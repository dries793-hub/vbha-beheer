/* ============ /kaart · eenvoudige kalenderronde voor leden: van kruispunt tot kruispunt ============
   Basis:   STRAAT KIEZEN → HELE STRAAT OF EEN DEEL → RESERVEREN
   Later:   MIJN STRATEN → PER STRAAT → BEDEELD MELDEN of EEN DEEL MELDEN
   Een deel loopt altijd van kruispunt tot kruispunt: de kruispunten zijn de grenzen tussen de bestaande stukken van de straat
   (krGroepen / KR_DELEN, zelfde opdeling als de app). Intern gaat alles via de bestaande stuk-ids ("straat~n"); het lid ziet enkel
   straatnamen. De server beslist wat vrij is, rekent het aantal kalenders uit en verwerkt de melding (teller in dozen).
   Wie: persoonlijke link (?l=&j=&t=) of één keer je naam kiezen (bewaard in deze browser). Dat geeft nooit bestuursrechten. */
(function () {
  "use strict";
  const $ = q => document.querySelector(q);
  const e2 = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const nr = n => Math.round(Number(n) || 0).toLocaleString("nl-BE");
  const kal = n => `${nr(n)} ${Number(n) === 1 ? "kalender" : "kalenders"}`;
  const KW = ["", "¼", "½", "¾"], fd = n => { n = Math.round((Number(n) || 0) * 4) / 4; const w = Math.floor(n + 1e-9), q = Math.round((n - w) * 4); return ((w ? w : "") + (q ? (w ? " " : "") + KW[q] : "") || "0") + " " + (n > 1 || n === 0 ? "dozen" : "doos"); };
  const gsm = () => matchMedia("(max-width:640px)").matches;
  const OPSLAG = "vbha.kaart.lid";
  const Q = new URLSearchParams(location.search), LINK = Q.get("l") && Q.get("j") && Q.get("t") ? { l: Q.get("l"), j: Q.get("j"), t: Q.get("t") } : null;
  let IK = null, MIJN = null, VIEW = "kies", CUR = null, BEZIG = false, NA = null;

  /* ---------- wie ben je ---------- */
  const lees = () => { try { return JSON.parse(localStorage.getItem(OPSLAG) || "null"); } catch (e) { return null; } };
  const bewaar = x => { try { x ? localStorage.setItem(OPSLAG, JSON.stringify(x)) : localStorage.removeItem(OPSLAG); } catch (e) { } };
  const voornaam = x => String(x && (x.voornaam || String(x.toon || x.naam || "").split(" ")[0]) || "").trim();
  const wieParams = () => IK && IK.link ? { ...IK.link } : IK ? { lidId: IK.id } : {};
  window.krIk = () => IK ? { id: IK.id, toon: IK.toon, naam: IK.toon, link: IK.link || null } : null;
  async function laadMijn() {
    if (!IK) { MIJN = null; teken(); return; }
    const p = IK.link ? `l=${encodeURIComponent(IK.link.l)}&j=${encodeURIComponent(IK.link.j)}&t=${encodeURIComponent(IK.link.t)}&mijn=1` : `mijn=${encodeURIComponent(IK.id)}`;
    try { const r = await fetch("/api/ronde?" + p, { cache: "no-store" }), j = await r.json().catch(() => ({}));
      if (!r.ok) { if (r.status === 400 && !IK.link) { bewaar(null); IK = null; MIJN = null; VIEW = "kies"; } teken(); return; }
      MIJN = j; if (!IK.voornaam && j.voornaam) IK.voornaam = j.voornaam;
    } catch (e) { }
    teken();
  }
  function zetIk(x, bron, naarMijn) { IK = { id: x.id, toon: x.toon || x.naam, voornaam: x.voornaam || voornaam(x), link: bron === "personal_link" ? LINK : null };
    if (bron !== "personal_link") bewaar({ id: IK.id, toon: IK.toon, voornaam: IK.voornaam });
    if (naarMijn) VIEW = "mijn"; return laadMijn(); }
  function kiesLid(dan) {
    if (document.getElementById("krWie")) return;
    const bg = document.createElement("div"); bg.className = "km-bg"; bg.id = "krWie";
    bg.innerHTML = `<div class="km vb-ui krw" role="dialog" aria-modal="true" aria-labelledby="krwT"><div class="km-h"><h3 id="krwT" class="vb-acc">Wie ben je?</h3><button type="button" class="km-x" data-w="x" aria-label="Sluiten"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div id="krwZ"><div class="krw-in"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input id="krwQ" type="search" placeholder="Typ je naam…" autocomplete="off" aria-label="Typ je naam" aria-describedby="krwH"></div>
        <p class="krw-h" id="krwH">Typ minstens 3 letters van je voornaam of familienaam.</p><ul class="krw-l" id="krwL" aria-label="Leden"></ul></div>
      <div id="krwB" hidden><p class="krw-ok">Verder als <b id="krwN"></b>?</p>
        <div class="krr-knoppen"><button type="button" class="vb-cta krr-groot" data-w="ja">Ja, verder</button><button type="button" class="vb-btn2 krr-groot" data-w="terug">Andere naam</button></div></div></div>`;
    document.body.appendChild(bg);
    const inp = bg.querySelector("#krwQ"), ul = bg.querySelector("#krwL"), hint = bg.querySelector("#krwH");
    let L = [], T = null, kz = null;
    const dicht = () => { bg.remove(); document.removeEventListener("keydown", esc); };
    const esc = e => { if (e.key === "Escape") dicht(); };
    document.addEventListener("keydown", esc);
    inp.addEventListener("input", () => { clearTimeout(T); const q = inp.value.trim();
      if (q.replace(/\s/g, "").length < 3) { L = []; ul.innerHTML = ""; hint.textContent = "Typ minstens 3 letters van je voornaam of familienaam."; return; }
      hint.textContent = "Even zoeken…";
      T = setTimeout(async () => { try { const r = await fetch("/api/leden?q=" + encodeURIComponent(q)); L = r.ok ? await r.json() : []; } catch (e) { L = []; }
        hint.textContent = L.length ? "Tik op je naam." : "Niet gevonden. Kijk de schrijfwijze na of vraag het bestuur.";
        ul.innerHTML = L.map((l, i) => `<li><button type="button" data-i="${i}">${e2(l.toon || l.naam)}</button></li>`).join(""); }, 250); });
    bg.addEventListener("click", e => { if (e.target === bg) return dicht(); const o = e.target.closest("[data-i]");
      if (o) { kz = L[+o.dataset.i]; bg.querySelector("#krwN").textContent = kz.toon || kz.naam; bg.querySelector("#krwZ").hidden = true; bg.querySelector("#krwB").hidden = false; return; }
      const b = e.target.closest("[data-w]"); if (!b) return;
      if (b.dataset.w === "x") return dicht();
      if (b.dataset.w === "terug") { kz = null; bg.querySelector("#krwZ").hidden = false; bg.querySelector("#krwB").hidden = true; inp.focus(); return; }
      if (b.dataset.w === "ja" && kz) { dicht(); zetIk(kz, "manual_member_selection").then(() => { if (typeof dan === "function") dan(); }); } });
    setTimeout(() => inp.focus(), 50);
  }
  const metIk = fn => IK ? fn() : kiesLid(fn);

  /* ---------- straten, stukken en kruispunten ---------- */
  const mijnIds = () => new Set(MIJN ? MIJN.teDoen.map(x => x.s) : []);
  const adrId = id => Number((KR.byId.get(id) || KR_DEEL.get(id) || {}).a) || 0;
  const naamSid = sid => (KR.byId.get(sid) || {}).n || sid;
  const groepen = sid => { try { return krGroepen(sid).filter(g => g.g && g.g.length); } catch (e) { return []; } };
  /* toestand van een stuk: "d" bedeeld, "r" gereserveerd (mijn = door mij), "" vrij */
  function stukStand(sid, g, M) {
    if (KR_STAND[sid]) return { st: KR_STAND[sid], mijn: M.has(sid) };
    let st = "", mijn = true, iets = false;
    for (const id of g.ids) { const s = KR_STAND[id]; if (s === "d") st = "d"; else if (s === "r" && st !== "d") st = "r"; if (s) { iets = true; if (!M.has(id)) mijn = false; } }
    return { st, mijn: iets && mijn };
  }
  const afst = (p, q) => Math.hypot((p[0] - q[0]) * 111320, (p[1] - q[1]) * 111320 * Math.cos(p[0] * Math.PI / 180));
  /* kruispunten = grenzen tussen opeenvolgende stukken + de twee uiteinden van de straat */
  function kruispunten(sid) {
    const G = groepen(sid); if (G.length < 2) return null;
    const pts = g => { const k = (g.k || []).filter(Boolean); if (k.length) return k; const f = g.g[0], l = g.g[g.g.length - 1]; return [f[0], l[l.length - 1]]; };
    const B = [];
    for (let i = 0; i < G.length - 1; i++) { let best = null, bd = Infinity; for (const p of pts(G[i])) for (const q of pts(G[i + 1])) { const d = afst(p, q); if (d < bd) { bd = d; best = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; } } B.push(best); }
    const ver = (g, ref) => pts(g).reduce((b, p) => afst(p, ref) > afst(b, ref) ? p : b, pts(g)[0]);
    const C = [ver(G[0], B[0]), ...B, ver(G[G.length - 1], B[B.length - 1])];
    // namen van de kruisende straten; een grens zonder kruisende straat (bv. waar de straat van vorm verandert) toont geen bolletje
    const N = C.map(p => kruisNaam(p, sid)), toon = C.map((p, i) => i === 0 || i === C.length - 1 || !!N[i]);
    return { G, C, N, toon };
  }
  const kruisNaam = (p, sid) => { try { return window.krBuur ? window.krBuur(p, sid) : ""; } catch (e) { return ""; } };
  /* mag dit stuk in de keuze? reserveren: vrij; melden: van mij (stukken zonder adressen mogen mee als ze vrij zijn) */
  function stukOk(sid, g, M, mode) { const s = stukStand(sid, g, M); if (mode === "reserve") return !s.st; return (s.st === "r" && s.mijn) || (!s.st && !g.a); }
  function idsVan(sid, G, i, j, M, mode) { const lo = Math.min(i, j), hi = Math.max(i, j), out = [];
    for (let k = lo; k < hi; k++) { const g = G[k], s = stukStand(sid, g, M); if (mode === "meld" && !(s.st === "r" && s.mijn)) continue; if (mode === "reserve" && !g.a) continue; out.push(...g.ids); }
    // melden met de hele straat op mijn naam: stuk-ids (de server splitst de reservatie)
    return out; }
  const kalenders = async ids => { try { const r = await fetch("/api/ronde?kalenders=" + encodeURIComponent(ids.join(","))); const j = await r.json(); return Number(j.kalenders) || 0; } catch (e) { return ids.reduce((t, id) => t + adrId(id), 0); } };

  /* ---------- kaartlaag voor de deelkeuze ---------- */
  let LAAG = null;
  function laag() { if (!KR.map) return null; if (!LAAG) LAAG = L.layerGroup().addTo(KR.map); return LAAG; }
  function tekenDeel() {
    const Lg = laag(); if (!Lg) return; Lg.clearLayers(); if (VIEW !== "deel" || !CUR || !CUR.K) return;
    const { G, C } = CUR.K, M = mijnIds(), w = krDikte(KR.map.getZoom()), rood = krVar("--kr-sel") || "#D0121B";
    if (CUR.p1 != null && CUR.p2 != null) { const lo = Math.min(CUR.p1, CUR.p2), hi = Math.max(CUR.p1, CUR.p2);
      for (let k = lo; k < hi; k++) { L.polyline(G[k].g, { renderer: KR.renderer, interactive: false, color: "#fff", weight: w[2] + 8, opacity: .95, lineCap: "round" }).addTo(Lg); L.polyline(G[k].g, { renderer: KR.renderer, interactive: false, color: rood, weight: w[2] + 3, lineCap: "round" }).addTo(Lg); } }
    C.forEach((p, c) => { const ok = geldig(c, M) && CUR.K.toon[c]; const lab = c === CUR.p1 ? "1" : c === CUR.p2 ? "2" : "";
      if (!ok && !lab) return;
      const m = L.marker(p, { icon: L.divIcon({ className: "krx-w", html: `<span class="krx${lab ? " on" : ""}">${lab}</span>`, iconSize: [52, 52], iconAnchor: [26, 26] }), keyboard: true, title: CUR.K.N[c] || "Einde van de straat", zIndexOffset: lab ? 2000 : 1000 });
      m.on("click", ev => { L.DomEvent.stopPropagation(ev); tik(c); }).addTo(Lg); });
  }
  /* geldige kruispunten: eerste tik = elk kruispunt naast een bruikbaar stuk; tweede tik = enkel eindpunten met een doorlopend bruikbaar traject */
  function geldig(c, M) { const { G } = CUR.K, ok = k => k >= 0 && k < G.length && stukOk(CUR.sid, G[k], M, CUR.mode);
    if (CUR.p1 == null || CUR.p2 != null) return ok(c - 1) || ok(c);
    if (c === CUR.p1) return false; const lo = Math.min(c, CUR.p1), hi = Math.max(c, CUR.p1);
    let adr = false; for (let k = lo; k < hi; k++) { if (!ok(k)) return false; if (G[k].a && (CUR.mode === "reserve" || stukStand(CUR.sid, G[k], M).mijn)) adr = true; } return adr; }
  async function tik(c) { if (VIEW !== "deel") return; const M = mijnIds();
    if (CUR.p2 != null) return; if (!geldig(c, M)) return;
    if (CUR.p1 == null) { CUR.p1 = c; teken(); return; }
    CUR.p2 = c; CUR.ids = idsVan(CUR.sid, CUR.K.G, CUR.p1, CUR.p2, M, CUR.mode); CUR.kal = null;
    const lo = Math.min(CUR.p1, CUR.p2), hi = Math.max(CUR.p1, CUR.p2);
    CUR.van = CUR.K.N[lo]; CUR.tot = CUR.K.N[hi];
    teken(); zoomDeel(); CUR.kal = await kalenders(CUR.ids); teken(); }
  function zoomStraat(sid) { const l = KR.lines.get(sid); if (l && KR.map) KR.map.fitBounds(l.getBounds(), padding()); }
  function zoomDeel() { if (!KR.map || !CUR || CUR.p2 == null) return; const lo = Math.min(CUR.p1, CUR.p2), hi = Math.max(CUR.p1, CUR.p2), pts = [];
    for (let k = lo; k < hi; k++) for (const p of CUR.K.G[k].g) pts.push(...p); if (pts.length) KR.map.fitBounds(L.latLngBounds(pts), padding()); }
  const padding = () => { const c = $("#krCard"), h = c && !c.hidden ? c.offsetHeight : 0;
    return gsm() ? { paddingTopLeft: [30, 120], paddingBottomRight: [60, h + 24], maxZoom: 18 } : { paddingTopLeft: [380, 80], paddingBottomRight: [60, 60], maxZoom: 18 }; };

  /* ---------- acties ---------- */
  const post = async body => { const r = await fetch("/api/ronde", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, ...wieParams() }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Dat lukte niet. Probeer opnieuw."); return j; };
  async function reserveer(ids, titel) {
    if (!IK) return kiesLid(() => reserveer(ids, titel));
    if (BEZIG) return; BEZIG = true; teken();
    try { await post({ actie: "reserveer", straten: ids }); NA = { titel: "Gereserveerd!", tekst: `${titel} staat nu op jouw naam.` };
      VIEW = "klaar"; CUR = null; KR.ss = new Set(); await Promise.all([krLive(), laadMijn()]); }
    catch (e) { NA = { titel: "Niet gelukt", tekst: e.message, fout: true }; VIEW = "klaar"; CUR = null; KR.ss = new Set(); krLive(); }
    BEZIG = false; teken();
  }
  async function meld(ids, titel, dozen) {
    if (BEZIG) return; BEZIG = true; teken();
    const key = CUR && CUR.key || ("k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10).padEnd(8, "0")); if (CUR) CUR.key = key;
    try { await post({ actie: "meld", key, straten: ids, dozen }); NA = { titel: "Bedankt!", tekst: `${titel} is als bedeeld geregistreerd. Het bestuur controleert dit nog.` };
      VIEW = "klaar"; CUR = null; await Promise.all([krLive(), laadMijn()]); }
    catch (e) { BEZIG = false; teken(); krMelding(e.message); return; }
    BEZIG = false; teken();
  }
  const schatDozen = k => Math.max(.25, Math.round(k / (PER_DOOS || 100) * 4) / 4);

  /* ---------- schermen (links op de computer, onderaan op de gsm) ---------- */
  function kaarten() { const M = MIJN ? MIJN.teDoen : [], per = new Map();
    for (const x of M) { const sid = x.s.split("~")[0]; if (!per.has(sid)) per.set(sid, []); per.get(sid).push(x.s); }
    return [...per].map(([sid, ids]) => ({ sid, ids, kal: ids.reduce((t, id) => t + adrId(id), 0), deel: ids.some(id => id.includes("~")) }));
  }
  function kanDeel(sid, ids) { const K = kruispunten(sid); if (!K) return false; const M = new Set(ids); return K.G.filter(g => g.a && (M.has(sid) || g.ids.every(i => M.has(i)))).length > 1; }
  function schermMijn() {
    const K = kaarten();
    let h = `<div class="krr-kop"><p class="krr-dag">Dag ${e2(voornaam(IK))}</p><h2 class="krr-t">Jouw straten</h2><p class="krr-sub">${K.length ? `Nog ${K.length} ${K.length === 1 ? "straat" : "straten"} te doen` : "Je hebt nog geen straten."}</p></div>`;
    if (!MIJN) return h + `<p class="krr-leeg">Even laden…</p>`;
    h += K.map(k => `<section class="krr-kaart"><h3>${e2(naamSid(k.sid))}${k.deel ? " <small>(een deel)</small>" : ""}</h3><p>${kal(k.kal)}</p>
      <button type="button" class="vb-cta krr-groot" data-kr="meld" data-sid="${e2(k.sid)}">Bedeeld melden</button>
      ${kanDeel(k.sid, k.ids) ? `<button type="button" class="vb-btn2 krr-groot" data-kr="meld-deel" data-sid="${e2(k.sid)}">Een deel melden</button>` : ""}</section>`).join("");
    h += `<button type="button" class="krr-plus krr-groot" data-kr="kies">+ Straten kiezen</button>`;
    const G = [...(MIJN.gemeld || []), ...(MIJN.afgewerkt || [])];
    if (G.length) h += `<div class="krr-gedaan"><h4>Al bedeeld</h4><ul>${G.map(m => `<li>${e2([...new Set(m.straten.map(s => naamSid(s.split("~")[0])))].join(", "))}</li>`).join("")}</ul></div>`;
    return h;
  }
  function schermKies() {
    return `<div class="krr-kop">${IK ? `<p class="krr-dag">Dag ${e2(voornaam(IK))}</p>` : ""}<h2 class="krr-t">Straten kiezen</h2><p class="krr-sub">Tik op een grijze straat op de kaart.</p></div>
      ${IK ? `<button type="button" class="vb-btn2 krr-groot" data-kr="mijn">Terug naar mijn straten</button>` : `<button type="button" class="vb-btn2 krr-groot" data-kr="mijn">Ik heb al straten</button>`}`;
  }
  function schermStraat() { const sid = CUR.sid, M = mijnIds(), G = groepen(sid), vrijAlles = !KR_STAND[sid] && G.every(g => !stukStand(sid, g, M).st), K = kruispunten(sid);
    const deelKan = K && K.G.some(g => g.a && !stukStand(sid, g, M).st);
    return `<div class="krr-kop"><h2 class="krr-t">${e2(naamSid(sid))}</h2><p class="krr-groot-getal">${CUR.kal == null ? "…" : kal(CUR.kal)}</p>${vrijAlles ? "" : `<p class="krr-sub">Een deel van deze straat is al genomen.</p>`}</div>
      <div class="krr-knoppen">${vrijAlles ? `<button type="button" class="vb-cta krr-groot" data-kr="res-heel"${BEZIG ? " disabled" : ""}>${BEZIG ? "Even geduld…" : "Hele straat reserveren"}</button>` : ""}
      ${deelKan ? `<button type="button" class="${vrijAlles ? "vb-btn2" : "vb-cta"} krr-groot" data-kr="deel">Een deel kiezen</button>` : ""}
      <button type="button" class="vb-btn2 krr-groot" data-kr="terug">Terug</button></div>`;
  }
  function schermDeel() { const n = naamSid(CUR.sid), meldt = CUR.mode === "meld";
    let h = `<div class="krr-kop"><p class="krr-dag">${meldt ? "Een deel melden" : "Een deel kiezen"}</p><h2 class="krr-t">${e2(n)}</h2></div>`;
    if (CUR.p2 == null) return h + `<p class="krr-stap"><b>${CUR.p1 == null ? "1" : "2"}</b>${CUR.p1 == null ? "Tik op het eerste kruispunt." : "Tik op het laatste kruispunt."}</p>
      <div class="krr-knoppen">${CUR.p1 != null ? `<button type="button" class="vb-btn2 krr-groot" data-kr="opnieuw">Opnieuw kiezen</button>` : ""}<button type="button" class="vb-btn2 krr-groot" data-kr="terug">Terug</button></div>`;
    const van = CUR.van || "het begin van de straat", tot = CUR.tot || "het einde van de straat";
    return h + `<h3 class="krr-h">Dit stuk gekozen</h3><p class="krr-sub">Van ${e2(van)} tot ${e2(tot)}</p><p class="krr-groot-getal">${CUR.kal == null ? "…" : kal(CUR.kal)}</p>
      ${meldt ? `<p class="krr-sub">De rest blijft voor jou gereserveerd.</p>${dozenVraag()}` : ""}
      <div class="krr-knoppen"><button type="button" class="vb-cta krr-groot" data-kr="${meldt ? "meld-stuk" : "res-stuk"}"${BEZIG || CUR.kal == null ? " disabled" : ""}>${BEZIG ? "Even geduld…" : meldt ? "Dit stuk als bedeeld melden" : "Dit stuk reserveren"}</button>
      <button type="button" class="vb-btn2 krr-groot" data-kr="opnieuw">Opnieuw kiezen</button><button type="button" class="vb-btn2 krr-groot" data-kr="terug">Terug</button></div>`;
  }
  /* één eenvoudige vraag: hoeveel dozen (voor de verdeling van de dozen; vooraf ingevuld met een schatting) */
  function dozenVraag() { if (CUR.dozen == null && CUR.kal != null) CUR.dozen = schatDozen(CUR.kal);
    return `<div class="krr-dz"><span>Hoeveel dozen heb je hiervoor gebruikt?</span><div class="vb-qty krr-qty"><button type="button" data-kr="dz-" aria-label="Een kwart doos minder"${(CUR.dozen || 0) <= .25 ? " disabled" : ""}>−</button><b>${CUR.dozen == null ? "…" : fd(CUR.dozen)}</b><button type="button" data-kr="dz+" aria-label="Een kwart doos meer">+</button></div></div>`; }
  function schermBevestig() { const n = naamSid(CUR.sid);
    return `<div class="krr-kop"><h2 class="krr-t">${e2(n)} volledig bedeeld?</h2><p class="krr-groot-getal">${CUR.kal == null ? "…" : kal(CUR.kal)}</p></div>${dozenVraag()}
      <div class="krr-knoppen"><button type="button" class="vb-cta krr-groot" data-kr="meld-ja"${BEZIG || CUR.kal == null ? " disabled" : ""}>${BEZIG ? "Even geduld…" : "Ja, bedeeld"}</button><button type="button" class="vb-btn2 krr-groot" data-kr="terug">Terug</button></div>`;
  }
  function schermKlaar() { return `<div class="krr-kop krr-klaar${NA && NA.fout ? " fout" : ""}"><span class="krr-ok" aria-hidden="true">${NA && NA.fout ? "!" : "✓"}</span><h2 class="krr-t">${e2(NA ? NA.titel : "")}</h2><p class="krr-sub" role="status">${e2(NA ? NA.tekst : "")}</p></div>
    <div class="krr-knoppen"><button type="button" class="vb-cta krr-groot" data-kr="${IK ? "mijn" : "kies"}">${IK ? "Naar mijn straten" : "Verder"}</button></div>`; }

  /* het bestaande paneel (#krCard) is de houder */
  const _card = krCard;
  krCard = function () {
    const c = $("#krCard"); if (!c) return;
    let R = $("#krR"); if (!R) { R = document.createElement("div"); R.id = "krR"; R.className = "krr"; c.appendChild(R); }
    c.hidden = false; c.classList.add("krr-aan", "open"); R.hidden = false; c.dataset.view = VIEW;
    if (VIEW === "mijn" && !IK) VIEW = "kies";
    R.innerHTML = VIEW === "mijn" ? schermMijn() : VIEW === "straat" ? schermStraat() : VIEW === "deel" ? schermDeel() : VIEW === "bevestig" ? schermBevestig() : VIEW === "klaar" ? schermKlaar() : schermKies();
    nav(); tekenDeel();
  };
  window.krCard = krCard;
  function teken() { try { krCard(); if (KR.map) krStyleAll(); } catch (e) { console.warn(e); } }

  /* ---------- kaart: tik op een straat ---------- */
  krToggle = function (id) {
    if (VIEW === "deel" || BEZIG) return;
    const sid = String(id).split("~")[0], M = mijnIds();
    if (M.has(sid) || [...M].some(x => x.startsWith(sid + "~"))) { VIEW = "mijn"; KR.ss = new Set(); teken(); return; }
    const G = groepen(sid);
    if (KR_STAND[sid] || (G.length && G.every(g => stukStand(sid, g, M).st))) { krMelding(`${naamSid(sid)} is al ${KR_STAND[sid] === "d" || G.every(g => stukStand(sid, g, M).st === "d") ? "bedeeld" : "gereserveerd"}.`); return; }
    CUR = { sid, kal: null }; VIEW = "straat"; KR.ss = new Set([sid]); teken(); zoomStraat(sid);
    const vrij = !KR_STAND[sid] && G.every(g => !stukStand(sid, g, M).st);
    kalenders(vrij ? [sid] : G.filter(g => !stukStand(sid, g, M).st).flatMap(g => g.ids)).then(k => { if (CUR && CUR.sid === sid) { CUR.kal = k; teken(); } });
  };
  window.krToggle = krToggle;
  /* kleuren: grijs vrij, blauw gereserveerd, groen bedeeld, rood = enkel de huidige keuze */
  const _st = krStyleAll;
  krStyleAll = function () { _st.apply(this, arguments); try { const p = $(".kr-leg-p"); if (p) p.hidden = true; } catch (e) { } };
  window.krStyleAll = krStyleAll;

  /* ---------- kopbalk: Kaart | Mijn straten ---------- */
  function nav() { let n = $("#krNav"); if (!n) { const h = $(".hdr .in"); if (!h) return; n = document.createElement("nav"); n.id = "krNav"; n.className = "krn"; n.setAttribute("aria-label", "Kalenderronde"); const lg = h.querySelector(".logo-a"); lg ? lg.after(n) : h.prepend(n); }
    const mijn = VIEW === "mijn"; n.innerHTML = `<button type="button" data-kr="kies" aria-current="${mijn ? "false" : "page"}">Kaart</button><button type="button" data-kr="mijn" aria-current="${mijn ? "page" : "false"}">Mijn straten</button>`; }

  /* ---------- klikken ---------- */
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-kr]"); if (!b) return; const k = b.dataset.kr;
    if (k === "mijn") return metIk(() => { VIEW = "mijn"; CUR = null; KR.ss = new Set(); teken(); });
    if (k === "kies") { VIEW = "kies"; CUR = null; KR.ss = new Set(); teken(); return; }
    if (k === "terug") { const v = VIEW, m = CUR && CUR.mode; CUR = null; KR.ss = new Set(); VIEW = v === "straat" || (v === "deel" && m === "reserve") || !IK ? "kies" : "mijn"; teken(); return; }
    if (k === "res-heel" && CUR) return reserveer([CUR.sid], naamSid(CUR.sid));
    if (k === "deel" && CUR) { const K = kruispunten(CUR.sid); if (!K) return; CUR = { sid: CUR.sid, mode: "reserve", K, p1: null, p2: null }; VIEW = "deel"; KR.ss = new Set(); teken(); zoomStraat(CUR.sid); return; }
    if (k === "meld" || k === "meld-deel") { const sid = b.dataset.sid, kaart = kaarten().find(x => x.sid === sid); if (!kaart) return;
      if (k === "meld") { CUR = { sid, ids: kaart.ids, kal: null, dozen: null }; VIEW = "bevestig"; KR.ss = new Set([sid]); teken(); zoomStraat(sid); kalenders(kaart.ids).then(x => { if (CUR && CUR.sid === sid) { CUR.kal = x; teken(); } }); return; }
      const K = kruispunten(sid); if (!K) return; CUR = { sid, mode: "meld", K, p1: null, p2: null, dozen: null }; VIEW = "deel"; KR.ss = new Set(); teken(); zoomStraat(sid); return; }
    if (k === "opnieuw" && CUR) { CUR.p1 = CUR.p2 = null; CUR.ids = null; CUR.kal = null; CUR.dozen = null; CUR.key = null; teken(); zoomStraat(CUR.sid); return; }
    if (k === "res-stuk" && CUR && CUR.ids) return reserveer(CUR.ids, `Het stuk van ${naamSid(CUR.sid)}`);
    if (k === "meld-stuk" && CUR && CUR.ids) return meld(CUR.ids, `Het stuk van ${naamSid(CUR.sid)}`, CUR.dozen);
    if (k === "meld-ja" && CUR) return meld(CUR.ids, naamSid(CUR.sid), CUR.dozen);
    if ((k === "dz+" || k === "dz-") && CUR) { CUR.dozen = Math.max(.25, Math.round(((CUR.dozen || 0) + (k === "dz+" ? .25 : -.25)) * 4) / 4); teken(); }
  });

  /* ---------- opstart ---------- */
  if (LINK) fetch(`/api/ronde?ik=1&l=${encodeURIComponent(LINK.l)}&j=${encodeURIComponent(LINK.j)}&t=${encodeURIComponent(LINK.t)}`, { cache: "no-store" }).then(r => r.ok ? r.json() : {})
    .then(x => { if (x && x.id) zetIk(x, "personal_link", true); else { const o = lees(); if (o && o.id) zetIk(o, "manual_member_selection", true); else teken(); } }).catch(() => teken());
  else { const o = lees(); if (o && o.id) zetIk(o, "manual_member_selection", true); }
  const _live = krLive; let tel = 0;
  krLive = async function () { const r = await _live.apply(this, arguments); if (IK && VIEW === "mijn" && ++tel % 2 === 0) laadMijn(); return r; };
  window.krLive = krLive;
  if (KR.map) KR.map.on("zoomend", tekenDeel); else { const t = setInterval(() => { if (KR.map) { clearInterval(t); KR.map.on("zoomend", tekenDeel); } }, 300); }
  teken();

  /* ---------- stijl: grote knoppen, duidelijke tekst, één hoofdactie per scherm ---------- */
  const st = document.createElement("style");
  st.textContent = `
#krCard.krr-aan>:not(#krR):not(.kr-grip){display:none!important}
.krr{display:flex;flex-direction:column;gap:12px}
.krr-kop{display:flex;flex-direction:column;gap:2px}
.krr-dag{margin:0;font-size:16px;color:var(--muted)}
.krr .krr-t{margin:0;font:700 24px/1.2 var(--f-display,inherit);letter-spacing:-.01em;color:var(--ink)}
.krr-sub{margin:2px 0 0;font-size:16px;color:var(--muted);line-height:1.4}
.krr-groot-getal{margin:4px 0 0;font-size:22px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums}
.krr .krr-h{margin:4px 0 0;font:700 19px/1.25 var(--f-display,inherit);color:var(--ink)}
.krr-knoppen{display:flex;flex-direction:column;gap:10px}
.krr .krr-groot{width:100%;min-height:52px!important;height:auto!important;font-size:17px!important;font-weight:600!important;border-radius:12px!important;box-sizing:border-box;justify-content:center}
.krr .vb-btn2.krr-groot{background:var(--surface)!important;border:1.5px solid #B9BCC2!important;color:var(--ink)!important}
.krr-kaart{border:1px solid var(--vb-line,var(--line));border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:8px;background:var(--surface)}
.krr-kaart h3{margin:0;font-size:20px;font-weight:700;color:var(--ink)}.krr-kaart h3 small{font-size:14px;font-weight:500;color:var(--muted)}
.krr-kaart p{margin:0 0 4px;font-size:16px;color:var(--muted)}
.krr .krr-plus{all:unset;box-sizing:border-box;display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px solid var(--accent);color:var(--accent);background:var(--surface);font-size:17px;font-weight:700}
.krr .krr-plus:focus-visible{outline:3px solid var(--ink);outline-offset:2px}
.krr-gedaan h4{margin:6px 0 4px;font-size:14px;font-weight:600;color:var(--muted)}.krr-gedaan ul{margin:0;padding-left:18px;color:var(--muted);font-size:15px}
.krr-leeg{margin:0;font-size:16px;color:var(--muted)}
.krr-stap{display:flex;align-items:center;gap:12px;margin:4px 0;font-size:19px;font-weight:600;color:var(--ink)}
.krr-stap b{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:var(--accent);color:#fff;font-size:18px}
.krr-dz{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:12px;background:var(--vb-subtle,#f3f3f2)}
.krr-dz>span{font-size:16px;font-weight:600;color:var(--ink)}
.krr .krr-qty{align-self:flex-start;height:52px!important}.krr .krr-qty>button{width:46px!important;height:46px!important;font-size:26px!important}.krr .krr-qty>b{min-width:96px!important;width:auto!important;font-size:18px!important;padding:0 6px!important}
.krr-klaar{align-items:flex-start}.krr-ok{display:grid;place-items:center;width:48px;height:48px;border-radius:50%;background:var(--good);color:#fff;font-size:26px;font-weight:700;margin-bottom:6px}.krr-klaar.fout .krr-ok{background:var(--bad)}
/* kruispunten: grote ronde knoppen (aanraakvlak 52 px) */
.krx-w{background:none!important;border:0!important;display:grid!important;place-items:center;cursor:pointer}
.krx{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#fff;border:3px solid #18191C;box-shadow:0 1px 4px rgba(0,0,0,.35);font:700 15px/1 var(--f-body,system-ui);color:#fff;box-sizing:border-box;transition:transform .12s}
.krx-w:hover .krx{transform:scale(1.15)}
.krx.on{width:36px;height:36px;background:#D0121B;border:3px solid #fff;color:#fff}
.krx-w:focus-visible{outline:3px solid #18191C;outline-offset:-6px;border-radius:50%}
/* kopbalk */
.krn{display:flex;align-items:stretch;gap:22px;height:100%;margin-left:28px}
.krn button{all:unset;cursor:pointer;display:flex;align-items:center;color:rgba(255,255,255,.78);font-size:15px;font-weight:500;border-bottom:2px solid transparent;padding-top:2px;box-sizing:border-box}
.krn button[aria-current=page]{color:#fff;border-color:#E0313A}.krn button:hover{color:#fff}.krn button:focus-visible{outline:2px solid #fff;outline-offset:2px}
body .hdr .in{height:56px}
/* legende: enkel vrij, gereserveerd, bedeeld */
body .kr-leg .kr-leg-sel,body .kr-leg .kr-leg-p{display:none!important}
/* computer: kolom links (zoals de mock-up), zoekveld boven de kaart */
@media (min-width:641px){
  body .kr-card.krr-aan{top:0!important;left:0!important;bottom:0!important;width:340px!important;max-width:none!important;max-height:none!important;border-radius:0!important;border-width:0 1px 0 0!important;padding:20px!important;overflow:auto;box-shadow:none!important}
  body .kr-search{left:356px!important}
  body .leaflet-control-container .leaflet-bottom.leaflet-left{left:340px}
}
/* gsm: blad onderaan, kaart krijgt de ruimte */
@media (max-width:640px){
  .krn{display:none}
  body .kr-card.krr-aan{max-height:min(68dvh,calc(100% - 70px))!important;padding:6px 16px calc(14px + env(safe-area-inset-bottom,0px))!important;overflow:auto}
  .krr .krr-t{font-size:22px}
  .krr{gap:10px}
  #krCard[data-view=deel] .krr-dag{display:none}
  #krCard[data-view=deel] .krr .krr-groot{min-height:48px!important}
  #krCard[data-view=deel] .krr-dz{padding:10px 12px;flex-direction:row;align-items:center;justify-content:space-between;gap:10px}
  #krCard[data-view=deel] .krr-dz>span{font-size:15px}
}
@media (prefers-color-scheme:dark){.krr .vb-btn2.krr-groot{border-color:#5A5D63!important}}
`;
  document.head.appendChild(st);
})();
