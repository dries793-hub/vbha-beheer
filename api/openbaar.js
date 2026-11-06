import { sendError, httpErr } from "./_lib/sb.js";
import banket from "./_lib/open_banket.js";
import kinderfeest from "./_lib/open_kinderfeest.js";
import ronde from "./_lib/open_ronde.js";

// Eén serverfunctie voor de openbare pagina's (Vercel Hobby laat maximaal 12 functies toe).
// vercel.json stuurt /api/banket, /api/kinderfeest en /api/ronde hierheen met ?f=...
const H = { banket, kinderfeest, ronde };

export default async function handler(req, res) {
  let f = String(req.query?.f || "");
  if (!H[f]) { const m = String(req.url || "").match(/\/api\/(banket|kinderfeest|ronde)\b/); if (m) f = m[1]; }
  if (!H[f]) return sendError(res, httpErr(404, "Niet gevonden"));
  return H[f](req, res);
}
