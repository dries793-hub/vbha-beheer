/* Te verwerken betalingen die al 5 dagen wachten: één mail naar de boekhouding (boekhouding@vbha.be).
   - Inkomende facturen (map Inkomende facturen) die nog niet (volledig) aan een transactie gekoppeld zijn en niet via domiciliëring lopen.
   - Onkostennota's die nog goed te keuren (ingediend) of nog te betalen (goedgekeurd) zijn.
   Per betaling één keer gemeld (config betaalWacht.gemeld); de mail toont telkens alle betalingen die 5 dagen of langer wachten. */
import { huisstijl, kaderBlok, knop, p, esc, eur } from "./bevestiging.js";
const DAGEN = 5, MAP = "Inkomende facturen";
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const van = d => (d.inkomend && (d.inkomend.leverancier || d.inkomend.vanNaam || d.inkomend.van)) || d.door || "";
export async function betaalWachtCron(sb) {
  const { data: cfgRow } = await sb.from("config").select("data").eq("id", "betaalWacht").maybeSingle();
  const C = (cfgRow && cfgRow.data) || {}; if (C.aan === false) return { uit: true };
  const grens = Date.now() - DAGEN * 864e5, gemeld = C.gemeld || {};
  const { data: docs } = await sb.from("documenten").select("id,data").eq("data->>map", MAP).limit(2000);
  const D = (docs || []).filter(r => r.data && r.data.inkomend);
  const { data: bk } = await sb.from("boekingen").select("data").not("data->>documentId", "is", null).limit(5000);
  const som = new Map(); for (const r of bk || []) { const k = r.data.documentId; som.set(k, (som.get(k) || 0) + (Number(r.data.bedrag) || 0)); }
  const domiLev = new Set(D.filter(r => r.data.inkomend.domi === true).map(r => norm(van(r.data))).filter(Boolean));
  const items = [];
  for (const r of D) {
    const d = r.data, I = d.inkomend, t = Number(I.totaal) || Number(I.bedragPdf) || 0, betaald = som.get(r.id) || 0;
    if (betaald && (!t || betaald >= t - 0.005)) continue;
    const v = norm(van(d));
    if (I.domi === true || (I.domi !== false && (/bancontact|payconiq/.test(v) || domiLev.has(v)))) continue;
    const op = new Date(I.ontvangen || d.op || 0).getTime(); if (!op || op > grens) continue;
    items.push({ id: r.id, soort: "Factuur", naam: van(d) || d.naam, bedrag: t ? t - betaald : null, sinds: op });
  }
  const { data: tb } = await sb.from("terugbetalingen").select("id,status,data").in("status", ["ingediend", "goedgekeurd"]).limit(500);
  for (const r of tb || []) {
    const op = new Date(r.data.op || 0).getTime(); if (!op || op > grens) continue;
    items.push({ id: r.id, soort: r.status === "ingediend" ? "Onkostennota (nog goed te keuren)" : "Onkostennota", naam: r.data.naam, bedrag: Number(r.data.bedrag) || null, sinds: op });
  }
  const nieuw = items.filter(x => !gemeld[x.id]);
  // opruimen: wat niet meer wacht, uit de lijst halen
  const nuIds = new Set(items.map(x => x.id)), schoon = Object.fromEntries(Object.entries(gemeld).filter(([k]) => nuIds.has(k)));
  if (!nieuw.length) { if (Object.keys(schoon).length !== Object.keys(gemeld).length) await sb.from("config").upsert({ id: "betaalWacht", data: { ...C, gemeld: schoon } }); return { nieuw: 0, wachtend: items.length }; }
  items.sort((a, b) => a.sinds - b.sinds);
  const dagen = x => Math.floor((Date.now() - x.sinds) / 864e5), tot = items.reduce((s, x) => s + (x.bedrag || 0), 0);
  const lijst = items.map(x => p(`<b>${esc(x.naam)}</b>${x.bedrag ? ` · ${eur(x.bedrag)}` : ""}<br><span style="color:#6b7280">${esc(x.soort)} · wacht ${dagen(x)} dagen</span>`, "margin:0 0 10px")).join("");
  const html = huisstijl(p("Dag boekhouding,") + p(`Er ${items.length === 1 ? "wacht een betaling" : `wachten ${items.length} betalingen`} al ${DAGEN} dagen of langer om uitgevoerd te worden${tot ? ` (samen ${eur(tot)})` : ""}.`)
    + kaderBlok("Te verwerken betalingen", lijst) + knop("Openen in de app", "https://vbha-beheer.vercel.app/#dashboard"), "Vriendenkring Brandweer Hoofdpost Aalst");
  const aan = process.env.BETAALWACHT_MAIL || "boekhouding@vbha.be";
  const { error } = await sb.from("mail_wachtrij").insert({ batch: "betaalwacht-" + new Date().toISOString().slice(0, 10), data: { aan, aanNaam: "Boekhouding VBHA", onderwerp: `${items.length === 1 ? "1 betaling wacht" : items.length + " betalingen wachten"} al ${DAGEN} dagen`, html, label: "Te verwerken betalingen" } });
  if (error) throw error;
  for (const x of nieuw) schoon[x.id] = new Date().toISOString();
  await sb.from("config").upsert({ id: "betaalWacht", data: { ...C, gemeld: schoon } });
  return { nieuw: nieuw.length, wachtend: items.length, gemaild: aan };
}
