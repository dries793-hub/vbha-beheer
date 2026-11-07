/* VBHA – adressen automatisch aanvullen (Adressenregister Vlaanderen via /api/adres).
   Werkt op elk veld met data-adres, name="adres", id="adres" of id="straat" (dan met id="gemeente" of data-adres-gemeente als tweede veld).
   Eén veld: "Kerkstraat 1, 9300 Aalst". Twee velden: "Kerkstraat 1" + "9300 Aalst". */
(function () {
  "use strict";
  if (window.__vbhaAdres) return; window.__vbhaAdres = true;
  const SEL = 'input[data-adres],input[name="adres"],input#adres,input#straat';
  let box = null, inp = null, L = [], sel = -1, timer = 0, nr = 0, gekozenStraat = null;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const css = `.adr-box{position:fixed;z-index:100000;background:#fff;border:1px solid #d0d0d0;border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.16);overflow:hidden;max-height:300px;overflow-y:auto;font:14.5px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1c1c1c}
.adr-i{display:flex;flex-direction:column;gap:1px;width:100%;text-align:left;padding:9px 12px;border:0;background:none;cursor:pointer;font:inherit;color:inherit}
.adr-i+.adr-i{border-top:1px solid #f0f0f0}.adr-i b{font-weight:600}.adr-i small{color:#6b6b6b;font-size:12.5px}
.adr-i.on,.adr-i:hover{background:#f6efe9}.adr-v{padding:6px 12px;font-size:11px;color:#8a8a8a;background:#fafafa;border-top:1px solid #f0f0f0}
@media (prefers-color-scheme:dark){.adr-box{background:#1f1f1f;color:#eee;border-color:#3a3a3a}.adr-i+.adr-i,.adr-v{border-color:#2c2c2c}.adr-v{background:#191919}.adr-i.on,.adr-i:hover{background:#2c2622}}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  const tweede = i => { if (i.id === "straat") return document.getElementById("gemeente"); const s = i.getAttribute("data-adres-gemeente"); return s ? document.querySelector(s) : null; };
  function sluit() { if (box) box.remove(); box = null; L = []; sel = -1; }
  function plaats() { if (!box || !inp) return; const r = inp.getBoundingClientRect(); box.style.left = r.left + "px"; box.style.top = r.bottom + 4 + "px"; box.style.width = Math.max(260, r.width) + "px"; }
  function toon() {
    if (!L.length) { sluit(); return; }
    if (!box) { box = document.createElement("div"); box.className = "adr-box"; box.setAttribute("role", "listbox"); document.body.appendChild(box); box.addEventListener("mousedown", e => e.preventDefault()); box.addEventListener("click", e => { const b = e.target.closest(".adr-i"); if (b) kies(+b.dataset.i); }); }
    box.innerHTML = L.map((x, i) => `<button type="button" class="adr-i${i === sel ? " on" : ""}" role="option" data-i="${i}"><b>${esc(x.s)}${x.n ? " " + esc(x.n) : ""}</b><small>${esc(x.p)} ${esc(x.g)}${x.n ? "" : " · daarna huisnummer"}</small></button>`).join("") + `<div class="adr-v">Adressen uit het Adressenregister (Vlaanderen)</div>`;
    plaats();
  }
  function zet(el, v) { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }
  function kies(i) {
    const x = L[i]; if (!x || !inp) return; const g = tweede(inp), pg = (x.p + " " + x.g).trim();
    if (!x.n) { // enkel straat: huisnummer zelf aanvullen
      gekozenStraat = { s: x.s, pg };
      zet(inp, x.s + " "); if (g) zet(g, pg);
      sluit(); inp.focus(); const n = inp.value.length; try { inp.setSelectionRange(n, n); } catch (e) {} return;
    }
    gekozenStraat = null;
    if (g) { zet(inp, x.s + " " + x.n); zet(g, pg); } else zet(inp, `${x.s} ${x.n}, ${pg}`);
    sluit();
  }
  async function zoek(el) {
    let q = el.value.trim(); const g = tweede(el);
    if (g && g.value.trim() && !/\d{4}/.test(q)) q += " " + g.value.trim();
    else if (gekozenStraat && el.value.startsWith(gekozenStraat.s) && !/\d{4}/.test(q)) q += " " + gekozenStraat.pg;
    if (q.length < 3 || !/[a-zà-ÿ]{2}/i.test(q)) { sluit(); return; }
    const n = ++nr;
    try { const r = await fetch("/api/adres?q=" + encodeURIComponent(q)); const j = r.ok ? await r.json() : []; if (n !== nr || document.activeElement !== el) return; L = Array.isArray(j) ? j : []; sel = -1; inp = el; toon(); }
    catch (e) { if (n === nr) sluit(); }
  }
  document.addEventListener("input", e => { const el = e.target; if (!(el instanceof HTMLInputElement) || !el.matches(SEL) || e.isTrusted === false) return; inp = el; clearTimeout(timer); timer = setTimeout(() => zoek(el), 220); });
  document.addEventListener("keydown", e => {
    if (!box || e.target !== inp) return;
    if (e.key === "ArrowDown") { e.preventDefault(); sel = (sel + 1) % L.length; toon(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = (sel - 1 + L.length) % L.length; toon(); }
    else if (e.key === "Enter" && sel >= 0) { e.preventDefault(); kies(sel); }
    else if (e.key === "Escape") { e.stopPropagation(); sluit(); }
  }, true);
  document.addEventListener("focusout", e => {
    if (e.target !== inp) return; setTimeout(() => { if (document.activeElement !== inp) sluit(); }, 120);
    // straat gekozen en huisnummer getypt maar geen voorstel aangeklikt: postcode en gemeente toch aanvullen (één veld)
    const el = e.target; if (gekozenStraat && !tweede(el) && el.value.startsWith(gekozenStraat.s) && !/\d{4}/.test(el.value)) { zet(el, el.value.trim().replace(/,\s*$/, "") + ", " + gekozenStraat.pg); gekozenStraat = null; }
  });
  window.addEventListener("resize", plaats); window.addEventListener("scroll", plaats, true);
  document.addEventListener("focusin", e => { const el = e.target; if (el instanceof HTMLInputElement && el.matches(SEL)) { el.setAttribute("autocomplete", "off"); } });
})();
