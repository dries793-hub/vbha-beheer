import { admin, sendError, httpErr } from "./sb.js";
import crypto from "node:crypto";
import { algemeen, actieveLeden, rateLimit, norm } from "./publiek.js";
import { meldPush } from "./push.js";
import { kloptRonde } from "./lidlink.js";

// Openbare stand van de kalenderronde voor de kaart op /kaart: status en datum per straat (zonder namen).
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=20");
  try {
    // de openbare kaart kan in de app (Kalenders › Kaart) niet actief gezet worden
    const kaartUit = async () => { try { const { data } = await admin().from("config").select("data").eq("id", "kaart").maybeSingle(); return !!(data && data.data && data.data.aan === false); } catch (e) { return false; } };
    if (req.method === "POST" && await kaartUit()) throw httpErr(403, "De kalenderkaart is momenteel niet actief.");
    if (req.method === "POST") { const bb = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : (req.body || {}); if (bb.her) return await herReserveer(req, res, bb, true); return await melding(req, res); }
    if (req.query && req.query.her) return await herReserveer(req, res, req.query, false);
    if (req.method !== "GET") throw httpErr(405, "Gebruik GET");
    if (req.query && req.query.wie) return await wieReserveerde(req, res);
    if (req.query && req.query.dozen) return await dozenVan(req, res);
    if (req.query && req.query.ik) return await wieBenIk(req, res);
    if (req.query && req.query.geojson != null) return await geoJson(req, res);
    const sb = admin();
    let verborgen = [];
    try { const { data: kc } = await sb.from("config").select("data").eq("id", "kaart").maybeSingle(); if (kc?.data?.aan === false) return res.status(200).json({ gesloten: true }); verborgen = Array.isArray(kc?.data?.verborgen) ? kc.data.verborgen.map(String).slice(0, 2000) : []; } catch (e) { /* geen config */ }
    const A = await algemeen(sb);
    const out = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from("ronde").select("data").eq("data->>jaar", String(A.jaar)).range(from, from + 999);
      if (error) throw error;
      for (const r of data) { const d = r.data || {}; if (d.straat) out.push({ s: d.straat, st: d.status === "reserved" ? "r" : "d", at: d.at || "" }); }
      if (data.length < 1000) break;
    }
    const { data: pd } = await sb.from("jaren").select("data").eq("id", String(A.jaar)).maybeSingle();
    // teller: afgewerkte dozen (verdeling) × kalenders per doos, tegenover de stock
    let teller = null;
    try { const per = Number(pd?.data?.perDoos) || 100, stock = Number(pd?.data?.kalenderStock) || 0; let ui = 0;
      for (let from = 0; ; from += 1000) { const { data: J, error: e2 } = await sb.from("jaarleden").select("data").eq("data->>jaar", String(A.jaar)).range(from, from + 999); if (e2) throw e2;
        for (const r of J) ui += (Number(r.data?.kalUitgevoerd) || 0) - (Number(r.data?.kalTerugRest) || 0); if (J.length < 1000) break; }
      if (stock > 0) teller = { bedeeld: Math.round(ui * per), totaal: Math.round(stock * per) }; } catch (e) { /* geen teller */ }
    // meldingen die het bestuur nog moet nakijken (zonder namen): oranje stippellijn op de kaart
    const open = {};
    try {
      const { data: M } = await sb.from("rondemeldingen").select("data").eq("data->>jaar", String(A.jaar)).eq("data->>stand", "open").limit(500);
      for (const r of M || []) { const d = r.data || {}; for (const s of d.straten || []) if (open[s] !== "d") open[s] = d.soort === "done" ? "d" : "r"; }
    } catch (e) { /* tabel niet bereikbaar: geen meldingen tonen */ }
    res.status(200).json({ jaar: A.jaar, perDoos: Number(pd?.data?.perDoos) || 100, straten: out, verborgen, teller, open: Object.entries(open).map(([s, st]) => ({ s, st })), nu: new Date().toISOString() });
  } catch (e) { sendError(res, e); }
}

/* POST /api/ronde  {straten:[id], soort:"r"|"d", lidId, website}
   Een lid meldt straten als gereserveerd of gedaan. Dat komt NIET meteen op de kaart: het bestuur controleert eerst
   (tabel rondemeldingen, stand "open"); pas na goedkeuring in de app worden de straten aangeduid. */
async function melding(req, res) {
  res.setHeader("Cache-Control", "no-store");
  let b = req.body || {}; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  if (b.website) return res.status(200).json({ ok: true }); // honeypot
  const sb = admin();
  await rateLimit(sb, req, "rondemelding", 60, 3600, httpErr); // ruim: leden melden vaak veel straten na elkaar, soms via hetzelfde netwerk
  const straten = [...new Set((Array.isArray(b.straten) ? b.straten : []).map(String).filter(s => /^[\w.~-]{1,80}$/.test(s)))].slice(0, 60);
  if (!straten.length) throw httpErr(400, "Kies minstens één straat.");
  const soort = b.soort === "d" ? "done" : b.soort === "r" ? "reserved" : null;
  if (!soort) throw httpErr(400, "Kies gereserveerd of gedaan.");
  const A = await algemeen(sb);
  const lid = (await actieveLeden(sb, A.jaar)).find(l => l.id === String(b.lidId || ""));
  if (!lid) throw httpErr(400, "Kies je naam uit de ledenlijst.");
  // al bedeelde straten kunnen niet meer gemeld worden; gereserveerde enkel nog als bedeeld
  { const st = {}, W = new Set(straten);
    for (let from = 0; ; from += 1000) {
      const { data: cur, error: e0 } = await sb.from("ronde").select("data").eq("data->>jaar", String(A.jaar)).range(from, from + 999);
      if (e0) throw e0;
      for (const r of cur) { const d = r.data || {}; if (d.straat && W.has(d.straat)) st[d.straat] = d.status === "reserved" ? "r" : "d"; }
      if (cur.length < 1000) break;
    }
    if (straten.some(s => st[s] === "d")) throw httpErr(400, "Een of meer straten zijn al bedeeld. Haal ze uit je selectie.");
    if (soort === "reserved" && straten.some(s => st[s] === "r")) throw httpErr(400, "Een of meer straten zijn al gereserveerd. Die kan je enkel nog als bedeeld doorgeven."); }
  // bij "bedeeld": hoeveel dozen het lid nog heeft, of hoeveel er afgewerkt zijn, en of er nog dozen nodig zijn
  const dozen = soort === "done" ? schoonDozen(b.dozen) : null;
  if (soort === "done" && b.dozen && !dozen) throw httpErr(400, "Beantwoord de vragen over je dozen.");
  if (dozen) dozen.opBij = await opVan(sb, A.jaar, lid.id);
  if (dozen && !(dozen.opBij > 0)) throw httpErr(400, "Volgens onze lijst heb je geen dozen. Neem contact op met het bestuur.");
  const id = "m" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
  const toon = lid.voornaam && lid.an ? `${lid.voornaam} ${lid.an}` : lid.naam;
  const { error } = await sb.from("rondemeldingen").insert({ id, data: { jaar: A.jaar, straten, soort, lidId: lid.id, naam: lid.naam, toon, op: new Date().toISOString(), stand: "open", ...(dozen ? { dozen } : {}) } });
  if (error) throw error;
  try { await meldPush(sb, "admin", { lidId: lid.id, titel: "Kalenderronde: melding te controleren", tekst: `${toon} meldt ${straten.length} ${straten.length === 1 ? "straat" : "straten"} als ${soort === "done" ? "gedaan" : "gereserveerd"}` + (dozen && dozen.nodig ? ` · heeft nog ${dozen.nodigN ? dozen.nodigN + " " : ""}dozen nodig` : ""), url: "/#ronde", tag: "ronde-" + lid.id }); } catch (e) {}
  return res.status(200).json({ ok: true });
}

/* GET /api/ronde?wie=straat1,straat2: wie reserveerde deze straten (om bij "bedeeld" de naam al in te vullen).
   Geeft enkel id en naam van het lid terug, zoals de naamsuggesties in het meldvenster. */
async function wieReserveerde(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const W = new Set(String(req.query.wie).split(",").map(s => s.trim()).filter(s => /^[\w.~-]{1,80}$/.test(s)).slice(0, 60));
  if (!W.size) return res.status(200).json([]);
  const sb = admin(); await rateLimit(sb, req, "rondewie", 60, 600, httpErr);
  const A = await algemeen(sb), rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("ronde").select("data").eq("data->>jaar", String(A.jaar)).range(from, from + 999);
    if (error) throw error;
    for (const r of data) { const d = r.data || {}; if (d.straat && W.has(d.straat) && d.status === "reserved") rows.push(d); }
    if (data.length < 1000) break;
  }
  if (!rows.length) return res.status(200).json([]);
  const L = await actieveLeden(sb, A.jaar), out = [], gezien = new Set();
  const nm = x => norm(x).replace(/\s+/g, " ");
  for (const d of rows) {
    const l = (d.lidId && L.find(x => x.id === d.lidId)) || (d.by && L.find(x => nm(x.naam) === nm(d.by) || nm(x.voornaam + " " + x.an) === nm(d.by)));
    if (!l || gezien.has(l.id)) continue; gezien.add(l.id);
    out.push({ id: l.id, toon: l.voornaam && l.an ? `${l.voornaam} ${l.an}` : l.naam, naam: l.naam });
  }
  res.status(200).json(out);
}

/* Persoonlijke link uit de mail "jouw straten opnieuw reserveren": /kaart?l=<lidId>&j=<jaar>&t=<handtekening>
   GET  /api/ronde?her=1&l&j&t  -> de straten die dit lid vorig jaar (j-1) bedeelde, met per straat of ze dit jaar nog vrij is
   POST /api/ronde {her:1,l,j,t} -> de vrije straten meteen reserveren op naam van het lid (de link is persoonlijk, dus geen controle door het bestuur nodig) */
async function rondeRijen(sb, jaar) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("ronde").select("data").eq("data->>jaar", String(jaar)).range(from, from + 999);
    if (error) throw error; for (const r of data) if (r.data && r.data.straat) out.push(r.data);
    if (data.length < 1000) break;
  }
  return out;
}
async function herReserveer(req, res, b, doe) {
  res.setHeader("Cache-Control", "no-store");
  const sb = admin(); await rateLimit(sb, req, "rondeher", 30, 3600, httpErr);
  const l = String(b.l || ""), j = Number(b.j);
  if (!kloptRonde(l, j, String(b.t || ""))) throw httpErr(400, "Deze link is niet (meer) geldig.");
  const A = await algemeen(sb);
  const { data: cfgA } = await sb.from("config").select("data").eq("id", "algemeen").maybeSingle();
  if (!(cfgA && cfgA.data && cfgA.data.kalVorig && cfgA.data.kalVorig.aan === true)) throw httpErr(400, "Straten van vorig jaar opnieuw reserveren kan op dit moment niet. Kies je straten gewoon op de kaart.");
  if (Number(A.jaar) !== j) throw httpErr(400, "Deze link was voor de kalenderronde van " + j + " en is niet meer geldig.");
  const { data: row } = await sb.from("leden").select("data").eq("id", l).maybeSingle();
  if (!row) throw httpErr(404, "Dit lid werd niet gevonden.");
  const L = row.data || {}, toon = [L.voornaam, L.naam].filter(Boolean).join(" ");
  const nm = x => norm(x).replace(/\s+/g, " "), namen = [nm(`${L.voornaam || ""} ${L.naam || ""}`), nm(`${L.naam || ""} ${L.voornaam || ""}`)];
  const isMijn = d => [{ lidId: d.lidId, by: d.by }, ...(Array.isArray(d.mee) ? d.mee : [])].some(w => w && (w.lidId ? w.lidId === l : w.by && namen.includes(nm(w.by))));
  const vorigRijen = (await rondeRijen(sb, j - 1)).filter(d => d.status === "done" && isMijn(d));
  const vorig = [...new Set(vorigRijen.map(d => d.straat))];
  const nu = await rondeRijen(sb, j), bezet = new Set(nu.map(d => d.straat));
  const vrij = s => { if (bezet.has(s)) return false; const sid = s.split("~")[0]; if (s.includes("~")) return !bezet.has(sid); for (const x of bezet) if (x.startsWith(s + "~")) return false; return true; };
  const mijn = new Set(nu.filter(isMijn).map(d => d.straat));
  if (!doe) { const { data: jr } = await sb.from("jaren").select("data").eq("id", String(j)).maybeSingle(); const tg = String(jr?.data?.kalTegen || "");
    return res.status(200).json({ voornaam: L.voornaam || "", jaar: j, tegen: /^\d{4}-\d{2}-\d{2}$/.test(tg) ? tg : "", straten: vorig.map(s => ({ s, st: mijn.has(s) ? "mijn" : vrij(s) ? "vrij" : "bezet" })) }); }
  const nieuw = vorig.filter(vrij), at = new Date().toISOString();
  if (nieuw.length) {
    const { error } = await sb.from("ronde").upsert(nieuw.map(s => ({ id: j + "_" + s, data: { jaar: j, straat: s, status: "reserved", by: toon, lidId: l, ...(() => { const r = vorigRijen.find(d => d.straat === s) || {}; const m = [{ lidId: r.lidId || null, by: r.by }, ...(Array.isArray(r.mee) ? r.mee : [])].filter(w => w && w.by && !(w.lidId ? w.lidId === l : namen.includes(nm(w.by)))); return m.length ? { mee: m } : {}; })(), at, ...(s.includes("~") ? { deel: true } : {}), via: "mail vorig jaar" } })));
    if (error) throw error;
    try { await meldPush(sb, "admin", { lidId: l, titel: "Kalenderronde: straten opnieuw gereserveerd", tekst: `${toon} reserveerde ${nieuw.length} ${nieuw.length === 1 ? "straat" : "straten"} van vorig jaar`, url: "/#ronde", tag: "ronde-" + l }); } catch (e) {}
  }
  return res.status(200).json({ ok: true, gereserveerd: nieuw });
}

/* dozen van een lid in de verdeling van dit jaar (kalOpgehaald = dozen die het lid nu in handen heeft) */
async function opVan(sb, jaar, lidId) {
  const { data } = await sb.from("jaarleden").select("data").eq("data->>lidId", lidId).eq("data->>jaar", String(jaar)).limit(1);
  const d = data && data[0] && data[0].data; return Math.max(0, Math.round((Number(d && d.kalOpgehaald) || 0) * 4) / 4);
}
/* GET /api/ronde?dozen=<lidId>: hoeveel dozen dit lid volgens de verdeling nog in handen heeft (voor de vragen bij "bedeeld") */
async function dozenVan(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const sb = admin(); await rateLimit(sb, req, "rondedozen", 60, 600, httpErr);
  const id = String(req.query.dozen || "").slice(0, 80);
  const A = await algemeen(sb);
  if (!(await actieveLeden(sb, A.jaar)).some(l => l.id === id)) return res.status(200).json({ op: 0 });
  // straat per straat melden: wat het lid bij zijn vorige melding (nog niet verwerkt, laatste 12 uur) nog over had
  let vorige = null;
  try {
    const { data: M } = await sb.from("rondemeldingen").select("data").eq("data->>lidId", id).eq("data->>stand", "open").gte("data->>op", new Date(Date.now() - 12 * 3600e3).toISOString()).order("data->>op", { ascending: false }).limit(1);
    const dz = M && M[0] && M[0].data && M[0].data.dozen; if (dz && dz.over === true && Number(dz.rest) > 0) vorige = { rest: Number(dz.rest), op: M[0].data.op };
  } catch (e) { }
  return res.status(200).json({ op: await opVan(sb, A.jaar, id), vorige });
}
/* antwoorden nakijken: kwarten van een doos, binnen redelijke grenzen */
function schoonDozen(x) {
  if (!x || typeof x !== "object") return null;
  const kw = v => { const n = Math.round(Number(v) * 4) / 4; return n > 0 && n <= 200 ? n : null; };
  const o = { opBij: Math.max(0, Math.round((Number(x.opBij) || 0) * 4) / 4) };
  if (x.over === true) { o.over = true; o.rest = kw(x.rest); if (!o.rest) return null; }
  else if (x.over === false) { o.over = false; if (x.af === "alle") o.af = "alle"; else { o.af = kw(x.af); if (!o.af) return null; } }
  else if (!(o.opBij > 0)) { /* geen dozen in de verdeling: enkel de vraag of er dozen nodig zijn */ }
  else return null;
  // "nog dozen nodig?" (enkel als alle dozen op zijn): na goedkeuring "nog mee te geven" in de verdeling
  if (o.over !== true && (o.af === "alle" || !(o.opBij > 0))) {
    if (x.nodig === true) { o.nodig = true; const n = Math.round(Number(x.nodigN)); o.nodigN = n >= 1 && n <= 50 ? n : null; }
    else if (x.nodig === false) o.nodig = false;
  }
  return o;
}

/* GET /api/ronde?ik=1&l&j&t: persoonlijke link uit de mail -> wie dit is, zodat de naam bij melden al ingevuld staat */
async function wieBenIk(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const l = String(req.query.l || ""), j = Number(req.query.j);
  if (!kloptRonde(l, j, String(req.query.t || ""))) return res.status(200).json({});
  const sb = admin(); await rateLimit(sb, req, "rondeik", 60, 600, httpErr);
  const A = await algemeen(sb), lid = (await actieveLeden(sb, A.jaar)).find(x => x.id === l);
  if (!lid) return res.status(200).json({});
  return res.status(200).json({ id: lid.id, naam: lid.naam, toon: lid.voornaam && lid.an ? `${lid.voornaam} ${lid.an}` : lid.naam });
}

/* GeoJSON van de gereserveerde en bedeelde straten (zonder namen van personen), bv. als laag met "externe gegevens" in uMap.
   Kleuren via properties._umap_options. Een deel van een straat ("straat~n") toont enkel dat stuk (zelfde opdeling als de kaart). */
let KRL = null, KRD = null;
// verborgen lijnstukken (sleutel "straat@lat,lng>lat,lng"): lijnen die volledig op zo'n stuk liggen, weglaten
const sleutel = (sid, p) => sid + "@" + [p[0], p[p.length - 1]].map(q => q[1].toFixed(5) + "," + q[0].toFixed(5)).sort().join(">");
function zonderVerborgen(sid, C, VB) {
  const KN = [...VB].filter(k => k.startsWith(sid + "#")).map(k => k.slice(sid.length + 1).split(",").map(Number)).filter(c => isFinite(c[0]) && isFinite(c[1]));
  if (KN.length) { const bij = q => KN.some(c => Math.hypot((q[1] - c[0]) * 111320, (q[0] - c[1]) * 111320 * Math.cos(c[0] * Math.PI / 180)) < (c[2] || 8));
    C = C.map(p => { const q = p.filter(x => !bij(x)); return q.length >= 2 ? q : p; }); }
  const K = [...VB].filter(k => k.startsWith(sid + "@")); if (!K.length) return C;
  const W = new Set(K), weg = (KRL[sid] || []).map(decodeer).filter(p => p.length > 1 && W.has(sleutel(sid, p)));
  if (!weg.length) return C;
  const m = q => [q[1] * 111320, q[0] * 111320 * Math.cos(q[1] * Math.PI / 180)];
  const afst = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
  const W2 = weg.map(p => p.map(m)), dicht = q => W2.some(w => w.some((a, i) => i && afst(q, w[i - 1], a) < 4));
  return C.filter(p => !p.map(m).every(dicht));
}
function decodeer(str) { const pts = []; let i = 0, lat = 0, lng = 0;
  while (i < str.length) { for (const k of [0, 1]) { let b, sh = 0, r = 0; do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20 && i <= str.length);
      const d = r & 1 ? ~(r >> 1) : r >> 1; if (k === 0) lat += d; else lng += d; }
    pts.push([lng / 1e5, lat / 1e5]); }
  return pts; }
const mooi = id => { const [s, dg] = String(id).split("--"); const n = s.replace(/-/g, " ").replace(/^./, c => c.toUpperCase()); return dg ? `${n} (${dg.replace(/-/g, " ").replace(/^./, c => c.toUpperCase())})` : n; };
async function geoJson(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Cache-Control", "public, max-age=60");
  if (!KRL) KRL = (await import("./kr_lijnen.js")).default;
  if (!KRD) KRD = (await import("./kr_delen.js")).default;
  const sb = admin(), A = await algemeen(sb), feats = [];
  let VB = new Set(); try { const { data: kc } = await sb.from("config").select("data").eq("id", "kaart").maybeSingle(); VB = new Set((kc?.data?.verborgen || []).map(String)); } catch (e) { }
  const KL = { done: "#18794A", reserved: "#2F6FE4" }; // zelfde kleuren als de kaart in de app (bedeeld groen, gereserveerd blauw)
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("ronde").select("data").eq("data->>jaar", String(A.jaar)).range(from, from + 999);
    if (error) throw error;
    for (const r of data) { const d = r.data || {}; if (!d.straat) continue; const sid = String(d.straat); if (VB.has(sid) || VB.has(sid.split("~")[0])) continue; const id = sid.split("~")[0], deel = sid.includes("~");
      const L = deel ? KRD[sid] : KRL[id]; if (!L || !L.length) continue; const st = d.status === "done" ? "done" : "reserved";
      const C = zonderVerborgen(id, L.map(decodeer), VB); if (!C.length) continue;
      feats.push({ type: "Feature", geometry: { type: "MultiLineString", coordinates: C },
        properties: { name: mooi(id) + (deel ? ` (stuk ${Number(sid.split("~")[1]) + 1})` : ""), status: st === "done" ? "bedeeld" : "gereserveerd", sinds: String(d.at || "").slice(0, 10),
          _umap_options: { color: KL[st], weight: 5, opacity: 0.9 } } }); }
    if (data.length < 1000) break;
  }
  res.status(200).json({ type: "FeatureCollection", features: feats });
}
