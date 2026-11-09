import { sendError, httpErr } from "./_lib/sb.js";
import banket from "./_lib/open_banket.js";
import kinderfeest from "./_lib/open_kinderfeest.js";
import ronde from "./_lib/open_ronde.js";
import leden from "./_lib/open_leden.js";
import sponsor from "./_lib/open_sponsor.js";
import status from "./_lib/open_status.js";
import adres from "./_lib/open_adres.js";
import kalender from "./_lib/open_kalender.js";
import deel from "./_lib/open_deel.js";
import fuif from "./_lib/fuif.js";
import kassa from "./_lib/kassa.js";
import shop from "./_lib/shop.js";
import site from "./_lib/open_site.js";
import album from "./_lib/open_album.js";

// Eén serverfunctie voor de openbare pagina's (Vercel Hobby laat maximaal 12 functies toe).
// vercel.json stuurt /api/banket, /api/kinderfeest en /api/ronde hierheen met ?f=...
const H = { banket, kinderfeest, ronde, leden, sponsor, status, reglement: status, deel, adres, kalender, fuif, kassa, shop, site, sitefoto: site, album };

export default async function handler(req, res) {
  let f = String(req.query?.f || "");
  if (!H[f]) { const m = String(req.url || "").match(/\/api\/(banket|kinderfeest|ronde|leden|sponsor|status|reglement|deel|adres|kalender|fuif|kassa|shop|album)\b/); if (m) f = m[1]; }
  if (!H[f]) return sendError(res, httpErr(404, "Niet gevonden"));
  return H[f](req, res);
}
