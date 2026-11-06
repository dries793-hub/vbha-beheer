import { admin, sendError, httpErr } from "./_lib/sb.js";
import { epcPayload, qrSvg } from "./_lib/epc.js";
import crypto from "node:crypto";
import { bcConfigured } from "./_lib/bancontact.js";
import { startBetaling } from "./_lib/betaal.js";

// Openbaar inschrijfformulier voor nieuwe leden (geen login nodig).
// GET  -> gegevens voor het formulier (categorieën, lidgeld, rekeningnummer)
// POST -> voegt het lid toe aan de ledenlijst, gemarkeerd als "nieuw"

const DEF_CATS = ["Ploeg 1", "Ploeg 2", "Ploeg 3", "Ploeg 4", "Vrijwilligers", "Administratie", "Erewacht"];
const NIET_KIESBAAR = new Set(["Officieren"]);
const DEF_IBAN = "BE43 9730 6810 0401";

const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const slug = s => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

async function info(sb) {
  const { data: cfgRow } = await sb.from("config").select("data").eq("id", "algemeen").maybeSingle();
  const c = cfgRow?.data || {};
  const jaar = Number(c.actiefJaar) || new Date().getFullYear();
  const { data: jRow } = await sb.from("jaren").select("data").eq("id", String(jaar)).maybeSingle();
  // zelfde regel als in de app: erewacht betaalt het erewachttarief, alle anderen het gewone lidgeld
  const lg = jRow?.data?.lidgeld || {};
  const gewoon = Number(lg.gewoon) || 30, erewacht = Number(lg.erewacht) || 20;
  const cats = (Array.isArray(c.ledenCategorieen) && c.ledenCategorieen.length ? c.ledenCategorieen : DEF_CATS).filter(k => !NIET_KIESBAAR.has(k));
  // erewacht achteraan, zoals in het oude formulier
  cats.sort((a, b) => (a === "Erewacht") - (b === "Erewacht"));
  const tarieven = Object.fromEntries(cats.map(k => [k, k === "Erewacht" ? erewacht : gewoon]));
  return { online: bcConfigured(), vereniging: c.vereniging || "Vriendenkring Brandweer Hoofdpost Aalst", rekeningnummer: c.rekeningnummer || DEF_IBAN, jaar, bedrag: gewoon, gewoon, erewacht, categorieen: cats, tarieven };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const sb = admin();
    if (req.method === "GET") return res.status(200).json(await info(sb));
    if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");

    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    // eenvoudige spambescherming: verborgen veld en minimale invultijd
    if (b.website) return res.status(200).json({ ok: true });
    if (Number(b.duur) > 0 && Number(b.duur) < 2500) throw httpErr(400, "Dat ging wel erg snel. Probeer het opnieuw.");

    const I = await info(sb);
    const d = {
      naam: clean(b.naam, 80), voornaam: clean(b.voornaam, 80), adres: clean(b.adres, 200),
      email: clean(b.email, 120).toLowerCase(), telefoon: clean(b.telefoon, 40), categorie: clean(b.categorie, 60),
    };
    if (!d.naam || !d.voornaam) throw httpErr(400, "Vul je naam en voornaam in.");
    if (!d.adres) throw httpErr(400, "Vul je adres in.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) throw httpErr(400, "Dit e-mailadres lijkt niet te kloppen.");
    if (d.telefoon.replace(/\D/g, "").length < 8) throw httpErr(400, "Vul een geldig telefoonnummer in.");
    if (!I.categorieen.includes(d.categorie)) throw httpErr(400, "Kies wat bij jou past.");

    // niet meer dan 30 inschrijvingen per uur (bescherming tegen misbruik)
    const uurGeleden = new Date(Date.now() - 3600 * 1000).toISOString();
    const { count } = await sb.from("leden").select("id", { count: "exact", head: true }).eq("data->>bron", "formulier").gte("data->>aangemeld", uurGeleden);
    if ((count || 0) >= 30) throw httpErr(429, "Er zijn net veel inschrijvingen binnengekomen. Probeer het later opnieuw.");

    // bestaat dit lid al? dan toch bewaren, maar als mogelijk dubbel markeren
    let id = slug(d.naam + "-" + d.voornaam), dubbelVan = null;
    const { data: bestaand } = await sb.from("leden").select("id").eq("id", id).maybeSingle();
    if (bestaand) { dubbelVan = id; id = id + "-" + Date.now().toString(36); }

    const bedrag = I.tarieven[d.categorie], mededeling = `${d.naam} ${d.voornaam} Lidgeld ${I.jaar}`;
    const token = I.online ? crypto.randomBytes(18).toString("base64url") : null;
    const lid = { ...d, lidSinds: I.jaar, info: "", lidTot: null, bron: "formulier", nieuw: true, aangemeld: new Date().toISOString(), lidgeldBedrag: bedrag, ...(token ? { betaalToken: token } : {}), ...(dubbelVan ? { dubbelVan } : {}) };
    const { error } = await sb.from("leden").insert({ id, data: lid });
    if (error) throw error;

    let qr = null;
    try { qr = qrSvg(epcPayload({ naam: I.vereniging, iban: I.rekeningnummer, bedrag, mededeling })); } catch (e) { console.error("QR", e); }
    // online betalen met Bancontact Pay (enkel als de API-sleutel ingesteld is)
    let online = null;
    if (token) {
      try {
        const bt = await startBetaling(sb, req, { id, data: lid }, { bedrag, jaar: I.jaar });
        online = { id, token, deeplink: bt.deeplink, qrcode: bt.qrcode, checkout: bt.checkout, verlooptOp: bt.verlooptOp };
      } catch (e) { console.error("Bancontact", e); }
    }
    res.status(200).json({ ok: true, jaar: I.jaar, bedrag, rekeningnummer: I.rekeningnummer, begunstigde: I.vereniging, mededeling, qr, online });
  } catch (e) { sendError(res, e); }
}
