/* Te verwerken betalingen die al 5 dagen wachten: één mail naar de boekhouding (boekhouding@vbha.be).
   - Inkomende facturen (map Inkomende facturen) die nog niet (volledig) aan een transactie gekoppeld zijn en niet via domiciliëring lopen.
   - Onkostennota's die nog goed te keuren (ingediend) of nog te betalen (goedgekeurd) zijn.
   Per betaling één keer gemeld (config betaalWacht.gemeld); de mail toont telkens alle betalingen die 5 dagen of langer wachten. */
import { huisstijl, kaderBlok, knop, p, esc, eur } from "./bevestiging.js";
import { registreer, sysMail } from "./sjabloon.js";
registreer({ key: "betaalwacht", naam: "Te verwerken betalingen (aan de boekhouding)", wanneer: "Als betalingen (inkomende facturen, onkostennota's) al enkele dagen wachten om uitgevoerd te worden.",
  onderwerp: "{als:een}1 betaling wacht{/als:een}{niet:een}{aantal} betalingen wachten{/niet:een} al {dagen} dagen",
  body: p("Er {als:een}wacht een betaling{/als:een}{niet:een}wachten {aantal} betalingen{/niet:een} al {dagen} dagen of langer om uitgevoerd te worden{als:totaal} (samen {totaal}){/als:totaal}.") + kaderBlok("Te verwerken betalingen", "{lijst}") + "<p>{knop_app}</p>",
  velden: [["aantal", "Aantal betalingen"], ["dagen", "Aantal dagen"], ["totaal", "Totaal bedrag"], ["lijst", "Lijst van de betalingen"], ["knop_app", "Knop naar de app"], ["een", "Voorwaarde: één betaling"]], voorbeeld: { aantal: "2", dagen: "5", totaal: "€430,00", een: "" } });
registreer({ key: "factuur-vervalt", naam: "Facturen die binnenkort vervallen (aan de boekhouding)", wanneer: "Als een inkomende factuur 5 dagen voor de vervaldatum nog niet betaald is.",
  onderwerp: "{als:een}1 factuur vervalt{/als:een}{niet:een}{aantal} facturen vervallen{/niet:een} binnenkort",
  body: p("{als:een}Deze factuur is{/als:een}{niet:een}Deze facturen zijn{/niet:een} nog niet betaald en {als:een}vervalt{/als:een}{niet:een}vervallen{/niet:een} binnen {dagen} dagen{als:totaal} (samen {totaal}){/als:totaal}.") + kaderBlok("Te betalen facturen", "{lijst}") + "<p>{knop_app}</p>",
  velden: [["aantal", "Aantal facturen"], ["dagen", "Aantal dagen voor de vervaldatum"], ["totaal", "Totaal bedrag"], ["lijst", "Lijst met de facturen en vervaldata"], ["knop_app", "Knop naar de app"], ["een", "Voorwaarde: één factuur"]], voorbeeld: { aantal: "2", dagen: "5", totaal: "€430,00", een: "" } });
let DAGEN = 5, AAN = ""; const MAP = "Inkomende facturen"; // aantal dagen en ontvanger instelbaar in de app (config betaalWacht.dagen / .mail)
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const van = d => (d.inkomend && (d.inkomend.leverancier || d.inkomend.vanNaam || d.inkomend.van)) || d.door || "";
export async function betaalWachtCron(sb) {
  const { data: cfgRow } = await sb.from("config").select("data").eq("id", "betaalWacht").maybeSingle();
  const C = (cfgRow && cfgRow.data) || {}; if (C.aan === false) return { uit: true };
  DAGEN = Math.max(1, Math.min(60, Number(C.dagen) || 10)); AAN = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(C.mail || "").trim()) ? String(C.mail).trim() : "";
  const grens = Date.now() - DAGEN * 864e5, gemeld = C.gemeld || {};
  const { data: docs } = await sb.from("documenten").select("id,data").eq("data->>map", MAP).limit(2000);
  const D = (docs || []).filter(r => r.data && r.data.inkomend && !r.data.inkomend.dubbelVan);
  const { data: bk } = await sb.from("boekingen").select("data").not("data->>documentId", "is", null).limit(5000);
  const som = new Map(); for (const r of bk || []) { const k = r.data.documentId; som.set(k, (som.get(k) || 0) + (Number(r.data.bedrag) || 0)); }
  const domiLev = new Set(D.filter(r => r.data.inkomend.domi === true).map(r => norm(van(r.data))).filter(Boolean));
  const items = [], vervalt = [], vandaag = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels" }).format(new Date());
  const VD = Math.max(0, Math.min(60, Number(C.vervalDagen ?? 5))), vervalGrens = new Date(Date.parse(vandaag + "T12:00:00Z") + VD * 864e5).toISOString().slice(0, 10);
  for (const r of D) {
    const d = r.data, I = d.inkomend, t = Number(I.totaal) || Number(I.bedragPdf) || 0, betaald = som.get(r.id) || 0;
    if (betaald && (!t || betaald >= t - 0.005)) continue;
    if (I.betaald) continue; // in de app op "Betaald" gezet
    const v = norm(van(d));
    if (I.domi === true || (I.domi !== false && (/bancontact|payconiq/.test(v) || domiLev.has(v)))) continue;
    if (/^\d{4}-\d{2}-\d{2}$/.test(I.verval || "") && I.verval <= vervalGrens) vervalt.push({ id: r.id, naam: van(d) || d.naam, nr: I.nr || "", bedrag: t ? t - betaald : null, verval: I.verval });
    const op = new Date(I.ontvangen || d.op || 0).getTime(); if (!op || op > grens) continue;
    items.push({ id: r.id, soort: "Factuur", naam: van(d) || d.naam, bedrag: t ? t - betaald : null, sinds: op });
  }
  const { data: tb } = await sb.from("terugbetalingen").select("id,status,data").in("status", ["ingediend", "goedgekeurd"]).limit(500);
  for (const r of tb || []) {
    const op = new Date(r.data.op || 0).getTime(); if (!op || op > grens) continue;
    items.push({ id: r.id, soort: r.status === "ingediend" ? "Onkostennota (nog goed te keuren)" : "Onkostennota", naam: r.data.naam, bedrag: Number(r.data.bedrag) || null, sinds: op });
  }
  // facturen die binnen VD dagen vervallen (of al vervallen zijn) en nog niet betaald: één keer melden
  const gemeldV = C.vervalGemeld || {}, nieuwV = C.vervalAan === false ? [] : vervalt.filter(x => !gemeldV[x.id]);
  if (nieuwV.length) {
    vervalt.sort((a, b) => a.verval.localeCompare(b.verval));
    const fd = iso => iso.split("-").reverse().join("/");
    const lijst = vervalt.map(x => p(`<b>${esc(x.naam)}</b>${x.bedrag ? ` · ${eur(x.bedrag)}` : ""}<br><span style="color:#6b7280">${x.nr ? "factuur " + esc(x.nr) + " · " : ""}${x.verval < vandaag ? "vervallen sinds" : "vervalt"} ${fd(x.verval)}</span>`, "margin:0 0 10px")).join("");
    const tv = vervalt.reduce((t, x) => t + (x.bedrag || 0), 0);
    const mv = await sysMail(sb, "factuur-vervalt", { aantal: vervalt.length, een: vervalt.length === 1, dagen: VD, totaal: tv ? eur(tv) : "", lijst, knop_app: knop("Openen in de app", "https://beheer.vbha.be/#dashboard") });
    const { error: ev } = await sb.from("mail_wachtrij").insert({ batch: "factuurvervalt-" + vandaag, data: { aan: AAN || process.env.BETAALWACHT_MAIL || "boekhouding@vbha.be", aanNaam: "Boekhouding VBHA", onderwerp: mv.onderwerp, html: huisstijl(mv.html, "Vriendenkring Brandweer Hoofdpost Aalst", { groet: false }), label: "Facturen vervallen binnenkort" } });
    if (ev) throw ev;
    const ids = new Set(vervalt.map(x => x.id)), nv = Object.fromEntries(Object.entries(gemeldV).filter(([k]) => ids.has(k)));
    for (const x of nieuwV) nv[x.id] = new Date().toISOString();
    C.vervalGemeld = nv; await sb.from("config").upsert({ id: "betaalWacht", data: { ...C } });
  }
  const nieuw = items.filter(x => !gemeld[x.id]);
  // opruimen: wat niet meer wacht, uit de lijst halen
  const nuIds = new Set(items.map(x => x.id)), schoon = Object.fromEntries(Object.entries(gemeld).filter(([k]) => nuIds.has(k)));
  if (!nieuw.length) { if (Object.keys(schoon).length !== Object.keys(gemeld).length) await sb.from("config").upsert({ id: "betaalWacht", data: { ...C, gemeld: schoon } }); return { nieuw: 0, wachtend: items.length }; }
  items.sort((a, b) => a.sinds - b.sinds);
  const dagen = x => Math.floor((Date.now() - x.sinds) / 864e5), tot = items.reduce((s, x) => s + (x.bedrag || 0), 0);
  const lijst = items.map(x => p(`<b>${esc(x.naam)}</b>${x.bedrag ? ` · ${eur(x.bedrag)}` : ""}<br><span style="color:#6b7280">${esc(x.soort)} · wacht ${dagen(x)} dagen</span>`, "margin:0 0 10px")).join("");
  const m = await sysMail(sb, "betaalwacht", { aantal: items.length, een: items.length === 1, dagen: DAGEN, totaal: tot ? eur(tot) : "", lijst, knop_app: knop("Openen in de app", "https://beheer.vbha.be/#dashboard") });
  const html = huisstijl(m.html, "Vriendenkring Brandweer Hoofdpost Aalst", { groet: false });
  const aan = AAN || process.env.BETAALWACHT_MAIL || "boekhouding@vbha.be";
  const { error } = await sb.from("mail_wachtrij").insert({ batch: "betaalwacht-" + new Date().toISOString().slice(0, 10), data: { aan, aanNaam: "Boekhouding VBHA", onderwerp: m.onderwerp, html, label: "Te verwerken betalingen" } });
  if (error) throw error;
  for (const x of nieuw) schoon[x.id] = new Date().toISOString();
  await sb.from("config").upsert({ id: "betaalWacht", data: { ...C, gemeld: schoon } });
  return { nieuw: nieuw.length, wachtend: items.length, gemaild: aan };
}
