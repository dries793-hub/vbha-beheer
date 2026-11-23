/* Sjablonen voor de automatische mails.
   Elke automatische mail registreert hier een standaardsjabloon (onderwerp + inhoud met velden zoals {voornaam}).
   Bij het versturen wordt het sjabloon uit de tabel "templates" gebruikt (id "sys-<sleutel>"), zodat aanpassingen in
   Mail/Sms › sjablonen meteen gelden; bestaat het daar niet (meer), dan de standaardtekst uit de code.
   Velden:  {veld}                   wordt ingevuld (waarden zijn al HTML; een veld alleen in een alinea vervangt de hele alinea)
            {als:veld}…{/als:veld}   enkel als het veld ingevuld/waar is
            {niet:veld}…{/niet:veld} enkel als het veld leeg/onwaar is */
const REG = new Map();
export const SYS_CAT = "Automatische mails";
export function registreer(def) { REG.set(def.key, def); return def; }
export function sysDefs() { return [...REG.values()]; }
// body mag ook een functie zijn die de opmaakhulpjes krijgt (voor modules die bevestiging.js niet vooraf laden)
async function bodyVan(def) { return typeof def.body === "function" ? def.body(await import("./bevestiging.js")) : def.body; }

const leeg = v => v == null || v === false || v === "" || v === 0;
export function vulSjabloon(t, vars = {}) {
  let s = String(t || "");
  for (let i = 0; i < 3; i++) { // geneste voorwaarden met verschillende velden
    s = s.replace(/\{als:(\w+)\}([\s\S]*?)\{\/als:\1\}/g, (m, k, inh) => leeg(vars[k]) ? "" : inh)
      .replace(/\{niet:(\w+)\}([\s\S]*?)\{\/niet:\1\}/g, (m, k, inh) => leeg(vars[k]) ? inh : "");
  }
  // een veld dat alleen in een alinea staat (blok zoals een tabel of knop): de hele alinea vervangen
  s = s.replace(/<(p|div)(\s[^>]*)?>\s*(?:<br\s*\/?>\s*)*\{(\w+)\}\s*(?:<br\s*\/?>\s*)*<\/\1>/gi, (m, tag, at, k) => k in vars ? (leeg(vars[k]) || vars[k] === true ? "" : String(vars[k])) : m);
  s = s.replace(/\{(\w+)\}/g, (m, k) => k in vars ? (leeg(vars[k]) || vars[k] === true ? "" : String(vars[k])) : m);
  // lege alinea's die door voorwaarden overbleven
  return s.replace(/<p(\s[^>]*)?>\s*(<br\s*\/?>)?\s*<\/p>/gi, "");
}
const tekst = s => String(s || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();

let CACHE = null, CACHE_T = 0;
async function laad(sb) {
  if (CACHE && Date.now() - CACHE_T < 60000) return CACHE;
  const M = new Map();
  try { const { data } = await sb.from("templates").select("id,data").like("id", "sys-%"); for (const r of data || []) M.set(r.id.slice(4), r.data || {}); } catch (e) { }
  CACHE = M; CACHE_T = Date.now(); return M;
}
export function wisCache() { CACHE = null; }

/* geeft { onderwerp, html } terug: html is de inhoud (zonder huisstijl-omkadering) */
export async function sysMail(sb, key, vars) {
  const def = REG.get(key); if (!def) throw new Error("Onbekend mailsjabloon: " + key);
  const M = await laad(sb), t = M.get(key);
  const ond = t && String(t.onderwerp || "").trim() ? t.onderwerp : def.onderwerp, body = t && String(t.body || "").trim() ? t.body : await bodyVan(def);
  const { kopMarker } = await import("./kop.js");
  return { onderwerp: tekst(vulSjabloon(ond, vars)), html: kopMarker(key, t => vulSjabloon(t, vars)) + vulSjabloon(body, vars) };
}

/* rij voor de tabel templates */
export const sysRij = async def => ({ naam: def.naam, categorie: SYS_CAT, groep: "", onderwerp: def.onderwerp, body: await bodyVan(def), opmaak: "huisstijl", isHtml: true,
  sys: def.key, wanneer: def.wanneer || "", velden: def.velden || [], voorbeeld: def.voorbeeld || {} });

/* ontbrekende standaardsjablonen aanmaken; met "herstel" één sjabloon terugzetten naar de standaardtekst.
   Bestaande sjablonen krijgen enkel bijgewerkte uitleg/velden, hun tekst blijft. */
export async function zaaiSjablonen(sb, herstel) {
  const { data } = await sb.from("templates").select("id,data").like("id", "sys-%");
  const B = new Map((data || []).map(r => [r.id, r.data || {}])), rijen = [];
  for (const def of REG.values()) {
    const id = "sys-" + def.key, cur = B.get(id), std = await sysRij(def);
    if (!cur || herstel === def.key) rijen.push({ id, data: std });
    else if (JSON.stringify([cur.naam, cur.wanneer, cur.velden, cur.voorbeeld, cur.sys, cur.categorie]) !== JSON.stringify([std.naam, std.wanneer, std.velden, std.voorbeeld, std.sys, std.categorie]))
      rijen.push({ id, data: { ...cur, naam: std.naam, categorie: SYS_CAT, sys: def.key, wanneer: std.wanneer, velden: std.velden, voorbeeld: std.voorbeeld, opmaak: "huisstijl", isHtml: true } });
  }
  if (rijen.length) { const { error } = await sb.from("templates").upsert(rijen); if (error) throw error; }
  wisCache();
  return { aangemaakt: rijen.length, totaal: REG.size };
}
