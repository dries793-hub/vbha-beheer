import crypto from "node:crypto";
import { requireUser, httpErr, sendError, isDbCron } from "./sb.js";

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
export function presign({ method, host, uri, region, ak, sk, expires, now = new Date() }) {
  const amz = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""), d = amz.slice(0, 8), scope = `${d}/${region}/s3/aws4_request`;
  const q = { "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": `${ak}/${scope}`, "X-Amz-Date": amz, "X-Amz-Expires": String(expires), "X-Amz-SignedHeaders": "host" };
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
      return res.status(200).json({ aan: true, host: r2Host(), bucket: env("R2_BUCKET"), stap });
    }
    if (req.method === "GET") { await requireUser(req); return res.status(200).json({ aan: r2Aan() }); }
    if (req.method !== "POST") throw httpErr(405, "Niet toegelaten");
    let b = req.body || {}; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
    const actie = String(b.actie || ""), paden = Array.isArray(b.paden) ? b.paden.slice(0, 500) : [];
    await requireUser(req, { write: actie !== "lees", functie: "fotos" });
    if (!r2Aan()) throw httpErr(503, "Cloudflare R2 is nog niet ingesteld");
    if (actie === "lees" || actie === "schrijf") {
      const urls = {}; for (const p of paden) if (geldig(p)) urls[p] = r2Url(actie === "lees" ? "GET" : "PUT", p, actie === "lees" ? 3600 : 900);
      return res.status(200).json({ urls });
    }
    if (actie === "wis") return res.status(200).json({ fout: await r2Wis(paden) });
    throw httpErr(400, "Onbekende actie");
  } catch (e) { return sendError(res, e); }
}
