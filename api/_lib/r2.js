import crypto from "node:crypto";
import { requireUser, httpErr, sendError, isDbCron, admin } from "./sb.js";

/* Cloudflare R2 (S3-compatibel) voor de fotoalbums.
   Nodig in Vercel: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
   De sleutels blijven op de server; de browser krijgt enkel tijdelijke, ondertekende links (presigned URLs). */
const env = k => String(process.env[k] || "").trim();
export const r2Aan = () => !!(env("R2_ACCOUNT_ID") && env("R2_ACCESS_KEY_ID") && env("R2_SECRET_ACCESS_KEY") && env("R2_BUCKET"));
// R2_JURISDICTION=eu voor een bucket met EU-jurisdictie (gegevens blijven in de EU)
export const r2Host = () => `${env("R2_ACCOUNT_ID")}${env("R2_JURISDICTION").toLowerCase() === "eu" ? ".eu" : ""}.r2.cloudflarestorage.com`;

const enc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
const hmac = (k, s) => crypto.createHmac("sha256", k).update(s).digest();
const sha = s => crypto.createHash("sha256").update(s).digest("hex");

// AWS Signature V4, ondertekening in de querystring (getest met het voorbeeld uit de AWS-documentatie)
export function presign({ method, host, uri, region, ak, sk, expires, now = new Date(), extra = {} }) {
  const amz = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""), d = amz.slice(0, 8), scope = `${d}/${region}/s3/aws4_request`;
  const q = { ...extra, "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": `${ak}/${scope}`, "X-Amz-Date": amz, "X-Amz-Expires": String(expires), "X-Amz-SignedHeaders": "host" };
  const cq = Object.keys(q).sort().map(k => enc(k) + "=" + enc(q[k])).join("&");
  const creq = [method, uri, cq, `host:${host}`, "", "host", "UNSIGNED-PAYLOAD"].join("\n");
  const sts = ["AWS4-HMAC-SHA256", amz, scope, sha(creq)].join("\n");
  const key = hmac(hmac(hmac(hmac("AWS4" + sk, d), region), "s3"), "aws4_request");
  return `https://${host}${uri}?${cq}&X-Amz-Signature=${crypto.createHmac("sha256", key).update(sts).digest("hex")}`;
}
const geldig = p => typeof p === "string" && (/^Albums\/[\w-]{3,80}\/(bron|mini|pub|klein)\/[\w-]{3,40}\.jpg$/.test(p) || p === "Albums/_test/bron/verbinding.jpg");
export function r2Url(method, pad, expires = 3600) {
  if (!geldig(pad)) throw httpErr(400, "Ongeldig pad");
  return presign({ method, host: r2Host(), uri: `/${enc(env("R2_BUCKET"))}/${pad.split("/").map(enc).join("/")}`, region: "auto", ak: env("R2_ACCESS_KEY_ID"), sk: env("R2_SECRET_ACCESS_KEY"), expires });
}
/* ---------- opslaglimiet: nooit boven het gratis deel van Cloudflare R2 (10 GB) ---------- */
export const LIMIET = 10 * 1000 ** 3;           // 10 GB
export const MAX = Math.floor(LIMIET * 0.97);   // harde grens met wat marge (opslag van mini/pub/klein en afrondingen)
const unxml = s => String(s).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
// som van de werkelijke grootte van alle bestanden in de bucket (ListObjectsV2, per 1000)
export async function r2Teller() {
  let bytes = 0, aantal = 0, token = null;
  for (let i = 0; i < 200; i++) {
    const extra = { "list-type": "2", "max-keys": "1000", ...(token ? { "continuation-token": token } : {}) };
    const u = presign({ method: "GET", host: r2Host(), uri: `/${enc(env("R2_BUCKET"))}`, region: "auto", ak: env("R2_ACCESS_KEY_ID"), sk: env("R2_SECRET_ACCESS_KEY"), expires: 300, extra });
    const r = await fetch(u); const t = await r.text();
    if (!r.ok) throw httpErr(502, "Cloudflare R2 antwoordt niet (" + r.status + ")");
    for (const m of t.matchAll(/<Size>(\d+)<\/Size>/g)) { bytes += Number(m[1]); aantal++; }
    const tr = /<IsTruncated>true<\/IsTruncated>/.test(t), nt = (t.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/) || [])[1];
    if (!tr || !nt) break; token = unxml(nt);
  }
  return { bytes, aantal };
}
// gebruik met een korte cache in config "r2gebruik" (zodat niet elke upload de hele bucket moet tellen)
export async function r2Gebruik(sb, { vers = false } = {}) {
  const { data } = await sb.from("config").select("data").eq("id", "r2gebruik").maybeSingle();
  const c = (data && data.data) || {};
  if (!vers && c.op && Date.now() - Date.parse(c.op) < 10 * 60 * 1000 && typeof c.bytes === "number") return c;
  const t = await r2Teller(); const n = { bytes: t.bytes, aantal: t.aantal, op: new Date().toISOString() };
  await sb.from("config").upsert({ id: "r2gebruik", data: n }); return n;
}
async function r2Bij(sb, c, extra) { await sb.from("config").upsert({ id: "r2gebruik", data: { ...c, bytes: c.bytes + extra } }); }
const ruimte = c => ({ gebruikt: c.bytes, limiet: LIMIET, max: MAX, procent: Math.round(c.bytes / LIMIET * 1000) / 10 });
export async function r2Wis(paden) {
  let fout = 0;
  for (let i = 0; i < paden.length; i += 8) await Promise.all(paden.slice(i, i + 8).filter(geldig).map(async p => { try { const r = await fetch(r2Url("DELETE", p, 300), { method: "DELETE" }); if (!r.ok && r.status !== 404) fout++; } catch { fout++; } }));
  return fout;
}

/* /api/mail?f=r2  (enkel bestuur)
   GET                         → {aan}
   POST {actie:"lees", paden}  → {urls:{pad:url}}  (bekijken, 1 uur geldig; elk bestuurslid)
   POST {actie:"schrijf", paden} → {urls}           (opladen met PUT, 15 min; enkel admin)
   POST {actie:"wis", paden}   → {fout}             (enkel admin) */
export default async function r2Api(req, res) {
  try {
    // controle van de instellingen door de beheerder (geplande-taaksleutel): opladen, lezen en wissen van een testbestand
    if (req.method === "POST" && await isDbCron(req)) {
      if (!r2Aan()) return res.status(200).json({ aan: false });
      const p = "Albums/_test/bron/verbinding.jpg", stap = {};
      try { const r = await fetch(r2Url("PUT", p, 300), { method: "PUT", body: "ok", headers: { "Content-Type": "image/jpeg" } }); stap.schrijven = r.status; } catch (e) { stap.schrijven = String(e.message || e).slice(0, 80); }
      try { const r = await fetch(r2Url("GET", p, 300)); stap.lezen = r.status; } catch (e) { stap.lezen = String(e.message || e).slice(0, 80); }
      try { const r = await fetch(r2Url("DELETE", p, 300), { method: "DELETE" }); stap.wissen = r.status; } catch (e) { stap.wissen = String(e.message || e).slice(0, 80); }
      let gebruik = null; try { gebruik = await r2Gebruik(admin(), { vers: true }); } catch (e) { gebruik = { fout: String(e.message || e).slice(0, 80) }; }
      return res.status(200).json({ aan: true, host: r2Host(), bucket: env("R2_BUCKET"), stap, gebruik });
    }
    if (req.method === "GET") { await requireUser(req); return res.status(200).json({ aan: r2Aan() }); }
    if (req.method !== "POST") throw httpErr(405, "Niet toegelaten");
    let b = req.body || {}; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
    const actie = String(b.actie || ""), paden = Array.isArray(b.paden) ? b.paden.slice(0, 500) : [];
    await requireUser(req, { write: actie !== "lees", functie: "fotos" });
    if (!r2Aan()) throw httpErr(503, "Cloudflare R2 is nog niet ingesteld");
    if (actie === "ruimte") { const sb = admin(); return res.status(200).json(ruimte(await r2Gebruik(sb, { vers: !!b.vers }))); }
    if (actie === "lees") { const urls = {}; for (const p of paden) if (geldig(p)) urls[p] = r2Url("GET", p, 3600); return res.status(200).json({ urls }); }
    if (actie === "schrijf") {
      // de browser geeft de grootte van wat hij gaat opladen mee; boven de grens weigert de server de opladlink
      const bytes = Math.max(0, Math.min(50 * 1000 ** 2 * paden.length, Number(b.bytes) || paden.length * 600 * 1000));
      const sb = admin(); const c = await r2Gebruik(sb);
      if (c.bytes + bytes > MAX) return res.status(507).json({ error: `De fotoruimte is vol (${(c.bytes / 1e9).toFixed(2).replace(".", ",")} van 10 GB gebruikt). Verwijder eerst oude albums of foto's.`, vol: true, ...ruimte(c) });
      const urls = {}; for (const p of paden) if (geldig(p)) urls[p] = r2Url("PUT", p, 900);
      await r2Bij(sb, c, bytes);
      return res.status(200).json({ urls, ...ruimte({ bytes: c.bytes + bytes }) });
    }
    if (actie === "wis") { const fout = await r2Wis(paden); const sb = admin(); await sb.from("config").upsert({ id: "r2gebruik", data: { op: null } }); return res.status(200).json({ fout }); }
    throw httpErr(400, "Onbekende actie");
  } catch (e) { return sendError(res, e); }
}
