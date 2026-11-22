/* ============ /kaart · persoonlijke kalenderronde: SELECTEREN → RESERVEREN → BEDELING MELDEN (→ controle door het bestuur in de app) ============
   Bouwt verder op de bestaande kaart (KR, KR_STAND, KR_DELEN, krStyleAll, krLive, krDeelIn, krMeldOpen). Geen eigen businesslogica:
   de server beslist of een straat vrij is, wat een melding meetelt en wat de teller is.
   Wie ben je?
   - persoonlijke link (?l=&j=&t=)            -> automatisch herkend (bron personal_link)
   - zonder link: naam kiezen uit de ledenlijst -> bewaard in deze browser (bron manual_member_selection)
   Dat is identificatie, geen aanmelding: het geeft nooit toegang tot beheer of tot gegevens van anderen. */
(function () {
  "use strict";
  const $ = q => document.querySelector(q);
  const e2 = t => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const nr = n => Math.round(Number(n) || 0).toLocaleString("nl-BE");
  const gsm = () => matchMedia("(max-width:640px)").matches;
  const OPSLAG = "vbha.kaart.lid";
  const Q = new URLSearchParams(location.search), LINK = Q.get("l") && Q.get("j") && Q.get("t") ? { l: Q.get("l"), j: Q.get("j"), t: Q.get("t") } : null;
  let IK = null, MIJN = null, TAB = "nieuw", MSEL = null, AANP = false, BEZIG = false;

  /* ---------- identiteit ---------- */
  const lees = () => { try { return JSON.parse(localStorage.getItem(OPSLAG) || "null"); } catch (e) { return null; } };
  const bewaar = x => { try { x ? localStorage.setItem(OPSLAG, JSON.stringify(x)) : localStorage.removeItem(OPSLAG); } catch (e) { } };
  const voornaam = x => String(x && (x.voornaam || String(x.toon || x.naam || "").split(" ")[0]) || "").trim();
  window.krIk = () => IK ? { id: IK.id, toon: IK.toon, naam: IK.toon, link: IK.link || null } : null;
  const wieParams = () => IK && IK.link ? { ...IK.link } : IK ? { lidId: IK.id } : {};
  async function laadMijn() {
    if (!IK) { MIJN = null; teken(); return; }
    const p = IK.link ? `l=${encodeURIComponent(IK.link.l)}&j=${encodeURIComponent(IK.link.j)}&t=${encodeURIComponent(IK.link.t)}&mijn=1` : `mijn=${encodeURIComponent(IK.id)}`;
    try {
      const r = await fetch("/api/ronde?" + p, { cache: "no-store" }), j = await r.json().catch(() => ({}));
      if (!r.ok) { if (r.status === 400 && !IK.link) { bewaar(null); IK = null; MIJN = null; krMelding(j.error || "Kies opnieuw je naam."); } teken(); return; }
      MIJN = j; if (!IK.voornaam && j.voornaam) IK.voornaam = j.voornaam;
      if (MSEL) MSEL = new Set([...MSEL].filter(s => j.teDoen.some(x => x.s === s)));
    } catch (e) { /* offline: vorige stand houden */ }
    teken();
  }
  function zetIk(x, bron) { IK = { id: x.id, toon: x.toon || x.naam, voornaam: x.voornaam || voornaam(x), bron, link: bron === "personal_link" ? LINK : null };
    if (bron !== "personal_link") bewaar({ id: IK.id, toon: IK.toon, voornaam: IK.voornaam }); MSEL = null; laadMijn(); }
  function wissel() { bewaar(null); IK = null; MIJN = null; MSEL = null; AANP = false; TAB = "nieuw"; KR.ss = new Set(); KR.deel = null; if (KR.map) krStyleAll(); teken(); kiesLid(); }

  /* ---------- "Wie ben je?" (desktop: venster, gsm: bottom sheet) ---------- */
  function kiesLid(dan) {
    if (document.getElementById("krWie")) return;
    const bg = document.createElement("div"); bg.className = "km-bg"; bg.id = "krWie";
    bg.innerHTML = `<div class="km vb-ui krw" role="dialog" aria-modal="true" aria-labelledby="krwT"><div class="km-h"><h3 id="krwT" class="vb-acc">Wie ben je?</h3><button type="button" class="km-x" data-w="x" aria-label="Sluiten"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="krw-stap" id="krwZ"><p class="krw-t">Kies je naam om straten te reserveren en je bedeling te melden.</p>
        <div class="krw-in"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input id="krwQ" type="search" placeholder="Zoek op voornaam of familienaam" autocomplete="off" aria-label="Zoek je naam" aria-describedby="krwH"></div>
        <p class="krw-h" id="krwH">Typ minstens 3 letters.</p><ul class="krw-l" id="krwL" role="listbox" aria-label="Leden"></ul></div>
      <div class="krw-stap" id="krwB" hidden><p class="krw-ok">Je gaat verder als <b id="krwN"></b>. Klopt dit?</p>
        <div class="km-a"><button type="button" class="vb-btn2" data-w="terug">Andere naam kiezen</button><button type="button" class="vb-cta" data-w="ja">Ja, verder</button></div></div>
      <p class="krw-noot">Dit is geen aanmelding: je krijgt geen toegang tot gegevens van anderen.</p></div>`;
    document.body.appendChild(bg);
    const inp = bg.querySelector("#krwQ"), ul = bg.querySelector("#krwL"), hint = bg.querySelector("#krwH");
    let L = [], T = null, kz = null, act = -1;
    const dicht = () => { bg.remove(); document.removeEventListener("keydown", esc); };
    const esc = e => { if (e.key === "Escape") dicht(); };
    document.addEventListener("keydown", esc);
    const lijst = () => { ul.innerHTML = L.map((l, i) => `<li><button type="button" role="option" data-i="${i}" aria-selected="${i === act}" class="${i === act ? "on" : ""}">${e2(l.toon || l.naam)}</button></li>`).join(""); };
    inp.addEventListener("input", () => { clearTimeout(T); const q = inp.value.trim(); act = -1;
      if (q.replace(/\s/g, "").length < 3) { L = []; lijst(); hint.textContent = "Typ minstens 3 letters."; return; }
      hint.textContent = "Zoeken…";
      T = setTimeout(async () => { try { const r = await fetch("/api/leden?q=" + encodeURIComponent(q)); L = r.ok ? await r.json() : []; } catch (e) { L = []; }
        hint.textContent = L.length ? "" : "Geen lid gevonden. Kijk de schrijfwijze na of vraag het bestuur."; lijst(); }, 250); });
    inp.addEventListener("keydown", e => { if (!L.length) return; if (e.key === "ArrowDown") { act = Math.min(L.length - 1, act + 1); lijst(); e.preventDefault(); } else if (e.key === "ArrowUp") { act = Math.max(0, act - 1); lijst(); e.preventDefault(); } else if (e.key === "Enter" && act >= 0) { kies(L[act]); e.preventDefault(); } });
    const kies = l => { kz = l; bg.querySelector("#krwN").textContent = l.toon || l.naam; bg.querySelector("#krwZ").hidden = true; bg.querySelector("#krwB").hidden = false; setTimeout(() => bg.querySelector('[data-w="ja"]').focus(), 30); };
    bg.addEventListener("click", e => { if (e.target === bg) return dicht(); const o = e.target.closest("[data-i]"); if (o) return kies(L[+o.dataset.i]);
      const b = e.target.closest("[data-w]"); if (!b) return; const w = b.dataset.w;
      if (w === "x") return dicht();
      if (w === "terug") { kz = null; bg.querySelector("#krwZ").hidden = false; bg.querySelector("#krwB").hidden = true; inp.focus(); return; }
      if (w === "ja" && kz) { dicht(); zetIk(kz, "manual_member_selection"); if (typeof dan === "function") setTimeout(dan, 0); } });
    setTimeout(() => inp.focus(), 50);
  }
  const metIk = fn => IK ? fn() : kiesLid(fn);

  /* ---------- gegevens van de selectie ---------- */
  const isMijn = id => !!(MIJN && MIJN.teDoen.some(x => x.s === id));
  const adr = id => Number((KR.byId.get(id) || KR_DEEL.get(id) || {}).a) || 0;
  const naam = id => { const d = KR_DEEL.get(id); if (!d) return (KR.byId.get(id) || {}).n || id; const s = KR.byId.get(d.sid) || {}; try { const g = krGroepen(d.sid).find(g => g.ids.includes(id)); return `${s.n} (stuk ${g ? g.n : d.nr})`; } catch (e) { return `${s.n} (stuk ${d.nr})`; } };
  const adrT = a => `${nr(a)} ${a === 1 ? "adres" : "adressen"}`;
  const dozen = a => Math.max(1, Math.ceil(a / (PER_DOOS || 100)));
  /* selectie als lijst: hele straten, en stukken per straat samen (zoals de bestaande kaart) */
  function selRijen() {
    const out = [], SG = krSegSel();
    for (const id of KR.ss) if (KR.byId.has(id)) out.push({ id, n: KR.byId.get(id).n, a: KR.byId.get(id).a, ids: [id] });
    for (const [sid, ds] of SG) { const s = KR.byId.get(sid); if (!s) continue; let G = []; try { G = krGroepen(sid); } catch (e) { }
      const k = G.filter(g => g.ids.every(i => KR.ss.has(i))).length; out.push({ id: sid, n: s.n, a: ds.reduce((t, d) => t + d.a, 0), ids: ds.map(d => d.id), stukken: `${k} van ${G.length} stukken` }); }
    return out;
  }
  const selIds = () => [...KR.ss].filter(id => KR.byId.has(id) || KR_DEEL.has(id));
  const kanDelen = id => { try { return (KR_DELEN.get(id) || []).length > 1 && KR_STAND[id] !== "d" && krGroepen(id).length > 1; } catch (e) { return false; } };

  /* ---------- acties ---------- */
  async function reserveer(ids) {
    if (!IK) return kiesLid(() => reserveer(ids));
    ids = ids.filter(id => !isMijn(id)); if (!ids.length) { krMelding("Deze straten staan al op jouw naam."); return; }
    if (BEZIG) return; BEZIG = true; teken();
    try {
      const r = await fetch("/api/ronde", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actie: "reserveer", straten: ids, ...wieParams() }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 409 && j.conflict) { BEZIG = false; teken(); return conflict(j, ids); }
      if (!r.ok) throw new Error(j.error || "Reserveren lukte niet.");
      const a = ids.reduce((t, id) => t + adr(id), 0);
      KR.ss = new Set(); KR.deel = null; TAB = "mijn"; MSEL = null; BEZIG = false;
      await Promise.all([krLive(), laadMijn()]);
      melding("Reservatie bewaard", `${ids.length} ${ids.length === 1 ? "straat" : "straten"} · ${adrT(a)} ${ids.length === 1 ? "is" : "zijn"} aan jouw reservatie toegevoegd.`);
    } catch (e) { BEZIG = false; teken(); krMelding(e.message + " Je selectie blijft bewaard."); }
  }
  function conflict(j, ids) {
    const vrij = (j.vrij || []).filter(id => ids.includes(id));
    venster("Niet alles is nog vrij", `<p>${e2(j.error)}</p>${vrij.length ? `<ul class="km-rows">${vrij.map(id => `<li><span>${e2(naam(id))}</span><b>${nr(adr(id))}</b></li>`).join("")}</ul>` : ""}`,
      vrij.length ? [["Annuleren", "x"], [`Reserveer de andere ${vrij.length === 1 ? "straat" : vrij.length + " straten"}`, "rest"]] : [["Sluiten", "x"]],
      k => { if (k === "rest") { KR.ss = new Set(vrij); if (KR.map) krStyleAll(); reserveer(vrij); } });
    KR.ss = new Set([...KR.ss].filter(id => vrij.includes(id) || !ids.includes(id))); if (KR.map) krStyleAll(); teken();
  }
  function meld(ids) {
    if (!IK) return kiesLid(() => meld(ids));
    if (!ids.length) return;
    window.krMeldOpen("d", ids, () => { KR.ss = new Set(); MSEL = null; AANP = false; TAB = "mijn"; laadMijn(); });
  }
  async function vrijgeven(ids) {
    if (!ids.length) return;
    venster("Straten vrijgeven?", `<p>${ids.length === 1 ? "Deze straat komt" : "Deze " + ids.length + " straten komen"} terug vrij op de kaart, zodat iemand anders ze kan reserveren.</p><ul class="km-rows">${ids.map(id => `<li><span>${e2(naam(id))}</span><b>${nr(adr(id))}</b></li>`).join("")}</ul>`,
      [["Annuleren", "x"], ["Vrijgeven", "ok"]], async k => { if (k !== "ok") return;
        try { const r = await fetch("/api/ronde", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actie: "vrijgeven", straten: ids, ...wieParams() }) });
          const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Vrijgeven lukte niet.");
          AANP = false; MSEL = null; await Promise.all([krLive(), laadMijn()]); krMelding(`${(j.vrij || []).length} ${(j.vrij || []).length === 1 ? "straat" : "straten"} vrijgegeven.`);
        } catch (e) { krMelding(e.message); } });
  }

  /* ---------- kleine vensters (zelfde stijl als het meldvenster) ---------- */
  function venster(titel, html, knoppen, cb, zonderKop) {
    const bg = document.createElement("div"); bg.className = "km-bg";
    bg.innerHTML = `<div class="km vb-ui" role="dialog" aria-modal="true" aria-label="${e2(titel)}">${zonderKop ? "" : `<div class="km-h"><h3 class="vb-acc">${e2(titel)}</h3><button type="button" class="km-x" data-v="x" aria-label="Sluiten"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>`}${html}
      <div class="km-a">${knoppen.map(([t, k], i) => `<button type="button" class="${i === knoppen.length - 1 && k !== "x" ? "vb-cta" : "vb-btn2"}" data-v="${k}">${e2(t)}</button>`).join("")}</div></div>`;
    document.body.appendChild(bg);
    const dicht = () => bg.remove();
    bg.addEventListener("click", e => { if (e.target === bg) return dicht(); const b = e.target.closest("[data-v]"); if (!b) return; dicht(); if (cb) cb(b.dataset.v); });
    setTimeout(() => { const b = bg.querySelector(".km-a button:last-child"); if (b) b.focus(); }, 30);
  }
  const melding = (titel, tekst) => venster(titel, `<p class="km-okt" role="status"><i aria-hidden="true">✓</i>${e2(titel)}</p><p>${e2(tekst)}</p>`, [["Sluiten", "x"]], null, true);

  /* ---------- paneel (desktop) / bottom sheet (gsm) ---------- */
  const BADGE = { pending: ["pend", "Gemeld · controle volgt"], confirmed: ["ok", "Bevestigd"], adjusted: ["adj", "Gecontroleerd · aangepast"], rejected: ["nok", "Niet goedgekeurd"] };
  const ICX = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/></svg>';
  function kop() {
    if (!IK) return `<div class="krr-kop"><p class="krr-dag">Welkom</p><button type="button" class="krr-id" data-kr="wie">Selecteer je naam</button><p class="krr-sub">Identificeer je om straten te reserveren.</p></div>`;
    const v = voornaam(IK);
    return `<div class="krr-kop"><p class="krr-dag">Dag ${e2(v)}</p>${IK.link ? "" : `<button type="button" class="krr-wis" data-kr="wissel">Niet ${e2(v)}? Wissel van lid</button>`}</div>
      <div class="krr-tabs" role="tablist"><button type="button" role="tab" data-krtab="nieuw" aria-selected="${TAB === "nieuw"}">Nieuwe selectie</button><button type="button" role="tab" data-krtab="mijn" aria-selected="${TAB === "mijn"}">Mijn straten${MIJN ? ` (${MIJN.teDoen.length})` : ""}</button></div>`;
  }
  function nieuw() {
    const R = selRijen();
    if (!R.length) return `<p class="krr-leeg">Tik op een straat op de kaart om ze te selecteren.</p>`;
    const a = R.reduce((t, x) => t + x.a, 0), alMijn = R.every(x => x.ids.every(isMijn));
    return `<h3 class="krr-h">Jouw selectie</h3><p class="krr-sum"><b>${R.length} ${R.length === 1 ? "straat" : "straten"} · ${adrT(a)}</b><small>Geschat: ±${nr(dozen(a))} ${dozen(a) === 1 ? "doos" : "dozen"}</small></p>
      <ul class="krr-l krr-lijst">${R.map(x => `<li><span class="krr-n">${e2(x.n)}${x.stukken ? `<small>${e2(x.stukken)}</small>` : x.ids.every(isMijn) ? "<small>al op jouw naam</small>" : ""}${kanDelen(x.id) ? `<button type="button" class="krr-deel" data-krdeel="${e2(x.id)}">Deel kiezen</button>` : ""}</span><span class="krr-a">${nr(x.a)}</span><button type="button" class="krr-x" data-krweg="${e2(x.id)}" aria-label="${e2(x.n)} uit de selectie halen" title="Uit de selectie halen">${ICX}</button></li>`).join("")}</ul>
      ${alMijn ? `<p class="krr-uit">Deze straten staan al op jouw naam.</p><button type="button" class="vb-cta krr-go" data-kr="meldsel">Als bedeeld melden</button>`
        : `<p class="krr-uit">Reserveer deze straten voor jouw ronde.</p><button type="button" class="vb-cta krr-go" data-kr="reserveer"${BEZIG ? " disabled" : ""}>${BEZIG ? "Bezig…" : "Reserveren"}</button><button type="button" class="krr-link" data-kr="meldsel">Al bedeeld? Meld als bedeeld</button>`}
      <button type="button" class="vb-tert krr-wisx" data-kr="wis">${ICW}Selectie wissen</button>`;
  }
  function mijn() {
    if (!MIJN) return `<p class="krr-leeg">Even laden…</p>`;
    const D = MIJN.teDoen, sel = MSEL || new Set(D.map(x => x.s)), a = D.reduce((t, x) => t + adr(x.s), 0);
    let h = `<section class="krr-sec"><div class="krr-sh"><h3 class="krr-h">${gsm() ? "Jouw reservatie" : "Te doen"}</h3>${D.length ? `<span class="krr-bd res">Door jou gereserveerd</span>` : ""}</div>`;
    if (!D.length) h += `<p class="krr-leeg">Je hebt geen gereserveerde straten meer. Kies straten op de kaart via <button type="button" class="krr-link in" data-krtab="nieuw">Nieuwe selectie</button>.</p>`;
    else {
      const n = sel.size, alle = n === D.length;
      h += `<p class="krr-sum"><b>${D.length} ${D.length === 1 ? "straat" : "straten"} · ${adrT(a)}</b><small>Geschat: ±${nr(dozen(a))} ${dozen(a) === 1 ? "doos" : "dozen"}</small></p>
        <ul class="krr-l krr-lijst krr-c">${D.map(x => { const on = sel.has(x.s); return `<li><button type="button" class="krr-ck${on ? " on" : ""}" role="checkbox" aria-checked="${on}" data-krsel="${e2(x.s)}" aria-label="${e2(naam(x.s))} selecteren"></button><button type="button" class="krr-n krr-zoom" data-krzoom="${e2(x.s)}">${e2(naam(x.s))}</button><span class="krr-a">${nr(adr(x.s))}</span></li>`; }).join("")}</ul>`;
      if (AANP) h += `<p class="krr-uit">Duid de straten aan die je wil vrijgeven.</p><button type="button" class="vb-cta krr-go" data-kr="vrij"${n ? "" : " disabled"}>${n ? `${n} ${n === 1 ? "straat" : "straten"} vrijgeven` : "Duid straten aan"}</button><div class="krr-rij"><button type="button" class="krr-link" data-krtab="nieuw">Straten toevoegen</button><button type="button" class="krr-link" data-kr="aanpuit">Klaar</button></div>`;
      else h += `<p class="krr-uit">Selecteer straten of meld alles als bedeeld.</p><button type="button" class="vb-cta krr-go" data-kr="meldmijn"${n ? "" : " disabled"}>${alle ? "Alles als bedeeld melden" : n ? `${n} ${n === 1 ? "straat" : "straten"} als bedeeld melden` : "Duid straten aan"}</button><button type="button" class="krr-link" data-kr="aanp">Reservatie aanpassen</button>`;
    }
    h += `</section>`;
    const blok = (titel, L, af) => !L.length ? "" : `<section class="krr-sec krr-lijst"><h3 class="krr-h2">${titel}</h3><ul class="krr-ml">${L.map(m => { const [c, t] = BADGE[m.controle] || ["", ""];
      return `<li><div class="krr-mt"><span>${e2(m.straten.map(naam).join(", "))}</span><span class="krr-bd ${c}">${t}</span></div><small>Gemeld door jou: <b>${nr(m.gemeld)}</b>${af && m.bevestigd != null ? ` · Bevestigd door bestuur: <b>${nr(m.bevestigd)}</b>` : ""}</small></li>`; }).join("")}</ul></section>`;
    h += blok("Gemeld", MIJN.gemeld, false) + blok("Afgewerkt", [...MIJN.afgewerkt, ...MIJN.afgewezen].sort((x, y) => String(y.op).localeCompare(String(x.op))), true);
    return h;
  }
  /* het bestaande paneel (#krCard) blijft de houder; enkel de deelmodus (stukken kiezen) gebruikt nog de oude inhoud */
  const _card = krCard;
  krCard = function () {
    const c = $("#krCard"); if (!c) return;
    let R = $("#krR"); if (!R) { R = document.createElement("div"); R.id = "krR"; R.className = "krr"; c.appendChild(R); }
    if (KR.deel) { c.classList.remove("krr-aan"); R.hidden = true; return _card.apply(this, arguments); }
    c.hidden = false; c.classList.add("krr-aan"); R.hidden = false;
    const open = KR.lijstOpen ?? true; c.classList.toggle("open", !!open); c.classList.add("rij");
    R.innerHTML = kop() + `<div class="krr-body">${IK && TAB === "mijn" ? mijn() : nieuw()}</div>`;
    navTeken(); tip();
  };
  window.krCard = krCard;
  function teken() { try { krCard(); if (KR.map) krStyleAll(); } catch (e) { console.warn(e); } }

  /* ---------- kaart: klikken volgt de flow; eigen straten zijn selecteerbaar in "Mijn straten" ---------- */
  const _tog = krToggle;
  krToggle = function (id) {
    if (TAB === "mijn" && isMijn(id)) { const D = MIJN.teDoen.map(x => x.s); MSEL = MSEL || new Set(D); MSEL.has(id) ? MSEL.delete(id) : MSEL.add(id); teken(); return; }
    if (TAB === "mijn") TAB = "nieuw";
    if (!KR.ss.has(id) && KR_STAND[id] === "r" && !isMijn(id)) { krMelding(((KR.byId.get(id) || {}).n || "Deze straat") + " is al gereserveerd."); return; }
    return _tog.apply(this, arguments);
  };
  window.krToggle = krToggle;
  /* in "Mijn straten": de eigen straten in het rood (huidige selectie), de rest zoals altijd */
  const _st = krStyleAll;
  krStyleAll = function () { _st.apply(this, arguments); try {
    if (IK && TAB === "mijn" && MIJN && KR.map) { const w = krDikte(KR.map.getZoom()), sel = MSEL || new Set(MIJN.teDoen.map(x => x.s));
      for (const s of sel) { const l = KR.lines.get(s); if (l) { l.setStyle({ color: krVar("--kr-sel") || "#D0121B", weight: w[2] }); l.bringToFront(); } } }
    const p = document.querySelector(".kr-leg-p"); if (p) p.hidden = !Object.keys(KR_PEND || {}).length;
  } catch (e) { } };
  window.krStyleAll = krStyleAll;

  /* ---------- kopbalk (desktop) en navigatie onderaan (gsm) ---------- */
  function navTeken() {
    const n = MIJN ? MIJN.teDoen.length : 0, badge = n ? `<span class="krn-b" aria-label="${n} te doen">${n}</span>` : "";
    let nav = $("#krNav"); if (!nav) { const h = $(".hdr .in"); if (!h) return; nav = document.createElement("nav"); nav.id = "krNav"; nav.className = "krn"; nav.setAttribute("aria-label", "Kalenderronde"); const lg = h.querySelector(".logo-a"); lg ? lg.after(nav) : h.prepend(nav); }
    nav.innerHTML = `<button type="button" data-krnav="kaart" aria-current="${TAB === "mijn" ? "false" : "page"}">Kaart</button><button type="button" data-krnav="mijn" aria-current="${TAB === "mijn" ? "page" : "false"}">Mijn straten${badge}</button>`;
    let bn = $("#krBnav"); if (!bn) { bn = document.createElement("nav"); bn.id = "krBnav"; bn.className = "krbn"; bn.setAttribute("aria-label", "Kalenderronde"); document.body.appendChild(bn); document.body.classList.add("krbn-aan"); }
    bn.innerHTML = `<button type="button" data-krnav="kaart" aria-current="${TAB === "mijn" ? "false" : "page"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4zM9 4v13M15 6.5v13"/></svg>Kaart</button><button type="button" data-krnav="mijn" aria-current="${TAB === "mijn" ? "page" : "false"}"><span class="krbn-i"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg>${badge}</span>Mijn straten</button>`;
  }
  function tip() { let t = $("#krTip"); const toon = !KR.ss.size && TAB !== "mijn" && !KR.deel;
    if (!t) { t = document.createElement("div"); t.id = "krTip"; t.className = "krtip"; t.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>Tip: tik op een straat om te selecteren'; const h = $(".kr-host"); if (h) h.appendChild(t); }
    t.hidden = !toon; }

  /* ---------- klikken ---------- */
  document.addEventListener("click", e => {
    const nv = e.target.closest("[data-krnav]");
    if (nv) { const k = nv.dataset.krnav; if (k === "mijn") metIk(() => { TAB = "mijn"; KR.lijstOpen = true; teken(); }); else { TAB = "nieuw"; AANP = false; if (gsm()) KR.lijstOpen = !!KR.ss.size; teken(); } return; }
    const tb = e.target.closest("[data-krtab]"); if (tb) { TAB = tb.dataset.krtab; AANP = false; if (TAB === "mijn") laadMijn(); teken(); return; }
    const w = e.target.closest("[data-krweg]"); if (w) { const id = w.dataset.krweg; KR.ss.delete(id); for (const d of KR_DELEN.get(id) || []) KR.ss.delete(d.id); if (KR.map) krStyleAll(); teken(); return; }
    const s = e.target.closest("[data-krsel]"); if (s) { const D = MIJN.teDoen.map(x => x.s); MSEL = MSEL || (AANP ? new Set() : new Set(D)); const id = s.dataset.krsel; MSEL.has(id) ? MSEL.delete(id) : MSEL.add(id); teken(); return; }
    const z = e.target.closest("[data-krzoom]"); if (z) { const id = z.dataset.krzoom, d = KR_DEEL.get(id); krZoomTo(d ? d.sid : id); return; }
    const b = e.target.closest("[data-kr]"); if (!b) return; const k = b.dataset.kr;
    if (k === "wie") return kiesLid();
    if (k === "wissel") return wissel();
    if (k === "reserveer") return reserveer(selIds());
    if (k === "meldsel") return meld(selIds());
    if (k === "meldmijn") { const D = MIJN.teDoen.map(x => x.s); return meld(D.filter(s => !MSEL || MSEL.has(s))); }
    if (k === "aanp") { AANP = true; MSEL = new Set(); teken(); return; }
    if (k === "aanpuit") { AANP = false; MSEL = null; teken(); return; }
    if (k === "vrij") return vrijgeven([...(MSEL || [])]);
    if (k === "wis") { KR.ss = new Set(); KR.deel = null; if (KR.map) krStyleAll(); teken(); }
  });

  /* ---------- opstart ---------- */
  if (LINK) {
    fetch(`/api/ronde?ik=1&l=${encodeURIComponent(LINK.l)}&j=${encodeURIComponent(LINK.j)}&t=${encodeURIComponent(LINK.t)}`, { cache: "no-store" }).then(r => r.ok ? r.json() : {})
      .then(x => { if (x && x.id) zetIk(x, "personal_link"); else { const o = lees(); if (o && o.id) zetIk(o, "manual_member_selection"); else teken(); } }).catch(() => teken());
  } else { const o = lees(); if (o && o.id) zetIk(o, "manual_member_selection"); }
  /* na elke verversing van de stand ook "Mijn straten" bijwerken (gemeld → bevestigd, …) */
  const _live = krLive; let tel = 0;
  krLive = async function () { const r = await _live.apply(this, arguments); if (IK && ++tel % 2 === 0) laadMijn(); return r; };
  window.krLive = krLive;
  teken();

  /* ---------- stijl (huisstijl: donkere kop, rood = primaire actie en huidige selectie, blauw = gereserveerd, groen = bedeeld) ---------- */
  const st = document.createElement("style");
  st.textContent = `
#krCard.krr-aan>:not(#krR):not(.kr-grip){display:none!important}
.krr{display:flex;flex-direction:column;gap:0}
.krr-kop{display:flex;flex-direction:column;gap:2px;margin:0 0 8px}
.krr-dag{margin:0;font-size:15px;color:var(--muted)}
.krr-wis,.krr-id,.krr-link,.krr-deel{all:unset;cursor:pointer;color:var(--info);font-size:13.5px;text-decoration:underline;text-underline-offset:2px;text-decoration-thickness:1px}
.krr-id{font-size:16px;font-weight:600;color:var(--accent);margin-top:2px}.krr-sub{margin:0;font-size:13px;color:var(--muted)}
.krr-wis{align-self:flex-start;font-size:12.5px;color:var(--muted)}
.krr-link{display:block;text-align:center;margin:10px auto 0;font-size:14px}.krr-link.in{display:inline;margin:0}
.krr-wis:focus-visible,.krr-id:focus-visible,.krr-link:focus-visible,.krr-deel:focus-visible{outline:2px solid var(--ink);outline-offset:2px;border-radius:4px}
.krr-tabs{display:flex;gap:18px;border-bottom:1px solid var(--vb-line,var(--line));margin:4px 0 12px}
.krr-tabs button{all:unset;cursor:pointer;padding:8px 2px 10px;font-size:15px;color:var(--muted);border-bottom:2px solid transparent;margin-bottom:-1px}
.krr-tabs button[aria-selected=true]{color:var(--ink);font-weight:600;border-color:var(--accent)}
.krr-tabs button:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.krr-h{margin:0;font:650 18px/1.25 var(--f-display,inherit);padding-left:12px;border-left:4px solid var(--accent)}
.krr .krr-h2{margin:18px 0 6px;font-size:12px;font-weight:650;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.krr-sh{display:flex;align-items:center;justify-content:space-between;gap:8px}
.krr-sum{display:flex;flex-direction:column;gap:1px;margin:10px 0 8px}.krr-sum b{font-size:15px;font-weight:600}.krr-sum small{font-size:13px;color:var(--muted)}
.krr-l{list-style:none;margin:0;padding:0;border-top:1px solid var(--vb-line,var(--line));max-height:min(32vh,260px);overflow:auto}
.krr-l li{display:flex;align-items:center;gap:10px;min-height:44px;padding:6px 0;border-bottom:1px solid var(--vb-line,var(--line));box-sizing:border-box}
.krr-n{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:1px;font-size:14.5px;text-align:left}.krr-n small{font-size:12px;color:var(--muted)}
button.krr-n{all:unset;flex:1;min-width:0;cursor:pointer;font-size:14.5px}button.krr-n:hover{text-decoration:underline}
.krr-deel{font-size:13px}
.krr-a{font-variant-numeric:tabular-nums;font-size:14px;min-width:36px;text-align:right}
.krr-x{all:unset;width:32px;height:32px;display:grid;place-items:center;border-radius:8px;color:var(--muted);cursor:pointer;flex:none}.krr-x:hover{background:var(--vb-subtle,#f1f2f3);color:var(--ink)}.krr-x svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
.krr-x:focus-visible{outline:2px solid var(--ink)}
.krr-ck{all:unset;flex:none;width:20px;height:20px;border-radius:50%;border:1.5px solid #B9BCC2;box-sizing:border-box;cursor:pointer;display:grid;place-items:center;position:relative}
.krr-ck::after{content:"";position:absolute;inset:-12px}
.krr-ck.on{border-color:var(--accent);background:var(--accent)}.krr-ck.on::before{content:"";width:8px;height:8px;border-radius:50%;background:#fff}
.krr-ck:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
.krr-uit{margin:12px 0 8px;font-size:13.5px;color:var(--muted)}
.krr-go{width:100%}
.krr-go:disabled{opacity:.55;cursor:default}
.krr-rij{display:flex;justify-content:center;gap:20px}.krr-rij .krr-link{margin:10px 0 0}
.krr-wisx{margin-top:12px;padding-top:12px!important;border-top:1px solid var(--vb-line,var(--line))!important;border-radius:0!important;width:100%;justify-content:flex-start}
.krr-leeg{margin:6px 0 4px;font-size:14px;color:var(--muted)}
.krr-bd{display:inline-flex;align-items:center;white-space:nowrap;padding:3px 8px;border-radius:6px;font-size:12px;font-weight:600;line-height:1.2}
.krr-bd.res{background:var(--info-soft);color:var(--info)}.krr-bd.pend{background:#FEF3E2;color:#9A5B00}.krr-bd.ok{background:var(--good-soft);color:var(--good)}.krr-bd.adj{background:var(--good-soft);color:var(--good)}.krr-bd.nok{background:var(--bad-soft);color:var(--bad)}
.krr-ml{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.krr-ml li{border:1px solid var(--vb-line,var(--line));border-radius:10px;padding:8px 10px;display:flex;flex-direction:column;gap:4px}
.krr-mt{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;font-size:14px}.krr-mt>span:first-child{min-width:0}
.krr-ml small{font-size:12.5px;color:var(--muted)}.krr-ml small b{color:var(--ink);font-weight:600}
.km .krr-bd{margin-top:2px}
.km .km-aant{margin-top:10px;padding-top:10px;border-top:1px solid var(--vb-line,var(--line))}
.km .km-aant label.km-dl{display:flex;flex-direction:column;margin:0;gap:1px}.km .km-aant label.km-dl small{font-weight:400;font-size:12.5px;color:var(--muted)}
.km .km-aant .vb-qty>input{width:56px!important}
/* "Wie ben je?" */
.krw .krw-t{margin:0 0 10px;color:var(--muted);font-size:14px}
.krw-in{display:flex;align-items:center;gap:8px;height:46px;padding:0 12px;border:1px solid var(--vb-line,var(--line));border-radius:10px;background:var(--surface)}
.krw-in:focus-within{border-color:var(--ink);box-shadow:0 0 0 3px rgba(24,25,28,.12)}
.krw-in svg{width:18px;height:18px;flex:none;fill:none;stroke:var(--muted);stroke-width:2;stroke-linecap:round}
.krw-in input{all:unset;flex:1;min-width:0;font-size:16px}
.krw-h{margin:6px 0 0;font-size:12.5px;color:var(--muted);min-height:1em}
.krw-l{list-style:none;margin:6px 0 0;padding:0;max-height:min(40dvh,300px);overflow:auto}
.krw-l button{all:unset;box-sizing:border-box;display:block;width:100%;padding:12px;border-radius:8px;cursor:pointer;font-size:15px}
.krw-l button:hover,.krw-l button.on{background:var(--vb-subtle,#f1f2f3)}.krw-l button:focus-visible{outline:2px solid var(--ink);outline-offset:-2px}
.krw-ok{margin:4px 0 0;font-size:15px;color:var(--ink)!important}
.krw-noot{margin:14px 0 0!important;font-size:12px!important;color:var(--muted)!important}
/* kopbalk: Kaart | Mijn straten */
.krn{display:flex;align-items:stretch;gap:22px;height:100%;margin-left:28px}
.krn button{all:unset;cursor:pointer;display:flex;align-items:center;gap:8px;color:rgba(255,255,255,.78);font-size:15px;font-weight:500;border-bottom:2px solid transparent;padding-top:2px;box-sizing:border-box}
.krn button[aria-current=page]{color:#fff;border-color:#E0313A}.krn button:hover{color:#fff}.krn button:focus-visible{outline:2px solid #fff;outline-offset:2px}
.krn-b{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 6px;box-sizing:border-box;border-radius:99px;background:#D0121B;color:#fff;font-size:12px;font-weight:650;font-variant-numeric:tabular-nums}
body .hdr .in{height:56px}
.krbn{display:none}
/* tip onderaan de kaart */
.krtip{position:absolute;z-index:900;left:50%;bottom:16px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:99px;background:var(--surface);border:1px solid var(--vb-line,var(--line));box-shadow:0 2px 8px rgba(17,18,20,.08);font-size:13px;color:var(--muted);white-space:nowrap;pointer-events:none}
.krtip svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
/* desktop: paneel links onder de zoekbalk (mock-up) */
@media (min-width:641px){
  body .kr-card.krr-aan{top:66px;bottom:auto;max-height:calc(100% - 78px);width:330px;padding:18px 18px 16px}
  .krtip{left:calc(50% + 175px)}
}
/* gsm: navigatie onderaan, het paneel is een bottom sheet erboven */
@media (max-width:640px){
  .krn{display:none}
  .krbn{display:grid;grid-template-columns:1fr 1fr;position:fixed;z-index:1200;left:0;right:0;bottom:0;height:calc(58px + env(safe-area-inset-bottom,0px));padding-bottom:env(safe-area-inset-bottom,0px);background:var(--surface);border-top:1px solid var(--vb-line,var(--line));box-sizing:border-box}
  .krbn button{all:unset;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:12px;font-weight:500;color:var(--muted);border-top:2px solid transparent;margin-top:-1px}
  .krbn button[aria-current=page]{color:var(--accent);border-color:var(--accent)}
  .krbn button:focus-visible{outline:2px solid var(--ink);outline-offset:-4px}
  .krbn svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  .krbn-i{position:relative;display:block;height:22px}.krbn-i .krn-b{position:absolute;top:-6px;right:-14px;min-width:18px;height:18px;font-size:11px}
  body.krbn-aan .kr-host{padding-bottom:0}
  body.krbn-aan .kr-card{bottom:calc(58px + env(safe-area-inset-bottom,0px))!important}
  body.krbn-aan .kr-zoom{bottom:calc(var(--kr-sheet,0px) + 68px + env(safe-area-inset-bottom,0px))!important}
  body .kr-card.krr-aan{max-height:min(62dvh,calc(100% - 130px))}
  body .kr-card.krr-aan:not(.open) .krr-lijst,body .kr-card.krr-aan:not(.open) .krr-wisx,body .kr-card.krr-aan:not(.open) .krr-sum small,body .kr-card.krr-aan:not(.open) .krr-uit{display:none}
  body .kr-card.krr-aan:not(.open) .krr-tabs{margin-bottom:8px}
  .krr-kop{margin-bottom:4px}.krr-dag{font-size:14px}
  .krr-l{max-height:min(26dvh,220px)}
  .krtip{display:none}
  body.krbn-aan #krToast{bottom:calc(var(--kr-sheet,0px) + 74px + env(safe-area-inset-bottom,0px))!important}
}
@media (prefers-color-scheme:dark){.krr-bd.pend{background:#33290F;color:#F0C04F}.krr-ck{border-color:#5A5D63}}
`;
  document.head.appendChild(st);
})();
