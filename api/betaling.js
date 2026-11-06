import { admin, sendError, httpErr } from "./_lib/sb.js";
import { bcConfigured } from "./_lib/bancontact.js";
import { startBetaling, controleerBetaling, startBanketBetaling, controleerBanketBetaling } from "./_lib/betaal.js";

// Openbaar, maar enkel met het geheime token dat de inschrijver na het inschrijven kreeg.
// GET  ?id=&token=  -> status van de betaling (en lidgeld op betaald zetten als ze gelukt is)
// POST {id, token}  -> nieuwe betaling starten (bv. als de vorige verlopen is)
// Met soort=banket gaat het om een banketinschrijving in plaats van een lid.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (!bcConfigured()) throw httpErr(501, "Online betalen is niet ingesteld");
    const b = req.method === "POST" ? (typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {})) : (req.query || {});
    const id = String(b.id || ""), token = String(b.token || "");
    if (!id || !token) throw httpErr(400, "Ontbrekende gegevens");
    const sb = admin();
    if (String(b.soort || "") === "banket") {
      const { data: br } = await sb.from("banket").select("id,data").eq("id", id).maybeSingle();
      if (!br || !br.data?.betaalToken || br.data.betaalToken !== token) throw httpErr(404, "Niet gevonden");
      if (req.method === "POST") return res.status(200).json(publiek(await startBanketBetaling(sb, req, br)));
      if (req.method !== "GET") throw httpErr(405, "Gebruik GET of POST");
      return res.status(200).json(publiek(await controleerBanketBetaling(sb, br)));
    }
    const { data: row } = await sb.from("leden").select("id,data").eq("id", id).maybeSingle();
    if (!row || !row.data?.betaalToken || row.data.betaalToken !== token) throw httpErr(404, "Niet gevonden");
    if (req.method === "POST") {
      const cur = row.data.betaling || {};
      const bt = await startBetaling(sb, req, row, { bedrag: cur.bedrag || row.data.lidgeldBedrag, jaar: cur.jaar || row.data.lidSinds });
      return res.status(200).json(publiek(bt));
    }
    if (req.method !== "GET") throw httpErr(405, "Gebruik GET of POST");
    const bt = await controleerBetaling(sb, row);
    res.status(200).json(publiek(bt));
  } catch (e) { sendError(res, e); }
}

const publiek = b => b ? { status: b.status, deeplink: b.deeplink, qrcode: b.qrcode, checkout: b.checkout, verlooptOp: b.verlooptOp, bedrag: b.bedrag } : { status: null };
