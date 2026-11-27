import { leesKop } from "./kop.js";
import { admin, isDbCron, httpErr, requireUser } from "./sb.js";
import { socialRij } from "./mailsocial.js";
import { smtpConfigured, afzender, verstuur } from "./smtp.js";
import { algemeen, configDoc, inschrijving, DEF_IBAN, lidgeldBoekingen, norm } from "./publiek.js";
import { controleerBetaling } from "./betaal.js";
import { teken, ondertekenLinks, reglementPad } from "./lidlink.js";
import { registreer, sysMail } from "./sjabloon.js";

/* Bevestigingsmails voor de inschrijfpagina's.
   - Kinderfeest (geen betaling): meteen na de inschrijving.
   - Banket en nieuw lid (met betaling): de mail wacht op de uitkomst van de online betaling (data.bevestiging.status = "wacht").
     Lukt de Bancontact-betaling, dan vertrekt de bevestiging meteen met "betaling ontvangen".
     Is er na 20 minuten nog niet betaald, dan stuurt de geplande taak (elke 10 minuten) de bevestiging met de gegevens om over te schrijven.
   - Wie later toch online betaalt, of een bestaand lid dat via de lidgeldlink betaalt, krijgt een korte mail "betaling ontvangen". */
const F = "font-family:'Inter','Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;";
const LOGO = "https://impro.usercontent.one/appid/oneComWsb/domain/vbha.be/media/vbha.be/onewebmedia/logo%20VBHA%201.png";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const eur = n => "€" + Number(n || 0).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const lang = iso => { if (!iso) return ""; const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); const s = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }); return s.charAt(0).toUpperCase() + s.slice(1); };
const kort = iso => { if (!iso) return ""; const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }); };
const plusDagen = (iso, n) => { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const vandaag = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const site = () => "https://vbha.be"; // openbare links (in mails en op papier) altijd via het eigen domein
const p = (t, st = "margin:0 0 16px") => `<p style="${st}">${t}</p>`;
/* ---------- huisstijl van de mails (2026): hoofding zoals op de facturen, inhoud in de stijl van de website ----------
   Werkt in Gmail, Apple Mail, Outlook (ook 2010-2019 via de VML-knop en vaste breedte) en op gsm. */
/* Kleuren en maten uit public/vbha-tokens.css (mails kunnen geen CSS-variabelen lezen). */
const INK = "#18191C", MUTED = "#6F7278", ROOD = "#C0161F", GOUD = "#C1A057", ZACHT = "#F3F3F2", LIJN = "#E6E4E1", PAGINA = "#FAF9F7", OK = "#168447", OK_ZACHT = "#E7F4EC", OK_LIJN = "#8CCBA6";
const LOGO_W = () => (process.env.VBHA_TEST === "1" ? "https://test.vbha.be" : site()) + "/mail/logo-mail.png";
// gegevens als rijen met een fijne lijn ertussen, waarde rechts (zoals de samenvatting op de openbare pagina's)
const menuTxt = m => /veg/i.test(String(m || "")) ? "Vegetarisch" : m ? "Vlees en vis" : "";
const rij = (k, v) => v === "" || v == null ? "" : `<tr><td class="vb-l" style="padding:8px 14px 8px 0;border-top:1px solid ${LIJN};color:${MUTED};vertical-align:top;white-space:nowrap;${F}font-size:14.5px;line-height:1.45">${esc(k)}</td><td style="padding:8px 0;border-top:1px solid ${LIJN};vertical-align:top;text-align:right;word-break:break-word;overflow-wrap:anywhere;${F}font-size:14.5px;line-height:1.45;color:${INK}">${v}</td></tr>`;
const tabel = rows => `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="${F}font-size:14.5px;color:${INK};line-height:1.45;border-collapse:collapse">${rows.join("")}</table>`;
// kopje met rode streep (zoals h2.vb-card-t)
const KOP = t => `<h2 style="${F}color:${INK};font-size:17px;line-height:1.25;font-weight:bold;margin:0 0 8px;padding:1px 0 1px 10px;border-left:3px solid ${ROOD}">${t}</h2>`;
const isGroen = k => /^#(1a7f45|168447)$/i.test(k), isRood = k => /^#(b30000|c0161f)$/i.test(k);
const kaderOpen = kleur => isGroen(kleur)
  ? `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:6px 0 20px;border-collapse:separate"><tr><td class="vb-k" bgcolor="${ZACHT}" style="padding:14px 16px 10px;border:1px solid ${LIJN};border-radius:12px;${F}font-size:15px;color:${INK};line-height:1.55">`
  : isRood(kleur)
  ? `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:6px 0 20px;border-collapse:separate"><tr><td class="vb-k" bgcolor="${ZACHT}" style="padding:14px 16px 10px;border:1px solid ${LIJN};border-radius:12px;${F}font-size:15px;color:${INK};line-height:1.55">`
  : `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:22px 0 20px;border-collapse:separate"><tr><td class="vb-s" style="padding:0;${F}font-size:15px;color:${INK};line-height:1.55">`;
// groen (gelukt): zelfde grijs kader als "Nog te betalen", met een groen streepje
const kaderKop = (kleur, titel) => isGroen(kleur) ? `<h2 style="${F}color:${INK};font-size:17px;line-height:1.25;font-weight:bold;margin:0 0 8px;padding:1px 0 1px 10px;border-left:3px solid ${OK}">${String(titel).replace(/^\s*(&#10003;|✓)\s*/, "")}</h2>` : KOP(titel);
// kaderBlok: standaard een sectie met rood kopje; rood = grijs kader (te betalen); groen = groene melding (gelukt)
const kaderBlok = (titel, inner, kleur = GOUD) => kaderOpen(kleur) + kaderKop(kleur, titel) + inner + `</td></tr></table>`;
// hoofdknop: rood over de volle breedte (zoals .vb-cta)
const knop = (t, href) => `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:6px 0 20px"><tr><td align="center" bgcolor="${ROOD}" style="border-radius:10px">`
  + `<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${esc(href)}" style="height:46px;v-text-anchor:middle;width:540px" arcsize="22%" stroke="f" fillcolor="${ROOD}"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold">${esc(t)}</center></v:roundrect><![endif]-->`
  + `<!--[if !mso]><!--><a href="${esc(href)}" target="_blank" style="${F}display:block;padding:13px 16px;font-size:16px;font-weight:bold;line-height:20px;color:#ffffff;text-align:center;text-decoration:none;border-radius:10px;background:${ROOD}">${esc(t)}</a><!--<![endif]--></td></tr></table>`;
// opmaak uit eerdere versies (bewaarde sjablonen) meteen in de nieuwe stijl zetten
const modern = s => String(s)
  .replace(/font-family:Helvetica,Arial,sans-serif;?/g, F)
  .replace(/color:#222222/gi, "color:" + INK).replace(/color:#(666666|686b71)/gi, "color:" + MUTED)
  .replace(/<h2 style="color:#b30000;/gi, `<h2 style="${F}color:${INK};`).replace(/<h3 style="color:#b30000;/gi, `<h3 style="${F}color:${INK};`)
  // oud kader (td met gekleurde linkerrand + h2 als titel) → nieuwe sectie/kader
  .replace(/<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:4px 0 22px;?\s*border-collapse:separate"><tr><td\b[^>]*?border-left:5px solid (#[0-9a-fA-F]{6})[^>]*>\s*<h2\b[^>]*>([\s\S]*?)<\/h2>/g, (_, k, t) => kaderOpen(k) + kaderKop(k, t))
  .replace(/<td\b[^>]*?border-left:5px solid (#[0-9a-fA-F]{6})[^>]*>\s*<h2\b[^>]*>([\s\S]*?)<\/h2>/g, (_, k, t) => kaderOpen(k).replace(/^[\s\S]*?<tr>/, "") + kaderKop(k, t))
  // oud kader zonder titel → grijs kader
  .replace(/<td\b[^>]*?border-left:5px solid #[0-9a-fA-F]{6}[^>]*>/g, `<td class="vb-k" bgcolor="${ZACHT}" style="padding:14px 16px;border:1px solid ${LIJN};border-radius:12px;${F}font-size:15px;color:${INK};line-height:1.55">`)
  // oude omlijnde knop → rode knop
  .replace(/<a href="([^"]*)" target="_blank" style="[^"]*border:1\.5px solid #b30000[^"]*">([\s\S]*?)(?: &rarr;)?<\/a>/gi, (_, h, t) => `<a href="${h}" target="_blank" style="${F}display:inline-block;padding:12px 20px;font-size:16px;font-weight:bold;line-height:20px;color:#ffffff;text-decoration:none;border-radius:10px;background:${ROOD}">${t}</a>`)
  .replace(/#b30000/gi, ROOD);
const HOOFD = (titel) => `<!DOCTYPE html><html lang="nl" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${titel}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><style>td,p,a,h1,h2,h3,li,span{font-family:'Segoe UI',Arial,sans-serif!important}</style><![endif]-->
<style>@media only screen and (max-width:520px){.vb-in{padding:24px 18px 20px!important}.vb-hl{padding:0 18px!important}.vb-k{padding:12px 14px!important}.vb-l{padding-right:10px!important}.vb-h1{font-size:24px!important}}</style></head>`;
// bovenschrift in rood met streepje + titel (zoals bovenaan de openbare pagina's)
/* subtiel brandweerembleem rechts naast de titel (zoals op de website); zonder titel rechts bovenaan in de tekst */
const EMB = (w = 44, h = 49, st = "") => `<img src="${(process.env.VBHA_TEST === "1" ? "https://test.vbha.be" : site()) + "/mail/embleem.png"}" alt="" width="${w}" height="${h}" style="display:block;width:${w}px;height:${h}px;border:0${st}">`;
const TITEL = (bovenschrift, titel) => (bovenschrift || titel) ? `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 20px;border-bottom:1px solid ${LIJN}"><tr><td valign="top" style="padding:0 0 16px">${TITEL0(bovenschrift, titel).replace(/margin:0 0 20px;padding:0 0 16px;border-bottom:1px solid [^;]+;/, "margin:0;padding:0;")}</td><td valign="top" align="right" width="56" style="padding:0 0 12px 12px;width:56px">${EMB()}</td></tr></table>` : `<img src="${(process.env.VBHA_TEST === "1" ? "https://test.vbha.be" : site()) + "/mail/embleem.png"}" alt="" width="40" height="45" align="right" style="float:right;width:40px;height:45px;border:0;margin:0 0 10px 14px">`;
const TITEL0 = (bovenschrift, titel) => (bovenschrift ? `<table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 6px"><tr><td style="${F}font-size:11.5px;line-height:18px;font-weight:bold;letter-spacing:.7px;text-transform:uppercase;color:${ROOD}">${bovenschrift}</td></tr></table>` : "")
  + (titel ? `<h1 class="vb-h1" style="${F}margin:0 0 20px;padding:0 0 16px;border-bottom:1px solid ${LIJN};font-size:26px;line-height:1.15;font-weight:800;letter-spacing:-.57px;color:${INK}">${titel}</h1>` : "");
function huisstijl(inner, ver, { groet = true, voet = "", extern = false, bovenschrift = "", titel = "" } = {}) { // extern: mail aan sponsors/klanten (geen leden)
  { const k = leesKop(inner); inner = k.html; if (!bovenschrift && !titel) { bovenschrift = esc(k.boven); titel = esc(k.titel); } }
  return `${HOOFD(esc(ver))}<body style="margin:0;padding:0;background:${PAGINA};-webkit-text-size-adjust:100%">
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="${PAGINA}"><tr><td align="center" style="padding:0">
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="${INK}"><tr><td align="center" style="padding:14px 0">
<!--[if mso]><table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" align="center"><tr><td><![endif]-->
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px"><tr><td class="vb-hl" style="padding:0 24px"><a href="${site()}" target="_blank" style="text-decoration:none"><img src="${LOGO_W()}" alt="VBHA" width="106" height="32" style="display:block;color:#ffffff;font-weight:bold;font-size:20px;width:106px;height:32px;border:0"></a></td></tr></table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
<!--[if mso]><table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" align="center"><tr><td><![endif]-->
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px">
<tr><td class="vb-in" style="${F}font-size:15px;line-height:1.6;color:${INK};padding:30px 24px 24px">${TITEL(bovenschrift, titel)}${modern(inner)}${groet ? p(`Met vriendelijke groeten,<br><b>Het bestuur${extern ? " van " + esc(ver) : ""}</b>`, "margin:8px 0 0") : ""}</td></tr>
<tr><td style="padding:16px 24px 6px;border-top:1px solid ${LIJN};${F}font-size:12px;color:${MUTED};line-height:1.6">${esc(ver)} &middot; <a href="https://vbha.be" style="color:${ROOD};text-decoration:none">vbha.be</a>${voet ? " &middot; " + voet : ""}</td></tr>
<tr><td style="padding:6px 20px 28px">${socialRij().replace('align="center" style="margin:0 auto"', 'align="left" style="margin:0"')}</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}
function betaalBlok({ betaald, betaling, bedrag, rekeningnummer, begunstigde, mededeling, tegen, link }) {
  if (betaald) {
    const op = betaling && betaling.betaaldOp ? " op " + kort(new Date(betaling.betaaldOp).toISOString()) : "";
    return kaderBlok("Betaling ontvangen", tabel([rij("Bedrag", `<b>${eur(bedrag)}</b>`), rij("Betaald via", "Bancontact"), betaling && betaling.betaaldOp ? rij("Betaald op", esc(lang(new Date(betaling.betaaldOp).toISOString().slice(0, 10)))) : ""])
      + p("Je hoeft niets meer te doen.", "margin:10px 0 0;font-size:13.5px;color:#666666"), "#1a7f45", "#f1faf4");
  }
  return kaderBlok("Nog te betalen", tabel([rij("Bedrag", `<b>${eur(bedrag)}</b>`), rij("Rekening", `<b>${esc(rekeningnummer)}</b>`), rij("Begunstigde", esc(begunstigde)), rij("Mededeling", `<b>${esc(mededeling)}</b>`), rij("Te betalen vóór", `<b>${esc(lang(tegen))}</b>`)]), "#b30000", "#fdf2f2")
    + (link ? knop("Liever online betalen met Bancontact", link) : "");
}
const BETAALD = (d, bedrag) => d.betaling && d.betaling.status === "SUCCEEDED" && Number(d.betaling.bedrag) === Number(bedrag);

/* ---------- standaardsjablonen (aanpasbaar in Mail/Sms › Automatische mails) ---------- */
const AFS = t => p(t);
registreer({ key: "banket-bevestiging", naam: "Banket: bevestiging inschrijving", wanneer: "Na een inschrijving voor het banket (na de online betaling, of na 20 minuten met de gegevens om over te schrijven).",
  onderwerp: "Bevestiging inschrijving banket {jaar}",
  body: AFS("Dag {voornaam}!") + AFS("Bedankt voor je inschrijving voor ons banket. Hieronder vind je nog eens alle gegevens.") + kaderBlok("Banket {jaar}", "{gegevens}") + "<p>{betaling}</p>"
    + AFS("{als:betaald}Je inschrijving is volledig in orde.{/als:betaald}{niet:betaald}Zodra je betaling ontvangen is, is je inschrijving definitief.{/niet:betaald} We kijken ernaar uit om samen een gezellige avond te beleven!"),
  velden: [["voornaam", "Voornaam"], ["naam", "Op naam van"], ["jaar", "Jaar"], ["datum", "Datum banket"], ["uur", "Uur"], ["locatie", "Locatie"], ["bedrag", "Bedrag"], ["gegevens", "Tabel met de inschrijving"], ["betaling", "Blok betaling (ontvangen of over te schrijven)"], ["betaald", "Voorwaarde: al betaald"]],
  voorbeeld: { voornaam: "Jan", naam: "Peeters Jan", jaar: "2026", datum: "Zaterdag 12 december 2026", uur: "19u00", locatie: "Feestzaal De Snip, Moorsel", bedrag: "€65,00", betaald: "" } });
registreer({ key: "lid-bevestiging", naam: "Nieuw lid: bevestiging inschrijving", wanneer: "Na een inschrijving als nieuw lid via de website.",
  onderwerp: "Bevestiging van je inschrijving als lid",
  body: AFS("Dag {voornaam}!") + AFS("Welkom bij de <b>{vereniging}</b>! We ontvingen je inschrijving als lid. Hieronder vind je nog eens je gegevens.") + kaderBlok("Je gegevens", "{gegevens}") + "<p>{betaling}</p>"
    + AFS("{als:betaald}Je lidmaatschap is in orde. Tot op een van onze activiteiten!{/als:betaald}{niet:betaald}Zodra je lidgeld ontvangen is, ben je volwaardig lid. Tot op een van onze activiteiten!{/niet:betaald}")
    + kaderBlok("Puntensysteem", p("Als lid verdien je punten door mee te helpen: bij activiteiten, de kalenderbedeling en meer. Die punten bepalen onder meer je korting op het banket. Lees hoe het werkt in het reglement van het puntensysteem.", "margin:0"))
    + "<p>{knop_reglement}</p>" + p("Kloppen je gegevens niet? Antwoord dan gewoon op deze mail.", "margin:0 0 15px;font-size:13.5px;color:#666666"),
  velden: [["voornaam", "Voornaam"], ["naam", "Naam"], ["vereniging", "Naam vereniging"], ["jaar", "Jaar"], ["lidgeld", "Lidgeld"], ["gegevens", "Tabel met de gegevens"], ["betaling", "Blok betaling"], ["knop_reglement", "Knop reglement puntensysteem"], ["link_reglement", "Link reglement"], ["betaald", "Voorwaarde: al betaald"]],
  voorbeeld: { voornaam: "Jan", naam: "Peeters Jan", vereniging: "Vriendenkring Brandweer Hoofdpost Aalst", jaar: "2026", lidgeld: "€30,00", betaald: "" } });
registreer({ key: "kinderfeest-bevestiging", naam: "Kinderfeest: bevestiging inschrijving", wanneer: "Meteen na een inschrijving voor het kinderfeest. Het stuk over de cadeaus stel je in bij Kinderfeest › tandwiel.",
  onderwerp: "Bevestiging inschrijving kinderfeest {jaar}",
  body: AFS("Dag {voornaam}!") + AFS("Je bent ingeschreven voor het kinderfeest. Super!") + kaderBlok("Je inschrijving", "{gegevens}") + "{cadeau_uitleg}" + AFS("Tot dan!"),
  velden: [["voornaam", "Voornaam"], ["jaar", "Jaar"], ["datum", "Datum kinderfeest"], ["uur", "Uur"], ["locatie", "Locatie"], ["cadeau_uitleg", "Uitleg over de cadeaus"], ["gegevens", "Tabel met de inschrijving"]],
  voorbeeld: { voornaam: "Jan", jaar: "2026", datum: "19 december 2026", uur: "14u30", locatie: "VTI - Sinte Annalaan 99b, Aalst" } });
registreer({ key: "familiedag-bevestiging", naam: "Familiedag: bevestiging inschrijving", wanneer: "Na een inschrijving voor de familiedag.",
  onderwerp: "Bevestiging inschrijving {titel}",
  body: AFS("Dag {voornaam}!") + AFS("Bedankt voor je inschrijving voor de {titel_klein}. Hieronder vind je nog eens alle gegevens.") + kaderBlok("{titel}", "{gegevens}") + "<p>{betaling}</p>"
    + "{als:gratis}" + kaderBlok("Niets te betalen", p("Deze familiedag is gratis voor leden: de vriendenkring trakteert. Je hoeft niets te betalen.", "margin:0"), "#1a7f45", "#f1faf4") + "{/als:gratis}"
    + "<p>{info}</p>" + AFS("We kijken ernaar uit om er samen een fijne dag van te maken!"),
  velden: [["voornaam", "Voornaam"], ["naam", "Op naam van"], ["jaar", "Jaar"], ["titel", "Titel activiteit"], ["titel_klein", "Titel (in een zin)"], ["bedrag", "Totaal"], ["gegevens", "Tabel met de inschrijving"], ["betaling", "Blok betaling"], ["info", "Extra info (instellingen familiedag)"], ["betaald", "Voorwaarde: al betaald"], ["gratis", "Voorwaarde: niets te betalen"]],
  voorbeeld: { voornaam: "Jan", naam: "Peeters Jan", jaar: "2026", titel: "Familiedag 2026", titel_klein: "familiedag 2026", bedrag: "€25,00", info: "", betaald: "", gratis: "" } });
registreer({ key: "betaling-ontvangen", naam: "Betaling ontvangen (lidgeld, banket, familiedag)", wanneer: "Als iemand later toch online betaalt, of een lid via de lidgeldlink betaalt.",
  onderwerp: "Betaling ontvangen voor {wat}",
  body: AFS("Dag {voornaam}!") + "<p>{betaling}</p>"
    + AFS("{als:lidgeld}Je lidgeld is in orde. Bedankt en tot op een van onze activiteiten!{/als:lidgeld}{als:familiedag}Je inschrijving voor de familiedag is nu volledig in orde. Tot dan!{/als:familiedag}{als:banket}Je inschrijving voor het banket is nu volledig in orde. Tot dan!{/als:banket}"),
  velden: [["voornaam", "Voornaam"], ["wat", "Waarvoor (bv. je lidgeld 2026)"], ["bedrag", "Bedrag"], ["betaling", "Blok betaling ontvangen"], ["lidgeld", "Voorwaarde: lidgeld"], ["banket", "Voorwaarde: banket"], ["familiedag", "Voorwaarde: familiedag"]],
  voorbeeld: { voornaam: "Jan", wat: "je lidgeld 2026", bedrag: "€30,00", lidgeld: "1", banket: "", familiedag: "" } });

/* ---------- inhoud per soort inschrijving ---------- */
export async function mailBanket(sb, row) {
  const d = row.data, A = await algemeen(sb), c = await configDoc(sb, "banket"), jaar = d.jaar || A.jaar;
  const { data: lid } = d.lidId ? await sb.from("leden").select("data").eq("id", d.lidId).maybeSingle() : { data: null };
  const L = lid && lid.data || {}, aan = String(L.email || "").trim();
  if (!aan) return null;
  const bedrag = d.teBetalen || 0, betaald = BETAALD(d, bedrag), ins = inschrijving(c, jaar + "-12-01");
  const datum = c.datum || jaar + "-12-12", uur = c.uur || "19u00", locatie = c.locatie || "Feestzaal De Snip, Beugemstraat 9, Moorsel";
  const m = await sysMail(sb, "banket-bevestiging", { voornaam: esc(L.voornaam || d.naam), naam: esc(d.naam), jaar, betaald,
    gegevens: tabel([rij("Wanneer", esc(lang(datum)) + (uur ? " om " + esc(uur) : "")), rij("Waar", esc(locatie)), rij("Op naam van", esc(d.naam)),
      rij("Personen", d.personen === 2 ? "2 (jij en je partner)" : "1"), rij("Menu", d.personen === 2 ? (menuTxt(d.menu1) === menuTxt(d.menu2) ? "2× " + esc(menuTxt(d.menu1)) : "1× " + esc(menuTxt(d.menu1)) + ", 1× " + esc(menuTxt(d.menu2))) : esc(menuTxt(d.menu1))), rij("Opmerking", esc(d.opmerking || "")), rij("Bedrag", eur(bedrag) + (d.korting ? ` <span style="color:#666666">(${esc(String(d.status || "").charAt(0) + String(d.status || "").slice(1).toLowerCase())}: ${d.korting}% korting op ${eur(Number(c.prijs) || 65)} per persoon)</span>` : ""))]),
    betaling: betaalBlok({ betaald, betaling: d.betaling, bedrag, rekeningnummer: A.rekeningnummer || DEF_IBAN, begunstigde: A.vereniging, mededeling: `${d.naam} Banket ${jaar}`, tegen: ins.tot || jaar + "-12-01" }),
    bedrag: eur(bedrag), datum: esc(lang(datum)), uur: esc(uur), locatie: esc(locatie) });
  const html = m.html;
  return { aan, aanNaam: L.voornaam ? L.voornaam + " " + (L.naam || "") : d.naam, onderwerp: m.onderwerp, html: huisstijl(html, A.vereniging, { bovenschrift: "Bevestiging", titel: "Banket " + esc(jaar) }), betaald };
}
export async function mailNieuwLid(sb, row) {
  const d = row.data, A = await algemeen(sb), aan = String(d.email || "").trim();
  if (!aan) return null;
  const jaar = (d.betaling && d.betaling.jaar) || d.lidSinds || A.jaar, bedrag = d.lidgeldBedrag || 0, betaald = BETAALD(d, bedrag);
  const tegen = plusDagen(String(d.aangemeld || vandaag()).slice(0, 10), 14);
  const link = !betaald && bedrag > 0 ? `${site()}/lidgeld?l=${encodeURIComponent(row.id)}&j=${jaar}&b=${Number(bedrag)}&t=${encodeURIComponent(teken(row.id, jaar, bedrag))}` : "";
  const m = await sysMail(sb, "lid-bevestiging", { voornaam: esc(d.voornaam || d.naam), naam: esc(d.naam + " " + d.voornaam), vereniging: esc(A.vereniging), jaar, betaald,
    gegevens: tabel([rij("Naam", esc(d.naam + " " + d.voornaam)), rij("Adres", esc(d.adres)), rij("E-mail", esc(d.email)), rij("Telefoon", esc(d.telefoon)), rij("Categorie", esc(d.categorie)), rij("Lidgeld " + jaar, eur(bedrag))]),
    betaling: betaalBlok({ betaald, betaling: d.betaling, bedrag, rekeningnummer: A.rekeningnummer || DEF_IBAN, begunstigde: A.vereniging, mededeling: `${d.naam} ${d.voornaam} Lidgeld ${jaar}`, tegen, link }),
    lidgeld: eur(bedrag), link_reglement: site() + reglementPad(row.id, jaar), knop_reglement: knop("Reglement puntensysteem lezen", site() + reglementPad(row.id, jaar)) });
  const html = m.html;
  return { aan, aanNaam: d.voornaam + " " + d.naam, onderwerp: m.onderwerp, html: huisstijl(html, A.vereniging, { bovenschrift: "Welkom", titel: "Lid " + esc(jaar) }), betaald };
}
/* kinderfeest: cadeau-info in de bevestiging (instelbaar in Kinderfeest › tandwiel; config kf_<jaar>.mail) */
export function kfMailDef(jaar, datum) {
  const Y = Number(String(datum || "").slice(0, 4)) || Number(jaar), d = new Date((datum || Y + "-12-19") + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - 10);
  return { cadeau: true, sites: "www.dreamland.be, www.bol.com", tot: d.toISOString().slice(0, 10), contact: "info@vbha.be", kopie: "",
    groepen: `${Y - 11}: cadeau voorzien door VBHA\n${Y - 10}-${Y - 6}: 50,00 EUR per kind\n${Y - 5}-${Y}: 35,00 EUR per kind` };
}
export function kfGroepen(t) {
  return String(t || "").split(/\n+/).map(l => l.match(/^\s*(\d{4})(?:\s*[-–]\s*(\d{4}))?\s*[:=]\s*(.+?)\s*$/)).filter(Boolean)
    .map(m => ({ van: Math.min(+m[1], +(m[2] || m[1])), tot: Math.max(+m[1], +(m[2] || m[1])), tekst: m[3] }));
}
const jarenTekst = (a, b) => { const L = []; for (let y = a; y <= b; y++) L.push(y); return L.length < 2 ? String(L[0]) : L.slice(0, -1).join(", ") + " en " + L[L.length - 1]; };
const linkSite = s => { const u = String(s).trim(); if (!u) return ""; const h = /^https?:\/\//i.test(u) ? u : "https://" + u; return `<a href="${esc(h)}" style="color:#a3211a">${esc(u.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, ""))}</a>`; };
export async function kfMailHtml(sb, d, { A, c, jaar, link }) {
  const datum = c.datum || jaar + "-12-19", tijd = c.tijd || "14u30", locatie = c.locatie || "VTI - Sinte Annalaan 99b, Aalst";
  const M = { ...kfMailDef(jaar, datum), ...(c.mail || {}), tot: kfMailDef(jaar, datum).tot }, G = kfGroepen(M.groepen);
  const lft = geb => { if (!geb) return ""; const [y, m, dd] = geb.split("-").map(Number), [Y, Mo, D] = datum.split("-").map(Number); let a = Y - y; if (Mo < m || (Mo === m && D < dd)) a--; return a < 1 ? "< 1 jaar" : a + " jaar"; };
  const groep = geb => { const y = Number(String(geb || "").slice(0, 4)); return G.find(g => y >= g.van && y <= g.tot); };
  // bedrag kort: "50,00 EUR per kind" -> "€ 50"; andere tekst (bv. "cadeau voorzien door VBHA") blijft zoals hij is
  const waarde = t => { const x = String(t || "").replace(/\s*per kind\s*$/i, "").trim(), m = x.match(/^(\d+(?:[.,]\d+)?)\s*(?:eur|euro|€)?$/i);
    if (m) { const n = Number(m[1].replace(",", ".")); return "<b>€ " + (Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")) + "</b>"; } return esc(x); };
  const perKind = (d.kinderen || []).map(k => ({ k, g: groep(k.geb) }));
  let vn = d.voornaam || "";
  if (!vn && d.lidId) { const { data: lid } = await sb.from("leden").select("data").eq("id", d.lidId).maybeSingle(); vn = (lid && lid.data && lid.data.voornaam) || ""; }
  const sites = String(M.sites || "").split(/[,;\s]+/).filter(Boolean).map(linkSite);
  const sitesT = sites.length < 2 ? sites.join("") : sites.slice(0, -1).join(", ") + " of " + sites[sites.length - 1];
  const totK = M.tot ? lang(M.tot).replace(/^\S+\s/, "").replace(/\s\d{4}$/, "") : "";
  const klein = t => p(`<span style="color:#666666;font-size:13.5px">${t}</span>`);
  const kindTxt = ({ k, g }) => `<b>${esc(String(k.naam || "").trim().split(/\s+/)[0] || k.naam || "")}</b>${k.geb ? ` <span style="color:#666666">(${lft(k.geb)})</span>` : ""}${M.cadeau && g ? ": " + waarde(g.tekst) : ""}`;
  let html = "";
  if (M.cadeau) {
    if (M.keuze) { if (perKind.some(x => x.g && /\d/.test(x.g.tekst))) html += p(`Kies het cadeau${totK ? ` <b>tegen ${esc(totK)}</b>` : ""}${sitesT ? ` op ${sitesT}` : ""} en plak de link via de knop.`) + knop("Cadeau kiezen", link || (site() + "/cadeau")) + klein("Geen keuze doorgegeven? Dan krijg je een waardebon van bol.com."); }
    else html += p(`Kies het cadeau${sitesT ? ` op ${sitesT}` : ""} en stuur ons${totK ? ` <b>tegen ${esc(totK)}</b>` : ""} per kind de omschrijving en het artikelnummer${M.contact ? ` via <a href="mailto:${esc(M.contact)}" style="color:#a3211a">${esc(M.contact)}</a>` : ""}.`) + klein("Geen keuze doorgegeven? Dan krijg je een waardebon van bol.com.");
  }
  const m = await sysMail(sb, "kinderfeest-bevestiging", { voornaam: esc(vn), jaar, datum: esc(lang(datum).replace(/^\S+\s/, "")), uur: esc(tijd), locatie: esc(locatie), cadeau_uitleg: html,
    gegevens: tabel([rij("Wanneer", esc(lang(datum)) + (tijd ? " om " + esc(tijd) : "")), rij("Waar", esc(locatie)), rij(M.cadeau ? "Cadeau" : (perKind.length > 1 ? "Kinderen" : "Kind"), perKind.map(kindTxt).join("<br>") || "–"), d.opmerking ? rij("Opmerking", esc(d.opmerking)) : ""]) });
  return Object.assign(new String(m.html.replace(/Dag\s+!/g, "Hallo!")), { onderwerp: m.onderwerp });
}
export async function mailKinderfeest(sb, row) {
  const d = row.data, A = await algemeen(sb), jaar = d.jaar || A.jaar, c = await configDoc(sb, "kf_" + jaar), aan = String(d.email || "").trim();
  if (!aan) return null;
  const { kfcLink } = await import("./kfcadeau.js");
  const html = await kfMailHtml(sb, d, { A, c, jaar, link: kfcLink(row.id) });
  const M = { ...kfMailDef(jaar, c.datum || jaar + "-12-19"), ...(c.mail || {}), tot: kfMailDef(jaar, c.datum || jaar + "-12-19").tot }, cc = String(M.kopie || "").split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(x => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(x)).slice(0, 5);
  return { aan, aanNaam: d.lid || "", cc, onderwerp: html.onderwerp || `Bevestiging inschrijving kinderfeest ${jaar}`, html: huisstijl(String(html), A.vereniging, { bovenschrift: "Bevestiging", titel: "Kinderfeest " + esc(jaar) }), betaald: true };
}
export async function mailFamiliedag(sb, row) {
  const d = row.data, A = await algemeen(sb), jaar = d.jaar || A.jaar, c = await configDoc(sb, "fd_" + jaar), aan = String(d.email || "").trim();
  if (!aan) return null;
  const bedrag = d.teBetalen || 0, betaald = bedrag > 0 && BETAALD(d, bedrag), ins = inschrijving(c, c.datum || jaar + "-12-31");
  let voornaam = String(d.naam || "").split(" ").slice(-1)[0];
  if (d.lidId) { const { data: l } = await sb.from("leden").select("data").eq("id", d.lidId).maybeSingle(); if (l && l.data && l.data.voornaam) voornaam = l.data.voornaam; }
  const titel = c.titel || "Familiedag " + jaar;
  const m = await sysMail(sb, "familiedag-bevestiging", { voornaam: esc(voornaam), naam: esc(d.naam), jaar, titel: esc(titel), titel_klein: esc(titel.toLowerCase().startsWith("familiedag") ? titel.toLowerCase() : titel), betaald, gratis: !(bedrag > 0),
    gegevens: tabel([rij("Wanneer", c.datum ? esc(lang(c.datum)) + (c.uur ? " om " + esc(c.uur) : "") : ""), rij("Waar", esc(c.locatie || "")), rij("Op naam van", esc(d.naam)),
      ...(d.lijnen || []).map(l => rij(l.naam, `${l.aantal} &times; ${l.gratis ? "gratis voor leden" : eur(l.prijs)}`)), rij("Opmerking", esc(d.opmerking || "")), rij("Totaal", `<b>${bedrag > 0 ? eur(bedrag) : "gratis"}</b>`)]),
    betaling: bedrag > 0 ? betaalBlok({ betaald, betaling: d.betaling, bedrag, rekeningnummer: A.rekeningnummer || DEF_IBAN, begunstigde: A.vereniging, mededeling: `${d.naam} Familiedag ${jaar}`, tegen: ins.tot }) : "",
    info: c.info ? esc(c.info).replace(/\n/g, "<br>") : "", bedrag: bedrag > 0 ? eur(bedrag) : "gratis" });
  const html = m.html;
  return { aan, aanNaam: d.naam || "", onderwerp: m.onderwerp, html: huisstijl(html, A.vereniging, { bovenschrift: "Bevestiging", titel: esc(titel) }), betaald: betaald || bedrag === 0 };
}
export async function mailBetaald(sb, tabel, row) {
  const d = row.data, A = await algemeen(sb), b = d.betaling || {};
  let aan = "", voornaam = "", wat = "";
  if (tabel === "leden") { aan = d.email; voornaam = d.voornaam; wat = `je lidgeld ${b.jaar || ""}`.trim(); }
  else if (tabel === "familiedag") { aan = d.email; voornaam = String(d.naam || "").split(" ").slice(-1)[0]; wat = `de familiedag ${d.jaar || ""}`.trim(); }
  else { const { data: lid } = d.lidId ? await sb.from("leden").select("data").eq("id", d.lidId).maybeSingle() : { data: null }; aan = lid && lid.data && lid.data.email; voornaam = lid && lid.data && lid.data.voornaam; wat = `het banket ${d.jaar || ""}`.trim(); }
  aan = String(aan || "").trim(); if (!aan) return null;
  const m = await sysMail(sb, "betaling-ontvangen", { voornaam: esc(voornaam || ""), wat: esc(wat), bedrag: eur(b.bedrag), lidgeld: tabel === "leden", banket: tabel === "banket", familiedag: tabel === "familiedag",
    betaling: betaalBlok({ betaald: true, betaling: b, bedrag: b.bedrag }) });
  const html = m.html.replace(/Dag\s+!/g, "Hallo!");
  return { aan, aanNaam: voornaam || "", onderwerp: m.onderwerp, html: huisstijl(html, A.vereniging, { bovenschrift: "Betaling ontvangen", titel: esc(wat.replace(/^(je|de|het)\s+/i, "").replace(/^./, x => x.toUpperCase())) }), betaald: true };
}

/* ---------- versturen ---------- */
async function haal(sb, tabel, id) { const { data } = await sb.from(tabel).select("id,data").eq("id", id).maybeSingle(); return data; }
async function zet(sb, tabel, id, patch) { const r = await haal(sb, tabel, id); if (!r) return; const { error } = await sb.from(tabel).update({ data: { ...r.data, ...patch } }).eq("id", id); if (error) throw error; }
async function stuur(m) { if (!m || !smtpConfigured()) return false; const cc = (m.cc || []).filter(c => c && c.toLowerCase() !== String(m.aan).toLowerCase()); const [r] = await verstuur([{ aan: m.aan, aanNaam: m.aanNaam, onderwerp: m.onderwerp, html: m.html, van: afzender(), ...(cc.length ? { cc } : {}) }]); return !!(r && r.ok); }
const MAKER = { banket: mailBanket, leden: mailNieuwLid, kinderfeest: mailKinderfeest, familiedag: mailFamiliedag };

export async function wachtOpBetaling(sb, tabel, id) { await zet(sb, tabel, id, { bevestiging: { status: "wacht", sinds: new Date().toISOString() } }); }
export async function stuurBevestiging(sb, tabel, id) {
  const r = await haal(sb, tabel, id); if (!r) return false;
  if (r.data.bevestiging && r.data.bevestiging.status === "verstuurd") return true;
  if (r.data.bevestiging && r.data.bevestiging.status === "dubbel") return false;
  const m = await MAKER[tabel](sb, r);
  if (!m) { await zet(sb, tabel, id, { bevestiging: { status: "geen-adres", op: new Date().toISOString() } }); return false; }
  // vangnet: dezelfde bevestiging (zelfde inschrijving, betaling en betaalstatus) nooit twee keer, ook niet als de rij intussen
  // door een verouderde kopie in de app terug op "wacht" gezet werd
  const sleutel = `bev:${tabel}:${id}:${(r.data.betaling && r.data.betaling.id) || "-"}:${m.betaald ? 1 : 0}`;
  try { const { data: nw, error } = await sb.from("bevestiging_log").upsert({ k: sleutel }, { onConflict: "k", ignoreDuplicates: true }).select("k"); if (!error && Array.isArray(nw) && !nw.length) { await zet(sb, tabel, id, { bevestiging: { ...(r.data.bevestiging || {}), status: "verstuurd", aan: m.aan, betaald: !!m.betaald, voor: (r.data.betaling && r.data.betaling.id) || null, al: true } }); return true; } } catch (e) { console.error("bevestiging vangnet", e); }
  const ok = await stuur(m);
  if (!ok) { try { await sb.from("bevestiging_log").delete().eq("k", sleutel); } catch (e) {} } // niet gelukt: later opnieuw proberen mag
  if (ok) await zet(sb, tabel, id, { bevestiging: { status: "verstuurd", op: new Date().toISOString(), aan: m.aan, betaald: !!m.betaald, voor: (r.data.betaling && r.data.betaling.id) || null } });
  if (ok && tabel === "leden") { try { await nastuur(sb, id); } catch (e) { console.error("nastuur", e); } }
  return ok;
}
/* Bulkmails die na de inschrijving van een nieuw lid nog lopen (bv. uitnodiging activiteiten): automatisch nasturen via de wachtrij.
   Ingesteld in de app (Mails › Nieuwe leden), config "nastuur".regels[tplId] = {onderwerp, html met @@VOORNAAM@@/@@NAAM@@, tot}. */
export async function nastuur(sb, id) {
  const { data: c } = await sb.from("config").select("data").eq("id", "nastuur").maybeSingle();
  const regels = (c && c.data && c.data.regels) || {}, nu = vandaag();
  const r = await haal(sb, "leden", id); if (!r) return 0;
  const d = r.data, aan = String(d.email || "").trim().toLowerCase(); if (!aan || d.geenLid) return 0;
  const { data: bl } = await sb.from("config").select("data").eq("id", "mail").maybeSingle();
  if (bl && bl.data && bl.data.geblokkeerd && bl.data.geblokkeerd[aan]) return 0;
  const al = { ...(d.nastuur || {}) }, rijen = [];
  // enkel regels met auto:true sturen nog automatisch; standaard toont de app een melding op het dashboard
  const actief = Object.entries(regels).filter(([tpl, R]) => R && R.auto === true && R.html && R.tot && R.tot >= nu && !al[tpl] && !(R.na && String(d.aangemeld || "") <= R.na));
  if (!actief.length) return 0;
  // pas nasturen als het lidgeld ontvangen is
  if (!(await lidgeldOntvangen(sb, id, d))) return 0;
  for (const [tpl, R] of actief) {
    const vn = esc(d.voornaam || ""), nm = esc([d.voornaam, d.naam].filter(Boolean).join(" "));
    const vulIn = (t, h) => String(t).split("%40%40LIDID%40%40").join(encodeURIComponent(id)).split("@@LIDID@@").join(encodeURIComponent(id)).split("@@VOORNAAM@@").join(h ? vn : d.voornaam || "").split("@@NAAM@@").join(h ? nm : [d.voornaam, d.naam].filter(Boolean).join(" ")).replace(/Dag\s+!/g, "Hallo!");
    rijen.push({ batch: "nastuur-" + tpl.replace(/[^\w.-]/g, "") + "-" + Date.now().toString(36), data: { aan, aanNaam: [d.voornaam, d.naam].filter(Boolean).join(" "), onderwerp: vulIn(R.onderwerp, false), html: ondertekenLinks(vulIn(R.html, true)), label: "Nagestuurd: " + (R.naam || tpl) } });
    al[tpl] = new Date().toISOString();
  }
  if (!rijen.length) return 0;
  const { error } = await sb.from("mail_wachtrij").insert(rijen); if (error) throw error;
  await zet(sb, "leden", id, { nastuur: al });
  return rijen.length;
}
/* lidgeld ontvangen? Dezelfde regels als de app: online betaald, manueel OK, of een lidgeldtransactie op naam */
async function lidgeldOntvangen(sb, id, d) {
  if (d.betaling && d.betaling.status === "SUCCEEDED") return true;
  if (d.lidgeldBedrag != null && !(Number(d.lidgeldBedrag) > 0)) return true;
  const J = Number((d.betaling && d.betaling.jaar) || d.lidSinds || new Date().getFullYear());
  const { data: j } = await sb.from("jaarleden").select("data").eq("id", J + "_" + id).maybeSingle();
  const lg = j && j.data && j.data.lidgeld;
  if (lg === "OK") return true; if (lg === "NOK") return false;
  const n1 = norm(d.naam), n2 = norm(d.voornaam);
  return (await lidgeldBoekingen(sb, J)).some(r => { const b = r.data || {}, m = norm(b.mededeling), c = norm(b.categorie);
    const kp = x => String(x || "").replace(/[^a-z0-9]/g, ""), mk = kp(m);
    return b.lidId === id || (n1 && n2 && (m.includes("lidgeld") || c.startsWith("lidgeld")) && ((m.includes(n1) && m.includes(n2)) || (kp(n1) && kp(n2) && mk.includes(kp(n1)) && mk.includes(kp(n2))))); });
}
/* geplande taak: nieuwe leden die nog op een nagestuurde mail wachten (bv. omdat hun lidgeld pas later binnenkwam) */
async function nastuurCron(sb) {
  const { data: c } = await sb.from("config").select("data").eq("id", "nastuur").maybeSingle();
  const nu = vandaag(), R = Object.values((c && c.data && c.data.regels) || {}).filter(R => R && R.auto === true && R.html && R.tot && R.tot >= nu);
  if (!R.length) return [];
  const vanaf = R.map(x => x.na || x.sinds || "").sort()[0] || new Date(Date.now() - 60 * 864e5).toISOString();
  const { data } = await sb.from("leden").select("id,data").gt("data->>aangemeld", vanaf).eq("data->bevestiging->>status", "verstuurd").limit(100);
  const uit = [];
  for (const r of data || []) { try { if (await nastuur(sb, r.id)) uit.push(r.id); } catch (e) { console.error("nastuur", r.id, e); } }
  return uit;
}
/* opgeroepen zodra een online betaling gelukt is */
export async function betalingGelukt(sb, tabel, id) {
  if (!smtpConfigured()) return;
  const r = await haal(sb, tabel, id); if (!r) return;
  const bev = r.data.bevestiging, b = r.data.betaling || {};
  if (b.bevestigd) return;
  if (bev && bev.status === "wacht") { await stuurBevestiging(sb, tabel, id); }
  else if (!(bev && bev.status === "verstuurd" && bev.betaald && bev.voor === b.id)) { const m = await mailBetaald(sb, tabel, r); if (m) await stuur(m); }
  await zet(sb, tabel, id, { betaling: { ...((await haal(sb, tabel, id)) || r).data.betaling, bevestigd: true } });
  if (tabel === "leden") { try { await nastuur(sb, id); } catch (e) { console.error("nastuur", e); } }
}
/* geplande taak: bevestigingen die langer dan 20 minuten op een betaling wachten */
export async function bevestigingenCron(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!(await isDbCron(req))) throw httpErr(403, "Geen toegang");
  const sb = admin(), grens = new Date(Date.now() - 20 * 60 * 1000).toISOString(), uit = [];
  for (const tabel of ["banket", "leden", "familiedag"]) {
    const { data } = await sb.from(tabel).select("id,data").eq("data->bevestiging->>status", "wacht").limit(25);
    for (const r of data || []) {
      try { if (r.data.betaling && r.data.betaling.id) await controleerBetaling(sb, tabel, r); } catch (e) { console.error("controle", e); }
      // nog geen 20 minuten oud en de betaling loopt nog: wachten. Verlopen of mislukt: meteen de bevestiging met de overschrijving.
      if (String(r.data.bevestiging.sinds || "") >= grens) { const nu = await haal(sb, tabel, r.id), st = nu && nu.data.betaling && nu.data.betaling.status; if (!st || !/^(EXPIRED|FAILED|CANCELED|CANCELLED|AUTHORIZATION_FAILED|ERROR)$/i.test(st)) continue; }
      try { if (await stuurBevestiging(sb, tabel, r.id)) uit.push(tabel + "/" + r.id); } catch (e) { console.error("bevestiging", e); }
    }
  }
  let facturen = [];
  try { facturen = await (await import("./factuur.js")).factuurCron(sb); } catch (e) { console.error("facturen", e); }
  let inkomend = null;
  try { inkomend = await (await import("./inkomend.js")).inkomendCron(sb); } catch (e) { console.error("inkomend", e); inkomend = { fout: e.message }; }
  let betaalherinnering = null;
  try { betaalherinnering = await (await import("./betaalherinnering.js")).betaalHerinneringCron(sb); } catch (e) { console.error("betaalherinnering", e); betaalherinnering = { fout: e.message }; }
  let fuif = null;
  try { fuif = await (await import("./fuif.js")).fuifCron(sb); } catch (e) { console.error("fuif", e); fuif = { fout: e.message }; }
  let kassa = null;
  try { kassa = await (await import("./kassa.js")).kassaCron(sb); } catch (e) { console.error("kassa", e); kassa = { fout: e.message }; }
  let shop = null;
  try { shop = await (await import("./shop.js")).shopCron(sb); } catch (e) { console.error("shop", e); shop = { fout: e.message }; }
  let nagestuurd = null;
  try { nagestuurd = await nastuurCron(sb); } catch (e) { console.error("nastuur", e); nagestuurd = { fout: e.message }; }
  let goud = null;
  try { goud = await (await import("./goudmail.js")).goudCron(sb); } catch (e) { console.error("goud", e); goud = { fout: e.message }; }
  let puntenMail = null;
  try { puntenMail = await (await import("./goudmail.js")).puntenCron(sb); } catch (e) { console.error("punten", e); puntenMail = { fout: e.message }; }
  let betaalWacht = null;
  try { betaalWacht = await (await import("./betaalwacht.js")).betaalWachtCron(sb); } catch (e) { console.error("betaalwacht", e); betaalWacht = { fout: e.message }; }
  res.status(200).json({ verstuurd: uit, herinneringenFacturen: facturen, inkomend, betaalherinnering, fuif, kassa, shop, goud, nagestuurd, puntenMail, betaalWacht });
}
// gedeeld met de facturatie (api/_lib/factuur.js)
export { huisstijl, modern, kaderBlok, knop, tabel, rij, p, esc, eur, kort, lang, vandaag, plusDagen, site, betaalBlok, DEF_IBAN };

/* voorbeeld van de bevestigingsmail kinderfeest (app: Kinderfeest › tandwiel › Voorbeeld) */
export async function kfVoorbeeld(req, res) {
  const { sb } = await requireUser(req);
  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const A = await algemeen(sb), jaar = Number(b.jaar) || A.jaar, c0 = await configDoc(sb, "kf_" + jaar), c = { ...c0, ...(b.cfg || {}), mail: { ...(c0.mail || {}), ...((b.cfg && b.cfg.mail) || {}) } };
  const Y = Number(String(c.datum || jaar + "-12-19").slice(0, 4));
  const d = { jaar, lid: "Peeters Jan", voornaam: "Jan", kinderen: [{ naam: "Lotte", geb: (Y - 8) + "-04-02" }, { naam: "Mats", geb: (Y - 3) + "-09-15" }] };
  const html = huisstijl(String(await kfMailHtml(sb, d, { A, c, jaar })), A.vereniging);
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ html, standaard: kfMailDef(jaar, c.datum || jaar + "-12-19") });
}
