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
  const eur2=n=>"€"+(Number(n)||0).toLocaleString("nl-BE",{minimumFractionDigits:2,maximumFractionDigits:2});
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
  C.rij=(saldo,max)=>{const g=C.gebruik(max);
    return `<div class="vb-r credit vb-credit"><span><label class="vb-sw"><input type="checkbox" data-vbc="aan"${C.aan?" checked":""}><i aria-hidden="true"></i>${esc(C.label)}</label></span>
      <b>${g>0?"− "+eur2(g):eur2(0)}</b><small>${eur2(saldo)} beschikbaar${C.aan?(C.ander?`<span class="vb-nw">· <span class="vb-cin">€<input data-vbc="in" type="text" inputmode="decimal" value="${g.toFixed(2).replace(".",",")}" aria-label="Bedrag ${esc(C.label.toLowerCase())}"></span></span>`:`<span class="vb-nw">· <button type="button" class="vb-aanp" data-vbc="aanp">Aanpassen</button></span>`):""}</small></div>`};
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
    return `<p class="vb-sum-t">${esc(titel)}</p><div class="vb-sum">${r}${c}${t}</div>`};

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
