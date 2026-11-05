
"use strict";
/* ============ hulpfuncties ============ */
const $=(s,el=document)=>el.querySelector(s);
const $$=(s,el=document)=>[...el.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmtEur=new Intl.NumberFormat("nl-BE",{style:"currency",currency:"EUR"});
const eur=n=>fmtEur.format(Math.round((n||0)*100)/100);
const norm=s=>String(s??"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/\s+/g," ").trim();
const slug=s=>norm(s).replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"x";
const num=v=>{if(typeof v==="number")return v;const s=String(v??"").trim().replace(/\s/g,"");if(!s)return 0;const t=s.includes(",")?s.replace(/\./g,"").replace(",","."):s;const n=parseFloat(t);return isNaN(n)?0:n};
const r2=n=>Math.round(n*100)/100;
const todayISO=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const fmtDate=iso=>iso?iso.slice(8,10)+"/"+iso.slice(5,7)+"/"+iso.slice(0,4):"";
const ls={get(k,d){try{const v=localStorage.getItem("vbha:"+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem("vbha:"+k,JSON.stringify(v))}catch(e){}}};
const ICON={
  dashboard:'<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  leden:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-6 6.5-6s5.9 2.4 6.5 6"/><path d="M16 4.5a3.3 3.3 0 0 1 0 6.6M18.5 14.4c1.7.9 2.8 2.9 3 5.6"/>',
  boekhouding:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 14h3M8 17h6"/>',
  punten:'<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>',
  kalenders:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  sponsors:'<path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6"/>',
  mails:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  instellingen:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', search:'<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  upload:'<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>', download:'<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>', copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  historiek:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  administratie:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
  boekingen:'<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  verwerken:'<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  regels:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  bank:'<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',
  kaart:'<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  communicatie:'<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'
};
const ic=n=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+ICON[n]+'</svg>';
const NAV=[{id:"leden",label:"Leden",items:[["leden","Ledenlijst"],["punten","Puntensysteem"]]},{id:"boekhouding",label:"Boekhouding",items:[["boekhouding","Overzicht"],["boekingen","Boekingen"],["verwerken","Te verwerken"],["regels","Automatische regels"],["bank","Bankimport"],["historiek","Historiek"]]},{id:"administratie",label:"Administratie",items:[["kalenders","Kalenders"],["sponsors","Sponsors"]]},{id:"communicatie",label:"Communicatie",items:[["mails","Mails"]]}];
const ROUTES=[["boekingen","Boekingen"],["verwerken","Te verwerken"],["regels","Regels"],["bank","Bankimport"],["dashboard","Dashboard"],["leden","Leden"],["boekhouding","Boekhouding"],["punten","Puntensysteem"],["kalenders","Kalenders"],["sponsors","Sponsors"],["historiek","Historiek"],["mails","Mails"],["instellingen","Instellingen"]];

/* ============ standaardwaarden ============ */
const DEF_CONFIG={vereniging:"Vriendenkring Brandweer Hoofdpost Aalst",rekeningnummer:"",
  boekCategorieen:["Lidgeld","Banket","Kalenders","Jaarmarkt","Fuif","Sponsoring","Pontoise","Kinderfeest","Paasmaandagwandeling","Andere kosten","Andere opbrengsten"],
  ledenCategorieen:["Administratie","Vrijwilligers","Erewacht","Ploeg 1","Ploeg 2","Ploeg 3","Ploeg 4","Officieren"]};
const DEF_JAAR={beginKas:0,beginRekening:0,gewichten:{kaarten:1,kalenders:25,shifts:35,vergaderingen:20},drempels:{zilver:65,goud:100},lidgeld:{gewoon:30,erewacht:20},kalenderStock:200};
const JUBILEA=[10,20,25,30,40,50,60];

/* ============ toestand ============ */
const COLS=["leden","boekingen","jaarleden","sponsors","jaren","templates","config","archief","regels","imports"];
const S={leden:new Map(),boekingen:new Map(),jaarleden:new Map(),sponsors:new Map(),jaren:new Map(),templates:new Map(),config:new Map(),archief:new Map(),regels:new Map(),imports:new Map()};
const loaded=new Set();
let db=null,canWrite=true,JAAR=ls.get("jaar",null);
const UI=Object.assign({ledenQ:"",ledenCat:"",ledenF:"alle",oudLeden:false,boekQ:"",boekCat:"",boekRek:"",puntQ:"",puntSort:"naam",kalQ:"",spQ:"",mailGroep:"alle",mailTpl:"",histJaar:null,histQ:"",boekDir:"",boekMaand:"",boekSort:{k:"datum",d:-1},boekPage:0},ls.get("ui",{}));
const saveUI=()=>{const {ledenQ,boekQ,puntQ,kalQ,spQ,histQ,...rest}=UI;ls.set("ui",rest)};
const cfg=()=>Object.assign({},DEF_CONFIG,(S.config.get("algemeen")||{}));
const jaarCfg=Y=>{const j=S.jaren.get(String(Y))||{};return{...DEF_JAAR,...j,gewichten:{...DEF_JAAR.gewichten,...(j.gewichten||{})},drempels:{...DEF_JAAR.drempels,...(j.drempels||{})},lidgeld:{...DEF_JAAR.lidgeld,...(j.lidgeld||{})}}};
const jaren=()=>[...S.jaren.keys()].map(Number).sort((a,b)=>a-b);
const naamVol=l=>(l.voornaam||"")+" "+(l.naam||"");
const isEreVoorzitter=l=>norm(l.info).includes("ere-voorzitter");

/* ============ berekeningen ============ */
let CTX=null,CTXKEY=-1,dirty=true;
function ctx(){
  if(!dirty&&CTX&&CTXKEY===JAAR)return CTX;
  const Y=JAAR,c=jaarCfg(Y);
  const boek=[...S.boekingen.values()].filter(b=>b.jaar===Y).map(b=>({...b,_m:norm(b.mededeling),_p:norm(b.partij)}));
  boek.sort((a,b)=>(a.datum||"").localeCompare(b.datum||"")||(a.nr||0)-(b.nr||0));
  let kas=c.beginKas,rek=c.beginRekening,tin=0,tuit=0;const perCat={};const reeks=[];
  for(const b of boek){const v=b.richting==="uit"?-b.bedrag:b.bedrag;if(b.rekening==="Kas")kas+=v;else rek+=v;b._kas=r2(kas);b._rek=r2(rek);
    if(b.richting==="uit")tuit+=b.bedrag;else tin+=b.bedrag;const k=b.categorie||"(geen categorie)";perCat[k]=perCat[k]||{in:0,uit:0,n:0};perCat[k][b.richting==="uit"?"uit":"in"]+=b.bedrag;perCat[k].n++;reeks.push([b.datum,kas+rek])}
  const lidBoek=boek.filter(b=>b._m.includes("lidgeld")||b.lidId);
  const leden=[...S.leden.values()].filter(l=>(!l.lidSinds||l.lidSinds<=Y)&&(!l.lidTot||l.lidTot>=Y));
  const oud=[...S.leden.values()].filter(l=>!leden.includes(l)&&!(l.lidSinds>Y));
  const rows=new Map();
  for(const lid of [...leden,...oud]){
    const jl=S.jaarleden.get(Y+"_"+lid.id)||{};
    let lg;
    if(isEreVoorzitter(lid))lg={ok:true,bron:"Ere-voorzitter"};
    else if(jl.lidgeld==="OK")lg={ok:true,bron:"Manueel op betaald gezet"};
    else if(jl.lidgeld==="NOK")lg={ok:false,bron:"Manueel op niet betaald gezet"};
    else{const n1=norm(lid.naam),n2=norm(lid.voornaam);const b=lidBoek.find(b=>b.lidId===lid.id||(n1&&n2&&b._m.includes("lidgeld")&&b._m.includes(n1)&&b._m.includes(n2)));lg=b?{ok:true,bron:"Betaling",boeking:b}:{ok:false,bron:""}}
    const w=c.gewichten;const p={kaarten:(jl.kaarten||0)*w.kaarten,kalenders:(jl.kalUitgevoerd||0)*w.kalenders,shifts:(jl.shifts||0)*w.shifts,vergaderingen:(jl.vergaderingen||0)*w.vergaderingen,extra:jl.extraPunten||0};
    p.totaal=p.kaarten+p.kalenders+p.shifts+p.vergaderingen+p.extra;
    const status=!lg.ok?"niet actief":lid.categorie==="Erewacht"?"GOUD":p.totaal<c.drempels.zilver?"BRONS":p.totaal<c.drempels.goud?"ZILVER":"GOUD";
    const bedrag=lid.categorie==="Erewacht"?c.lidgeld.erewacht:c.lidgeld.gewoon;
    rows.set(lid.id,{lid,jl,lg,p,status,bedrag,huidig:leden.includes(lid),jaren:lid.lidSinds?Y-lid.lidSinds:null});
  }
  const sortNaam=(a,b)=>(a.naam||"").localeCompare(b.naam||"","nl")||(a.voornaam||"").localeCompare(b.voornaam||"","nl");
  leden.sort(sortNaam);oud.sort(sortNaam);
  CTX={Y,c,boek,kas:r2(kas),rek:r2(rek),tin,tuit,perCat,reeks,leden,oud,rows};CTXKEY=Y;dirty=false;return CTX;
}

/* ============ opslag ============ */
const queues=new Map();
function write(col,id,data,{merge=false,del=false}={}){
  if(!db){toast("Geen verbinding met de gegevens.",true);return Promise.reject()}
  const key=col+"/"+id;const prev=queues.get(key)||Promise.resolve();
  const p=prev.catch(()=>{}).then(()=>{const ref=db.collection(col).doc(id);
    if(del)return ref.delete();
    if(merge){const cur=S[col].get(id);const {id:_i,...rest}=cur||{};return ref.set({...rest,...data})}
    return ref.set(data)}).catch(e=>{handleWriteError(e);throw e});
  queues.set(key,p);return p;
}
function handleWriteError(e){
  if(e&&(e.code==="permission_denied"||e.code==="42501")){toast("Je hebt alleen leesrechten. Vraag een bewerker om dit aan te passen.",true);return}
  if(e&&e.code==="23505"){toast("Deze boeking bestaat al (zelfde bankreferentie).",true);return}
  if(e&&e.code==="quota_exceeded"){toast("De opslag is vol. Verwijder oude gegevens of vraag hulp.",true);return}
  toast("Opslaan mislukt"+(e&&e.message?": "+e.message:"")+". Probeer opnieuw.",true);
}
let canWriteConfirmed=false;
const newId=col=>db.collection(col).doc().id;
function applyRO(){document.body.classList.toggle("ro",!canWrite)}

/* ============ Supabase: aanmelden en gegevens ============ */
let SB=null,ME=null;
function sbErr(e){const x=new Error(e&&e.message||"Onbekende fout");x.code=e&&e.code==="42501"?"permission_denied":(e&&e.code)||"error";return x}
function makeDb(){
  const subs=new Map();const chan=SB.channel("vbha-gegevens");let started=false;
  async function loadAll(col){const out=[];for(let from=0;;from+=1000){const {data,error}=await SB.from(col).select("id,data").order("id").range(from,from+999);if(error)throw sbErr(error);out.push(...data);if(data.length<1000)break}return out}
  function emit(col){const s=subs.get(col);if(!s||s.t||!s.loaded)return;s.t=setTimeout(()=>{s.t=0;const docs=[...s.cache.entries()].map(([id,d])=>({id,data:()=>d}));for(const cb of s.cbs)cb.next({docs,metadata:{fromCache:false}})},40)}
  return{
    collection(col){return{
      onSnapshot(next,err){let s=subs.get(col);
        if(!s){s={cache:new Map(),cbs:[],t:0,loaded:false};subs.set(col,s);
          chan.on("postgres_changes",{event:"*",schema:"public",table:col},p=>{if(p.eventType==="DELETE"){if(p.old&&p.old.id)s.cache.delete(p.old.id)}else if(p.new&&p.new.id){s.cache.set(p.new.id,p.new.data||{})}emit(col)});
          loadAll(col).then(rows=>{for(const r of rows)s.cache.set(r.id,r.data||{});s.loaded=true;emit(col)}).catch(e=>{for(const cb of s.cbs)cb.err&&cb.err(e)});
          if(!started){started=true;setTimeout(()=>chan.subscribe(),0)}}
        s.cbs.push({next,err});return()=>{}},
      doc(id){id=id||(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2));return{id,
        async set(data){const {error}=await SB.from(col).upsert({id,data});if(error)throw sbErr(error);const s=subs.get(col);if(s){s.cache.set(id,data);emit(col)}},
        async delete(){const {error}=await SB.from(col).delete().eq("id",id);if(error)throw sbErr(error);const s=subs.get(col);if(s){s.cache.delete(id);emit(col)}}}}
    }},
    async bulkSet(col,docs,onProg){for(let i=0;i<docs.length;i+=400){const chunk=docs.slice(i,i+400).map(d=>{const {id,...data}=d;return{id:String(id),data}});const {error}=await SB.from(col).upsert(chunk);if(error)throw sbErr(error);onProg&&onProg(Math.min(i+400,docs.length))}
      const s=subs.get(col);if(s){for(const d of docs){const {id,...data}=d;s.cache.set(String(id),data)}emit(col)}}
  };
}
async function api(path,opt={}){
  const {data:{session}}=await SB.auth.getSession();
  const r=await fetch(path,{...opt,headers:{"Content-Type":"application/json",...(opt.headers||{}),Authorization:"Bearer "+(session?session.access_token:"")}});
  const j=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(j.error||("Fout "+r.status));e.status=r.status;throw e}return j;
}
function authCard(inner){document.body.classList.add("anon");$("#nav").innerHTML="";$("#main").innerHTML=`<div class="auth"><div class="panel auth-card"><div class="panel-b stack">${EMBLEM}${inner}</div></div></div>`}
function showLogin(msg){
  authCard(`<h1>Aanmelden</h1><p class="muted" style="margin:0">Beheer van de ${esc(DEF_CONFIG.vereniging)}. Alleen voor uitgenodigde bestuursleden.</p>
  <form id="fLogin" class="stack"><div class="fld"><label for="lEmail">E-mailadres</label><input id="lEmail" name="email" type="email" autocomplete="username" required></div>
  <div class="fld"><label for="lPw">Wachtwoord</label><input id="lPw" name="pw" type="password" autocomplete="current-password" required></div>
  <div class="err" id="lErr">${esc(msg||"")}</div><div class="muted small" id="lMsg"></div><button class="btn solid" type="submit">Aanmelden</button></form>
  <button type="button" class="btn ghost sm" data-act="pwVergeten" style="align-self:flex-start">Wachtwoord vergeten?</button>`);
  setTimeout(()=>{const i=$("#lEmail");i&&i.focus()},30);
}
function showSetPassword(kind){
  authCard(`<h1>${kind==="invite"?"Welkom! Kies je wachtwoord":"Kies een nieuw wachtwoord"}</h1><p class="muted" style="margin:0">Minstens 8 tekens. Je gebruikt het samen met je e-mailadres om aan te melden.</p>
  <form id="fPw" class="stack"><div class="fld"><label for="pw1">Nieuw wachtwoord</label><input id="pw1" name="pw1" type="password" autocomplete="new-password" minlength="8" required></div>
  <div class="fld"><label for="pw2">Herhaal wachtwoord</label><input id="pw2" name="pw2" type="password" autocomplete="new-password" minlength="8" required></div>
  <div class="err" id="pwErr"></div><button class="btn solid" type="submit">Wachtwoord bewaren</button></form>`);
}
async function doLogin(f){const d=formData(f);$("#lErr").textContent="";const btn=f.querySelector("button[type=submit]");btn.disabled=true;
  const {data,error}=await SB.auth.signInWithPassword({email:d.email.trim(),password:d.pw});btn.disabled=false;
  if(error){$("#lErr").textContent=/invalid/i.test(error.message)?"E-mailadres of wachtwoord klopt niet.":error.message;return}
  startApp(data.session)}
async function doSetPassword(f){const d=formData(f);const e=$("#pwErr");if(d.pw1.length<8){e.textContent="Gebruik minstens 8 tekens.";return}if(d.pw1!==d.pw2){e.textContent="De twee wachtwoorden zijn niet gelijk.";return}
  const {data,error}=await SB.auth.updateUser({password:d.pw1});if(error){e.textContent=error.message;return}
  const {data:{session}}=await SB.auth.getSession();toast("Wachtwoord bewaard.");startApp(session)}
(async function boot(){
  const hp=new URLSearchParams(location.hash.slice(1));const authType=hp.get("type");const authErr=hp.get("error_description");
  let conf;try{const r=await fetch("/api/config");conf=await r.json();if(!r.ok||!conf.supabaseUrl)throw 0}catch(e){$("#main").innerHTML='<div class="loading"><b>De app is nog niet ingesteld.</b><span>Vul SUPABASE_URL en SUPABASE_ANON_KEY in bij Vercel en publiceer opnieuw. Zie README.md.</span></div>';return}
  SB=supabase.createClient(conf.supabaseUrl,conf.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data:{session}}=await SB.auth.getSession();
  if(hp.get("access_token")||authErr)history.replaceState(null,"",location.pathname+"#dashboard");
  SB.auth.onAuthStateChange(ev=>{if(ev==="PASSWORD_RECOVERY")showSetPassword("recovery")});
  if(session&&(authType==="invite"||authType==="recovery"))return showSetPassword(authType);
  if(!session)return showLogin(authErr?"De link is verlopen of al gebruikt. Vraag een nieuwe uitnodiging of kies 'Wachtwoord vergeten'.":"");
  startApp(session);
})();
let STARTED=false;
async function startApp(session){
  if(STARTED||!session)return;
  ME={email:session.user.email,id:session.user.id};
  const {data:rol,error}=await SB.from("bestuur").select("rol").eq("user_id",ME.id).maybeSingle();
  if(error||!rol){authCard(`<h1>Geen toegang</h1><p style="margin:0">Je bent aangemeld als <b>${esc(ME.email)}</b>, maar dit adres staat niet in de lijst van bestuursleden.</p><button class="btn" data-act="logout">Afmelden</button>`);return}
  STARTED=true;document.body.classList.remove("anon");
  canWrite=rol.rol==="bewerker";canWriteConfirmed=true;applyRO();
  const w=$("#who");w.textContent=canWrite?ME.email:ME.email+" · alleen lezen";w.classList.toggle("ro",!canWrite);
  $("#main").innerHTML='<div class="loading" id="boot"><b>Gegevens laden…</b><span>Leden, boekhouding en punten worden opgehaald.</span></div>';
  const q=new URLSearchParams(location.search);if(q.get("bank")){const ok=q.get("bank")==="ok";setTimeout(()=>toast(ok?"De bankrekening is gekoppeld.":"Koppelen met de bank is niet gelukt"+(q.get("reden")?": "+q.get("reden"):"")+".",!ok),400);history.replaceState(null,"",location.pathname+"#bank")}
  const timer=setTimeout(()=>{if(loaded.size<COLS.length){const b=$("#boot");if(b)b.innerHTML="<b>De gegevens zijn nog niet bereikbaar.</b><span>Controleer je internetverbinding. De pagina blijft het proberen.</span>"}},10000);
  db=makeDb();
  for(const col of COLS){
    db.collection(col).onSnapshot(snap=>{
      const m=new Map();for(const d of snap.docs){m.set(d.id,{...d.data(),id:d.id})}S[col]=m;
      loaded.add(col);dirty=true;if(loaded.size===COLS.length)clearTimeout(timer);schedule();
    },err=>{loaded.add(col);clearTimeout(timer);toast("Gegevens ("+col+") konden niet geladen worden: "+(err&&err.message||""),true);schedule()});
  }
}
async function restoreBackup(file){
  let o;try{o=JSON.parse(await file.text())}catch(e){toast("Dit is geen geldig back-upbestand.",true);return}
  const cols=COLS.filter(c=>Array.isArray(o[c])&&o[c].length);if(!cols.length){toast("Er staan geen gegevens in dit bestand.",true);return}
  const tot=cols.reduce((s,c)=>s+o[c].length,0);
  confirmBox(`<b>${tot}</b> records terugzetten uit <b>${esc(file.name)}</b>?<br><span class="muted small">${cols.map(c=>c+": "+o[c].length).join(" · ")}</span><br><br>Bestaande records met dezelfde sleutel worden overschreven. Andere records blijven staan.`,"Terugzetten",async()=>{
    IMPORTING=true;let done=0;
    try{for(const c of cols){await db.bulkSet(c,o[c].filter(d=>d&&d.id!=null),n=>{toast("Bezig met terugzetten: "+(done+n)+" / "+tot)});done+=o[c].length}toast("Back-up teruggezet: "+tot+" records.")}
    catch(e){handleWriteError(e)}finally{IMPORTING=false;dirty=true;render(true)}
  });
}

let pending=false,rafId=0;
function schedule(){if(IMPORTING){pending=true;return}if(rafId)return;rafId=requestAnimationFrame(()=>{rafId=0;
  const ae=document.activeElement;if(ae&&$("#main").contains(ae)&&/INPUT|TEXTAREA|SELECT/.test(ae.tagName)&&ae.dataset.live!==undefined){pending=true;return}
  render()})}
document.addEventListener("focusout",()=>{if(pending){pending=false;setTimeout(()=>{const ae=document.activeElement;if(!(ae&&$("#main").contains(ae)&&ae.dataset.live!==undefined))render();else pending=true},0)}});
window.addEventListener("hashchange",()=>{closeNavMenu();render(true)});
function openNavMenu(btn){const n=NAV.find(x=>x.id===btn.dataset.id);const m=$("#navmenu");if(!n)return;
  if(!m.hidden&&m.dataset.for===n.id){closeNavMenu();return}
  m.innerHTML=n.items.map(([k,l])=>'<a role="menuitem" href="#'+k+'" class="'+(k===route()?"on":"")+'">'+ic(k)+esc(l)+'</a>').join("");
  m.dataset.for=n.id;m.hidden=false;const r=btn.getBoundingClientRect();
  m.style.left=Math.max(8,Math.min(r.left,window.innerWidth-m.offsetWidth-8))+"px";m.style.top=(r.bottom+6)+"px";btn.setAttribute("aria-expanded","true");
  const f=m.querySelector("a");if(f&&e_kbd)f.focus()}
let e_kbd=false;document.addEventListener("keydown",e=>{e_kbd=e.key==="Enter"||e.key===" ";if(e.key==="Escape")closeNavMenu()},true);document.addEventListener("pointerdown",()=>{e_kbd=false},true);
function closeNavMenu(){const m=$("#navmenu");if(!m||m.hidden)return;m.hidden=true;$$(".navdd").forEach(b=>b.setAttribute("aria-expanded","false"))}
const HOVER=!!(window.matchMedia&&window.matchMedia("(hover:hover) and (pointer:fine)").matches);let navTimer=0;
document.addEventListener("mouseover",e=>{if(!HOVER)return;const b=e.target.closest(".navdd"),m=e.target.closest("#navmenu");if(b||m)clearTimeout(navTimer);
  if(b){const menu=$("#navmenu");if(menu.hidden||menu.dataset.for!==b.dataset.id)openNavMenu(b)}});
document.addEventListener("mouseout",e=>{if(!HOVER)return;if(!e.target.closest(".navdd,#navmenu"))return;const to=e.relatedTarget&&e.relatedTarget.closest&&e.relatedTarget.closest(".navdd,#navmenu");if(to)return;clearTimeout(navTimer);navTimer=setTimeout(closeNavMenu,200)});
window.addEventListener("resize",closeNavMenu);window.addEventListener("scroll",closeNavMenu,{passive:true});$("#nav").addEventListener("scroll",closeNavMenu,{passive:true});

/* ============ rendering ============ */
let lastRoute="";
function route(){const h=location.hash.replace("#","");return ROUTES.some(r=>r[0]===h)?h:"dashboard"}
function render(force){
  if(!db)return;
  if(loaded.size<COLS.length&&S.leden.size===0&&S.jaren.size===0)return;
  const ys=jaren();const cj=Number(cfg().actiefJaar)||0;
  if(!ys.length){JAAR=new Date().getFullYear()}
  else JAAR=ys.includes(cj)?cj:ys[ys.length-1];
  const r=route();
  $("#nav").innerHTML=NAV.map(n=>Array.isArray(n)?'<a href="#'+n[0]+'" class="'+(n[0]===r?"on":"")+'">'+ic(n[0])+esc(n[1])+'</a>':'<button type="button" class="navdd'+(n.items.some(i=>i[0]===r)?" on":"")+'" data-act="navdd" data-id="'+n.id+'" aria-haspopup="true" aria-expanded="false">'+ic(n.id)+esc(n.label)+'<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>').join("");
  $("#brandLbl").textContent=cfg().vereniging||"";
  const g=$("#gear");if(!g.firstChild)g.innerHTML=ic("instellingen");g.classList.toggle("on",r==="instellingen");
  const sy=window.scrollY;
  const v=VIEWS[r]();
  const yearSel=ys.length?'<div class="yearpick"><label for="jaarSel">Boekjaar</label><select id="jaarSel" data-change="jaar">'+ys.map(y=>'<option'+(y===JAAR?" selected":"")+'>'+y+'</option>').join("")+'</select></div>':"";
  $("#main").innerHTML='<div class="top">'+EMBLEM+'<div><h1>'+esc(v.title)+'</h1>'+(v.sub?'<div class="sub">'+v.sub+'</div>':"")+'</div><div class="grow"></div>'+(v.actions||"")+'</div>'+
    (S.leden.size===0&&S.jaren.size===0?emptyState():"")+'<div id="body" style="display:flex;flex-direction:column;gap:18px">'+v.body()+'</div>';
  VIEWS[r].after&&VIEWS[r].after();
  if(r===lastRoute&&!force)window.scrollTo(0,sy);lastRoute=r;
}
function renderBody(){const r=route();const v=VIEWS[r]();$("#body").innerHTML=v.body();VIEWS[r].after&&VIEWS[r].after()}
function emptyState(){return '<div class="panel"><div class="empty" style="display:flex;flex-direction:column;gap:12px;align-items:center"><b style="font-size:17px;color:var(--ink)">Nog geen gegevens</b><span>Lees je bestaande Excel-bestanden in (VBHA_2025.xlsm, daarna VBHA_2026.xlsm), of start met een leeg boekjaar in Instellingen.</span><button class="btn primary" data-w data-act="importExcel">'+ic("upload")+'Excel-bestand importeren</button></div></div>'}
const VIEWS={};
const EMBLEM='<img class="emblem emblem-l" alt="" width="47" height="52" src="data:image/png;base64,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"><img class="emblem emblem-d" alt="" width="47" height="52" src="data:image/png;base64,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">';

/* ---------- dashboard ---------- */
VIEWS.dashboard=()=>({title:"Dashboard",emblem:true,body(){
  const C=ctx();const cur=C.leden.map(l=>C.rows.get(l.id));
  const ok=cur.filter(r=>r.lg.ok).length,nok=cur.length-ok,ere=cur.filter(r=>r.lid.categorie==="Erewacht").length;
  const st={GOUD:0,ZILVER:0,BRONS:0,"niet actief":0};cur.forEach(r=>st[r.status]++);
  const kal=kalStats(C);
  const jub=cur.filter(r=>r.jaren===25).sort((a,b)=>(a.lid.naam||"").localeCompare(b.lid.naam||"","nl"));
  const cats=Object.entries(C.perCat).sort((a,b)=>(b[1].in+b[1].uit)-(a[1].in+a[1].uit));
  const max=Math.max(1,...cats.map(([,v])=>Math.max(v.in,v.uit)));
  const top=cur.filter(r=>r.lid.categorie!=="Erewacht"&&r.p.totaal>0).sort((a,b)=>b.p.totaal-a.p.totaal).slice(0,6);
  const recent=C.boek.slice(-6).reverse();
  return `<div class="tiles six">
    <div class="tile hero"><span class="lbl">Totaal saldo</span><span class="val">${eur(C.kas+C.rek)}</span><span class="hint">Kas + rekening vandaag</span></div>
    <a class="tile" href="#boekhouding"><span class="lbl">Rekening</span><span class="val">${eur(C.rek)}</span><span class="hint">Begin ${eur(C.c.beginRekening)}</span></a>
    <a class="tile" href="#boekhouding"><span class="lbl">Kas</span><span class="val">${eur(C.kas)}</span><span class="hint">Begin ${eur(C.c.beginKas)}</span></a>
    <a class="tile" href="#leden"><span class="lbl">Leden in orde</span><span class="val">${ok}<small style="font-size:16px;color:var(--muted)"> / ${cur.length}</small></span><span class="hint">${ere} erewachters</span></a>
    <a class="tile" href="#leden" data-act="toonNietBetaald"><span class="lbl">Niet betaald</span><span class="val" style="color:${nok?"var(--bad)":"var(--good)"}">${nok}</span><span class="hint">Lidgeld ${JAAR} ontbreekt</span></a>
    <a class="tile" href="#kalenders"><span class="lbl">Kalenders in stock</span><span class="val">${kal.stock}</span><span class="hint">${kal.uit} dozen uitgevoerd, ${kal.omloop} in omloop</span></a>
  </div>
  <div class="grid g2">
    <div class="panel"><div class="panel-h"><h2>Saldo doorheen het jaar</h2></div><div class="panel-b">${sparkline(C)}</div></div>
    <div class="panel"><div class="panel-h"><h2>Status leden</h2><span class="grow"></span><a class="btn sm ghost" href="#punten">Puntensysteem</a></div><div class="panel-b">
      ${["GOUD","ZILVER","BRONS","niet actief"].map(k=>`<div class="catbar"><span>${medal(k)}</span><div class="track"><span style="width:${cur.length?st[k]/cur.length*100:0}%;background:var(--${k==="niet actief"?"line":k.toLowerCase()})"></span></div><b>${st[k]}</b></div>`).join("")}
      <p class="sub" style="margin:10px 0 0;font-size:13px;color:var(--muted)">Zilver vanaf ${C.c.drempels.zilver} punten, goud vanaf ${C.c.drempels.goud}. Erewachters zijn altijd goud.</p></div></div>
  </div>
  <div class="grid g2">
    <div class="panel"><div class="panel-h"><h2>Inkomsten en uitgaven per categorie</h2></div><div class="panel-b">
      ${cats.length?cats.map(([k,v])=>`<div class="catbar"><span class="trunc">${esc(k)}</span><div class="track" title="in ${eur(v.in)} / uit ${eur(v.uit)}"><span style="width:${v.in/max*50}%;background:var(--good)"></span><span style="width:${v.uit/max*50}%;background:var(--bad)"></span></div><b class="${v.in-v.uit>=0?"in":"out"}">${eur(v.in-v.uit)}</b></div>`).join(""):'<div class="empty">Nog geen boekingen in '+JAAR+'.</div>'}
      <div class="catbar" style="border-top:1px solid var(--line);margin-top:6px;padding-top:8px"><b>Totaal</b><span class="muted" style="color:var(--muted);font-size:13px">in ${eur(C.tin)} · uit ${eur(C.tuit)}</span><b class="${C.tin-C.tuit>=0?"in":"out"}">${eur(C.tin-C.tuit)}</b></div>
    </div></div>
    <div class="panel"><div class="panel-h"><h2>Jubilarissen ${JAAR}</h2></div><div class="panel-b"><div class="list">
      ${jub.length?jub.map(r=>`<div class="li"><span class="pill ${r.jaren===25?"warn":"neutral"}">${r.jaren} jaar</span><span class="grow"><b>${esc(naamVol(r.lid))}</b> <span style="color:var(--muted)">lid sinds ${r.lid.lidSinds}</span></span></div>`).join(""):'<div class="empty">Geen jubilarissen dit jaar.</div>'}
    </div></div></div>
  </div>
  <div class="grid g2">
    <div class="panel"><div class="panel-h"><h2>Laatste boekingen</h2><span class="grow"></span><button class="btn sm" data-w data-act="nieuweBoeking">${ic("plus")}Boeking</button></div><div class="panel-b"><div class="list">
      ${recent.length?recent.map(b=>`<div class="li"><span style="color:var(--muted);width:78px;flex:none">${fmtDate(b.datum)}</span><span class="grow trunc">${esc(b.mededeling||b.partij||b.categorie)}</span><b class="${b.richting==="uit"?"out":"in"}">${b.richting==="uit"?"−":"+"}${eur(b.bedrag)}</b></div>`).join(""):'<div class="empty">Nog geen boekingen.</div>'}
    </div></div></div>
    <div class="panel"><div class="panel-h"><h2>Meeste punten</h2></div><div class="panel-b"><div class="list">
      ${top.length?top.map(r=>`<div class="li"><span class="grow"><b>${esc(naamVol(r.lid))}</b></span>${medal(r.status)}<b style="width:52px;text-align:right">${r.p.totaal}</b></div>`).join(""):'<div class="empty">Nog geen punten ingevoerd.</div>'}
    </div></div></div>
  </div>`}});
function medal(s){return s==="niet actief"?'<span class="medal na"><i></i>NIET ACTIEF</span>':'<span class="medal '+s+'"><i></i>'+s+'</span>'}
function sparkline(C){
  const pts=[[JAAR+"-01-01",C.c.beginKas+C.c.beginRekening],...C.reeks];
  if(pts.length<2)return '<div class="empty">Nog geen boekingen.</div>';
  const W=560,H=170,P=34,t0=Date.parse(JAAR+"-01-01"),t1=Math.max(Date.parse(JAAR+"-12-31"),t0+1);
  const vals=pts.map(p=>p[1]);let lo=Math.min(0,...vals),hi=Math.max(...vals);if(hi===lo)hi=lo+1;
  const x=d=>P+(Date.parse(d)-t0)/(t1-t0)*(W-P-8),y=v=>8+(hi-v)/(hi-lo)*(H-30);
  let d="";pts.forEach((p,i)=>{const X=x(p[0]),Y=y(p[1]);d+=i?"H"+X.toFixed(1)+"V"+Y.toFixed(1):"M"+X.toFixed(1)+" "+Y.toFixed(1)});
  const last=pts[pts.length-1];const area=d+"V"+y(lo)+"H"+x(pts[0][0])+"Z";
  const ticks=[lo,(lo+hi)/2,hi];const months=["jan","apr","jul","okt"];
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Verloop totaal saldo">
    ${ticks.map(v=>`<line x1="${P}" x2="${W-8}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${P-6}" y="${y(v)+4}" text-anchor="end" font-size="10.5" fill="var(--muted)">${Math.round(v/1000)}k</text>`).join("")}
    ${months.map((m,i)=>`<text x="${x(JAAR+"-"+String(i*3+1).padStart(2,"0")+"-01")}" y="${H-6}" font-size="10.5" fill="var(--muted)">${m}</text>`).join("")}
    <path d="${area}" fill="var(--accent)" fill-opacity=".10"/><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2"/>
    <circle cx="${x(last[0])}" cy="${y(last[1])}" r="4" fill="var(--accent)"/></svg>`;
}

/* ---------- leden ---------- */
VIEWS.leden=()=>({title:"Leden",sub:"Ledenadministratie en lidgeld "+JAAR,
  actions:'<button class="btn primary" data-w data-act="nieuwLid">'+ic("plus")+'Nieuw lid</button>',
  body(){const C=ctx();const c=cfg();
  return `<div class="bar"><div class="search">${ic("search")}<input id="ledenQ" data-live data-input="ledenQ" placeholder="Zoek op naam, adres, e-mail of telefoon" value="${esc(UI.ledenQ)}"></div>
    <select class="sel" id="ledenCat" data-change="ledenCat"><option value="">Alle categorieën</option>${c.ledenCategorieen.map(k=>`<option${UI.ledenCat===k?" selected":""}>${esc(k)}</option>`).join("")}</select>
    <div class="seg" role="group" aria-label="Lidgeldfilter">${[["alle","Alle"],["ok","Betaald"],["nok","Niet betaald"]].map(([k,l])=>`<button data-act="ledenF" data-v="${k}" class="${UI.ledenF===k?"on":""}">${l}</button>`).join("")}</div></div>
    <div class="panel" id="ledenList">${ledenTable()}</div>`},
  });
VIEWS.leden.after=null;
function ledenTable(){
  const C=ctx();const q=norm(UI.ledenQ);
  let list=(q?[...C.leden,...C.oud]:C.leden).map(l=>C.rows.get(l.id));
  if(UI.ledenCat)list=list.filter(r=>r.lid.categorie===UI.ledenCat);
  if(UI.ledenF==="ok")list=list.filter(r=>r.lg.ok);if(UI.ledenF==="nok")list=list.filter(r=>!r.lg.ok&&r.huidig);
  if(q)list=list.filter(r=>norm([r.lid.naam,r.lid.voornaam,r.lid.adres,r.lid.email,r.lid.telefoon,r.lid.info].join(" ")).includes(q));
  if(!list.length)return '<div class="empty">Geen leden gevonden'+(q?' voor “'+esc(UI.ledenQ)+'”':'')+'.</div>';
  return `<div class="tw"><table><thead><tr><th>Naam</th><th>Status</th><th>Lidgeld ${JAAR}</th><th>Categorie</th><th class="num">Lid sinds</th><th>E-mail</th><th>Telefoon</th></tr></thead><tbody>
  ${list.map(r=>`<tr class="click" data-act="toonLid" data-id="${esc(r.lid.id)}"><td class="nm"><b>${esc(r.lid.naam)}</b> ${esc(r.lid.voornaam)}${r.huidig?"":' <span class="pill neutral">oud-lid</span>'}</td>
    <td>${r.huidig?medal(r.status):""}</td><td>${r.huidig?lgPill(r):""}</td><td>${esc(r.lid.categorie)}</td><td class="num">${esc(r.lid.lidSinds||"")}</td>
    <td class="trunc">${esc(r.lid.email)||'<span class="pill warn">geen e-mail</span>'}</td><td style="white-space:nowrap">${esc(r.lid.telefoon)}</td></tr>`).join("")}
  </tbody></table></div><div style="padding:10px 16px;color:var(--muted);font-size:13px;border-top:1px solid var(--line)">${list.length} leden getoond</div>`;
}
function lgPill(r){return r.lg.ok?'<span class="pill ok" title="'+esc(r.lg.bron)+'">✓ Betaald</span>':'<span class="pill nok">Niet betaald</span>'}

/* ---------- boekhouding ---------- */
const BOEK_TABS=[["boekhouding","Overzicht"],["boekingen","Boekingen"],["verwerken","Te verwerken"],["regels","Regels"],["bank","Bankimport"],["historiek","Historiek"]];
const MAANDEN=["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];
const MAANDEN_VOL=["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"];
const PAGE=50;
const SEL=new Set();
const VELD={mededeling:"Mededeling",partij:"Tegenpartij",iban:"Rekening tegenpartij",alles:"Mededeling of tegenpartij"};
const OPS={bevat:"bevat",begint:"begint met",gelijk:"is gelijk aan"};
const RICHTING={beide:"In en uit",in:"Alleen ontvangsten",uit:"Alleen uitgaven"};
const signed=b=>b.richting==="uit"?-b.bedrag:b.bedrag;
const kfmt=v=>Math.abs(v)>=1000?(Math.round(v/100)/10).toString().replace(".",",")+"k":String(Math.round(v));
function teVerwerken(C){return C.boek.filter(b=>!b.categorie||b.status==="controle")}
function boekTabs(act){const n=teVerwerken(ctx()).length;return `<nav class="tabs" aria-label="Onderdelen boekhouding">${BOEK_TABS.map(([k,l])=>`<a href="#${k}" class="${k===act?"on":""}">${esc(l)}${k==="verwerken"&&n?`<span class="cnt">${n}</span>`:""}</a>`).join("")}</nav>`}
function catList(C){return [...new Set([...cfg().boekCategorieen,...(C?C.boek.map(b=>b.categorie).filter(Boolean):[])])]}
function bedragCel(b){return `<span class="amt ${b.richting==="uit"?"out":"in"}">${b.richting==="uit"?"−":"+"}${eur(b.bedrag)}</span>`}
function catCell(b){if(!b.categorie)return '<span class="pill warn">Te verwerken</span>';return `<span class="cat">${esc(b.categorie)}</span>${b.status==="controle"?' <span class="pill warn" title="Automatisch voorgesteld, nog niet bevestigd">controleren</span>':""}`}
function bronLabel(b){return b.bron==="api"?"Bankkoppeling":b.bron==="bank"?"Bankbestand":b.bron==="excel"?"Excel-import":"Manueel"}
const boekActions=()=>'<button class="btn primary" data-w data-act="nieuweBoeking">'+ic("plus")+'Nieuwe boeking</button>';

/* regels */
const byVolg=(a,b)=>(a.volgorde||0)-(b.volgorde||0)||String(a.id).localeCompare(String(b.id));
function actieveRegels(){return [...S.regels.values()].filter(r=>r.actief!==false).sort(byVolg)}
function matchRegel(r,b){
  const raw=String(r.waarde||"");if(!raw.trim())return false;
  if(r.richting&&r.richting!=="beide"&&r.richting!==(b.richting==="uit"?"uit":"in"))return false;
  const iban=r.veld==="iban";const v=iban?norm(raw).replace(/\s/g,""):norm(raw);
  const fields=r.veld==="partij"?[b.partij]:iban?[b.iban]:r.veld==="alles"?[b.mededeling,b.partij]:[b.mededeling];
  return fields.some(f=>{let t=norm(f);if(iban)t=t.replace(/\s/g,"");if(!t)return false;return r.op==="begint"?t.startsWith(v):r.op==="gelijk"?t===v:t.includes(v)});
}
let PIDX=null,PIDXKEY=null;
function partijIndex(){const key=S.boekingen;if(PIDX&&PIDXKEY===key)return PIDX;const m=new Map();
  for(const b of S.boekingen.values()){if(!b.categorie||b.status==="controle")continue;const p=norm(b.partij);if(p.length<4)continue;if(!m.has(p))m.set(p,new Map());const c=m.get(p);c.set(b.categorie,(c.get(b.categorie)||0)+1)}
  PIDX=m;PIDXKEY=key;return m}
function suggest(b){
  for(const r of actieveRegels())if(matchRegel(r,b))return{categorie:r.categorie,regel:r.id,naam:"Regel: "+(r.naam||OPS[r.op]+" “"+r.waarde+"”"),zeker:true};
  const c=partijIndex().get(norm(b.partij));
  if(c&&c.size===1){const [cat,n]=[...c.entries()][0];if(n>=2)return{categorie:cat,naam:"Zelfde tegenpartij als "+n+" eerdere boekingen",zeker:false}}
  return null;
}
function findLid(b){const t=norm((b.mededeling||"")+" "+(b.partij||""));const hits=ctx().leden.filter(l=>{const a=norm(l.naam),v=norm(l.voornaam);return a&&v&&t.includes(a)&&t.includes(v)});return hits.length===1?hits[0].id:null}
function regelText(r){return `${esc(VELD[r.veld]||"Mededeling")} ${esc(OPS[r.op]||"bevat")} <b>“${esc(r.waarde)}”</b>`}

/* overzicht */
VIEWS.boekhouding=()=>({title:"Boekhouding",sub:"Overzicht boekjaar "+JAAR,actions:boekActions(),body(){
  const C=ctx();const tv=teVerwerken(C).length;const res=C.tin-C.tuit;
  const cats=Object.entries(C.perCat).map(([k,v])=>({k,...v,net:v.in-v.uit})).sort((a,b)=>(b.in+b.uit)-(a.in+a.uit));
  const max=Math.max(1,...cats.map(c=>Math.max(c.in,c.uit)));
  const recent=C.boek.slice(-8).reverse();
  return boekTabs("boekhouding")+`<div class="tiles six">
    <div class="tile hero"><span class="lbl">Totaal saldo</span><span class="val">${eur(C.kas+C.rek)}</span></div>
    <div class="tile"><span class="lbl">Rekening</span><span class="val">${eur(C.rek)}</span></div>
    <div class="tile"><span class="lbl">Kas</span><span class="val">${eur(C.kas)}</span></div>
    <div class="tile"><span class="lbl">Inkomsten</span><span class="val in">${eur(C.tin)}</span></div>
    <div class="tile"><span class="lbl">Uitgaven</span><span class="val out">${eur(C.tuit)}</span></div>
    <a class="tile" href="#verwerken"><span class="lbl">Resultaat</span><span class="val ${res>=0?"in":"out"}">${res>=0?"+":"−"}${eur(Math.abs(res))}</span></a>
  </div>
  <div class="panel"><div class="panel-h"><h2>Inkomsten en uitgaven per maand</h2><span class="grow"></span><span class="legend"><i style="background:var(--good)"></i>In <i style="background:var(--bad)"></i>Uit</span></div><div class="panel-b">${maandChart(C)}</div></div>
  <div class="grid g2" style="align-items:start">
    <div class="panel"><div class="panel-h"><h2>Resultaat per categorie</h2></div><div class="tw"><table><thead><tr><th>Categorie</th><th class="num">In</th><th class="num">Uit</th><th class="num">Netto</th><th style="width:24%"></th></tr></thead><tbody>
      ${cats.map(c=>`<tr class="click" data-act="filterCat" data-v="${esc(c.k)}" title="Toon de boekingen van ${esc(c.k)}"><td><span class="cat">${esc(c.k)}</span></td><td class="num in">${c.in?eur(c.in):""}</td><td class="num out">${c.uit?eur(c.uit):""}</td><td class="num"><b class="${c.net>=0?"in":"out"}">${c.net>=0?"+":"−"}${eur(Math.abs(c.net))}</b></td>
        <td><div class="track2"><span style="width:${c.in/max*100}%;background:var(--good)"></span><span style="width:${c.uit/max*100}%;background:var(--bad)"></span></div></td></tr>`).join("")||'<tr><td colspan="5" class="empty">Nog geen boekingen in '+JAAR+'.</td></tr>'}
      </tbody><tfoot><tr><td>Totaal</td><td class="num in">${eur(C.tin)}</td><td class="num out">${eur(C.tuit)}</td><td class="num ${res>=0?"in":"out"}">${res>=0?"+":"−"}${eur(Math.abs(res))}</td><td></td></tr></tfoot></table></div></div>
    <div class="panel"><div class="panel-h"><h2>Laatste boekingen</h2><span class="grow"></span><a class="btn sm" href="#boekingen">Alle boekingen</a></div><div class="list" style="padding:4px 20px">
      ${recent.map(b=>`<div class="li click" data-act="toonBoeking" data-id="${esc(b.id)}"><span class="muted nowrap" style="width:84px">${fmtDate(b.datum)}</span><span class="grow trunc">${esc(b.partij||b.mededeling)}<br><span class="muted small">${b.categorie?esc(b.categorie):"Te verwerken"}</span></span>${bedragCel(b)}</div>`).join("")||'<div class="empty">Nog geen boekingen.</div>'}
    </div></div>
  </div>`}});
function maandChart(C){
  const m=Array.from({length:12},()=>({in:0,uit:0}));for(const b of C.boek){const i=+String(b.datum||"").slice(5,7)-1;if(i>=0&&i<12)m[i][b.richting==="uit"?"uit":"in"]+=b.bedrag}
  const W=900,H=240,P=46,B=26;const top=Math.max(1,...m.map(x=>Math.max(x.in,x.uit)));const stepV=[100,200,250,500,1000,2000,2500,5000,10000,20000,50000].find(s=>top/s<=4)||100000;const hi=Math.ceil(top/stepV)*stepV;
  const step=(W-P-8)/12,bw=Math.min(24,step*.3),y=v=>10+(hi-v)/hi*(H-B-10);const ticks=[];for(let v=0;v<=hi;v+=stepV)ticks.push(v);
  return `<div class="tw"><svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:560px;height:auto;display:block" role="img" aria-label="Inkomsten en uitgaven per maand">
  ${ticks.map(v=>`<line x1="${P}" x2="${W-6}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${P-8}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="var(--muted)">${kfmt(v)}</text>`).join("")}
  ${m.map((x,i)=>{const x0=P+i*step+(step-2*bw-3)/2;return `<g class="mbar" data-act="filterMaand" data-v="${String(i+1).padStart(2,"0")}" style="cursor:pointer"><title>${MAANDEN_VOL[i]}: in ${eur(x.in)}, uit ${eur(x.uit)}</title><rect x="${P+i*step}" y="6" width="${step}" height="${H-B-6}" fill="transparent"/>
    <rect x="${x0}" y="${y(x.in)}" width="${bw}" height="${Math.max(0,y(0)-y(x.in))}" fill="var(--good)" rx="2"/><rect x="${x0+bw+3}" y="${y(x.uit)}" width="${bw}" height="${Math.max(0,y(0)-y(x.uit))}" fill="var(--bad)" rx="2"/>
    <text x="${P+i*step+step/2}" y="${H-7}" text-anchor="middle" font-size="11.5" fill="var(--muted)">${MAANDEN[i]}</text></g>`}).join("")}
  </svg></div><div class="muted small" style="margin-top:6px">Klik op een maand om de boekingen ervan te zien.</div>`;
}

/* journaal */
VIEWS.boekingen=()=>({title:"Boekingen",sub:"Journaal boekjaar "+JAAR,actions:'<button class="btn" data-act="exportBoek">'+ic("download")+'Exporteren</button>'+boekActions(),body(){
  const C=ctx();
  return boekTabs("boekingen")+`<div class="bar">
   <div class="search">${ic("search")}<input id="boekQ" data-live data-input="boekQ" placeholder="Zoek op naam, mededeling, bedrag of nummer" value="${esc(UI.boekQ)}"></div>
   <select class="sel" id="boekMaand" data-change="boekMaand" aria-label="Maand"><option value="">Hele jaar</option>${MAANDEN_VOL.map((m,i)=>{const v=String(i+1).padStart(2,"0");return `<option value="${v}"${UI.boekMaand===v?" selected":""}>${m}</option>`}).join("")}</select>
   <select class="sel" id="boekCat" data-change="boekCat" aria-label="Categorie"><option value="">Alle categorieën</option>${[...catList(C),"(geen categorie)"].map(k=>`<option${UI.boekCat===k?" selected":""}>${esc(k)}</option>`).join("")}</select>
   <div class="seg" role="group" aria-label="Rekening of kas">${[["","Alles"],["Rekening","Rekening"],["Kas","Kas"]].map(([k,l])=>`<button data-act="boekRek" data-v="${k}" class="${UI.boekRek===k?"on":""}">${l}</button>`).join("")}</div>
   <div class="seg" role="group" aria-label="In of uit">${[["","In en uit"],["in","In"],["uit","Uit"]].map(([k,l])=>`<button data-act="boekDir" data-v="${k}" class="${UI.boekDir===k?"on":""}">${l}</button>`).join("")}</div>
   ${UI.boekQ||UI.boekMaand||UI.boekCat||UI.boekRek||UI.boekDir?'<button class="btn ghost sm" data-act="filtersWis">Filters wissen</button>':""}
  </div><div id="boekList">${journal()}</div>`}});
function journalList(){
  const C=ctx();const q=norm(UI.boekQ);let L=C.boek;
  if(UI.boekMaand)L=L.filter(b=>String(b.datum||"").slice(5,7)===UI.boekMaand);
  if(UI.boekCat)L=L.filter(b=>(b.categorie||"(geen categorie)")===UI.boekCat);
  if(UI.boekRek)L=L.filter(b=>b.rekening===UI.boekRek);
  if(UI.boekDir)L=L.filter(b=>(b.richting==="uit"?"uit":"in")===UI.boekDir);
  if(q)L=L.filter(b=>(b._m+" "+b._p+" "+norm(b.categorie)+" "+String(b.bedrag).replace(".",",")+" "+(b.nr??"")+" "+norm(b.iban)).includes(q));
  const s=UI.boekSort||{k:"datum",d:-1};
  const key={datum:b=>(b.datum||"")+String(b.nr||0).padStart(7,"0"),nr:b=>b.nr||0,bedrag:b=>signed(b),categorie:b=>norm(b.categorie)||"~",partij:b=>norm(b.partij||b.mededeling)}[s.k]||(b=>b.datum||"");
  return L.slice().sort((a,b)=>{const x=key(a),y=key(b);return (x<y?-1:x>y?1:0)*s.d});
}
function journal(){
  const L=journalList();for(const id of SEL)if(!S.boekingen.has(id))SEL.delete(id);
  const tin=L.reduce((s,b)=>s+(b.richting!=="uit"?b.bedrag:0),0),tuit=L.reduce((s,b)=>s+(b.richting==="uit"?b.bedrag:0),0);
  const pages=Math.max(1,Math.ceil(L.length/PAGE));UI.boekPage=Math.max(0,Math.min(UI.boekPage||0,pages-1));const from=UI.boekPage*PAGE;const rows=L.slice(from,from+PAGE);
  const allSel=rows.length>0&&rows.every(b=>SEL.has(b.id));const s=UI.boekSort||{k:"datum",d:-1};
  const th=(k,l,cls="")=>`<th class="${cls} sortable${s.k===k?" sorted":""}" data-act="boekSort" data-v="${k}" aria-sort="${s.k===k?(s.d>0?"ascending":"descending"):"none"}">${l}<span class="arr">${s.k===k?(s.d>0?"▲":"▼"):""}</span></th>`;
  const bulk=SEL.size?`<div class="bulkbar" data-w><b>${SEL.size} geselecteerd</b><select class="sel" id="bulkCat" aria-label="Categorie voor selectie"><option value="">Categorie kiezen…</option>${selOpts(catList(ctx()),"")}</select><button class="btn sm solid" data-act="bulkCat">Toekennen</button><button class="btn sm" data-act="bulkOk">Markeren als gecontroleerd</button><button class="btn sm danger" data-act="bulkDel">Verwijderen</button><span class="grow"></span><button class="btn sm ghost" data-act="selClear">Selectie wissen</button></div>`:"";
  return `${bulk}<div class="panel"><div class="sumbar"><span><b>${L.length}</b> boekingen</span><span>In <b class="in">${eur(tin)}</b></span><span>Uit <b class="out">${eur(tuit)}</b></span><span>Saldo <b class="${tin-tuit>=0?"in":"out"}">${tin-tuit>=0?"+":"−"}${eur(Math.abs(tin-tuit))}</b></span></div>
  <div class="tw"><table class="journal"><thead><tr><th class="chk"><input type="checkbox" data-selall aria-label="Alles op deze pagina selecteren"${allSel?" checked":""}${canWrite?"":" disabled"}></th>${th("nr","Nr","num")}${th("datum","Datum")}${th("partij","Omschrijving")}${th("categorie","Categorie")}<th>Rekening</th>${th("bedrag","Bedrag","num")}<th class="num">Saldo na</th></tr></thead><tbody>
  ${rows.map(b=>`<tr class="click${SEL.has(b.id)?" selrow":""}" data-act="toonBoeking" data-id="${esc(b.id)}"><td class="chk"><input type="checkbox" data-sel="${esc(b.id)}" aria-label="Selecteer boeking ${esc(b.nr??"")}"${SEL.has(b.id)?" checked":""}${canWrite?"":" disabled"}></td>
   <td class="num muted">${esc(b.nr??"")}</td><td class="nowrap">${fmtDate(b.datum)}</td>
   <td class="desc"><div class="d1">${esc(b.partij||b.mededeling||"—")}</div>${b.partij&&b.mededeling?`<div class="d2">${esc(b.mededeling)}</div>`:""}</td>
   <td>${catCell(b)}</td><td class="nowrap"><span class="acct${b.rekening==="Kas"?" kas":""}">${esc(b.rekening)}</span>${b.bron==="bank"||b.bron==="api"?' <span class="muted small" title="'+esc(bronLabel(b))+'">'+ic("bank")+'</span>':""}</td>
   <td class="num">${bedragCel(b)}</td><td class="num muted">${eur(b.rekening==="Kas"?b._kas:b._rek)}</td></tr>`).join("")||'<tr><td colspan="8" class="empty">Geen boekingen gevonden met deze filters.</td></tr>'}
  </tbody></table></div>
  ${pages>1?`<div class="pager"><span class="muted">${from+1}–${Math.min(from+PAGE,L.length)} van ${L.length}</span><span class="grow"></span><button class="btn sm" data-act="page" data-v="-1"${UI.boekPage===0?" disabled":""}>Vorige</button><span class="muted small">Pagina ${UI.boekPage+1} van ${pages}</span><button class="btn sm" data-act="page" data-v="1"${UI.boekPage>=pages-1?" disabled":""}>Volgende</button></div>`:""}</div>`;
}
function refreshJournal(){const el=$("#boekList");if(el)el.innerHTML=journal()}

/* te verwerken */
VIEWS.verwerken=()=>({title:"Te verwerken",sub:"Boekingen zonder categorie, of met een voorstel dat je nog moet bevestigen",actions:boekActions(),body(){
  const C=ctx();const L=teVerwerken(C).slice().sort((a,b)=>(b.datum||"").localeCompare(a.datum||""));const cats=catList(C);
  if(!L.length)return boekTabs("verwerken")+'<div class="panel"><div class="empty"><b style="color:var(--ink)">Alles is verwerkt.</b><br>Bankregels waarvoor geen regel past, verschijnen hier na een import.</div></div>';
  return boekTabs("verwerken")+`<div class="bar"><span class="muted">${L.length} boekingen wachten op een categorie of bevestiging.</span><span class="grow"></span><button class="btn" data-w data-act="regelsToepassen">Regels opnieuw toepassen</button><button class="btn primary" data-w data-act="alleBevestigen">Alle voorstellen bevestigen</button></div>
  <div class="panel"><div class="tw"><table class="journal"><thead><tr><th>Datum</th><th>Omschrijving</th><th class="num">Bedrag</th><th>Categorie</th><th>Waarom dit voorstel</th><th></th></tr></thead><tbody>
  ${L.map(b=>{const s=b.categorie?null:suggest(b);const cat=b.categorie||(s&&s.categorie)||"";const why=b.categorie?(b.regelNaam||"Automatisch voorgesteld"):(s?s.naam:"Geen passende regel");
    return `<tr><td class="nowrap">${fmtDate(b.datum)}</td><td class="desc"><div class="d1">${esc(b.partij||b.mededeling||"—")}</div>${b.partij&&b.mededeling?`<div class="d2">${esc(b.mededeling)}</div>`:""}</td><td class="num">${bedragCel(b)}</td>
    <td><select class="sel sm" data-vcat="${esc(b.id)}" aria-label="Categorie"${canWrite?"":" disabled"}><option value="">Kies…</option>${selOpts(cats,cat)}</select></td><td class="muted small">${esc(why)}</td>
    <td class="nowrap" style="text-align:right"><button class="btn sm solid" data-w data-act="vOk" data-id="${esc(b.id)}">Bevestigen</button> <button class="btn sm ghost" data-w data-act="regelVan" data-id="${esc(b.id)}">Regel maken</button></td></tr>`}).join("")}
  </tbody></table></div></div>`}});

/* regels */
VIEWS.regels=()=>({title:"Automatische regels",sub:"Zo krijgen nieuwe bankregels vanzelf de juiste categorie",actions:'<button class="btn primary" data-w data-act="nieuweRegel">'+ic("plus")+'Nieuwe regel</button>',body(){
  const C=ctx();const R=[...S.regels.values()].sort(byVolg);const act=R.filter(r=>r.actief!==false);
  let cov=0,good=0;for(const b of C.boek){const r=act.find(r=>matchRegel(r,b));if(r){cov++;if(r.categorie===b.categorie)good++}}
  return boekTabs("regels")+`<div class="note info">Bij elke import loopt de app de regels van boven naar onder af. De eerste regel die past, bepaalt de categorie. Past er geen, dan kijkt de app naar eerdere boekingen van dezelfde tegenpartij en zet ze de boeking bij <a href="#verwerken">Te verwerken</a> om te bevestigen.</div>
  <div class="tiles"><div class="tile"><span class="lbl">Actieve regels</span><span class="val">${act.length}</span><span class="hint">${R.length-act.length} uitgeschakeld</span></div>
   <div class="tile"><span class="lbl">Dekking ${JAAR}</span><span class="val">${C.boek.length?Math.round(cov/C.boek.length*100):0}%</span><span class="hint">${cov} van ${C.boek.length} boekingen krijgen een regel</span></div>
   <div class="tile"><span class="lbl">Juistheid</span><span class="val">${cov?Math.round(good/cov*100):0}%</span><span class="hint">Zelfde categorie als nu geboekt</span></div></div>
  <div class="panel"><div class="tw"><table><thead><tr><th style="width:84px">Volgorde</th><th>Aan</th><th>Als</th><th>Geldt voor</th><th>Dan categorie</th><th class="num">Treffers ${JAAR}</th><th class="num">Klopt</th><th></th></tr></thead><tbody>
  ${R.map((r,i)=>{const hits=C.boek.filter(b=>matchRegel(r,b));const ok=hits.filter(b=>b.categorie===r.categorie).length;
    return `<tr${r.actief===false?' class="dim"':""}><td class="nowrap"><span class="muted" style="display:inline-block;width:20px">${i+1}</span><button class="btn sm ghost" data-w data-act="regelUp" data-id="${esc(r.id)}" aria-label="Hoger"${i===0?" disabled":""}>▲</button><button class="btn sm ghost" data-w data-act="regelDown" data-id="${esc(r.id)}" aria-label="Lager"${i===R.length-1?" disabled":""}>▼</button></td>
    <td><input type="checkbox" data-ractief="${esc(r.id)}"${r.actief!==false?" checked":""} aria-label="Regel aan of uit"${canWrite?"":" disabled"}></td><td>${regelText(r)}${r.naam?`<div class="muted small">${esc(r.naam)}</div>`:""}</td><td class="muted small">${esc(RICHTING[r.richting||"beide"])}</td><td><span class="cat">${esc(r.categorie)}</span></td>
    <td class="num">${hits.length}</td><td class="num">${hits.length?Math.round(ok/hits.length*100)+"%":"–"}</td><td style="text-align:right"><button class="btn sm" data-w data-act="regelEdit" data-id="${esc(r.id)}">Wijzigen</button></td></tr>`}).join("")||'<tr><td colspan="8" class="empty">Nog geen regels. Maak er een met “Nieuwe regel”.</td></tr>'}
  </tbody></table></div></div>`}});
function regelForm(r,id){
  const C=ctx();const n=[...S.regels.values()].length;
  modal(id?"Regel wijzigen":"Nieuwe regel",`<form id="fRegel" class="form">
   ${fld("rVeld","Kijk naar",`<select id="rVeld" name="veld" data-rf>${selOpts(Object.entries(VELD),r.veld||"mededeling")}</select>`)}
   ${fld("rOp","Voorwaarde",`<select id="rOp" name="op" data-rf>${selOpts(Object.entries(OPS),r.op||"bevat")}</select>`)}
   ${fld("rWaarde","Tekst *",inp("rWaarde",r.waarde,'name="waarde" data-rf placeholder="bv. lidgeld, banket, SumUp"'),"full")}
   ${fld("rRich","Geldt voor",`<select id="rRich" name="richting" data-rf>${selOpts(Object.entries(RICHTING),r.richting||"beide")}</select>`)}
   ${fld("rCat","Dan categorie *",`<select id="rCat" name="categorie" data-rf><option value="">Kies…</option>${selOpts(catList(C),r.categorie)}</select>`)}
   ${fld("rNaam","Omschrijving (optioneel)",inp("rNaam",r.naam,'name="naam" placeholder="bv. Bankkosten Argenta"'),"full")}
   <div class="full" id="rPrev"></div><div class="err full" id="rErr"></div></form>`,
   `${id?'<button class="btn ghost danger" id="rDel">Verwijderen</button><span class="grow"></span>':""}<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="rOk">Bewaren</button>`);
  regelPreview();
  $("#rOk").onclick=async()=>{const f=formData($("#fRegel"));if(!f.waarde.trim()){$("#rErr").textContent="Vul de tekst in waarop de regel moet letten.";return}if(!f.categorie){$("#rErr").textContent="Kies een categorie.";return}
    const max=Math.max(0,...[...S.regels.values()].map(x=>x.volgorde||0));
    const d={...stripId(r),veld:f.veld,op:f.op,waarde:f.waarde.trim(),richting:f.richting,categorie:f.categorie,naam:f.naam.trim(),actief:r.actief!==false,volgorde:r.volgorde??(max+10)};
    closeModal();await write("regels",id||newId("regels"),d);toast("Regel bewaard.")};
  if(id)$("#rDel").onclick=()=>confirmBox("Deze regel verwijderen?","Verwijderen",async()=>{await write("regels",id,null,{del:true});toast("Regel verwijderd.")});
}
function regelPreview(){const el=$("#rPrev");if(!el)return;const f=formData($("#fRegel"));const r={...f};const C=ctx();
  if(!String(f.waarde||"").trim()){el.innerHTML='<div class="note info">Vul een tekst in om te zien welke boekingen van '+JAAR+' deze regel zou vinden.</div>';return}
  const hits=C.boek.filter(b=>matchRegel(r,b));const anders=hits.filter(b=>f.categorie&&b.categorie!==f.categorie);
  el.innerHTML=`<div class="note info"><b>${hits.length}</b> boekingen in ${JAAR} passen bij deze regel${f.categorie?`, waarvan <b>${anders.length}</b> nu een andere categorie hebben`:""}.${hits.length?'<div class="small" style="margin-top:6px">'+hits.slice(-4).reverse().map(b=>`${fmtDate(b.datum)} · ${esc(b.partij||b.mededeling)} · ${esc(b.categorie||"geen categorie")}`).join("<br>")+"</div>":""}</div>`}
function regelVan(b){const p=String(b.partij||"").trim();regelForm(p&&p.length>3?{veld:"partij",op:"bevat",waarde:p,categorie:b.categorie||(suggest(b)||{}).categorie||""}:{veld:"mededeling",op:"bevat",waarde:String(b.mededeling||"").split(/\s+/).slice(0,3).join(" "),categorie:b.categorie||""},null)}

/* bank */
VIEWS.bank=()=>({title:"Bankimport",sub:"Rekeninguittreksels van Argenta inlezen",body(){
  const imps=[...S.imports.values()].sort((a,b)=>String(b.tijd||"").localeCompare(String(a.tijd||"")));
  return boekTabs("bank")+`<div class="grid g2" style="align-items:start">
  <div class="panel"><div class="panel-h"><h2>Bestand importeren</h2></div><div class="panel-b stack">
    <p style="margin:0">Exporteer in Argenta Online Banking je verrichtingen als CSV- of Excel-bestand en kies het hier. Je ziet eerst een voorbeeld. Er wordt niets bewaard tot je op Importeren klikt.</p>
    <ul class="checks"><li>Elke regel krijgt de categorie van de eerste passende <a href="#regels">regel</a>.</li><li>Verrichtingen die al geboekt zijn, worden overgeslagen: zelfde bankreferentie, of zelfde datum, bedrag en tegenpartij.</li><li>Lidgelden worden op naam aan het juiste lid gekoppeld.</li><li>Wat geen regel heeft, komt bij <a href="#verwerken">Te verwerken</a>.</li></ul>
    <div data-w><button class="btn primary" data-act="importBank">${ic("upload")}Bestand kiezen</button></div></div></div>
  <div class="panel" id="bankKop"><div class="panel-h"><h2>Rechtstreekse koppeling met de bank</h2></div><div class="panel-b"><div class="muted">Status laden…</div></div></div></div>
  <div class="panel"><div class="panel-h"><h2>Importgeschiedenis</h2></div><div class="tw"><table><thead><tr><th>Wanneer</th><th>Bestand</th><th>Bron</th><th>Boekjaar</th><th class="num">Nieuw</th><th class="num">Overgeslagen</th><th class="num">Te verwerken</th></tr></thead><tbody>
  ${imps.map(i=>`<tr><td class="nowrap">${fmtDate(String(i.tijd||"").slice(0,10))} ${esc(String(i.tijd||"").slice(11,16))}</td><td class="trunc">${esc(i.bestand)}</td><td>${esc(i.bron==="api"?"Bankkoppeling":"Bestand")}</td><td>${esc(i.jaar)}</td><td class="num">${i.nieuw||0}</td><td class="num">${i.dubbel||0}</td><td class="num">${i.open||0}</td></tr>`).join("")||'<tr><td colspan="7" class="empty">Nog geen imports. Elke import van een bankbestand verschijnt hier.</td></tr>'}
  </tbody></table></div></div>`}});

/* ---------- punten ---------- */
VIEWS.punten=()=>({title:"Puntensysteem",sub:"Inzet van leden in "+JAAR+" (erewachters zijn altijd goud)",body(){
  const C=ctx(),w=C.c.gewichten;
  return `<div class="note info">Punten: kaarten ×${w.kaarten} · kalenderdozen ×${w.kalenders} · shifts ×${w.shifts} · bestuursvergaderingen ×${w.vergaderingen} · plus extra punten. Zilver vanaf ${C.c.drempels.zilver}, goud vanaf ${C.c.drempels.goud}. Kalenderdozen vul je in bij <a href="#kalenders">Kalenders</a>. Waarden wijzigen bewaart meteen.</div>
  <div class="bar"><div class="search">${ic("search")}<input id="puntQ" data-live data-input="puntQ" placeholder="Zoek lid" value="${esc(UI.puntQ)}"></div>
  <div class="seg" role="group" aria-label="Sorteren">${[["naam","Op naam"],["totaal","Op punten"]].map(([k,l])=>`<button data-act="puntSort" data-v="${k}" class="${UI.puntSort===k?"on":""}">${l}</button>`).join("")}</div></div>
  <div class="panel" id="puntList">${puntTable()}</div>`}});
function puntTable(){
  const C=ctx(),w=C.c.gewichten,q=norm(UI.puntQ);
  let list=C.leden.filter(l=>l.categorie!=="Erewacht").map(l=>C.rows.get(l.id));
  if(q)list=list.filter(r=>norm(naamVol(r.lid)).includes(q));
  if(UI.puntSort==="totaal")list.sort((a,b)=>b.p.totaal-a.p.totaal);
  const dis=canWrite?"":" disabled";
  const inp=(r,f)=>`<input class="cellin" type="number" min="0" step="1" inputmode="numeric" data-live data-jl="${f}" data-id="${esc(r.lid.id)}" value="${r.jl[f]||""}" aria-label="${f} ${esc(naamVol(r.lid))}"${dis}>`;
  return `<div class="tw" style="max-height:72vh"><table><thead><tr><th>Naam</th><th class="num">Kaarten ×${w.kaarten}</th><th class="num">Kalenderdozen ×${w.kalenders}</th><th class="num">Shifts ×${w.shifts}</th><th class="num">Vergaderingen ×${w.vergaderingen}</th><th>Extra inspanning</th><th class="num">Extra punten</th><th class="num">Totaal</th><th>Status</th></tr></thead><tbody>
  ${list.map(r=>`<tr><td class="nm" style="white-space:nowrap"><b>${esc(r.lid.naam)}</b> ${esc(r.lid.voornaam)}</td><td class="num">${inp(r,"kaarten")}</td><td class="num">${r.jl.kalUitgevoerd||0}</td><td class="num">${inp(r,"shifts")}</td><td class="num">${inp(r,"vergaderingen")}</td>
  <td><input class="cellin wide" data-live data-jl="extraTekst" data-id="${esc(r.lid.id)}" value="${esc(r.jl.extraTekst||"")}" placeholder="bv. 150 jaar" aria-label="Extra inspanning ${esc(naamVol(r.lid))}"${dis}></td><td class="num">${inp(r,"extraPunten")}</td><td class="num"><b>${r.p.totaal}</b></td><td>${medal(r.status)}</td></tr>`).join("")||'<tr><td colspan="9" class="empty">Geen leden gevonden.</td></tr>'}
  </tbody></table></div>`;
}

/* ---------- kalenders ---------- */
function kalStats(C){const rows=[...S.jaarleden.values()].filter(j=>j.jaar===C.Y&&j.kal);const omloop=rows.reduce((s,j)=>s+(j.kalOpgehaald||0),0),uit=rows.reduce((s,j)=>s+(j.kalUitgevoerd||0),0);return{rows,omloop,uit,stock:C.c.kalenderStock-omloop-uit}}
VIEWS.kalenders=()=>({title:"Kalenders "+JAAR,sub:"Verdeling en verkoop van de kalenderdozen",
  actions:(/^https?:\/\//i.test(jaarCfg(JAAR).kaartUrl||"")?'<a class="btn" href="'+esc(jaarCfg(JAAR).kaartUrl)+'" target="_blank" rel="noopener">'+ic("kaart")+'Kaart openen</a>':'')+'<button class="btn primary" data-w data-act="kalToevoegen">'+ic("plus")+'Persoon toevoegen</button>',body(){
  const C=ctx(),k=kalStats(C);
  const inLijst=new Set(k.rows.map(j=>j.lidId).filter(Boolean));
  const ontbreekt=C.leden.filter(l=>l.categorie!=="Erewacht"&&C.rows.get(l.id).lg.ok&&!inLijst.has(l.id));
  return `<div class="tiles"><div class="tile"><span class="lbl">Nog in stock</span><span class="val">${k.stock}</span><span class="hint">van ${C.c.kalenderStock} dozen</span></div>
    <div class="tile"><span class="lbl">In omloop</span><span class="val">${k.omloop}</span><span class="hint">opgehaald, nog niet klaar</span></div>
    <div class="tile"><span class="lbl">Uitgevoerd</span><span class="val">${k.uit}</span><span class="hint">${k.uit*C.c.gewichten.kalenders} punten in totaal</span></div>
    <div class="tile"><span class="lbl">Personen in lijst</span><span class="val">${k.rows.length}</span><span class="hint">${ontbreekt.length} actieve leden ontbreken</span></div></div>
  ${ontbreekt.length?`<details class="note"><summary style="cursor:pointer;font-weight:600">${ontbreekt.length} actieve leden (geen erewacht) staan niet in de kalenderlijst</summary><div style="margin-top:6px">${ontbreekt.map(l=>esc(naamVol(l))).join(", ")}</div></details>`:""}
  <div class="bar"><div class="search">${ic("search")}<input id="kalQ" data-live data-input="kalQ" placeholder="Zoek persoon" value="${esc(UI.kalQ)}"></div></div>
  <div class="panel" id="kalList">${kalTable()}</div>`}});
function kalNaam(j){if(j.lidId){const l=S.leden.get(j.lidId);return l?naamVol(l):j.lidId}return j.naam||"?"}
function kalTable(){
  const C=ctx(),k=kalStats(C),q=norm(UI.kalQ),w=C.c.gewichten.kalenders;
  let list=k.rows.map(j=>({j,n:kalNaam(j)}));if(q)list=list.filter(x=>norm(x.n).includes(q));
  list.sort((a,b)=>(b.j.kalUitgevoerd||0)-(a.j.kalUitgevoerd||0)||(b.j.kalOpgehaald||0)-(a.j.kalOpgehaald||0)||a.n.localeCompare(b.n,"nl"));
  const dis=canWrite?"":" disabled";
  return `<div class="tw" style="max-height:72vh"><table><thead><tr><th class="num">#</th><th>Persoon</th><th class="num">Opgehaald (bezig)</th><th class="num">Uitgevoerd</th><th class="num">Punten</th><th></th></tr></thead><tbody>
  ${list.map((x,i)=>`<tr><td class="num muted">${i+1}</td><td><b>${esc(x.n)}</b>${x.j.lidId?"":' <span class="pill neutral">geen lid</span>'}</td>
  <td class="num"><input class="cellin" type="number" min="0" data-live data-kal="kalOpgehaald" data-id="${esc(x.j.id)}" value="${x.j.kalOpgehaald||""}" aria-label="Opgehaald ${esc(x.n)}"${dis}></td>
  <td class="num"><input class="cellin" type="number" min="0" data-live data-kal="kalUitgevoerd" data-id="${esc(x.j.id)}" value="${x.j.kalUitgevoerd||""}" aria-label="Uitgevoerd ${esc(x.n)}"${dis}></td>
  <td class="num"><b>${(x.j.kalUitgevoerd||0)*w}</b></td>
  <td style="white-space:nowrap;text-align:right"><button class="btn sm" data-w data-act="kalOphalen" data-id="${esc(x.j.id)}" title="Eén doos meegeven">+1 opgehaald</button> <button class="btn sm" data-w data-act="kalKlaar" data-id="${esc(x.j.id)}"${(x.j.kalOpgehaald||0)>0?"":" disabled"} title="Eén opgehaalde doos is volledig verkocht">Doos klaar</button></td></tr>`).join("")||'<tr><td colspan="6" class="empty">Nog niemand in de kalenderlijst voor '+JAAR+'.</td></tr>'}
  </tbody></table></div>`;
}

/* ---------- sponsors ---------- */
function sponsorOntvangen(s,C){
  const toks=norm(s.bedrijf).split(/[^a-z0-9]+/).filter(t=>t.length>=4&&!["bvba","sprl","groep","group"].includes(t));
  return C.boek.filter(b=>b.categorie==="Sponsoring"&&b.richting!=="uit"&&toks.some(t=>(b._m+" "+b._p).includes(t))).reduce((s,b)=>s+b.bedrag,0);
}
VIEWS.sponsors=()=>({title:"Sponsors",sub:"Sponsorbeheer",actions:'<button class="btn primary" data-w data-act="nieuweSponsor">'+ic("plus")+'Nieuwe sponsor</button>',body(){
  const C=ctx();const q=norm(UI.spQ);let list=[...S.sponsors.values()].sort((a,b)=>(a.bedrijf||"").localeCompare(b.bedrijf||"","nl"));
  if(q)list=list.filter(s=>norm(Object.values(s).join(" ")).includes(q));
  const totaal=[...S.sponsors.values()].reduce((s,x)=>s+num(x.bedrag),0);const ontv=C.boek.filter(b=>b.categorie==="Sponsoring"&&b.richting!=="uit").reduce((s,b)=>s+b.bedrag,0);
  return `<div class="tiles"><div class="tile"><span class="lbl">Sponsors</span><span class="val">${S.sponsors.size}</span></div><div class="tile"><span class="lbl">Afgesproken bedragen</span><span class="val">${eur(totaal)}</span></div><div class="tile"><span class="lbl">Ontvangen in ${JAAR}</span><span class="val in">${eur(ontv)}</span><span class="hint">Boekingen met categorie Sponsoring</span></div></div>
  <div class="bar"><div class="search">${ic("search")}<input id="spQ" data-live data-input="spQ" placeholder="Zoek sponsor" value="${esc(UI.spQ)}"></div></div>
  <div class="panel"><div class="tw"><table><thead><tr><th>Bedrijf</th><th>Contactpersoon</th><th>E-mail</th><th>Telefoon</th><th>KBO-nr.</th><th class="num">Bedrag</th><th>Ontvangen ${JAAR}</th></tr></thead><tbody>
  ${list.map(s=>{const o=sponsorOntvangen(s,C);return `<tr class="click" data-act="toonSponsor" data-id="${esc(s.id)}"><td><b>${esc(s.bedrijf)}</b><div style="color:var(--muted);font-size:13px">${esc(s.adres)}</div></td><td>${esc(s.voornaam)} ${esc(s.naam)}</td><td class="trunc">${esc(s.email)}</td><td style="white-space:nowrap">${esc(s.telefoon)}</td><td class="muted">${esc(s.kbo)}</td><td class="num">${eur(num(s.bedrag))}</td><td>${o?'<span class="pill ok">'+eur(o)+'</span>':'<span class="pill neutral">nog niets gevonden</span>'}</td></tr>`}).join("")||'<tr><td colspan="7" class="empty">Geen sponsors.</td></tr>'}
  </tbody></table></div></div>`}});

/* ---------- historiek ---------- */
function alleJaren(){
  const out=new Map();
  for(const a of S.archief.values()){const rows=(a.rijen||[]).map(r=>({nr:r[0],datum:r[1],categorie:r[2],mededeling:r[3],partij:r[4],rekening:r[5],bedrag:r[6],richting:r[7]}));
    out.set(a.jaar,{jaar:a.jaar,bron:"archief",beginKas:a.beginKas,beginRekening:a.beginRekening,rows})}
  for(const y of jaren()){const c=jaarCfg(y);const rows=[...S.boekingen.values()].filter(b=>b.jaar===y);out.set(y,{jaar:y,bron:"actief",beginKas:c.beginKas,beginRekening:c.beginRekening,rows})}
  const list=[...out.values()].sort((a,b)=>a.jaar-b.jaar);
  for(const j of list){let kas=j.beginKas,rek=j.beginRekening,tin=0,tuit=0;const perCat={};
    j.rows.sort((a,b)=>(a.datum||"").localeCompare(b.datum||"")||(a.nr||0)-(b.nr||0));
    for(const b of j.rows){const v=b.richting==="uit"?-b.bedrag:b.bedrag;if(b.rekening==="Kas")kas+=v;else if(b.rekening==="Rekening")rek+=v;
      if(b.richting==="uit")tuit+=b.bedrag;else tin+=b.bedrag;const k=b.categorie||"(geen categorie)";perCat[k]=perCat[k]||{in:0,uit:0,n:0};perCat[k][b.richting==="uit"?"uit":"in"]+=b.bedrag;perCat[k].n++;
      b._kas=r2(kas);b._rek=r2(rek)}
    Object.assign(j,{eindKas:r2(kas),eindRek:r2(rek),tin:r2(tin),tuit:r2(tuit),perCat})}
  list.forEach((j,i)=>{const p=list[i-1];j.gat=p&&p.jaar===j.jaar-1?r2((j.beginKas+j.beginRekening)-(p.eindKas+p.eindRek)):0;j.gatKas=p&&p.jaar===j.jaar-1?r2(j.beginKas-p.eindKas):0;j.gatRek=p&&p.jaar===j.jaar-1?r2(j.beginRekening-p.eindRek):0});
  return list;
}
VIEWS.historiek=()=>({title:"Historiek",sub:"Boekhouding over alle jaren",actions:'<button class="btn" data-act="exportHist">'+ic("download")+'Historiek als Excel</button>',body(){
  const L=alleJaren();if(!L.length)return '<div class="panel"><div class="empty">Nog geen boekjaren.</div></div>';
  const sel=L.find(j=>j.jaar===UI.histJaar)||L[L.length-1];
  const tot=L.reduce((s,j)=>s+j.rows.length,0);
  return boekTabs("historiek")+`<div class="panel"><div class="panel-h"><h2>Saldo op 31 december</h2><span class="grow"></span><span style="font-size:13px;color:var(--muted)">${L[0].jaar}–${L[L.length-1].jaar} · ${tot.toLocaleString("nl-BE")} boekingen</span></div><div class="panel-b">${histChart(L)}</div></div>
  <div class="panel"><div class="panel-h"><h2>Overzicht per jaar</h2></div><div class="tw"><table><thead><tr><th>Jaar</th><th class="num">Begin totaal</th><th class="num">Inkomsten</th><th class="num">Uitgaven</th><th class="num">Resultaat</th><th class="num">Eind kas</th><th class="num">Eind rekening</th><th class="num">Eind totaal</th><th class="num">Boekingen</th><th></th></tr></thead><tbody>
  ${L.slice().reverse().map(j=>{const res=j.tin-j.tuit;return `<tr class="click" data-act="histJaar" data-v="${j.jaar}"${j.jaar===sel.jaar?' style="outline:2px solid var(--accent);outline-offset:-2px"':""}><td style="white-space:nowrap"><b>${j.jaar}</b> ${j.bron==="archief"?'<span class="pill neutral">archief</span>':""}</td><td class="num">${eur(j.beginKas+j.beginRekening)}</td><td class="num in">${eur(j.tin)}</td><td class="num out">${eur(j.tuit)}</td><td class="num ${res>=0?"in":"out"}"><b>${res>=0?"+":"−"}${eur(Math.abs(res))}</b></td><td class="num">${eur(j.eindKas)}</td><td class="num">${eur(j.eindRek)}</td><td class="num"><b>${eur(j.eindKas+j.eindRek)}</b></td><td class="num">${j.rows.length}</td>
   <td>${Math.abs(j.gat)>=0.01||Math.abs(j.gatKas)>=0.01||Math.abs(j.gatRek)>=0.01?`<span class="pill warn" title="Beginsaldo ${j.jaar} wijkt af van eindsaldo ${j.jaar-1}: kas ${eur(j.gatKas)}, rekening ${eur(j.gatRek)}">sluit niet aan</span>`:""}</td></tr>`}).join("")}
  </tbody></table></div></div>
  ${L.some(j=>Math.abs(j.gatKas)>=0.01||Math.abs(j.gatRek)>=0.01)?`<div class="note">${L.filter(j=>Math.abs(j.gatKas)>=0.01||Math.abs(j.gatRek)>=0.01).map(j=>`Het beginsaldo van <b>${j.jaar}</b> sluit niet aan op het eindsaldo van ${j.jaar-1}: kas ${j.gatKas>0?"+":""}${eur(j.gatKas)}, rekening ${j.gatRek>0?"+":""}${eur(j.gatRek)}.`).join("<br>")}${L.some(j=>j.bron==="actief"&&(Math.abs(j.gatKas)>=0.01||Math.abs(j.gatRek)>=0.01))?" Je past een beginsaldo aan bij Instellingen, na het kiezen van dat boekjaar.":""}</div>`:""}
  <div class="bar"><div class="search">${ic("search")}<input id="histQ" data-live data-input="histQ" placeholder="Zoek in alle jaren, bv. een naam, banket of een leverancier" value="${esc(UI.histQ)}"></div></div>
  <div id="histList">${histDetail(L,sel)}</div>`}});
function histDetail(L,sel){
  const q=norm(UI.histQ);
  if(q){const hits=[];for(const j of L)for(const b of j.rows)if(norm(b.mededeling+" "+b.partij+" "+b.categorie).includes(q))hits.push(b);
    const tin=hits.reduce((s,b)=>s+(b.richting!=="uit"?b.bedrag:0),0),tuit=hits.reduce((s,b)=>s+(b.richting==="uit"?b.bedrag:0),0);
    return `<div class="panel"><div class="panel-h"><h2>Zoekresultaat</h2><span class="grow"></span><span style="font-size:13px;color:var(--muted)">${hits.length} boekingen · in ${eur(tin)} · uit ${eur(tuit)}</span></div>${histRows(hits.slice().reverse().slice(0,500),true)}${hits.length>500?'<div class="empty">Eerste 500 getoond. Verfijn je zoekopdracht.</div>':""}</div>`}
  const cats=Object.entries(sel.perCat).sort((a,b)=>(b[1].in+b[1].uit)-(a[1].in+a[1].uit));const max=Math.max(1,...cats.map(([,v])=>Math.max(v.in,v.uit)));
  return `<div class="grid g2" style="align-items:start"><div class="panel"><div class="panel-h"><h2>Categorieën ${sel.jaar}</h2></div><div class="panel-b">
    ${cats.map(([k,v])=>`<div class="catbar"><span class="trunc" title="${esc(k)}">${esc(k)}</span><div class="track"><span style="width:${v.in/max*50}%;background:var(--good)"></span><span style="width:${v.uit/max*50}%;background:var(--bad)"></span></div><b class="${v.in-v.uit>=0?"in":"out"}">${eur(v.in-v.uit)}</b></div>`).join("")||'<div class="empty">Geen boekingen.</div>'}</div></div>
  <div class="panel"><div class="panel-h"><h2>Kerncijfers ${sel.jaar}</h2>${sel.jaar===JAAR?`<span class="grow"></span><button class="btn sm" data-act="naarBoekjaar" data-v="${sel.jaar}">Open in Boekhouding</button>`:""}</div><div class="panel-b"><dl class="kv">
    <dt>Beginsaldo kas</dt><dd>${eur(sel.beginKas)}</dd><dt>Beginsaldo rekening</dt><dd>${eur(sel.beginRekening)}</dd><dt>Inkomsten</dt><dd class="in">${eur(sel.tin)}</dd><dt>Uitgaven</dt><dd class="out">${eur(sel.tuit)}</dd>
    <dt>Eindsaldo kas</dt><dd><b>${eur(sel.eindKas)}</b></dd><dt>Eindsaldo rekening</dt><dd><b>${eur(sel.eindRek)}</b></dd><dt>Bron</dt><dd>${sel.bron==="archief"?"Archief (VBHA_boekhouding.xlsm), alleen lezen":"Actief boekjaar in deze app"}</dd></dl></div></div></div>
  <div class="panel"><div class="panel-h"><h2>Boekingen ${sel.jaar}</h2><span class="grow"></span><span style="font-size:13px;color:var(--muted)">${sel.rows.length} boekingen</span></div>${histRows(sel.rows.slice().reverse(),false)}</div>`;
}
function histRows(rows,metJaar){
  return `<div class="tw" style="max-height:70vh"><table><thead><tr><th class="num">Nr</th><th>Datum</th><th>Categorie</th><th>Mededeling</th><th>Betaald aan / ontvangen van</th><th>Rek./kas</th><th class="num">In</th><th class="num">Uit</th>${metJaar?"":'<th class="num">Cumul kas</th><th class="num">Cumul rekening</th>'}</tr></thead><tbody>
  ${rows.map(b=>`<tr><td class="num muted">${b.nr??""}</td><td style="white-space:nowrap">${fmtDate(b.datum)}</td><td class="trunc" style="max-width:200px" title="${esc(b.categorie)}">${esc(b.categorie)}</td><td class="trunc" title="${esc(b.mededeling)}">${esc(b.mededeling)}</td><td class="trunc">${esc(b.partij)}</td><td>${esc(b.rekening)}</td>
  <td class="num in">${b.richting!=="uit"?eur(b.bedrag):""}</td><td class="num out">${b.richting==="uit"?eur(b.bedrag):""}</td>${metJaar?"":`<td class="num">${eur(b._kas)}</td><td class="num">${eur(b._rek)}</td>`}</tr>`).join("")||'<tr><td colspan="10" class="empty">Geen boekingen gevonden.</td></tr>'}</tbody></table></div>`;
}
function histChart(L){
  const W=900,H=220,P=46,B=26,n=L.length;const vals=L.map(j=>j.eindKas+j.eindRek);const hi=Math.max(1,...vals)*1.1;
  const step=(W-P-10)/n,bw=Math.min(46,step*.62),y=v=>10+(hi-v)/hi*(H-B-10);
  const ticks=[0,hi/2/1.1,hi/1.1].map(v=>Math.round(v/1000)*1000);
  return `<div class="tw"><svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:560px;height:auto;display:block" role="img" aria-label="Eindsaldo per jaar">
  ${ticks.map(v=>`<line x1="${P}" x2="${W-6}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${P-6}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="var(--muted)">${Math.round(v/1000)}k</text>`).join("")}
  ${L.map((j,i)=>{const x=P+i*step+(step-bw)/2,v=vals[i],k=j.eindKas;const on=j.jaar===UI.histJaar||(!UI.histJaar&&i===n-1);
    return `<g data-act="histJaar" data-v="${j.jaar}" style="cursor:pointer"><rect x="${x}" y="${y(v)}" width="${bw}" height="${Math.max(1,y(0)-y(v))}" fill="var(--accent)" fill-opacity="${on?1:.55}" rx="2"/><rect x="${x}" y="${y(k)}" width="${bw}" height="${Math.max(0,y(0)-y(k))}" fill="var(--ink)" fill-opacity=".18"/>
    <text x="${x+bw/2}" y="${H-8}" text-anchor="middle" font-size="11.5" fill="var(--muted)" font-weight="${on?700:400}">${j.jaar}</text>
    <text x="${x+bw/2}" y="${y(v)-5}" text-anchor="middle" font-size="10.5" fill="var(--ink)">${Math.round(v/100)/10}k</text></g>`}).join("")}
  </svg></div><div style="display:flex;gap:16px;font-size:13px;color:var(--muted);margin-top:6px"><span><i style="display:inline-block;width:10px;height:10px;background:var(--accent);border-radius:2px"></i> totaal (kas + rekening)</span><span><i style="display:inline-block;width:10px;height:10px;background:var(--ink);opacity:.25;border-radius:2px"></i> waarvan kas</span><span>Klik op een jaar voor de details.</span></div>`;
}
function exportHist(){
  const L=alleJaren(),wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(L.map(j=>({Jaar:j.jaar,"Begin kas":j.beginKas,"Begin rekening":j.beginRekening,Inkomsten:j.tin,Uitgaven:j.tuit,Resultaat:r2(j.tin-j.tuit),"Eind kas":j.eindKas,"Eind rekening":j.eindRek,"Eind totaal":r2(j.eindKas+j.eindRek),Boekingen:j.rows.length}))),"Overzicht");
  for(const j of L.slice().reverse())XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(j.rows.map(b=>({Nr:b.nr,Datum:fmtDate(b.datum),Categorie:b.categorie,Mededeling:b.mededeling,"Betaald aan/Ontvangen van":b.partij,"Rekening/Kas":b.rekening,Bedrag:b.bedrag,"IN/UIT":b.richting,"Cumul kas":b._kas,"Cumul rekening":b._rek}))),String(j.jaar));
  save("VBHA_historiek.xlsx",XLSX.write(wb,{type:"array",bookType:"xlsx"}));
}

/* ---------- bankkoppeling (Enable Banking) ---------- */
let BANK=null;
VIEWS.bank.after=()=>{loadBank()};
async function loadBank(force){
  const el=$("#bankKop");if(!el)return;
  if(BANK&&!force){el.innerHTML=bankHtml(BANK);return}
  try{BANK=await api("/api/bank/status")}catch(e){BANK={fout:e.message}}
  const el2=$("#bankKop");if(el2)el2.innerHTML=bankHtml(BANK);
}
function bankHtml(B){
  const head=(pill)=>`<div class="panel-h"><h2>Rechtstreekse koppeling met de bank</h2><span class="grow"></span>${pill}</div>`;
  if(B.fout)return head('<span class="pill nok">Niet bereikbaar</span>')+`<div class="panel-b"><p style="margin:0">De status kon niet opgehaald worden: ${esc(B.fout)}</p></div>`;
  if(!B.configured)return head('<span class="pill neutral">Nog niet ingesteld</span>')+`<div class="panel-b stack"><p style="margin:0">De koppeling loopt via Enable Banking, een erkende dienst voor rekeninginformatie (PSD2). Vul bij Vercel <span class="kbd">ENABLE_BANKING_APP_ID</span> en <span class="kbd">ENABLE_BANKING_PRIVATE_KEY</span> in en publiceer opnieuw. De stappen staan in README.md.</p></div>`;
  const K=B.koppelingen||[];
  const rows=K.map(k=>{const vervalt=k.valid_until?new Date(k.valid_until):null;const dagen=vervalt?Math.round((vervalt-Date.now())/864e5):null;
    return `<div class="li" style="align-items:flex-start"><span class="grow"><b>${esc(k.aspsp||"Bank")}</b>${(k.accounts||[]).map(a=>`<div class="small">${esc(a.naam||"Rekening")} · <span class="kbd">${esc(a.iban||"")}</span></div>`).join("")}
      <div class="muted small">Toestemming geldig tot ${vervalt?fmtDate(vervalt.toISOString().slice(0,10)):"?"}${dagen!=null&&dagen<21?` <span class="pill warn">nog ${Math.max(0,dagen)} dagen</span>`:""} · laatst opgehaald ${k.laatste_sync?fmtDate(k.laatste_sync.slice(0,10))+" "+k.laatste_sync.slice(11,16):"nog nooit"}</div></span>
      <span class="nowrap" data-w><button class="btn sm solid" data-act="bankSync">Nu ophalen</button> <button class="btn sm ghost danger" data-act="bankOntkoppel" data-id="${esc(k.id)}">Ontkoppelen</button></span></div>`}).join("");
  return head(K.length?'<span class="pill ok">Gekoppeld</span>':'<span class="pill neutral">Niet gekoppeld</span>')+`<div class="panel-b stack">
    ${K.length?`<div class="list">${rows}</div><p class="muted small" style="margin:0">Nieuwe verrichtingen worden elke ochtend automatisch opgehaald en lopen langs de regels. Wat geen regel heeft, komt bij Te verwerken. De bank vraagt periodiek om de toestemming te vernieuwen: koppel dan opnieuw.</p>`:
    `<p style="margin:0">Koppel de rekening van de vriendenkring. Je wordt doorgestuurd naar je bank om toestemming te geven. Daarna haalt de app elke ochtend de nieuwe verrichtingen op.</p>`}
    <div class="form" data-w><div class="fld"><label for="ebBank">Bank</label><select id="ebBank"><option value="">Banken laden…</option></select></div>
    <div class="fld"><label for="ebType">Soort rekening</label><select id="ebType"><option value="business">Zakelijk (vzw)</option><option value="personal">Particulier</option></select></div>
    <div class="full"><button class="btn primary" data-act="bankKoppel">${K.length?"Nog een rekening koppelen":"Rekening koppelen"}</button></div></div></div>`;
}
let ASPSPS=null;
async function fillBanks(){const sel=$("#ebBank");if(!sel)return;try{if(!ASPSPS)ASPSPS=(await api("/api/bank/aspsps")).aspsps||[];
  const opts=ASPSPS.slice().sort((a,b)=>a.name.localeCompare(b.name));sel.innerHTML=opts.map(a=>`<option value="${esc(a.name)}"${/argenta/i.test(a.name)?" selected":""}>${esc(a.name)}</option>`).join("")||'<option value="">Geen banken gevonden</option>'}
  catch(e){sel.innerHTML='<option value="">Lijst niet beschikbaar</option>'}}
const _bankHtml=bankHtml;bankHtml=function(B){setTimeout(fillBanks,0);return _bankHtml(B)};
async function bankKoppel(){const a=$("#ebBank").value;if(!a){toast("Kies eerst een bank.",true);return}
  const asp=(ASPSPS||[]).find(x=>x.name===a)||{};
  try{const r=await api("/api/bank/start",{method:"POST",body:JSON.stringify({aspsp:a,psuType:$("#ebType").value,maxSeconds:asp.maximum_consent_validity||null})});location.href=r.url}
  catch(e){toast("Koppelen starten lukte niet: "+e.message,true)}}
async function bankSync(btn){btn.disabled=true;btn.textContent="Bezig…";
  try{const r=await api("/api/bank/sync",{method:"POST",body:"{}"});toast(`${r.nieuw||0} nieuwe verrichtingen, ${r.dubbel||0} al geboekt${r.open?", "+r.open+" te verwerken":""}.`);await loadBank(true);if(r.open)location.hash="verwerken"}
  catch(e){toast("Ophalen lukte niet: "+e.message,true);btn.disabled=false;btn.textContent="Nu ophalen"}}
function bankOntkoppel(id){confirmBox("De koppeling met de bank verwijderen? De boekingen die al opgehaald zijn, blijven staan.","Ontkoppelen",async()=>{try{await api("/api/bank/unlink",{method:"POST",body:JSON.stringify({id})});toast("Koppeling verwijderd.");await loadBank(true)}catch(e){toast(e.message,true)}})}

/* ---------- mails ---------- */
function groepen(){
  const C=ctx();const cur=C.leden.map(l=>C.rows.get(l.id));
  const lidR=r=>({email:r.lid.email,voornaam:r.lid.voornaam,naam:r.lid.naam,bedrag:r.bedrag,mededeling:`${r.lid.naam} ${r.lid.voornaam} lidgeld ${JAAR}`,label:naamVol(r.lid)});
  const g=[
    ["alle","Alle leden",cur],
    ["lidgeld","Uitnodiging lidgeld (alle leden behalve ere-voorzitters)",cur.filter(r=>!isEreVoorzitter(r.lid))],
    ["herinnering","Herinnering: lidgeld nog niet betaald",cur.filter(r=>!r.lg.ok&&!isEreVoorzitter(r.lid))],
    ["betaald","Leden in orde met lidgeld",cur.filter(r=>r.lg.ok)],
    ["betaald-niet-ere","Betalende leden zonder erewacht",cur.filter(r=>r.lg.ok&&r.lid.categorie!=="Erewacht")],
    ["erewacht","Erewacht",cur.filter(r=>r.lid.categorie==="Erewacht")],
    ...cfg().ledenCategorieen.filter(k=>k!=="Erewacht").map(k=>["cat:"+k,"Categorie: "+k,cur.filter(r=>r.lid.categorie===k)])
  ].map(([id,label,rs])=>({id,label,list:rs.map(lidR)}));
  g.push({id:"sponsors",label:"Alle sponsors",list:[...S.sponsors.values()].map(s=>({email:s.email,voornaam:s.voornaam,naam:s.naam,bedrijf:s.bedrijf,bedrag:num(s.bedrag),mededeling:"",label:s.bedrijf}))});
  return g;
}
function vul(t,r){
  const c=cfg();
  let s=String(t||"");
  s=s.split("Beste xnaamx,").join("Beste "+r.voornaam+",").split(/xnaamx xvoornaamx lidgeld \d{4}/).join(r.mededeling).split("xx euro").join(r.bedrag+" euro").split("xnaamx").join(r.voornaam||"");
  const map={voornaam:r.voornaam||"",naam:r.naam||"",bedrag:String(r.bedrag??""),jaar:String(JAAR),mededeling:r.mededeling||"",bedrijf:r.bedrijf||"",rekeningnummer:c.rekeningnummer||"[rekeningnummer]",vereniging:c.vereniging||""};
  return s.replace(/\{(\w+)\}/g,(m,k)=>k in map?map[k]:m);
}
const textToHtml=t=>'<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111">'+String(t).split(/\n{2,}/).map(p=>"<p>"+esc(p).replace(/\n/g,"<br>")+"</p>").join("")+"</div>";
const htmlToText=h=>{const d=new DOMParser().parseFromString(h,"text/html");d.querySelectorAll("br").forEach(b=>b.replaceWith("\n"));d.querySelectorAll("p,div,tr,h1,h2,h3,li").forEach(p=>p.append("\n"));return (d.body.textContent||"").replace(/\n{3,}/g,"\n\n").trim()};
let MAIL=null;
function mailState(){
  if(MAIL&&!MAIL.touched&&!MAIL.tplId&&S.templates.size)MAIL=null;
  if(!MAIL){const t=S.templates.get(UI.mailTpl)||[...S.templates.values()][0]||null;MAIL={tplId:t?t.id:"",naam:t?t.naam:"",onderwerp:t?t.onderwerp:"VBHA - Nieuws van de vriendenkring",body:t?t.body:"Beste {voornaam},\n\n",isHtml:!!(t&&t.isHtml),idx:0,dirty:false};if(t&&t.groep&&!UI.mailGroep)UI.mailGroep=t.groep}
  return MAIL;
}
VIEWS.mails=()=>({title:"Mails aan leden",sub:"Gepersonaliseerde mails voor een doelgroep",body(){
  const M=mailState();const G=groepen();const g=G.find(x=>x.id===UI.mailGroep)||G[0];
  const tpls=[...S.templates.values()].sort((a,b)=>(a.naam||"").localeCompare(b.naam||"","nl"));
  const met=g.list.filter(r=>r.email),zonder=g.list.filter(r=>!r.email);
  return `<div class="grid g2" style="align-items:start">
  <div class="panel"><div class="panel-h"><h2>1 · Doelgroep</h2></div><div class="panel-b" style="display:flex;flex-direction:column;gap:10px">
    <select class="sel" id="mailGroep" data-change="mailGroep">${G.map(x=>`<option value="${esc(x.id)}"${x.id===g.id?" selected":""}>${esc(x.label)} (${x.list.filter(r=>r.email).length})</option>`).join("")}</select>
    <div style="font-size:14px;color:var(--muted)">${met.length} ontvangers met e-mailadres${zonder.length?`, ${zonder.length} zonder: ${zonder.map(r=>esc(r.label)).join(", ")}`:""}.</div>
  </div>
  <div class="panel-h" style="border-top:1px solid var(--line)"><h2>2 · Bericht</h2><span class="grow"></span>
    <select class="sel" id="mailTpl" data-change="mailTpl" aria-label="Sjabloon"><option value="">Nieuw sjabloon…</option>${tpls.map(t=>`<option value="${esc(t.id)}"${t.id===M.tplId?" selected":""}>${esc(t.naam)}</option>`).join("")}</select></div>
  <div class="panel-b"><div class="form">
    <div class="fld"><label for="mNaam">Naam sjabloon</label><input id="mNaam" data-live data-mail="naam" value="${esc(M.naam)}" placeholder="bv. Uitnodiging banket"></div>
    <div class="fld"><label for="mOnd">Onderwerp</label><input id="mOnd" data-live data-mail="onderwerp" value="${esc(M.onderwerp)}"></div>
    <div class="fld full"><label for="mBody">Tekst ${M.isHtml?'<span class="pill neutral">HTML-sjabloon</span>':""}</label>
      <div class="chips" style="margin-bottom:4px">${["voornaam","naam","bedrag","jaar","mededeling","rekeningnummer","bedrijf"].map(k=>`<button class="chip" data-act="mailChip" data-v="{${k}}">{${k}}</button>`).join("")}</div>
      <textarea id="mBody" data-live data-mail="body" spellcheck="true">${esc(M.body)}</textarea>
      <span class="help">Velden tussen accolades worden per persoon ingevuld. Oude HTML-bestanden met <span class="kbd">xnaamx</span> en <span class="kbd">xx euro</span> werken ook.</span></div>
    <div class="full bar"><button class="btn" data-w data-act="mailSave">Sjabloon bewaren</button><label class="btn ghost" for="mailFile" style="cursor:pointer">${ic("upload")}HTML-bestand laden</label><input type="file" id="mailFile" accept=".html,.htm,text/html" hidden>
      ${M.tplId?'<button class="btn ghost danger" data-w data-act="mailDel">Sjabloon verwijderen</button>':""}${M.isHtml?'<button class="btn ghost" data-act="mailToText">Omzetten naar gewone tekst</button>':""}</div>
  </div></div></div>
  <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
  <div class="panel"><div class="panel-h"><h2>Voorbeeld</h2><span class="grow"></span><button class="btn sm" data-act="mailPrev" aria-label="Vorige">‹</button><span id="mIdx" style="font-size:13px;color:var(--muted)"></span><button class="btn sm" data-act="mailNext" aria-label="Volgende">›</button></div>
    <div class="panel-b" style="display:flex;flex-direction:column;gap:10px"><div class="mailhead" id="mHead"></div><div class="preview" id="mPrev"></div></div></div>
  <div class="panel"><div class="panel-h"><h2>3 · Versturen</h2></div><div class="panel-b" style="display:flex;flex-direction:column;gap:12px">
    <button class="btn primary" data-act="mailZip"${met.length?"":" disabled"}>${ic("download")}${met.length} mails downloaden als concepten (.zip)</button>
    <div style="font-size:13.5px;color:var(--muted)">Pak het zip-bestand uit en dubbelklik een mail: ze opent in Outlook als klaar-te-versturen concept, met de juiste naam en het juiste bedrag.</div>
    <button class="btn" data-act="mailCopy"${met.length?"":" disabled"}>${ic("copy")}Alle adressen kopiëren (voor BCC)</button>
    <div style="font-size:13.5px;color:var(--muted)">Voor één algemene mail: plak de adressen in het BCC-veld. Velden zoals {voornaam} worden dan niet ingevuld.</div>
    <details><summary style="cursor:pointer;font-weight:600">Eén voor één openen in je mailprogramma</summary><div class="list" style="margin-top:6px;max-height:320px;overflow:auto">
      ${met.map((r,i)=>`<div class="li"><span class="grow trunc">${esc(r.label)} <span style="color:var(--muted)">${esc(r.email)}</span></span><a class="btn sm" href="${esc(mailto(r,M))}" target="_blank" rel="noopener">Open</a></div>`).join("")}
    </div></details>
  </div></div></div></div>`},});
VIEWS.mails.after=()=>{mailPreview()};
function mailRecips(){const G=groepen();const g=G.find(x=>x.id===UI.mailGroep)||G[0];return g.list.filter(r=>r.email)}
function mailHtml(r,M){return M.isHtml?vul(M.body,r):textToHtml(vul(M.body,r))}
function mailto(r,M){const text=M.isHtml?htmlToText(vul(M.body,r)):vul(M.body,r);let u="mailto:"+encodeURIComponent(r.email)+"?subject="+encodeURIComponent(vul(M.onderwerp,r))+"&body="+encodeURIComponent(text);return u.length>1900?"mailto:"+encodeURIComponent(r.email)+"?subject="+encodeURIComponent(vul(M.onderwerp,r)):u}
function mailPreview(){
  const M=mailState(),list=mailRecips();const el=$("#mPrev");if(!el)return;
  if(!list.length){$("#mHead").innerHTML="";el.textContent="Geen ontvangers in deze doelgroep.";$("#mIdx").textContent="";return}
  M.idx=Math.max(0,Math.min(M.idx,list.length-1));const r=list[M.idx];
  $("#mIdx").textContent=(M.idx+1)+" / "+list.length;
  $("#mHead").innerHTML="<span>Aan: <b>"+esc(r.label)+"</b> &lt;"+esc(r.email)+"&gt;</span><span>Onderwerp: <b>"+esc(vul(M.onderwerp,r))+"</b></span>";
  let sr=el.shadowRoot||el.attachShadow({mode:"open"});
  const h=mailHtml(r,M);const d=new DOMParser().parseFromString(h,"text/html");d.querySelectorAll("script,iframe,object,embed,link,meta").forEach(n=>n.remove());
  sr.innerHTML=[...d.head.querySelectorAll("style")].map(s=>s.outerHTML).join("")+d.body.innerHTML;
}
function b64(str){const bytes=new TextEncoder().encode(str);let bin="";for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(bin)}
function eml(r,M){
  const subj="=?UTF-8?B?"+b64(vul(M.onderwerp,r))+"?=";
  const html=mailHtml(r,M);const full=/<html/i.test(html)?html:'<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>'+html+"</body></html>";
  return ["To: "+r.email,"Subject: "+subj,"X-Unsent: 1","MIME-Version: 1.0","Content-Type: text/html; charset=UTF-8","Content-Transfer-Encoding: base64","",b64(full).replace(/.{76}/g,"$&\r\n")].join("\r\n");
}

/* ---------- instellingen ---------- */
VIEWS.instellingen=()=>({title:"Instellingen",sub:"Boekjaren, puntensysteem, lijsten en back-ups",body(){
  const C=ctx(),c=cfg(),j=C.c,ys=jaren(),last=ys[ys.length-1];
  const d=canWrite?"":" disabled";
  return `<div class="panel"><div class="panel-h"><h2>Actief boekjaar</h2></div><div class="panel-b bar"><select class="sel" id="actiefJaar" data-change="actiefJaar" aria-label="Actief boekjaar"${d}>${ys.map(y=>`<option${y===JAAR?" selected":""}>${y}</option>`).join("")}</select><span style="color:var(--muted);font-size:13.5px;flex:1 1 260px">Dit is het jaar dat iedereen ziet in het dashboard, de leden, de boekhouding, de punten en de kalenders. Oudere jaren bekijk je via Boekhouding › Historiek.</span></div></div>
  <div class="grid g2" style="align-items:start">
  <form class="panel" id="fJaar"><div class="panel-h"><h2>Instellingen boekjaar ${JAAR}</h2></div><div class="panel-b"><div class="form">
    <div class="fld"><label for="jKas">Beginsaldo kas</label><input id="jKas" name="beginKas" inputmode="decimal" value="${j.beginKas}"${d}></div>
    <div class="fld"><label for="jRek">Beginsaldo rekening</label><input id="jRek" name="beginRekening" inputmode="decimal" value="${j.beginRekening}"${d}></div>
    <div class="fld"><label for="jLg">Lidgeld gewoon lid (€)</label><input id="jLg" name="lg_gewoon" inputmode="decimal" value="${j.lidgeld.gewoon}"${d}></div>
    <div class="fld"><label for="jLe">Lidgeld erewacht (€)</label><input id="jLe" name="lg_erewacht" inputmode="decimal" value="${j.lidgeld.erewacht}"${d}></div>
    <div class="fld"><label for="jW1">Punten per kaart</label><input id="jW1" name="w_kaarten" inputmode="numeric" value="${j.gewichten.kaarten}"${d}></div>
    <div class="fld"><label for="jW2">Punten per kalenderdoos</label><input id="jW2" name="w_kalenders" inputmode="numeric" value="${j.gewichten.kalenders}"${d}></div>
    <div class="fld"><label for="jW3">Punten per shift</label><input id="jW3" name="w_shifts" inputmode="numeric" value="${j.gewichten.shifts}"${d}></div>
    <div class="fld"><label for="jW4">Punten per vergadering</label><input id="jW4" name="w_vergaderingen" inputmode="numeric" value="${j.gewichten.vergaderingen}"${d}></div>
    <div class="fld"><label for="jZ">Zilver vanaf (punten)</label><input id="jZ" name="d_zilver" inputmode="numeric" value="${j.drempels.zilver}"${d}></div>
    <div class="fld"><label for="jG">Goud vanaf (punten)</label><input id="jG" name="d_goud" inputmode="numeric" value="${j.drempels.goud}"${d}></div>
    <div class="fld"><label for="jStock">Kalenderdozen dit jaar</label><input id="jStock" name="kalenderStock" inputmode="numeric" value="${j.kalenderStock}"${d}></div>
    <div class="fld full"><label for="jKaart">Link naar de kalenderkaart (uMap)</label><input id="jKaart" name="kaartUrl" type="url" value="${esc(j.kaartUrl||"")}" placeholder="https://umap.openstreetmap.de/…"${d}><span class="help">Verschijnt als knop “Kaart openen” op de pagina Kalenders.</span></div>
    <div class="full bar" data-w><button class="btn primary" type="submit">Boekjaar bewaren</button></div></div></div></form>
  <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
  <div class="panel" data-w><div class="panel-h"><h2>Nieuw boekjaar</h2></div><div class="panel-b" style="display:flex;flex-direction:column;gap:10px">
    ${ys.length?`<p style="margin:0">Open ${last+1} met de eindsaldi van ${last} als beginsaldo. Leden, sponsors en instellingen gaan mee; punten, kalenders en lidgeld starten op nul.</p><button class="btn primary" data-act="nieuwJaar" style="align-self:flex-start">Boekjaar ${last+1} openen</button>`:`<p style="margin:0">Er is nog geen boekjaar.</p><button class="btn primary" data-act="eersteJaar" style="align-self:flex-start">Boekjaar ${new Date().getFullYear()} starten</button>`}
  </div></div>
  <div class="panel"><div class="panel-h"><h2>Exporteren en importeren</h2></div><div class="panel-b" style="display:flex;flex-direction:column;gap:10px">
    <button class="btn" data-act="exportXlsx" style="align-self:flex-start">${ic("download")}Boekjaar ${JAAR} als Excel</button>
    <button class="btn" data-act="exportJson" style="align-self:flex-start">${ic("download")}Volledige back-up (.json)</button>
    <button class="btn" data-w data-act="importExcel" style="align-self:flex-start">${ic("upload")}Oud VBHA Excel-bestand importeren</button>
    <label class="btn" data-w for="restoreFile" style="align-self:flex-start;cursor:pointer">${ic("upload")}Back-up terugzetten (.json)</label><input type="file" id="restoreFile" accept=".json,application/json" hidden>
    <span style="font-size:13px;color:var(--muted)">Maak af en toe een back-up en bewaar die op een veilige plaats.</span></div></div>
  </div></div>
  <form class="panel" id="fCfg"><div class="panel-h"><h2>Algemeen</h2></div><div class="panel-b"><div class="form">
    <div class="fld"><label for="cNaam">Naam vereniging</label><input id="cNaam" name="vereniging" value="${esc(c.vereniging)}"${d}></div>
    <div class="fld"><label for="cIban">Rekeningnummer (voor mails)</label><input id="cIban" name="rekeningnummer" value="${esc(c.rekeningnummer)}" placeholder="BE.. .... .... ...."${d}></div>
    <div class="fld"><label for="cBc">Categorieën boekhouding</label><textarea id="cBc" name="boekCategorieen" style="min-height:160px"${d}>${esc(c.boekCategorieen.join("\n"))}</textarea><span class="help">Eén per regel.</span></div>
    <div class="fld"><label for="cLc">Categorieën leden</label><textarea id="cLc" name="ledenCategorieen" style="min-height:160px"${d}>${esc(c.ledenCategorieen.join("\n"))}</textarea><span class="help">Eén per regel. "Erewacht" heeft een vaste betekenis.</span></div>
    <div class="full bar" data-w><button class="btn primary" type="submit">Bewaren</button></div></div></div></form>
  <div class="note info">Toegang geven: nodig een bestuurslid uit in Supabase via Authentication › Users › Invite user. Na het kiezen van een wachtwoord kan die persoon alles bekijken en bewerken. Voor alleen-lezen zet je de rol in de tabel <span class="kbd">bestuur</span> op <span class="kbd">lezer</span>. Je bent aangemeld als <b>${esc(ME?ME.email:"")}</b>.</div>`}});

/* ============ modals ============ */
function modal(title,body,foot,{wide=false,onClose}={}){
  $("#modal").innerHTML=`<div class="modal-bg" data-act="closeModalBg"><div class="modal${wide?" wide":""}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-h"><h3>${esc(title)}</h3><button class="btn ghost sm" data-act="closeModal" aria-label="Sluiten">${ic("x")}</button></div><div class="modal-b">${body}</div>${foot?`<div class="modal-f">${foot}</div>`:""}</div></div>`;
  MODAL_CLOSE=onClose||null;const f=$("#modal input:not([type=hidden]):not([disabled]),#modal select,#modal textarea");if(f)setTimeout(()=>f.focus(),30);
}
let MODAL_CLOSE=null;
function closeModal(){$("#modal").innerHTML="";if(MODAL_CLOSE){const f=MODAL_CLOSE;MODAL_CLOSE=null;f()}}
function confirmBox(text,label,fn){modal("Bevestigen",`<p style="margin:0">${text}</p>`,`<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="cfOk">${esc(label)}</button>`);$("#cfOk").onclick=()=>{closeModal();fn()}}
function toast(msg,bad){const t=$("#toast");t.className="toast"+(bad?" bad":"");t.textContent=msg;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>{t.hidden=true},bad?5000:2600)}
const fld=(id,label,input,cls="")=>`<div class="fld ${cls}"><label for="${id}">${label}</label>${input}</div>`;
const inp=(id,val,attrs="")=>`<input id="${id}" name="${id}" value="${esc(val??"")}" ${attrs}>`;
const selOpts=(arr,cur)=>arr.map(o=>{const [v,l]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}"${String(cur)===String(v)?" selected":""}>${esc(l)}</option>`}).join("");
const formData=f=>Object.fromEntries(new FormData(f).entries());

/* ---------- lid ---------- */
function lidForm(l={}){const c=cfg();return `<form id="fLid" class="form">
  ${fld("naam","Naam *",inp("naam",l.naam,'required autocomplete="off"'))}${fld("voornaam","Voornaam *",inp("voornaam",l.voornaam,'required autocomplete="off"'))}
  ${fld("adres","Adres",inp("adres",l.adres,'placeholder="Straat nr, postcode gemeente"'),"full")}
  ${fld("email","E-mail",inp("email",l.email,'type="email"'))}${fld("telefoon","Telefoon",inp("telefoon",l.telefoon,'type="tel"'))}
  ${fld("categorie","Categorie *",`<select id="categorie" name="categorie" required><option value="">Kies…</option>${selOpts(c.ledenCategorieen,l.categorie)}</select>`)}
  ${fld("lidSinds","Lid sinds (jaar)",inp("lidSinds",l.lidSinds??JAAR,'inputmode="numeric"'))}
  ${fld("info","Info",inp("info",l.info,'placeholder="bv. Ere-voorzitter, via William"'))}
  ${fld("lidTot","Lid tot en met (jaar)",inp("lidTot",l.lidTot,'inputmode="numeric" placeholder="leeg = nog lid"'))}
  <div class="err full" id="lidErr"></div></form>`}
function readLid(){const f=formData($("#fLid"));const e=$("#lidErr");
  if(!f.naam.trim()||!f.voornaam.trim()){e.textContent="Vul naam en voornaam in.";return null}
  if(!f.categorie){e.textContent="Kies een categorie.";return null}
  const ls_=parseInt(f.lidSinds,10),lt=parseInt(f.lidTot,10);
  return{naam:f.naam.trim(),voornaam:f.voornaam.trim(),adres:f.adres.trim(),email:f.email.trim(),telefoon:f.telefoon.trim(),categorie:f.categorie,lidSinds:isNaN(ls_)?null:ls_,info:f.info.trim(),lidTot:isNaN(lt)?null:lt}}
function nieuwLid(){modal("Nieuw lid",lidForm(),`<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="lidOk">Lid toevoegen</button>`);
  $("#lidOk").onclick=async()=>{const d=readLid();if(!d)return;let id=slug(d.naam+"-"+d.voornaam);if(S.leden.has(id)){$("#lidErr").textContent="Er bestaat al een lid met deze naam.";return}
    closeModal();await write("leden",id,d);toast(naamVol(d)+" is toegevoegd.")}}
function toonLid(id){
  const C=ctx(),r=C.rows.get(id);if(!r)return;const l=r.lid;
  const b=r.lg.boeking;
  const body=`<div class="grid g2"><dl class="kv"><dt>Adres</dt><dd>${esc(l.adres)||"–"}</dd><dt>E-mail</dt><dd>${esc(l.email)||"–"}</dd><dt>Telefoon</dt><dd>${esc(l.telefoon)||"–"}</dd><dt>Categorie</dt><dd>${esc(l.categorie)}</dd><dt>Lid sinds</dt><dd>${esc(l.lidSinds||"–")}${r.jaren!=null?" ("+r.jaren+" jaar)":""}</dd>${l.info?`<dt>Info</dt><dd>${esc(l.info)}</dd>`:""}${l.lidTot?`<dt>Lid tot</dt><dd>${l.lidTot}</dd>`:""}</dl>
   <div style="display:flex;flex-direction:column;gap:10px"><div><b>Lidgeld ${JAAR}</b> &nbsp;${lgPill(r)} <span style="color:var(--muted)">${eur(r.bedrag)}</span></div>
   <div style="font-size:13.5px;color:var(--muted)">${b?`Gevonden in boeking ${b.nr??""} van ${fmtDate(b.datum)}: “${esc(b.mededeling)}”`:esc(r.lg.bron)||"Geen betaling gevonden met naam, voornaam en het woord lidgeld in de mededeling."}</div>
   <div class="fld" data-w><label for="lgOv">Lidgeldstatus</label><select id="lgOv" data-lgov="${esc(id)}">${selOpts([["","Automatisch (uit de boekhouding)"],["OK","Manueel: betaald"],["NOK","Manueel: niet betaald"]],r.jl.lidgeld||"")}</select></div>
   ${!r.lg.ok?`<button class="btn primary" data-w data-act="lidgeldBetaald" data-id="${esc(id)}" style="align-self:flex-start">Lidgeld ontvangen boeken</button>`:""}
   ${l.categorie!=="Erewacht"?`<div><b>Punten ${JAAR}</b>: ${r.p.totaal} &nbsp;${medal(r.status)}</div>`:""}</div></div>`+lidgeldHistHtml(l,r);
  modal(naamVol(l),body,`<button class="btn ghost danger" data-w id="lidDel">Verwijderen</button><span class="grow"></span><button class="btn" data-act="closeModal">Sluiten</button><button class="btn primary" data-w id="lidEdit">Gegevens wijzigen</button>`,{wide:true});
  $("#lidEdit").onclick=()=>{modal("Lid wijzigen",lidForm(l),`<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="lidOk">Bewaren</button>`);
    $("#lidOk").onclick=async()=>{const d=readLid();if(!d)return;closeModal();await write("leden",id,d);toast("Gegevens bewaard.")}};
  $("#lidDel").onclick=()=>confirmBox(`<b>${esc(naamVol(l))}</b> definitief verwijderen? Wil je iemand enkel niet meer als lid tonen, vul dan beter "Lid tot en met" in.`,"Verwijderen",async()=>{await write("leden",id,null,{del:true});toast("Lid verwijderd.")});
}
function lidgeldHist(lid){
  const n1=norm(lid.naam),n2=norm(lid.voornaam);const L=alleJaren();if(!L.length||!n1||!n2)return[];
  const hits=new Map();
  for(const j of L)for(const b of j.rows){if(b.richting==="uit")continue;const m=norm(b.mededeling),t=m+" "+norm(b.partij);
    const ok=b.lidId===lid.id||((m.includes("lidgeld")||norm(b.categorie).startsWith("lidgeld"))&&t.includes(n1)&&t.includes(n2));if(!ok)continue;
    const ym=m.match(/lidgeld.{0,40}?\b(20\d\d)\b/);let y=j.jaar;if(ym){const v=+ym[1];if(v>=j.jaar-2&&v<=j.jaar+1)y=v}
    if(!hits.has(y))hits.set(y,[]);hits.get(y).push({...b,_jaar:j.jaar})}
  const first=Math.max(lid.lidSinds||0,L[0].jaar),last=Math.min(JAAR,lid.lidTot||JAAR);const out=[];
  for(let y=last;y>=first;y--){const jl=S.jaarleden.get(y+"_"+lid.id);out.push({y,bet:hits.get(y)||[],ov:jl&&jl.lidgeld})}
  return out;
}
function lidgeldHistHtml(l,r){
  const H=lidgeldHist(l);if(!H.length)return"";
  const ere=isEreVoorzitter(l);let ok=0;
  const rows=H.map(h=>{const paid=h.y===JAAR?r.lg.ok:(h.ov==="OK"||(h.ov!=="NOK"&&(h.bet.length>0||ere)));if(paid)ok++;
    const b=h.bet[0];const pill=ere&&!h.bet.length?'<span class="pill neutral">vrijgesteld</span>':paid?'<span class="pill ok">✓ Betaald</span>':'<span class="pill nok">Niet gevonden</span>';
    return `<tr><td><b>${h.y}</b></td><td>${pill}${h.ov&&h.y!==JAAR?' <span class="pill neutral">manueel</span>':""}</td><td style="white-space:nowrap">${b?fmtDate(b.datum):""}</td><td class="num">${b?eur(h.bet.reduce((s,x)=>s+x.bedrag,0)):""}</td><td class="trunc" style="max-width:340px" title="${esc(b?b.mededeling:"")}">${b?esc(b.mededeling)+(b._jaar!==h.y?` <span style="color:var(--muted)">(geboekt in ${b._jaar})</span>`:""):""}${h.bet.length>1?` <span class="pill neutral">${h.bet.length} betalingen</span>`:""}</td></tr>`}).join("");
  return `<div><div style="display:flex;align-items:baseline;gap:10px;margin:6px 0 8px"><b>Lidgeld per jaar</b><span style="color:var(--muted);font-size:13px">${ok} van ${H.length} jaar betaald</span></div>
  <div class="tw" style="max-height:300px;border:1px solid var(--line);border-radius:8px"><table><thead><tr><th>Jaar</th><th>Status</th><th>Datum</th><th class="num">Bedrag</th><th>Mededeling</th></tr></thead><tbody>${rows}</tbody></table></div>
  <div style="color:var(--muted);font-size:12.5px;margin-top:6px">Gezocht op naam, voornaam en "lidgeld" in de boekhouding van alle jaren. Een betaling met een ander jaartal in de mededeling (bv. "lidgeld 2024" betaald in januari 2025) telt voor dat jaar.</div></div>`;
}
function lidgeldBetaald(id){
  const C=ctx(),r=C.rows.get(id),l=r.lid;
  boekingForm({datum:todayISO().startsWith(String(JAAR))?todayISO():JAAR+"-12-31",categorie:"Lidgeld",mededeling:`${l.naam} ${l.voornaam} lidgeld ${JAAR}`,partij:naamVol(l),rekening:"Kas",bedrag:r.bedrag,richting:"in",lidId:id},null,"Lidgeld ontvangen");
}

/* ---------- boeking ---------- */
function boekingForm(b,id,title){
  const c=cfg();const C=ctx();
  const ledenOpts=[["","— geen —"],...C.leden.map(l=>[l.id,l.naam+" "+l.voornaam])];
  const info=id?`<div class="full muted small">Bron: ${esc(bronLabel(b))}${b.bankRef?" · Bankreferentie "+esc(b.bankRef):""}${b.regelNaam?" · "+esc(b.regelNaam):""}${b.status==="controle"?' · <span class="pill warn">nog te controleren</span>':""}</div>`:"";
  modal(title||(id?"Boeking "+(b.nr??"")+" wijzigen":"Nieuwe boeking"),`<form id="fBoek" class="form">
    ${fld("bDatum","Datum *",`<input id="bDatum" name="datum" type="date" value="${esc(b.datum||todayISO())}" required>`)}
    ${fld("bCat","Categorie *",`<select id="bCat" name="categorie"><option value="">Kies…</option>${selOpts(catList(C),b.categorie)}</select>`)}
    ${fld("bPartij","Tegenpartij (betaald aan / ontvangen van)",inp("bPartij",b.partij,'name="partij"'),"full")}
    ${fld("bMed","Mededeling *",inp("bMed",b.mededeling,'name="mededeling"'),"full")}
    ${fld("bBedrag","Bedrag (€) *",inp("bBedrag",b.bedrag!=null?String(b.bedrag).replace(".",","):"",'name="bedrag" inputmode="decimal" placeholder="0,00"'))}
    ${fld("bRich","In of uit *",`<select id="bRich" name="richting">${selOpts([["in","In (ontvangst)"],["uit","Uit (uitgave)"]],b.richting||"in")}</select>`)}
    ${fld("bRek","Rekening of kas *",`<select id="bRek" name="rekening">${selOpts(["Kas","Rekening"],b.rekening||"Kas")}</select>`)}
    ${fld("bIban","Rekening tegenpartij",inp("bIban",b.iban,'name="iban" placeholder="BE.. .... .... ...."'))}
    ${fld("bLid","Gekoppeld lid (lidgeld)",`<select id="bLid" name="lidId">${selOpts(ledenOpts,b.lidId||"")}</select>`,"full")}
    ${info}<div class="err full" id="boekErr"></div></form>`,
    `${id?'<button class="btn ghost danger" id="bDel">Verwijderen</button><button class="btn ghost" id="bRegel">Regel maken</button><span class="grow"></span>':""}<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="bOk">${id?"Bewaren":"Toevoegen"}</button>`,{wide:false});
  $("#bOk").onclick=async()=>{
    const f=formData($("#fBoek")),e=$("#boekErr");const bedrag=r2(Math.abs(num(f.bedrag)));
    if(!f.datum){e.textContent="Kies een datum.";return}
    if(Number(f.datum.slice(0,4))!==JAAR){e.textContent=`De datum valt buiten boekjaar ${JAAR}. Kies eerst het juiste boekjaar in Instellingen.`;return}
    if(!f.categorie){e.textContent="Kies een categorie.";return}
    if(!f.mededeling.trim()&&!f.partij.trim()){e.textContent="Vul een mededeling of tegenpartij in.";return}
    if(!bedrag){e.textContent="Vul een bedrag in.";return}
    const nr=id?b.nr:nextNr();
    const base=id?stripId(S.boekingen.get(id)||b):{bron:"manueel"};
    const d={...base,jaar:JAAR,nr,datum:f.datum,categorie:f.categorie,mededeling:f.mededeling.trim(),partij:f.partij.trim(),iban:f.iban.trim(),rekening:f.rekening,bedrag,richting:f.richting,lidId:f.lidId||null,status:null};
    closeModal();await write("boekingen",id||newId("boekingen"),d);toast(id?"Boeking bewaard.":"Boeking "+nr+" toegevoegd.");
  };
  if(id){$("#bDel").onclick=()=>confirmBox("Boeking "+esc(b.nr??"")+" (“"+esc(b.mededeling||b.partij)+"”, "+eur(b.bedrag)+") verwijderen?","Verwijderen",async()=>{await write("boekingen",id,null,{del:true});toast("Boeking verwijderd.")});
    $("#bRegel").onclick=()=>{const cur=S.boekingen.get(id)||b;closeModal();regelVan(cur)}}
}
function nextNr(){let m=0;for(const b of S.boekingen.values())if(b.jaar===JAAR&&b.nr>m)m=b.nr;return m+1}
async function patchBoekingen(ids,patchFn,label){
  const ops=[];for(const id of ids){const cur=S.boekingen.get(id);if(!cur)continue;const p=patchFn(cur);if(!p)continue;ops.push(["boekingen",id,{...stripId(cur),...p}])}
  if(!ops.length){toast("Er was niets te wijzigen.");return 0}
  try{await writeMany(ops,()=>{})}catch(e){handleWriteError(e);return 0}
  toast(label.replace("{n}",ops.length));return ops.length;
}
function exportBoek(){
  const L=journalList();const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(L.map(b=>({Nr:b.nr,Datum:fmtDate(b.datum),Categorie:b.categorie,Tegenpartij:b.partij,"Rekening tegenpartij":b.iban||"",Mededeling:b.mededeling,"Rekening/Kas":b.rekening,In:b.richting!=="uit"?b.bedrag:"",Uit:b.richting==="uit"?b.bedrag:"",Bron:bronLabel(b),Bankreferentie:b.bankRef||""}))),"Boekingen "+JAAR);
  save("VBHA_boekingen_"+JAAR+(UI.boekMaand?"_"+UI.boekMaand:"")+".xlsx",XLSX.write(wb,{type:"array",bookType:"xlsx"}));
}

/* ---------- bankimport ---------- */
let IMP=null;
function parseDatum(v){
  if(v instanceof Date&&!isNaN(v))return v.getFullYear()+"-"+String(v.getMonth()+1).padStart(2,"0")+"-"+String(v.getDate()).padStart(2,"0");
  if(typeof v==="number"&&v>20000&&v<80000){const d=XLSX.SSF.parse_date_code(v);return d.y+"-"+String(d.m).padStart(2,"0")+"-"+String(d.d).padStart(2,"0")}
  const s=String(v??"").trim();let m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if(m){let y=+m[3];if(y<100)y+=2000;return y+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0")}
  m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return m[0];return "";
}
function importBank(){
  modal("Bankafschrift importeren",`<p style="margin:0">Kies het bestand met verrichtingen dat je in Argenta downloadde (CSV of Excel). Alles komt op <b>Rekening</b> in boekjaar <b>${JAAR}</b>.</p>
   <div><label class="btn primary" for="bankFile" style="cursor:pointer">${ic("upload")}Bestand kiezen</label><input type="file" id="bankFile" accept=".csv,.xlsx,.xls" hidden></div><div id="impArea"></div>`,"",{wide:true});
}
function readBankFile(file){
  const rd=new FileReader();rd.onload=()=>{try{
    const wb=XLSX.read(new Uint8Array(rd.result),{type:"array",cellDates:true});const ws=wb.Sheets[wb.SheetNames[0]];
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:""});
    let h=rows.findIndex(r=>r.some(c=>/datum/i.test(String(c))));if(h<0)h=0;
    const head=rows[h].map(c=>String(c).trim());const find=(re,fb)=>{const i=head.findIndex(c=>re.test(c));return i>=0?i:fb};
    IMP={bestand:file.name,head,rows:rows.slice(h+1).filter(r=>r.some(c=>c!=="")),map:{
      datum:find(/^boek(ings)?datum/i,find(/datum/i,1)),bedrag:find(/bedrag/i,5),partij:find(/naam/i,9),mededeling:find(/mededeling|omschrijving/i,10),
      iban:find(/rekening.*tegen|tegenrekening|iban/i,-1),ref:find(/referentie|^ref/i,-1)}};
    buildImp();
  }catch(e){$("#impArea").innerHTML='<div class="err">Dit bestand kon niet gelezen worden. Kies het CSV- of Excel-bestand van de bank.</div>'}};
  rd.readAsArrayBuffer(file);
}
function bankDocId(ref,Y){return ref?"bk-"+Y+"-"+slug(ref).slice(0,120):null}
function buildImp(){
  const {head,rows,map}=IMP;const C=ctx();const cats=catList(C);
  const exist=[...S.boekingen.values()];const seen=new Set();
  IMP.items=rows.map(r=>{const g=k=>map[k]>=0?r[map[k]]:"";const datum=parseDatum(g("datum"));const raw=num(g("bedrag"));const partij=String(g("partij")??"").trim();const mededeling=String(g("mededeling")??"").trim();
    const iban=String(g("iban")??"").replace(/\s+/g," ").trim();const ref=String(g("ref")??"").trim();
    const b={datum,bedrag:r2(Math.abs(raw)),richting:raw<0?"uit":"in",partij,mededeling,iban,bankRef:ref};
    const did=bankDocId(ref,JAAR);const fz=datum+"|"+b.bedrag+"|"+norm(partij)+"|"+b.richting;
    const dub=(did&&S.boekingen.has(did))||exist.some(x=>(ref&&x.bankRef===ref)||(x.datum===datum&&r2(x.bedrag)===b.bedrag&&norm(x.partij)===norm(partij)&&(x.richting||"in")===b.richting))||seen.has(did||fz);
    seen.add(did||fz);
    const buiten=!!datum&&Number(datum.slice(0,4))!==JAAR;const s=suggest(b);
    return{...b,docId:did,sug:s,categorie:s?s.categorie:"",dub,buiten,ok:!!datum&&!!b.bedrag&&!dub&&!buiten}}).filter(x=>x.datum||x.bedrag);
  const colSel=(k,l,opt)=>`<div class="fld"><label for="map_${k}">${l}</label><select id="map_${k}" data-map="${k}">${opt?'<option value="-1">(geen)</option>':""}${head.map((h,i)=>`<option value="${i}"${i===map[k]?" selected":""}>${String.fromCharCode(65+i)}: ${esc(h||"(leeg)")}</option>`).join("")}</select></div>`;
  const nOk=IMP.items.filter(x=>x.ok).length,nd=IMP.items.filter(x=>x.dub).length,nb=IMP.items.filter(x=>x.buiten).length,nr=IMP.items.filter(x=>x.ok&&x.sug&&x.sug.zeker).length;
  $("#impArea").innerHTML=`<details class="mapping"><summary>Kolommen controleren</summary><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-top:10px">${colSel("datum","Datum")}${colSel("bedrag","Bedrag")}${colSel("partij","Naam tegenpartij")}${colSel("mededeling","Mededeling")}${colSel("iban","Rekening tegenpartij",1)}${colSel("ref","Bankreferentie",1)}</div></details>
   <div class="sumbar boxed"><span><b>${IMP.items.length}</b> regels gelezen</span><span><b>${nOk}</b> nieuw</span><span><b>${nr}</b> met regel</span><span><b>${nOk-nr}</b> naar Te verwerken</span>${nd?`<span>${nd} al geboekt</span>`:""}${nb?`<span class="out">${nb} buiten ${JAAR}</span>`:""}</div>
   <div class="tw" style="max-height:50vh;border:1px solid var(--line);border-radius:8px"><table class="journal"><thead><tr><th class="chk"><input type="checkbox" id="impAll" aria-label="Alles selecteren"${nOk?" checked":""}></th><th>Datum</th><th>Omschrijving</th><th class="num">Bedrag</th><th>Categorie</th><th>Status</th></tr></thead><tbody>
   ${IMP.items.map((x,i)=>`<tr${x.ok?"":' class="dim"'}><td class="chk"><input type="checkbox" data-impok="${i}"${x.ok?" checked":""} aria-label="Regel ${i+1} importeren"></td><td class="nowrap">${fmtDate(x.datum)||'<span class="err">?</span>'}</td>
   <td class="desc"><div class="d1">${esc(x.partij||"—")}${x.iban?` <span class="muted small">${esc(x.iban)}</span>`:""}</div><div class="d2">${esc(x.mededeling)}</div></td><td class="num">${bedragCel(x)}</td>
   <td><select class="sel sm" data-impcat="${i}" aria-label="Categorie regel ${i+1}"><option value="">Te verwerken</option>${selOpts(cats,x.categorie)}</select></td>
   <td class="small">${x.dub?'<span class="pill neutral">al geboekt</span>':x.buiten?'<span class="pill warn">ander jaar</span>':x.sug?`<span class="${x.sug.zeker?"in":"muted"}" title="${esc(x.sug.naam)}">${x.sug.zeker?"✓ regel":"voorstel"}</span>`:'<span class="muted">geen regel</span>'}</td></tr>`).join("")}</tbody></table></div>
   <div class="bar" style="justify-content:flex-end"><span id="impProg" class="muted"></span><button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="impGo">Geselecteerde regels importeren</button></div>`;
  $("#impGo").onclick=doImport;
}
async function doImport(){
  const sel=IMP.items.filter(x=>x.ok&&x.datum&&x.bedrag);if(!sel.length){toast("Er is niets geselecteerd.",true);return}
  if(sel.some(x=>Number(x.datum.slice(0,4))!==JAAR)){toast("Sommige geselecteerde regels vallen buiten boekjaar "+JAAR+".",true);return}
  $("#impGo").disabled=true;sel.sort((a,b)=>a.datum.localeCompare(b.datum));let nr=nextNr();const ops=[];let open=0;
  for(const x of sel){const zeker=x.sug&&x.sug.zeker&&x.categorie===x.sug.categorie;const status=!x.categorie?null:zeker?null:(x.sug&&x.categorie===x.sug.categorie?"controle":null);
    if(!x.categorie||status==="controle")open++;
    const d={jaar:JAAR,nr:nr++,datum:x.datum,categorie:x.categorie,mededeling:x.mededeling,partij:x.partij,iban:x.iban,bankRef:x.bankRef||"",rekening:"Rekening",bedrag:x.bedrag,richting:x.richting,lidId:x.categorie==="Lidgeld"?findLid(x):null,bron:"bank",status,regelNaam:x.sug&&x.categorie===x.sug.categorie?x.sug.naam:""};
    ops.push(["boekingen",x.docId||newId("boekingen"),d])}
  const prog=$("#impProg");
  try{await writeMany(ops,n=>{if(prog)prog.textContent=n+" / "+ops.length})}catch(e){handleWriteError(e);$("#impGo").disabled=false;return}
  try{await write("imports",newId("imports"),{tijd:new Date().toISOString(),bestand:IMP.bestand||"",bron:"bestand",jaar:JAAR,nieuw:ops.length,dubbel:IMP.items.filter(x=>x.dub).length,open})}catch(e){}
  closeModal();toast(ops.length+" boekingen geïmporteerd"+(open?", "+open+" te verwerken.":"."));
  if(open)location.hash="verwerken";
}

/* ---------- sponsor ---------- */
function sponsorForm(s,id){
  modal(id?s.bedrijf:"Nieuwe sponsor",`<form id="fSp" class="form">
   ${fld("sB","Bedrijf *",inp("sB",s.bedrijf,'name="bedrijf"'),"full")}${fld("sV","Voornaam contact",inp("sV",s.voornaam,'name="voornaam"'))}${fld("sN","Naam contact",inp("sN",s.naam,'name="naam"'))}
   ${fld("sA","Adres",inp("sA",s.adres,'name="adres"'),"full")}${fld("sE","E-mail",inp("sE",s.email,'name="email" type="email"'))}${fld("sT","Telefoon",inp("sT",s.telefoon,'name="telefoon"'))}
   ${fld("sK","KBO-nummer",inp("sK",s.kbo,'name="kbo"'))}${fld("sBd","Bedrag (€)",inp("sBd",s.bedrag,'name="bedrag" inputmode="decimal"'))}<div class="err full" id="spErr"></div></form>`,
   `${id?'<button class="btn ghost danger" data-w id="spDel">Verwijderen</button><span class="grow"></span>':""}<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" data-w id="spOk">Bewaren</button>`);
  if(!canWrite)$$("#fSp input").forEach(i=>i.disabled=true);
  $("#spOk").onclick=async()=>{const f=formData($("#fSp"));if(!f.bedrijf.trim()){$("#spErr").textContent="Vul de naam van het bedrijf in.";return}
    const d={...f,bedrijf:f.bedrijf.trim(),bedrag:num(f.bedrag)};closeModal();await write("sponsors",id||newId("sponsors"),d);toast("Sponsor bewaard.")};
  if(id)$("#spDel").onclick=()=>confirmBox("Sponsor <b>"+esc(s.bedrijf)+"</b> verwijderen?","Verwijderen",async()=>{await write("sponsors",id,null,{del:true});toast("Sponsor verwijderd.")});
}

/* ---------- kalenderlijst ---------- */
function kalToevoegen(){
  const C=ctx(),k=kalStats(C);const inL=new Set(k.rows.map(j=>j.lidId));
  const opts=C.leden.filter(l=>!inL.has(l.id)).map(l=>[l.id,l.naam+" "+l.voornaam]);
  modal("Persoon aan kalenderlijst toevoegen",`<div class="form">${fld("kLid","Lid",`<select id="kLid"><option value="">Kies een lid…</option>${selOpts(opts,"")}</select>`,"full")}
   ${fld("kNaam","Of: iemand die geen lid is",inp("kNaam","",'placeholder="Voornaam Naam"'),"full")}${fld("kOp","Aantal dozen meegegeven",inp("kOp","",'inputmode="numeric"'))}<div class="err full" id="kErr"></div></div>`,
   `<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="kOk">Toevoegen</button>`);
  $("#kOk").onclick=async()=>{const lid=$("#kLid").value,naam=$("#kNaam").value.trim(),op=parseInt($("#kOp").value,10)||0;
    if(!lid&&!naam){$("#kErr").textContent="Kies een lid of vul een naam in.";return}
    const id=JAAR+"_"+(lid||"x-"+slug(naam));const cur=S.jaarleden.get(id)||{};closeModal();
    await write("jaarleden",id,{...stripId(cur),jaar:JAAR,lidId:lid||null,naam:lid?"":naam,kal:true,kalOpgehaald:(cur.kalOpgehaald||0)+op,kalUitgevoerd:cur.kalUitgevoerd||0});toast("Toegevoegd aan de kalenderlijst.")};
}
const stripId=o=>{const {id,...r}=o||{};return r};
function setJL(lidId,patch){const id=JAAR+"_"+lidId;const cur=S.jaarleden.get(id)||{jaar:JAAR,lidId};const d={...stripId(cur),jaar:JAAR,lidId,...patch};S.jaarleden.set(id,{...d,id});dirty=true;return write("jaarleden",id,d)}
function setJLid(id,patch){const cur=S.jaarleden.get(id);if(!cur)return;const d={...stripId(cur),...patch};S.jaarleden.set(id,{...d,id});dirty=true;return write("jaarleden",id,d)}

/* ---------- jaar & export ---------- */
async function saveJaar(f){
  const g=k=>num(f[k]);const d={jaar:JAAR,beginKas:r2(g("beginKas")),beginRekening:r2(g("beginRekening")),lidgeld:{gewoon:g("lg_gewoon"),erewacht:g("lg_erewacht")},
    gewichten:{kaarten:g("w_kaarten"),kalenders:g("w_kalenders"),shifts:g("w_shifts"),vergaderingen:g("w_vergaderingen")},drempels:{zilver:g("d_zilver"),goud:g("d_goud")},kalenderStock:g("kalenderStock"),kaartUrl:String(f.kaartUrl||"").trim()};
  await write("jaren",String(JAAR),{...stripId(S.jaren.get(String(JAAR))),...d});toast("Boekjaar "+JAAR+" bewaard.");
}
async function nieuwJaar(){const ys=jaren(),last=ys[ys.length-1];const prevJ=JAAR;JAAR=last;dirty=true;const C=ctx();const c=C.c;JAAR=prevJ;dirty=true;
  confirmBox(`Boekjaar <b>${last+1}</b> openen met beginsaldo kas ${eur(C.kas)} en rekening ${eur(C.rek)}?`,"Openen",async()=>{
    await write("jaren",String(last+1),{jaar:last+1,beginKas:C.kas,beginRekening:C.rek,gewichten:c.gewichten,drempels:c.drempels,lidgeld:c.lidgeld,kalenderStock:c.kalenderStock});
    await write("config","algemeen",{...stripId(S.config.get("algemeen")),actiefJaar:last+1});
    JAAR=last+1;ls.set("jaar",JAAR);dirty=true;toast("Boekjaar "+JAAR+" is geopend.");render(true)})}
async function save(filename,data){
  try{const type=/\.json$/i.test(filename)?"application/json":/\.zip$/i.test(filename)?"application/zip":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const blob=data instanceof Blob?data:new Blob([data],{type});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename;document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)}catch(e){toast("Downloaden lukte niet.",true)}
}

function exportXlsx(){
  const C=ctx(),wb=XLSX.utils.book_new();
  const all=[...C.leden,...C.oud].map(l=>C.rows.get(l.id)).filter(r=>r.huidig);
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(all.map(r=>({Naam:r.lid.naam,Voornaam:r.lid.voornaam,Status:r.status,Adres:r.lid.adres,Email:r.lid.email,Telefoon:r.lid.telefoon,Categorie:r.lid.categorie,"Lid sinds":r.lid.lidSinds,Lidgeld:r.lg.ok?"OK":"NOK",Info:r.lid.info}))),"Ledenadministratie");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(all.filter(r=>r.lid.categorie!=="Erewacht").map(r=>({Naam:r.lid.naam,Voornaam:r.lid.voornaam,Kaarten:r.jl.kaarten||0,Kalenderdozen:r.jl.kalUitgevoerd||0,Shifts:r.jl.shifts||0,Vergaderingen:r.jl.vergaderingen||0,"Extra inspanningen":r.jl.extraTekst||"","Extra punten":r.jl.extraPunten||0,"Totaal punten":r.p.totaal,Status:r.status}))),"Puntensysteem");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([{Nr:"",Datum:"",Categorie:"",Mededeling:"Overdracht kas",["Betaald aan/Ontvangen van"]:"","Rekening/Kas":"Kas",Bedrag:C.c.beginKas,"IN/UIT":"in"},{Nr:"",Datum:"",Categorie:"",Mededeling:"Overdracht rekening","Betaald aan/Ontvangen van":"","Rekening/Kas":"Rekening",Bedrag:C.c.beginRekening,"IN/UIT":"in"},
    ...C.boek.map(b=>({Nr:b.nr,Datum:fmtDate(b.datum),Categorie:b.categorie,Mededeling:b.mededeling,"Betaald aan/Ontvangen van":b.partij,"Rekening/Kas":b.rekening,Bedrag:b.bedrag,"IN/UIT":b.richting,"Cumul kas":b._kas,"Cumul rekening":b._rek,SALDO:r2(b._kas+b._rek)}))]),"Boekhouding");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(kalStats(C).rows.map(j=>({Persoon:kalNaam(j),Opgehaald:j.kalOpgehaald||0,Uitgevoerd:j.kalUitgevoerd||0,Punten:(j.kalUitgevoerd||0)*C.c.gewichten.kalenders}))),"Kalenders");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([...S.sponsors.values()].map(s=>({Bedrijf:s.bedrijf,Naam:s.naam,Voornaam:s.voornaam,Adres:s.adres,Email:s.email,Telefoon:s.telefoon,"KBO nr.":s.kbo,Bedrag:num(s.bedrag)}))),"Sponsorbeheer");
  save("VBHA_"+JAAR+".xlsx",XLSX.write(wb,{type:"array",bookType:"xlsx"}));
}
function exportJson(){const o={};for(const c of COLS)o[c]=[...S[c].values()];save("VBHA_backup_"+todayISO()+".json",JSON.stringify(o,null,1))}

/* ---------- import uit de oude Excel-bestanden ---------- */
/*IMPORT-START*/
function parseVBHA(wb,filename){
  const X=XLSX.utils;
  const ws=n=>wb.Sheets[n];
  if(!ws("Ledenadministratie")||!ws("Boekhouding"))throw new Error("Dit is geen VBHA-bestand: de tabbladen Ledenadministratie en Boekhouding ontbreken.");
  const cell=(s,ref)=>{const c=ws(s)&&ws(s)[ref];return c?c:null};
  const v=(s,r,col)=>{const c=ws(s)[X.encode_cell({r:r-1,c:col})];return c?c.v:null};
  const f=(s,r,col)=>{const c=ws(s)[X.encode_cell({r:r-1,c:col})];return c&&c.f?String(c.f):""};
  const last=s=>X.decode_range(ws(s)["!ref"]).e.r+1;
  const str=x=>x==null?"":String(x).trim();
  const n0=x=>typeof x==="number"?x:(x==null||x===""?0:num(x));
  let Y=null;const a6=cell("Dashboard","A6");if(a6){const m=String(a6.v).match(/20\d\d/);if(m)Y=+m[0]}
  if(!Y){const d8=str(v("Boekhouding",8,3)).match(/20\d\d/);if(d8)Y=+d8[0]+1}
  if(!Y){const m=String(filename||"").match(/20\d\d/);if(m)Y=+m[0]}
  if(!Y)throw new Error("Het boekjaar van dit bestand kon niet bepaald worden.");
  // leden
  const leden=[];
  for(let r=7;r<=last("Ledenadministratie");r++){const naam=str(v("Ledenadministratie",r,0));if(!naam)continue;
    const ls_=v("Ledenadministratie",r,7);
    leden.push({id:slug(naam+"-"+str(v("Ledenadministratie",r,1))),naam,voornaam:str(v("Ledenadministratie",r,1)),adres:str(v("Ledenadministratie",r,3)),email:str(v("Ledenadministratie",r,4)),telefoon:str(v("Ledenadministratie",r,5)),categorie:str(v("Ledenadministratie",r,6)),lidSinds:typeof ls_==="number"?ls_:(parseInt(ls_,10)||null),info:str(v("Ledenadministratie",r,9))})}
  // drempels uit de statusformule
  const jaar={jaar:Y,...JSON.parse(JSON.stringify(DEF_JAAR))};
  const sf=f("Ledenadministratie",7,2);const th=[...sf.matchAll(/<(\d+)/g)].map(m=>+m[1]);if(th.length>=2)jaar.drempels={zilver:th[0],goud:th[1]};
  // punten
  const ps="Puntensysteem",pmap=new Map();
  const idOf=new Map(leden.map(l=>[norm(l.naam)+"|"+norm(l.voornaam),l.id]));
  const fullOf=new Map(leden.map(l=>[norm(l.voornaam+" "+l.naam),l.id]));
  const hasKal=!!ws("Kalenders");
  if(ws(ps)){
    for(let r=7;r<=last(ps);r++){const fm=(c)=>f(ps,r,c).match(/\*\s*([\d.]+)/);
      if(fm(3)&&fm(5)&&fm(7)&&fm(9)){jaar.gewichten={kaarten:+fm(3)[1],kalenders:+fm(5)[1],shifts:+fm(7)[1],vergaderingen:+fm(9)[1]};break}}
    for(let r=7;r<=last(ps);r++){const naam=str(v(ps,r,0));if(!naam)continue;const lid=idOf.get(norm(naam)+"|"+norm(v(ps,r,1)));if(!lid)continue;
      const p={jaar:Y,lidId:lid,kaarten:n0(v(ps,r,2)),shifts:n0(v(ps,r,6)),vergaderingen:n0(v(ps,r,8)),extraTekst:str(v(ps,r,10)),extraPunten:n0(v(ps,r,11))};
      if(!hasKal&&n0(v(ps,r,4))){p.kalUitgevoerd=n0(v(ps,r,4));p.kal=true}
      if(p.kaarten||p.shifts||p.vergaderingen||p.extraTekst||p.extraPunten||p.kal)pmap.set(Y+"_"+lid,p)}
  }
  if(hasKal){const ks="Kalenders";const b3=f(ks,3,1).match(/^=?\s*(\d+)/);if(b3)jaar.kalenderStock=+b3[1];
    const b6=v(ks,6,1);if(typeof b6==="number")jaar.gewichten.kalenders=b6;
    for(let r=9;r<=last(ks);r++){const nm=str(v(ks,r,0));if(!nm)continue;const lid=fullOf.get(norm(nm))||null;const id=Y+"_"+(lid||"x-"+slug(nm));
      const p=pmap.get(id)||{jaar:Y,lidId:lid};Object.assign(p,{naam:lid?"":nm,kal:true,kalOpgehaald:n0(v(ks,r,1)),kalUitgevoerd:n0(v(ks,r,2))});pmap.set(id,p)}}
  // boekhouding
  const bs="Boekhouding";const boekingen=[];
  for(let r=8;r<=9;r++){const rek=str(v(bs,r,5));const g=n0(v(bs,r,6));if(/kas/i.test(rek))jaar.beginKas=g;else if(/rek/i.test(rek))jaar.beginRekening=g}
  let seq=0;
  for(let r=10;r<=last(bs);r++){const g=v(bs,r,6);if(typeof g!=="number")continue;
    const dv=v(bs,r,1);let datum="";if(typeof dv==="number"){const d=XLSX.SSF.parse_date_code(dv);datum=d.y+"-"+String(d.m).padStart(2,"0")+"-"+String(d.d).padStart(2,"0")}else datum=parseDatum(dv);
    const nrv=v(bs,r,0);const nr=typeof nrv==="number"?nrv:null;seq++;
    const rek=str(v(bs,r,5));
    boekingen.push({id:Y+"-"+(nr??"r"+seq),jaar:Y,nr:nr??seq,datum,categorie:str(v(bs,r,2)),mededeling:str(v(bs,r,3)),partij:str(v(bs,r,4)),rekening:/kas/i.test(rek)?"Kas":"Rekening",bedrag:r2(Math.abs(g)),richting:(/uit/i.test(str(v(bs,r,7)))!==(g<0))?"uit":"in",lidId:null})}
  // dubbele nummers vermijden
  const seen=new Set();for(const b of boekingen){while(seen.has(b.id))b.id+="b";seen.add(b.id)}
  // sponsors
  const sponsors=[];if(ws("Sponsorbeheer"))for(let r=7;r<=last("Sponsorbeheer");r++){const b=str(v("Sponsorbeheer",r,0));if(!b)continue;
    sponsors.push({id:slug(b),bedrijf:b,naam:str(v("Sponsorbeheer",r,1)),voornaam:str(v("Sponsorbeheer",r,2)),adres:str(v("Sponsorbeheer",r,3)),email:str(v("Sponsorbeheer",r,4)),telefoon:str(v("Sponsorbeheer",r,5)),kbo:str(v("Sponsorbeheer",r,6)),bedrag:n0(v("Sponsorbeheer",r,7))})}
  return{Y,jaar,leden,jaarleden:[...pmap.entries()].map(([id,p])=>({id,...p})),boekingen,sponsors};
}
/*IMPORT-END*/
const DEF_TEMPLATES=[
 {id:"uitnodiging-lidgeld",naam:"Uitnodiging lidgeld",groep:"lidgeld",onderwerp:"VBHA - Uitnodiging verlenging lidmaatschap {jaar}",body:"Beste {voornaam},\n\nOok in {jaar} rekenen we graag op jou als lid van onze vriendenkring. Het lidgeld bedraagt {bedrag} euro.\n\nWil je dit overschrijven op rekeningnummer {rekeningnummer} met als mededeling:\n{mededeling}\n\nAlvast bedankt voor je steun!\n\nMet vriendelijke groeten,\nHet bestuur van de vriendenkring"},
 {id:"herinnering-lidgeld",naam:"Herinnering lidgeld",groep:"herinnering",onderwerp:"VBHA - Herinnering verlenging lidmaatschap {jaar}",body:"Beste {voornaam},\n\nVolgens onze gegevens hebben we je lidgeld voor {jaar} nog niet ontvangen. Het bedrag is {bedrag} euro.\n\nJe kan het overschrijven op rekeningnummer {rekeningnummer} met als mededeling:\n{mededeling}\n\nHeb je intussen al betaald? Dan mag je deze mail negeren.\n\nMet vriendelijke groeten,\nHet bestuur van de vriendenkring"},
 {id:"nieuws",naam:"Nieuws van de vriendenkring",groep:"alle",onderwerp:"VBHA - Nieuws van de vriendenkring",body:"Beste {voornaam},\n\n\n\nMet vriendelijke groeten,\nHet bestuur van de vriendenkring"}
];
let IMPORTING=false;
async function writeMany(ops,onProg){
  let i=0,done=0;
  const worker=async()=>{while(i<ops.length){const op=ops[i++];
    for(let a=0;;a++){try{const ref=db.collection(op[0]).doc(op[1]);await(op[2]===null?ref.delete():ref.set(op[2]));break}
      catch(e){if(a<5&&e&&(e.code==="resource_exhausted"||e.code==="unavailable")){await new Promise(r=>setTimeout(r,600*(a+1)+Math.random()*500));continue}throw e}}
    onProg(++done)}};
  await Promise.all([worker(),worker(),worker(),worker()]);
}
function importExcelDialog(){
  modal("Importeren uit Excel",`<p style="margin:0">Kies een VBHA-bestand (bv. <span class="kbd">VBHA_2025.xlsm</span>). Leden, boekhouding, punten, kalenders en sponsors van dat jaar worden ingelezen. Heb je meerdere jaren, importeer ze dan één voor één, het oudste eerst.</p>
    <label class="btn primary" for="xlsFile" style="align-self:flex-start;cursor:pointer">${ic("upload")}Excel-bestand kiezen</label><input type="file" id="xlsFile" accept=".xlsm,.xlsx" hidden><div id="xlsArea"></div>`,"");
}
async function readVBHA(file){
  const area=$("#xlsArea");area.innerHTML='<div class="note info">Bestand lezen…</div>';
  let P;try{const wb=XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:"array"});P=parseVBHA(wb,file.name)}catch(e){area.innerHTML='<div class="err">'+esc(e.message||"Het bestand kon niet gelezen worden.")+'</div>';return}
  const bestaand=[...S.boekingen.values()].filter(b=>b.jaar===P.Y).length;
  const sum=P.boekingen.reduce((s,b)=>s+(b.richting==="uit"?-1:1)*b.bedrag,0);
  area.innerHTML=`<div class="note info"><b>Boekjaar ${P.Y}</b>: ${P.leden.length} leden, ${P.boekingen.length} boekingen, ${P.jaarleden.length} punten- en kalenderregels, ${P.sponsors.length} sponsors. Beginsaldo kas ${eur(P.jaar.beginKas)}, rekening ${eur(P.jaar.beginRekening)}.</div>
   ${bestaand?`<div class="note">Boekjaar ${P.Y} bevat al ${bestaand} boekingen. Die worden vervangen door de boekingen uit dit bestand, net als de punten en kalenders van ${P.Y}.</div>`:""}
   <div class="bar" style="justify-content:flex-end"><span id="xlsProg" style="color:var(--muted)"></span><button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="xlsGo">Importeren</button></div>`;
  $("#xlsGo").onclick=()=>runImport(P);
}
async function runImport(P){
  $("#xlsGo").disabled=true;IMPORTING=true;
  const ops=[];const Y=P.Y;
  for(const b of S.boekingen.values())if(b.jaar===Y)ops.push(["boekingen",b.id,null]);
  for(const j of S.jaarleden.values())if(j.jaar===Y)ops.push(["jaarleden",j.id,null]);
  const del=new Set(ops.map(o=>o[0]+"/"+o[1]));
  const put=(c,id,d)=>{if(del.has(c+"/"+id)){const i=ops.findIndex(o=>o[0]===c&&o[1]===id&&o[2]===null);if(i>=0)ops.splice(i,1)}ops.push([c,id,d])};
  const jarenNu=jaren();const nieuwste=Math.max(Y,...jarenNu);
  const inFile=new Set(P.leden.map(l=>l.id));
  for(const l of P.leden){const cur=S.leden.get(l.id);const {id,...d}=l;
    if(cur&&Y<Math.max(...jarenNu,0)){ // ouder jaar: bestaande (recentere) gegevens niet overschrijven
      const patch={};if(cur.lidSinds==null&&d.lidSinds)patch.lidSinds=d.lidSinds;if(Object.keys(patch).length)put("leden",id,{...stripId(cur),...patch});continue}
    put("leden",id,{...stripId(cur),...d,lidTot:cur&&cur.lidTot&&cur.lidTot>=Y?cur.lidTot:(Y>=nieuwste?null:Y)})}
  if(Y>=nieuwste)for(const l of S.leden.values())if(!inFile.has(l.id)&&!l.lidTot&&(!l.lidSinds||l.lidSinds<Y))put("leden",l.id,{...stripId(l),lidTot:Y-1});
  put("jaren",String(Y),P.jaar);
  for(const b of P.boekingen){const {id,...d}=b;put("boekingen",id,d)}
  for(const j of P.jaarleden){const {id,...d}=j;put("jaarleden",id,d)}
  for(const s of P.sponsors){const {id,...d}=s;put("sponsors",id,{...stripId(S.sponsors.get(id)),...d})}
  if(!S.templates.size)for(const t of DEF_TEMPLATES){const {id,...d}=t;put("templates",id,d)}
  const prog=$("#xlsProg");
  try{await writeMany(ops,n=>{if(prog)prog.textContent="Bezig: "+n+" / "+ops.length})}
  catch(e){IMPORTING=false;toast("Importeren onderbroken ("+(e&&e.code||"fout")+"). Je kan het bestand opnieuw importeren.",true);render();return}
  IMPORTING=false;JAAR=Y;ls.set("jaar",Y);dirty=true;closeModal();toast("Boekjaar "+Y+" is geïmporteerd.");render(true);
}

/* ============ events ============ */
document.addEventListener("click",async e=>{
  if(!e.target.closest("#navmenu,.navdd"))closeNavMenu();
  if(e.target.closest("td.chk"))return;
  const t=e.target.closest("[data-act]");if(!t)return;const a=t.dataset.act,id=t.dataset.id;
  if(a==="closeModalBg"){if(e.target===t)closeModal();return}
  switch(a){
    case"closeModal":closeModal();break;
    case"logout":await SB.auth.signOut();location.href="/";break;
    case"pwVergeten":{const em=($("#lEmail")||{}).value||"";if(!em.trim()){$("#lErr").textContent="Vul eerst je e-mailadres in.";break}
      const {error}=await SB.auth.resetPasswordForEmail(em.trim(),{redirectTo:location.origin+"/"});$("#lErr").textContent="";$("#lMsg").textContent=error?"Versturen lukte niet: "+error.message:"Als dit adres toegang heeft, krijg je zo een mail om een nieuw wachtwoord te kiezen.";break}
    case"bankKoppel":bankKoppel();break;
    case"bankSync":bankSync(t);break;
    case"bankOntkoppel":bankOntkoppel(id);break;
    case"navdd":{const m=$("#navmenu");if(HOVER&&!m.hidden&&m.dataset.for===t.dataset.id)break;openNavMenu(t);break}
    case"toonNietBetaald":UI.ledenF="nok";saveUI();break;
    case"ledenF":UI.ledenF=t.dataset.v;saveUI();$$(".seg button[data-act=ledenF]").forEach(b=>b.classList.toggle("on",b===t));$("#ledenList").innerHTML=ledenTable();break;
    case"boekRek":UI.boekRek=t.dataset.v;UI.boekPage=0;saveUI();renderBody();break;
    case"boekDir":UI.boekDir=t.dataset.v;UI.boekPage=0;saveUI();renderBody();break;
    case"filtersWis":Object.assign(UI,{boekQ:"",boekMaand:"",boekCat:"",boekRek:"",boekDir:"",boekPage:0});saveUI();renderBody();break;
    case"boekSort":{const k=t.dataset.v;const s=UI.boekSort||{k:"datum",d:-1};UI.boekSort=s.k===k?{k,d:-s.d}:{k,d:k==="datum"||k==="bedrag"||k==="nr"?-1:1};UI.boekPage=0;saveUI();refreshJournal();break}
    case"page":UI.boekPage=(UI.boekPage||0)+(+t.dataset.v);refreshJournal();{const el=$("#boekList");if(el)el.scrollIntoView({block:"start"})}break;
    case"filterCat":Object.assign(UI,{boekCat:t.dataset.v,boekMaand:"",boekQ:"",boekRek:"",boekDir:"",boekPage:0});saveUI();location.hash="boekingen";break;
    case"filterMaand":Object.assign(UI,{boekMaand:t.dataset.v,boekCat:"",boekQ:"",boekPage:0});saveUI();location.hash="boekingen";break;
    case"selClear":SEL.clear();refreshJournal();break;
    case"bulkCat":{const v=$("#bulkCat").value;if(!v){toast("Kies eerst een categorie.",true);break}const n=await patchBoekingen([...SEL],b=>({categorie:v,status:null,lidId:v==="Lidgeld"?(b.lidId||findLid(b)):(b.lidId||null)}),"Categorie toegekend aan {n} boekingen.");if(n){SEL.clear();refreshJournal()}break}
    case"bulkOk":{const n=await patchBoekingen([...SEL],b=>b.categorie&&b.status==="controle"?{status:null}:null,"{n} boekingen gemarkeerd als gecontroleerd.");if(n){SEL.clear();refreshJournal()}break}
    case"bulkDel":{const ids=[...SEL];confirmBox("<b>"+ids.length+" boekingen</b> definitief verwijderen?","Verwijderen",async()=>{try{await writeMany(ids.map(i=>["boekingen",i,null]),()=>{});SEL.clear();toast(ids.length+" boekingen verwijderd.")}catch(err){handleWriteError(err)}});break}
    case"vOk":{const el=$('[data-vcat="'+CSS.escape(id)+'"]');const v=el&&el.value;if(!v){toast("Kies eerst een categorie.",true);break}await patchBoekingen([id],b=>({categorie:v,status:null,lidId:v==="Lidgeld"?(b.lidId||findLid(b)):(b.lidId||null)}),"Boeking bevestigd.");break}
    case"alleBevestigen":{const m=new Map();for(const b of teVerwerken(ctx())){const el=$('[data-vcat="'+CSS.escape(b.id)+'"]');if(el&&el.value)m.set(b.id,el.value)}if(!m.size){toast("Er zijn geen voorstellen om te bevestigen.",true);break}
      await patchBoekingen([...m.keys()],b=>({categorie:m.get(b.id),status:null,lidId:m.get(b.id)==="Lidgeld"?(b.lidId||findLid(b)):(b.lidId||null)}),"{n} boekingen bevestigd.");break}
    case"regelsToepassen":await patchBoekingen(teVerwerken(ctx()).map(b=>b.id),b=>{const s=suggest(b);if(!s)return null;if(b.categorie===s.categorie&&!(s.zeker&&b.status==="controle"))return null;return{categorie:s.categorie,status:s.zeker?null:"controle",regelNaam:s.naam,lidId:s.categorie==="Lidgeld"?(b.lidId||findLid(b)):(b.lidId||null)}},"Regels toegepast op {n} boekingen.");break;
    case"regelVan":{const b=S.boekingen.get(id);if(b)regelVan(b);break}
    case"nieuweRegel":regelForm({},null);break;
    case"regelEdit":{const r=S.regels.get(id);if(r)regelForm(r,id);break}
    case"regelUp":case"regelDown":{const R=[...S.regels.values()].sort(byVolg);const i=R.findIndex(r=>r.id===id);const j=a==="regelUp"?i-1:i+1;if(i<0||j<0||j>=R.length)break;
      const ops=R.map((r,k)=>[r,((k===i?j:k===j?i:k)+1)*10]).filter(([r,v])=>r.volgorde!==v).map(([r,v])=>["regels",r.id,{...stripId(r),volgorde:v}]);try{await writeMany(ops,()=>{})}catch(err){handleWriteError(err)}break}
    case"exportBoek":exportBoek();break;
    case"puntSort":UI.puntSort=t.dataset.v;saveUI();$$(".seg button[data-act=puntSort]").forEach(b=>b.classList.toggle("on",b===t));$("#puntList").innerHTML=puntTable();break;
    case"nieuwLid":nieuwLid();break;
    case"toonLid":toonLid(id);break;
    case"lidgeldBetaald":closeModal();lidgeldBetaald(id);break;
    case"nieuweBoeking":boekingForm({},null);break;
    case"toonBoeking":{const b=S.boekingen.get(id);if(b)canWrite?boekingForm(b,id):toast("Je hebt alleen leesrechten.");break}
    case"importBank":importBank();break;
    case"nieuweSponsor":sponsorForm({},null);break;
    case"toonSponsor":sponsorForm(S.sponsors.get(id),id);break;
    case"kalToevoegen":kalToevoegen();break;
    case"kalOphalen":{const j=S.jaarleden.get(id);if(j){await setJLid(id,{kalOpgehaald:(j.kalOpgehaald||0)+1});renderBody()}break}
    case"kalKlaar":{const j=S.jaarleden.get(id);if(j&&(j.kalOpgehaald||0)>0){await setJLid(id,{kalOpgehaald:j.kalOpgehaald-1,kalUitgevoerd:(j.kalUitgevoerd||0)+1});renderBody()}break}
    case"mailChip":{const ta=$("#mBody");const v=t.dataset.v;const s=ta.selectionStart??ta.value.length;ta.value=ta.value.slice(0,s)+v+ta.value.slice(ta.selectionEnd??s);ta.focus();ta.selectionStart=ta.selectionEnd=s+v.length;MAIL.body=ta.value;MAIL.touched=true;mailPreview();break}
    case"mailPrev":MAIL.idx--;mailPreview();break;
    case"mailNext":MAIL.idx++;mailPreview();break;
    case"mailToText":MAIL.body=htmlToText(MAIL.body);MAIL.isHtml=false;render();break;
    case"mailSave":{const M=MAIL;if(!M.naam.trim()){toast("Geef het sjabloon eerst een naam.",true);$("#mNaam").focus();break}
      const tid=M.tplId||newId("templates");await write("templates",tid,{naam:M.naam.trim(),onderwerp:M.onderwerp,body:M.body,isHtml:M.isHtml,groep:UI.mailGroep});M.tplId=tid;UI.mailTpl=tid;saveUI();toast("Sjabloon bewaard.");break}
    case"mailDel":confirmBox("Sjabloon <b>"+esc(MAIL.naam)+"</b> verwijderen?","Verwijderen",async()=>{await write("templates",MAIL.tplId,null,{del:true});MAIL=null;UI.mailTpl="";saveUI();render()});break;
    case"mailCopy":{const list=mailRecips().map(r=>r.email).join("; ");try{await navigator.clipboard.writeText(list);toast(mailRecips().length+" adressen gekopieerd.")}catch(err){modal("Adressen",`<textarea style="width:100%;min-height:200px" readonly id="adrTa">${esc(list)}</textarea><span style="color:var(--muted)">Selecteer alles en kopieer.</span>`,"");setTimeout(()=>{const ta=$("#adrTa");ta&&ta.select()},50)}break}
    case"mailZip":{const list=mailRecips();const zip=new JSZip();list.forEach((r,i)=>zip.file(String(i+1).padStart(3,"0")+" "+(r.label||r.email).replace(/[\\/:*?"<>|]/g,"")+".eml",eml(r,MAIL)));
      const blob=await zip.generateAsync({type:"blob"});await save("VBHA mails "+slug(MAIL.naam||MAIL.onderwerp||"bericht")+".zip",blob);break}
    case"nieuwJaar":nieuwJaar();break;
    case"eersteJaar":{const y=new Date().getFullYear();await write("jaren",String(y),{jaar:y,...DEF_JAAR});await write("config","algemeen",{...stripId(S.config.get("algemeen")),actiefJaar:y});JAAR=y;ls.set("jaar",y);break}
    case"exportXlsx":exportXlsx();break;
    case"exportJson":exportJson();break;
    case"exportHist":exportHist();break;
    case"histJaar":UI.histJaar=+t.dataset.v;UI.histQ="";saveUI();renderBody();break;
    case"naarBoekjaar":JAAR=+t.dataset.v;ls.set("jaar",JAAR);dirty=true;location.hash="boekhouding";break;
    case"importExcel":importExcelDialog();break;
  }
});
document.addEventListener("input",e=>{
  const t=e.target;
  if(t.dataset.input){UI[t.dataset.input]=t.value;const m={ledenQ:["#ledenList",ledenTable],boekQ:["#boekList",()=>{UI.boekPage=0;return journal()}],puntQ:["#puntList",puntTable],kalQ:["#kalList",kalTable],histQ:["#histList",()=>{const L=alleJaren();return histDetail(L,L.find(j=>j.jaar===UI.histJaar)||L[L.length-1])}]}[t.dataset.input];
    if(m){const el=$(m[0]);if(el)el.innerHTML=m[1]()}else if(t.dataset.input==="spQ"){clearTimeout(input.t);input.t=setTimeout(()=>{renderBody();const i=$("#spQ");if(i){i.focus();i.selectionStart=i.selectionEnd=i.value.length}},250)}}
  if(t.dataset.mail){MAIL[t.dataset.mail]=t.value;MAIL.touched=true;mailPreview()}
  if(t.dataset.rf!==undefined)regelPreview();
});
const input={};
document.addEventListener("change",async e=>{
  const t=e.target;
  if(t.id==="mailFile"&&t.files[0]){const rd=new FileReader();rd.onload=()=>{MAIL.body=String(rd.result);MAIL.isHtml=true;if(!MAIL.naam)MAIL.naam=t.files[0].name.replace(/\.html?$/i,"");render()};rd.readAsText(t.files[0]);return}
  if(t.id==="bankFile"&&t.files[0]){readBankFile(t.files[0]);return}
  if(t.id==="xlsFile"&&t.files[0]){readVBHA(t.files[0]);return}
  if(t.id==="restoreFile"&&t.files[0]){restoreBackup(t.files[0]);t.value="";return}
  if(t.dataset.map!==undefined){IMP.map[t.dataset.map]=+t.value;buildImp();return}
  if(t.dataset.impok!==undefined){IMP.items[+t.dataset.impok].ok=t.checked;return}
  if(t.dataset.sel!==undefined){t.checked?SEL.add(t.dataset.sel):SEL.delete(t.dataset.sel);refreshJournal();return}
  if(t.dataset.selall!==undefined){const L=journalList();const from=(UI.boekPage||0)*PAGE;L.slice(from,from+PAGE).forEach(b=>t.checked?SEL.add(b.id):SEL.delete(b.id));refreshJournal();return}
  if(t.dataset.ractief){const r=S.regels.get(t.dataset.ractief);if(r)await write("regels",r.id,{...stripId(r),actief:t.checked});return}
  if(t.dataset.rf!==undefined){regelPreview();return}
  if(t.dataset.vcat!==undefined)return;
  if(t.id==="impAll"){IMP.items.forEach((x,i)=>{x.ok=t.checked&&!!x.datum&&!x.buiten&&!x.dub;const cb=$(`[data-impok="${i}"]`);if(cb)cb.checked=x.ok});return}
  if(t.dataset.impcat!==undefined){IMP.items[+t.dataset.impcat].categorie=t.value;return}
  if(t.dataset.lgov){const id=t.dataset.lgov;await setJL(id,{lidgeld:t.value||null});toast("Lidgeldstatus bewaard.");closeModal();toonLid(id);return}
  if(t.dataset.jl||t.dataset.kal){
    if(t.dataset.jl){const f=t.dataset.jl;const v=f==="extraTekst"?t.value.trim():Math.max(0,num(t.value));await setJL(t.dataset.id,{[f]:v})}
    else{const v=Math.max(0,Math.round(num(t.value)));await setJLid(t.dataset.id,{[t.dataset.kal]:v})}
    const ae=document.activeElement;if(ae&&ae.dataset&&(ae.dataset.jl||ae.dataset.kal)&&ae!==t)pending=true;else{pending=false;renderBody()}
    return}
  const c=t.dataset.change;if(!c)return;
  if(c==="actiefJaar"){await write("config","algemeen",{...stripId(S.config.get("algemeen")),actiefJaar:+t.value});toast("Actief boekjaar is nu "+t.value+".");return}
  if(c==="jaar"){JAAR=+t.value;ls.set("jaar",JAAR);dirty=true;render(true);return}
  if(c==="oudLeden"){UI.oudLeden=t.checked;saveUI();$("#ledenList").innerHTML=ledenTable();return}
  if(c==="ledenCat"||c==="boekCat"){UI[c]=t.value;saveUI();if(c==="ledenCat")$("#ledenList").innerHTML=ledenTable();else{UI.boekPage=0;renderBody()}return}
  if(c==="boekMaand"){UI.boekMaand=t.value;UI.boekPage=0;saveUI();renderBody();return}
  if(c==="mailGroep"){UI.mailGroep=t.value;saveUI();MAIL.idx=0;renderBody();return}
  if(c==="mailTpl"){UI.mailTpl=t.value;saveUI();const tp=S.templates.get(t.value);MAIL=tp?{tplId:tp.id,naam:tp.naam,onderwerp:tp.onderwerp,body:tp.body,isHtml:!!tp.isHtml,idx:0}:{tplId:"",naam:"",onderwerp:"VBHA - Nieuws van de vriendenkring",body:"Beste {voornaam},\n\n",isHtml:false,idx:0};
    if(tp&&tp.groep){UI.mailGroep=tp.groep;saveUI()}renderBody();return}
});
document.addEventListener("submit",async e=>{
  e.preventDefault();const f=e.target;
  if(f.id==="fLogin"){doLogin(f);return}
  if(f.id==="fPw"){doSetPassword(f);return}
  if(f.id==="fJaar"){await saveJaar(formData(f));return}
  if(f.id==="fCfg"){const d=formData(f);const lines=s=>String(s).split("\n").map(x=>x.trim()).filter(Boolean);
    await write("config","algemeen",{...stripId(S.config.get("algemeen")),vereniging:d.vereniging.trim(),rekeningnummer:d.rekeningnummer.trim(),boekCategorieen:lines(d.boekCategorieen),ledenCategorieen:lines(d.ledenCategorieen)});toast("Instellingen bewaard.");}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("#modal").innerHTML)closeModal()});
document.addEventListener("focusout",e=>{const t=e.target;if(t.dataset&&(t.dataset.kal||t.dataset.jl)){setTimeout(()=>{const ae=document.activeElement;if(!(ae&&ae.dataset&&(ae.dataset.kal||ae.dataset.jl))&&pending){pending=false;renderBody()}},0)}});
