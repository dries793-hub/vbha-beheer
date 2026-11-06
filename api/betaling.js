import { admin, sendError, httpErr } from "./_lib/sb.js";
import { bcConfigured } from "./_lib/bancontact.js";
import { startBetaling, controleerBetaling, BETAALTABELLEN } from "./_lib/betaal.js";

// Openbaar, maar enkel met het geheime token dat de inschrijver na het inschrijven kreeg.
// GET  ?t=leden|banket&id=&token=  -> status van de betaling
// POST {t, id, token}              -> nieuwe betaling starten (bv. als de vorige verlopen is)
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (!bcConfigured()) throw httpErr(501, "Online betalen is niet ingesteld");
    const b = req.method === "POST" ? (typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {})) : (req.query || {});
    const tabel = BETAALTABELLEN.includes(b.t) ? b.t : "leden";
    const id = String(b.id || ""), token = String(b.token || "");
    if (!id || !token) throw httpErr(400, "Ontbrekende gegevens");
    const sb = admin();
    const { data: row } = await sb.from(tabel).select("id,data").eq("id", id).maybeSingle();
    if (!row || !row.data?.betaalToken || row.data.betaalToken !== token) throw httpErr(404, "Niet gevonden");
    if (req.method === "POST") {
      const cur = row.data.betaling || {};
      const bt = await startBetaling(sb, req, tabel, row, { bedrag: cur.bedrag || row.data.teBetalen || row.data.lidgeldBedrag, jaar: cur.jaar || row.data.jaar || row.data.lidSinds });
      return res.status(200).json(publiek(bt));
    }
    if (req.method !== "GET") throw httpErr(405, "Gebruik GET of POST");
    res.status(200).json(publiek(await controleerBetaling(sb, tabel, row)));
  } catch (e) { sendError(res, e); }
}

const publiek = b => b ? { status: b.status, deeplink: b.deeplink, qrcode: b.qrcode, checkout: b.checkout, verlooptOp: b.verlooptOp, bedrag: b.bedrag } : { status: null };
