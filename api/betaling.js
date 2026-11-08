import { admin, sendError, httpErr, requireUser } from "./_lib/sb.js";
import { onlineConfigured, providerNaam } from "./_lib/betaalprovider.js";
import { testSleutel, verken } from "./_lib/bancontact.js";
import { startBetaling, controleerBetaling, BETAALTABELLEN } from "./_lib/betaal.js";
import { klopt } from "./_lib/lidlink.js";
import { algemeen } from "./_lib/publiek.js";
import { epcPayload, qrSvg } from "./_lib/epc.js";
import { factuurPubliek } from "./_lib/factuur.js";
import { sponsorLink } from "./_lib/open_sponsor.js";
import { steunBetaling } from "./_lib/steun.js";

// Openbaar, maar enkel met het geheime token dat de inschrijver na het inschrijven kreeg.
// GET  ?t=leden|banket&id=&token=  -> status van de betaling
// POST {t, id, token}              -> nieuwe betaling starten (bv. als de vorige verlopen is)
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    // ?test=bancontact : controleert alleen of de Bancontact-sleutel aanvaard wordt (er wordt niets betaald of bewaard)
    // testen van de Bancontact-koppeling: enkel voor een aangemelde administrator
    if (req.method === "GET" && (req.query?.test === "bancontact" || req.query?.test === "verken")) await requireUser(req, { write: true });
    if (req.method === "GET" && req.query?.test === "bancontact") return res.status(200).json({ provider: onlineConfigured() ? providerNaam() : null, ...(await testSleutel()) });
    if (req.method === "GET" && req.query?.test === "verken") return res.status(200).json(await verken());
    const b = req.method === "POST" ? (typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {})) : (req.query || {});
    if (b.steun) return await steunBetaling(req, res, b); // vrije steun met eigen bedrag en mededeling (/steun, vbha.be)
    if (b.l) return await lidgeldLink(req, res, b);
    if (b.sp) return await sponsorLink(req, res, b, { startBetaling, controleerBetaling }); // betaallink sponsoring (zonder factuur)
    if (b.fa) return await factuurPubliek(req, res, b, { onlineConfigured, startBetaling, controleerBetaling }); // betaallink uit een factuurmail
    if (!onlineConfigured()) throw httpErr(501, "Online betalen is niet ingesteld");
    const tabel = ["leden", "banket", "tickets"].includes(b.t) ? b.t : "leden";
    const id = String(b.id || ""), token = String(b.token || "");
    if (!id || !token) throw httpErr(400, "Ontbrekende gegevens");
    const sb = admin();
    const { data: row } = await sb.from(tabel).select("id,data").eq("id", id).maybeSingle();
    if (!row || !row.data?.betaalToken || row.data.betaalToken !== token) throw httpErr(404, "Niet gevonden");
    if (req.method === "POST") {
      const cur = row.data.betaling || {};
      const bt = await startBetaling(sb, req, tabel, row, { bedrag: cur.bedrag || row.data.teBetalen || row.data.lidgeldBedrag || row.data.bedrag, jaar: cur.jaar || row.data.jaar || row.data.lidSinds, ...(tabel === "tickets" ? { terug: "/fuif?betaling=terug" } : {}) });
      return res.status(200).json(publiek(bt));
    }
    if (req.method !== "GET") throw httpErr(405, "Gebruik GET of POST");
    res.status(200).json(publiek(await controleerBetaling(sb, tabel, row)));
  } catch (e) { sendError(res, e); }
}

const publiek = b => b ? { status: b.status, deeplink: b.deeplink, qrcode: b.qrcode, checkout: b.checkout, provider: b.provider || null, verlooptOp: b.verlooptOp, bedrag: b.bedrag } : { status: null };

// Betaallink uit een lidgeldmail (bestaand lid): ?l=lidId&j=jaar&b=bedrag&t=handtekening
// GET -> gegevens + status, POST -> online betaling starten
async function lidgeldLink(req, res, b) {
  const l = String(b.l), j = String(b.j), bedrag = Number(b.b), t = String(b.t || "");
  if (!klopt(l, j, bedrag, t)) throw httpErr(404, "Deze betaallink is ongeldig. Gebruik de link uit de laatste mail of neem contact op met het bestuur.");
  const sb = admin();
  const { data: row } = await sb.from("leden").select("id,data").eq("id", l).maybeSingle();
  if (!row) throw httpErr(404, "Dit lid werd niet gevonden. Neem contact op met het bestuur.");
  const d = row.data || {};
  const terug = `/lidgeld?l=${encodeURIComponent(l)}&j=${j}&b=${bedrag}&t=${encodeURIComponent(t)}&betaling=terug`;
  const cur = d.betaling && String(d.betaling.jaar) === j && Number(d.betaling.bedrag) === bedrag ? d.betaling : null;
  if (req.method === "POST") {
    if (!onlineConfigured()) throw httpErr(501, "Online betalen is niet ingesteld");
    const bt = await startBetaling(sb, req, "leden", row, { bedrag, jaar: j, terug });
    return res.status(200).json(publiek(bt));
  }
  if (req.method !== "GET") throw httpErr(405, "Gebruik GET of POST");
  const I = await algemeen(sb);
  const { data: jl } = await sb.from("jaarleden").select("data").eq("id", j + "_" + l).maybeSingle();
  let online = null;
  if (cur && cur.id && onlineConfigured()) { try { online = publiek(await controleerBetaling(sb, "leden", row)); } catch (e) { online = publiek(cur); } }
  const mededeling = `${d.naam || ""} ${d.voornaam || ""} lidgeld ${j}`.replace(/\s+/g, " ").trim();
  let qr = null;
  try { qr = qrSvg(epcPayload({ naam: I.vereniging, iban: I.rekeningnummer, bedrag, mededeling })); } catch (e) { console.error("QR", e); }
  res.status(200).json({
    voornaam: d.voornaam || "", jaar: j, bedrag, mededeling, rekeningnummer: I.rekeningnummer, begunstigde: I.vereniging, qr,
    betaald: (jl && jl.data && jl.data.lidgeld === "OK") || (online && online.status === "SUCCEEDED"), online, kanOnline: onlineConfigured(),
  });
}
