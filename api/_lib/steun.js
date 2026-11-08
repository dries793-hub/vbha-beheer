import { admin, httpErr } from "./sb.js";
import { onlineConfigured, maakBetaling, haalBetaling } from "./betaalprovider.js";
import { siteUrl } from "./betaal.js";
import { clean, algemeen, DEF_IBAN } from "./publiek.js";
import { epcPayload, qrSvg } from "./epc.js";

/* ============ Vrije steun (/steun, ook gelinkt vanaf vbha.be) ============
   Iedereen kan zelf een bedrag en mededeling kiezen en meteen online betalen (Bancontact Pay).
   Er wordt niets in de database bewaard: de betaling komt gewoon binnen via de doorstorting/bankimport.
   GET  /api/betaling?steun=info        -> rekeningnummer, begunstigde, of online betalen kan
   GET  /api/betaling?steun=<paymentId>  -> status van een steunbetaling (enkel betalingen met referentie "VBHA STEUN")
   POST {steun:1, bedrag, mededeling}    -> nieuwe online betaling starten */

export const STEUN_MIN = 1, STEUN_MAX = 2500;
const REF = "VBHA STEUN";
const bedragUit = v => Math.round(Number(String(v ?? "").replace(",", ".").replace(/[^\d.]/g, "")) * 100) / 100;

export async function steunBetaling(req, res, b) {
  if (req.method === "GET") {
    const q = String(b.steun || "");
    if (q === "info" || q === "1") {
      const I = await algemeen(admin());
      return res.status(200).json({ online: onlineConfigured(), rekeningnummer: I.rekeningnummer || DEF_IBAN, begunstigde: I.vereniging, min: STEUN_MIN, max: STEUN_MAX });
    }
    if (!onlineConfigured()) throw httpErr(501, "Online betalen is niet ingesteld");
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(q)) throw httpErr(400, "Ongeldige betaling");
    const p = await haalBetaling(q);
    if (!String(p.reference || "").startsWith(REF)) throw httpErr(404, "Niet gevonden");
    return res.status(200).json({ status: p.status, bedrag: p.bedrag });
  }
  if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");
  const bedrag = bedragUit(b.bedrag);
  if (!(bedrag >= STEUN_MIN) || bedrag > STEUN_MAX) throw httpErr(400, `Kies een bedrag tussen €${STEUN_MIN} en €${STEUN_MAX}.`);
  const mededeling = clean(b.mededeling, 60) || "Steun VBHA";
  const I = await algemeen(admin());
  let qr = null;
  try { qr = qrSvg(epcPayload({ naam: I.vereniging, iban: I.rekeningnummer || DEF_IBAN, bedrag, mededeling })); } catch (e) { console.error("QR", e); }
  const handmatig = { bedrag, mededeling, rekeningnummer: I.rekeningnummer || DEF_IBAN, begunstigde: I.vereniging, qr };
  if (!onlineConfigured()) return res.status(200).json({ online: null, ...handmatig });
  const p = await maakBetaling({
    bedrag, omschrijving: `Steun VBHA: ${mededeling}`,
    referentie: `${REF} ${Date.now().toString(36)}`,
    callbackUrl: siteUrl(req) + "/api/bancontact/callback",
    redirectUrl: siteUrl(req) + "/steun?betaling=terug",
  });
  res.status(200).json({ online: { id: p.id, status: p.status, deeplink: p.deeplink, qrcode: p.qrcode, checkout: p.checkout, verlooptOp: p.verlooptOp }, ...handmatig });
}
