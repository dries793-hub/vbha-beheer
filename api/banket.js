import { admin, sendError, httpErr, selectAll } from "./_lib/sb.js";
import { epcPayload, qrSvg } from "./_lib/epc.js";
import crypto from "node:crypto";
import { bcConfigured } from "./_lib/bancontact.js";
import { startBanketBetaling } from "./_lib/betaal.js";

// Openbare inschrijfpagina voor het banket (geen login nodig).
// GET  -> gegevens voor de pagina: datum, locatie, prijs en de namen van de actieve leden
// POST -> bewaart de inschrijving in de tabel 'banket' (id = jaar_lidId)

const DEF_IBAN = "BE43 9730 6810 0401";
export const BANKET_DEF = { prijs: 65, deadline: "1 december", datum: "Zaterdag 12 december", uur: "19u00", locatie: "Feestzaal De Snip, Beugemstraat 9, Moorsel", open: true };
const MENUS = ["Normaal", "Vegetarisch"];
const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

async function info(sb) {
  const { data: rows } = await sb.from("config").select("id,data").in("id", ["algemeen", "banket"]);
  const c = rows?.find(r => r.id === "algemeen")?.data || {};
  const b = { ...BANKET_DEF, ...(rows?.find(r => r.id === "banket")?.data || {}) };
  const jaar = Number(c.actiefJaar) || new Date().getFullYear();
  return { jaar, vereniging: c.vereniging || "Vriendenkring Brandweer Hoofdpost Aalst", rekeningnummer: c.rekeningnummer || DEF_IBAN,
    prijs: Number(b.prijs) || BANKET_DEF.prijs, deadline: b.deadline, datum: b.datum, uur: b.uur, locatie: b.locatie, open: b.open !== false, online: bcConfigured() };
}

// Actieve leden van het jaar: zelfde regel als in de app (lid sinds <= jaar, lid tot leeg of >= jaar).
async function actieveLeden(sb, jaar) {
  const rows = await selectAll(sb, "leden");
  return rows.map(r => ({ id: r.id, ...r.data }))
    .filter(l => l.naam && (!l.lidSinds || Number(l.lidSinds) <= jaar) && (!l.lidTot || Number(l.lidTot) >= jaar) && !l.dubbelVan)
    .map(l => ({ id: l.id, naam: `${l.naam} ${l.voornaam || ""}`.trim() }))
    .sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const sb = admin();
    const I = await info(sb);
    if (req.method === "GET") return res.status(200).json({ ...I, leden: I.open ? await actieveLeden(sb, I.jaar) : [] });
    if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");
    if (!I.open) throw httpErr(403, "De inschrijvingen voor het banket zijn afgesloten.");

    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    if (b.website) return res.status(200).json({ ok: true });
    if (Number(b.duur) > 0 && Number(b.duur) < 2500) throw httpErr(400, "Dat ging wel erg snel. Probeer het opnieuw.");

    const leden = await actieveLeden(sb, I.jaar);
    const lid = leden.find(l => l.id === String(b.lidId || ""));
    if (!lid) throw httpErr(400, "Kies je naam uit de ledenlijst.");
    const personen = Number(b.personen) === 2 ? 2 : Number(b.personen) === 1 ? 1 : 0;
    if (!personen) throw httpErr(400, "Kies of je alleen of met partner komt.");
    const menu1 = clean(b.menu1, 20), menu2 = clean(b.menu2, 20);
    if (!MENUS.includes(menu1)) throw httpErr(400, "Kies je menu.");
    if (personen === 2 && !MENUS.includes(menu2)) throw httpErr(400, "Kies het menu voor je partner.");

    const uurGeleden = new Date(Date.now() - 3600 * 1000).toISOString();
    const { count } = await sb.from("banket").select("id", { count: "exact", head: true }).gte("data->>ingediend", uurGeleden);
    if ((count || 0) >= 60) throw httpErr(429, "Er zijn net veel inschrijvingen binnengekomen. Probeer het later opnieuw.");

    const id = I.jaar + "_" + lid.id;
    const mededeling = `${lid.naam} Banket ${I.jaar}`;
    const { data: bestaand } = await sb.from("banket").select("id").eq("id", id).maybeSingle();
    if (bestaand) throw httpErr(409, `${lid.naam} is al ingeschreven voor het banket. Wil je iets wijzigen, laat het dan weten aan het bestuur.`);

    const bedrag = personen * I.prijs;
    const token = I.online ? crypto.randomBytes(18).toString("base64url") : null;
    const data = { jaar: I.jaar, lidId: lid.id, naam: lid.naam, personen, menu1, menu2: personen === 2 ? menu2 : "", opmerking: clean(b.opmerking, 500),
      bedrag, bron: "formulier", ingediend: new Date().toISOString(), nieuw: true, ...(token ? { betaalToken: token } : {}) };
    const { error } = await sb.from("banket").insert({ id, data });
    if (error) { if (error.code === "23505") throw httpErr(409, `${lid.naam} is al ingeschreven voor het banket.`); throw error; }

    let qr = null;
    try { qr = qrSvg(epcPayload({ naam: I.vereniging, iban: I.rekeningnummer, bedrag, mededeling })); } catch (e) { console.error("QR", e); }
    let online = null;
    if (token) {
      try {
        const bt = await startBanketBetaling(sb, req, { id, data });
        online = { id, token, deeplink: bt.deeplink, qrcode: bt.qrcode, checkout: bt.checkout, verlooptOp: bt.verlooptOp };
      } catch (e) { console.error("Bancontact", e); }
    }
    res.status(200).json({ ok: true, jaar: I.jaar, naam: lid.naam, personen, bedrag, rekeningnummer: I.rekeningnummer, begunstigde: I.vereniging, mededeling, qr, online });
  } catch (e) { sendError(res, e); }
}
