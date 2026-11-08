import { admin, isDbCron, httpErr, requireUser } from "./sb.js";
import { smtpConfigured, afzender, verstuur } from "./smtp.js";
import { algemeen, configDoc, inschrijving, DEF_IBAN } from "./publiek.js";
import { controleerBetaling } from "./betaal.js";
import { teken, ondertekenLinks } from "./lidlink.js";

/* Bevestigingsmails voor de inschrijfpagina's.
   - Kinderfeest (geen betaling): meteen na de inschrijving.
   - Banket en nieuw lid (met betaling): de mail wacht op de uitkomst van de online betaling (data.bevestiging.status = "wacht").
     Lukt de Bancontact-betaling, dan vertrekt de bevestiging meteen met "betaling ontvangen".
     Is er na 20 minuten nog niet betaald, dan stuurt de geplande taak (elke 10 minuten) de bevestiging met de gegevens om over te schrijven.
   - Wie later toch online betaalt, of een bestaand lid dat via de lidgeldlink betaalt, krijgt een korte mail "betaling ontvangen". */
const F = "font-family:Helvetica,Arial,sans-serif;";
const LOGO = "https://impro.usercontent.one/appid/oneComWsb/domain/vbha.be/media/vbha.be/onewebmedia/logo%20VBHA%201.png";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const eur = n => "€" + Number(n || 0).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const lang = iso => { if (!iso) return ""; const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); const s = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }); return s.charAt(0).toUpperCase() + s.slice(1); };
const kort = iso => { if (!iso) return ""; const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("nl-BE", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }); };
const plusDagen = (iso, n) => { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const vandaag = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const site = () => String(process.env.SITE_URL || "https://vbha-beheer.vercel.app").replace(/\/+$/, "");
const p = (t, st = "margin:0 0 15px") => `<p style="${st}">${t}</p>`;
const rij = (k, v) => v === "" || v == null ? "" : `<tr><td style="padding:4px 14px 4px 0;color:#666666;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:4px 0;vertical-align:top">${v}</td></tr>`;
const tabel = rows => `<table role="presentation" border="0" cellspacing="0" cellpadding="0" style="${F}font-size:15px;color:#222222;line-height:1.45">${rows.join("")}</table>`;
const kaderBlok = (titel, inner, kleur = "#C1A057", bg = "#fff9f9") => `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:6px 0 18px;border-collapse:collapse"><tr><td bgcolor="${bg}" style="padding:16px 22px;border-left:5px solid ${kleur};${F}font-size:15px;color:#222222;line-height:1.5"><h2 style="color:#b30000;font-size:17px;font-weight:bold;margin:0 0 10px">${titel}</h2>${inner}</td></tr></table>`;
const knop = (t, href) => `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:4px 0 18px"><tr><td align="center"><table role="presentation" border="0" cellspacing="0" cellpadding="0"><tr><td bgcolor="#b30000" style="border-radius:4px;padding:12px 26px;text-align:center"><a href="${esc(href)}" style="${F}font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none">${esc(t)}</a></td></tr></table></td></tr></table>`;
function huisstijl(inner, ver) {
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f7f7f7">
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f7f7f7"><tr><td align="center" style="padding:25px 10px">
<table role="presentation" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="width:100%;max-width:640px;border-collapse:collapse">
<tr><td align="center" bgcolor="#f7f7f7" style="padding:20px"><img src="${LOGO}" alt="${esc(ver)}" width="220" height="84" style="display:block;width:220px;height:84px;border:0"></td></tr>
<tr><td style="border-top:8px solid #b30000;padding:0"></td></tr>
<tr><td style="${F}font-size:15px;line-height:1.5;color:#222222;padding:28px 40px 22px">${inner}${p("Met vriendelijke groeten,<br><b>Het bestuur</b>", "margin:0")}</td></tr>
<tr><td style="border-top:8px solid #b30000;padding:0"></td></tr>
<tr><td align="center" bgcolor="#f7f7f7" style="${F}font-size:12px;color:#888888;line-height:1.5;padding:14px 20px">${esc(ver)} &middot; Vragen? Antwoord gewoon op deze mail.</td></tr>
</table></td></tr></table></body></html>`;
}
function betaalBlok({ betaald, betaling, bedrag, rekeningnummer, begunstigde, mededeling, tegen, link }) {
  if (betaald) {
    const op = betaling && betaling.betaaldOp ? " op " + kort(new Date(betaling.betaaldOp).toISOString()) : "";
    return kaderBlok("&#10003; Betaling ontvangen", p(`We ontvingen je betaling van <b>${eur(bedrag)}</b> via Bancontact${op}. Je hoeft niets meer te doen.`, "margin:0"), "#1a7f45", "#f1faf4");
  }
  return kaderBlok("Nog te betalen", tabel([rij("Bedrag", `<b>${eur(bedrag)}</b>`), rij("Rekening", `<b>${esc(rekeningnummer)}</b>`), rij("Begunstigde", esc(begunstigde)), rij("Mededeling", `<b>${esc(mededeling)}</b>`), rij("Te betalen vóór", `<b>${esc(lang(tegen))}</b>`)])
    + p("Gebruik exact deze mededeling, dan wordt je betaling automatisch herkend.", "margin:10px 0 0;font-size:13.5px;color:#666666"))
    + (link ? knop("Liever online betalen met Bancontact", link) : "");
}
const BETAALD = (d, bedrag) => d.betaling && d.betaling.status === "SUCCEEDED" && Number(d.betaling.bedrag) === Number(bedrag);

/* ---------- inhoud per soort inschrijving ---------- */
async function mailBanket(sb, row) {
  const d = row.data, A = await algemeen(sb), c = await configDoc(sb, "banket"), jaar = d.jaar || A.jaar;
  const { data: lid } = d.lidId ? await sb.from("leden").select("data").eq("id", d.lidId).maybeSingle() : { data: null };
  const L = lid && lid.data || {}, aan = String(L.email || "").trim();
  if (!aan) return null;
  const bedrag = d.teBetalen || 0, betaald = BETAALD(d, bedrag), ins = inschrijving(c, jaar + "-12-01");
  const datum = c.datum || jaar + "-12-12", uur = c.uur || "19u00", locatie = c.locatie || "Feestzaal De Snip, Beugemstraat 9, Moorsel";
  const html = p(`Beste ${esc(L.voornaam || d.naam)},`) + p(`Bedankt voor je inschrijving voor ons banket. Hieronder vind je nog eens alle gegevens.`)
    + kaderBlok("Banket " + jaar, tabel([rij("Wanneer", esc(lang(datum)) + (uur ? " om " + esc(uur) : "")), rij("Waar", esc(locatie)), rij("Op naam van", esc(d.naam)),
      rij("Personen", d.personen === 2 ? "2 (jij en je partner)" : "1"), rij("Menu", esc(d.menu1) + (d.personen === 2 ? " en " + esc(d.menu2) : "")), rij("Opmerking", esc(d.opmerking || "")), rij("Bedrag", eur(bedrag) + (d.korting ? ` <span style="color:#666666">(${esc(String(d.status || "").charAt(0) + String(d.status || "").slice(1).toLowerCase())}: ${d.korting}% korting op ${eur(Number(c.prijs) || 65)} per persoon)</span>` : ""))]))
    + betaalBlok({ betaald, betaling: d.betaling, bedrag, rekeningnummer: A.rekeningnummer || DEF_IBAN, begunstigde: A.vereniging, mededeling: `${d.naam} Banket ${jaar}`, tegen: ins.tot || jaar + "-12-01" })
    + p(betaald ? "Je inschrijving is volledig in orde. We kijken ernaar uit om samen een gezellige avond te beleven!" : "Zodra je betaling ontvangen is, is je inschrijving definitief. We kijken ernaar uit om samen een gezellige avond te beleven!");
  return { aan, aanNaam: L.voornaam ? L.voornaam + " " + (L.naam || "") : d.naam, onderwerp: `VBHA - Bevestiging inschrijving banket ${jaar}`, html: huisstijl(html, A.vereniging), betaald };
}
async function mailNieuwLid(sb, row) {
  const d = row.data, A = await algemeen(sb), aan = String(d.email || "").trim();
  if (!aan) return null;
  const jaar = (d.betaling && d.betaling.jaar) || d.lidSinds || A.jaar, bedrag = d.lidgeldBedrag || 0, betaald = BETAALD(d, bedrag);
  const tegen = plusDagen(String(d.aangemeld || vandaag()).slice(0, 10), 14);
  const link = !betaald && bedrag > 0 ? `${site()}/lidgeld?l=${encodeURIComponent(row.id)}&j=${jaar}&b=${Number(bedrag)}&t=${encodeURIComponent(teken(row.id, jaar, bedrag))}` : "";
  const html = p(`Beste ${esc(d.voornaam || d.naam)},`) + p(`Welkom bij de <b>${esc(A.vereniging)}</b>! We ontvingen je inschrijving als lid. Hieronder vind je nog eens je gegevens.`)
    + kaderBlok("Je gegevens", tabel([rij("Naam", esc(d.naam + " " + d.voornaam)), rij("Adres", esc(d.adres)), rij("E-mail", esc(d.email)), rij("Telefoon", esc(d.telefoon)), rij("Categorie", esc(d.categorie)), rij("Lidgeld " + jaar, eur(bedrag))]))
    + betaalBlok({ betaald, betaling: d.betaling, bedrag, rekeningnummer: A.rekeningnummer || DEF_IBAN, begunstigde: A.vereniging, mededeling: `${d.naam} ${d.voornaam} Lidgeld ${jaar}`, tegen, link })
    + p(betaald ? "Je lidmaatschap is in orde. Tot op een van onze activiteiten!" : "Zodra je lidgeld ontvangen is, ben je volwaardig lid. Tot op een van onze activiteiten!")
    + kaderBlok("Puntensysteem", p("Als lid verdien je punten door mee te helpen: bij activiteiten, de kalenderbedeling, vergaderingen en meer. Die punten bepalen onder meer je korting op het banket. Lees hoe het werkt in het reglement van het puntensysteem.", "margin:0"))
    + knop("Reglement puntensysteem lezen", `${site()}/reglement`)
    + p("Kloppen je gegevens niet? Antwoord dan gewoon op deze mail.", "margin:0 0 15px;font-size:13.5px;color:#666666");
  return { aan, aanNaam: d.voornaam + " " + d.naam, onderwerp: `VBHA - Bevestiging van je inschrijving als lid`, html: huisstijl(html, A.vereniging), betaald };
}
/* kinderfeest: cadeau-info in de bevestiging (instelbaar in Kinderfeest › tandwiel; config kf_<jaar>.mail) */
export function kfMailDef(jaar, datum) {
  const Y = Number(String(datum || "").slice(0, 4)) || Number(jaar), d = new Date((datum || Y + "-12-19") + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() - 10);
  return { cadeau: true, sites: "www.dreamland.be, www.bol.com", tot: d.toISOString().slice(0, 10), contact: "jojanneke.lariviere@zonezuidoost.be", kopie: "jojanneke.lariviere@zonezuidoost.be",
    groepen: `${Y - 11}: cadeau voorzien door VBHA\n${Y - 10}-${Y - 6}: 50,00 EUR per kind\n${Y - 5}-${Y}: 35,00 EUR per kind` };
}
export function kfGroepen(t) {
  return String(t || "").split(/\n+/).map(l => l.match(/^\s*(\d{4})(?:\s*[-–]\s*(\d{4}))?\s*[:=]\s*(.+?)\s*$/)).filter(Boolean)
    .map(m => ({ van: Math.min(+m[1], +(m[2] || m[1])), tot: Math.max(+m[1], +(m[2] || m[1])), tekst: m[3] }));
}
const jarenTekst = (a, b) => { const L = []; for (let y = a; y <= b; y++) L.push(y); return L.length < 2 ? String(L[0]) : L.slice(0, -1).join(", ") + " en " + L[L.length - 1]; };
const linkSite = s => { const u = String(s).trim(); if (!u) return ""; const h = /^https?:\/\//i.test(u) ? u : "https://" + u; return `<a href="${esc(h)}" style="color:#a3211a">${esc(u.replace(/^https?:\/\//i, ""))}</a>`; };
export async function kfMailHtml(sb, d, { A, c, jaar }) {
  const datum = c.datum || jaar + "-12-19", tijd = c.tijd || "14u30", locatie = c.locatie || "VTI - Sinte Annalaan 99b, Aalst";
  const M = { ...kfMailDef(jaar, datum), ...(c.mail || {}) }, G = kfGroepen(M.groepen);
  const lft = geb => { if (!geb) return ""; const [y, m, dd] = geb.split("-").map(Number), [Y, Mo, D] = datum.split("-").map(Number); let a = Y - y; if (Mo < m || (Mo === m && D < dd)) a--; return a < 1 ? "< 1 jaar" : a + " jaar"; };
  const groep = geb => { const y = Number(String(geb || "").slice(0, 4)); return G.find(g => y >= g.van && y <= g.tot); };
  const kids = (d.kinderen || []).map(k => `<b>${esc(k.naam)}</b>${k.geb ? ` <span style="color:#666666">(${lft(k.geb)})</span>` : ""}`).join("<br>");
  const waarde = t => { const x = String(t || "").replace(/\s*per kind\s*$/i, "").trim(); return /^\d/.test(x) ? "cadeau ter waarde van <b>" + esc(x) + "</b>" : esc(x); };
  const perKind = (d.kinderen || []).map(k => ({ k, g: groep(k.geb) })).filter(x => x.g);
  let vn = d.voornaam || "";
  if (!vn && d.lidId) { const { data: lid } = await sb.from("leden").select("data").eq("id", d.lidId).maybeSingle(); vn = (lid && lid.data && lid.data.voornaam) || ""; }
  const sites = String(M.sites || "").split(/[,;\s]+/).filter(Boolean).map(linkSite);
  const sitesT = sites.length < 2 ? sites.join("") : sites.slice(0, -1).join(", ") + " of " + sites[sites.length - 1];
  const totL = M.tot ? lang(M.tot).replace(/^\S+\s/, "") : "";
  let html = p(vn ? `Beste ${esc(vn)},` : "Beste,") + p(`Je bent ingeschreven voor het kinderfeest op <b>${esc(lang(datum).replace(/^\S+\s/, ""))}</b>. Super!`);
  if (M.cadeau) {
    html += p("Dit jaar kan je zoals vorig jaar zelf het cadeau voor je kind(eren) kiezen.")
      + (sitesT ? p(`Ga hiervoor naar de website ${sitesT} en kies 1 of meerdere cadeaus volgens de waarde die hieronder per kind vermeld staat.`) : "")
      + (perKind.length ? `<ul style="margin:0 0 15px;padding-left:22px">${perKind.map(({ k, g }) => `<li style="margin:0 0 4px"><b>${esc(k.naam)}</b>: ${waarde(g.tekst)}</li>`).join("")}</ul>` : "")
      + p(`Stuur ons ${totL ? `<b>voor ${esc(totL)}</b> ` : ""}per kind de omschrijving en het artikelnummer door${M.contact ? ` via <a href="mailto:${esc(M.contact)}" style="color:#a3211a">${esc(M.contact)}</a>` : ""}.`)
      + p(`Gelieve ook te letten op de beschikbaarheid en levertijden van de producten.<br>Indien we ${totL ? "op " + esc(totL) + " " : ""}niets van jou hebben ontvangen, zal er een waardebon van bol.com worden voorzien t.w.v. het bedrag hierboven.`)
      ;
  }
  html += kaderBlok("Je inschrijving", tabel([rij("Wanneer", esc(lang(datum)) + (tijd ? " om " + esc(tijd) : "")), rij("Waar", esc(locatie)), rij("Lid", esc(d.lid)), rij("Kinderen", kids || "–"), d.opmerking ? rij("Opmerking", esc(d.opmerking)) : ""]))
    + p("Tot dan!");
  return html;
}
async function mailKinderfeest(sb, row) {
  const d = row.data, A = await algemeen(sb), jaar = d.jaar || A.jaar, c = await configDoc(sb, "kf_" + jaar), aan = String(d.email || "").trim();
  if (!aan) return null;
  const html = await kfMailHtml(sb, d, { A, c, jaar });
  const M = { ...kfMailDef(jaar, c.datum || jaar + "-12-19"), ...(c.mail || {}) }, cc = String(M.kopie || "").split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(x => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(x)).slice(0, 5);
  return { aan, aanNaam: d.lid || "", cc, onderwerp: `VBHA - Bevestiging inschrijving kinderfeest ${jaar}`, html: huisstijl(html, A.vereniging), betaald: true };
}
async function mailBetaald(sb, tabel, row) {
  const d = row.data, A = await algemeen(sb), b = d.betaling || {};
  let aan = "", voornaam = "", wat = "";
  if (tabel === "leden") { aan = d.email; voornaam = d.voornaam; wat = `je lidgeld ${b.jaar || ""}`.trim(); }
  else { const { data: lid } = d.lidId ? await sb.from("leden").select("data").eq("id", d.lidId).maybeSingle() : { data: null }; aan = lid && lid.data && lid.data.email; voornaam = lid && lid.data && lid.data.voornaam; wat = `het banket ${d.jaar || ""}`.trim(); }
  aan = String(aan || "").trim(); if (!aan) return null;
  const html = p(`Beste ${esc(voornaam || "")},`.replace(" ,", ",")) + betaalBlok({ betaald: true, betaling: b, bedrag: b.bedrag })
    + p(tabel === "leden" ? "Je lidgeld is in orde. Bedankt en tot op een van onze activiteiten!" : "Je inschrijving voor het banket is nu volledig in orde. Tot dan!");
  return { aan, aanNaam: voornaam || "", onderwerp: `VBHA - Betaling ontvangen voor ${wat}`, html: huisstijl(html, A.vereniging), betaald: true };
}

/* ---------- versturen ---------- */
async function haal(sb, tabel, id) { const { data } = await sb.from(tabel).select("id,data").eq("id", id).maybeSingle(); return data; }
async function zet(sb, tabel, id, patch) { const r = await haal(sb, tabel, id); if (!r) return; const { error } = await sb.from(tabel).update({ data: { ...r.data, ...patch } }).eq("id", id); if (error) throw error; }
async function stuur(m) { if (!m || !smtpConfigured()) return false; const cc = (m.cc || []).filter(c => c && c.toLowerCase() !== String(m.aan).toLowerCase()); const [r] = await verstuur([{ aan: m.aan, aanNaam: m.aanNaam, onderwerp: m.onderwerp, html: m.html, van: afzender(), ...(cc.length ? { cc } : {}) }]); return !!(r && r.ok); }
const MAKER = { banket: mailBanket, leden: mailNieuwLid, kinderfeest: mailKinderfeest };

export async function wachtOpBetaling(sb, tabel, id) { await zet(sb, tabel, id, { bevestiging: { status: "wacht", sinds: new Date().toISOString() } }); }
export async function stuurBevestiging(sb, tabel, id) {
  const r = await haal(sb, tabel, id); if (!r) return false;
  if (r.data.bevestiging && r.data.bevestiging.status === "verstuurd") return true;
  if (r.data.bevestiging && r.data.bevestiging.status === "dubbel") return false;
  const m = await MAKER[tabel](sb, r);
  if (!m) { await zet(sb, tabel, id, { bevestiging: { status: "geen-adres", op: new Date().toISOString() } }); return false; }
  const ok = await stuur(m);
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
  for (const [tpl, R] of Object.entries(regels)) {
    if (!R || !R.html || !R.tot || R.tot < nu || al[tpl]) continue;
    const vn = esc(d.voornaam || ""), nm = esc([d.voornaam, d.naam].filter(Boolean).join(" "));
    const vulIn = (t, h) => String(t).split("@@VOORNAAM@@").join(h ? vn : d.voornaam || "").split("@@NAAM@@").join(h ? nm : [d.voornaam, d.naam].filter(Boolean).join(" ")).replace(/Beste\s+,/g, "Beste,");
    rijen.push({ batch: "nastuur-" + tpl.replace(/[^\w.-]/g, "") + "-" + Date.now().toString(36), data: { aan, aanNaam: [d.voornaam, d.naam].filter(Boolean).join(" "), onderwerp: vulIn(R.onderwerp, false), html: ondertekenLinks(vulIn(R.html, true)), label: "Nagestuurd: " + (R.naam || tpl) } });
    al[tpl] = new Date().toISOString();
  }
  if (!rijen.length) return 0;
  const { error } = await sb.from("mail_wachtrij").insert(rijen); if (error) throw error;
  await zet(sb, "leden", id, { nastuur: al });
  return rijen.length;
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
}
/* geplande taak: bevestigingen die langer dan 20 minuten op een betaling wachten */
export async function bevestigingenCron(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!(await isDbCron(req))) throw httpErr(403, "Geen toegang");
  const sb = admin(), grens = new Date(Date.now() - 20 * 60 * 1000).toISOString(), uit = [];
  for (const tabel of ["banket", "leden"]) {
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
  res.status(200).json({ verstuurd: uit, herinneringenFacturen: facturen, inkomend, betaalherinnering });
}
// gedeeld met de facturatie (api/_lib/factuur.js)
export { huisstijl, kaderBlok, knop, tabel, rij, p, esc, eur, kort, lang, vandaag, plusDagen, site };

/* voorbeeld van de bevestigingsmail kinderfeest (app: Kinderfeest › tandwiel › Voorbeeld) */
export async function kfVoorbeeld(req, res) {
  const { sb } = await requireUser(req);
  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const A = await algemeen(sb), jaar = Number(b.jaar) || A.jaar, c0 = await configDoc(sb, "kf_" + jaar), c = { ...c0, ...(b.cfg || {}), mail: { ...(c0.mail || {}), ...((b.cfg && b.cfg.mail) || {}) } };
  const Y = Number(String(c.datum || jaar + "-12-19").slice(0, 4));
  const d = { jaar, lid: "Peeters Jan", voornaam: "Jan", kinderen: [{ naam: "Lotte", geb: (Y - 8) + "-04-02" }, { naam: "Mats", geb: (Y - 3) + "-09-15" }] };
  const html = huisstijl(await kfMailHtml(sb, d, { A, c, jaar }), A.vereniging);
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ html, standaard: kfMailDef(jaar, c.datum || jaar + "-12-19") });
}
