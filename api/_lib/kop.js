/* Kop van de automatische mails, zoals op de inschrijf- en openbare pagina's: rood bovenschrift + titel (+ embleem rechts).
   Velden zoals {jaar} worden ingevuld; een veld dat ontbreekt valt weg. Dezelfde lijst staat in de beheer-app (own/sysmail.js). */
export const KOP = {
  "banket-bevestiging": ["Bevestiging", "Banket {jaar}"],
  "herinnering-banket": ["Herinnering", "Banket {jaar}"],
  "banket-inschrijven": ["Inschrijving", "Banket {jaar}"],
  "lid-bevestiging": ["Welkom", "Lidmaatschap {jaar}"],
  "herinnering-lidgeld": ["Herinnering", "Lidgeld {jaar}"],
  "betaling-ontvangen": ["Betaling", "Betaling ontvangen"],
  "kinderfeest-bevestiging": ["Bevestiging", "Kinderfeest {jaar}"],
  "kinderfeest-cadeaukeuze": ["Kinderfeest {jaar}", "Cadeaukeuze ontvangen"],
  "kinderfeest-cadeau-online": ["Kinderfeest {jaar}", "Kies het cadeau"],
  "kinderfeest-voorraad": ["Kinderfeest", "Cadeau niet meer op voorraad"],
  "kinderfeest-invullink": ["Kinderfeest {jaar}", "Inschrijving"],
  "familiedag-bevestiging": ["Bevestiging", "{titel}"],
  "pontoise-uitnodiging": ["Uitnodiging", "Pontoise {jaar}"],
  "pontoise-bevestiging": ["Kandidatuur", "Pontoise {jaar}"],
  "pontoise-melding": ["Nieuwe kandidaat", "Pontoise {jaar}"],
  "uitnodiging-banket": ["Uitnodiging", "Banket {jaar}"],
  "uitnodiging-kinderfeest": ["Uitnodiging", "Kinderfeest {jaar}"],
  "uitnodiging-familiedag": ["Uitnodiging", "{titel}"],
  "visite-invitation": ["Invitation", "Visite à Alost {jaar}"],
  "visite-confirmation": ["Confirmation", "Visite à Alost {jaar}"],
  "visite-melding": ["Pontoise", "Bezoek {jaar}"],
  "fuif-tickets": ["Tickets", "{fuif}"],
  "fuif-sponsoruitnodiging": ["Uitnodiging", "{fuif}"],
  "fuif-genodigde": ["Uitnodiging", "{fuif}"],
  "factuur": ["Factuur", "Factuur {nr}"],
  "factuur-herinnering": ["Herinnering", "Factuur {nr}"],
  "factuur-aanmaning": ["Aanmaning", "Factuur {nr}"],
  "factuur-betaald": ["Betaling ontvangen", "Factuur {nr}"],
  "creditnota": ["Creditnota", "Creditnota {nr}"],
  "sponsor-bevestiging": ["Sponsoring", "Kalender {kalenderjaar}"],
  "sponsor-melding": ["Sponsoring", "Nieuwe sponsor"],
  "sponsor-betaald": ["Sponsoring", "Betaling ontvangen"],
  "sponsorbevestiging": ["Sponsoring", "Sponsorbevestiging {nr}"],
  "goudstatus": ["Puntensysteem", "Proficiat met je goudstatus"],
  "punten": ["Puntensysteem", "Jouw punten in {jaar}"],
  "ronde-reservatie": ["Kalenderronde", "Reservatie bevestigd"],
  "kalender-herinnering": ["Herinnering", "Kalenders {jaar}"],
  "huur-login": ["Huurwinkel", "Jouw persoonlijke link"],
  "huur-tebetalen": ["Nog te betalen", "Materiaalverhuur"],
  "huur-melding": ["Nieuwe reservatie", "Materiaalverhuur"],
  "huur-geannuleerd": ["Geannuleerd", "Materiaalverhuur"],
  "huur-betaald": ["Reservatie bevestigd", "Materiaalverhuur"],
  "huur-betaalherinnering": ["Herinnering", "Materiaalverhuur"],
  "huur-herinnering": ["Herinnering", "Materiaalverhuur"],
  "huur-afgerond": ["Bedankt", "Materiaalverhuur"],
  "shop-bevestiging": ["Webshop", "Bevestiging bestelling"],
  "shop-verzonden": ["Webshop", "Bestelling verzonden"],
  "shop-klaar": ["Webshop", "Bestelling ligt klaar"],
  "vergadering-herinnering": ["Vergadering", "{titel}"],
  "vergadering-verslag": ["Verslag", "{titel}"],
  "toegang": ["Beheeromgeving", "Toegang tot VBHA Beheer"],
  "onkosten-link": ["Onkosten", "Onkosten terugvragen"],
  "terugbetaling-iban": ["Terugbetaling", "Rekeningnummer opvragen"],
  "onkosten-boekhouding": ["Boekhouding", "Nieuwe onkostennota"],
  "betaalwacht": ["Boekhouding", "Te verwerken betalingen"],
  "factuur-vervalt": ["Boekhouding", "Facturen die binnenkort vervallen"],
};
const schoon = s => String(s || "").replace(/<[^>]+>/g, "").replace(/\{[\w:\/]+\}/g, "").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
/* marker vooraan in de inhoud; huisstijl() haalt hem eruit en zet er bovenschrift + titel van */
export function kopMarker(key, vul) {
  const k = KOP[key]; if (!k) return "";
  const b = schoon(vul(k[0])), t0 = schoon(vul(k[1])), t = t0.charAt(0).toUpperCase() + t0.slice(1);
  return b || t ? `<!--vb-kop:${encodeURIComponent(b)}|${encodeURIComponent(t)}-->` : "";
}
export function leesKop(html) {
  const m = /^\s*<!--vb-kop:([^|]*)\|([^>]*)-->/.exec(String(html || ""));
  if (!m) return { html, boven: "", titel: "" };
  return { html: String(html).slice(m[0].length), boven: decodeURIComponent(m[1]), titel: decodeURIComponent(m[2]) };
}
