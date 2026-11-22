import { admin, sendError, httpErr } from "./sb.js";
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
    if (req.method === "POST") { const bb = typeof req.body === "string" ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : (req.body || {}); if (bb.her) return await herReserveer(req, res, bb, true); if (bb.actie === "vrijgeven") return await vrijgeven(req, res, bb); if (bb.actie === "meld" || bb.soort === "d") return await meld(req, res, bb); return await reserveer(req, res, bb); }
    if (req.query && req.query.her) return await herReserveer(req, res, req.query, false);
    if (req.method !== "GET") throw httpErr(405, "Gebruik GET");
    if (req.query && req.query.wie) return await wieReserveerde(req, res);
    if (req.query && req.query.dozen) return await dozenVan(req, res);
    if (req.query && req.query.ik) return await wieBenIk(req, res);
    if (req.query && req.query.mijn != null) return await mijnStraten(req, res);
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
    // teller: afgewerkte dozen (verdeling) + dozen van nog te controleren bedelingen, × kalenders per doos, tegenover de stock
    let teller = null;
    try { teller = await tellerVan(sb, A.jaar, pd); } catch (e) { /* geen teller */ }
    // meldingen die het bestuur nog moet nakijken (zonder namen): oranje stippellijn op de kaart
    const open = {};
    try {
      const { data: M } = await sb.from("rondemeldingen").select("data").eq("data->>jaar", String(A.jaar)).eq("data->>stand", "open").limit(500);
      for (const r of M || []) { const d = r.data || {}; for (const s of d.straten || []) if (open[s] !== "d") open[s] = d.soort === "done" ? "d" : "r"; }
    } catch (e) { /* tabel niet bereikbaar: geen meldingen tonen */ }
    res.status(200).json({ jaar: A.jaar, perDoos: Number(pd?.data?.perDoos) || 100, straten: out, verborgen, teller, open: Object.entries(open).map(([s, st]) => ({ s, st })), nu: new Date().toISOString() });
  } catch (e) { sendError(res, e); }
}

/* ---------- Reserveren en bedeling melden (rechtstreeks, zonder goedkeuring vooraf) ----------
   Wie: persoonlijke link (l, j, t: handtekening klopt) -> bron "personal_link"; anders een gekozen naam uit de ledenlijst
   (lidId) -> bron "manual_member_selection". Dat is identificatie, geen aanmelding: het geeft nooit toegang tot beheer of gegevens.
   De databasefuncties (supabase/ronde-controle.sql) doen alles in één transactie, na elkaar per jaar (geen dubbele reservaties). */
let KRA = null; // aantal adressen per straat en per stuk (gegenereerd uit de kaart)
const adressenVan = async straten => { if (!KRA) KRA = (await import("./kr_adressen.js")).default; return straten.map(s => KRA[s]); };
const schoonStraten = x => [...new Set((Array.isArray(x) ? x : []).map(String).filter(s => /^[\w.~-]{1,80}$/.test(s)))].slice(0, 60);
const toonVan = l => l.voornaam && l.an ? `${l.voornaam} ${l.an}` : l.naam;
async function wie(sb, A, b) {
  const L = await actieveLeden(sb, A.jaar);
  if (b.l && b.t) {
    if (!kloptRonde(String(b.l), Number(b.j), String(b.t)) || Number(b.j) !== Number(A.jaar)) throw httpErr(400, "Deze persoonlijke link is niet (meer) geldig. Kies je naam.");
    const lid = L.find(x => x.id === String(b.l)); if (!lid) throw httpErr(400, "Dit lid staat niet (meer) op de ledenlijst van dit jaar.");
    return { lid, bron: "personal_link" };
  }
  const lid = L.find(x => x.id === String(b.lidId || ""));
  if (!lid) throw httpErr(400, "Kies eerst je naam uit de ledenlijst.");
  return { lid, bron: "manual_member_selection" };
}
async function tellerVan(sb, jaar, pd) {
  // teller in dozen, zoals altijd: afgewerkte dozen in de verdeling (jaarleden) + dozen uit bedelingen die het bestuur nog moet
  // nakijken (die tellen meteen mee). Na controle gaan de dozen in de verdeling en valt de voorlopige bijdrage weg: nooit dubbel.
  if (pd === undefined) { const { data } = await sb.from("jaren").select("data").eq("id", String(jaar)).maybeSingle(); pd = data; }
  const per = Number(pd?.data?.perDoos) || 100, stock = Number(pd?.data?.kalenderStock) || 0;
  let ui = 0;
  for (let from = 0; ; from += 1000) { const { data: J, error: e2 } = await sb.from("jaarleden").select("data").eq("data->>jaar", String(jaar)).range(from, from + 999); if (e2) throw e2;
    for (const r of J) ui += (Number(r.data?.kalUitgevoerd) || 0) - (Number(r.data?.kalTerugRest) || 0); if (J.length < 1000) break; }
  const { data: t, error } = await sb.rpc("ronde_teller", { p_jaar: Number(jaar) }); if (error) throw error;
  const voorl = Number(t?.voorlopig) || 0;
  if (!(stock > 0)) return null;
  return { bedeeld: Math.round((ui + voorl) * per), totaal: Math.round(stock * per), teControleren: Number(t?.teControleren) || 0 };
}
const naamVan = s => { const [id, n] = String(s).split("~"); const [st, dg] = id.split("--"); const t = st.replace(/-/g, " ").replace(/^./, c => c.toUpperCase()); return (dg ? `${t} (${dg.replace(/-/g, " ").replace(/^./, c => c.toUpperCase())})` : t) + (n != null ? ` (stuk ${Number(n) + 1})` : ""); };
const conflictTekst = C => { const n = C.map(c => naamVan(c.s)); return (n.length === 1 ? `${n[0]} is` : `${n.slice(0, -1).join(", ")} en ${n[n.length - 1]} zijn`) + " niet meer beschikbaar."; };
function conflictFout(C, straten) {
  const bezet = new Set(), base = s => s.split("~")[0];
  for (const c of C) for (const s of straten) if (s === c.s || base(s) === c.s || base(c.s) === s) bezet.add(s);
  const e = httpErr(409, conflictTekst(C) + " Er werd niets bewaard; bevestig de andere straten opnieuw."); e.extra = { conflict: [...bezet], vrij: straten.filter(s => !bezet.has(s)) }; return e;
}
const stuur = (res, e) => { if (e && e.extra) return res.status(e.status).json({ error: e.message, ...e.extra }); throw e; };

/* POST /api/ronde {actie:"reserveer", straten, lidId | l,j,t} */
async function reserveer(req, res, b) {
  res.setHeader("Cache-Control", "no-store");
  if (b.website) return res.status(200).json({ ok: true }); // honeypot
  const sb = admin(); await rateLimit(sb, req, "rondereserveer", 60, 3600, httpErr);
  const straten = schoonStraten(b.straten); if (!straten.length) throw httpErr(400, "Kies minstens één straat.");
  const A = await algemeen(sb), { lid, bron } = await wie(sb, A, b);
  const adr = await adressenVan(straten); if (adr.some(a => a == null)) throw httpErr(400, "Een of meer straten bestaan niet op de kaart.");
  const { data: r, error } = await sb.rpc("ronde_reserveer", { p_jaar: Number(A.jaar), p_straten: straten, p_lid: lid.id, p_by: [lid.voornaam, lid.an].filter(Boolean).join(" ") || lid.naam, p_bron: bron });
  if (error) throw error;
  if (r && r.fout === "dubbel") throw httpErr(400, "Je koos een straat én een stuk van diezelfde straat. Kies één van beide.");
  if (r && r.conflict) return stuur(res, conflictFout(r.conflict, straten));
  try { await meldPush(sb, "admin", { lidId: lid.id, titel: "Kalenderronde: nieuwe reservatie", tekst: `${toonVan(lid)} reserveerde ${straten.length} ${straten.length === 1 ? "straat" : "straten"}`, url: "/#ronde", tag: "ronde-" + lid.id }); } catch (e) {}
  return res.status(200).json({ ok: true, straten, adressen: adr.reduce((t, a) => t + a, 0), at: r.at });
}

/* POST /api/ronde {actie:"vrijgeven", straten, lidId | l,j,t}: eigen reservatie aanpassen (nog niet gemelde straten terug vrij) */
async function vrijgeven(req, res, b) {
  res.setHeader("Cache-Control", "no-store");
  const sb = admin(); await rateLimit(sb, req, "rondevrij", 60, 3600, httpErr);
  const straten = schoonStraten(b.straten); if (!straten.length) throw httpErr(400, "Kies minstens één straat.");
  const A = await algemeen(sb), { lid } = await wie(sb, A, b);
  const { data: r, error } = await sb.rpc("ronde_vrijgeven", { p_jaar: Number(A.jaar), p_straten: straten, p_lid: lid.id });
  if (error) throw error;
  return res.status(200).json({ ok: true, vrij: r.vrij || [] });
}

/* POST /api/ronde {actie:"meld", key, straten, aantal, dozen, lidId | l,j,t}
   Telt meteen mee in de teller (controle "pending"); het bestuur controleert nadien. key = unieke id van deze melding (vanuit de
   browser, één per melding): dezelfde melding twee keer versturen (dubbelklik, opnieuw proberen) telt nooit twee keer. */
async function meld(req, res, b) {
  res.setHeader("Cache-Control", "no-store");
  if (b.website) return res.status(200).json({ ok: true });
  const sb = admin(); await rateLimit(sb, req, "rondemelding", 60, 3600, httpErr);
  const straten = schoonStraten(b.straten); if (!straten.length) throw httpErr(400, "Kies minstens één straat.");
  const key = String(b.key || ""); if (!/^k[0-9a-z]{12,40}$/.test(key)) throw httpErr(400, "Ongeldige melding. Laad de pagina opnieuw.");
  const A = await algemeen(sb), { lid, bron } = await wie(sb, A, b);
  const adr = await adressenVan(straten); if (adr.some(a => a == null)) throw httpErr(400, "Een of meer straten bestaan niet op de kaart.");
  const adressen = adr.reduce((t, a) => t + a, 0);
  // we werken met dozen: het aantal afgewerkte dozen volgt uit de antwoorden over de dozen en de verdeling (dozen in handen)
  const dozen = schoonDozen(b.dozen);
  if (!dozen) throw httpErr(400, "Beantwoord de vragen over je dozen.");
  dozen.opBij = await opVan(sb, A.jaar, lid.id);
  if (!(dozen.opBij > 0)) throw httpErr(400, "Volgens onze lijst heb je geen dozen. Neem contact op met het bestuur.");
  const aantal = Math.round(Math.max(0, dozen.over === true ? dozen.opBij - (dozen.rest || 0) : dozen.af === "alle" ? dozen.opBij : Math.min(Number(dozen.af) || 0, dozen.opBij)) * 4) / 4;
  const { data: r, error } = await sb.rpc("ronde_meld", { p_id: key, p_jaar: Number(A.jaar), p_straten: straten, p_lid: lid.id, p_naam: lid.naam, p_toon: toonVan(lid),
    p_by: [lid.voornaam, lid.an].filter(Boolean).join(" ") || lid.naam, p_bron: bron, p_gemeld: aantal, p_adressen: adressen, p_dozen: dozen });
  if (error) { if (/id al gebruikt/.test(error.message || "")) throw httpErr(409, "Deze melding werd al verstuurd."); throw error; }
  if (r && r.fout === "dubbel") throw httpErr(400, "Je koos een straat én een stuk van diezelfde straat. Kies één van beide.");
  if (r && r.conflict) return stuur(res, conflictFout(r.conflict, straten));
  if (!r.al) try { await meldPush(sb, "admin", { lidId: lid.id, titel: "Kalenderronde: bedeling te controleren", tekst: `${toonVan(lid)} meldt ${aantal} ${aantal === 1 ? "doos" : "dozen"} bedeeld in ${straten.length} ${straten.length === 1 ? "straat" : "straten"}` + (dozen && dozen.nodig ? ` · heeft nog ${dozen.nodigN ? dozen.nodigN + " " : ""}dozen nodig` : ""), url: "/#ronde", tag: "ronde-" + lid.id }); } catch (e) {}
  const m = r.melding || {};
  return res.status(200).json({ ok: true, al: !!r.al, id: key, gemeld: Number(m.gemeld) || 0, straten: m.straten || straten, controle: m.controle, teller: await tellerVan(sb, A.jaar) });
}

/* GET /api/ronde?mijn=<lidId> (of &l&j&t): "Mijn straten" — te doen (gereserveerd), gemeld (wacht op controle), afgewerkt.
   Enkel straten en aantallen van dit lid; geen namen van bestuursleden. */
async function mijnStraten(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const sb = admin(); await rateLimit(sb, req, "rondemijn", 120, 600, httpErr);
  const A = await algemeen(sb), q = req.query;
  const { lid } = await wie(sb, A, q.l ? { l: q.l, j: q.j, t: q.t } : { lidId: q.mijn });
  const rijen = await rondeRijen(sb, A.jaar);
  const doen = rijen.filter(d => d.status === "reserved" && d.lidId === lid.id).map(d => ({ s: d.straat, at: d.at || "" }));
  const { data: M, error } = await sb.from("rondemeldingen").select("id,data").eq("data->>jaar", String(A.jaar)).eq("data->>lidId", lid.id).eq("data->>soort", "done").limit(500);
  if (error) throw error;
  const meld = (M || []).filter(r => r.data && r.data.controle).map(r => { const d = r.data; return { id: r.id, straten: d.straten || [], op: d.op, gemeld: d.gemeld, bevestigd: d.bevestigd ?? null, controle: d.controle }; })
    .sort((a, b) => String(b.op).localeCompare(String(a.op)));
  return res.status(200).json({ id: lid.id, voornaam: lid.voornaam || "", toon: toonVan(lid), teDoen: doen, gemeld: meld.filter(m => m.controle === "pending"),
    afgewerkt: meld.filter(m => m.controle === "confirmed" || m.controle === "adjusted"), afgewezen: meld.filter(m => m.controle === "rejected") });
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
  let nieuw = vorig.filter(vrij);
  if (nieuw.length) {
    // zelfde databasefunctie als gewoon reserveren (na elkaar, alles of niets); wat intussen bezet raakte, valt weg
    const by = [L.voornaam, L.naam].filter(Boolean).join(" ");
    for (let poging = 0; poging < 2 && nieuw.length; poging++) {
      const { data: r, error } = await sb.rpc("ronde_reserveer", { p_jaar: j, p_straten: nieuw, p_lid: l, p_by: by, p_bron: "personal_link" });
      if (error) throw error;
      if (r && r.ok) break;
      const weg = new Set((r && r.conflict || []).map(c => c.s)); nieuw = nieuw.filter(s => !weg.has(s) && !weg.has(s.split("~")[0]) && ![...weg].some(w => w.split("~")[0] === s));
      if (poging === 1) nieuw = [];
    }
    // wie vorig jaar mee bedeelde, ook nu mee vermelden (enkel extra info bij de reservatie)
    for (const s of nieuw) { const r = vorigRijen.find(d => d.straat === s) || {}; const m = [{ lidId: r.lidId || null, by: r.by }, ...(Array.isArray(r.mee) ? r.mee : [])].filter(w => w && w.by && !(w.lidId ? w.lidId === l : namen.includes(nm(w.by))));
      try { const { data: cur } = await sb.from("ronde").select("data").eq("id", j + "_" + s).maybeSingle(); if (cur && cur.data && cur.data.lidId === l && cur.data.status === "reserved") await sb.from("ronde").update({ data: { ...cur.data, via: "mail vorig jaar", ...(m.length ? { mee: m } : {}) } }).eq("id", j + "_" + s); } catch (e) {} }
    if (nieuw.length) try { await meldPush(sb, "admin", { lidId: l, titel: "Kalenderronde: straten opnieuw gereserveerd", tekst: `${toon} reserveerde ${nieuw.length} ${nieuw.length === 1 ? "straat" : "straten"} van vorig jaar`, url: "/#ronde", tag: "ronde-" + l }); } catch (e) {}
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
  return res.status(200).json({ id: lid.id, naam: lid.naam, voornaam: lid.voornaam || "", toon: lid.voornaam && lid.an ? `${lid.voornaam} ${lid.an}` : lid.naam });
}

/* GeoJSON van de gereserveerde en bedeelde straten (zonder namen van personen), bv. als laag met "externe gegevens" in uMap.
   Kleuren via properties._umap_options. Een deel van een straat ("straat~n") toont enkel dat stuk (zelfde opdeling als de kaart). */
let KRL = null, KRD = null;
// verborgen lijnstukken (sleutel "straat@lat,lng>lat,lng"): lijnen die volledig op zo'n stuk liggen, weglaten
const sleutel = (sid, p) => sid + "@" + [p[0], p[p.length - 1]].map(q => q[1].toFixed(5) + "," + q[0].toFixed(5)).sort().join(">");
function zonderVerborgen(sid, C, VB) {
  // "straat+punt>punt": ontbrekend stukje straat toevoegen (coördinaten hier [lng, lat])
  for (const k of VB) if (k.startsWith(sid + "+")) { const q = k.slice(sid.length + 1).split(">").map(t => t.split(",").map(Number)); if (q.length === 2 && q.flat().every(isFinite)) C = [...C, q.map(x => [x[1], x[0]])]; }
  const KN = [...VB].filter(k => k.startsWith(sid + "#")).map(k => k.slice(sid.length + 1).split(",").map(Number)).filter(c => isFinite(c[0]) && isFinite(c[1]));
  if (KN.length) { const bij = q => KN.some(c => Math.hypot((q[1] - c[0]) * 111320, (q[0] - c[1]) * 111320 * Math.cos(c[0] * Math.PI / 180)) < (c[2] || 8));
    C = C.map(p => { const q = p.filter(x => !bij(x)); return q.length >= 2 ? q : p; }); }
  // "straat%punt>punt": het stukje van de straat tussen die twee punten weg (geometrisch, zoals op de kaart; coördinaten hier [lng, lat])
  const SN = [...VB].filter(k => k.startsWith(sid + "%")).map(k => k.slice(sid.length + 1).split(">").map(t => t.split(",").map(Number)));
  if (SN.length) { const CO = Math.cos(50.94 * Math.PI / 180), mm = (la, lo) => [la * 111320, lo * 111320 * CO], CS = SN.map(([a, b]) => [mm(a[0], a[1]), mm(b[0], b[1])]);
    const binnen = q => CS.some(([A, B]) => { const dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx * dx + dy * dy || 1, t = ((q[0] - A[0]) * dx + (q[1] - A[1]) * dy) / L2; if (t < -0.02 || t > 1.02) return false; return Math.hypot(q[0] - (A[0] + t * dx), q[1] - (A[1] + t * dy)) < 4; });
    C = C.flatMap(p => { const D = [p[0]]; for (let i = 1; i < p.length; i++) { const a = mm(p[i - 1][1], p[i - 1][0]), b = mm(p[i][1], p[i][0]), n = Math.min(200, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2)); for (let j = 1; j < n; j++) D.push([p[i - 1][0] + (p[i][0] - p[i - 1][0]) * j / n, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * j / n]); D.push(p[i]); }
      if (!D.some(q => binnen(mm(q[1], q[0])))) return [p]; const out = []; let cur = []; for (const q of D) { if (binnen(mm(q[1], q[0]))) { if (cur.length >= 2) out.push(cur); cur = []; } else cur.push(q); } if (cur.length >= 2) out.push(cur); return out; }); }
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
