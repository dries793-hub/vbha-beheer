import { sendError, httpErr } from "./_lib/sb.js";
import banket from "./_lib/open_banket.js";
import kinderfeest from "./_lib/open_kinderfeest.js";
import ronde from "./_lib/open_ronde.js";
import leden from "./_lib/open_leden.js";
import sponsor from "./_lib/open_sponsor.js";
import status from "./_lib/open_status.js";
import deel from "./_lib/open_deel.js";

// Eén serverfunctie voor de openbare pagina's (Vercel Hobby laat maximaal 12 functies toe).
// vercel.json stuurt /api/banket, /api/kinderfeest en /api/ronde hierheen met ?f=...
// TIJDELIJK: SRI-hashes van de CDN-bibliotheken berekenen over de echte bytes
import crypto from "node:crypto";
async function sritmp(req, res) { const U = ["https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js","https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js","https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js","https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js","https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js"];
  const out = {}; for (const u of U) { const b = Buffer.from(await (await fetch(u)).arrayBuffer()); out[u] = "sha512-" + crypto.createHash("sha512").update(b).digest("base64"); } res.status(200).json(out); }
const H = { banket, kinderfeest, ronde, leden, sponsor, status, reglement: status, deel, sritmp };

export default async function handler(req, res) {
  let f = String(req.query?.f || "");
  if (!H[f]) { const m = String(req.url || "").match(/\/api\/(banket|kinderfeest|ronde|leden|sponsor|status|reglement|deel)\b/); if (m) f = m[1]; }
  if (!H[f]) return sendError(res, httpErr(404, "Niet gevonden"));
  return H[f](req, res);
}
