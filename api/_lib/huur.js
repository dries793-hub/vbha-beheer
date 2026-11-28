import crypto from "node:crypto";
import { admin, httpErr, sendError, requireUser, IS_TEST } from "./sb.js";
import { clean, body, configDoc, algemeen, rateLimit, actieveLeden, masker, vandaagISO, DEF_IBAN } from "./publiek.js";
import { onlineConfigured } from "./betaalprovider.js";
import { smtpConfigured, afzender, verstuur } from "./smtp.js";
import { huisstijl, kaderBlok, knop, tabel, rij, p, esc, eur, lang, plusDagen, site } from "./bevestiging.js";
import { registreer, sysMail } from "./sjabloon.js";
import { epcPayload, qrSvg } from "./epc.js";
import { lidStatus, tegoedSaldo } from "./status.js";
import { meldPush } from "./push.js";

/* ============ Materiaalverhuur (huurwinkel voor leden) ============
   Tabellen: "huur_items" {naam, beschrijving, afbeeldingen:[id], hoofd, aantal, prijsModus:"dag"|"beurt"|"beurtdag", prijsDag, prijsBeurt,
     beurtDagen, maxDagen, waarborg, korting (statuskorting toepassen, standaard ja), actief, volgorde}
   "huur" (reservaties) {nr, jaar, lidId, naam, voornaam, email, gsm, van, tot, dagen, lijnen:[{id,naam,aantal,huur,waarborg}], huurBruto, lidStatus, korting,
     kortingBedrag, huurNetto, tegoed:[{lidId,bedrag}], waarborg, teBetalen, opmerking, staat, betaald, betaalwijze, betaalToken, betaling, log:[], waarborgTerug, ...}
   Staat: aangevraagd → goedgekeurd (bestuur) → betaald → uitgeleend → afgerond; of geweigerd / geannuleerd.
   Config "huur": {open, titel, intro, info, afhaaladres, contact, meldAan, korting, tegoed, voorwaarden, minVooraf, betaalDagen}
   Openbaar: /huur — aanmelden met je naam: we mailen een persoonlijke link (/huur?s=<sessie>), 30 dagen geldig.
   Afbeeldingen in "beelden" (id "huur-…"), via /api/huur?img=… */
export const HUUR_DEF = { open: true, titel: "Materiaalverhuur", intro: "Als lid kan je materiaal van de vriendenkring huren, aan een voordelige ledenprijs.",
  info: "", afhaaladres: "Kazerne Brandweer Aalst, Vrijheidstraat 55, 9300 Aalst", contact: "", meldAan: "", korting: true, tegoed: true,
  voorwaarden: "Je gaat zorgvuldig om met het gehuurde materiaal en brengt het proper en volledig terug op het afgesproken moment. Schade of verlies wordt verrekend met de waarborg.",
  minVooraf: 2, betaalDagen: 7 };
export const ACTIEF = ["aangevraagd", "goedgekeurd", "betaald", "uitgeleend"];
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const geldig = a => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(String(a || ""));
const isoOk = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const dagenTussen = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5) + 1;
const kortD = iso => lang(iso).replace(/ \d{4}$/, "").replace(/^./, c => c.toLowerCase());
const periode = (a, b) => a === b ? kortD(a) : `${kortD(a)} tot en met ${kortD(b)}`;
const uurBxl = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", hour: "2-digit", hour12: false }).format(new Date()));

export async function huurCfg(sb) { const c = await configDoc(sb, "huur"); return { ...HUUR_DEF, ...c, minVooraf: Math.max(0, Number(c.minVooraf ?? HUUR_DEF.minVooraf) || 0), betaalDagen: Math.max(1, Number(c.betaalDagen) || HUUR_DEF.betaalDagen) }; }

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
export const prijsTekst = i => { const m = i.prijsModus || "dag", B = Math.max(1, Number(i.beurtDagen) || 1);
  if (m === "beurt") return `${eur(i.prijsBeurt)} per huurbeurt${B > 1 ? ` (max. ${B} dagen)` : " (1 dag)"}`;
  if (m === "beurtdag") return `${eur(i.prijsBeurt)} voor ${B === 1 ? "1 dag" : B + " dagen"}, daarna ${eur(i.prijsDag)} per extra dag`;
  return `${eur(i.prijsDag)} per dag`; };
const maxD = i => (i.prijsModus === "beurt" ? Math.max(1, Number(i.beurtDagen) || 1) : 0) || Number(i.maxDagen) || 0;
/* bezetting: actieve reservaties (zonder die van "behalve") */
async function reservaties(sb) {
  const { data, error } = await sb.from("huur").select("id,data").limit(5000); if (error) throw error;
  return (data || []).map(r => ({ id: r.id, ...r.data }));
}
export function vrijAantal(R, item, van, tot, behalve) {
  let max = 0;
  for (let d = van; d <= tot; d = plusDagen(d, 1)) {
    let n = 0; for (const r of R) if (r.id !== behalve && ACTIEF.includes(r.staat) && r.van <= d && r.tot >= d) for (const l of r.lijnen || []) if (l.id === item.id) n += Number(l.aantal) || 0;
    if (n > max) max = n;
  }
  return Math.max(1, Number(item.aantal) || 1) - max; // negatief = overboekt
}
/* bezette periodes per artikel (openbaar, zonder namen) */
function bezetting(R, I) {
  const vandaag = vandaagISO(), out = {};
  for (const i of I) { const L = []; for (const r of R) if (ACTIEF.includes(r.staat) && r.tot >= vandaag) for (const l of r.lijnen || []) if (l.id === i.id) L.push({ van: r.van, tot: r.tot, n: Number(l.aantal) || 0 }); out[i.id] = L; }
  return out;
}
/* volledige berekening van een mandje */
async function bereken(sb, c, lidId, A, { van, tot, want, tegoed }, { R, I, behalve } = {}) {
  if (!isoOk(van) || !isoOk(tot)) throw httpErr(400, "Kies een begin- en einddatum.");
  if (tot < van) throw httpErr(400, "De einddatum ligt vóór de begindatum.");
  const vroegst = plusDagen(vandaagISO(), c.minVooraf);
  if (van < vroegst && !behalve) throw httpErr(400, c.minVooraf ? `Huren kan ten vroegste vanaf ${kortD(vroegst)}.` : "Kies een datum vanaf vandaag.");
  if (van > plusDagen(vandaagISO(), 400)) throw httpErr(400, "Zo ver vooruit kan je nog niet reserveren.");
  const dagen = dagenTussen(van, tot);
  I = I || await items(sb); R = R || await reservaties(sb);
  const M = new Map(I.map(i => [i.id, i])), lijnen = [];
  for (const [id, n] of Object.entries(want || {})) {
    const i = M.get(id), aantal = Math.floor(Number(n)) || 0; if (!i || aantal <= 0) continue;
    const md = maxD(i); if (md && dagen > md) throw httpErr(400, `${i.naam} kan je maximaal ${md === 1 ? "1 dag" : md + " dagen"} na elkaar huren.`);
    const vrij = Math.max(0, vrijAantal(R, i, van, tot, behalve));
    if (aantal > vrij) throw httpErr(409, vrij ? `Van ${i.naam} ${vrij === 1 ? "is er nog 1" : "zijn er nog " + vrij} beschikbaar in die periode.` : `${i.naam} is niet meer beschikbaar in die periode. Kies andere data.`);
    const stuk = stukPrijs(i, dagen);
    lijnen.push({ id, naam: i.naam, aantal, stuk, huur: r2(stuk * aantal), waarborg: r2(Number(i.waarborg || 0) * aantal), korting: i.korting !== false });
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
async function volgNr(sb, jaar) {
  const { data } = await sb.from("huur").select("data->>nr");
  let max = 0; for (const r of data || []) { const m = String(r.nr || "").match(new RegExp("^H" + jaar + "-(\\d+)$")); if (m) max = Math.max(max, +m[1]); }
  return `H${jaar}-${String(max + 1).padStart(3, "0")}`;
}
const mededeling = d => `Huur ${d.nr} ${d.naam}`.slice(0, 140);
const pubRes = (d, id) => ({ id, nr: d.nr, van: d.van, tot: d.tot, dagen: d.dagen, lijnen: (d.lijnen || []).map(l => ({ id: l.id, naam: l.naam, aantal: l.aantal, huur: l.huur, waarborg: l.waarborg })),
  huurBruto: d.huurBruto, korting: d.korting, kortingBedrag: d.kortingBedrag, lidStatus: d.lidStatus, huurNetto: d.huurNetto, tegoed: (d.tegoed || []).reduce((t, x) => t + (Number(x.bedrag) || 0), 0),
  waarborg: d.waarborg, teBetalen: d.teBetalen, staat: d.staat, betaald: !!d.betaald, betaalwijze: d.betaalwijze || null, opmerking: d.opmerking || "", reden: d.reden || "", bericht: d.bericht || "",
  betaalTegen: d.betaalTegen || null, aangemeld: d.aangemeld, waarborgTerug: d.waarborgTerug || null, betaalToken: d.staat === "goedgekeurd" ? d.betaalToken : undefined });
const betaalInfo = (A, d) => ({ rekeningnummer: A.rekeningnummer || DEF_IBAN, begunstigde: A.vereniging, mededeling: mededeling(d), bedrag: d.teBetalen,
  qr: (() => { try { return qrSvg(epcPayload({ naam: A.vereniging, iban: A.rekeningnummer || DEF_IBAN, bedrag: d.teBetalen, mededeling: mededeling(d) })); } catch (e) { return null; } })() });
async function logZet(sb, id, d, wat, door) { const nd = { ...d, log: [...(d.log || []), { op: new Date().toISOString(), wat, door: door || "" }].slice(-40) }; const { error } = await sb.from("huur").update({ data: nd }).eq("id", id); if (error) throw error; return nd; }

/* ---------- mails ---------- */
const MV = [["voornaam", "Voornaam"], ["nr", "Reservatienummer"], ["periode", "Periode"], ["overzicht", "Tabel met de artikels en prijzen"], ["link", "Persoonlijke link huurwinkel"], ["knop", "Knop naar de huurwinkel"]];
const MVV = { voornaam: "Jan", nr: "H2027-004", periode: "zaterdag 12 juni tot en met zondag 13 juni", link: "https://vbha.be/huur" };
registreer({ key: "huur-login", naam: "Huurwinkel: persoonlijke link", wanneer: "Als een lid zich aanmeldt in de huurwinkel (/huur).",
  onderwerp: "Je persoonlijke link voor de huurwinkel",
  body: p("Dag {voornaam}!") + p("Met de knop hieronder kom je in jouw persoonlijke huurwinkel. Daar kies je wat je wil huren, volg je je aanvragen op en betaal je.") + "<p>{knop}</p>"
    + p("De link is 30 dagen geldig en enkel voor jou bedoeld: stuur deze mail dus niet door. Heb je niets aangevraagd? Dan mag je deze mail gewoon negeren.", "margin:0 0 16px;font-size:13.5px;color:#686B71"),
  velden: [["voornaam", "Voornaam"], ["link", "Persoonlijke link"], ["knop", "Knop naar de huurwinkel"]], voorbeeld: MVV });
registreer({ key: "huur-aanvraag", naam: "Huurwinkel: aanvraag ontvangen", wanneer: "Na een huuraanvraag in de huurwinkel.",
  onderwerp: "We ontvingen je huuraanvraag {nr}",
  body: p("Dag {voornaam}!") + p("Bedankt voor je aanvraag. Het bestuur bekijkt ze zo snel mogelijk. Je krijgt een mail zodra ze goedgekeurd is; daarna kan je betalen.") + kaderBlok("Aanvraag {nr} · {periode}", "{overzicht}") + "<p>{knop}</p>",
  velden: MV, voorbeeld: MVV });
registreer({ key: "huur-melding", naam: "Huurwinkel: melding nieuwe aanvraag (bestuur)", wanneer: "Na een huuraanvraag, naar het adres in de instellingen van Materiaalverhuur.",
  onderwerp: "Nieuwe huuraanvraag {nr} van {naam}",
  body: p("Er is een nieuwe huuraanvraag binnengekomen.") + kaderBlok("{naam} · {periode}", "{overzicht}") + "{als:opmerking}" + p("<i>Opmerking: {opmerking}</i>") + "{/als:opmerking}" + p("Keur de aanvraag goed of weiger ze in VBHA Beheer › Vereniging › Materiaalverhuur."),
  velden: [["naam", "Naam lid"], ["nr", "Reservatienummer"], ["periode", "Periode"], ["overzicht", "Tabel"], ["opmerking", "Opmerking van het lid"]], voorbeeld: { ...MVV, naam: "Peeters Jan", opmerking: "" } });
registreer({ key: "huur-goedgekeurd", naam: "Huurwinkel: aanvraag goedgekeurd", wanneer: "Als het bestuur een huuraanvraag goedkeurt.",
  onderwerp: "Je huuraanvraag {nr} is goedgekeurd",
  body: p("Dag {voornaam}!") + p("Goed nieuws: je huuraanvraag is <b>goedgekeurd</b>.{als:bericht} {bericht}{/als:bericht}") + kaderBlok("Reservatie {nr} · {periode}", "{overzicht}")
    + p("Betaal <b>{bedrag}</b> vóór <b>{tegen}</b> via je persoonlijke huurwinkel, met Bancontact of met een overschrijving. Pas na je betaling is de reservatie definitief.") + "<p>{knop}</p>",
  velden: [...MV, ["bedrag", "Te betalen"], ["tegen", "Betalen vóór"], ["bericht", "Bericht van het bestuur"]], voorbeeld: { ...MVV, bedrag: "€60,00", tegen: "zaterdag 5 juni", bericht: "" } });
registreer({ key: "huur-geweigerd", naam: "Huurwinkel: aanvraag niet mogelijk", wanneer: "Als het bestuur een huuraanvraag weigert.",
  onderwerp: "Je huuraanvraag {nr} kan helaas niet doorgaan",
  body: p("Dag {voornaam}!") + p("Helaas kunnen we je huuraanvraag voor {periode} niet goedkeuren.") + "{als:reden}" + p("<b>Reden:</b> {reden}") + "{/als:reden}" + p("Vragen of liever andere data? Neem gerust contact met ons op, of doe een nieuwe aanvraag in de huurwinkel.") + "<p>{knop}</p>",
  velden: [...MV, ["reden", "Reden"]], voorbeeld: { ...MVV, reden: "De tent is die dag al in gebruik op een activiteit van de vriendenkring." } });
registreer({ key: "huur-betaald", naam: "Huurwinkel: betaling ontvangen", wanneer: "Na de betaling van een goedgekeurde huur (online of aangeduid door het bestuur).",
  onderwerp: "Je reservatie {nr} is in orde",
  body: p("Dag {voornaam}!") + p("We ontvingen je betaling van <b>{bedrag}</b>. Je reservatie is nu <b>definitief</b>.") + kaderBlok("Reservatie {nr} · {periode}", "{overzicht}")
    + kaderBlok("Afhalen en terugbrengen", "{afhalen}") + "<p>{knop}</p>",
  velden: [...MV, ["bedrag", "Betaald bedrag"], ["afhalen", "Info afhalen (instellingen)"]], voorbeeld: { ...MVV, bedrag: "€60,00", afhalen: "Afhalen in de kazerne. We nemen contact met je op om een moment af te spreken." } });
registreer({ key: "huur-betaalherinnering", naam: "Huurwinkel: herinnering betalen", wanneer: "Eén keer, als een goedgekeurde huur nog niet betaald is op de betaaldatum.",
  onderwerp: "Herinnering: betaal je reservatie {nr}",
  body: p("Dag {voornaam}!") + p("Je huuraanvraag voor {periode} werd goedgekeurd, maar we ontvingen nog geen betaling van <b>{bedrag}</b>. Betaal zo snel mogelijk, anders kunnen we het materiaal niet voor je vasthouden.") + "<p>{knop}</p>",
  velden: [...MV, ["bedrag", "Te betalen"]], voorbeeld: { ...MVV, bedrag: "€60,00" } });
registreer({ key: "huur-herinnering", naam: "Huurwinkel: herinnering afhalen", wanneer: "De dag vóór het begin van een betaalde huur (vanaf 10u).",
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
export async function huurMail(sb, id, soort, extra = {}, basis) {
  if (!smtpConfigured()) return false;
  const { data: r } = await sb.from("huur").select("id,data").eq("id", id).maybeSingle(); if (!r) return false;
  const d = r.data, c = await huurCfg(sb), A = await algemeen(sb), link = huurLink(d.lidId, basis);
  const V = { voornaam: esc(d.voornaam || d.naam), naam: esc(d.naam), nr: esc(d.nr), periode: esc(periode(d.van, d.tot)), overzicht: overzicht(d), link: esc(link), knop: knop("Naar mijn huurwinkel", link),
    bedrag: eur(d.teBetalen), tegen: esc(d.betaalTegen ? kortD(d.betaalTegen) : ""), bericht: esc(d.bericht || ""), reden: esc(d.reden || ""), afhalen: afhaalTekst(c), opmerking: esc(d.opmerking || ""), ...extra };
  const key = { aanvraag: "huur-aanvraag", goedgekeurd: "huur-goedgekeurd", geweigerd: "huur-geweigerd", betaald: "huur-betaald", herinnering: "huur-herinnering", betaalherinnering: "huur-betaalherinnering", afgerond: "huur-afgerond" }[soort];
  if (!key || !geldig(d.email)) return false;
  const m = await sysMail(sb, key, V);
  const [x] = await verstuur([{ aan: d.email, aanNaam: d.naam, onderwerp: m.onderwerp, html: huisstijl(m.html, A.vereniging), van: afzender() }]);
  if (x && x.ok) { const { data: n } = await sb.from("huur").select("data").eq("id", id).maybeSingle(); await sb.from("huur").update({ data: { ...n.data, mail: { ...(n.data.mail || {}), [soort]: new Date().toISOString() } } }).eq("id", id); }
  return !!(x && x.ok);
}
async function meldBestuur(sb, id, d, c) {
  try { await meldPush(sb, "iedereen", { titel: "Nieuwe huuraanvraag", tekst: `${d.nr} · ${d.naam} · ${periode(d.van, d.tot)}`, url: "/#huur", tag: "huur-" + id, lidId: d.lidId }); } catch (e) { console.error("huur push", e); }
  if (!smtpConfigured() || !geldig(c.meldAan)) return;
  try { const A = await algemeen(sb), m = await sysMail(sb, "huur-melding", { naam: esc(d.naam), nr: esc(d.nr), periode: esc(periode(d.van, d.tot)), overzicht: overzicht(d), opmerking: esc(d.opmerking || "") });
    await verstuur([{ aan: c.meldAan, aanNaam: "Bestuur", onderwerp: m.onderwerp, html: huisstijl(m.html, A.vereniging), van: afzender() }]); } catch (e) { console.error("huur melding", e); }
}

/* ---------- openbaar: /api/huur ---------- */
const basisUrl = req => { const h = req.headers["x-forwarded-host"] || req.headers.host; return IS_TEST && h ? "https://" + h : site(); };
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
    const pub = { open: c.open !== false, titel: c.titel, intro: c.intro, afhaaladres: c.afhaaladres, voorwaarden: c.voorwaarden, minVooraf: c.minVooraf, online: onlineConfigured() };

    // ---- zonder sessie: algemene info + artikels, en aanmelden met je naam ----
    if (!s) {
      if (req.method === "GET") return res.status(200).json({ ...pub, items: (await items(sb)).map(pubItem) });
      if (b.actie !== "login") throw httpErr(401, "Meld je eerst aan.");
      await rateLimit(sb, req, "huurlogin", 8, 3600, httpErr);
      if (b.website) return res.status(200).json({ ok: true });
      const l = (await actieveLeden(sb, A.jaar)).find(x => x.id === String(b.lidId || ""));
      if (!l) throw httpErr(400, "Kies je naam uit de lijst van leden. Enkel leden met een betaald lidgeld kunnen huren.");
      const { data: lr } = await sb.from("leden").select("data").eq("id", l.id).maybeSingle(); const email = String(lr?.data?.email || "").trim();
      if (!geldig(email)) return res.status(200).json({ ok: false, geenMail: true });
      const link = huurLink(l.id, basisUrl(req));
      if (IS_TEST) return res.status(200).json({ ok: true, naar: masker(email), testLink: link }); // testomgeving: er vertrekt nooit een mail
      if (!smtpConfigured()) throw httpErr(501, "Mails versturen is niet ingesteld.");
      const m = await sysMail(sb, "huur-login", { voornaam: esc(l.voornaam || l.naam), link: esc(link), knop: knop("Naar mijn huurwinkel", link) });
      const [x] = await verstuur([{ aan: email, aanNaam: l.naam, onderwerp: m.onderwerp, html: huisstijl(m.html, A.vereniging), van: afzender() }]);
      if (!x || !x.ok) throw httpErr(502, "De mail kon niet verstuurd worden. Probeer het later opnieuw.");
      return res.status(200).json({ ok: true, naar: masker(email) });
    }

    // ---- met sessie ----
    const lidId = leesSessie(s); if (!lidId) throw httpErr(401, "Je link is verlopen of ongeldig. Vraag een nieuwe link aan.");
    const { data: lr } = await sb.from("leden").select("id,data").eq("id", lidId).maybeSingle(); if (!lr) throw httpErr(401, "Je link is ongeldig. Vraag een nieuwe link aan.");
    const L = lr.data || {}, naam = `${L.naam || ""} ${L.voornaam || ""}`.trim(), actief = (await actieveLeden(sb, A.jaar)).some(x => x.id === lidId);
    const [I, R] = await Promise.all([items(sb), reservaties(sb)]);
    const eigen = () => R.filter(r => r.lidId === lidId).sort((a, b) => String(b.aangemeld || "").localeCompare(String(a.aangemeld || "")));
    if (req.method === "GET") {
      const S = await lidStatus(sb, lidId, A.jaar), saldo = c.tegoed && S.tegoed ? (await tegoedSaldo(sb, lidId, A.jaar, S)).saldo : 0;
      return res.status(200).json({ ...pub, lid: { voornaam: L.voornaam || "", naam, actief, status: S.status, korting: c.korting ? S.korting : 0, tegoed: saldo, email: masker(L.email), gsm: L.telefoon || "" },
        items: I.map(pubItem), bezet: bezetting(R, I), reservaties: eigen().map(r => pubRes(r, r.id)) });
    }
    if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");
    await rateLimit(sb, req, "huur", 120, 3600, httpErr);
    const want = b.items || {}, P = () => bereken(sb, c, lidId, A, { van: b.van, tot: b.tot, want, tegoed: b.tegoed }, { R, I });

    if (b.actie === "prijs") return res.status(200).json(await P());
    if (b.actie === "aanvraag") {
      if (c.open === false) throw httpErr(403, "De huurwinkel is momenteel gesloten.");
      if (!actief) throw httpErr(403, `Je lidgeld voor ${A.jaar} is nog niet in orde. Pas daarna kan je huren.`);
      if (!b.akkoord) throw httpErr(400, "Ga akkoord met de huurvoorwaarden.");
      const gsm = clean(b.gsm, 40); if (gsm.replace(/\D/g, "").length < 8) throw httpErr(400, "Vul je gsm-nummer in, zodat we je kunnen bereiken.");
      const open = R.filter(r => r.lidId === lidId && r.staat === "aangevraagd").length; if (open >= 5) throw httpErr(429, "Je hebt al 5 openstaande aanvragen. Wacht tot het bestuur ze bekeken heeft.");
      const x = await P();
      if (b.totaal != null && Math.abs(Number(b.totaal) - x.teBetalen) > 0.001) throw httpErr(409, "De prijs werd intussen aangepast. Kijk je mandje opnieuw na.");
      const id = "h" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex"), jaarNr = Number(vandaagISO().slice(0, 4));
      const d = { nr: await volgNr(sb, jaarNr), jaar: A.jaar, lidId, naam, voornaam: L.voornaam || "", email: String(L.email || "").trim(), gsm, van: x.van, tot: x.tot, dagen: x.dagen,
        lijnen: x.lijnen, huurBruto: x.huurBruto, lidStatus: x.lidStatus, korting: x.korting, kortingBedrag: x.kortingBedrag, huurNetto: x.huurNetto, ...(x.tegoed > 0 ? { tegoed: [{ lidId, bedrag: x.tegoed }] } : {}),
        waarborg: x.waarborg, teBetalen: x.teBetalen, opmerking: clean(b.opmerking, 600), staat: "aangevraagd", betaald: false, betaalToken: crypto.randomBytes(18).toString("base64url"),
        bron: "formulier", aangemeld: new Date().toISOString(), nieuw: true, log: [{ op: new Date().toISOString(), wat: "Aangevraagd via de huurwinkel" }] };
      const { error } = await sb.from("huur").insert({ id, data: d }); if (error) throw error;
      // gelijktijdige aanvraag voor hetzelfde materiaal: wie het laatst kwam, wordt teruggedraaid
      const R2 = await reservaties(sb); for (const l of d.lijnen) { const it = I.find(i => i.id === l.id); if (it && vrijAantal(R2, it, d.van, d.tot) < 0) { await sb.from("huur").delete().eq("id", id); throw httpErr(409, `${it.naam} werd net door iemand anders gereserveerd. Kies andere data.`); } }
      await meldBestuur(sb, id, d, c);
      try { await huurMail(sb, id, "aanvraag", {}, basisUrl(req)); } catch (e) { console.error("huur mail", e); }
      return res.status(200).json({ ok: true, reservatie: pubRes(d, id) });
    }
    // acties op een eigen reservatie
    const r = R.find(x => x.id === String(b.id || "") && x.lidId === lidId); if (!r) throw httpErr(404, "Reservatie niet gevonden.");
    const { id: rid, ...rd } = r;
    if (b.actie === "annuleer") {
      if (!["aangevraagd", "goedgekeurd"].includes(rd.staat) || rd.betaald) throw httpErr(400, "Deze reservatie kan je niet meer zelf annuleren. Neem contact op met het bestuur.");
      await logZet(sb, rid, { ...rd, staat: "geannuleerd", tegoed: null, geannuleerdOp: new Date().toISOString() }, "Geannuleerd door het lid");
      try { await meldPush(sb, "iedereen", { titel: "Huur geannuleerd", tekst: `${rd.nr} · ${rd.naam} annuleerde zelf`, url: "/#huur", tag: "huur-" + rid }); } catch (e) {}
      return res.status(200).json({ ok: true });
    }
    if (b.actie === "betaal") {
      if (rd.staat !== "goedgekeurd" || rd.betaald) throw httpErr(400, rd.betaald ? "Deze reservatie is al betaald." : "Je kan pas betalen als het bestuur je aanvraag goedgekeurd heeft.");
      const wijze = b.wijze === "bancontact" ? "bancontact" : "overschrijving";
      if (!(rd.teBetalen > 0)) { const nd = await logZet(sb, rid, { ...rd, staat: "betaald", betaald: true, betaaldOp: new Date().toISOString() }, "Niets te betalen"); try { await huurMail(sb, rid, "betaald", {}, basisUrl(req)); } catch (e) {} return res.status(200).json({ ok: true, betaald: true, reservatie: pubRes(nd, rid) }); }
      if (wijze === "bancontact") {
        if (!onlineConfigured()) throw httpErr(400, "Bancontact is momenteel niet beschikbaar. Kies overschrijving.");
        const { startBetaling } = await import("./betaal.js");
        const nd = { ...rd, betaalwijze: "bancontact" }; await sb.from("huur").update({ data: nd }).eq("id", rid);
        const bt = await startBetaling(sb, req, "huur", { id: rid, data: nd }, { bedrag: rd.teBetalen, jaar: rd.jaar, terug: "/huur?betaling=terug" });
        return res.status(200).json({ ok: true, online: { t: "huur", id: rid, token: rd.betaalToken, deeplink: bt.deeplink, qrcode: bt.qrcode, checkout: bt.checkout, verlooptOp: bt.verlooptOp, provider: bt.provider || null }, bedrag: rd.teBetalen, ...betaalInfo(A, rd) });
      }
      if (rd.betaalwijze !== "overschrijving") await sb.from("huur").update({ data: { ...rd, betaalwijze: "overschrijving" } }).eq("id", rid);
      return res.status(200).json({ ok: true, overschrijving: true, ...betaalInfo(A, rd) });
    }
    throw httpErr(400, "Onbekende actie.");
  } catch (e) { sendError(res, e); }
}

/* ---------- betaling gelukt (Bancontact of door het bestuur aangeduid) ---------- */
export async function huurBetaald(sb, id, { door, wijze, mail = true } = {}) {
  const { data: r } = await sb.from("huur").select("id,data").eq("id", id).maybeSingle(); if (!r || r.data.betaald) return false;
  const d = r.data, nd = { ...d, betaald: true, betaaldOp: (d.betaling && d.betaling.status === "SUCCEEDED" && d.betaling.betaaldOp) || new Date().toISOString(), betaalwijze: wijze || d.betaalwijze || "overschrijving",
    staat: ["aangevraagd", "goedgekeurd"].includes(d.staat) ? "betaald" : d.staat, nieuw: false };
  const { data: upd } = await sb.from("huur").update({ data: { ...nd, log: [...(d.log || []), { op: new Date().toISOString(), wat: door ? "Betaling aangeduid" : "Online betaald (Bancontact)", door: door || "" }] } }).eq("id", id).eq("data->>betaald", "false").select("id");
  if (!upd || !upd.length) return false;
  if (!door) { try { await meldPush(sb, "iedereen", { titel: "Huur betaald", tekst: `${d.nr} · ${d.naam} · ${eur(d.teBetalen)}`, url: "/#huur", tag: "huur-" + id }); } catch (e) {} }
  if (mail) { try { await huurMail(sb, id, "betaald"); } catch (e) { console.error("huur mail", e); } }
  return true;
}

/* ---------- geplande taak: Bancontact nakijken, herinneringen ---------- */
export async function huurCron(sb) {
  const R = await reservaties(sb), uit = { betaald: 0, herinnering: 0, betaalherinnering: 0 };
  if (!R.length) return uit;
  const { controleerBetaling } = await import("./betaal.js"), vandaag = vandaagISO(), uur = uurBxl();
  for (const r of R) {
    try {
      if (r.staat === "goedgekeurd" && !r.betaald && r.betaling && r.betaling.id && r.betaling.status !== "SUCCEEDED" && Date.now() - Date.parse(r.betaling.gestart || 0) < 864e5) {
        const { id, ...data } = r; const st = await controleerBetaling(sb, "huur", { id, data }); if (st && st.status === "SUCCEEDED") uit.betaald++;
      }
      if (uur < 10 || !smtpConfigured()) continue;
      if (r.staat === "betaald" && !(r.mail && r.mail.herinnering) && plusDagen(r.van, -1) <= vandaag && r.van >= vandaag) { if (await huurMail(sb, r.id, "herinnering")) uit.herinnering++; }
      if (r.staat === "goedgekeurd" && !r.betaald && r.betaalTegen && r.betaalTegen <= vandaag && !(r.mail && r.mail.betaalherinnering) && r.van >= vandaag) { if (await huurMail(sb, r.id, "betaalherinnering")) uit.betaalherinnering++; }
    } catch (e) { console.error("huur cron", e); }
  }
  return uit;
}

/* ---------- beheer-app: POST /api/mail?f=huur ---------- */
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
    if (b.actie === "prijs" || b.actie === "nieuw") { // reservatie door het bestuur ingeven (voor een lid)
      const { data: lr } = await sb.from("leden").select("id,data").eq("id", String(b.lidId || "")).maybeSingle(); if (!lr) throw httpErr(404, "Kies een lid.");
      const R = await reservaties(sb), I = await items(sb, true);
      const x = await bereken(sb, { ...c, minVooraf: 0 }, lr.id, A, { van: b.van, tot: b.tot, want: b.items || {}, tegoed: b.tegoed }, { R, I, behalve: "-" });
      if (b.actie === "prijs") return res.status(200).json(x);
      const L = lr.data, id = "h" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex"), staat = b.goedgekeurd ? "goedgekeurd" : "aangevraagd";
      const teBetalen = b.bedrag != null && b.bedrag !== "" ? r2(Math.max(0, Number(String(b.bedrag).replace(",", ".")) || 0)) : x.teBetalen;
      const d = { nr: await volgNr(sb, Number(vandaagISO().slice(0, 4))), jaar: A.jaar, lidId: lr.id, naam: `${L.naam || ""} ${L.voornaam || ""}`.trim(), voornaam: L.voornaam || "", email: String(L.email || "").trim(), gsm: clean(b.gsm || L.telefoon, 40),
        van: x.van, tot: x.tot, dagen: x.dagen, lijnen: x.lijnen, huurBruto: x.huurBruto, lidStatus: x.lidStatus, korting: x.korting, kortingBedrag: x.kortingBedrag, huurNetto: x.huurNetto, ...(x.tegoed > 0 ? { tegoed: [{ lidId: lr.id, bedrag: x.tegoed }] } : {}),
        waarborg: x.waarborg, teBetalen, ...(teBetalen !== x.teBetalen ? { aangepast: { van: x.teBetalen, door } } : {}), opmerking: clean(b.opmerking, 600), staat, betaald: false, betaalToken: crypto.randomBytes(18).toString("base64url"),
        ...(staat === "goedgekeurd" ? { goedgekeurdOp: new Date().toISOString(), betaalTegen: [plusDagen(vandaagISO(), c.betaalDagen), x.van].sort()[0] } : {}),
        bron: "beheer", aangemeld: new Date().toISOString(), log: [{ op: new Date().toISOString(), wat: "Ingegeven door het bestuur", door }] };
      const { error } = await sb.from("huur").insert({ id, data: d }); if (error) throw error;
      let gemaild = false; if (b.mail) { try { gemaild = await huurMail(sb, id, staat === "goedgekeurd" ? "goedgekeurd" : "aanvraag", {}, basisUrl(req)); } catch (e) {} }
      return res.status(200).json({ ok: true, id, gemaild });
    }
    const { data: r } = await sb.from("huur").select("id,data").eq("id", String(b.id || "")).maybeSingle(); if (!r) throw httpErr(404, "Reservatie niet gevonden.");
    const d = r.data, id = r.id, mail = !!b.mail;
    let gemaild = false;
    if (b.actie === "goedkeuren") {
      if (d.staat !== "aangevraagd") throw httpErr(400, "Enkel een nieuwe aanvraag kan je goedkeuren.");
      const bedrag = b.bedrag != null && b.bedrag !== "" ? r2(Math.max(0, Number(String(b.bedrag).replace(",", ".")) || 0)) : d.teBetalen;
      const tegen = isoOk(b.tegen) ? b.tegen : [plusDagen(vandaagISO(), c.betaalDagen), d.van].sort()[0];
      await logZet(sb, id, { ...d, staat: bedrag > 0 ? "goedgekeurd" : "betaald", ...(bedrag <= 0 ? { betaald: true, betaaldOp: new Date().toISOString() } : {}), teBetalen: bedrag, ...(bedrag !== d.teBetalen ? { aangepast: { van: d.teBetalen, door } } : {}),
        betaalTegen: tegen, bericht: clean(b.bericht, 600), goedgekeurdOp: new Date().toISOString(), nieuw: false }, "Goedgekeurd" + (bedrag !== d.teBetalen ? ` (bedrag aangepast naar ${eur(bedrag)})` : ""), door);
      if (mail) gemaild = await huurMail(sb, id, bedrag > 0 ? "goedgekeurd" : "betaald", {}, basisUrl(req));
    } else if (b.actie === "weigeren") {
      if (!["aangevraagd", "goedgekeurd"].includes(d.staat) || d.betaald) throw httpErr(400, "Deze reservatie kan je niet meer weigeren. Annuleer ze.");
      await logZet(sb, id, { ...d, staat: "geweigerd", reden: clean(b.reden, 600), tegoed: null, nieuw: false }, "Geweigerd", door);
      if (mail) gemaild = await huurMail(sb, id, "geweigerd", {}, basisUrl(req));
    } else if (b.actie === "betaald") {
      await huurBetaald(sb, id, { door, mail, wijze: b.wijze === "cash" ? "cash" : b.wijze === "bancontact" ? "bancontact" : "overschrijving" });
      gemaild = !!((await sb.from("huur").select("data").eq("id", id).maybeSingle()).data?.data?.mail?.betaald);
    } else if (b.actie === "uitgeleend") {
      await logZet(sb, id, { ...d, staat: "uitgeleend", uitgeleendOp: new Date().toISOString(), nieuw: false }, "Afgehaald", door);
    } else if (b.actie === "terug") {
      const wb = r2(d.waarborg), terug = b.terug != null && b.terug !== "" ? r2(Math.min(wb, Math.max(0, Number(String(b.terug).replace(",", ".")) || 0))) : wb;
      const W = wb ? { bedrag: terug, ingehouden: r2(wb - terug), opm: clean(b.opm, 600), op: new Date().toISOString(), wijze: b.wijze === "cash" ? "cash" : "overschrijving", door } : null;
      await logZet(sb, id, { ...d, staat: "afgerond", terugOp: new Date().toISOString(), ...(W ? { waarborgTerug: W } : {}), nieuw: false }, "Teruggebracht" + (W ? ` · waarborg ${eur(W.bedrag)} terug${W.ingehouden ? `, ${eur(W.ingehouden)} ingehouden` : ""}` : ""), door);
      const zin = W ? (W.bedrag ? `Je waarborg van <b>${eur(W.bedrag)}</b> ${W.wijze === "cash" ? "kreeg je cash terug" : "storten we terug op je rekening"}.` : "") + (W.ingehouden ? ` We hielden <b>${eur(W.ingehouden)}</b> in${W.opm ? ": " + esc(W.opm) : ""}.` : "") : "";
      if (mail) gemaild = await huurMail(sb, id, "afgerond", { waarborg: zin.trim() });
    } else if (b.actie === "annuleren") {
      await logZet(sb, id, { ...d, staat: "geannuleerd", reden: clean(b.reden, 600), tegoed: d.betaald ? d.tegoed : null, geannuleerdOp: new Date().toISOString(), nieuw: false }, "Geannuleerd door het bestuur" + (d.betaald ? " (terugbetaling regelen)" : ""), door);
    } else if (b.actie === "mail") {
      gemaild = await huurMail(sb, id, String(b.soort || ""), {}, basisUrl(req));
    } else if (b.actie === "notitie") {
      await logZet(sb, id, { ...d, notitie: clean(b.notitie, 1000) }, "Notitie aangepast", door);
    } else throw httpErr(400, "Onbekende actie.");
    return res.status(200).json({ ok: true, gemaild });
  } catch (e) { sendError(res, e); }
}
