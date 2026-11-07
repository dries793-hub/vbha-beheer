import crypto from "node:crypto";
import { admin, requireUser, httpErr } from "./sb.js";
import { configDoc, algemeen } from "./publiek.js";

/* ============ Pushmeldingen (Web Push, zonder extra pakketten) ============
   - Sleutelpaar (VAPID) in de afgeschermde tabel push_sleutel, aangemaakt bij het eerste gebruik.
   - Toestellen in de afgeschermde tabel push_abonnementen (enkel via deze server).
   - Versleuteling volgens RFC 8291 (aes128gcm), aanmelding bij de pushdienst volgens RFC 8292 (VAPID).
   - Dagelijkse melding op de dag van een activiteit of vergadering: config "herinneringen".push = {aan, uur, activiteiten, vergaderingen}. */

const b64u = b => Buffer.from(b).toString("base64url");
const unb64u = s => Buffer.from(String(s).replace(/=+$/, ""), "base64url");
const hmac = (k, d) => crypto.createHmac("sha256", k).update(d).digest();

export async function vapid(sb) {
  let { data } = await sb.from("push_sleutel").select("publiek,prive").eq("id", 1).maybeSingle();
  if (data) return data;
  const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const j = privateKey.export({ format: "jwk" });
  const rij = { id: 1, publiek: b64u(Buffer.concat([Buffer.from([4]), unb64u(j.x), unb64u(j.y)])), prive: j.d };
  await sb.from("push_sleutel").upsert(rij, { onConflict: "id", ignoreDuplicates: true });
  ({ data } = await sb.from("push_sleutel").select("publiek,prive").eq("id", 1).maybeSingle());
  return data;
}

export function vapidKop(endpoint, k) {
  const aud = new URL(endpoint).origin;
  const pub = unb64u(k.publiek);
  const key = crypto.createPrivateKey({ key: { kty: "EC", crv: "P-256", x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)), d: k.prive }, format: "jwk" });
  const kop = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const inhoud = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:" + (process.env.PUSH_CONTACT || "bestuur@vbha.be") }));
  const sig = crypto.sign("sha256", Buffer.from(kop + "." + inhoud), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${kop}.${inhoud}.${b64u(sig)}, k=${k.publiek}`;
}

// RFC 8291: versleutel de inhoud voor één toestel
export function versleutel(tekst, p256dh, auth) {
  const uaPub = unb64u(p256dh), geheim = unb64u(auth);
  const ecdh = crypto.createECDH("prime256v1"); ecdh.generateKeys();
  const asPub = ecdh.getPublicKey(), gedeeld = ecdh.computeSecret(uaPub);
  const zout = crypto.randomBytes(16);
  const ikm = hmac(hmac(geheim, gedeeld), Buffer.concat([Buffer.from("WebPush: info\0"), uaPub, asPub, Buffer.from([1])]));
  const prk = hmac(zout, ikm);
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01", "latin1")).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01", "latin1")).subarray(0, 12);
  const c = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const ct = Buffer.concat([c.update(Buffer.concat([Buffer.from(tekst, "utf8"), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([zout, rs, Buffer.from([asPub.length]), asPub, ct]);
}

async function stuurEen(sb, k, a, bericht) {
  const r = await fetch(a.endpoint, {
    method: "POST",
    headers: { TTL: "43200", Urgency: "normal", "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", Authorization: vapidKop(a.endpoint, k) },
    body: versleutel(JSON.stringify(bericht), a.p256dh, a.auth),
  });
  if (r.status === 404 || r.status === 410) { await sb.from("push_abonnementen").delete().eq("id", a.id); return { ok: false, weg: true }; }
  if (r.status >= 200 && r.status < 300) { await sb.from("push_abonnementen").update({ laatst_ok: new Date().toISOString() }).eq("id", a.id); return { ok: true }; }
  return { ok: false, fout: r.status + " " + (await r.text().catch(() => "")).slice(0, 200) };
}
export async function stuurPush(sb, bericht, { userId } = {}) {
  const k = await vapid(sb);
  let q = sb.from("push_abonnementen").select("id,endpoint,p256dh,auth,user_id");
  if (userId) q = q.eq("user_id", userId);
  const { data, error } = await q;
  if (error) throw error;
  const uit = [];
  for (const a of data || []) { try { uit.push(await stuurEen(sb, k, a, bericht)); } catch (e) { uit.push({ ok: false, fout: e.message }); } }
  return { toestellen: (data || []).length, ok: uit.filter(x => x.ok).length, uit };
}

/* ---------- api: /api/mail?f=push  (aangemeld) ---------- */
// GET -> {sleutel, toestellen}   POST {actie: abonneer|stop|test, abonnement, toestel, endpoint}
export async function pushApi(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const { user, sb } = await requireUser(req);
  if (req.method === "GET") {
    const k = await vapid(sb);
    const { count } = await sb.from("push_abonnementen").select("id", { count: "exact", head: true }).eq("user_id", user.id);
    return res.status(200).json({ sleutel: k.publiek, toestellen: count || 0 });
  }
  if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");
  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  if (b.actie === "abonneer") {
    const s = b.abonnement || {}, ep = String(s.endpoint || "");
    if (!/^https:\/\//.test(ep) || !s.keys || !s.keys.p256dh || !s.keys.auth) throw httpErr(400, "Ongeldig abonnement");
    const id = crypto.createHash("sha256").update(ep).digest("hex").slice(0, 40);
    const { error } = await sb.from("push_abonnementen").upsert({ id, user_id: user.id, endpoint: ep, p256dh: String(s.keys.p256dh), auth: String(s.keys.auth), toestel: String(b.toestel || "").slice(0, 120) });
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  if (b.actie === "stop") {
    const id = crypto.createHash("sha256").update(String(b.endpoint || "")).digest("hex").slice(0, 40);
    await sb.from("push_abonnementen").delete().eq("id", id).eq("user_id", user.id);
    return res.status(200).json({ ok: true });
  }
  if (b.actie === "test") {
    const r = await stuurPush(sb, { titel: "Testmelding VBHA", tekst: "Pushmeldingen werken op dit toestel.", url: "/#herinneringen", tag: "test" }, { userId: user.id });
    if (!r.toestellen) throw httpErr(400, "Er is nog geen toestel aangemeld voor meldingen.");
    if (!r.ok) throw httpErr(502, "De melding kon niet afgeleverd worden" + (r.uit[0] && r.uit[0].fout ? " (" + r.uit[0].fout + ")" : "") + ".");
    return res.status(200).json(r);
  }
  throw httpErr(400, "Onbekende actie");
}

/* ---------- dagelijkse melding (vanuit de geplande taak van de herinneringen, elk uur) ---------- */
export const PUSH_DEF = { aan: true, uur: 9, activiteiten: true, vergaderingen: true };
export async function pushVanDaag(sb, cfg, vandaag, uurNu) {
  const P = { ...PUSH_DEF, ...(cfg.push || {}) };
  if (!P.aan || uurNu !== Number(P.uur) || cfg.pushDag === vandaag) return { gedaan: false };
  const items = [];
  if (P.vergaderingen) {
    const { data } = await sb.from("vergaderingen").select("id,data").eq("data->>datum", vandaag);
    for (const r of data || []) { const v = r.data || {}; items.push({ titel: (v.titel && v.titel !== v.soort ? v.titel : v.soort || "Vergadering") + " VBHA" + (v.uur ? " om " + v.uur : ""), tekst: v.locatie || "", url: "/#agenda", tag: "verg-" + r.id }); }
  }
  if (P.activiteiten) {
    const { data } = await sb.from("activiteiten").select("id,data").eq("data->>datum", vandaag);
    for (const r of data || []) { const a = r.data || {}; items.push({ titel: (a.titel || "Activiteit") + " VBHA" + (a.uur ? " om " + a.uur : ""), tekst: a.locatie || "", url: "/#agenda", tag: "act-" + r.id }); }
    const A = await algemeen(sb), bk = await configDoc(sb, "banket"), kf = await configDoc(sb, "kf_" + A.jaar);
    if ((bk.datum || A.jaar + "-12-12") === vandaag) items.push({ titel: "Banket VBHA" + (bk.uur ? " om " + bk.uur : ""), tekst: bk.locatie || "", url: "/#banket", tag: "banket" });
    if (kf.datum && kf.datum === vandaag) items.push({ titel: "Kinderfeest VBHA" + (kf.tijd ? " om " + kf.tijd : ""), tekst: kf.locatie || "", url: "/#kinderfeest", tag: "kinderfeest" });
  }
  const { data: rij } = await sb.from("config").select("data").eq("id", "herinneringen").maybeSingle();
  await sb.from("config").upsert({ id: "herinneringen", data: { ...((rij && rij.data) || {}), pushDag: vandaag } });
  const uit = [];
  for (const m of items) uit.push({ tag: m.tag, ...(await stuurPush(sb, m)) });
  return { gedaan: true, items: uit };
}
