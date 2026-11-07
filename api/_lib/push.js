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
    let voorkeur = null;
    if (req.query && req.query.endpoint) {
      const id = crypto.createHash("sha256").update(String(req.query.endpoint)).digest("hex").slice(0, 40);
      const { data: a } = await sb.from("push_abonnementen").select("voorkeur").eq("id", id).eq("user_id", user.id).maybeSingle();
      if (a) voorkeur = { ...VOORKEUR_DEF, ...(a.voorkeur || {}) };
    }
    return res.status(200).json({ sleutel: k.publiek, toestellen: count || 0, voorkeur, standaard: VOORKEUR_DEF });
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
  if (b.actie === "voorkeur") {
    const id = crypto.createHash("sha256").update(String(b.endpoint || "")).digest("hex").slice(0, 40), v = b.voorkeur || {};
    const dagen = [...new Set((Array.isArray(v.dagen) ? v.dagen : []).map(Number).filter(n => [0, 1, 3, 5].includes(n)))].sort((x, y) => x - y);
    const uur = Math.round(Number(v.uur)); if (!(uur >= 6 && uur <= 22)) throw httpErr(400, "Kies een uur tussen 6u en 22u.");
    const voorkeur = { uur, dagen, vergaderingen: v.vergaderingen !== false, activiteiten: v.activiteiten !== false, meldingen: v.meldingen !== false };
    const { data, error } = await sb.from("push_abonnementen").update({ voorkeur }).eq("id", id).eq("user_id", user.id).select("id");
    if (error) throw error;
    if (!data || !data.length) throw httpErr(404, "Dit toestel is nog niet aangemeld voor meldingen.");
    return res.status(200).json({ ok: true, voorkeur });
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

/* ---------- herinneringen vóór vergaderingen en activiteiten (geplande taak, elk uur) ----------
   Per toestel kiest de gebruiker het uur en hoeveel op voorhand (zelfde dag, 1, 3 en/of 5 dagen); config herinneringen.push.aan = hoofdschakelaar. */
export const VOORKEUR_DEF = { uur: 9, dagen: [0], vergaderingen: true, activiteiten: true, meldingen: true };
export const PUSH_DEF = { aan: true };
const plusD = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const wanneer = n => n === 0 ? "Vandaag" : n === 1 ? "Morgen" : "Over " + n + " dagen";
const dagKort = iso => new Date(iso + "T12:00:00Z").toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
export async function pushVanDaag(sb, cfg, vandaag, uurNu) {
  const P = { ...PUSH_DEF, ...(cfg.push || {}) };
  if (!P.aan) return { uit: true };
  const { data: abo, error } = await sb.from("push_abonnementen").select("id,endpoint,p256dh,auth,user_id,voorkeur,laatste_dag");
  if (error) throw error;
  const nu = (abo || []).filter(a => { const v = { ...VOORKEUR_DEF, ...(a.voorkeur || {}) }; return Number(v.uur) === uurNu && a.laatste_dag !== vandaag && v.dagen.length && (v.vergaderingen || v.activiteiten); });
  if (!nu.length) return { gedaan: false };
  const tot = plusD(vandaag, 5);
  const [{ data: verg }, { data: act }] = await Promise.all([
    sb.from("vergaderingen").select("id,data").gte("data->>datum", vandaag).lte("data->>datum", tot),
    sb.from("activiteiten").select("id,data").gte("data->>datum", vandaag).lte("data->>datum", tot)]);
  const A = await algemeen(sb), bk = await configDoc(sb, "banket"), kf = await configDoc(sb, "kf_" + A.jaar);
  const V = (verg || []).map(r => ({ soort: "vergaderingen", datum: r.data.datum, titel: (r.data.titel && r.data.titel !== r.data.soort ? r.data.titel : r.data.soort || "Vergadering"), uur: r.data.uur, loc: r.data.locatie, url: "/#agenda", tag: "verg-" + r.id }));
  const C = (act || []).map(r => ({ soort: "activiteiten", datum: r.data.datum, titel: r.data.titel || "Activiteit", uur: r.data.uur, loc: r.data.locatie, url: "/#agenda", tag: "act-" + r.id }));
  const bd = bk.datum || A.jaar + "-12-12"; if (bd >= vandaag && bd <= tot) C.push({ soort: "activiteiten", datum: bd, titel: "Banket", uur: bk.uur, loc: bk.locatie, url: "/#banket", tag: "banket" });
  if (kf.datum && kf.datum >= vandaag && kf.datum <= tot) C.push({ soort: "activiteiten", datum: kf.datum, titel: "Kinderfeest", uur: kf.tijd, loc: kf.locatie, url: "/#kinderfeest", tag: "kinderfeest" });
  const k = await vapid(sb), uit = [];
  for (const a of nu) {
    const v = { ...VOORKEUR_DEF, ...(a.voorkeur || {}) };
    const items = [...(v.vergaderingen ? V : []), ...(v.activiteiten ? C : [])].map(x => ({ ...x, n: Math.round((Date.parse(x.datum + "T12:00:00Z") - Date.parse(vandaag + "T12:00:00Z")) / 864e5) })).filter(x => v.dagen.includes(x.n));
    await sb.from("push_abonnementen").update({ laatste_dag: vandaag }).eq("id", a.id);
    for (const x of items) {
      const bericht = { titel: `${wanneer(x.n)}: ${x.titel} VBHA${x.uur ? " om " + x.uur : ""}`, tekst: [x.n > 1 ? dagKort(x.datum) : "", x.loc || ""].filter(Boolean).join(" · "), url: x.url, tag: x.tag + "-" + x.n };
      try { uit.push(await stuurEen(sb, k, a, bericht)); } catch (e) { uit.push({ ok: false, fout: e.message }); }
    }
  }
  return { gedaan: true, toestellen: nu.length, verstuurd: uit.filter(x => x.ok).length };
}

/* ---------- meteen een melding bij nieuwe dashboardmeldingen ----------
   groep "iedereen" (alle bestuursleden) of "boek" (admin, bewerker, boekhouder). Fouten breken nooit de eigenlijke actie. */
const GROEP = { iedereen: null, boek: ["admin", "bewerker", "boekhouder"] };
export async function meldPush(sb, groep, bericht) {
  try {
    const { data: c } = await sb.from("config").select("data").eq("id", "herinneringen").maybeSingle();
    if ((((c && c.data) || {}).push || {}).aan === false) return { uit: true };
    let users = null;
    if (GROEP[groep]) { const { data: b } = await sb.from("bestuur").select("user_id").in("rol", GROEP[groep]); users = (b || []).map(x => x.user_id); if (!users.length) return { niemand: true }; }
    let q = sb.from("push_abonnementen").select("id,endpoint,p256dh,auth,user_id,voorkeur");
    if (users) q = q.in("user_id", users);
    const { data: abo } = await q;
    const L = (abo || []).filter(a => !a.voorkeur || a.voorkeur.meldingen !== false);
    if (!L.length) return { toestellen: 0 };
    const k = await vapid(sb);
    const uit = await Promise.all(L.map(a => stuurEen(sb, k, a, bericht).catch(e => ({ ok: false, fout: e.message }))));
    return { toestellen: L.length, ok: uit.filter(x => x.ok).length };
  } catch (e) { console.error("meldPush", e); return { fout: e.message }; }
}
