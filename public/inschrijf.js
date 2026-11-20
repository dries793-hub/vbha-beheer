/* ============ VBHA inschrijfpagina's: gedeelde bouwstenen (bij inschrijf.css) ============
   VB.icon(naam)                       kleine lijniconen (kalender, locatie, klok, mensen, info, vuilbak)
   VB.eur2(bedrag)                     bedrag altijd met 2 decimalen ("€42,50")
   VB.info()                           iconen bij de tegels Wanneer / Waar
   VB.meta(el, [{icon, html}])         compacte metaregels onder de tegels (deadline, doelgroep)
   VB.notice(tekst)                    neutrale melding (bv. "Welkom terug! …")
   VB.badge(status)                    statusbadge (Goud, Zilver, Brons, Basis)
   VB.credit                           punten/tegoed: één component voor alle pagina's
   VB.summary({...})                   prijsoverzicht "Overzicht … Te betalen"
   VB.dmy(iso) / VB.iso(tekst) / VB.datumVeld(input)   datums als DD/MM/JJJJ tonen, als JJJJ-MM-DD bewaren */
(function(){
  const S='<svg viewBox="0 0 24 24" aria-hidden="true">';
  const IC={kal:S+'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    pin:S+'<path d="M12 21s-7-6.1-7-11.4A7 7 0 0 1 19 9.6C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.6" r="2.6"/></svg>',
    klok:S+'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    mensen:S+'<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c.6-3.3 3.1-5 6-5s5.4 1.7 6 5"/><path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.7c1.8.6 3 2.2 3.5 4.8"/></svg>',
    info:S+'<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.4"/></svg>',
    vuilbak:S+'<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.8 12.5h9.4L17.5 7M10 11v5.5M14 11v5.5"/></svg>'};
  const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const eur2=n=>"€\u00a0"+(Number(n)||0).toLocaleString("nl-BE",{minimumFractionDigits:2,maximumFractionDigits:2});
  const stNaam=s=>!s?"":s==="GEEN"?"Basis":s.charAt(0)+s.slice(1).toLowerCase();
  const VB={icon:n=>IC[n]||"",eur2,esc};

  /* praktische info: icoon bij Wanneer / Waar */
  VB.info=()=>{for(const sp of document.querySelectorAll(".fact>span")){if(sp.querySelector("svg"))continue;const t=sp.textContent.trim().toLowerCase();
    const n=t.startsWith("wanneer")?"kal":t.startsWith("waar")?"pin":"";if(n)sp.insertAdjacentHTML("afterbegin",IC[n])}};
  VB.meta=(el,L)=>{if(!el)return;el.innerHTML=L.filter(x=>x&&x.html).map(x=>`<div class="vb-meta">${IC[x.icon]||""}<span>${x.html}</span></div>`).join("");el.hidden=!el.innerHTML};
  VB.notice=t=>`<div class="vb-notice" role="status">${IC.info}<span>${t}</span></div>`;
  VB.badge=s=>s?`<span class="vb-badge st-${esc(String(s).toLowerCase())}">${esc(stNaam(s))}</span>`:"";

  /* ---- punten / tegoed ----
     Staat: aan (schakelaar), bedrag (null = maximum), ander (eigen bedrag tonen). De pagina zet VB.credit.op = upd-functie. */
  const C={aan:true,bedrag:null,ander:false,op:null,label:"Punten gebruiken"};
  C.gebruik=max=>max>0&&C.aan?Math.round(Math.max(0,Math.min(max,C.bedrag==null?max:C.bedrag))*100)/100:0;
  /* PointsControl: [schakelaar] Punten gebruiken ……… − € 42,50
                         € 42,50 beschikbaar ………… Aanpassen */
  C.rij=(saldo,max)=>{const g=C.gebruik(max);
    return `<div class="vb-r credit vb-pc"><label class="vb-pc-sw"><input type="checkbox" id="vbcAan" data-vbc="aan"${C.aan?" checked":""}><i aria-hidden="true"></i></label>
      <label class="vb-pc-t" for="vbcAan">${esc(C.label)}</label><b class="${g>0?"":"nul"}">${g>0?"− "+eur2(g):eur2(0)}</b>
      <small class="vb-pc-s">${eur2(saldo)} beschikbaar</small>
      <span class="vb-pc-a">${C.aan?(C.ander?`<span class="vb-cin">€<input data-vbc="in" type="text" inputmode="decimal" value="${g.toFixed(2).replace(".",",")}" aria-label="Bedrag ${esc(C.label.toLowerCase())}"></span>`:`<button type="button" class="vb-aanp" data-vbc="aanp">Aanpassen</button>`):""}</span></div>`};
  VB.credit=C;
  document.addEventListener("change",e=>{const t=e.target.closest("[data-vbc]");if(!t)return;
    if(t.dataset.vbc==="aan"){C.aan=t.checked;C.op&&C.op()}
    else if(t.dataset.vbc==="in"){const v=Number(String(t.value).replace(/\s|€/g,"").replace(",","."));C.bedrag=isFinite(v)&&v>=0?v:null;C.op&&C.op()}});
  document.addEventListener("click",e=>{const t=e.target.closest('[data-vbc="aanp"]');if(!t)return;e.preventDefault();C.ander=true;C.op&&C.op();
    const i=document.querySelector('[data-vbc="in"]');if(i){i.focus();i.select()}});
  document.addEventListener("keydown",e=>{if(e.target.matches&&e.target.matches('[data-vbc="in"]')&&e.key==="Enter"){e.preventDefault();e.target.blur()}});

  /* ---- prijsoverzicht ----
     rijen: [{label, sub, status, bedrag, min:true}] · credit: {saldo, max} · totaal: {label, bedrag} */
  VB.summary=({titel="Overzicht",rijen=[],credit=null,totaal=null})=>{
    const r=rijen.filter(Boolean).map(x=>`<div class="vb-r${x.status?" korting st-"+esc(String(x.status).toLowerCase()):""}"><span>${esc(x.label)}${x.status?" "+VB.badge(x.status):""}${x.sub?`<small>${esc(x.sub)}</small>`:""}</span><b>${x.min?"− ":""}${eur2(x.bedrag)}</b></div>`).join("");
    const c=credit&&credit.max>0?C.rij(credit.saldo,credit.max):"";
    const t=totaal?`<div class="vb-tot"><span>${esc(totaal.label||"Te betalen")}</span><b>${eur2(totaal.bedrag)}</b></div>`:"";
    return `${titel?`<p class="vb-sum-t">${esc(titel)}</p>`:""}<div class="vb-sum">${r}${c}${t}</div>`};

  /* ---- afrekenbalk: "Te betalen" + bedrag (bedrag null = verbergen); korte visuele tik bij een wijziging ---- */
  VB.due=(el,bedrag)=>{if(!el)return;if(bedrag==null){el.hidden=true;return}el.hidden=false;const b=el.querySelector("b");const t=eur2(bedrag);
    if(b.textContent!==t){if(b.textContent&&!matchMedia("(prefers-reduced-motion: reduce)").matches){b.classList.add("vb-tik");setTimeout(()=>{b.textContent=t;b.classList.remove("vb-tik")},110)}else b.textContent=t}};
  /* ---- afrekenbalk die het bestaande totaal van de pagina toont (data-due-from="selector"); de pagina rekent zelf ---- */
  {let q=0;const run=()=>{q=0;document.querySelectorAll(".vb-checkout[data-due-from]").forEach(c=>{const due=c.querySelector(".vb-due");if(!due)return;const src=document.querySelector(c.dataset.dueFrom);
      const t=src?src.textContent.replace(/\s+/g," ").trim():"";if(!t||!/\d/.test(t)){due.hidden=true;return}due.hidden=false;const b=due.querySelector("b");if(b.textContent!==t)b.textContent=t})};
    new MutationObserver(()=>{if(!q)q=requestAnimationFrame(run)}).observe(document.documentElement,{subtree:true,childList:true,characterData:true});document.addEventListener("DOMContentLoaded",run)}
  /* ---- foutmelding bij het veld (FieldError) ---- */
  VB.wisFouten=root=>{(root||document).querySelectorAll(".veld-fout").forEach(x=>x.remove());(root||document).querySelectorAll('[aria-invalid="true"],.is-fout').forEach(x=>{x.removeAttribute("aria-invalid");x.classList.remove("is-fout")})};
  VB.veldFout=(el,tekst,{focus=true}={})=>{if(!el)return;const box=el.closest("fieldset,.vb-veld,.kid>div,.full")||el.parentElement;box.querySelectorAll(".veld-fout").forEach(x=>x.remove());
    const id="vf"+Math.random().toString(36).slice(2,7),p=document.createElement("p");p.className="veld-fout";p.id=id;p.setAttribute("role","alert");p.textContent=tekst;box.append(p);
    const ctl=el.matches("input,textarea,select")?el:el.querySelector(".ch,.opts,.bm,.stp")||el;ctl.classList.add("is-fout");
    (ctl.matches("input,textarea,select")?[ctl]:ctl.querySelectorAll("input")).forEach(i=>{i.setAttribute("aria-invalid","true");i.setAttribute("aria-describedby",id)});
    const wis=()=>{p.remove();ctl.classList.remove("is-fout");box.querySelectorAll("[aria-invalid]").forEach(i=>i.removeAttribute("aria-invalid"))};box.addEventListener("change",wis,{once:true});box.addEventListener("input",wis,{once:true});
    if(focus){box.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth",block:"center"});const f=box.querySelector("input:not([type=hidden]):not([hidden]),textarea,select");if(f)setTimeout(()=>f.focus({preventScroll:true}),250)}};
  /* ---- knop in laadtoestand ---- */
  VB.bezig=(btn,tekst)=>{if(!btn)return;if(tekst){btn.disabled=true;btn.classList.add("is-busy");btn.textContent=tekst}else{btn.disabled=false;btn.classList.remove("is-busy")}};
  /* ---- gsm-toetsenbord open: afrekenbalk niet laten zweven ---- */
  {const tik=()=>{const vv=window.visualViewport;const a=document.activeElement;const typ=a&&a.matches&&a.matches("input:not([type=radio]):not([type=checkbox]),textarea");
    document.body&&document.body.classList.toggle("vb-kb",!!typ&&(!vv||vv.height<window.innerHeight*.8||matchMedia("(pointer:coarse)").matches))};
    document.addEventListener("focusin",tik);document.addEventListener("focusout",()=>setTimeout(tik,60));if(window.visualViewport)visualViewport.addEventListener("resize",tik)}

  /* ---- datums: tonen als DD/MM/JJJJ, bewaren als JJJJ-MM-DD ---- */
  VB.dmy=iso=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||"");return m?`${m[3]}/${m[2]}/${m[1]}`:""};
  VB.iso=t=>{const m=/^\s*(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\s*$/.exec(t||"");if(!m)return "";const d=+m[1],mo=+m[2],y=+m[3];
    const dt=new Date(y,mo-1,d);if(dt.getFullYear()!==y||dt.getMonth()!==mo-1||dt.getDate()!==d)return "";return `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`};
  VB.datumVeld=inp=>{if(!inp||inp.dataset.vbd)return;inp.dataset.vbd="1";inp.type="text";inp.inputMode="numeric";inp.placeholder="DD/MM/JJJJ";inp.maxLength=10;inp.autocomplete="off";
    if(/^\d{4}-\d{2}-\d{2}$/.test(inp.value))inp.value=VB.dmy(inp.value);
    inp.addEventListener("input",e=>{if(e.inputType&&e.inputType.startsWith("delete"))return;let v=inp.value.replace(/[^\d]/g,"").slice(0,8);
      if(v.length>4)v=v.slice(0,2)+"/"+v.slice(2,4)+"/"+v.slice(4);else if(v.length>2)v=v.slice(0,2)+"/"+v.slice(2);inp.value=v})};
  window.VB=VB;
})();

/* ---- MemberPicker: naam van het lid kiezen met suggesties terwijl je typt (gedeeld door banket en familiedag).
   Gebruikt de functies esc() en lidPrijs(id) van de pagina zelf. ---- */
function lidPicker(inp){const wrap=inp.parentElement;wrap.classList.add("lp");const box=document.createElement("div");box.className="lp-l";box.hidden=true;box.setAttribute("role","listbox");wrap.append(box);
  let T=0,L=[],sel=-1,laatste="";inp.setAttribute("autocomplete","off");inp.setAttribute("role","combobox");inp.setAttribute("aria-autocomplete","list");
  const mark=(n,q)=>{const t=q.trim().split(/\s+/).filter(Boolean);let h=esc(n);for(const x of t){const re=new RegExp("("+x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","i");h=h.replace(re,"<b>$1</b>")}return h};
  const teken=q=>{if(!L.length){box.innerHTML=q.trim().length>=3?'<div class="lp-leeg">Geen lid gevonden met deze naam.</div>':"";box.hidden=q.trim().length<3;return}
    box.innerHTML=L.map((l,i)=>`<button type="button" class="lp-i${i===sel?" on":""}" data-i="${i}" role="option">${mark(l.toon||l.naam,q)}</button>`).join("");box.hidden=false};
  const kies=l=>{inp.value=l.toon||l.naam;inp.dataset.id=l.id;inp.classList.add("lp-ok");box.hidden=true;laatste=l.toon||l.naam;lidPrijs(l.id)};
  inp.addEventListener("input",()=>{if(inp.dataset.id)lidPrijs(null);delete inp.dataset.id;inp.classList.remove("lp-ok");clearTimeout(T);const q=inp.value;sel=-1;
    if(q.trim().length<3){L=[];box.hidden=true;return}
    T=setTimeout(async()=>{try{const r=await fetch("/api/leden?q="+encodeURIComponent(q));L=r.ok?await r.json():[];}catch(e){L=[]}if(inp.value===q)teken(q)},160)});
  inp.addEventListener("keydown",e=>{if(box.hidden||!L.length)return;
    if(e.key==="ArrowDown"){e.preventDefault();sel=(sel+1)%L.length;teken(inp.value)}else if(e.key==="ArrowUp"){e.preventDefault();sel=(sel-1+L.length)%L.length;teken(inp.value)}
    else if(e.key==="Enter"){e.preventDefault();kies(L[sel<0?0:sel])}else if(e.key==="Escape"){box.hidden=true}});
  box.addEventListener("mousedown",e=>{const b=e.target.closest(".lp-i");if(!b)return;e.preventDefault();kies(L[+b.dataset.i])});
  inp.addEventListener("blur",()=>setTimeout(()=>{box.hidden=true;if(!inp.dataset.id&&L.length===1&&inp.value.trim())kies(L[0])},150));}

/* ============ PaymentPanel: gedeelde betaalpresentatie (enkel weergave; de betaallogica blijft /api/betaling) ============
   Gebruikt de globale waarden van de pagina zelf: esc, eur, BET, volgT, volgN, betaald(), BC_ICON. */
/* PaymentPanel – handmatig: gedeeld door banket, familiedag, inschrijven, lidgeld */
function handmatig(j){return `<dl class="pd"><div><dt>Bedrag</dt><dd><b>${eur(j.bedrag)}</b></dd></div>
  <div><dt>Rekeningnummer</dt><dd><span class="mono">${esc(j.rekeningnummer)}</span><button type="button" class="cp" data-cp="${esc(String(j.rekeningnummer).replace(/\s+/g,""))}">Kopieer</button></dd></div>
  ${j.begunstigde?`<div><dt>Begunstigde</dt><dd>${esc(j.begunstigde)}</dd></div>`:""}
  <div><dt>Mededeling</dt><dd><span class="mono">${esc(j.mededeling)}</span><button type="button" class="cp" data-cp="${esc(j.mededeling)}">Kopieer</button></dd></div></dl>
  <p class="hint">Gebruik exact deze mededeling, dan wordt je betaling automatisch herkend.</p>`}

/* PaymentPanel – appLink: gedeeld door banket, familiedag, inschrijven, fuif, shop, steun */
function appLink(o){if(!o||!o.deeplink)return null;const ret=location.origin+location.pathname+"?betaling=terug";return o.deeplink+(o.deeplink.includes("?")?"&":"?")+"returnUrl="+encodeURIComponent(ret)}

/* PaymentPanel – onlineBlok: gedeeld door banket, familiedag, inschrijven */
function onlineBlok(o,bedrag){const href=appLink(o);
  return `<div id="online"><a class="btn bc" id="bcGo" href="${esc(href||o.checkout||"#")}">${BC_ICON}Betaal ${eur(bedrag)} met Bancontact</a>
  <p class="hint c">${o.deeplink?"Je Bancontact- of bankapp opent en je bevestigt daar binnen 2 minuten.<br><small>Kom je op een pagina om een app te downloaden? Dan heb je geen app die Bancontact Pay ondersteunt: kies dan hieronder <b>overschrijving</b>.</small>":"Je gaat naar de beveiligde betaalpagina. Daar betaal je met de Bancontact-app, je bankapp of je kaart."}</p>
  ${o.qrcode?`<div class="qrwrap desk"><div class="qr"><img src="${esc(o.qrcode)}" alt="Bancontact-QR-code" width="200" height="200"></div><p>Op een computer? Scan deze code met de Bancontact-app of de app van je bank.</p></div>`:""}
  <p class="wacht" id="bcStatus" aria-live="polite"></p></div>`}

/* PaymentPanel – volg: gedeeld door banket, familiedag */
async function volg(){clearTimeout(volgT);if(!BET)return;
  try{const r=await fetch(`/api/betaling?t=${encodeURIComponent(BET.t)}&id=${encodeURIComponent(BET.id)}&token=${encodeURIComponent(BET.token)}`);const s=await r.json();
    if(s.status==="SUCCEEDED"){betaald();return}
    const st=$("#bcStatus");
    if(["EXPIRED","CANCELLED","FAILED","AUTHORIZATION_FAILED"].includes(s.status)){if(st)st.innerHTML=`${s.status==="EXPIRED"?"Deze betaling is verlopen.":"De betaling is niet gelukt."} <button type="button" class="cp" id="bcNieuw">Opnieuw proberen</button>`;const g=$("#bcGo");if(g)g.classList.add("off");return}
    if(s.status==="IDENTIFIED"||s.status==="AUTHORIZED"){if(st)st.textContent="Bevestig de betaling in je app…"}
  }catch(x){}
  if(++volgN<200)volgT=setTimeout(volg,document.hidden?8000:3000)}
