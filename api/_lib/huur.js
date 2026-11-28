import crypto from "node:crypto";
import { admin, httpErr, sendError, requireUser, IS_TEST } from "./sb.js";
import { clean, body, configDoc, algemeen, rateLimit, actieveLeden, vandaagISO, DEF_IBAN } from "./publiek.js";
import { onlineConfigured } from "./betaalprovider.js";
import { smtpConfigured, afzender, verstuur } from "./smtp.js";
import { huisstijl, kaderBlok, knop, tabel, rij, p, esc, eur, lang, plusDagen, site } from "./bevestiging.js";
import { registreer, sysMail } from "./sjabloon.js";
import { epcPayload, qrSvg } from "./epc.js";
import { lidStatus, tegoedSaldo } from "./status.js";
import { meldPush } from "./push.js";

/* ============ Materiaalverhuur (huurwinkel voor leden) ============
   Tabellen: "huur_items" {naam, beschrijving, afbeeldingen:[id], hoofd, aantal, prijsModus:"dag"|"beurt"|"beurtdag", prijsDag, prijsBeurt,
     beurtDagen, maxDagen, waarborg, checklist:[onderdelen], actief, volgorde}
   "huur" (reservaties) {nr, jaar, lidId, naam, voornaam, email, gsm, van, tot, dagen, lijnen:[{id,naam,aantal,stuk,huur,waarborg}], huurBruto, lidStatus, korting,
     kortingBedrag, huurNetto, tegoed:[{lidId,bedrag}], waarborg, teBetalen, betaalTegen, opmerking, staat, betaald, betaalwijze, betaalToken, betaling,
     afhaling:{op,check,fotos,opm,handtekening,door}, terugname:{op,check,fotos,opm,door}, waarborgTerug, log:[], mail:{}}
   Staat: tebetalen → betaald (= bevestigd) → uitgeleend (afgehaald) → afgerond (teruggebracht); of geannuleerd. "geblokkeerd" = eigen gebruik vriendenkring.
   Betalen: Bancontact (meteen bevestigd) of overschrijving (bevestigd zodra de betaling op de rekening staat: automatisch herkend in de transacties
   via het reservatienummer in de mededeling). Niet betaald na de betaaldatum + "vrijgevenNa" dagen: automatisch geannuleerd.
   Config "huur": {open, titel, intro, info, afhaaladres, contact, meldAan, korting, tegoed, voorwaarden, minVooraf, betaalDagen, autoVrijgeven, vrijgevenNa}
   Openbaar: /huur — aanmelden met je naam: we mailen een persoonlijke link (/huur?s=<sessie>), 30 dagen geldig.
   Afbeeldingen in "beelden": artikels "huur-…" (openbaar via /api/huur?img=…), foto's en handtekeningen van het bestuur "huurp-…" (niet openbaar). */
export const HUUR_DEF = { open: true, titel: "Materiaalverhuur", intro: "Als lid kan je materiaal van de vriendenkring huren, aan een voordelige ledenprijs.",
  info: "", afhaaladres: "Kazerne Brandweer Aalst, Vrijheidstraat 55, 9300 Aalst", contact: "", meldAan: "", korting: true, tegoed: true,
  voorwaarden: "Je gaat zorgvuldig om met het gehuurde materiaal en brengt het proper en volledig terug op het afgesproken moment. Schade of verlies wordt verrekend met de waarborg.",
  minVooraf: 2, betaalDagen: 3, autoVrijgeven: true, vrijgevenNa: 2 };
export const ACTIEF = ["tebetalen", "betaald", "uitgeleend", "geblokkeerd"];
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const geldig = a => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(String(a || ""));
const isoOk = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const dagenTussen = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5) + 1;
const kortD = iso => lang(iso).replace(/ \d{4}$/, "").replace(/^./, c => c.toLowerCase());
const periode = (a, b) => a === b ? kortD(a) : `${kortD(a)} tot en met ${kortD(b)}`;
const uurBxl = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", hour: "2-digit", hour12: false }).format(new Date()));
const nu = () => new Date().toISOString();

export async function huurCfg(sb) { const c = await configDoc(sb, "huur");
  return { ...HUUR_DEF, ...c, minVooraf: Math.max(0, Number(c.minVooraf ?? HUUR_DEF.minVooraf) || 0), betaalDagen: Math.max(1, Number(c.betaalDagen) || HUUR_DEF.betaalDagen),
    vrijgevenNa: Math.max(0, Number(c.vrijgevenNa ?? HUUR_DEF.vrijgevenNa) || 0), autoVrijgeven: c.autoVrijgeven !== false }; }
/* betalen vóór: binnen x dagen, maar ten laatste de dag vóór de huur (en nooit vóór vandaag) */
const betaalTegenVan = (c, van) => { const v = vandaagISO(), a = plusDagen(v, c.betaalDagen), b = plusDagen(van, -1); return [a, b].sort()[0] < v ? v : [a, b].sort()[0]; };

/* ---------- sessie: persoonlijke link (ondertekend, 30 dagen geldig) ---------- */
const sleutel = () => String(process.env.BETAAL_GEHEIM || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const sig = s => crypto.createHmac("sha256", sleutel()).update("vbha-huur|" + s).digest("base64url").slice(0, 24);
export function huurSessie(lidId, dagen = 30) { const s = Buffer.from(`${lidId}|${Date.now() + dagen * 864e5}`).toString("base64url"); return s + "." + sig(s); }
function leesSessie(t) {
  const [s, h] = String(t || "").split("."); if (!s || !h || !sleutel()) return null;
  const a = Buffer.from(sig(s)), b = Buffer.from(h); if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const [lidId, exp] = Buffer.from(s, "base64url").toString().split("|"); if (!lidId || !(Number(exp) > Date.now())) return null;
  return lidId;
}
export const huurLink = (lidId, basis) => `${basis || site()}/huur?s=${huurSessie(lidId)}`;

/* ---------- artikelen, prijs en beschikbaarheid ---------- */
async function items(sb, alles) {
  const { data, error } = await sb.from("huur_items").select("id,data"); if (error) throw error;
  return (data || []).map(r => ({ id: r.id, ...r.data })).filter(i => i.naam && (alles || i.actief !== false))
    .sort((a, b) => (Number(a.volgorde) || 0) - (Number(b.volgorde) || 0) || String(a.naam).localeCompare(String(b.naam), "nl"));
}
const pubItem = i => ({ id: i.id, naam: i.naam, beschrijving: i.beschrijving || "", hoofd: i.hoofd || (i.afbeeldingen || [])[0] || null, afbeeldingen: i.afbeeldingen || [],
  aantal: Math.max(1, Number(i.aantal) || 1), prijsModus: i.prijsModus || "dag", prijsDag: r2(i.prijsDag), prijsBeurt: r2(i.prijsBeurt), beurtDagen: Math.max(1, Number(i.beurtDagen) || 1),
  maxDagen: Number(i.maxDagen) || null, waarborg: r2(i.waarborg), korting: i.korting !== false });
/* huurprijs van één stuk voor d dagen (zonder korting) */
export function stukPrijs(i, d) {
  const m = i.prijsModus || "dag", B = Math.max(1, Number(i.beurtDagen) || 1);
  if (m === "beurt") return r2(i.prijsBeurt);
  if (m === "beurtdag") return r2(Number(i.prijsBeurt || 0) + Math.max(0, d - B) * Number(i.prijsDag || 0));
  return r2(Number(i.prijsDag || 0) * d);
}
const maxD = i => (i.prijsModus === "beurt" ? Math.max(1, Number(i.beurtDagen) || 1) : 0) || Number(i.maxDagen) || 0;
async function reservaties(sb) {
  const { data, error } = await sb.from("huur").select("id,data").limit(5000); if (error) throw error;
  return (data || []).map(r => ({ id: r.id, ...r.data }));
}
/* vrije stuks van een artikel in een periode (negatief = overboekt) */
export function vrijAantal(R, item, van, tot, behalve) {
  let max = 0;
  for (let d = van; d <= tot; d = plusDagen(d, 1)) {
    let n = 0; for (const r of R) if (r.id !== behalve && ACTIEF.includes(r.staat) && r.van <= d && r.tot >= d) for (const l of r.lijnen || []) if (l.id === item.id) n += Number(l.aantal) || 0;
    if (n > max) max = n;
  }
  return Math.max(1, Number(item.aantal) || 1) - max;
}
/* bezette periodes per artikel (openbaar, zonder namen) */
function bezetting(R, I) {
  const vandaag = vandaagISO(), out = {};
  for (const i of I) { const L = []; for (const r of R) if (ACTIEF.includes(r.staat) && r.tot >= vandaag) for (const l of r.lijnen || []) if (l.id === i.id) L.push({ van: r.van, tot: r.tot, n: Number(l.aantal) || 0 }); out[i.id] = L; }
  return out;
}
/* volledige berekening van een mandje */
async function bereken(sb, c, lidId, A, { van, tot, want, tegoed }, { R, I, behalve, vrijeDatum } = {}) {
  if (!isoOk(van) || !isoOk(tot)) throw httpErr(400, "Kies een begin- en einddatum.");
  if (tot < van) throw httpErr(400, "De einddatum ligt vóór de begindatum.");
  const vroegst = plusDagen(vandaagISO(), c.minVooraf);
  if (!vrijeDatum && van < vroegst) throw httpErr(400, c.minVooraf ? `Huren kan ten vroegste vanaf ${kortD(vroegst)}.` : "Kies een datum vanaf vandaag.");
  if (van > plusDagen(vandaagISO(), 400)) throw httpErr(400, "Zo ver vooruit kan je nog niet reserveren.");
  const dagen = dagenTussen(van, tot);
  I = I || await items(sb); R = R || await reservaties(sb);
  const M = new Map(I.map(i => [i.id, i])), lijnen = [];
  for (const [id, n] of Object.entries(want || {})) {
    const i = M.get(id), aantal = Math.floor(Number(n)) || 0; if (!i || aantal <= 0) continue;
    const md = maxD(i); if (md && dagen > md && lidId) throw httpErr(400, `${i.naam} kan je maximaal ${md === 1 ? "1 dag" : md + " dagen"} na elkaar huren.`);
    const vrij = Math.max(0, vrijAantal(R, i, van, tot, behalve));
    if (aantal > vrij) throw httpErr(409, vrij ? `Van ${i.naam} ${vrij === 1 ? "is er nog 1" : "zijn er nog " + vrij} beschikbaar in die periode.` : `${i.naam} is niet beschikbaar in die periode. Kies andere data.`);
    const stuk = stukPrijs(i, dagen);
    lijnen.push({ id, naam: i.naam, aantal, stuk, huur: r2(stuk * aantal), waarborg: r2(Number(i.waarborg || 0) * aantal), korting: true }); // statuskorting: instelling van de hele huurwinkel
  }
  if (!lijnen.length) throw httpErr(400, "Kies minstens één artikel.");
  const S = lidId ? await lidStatus(sb, lidId, A.jaar) : null;
  const pct = c.korting && S ? Number(S.korting) || 0 : 0;
  const huurBruto = r2(lijnen.reduce((t, l) => t + l.huur, 0)), kortbaar = r2(lijnen.filter(l => l.korting).reduce((t, l) => t + l.huur, 0));
  const kortingBedrag = r2(kortbaar * pct / 100), huurNetto = r2(huurBruto - kortingBedrag), waarborg = r2(lijnen.reduce((t, l) => t + l.waarborg, 0));
  const saldo = c.tegoed && S && S.tegoed ? (await tegoedSaldo(sb, lidId, A.jaar, S)).saldo : 0;
  const teg = r2(Math.max(0, Math.min(Number(String(tegoed ?? 0).replace(",", ".")) || 0, saldo, huurNetto)));
  return { van, tot, dagen, lijnen, huurBruto, lidStatus: S ? S.status : null, korting: pct, kortingBedrag, huurNetto, tegoedSaldo: saldo, tegoed: teg, waarborg, teBetalen: r2(huurNetto - teg + waarborg) };
}
async function volgNr(sb, jaar, pre = "H") {
  const { data } = await sb.from("huur").select("data->>nr");
  let max = 0; for (const r of data || []) { const m = String(r.nr || "").match(new RegExp("^[HB]" + jaar + "-(\\d+)$")); if (m) max = Math.max(max, +m[1]); }
  return `${pre}${jaar}-${String(max + 1).padStart(3, "0")}`;
}
const mededeling = d => `Huur ${d.nr} ${d.naam}`.slice(0, 140);
const pubRes = (d, id) => ({ id, nr: d.nr, van: d.van, tot: d.tot, dagen: d.dagen, lijnen: (d.lijnen || []).map(l => ({ id: l.id, naam: l.naam, aantal: l.aantal, huur: l.huur, waarborg: l.waarborg })),
  huurBruto: d.huurBruto, korting: d.korting, kortingBedrag: d.kortingBedrag, lidStatus: d.lidStatus, huurNetto: d.huurNetto, tegoed: (d.tegoed || []).reduce((t, x) => t + (Number(x.bedrag) || 0), 0),
  waarborg: d.waarborg, teBetalen: d.teBetalen, staat: d.staat, betaald: !!d.betaald, betaalwijze: d.betaalwijze || null, reden: d.reden || "", betaalTegen: d.betaalTegen || null,
  aangemeld: d.aangemeld, waarborgTerug: d.waarborgTerug || null });
const betaalInfo = (A, d) => ({ rekeningnummer: A.rekeningnummer || DEF_IBAN, begunstigde: A.vereniging, mededeling: mededeling(d), bedrag: d.teBetalen, betaalTegen: d.betaalTegen || null,
  qr: (() => { try { return qrSvg(epcPayload({ naam: A.vereniging, iban: A.rekeningnummer || DEF_IBAN, bedrag: d.teBetalen, mededeling: mededeling(d) })); } catch (e) { return null; } })() });
async function logZet(sb, id, d, wat, door) { const nd = { ...d, log: [...(d.log || []), { op: nu(), wat, door: door || "" }].slice(-40) }; const { error } = await sb.from("huur").update({ data: nd }).eq("id", id); if (error) throw error; return nd; }

/* ---------- mails ---------- */
const MV = [["voornaam", "Voornaam"], ["nr", "Reservatienummer"], ["periode", "Periode"], ["overzicht", "Tabel met de artikels en prijzen"], ["link", "Persoonlijke link huurwinkel"], ["knop", "Knop naar de huurwinkel"]];
const MVV = { voornaam: "Jan", nr: "H2027-004", periode: "zaterdag 12 juni tot en met zondag 13 juni", link: "https://vbha.be/huur" };
registreer({ key: "huur-login", naam: "Huurwinkel: persoonlijke link", wanneer: "Als een lid zich aanmeldt in de huurwinkel (/huur).",
  onderwerp: "Je persoonlijke link voor de huurwinkel",
  body: p("Dag {voornaam}!") + p("Met de knop hieronder kom je in jouw persoonlijke huurwinkel. Daar zie je wat je kan huren en aan welke prijs, reserveer en betaal je, en vind je je reservaties terug.") + "<p>{knop}</p>"
    + p("De link is 30 dagen geldig en enkel voor jou bedoeld: stuur deze mail dus niet door. Heb je niets aangevraagd? Dan mag je deze mail gewoon negeren.", "margin:0 0 16px;font-size:13.5px;color:#686B71"),
  velden: [["voornaam", "Voornaam"], ["link", "Persoonlijke link"], ["knop", "Knop naar de huurwinkel"]], voorbeeld: MVV });
registreer({ key: "huur-tebetalen", naam: "Huurwinkel: reservatie nog te betalen", wanneer: "Na een reservatie met overschrijving (of als een Bancontact-betaling na 20 minuten niet gelukt is).",
  onderwerp: "Je reservatie {nr}: nog te betalen",
  body: p("Dag {voornaam}!") + p("Bedankt voor je reservatie. We houden het materiaal voor je vast tot <b>{tegen}</b>. Zodra je betaling binnen is, is je reservatie definitief en krijg je een bevestiging.")
    + kaderBlok("Reservatie {nr} · {periode}", "{overzicht}") + "{betaling}" + "<p>{knop}</p>",
  velden: [...MV, ["bedrag", "Te betalen"], ["tegen", "Betalen vóór"], ["betaling", "Blok met de betaalgegevens"]], voorbeeld: { ...MVV, bedrag: "€60,00", tegen: "zaterdag 5 juni" } });
registreer({ key: "huur-melding", naam: "Huurwinkel: melding nieuwe reservatie (bestuur)", wanneer: "Na een reservatie, naar het adres in de instellingen van Materiaalverhuur.",
  onderwerp: "Nieuwe reservatie {nr} van {naam}",
  body: p("Er is een nieuwe reservatie in de huurwinkel.") + kaderBlok("{naam} · {periode}", "{overzicht}") + p("Betaling: {betaling}") + "{als:opmerking}" + p("<i>Opmerking: {opmerking}</i>") + "{/als:opmerking}"
    + p("Je vindt alles in VBHA Beheer › Vereniging › Materiaalverhuur."),
  velden: [["naam", "Naam lid"], ["nr", "Reservatienummer"], ["periode", "Periode"], ["overzicht", "Tabel"], ["betaling", "Betaalwijze"], ["opmerking", "Opmerking van het lid"]], voorbeeld: { ...MVV, naam: "Peeters Jan", betaling: "Bancontact", opmerking: "" } });
registreer({ key: "huur-betaald", naam: "Huurwinkel: reservatie bevestigd", wanneer: "Zodra de huur betaald is (Bancontact, overschrijving of aangeduid door het bestuur).",
  onderwerp: "Je reservatie {nr} is bevestigd",
  body: p("Dag {voornaam}!") + p("We ontvingen je betaling van <b>{bedrag}</b>. Je reservatie is <b>bevestigd</b>.") + kaderBlok("Reservatie {nr} · {periode}", "{overzicht}")
    + kaderBlok("Afhalen en terugbrengen", "{afhalen}") + "<p>{knop}</p>",
  velden: [...MV, ["bedrag", "Betaald bedrag"], ["afhalen", "Info afhalen (instellingen)"]], voorbeeld: { ...MVV, bedrag: "€60,00", afhalen: "Afhalen in de kazerne. We nemen contact met je op om een moment af te spreken." } });
registreer({ key: "huur-betaalherinnering", naam: "Huurwinkel: herinnering betalen", wanneer: "Eén keer, op de betaaldatum van een reservatie die nog niet betaald is.",
  onderwerp: "Herinnering: betaal je reservatie {nr}",
  body: p("Dag {voornaam}!") + p("We ontvingen nog geen betaling van <b>{bedrag}</b> voor je reservatie van {periode}. Betaal zo snel mogelijk, anders vervalt je reservatie en geven we het materiaal vrij{als:vrij} op <b>{vrij}</b>{/als:vrij}.") + "{betaling}" + "<p>{knop}</p>",
  velden: [...MV, ["bedrag", "Te betalen"], ["vrij", "Datum waarop de reservatie vervalt"], ["betaling", "Blok met de betaalgegevens"]], voorbeeld: { ...MVV, bedrag: "€60,00", vrij: "maandag 7 juni" } });
registreer({ key: "huur-geannuleerd", naam: "Huurwinkel: reservatie geannuleerd", wanneer: "Als een reservatie vervalt (niet tijdig betaald) of als het bestuur ze annuleert (en de mail aanvinkt).",
  onderwerp: "Je reservatie {nr} is geannuleerd",
  body: p("Dag {voornaam}!") + p("Je reservatie voor {periode} is geannuleerd.") + "{als:reden}" + p("<b>Reden:</b> {reden}") + "{/als:reden}" + p("Vragen? Neem gerust contact met ons op. Je kan altijd een nieuwe reservatie maken in de huurwinkel.") + "<p>{knop}</p>",
  velden: [...MV, ["reden", "Reden"]], voorbeeld: { ...MVV, reden: "We ontvingen geen betaling." } });
registreer({ key: "huur-herinnering", naam: "Huurwinkel: herinnering afhalen", wanneer: "De dag vóór het begin van een bevestigde huur (vanaf 10u).",
  onderwerp: "Morgen begint je huur ({nr})",
  body: p("Dag {voornaam}!") + p("Een korte herinnering: morgen begint je huur.") + kaderBlok("Reservatie {nr} · {periode}", "{overzicht}") + kaderBlok("Afhalen en terugbrengen", "{afhalen}") + p("Veel plezier ermee!"),
  velden: [...MV, ["afhalen", "Info afhalen (instellingen)"]], voorbeeld: { ...MVV, afhalen: "Afhalen in de kazerne." } });
registreer({ key: "huur-afgerond", naam: "Huurwinkel: huur afgerond", wanneer: "Als het bestuur het materiaal als teruggebracht aanduidt (en de mail aanvinkt).",
  onderwerp: "Bedankt om te huren bij de vriendenkring ({nr})",
  body: p("Dag {voornaam}!") + p("We kregen het materiaal goed terug. Bedankt om bij de vriendenkring te huren!") + "{als:waarborg}" + p("{waarborg}") + "{/als:waarborg}" + p("Tot een volgende keer!"),
  velden: [...MV, ["waarborg", "Zin over de waarborg"]], voorbeeld: { ...MVV, waarborg: "Je waarborg van €50,00 storten we terug op je rekening." } });

function overzicht(d) {
  const R = (d.lijnen || []).map(l => rij(`${l.aantal} × ${l.naam}`, eur(l.huur)));
  if (d.kortingBedrag) R.push(rij(`Korting ${d.lidStatus ? d.lidStatus.toLowerCase() + " " : ""}(${d.korting}%)`, "− " + eur(d.kortingBedrag)));
  const teg = (d.tegoed || []).reduce((t, x) => t + (Number(x.bedrag) || 0), 0); if (teg) R.push(rij("Goudtegoed", "− " + eur(teg)));
  if (d.waarborg) R.push(rij("Waarborg (krijg je terug)", eur(d.waarborg)));
  R.push(rij("Totaal", `<b>${eur(d.teBetalen)}</b>`));
  return tabel(R);
}
function afhaalTekst(c) { return esc(c.info || `Je haalt het materiaal af in de kazerne (${c.afhaaladres}). We nemen contact met je op om een moment af te spreken.`).replace(/\n/g, "<br>") + (c.contact ? "<br><br>Contact: " + esc(c.contact) : ""); }
const betaalBlokMail = (A, d) => kaderBlok("Nog te betalen", tabel([rij("Bedrag", `<b>${eur(d.teBetalen)}</b>`), rij("Rekening", `<b>${esc(A.rekeningnummer || DEF_IBAN)}</b>`), rij("Begunstigde", esc(A.vereniging)), rij("Mededeling", `<b>${esc(mededeling(d))}</b>`)])
  + p("Vermeld zeker de mededeling: zo herkennen we je betaling automatisch.", "margin:10px 0 0;font-size:13.5px;color:#686B71"), "#b30000");
const SOORT = { tebetalen: "huur-tebetalen", betaald: "huur-betaald", herinnering: "huur-herinnering", betaalherinnering: "huur-betaalherinnering", geannuleerd: "huur-geannuleerd", afgerond: "huur-afgerond" };
export async function huurMail(sb, id, soort, extra = {}, basis) {
  if (!smtpConfigured()) return false;
  const { data: r } = await sb.from("huur").select("id,data").eq("id", id).maybeSingle(); if (!r || !r.data.lidId) return false;
  const d = r.data, c = await huurCfg(sb), A = await algemeen(sb), link = huurLink(d.lidId, basis);
  const V = { voornaam: esc(d.voornaam || d.naam), naam: esc(d.naam), nr: esc(d.nr), periode: esc(periode(d.van, d.tot)), overzicht: overzicht(d), link: esc(link), knop: knop("Naar mijn huurwinkel", link),
    bedrag: eur(d.teBetalen), tegen: esc(d.betaalTegen ? kortD(d.betaalTegen) : ""), reden: esc(d.reden || ""), afhalen: afhaalTekst(c), betaling: betaalBlokMail(A, d),
    vrij: c.autoVrijgeven && d.betaalTegen ? esc(kortD(plusDagen(d.betaalTegen, c.vrijgevenNa + 1))) : "", ...extra };
  const key = SOORT[soort]; if (!key || !geldig(d.email)) return false;
  const m = await sysMail(sb, key, V);
  const [x] = await verstuur([{ aan: d.email, aanNaam: d.naam, onderwerp: m.onderwerp, html: huisstijl(m.html, A.vereniging), van: afzender() }]);
  if (x && x.ok) { const { data: n } = await sb.from("huur").select("data").eq("id", id).maybeSingle(); await sb.from("huur").update({ data: { ...n.data, mail: { ...(n.data.mail || {}), [soort]: nu() } } }).eq("id", id); }
  return !!(x && x.ok);
}
async function meldBestuur(sb, id, d, c) {
  try { await meldPush(sb, "iedereen", { titel: "Nieuwe reservatie materiaal", tekst: `${d.nr} · ${d.naam} · ${periode(d.van, d.tot)}`, url: "/#huur", tag: "huur-" + id, lidId: d.lidId }); } catch (e) { console.error("huur push", e); }
  if (!smtpConfigured() || !geldig(c.meldAan)) return;
  try { const A = await algemeen(sb), m = await sysMail(sb, "huur-melding", { naam: esc(d.naam), nr: esc(d.nr), periode: esc(periode(d.van, d.tot)), overzicht: overzicht(d), opmerking: esc(d.opmerking || ""), betaling: d.betaalwijze === "bancontact" ? "Bancontact" : d.betaald ? "niets te betalen" : "overschrijving" });
    await verstuur([{ aan: c.meldAan, aanNaam: "Bestuur", onderwerp: m.onderwerp, html: huisstijl(m.html, A.vereniging), van: afzender() }]); } catch (e) { console.error("huur melding", e); }
}

/* ---------- openbaar: /api/huur ---------- */
const basisUrl = req => { const h = req.headers["x-forwarded-host"] || req.headers.host; return IS_TEST && h ? "https://" + h : site(); };
async function startBc(sb, req, rid, rd) {
  const { startBetaling } = await import("./betaal.js");
  const nd = { ...rd, betaalwijze: "bancontact" }; await sb.from("huur").update({ data: nd }).eq("id", rid);
  const bt = await startBetaling(sb, req, "huur", { id: rid, data: nd }, { bedrag: rd.teBetalen, jaar: rd.jaar, terug: "/huur?betaling=terug" });
  return { t: "huur", id: rid, token: rd.betaalToken, deeplink: bt.deeplink, qrcode: bt.qrcode, checkout: bt.checkout, verlooptOp: bt.verlooptOp, provider: bt.provider || null };
}
export default async function huurPubliek(req, res) {
  try {
    const sb = admin(), q = req.query || {};
    if (req.method === "GET" && q.img) {
      const id = String(q.img); if (!/^huur-[\w-]{4,60}$/.test(id)) throw httpErr(404, "Niet gevonden");
      const { data } = await sb.from("beelden").select("data").eq("id", id).maybeSingle(); if (!data || !data.data || !data.data.web) throw httpErr(404, "Niet gevonden");
      res.setHeader("Content-Type", data.data.mime || "image/jpeg"); res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.status(200).send(Buffer.from(data.data.web, "base64"));
    }
    res.setHeader("Cache-Control", "no-store");
    const c = await huurCfg(sb), A = await algemeen(sb), b = req.method === "POST" ? body(req) : {};
    const s = String(q.s || b.s || req.headers["x-huur"] || "");
    const pub = { open: c.open !== false, titel: c.titel, intro: c.intro };

    // ---- zonder sessie: enkel aanmelden met je naam ----
    if (!s) {
      if (req.method === "GET") return res.status(200).json(pub);
      if (b.actie !== "login") throw httpErr(401, "Meld je eerst aan.");
      await rateLimit(sb, req, "huurlogin", 8, 3600, httpErr);
      if (b.website) return res.status(200).json({ ok: true });
      const l = (await actieveLeden(sb, A.jaar)).find(x => x.id === String(b.lidId || ""));
      if (!l) throw httpErr(400, "Kies je naam uit de lijst van leden. Enkel leden met een betaald lidgeld kunnen huren.");
      const { data: lr } = await sb.from("leden").select("data").eq("id", l.id).maybeSingle(); const email = String(lr?.data?.email || "").trim();
      if (!geldig(email)) return res.status(200).json({ ok: false, geenMail: true });
      const link = huurLink(l.id, basisUrl(req));
      if (IS_TEST) return res.status(200).json({ ok: true, testLink: link }); // testomgeving: er vertrekt nooit een mail
      if (!smtpConfigured()) throw httpErr(501, "Mails versturen is niet ingesteld.");
      const m = await sysMail(sb, "huur-login", { voornaam: esc(l.voornaam || l.naam), link: esc(link), knop: knop("Naar mijn huurwinkel", link) });
      const [x] = await verstuur([{ aan: email, aanNaam: l.naam, onderwerp: m.onderwerp, html: huisstijl(m.html, A.vereniging), van: afzender() }]);
      if (!x || !x.ok) throw httpErr(502, "De mail kon niet verstuurd worden. Probeer het later opnieuw.");
      return res.status(200).json({ ok: true });
    }

    // ---- met sessie ----
    const lidId = leesSessie(s); if (!lidId) throw httpErr(401, "Je link is verlopen of ongeldig. Vraag een nieuwe link aan.");
    const { data: lr } = await sb.from("leden").select("id,data").eq("id", lidId).maybeSingle(); if (!lr) throw httpErr(401, "Je link is ongeldig. Vraag een nieuwe link aan.");
    const L = lr.data || {}, naam = `${L.naam || ""} ${L.voornaam || ""}`.trim(), actief = (await actieveLeden(sb, A.jaar)).some(x => x.id === lidId);
    const [I, R] = await Promise.all([items(sb), reservaties(sb)]);
    const eigen = () => R.filter(r => r.lidId === lidId).sort((a, b) => String(b.aangemeld || "").localeCompare(String(a.aangemeld || "")));
    if (req.method === "GET") {
      const S = await lidStatus(sb, lidId, A.jaar), saldo = c.tegoed && S.tegoed ? (await tegoedSaldo(sb, lidId, A.jaar, S)).saldo : 0;
      return res.status(200).json({ ...pub, afhaaladres: c.afhaaladres, voorwaarden: c.voorwaarden, minVooraf: c.minVooraf, betaalDagen: c.betaalDagen, online: onlineConfigured(),
        lid: { voornaam: L.voornaam || "", naam, actief, status: S.status, korting: c.korting ? S.korting : 0, tegoed: saldo },
        items: I.map(pubItem), bezet: bezetting(R, I), reservaties: eigen().map(r => pubRes(r, r.id)) });
    }
    if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");
    await rateLimit(sb, req, "huur", 120, 3600, httpErr);
    const want = b.items || {}, P = () => bereken(sb, c, lidId, A, { van: b.van, tot: b.tot, want, tegoed: b.tegoed }, { R, I });

    if (b.actie === "prijs") return res.status(200).json(await P());
    if (b.actie === "reserveer") {
      if (c.open === false) throw httpErr(403, "De huurwinkel is momenteel gesloten.");
      if (!actief) throw httpErr(403, `Je lidgeld voor ${A.jaar} is nog niet in orde. Pas daarna kan je huren.`);
      if (!b.akkoord) throw httpErr(400, "Ga akkoord met de huurvoorwaarden.");
      const wijze = b.wijze === "bancontact" && onlineConfigured() ? "bancontact" : "overschrijving";
      const open = R.filter(r => r.lidId === lidId && r.staat === "tebetalen").length; if (open >= 3) throw httpErr(429, "Je hebt al 3 reservaties die nog betaald moeten worden. Betaal of annuleer die eerst.");
      const x = await P();
      if (b.totaal != null && Math.abs(Number(b.totaal) - x.teBetalen) > 0.001) throw httpErr(409, "De prijs werd intussen aangepast. Kijk je mandje opnieuw na.");
      const id = "h" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex"), gratis = !(x.teBetalen > 0);
      const d = { nr: await volgNr(sb, Number(vandaagISO().slice(0, 4))), jaar: A.jaar, lidId, naam, voornaam: L.voornaam || "", email: String(L.email || "").trim(), gsm: String(L.telefoon || "").trim(),
        van: x.van, tot: x.tot, dagen: x.dagen, lijnen: x.lijnen, huurBruto: x.huurBruto, lidStatus: x.lidStatus, korting: x.korting, kortingBedrag: x.kortingBedrag, huurNetto: x.huurNetto,
        ...(x.tegoed > 0 ? { tegoed: [{ lidId, bedrag: x.tegoed }] } : {}), waarborg: x.waarborg, teBetalen: x.teBetalen, betaalTegen: betaalTegenVan(c, x.van), opmerking: clean(b.opmerking, 600),
        staat: gratis ? "betaald" : "tebetalen", betaald: gratis, ...(gratis ? { betaaldOp: nu() } : {}), betaalwijze: gratis ? "tegoed" : wijze, betaalToken: crypto.randomBytes(18).toString("base64url"),
        bron: "formulier", aangemeld: nu(), nieuw: true, log: [{ op: nu(), wat: "Gereserveerd via de huurwinkel" + (gratis ? " (volledig met tegoed)" : wijze === "bancontact" ? " (Bancontact)" : " (overschrijving)") }] };
      const { error } = await sb.from("huur").insert({ id, data: d }); if (error) throw error;
      // gelijktijdige reservatie voor hetzelfde materiaal: de laatste wordt teruggedraaid
      const R2 = await reservaties(sb); for (const l of d.lijnen) { const it = I.find(i => i.id === l.id); if (it && vrijAantal(R2, it, d.van, d.tot) < 0) { await sb.from("huur").delete().eq("id", id); throw httpErr(409, `${it.naam} werd net door iemand anders gereserveerd. Kies andere data.`); } }
      await meldBestuur(sb, id, d, c);
      let online = null;
      if (gratis) { try { await huurMail(sb, id, "betaald", {}, basisUrl(req)); } catch (e) {} }
      else if (wijze === "bancontact") { try { online = await startBc(sb, req, id, d); } catch (e) { console.error("huur bancontact", e); } }
      if (!gratis && !online) { try { await huurMail(sb, id, "tebetalen", {}, basisUrl(req)); } catch (e) { console.error("huur mail", e); } }
      return res.status(200).json({ ok: true, reservatie: pubRes(d, id), bevestigd: gratis, online, ...(gratis ? {} : betaalInfo(A, d)) });
    }
    // acties op een eigen reservatie
    const r = R.find(x => x.id === String(b.id || "") && x.lidId === lidId); if (!r) throw httpErr(404, "Reservatie niet gevonden.");
    const { id: rid, ...rd } = r;
    if (b.actie === "annuleer") {
      if (rd.staat !== "tebetalen" || rd.betaald) throw httpErr(400, "Deze reservatie kan je niet meer zelf annuleren. Neem contact op met het bestuur.");
      await logZet(sb, rid, { ...rd, staat: "geannuleerd", tegoed: null, geannuleerdOp: nu() }, "Geannuleerd door het lid");
      try { await meldPush(sb, "iedereen", { titel: "Huur geannuleerd", tekst: `${rd.nr} · ${rd.naam} annuleerde zelf`, url: "/#huur", tag: "huur-" + rid }); } catch (e) {}
      return res.status(200).json({ ok: true });
    }
    if (b.actie === "betaal") {
      if (rd.staat !== "tebetalen" || rd.betaald) throw httpErr(400, rd.betaald ? "Deze reservatie is al betaald." : "Deze reservatie kan niet meer betaald worden.");
      if (b.wijze === "bancontact") {
        if (!onlineConfigured()) throw httpErr(400, "Bancontact is momenteel niet beschikbaar. Kies overschrijving.");
        return res.status(200).json({ ok: true, online: await startBc(sb, req, rid, rd), ...betaalInfo(A, rd) });
      }
      return res.status(200).json({ ok: true, overschrijving: true, ...betaalInfo(A, rd) });
    }
    throw httpErr(400, "Onbekende actie.");
  } catch (e) { sendError(res, e); }
}

/* ---------- betaling gelukt (Bancontact, herkende overschrijving of door het bestuur aangeduid) ---------- */
export async function huurBetaald(sb, id, { door, wijze, mail = true, via } = {}) {
  const { data: r } = await sb.from("huur").select("id,data").eq("id", id).maybeSingle(); if (!r || r.data.betaald) return false;
  const d = r.data, nd = { ...d, betaald: true, betaaldOp: (d.betaling && d.betaling.status === "SUCCEEDED" && d.betaling.betaaldOp) || nu(), betaalwijze: wijze || (d.betaling && d.betaling.status === "SUCCEEDED" ? "bancontact" : d.betaalwijze) || "overschrijving",
    staat: ["tebetalen", "geannuleerd"].includes(d.staat) ? "betaald" : d.staat };
  const wat = door ? "Betaling aangeduid" : via ? "Overschrijving herkend in de transacties" : "Online betaald (Bancontact)";
  const { data: upd } = await sb.from("huur").update({ data: { ...nd, log: [...(d.log || []), { op: nu(), wat: wat + (d.staat === "geannuleerd" ? " · reservatie opnieuw actief" : ""), door: door || "" }] } }).eq("id", id).eq("data->>betaald", "false").select("id");
  if (!upd || !upd.length) return false;
  if (!door) { try { await meldPush(sb, "iedereen", { titel: "Huur betaald", tekst: `${d.nr} · ${d.naam} · ${eur(d.teBetalen)}`, url: "/#huur", tag: "huur-" + id }); } catch (e) {} }
  if (mail) { try { await huurMail(sb, id, "betaald"); } catch (e) { console.error("huur mail", e); } }
  return true;
}

/* ---------- geplande taak (elke 10 min): Bancontact, overschrijvingen herkennen, herinneringen, vrijgeven ---------- */
export async function huurCron(sb) {
  const R = await reservaties(sb), uit = { betaald: 0, herkend: 0, herinnering: 0, betaalherinnering: 0, vrijgegeven: 0 };
  if (!R.some(r => ["tebetalen", "betaald"].includes(r.staat))) return uit;
  const c = await huurCfg(sb), { controleerBetaling } = await import("./betaal.js"), vandaag = vandaagISO(), uur = uurBxl();
  for (const r of R) {
    try {
      const { id, ...data } = r;
      if (r.staat === "tebetalen" && !r.betaald) {
        // 1. lopende Bancontact-betaling nakijken; na 20 minuten zonder succes: mail met de gegevens om over te schrijven
        if (r.betaling && r.betaling.id && r.betaling.status !== "SUCCEEDED" && Date.now() - Date.parse(r.betaling.gestart || 0) < 864e5) {
          const st = await controleerBetaling(sb, "huur", { id, data }); if (st && st.status === "SUCCEEDED") { uit.betaald++; continue; }
        }
        if (r.betaalwijze === "bancontact" && !(r.mail && r.mail.tebetalen) && Date.now() - Date.parse(r.aangemeld || 0) > 20 * 60000) await huurMail(sb, id, "tebetalen");
        // 2. overschrijving herkennen: transactie (inkomend) met het reservatienummer in de mededeling en minstens het bedrag
        const { data: B } = await sb.from("boekingen").select("id,data").ilike("data->>mededeling", `%${r.nr}%`).limit(5);
        const t = (B || []).find(x => x.data && x.data.richting !== "uit" && Number(x.data.bedrag) >= Number(r.teBetalen) - 0.01);
        if (t) { if (await huurBetaald(sb, id, { via: t.id, wijze: "overschrijving" })) uit.herkend++; continue; }
        // 3. niet tijdig betaald: herinnering op de betaaldatum, vrijgeven na x dagen
        if (c.autoVrijgeven && r.betaalTegen && plusDagen(r.betaalTegen, c.vrijgevenNa) < vandaag) {
          await logZet(sb, id, { ...data, staat: "geannuleerd", reden: "We ontvingen geen betaling binnen de termijn. Het materiaal is opnieuw vrijgegeven.", tegoed: null, geannuleerdOp: nu(), automatisch: true }, "Automatisch vrijgegeven (niet betaald)");
          uit.vrijgegeven++; try { await huurMail(sb, id, "geannuleerd"); } catch (e) {}
          try { await meldPush(sb, "iedereen", { titel: "Huur vrijgegeven", tekst: `${r.nr} · ${r.naam}: niet betaald, automatisch geannuleerd`, url: "/#huur", tag: "huur-" + id }); } catch (e) {}
          continue;
        }
        if (uur >= 10 && smtpConfigured() && r.betaalTegen && r.betaalTegen <= vandaag && !(r.mail && r.mail.betaalherinnering)) { if (await huurMail(sb, id, "betaalherinnering")) uit.betaalherinnering++; }
      }
      if (uur >= 10 && smtpConfigured() && r.staat === "betaald" && !(r.mail && r.mail.herinnering) && plusDagen(r.van, -1) <= vandaag && r.van >= vandaag) { if (await huurMail(sb, id, "herinnering")) uit.herinnering++; }
    } catch (e) { console.error("huur cron", e); }
  }
  return uit;
}

/* ---------- beheer-app: POST /api/mail?f=huur ---------- */
const bewijs = (b, door) => ({ op: nu(), check: Array.isArray(b.check) ? b.check.slice(0, 200).map(x => ({ t: clean(x.t, 120), ok: !!x.ok })) : [], fotos: Array.isArray(b.fotos) ? b.fotos.filter(x => /^huurp-[\w-]{4,60}$/.test(String(x))).slice(0, 20) : [],
  opm: clean(b.opm, 800), ...(b.handtekening && /^huurp-[\w-]{4,60}$/.test(String(b.handtekening)) ? { handtekening: b.handtekening, getekendDoor: clean(b.getekendDoor, 100) } : {}), door });
export async function huurApi(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");
    const { user, sb } = await requireUser(req, { write: true, functie: "huur" }), b = body(req), door = (user && user.email) || "";
    const c = await huurCfg(sb), A = await algemeen(sb);
    if (b.actie === "link") { // persoonlijke link naar een lid mailen (of tonen op de testomgeving)
      const { data: lr } = await sb.from("leden").select("id,data").eq("id", String(b.lidId || "")).maybeSingle(); if (!lr) throw httpErr(404, "Lid niet gevonden.");
      const link = huurLink(lr.id, basisUrl(req)); if (!b.mail) return res.status(200).json({ ok: true, link });
      const email = String(lr.data.email || "").trim(); if (!geldig(email)) throw httpErr(400, "Dit lid heeft geen geldig e-mailadres.");
      if (!smtpConfigured()) return res.status(200).json({ ok: true, link, test: true });
      const m = await sysMail(sb, "huur-login", { voornaam: esc(lr.data.voornaam || lr.data.naam), link: esc(link), knop: knop("Naar mijn huurwinkel", link) });
      const [x] = await verstuur([{ aan: email, aanNaam: `${lr.data.naam || ""} ${lr.data.voornaam || ""}`.trim(), onderwerp: m.onderwerp, html: huisstijl(m.html, A.vereniging), van: afzender() }]);
      return res.status(200).json({ ok: !!(x && x.ok), naar: email });
    }
    if (b.actie === "blokkeer") { // eigen gebruik van de vriendenkring: data afsluiten
      const R = await reservaties(sb), I = await items(sb, true);
      const x = await bereken(sb, { ...c, korting: false, tegoed: false }, null, A, { van: b.van, tot: b.tot, want: b.items || {} }, { R, I, vrijeDatum: true });
      const id = "hb" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
      const d = { nr: await volgNr(sb, Number(vandaagISO().slice(0, 4)), "B"), lidId: null, naam: "Eigen gebruik vriendenkring", reden: clean(b.reden, 300), van: x.van, tot: x.tot, dagen: x.dagen,
        lijnen: x.lijnen.map(l => ({ id: l.id, naam: l.naam, aantal: l.aantal })), teBetalen: 0, waarborg: 0, staat: "geblokkeerd", betaald: false, bron: "beheer", aangemeld: nu(), log: [{ op: nu(), wat: "Geblokkeerd voor eigen gebruik", door }] };
      const { error } = await sb.from("huur").insert({ id, data: d }); if (error) throw error;
      return res.status(200).json({ ok: true, id });
    }
    if (b.actie === "prijs" || b.actie === "nieuw") { // reservatie door het bestuur ingeven (voor een lid)
      const { data: lr } = await sb.from("leden").select("id,data").eq("id", String(b.lidId || "")).maybeSingle(); if (!lr) throw httpErr(404, "Kies een lid.");
      const R = await reservaties(sb), I = await items(sb, true);
      const x = await bereken(sb, c, lr.id, A, { van: b.van, tot: b.tot, want: b.items || {}, tegoed: b.tegoed }, { R, I, vrijeDatum: true });
      if (b.actie === "prijs") return res.status(200).json(x);
      const L = lr.data, id = "h" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
      const teBetalen = b.bedrag != null && b.bedrag !== "" ? r2(Math.max(0, Number(String(b.bedrag).replace(",", ".")) || 0)) : x.teBetalen, betaald = !!b.betaald || !(teBetalen > 0);
      const d = { nr: await volgNr(sb, Number(vandaagISO().slice(0, 4))), jaar: A.jaar, lidId: lr.id, naam: `${L.naam || ""} ${L.voornaam || ""}`.trim(), voornaam: L.voornaam || "", email: String(L.email || "").trim(), gsm: String(L.telefoon || "").trim(),
        van: x.van, tot: x.tot, dagen: x.dagen, lijnen: x.lijnen, huurBruto: x.huurBruto, lidStatus: x.lidStatus, korting: x.korting, kortingBedrag: x.kortingBedrag, huurNetto: x.huurNetto, ...(x.tegoed > 0 ? { tegoed: [{ lidId: lr.id, bedrag: x.tegoed }] } : {}),
        waarborg: x.waarborg, teBetalen, ...(teBetalen !== x.teBetalen ? { aangepast: { van: x.teBetalen, door } } : {}), opmerking: clean(b.opmerking, 600), staat: betaald ? "betaald" : "tebetalen", betaald,
        ...(betaald ? { betaaldOp: nu(), betaalwijze: b.wijze === "cash" ? "cash" : teBetalen > 0 ? "overschrijving" : "tegoed" } : { betaalwijze: "overschrijving" }), betaalTegen: betaalTegenVan(c, x.van < vandaagISO() ? vandaagISO() : x.van),
        betaalToken: crypto.randomBytes(18).toString("base64url"), bron: "beheer", aangemeld: nu(), log: [{ op: nu(), wat: "Ingegeven door het bestuur" + (betaald && teBetalen > 0 ? " (al betaald)" : ""), door }] };
      const { error } = await sb.from("huur").insert({ id, data: d }); if (error) throw error;
      let gemaild = false; if (b.mail) { try { gemaild = await huurMail(sb, id, betaald ? "betaald" : "tebetalen", {}, basisUrl(req)); } catch (e) {} }
      return res.status(200).json({ ok: true, id, gemaild });
    }
    const { data: r } = await sb.from("huur").select("id,data").eq("id", String(b.id || "")).maybeSingle(); if (!r) throw httpErr(404, "Reservatie niet gevonden.");
    const d = r.data, id = r.id, mail = !!b.mail;
    let gemaild = false;
    if (b.actie === "betaald") {
      await huurBetaald(sb, id, { door, mail, wijze: b.wijze === "cash" ? "cash" : b.wijze === "bancontact" ? "bancontact" : "overschrijving" });
      gemaild = !!((await sb.from("huur").select("data").eq("id", id).maybeSingle()).data?.data?.mail?.betaald);
    } else if (b.actie === "uitgeleend") {
      if (!["betaald", "tebetalen"].includes(d.staat)) throw httpErr(400, "Deze reservatie kan niet (meer) afgehaald worden.");
      await logZet(sb, id, { ...d, staat: "uitgeleend", uitgeleendOp: nu(), afhaling: bewijs(b, door), nieuw: false }, "Afgehaald" + (b.handtekening ? " · contract getekend" : ""), door);
    } else if (b.actie === "terug") {
      const wb = r2(d.waarborg), terug = b.terug != null && b.terug !== "" ? r2(Math.min(wb, Math.max(0, Number(String(b.terug).replace(",", ".")) || 0))) : wb;
      const W = wb ? { bedrag: terug, ingehouden: r2(wb - terug), opm: clean(b.opm, 600), op: nu(), wijze: b.wijze === "cash" ? "cash" : "overschrijving", door } : null;
      await logZet(sb, id, { ...d, staat: "afgerond", terugOp: nu(), terugname: bewijs(b, door), ...(W ? { waarborgTerug: W } : {}), nieuw: false }, "Teruggebracht" + (W ? ` · waarborg ${eur(W.bedrag)} terug${W.ingehouden ? `, ${eur(W.ingehouden)} ingehouden` : ""}` : ""), door);
      const zin = W ? (W.bedrag ? `Je waarborg van <b>${eur(W.bedrag)}</b> ${W.wijze === "cash" ? "kreeg je cash terug" : "storten we terug op je rekening"}.` : "") + (W.ingehouden ? ` We hielden <b>${eur(W.ingehouden)}</b> in${W.opm ? ": " + esc(W.opm) : ""}.` : "") : "";
      if (mail) gemaild = await huurMail(sb, id, "afgerond", { waarborg: zin.trim() });
    } else if (b.actie === "annuleren") {
      await logZet(sb, id, { ...d, staat: d.staat === "geblokkeerd" ? "opgeheven" : "geannuleerd", reden: clean(b.reden, 600), tegoed: d.betaald ? d.tegoed : null, geannuleerdOp: nu(), nieuw: false },
        d.staat === "geblokkeerd" ? "Blokkering opgeheven" : "Geannuleerd door het bestuur" + (d.betaald ? " (terugbetaling regelen)" : ""), door);
      if (mail && d.staat !== "geblokkeerd") gemaild = await huurMail(sb, id, "geannuleerd", {}, basisUrl(req));
    } else if (b.actie === "mail") {
      gemaild = await huurMail(sb, id, String(b.soort || ""), {}, basisUrl(req));
    } else if (b.actie === "notitie") {
      await logZet(sb, id, { ...d, notitie: clean(b.notitie, 1000) }, "Notitie aangepast", door);
    } else throw httpErr(400, "Onbekende actie.");
    return res.status(200).json({ ok: true, gemaild });
  } catch (e) { sendError(res, e); }
}
