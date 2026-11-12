/* Kinderfeest: ouders kiezen zelf het cadeau per kind (bol.com of dreamland.be).
   - Persoonlijke link per inschrijving: /cadeau?i=<id>&t=<handtekening> (in de bevestigingsmail).
   - De ouder plakt de link van een product; de server haalt naam, prijs, foto en voorraad op bij de winkel
     en controleert het budget van het kind (Waarde per geboortejaar, Kinderfeest › tandwiel).
   - Bewaard bij het kind: kinderen[i].cadeau = {items:[{url,winkel,naam,prijs,foto,artikelnr,beschikbaar,auto,gecontroleerd}], totaal, op} of {bon:true}.
   - Kiezen kan tot en met de datum "Cadeau doorgeven vóór" (standaard 10 dagen voor het feest). Wie niets koos, krijgt een bon van bol.com. */
import crypto from "node:crypto";
import { admin, httpErr, sendError, requireUser } from "./sb.js";
import { body, clean, configDoc, algemeen, rateLimit, vandaagISO } from "./publiek.js";
import { kfMailDef, kfGroepen } from "./bevestiging.js";

const sleutel = () => String(process.env.BETAAL_GEHEIM || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
export const kfcToken = id => crypto.createHmac("sha256", sleutel()).update(`vbha-kfcadeau|${id}`).digest("base64url").slice(0, 22);
export function kfcKlopt(id, t) {
  if (!sleutel() || !id || typeof t !== "string") return false;
  const a = Buffer.from(kfcToken(id)), b = Buffer.from(t);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const site = () => String(process.env.SITE_URL || "https://vbha-beheer.vercel.app").replace(/\/+$/, "");
const PVELD = ["url", "winkel", "naam", "prijs", "foto", "artikelnr", "beschikbaar", "levertijd", "gecontroleerd"];
const pTekst = p => PVELD.map(k => k + "=" + (p[k] == null ? "" : String(p[k]))).join("|");
export const tekenProduct = p => crypto.createHmac("sha256", sleutel()).update("vbha-product|" + pTekst(p)).digest("base64url").slice(0, 32);
export function kloptProduct(p) {
  if (!sleutel() || typeof p.sig !== "string" || !(Date.now() - Date.parse(p.gecontroleerd || 0) < 3600e3)) return false;
  const a = Buffer.from(tekenProduct(p)), b = Buffer.from(p.sig); return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export const kfcLink = id => `${site()}/cadeau?i=${encodeURIComponent(id)}&t=${kfcToken(id)}`;

/* ---------- productgegevens ophalen bij de winkel ---------- */
const WINKELS = { "bol.com": "bol.com", "dreamland.be": "Dreamland" };
export function winkelVan(host) { const h = String(host || "").toLowerCase().replace(/^www\./, ""); for (const k of Object.keys(WINKELS)) if (h === k || h.endsWith("." + k)) return WINKELS[k]; return null; }
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", euro: "€" };
const ont = s => String(s || "").replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e.toLowerCase()] ?? m)).replace(/\s+/g, " ").trim();
const getal = v => { if (v == null || v === "") return null; const n = Number(String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null; };
function voorraad(a) {
  const s = String(a || "").split("/").pop().toLowerCase();
  if (!s) return null;
  if (/^(instock|limitedavailability|onlineonly|instoreonly)$/.test(s)) return true;
  if (/^(outofstock|soldout|discontinued)$/.test(s)) return false;
  return null; // preorder, backorder, ...: onbekend
}
function zoekProduct(x) {
  if (!x || typeof x !== "object") return null;
  if (Array.isArray(x)) { for (const y of x) { const p = zoekProduct(y); if (p) return p; } return null; }
  const t = x["@type"]; if (t === "Product" || (Array.isArray(t) && t.includes("Product"))) return x;
  if (x["@graph"]) return zoekProduct(x["@graph"]);
  return null;
}
function meta(html, naam) {
  const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${naam.replace(/[:.]/g, "\\$&")}["'][^>]*>`, "i"), m = html.match(re);
  if (!m) return null; const c = m[0].match(/content=["']([^"']*)["']/i); return c ? ont(c[1]) : null;
}
export function parseProduct(html) {
  const uit = { naam: null, prijs: null, foto: null, artikelnr: null, beschikbaar: null };
  for (const m of String(html || "").matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let j; try { j = JSON.parse(m[1].trim()); } catch { continue; }
    const p = zoekProduct(j); if (!p) continue;
    uit.naam = uit.naam || ont(p.name);
    const img = Array.isArray(p.image) ? p.image[0] : p.image; uit.foto = uit.foto || (typeof img === "string" ? img : img && img.url) || null;
    uit.artikelnr = uit.artikelnr || String(p.gtin13 || p.gtin || p.ean || p.sku || p.productID || "").slice(0, 40) || null;
    const offers = Array.isArray(p.offers) ? p.offers : p.offers ? [p.offers] : [];
    for (const o of offers) {
      const sub = Array.isArray(o.offers) ? o.offers[0] : o.offers; const of = sub || o;
      const pr = getal(of.price ?? of.lowPrice ?? (of.priceSpecification && of.priceSpecification.price));
      if (pr != null && uit.prijs == null) uit.prijs = pr;
      const v = voorraad(of.availability); if (v != null && uit.beschikbaar == null) uit.beschikbaar = v;
    }
    if (uit.naam && uit.prijs != null) break;
  }
  uit.naam = uit.naam || meta(html, "og:title");
  uit.foto = uit.foto || meta(html, "og:image");
  if (uit.prijs == null) uit.prijs = getal(meta(html, "product:price:amount") || meta(html, "og:price:amount") || meta(html, "price"));
  if (uit.beschikbaar == null) uit.beschikbaar = voorraad(meta(html, "product:availability") || meta(html, "og:availability") || meta(html, "availability"));
  if (uit.naam) uit.naam = uit.naam.replace(/\s*\|\s*(bol(\.com)?|dreamland)\s*$/i, "").slice(0, 200);
  return uit;
}
/* bol.com: officiële gegevens via de Marketing Catalog API van het bol.com Partnerprogramma
   (Vercel: BOL_CLIENT_ID en BOL_CLIENT_SECRET, aan te maken in het partneraccount › Account › Open API). */
const bolAan = () => !!(String(process.env.BOL_CLIENT_ID || "").trim() && String(process.env.BOL_CLIENT_SECRET || "").trim());
let BOL_TOKEN = null;
async function bolToken() {
  if (BOL_TOKEN && BOL_TOKEN.tot > Date.now() + 15000) return BOL_TOKEN.t;
  const auth = Buffer.from(String(process.env.BOL_CLIENT_ID).trim() + ":" + String(process.env.BOL_CLIENT_SECRET).trim()).toString("base64");
  const r = await fetch("https://login.bol.com/token?grant_type=client_credentials", { method: "POST", headers: { Authorization: "Basic " + auth, Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error("bol.com aanmelden lukte niet (" + r.status + ")");
  BOL_TOKEN = { t: j.access_token, tot: Date.now() + (Number(j.expires_in) || 299) * 1000 };
  return BOL_TOKEN.t;
}
async function bolGet(pad) {
  const r = await fetch("https://api.bol.com/marketing/catalog/v1" + pad, { headers: { Authorization: "Bearer " + await bolToken(), Accept: "application/json", "Accept-Language": "nl" }, signal: AbortSignal.timeout(8000) });
  if (r.status === 404) return null;
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error("bol.com " + r.status);
  return j;
}
const bolPrijs = o => { if (!o) return null; const p = o.price ?? (o.prices && (o.prices.price ?? o.prices[0]?.price)) ?? o.listPrice ?? o.sellingPrice; return getal(typeof p === "object" && p ? (p.amount ?? p.value) : p); };
export async function bolInfo(u) {
  const id = (String(u.pathname).match(/\/(\d{13,17})(?:\/|$)/) || [])[1];
  if (!id) return null;
  let ean = id.length === 13 && !id.startsWith("9") ? id : null;
  if (!ean) { const c = await bolGet("/products/" + id + "/to-ean"); ean = c && (c.ean || c.EAN); }
  if (!ean) return null;
  const [p, o] = await Promise.all([bolGet(`/products/${ean}?country-code=BE&include-image=true&include-offer=true`), bolGet(`/products/${ean}/offers/best?country-code=BE`)]);
  if (!p) return null;
  const img = p.image || (Array.isArray(p.images) && p.images[0]) || null;
  const offer = o || p.offer || null;
  return { naam: ont(p.title || p.name || "").slice(0, 200) || null, prijs: bolPrijs(offer), foto: (img && (img.url || (img.renditions && img.renditions[0] && img.renditions[0].url))) || null,
    artikelnr: String(ean), beschikbaar: offer ? !offer.isPreOrder || null : false, levertijd: offer && offer.deliveryDescription ? String(offer.deliveryDescription).slice(0, 120) : null };
}
/* Zyte API (tussendienst die de productpagina ophaalt voorbij de botbeveiliging; Vercel: ZYTE_API_KEY). Automatische productherkenning. */
const zyteAan = () => !!String(process.env.ZYTE_API_KEY || "").trim();
async function zyteVraag(u, extractFrom, ms) {
  const r = await fetch("https://api.zyte.com/v1/extract", { method: "POST", signal: AbortSignal.timeout(ms),
    headers: { Authorization: "Basic " + Buffer.from(String(process.env.ZYTE_API_KEY).trim() + ":").toString("base64"), "Content-Type": "application/json" },
    body: JSON.stringify({ url: u.toString(), product: true, productOptions: { extractFrom }, geolocation: "BE" }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("zyte " + r.status + " " + String(j.title || j.detail || "").slice(0, 120));
  const p = j.product || {};
  const av = String(p.availability || "").toLowerCase();
  const gt = Array.isArray(p.gtin) && p.gtin[0] ? (p.gtin[0].value || p.gtin[0]) : null;
  return { naam: p.name ? ont(p.name).slice(0, 200) : null, prijs: getal(p.price), foto: (p.mainImage && p.mainImage.url) || (Array.isArray(p.images) && p.images[0] && p.images[0].url) || null,
    artikelnr: String(gt || p.sku || p.mpn || "").slice(0, 40) || null, beschikbaar: av === "instock" ? true : av === "outofstock" ? false : null, url: p.canonicalUrl || p.url || null };
}
// eerst de snelle manier (gewone opvraging, zonder browser); lukt dat niet, dan met een echte browser
const ZYTE_MODUS = {}; // per winkel: wat de laatste keer werkte
export async function zyteInfo(u) {
  const w = winkelVan(u.hostname) || "?", volg = ZYTE_MODUS[w] === "browserHtml" ? ["browserHtml"] : ["httpResponseBody", "browserHtml"];
  let laatste = null;
  for (const m of volg) {
    try { const p = await zyteVraag(u, m, m === "httpResponseBody" ? 28000 : 40000); if (p.naam && p.prijs != null) { ZYTE_MODUS[w] = m; return p; } laatste = p; }
    catch (e) { laatste = laatste || null; if (m === "browserHtml") throw e; }
  }
  return laatste || {};
}
// zoekpagina via Zyte in een echte browser: links naar productpagina's
async function zyteNav(url) {
  const r = await fetch("https://api.zyte.com/v1/extract", { method: "POST", signal: AbortSignal.timeout(55000),
    headers: { Authorization: "Basic " + Buffer.from(String(process.env.ZYTE_API_KEY).trim() + ":").toString("base64"), "Content-Type": "application/json" },
    body: JSON.stringify({ url, browserHtml: true, geolocation: "BE" }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("zyte " + r.status);
  const h = String(j.browserHtml || ""), basis = new URL(j.url || url);
  const items = [...new Set([...h.matchAll(/href="([^"]*(?:\/producten\/|\/p\/)[^"]*)"/g)].map(m => { try { return new URL(m[1].replace(/&amp;/g, "&"), basis).toString(); } catch { return null; } }).filter(Boolean))].map(u => ({ url: u }));
  return { items, url: j.url || url };
}
/* Hetzelfde product (zelfde EAN) bij de andere winkel zoeken en de prijs teruggeven. */
const ZOEK = { "bol.com": e => `https://www.bol.com/be/nl/s/?searchtext=${e}`, "Dreamland": e => `https://www.dreamland.be/nl/zoeken/producten?q=${e}` };
export async function vergelijkProduct(p) {
  if (!zyteAan() || !p || !/^\d{8,14}$/.test(String(p.artikelnr || ""))) return null;
  const ander = p.winkel === "bol.com" ? "Dreamland" : p.winkel === "Dreamland" ? "bol.com" : null; if (!ander) return null;
  const nav = await zyteNav(ZOEK[ander](p.artikelnr));
  let kand = nav.items.map(x => x.url).filter(u => { try { return winkelVan(new URL(u).hostname) === ander && !/charity|campagne|campaign/i.test(u); } catch { return false; } });
  if (!kand.length) kand = [nav.url];
  for (const u of kand.slice(0, 2)) {
    let q; try { q = await zyteInfo(new URL(u)); } catch { continue; }
    if (q && q.prijs != null && String(q.artikelnr || "") === String(p.artikelnr)) { const e = new URL(q.url || u); e.search = ""; e.hash = "";
      return { url: e.toString(), winkel: ander, naam: q.naam, prijs: q.prijs, foto: q.foto, artikelnr: q.artikelnr, beschikbaar: q.beschikbaar, auto: true, bron: "zyte", gecontroleerd: new Date().toISOString() }; }
  }
  return null;
}
export async function productInfo(url) {
  let u; try { u = new URL(String(url || "").trim()); } catch { throw httpErr(400, "Dit is geen geldige link. Kopieer de link van de productpagina."); }
  if (!/^https?:$/.test(u.protocol)) throw httpErr(400, "Dit is geen geldige link.");
  const winkel = winkelVan(u.hostname);
  if (!winkel) throw httpErr(400, "Kies een product van bol.com of dreamland.be.");
  u.protocol = "https:"; u.hash = ""; u.search = "";
  const basis = { url: u.toString().slice(0, 500), winkel };
  if (winkel === "bol.com" && bolAan()) {
    try { const p = await bolInfo(u); if (p && p.naam && (p.prijs != null || p.beschikbaar === false)) return { ...basis, ...p, prijs: p.prijs, auto: true, bron: "bol-api", gecontroleerd: new Date().toISOString() }; }
    catch (e) { console.error("bol api", e.message); }
  }
  if (zyteAan()) {
    try { const p = await zyteInfo(u); if (p && p.naam && p.prijs != null) { const { url: _u, ...rest } = p; return { ...basis, ...rest, auto: true, bron: "zyte", gecontroleerd: new Date().toISOString() }; } }
    catch (e) { console.error("zyte", e.message); }
  }
  let html = "", status = 0;
  try {
    const r = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(9000), headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "Accept-Language": "nl-BE,nl;q=0.9,en;q=0.6" } });
    status = r.status; if (r.ok) html = (await r.text()).slice(0, 4000000);
    if (r.url && winkelVan(new URL(r.url).hostname)) { const e = new URL(r.url); e.search = ""; e.hash = ""; basis.url = e.toString().slice(0, 500); }
  } catch (e) { status = -1; }
  const p = parseProduct(html);
  if (!p.naam || p.prijs == null) return { ...basis, auto: false, status, naam: p.naam || null, prijs: p.prijs, foto: p.foto || null };
  return { ...basis, ...p, auto: true, status, gecontroleerd: new Date().toISOString() };
}

/* ---------- budget per kind ---------- */
export function kfcInstellingen(c, jaar) { const datum = c.datum || jaar + "-12-19"; return { ...kfMailDef(jaar, datum), ...(c.mail || {}), tot: kfMailDef(jaar, datum).tot, datum }; } // kiezen kan altijd tot 10 dagen voor het feest
export function budgetVan(geb, M) {
  const y = Number(String(geb || "").slice(0, 4)), g = kfGroepen(M.groepen).find(x => y >= x.van && y <= x.tot);
  if (!g) return { budget: null, tekst: "" };
  const m = String(g.tekst).match(/(\d+(?:[.,]\d{1,2})?)\s*(eur|€)/i) || String(g.tekst).match(/^\s*(?:€\s*)?(\d+(?:[.,]\d{1,2})?)/);
  return m ? { budget: Number(m[1].replace(",", ".")), tekst: g.tekst } : { budget: null, voorzien: true, tekst: g.tekst };
}
const lft = (geb, datum) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(geb || ""))) return null; const [y, m, d] = geb.split("-").map(Number), [Y, M, D] = datum.split("-").map(Number); let a = Y - y; if (M < m || (M === m && D < d)) a--; return a; };
const r2 = n => Math.round(n * 100) / 100;

async function laad(sb, id, t) {
  if (!kfcKlopt(String(id || ""), String(t || ""))) throw httpErr(404, "Deze link klopt niet. Gebruik de link uit de bevestigingsmail.");
  const { data: row } = await sb.from("kinderfeest").select("id,data").eq("id", String(id)).maybeSingle();
  if (!row) throw httpErr(404, "Deze inschrijving bestaat niet meer.");
  const c = await configDoc(sb, "kf_" + row.data.jaar), M = kfcInstellingen(c, row.data.jaar);
  return { row, c, M, open: M.cadeau !== false && M.keuze === true && vandaagISO() <= M.tot };
}
function view(row, M, open) {
  const d = row.data;
  return { lid: d.lid || "", jaar: d.jaar, datum: M.datum, tot: M.tot, open, sites: M.sites,
    bijbetalen: bijMag(M), maxExtra: MAX_EXTRA, ...bijStand(d, M),
    kinderen: (d.kinderen || []).map((k, i) => { const b = budgetVan(k.geb, M), a = lft(k.geb, M.datum); return { i, naam: k.naam, leeftijd: a, ...b, cadeau: k.cadeau || null, besteld: !!(k.besteld && k.besteld.op) }; }) };
}
/* ---------- bijbetalen boven het budget (Bancontact) ----------
   Eén pot per gezin: de budgetten van de kinderen tellen samen. Een kind mag over zijn budget gaan als een ander kind eronder blijft.
   Wat het gezin samen boven de pot gaat, betaalt het bij; pas als voor elk kind met een budget gekozen is (cadeau of bon).
   Een bon telt als het volle budget van dat kind. data.bijbetaald = wat al betaald werd; daarna liggen die keuzes vast. */
const MAX_EXTRA = 150;
const bijMag = M => M.bijbetalen !== false;
export function bijStand(d, M) {
  const K = (d.kinderen || []).map(k => ({ k, B: budgetVan(k.geb, M) })).filter(x => x.B.budget != null);
  const gekozen = K.filter(x => x.k.cadeau && (x.k.cadeau.bon || (x.k.cadeau.items || []).length));
  const pot = r2(gekozen.reduce((s, x) => s + x.B.budget, 0)), potAlles = r2(K.reduce((s, x) => s + x.B.budget, 0));
  const besteed = r2(gekozen.reduce((s, x) => s + (x.k.cadeau.bon ? x.B.budget : Number(x.k.cadeau.keuzeTotaal ?? x.k.cadeau.totaal) || 0), 0));
  const extra = r2(Math.max(0, besteed - pot)), bijbetaald = r2(Number(d.bijbetaald) || 0), alles = K.length > 0 && gekozen.length === K.length;
  const b = d.betaling || null;
  return { pot: potAlles, besteed, extraTotaal: extra, bijbetaald, alleGekozen: alles, teBetalen: alles ? r2(Math.max(0, extra - bijbetaald)) : 0, extraVoorlopig: alles ? 0 : extra,
    betaling: b ? { status: b.status, bedrag: b.bedrag } : null };
}
/* ---------- bevestigingsmail naar de ouder ----------
   - zodra voor alle kinderen met een budget gekozen is en er niets (meer) bij te betalen is (ook na een wijziging);
   - na een gelukte bijbetaling met Bancontact (met "betaling ontvangen"). */
export async function kfCadeauMail(sb, id, { betaald = 0 } = {}) {
  try {
    const { smtpConfigured, afzender, verstuur } = await import("./smtp.js");
    if (!smtpConfigured()) return false;
    const { data: row } = await sb.from("kinderfeest").select("id,data").eq("id", String(id)).maybeSingle(); if (!row) return false;
    const d = row.data, aan = String(d.email || "").trim(); if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(aan)) return false;
    const { huisstijl, kaderBlok, tabel, rij, p } = await import("./bevestiging.js");
    const A = await algemeen(sb), M = kfcInstellingen(await configDoc(sb, "kf_" + d.jaar), d.jaar), S = bijStand(d, M);
    let voornaam = String(d.lid || "").split(" ").slice(-1)[0];
    if (d.lidId) { const { data: l } = await sb.from("leden").select("data").eq("id", d.lidId).maybeSingle(); if (l && l.data && l.data.voornaam) voornaam = l.data.voornaam; }
    const e = x => String(x ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const eu = n => "€" + Number(n || 0).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const kids = (d.kinderen || []).map(k => {
      const B = budgetVan(k.geb, M), c = k.cadeau;
      if (B.voorzien || B.budget == null) return kaderBlok(e(k.naam), p("De vriendenkring voorziet een cadeau.", "margin:0"));
      if (c && c.bon) return kaderBlok(e(k.naam), p(`Een bon van bol.com van <b>${eu(B.budget)}</b>.`, "margin:0"));
      if (c && (c.items || []).length) return kaderBlok(e(k.naam), tabel([...c.items.map(it => rij(e(it.winkel || ""), `${e(it.naam || "")} &middot; <b>${eu(it.prijs)}</b>`)), rij("Totaal", `<b>${eu(c.totaal)}</b> (budget ${eu(B.budget)})`)]));
      return "";
    }).join("");
    const nKids = (d.kinderen || []).filter(k => budgetVan(k.geb, M).budget != null).length;
    const pot = nKids > 1 ? p(`Samen ${eu(S.besteed)} van het totale budget van ${eu(S.pot)}.`) : "";
    const bet = betaald > 0 ? kaderBlok("Bijbetaling ontvangen", p(`We ontvingen je betaling van <b>${eu(betaald)}</b> met Bancontact. Bedankt!`, "margin:0"), "#1a7f45", "#f1faf4") : "";
    const vast = (d.kinderen || []).some(k => k.cadeau && k.cadeau.betaald);
    const wijzig = !vast && vandaagISO() <= M.tot ? p(`Wil je nog iets wijzigen? Dat kan tot en met ${e(lang(M.tot))} via <a href="${e(kfcLink(row.id))}">je cadeaupagina</a>.`) : "";
    const html = p(`Beste ${e(voornaam)},`) + p(betaald > 0 ? "Je bijbetaling is in orde: we bestellen de cadeaus die je koos voor het kinderfeest." : "Bedankt! We ontvingen je cadeaukeuze voor het kinderfeest.") + bet + kids + pot + wijzig + p(`Tot op het kinderfeest${M.datum ? " van " + e(lang(M.datum)) : ""}!`);
    const [r] = await verstuur([{ aan, aanNaam: d.lid || "", onderwerp: betaald > 0 ? `VBHA - Bijbetaling ontvangen, cadeaus kinderfeest ${d.jaar}` : `VBHA - Cadeaukeuze kinderfeest ${d.jaar} ontvangen`, html: huisstijl(html, A.vereniging), van: afzender() }]);
    return !!(r && r.ok);
  } catch (x) { console.error("kfCadeauMail", x); return false; }
}
const lang = iso => { const [y, m, d] = String(iso || "").slice(0, 10).split("-").map(Number); return y ? new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : ""; };
// na een gelukte betaling (betaal.js): bedrag bij data.bijbetaald; de gekozen cadeaus liggen vast
export async function kfBijbetaald(sb, id) {
  const { data: row } = await sb.from("kinderfeest").select("id,data").eq("id", String(id)).maybeSingle(); if (!row) return;
  const d = row.data, op = new Date().toISOString(), bedrag = Number(d.betaling && d.betaling.bedrag) || 0;
  const kinderen = (d.kinderen || []).map(k => k.cadeau && !k.cadeau.betaald ? { ...k, cadeau: { ...k.cadeau, betaald: true, betaaldOp: op } } : k);
  const nd = { ...d, kinderen, bijbetaald: r2((Number(d.bijbetaald) || 0) + bedrag) };
  const { configDoc } = await import("./publiek.js"); const M = kfcInstellingen(await configDoc(sb, "kf_" + d.jaar), d.jaar);
  if (!bijStand(nd, M).teBetalen && !(d.cadeau && d.cadeau.doorgegeven)) nd.cadeau = { doorgegeven: true, op, door: "ouder (keuzepagina)" };
  const { error } = await sb.from("kinderfeest").update({ data: nd }).eq("id", row.id); if (error) throw error;
  if (bedrag > 0) await kfCadeauMail(sb, row.id, { betaald: bedrag });
}

/* ---------- openbaar: GET ?cadeau=<id>&t=..  |  POST {cadeau,t,actie:"check"|"bewaar"} ---------- */
export async function kfCadeauPubliek(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const sb = admin();
    if (req.method === "GET") {
      await rateLimit(sb, req, "kfcadeau", 120, 600, httpErr);
      const { row, M, open } = await laad(sb, req.query.cadeau, req.query.t);
      return res.status(200).json(view(row, M, open));
    }
    if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");
    const b = body(req);
    await rateLimit(sb, req, "kfcadeaup", 80, 600, httpErr);
    const { row, M, open } = await laad(sb, b.cadeau, b.t);
    if (b.actie === "check") { const p = await productInfo(b.url); return res.status(200).json(p.auto ? { ...p, sig: tekenProduct(p) } : p); }
    if (b.actie === "betaal" || b.actie === "betaalstatus") {
      const { startBetaling, controleerBetaling } = await import("./betaal.js");
      const { onlineConfigured } = await import("./betaalprovider.js");
      if (b.actie === "betaalstatus") { if (row.data.betaling) await controleerBetaling(sb, "kinderfeest", row); const { data: r2w } = await sb.from("kinderfeest").select("id,data").eq("id", row.id).maybeSingle(); return res.status(200).json(view(r2w, M, open)); }
      if (!onlineConfigured()) throw httpErr(501, "Online betalen is niet ingesteld.");
      const bedrag = bijStand(row.data, M).teBetalen; if (!(bedrag > 0)) throw httpErr(400, "Er is niets bij te betalen.");
      const bt = await startBetaling(sb, req, "kinderfeest", row, { bedrag, jaar: row.data.jaar, terug: `/cadeau?i=${encodeURIComponent(row.id)}&t=${encodeURIComponent(String(b.t))}&betaling=terug` });
      return res.status(200).json({ status: bt.status, checkout: bt.checkout || null, deeplink: bt.deeplink || null, qrcode: bt.qrcode || null, bedrag: bt.bedrag });
    }
    if (b.actie !== "bewaar") throw httpErr(400, "Onbekende actie.");
    if (!open) throw httpErr(403, "Cadeaus kiezen kan niet meer: de termijn is voorbij. Wie niets koos, krijgt een bon van bol.com.");
    const d = row.data, i = Number(b.kind), k = (d.kinderen || [])[i];
    if (!k) throw httpErr(400, "Dit kind staat niet in de inschrijving.");
    if (k.besteld && k.besteld.op) throw httpErr(409, "Het cadeau van " + k.naam + " is al besteld en kan niet meer gewijzigd worden.");
    if (k.cadeau && k.cadeau.betaald) throw httpErr(409, "Voor het cadeau van " + k.naam + " werd al bijbetaald. Wil je iets wijzigen, neem dan contact met ons op.");
    const B = budgetVan(k.geb, M);
    if (B.voorzien || B.budget == null) throw httpErr(400, `Voor ${k.naam} voorziet de vriendenkring het cadeau.`);
    let cadeau;
    if (b.bon) cadeau = { bon: true, op: new Date().toISOString() };
    else {
      const L = (Array.isArray(b.items) ? b.items : []).slice(0, 6);
      if (!L.length) cadeau = null;
      else {
        const items = await Promise.all(L.map(async x => {
          // net gecontroleerd (ondertekend door de server, minder dan een uur oud): niet opnieuw opvragen
          // al bewaard bij dit kind (ongewijzigd): niet opnieuw bij de winkel opvragen
          const oud = k.cadeau && (k.cadeau.items || []).find(o => o.url === (x && x.url) && Number(o.prijs) === Number(x && x.prijs));
          if (oud) return { ...oud, keuzePrijs: oud.keuzePrijs ?? oud.prijs };
          if (x && x.sig && x.auto && kloptProduct(x)) { const p = { ...Object.fromEntries(PVELD.map(k => [k, x[k] ?? null])), auto: true, bron: "zyte" }; if (p.beschikbaar === false) throw httpErr(400, `"${p.naam}" is niet op voorraad. Kies een ander product.`); return p; }
          const p = await productInfo(x && x.url);
          if (p.auto) { if (p.beschikbaar === false) throw httpErr(400, `"${p.naam}" is niet op voorraad. Kies een ander product.`); return p; }
          // de winkel gaf de gegevens niet vrij: naam en prijs van de ouder (niet automatisch gecontroleerd)
          const naam = clean(x.naam || p.naam, 200), prijs = Number(String(x.prijs ?? "").replace(",", "."));
          if (!naam || !(prijs > 0)) throw httpErr(400, "Vul de naam en de prijs van het product in.");
          return { ...p, naam, prijs: r2(prijs), auto: false };
        }));
        for (const x of items) if (x.keuzePrijs == null) x.keuzePrijs = x.prijs;
        const totaal = r2(items.reduce((s, x) => s + x.prijs, 0)), keuzeTotaal = r2(items.reduce((s, x) => s + Number(x.keuzePrijs), 0));
        cadeau = { items, totaal, keuzeTotaal, op: new Date().toISOString() }; // keuzeTotaal: prijs op het moment van kiezen (prijsstijgingen nadien draagt de vriendenkring)
      }
    }
    const kinderen = d.kinderen.map((x, j) => { if (j !== i) return x; const n = { ...x }; if (cadeau) n.cadeau = cadeau; else delete n.cadeau; return n; });
    const nd = { ...d, kinderen };
    // één pot per gezin: enkel wat het gezin samen boven alle budgetten gaat, moet bijbetaald worden
    { const S = bijStand(nd, M), ov = r2(S.besteed - (S.pot > 0 ? S.pot : 0)), eu = n => "€ " + n.toFixed(2).replace(".", ",");
      const nu = r2(Math.max(0, S.besteed - kinderen.reduce((t, x) => { const bb = budgetVan(x.geb, M); return t + (bb.budget != null && x.cadeau ? bb.budget : 0); }, 0)));
      if (ov > 0.004 && !bijMag(M)) throw httpErr(400, `Samen gaan de cadeaus ${eu(ov)} boven het totale budget van ${eu(S.pot)}. Haal iets uit een mandje.`);
      if (ov > MAX_EXTRA) throw httpErr(400, `Samen gaan de cadeaus ${eu(ov)} boven het totale budget van ${eu(S.pot)}. Bijbetalen kan tot ${eu(MAX_EXTRA)}.`);
      if (nu > 0.004 && S.alleGekozen && b.bijbetalen !== true) throw httpErr(400, `Je gaat samen ${eu(nu)} boven het budget. Bevestig dat je dit bijbetaalt.`); }
    if (kinderen.every(x => budgetVan(x.geb, M).budget == null || x.cadeau) && !bijStand(nd, M).teBetalen && !(d.cadeau && d.cadeau.doorgegeven)) nd.cadeau = { doorgegeven: true, op: new Date().toISOString(), door: "ouder (keuzepagina)" };
    const { error } = await sb.from("kinderfeest").update({ data: nd }).eq("id", row.id); if (error) throw error;
    { const S = bijStand(nd, M); if (S.alleGekozen && !S.teBetalen) await kfCadeauMail(sb, row.id); }
    return res.status(200).json(view({ ...row, data: nd }, M, open));
  } catch (e) { sendError(res, e); }
}

/* ---------- app: POST /api/mail?f=kfcadeau {actie:"link"|"controle"} ---------- */
export async function kfCadeauApp(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const { sb } = await requireUser(req, { write: true, functie: "kinderfeest" }), b = body(req);
    if (b.actie === "link") return res.status(200).json({ url: kfcLink(String(b.id || "")) });
    // prijs vergelijken met de andere winkel voor één gekozen product (enkel in het beheer; elke vergelijking kost opvragingen bij Zyte)
    if (b.actie === "vergelijk") {
      const { data: row } = await sb.from("kinderfeest").select("id,data").eq("id", String(b.id || "")).maybeSingle(); if (!row) throw httpErr(404, "Inschrijving niet gevonden.");
      const d = row.data, k = (d.kinderen || [])[Number(b.kind)], it = k && k.cadeau && (k.cadeau.items || [])[Number(b.item)];
      if (!it) throw httpErr(404, "Product niet gevonden.");
      // in één beweging: eigen winkel opnieuw (prijs, voorraad) én de andere winkel (zelfde EAN)
      let alt = null, fout = null, p = null;
      const [r1, r2v] = await Promise.allSettled([productInfo(it.url), it.artikelnr ? vergelijkProduct(it) : Promise.resolve(null)]);
      if (r1.status === "fulfilled") p = r1.value;
      if (r2v.status === "fulfilled") alt = r2v.value; else fout = String((r2v.reason && r2v.reason.message) || r2v.reason);
      const nu = new Date().toISOString();
      let nieuw = { ...it, alt: alt ? { winkel: alt.winkel, url: alt.url, naam: alt.naam, prijs: alt.prijs, op: nu } : { geen: true, op: nu } };
      if (p && p.auto) { nieuw = { ...nieuw, naam: p.naam || it.naam, prijs: p.prijs, levertijd: p.levertijd || null, foto: p.foto || it.foto, beschikbaar: p.beschikbaar, auto: true, gecontroleerd: p.gecontroleerd || nu, vorigePrijs: p.prijs !== it.prijs ? it.prijs : it.vorigePrijs }; delete nieuw.controleMislukt; }
      else nieuw = { ...nieuw, gecontroleerd: nu, controleMislukt: true };
      const kinderen = d.kinderen.map((x, j) => { if (j !== Number(b.kind)) return x; const items = x.cadeau.items.map((y, n) => n === Number(b.item) ? nieuw : y); return { ...x, cadeau: { ...x.cadeau, items, totaal: r2(items.reduce((t, y) => t + (Number(y.prijs) || 0), 0)) } }; });
      const { error } = await sb.from("kinderfeest").update({ data: { ...d, kinderen } }).eq("id", row.id); if (error) throw error;
      return res.status(200).json({ ok: true, item: nieuw, alt: nieuw.alt, fout, gewijzigd: !!(p && p.auto && (p.prijs !== it.prijs || p.beschikbaar !== it.beschikbaar)) });
    }
    if (b.actie === "controle") {
      const A = await algemeen(sb), jaar = Number(b.jaar) || A.jaar;
      const { data: rows, error } = await sb.from("kinderfeest").select("id,data").eq("data->>jaar", String(jaar)); if (error) throw error;
      let n = 0, gewijzigd = 0, weg = 0, mislukt = 0;
      for (const row of rows || []) {
        const d = row.data; let anders = false;
        const kinderen = await Promise.all((d.kinderen || []).map(async k => {
          if (!k.cadeau || !Array.isArray(k.cadeau.items) || (k.besteld && k.besteld.op)) return k;
          const items = await Promise.all(k.cadeau.items.map(async it => {
            n++; let p; try { p = await productInfo(it.url); } catch { mislukt++; return it; }
            if (!p.auto) { mislukt++; return { ...it, gecontroleerd: new Date().toISOString(), controleMislukt: true }; }
            const nw = { ...it, naam: p.naam, prijs: p.prijs, levertijd: p.levertijd || null, foto: p.foto || it.foto, beschikbaar: p.beschikbaar, auto: true, gecontroleerd: p.gecontroleerd, vorigePrijs: p.prijs !== it.prijs ? it.prijs : it.vorigePrijs };
            delete nw.controleMislukt;
            if (p.prijs !== it.prijs || p.beschikbaar !== it.beschikbaar) { gewijzigd++; anders = true; }
            if (p.beschikbaar === false) weg++;
            return nw;
          }));
          anders = true;
          return { ...k, cadeau: { ...k.cadeau, items, totaal: r2(items.reduce((s, x) => s + (Number(x.prijs) || 0), 0)) } };
        }));
        if (anders) { const { error: e2 } = await sb.from("kinderfeest").update({ data: { ...d, kinderen } }).eq("id", row.id); if (e2) throw e2; }
      }
      return res.status(200).json({ ok: true, gecontroleerd: n, gewijzigd, nietBeschikbaar: weg, mislukt });
    }
    // ouders die zich inschreven vóór de cadeaukiezer aan stond: mail met hun persoonlijke keuzelink (via de mailwachtrij)
    if (b.actie === "meld") {
      const A = await algemeen(sb), jaar = Number(b.jaar) || A.jaar, c = await configDoc(sb, "kf_" + jaar), M = kfcInstellingen(c, jaar);
      if (!(M.cadeau !== false && M.keuze === true)) throw httpErr(400, "De cadeaukiezer staat niet aan.");
      if (vandaagISO() > M.tot) throw httpErr(400, "De keuzetermijn is voorbij.");
      const { data: rows, error } = await sb.from("kinderfeest").select("id,data").eq("data->>jaar", String(jaar)); if (error) throw error;
      const sinds = M.keuzeSinds || "9999";
      const L = (rows || []).filter(r => { const d = r.data || {}; const K = (d.kinderen || []).filter(k => budgetVan(k.geb, M).budget != null);
        return K.length && !K.every(k => k.cadeau) && !d.cadeauMeld && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(String(d.email || "").trim()) && String((d.bevestiging && d.bevestiging.op) || d.aangemeld || "") < sinds; });
      if (b.dry) return res.status(200).json({ aantal: L.length, wie: L.map(r => r.data.lid) });
      if (!L.length) return res.status(200).json({ aantal: 0 });
      const { huisstijl, kaderBlok, p } = await import("./bevestiging.js");
      const e = x => String(x ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
      const eu = n => "€" + Number(n || 0).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const tot = lang(M.tot), batch = "kfmeld-" + jaar + "-" + Date.now();
      const knop = u => `<table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 18px"><tr><td bgcolor="#C0161F" style="border-radius:8px"><a href="${e(u)}" style="display:inline-block;padding:12px 22px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px">Cadeau kiezen</a></td></tr></table>`;
      const rijen = [];
      for (const r of L) {
        const d = r.data; let vn = String(d.lid || "").split(" ").slice(-1)[0];
        if (d.lidId) { const { data: l } = await sb.from("leden").select("data").eq("id", d.lidId).maybeSingle(); if (l && l.data && l.data.voornaam) vn = l.data.voornaam; }
        const kids = (d.kinderen || []).map(k => { const B = budgetVan(k.geb, M); return B.budget != null ? `<li style="margin:0 0 4px"><b>${e(k.naam)}</b>: cadeau ter waarde van <b>${eu(B.budget)}</b></li>` : B.voorzien ? `<li style="margin:0 0 4px"><b>${e(k.naam)}</b>: de vriendenkring voorziet een cadeau</li>` : ""; }).join("");
        const html = p(`Beste ${e(vn)},`) + p("Goed nieuws: het cadeau voor je kind(eren) kies je dit jaar gewoon online. Je hoeft niets meer door te mailen.")
          + (kids ? `<ul style="margin:0 0 15px;padding-left:22px">${kids}</ul>` : "")
          + p(`Kies het cadeau <b>tot en met ${e(tot)}</b> via de knop hieronder: plak de link van het product, wij controleren meteen de prijs en de voorraad. Indien je tegen ${e(tot)} geen keuze doorgeeft, krijg je een waardebon van bol.com t.w.v. het bedrag hierboven.`)
          + knop(kfcLink(r.id)) + p("Gaf je je keuze al door per mail? Dan hoef je niets meer te doen.");
        rijen.push({ batch, data: { aan: String(d.email).trim(), aanNaam: d.lid || "", onderwerp: `VBHA - Kies nu online het cadeau voor het kinderfeest ${jaar}`, html: huisstijl(html, A.vereniging), antwoordAan: "info@vbha.be" } });
      }
      const { error: e2 } = await sb.from("mail_wachtrij").insert(rijen); if (e2) throw e2;
      const op = new Date().toISOString();
      for (const r of L) await sb.from("kinderfeest").update({ data: { ...r.data, cadeauMeld: op } }).eq("id", r.id);
      return res.status(200).json({ aantal: rijen.length });
    }
    throw httpErr(400, "Onbekende actie.");
  } catch (e) { sendError(res, e); }
}
