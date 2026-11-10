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
export function kfcInstellingen(c, jaar) { const datum = c.datum || jaar + "-12-19"; return { ...kfMailDef(jaar, datum), ...(c.mail || {}), datum }; }
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
    kinderen: (d.kinderen || []).map((k, i) => { const b = budgetVan(k.geb, M), a = lft(k.geb, M.datum); return { i, naam: k.naam, leeftijd: a, ...b, cadeau: k.cadeau || null, besteld: !!(k.besteld && k.besteld.op) }; }) };
}

/* ---------- openbaar: GET ?cadeau=<id>&t=..  |  POST {cadeau,t,actie:"check"|"bewaar"} ---------- */
export async function kfCadeauPubliek(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const sb = admin();
    if (req.method === "GET" && req.query.probe) { // tijdelijke test van gratis tussendiensten (eenmalige sleutel in de afgeschermde tabel diag_token)
      const { data } = await sb.from("diag_token").select("tot").eq("token", String(req.query.diag || "")).maybeSingle();
      if (!data || Date.parse(data.tot) < Date.now()) throw httpErr(403, "Geen toegang.");
      const url = String(req.query.probe), out = {};
      const kort = t => String(t || "").replace(/\s+/g, " ").slice(0, 300);
      try { const r = await fetch("https://r.jina.ai/" + url, { headers: { "X-Return-Format": "html" }, signal: AbortSignal.timeout(25000) }); const t = await r.text(); out.jina = { status: r.status, lengte: t.length, product: parseProduct(t), begin: kort(t.replace(/<[^>]+>/g, " ")) }; } catch (e) { out.jina = { fout: String(e.message || e) }; }
      try { const r = await fetch("https://r.jina.ai/" + url, { signal: AbortSignal.timeout(25000) }); const t = await r.text(); const pr = (t.match(/€\s?\d+[.,]\d{2}|\d+[.,]\d{2}\s?€/) || [])[0]; out.jinaTekst = { status: r.status, lengte: t.length, prijsGezien: pr || null, begin: kort(t) }; } catch (e) { out.jinaTekst = { fout: String(e.message || e) }; }
      try { const r = await fetch("https://api.microlink.io/?url=" + encodeURIComponent(url), { signal: AbortSignal.timeout(25000) }); const j = await r.json(); out.microlink = { status: r.status, titel: j.data && j.data.title, beschrijving: kort(j.data && j.data.description), fout: j.message || null }; } catch (e) { out.microlink = { fout: String(e.message || e) }; }
      return res.status(200).json(out);
    }
    if (req.method === "GET") {
      await rateLimit(sb, req, "kfcadeau", 120, 600, httpErr);
      const { row, M, open } = await laad(sb, req.query.cadeau, req.query.t);
      return res.status(200).json(view(row, M, open));
    }
    if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");
    const b = body(req);
    await rateLimit(sb, req, "kfcadeaup", 80, 600, httpErr);
    const { row, M, open } = await laad(sb, b.cadeau, b.t);
    if (b.actie === "check") return res.status(200).json(await productInfo(b.url));
    if (b.actie !== "bewaar") throw httpErr(400, "Onbekende actie.");
    if (!open) throw httpErr(403, "Cadeaus kiezen kan niet meer: de termijn is voorbij. Wie niets koos, krijgt een bon van bol.com.");
    const d = row.data, i = Number(b.kind), k = (d.kinderen || [])[i];
    if (!k) throw httpErr(400, "Dit kind staat niet in de inschrijving.");
    if (k.besteld && k.besteld.op) throw httpErr(409, "Het cadeau van " + k.naam + " is al besteld en kan niet meer gewijzigd worden.");
    const B = budgetVan(k.geb, M);
    if (B.voorzien || B.budget == null) throw httpErr(400, `Voor ${k.naam} voorziet de vereniging het cadeau.`);
    let cadeau;
    if (b.bon) cadeau = { bon: true, op: new Date().toISOString() };
    else {
      const L = (Array.isArray(b.items) ? b.items : []).slice(0, 6);
      if (!L.length) cadeau = null;
      else {
        const items = await Promise.all(L.map(async x => {
          const p = await productInfo(x && x.url);
          if (p.auto) { if (p.beschikbaar === false) throw httpErr(400, `"${p.naam}" is niet op voorraad. Kies een ander product.`); return p; }
          // de winkel gaf de gegevens niet vrij: naam en prijs van de ouder (niet automatisch gecontroleerd)
          const naam = clean(x.naam || p.naam, 200), prijs = Number(String(x.prijs ?? "").replace(",", "."));
          if (!naam || !(prijs > 0)) throw httpErr(400, "Vul de naam en de prijs van het product in.");
          return { ...p, naam, prijs: r2(prijs), auto: false };
        }));
        const totaal = r2(items.reduce((s, x) => s + x.prijs, 0));
        if (totaal > B.budget + 0.005) throw httpErr(400, `Samen kosten deze cadeaus € ${totaal.toFixed(2).replace(".", ",")}. Het budget voor ${k.naam} is € ${B.budget.toFixed(2).replace(".", ",")}.`);
        cadeau = { items, totaal, op: new Date().toISOString() };
      }
    }
    const kinderen = d.kinderen.map((x, j) => { if (j !== i) return x; const n = { ...x }; if (cadeau) n.cadeau = cadeau; else delete n.cadeau; return n; });
    const moet = kinderen.filter(x => { const bb = budgetVan(x.geb, M); return bb.budget != null; });
    const nd = { ...d, kinderen };
    if (moet.length && moet.every(x => x.cadeau) && !(d.cadeau && d.cadeau.doorgegeven)) nd.cadeau = { doorgegeven: true, op: new Date().toISOString(), door: "ouder (keuzepagina)" };
    const { error } = await sb.from("kinderfeest").update({ data: nd }).eq("id", row.id); if (error) throw error;
    return res.status(200).json(view({ ...row, data: nd }, M, open));
  } catch (e) { sendError(res, e); }
}

/* ---------- app: POST /api/mail?f=kfcadeau {actie:"link"|"controle"} ---------- */
export async function kfCadeauApp(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const { sb } = await requireUser(req, { write: true, functie: "kinderfeest" }), b = body(req);
    if (b.actie === "link") return res.status(200).json({ url: kfcLink(String(b.id || "")) });
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
    throw httpErr(400, "Onbekende actie.");
  } catch (e) { sendError(res, e); }
}
