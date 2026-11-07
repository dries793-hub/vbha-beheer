
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
  banket:'<path d="M7 3v7a3 3 0 0 0 3 3v8M7 3v4M10 3v4M4 3v4a3 3 0 0 0 3 3"/><path d="M17 21V3c-2 1.5-3 4-3 7v4h3"/>',
  administratie:'<path d="M4 6.5h16v3.25a2.25 2.25 0 0 0 0 4.5v3.25H4v-3.25a2.25 2.25 0 0 0 0-4.5z"/><path d="M14.5 6.5v2M14.5 11v2M14.5 15.5v2"/>',
  boekingen:'<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  verwerken:'<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  regels:'<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  bank:'<path d="M3 10l9-6 9 6"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',
  reglement:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  kaart:'<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  communicatie:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',deel:'<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'
};
const ic=n=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+ICON[n]+'</svg>';
const NAV=[{id:"leden",label:"Leden",items:[["leden","Ledenlijst"],["punten","Puntensysteem"]]},{id:"boekhouding",label:"Boekhouding",items:[["boekhouding","Overzicht"],["boekingen","Transacties"],["verwerken","Te verwerken"],["historiek","Historiek"]]},{id:"administratie",label:"Activiteiten",items:[["kalenders","Kalenders"],["banket","Banket"]]},{id:"communicatie",label:"Administratie",items:[["sponsors","Sponsors"],["mails","Mails"]]}];
const ROUTES=[["logboek","Logboek"],["boekingen","Transacties"],["verwerken","Te verwerken"],["regels","Regels"],["bank","Bankimport"],["dashboard","Dashboard"],["leden","Leden"],["boekhouding","Boekhouding"],["punten","Puntensysteem"],["kalenders","Kalenders"],["ronde","Kalenderronde"],["sponsors","Sponsors"],["banket","Banket"],["historiek","Historiek"],["mails","Mails"],["instellingen","Instellingen"]];

/* ============ standaardwaarden ============ */
const DEF_CONFIG={vereniging:"Vriendenkring Brandweer Hoofdpost Aalst",rekeningnummer:"",
  boekCategorieen:["Lidgeld","Banket","Kalenders","Jaarmarkt","Fuif","Sponsoring","Pontoise","Kinderfeest","Paasmaandagwandeling","Andere kosten","Andere opbrengsten"],
  ledenCategorieen:["Administratie","Vrijwilligers","Erewacht","Ploeg 1","Ploeg 2","Ploeg 3","Ploeg 4","Officieren"]};
const DEF_JAAR={beginKas:0,beginRekening:0,gewichten:{kaarten:1,kalenders:25,shifts:35,vergaderingen:20},drempels:{zilver:65,goud:100},korting:{brons:20,zilver:35,goud:50},lidgeld:{gewoon:30,erewacht:20},kalenderStock:200,perDoos:100};
const JUBILEA=[10,20,25,30,40,50,60];

/* ============ toestand ============ */
const COLS=["leden","boekingen","jaarleden","sponsors","jaren","templates","config","archief","regels","imports","ronde","banket","kinderfeest","activiteiten","vergaderingen","documenten","fotoalbums","mailings"];
const S={leden:new Map(),boekingen:new Map(),jaarleden:new Map(),sponsors:new Map(),jaren:new Map(),templates:new Map(),config:new Map(),archief:new Map(),regels:new Map(),imports:new Map(),ronde:new Map(),banket:new Map(),kinderfeest:new Map(),activiteiten:new Map(),vergaderingen:new Map(),documenten:new Map(),fotoalbums:new Map(),mailings:new Map()};
const loaded=new Set();
let db=null,canWrite=true,JAAR=ls.get("jaar",null);
const UI=Object.assign({ledenQ:"",ledenCat:"",ledenF:"alle",oudLeden:false,boekQ:"",boekCat:"",boekRek:"",puntQ:"",puntSort:"naam",kalQ:"",spQ:"",mailGroep:"alle",mailTpl:"",histJaar:null,histQ:"",boekDir:"",boekMaand:"",boekSort:{k:"datum",d:-1},boekPage:0},ls.get("ui",{}));
if(UI.puntSort==="voornaam")UI.puntSort="naam";UI.ledenSort={k:"naam",d:1};
const saveUI=()=>{const {ledenQ,boekQ,puntQ,kalQ,spQ,histQ,...rest}=UI;ls.set("ui",rest)};
const cfg=()=>Object.assign({},DEF_CONFIG,(S.config.get("algemeen")||{}));
const jaarCfg=Y=>{const j=S.jaren.get(String(Y))||{};return{...DEF_JAAR,...j,gewichten:{...DEF_JAAR.gewichten,...(j.gewichten||{})},drempels:{...DEF_JAAR.drempels,...(j.drempels||{})},korting:{...DEF_JAAR.korting,...(j.korting||{})},lidgeld:{...DEF_JAAR.lidgeld,...(j.lidgeld||{})}}};
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
  const leden=[...S.leden.values()].filter(l=>!l.geenLid&&(!l.lidSinds||l.lidSinds<=Y)&&(!l.lidTot||l.lidTot>=Y));
  const oud=[...S.leden.values()].filter(l=>!leden.includes(l)&&!(l.lidSinds>Y));
  const rows=new Map();
  for(const lid of [...leden,...oud]){
    const jl=S.jaarleden.get(Y+"_"+lid.id)||{};
    let lg;
    if(isEreVoorzitter(lid))lg={ok:true,bron:"Ere-voorzitter"};
    else if(jl.lidgeld==="OK")lg={ok:true,bron:jl.lidgeldBron||"Manueel op betaald gezet"};
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

/* ============ logboek ============ */
const LOG_COLS=new Set(["leden","jaarleden","boekingen"]);
let ME_NAME="";
const LOGS={rows:[],loaded:false,done:false,err:null,busy:false};
const LOG_SKIP=new Set(["id","jaar","lidId","extras","betaalToken","aangemeld","bron","bancontactId","regelNaam","bankRef","dubbelVan","lidgeldBedrag"]);
const LOG_ID=["naam","voornaam","lidId","jaar","nr","datum","bedrag","partij","richting","mededeling"];
function logDiff(a,b){a=a||{};b=b||{};const out=[];for(const k of new Set([...Object.keys(a),...Object.keys(b)])){if(LOG_SKIP.has(k)||k.startsWith("_"))continue;if(JSON.stringify(logN(a[k]))!==JSON.stringify(logN(b[k])))out.push(k)}return out}
const logN=v=>v==null||v===""||v===0||v===false||(Array.isArray(v)&&!v.length)?null:v;
function logEntry(col,id,oud,nieuw){if(!LOG_COLS.has(col))return null;oud=oud?stripId(oud):null;nieuw=nieuw?stripId(nieuw):null;
  const actie=!oud?"nieuw":!nieuw?"verwijderd":"gewijzigd";const ch=logDiff(oud,nieuw);if(!ch.length&&actie==="gewijzigd")return null;
  const pick=o=>{if(!o)return null;const r={};for(const k of [...ch,...LOG_ID])if(o[k]!==undefined)r[k]=o[k];return r};
  return{ts:new Date().toISOString(),wie:ME_NAME||"Onbekend",tabel:col,doc_id:id,actie,oud:pick(oud),nieuw:pick(nieuw)}}
function logWrite(entries){if(!LOG_CLIENT||!db)return;for(const e of entries){if(!e)continue;const lid=e.ts.replace(/\D/g,"").slice(0,17)+"-"+Math.random().toString(36).slice(2,8);db.collection("logboek").doc(lid).set(e).catch(()=>{})}}
const LOG_FL={naam:"Naam",voornaam:"Voornaam",adres:"Adres",email:"E-mail",telefoon:"Telefoon",categorie:"Categorie",lidSinds:"Lid sinds",lidTot:"Lid tot",info:"Info",nieuw:"Nieuw via formulier",personen:"Personen",menu1:"Menu",menu2:"Menu partner",opmerking:"Opmerking",betaald:"Betaald",lid:"Lid",kinderen:"Kinderen",straat:"Straat",by:"Door",
  kaarten:"Kaarten",shifts:"Shifts",vergaderingen:"Vergaderingen",kalOpgehaald:"Kalenderdozen opgehaald",kalUitgevoerd:"Kalenderdozen uitgevoerd",kal:"Kalenderlijst",extraTekst:"Extra inspanning",extraPunten:"Extra punten",
  lidgeld:"Lidgeldstatus",lidgeldBron:"Lidgeld",betaling:"Online betaling",datum:"Datum",bedrag:"Bedrag",mededeling:"Mededeling",partij:"Tegenpartij",iban:"Rekening tegenpartij",rekening:"Rekening/Kas",richting:"Richting",status:"Status",nr:"Nr"};
function logVal(k,v){if(v==null||v==="")return '<i class="muted">leeg</i>';
  if(k==="lidgeld")return v==="OK"?"manueel betaald":v==="NOK"?"manueel niet betaald":esc(String(v));
  if(k==="bedrag"&&typeof v==="number")return eur(v);if(k==="richting")return v==="uit"?"uitgave":"ontvangst";
  if(k==="datum")return fmtDate(v);if(k==="betaling"&&typeof v==="object")return esc(v.status||"")+(v.bedrag?" · "+eur(v.bedrag):"");
  if(typeof v==="boolean")return v?"ja":"nee";if(typeof v==="object")return esc(JSON.stringify(v).slice(0,60));
  const s=String(v);return esc(s.length>70?s.slice(0,70)+"…":s)}
function logOnderwerp(e){const o=e.nieuw||e.oud||{};
  if(e.tabel==="leden"){const l=S.leden.get(e.doc_id);return esc([o.naam||(l&&l.naam),o.voornaam||(l&&l.voornaam)].filter(Boolean).join(" ")||e.doc_id)}
  if(e.tabel==="jaarleden"){const lid=o.lidId||String(e.doc_id).replace(/^\d{4}_/,"");const l=S.leden.get(lid);const y=o.jaar||String(e.doc_id).slice(0,4);return esc(l?naamVol(l):(o.naam||lid.replace(/^x-/,"").replace(/-/g," ")))+` <span class="muted">· ${esc(String(y))}</span>`}
  if(e.tabel==="boekingen"){const b=S.boekingen.get(e.doc_id)||{};const nr=o.nr??b.nr,p=o.partij||b.partij||o.mededeling||b.mededeling||"";return (nr!=null?"#"+esc(String(nr))+" ":"")+esc(p.slice(0,40))+(o.bedrag!=null||b.bedrag!=null?` <span class="muted">· ${eur(o.bedrag??b.bedrag)}</span>`:"")}
  if(e.tabel==="banket"||e.tabel==="kinderfeest"){const r=(S[e.tabel]&&S[e.tabel].get(e.doc_id))||{};return esc(o.naam||o.lid||r.naam||r.lid||e.doc_id)}
  if(e.tabel==="fotoalbums"){const r=S.fotoalbums.get(e.doc_id)||{};return esc(o.titel||r.titel||e.doc_id)}
  if(e.tabel==="documenten"){const r=S.documenten.get(e.doc_id)||{};return esc(o.naam||r.naam||e.doc_id)}
  if(e.tabel==="activiteiten"||e.tabel==="vergaderingen"){const r=(S[e.tabel]&&S[e.tabel].get(e.doc_id))||{};const t=o.titel||r.titel||o.soort||r.soort||"";const d=o.datum||r.datum||"";return esc(t)+(d?` <span class="muted">· ${fmtDate(d)}</span>`:"")}
  if(e.tabel==="ronde"){const st=String(o.straat||String(e.doc_id).replace(/^\d{4}_/,""));const dl=typeof KR_DEEL!=="undefined"&&KR_DEEL.get(st);const x=typeof KR!=="undefined"&&KR.byId&&KR.byId.get(dl?dl.sid:st);return esc((x?x.n:st.replace(/~\d+$/,"").replace(/--/g," · ").replace(/-/g," "))+(dl?" (deel "+dl.nr+")":""))}
  return esc(e.info||e.doc_id||"")}
const LOG_TYPE={leden:"Lid",jaarleden:"Punten",boekingen:"Transactie",ronde:"Kalenderronde",banket:"Banket",kinderfeest:"Kinderfeest",activiteiten:"Activiteit",vergaderingen:"Vergadering",documenten:"Document",fotoalbums:"Fotoalbum"};
function logRegels(e){if(e.actie==="bulk")return esc(e.info||"");const a=e.oud||{},b=e.nieuw||{};
  let ks=logDiff(a,b);if(e.actie==="nieuw")ks=ks.filter(k=>b[k]!=null&&b[k]!==""&&b[k]!==0&&b[k]!==false);
  if(e.tabel==="jaarleden"&&ks.includes("extraTekst")&&ks.includes("extraPunten")){}
  return ks.slice(0,8).map(k=>`<div class="lg-ch"><span>${esc(LOG_FL[k]||k)}</span>${e.actie==="nieuw"?logVal(k,b[k]):e.actie==="verwijderd"?logVal(k,a[k]):logVal(k,a[k])+' <span class="arr">→</span> '+logVal(k,b[k])}</div>`).join("")+(ks.length>8?`<div class="muted" style="font-size:12px">+${ks.length-8} meer</div>`:"")}
const LOG_CLIENT=false; // op de eigen site logt de database zelf (supabase/logboek.sql)
async function logStart(more){if(LOGS.busy||(LOGS.loaded&&!more))return;LOGS.busy=true;const from=LOGS.rows.length;
  const {data,error}=await SB.from("logboek").select("id,ts,wie,tabel,doc_id,actie,oud,nieuw").order("id",{ascending:false}).range(from,from+299);LOGS.busy=false;
  if(error){LOGS.err=error.message;LOGS.loaded=true}else{LOGS.rows.push(...data);LOGS.done=data.length<300;LOGS.loaded=true;LOGS.err=null}if(route()==="logboek")renderBody()}
function logMeer(){const N=(UI.logN||100)+200;UI.logN=N;if(!LOGS.done&&LOGS.rows.length<N)logStart(true);else renderBody()}
/* ============ opslag ============ */
const queues=new Map();
function write(col,id,data,{merge=false,del=false,oud}={}){
  if(!db){toast("Geen verbinding met de gegevens.",true);return Promise.reject()}
  const _oud=oud!==undefined?oud:(S[col]&&S[col].get(id))||null;let _nieuw=del?null:data;
  const key=col+"/"+id;const prev=queues.get(key)||Promise.resolve();
  const p=prev.catch(()=>{}).then(()=>{const ref=db.collection(col).doc(id);
    if(del)return ref.delete();
    if(merge){const cur=S[col].get(id);const {id:_i,...rest}=cur||{};_nieuw={...rest,...data};return ref.set(_nieuw)}
    return ref.set(data)}).then(r=>{if(LOG_CLIENT&&LOG_COLS.has(col))logWrite([logEntry(col,id,_oud,_nieuw)]);return r}).catch(e=>{handleWriteError(e);throw e});
  queues.set(key,p);return p;
}
function handleWriteError(e){
  if(e&&(e.code==="permission_denied"||e.code==="42501")){toast("Je hebt alleen leesrechten. Vraag een bewerker om dit aan te passen.",true);return}
  if(e&&e.code==="23505"){toast("Deze transactie bestaat al (zelfde bankreferentie).",true);return}
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
  authCard(`<h1>Aanmelden</h1>
  <form id="fLogin" class="stack"><div class="fld"><label for="lEmail">E-mailadres</label><input id="lEmail" name="email" type="email" autocomplete="username" required></div>
  <div class="fld"><label for="lPw">Wachtwoord</label><input id="lPw" name="pw" type="password" autocomplete="current-password" required></div>
  <div class="err" id="lErr">${esc(msg||"")}</div><div class="muted small" id="lMsg"></div><button class="btn solid" type="submit">Aanmelden</button></form>`);
  setTimeout(()=>{const i=$("#lEmail");i&&i.focus()},30);
}
function showSetPassword(kind){
  authCard(`<h1>${kind==="invite"?"Welkom! Kies je wachtwoord":kind==="eerste"?"Kies je eigen wachtwoord":"Kies een nieuw wachtwoord"}</h1><p class="muted" style="margin:0">${kind==="eerste"?"Je meldde je aan met een tijdelijk wachtwoord. ":""}Minstens 8 tekens. Je gebruikt het samen met je e-mailadres om aan te melden.</p>
  <form id="fPw" class="stack"><div class="fld"><label for="pw1">Nieuw wachtwoord</label><input id="pw1" name="pw1" type="password" autocomplete="new-password" minlength="8" required></div>
  <div class="fld"><label for="pw2">Herhaal wachtwoord</label><input id="pw2" name="pw2" type="password" autocomplete="new-password" minlength="8" required></div>
  <div class="err" id="pwErr"></div><button class="btn solid" type="submit">Wachtwoord bewaren</button></form>`);
}
async function doLogin(f){const d=formData(f);$("#lErr").textContent="";const btn=f.querySelector("button[type=submit]");btn.disabled=true;
  const {data,error}=await SB.auth.signInWithPassword({email:d.email.trim(),password:d.pw});btn.disabled=false;
  if(error){const m=String(error.message||"");$("#lErr").textContent=/invalid login credentials/i.test(m)?"E-mailadres of wachtwoord klopt niet.":/api key|jwt|apikey/i.test(m)?"De sleutel van Supabase klopt niet ("+m+"). Gebruik de legacy anon key in Vercel (zie README).":/not confirmed/i.test(m)?"Dit e-mailadres is nog niet bevestigd. Vink in Supabase \"Auto Confirm User\" aan of bevestig de gebruiker.":"Aanmelden lukte niet: "+m;return}
  startApp(data.session)}
async function doSetPassword(f){const d=formData(f);const e=$("#pwErr");if(d.pw1.length<8){e.textContent="Gebruik minstens 8 tekens.";return}if(d.pw1!==d.pw2){e.textContent="De twee wachtwoorden zijn niet gelijk.";return}
  const {data,error}=await SB.auth.updateUser({password:d.pw1,data:{tijdelijk:false}});if(error){e.textContent=error.message;return}PW_NIEUW=true;
  const {data:{session}}=await SB.auth.getSession();toast("Wachtwoord bewaard.");startApp(session)}
(async function boot(){
  const hp=new URLSearchParams(location.hash.slice(1));const authType=hp.get("type");const authErr=hp.get("error_description");
  let conf;try{const r=await fetch("/api/config");conf=await r.json();if(!r.ok||!conf.supabaseUrl)throw 0}catch(e){$("#main").innerHTML='<div class="loading"><b>De app is nog niet ingesteld.</b><span>Vul SUPABASE_URL en SUPABASE_ANON_KEY in bij Vercel en publiceer opnieuw. Zie README.md.</span></div>';return}
  SB=supabase.createClient(conf.supabaseUrl,conf.supabaseAnonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data:{session}}=await SB.auth.getSession();
  if(hp.get("access_token")||authErr)history.replaceState(null,"",location.pathname+"#dashboard");
  SB.auth.onAuthStateChange(ev=>{if(ev==="PASSWORD_RECOVERY")showSetPassword("recovery")});
  if(session&&(authType==="invite"||authType==="recovery"))return showSetPassword(authType);
  if(!session)return showLogin(authErr?"De link is verlopen of al gebruikt. Vraag een nieuwe uitnodiging aan een bestuurslid.":"");
  startApp(session);
})();
let STARTED=false,PW_NIEUW=false;
async function startApp(session){
  if(STARTED||!session)return;
  ME={email:session.user.email,id:session.user.id};
  const {data:rol,error}=await SB.from("bestuur").select("rol,naam").eq("user_id",ME.id).maybeSingle();
  if(error||!rol){authCard(`<h1>Geen toegang</h1><p style="margin:0">Je bent aangemeld als <b>${esc(ME.email)}</b>, maar dit adres staat niet in de lijst van bestuursleden.</p><button class="btn" data-act="logout">Afmelden</button>`);return}
  ROL=rol.rol==="bewerker"?"admin":rol.rol;
  if(session.user.user_metadata&&session.user.user_metadata.tijdelijk&&!PW_NIEUW)return showSetPassword("eerste");
  STARTED=true;document.body.classList.remove("anon");
  canWrite=magSchrijven();canWriteConfirmed=true;applyRO();
  ME_NAME=rol.naam||ME.email;const an=$("#acctName");if(an)an.textContent=ME.email;const w=$("#who");if(w){w.textContent=ROL_LBL[ROL]||"";w.classList.toggle("ro",ROL==="lezer")}ROL_ECHT=ROL;gbMenu();gbSimStart();
  $("#main").innerHTML='<div class="loading" id="boot"><b>Gegevens laden…</b><span>Leden, boekhouding en punten worden opgehaald.</span></div>';
  const q=new URLSearchParams(location.search);if(q.get("bank")){const ok=q.get("bank")==="ok";setTimeout(()=>toast(ok?"De bankrekening is gekoppeld.":"Koppelen met de bank is niet gelukt"+(q.get("reden")?": "+q.get("reden"):"")+".",!ok),400);history.replaceState(null,"",location.pathname+"#bank")}
  const timer=setTimeout(()=>{if(loaded.size<COLS.length){const b=$("#boot");if(b)b.innerHTML="<b>De gegevens zijn nog niet bereikbaar.</b><span>Controleer je internetverbinding. De pagina blijft het proberen.</span>"}},10000);
  db=makeDb();
  for(const col of COLS){
    db.collection(col).onSnapshot(snap=>{
      const m=new Map();for(const d of snap.docs){m.set(d.id,{...d.data(),id:d.id})}S[col]=m;
      loaded.add(col);dirty=true;if(loaded.size===COLS.length)clearTimeout(timer);schedule();
    },err=>{loaded.add(col);clearTimeout(timer);if(col!=="facturen")toast("Gegevens ("+col+") konden niet geladen worden: "+(err&&err.message||""),true);schedule()});
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
/* tijdens een klik niet hertekenen, anders gaat de klik verloren */
let PTR=false,DEFER=false;
document.addEventListener("pointerdown",()=>{PTR=true},true);
const ptrEnd=()=>{PTR=false;if(DEFER){DEFER=false;setTimeout(()=>{const ae=document.activeElement;if(ae&&$("#main").contains(ae)&&ae.dataset&&ae.dataset.live!==undefined){pending=true;return}render()},0)}};
document.addEventListener("pointerup",ptrEnd,true);document.addEventListener("pointercancel",ptrEnd,true);
function schedule(){if(IMPORTING){pending=true;return}if(rafId)return;rafId=requestAnimationFrame(()=>{rafId=0;
  if(PTR){DEFER=true;return}
  const ae=document.activeElement;if(ae&&$("#main").contains(ae)&&/INPUT|TEXTAREA|SELECT/.test(ae.tagName)&&ae.dataset.live!==undefined){pending=true;return}
  render()})}
document.addEventListener("focusout",()=>{if(pending){pending=false;setTimeout(()=>{const ae=document.activeElement;if(!(ae&&$("#main").contains(ae)&&ae.dataset.live!==undefined)){if(PTR)DEFER=true;else render()}else pending=true},0)}});
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


/* ============ mobiel: onderbalk, keuzeblad en kaarttabellen ============ */
const KORT={boekhouding:"Financiën",administratie:"Activiteiten",communicatie:"Admin"};
function navGroups(){return [{id:"dashboard",label:"Dashboard",items:[["dashboard","Dashboard"]]},...NAV.map(n=>Array.isArray(n)?{id:n[0],label:n[1],items:[n]}:n)]}
function renderTabbar(r){const tb=$("#tabbar");if(!tb)return;
  tb.innerHTML=navGroups().map(g=>{const on=g.items.some(i=>i[0]===r);const single=g.items.length===1;
    return single?`<a href="#${g.items[0][0]}" class="${on?"on":""}">${ic(g.id==="dashboard"?"dashboard":g.id)}<span>${esc(KORT[g.id]||g.label)}</span></a>`:`<button type="button" class="${on?"on":""}" data-act="sheetOpen" data-id="${g.id}" aria-haspopup="true" aria-label="${esc(g.label)}">${ic(g.id)}<span>${esc(KORT[g.id]||g.label)}</span></button>`}).join("")}
function openSheet(id){const g=navGroups().find(x=>x.id===id);if(!g)return;const r=route();
  $("#sheetT").textContent=g.label;$("#sheetL").innerHTML=g.items.map(([k,l])=>`<a href="#${k}" class="${k===r?"on":""}">${ic(k)}<span>${esc(l)}</span><svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></a>`).join("");$("#sheet").hidden=false}
function closeSheet(){const s=$("#sheet");if(s)s.hidden=true}
function labelTables(root){for(const t of (root||document).querySelectorAll("table.rcards:not([data-lab])")){const heads=[...t.querySelectorAll("thead th")].map(th=>th.textContent.replace(/[▲▼]/g,"").trim());const main=+(t.dataset.main||0);
  for(const tr of t.querySelectorAll("tbody tr")){[...tr.children].forEach((td,i)=>{if(td.colSpan>1){td.classList.add("c-full");return}td.dataset.label=heads[i]||"";if(i===main)td.classList.add("c-main")})}t.dataset.lab="1"}}
new MutationObserver(()=>{if(labelTables.q)return;labelTables.q=1;queueMicrotask(()=>{labelTables.q=0;labelTables(document)})}).observe(document.body,{childList:true,subtree:true});
window.addEventListener("hashchange",closeSheet);
function navTitel(id){for(const g of NAV)if(g.items)for(const [i,l] of g.items)if(i===id)return l;return null}
function closeAcct(){const m=$("#acctMenu");if(m&&!m.hidden){m.hidden=true;const b=$("#gear");if(b)b.setAttribute("aria-expanded","false")}}
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeAcct()});
window.addEventListener("hashchange",closeAcct);
/* ============ rendering ============ */
let lastRoute="";
function route(){const h=location.hash.replace("#","");return ROUTES.some(r=>r[0]===h)?h:"dashboard"}
function render(force){
  if(!db)return;
  if(loaded.size<COLS.length&&S.leden.size===0&&S.jaren.size===0)return;
  const ys=jaren();const cj=Number(cfg().actiefJaar)||0;
  if(!ys.length){JAAR=new Date().getFullYear()}
  else JAAR=ys.includes(cj)?cj:ys[ys.length-1];
  const r=route(),rn=r==="ronde"?"kalenders":r;
  if(canWriteConfirmed){canWrite=magSchrijven(r);applyRO()}
  renderTabbar(rn);
  $("#nav").innerHTML=NAV.map(n=>Array.isArray(n)?'<a href="#'+n[0]+'" class="'+(n[0]===rn?"on":"")+'">'+ic(n[0])+esc(n[1])+'</a>':'<button type="button" class="navdd'+(n.items.some(i=>i[0]===rn)?" on":"")+'" data-act="navdd" data-id="'+n.id+'" aria-haspopup="true" aria-expanded="false">'+ic(n.id)+esc(n.label)+'<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>').join("");
  $("#brandLbl").textContent=cfg().vereniging||"";
  const g=$("#gear");if(g)g.classList.toggle("on",INST_IDS.includes(r));
  const sy=window.scrollY;const tws=[...document.querySelectorAll("#body .tw")].map(e=>e.scrollTop);
  const v=VIEWS[r]();
  const yearSel=ys.length?'<div class="yearpick"><label for="jaarSel">Boekjaar</label><select id="jaarSel" data-change="jaar">'+ys.map(y=>'<option'+(y===JAAR?" selected":"")+'>'+y+'</option>').join("")+'</select></div>':"";
  $("#main").innerHTML='<div class="top">'+EMBLEM+'<div><h1>'+esc(navTitel(r)||v.title)+'</h1></div><div class="grow"></div>'+(v.actions||"")+'</div>'+
    (S.leden.size===0&&S.jaren.size===0?emptyState():"")+'<div id="body" style="display:flex;flex-direction:column;gap:18px">'+v.body()+'</div>';
  VIEWS[r].after&&VIEWS[r].after();
  if(r===lastRoute&&!force){window.scrollTo(0,sy);[...document.querySelectorAll("#body .tw")].forEach((e,i)=>{if(tws[i])e.scrollTop=tws[i]})}lastRoute=r;
}
function renderBody(){const r=route();const v=VIEWS[r]();const sc=[...$("#body").querySelectorAll(".tw")].map(e=>e.scrollTop);$("#body").innerHTML=v.body();[...$("#body").querySelectorAll(".tw")].forEach((e,i)=>{if(sc[i])e.scrollTop=sc[i]});VIEWS[r].after&&VIEWS[r].after()}
function emptyState(){return '<div class="panel"><div class="empty" style="display:flex;flex-direction:column;gap:12px;align-items:center"><b style="font-size:17px;color:var(--ink)">Nog geen gegevens</b><span>Lees je bestaande Excel-bestanden in (VBHA_2025.xlsm, daarna VBHA_2026.xlsm), of start met een leeg boekjaar in Instellingen.</span><button class="btn primary" data-w data-act="importExcel">'+ic("upload")+'Excel-bestand importeren</button></div></div>'}
const VIEWS={};
const EMBLEM='<img class="emblem emblem-l" alt="" width="47" height="52" src="data:image/png;base64,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"><img class="emblem emblem-d" alt="" width="47" height="52" src="data:image/png;base64,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">';

/* ---------- dashboard ---------- */
function nieuweInschr(){return [...S.banket.values(),...S.kinderfeest.values()].filter(r=>r.nieuw&&Number(r.jaar)===JAAR)}
function inschrMelding(){const L=nieuweInschr();if(!L.length)return"";const b=L.filter(r=>S.banket.has(r.id)).length,k=L.filter(r=>S.kinderfeest.has(r.id)).length;
  const it=(v,n,t)=>n?`<a class="nm-i" href="#${v}"><b>${t}</b><span>${n} ${n===1?"nieuwe inschrijving":"nieuwe inschrijvingen"}</span></a>`:"";
  return `<div class="nmeld" role="status"><span class="nm-ic">${ic("deel")}</span><div class="nm-body"><b>${L.length===1?"Er is een nieuwe inschrijving":L.length+" nieuwe inschrijvingen"} binnengekomen</b>
  <div class="nm-l">${it("banket",b,"Banket")}${it("kinderfeest",k,"Kinderfeest")}</div></div>${canWrite?`<button type="button" class="nm-x" data-act="inschrGezien" aria-label="Melding sluiten" title="Melding sluiten">${ic("x")}</button>`:""}</div>`}
function nieuweLeden(){return [...S.leden.values()].filter(l=>l.nieuw).sort((a,b)=>String(b.aangemeld||"").localeCompare(String(a.aangemeld||"")))}
function nieuwMelding(){const L=nieuweLeden();if(!L.length)return"";
  const d=x=>{const t=new Date(x);return isNaN(t)?"":t.toLocaleDateString("nl-BE",{day:"numeric",month:"short"})};
  return `<div class="nmeld" role="status"><span class="nm-ic">${ic("leden")}</span><div class="nm-body"><b>${L.length===1?"Er heeft zich een nieuw lid aangemeld":L.length+" nieuwe leden hebben zich aangemeld"} via het formulier</b>
  <div class="nm-l">${L.slice(0,8).map(l=>`<button type="button" class="nm-i" data-act="toonLid" data-id="${esc(l.id)}"><b>${esc(l.naam)}</b> ${esc(l.voornaam)}<span>${esc(l.categorie||"")}${l.aangemeld?" · "+d(l.aangemeld):""}</span>${l.dubbelVan?'<span class="pill warn">mogelijk al lid</span>':""}</button>`).join("")}${L.length>8?`<span class="nm-more">+${L.length-8} meer</span>`:""}</div></div>${canWrite?`<button type="button" class="nm-x" data-act="nieuwGezien" aria-label="Melding sluiten" title="Melding sluiten">${ic("x")}</button>`:""}</div>`}
VIEWS.dashboard=()=>({title:"Dashboard",emblem:true,body(){
  const C=ctx();const cur=C.leden.map(l=>C.rows.get(l.id));
  const ok=cur.filter(r=>r.lg.ok).length,nok=cur.length-ok;
  const st={GOUD:0,ZILVER:0,BRONS:0,"niet actief":0};cur.forEach(r=>st[r.status]++);
  const actief=st.GOUD+st.ZILVER+st.BRONS;
  const nieuw=cur.filter(r=>r.lid.lidSinds===JAAR).length;
  const jub=cur.filter(r=>r.jaren===25).sort((a,b)=>(a.lid.naam||"").localeCompare(b.lid.naam||"","nl"));
  const cats=Object.entries(C.perCat).map(([k,v])=>({k,net:v.in-v.uit,...v})).sort((a,b)=>Math.abs(b.net)-Math.abs(a.net));
  const maxNet=Math.max(1,...cats.map(c=>Math.abs(c.net)));
  const top=cur.filter(r=>r.lg.ok&&r.lid.categorie!=="Erewacht"&&r.p.totaal>0).sort((a,b)=>b.p.totaal-a.p.totaal).slice(0,8);
  const recent=C.boek.slice(-6).reverse();
  const sgn=v=>(v>=0?"+":"−")+eur(Math.abs(v));
  const sec=(icon,titel,link,label)=>`<div class="dsec-h"><span class="dsec-ic">${ic(icon)}</span><h2>${titel}</h2><span class="grow"></span><a class="btn sm ghost" href="#${link}">${label} ›</a></div>`;
  return nieuwMelding()+inschrMelding()+agendaSectie()+`<section class="dsec" aria-label="Leden">${sec("leden","Leden","leden","Naar ledenlijst")}
  <div class="tiles two">
    <a class="tile" href="#leden" data-act="toonAlleLeden"><span class="lbl">Leden in orde</span><span class="val">${ok}<small style="font-size:16px;color:var(--muted)"> / ${cur.length}</small></span></a>
    <a class="tile" href="#leden" data-act="toonNietBetaald"><span class="lbl">Niet betaald</span><span class="val" style="color:${nok?"var(--bad)":"var(--good)"}">${nok}</span></a>
  </div>
  <div class="grid g2 eq">
    <div class="stackcol">
      <div class="panel"><div class="panel-h"><h2>Status leden</h2></div><div class="panel-b"><div class="dcats">
        ${["GOUD","ZILVER","BRONS"].map(k=>`<div class="dcat st"><span>${medal(k)}</span><span class="dtrack"><span style="width:${actief?st[k]/actief*100:0}%;background:var(--${k.toLowerCase()})"></span></span><b>${st[k]}<span class="muted small" style="font-weight:400"> · ${actief?Math.round(st[k]/actief*100):0}%</span></b></div>`).join("")}
      </div></div></div>
      <div class="panel"><div class="panel-h"><h2>Jubilarissen ${JAAR}</h2><span class="grow"></span><span class="pill warn">25 jaar lid</span></div><div class="panel-b"><div class="list">
        ${jub.length?jub.map(r=>`<div class="li"><span class="grow trunc"><b>${esc(naamVol(r.lid))}</b></span><span class="muted">lid sinds ${r.lid.lidSinds}</span></div>`).join(""):'<div class="empty" style="padding:8px 0">Geen jubilarissen dit jaar.</div>'}
      </div></div></div>
    </div>
    <div class="panel"><div class="panel-h"><h2>Meeste punten</h2></div><div class="panel-b"><div class="list">
      ${top.length?top.map((r,i)=>`<div class="li${i>=5?" top-x":""}"><span class="rank">${i+1}</span><span class="grow trunc"><b>${esc(naamVol(r.lid))}</b></span>${medal(r.status)}<b style="width:48px;text-align:right">${r.p.totaal}</b></div>`).join(""):'<div class="empty">Nog geen punten ingevoerd.</div>'}
    </div></div></div>
  </div></section>
<section class="dsec" aria-label="Financieel">${sec("boekhouding","Financieel","boekhouding","Naar boekhouding")}
  <div class="tiles three">
    <div class="tile hero"><span class="lbl">Totaal saldo</span><span class="val">${eur(C.kas+C.rek)}</span></div>
    <a class="tile" href="#boekingen" data-act="filterRek" data-v="Rekening"><span class="lbl">Rekening</span><span class="val">${eur(C.rek)}</span></a>
    <a class="tile" href="#boekingen" data-act="filterRek" data-v="Kas"><span class="lbl">Kas</span><span class="val">${eur(C.kas)}</span></a>
  </div>
  <div class="grid g2 eq">
    <div class="panel"><div class="panel-h"><h2>Saldo afgelopen 12 maanden</h2></div><div class="panel-b">${saldoChart(C)}</div></div>
    <div class="panel"><div class="panel-h"><h2>Resultaat per categorie</h2></div><div class="panel-b">
      ${cats.length?`<div class="dcats">${cats.map(c=>`<a class="dcat" href="#boekingen" data-act="filterCat" data-v="${esc(c.k)}"><span class="trunc">${esc(c.k)}</span><span class="dtrack"><span style="width:${Math.max(1.5,Math.abs(c.net)/maxNet*100)}%;background:var(--${c.net>=0?"good":"bad"})"></span></span><b class="${c.net>=0?"in":"out"}">${sgn(c.net)}</b></a>`).join("")}
      <div class="dcat tot"><span>Resultaat ${JAAR}</span><span></span><b class="${C.tin-C.tuit>=0?"in":"out"}">${sgn(C.tin-C.tuit)}</b></div></div>`:'<div class="empty">Nog geen transacties in '+JAAR+'.</div>'}
    </div></div>
  </div>
  </section>`}});
let SALDO=null;
function saldoHover(e){const wrap=e.target.closest&&e.target.closest(".dchart-wrap");if(!wrap||!SALDO)return;const svg=wrap.querySelector("svg"),g=svg.querySelector(".hov"),tip=wrap.querySelector(".dtip");
  const r=svg.getBoundingClientRect(),S0=SALDO,vx=(e.clientX-r.left)/r.width*S0.W;
  if(vx<S0.P-4||vx>S0.W-S0.R+4){g.style.display="none";tip.hidden=true;return}
  const t=S0.tS+(vx-S0.P)/(S0.W-S0.P-S0.R)*(S0.tE-S0.tS);let lo=0,hi=S0.pts.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(S0.pts[m][0]<t)lo=m;else hi=m}
  const p=Math.abs(S0.pts[lo][0]-t)<Math.abs(S0.pts[hi][0]-t)?S0.pts[lo]:S0.pts[hi];
  const X=S0.P+(p[0]-S0.tS)/(S0.tE-S0.tS)*(S0.W-S0.P-S0.R),Y=S0.T+(S0.hi-p[2])/(S0.hi-S0.lo2)*(S0.H-S0.T-S0.B);
  g.style.display="";g.querySelector("line").setAttribute("x1",X);g.querySelector("line").setAttribute("x2",X);const c=g.querySelector("circle");c.setAttribute("cx",X);c.setAttribute("cy",Y);
  tip.innerHTML=`<span>${new Date(p[0]).toLocaleDateString("nl-BE",{weekday:"short",day:"numeric",month:"short",year:"numeric",timeZone:"UTC"})}</span><b>${eur(p[2])}</b>`;tip.hidden=false;
  const px=X/S0.W*r.width,py=Y/S0.H*r.height,tw=tip.offsetWidth;let left=px-tw/2;left=Math.max(0,Math.min(r.width-tw,left));tip.style.left=left+"px";tip.style.top=Math.max(0,py-tip.offsetHeight-12)+"px"}
document.addEventListener("pointermove",e=>{if(e.target.closest&&e.target.closest(".dchart-wrap"))saldoHover(e)});
document.addEventListener("pointerdown",e=>{if(e.target.closest&&e.target.closest(".dchart-wrap"))saldoHover(e)});
document.addEventListener("pointerout",e=>{const w=e.target.closest&&e.target.closest(".dchart-wrap");if(w&&!w.contains(e.relatedTarget)){const g=w.querySelector(".hov");if(g)g.style.display="none";const tp=w.querySelector(".dtip");if(tp)tp.hidden=true}});
function saldoReeks(){
  // dagelijks totaal saldo (kas + rekening) over de 12 maanden tot vandaag (of tot 31/12 van het gekozen boekjaar)
  const ys=jaren();if(!ys.length)return null;
  const today=todayISO(),cy=+today.slice(0,4);const end=JAAR>=cy?today:JAAR+"-12-31";
  const DAY=86400000,tE=Date.parse(end+"T00:00:00Z"),tS=tE-365*DAY;
  const per={};const yrs=new Set();for(let t=tS;t<=tE;t+=DAY)yrs.add(+new Date(t).toISOString().slice(0,4));
  for(const Y of yrs){if(!S.jaren.has(String(Y)))continue;const c=jaarCfg(Y);
    const ev=[...S.boekingen.values()].filter(b=>b.jaar===Y&&b.datum).map(b=>[b.datum,(b.richting==="uit"?-1:1)*(+b.bedrag||0)]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
    per[Y]={begin:(+c.beginKas||0)+(+c.beginRekening||0),ev}}
  const known=Object.keys(per).map(Number).sort((a,b)=>a-b);if(!known.length)return null;
  const pts=[];const idx={},run={};
  for(let t=tS;t<=tE;t+=DAY){const d=new Date(t).toISOString().slice(0,10),Y=+d.slice(0,4);let v;
    if(per[Y]){const P=per[Y];if(run[Y]==null){run[Y]=P.begin;idx[Y]=0}while(idx[Y]<P.ev.length&&P.ev[idx[Y]][0]<=d){run[Y]+=P.ev[idx[Y]][1];idx[Y]++}v=run[Y]}
    else{const nxt=known.find(k=>k>Y);v=nxt!=null?per[nxt].begin:null}
    pts.push([t,d,v==null?null:r2(v)])}
  return{pts:pts.filter(p=>p[2]!=null),tS,tE}}
function saldoChart(C){
  const R0=saldoReeks();if(!R0||R0.pts.length<2)return '<div class="empty">Nog geen transacties.</div>';
  const {pts,tS,tE}=R0;
  const narrow=window.innerWidth<640;const W=narrow?360:640,H=narrow?230:300,P=narrow?38:54,R=narrow?8:14,T=22,B=26;
  const vals=pts.map(p=>p[2]);const top=Math.max(1,...vals);const lo=Math.min(0,...vals);
  const stepV=[500,1000,2000,2500,5000,10000,20000,25000,50000].find(s=>(top-lo)/s<=5)||100000;const hi=Math.ceil(top/stepV)*stepV;const lo2=Math.floor(lo/stepV)*stepV;
  const x=t=>P+(t-tS)/(tE-tS)*(W-P-R),y=v=>T+(hi-v)/(hi-lo2)*(H-T-B);
  let d="";pts.forEach((p,i)=>{d+=(i?"L":"M")+x(p[0]).toFixed(1)+" "+y(p[2]).toFixed(1)});
  const first=pts[0],last=pts[pts.length-1],lx=x(last[0]),ly=y(last[2]);const area=d+"L"+lx.toFixed(1)+" "+y(lo2)+"L"+x(first[0]).toFixed(1)+" "+y(lo2)+"Z";
  const ticks=[];for(let v=lo2;v<=hi+1;v+=stepV)ticks.push(v);
  const kf=v=>v===0?"0":(v/1000).toLocaleString("nl-BE")+"k";
  // maandlabels: midden van elke maand binnen het venster
  const months=[];{const s=new Date(tS);let yy=s.getUTCFullYear(),mm=s.getUTCMonth();
    for(let k=0;k<14;k++){const a=Date.UTC(yy,mm,1),b=Date.UTC(yy,mm+1,1);if(a>tE)break;const a2=Math.max(a,tS),b2=Math.min(b,tE),mid=(a2+b2)/2;if(b2-a2>12*86400000)months.push([MAANDEN[mm],x(mid),a]);mm++;if(mm>11){mm=0;yy++}}}
  const jan=months.filter(m=>new Date(m[2]).getUTCMonth()===0).map(m=>[x(m[2]),new Date(m[2]).getUTCFullYear()]);
  const labelRight=lx<W-150;
  SALDO={pts,tS,tE,P,R,W,H,T,B,hi,lo2};
  return `<div class="dchart-wrap"><svg viewBox="0 0 ${W} ${H}" class="dchart" role="img" aria-label="Verloop van het totale saldo, dag per dag, over de laatste 12 maanden">
    ${ticks.map(v=>`<line x1="${P}" x2="${W-R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${P-10}" y="${y(v)+4}" text-anchor="end" font-size="12" fill="var(--muted)">${kf(v)}</text>`).join("")}
    ${jan.map(([X,yr])=>`<line x1="${X}" x2="${X}" y1="${T-6}" y2="${y(lo2)}" stroke="var(--line-strong)" stroke-dasharray="2 3"/><text x="${X+4}" y="${T-8}" font-size="11" fill="var(--muted)">${yr}</text>`).join("")}
    ${months.filter((_,i)=>!narrow||i%2===0).map(([m,X])=>`<text x="${X}" y="${H-8}" text-anchor="middle" font-size="12" fill="var(--muted)">${m}</text>`).join("")}
    <path d="${area}" fill="var(--accent)" fill-opacity=".09"/><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="${lx}" cy="${ly}" r="5" fill="var(--surface)" stroke="var(--accent)" stroke-width="2.5"/>
    <text x="${labelRight&&!narrow?lx+10:lx-10}" y="${ly-10}" text-anchor="${labelRight&&!narrow?"start":"end"}" font-size="13" font-weight="600" fill="var(--ink)">${eur(last[2])}</text>
    <g class="hov" style="display:none"><line x1="0" x2="0" y1="${T-6}" y2="${y(lo2)}" stroke="var(--ink)" stroke-opacity=".35"/><circle r="4.5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/></g>
    <rect x="${P}" y="0" width="${W-P-R}" height="${H}" fill="transparent" class="hov-hit"/>
  </svg><div class="dtip" hidden></div></div>`;
}
function medal(s){return s==="niet actief"?'<span class="medal na"><i></i>NIET ACTIEF</span>':'<span class="medal '+s+'"><i></i>'+s+'</span>'}
function sparkline(C){
  const pts=[[JAAR+"-01-01",C.c.beginKas+C.c.beginRekening],...C.reeks];
  if(pts.length<2)return '<div class="empty">Nog geen transacties.</div>';
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
  actions:'<a class="btn" href="/inschrijven" target="_blank" rel="noopener" title="Openbare inschrijfpagina, om te delen met nieuwe leden">'+ic("deel")+'Inschrijfpagina</a><button class="btn primary" data-w data-act="nieuwLid">'+ic("plus")+'Nieuw lid</button><button class="btn iconbtn" data-act="ledenInst" aria-label="Instellingen ledenlijst" title="Instellingen ledenlijst">'+ic("instellingen")+'</button>',
  body(){const C=ctx();const c=cfg();
  return `<div class="bar"><div class="search">${ic("search")}<input id="ledenQ" data-live data-input="ledenQ" placeholder="Zoek op naam, adres, e-mail of telefoon" value="${esc(UI.ledenQ)}"></div>
    <select class="sel" id="ledenCat" data-change="ledenCat"><option value="">Alle categorieën</option>${c.ledenCategorieen.map(k=>`<option${UI.ledenCat===k?" selected":""}>${esc(k)}</option>`).join("")}</select>
    <div class="seg" role="group" aria-label="Lidgeldfilter">${[["alle","Alle"],["ok","Betaald"],["nok","Niet betaald"]].map(([k,l])=>`<button data-act="ledenF" data-v="${k}" class="${UI.ledenF===k?"on":""}">${l}</button>`).join("")}</div>
    <select class="sel only-sm" data-change="ledenSortSel" aria-label="Sorteren">${selOpts([["naam","Sorteren: achternaam"],["voornaam","Sorteren: voornaam"],["status","Sorteren: status"],["lidgeld","Sorteren: lidgeld"],["categorie","Sorteren: categorie"],["lidSinds","Sorteren: lid sinds"]],ledenSort().k)}</select></div>
    <div class="panel" id="ledenList">${ledenTable()}</div>`},
  });
VIEWS.leden.after=null;
function ledenSort(){const s=UI.ledenSort;return s&&s.k?s:{k:"naam",d:1}}
function ledenTable(){
  const C=ctx();const q=norm(UI.ledenQ);
  let list=(q?[...C.leden,...C.oud]:C.leden).map(l=>C.rows.get(l.id));
  if(UI.ledenCat)list=list.filter(r=>r.lid.categorie===UI.ledenCat);
  if(UI.ledenF==="ok")list=list.filter(r=>r.lg.ok);if(UI.ledenF==="nok")list=list.filter(r=>!r.lg.ok&&r.huidig);
  if(q)list=list.filter(r=>norm([r.lid.naam,r.lid.voornaam,r.lid.adres,r.lid.email,r.lid.telefoon,r.lid.info].join(" ")).includes(q));
  const LS=ledenSort(),vn=LS.k==="voornaam";
  const STR={GOUD:3,ZILVER:2,BRONS:1};
  const key={naam:r=>[r.lid.naam,r.lid.voornaam],voornaam:r=>[r.lid.voornaam,r.lid.naam],status:r=>[r.huidig?(STR[r.status]||0):-1],lidgeld:r=>[r.huidig?(r.lg.ok?1:0):-1],categorie:r=>[r.lid.categorie||""],lidSinds:r=>[+r.lid.lidSinds||9999]}[LS.k];
  const cmp=(a,b)=>{const x=key(a),y=key(b);for(let i=0;i<x.length;i++){const c=typeof x[i]==="number"?x[i]-y[i]:String(x[i]||"").localeCompare(String(y[i]||""),"nl");if(c)return c*LS.d}return (a.lid.naam||"").localeCompare(b.lid.naam||"","nl")||(a.lid.voornaam||"").localeCompare(b.lid.voornaam||"","nl")};
  list.sort(cmp);
  const th=(k,l,cls="")=>{const on=LS.k===k||(k==="naam"&&vn);return `<th${cls?` class="${cls}"`:""}><button type="button" class="thsort${on?" on":""}" data-act="ledenSort" data-v="${k}" title="${k==="naam"?(LS.k==="naam"?"Klik om te sorteren op voornaam":"Sorteren op achternaam"):"Sorteren op "+l.toLowerCase()}">${k==="naam"&&vn?"Voornaam":l} <span>${on?(LS.d>0?"▲":"▼"):""}</span></button></th>`};
  if(!list.length)return '<div class="empty">Geen leden gevonden'+(q?' voor “'+esc(UI.ledenQ)+'”':'')+'.</div>';
  const mob=`<div class="mlist" role="list">${list.map(r=>{const nm=vn?`<b>${esc(r.lid.voornaam)}</b> ${esc(r.lid.naam)}`:`<b>${esc(r.lid.naam)}</b> ${esc(r.lid.voornaam)}`;
    const sub=[r.huidig&&r.status!=="niet actief"?`<span class="ml-st ${r.status}"><i></i>${esc(r.status.charAt(0)+r.status.slice(1).toLowerCase())}</span>`:"",esc(r.lid.categorie||"")].filter(Boolean).join('<span class="ml-dot">·</span>');
    return `<button type="button" class="ml-row" role="listitem" data-act="toonLid" data-id="${esc(r.lid.id)}"><span class="ml-av ${r.huidig?(r.lg.ok?"ok":"nok"):"oud"}" aria-hidden="true">${esc(((vn?r.lid.voornaam:r.lid.naam)||"?").charAt(0).toUpperCase())}</span>
      <span class="ml-m"><span class="ml-n">${nm}${r.lid.nieuw?' <span class="pill info">nieuw</span>':""}</span><span class="ml-s">${sub}</span></span>
      <span class="ml-r">${r.huidig?(r.lg.ok?'<span class="pill ok">✓ Betaald</span>':'<span class="pill nok">Open</span>'):`<span class="pill neutral">${r.lid.geenLid?"geen lid":"oud-lid"}</span>`}</span><span class="ml-chev" aria-hidden="true">›</span></button>`}).join("")}</div>`;
  return mob+`<div class="tw dsk-only"><table class="rcards"><thead><tr>${th("naam","Naam")}${th("status","Status")}${th("lidgeld","Lidgeld "+JAAR)}${th("categorie","Categorie")}${th("lidSinds","Lid sinds","num")}<th>E-mail</th><th>Telefoon</th></tr></thead><tbody>
  ${list.map(r=>`<tr class="click" data-act="toonLid" data-id="${esc(r.lid.id)}"><td class="nm">${vn?`<b>${esc(r.lid.voornaam)}</b> ${esc(r.lid.naam)}`:`<b>${esc(r.lid.naam)}</b> ${esc(r.lid.voornaam)}`}${r.huidig?"":` <span class="pill neutral">${r.lid.geenLid?"geen lid":"oud-lid"}</span>`}${r.lid.nieuw?' <span class="pill info">nieuw</span>':""}</td>
    <td>${r.huidig?medal(r.status):""}</td><td>${r.huidig?lgPill(r):""}</td><td>${esc(r.lid.categorie)}</td><td class="num">${esc(r.lid.lidSinds||"")}</td>
    <td class="trunc">${esc(r.lid.email)||'<span class="pill warn">geen e-mail</span>'}</td><td style="white-space:nowrap">${esc(r.lid.telefoon)}</td></tr>`).join("")}
  </tbody></table></div><div style="padding:10px 16px;color:var(--muted);font-size:13px;border-top:1px solid var(--line)">${list.length} leden getoond</div>`;
}
function lgPill(r){return r.lg.ok?'<span class="pill ok" title="'+esc(r.lg.bron)+'">✓ Betaald</span>':'<span class="pill nok">Niet betaald</span>'}

/* ---------- boekhouding ---------- */
const BOEK_TABS=[["boekhouding","Overzicht"],["boekingen","Transacties"],["verwerken","Te verwerken"],["historiek","Historiek"]];
const INST_TABS=[["instellingen","Algemeen"],["herinneringen","Herinneringen"],["regels","Automatische regels"],["bank","Bankimport"],["logboek","Logboek"]];
const INST_IDS=INST_TABS.map(t=>t[0]);
function instTabs(act){return `<nav class="tabs" aria-label="Onderdelen instellingen">${INST_TABS.map(([k,l])=>`<a href="#${k}" class="${k===act?"on":""}">${esc(l)}</a>`).join("")}</nav>`}
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
function boekTabs(act){return "";const n=teVerwerken(ctx()).length;return `<nav class="tabs" aria-label="Onderdelen boekhouding">${BOEK_TABS.map(([k,l])=>`<a href="#${k}" class="${k===act?"on":""}">${esc(l)}${k==="verwerken"&&n?`<span class="cnt">${n}</span>`:""}</a>`).join("")}</nav>`}
function catList(C){return [...new Set([...cfg().boekCategorieen,...(C?C.boek.map(b=>b.categorie).filter(Boolean):[])])]}
function bedragCel(b){return `<span class="amt ${b.richting==="uit"?"out":"in"}">${b.richting==="uit"?"−":"+"}${eur(b.bedrag)}</span>`}
function catCell(b){if(!b.categorie)return '<span class="pill warn">Te verwerken</span>';return `<span class="cat">${esc(b.categorie)}</span>${b.status==="controle"?' <span class="pill warn" title="Automatisch voorgesteld, nog niet bevestigd">controleren</span>':""}`}
function bronLabel(b){return b.bron==="api"?"Bankkoppeling":b.bron==="bank"?"Bankbestand":b.bron==="excel"?"Excel-import":"Manueel"}
const boekActions=()=>'<button class="btn primary" data-w data-act="nieuweBoeking" title="Een transactie met de hand toevoegen, bv. een kasverrichting">'+ic("plus")+'Manuele transactie</button>';

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
  if(c&&c.size===1){const [cat,n]=[...c.entries()][0];if(n>=2)return{categorie:cat,naam:"Zelfde tegenpartij als "+n+" eerdere transacties",zeker:false}}
  return null;
}
function findLid(b){const t=norm((b.mededeling||"")+" "+(b.partij||""));const hits=ctx().leden.filter(l=>{const a=norm(l.naam),v=norm(l.voornaam);return a&&v&&t.includes(a)&&t.includes(v)});return hits.length===1?hits[0].id:null}
function regelText(r){return `${esc(VELD[r.veld]||"Mededeling")} ${esc(OPS[r.op]||"bevat")} <b>“${esc(r.waarde)}”</b>`}

/* overzicht */
VIEWS.boekhouding=()=>({title:"Boekhouding",sub:"Overzicht boekjaar "+JAAR,actions:boekActions()+'<button class="btn iconbtn" data-act="finInst" aria-label="Financiële instellingen" title="Financiële instellingen">'+ic("instellingen")+'</button>',body(){
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
    <div class="panel"><div class="panel-h"><h2>Resultaat per categorie</h2></div><div class="mlist" role="list">${cats.map(c=>`<button type="button" class="ml-row" role="listitem" data-act="filterCat" data-v="${esc(c.k)}"><span class="ml-m"><span class="ml-n"><b>${esc(c.k)}</b></span><span class="ml-s">${c.in?`<span class="in">in ${eur(c.in)}</span>`:""}${c.in&&c.uit?'<span class="ml-dot">·</span>':""}${c.uit?`<span class="out">uit ${eur(c.uit)}</span>`:""}</span><span class="ml-bar"><span style="width:${c.in/max*100}%;background:var(--good)"></span><span style="width:${c.uit/max*100}%;background:var(--bad)"></span></span></span><span class="ml-r ml-amt ${c.net>=0?"in":"out"}">${c.net>=0?"+":"−"}${eur(Math.abs(c.net))}</span><span class="ml-chev" aria-hidden="true">›</span></button>`).join("")||'<div class="empty">Nog geen transacties in '+JAAR+'.</div>'}
      <div class="ml-row ml-tot"><span class="ml-m"><span class="ml-n"><b>Totaal</b></span><span class="ml-s"><span class="in">in ${eur(C.tin)}</span><span class="ml-dot">·</span><span class="out">uit ${eur(C.tuit)}</span></span></span><span class="ml-r ml-amt ${res>=0?"in":"out"}">${res>=0?"+":"−"}${eur(Math.abs(res))}</span></div></div>
      <div class="tw dsk-only"><table class="rcards"><thead><tr><th>Categorie</th><th class="num">In</th><th class="num">Uit</th><th class="num">Netto</th><th style="width:24%"></th></tr></thead><tbody>
      ${cats.map(c=>`<tr class="click" data-act="filterCat" data-v="${esc(c.k)}" title="Toon de transacties van ${esc(c.k)}"><td><span class="cat">${esc(c.k)}</span></td><td class="num in">${c.in?eur(c.in):""}</td><td class="num out">${c.uit?eur(c.uit):""}</td><td class="num"><b class="${c.net>=0?"in":"out"}">${c.net>=0?"+":"−"}${eur(Math.abs(c.net))}</b></td>
        <td><div class="track2"><span style="width:${c.in/max*100}%;background:var(--good)"></span><span style="width:${c.uit/max*100}%;background:var(--bad)"></span></div></td></tr>`).join("")||'<tr><td colspan="5" class="empty">Nog geen transacties in '+JAAR+'.</td></tr>'}
      </tbody><tfoot><tr><td>Totaal</td><td class="num in">${eur(C.tin)}</td><td class="num out">${eur(C.tuit)}</td><td class="num ${res>=0?"in":"out"}">${res>=0?"+":"−"}${eur(Math.abs(res))}</td><td></td></tr></tfoot></table></div></div>
    <div class="panel"><div class="panel-h"><h2>Laatste transacties</h2><span class="grow"></span><a class="btn sm" href="#boekingen">Alle transacties</a></div><div class="list" style="padding:4px 20px">
      ${recent.map(b=>`<div class="li click" data-act="toonBoeking" data-id="${esc(b.id)}"><span class="muted nowrap" style="width:84px">${fmtDate(b.datum)}</span><span class="grow trunc">${esc(b.partij||b.mededeling)}<br><span class="muted small">${b.categorie?esc(b.categorie):"Te verwerken"}</span></span>${bedragCel(b)}</div>`).join("")||'<div class="empty">Nog geen transacties.</div>'}
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
  </svg></div><div class="muted small" style="margin-top:6px">Klik op een maand om de transacties ervan te zien.</div>`;
}

/* journaal */
VIEWS.boekingen=()=>({title:"Transacties",sub:"Journaal boekjaar "+JAAR,actions:'<button class="btn" data-act="exportBoek">'+ic("download")+'Exporteren</button>'+boekActions(),body(){
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
  return `${bulk}<div class="panel"><div class="sumbar"><span><b>${L.length}</b> transacties</span><span>In <b class="in">${eur(tin)}</b></span><span>Uit <b class="out">${eur(tuit)}</b></span><span>Saldo <b class="${tin-tuit>=0?"in":"out"}">${tin-tuit>=0?"+":"−"}${eur(Math.abs(tin-tuit))}</b></span></div>
  <div class="tw"><table class="journal jl"><thead><tr><th class="chk"><input type="checkbox" data-selall aria-label="Alles op deze pagina selecteren"${allSel?" checked":""}${canWrite?"":" disabled"}></th>${th("nr","Nr","num")}${th("datum","Datum")}${th("partij","Omschrijving")}${th("categorie","Categorie")}<th>Rekening</th>${th("bedrag","Bedrag","num")}<th class="num">Saldo na</th></tr></thead><tbody>
  ${rows.map(b=>`<tr class="click${SEL.has(b.id)?" selrow":""}" data-act="toonBoeking" data-id="${esc(b.id)}"><td class="chk c-chk"><input type="checkbox" data-sel="${esc(b.id)}" aria-label="Selecteer transactie ${esc(b.nr??"")}"${SEL.has(b.id)?" checked":""}${canWrite?"":" disabled"}></td>
   <td class="num muted c-nr">${esc(b.nr??"")}</td><td class="nowrap c-date">${fmtDate(b.datum)}</td>
   <td class="desc c-desc"><div class="d1">${esc(b.partij||b.mededeling||"—")}</div>${b.partij&&b.mededeling?`<div class="d2">${esc(b.mededeling)}</div>`:""}</td>
   <td class="c-cat">${catCell(b)}</td><td class="nowrap c-acct"><span class="acct${b.rekening==="Kas"?" kas":""}">${esc(b.rekening)}</span>${b.bron==="bank"||b.bron==="api"?' <span class="muted small" title="'+esc(bronLabel(b))+'">'+ic("bank")+'</span>':""}</td>
   <td class="num c-amt">${bedragCel(b)}</td><td class="num muted c-saldo">${eur(b.rekening==="Kas"?b._kas:b._rek)}</td></tr>`).join("")||'<tr><td colspan="8" class="empty">Geen transacties gevonden met deze filters.</td></tr>'}
  </tbody></table></div>
  ${pages>1?`<div class="pager"><span class="muted">${from+1}–${Math.min(from+PAGE,L.length)} van ${L.length}</span><span class="grow"></span><button class="btn sm" data-act="page" data-v="-1"${UI.boekPage===0?" disabled":""}>Vorige</button><span class="muted small">Pagina ${UI.boekPage+1} van ${pages}</span><button class="btn sm" data-act="page" data-v="1"${UI.boekPage>=pages-1?" disabled":""}>Volgende</button></div>`:""}</div>`;
}
function refreshJournal(){const el=$("#boekList");if(el)el.innerHTML=journal()}

/* te verwerken */
VIEWS.verwerken=()=>({title:"Te verwerken",sub:"Transacties zonder categorie, of met een voorstel dat je nog moet bevestigen",actions:boekActions(),body(){
  const C=ctx();const L=teVerwerken(C).slice().sort((a,b)=>(b.datum||"").localeCompare(a.datum||""));const cats=catList(C);
  if(!L.length)return boekTabs("verwerken")+'<div class="panel"><div class="empty"><b style="color:var(--ink)">Alles is verwerkt.</b><br>Bankregels waarvoor geen regel past, verschijnen hier na een import.</div></div>';
  return boekTabs("verwerken")+`<div class="bar"><span class="muted">${L.length} transacties wachten op een categorie of bevestiging.</span><span class="grow"></span><button class="btn" data-w data-act="regelsToepassen">Regels opnieuw toepassen</button><button class="btn primary" data-w data-act="alleBevestigen">Alle voorstellen bevestigen</button></div>
  <div class="panel"><div class="tw"><table class="journal rcards" data-main="1"><thead><tr><th>Datum</th><th>Omschrijving</th><th class="num">Bedrag</th><th>Categorie</th><th>Waarom dit voorstel</th><th></th></tr></thead><tbody>
  ${L.map(b=>{const s=b.categorie?null:suggest(b);const cat=b.categorie||(s&&s.categorie)||"";const why=b.categorie?(b.regelNaam||"Automatisch voorgesteld"):(s?s.naam:"Geen passende regel");
    return `<tr><td class="nowrap">${fmtDate(b.datum)}</td><td class="desc"><div class="d1">${esc(b.partij||b.mededeling||"—")}</div>${b.partij&&b.mededeling?`<div class="d2">${esc(b.mededeling)}</div>`:""}</td><td class="num">${bedragCel(b)}</td>
    <td><select class="sel sm" data-vcat="${esc(b.id)}" aria-label="Categorie"${canWrite?"":" disabled"}><option value="">Kies…</option>${selOpts(cats,cat)}</select></td><td class="muted small">${esc(why)}</td>
    <td class="nowrap" style="text-align:right"><button class="btn sm solid" data-w data-act="vOk" data-id="${esc(b.id)}">Bevestigen</button> <button class="btn sm ghost" data-w data-act="regelVan" data-id="${esc(b.id)}">Regel maken</button></td></tr>`}).join("")}
  </tbody></table></div></div>`}});

/* regels */
VIEWS.regels=()=>({title:"Automatische regels",sub:"Zo krijgen nieuwe bankregels vanzelf de juiste categorie",actions:'<button class="btn primary" data-w data-act="nieuweRegel">'+ic("plus")+'Nieuwe regel</button>',body(){
  const C=ctx();const R=[...S.regels.values()].sort(byVolg);const act=R.filter(r=>r.actief!==false);
  let cov=0,good=0;for(const b of C.boek){const r=act.find(r=>matchRegel(r,b));if(r){cov++;if(r.categorie===b.categorie)good++}}
  return instTabs("regels")+`<div class="note info">Bij elke import loopt de app de regels van boven naar onder af. De eerste regel die past, bepaalt de categorie. Past er geen, dan kijkt de app naar eerdere transacties van dezelfde tegenpartij en zet ze de transactie bij <a href="#verwerken">Te verwerken</a> om te bevestigen.</div>
  <div class="tiles"><div class="tile"><span class="lbl">Actieve regels</span><span class="val">${act.length}</span><span class="hint">${R.length-act.length} uitgeschakeld</span></div>
   <div class="tile"><span class="lbl">Dekking ${JAAR}</span><span class="val">${C.boek.length?Math.round(cov/C.boek.length*100):0}%</span><span class="hint">${cov} van ${C.boek.length} transacties krijgen een regel</span></div>
   <div class="tile"><span class="lbl">Juistheid</span><span class="val">${cov?Math.round(good/cov*100):0}%</span><span class="hint">Zelfde categorie als nu geboekt</span></div></div>
  <div class="panel"><div class="tw"><table class="rcards" data-main="2"><thead><tr><th style="width:84px">Volgorde</th><th>Aan</th><th>Als</th><th>Geldt voor</th><th>Dan categorie</th><th class="num">Treffers ${JAAR}</th><th class="num">Klopt</th><th></th></tr></thead><tbody>
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
  if(!String(f.waarde||"").trim()){el.innerHTML='<div class="note info">Vul een tekst in om te zien welke transacties van '+JAAR+' deze regel zou vinden.</div>';return}
  const hits=C.boek.filter(b=>matchRegel(r,b));const anders=hits.filter(b=>f.categorie&&b.categorie!==f.categorie);
  el.innerHTML=`<div class="note info"><b>${hits.length}</b> transacties in ${JAAR} passen bij deze regel${f.categorie?`, waarvan <b>${anders.length}</b> nu een andere categorie hebben`:""}.${hits.length?'<div class="small" style="margin-top:6px">'+hits.slice(-4).reverse().map(b=>`${fmtDate(b.datum)} · ${esc(b.partij||b.mededeling)} · ${esc(b.categorie||"geen categorie")}`).join("<br>")+"</div>":""}</div>`}
function regelVan(b){const p=String(b.partij||"").trim();regelForm(p&&p.length>3?{veld:"partij",op:"bevat",waarde:p,categorie:b.categorie||(suggest(b)||{}).categorie||""}:{veld:"mededeling",op:"bevat",waarde:String(b.mededeling||"").split(/\s+/).slice(0,3).join(" "),categorie:b.categorie||""},null)}

/* bank */
VIEWS.bank=()=>({title:"Bankimport",sub:"Rekeninguittreksels van Argenta inlezen",body(){
  const imps=[...S.imports.values()].sort((a,b)=>String(b.tijd||"").localeCompare(String(a.tijd||"")));
  return instTabs("bank")+`<div class="grid g2" style="align-items:start">
  <div class="panel"><div class="panel-h"><h2>Bestand importeren</h2></div><div class="panel-b stack">
    <p style="margin:0">Exporteer in Argenta Online Banking je verrichtingen als CSV- of Excel-bestand en kies het hier. Je ziet eerst een voorbeeld. Er wordt niets bewaard tot je op Importeren klikt.</p>
    <ul class="checks"><li>Elke regel krijgt de categorie van de eerste passende <a href="#regels">regel</a>.</li><li>Verrichtingen die al geboekt zijn, worden overgeslagen: zelfde bankreferentie, of zelfde datum, bedrag en tegenpartij.</li><li>Lidgelden worden op naam aan het juiste lid gekoppeld.</li><li>Wat geen regel heeft, komt bij <a href="#verwerken">Te verwerken</a>.</li></ul>
    <div data-w><button class="btn primary" data-act="importBank">${ic("upload")}Bestand kiezen</button></div></div></div>
  <div class="panel" id="bankKop"><div class="panel-h"><h2>Rechtstreekse koppeling met de bank</h2></div><div class="panel-b"><div class="muted">Status laden…</div></div></div></div>
  <div class="panel"><div class="panel-h"><h2>Importgeschiedenis</h2></div><div class="tw"><table class="rcards"><thead><tr><th>Wanneer</th><th>Bestand</th><th>Bron</th><th>Boekjaar</th><th class="num">Nieuw</th><th class="num">Overgeslagen</th><th class="num">Te verwerken</th></tr></thead><tbody>
  ${imps.map(i=>`<tr><td class="nowrap">${fmtDate(String(i.tijd||"").slice(0,10))} ${esc(String(i.tijd||"").slice(11,16))}</td><td class="trunc">${esc(i.bestand)}</td><td>${esc(i.bron==="api"?"Bankkoppeling":"Bestand")}</td><td>${esc(i.jaar)}</td><td class="num">${i.nieuw||0}</td><td class="num">${i.dubbel||0}</td><td class="num">${i.open||0}</td></tr>`).join("")||'<tr><td colspan="7" class="empty">Nog geen imports. Elke import van een bankbestand verschijnt hier.</td></tr>'}
  </tbody></table></div></div>`}});

/* ---------- punten ---------- */
VIEWS.punten=()=>({title:"Puntensysteem",actions:'<button class="btn primary" data-act="docRol" data-v="reglement" title="Reglement openen (uit Documenten)">'+ic("reglement")+'Reglement</button><button class="btn iconbtn" data-w data-act="puntInst" aria-label="Instellingen puntensysteem" title="Instellingen puntensysteem">'+ic("instellingen")+'</button>',body(){
  const C=ctx(),w=C.c.gewichten;
  const it=(v,l)=>`<div class="pt-c"><span>${l}</span><b>${v}</b></div>`,dr=C.c.drempels,k=C.c.korting;
  const st=(m,van)=>`<div class="pt-c">${medal(m)}<b>${van}</b></div>`;
  return `<div class="ptiles"><div class="ptile"><div class="pt-h">Punten per</div><div class="pt-row">${it(w.kalenders,"kalenderdoos")}${it(w.kaarten,"kaart")}${it(w.shifts,"shift")}${it(w.vergaderingen,"vergadering")}${it("vrij","extra")}</div></div>
  <div class="ptile"><div class="pt-h">Status</div><div class="pt-row">${st("BRONS","0–"+(dr.zilver-1))}${st("ZILVER",dr.zilver+"–"+(dr.goud-1))}${st("GOUD",dr.goud+"+")}</div></div></div>
  <div class="bar"><div class="search">${ic("search")}<input id="puntQ" data-live data-input="puntQ" placeholder="Zoek lid" value="${esc(UI.puntQ)}"></div>
  <div class="seg" role="group" aria-label="Sorteren">${[["naam",UI.puntSort==="voornaam"?"Op voornaam":"Op naam"],["totaal","Op punten"]].map(([k,l])=>`<button data-act="puntSort" data-v="${k}" class="${UI.puntSort===k||(k==="naam"&&UI.puntSort==="voornaam")?"on":""}">${l}</button>`).join("")}</div></div>
  <div class="panel" id="puntList">${puntTable()}</div>`}});
function stepper(kind,f,id,v,label){const d=canWrite?"":" disabled";
  return `<span class="step" role="group" aria-label="${esc(label)}"><button type="button" data-act="step" data-k="${kind}" data-f="${f}" data-id="${esc(id)}" data-d="-1" aria-label="Min"${d||(v<=0?" disabled":"")}>−</button><b>${v}</b><button type="button" data-act="step" data-k="${kind}" data-f="${f}" data-id="${esc(id)}" data-d="1" aria-label="Plus"${d}>+</button></span>`}
function extraLijnen(jl){if(Array.isArray(jl.extras))return jl.extras;if(jl.extraTekst||jl.extraPunten)return[{tekst:jl.extraTekst||"",punten:jl.extraPunten||0}];return[]}
function extraHtml(r,dis){const L0=extraLijnen(r.jl),L=L0.length?L0:[{tekst:"",punten:0}],id=esc(r.lid.id),nm=esc(naamVol(r.lid));
  return `<div class="xlist">${L.map((x,i)=>{
    return `<div class="xl"><input class="cellin wide" data-live data-jl="_x" data-xf="tekst" data-xi="${i}" data-id="${id}" value="${esc(x.tekst||"")}" placeholder="Omschrijving" aria-label="Extra inspanning ${i+1} ${nm}"${dis}><input class="cellin xp" type="number" min="0" step="1" inputmode="numeric" data-live data-jl="_x" data-xf="punten" data-xi="${i}" data-id="${id}" value="${x.punten||""}" placeholder="ptn" aria-label="Punten extra inspanning ${i+1} ${nm}"${dis}>${canWrite?(i===0?`<button type="button" class="xbtn xadd" data-act="xAdd" data-id="${id}" aria-label="Lijn toevoegen" title="Lijn toevoegen">+</button>`:`<button type="button" class="xbtn xdel" data-act="xDel" data-id="${id}" data-i="${i}" aria-label="Lijn verwijderen" title="Lijn verwijderen">×</button>`):""}</div>`}).join("")}</div>`}
function saveExtras(lidId,L){const t=L.map(x=>(x.tekst||"").trim()).filter(Boolean).join("; ");const pt=L.reduce((s,x)=>s+(+x.punten||0),0);return setJL(lidId,{extras:L,extraTekst:t,extraPunten:pt})}
/* ---------- categorie-editor ---------- */
function catEditor(id,list,name,fixed){const d=canWrite?"":" disabled";fixed=fixed||[];
  return `<div class="cated" id="${id}" data-fixed="${esc(fixed.join("|"))}"><div class="cat-l">${list.map(x=>catRow(x,fixed,d)).join("")}</div>
  ${canWrite?`<div class="cat-add"><input type="text" class="cat-in" placeholder="Nieuwe categorie" maxlength="60" aria-label="Nieuwe categorie"><button type="button" class="btn" data-catadd>${ic("plus")}Toevoegen</button></div>`:""}
  ${name?`<input type="hidden" name="${name}" value="${esc(list.join("\n"))}">`:""}</div>`}
function catRow(x,fixed,d){return `<span class="cat-r"><span class="cat-n">${esc(x)}</span>${fixed.includes(x)||d?"":`<button type="button" class="cat-x" data-catdel aria-label="${esc(x)} verwijderen" title="Verwijderen">${ic("x")}</button>`}</span>`}
function catVals(el){return [...el.querySelectorAll(".cat-n")].map(s=>s.textContent)}
function catSync(el){const h=el.querySelector('input[type=hidden]');if(h)h.value=catVals(el).join("\n")}
function catAdd(el){const i=el.querySelector(".cat-in");const v=i.value.replace(/\s+/g," ").trim();if(!v)return;
  if(catVals(el).some(x=>norm(x)===norm(v))){toast("Die categorie bestaat al.",true);i.select();return}
  el.querySelector(".cat-l").insertAdjacentHTML("beforeend",catRow(v,[],""));i.value="";i.focus();catSync(el)}
document.addEventListener("click",e=>{const a=e.target.closest("[data-catadd]");if(a){e.preventDefault();catAdd(a.closest(".cated"));return}
  const x=e.target.closest("[data-catdel]");if(x){e.preventDefault();const el=x.closest(".cated");x.closest(".cat-r").remove();catSync(el)}},true);
document.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.classList&&e.target.classList.contains("cat-in")){e.preventDefault();catAdd(e.target.closest(".cated"))}},true);
function ledenInst(){const c=cfg();
  modal("Instellingen ledenlijst",`<div class="pi-sec"><h4>Categorieën leden</h4>${catEditor("liCat",c.ledenCategorieen,null,["Erewacht"])}<p class="pi-note">"Erewacht" heeft een vaste betekenis (eigen lidgeld) en kan niet verwijderd worden. Een categorie verwijderen verandert niets aan de leden die er al in staan.</p></div>`,
  `<button class="btn" data-act="closeModal">${canWrite?"Annuleren":"Sluiten"}</button>${canWrite?'<button class="btn primary" id="liOk">Bewaren</button>':""}`);
  const ok=$("#liOk");if(!ok)return;
  ok.onclick=async()=>{const cats=catVals($("#liCat"));if(!cats.length){toast("Geef minstens één categorie op.",true);return}
    await write("config","algemeen",{...stripId(S.config.get("algemeen")||{}),ledenCategorieen:cats});closeModal();toast("Categorieën leden bewaard.")}}
function finInst(){const j=jaarCfg(JAAR),c=cfg();const d=canWrite?"":" disabled";
  const n=(id,l,v,suf,h)=>`<div class="fld"><label for="${id}">${l}</label><div class="sfx"><input id="${id}" type="number" step="0.01" inputmode="decimal" value="${v}"${d}><span>${suf}</span></div>${h?`<span class="help">${h}</span>`:""}</div>`;
  modal("Financiële instellingen",`<div class="pi-sec"><h4>Beginsaldo boekjaar ${JAAR}</h4><div class="form">${n("fiKas","Kas",j.beginKas,"€")}${n("fiRek","Rekening",j.beginRekening,"€")}</div></div>
  <div class="pi-sec"><h4>Lidgeld ${JAAR}</h4><div class="form">${n("fiLg","Gewoon lid",j.lidgeld.gewoon,"€")}${n("fiLe","Erewacht",j.lidgeld.erewacht,"€")}</div></div>
  <div class="pi-sec"><h4>Rekening</h4><div class="form"><div class="fld full"><label for="fiIban">Rekeningnummer</label><input id="fiIban" value="${esc(c.rekeningnummer)}" placeholder="BE.. .... .... ...."${d}><span class="help">Staat op de betaal-QR's, de inschrijfpagina's en in de mails.</span></div></div></div>
  <div class="pi-sec"><h4>Categorieën</h4><div class="form"><div class="fld full"><span class="lbl">Categorieën boekhouding</span>${catEditor("fiCat",c.boekCategorieen)}<span class="help">Een categorie verwijderen verandert niets aan bestaande transacties.</span></div></div></div>
  <div class="pi-sec"><h4>Bank</h4><div class="bar" style="margin:0"><a class="btn" href="#bank" data-act="closeModal">${ic("upload")}Bankimport en koppeling</a><a class="btn" href="#regels" data-act="closeModal">Automatische regels</a></div></div>`,
  `<button class="btn" data-act="closeModal">${canWrite?"Annuleren":"Sluiten"}</button>${canWrite?'<button class="btn primary" id="fiOk">Bewaren</button>':""}`);
  const ok=$("#fiOk");if(!ok)return;
  ok.onclick=async()=>{const v=id=>r2(num($("#"+id).value));const cats=catVals($("#fiCat"));
    if(!cats.length){toast("Geef minstens één categorie op.",true);return}
    const cur=stripId(S.jaren.get(String(JAAR))||{jaar:JAAR});
    await write("jaren",String(JAAR),{...cur,jaar:JAAR,beginKas:v("fiKas"),beginRekening:v("fiRek"),lidgeld:{...(cur.lidgeld||{}),gewoon:v("fiLg"),erewacht:v("fiLe")}});
    await write("config","algemeen",{...stripId(S.config.get("algemeen")||{}),rekeningnummer:$("#fiIban").value.trim(),boekCategorieen:cats});
    closeModal();toast("Financiële instellingen bewaard.")}}
function puntInst(){const c=jaarCfg(JAAR),w=c.gewichten,dr=c.drempels,k=c.korting;
  const n=(id,l,v,suf)=>`<div class="fld"><label for="${id}">${l}</label><div class="sfx"><input id="${id}" type="number" min="0" step="1" inputmode="numeric" value="${v}"><span>${suf}</span></div></div>`;
  modal("Instellingen puntensysteem "+JAAR,`<div class="pi-sec"><h4>Punten per onderdeel</h4><div class="form">${n("piD","Kalenders bussen (per doos)",w.kalenders,"pt")}${n("piK","Verkoop kaart fuif (per stuk)",w.kaarten,"pt")}${n("piS","Hulp bij activiteit (per shift)",w.shifts,"pt")}${n("piV","Vergadering (bestuur)",w.vergaderingen,"pt")}</div></div>
  <div class="pi-sec"><h4>Status en korting</h4><div class="pi-grid"><span></span><span class="pi-c">Vanaf</span><span class="pi-c">Korting</span>
  <span>${medal("BRONS")}</span><span class="pi-fix">0 pt</span><div class="sfx"><input id="piKb" type="number" min="0" max="100" inputmode="numeric" value="${k.brons}" aria-label="Korting brons"><span>%</span></div>
  <span>${medal("ZILVER")}</span><div class="sfx"><input id="piZ" type="number" min="0" inputmode="numeric" value="${dr.zilver}" aria-label="Zilver vanaf"><span>pt</span></div><div class="sfx"><input id="piKz" type="number" min="0" max="100" inputmode="numeric" value="${k.zilver}" aria-label="Korting zilver"><span>%</span></div>
  <span>${medal("GOUD")}</span><div class="sfx"><input id="piG" type="number" min="0" inputmode="numeric" value="${dr.goud}" aria-label="Goud vanaf"><span>pt</span></div><div class="sfx"><input id="piKg" type="number" min="0" max="100" inputmode="numeric" value="${k.goud}" aria-label="Korting goud"><span>%</span></div></div></div>
  <p class="pi-note">Geldt voor boekjaar ${JAAR}. Een nieuw boekjaar neemt deze waarden over.</p>`,
  `<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="piOk">Bewaren</button>`);
  $("#piOk").onclick=async()=>{const g=id=>Math.max(0,Math.round(num($("#"+id).value)));const z=g("piZ"),go=g("piG");
    if(go<=z){toast("Goud moet hoger liggen dan zilver.",true);return}
    const cur=stripId(S.jaren.get(String(JAAR))||{jaar:JAAR});
    await write("jaren",String(JAAR),{...cur,jaar:JAAR,gewichten:{kaarten:g("piK"),kalenders:g("piD"),shifts:g("piS"),vergaderingen:g("piV")},drempels:{zilver:z,goud:go},korting:{brons:Math.min(100,g("piKb")),zilver:Math.min(100,g("piKz")),goud:Math.min(100,g("piKg"))}});
    closeModal();toast("Puntensysteem "+JAAR+" bewaard.")}}
function toonReglement(){const c=jaarCfg(JAAR),w=c.gewichten,dr=c.drempels,k=c.korting;
  modal("Reglement puntensysteem",`<div class="regl">
  <h4>1. Doelstellingen</h4><ul><li>Leden stimuleren om actief deel te nemen.</li><li>Extra inzet belonen met tastbare voordelen.</li></ul>
  <h4>2. Basisprincipes</h4><ul><li>Elk lid betaalt het standaard lidgeld.</li><li>Leden verdienen punten voor hun inzet.</li><li>De punten die je verzamelt in werkjaar (X) gelden voor het daaropvolgende inzetjaar (X+1).</li><li>Maximale korting per activiteit: ${k.goud}% van de kostprijs.</li><li>Geldigheid: 1 jaar. Punten worden jaarlijks op 1 januari op 0 gezet (geen overdracht).</li><li>Erewachters betalen wel hun lidgeld, maar genieten steeds de maximale korting van ${k.goud}% en nemen niet deel aan het puntensysteem.</li></ul>
  <h4>3. Toekenning van punten</h4><p>Elke taak of activiteit krijgt een specifieke puntenwaarde. Het bestuur noteert de punten van de deelnemers na elke activiteit. Het blijft de verantwoordelijkheid van elk lid om zijn of haar puntensaldo te controleren.</p>
  <table class="rtab"><thead><tr><th>Activiteit</th><th>Punten</th></tr></thead><tbody><tr><td>Verkoop kaarten fuif (per stuk)</td><td>${w.kaarten}</td></tr><tr><td>Bussen kalenders (per doos)</td><td>${w.kalenders}</td></tr><tr><td>Hulp bij activiteit (shift/opbouw/afbraak)</td><td>${w.shifts}</td></tr><tr><td>Extra inspanning (ontwerp kalender, aanbrengen sponsor, …)</td><td>50</td></tr><tr><td>Aanwezigheid op vergaderingen (bestuur)</td><td>${w.vergaderingen}</td></tr></tbody></table>
  <h4>4. Omzetting van punten in korting</h4><p>De verzamelde punten worden omgezet in een korting op de kostprijs van betalende activiteiten (bv. banket).</p>
  <table class="rtab"><thead><tr><th>Punten per jaar</th><th>Voordeel</th><th>Type lid</th></tr></thead><tbody><tr><td>0–${dr.zilver-1}</td><td>${k.brons}% korting</td><td>${medal("BRONS")}</td></tr><tr><td>${dr.zilver}–${dr.goud-1}</td><td>${k.zilver}% korting</td><td>${medal("ZILVER")}</td></tr><tr><td>${dr.goud} of meer</td><td>${k.goud}% korting</td><td>${medal("GOUD")}</td></tr></tbody></table>
  <h4>5. Regels rond gebruik</h4><ul><li>Punten zijn strikt persoonsgebonden en kunnen onder geen enkele voorwaarde verkocht, overgedragen of gedeeld worden met andere leden. Ze dienen uitsluitend ter beloning van de individuele inzet van het lid.</li><li>Punten die tijdens een werkjaar worden verzameld, zijn geldig voor het daaropvolgende inzetjaar. Ze kunnen enkel tijdens dat inzetjaar ingezet worden en vervallen bij de jaarlijkse reset. Punten doorschuiven naar een volgend werkjaar kan niet. Zo start elk lid elk jaar opnieuw met gelijke kansen.</li><li>Inzet wordt gewaardeerd op basis van vastgelegde categorieën. Het bestuur kan bij bijzondere inspanningen bijkomende punten toekennen.</li><li>Enkel leden die hun jaarlijkse lidgeld betaald hebben, kunnen punten verzamelen en inruilen. Is het lidgeld niet betaald, dan vervallen alle rechten op deelname aan het puntensysteem.</li><li>Punten geven recht op een korting van maximum ${k.goud}% van de kostprijs van een betalende activiteit. Volledig gratis deelnemen aan een activiteit is dus niet mogelijk.</li><li>Meent een lid te weinig punten ontvangen te hebben, dan kan dit binnen een redelijke termijn gemeld worden bij het bestuur. Het bestuur bekijkt de melding en neemt een definitieve, bindende beslissing.</li><li>Er is geen maximumaantal punten dat een lid kan verzamelen. Enkel de korting per activiteit is begrensd.</li><li>Enkel leden van de vriendenkring komen in aanmerking om punten te verzamelen. Brengt een lid een extern persoon (bv. partner) mee om te helpen, dan krijgt dat lid hiervoor extra punten.</li><li>Het bestuur kan tijdens het jaar extra afspraken maken voor activiteiten die spontaan tot stand komen en niet in dit reglement vermeld staan.</li></ul>
  <div class="regl-end"><b>Afsluitende opmerking</b><br>Het systeem is bedoeld om inzet zichtbaar en belonend te maken, niet om leden uit te melken of te rangschikken.</div></div>`,
  `<button class="btn" data-act="reglPrint">${ic("download")}Afdrukken / PDF</button><button class="btn primary" data-act="closeModal">Sluiten</button>`)}
const PT_OPEN=new Set();
function puntTable(){
  const C=ctx(),w=C.c.gewichten,q=norm(UI.puntQ);
  let list=C.leden.filter(l=>l.categorie!=="Erewacht").map(l=>C.rows.get(l.id)).filter(r=>r&&r.lg.ok);
  if(q)list=list.filter(r=>norm(naamVol(r.lid)).includes(q));
  const vn=UI.puntSort==="voornaam";
  if(UI.puntSort==="totaal")list.sort((a,b)=>b.p.totaal-a.p.totaal);
  else if(vn)list.sort((a,b)=>(a.lid.voornaam||"").localeCompare(b.lid.voornaam||"","nl")||(a.lid.naam||"").localeCompare(b.lid.naam||"","nl"));
  const dis=canWrite?"":" disabled";
  const inp=(r,f)=>stepper("jl",f,r.lid.id,r.jl[f]||0,f+" "+naamVol(r.lid));
  const mob=`<div class="mlist" role="list">${list.map(r=>{const id=r.lid.id,open=PT_OPEN.has(id);const nm=vn?`<b>${esc(r.lid.voornaam)}</b> ${esc(r.lid.naam)}`:`<b>${esc(r.lid.naam)}</b> ${esc(r.lid.voornaam)}`;
    const det=[["Kaarten","kaarten"],["Shifts","shifts"],["Vergaderingen","vergaderingen"]];
    return `<div class="pm${open?" open":""}" role="listitem"><button type="button" class="ml-row" data-act="ptOpen" data-id="${esc(id)}" aria-expanded="${open}">
      <span class="ml-m"><span class="ml-n">${nm}</span><span class="ml-s">${medal(r.status)}</span></span><span class="pm-tot"><b>${r.p.totaal}</b><small>punten</small></span><span class="ml-chev" aria-hidden="true">›</span></button>
      ${open?`<div class="pm-d"><div class="pm-g"><div class="pm-c"><span>Kalenderdozen</span><b class="pm-v">${r.jl.kalUitgevoerd||0}</b></div>${det.map(([l,f])=>`<div class="pm-c"><span>${l}</span>${inp(r,f)}</div>`).join("")}</div>
        <div class="pm-x"><span>Extra inspanningen</span>${extraHtml(r,dis)}</div></div>`:""}</div>`}).join("")||'<div class="empty">Geen actieve leden gevonden.</div>'}</div>`;
  return mob+`<div class="tw dsk-only"><table class="rcards ptab"><thead><tr><th><button type="button" class="thsort" data-act="puntNaam" title="Klik om te sorteren op ${vn?"achternaam":"voornaam"}">${vn?"Voornaam":"Naam"} <span>${UI.puntSort==="totaal"?"":"▲"}</span></button></th><th>Kalenderdozen</th><th>Kaarten</th><th>Shifts</th><th>Vergaderingen</th><th>Extra inspanningen</th><th class="num">Totaal</th><th>Status</th></tr></thead><tbody>
  ${list.map(r=>`<tr><td class="nm" style="white-space:nowrap">${vn?`<b>${esc(r.lid.voornaam)}</b> ${esc(r.lid.naam)}`:`<b>${esc(r.lid.naam)}</b> ${esc(r.lid.voornaam)}`}</td><td class="num">${r.jl.kalUitgevoerd||0}</td><td class="num">${inp(r,"kaarten")}</td><td class="num">${inp(r,"shifts")}</td><td class="num">${inp(r,"vergaderingen")}</td>
  <td class="xcell">${extraHtml(r,dis)}</td><td class="num"><b>${r.p.totaal}</b></td><td>${medal(r.status)}</td></tr>`).join("")||'<tr><td colspan="8" class="empty">Geen actieve leden gevonden.</td></tr>'}
  </tbody></table></div>`;
}

/* ---------- kalenders ---------- */
function kalStats(C){const rows=[...S.jaarleden.values()].filter(j=>j.jaar===C.Y&&j.kal&&((j.kalOpgehaald||0)>0||(j.kalUitgevoerd||0)>0||j.kalToegevoegd));const omloop=rows.reduce((s,j)=>s+(j.kalOpgehaald||0),0),uit=rows.reduce((s,j)=>s+(j.kalUitgevoerd||0),0);return{rows,omloop,uit,stock:C.c.kalenderStock-omloop-uit}}
VIEWS.kalenders=()=>({title:"Kalenders "+JAAR,sub:"Verdeling en verkoop van de kalenderdozen",
  actions:'<a class="btn" href="/kaart" target="_blank" rel="noopener" title="Openbare kaart van de kalenderronde">'+ic("kaart")+'Kaart openen</a>'+'<button class="btn primary" data-w data-act="kalToevoegen">'+ic("plus")+'Persoon toevoegen</button>',body(){
  const C=ctx(),k=kalStats(C);
  const inLijst=new Set(k.rows.map(j=>j.lidId).filter(Boolean));
  const ontbreekt=C.leden.filter(l=>l.categorie!=="Erewacht"&&C.rows.get(l.id).lg.ok&&!inLijst.has(l.id));
  return kalTabs("kalenders")+`<div class="tiles"><div class="tile"><span class="lbl">Nog in stock</span><span class="val">${k.stock}</span><span class="hint">van ${C.c.kalenderStock} dozen</span></div>
    <div class="tile"><span class="lbl">In omloop</span><span class="val">${k.omloop}</span><span class="hint">opgehaald, nog niet klaar</span></div>
    <div class="tile"><span class="lbl">Uitgevoerd</span><span class="val">${k.uit}</span><span class="hint">${k.uit*C.c.gewichten.kalenders} punten in totaal</span></div>
    <div class="tile"><span class="lbl">Personen in lijst</span><span class="val">${k.rows.length}</span><span class="hint">met kalenders in ${JAAR}</span></div></div>
  <div class="bar"><div class="search">${ic("search")}<input id="kalQ" data-live data-input="kalQ" placeholder="Zoek persoon" value="${esc(UI.kalQ)}"></div></div>
  <div class="panel" id="kalList">${kalTable()}</div>`}});
function kalNaam(j){if(j.lidId){const l=S.leden.get(j.lidId);return l?naamVol(l):j.lidId}return j.naam||"?"}
const KAL_OPEN=new Set();

/* ---------- kalenderronde (Kalenders › Kalenderronde) ----------
   Kaart met alle straten waar de kalenders rondgebracht worden. Een straat aantikken toont een kaartje
   met "Te doen" / "Gedaan". Aanduidingen staan in de collectie "ronde", één document per straat en per jaar:
   id "<jaar>_<straat-id>" met {jaar, straat, status:"done", by, at}. De straten zelf staan als tekst in
   <script id="krData"> onderaan (naam, deelgemeente 0-3, aantal adressen, delen in Google-polyline-codering).
   Het aantal adressen = unieke huisnummers in OpenStreetMap binnen 120 m van de straat; pas het getal gerust aan. */
const KR_WIJKEN=["Centrum","Gijzegem","Hofstade","Nieuwerkerken"];
const KR_LABEL_ZOOM=16;
/* Startbeeld van de kaart: midden van Aalst-centrum op zoomniveau 15. De knop met het speldje toont de hele regio. */
const KR_START={at:[50.9402,4.0368],zoom:15};
/* Lijndikte per zoomniveau (pixels): [te doen, gedaan, geselecteerd]. Tussen twee niveaus wordt de dichtstbijzijnde gebruikt. */
const KR_DIKTE={12:[1,1.5,4],13:[1.2,2,4.5],14:[1.6,2.5,5],15:[2,3,6],16:[2.8,4,7],17:[3.5,5,8],18:[4,6,9]};
const krDikte=z=>KR_DIKTE[Math.max(12,Math.min(18,Math.round(z)))]; // vanaf dit zoomniveau staan de straatnamen op de kaart
const KR_CHECK='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const krSlug=t=>t.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
function krDecode(s){const pts=[];let i=0,la=0,lo=0;
  while(i<s.length){for(let k=0;k<2;k++){let r=0,sh=0,b;do{b=s.charCodeAt(i++)-63;r|=(b&31)<<sh;sh+=5}while(b>=32);const d=(r&1)?~(r>>1):(r>>1);if(k===0)la+=d;else lo+=d}pts.push([la/1e5,lo/1e5])}
  return pts}
/* Grenzen van de verdeelregio (<script id="krGrens">). Straatdelen die voor meer dan de helft buiten deze grenzen liggen,
   worden weggelaten; een straat zonder delen binnen de grenzen verdwijnt helemaal (niet zichtbaar, niet aanklikbaar, niet geteld). */
const KR_GRENS=(()=>{const el=document.getElementById("krGrens");if(!el)return[];return el.textContent.trim().split("\n").map(l=>l.slice(l.indexOf(" ")+1).trim().split(" ").map(krDecode)).flat()})();
const krInRing=(p,r)=>{let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const yi=r[i][0],xi=r[i][1],yj=r[j][0],xj=r[j][1];if(((yi>p[0])!==(yj>p[0]))&&(p[1]<(xj-xi)*(p[0]-yi)/(yj-yi)+xi))c=!c}return c};
const krBinnen=p=>!KR_GRENS.length||KR_GRENS.some(r=>krInRing(p,r));
const KR_STREETS=(()=>{const el=document.getElementById("krData");if(!el)return[];
  return el.textContent.trim().split("\n").map(l=>{const m=l.match(/^(.*) ([0-3]) (\d+) ([^0-9]*)$/);if(!m)return null;const n=m[1],w=KR_WIJKEN[+m[2]];
    return{id:w==="Centrum"?krSlug(n):krSlug(n)+"--"+krSlug(w),n,w,a:+m[3],g:m[4].trim().split(" ").map(krDecode).filter(part=>part.filter(krBinnen).length*2>=part.length)}}).filter(s=>s&&s.g.length)})();
const KR={ss:new Set(),map:null,host:null,sp:null,lines:new Map(),labels:null,labelAt:null,sel:null,busy:false,byId:new Map(KR_STREETS.map(s=>[s.id,s]))};
const krNaam=()=>ls.get("rondeNaam","");
const krVar=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const krAdr=n=>n===1?"1 adres":n+" adressen";
const krNum=n=>n.toLocaleString("nl-BE");
const krDT=iso=>{try{return new Date(iso).toLocaleString("nl-BE",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}catch(e){return""}};
/* krAll: alle aanduidingen van het jaar; krMarks: alleen afgewerkte straten (status "done"); krRes: gereserveerde (status "reserved"). */
function krAll(){const m={};for(const d of S.ronde.values())if(d.jaar===JAAR&&KR.byId.has(d.straat))m[d.straat]=d;return m}
function krMarks(){const a=krAll(),m={};for(const k in a)if(a[k].status!=="reserved")m[k]=a[k];return m}
function krRes(){const a=krAll(),m={};for(const k in a)if(a[k].status==="reserved")m[k]=a[k];return m}
/* Straatdelen: een straat wordt opgedeeld van kruispunt tot kruispunt. Een kruispunt is een punt dat de straat deelt met een andere straat.
   Punten van eenzelfde straat die minder dan 40 m van elkaar liggen tellen als één kruispunt, zodat de twee rijrichtingen van een
   gescheiden rijbaan samen één stuk vormen. Stukken korter dan 50 m worden bij een aangrenzend stuk gevoegd.
   Id van een deel: <straat-id>~<volgnummer>. Zelfde code in de app en op de openbare kaart, zodat de ids overal gelijk zijn. */
function krMaakDelen(streets){const key=p=>p[0].toFixed(5)+","+p[1].toFixed(5),cnt=new Map();
  for(const s of streets){const seen=new Set();for(const part of s.g)for(const p of part){const k=key(p);if(!seen.has(k)){seen.add(k);cnt.set(k,(cnt.get(k)||0)+1)}}}
  const dist=(a,b)=>{const dy=(a[0]-b[0])*111320,dx=(a[1]-b[1])*111320*Math.cos(a[0]*Math.PI/180);return Math.hypot(dx,dy)};
  const lengte=g=>{let t=0;for(let i=1;i<g.length;i++)t+=dist(g[i-1],g[i]);return t};
  const out=new Map();
  for(const s of streets){const stuk=[];
    for(const part of s.g){let cur=[part[0]];for(let i=1;i<part.length;i++){cur.push(part[i]);if(i<part.length-1&&cnt.get(key(part[i]))>1){stuk.push(cur);cur=[part[i]]}}if(cur.length>1)stuk.push(cur)}
    // eindpunten van de stukken groeperen tot kruispunten (binnen 40 m)
    const kp=[];const kpVan=p=>{for(let i=0;i<kp.length;i++)if(dist(kp[i],p)<40)return i;kp.push(p);return kp.length-1};
    let groepen=[];const per=new Map();
    for(const g of stuk){const a=kpVan(g[0]),b=kpVan(g[g.length-1]),k=Math.min(a,b)+"-"+Math.max(a,b);
      if(!per.has(k)){const gr={a:Math.min(a,b),b:Math.max(a,b),g:[]};per.set(k,gr);groepen.push(gr)}per.get(k).g.push(g)}
    const glen=gr=>Math.max(...gr.g.map(lengte));
    for(let t=0;t<groepen.length&&groepen.length>1;){const gr=groepen[t];
      if(gr.a===gr.b||glen(gr)<50){const h=groepen.find(x=>x!==gr&&(x.a===gr.a||x.b===gr.a||x.a===gr.b||x.b===gr.b))||groepen.find(x=>x!==gr);
        h.g.push(...gr.g);groepen.splice(t,1);t=0;continue}t++}
    // nummeren in de richting van de straat (van het ene uiteinde naar het andere)
    const alle=s.g.flat(),p0=alle[0],ver=alle.reduce((b,p)=>dist(p0,p)>dist(p0,b)?p:b,p0),ax=[ver[0]-p0[0],ver[1]-p0[1]];
    const proj=gr=>{const pts=gr.g.flat(),m=pts[Math.floor(pts.length/2)];return (m[0]-p0[0])*ax[0]+(m[1]-p0[1])*ax[1]};
    groepen=groepen.map(gr=>({gr,v:proj(gr)})).sort((x,y)=>x.v-y.v).map(x=>x.gr);
    const len=groepen.map(gr=>gr.g.reduce((x,g)=>x+lengte(g),0)),L=len.reduce((a,b)=>a+b,0)||1;
    out.set(s.id,groepen.map((gr,i)=>({id:s.id+"~"+i,sid:s.id,nr:i+1,g:gr.g,k:[kp[gr.a],kp[gr.b]],len:len[i],a:Math.max(groepen.length>1?1:0,Math.round(s.a*len[i]/L))})))}
  return out}
const KR_DELEN=krMaakDelen(KR_STREETS),KR_DEEL=new Map([...KR_DELEN.values()].flat().map(d=>[d.id,d]));
/* krDelen: aanduidingen van straatdelen (document per deel, straat = "<straat>~<nr>", deel: true) */
function krDelen(){const m={};for(const d of S.ronde.values())if(d.jaar===JAAR&&KR_DEEL.has(d.straat))m[d.straat]=d;return m}
function krDeelVan(sid){const D=krDelen();return (KR_DELEN.get(sid)||[]).filter(x=>D[x.id]).map(x=>({...x,m:D[x.id]}))}
function krAdrGedaan(s,M,D){if(M[s.id])return s.a;let t=0;for(const x of KR_DELEN.get(s.id)||[]){const m=D[x.id];if(m&&m.status!=="reserved")t+=x.a}return Math.min(t,s.a)}
const krInfo=id=>{const d=KR_DEEL.get(id);if(d){const s=KR.byId.get(d.sid);return{n:s.n+" (deel "+d.nr+")",a:d.a,deel:true,s}}const s=KR.byId.get(id);return{n:s.n,a:s.a,s}};
/* ops om de losse delen van straten weg te halen (bij het aanduiden of wissen van de hele straat) */
function krSegWeg(sids){const ops=[];for(const sid of sids)for(const x of krDeelVan(sid)){S.ronde.delete(JAAR+"_"+x.id);ops.push(["ronde",JAAR+"_"+x.id,null])}return ops}

const KAL_TABS=[["kalenders","Verdeling"],["ronde","Kalenderronde"]];
function kalTabs(act){return `<nav class="tabs" aria-label="Onderdelen kalenders">${KAL_TABS.map(([k,l])=>`<a href="#${k}" class="${k===act?"on":""}">${esc(l)}</a>`).join("")}</nav>`}

VIEWS.ronde=()=>({title:"Kalenderronde",
  actions:`<a class="btn" href="/kaart" target="_blank" rel="noopener" title="Kaart zonder aanmelden, om te delen">${ic("kaart")}Kaart openen</a>`,
  body(){
  const M=krMarks(),D=krDelen(),RS=krRes(),nRes=Object.keys(RS).length,tot=KR_STREETS.length,done=Object.keys(M).length,pct=tot?done/tot*100:0;
  const aTot=KR_STREETS.reduce((t,s)=>t+s.a,0),aDone=KR_STREETS.reduce((t,s)=>t+krAdrGedaan(s,M,D),0),aPct=aTot?aDone/aTot*100:0;
  const per=KR_WIJKEN.map(w=>{const ss=KR_STREETS.filter(s=>s.w===w),dd=ss.filter(s=>M[s.id]);return{w,n:ss.length,d:dd.length,an:ss.reduce((t,s)=>t+s.a,0),ad:ss.reduce((t,s)=>t+krAdrGedaan(s,M,D),0)}});
  return kalTabs("ronde")+`<div class="tiles three"><div class="tile hero"><span class="lbl">Bedeelde adressen ${JAAR}</span><span class="val">${krNum(aDone)}</span><span class="hint">van ${krNum(aTot)} adressen · ${Math.round(aPct)}%</span></div>
    <div class="tile"><span class="lbl">Nog te bedelen</span><span class="val">${krNum(aTot-aDone)}</span><span class="hint">adressen in ${tot-done} straten</span></div>
    <div class="tile"><span class="lbl">Afgewerkte straten</span><span class="val">${done}</span><span class="hint">van ${tot} straten · ${Math.round(pct)}%${nRes?` · ${nRes} gereserveerd`:""}</span></div></div>
  <div class="panel"><div class="panel-b kr-prog">
    <div class="kr-prog-main"><div class="kr-prog-t"><b>${Math.round(aPct)}%</b>van de verdeelregio bedeeld</div><span class="kr-track" aria-hidden="true"><span style="width:${aPct}%"></span></span></div>
    <div class="kr-wijken">${per.map(p=>`<button type="button" class="kr-wijk" data-act="krWijk" data-id="${esc(p.w)}" title="Zoom naar ${esc(p.w)}: ${p.d} van ${p.n} straten"><span>${esc(p.w)}</span><b>${krNum(p.ad)}/${krNum(p.an)}</b><i class="kr-track sm" aria-hidden="true"><span style="width:${p.an?p.ad/p.an*100:0}%"></span></i><small>${p.d}/${p.n} straten</small></button>`).join("")}</div>
  </div></div>
  <div class="panel"><div class="kr-slot" id="krSlot"></div></div>
  <div class="panel"><div class="panel-h"><h2>Aangeduide straten</h2>${done?`<span class="cnt">${done}</span>`:""}${nRes?`<span class="pill info">${nRes} gereserveerd</span>`:""}<span class="grow"></span></div>${krHistory({...krAll(),...krDelen()})}</div>`}});
VIEWS.ronde.after=krAfter;

function krHistory(M){const E=Object.values(M).sort((a,b)=>(b.at||"").localeCompare(a.at||""));
  if(!E.length)return '<div class="empty">Nog geen straten aangeduid voor '+JAAR+'. Tik een straat aan op de kaart en zet ze op Reserveren of Gedaan.</div>';
  const mob=`<div class="mlist" role="list">${E.map(m=>{const dl=KR_DEEL.get(m.straat),s=KR.byId.get(dl?dl.sid:m.straat);
    return `<div class="ml-row kr-mr" role="listitem"><button type="button" class="kr-mn" data-act="krToon" data-id="${esc(s.id)}"><span class="ml-m"><span class="ml-n"><b>${esc(s.n)}</b>${dl?` <span class="pill neutral">deel ${dl.nr}</span>`:""}</span>
      <span class="ml-s">${esc(s.w)}<span class="ml-dot">·</span>${dl?"± "+dl.a:s.a} adressen</span><span class="ml-s">${esc(m.by||"onbekend")}<span class="ml-dot">·</span>${esc(krDT(m.at))}</span></span>
      <span class="ml-r">${m.status==="reserved"?'<span class="pill info">Gereserveerd</span>':'<span class="pill ok">Gedaan</span>'}</span></button>
      ${canWrite?`<button type="button" class="iconbtn2 kr-x" data-act="krWis" data-id="${esc(m.straat)}" aria-label="${esc(s.n)} terug op te doen zetten">${ic("x")}</button>`:""}</div>`}).join("")}</div>`;
  return mob+`<div class="tw dsk-only" style="max-height:440px"><table class="rcards" data-main="0"><thead><tr><th>Straat</th><th>Status</th><th>Deelgemeente</th><th class="num">Adressen</th><th>Door</th><th>Wanneer</th><th></th></tr></thead><tbody>${E.map(m=>{const dl=KR_DEEL.get(m.straat),s=KR.byId.get(dl?dl.sid:m.straat);
    return `<tr><td><button type="button" class="kr-link" data-act="krToon" data-id="${esc(s.id)}" title="Toon op de kaart">${esc(s.n)}</button>${dl?` <span class="pill neutral">deel ${dl.nr}</span>`:""}</td><td>${m.status==="reserved"?'<span class="pill info">Gereserveerd</span>':'<span class="pill ok">Gedaan</span>'}</td><td class="muted">${esc(s.w)}</td><td class="num">${dl?"± "+dl.a:s.a}</td><td>${esc(m.by||"onbekend")}</td><td class="nowrap muted">${esc(krDT(m.at))}</td><td class="num"><button type="button" class="btn sm ghost danger" data-w data-act="krWis" data-id="${esc(m.straat)}" title="Terug op Te doen zetten" aria-label="${esc(s.n)} wissen">${ic("x")}</button></td></tr>`}).join("")}</tbody></table></div>`}

/* De kaart blijft bestaan als één element dat na elke hertekening terug in #krSlot gehangen wordt. */
function krHost(){if(KR.host)return KR.host;const h=document.createElement("div");h.className="kr-host";
  h.innerHTML=`<div class="kr-map" id="krMap" role="application" aria-label="Kaart van de straten van Aalst-centrum, Gijzegem, Hofstade en Nieuwerkerken"></div>
  <button type="button" class="kr-search" id="krSearchOpen" aria-haspopup="dialog">${ic("search")}<span>Zoek een straat…</span></button>
  <div class="kr-zoom"><button type="button" id="krZin" aria-label="Inzoomen">+</button><button type="button" id="krZout" aria-label="Uitzoomen">−</button><button type="button" id="krFit" aria-label="Hele kaart tonen" title="Hele kaart tonen">${ic("kaart")}</button></div>
  <section class="kr-card" id="krCard" hidden aria-labelledby="krCardT"><div class="kr-card-h"><div class="kr-card-t"><h3 id="krCardT"></h3><span id="krCardM"></span><button type="button" class="kr-link kr-wie" id="krWie" data-w hidden>Naam wijzigen</button><button type="button" class="kr-link kr-wie" id="krDeel" data-w hidden>Slechts een deel aanduiden</button></div><button type="button" class="btn ghost sm" id="krCardX" aria-label="Sluiten">${ic("x")}</button></div>
  <div class="kr-multi" id="krMulti" hidden></div>
  <div class="kr-seg" data-w role="group" aria-label="Status van de straat"><button type="button" id="krTodo" aria-pressed="true">Te doen</button><button type="button" id="krResBtn" aria-pressed="false">Reserveren</button><button type="button" id="krDone" aria-pressed="false">${KR_CHECK}Gedaan</button></div></section>`;
  h.querySelector("#krSearchOpen").onclick=krOpenSearch;
  h.querySelector("#krZin").onclick=()=>KR.map&&KR.map.zoomIn();
  h.querySelector("#krZout").onclick=()=>KR.map&&KR.map.zoomOut();
  h.querySelector("#krFit").onclick=()=>KR.map&&KR.map.fitBounds(KR.bounds,{padding:[20,20]});
  h.querySelector("#krCardX").onclick=()=>krSelect(null);
  h.querySelector("#krCard").addEventListener("click",e=>{const b=e.target.closest("[data-krx]");if(b){e.stopPropagation();krToggle(b.dataset.krx)}});
  h.querySelector("#krWie").onclick=()=>{const m=KR.sel&&krAll()[KR.sel];if(m)krKiesPersoon(KR.sel,m.status==="reserved"?"reserved":"done")};
  h.querySelector("#krDeel").onclick=()=>{if(KR.deel){KR.deel=null;KR.dsel=new Set()}else if(KR.sel){KR.deel=KR.sel;KR.dsel=new Set();krZoomTo(KR.sel)}if(KR.map)krStyleAll();krCard()};
  h.querySelector("#krDone").onclick=()=>krZet("done");
  h.querySelector("#krResBtn").onclick=()=>krZet("reserved");
  h.querySelector("#krTodo").onclick=()=>krZet("todo");
  KR.host=h;return h}

function krInit(){const h=krHost();if(KR.map)return;
  if(!window.L){h.querySelector("#krMap").innerHTML='<div class="empty">De kaart kon niet laden. Controleer je internetverbinding en herlaad de pagina.</div>';return}
  const map=L.map(h.querySelector("#krMap"),{zoomControl:false,preferCanvas:true,minZoom:12,maxZoom:19});KR.map=map;
  const renderer=L.canvas({tolerance:10});
  KR.bounds=L.latLngBounds(KR_STREETS.flatMap(s=>s.g.flat()));
  map.setView(KR_START.at,KR_START.zoom);map.setMaxBounds(KR.bounds.pad(.3));
  map.on("zoomend",()=>krStyleAll());
  map.attributionControl.setPrefix(false);map.attributionControl.setPosition("bottomleft");
  map.attributionControl.addAttribution('Straten © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>');
  for(const s of KR_STREETS){const line=L.polyline(s.g,{renderer,weight:4,lineCap:"round",lineJoin:"round"})
    .on("click",e=>{L.DomEvent.stopPropagation(e);krToggle(s.id)}).addTo(map);KR.lines.set(s.id,line)}
  
  // Elke naam staat op het langste rechte stuk van de straat en draait mee, zoals op een wegenkaart.
  KR.labelAt=new Map(KR_STREETS.map(s=>{let best=null,bl=-1;
    for(const part of s.g)for(let i=1;i<part.length;i++){const a=map.project(part[i-1],KR_LABEL_ZOOM),b=map.project(part[i],KR_LABEL_ZOOM);const len=a.distanceTo(b);if(len>bl){bl=len;best=[part[i-1],part[i],a,b]}}
    if(!best){const p=s.g[0][0];return[s.id,{at:p,angle:0}]}
    const [p,q,a,b]=best;let ang=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;if(ang>90)ang-=180;if(ang<-90)ang+=180;
    return[s.id,{at:[(p[0]+q[0])/2,(p[1]+q[1])/2],angle:ang}]}));
  KR.labels=L.layerGroup().addTo(map);map.on("zoomend moveend",krLabels);
  krBg();
  const restyle=()=>{if(KR.map){krStyleAll();krBgStyle()}};
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change",restyle);
  new MutationObserver(restyle).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
}
function krLabels(){if(!KR.labels)return;KR.labels.clearLayers();const map=KR.map;if(map.getZoom()<KR_LABEL_ZOOM)return;
  const view=map.getBounds().pad(.1);
  for(const s of KR_STREETS){const {at,angle}=KR.labelAt.get(s.id);if(!view.contains(at))continue;
    const t=document.createElement("span");t.textContent=s.n;t.style.transform=`rotate(${angle.toFixed(1)}deg)`;
    KR.labels.addLayer(L.tooltip({permanent:true,direction:"center",className:"kr-lbl",interactive:false}).setLatLng(at).setContent(t))}}
function krStyleAll(){const A=krAll();const todo=krVar("--kr-todo"),dn=krVar("--good"),rs=krVar("--info"),sel=krVar("--accent");const w=krDikte(KR.map?KR.map.getZoom():15);
  for(const [id,line] of KR.lines){const s=KR.ss.has(id),m=A[id],r=m&&m.status==="reserved",d=m&&!r;line.setStyle({color:d?dn:r?rs:s?sel:todo,weight:m?w[1]:s?w[2]:w[0],opacity:1})}
  /* aangeduide straten altijd boven de grijze tekenen, anders bedekken aansluitende straten ze deels en lijken ze dunner dan een net aangeduide straat */
  for(const id in A){const l=KR.lines.get(id);if(l)l.bringToFront()}
  for(const id of KR.ss){const l=KR.lines.get(id);if(l)l.bringToFront()}
  krSegTeken(A,{todo,dn,rs,sel,w})}
function krSegTeken(A,c){if(!KR.map)return;if(!KR.segLayer)KR.segLayer=L.layerGroup().addTo(KR.map);KR.segLayer.clearLayers();const D=krDelen();
  for(const id in D){const x=KR_DEEL.get(id);if(KR.deel===x.sid||A[x.sid])continue;
    L.polyline(x.g,{interactive:false,weight:c.w[1],color:D[id].status==="reserved"?c.rs:c.dn,lineCap:"round",opacity:1}).addTo(KR.segLayer)}
  if(KR.deel){const base=KR.lines.get(KR.deel);if(base)base.setStyle({opacity:.2});const full=A[KR.deel];
    for(const x of KR_DELEN.get(KR.deel)||[]){const m=full||D[x.id],on=KR.dsel.has(x.id);
      L.polyline(x.g,{weight:16,opacity:0,interactive:true}).on("click",e=>{L.DomEvent.stopPropagation(e);KR.dsel.has(x.id)?KR.dsel.delete(x.id):KR.dsel.add(x.id);krStyleAll();krCard()}).addTo(KR.segLayer);
      L.polyline(x.g,{interactive:false,weight:on?c.w[2]+1:c.w[1]+1,color:on?c.sel:m?(m.status==="reserved"?c.rs:c.dn):krVar("--muted"),lineCap:"butt",opacity:1}).addTo(KR.segLayer)}
    const ends=new Set();for(const x of KR_DELEN.get(KR.deel)||[])for(const p of x.k){const k=p.join(",");if(ends.has(k))continue;ends.add(k);
      L.circleMarker(p,{radius:4,weight:2,color:krVar("--ink")||"#222",fillColor:"#fff",fillOpacity:1,interactive:false}).addTo(KR.segLayer)}}}
function krCard(){const c=KR.host&&KR.host.querySelector("#krCard");if(!c)return;
  const mu=c.querySelector("#krMulti");
  if(KR.ss.size>1){const A=krAll(),ids=[...KR.ss].filter(id=>KR.byId.has(id)),L=ids.map(id=>KR.byId.get(id));const tot=L.reduce((t,x)=>t+x.a,0),pd=jaarCfg(JAAR).perDoos||100,doz=Math.ceil(tot/pd);
    const st=ids.map(id=>A[id]?(A[id].status==="reserved"?"r":"d"):"t");const all=v=>st.every(x=>x===v);
    c.hidden=false;c.classList.add("multi");c.querySelector("#krCardT").textContent=ids.length+" straten geselecteerd";
    c.querySelector("#krCardM").textContent="Tik een straat aan om ze toe te voegen, nog eens om ze weg te halen.";c.querySelector("#krWie").hidden=true;
    mu.hidden=false;mu.innerHTML=`<div class="kr-sum"><div><b>${krNum(tot)}</b><span>adressen</span></div><div><b>${krNum(doz)}</b><span>${doz===1?"doos":"dozen"} <small>(${pd} per doos)</small></span></div></div>
      <ul class="kr-ml">${L.map((x,k)=>`<li><span class="kr-ml-n">${esc(x.n)}${A[x.id]?`<small>${A[x.id].status==="reserved"?"gereserveerd":"gedaan"}</small>`:""}</span><span class="kr-ml-a">${krNum(x.a)}</span></li>`).join("")}</ul>`;
    c.querySelector("#krDone").setAttribute("aria-pressed",String(all("d")));c.querySelector("#krResBtn").setAttribute("aria-pressed",String(all("r")));c.querySelector("#krTodo").setAttribute("aria-pressed",String(all("t")));return}
  c.classList.remove("multi");mu.hidden=true;mu.innerHTML="";
  const kd=c.querySelector("#krDeel");kd.hidden=true;
  if(KR.deel&&KR.byId.has(KR.deel)){const s=KR.byId.get(KR.deel),segs=KR_DELEN.get(s.id)||[],D=krDelen(),full=krAll()[s.id],kz=segs.filter(x=>KR.dsel.has(x.id));
    const st=kz.map(x=>{const m=full||D[x.id];return m?(m.status==="reserved"?"r":"d"):"t"}),all=v=>kz.length&&st.every(x=>x===v);
    c.hidden=false;c.querySelector("#krCardT").textContent=s.n+" · deel aanduiden";
    c.querySelector("#krCardM").textContent=kz.length?`${kz.length} van ${segs.length} stukken gekozen · ± ${krAdr(kz.reduce((t,x)=>t+x.a,0))}`:`Tik de stukken aan die je wil aanduiden. De straat is opgedeeld in ${segs.length} stukken, van kruispunt tot kruispunt.`;
    c.querySelector("#krWie").hidden=true;kd.hidden=false;kd.textContent="Terug naar de hele straat";
    c.querySelector("#krDone").setAttribute("aria-pressed",String(!!all("d")));c.querySelector("#krResBtn").setAttribute("aria-pressed",String(!!all("r")));c.querySelector("#krTodo").setAttribute("aria-pressed",String(!!all("t")));return}
  if(!KR.sel||!KR.byId.has(KR.sel)){c.hidden=true;return}
  const s=KR.byId.get(KR.sel),m=krAll()[KR.sel],r=m&&m.status==="reserved";c.hidden=false;
  c.querySelector("#krCardT").textContent=s.n;
  c.querySelector("#krCardM").textContent=s.w+" · "+krAdr(s.a)+(m?` · ${r?"gereserveerd":"gedaan"} door ${m.by||"onbekend"} · ${krDT(m.at)}`:"");
  const dv=krDeelVan(KR.sel),nseg=(KR_DELEN.get(KR.sel)||[]).length;
  if(!m&&dv.length){const nd=dv.filter(x=>x.m.status!=="reserved").length,nr=dv.length-nd;c.querySelector("#krCardM").textContent=s.w+" · "+krAdr(s.a)+` · deels: ${[nd?nd+" van "+nseg+" stukken gedaan":"",nr?nr+" gereserveerd":""].filter(Boolean).join(", ")}`}
  if(canWrite&&nseg>1){kd.hidden=false;kd.textContent=dv.length&&!m?"Delen bekijken of wijzigen":"Slechts een deel aanduiden"}
  c.querySelector("#krWie").hidden=!m;c.querySelector("#krDone").setAttribute("aria-pressed",String(!!m&&!r));c.querySelector("#krResBtn").setAttribute("aria-pressed",String(!!r));c.querySelector("#krTodo").setAttribute("aria-pressed",String(!m))}
function krSelect(id){if(KR.deel&&KR.deel!==id){KR.deel=null;KR.dsel=new Set()}KR.ss=new Set(id?[id]:[]);KR.sel=id||null;if(KR.map)krStyleAll();krCard()}
function krToggle(id){if(KR.deel){KR.deel=null;KR.dsel=new Set();KR.ss=new Set()}if(KR.ss.has(id))KR.ss.delete(id);else KR.ss.add(id);KR.sel=KR.ss.size===1?[...KR.ss][0]:KR.ss.size?id:null;if(KR.map)krStyleAll();krCard()}
function krZoomTo(id){const l=KR.lines.get(id);if(l&&KR.map)KR.map.fitBounds(l.getBounds(),{maxZoom:17,paddingTopLeft:[40,80],paddingBottomRight:[70,200]})}
function krAfter(){const slot=$("#krSlot");if(!slot)return;slot.appendChild(krHost());
  if(!KR.map)krInit();else KR.map.invalidateSize({pan:false});
  if(KR.map){krStyleAll();krLabels()}krCard();
  if(KR.pending){const id=KR.pending;KR.pending=null;krZoomTo(id);krSelect(id)}}
function krGoto(id){if(route()!=="ronde"){KR.pending=id;location.hash="ronde";return}
  $("#krSlot").scrollIntoView({block:"center",behavior:"smooth"});krZoomTo(id);krSelect(id)}

async function krZet(st,id=KR.sel){if(KR.deel&&id===KR.sel)return krZetDeel(st);
  if(id&&KR_DEEL.has(id)){if(st!=="todo"||!canWrite||KR.busy)return;KR.busy=true;S.ronde.delete(JAAR+"_"+id);if(KR.map)krStyleAll();krCard();try{await write("ronde",JAAR+"_"+id,null,{del:true})}catch(e){}finally{KR.busy=false}if(KR.map)krStyleAll();krCard();return}
  if(KR.ss.size>1)return krZetMeer(st);if(!id||!canWrite||KR.busy)return;const cur=krAll()[id];
  if(st==="todo"){const weg=krSegWeg([id]);if(!cur&&!weg.length)return;KR.busy=true;if(cur){S.ronde.delete(JAAR+"_"+id);weg.push(["ronde",JAAR+"_"+id,null])}if(KR.map)krStyleAll();krCard();try{await writeMany(weg,()=>{})}catch(e){handleWriteError(e)}finally{KR.busy=false}if(KR.map)krStyleAll();krCard();return}
  if(cur&&(cur.status==="reserved")===(st==="reserved"))return;krKiesPersoon(id,st)}
async function krZetMeer(st){if(!canWrite||KR.busy)return;const ids=[...KR.ss].filter(id=>KR.byId.has(id)),A=krAll();
  if(st==="todo"){const del=ids.filter(id=>A[id]),weg=krSegWeg(ids);if(!del.length&&!weg.length)return;KR.busy=true;del.forEach(id=>S.ronde.delete(JAAR+"_"+id));if(KR.map)krStyleAll();krCard();
    try{await writeMany([...del.map(id=>["ronde",JAAR+"_"+id,null]),...weg],()=>{})}catch(e){handleWriteError(e)}finally{KR.busy=false}if(KR.map)krStyleAll();krCard();return}
  krKiesPersoon(ids,st)}
/* Naam typen bij Reserveren of Gedaan; de lijst vult aan met de leden van het boekjaar en namen die al gebruikt werden.
   Komt de naam overeen met een lid, dan wordt ook lidId bewaard. */
function krLidVanNaam(n){const q=norm(n);if(!q)return null;for(const l of S.leden.values()){if(norm((l.voornaam||"")+" "+(l.naam||""))===q||norm((l.naam||"")+" "+(l.voornaam||""))===q)return l}return null}
function krKiesPersoon(id,st){if(Array.isArray(id))return krKiesPersoonMeer(id,st);const s=KR.byId.get(id);if(!s)return;const cur=krAll()[id];const res=st==="reserved";
  const namen=[...new Set([...ctx().leden.map(l=>naamVol(l).trim()),...[...S.ronde.values()].map(d=>d.by).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,"nl"));
  const start=cur&&cur.by?cur.by:ls.get("rondeWie","")||krNaam();
  modal(s.n+(res?" reserveren":" afgewerkt"),`<div class="fld"><label for="krWieIn">${res?"Gereserveerd door":"Afgewerkt door"}</label><input id="krWieIn" list="krWieLijst" maxlength="60" autocomplete="off" placeholder="Begin te typen…" value="${esc(start)}"><datalist id="krWieLijst">${namen.map(n=>`<option value="${esc(n)}"></option>`).join("")}</datalist><span class="help">Kies een lid uit de lijst of typ een andere naam.</span></div><p class="err" id="krWieErr" hidden></p>`,
  `<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="krWieOk">${res?"Reserveren":"Op gedaan zetten"}</button>`);
  const inp=$("#krWieIn"),er=$("#krWieErr");setTimeout(()=>{inp.focus();inp.select()},40);
  const ok=async()=>{const by=inp.value.trim();if(!by){er.textContent="Geef een naam op.";er.hidden=false;inp.focus();return}
    const l=krLidVanNaam(by);ls.set("rondeWie",by);closeModal();KR.busy=true;
    const zelfde=cur&&(cur.status==="reserved")===res;
    const doc={jaar:JAAR,straat:id,status:res?"reserved":"done",by:l?naamVol(l).trim():by,lidId:l?l.id:null,at:zelfde?cur.at:new Date().toISOString(),...(zelfde?{gewijzigd:new Date().toISOString()}:{})};
    S.ronde.set(JAAR+"_"+id,{...doc,id:JAAR+"_"+id});if(KR.map)krStyleAll();krCard();
    try{await write("ronde",JAAR+"_"+id,doc);const weg=krSegWeg([id]);if(weg.length)await writeMany(weg,()=>{})}catch(e){}finally{KR.busy=false}
    if(KR.map)krStyleAll();krCard()};
  $("#krWieOk").onclick=ok;inp.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();ok()}})}
/* Deelmodus: de gekozen stukken krijgen de status; was de hele straat aangeduid, dan wordt ze eerst in stukken opgesplitst. */
async function krZetDeel(st){if(!canWrite||KR.busy)return;const sid=KR.deel,ids=[...KR.dsel];if(!ids.length){toast("Tik eerst een of meer stukken van de straat aan.",true);return}
  const full=krAll()[sid],D=krDelen(),pre=[];
  if(full){for(const x of KR_DELEN.get(sid)||[])if(!KR.dsel.has(x.id)){const doc={...stripId(full),straat:x.id,deel:true};S.ronde.set(JAAR+"_"+x.id,{...doc,id:JAAR+"_"+x.id});pre.push(["ronde",JAAR+"_"+x.id,doc])}
    S.ronde.delete(JAAR+"_"+sid);pre.push(["ronde",JAAR+"_"+sid,null])}
  if(st==="todo"){for(const id of ids)if(D[id]){S.ronde.delete(JAAR+"_"+id);pre.push(["ronde",JAAR+"_"+id,null])}if(!pre.length)return;KR.busy=true;KR.dsel=new Set();if(KR.map)krStyleAll();krCard();
    try{await writeMany(pre,()=>{})}catch(e){handleWriteError(e)}finally{KR.busy=false}if(KR.map)krStyleAll();krCard();return}
  krKiesPersoonMeer(ids,st,pre)}
function krKiesPersoonMeer(ids,st,pre){pre=pre||[];const res=st==="reserved",A={...krAll(),...krDelen()};const deel=ids.every(id=>KR_DEEL.has(id));
  const namen=[...new Set([...ctx().leden.map(l=>naamVol(l).trim()),...[...S.ronde.values()].map(d=>d.by).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,"nl"));
  const tot=ids.reduce((t,id)=>t+krInfo(id).a,0);
  modal((deel?krInfo(ids[0]).s.n+": "+ids.length+(ids.length===1?" stuk ":" stukken "):ids.length+" straten ")+(res?"reserveren":"op gedaan zetten"),`<p style="margin:0;color:var(--muted)">${deel?"± "+krNum(tot)+" adressen":ids.map(id=>esc(krInfo(id).n)).join(", ")+" · "+krNum(tot)+" adressen"}</p><div class="fld"><label for="krWieIn">${res?"Gereserveerd door":"Afgewerkt door"}</label><input id="krWieIn" list="krWieLijst" maxlength="60" autocomplete="off" placeholder="Begin te typen…" value="${esc(ls.get("rondeWie","")||krNaam())}"><datalist id="krWieLijst">${namen.map(n=>`<option value="${esc(n)}"></option>`).join("")}</datalist><span class="help">Kies een lid uit de lijst of typ een andere naam.</span></div><p class="err" id="krWieErr" hidden></p>`,
  `<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="krWieOk">${res?"Reserveren":"Op gedaan zetten"}</button>`);
  const inp=$("#krWieIn"),er=$("#krWieErr");setTimeout(()=>{inp.focus();inp.select()},40);
  const ok=async()=>{const by=inp.value.trim();if(!by){er.textContent="Geef een naam op.";er.hidden=false;inp.focus();return}
    const l=krLidVanNaam(by);ls.set("rondeWie",by);closeModal();KR.busy=true;const now=new Date().toISOString();
    const ops=[...pre,...krSegWeg(ids.filter(id=>!KR_DEEL.has(id))),...ids.map(id=>{const cur=A[id],zelfde=cur&&(cur.status==="reserved")===res;const doc={jaar:JAAR,straat:id,status:res?"reserved":"done",by:l?naamVol(l).trim():by,lidId:l?l.id:null,at:zelfde?cur.at:now,...(zelfde?{gewijzigd:now}:{}),...(KR_DEEL.has(id)?{deel:true}:{})};S.ronde.set(JAAR+"_"+id,{...doc,id:JAAR+"_"+id});return["ronde",JAAR+"_"+id,doc]})];if(deel)KR.dsel=new Set();
    if(KR.map)krStyleAll();krCard();
    try{await writeMany(ops,()=>{});toast((deel?ids.length+(ids.length===1?" stuk ":" stukken "):ids.length+" straten ")+(res?"gereserveerd":"op gedaan gezet")+".")}catch(e){handleWriteError(e)}finally{KR.busy=false}if(KR.map)krStyleAll();krCard()};
  $("#krWieOk").onclick=ok;inp.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();ok()}})}
function krVraagNaam(next){
  modal("Wie ben je?",`<p style="margin:0;color:var(--muted)">Je naam staat bij de straten die je afwerkt. Zo weten de anderen wie waar liep. Hij wordt op dit toestel onthouden.</p>
  <div class="fld"><label for="krNaamIn">Naam</label><input id="krNaamIn" maxlength="40" placeholder="Bv. Jan of Ploeg 2" autocomplete="name" value="${esc(krNaam())}"></div>`,
  `<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="krNaamOk">Opslaan</button>`);
  const inp=$("#krNaamIn"),ok=()=>{const v=inp.value.trim();if(!v){inp.focus();return}ls.set("rondeNaam",v);closeModal();render();if(next)next()};
  $("#krNaamOk").onclick=ok;inp.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();ok()}})}

/* Zoeken: volledig scherm met alle straten, gefilterd tijdens het typen. "hofstade" toont alle straten van Hofstade. */
const krFold=t=>t.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase();
const KR_SORTED=[...KR_STREETS].sort((a,b)=>a.n.localeCompare(b.n,"nl")||a.w.localeCompare(b.w,"nl"));
function krOpenSearch(){if(!KR.sp){const p=document.createElement("section");p.className="kr-sp";p.hidden=true;p.setAttribute("role","dialog");p.setAttribute("aria-modal","true");p.setAttribute("aria-label","Zoek een straat");
    p.innerHTML=`<div class="kr-sp-bar"><button type="button" id="krSpBack" aria-label="Terug naar de kaart"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><input id="krSpIn" type="search" placeholder="Zoek een straat…" autocomplete="off" enterkeyhint="go" aria-label="Zoek een straat"></div><ul id="krSpList"></ul><p class="empty" id="krSpEmpty" hidden>Geen straat gevonden met deze naam.</p>`;
    document.body.appendChild(p);KR.sp=p;
    p.querySelector("#krSpBack").onclick=krCloseSearch;
    const inp=p.querySelector("#krSpIn");inp.addEventListener("input",krResults);
    inp.addEventListener("keydown",e=>{if(e.key==="Enter"&&KR.hits.length){e.preventDefault();krPick(KR.hits[0])}if(e.key==="Escape")krCloseSearch()})}
  const inp=KR.sp.querySelector("#krSpIn");inp.value="";KR.sp.hidden=false;inp.focus();krResults();KR.sp.querySelector("#krSpList").scrollTop=0}
function krCloseSearch(){if(!KR.sp)return;KR.sp.querySelector("#krSpIn").blur();KR.sp.hidden=true}
function krPick(s){krCloseSearch();krZoomTo(s.id);krSelect(s.id)}
function krResults(){const q=krFold(KR.sp.querySelector("#krSpIn").value.trim()),M=krAll();
  KR.hits=q?KR_SORTED.filter(s=>krFold(s.n).includes(q)||krFold(s.w).startsWith(q)):KR_SORTED;
  KR.sp.querySelector("#krSpEmpty").hidden=KR.hits.length>0;
  KR.sp.querySelector("#krSpList").replaceChildren(...KR.hits.map(s=>{const li=document.createElement("li"),b=document.createElement("button");b.type="button";
    const nm=document.createElement("span");nm.textContent=s.n;const sm=document.createElement("small");sm.textContent=s.w+" · "+krAdr(s.a);nm.append(sm);b.append(nm);
    const m=M[s.id];if(m){const d=document.createElement("span");d.className="kr-ok";if(m.status==="reserved"){d.classList.add("res");d.append("gereserveerd · "+(m.by||""))}else{d.innerHTML=KR_CHECK;d.append(m.by||"gedaan")}b.append(d)}
    b.onclick=()=>krPick(s);li.append(b);return li}))}
function krWijk(w){const ss=KR_STREETS.filter(s=>s.w===w);if(!ss.length||!KR.map)return;KR.map.fitBounds(L.latLngBounds(ss.flatMap(s=>s.g.flat())),{padding:[30,30]});$("#krSlot").scrollIntoView({block:"center",behavior:"smooth"})}
function krWisAlles(){const M={...krAll(),...krDelen()},ids=Object.keys(M);if(!ids.length)return;
  confirmBox(`Alle <b>${ids.length}</b> aangeduide straten van ${JAAR} terug op Te doen zetten, voor iedereen? Dit kan je niet ongedaan maken.`,"Alles wissen",async()=>{
    try{await writeMany(ids.map(id=>["ronde",JAAR+"_"+id,null]),()=>{});KR.sel=null;KR.ss.clear();toast(ids.length+" straten gewist.")}catch(err){handleWriteError(err)}})}

/* ---------- kalenderronde: achtergrondkaart ----------
   Getekend uit kaart.json (naast deze pagina gepubliceerd), gemaakt uit het GRB van Digitaal Vlaanderen:
   groen, water, wegdek, spoor en gebouwen. Elk vlak is een Google-polyline (lengtegraad/breedtegraad zoals de straten);
   een vlak met gaten is een lijst van ringen. Kleuren: --krb-* bovenaan de stijl. Gebouwen vanaf zoom KR_BLD_ZOOM. */
const KR_BLD_ZOOM=15;
const KR_BG_ORDER=[["green","--krb-green"],["water","--krb-water"],["road","--krb-road"],["rail","--krb-rail"],["bld","--krb-bld"]];
function krBg(){if(KR.bgLoading||KR.bg||!KR.map)return;KR.bgLoading=true;
  fetch("kaart.json").then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).then(d=>{
    const map=KR.map;map.createPane("krBg").style.zIndex=300;map.createPane("krBld").style.zIndex=310;
    const rBg=L.canvas({pane:"krBg",padding:.3}),rBld=L.canvas({pane:"krBld",padding:.3});
    KR.bg={groups:{},src:d.src||""};
    for(const [k,tok] of KR_BG_ORDER){const items=(d.L&&d.L[k])||[];if(!items.length)continue;
      const bld=k==="bld",g=L.layerGroup();
      for(const it of items){const rings=(Array.isArray(it)?it:[it]).map(krDecode);
        g.addLayer(L.polygon(rings,{renderer:bld?rBld:rBg,pane:bld?"krBld":"krBg",interactive:false,stroke:false,fillOpacity:1,_krTok:tok}))}
      KR.bg.groups[k]=g;if(!bld)g.addTo(map)}
    map.attributionControl.addAttribution("Achtergrond © GRB, Digitaal Vlaanderen");
    krGrens(map);
    map.on("zoomend",krBgZoom);krBgZoom();krBgStyle();
  }).catch(()=>{KR.bgLoading=false})}
/* Alles buiten de deelgemeenten Aalst, Gijzegem, Hofstade en Nieuwerkerken wordt afgedekt (--kr-out), met een stippellijn op de grens.
   De grenzen staan in <script id="krGrens">: per lijn een naam en één ring. */
function krGrens(map){const el=document.getElementById("krGrens");if(!el)return;
  const R=KR_GRENS;if(!R.length)return;
  map.createPane("krMask").style.zIndex=330;const r=L.canvas({pane:"krMask",padding:.5});
  const world=[[52.5,2],[52.5,6.5],[49.5,6.5],[49.5,2]];
  KR.bg.mask=L.polygon([world,...R],{renderer:r,pane:"krMask",interactive:false,stroke:false,fillOpacity:1}).addTo(map);
  KR.bg.grens=L.polyline(R.map(x=>x.concat([x[0]])),{renderer:r,pane:"krMask",interactive:false,weight:1.5,dashArray:"6 5",opacity:1}).addTo(map)}
function krBgZoom(){const g=KR.bg&&KR.bg.groups.bld;if(!g)return;const on=KR.map.getZoom()>=KR_BLD_ZOOM;
  if(on&&!KR.map.hasLayer(g))g.addTo(KR.map);else if(!on&&KR.map.hasLayer(g))g.remove()}
function krBgStyle(){if(!KR.bg)return;const c={};
  for(const g of Object.values(KR.bg.groups))g.eachLayer(l=>{const t=l.options._krTok;l.setStyle({fillColor:c[t]||(c[t]=krVar(t))})});
  if(KR.bg.mask)KR.bg.mask.setStyle({fillColor:krVar("--kr-out")});if(KR.bg.grens)KR.bg.grens.setStyle({color:krVar("--kr-grens")})}

/* ---------- sponsors ---------- */
/* Koppelen van betalingen aan sponsors.
   1. Manueel: transactie.sponsorId = id van de sponsor ("-" = bewust geen sponsorbetaling). Geldt voor elke categorie en datum in het boekjaar.
   2. Automatisch: inkomende transacties met categorie Sponsoring vanaf 1 juni. Per sponsor wordt een score berekend op hele woorden
      (bedrijfsnaam, weergavenaam, contactpersoon, domein van het e-mailadres) en een bonus als het bedrag gelijk is. De hoogste score wint;
      bij gelijke score zonder verschil in bedrag blijft de betaling onverdeeld. */
const SP_STOP=new Set(["bvba","sprl","groep","group","cafe","bierhuis","brouwerij","services","kantoor","renovatie","renovaties","advocaat","advocatenkantoor","hotel","aalst","sponsoring","sponsering","kalender","brandweer","boomkwekerijen","zakenkantoor","dakwerken","onderdelen","auto"]);
const SP_DOM=new Set(["gmail","hotmail","outlook","live","telenet","skynet","yahoo","icloud","proximus","zonezuidoost","msn","scarlet"]);
const spNaam=s=>(s&&(s.weergave||s.bedrijf))||"";
function spToks(s){const T=[];const w=x=>norm(x).replace(/[^a-z0-9]+/g," ").trim();
  for(const v of [s.bedrijf,s.weergave])for(const t of w(v).split(" "))if(t.length>=4&&!SP_STOP.has(t))T.push({t,g:t.length});
  for(const v of [s.bedrijf,s.weergave]){const z=w(v).replace(/\b(bv|nv|bvba|vzw|comm\.?v)\b/g,"").trim();if(z.split(" ").length>1&&z.length>=6)T.push({t:z,g:z.length+4})}
  const cp=w((s.voornaam||"")+" "+(s.naam||""));if(cp.split(" ").length>1)T.push({t:cp,g:cp.length+4});const nm=w(s.naam);if(nm.length>=4&&nm.split(" ").length>1)T.push({t:nm,g:nm.length});
  const dm=(/@([^.@\s]+)\./.exec(String(s.email||""))||[])[1];if(dm&&dm.length>=5&&!SP_DOM.has(dm.toLowerCase()))T.push({t:dm.toLowerCase(),g:dm.length,dom:true});
  return T}
function spScore(T,hay,hayW,hayZ){let sc=0;for(const x of T){if(x.dom){if(hayZ.includes(x.t))sc+=x.g;continue}
    if(x.t.includes(" ")?(" "+hay+" ").includes(" "+x.t+" "):hayW.some(w=>w===x.t||(x.t.length>=6&&w.startsWith(x.t))))sc+=x.g}return sc}
function spKoppel(C){const sp=[...S.sponsors.values()].map(s=>({s,T:spToks(s)}));const per=new Map(),los=[];
  const add=(s,b,hoe)=>{const a=per.get(s.id)||{som:0,L:[]};a.som+=b.bedrag;a.L.push({...b,_hoe:hoe});per.set(s.id,a)};
  for(const b of C.boek){
    if(b.sponsorId){if(b.sponsorId!=="-"&&S.sponsors.has(b.sponsorId)&&b.richting!=="uit")add(S.sponsors.get(b.sponsorId),b,"manueel");continue}
    if(b.categorie!=="Sponsoring"||b.richting==="uit"||String(b.datum||"")<JAAR+"-06-01")continue;
    const hay=(b._m+" "+b._p).replace(/[^a-z0-9]+/g," ").trim(),hayW=hay.split(" "),hayZ=hay.replace(/ /g,"");
    let best=null,bs=0,tie=false;for(const x of sp){let sc=spScore(x.T,hay,hayW,hayZ);if(!sc)continue;if(Math.abs(num(x.s.bedrag)-b.bedrag)<0.01)sc+=3;
      if(sc>bs){best=x;bs=sc;tie=false}else if(sc===bs)tie=true}
    if(best&&!tie)add(best.s,b,"automatisch");else los.push(b)}
  return{per,los}}
function sponsorOntvangen(s,C){const k=(C._spk=C._spk||spKoppel(C)).per.get(s.id);return k?k.som:0}
VIEWS.sponsors=()=>({title:"Sponsors",sub:"Sponsorbeheer",actions:'<button class="btn" data-act="docRol" data-v="sponsordossier" title="Sponsordossier openen (uit Documenten)">'+ic("documenten")+'Sponsordossier</button><button class="btn primary" data-w data-act="nieuweSponsor">'+ic("plus")+'Nieuwe sponsor</button>',body(){
  const C=ctx();C._spk=spKoppel(C);const q=norm(UI.spQ);const ss=UI.spSort||{k:"bedrijf",d:1};
  const ont=x=>(x.naturaJaren||[]).includes(JAAR)?Math.max(sponsorOntvangen(x,C),num(x.bedrag))+0.001:sponsorOntvangen(x,C);
  let list=[...S.sponsors.values()].sort((a,b)=>(ss.k==="bedrag"?(num(a.bedrag)-num(b.bedrag)):ss.k==="ontv"?(ont(a)-ont(b)):0)*ss.d||(ss.k==="bedrijf"?ss.d:1)*spNaam(a).localeCompare(spNaam(b),"nl"));
  const sth=(k,l,cls="")=>`<th class="${cls} sortable${ss.k===k?" sorted":""}" data-act="spSort" data-v="${k}" aria-sort="${ss.k===k?(ss.d>0?"ascending":"descending"):"none"}">${l}<span class="arr">${ss.k===k?(ss.d>0?"▲":"▼"):""}</span></th>`;
  if(q)list=list.filter(s=>norm(Object.values(s).join(" ")).includes(q));
  const totaal=[...S.sponsors.values()].reduce((s,x)=>s+num(x.bedrag),0);const K=C._spk=spKoppel(C);const ontv=[...K.per.values()].reduce((a,x)=>a+x.som,0);const losT=K.los.reduce((a,b)=>a+b.bedrag,0);
  const open=[...S.sponsors.values()].filter(x=>!K.per.has(x.id)&&!(x.naturaJaren||[]).includes(JAAR));const openT=open.reduce((a,x)=>a+num(x.bedrag),0);
  return `<div class="tiles"><div class="tile"><span class="lbl">Sponsors</span><span class="val">${S.sponsors.size}</span></div><div class="tile"><span class="lbl">Afgesproken bedragen</span><span class="val">${eur(totaal)}</span></div><div class="tile"><span class="lbl">Ontvangen</span><span class="val in">${eur(ontv)}</span></div></div>
  <div class="bar"><div class="search">${ic("search")}<input id="spQ" data-live data-input="spQ" placeholder="Zoek sponsor" value="${esc(UI.spQ)}"></div></div>
  <div class="panel"><div class="mlist" role="list">${list.map(s=>{const o=sponsorOntvangen(s,C),nat=(s.naturaJaren||[]).includes(JAAR);const cp=[s.voornaam,s.naam].filter(Boolean).join(" ");
    return `<button type="button" class="ml-row" role="listitem" data-act="toonSponsor" data-id="${esc(s.id)}"><span class="ml-m"><span class="ml-n"><b>${esc(spNaam(s))}</b></span><span class="ml-s">${num(s.bedrag)?eur(num(s.bedrag)):"geen bedrag"}${cp?'<span class="ml-dot">·</span>'+esc(cp):""}</span></span>
      <span class="ml-r">${nat?'<span class="pill ok">✓ In natura</span>':o&&o>=num(s.bedrag)-0.01?'<span class="pill ok">✓ Betaald</span>':o?'<span class="pill warn">Deels</span>':'<span class="pill nok">Open</span>'}</span><span class="ml-chev" aria-hidden="true">›</span></button>`}).join("")||'<div class="empty">Geen sponsors.</div>'}</div>
  <div class="tw dsk-only"><table class="rcards"><thead><tr>${sth("bedrijf","Bedrijf")}<th>Contactpersoon</th><th>E-mail</th><th>Telefoon</th><th>KBO-nr.</th>${sth("bedrag","Bedrag","num")}${sth("ontv","Status")}</tr></thead><tbody>
  ${list.map(s=>{const o=sponsorOntvangen(s,C);return `<tr class="click" data-act="toonSponsor" data-id="${esc(s.id)}"><td><b>${esc(spNaam(s))}</b>${s.weergave&&s.bedrijf&&norm(s.weergave)!==norm(s.bedrijf)?`<div class="muted small">${esc(s.bedrijf)}</div>`:""}</td><td>${esc(s.voornaam)} ${esc(s.naam)}</td><td class="trunc">${esc(s.email)}</td><td style="white-space:nowrap">${esc(s.telefoon)}</td><td class="muted">${esc(s.kbo)}</td><td class="num">${eur(num(s.bedrag))}</td><td>${(s.naturaJaren||[]).includes(JAAR)?'<span class="pill ok" title="Voldaan in natura">✓ In natura</span>':o&&o>=num(s.bedrag)-0.01?'<span class="pill ok" title="Ontvangen: '+eur(o)+'">✓ Betaald</span>':o?'<span class="pill warn" title="Ontvangen: '+eur(o)+' van '+eur(num(s.bedrag))+'">Deels</span>':'<span class="pill nok">Open</span>'}</td></tr>`}).join("")||'<tr><td colspan="7" class="empty">Geen sponsors.</td></tr>'}
  </tbody></table></div></div>
  ${K.los.length?`<div class="panel"><div class="panel-h"><h2>Sponsorbetalingen zonder sponsor in de lijst</h2><span class="grow"></span><span class="muted small">${K.los.length} · ${eur(losT)}</span></div>
   <div class="panel-b" style="padding-bottom:0"><p class="muted small" style="margin:0">Transacties met categorie Sponsoring sinds 1 juni ${JAAR} die niet automatisch aan een sponsor gekoppeld konden worden. Wijs ze toe aan een sponsor, voeg de sponsor toe, of duid aan dat het geen sponsorbetaling is.</p></div>
   <div class="tw"><table class="rcards" data-main="1"><thead><tr><th>Datum</th><th>Van</th><th>Mededeling</th><th class="num">Bedrag</th><th></th></tr></thead><tbody>
   ${K.los.map(b=>`<tr><td class="nowrap">${fmtDate(b.datum)}</td><td><b>${esc(b.partij||"")}</b></td><td class="trunc">${esc(b.mededeling||"")}</td><td class="num in nowrap">${eur(b.bedrag)}</td>
    <td class="nowrap" style="text-align:right"><button class="btn sm" data-act="toonBoeking" data-id="${esc(b.id)}">Transactie</button>${canWrite?` <button class="btn sm primary" data-act="spToewijzen" data-id="${esc(b.id)}">Toewijzen</button> <button class="btn sm" data-act="spVanBoeking" data-id="${esc(b.id)}">${ic("plus")}Sponsor</button>`:""}</td></tr>`).join("")}</tbody></table></div></div>`:""}`}});

/* ---------- banket ---------- */
const BK_PUBLIEK="/banket";
const BK_FORM="https://docs.google.com/forms/d/1L-eZqLg67w6InWQzEeV6x0EhRRF8_Ro-pPCKOS8CTyo/edit#responses";
const bkCfg=()=>Object.assign({prijs:65,deadline:"1 december",datum:JAAR+"-12-12",uur:"19u00",locatie:"Feestzaal De Snip, Beugemstraat 9, Moorsel"},S.config.get("banket")||{});
const bkMenu=m=>norm(m).includes("veg")?"Vegetarisch":"Normaal";
const bkDue=r=>r2((r.personen===2?2:1)*num(bkCfg().prijs));
const bkToks=s=>norm(s).split(/[^a-z0-9]+/).filter(t=>t.length>=3);
function bkLijst(){return [...S.banket.values()].filter(r=>Number(r.jaar)===JAAR)}
function bkBetaling(r,C){
  const due=bkDue(r);
  if(r.betaald==="OK")return{ok:true,bedrag:due,bron:"Manueel op betaald gezet"};
  if(r.betaald==="NOK")return{ok:false,bedrag:0,bron:"Manueel op niet betaald gezet"};
  if(r.betaling&&r.betaling.status==="SUCCEEDED")return{ok:true,bedrag:due,bron:"Online betaald met Bancontact"+(r.betaling.betaaldOp?" op "+fmtDate(String(r.betaling.betaaldOp).slice(0,10)):"")};
  const t=bkToks(r.naam);if(!t.length)return{ok:false,bedrag:0,bron:""};
  const L=C.boek.filter(b=>b.richting!=="uit"&&(b.categorie==="Banket"||b._m.includes("banket"))&&t.every(x=>(b._m+" "+b._p).includes(x)));
  const s=r2(L.reduce((a,b)=>a+b.bedrag,0));
  return{ok:s>0&&s>=due-0.01,deel:s>0&&s<due-0.01,bedrag:s,boekingen:L,bron:L.length?"Betaling "+L.map(b=>fmtDate(b.datum)).join(", "):""};
}
function bkLid(r){const t=bkToks(r.naam);if(!t.length)return null;
  return [...S.leden.values()].find(l=>{const n=bkToks(naamVol(l));return n.length&&n.every(x=>t.includes(x))})||null}
function bkEpc(naam,bedrag){const c=cfg();const iban=(c.rekeningnummer||"BE43 9730 6810 0401").replace(/\s/g,"").toUpperCase();
  const med=String(naam||"").normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^A-Za-z0-9 .,'\-\/]/g," ").replace(/\s+/g," ").trim()+" Banket "+JAAR;
  const txt=["BCD","002","1","SCT","",(c.vereniging||"Vriendenkring Brandweer Hoofdpost Aalst").slice(0,70),iban,"EUR"+Number(bedrag).toFixed(2),"","",med.slice(0,140),""].join("\n");
  let svg="";if(window.qrcode){const q=qrcode(0,"M");q.addData(txt);q.make();svg=q.createSvgTag({cellSize:4,margin:2,scalable:true})}
  return{iban,med,svg}}
function bkRows(){const C=ctx();return bkLijst().map(r=>({r,p:bkBetaling(r,C),due:bkDue(r),lid:bkLid(r)}))
  .sort((a,b)=>(a.r.naam||"").localeCompare(b.r.naam||"","nl"))}
function bkTable(){
  const q=norm(UI.bkQ||""),F=UI.bkF||"alle";
  let R=bkRows();if(q)R=R.filter(x=>norm([x.r.naam,x.r.opmerking,x.r.menu1,x.r.menu2].join(" ")).includes(q));
  if(F==="open")R=R.filter(x=>!x.p.ok);else if(F==="ok")R=R.filter(x=>x.p.ok);else if(F==="veg")R=R.filter(x=>x.r.menu1==="Vegetarisch"||(x.r.personen===2&&x.r.menu2==="Vegetarisch"));
  const pers=R.reduce((s,x)=>s+(x.r.personen===2?2:1),0);
  return `<div class="tw"><table class="rcards"><thead><tr><th>Naam</th><th>Formule</th><th>Menu</th><th>Opmerking</th><th class="num">Bedrag</th><th>Betaling</th><th>Ingeschreven</th></tr></thead><tbody>
  ${R.map(x=>{const r=x.r;const menu=r.personen===2?esc(r.menu1)+" + "+esc(r.menu2||"?"):esc(r.menu1);
    const pill=x.p.ok?`<span class="pill ok" title="${esc(x.p.bron)}">Betaald</span>`:x.p.deel?`<span class="pill warn" title="${esc(x.p.bron)}">Deels: ${eur(x.p.bedrag)}</span>`:`<span class="pill nok">Open</span>`;
    return `<tr class="click" data-act="bkToon" data-id="${esc(r.id)}"><td><b>${esc(r.naam)}</b>${x.lid?"":'<div class="small muted">niet gevonden in ledenlijst</div>'}</td><td class="nowrap">${r.personen===2?"Met partner":"Alleen"}</td><td>${menu}</td><td class="trunc">${esc(r.opmerking||"")}</td><td class="num">${eur(x.due)}</td><td>${pill}</td><td class="muted nowrap">${esc(r.ingediend||"")}</td></tr>`}).join("")||'<tr><td colspan="7" class="empty">Nog geen inschrijvingen'+(q||F!=="alle"?" voor deze filter":"")+'.</td></tr>'}
  </tbody>${R.length?`<tfoot><tr><td>${R.length} inschrijvingen</td><td>${pers} personen</td><td></td><td></td><td class="num">${eur(R.reduce((s,x)=>s+x.due,0))}</td><td></td><td></td></tr></tfoot>`:""}</table></div>`}
VIEWS.banket=()=>({title:"Banket "+JAAR,sub:"Inschrijvingen en betalingen",
  actions:`<a class="btn" href="${BK_PUBLIEK}" target="_blank" rel="noopener" title="Openbare inschrijfpagina, om te delen met de leden (${esc(insStatus(bkCfg(),JAAR+"-12-01").label)})">${ic("deel")}Inschrijfpagina${insPill(insStatus(bkCfg(),JAAR+"-12-01"))}</a><button class="btn primary" data-w data-act="bkNieuw">${ic("plus")}Nieuwe inschrijving</button><button class="btn iconbtn" data-act="bkInst" aria-label="Instellingen banket" title="Instellingen banket">${ic("instellingen")}</button>`,
  body(){
  const R=bkRows(),bc=bkCfg();const pers=R.reduce((s,x)=>s+(x.r.personen===2?2:1),0);
  let norm_=0,veg=0;for(const {r} of R){(r.menu1==="Vegetarisch"?veg++:norm_++);if(r.personen===2)(r.menu2==="Vegetarisch"?veg++:norm_++)}
  const due=R.reduce((s,x)=>s+x.due,0),paid=R.reduce((s,x)=>s+Math.min(x.p.bedrag||0,x.due),0),open=R.filter(x=>!x.p.ok).length;
  const ontv=ctx().boek.filter(b=>b.categorie==="Banket"&&b.richting!=="uit").reduce((s,b)=>s+b.bedrag,0);
  const F=UI.bkF||"alle";
  return `<div class="tiles"><div class="tile hero"><span class="lbl">Personen</span><span class="val">${pers}</span><span class="hint">${R.length} inschrijvingen</span></div>
   <div class="tile"><span class="lbl">Menu's</span><span class="val">${norm_} <small style="font-size:14px;color:var(--muted);font-weight:500">normaal</small> · ${veg} <small style="font-size:14px;color:var(--muted);font-weight:500">veggie</small></span></div>
   <div class="tile"><span class="lbl">Te ontvangen</span><span class="val">${eur(due)}</span><span class="hint">${eur(bc.prijs)} per persoon</span></div>
   <div class="tile"><span class="lbl">Betaald</span><span class="val in">${eur(paid)}</span><span class="hint">${open?open+" nog open":"alles ontvangen"}</span></div></div>
  
  <div class="bar"><div class="search">${ic("search")}<input id="bkQ" data-live data-input="bkQ" placeholder="Zoek op naam of opmerking" value="${esc(UI.bkQ||"")}"></div>
   <div class="seg">${[["alle","Alle"],["open","Open"],["ok","Betaald"],["veg","Vegetarisch"]].map(([v,l])=>`<button type="button" data-act="bkF" data-v="${v}" class="${F===v?"on":""}">${l}</button>`).join("")}</div></div>
  <div class="panel" id="bkList">${bkTable()}</div>`}});
const INS_MAAND=["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"];
const insTot=(c,def)=>/^\d{4}-\d{2}-\d{2}$/.test(String(c.inschrijvenTot||""))?c.inschrijvenTot:def;
const insTekst=iso=>{const [y,m,d]=iso.split("-").map(Number);return d+" "+INS_MAAND[m-1]};
function insStatus(c,def){const tot=insTot(c,def);const open=c.open!==false&&todayISO()<=tot;return{open,tot,label:open?"open t.e.m. "+insTekst(tot):c.open===false?"gesloten":"afgesloten sinds "+insTekst(tot)}}
const insPill=st=>`<span class="ins-st ${st.open?"ok":"nok"}" title="Inschrijvingen ${st.label}"></span>`;
function insVelden(c,def,d){const st=insStatus(c,def);return `${fld("insTot","Inschrijven tot en met",`<input id="insTot" type="date" value="${esc(insTot(c,def))}"${d}>`)}
  <div class="fld"><span class="lbl">Inschrijvingen</span><label class="sp-nat" style="padding:9px 12px"><input type="checkbox" id="insOpen"${c.open!==false?" checked":""}${d}><span><b>Open</b><small>${st.open?"Nu open":"Nu gesloten"}${c.open!==false&&!st.open?" (datum voorbij)":""}</small></span></label></div>`}
const insLees=()=>({inschrijvenTot:$("#insTot").value,open:$("#insOpen").checked});
function bkInst(){const bc=bkCfg(),d=canWrite?"":" disabled";const ontv=ctx().boek.filter(b=>b.categorie==="Banket"&&b.richting!=="uit").reduce((s,b)=>s+b.bedrag,0);
  modal("Instellingen banket",`<form id="fBkI2" class="form">${fld("bkP","Prijs per persoon (€)",inp("bkP",bc.prijs,'inputmode="decimal"'+d))}${fld("bkDt","Datum banket",`<input id="bkDt" type="date" value="${esc(bc.datum||"")}"${d}>`)}
   ${insVelden(bc,JAAR+"-12-01",d)}<p class="pi-note full" style="margin:0">Ontvangen met categorie Banket in ${JAAR}: <b>${eur(ontv)}</b></p></form>`,
   `<button class="btn" data-act="closeModal">${canWrite?"Annuleren":"Sluiten"}</button>${canWrite?'<button class="btn primary" id="bkIOk">Bewaren</button>':""}`);
  const ok=$("#bkIOk");if(!ok)return;
  ok.onclick=async()=>{const ins=insLees();const r={prijs:num($("#bkP").value)||65,deadline:/^\d{4}-\d{2}-\d{2}$/.test(ins.inschrijvenTot)?insTekst(ins.inschrijvenTot):bc.deadline,datum:$("#bkDt").value};closeModal();
    await write("config","banket",{...stripId(S.config.get("banket")||{}),prijs:r.prijs,deadline:r.deadline,open:ins.open,...(/^\d{4}-\d{2}-\d{2}$/.test(ins.inschrijvenTot)?{inschrijvenTot:ins.inschrijvenTot}:{}),...(/^\d{4}-\d{2}-\d{2}$/.test(r.datum)?{datum:r.datum}:{})});toast("Instellingen banket bewaard.")}}
function bkForm(r,id){
  const p=id?bkBetaling(r,ctx()):null;const due=bkDue(r);const E=id?bkEpc(r.naam,due):null;
  modal(id?r.naam:"Nieuwe inschrijving",`<form id="fBkI" class="form">
   ${fld("biN","Naam en voornaam *",inp("biN",r.naam,'name="naam"'),"full")}
   ${fld("biP","Formule",`<select id="biP" name="personen">${selOpts([["1","Alleen (1 persoon)"],["2","Met partner (2 personen)"]],r.personen===2?"2":"1")}</select>`)}
   ${fld("biB","Betaling",`<select id="biB" name="betaald">${selOpts([["","Automatisch uit transacties"],["OK","Betaald (manueel)"],["NOK","Niet betaald (manueel)"]],r.betaald||"")}</select>`)}
   ${fld("biM1","Menu lid",`<select id="biM1" name="menu1">${selOpts(["Normaal","Vegetarisch"],r.menu1||"Normaal")}</select>`)}
   ${fld("biM2","Menu partner",`<select id="biM2" name="menu2">${selOpts([["","—"],"Normaal","Vegetarisch"],r.menu2||"")}</select>`)}
   ${fld("biO","Allergieën / opmerkingen",`<textarea id="biO" name="opmerking" style="min-height:80px">${esc(r.opmerking||"")}</textarea>`,"full")}<div class="err full" id="biErr"></div></form>
   ${id?`<div class="note info" style="display:grid;grid-template-columns:${E.svg?"130px ":""}minmax(0,1fr);gap:14px;align-items:center">${E.svg?`<div style="background:#fff;border-radius:6px;padding:4px">${E.svg}</div>`:""}<div><b>${eur(due)}</b> op ${esc(E.iban.replace(/(.{4})/g,"$1 ").trim())}<br>Mededeling: <b>${esc(E.med)}</b><br><span class="muted small">${p.ok?"Betaald — "+esc(p.bron):p.deel?"Deels betaald ("+eur(p.bedrag)+")":"Nog geen betaling gevonden."}</span></div></div>`:""}`,
   `${id?'<button class="btn ghost danger" data-w id="biDel">Verwijderen</button><span class="grow"></span>':""}<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" data-w id="biOk">Bewaren</button>`);
  if(!canWrite)$$("#fBkI input,#fBkI select,#fBkI textarea").forEach(i=>i.disabled=true);
  $("#biOk").onclick=async()=>{const f=formData($("#fBkI"));if(!f.naam.trim()){$("#biErr").textContent="Vul een naam in.";return}
    const pers=f.personen==="2"?2:1;
    const d={...(id?stripId(r):{jaar:JAAR,bron:"manueel",ingediend:fmtDate(todayISO())}),naam:f.naam.trim(),personen:pers,menu1:f.menu1,menu2:pers===2?(f.menu2||"Normaal"):"",opmerking:f.opmerking.trim(),betaald:f.betaald||null};
    closeModal();await write("banket",id||newId("banket"),d);toast("Inschrijving bewaard.")};
  if(id)$("#biDel").onclick=()=>confirmBox("Inschrijving van <b>"+esc(r.naam)+"</b> verwijderen?","Verwijderen",async()=>{await write("banket",id,null,{del:true});toast("Inschrijving verwijderd.")});
}
function bkImportDialog(){
  modal("Antwoorden importeren",`<p style="margin:0">Open het <a href="${BK_FORM}" target="_blank" rel="noopener">Google-formulier</a>, ga naar <b>Antwoorden</b> › <b>⋮</b> › <b>Antwoorden downloaden (.csv)</b> en kies hier het gedownloade bestand (.zip of .csv). Inschrijvingen die al in de lijst staan, worden overgeslagen.</p>
   <label class="btn primary" for="bkFile" style="align-self:flex-start;cursor:pointer">${ic("upload")}Bestand kiezen</label><input type="file" id="bkFile" accept=".zip,.csv,.xlsx" hidden><div id="bkArea"></div>`,"");
}
async function bkRead(file){
  const area=$("#bkArea");area.innerHTML='<div class="note info">Bestand lezen…</div>';
  let rows;try{let wb;
    if(/\.zip$/i.test(file.name)){const z=await JSZip.loadAsync(await file.arrayBuffer());const f=Object.values(z.files).find(x=>/\.csv$/i.test(x.name));if(!f)throw new Error("Geen .csv gevonden in het zip-bestand.");wb=XLSX.read(await f.async("string"),{type:"string",raw:true})}
    else if(/\.csv$/i.test(file.name))wb=XLSX.read(await file.text(),{type:"string",raw:true});
    else wb=XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:"array"});
    rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:false,defval:""})}
  catch(e){area.innerHTML='<div class="err">'+esc(e.message||"Het bestand kon niet gelezen worden.")+'</div>';return}
  const H=(rows[0]||[]).map(norm);const col=f=>H.findIndex(f);
  const cT=col(h=>h.includes("tijdstempel")||h.includes("timestamp")),cN=col(h=>h.includes("naam")),cA=col(h=>h.includes("aanwezig")),
    cM1=col(h=>h.includes("menu")&&h.includes("jezelf")),cM2=col(h=>h.includes("menu")&&h.includes("partner")),cO=col(h=>h.includes("allergie")||h.includes("opmerk"));
  if(cN<0||cA<0){area.innerHTML='<div class="err">Dit lijkt geen export van het bankformulier: de kolommen "Naam lid" en "Aanwezigheid" ontbreken.</div>';return}
  const items=[];for(const r of rows.slice(1)){const naam=String(r[cN]||"").trim();if(!naam)continue;
    const ts=cT>=0?String(r[cT]||"").trim():"";const pers=norm(r[cA]).includes("met partner")?2:1;
    items.push({id:"gf-"+slug(ts+"-"+naam),d:{jaar:JAAR,bron:"formulier",ingediend:ts,naam,personen:pers,menu1:bkMenu(cM1>=0?r[cM1]:""),menu2:pers===2?bkMenu(cM2>=0?r[cM2]:""):"",opmerking:cO>=0?String(r[cO]||"").trim():""}})}
  const nieuw=items.filter(x=>!S.banket.has(x.id));
  area.innerHTML=`<div class="note info"><b>${items.length}</b> antwoorden gelezen: <b>${nieuw.length}</b> nieuw, ${items.length-nieuw.length} stonden er al. Ze komen bij het banket van <b>${JAAR}</b>.</div>
   <div class="bar" style="justify-content:flex-end"><span id="bkProg" class="muted"></span><button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="bkGo"${nieuw.length?"":" disabled"}>Importeren</button></div>`;
  $("#bkGo").onclick=async()=>{try{await writeMany(nieuw.map(x=>["banket",x.id,x.d]),n=>{const p=$("#bkProg");if(p)p.textContent="Bezig: "+n+" / "+nieuw.length})}catch(e){handleWriteError(e);return}
    closeModal();toast(nieuw.length+" inschrijvingen geïmporteerd.")};
}
function bkSheet(){return bkRows().map(x=>({Naam:x.r.naam,Formule:x.r.personen===2?"Met partner":"Alleen",Personen:x.r.personen===2?2:1,"Menu lid":x.r.menu1,"Menu partner":x.r.personen===2?x.r.menu2:"",Opmerking:x.r.opmerking||"",Bedrag:x.due,Betaald:x.p.ok?"Ja":x.p.deel?"Deels ("+x.p.bedrag+")":"Nee",Ingeschreven:x.r.ingediend||""}))}
function bkExport(){const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(bkSheet()),"Banket "+JAAR);save("VBHA_Banket_"+JAAR+".xlsx",XLSX.write(wb,{type:"array",bookType:"xlsx"}))}

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
VIEWS.historiek=()=>({title:"Historiek",sub:"Boekhouding over alle jaren",actions:'<button class="btn" data-act="exportHist">'+ic("download")+'Exporteren</button>',body(){
  const L=alleJaren();if(!L.length)return '<div class="panel"><div class="empty">Nog geen boekjaren.</div></div>';
  const sel=L.find(j=>j.jaar===UI.histJaar)||L[L.length-1];
  const tot=L.reduce((s,j)=>s+j.rows.length,0);
  return boekTabs("historiek")+`<div class="bar"><div class="search">${ic("search")}<input id="histQ" data-live data-input="histQ" placeholder="Zoek in alle jaren, bv. een naam, banket of een leverancier" value="${esc(UI.histQ)}"></div></div>
  <div class="panel"><div class="panel-h"><h2>Saldo op 31 december</h2><span class="grow"></span><span style="font-size:13px;color:var(--muted)">${L[0].jaar}–${L[L.length-1].jaar} · ${tot.toLocaleString("nl-BE")} transacties</span></div><div class="panel-b">${histChart(L)}</div></div>
  <div class="panel"><div class="panel-h"><h2>Overzicht per jaar</h2></div><div class="tw"><table class="rcards"><thead><tr><th>Jaar</th><th class="num">Begin totaal</th><th class="num">Inkomsten</th><th class="num">Uitgaven</th><th class="num">Resultaat</th><th class="num">Eind kas</th><th class="num">Eind rekening</th><th class="num">Eind totaal</th><th class="num">Transacties</th></tr></thead><tbody>
  ${L.slice().reverse().map(j=>{const res=j.tin-j.tuit;return `<tr class="click" data-act="histJaar" data-v="${j.jaar}"${j.jaar===sel.jaar?' style="outline:2px solid var(--accent);outline-offset:-2px"':""}><td style="white-space:nowrap"><b>${j.jaar}</b></td><td class="num">${eur(j.beginKas+j.beginRekening)}</td><td class="num in">${eur(j.tin)}</td><td class="num out">${eur(j.tuit)}</td><td class="num ${res>=0?"in":"out"}"><b>${res>=0?"+":"−"}${eur(Math.abs(res))}</b></td><td class="num">${eur(j.eindKas)}</td><td class="num">${eur(j.eindRek)}</td><td class="num"><b>${eur(j.eindKas+j.eindRek)}</b></td><td class="num">${j.rows.length}</td>
</tr>`}).join("")}
  </tbody></table></div></div>
  <div id="histList">${histDetail(L,sel)}</div>`}});
function histDetail(L,sel){
  const q=norm(UI.histQ);
  if(q){const hits=[];for(const j of L)for(const b of j.rows)if(norm(b.mededeling+" "+b.partij+" "+b.categorie).includes(q))hits.push(b);
    const tin=hits.reduce((s,b)=>s+(b.richting!=="uit"?b.bedrag:0),0),tuit=hits.reduce((s,b)=>s+(b.richting==="uit"?b.bedrag:0),0);
    return `<div class="panel"><div class="panel-h"><h2>Zoekresultaat</h2><span class="grow"></span><span style="font-size:13px;color:var(--muted)">${hits.length} transacties · in ${eur(tin)} · uit ${eur(tuit)}</span></div>${histRows(hits.slice().reverse().slice(0,500),true)}${hits.length>500?'<div class="empty">Eerste 500 getoond. Verfijn je zoekopdracht.</div>':""}</div>`}
  const cats=Object.entries(sel.perCat).sort((a,b)=>Math.abs(b[1].in-b[1].uit)-Math.abs(a[1].in-a[1].uit));const max=Math.max(1,...cats.map(([,v])=>Math.max(v.in,v.uit)));
  const sg=v=>(v>=0?"+":"−")+eur(Math.abs(v)),res=sel.tin-sel.tuit;
  return `<div class="grid g2 hgrid"><div class="panel"><div class="panel-h"><h2>Categorieën ${sel.jaar}</h2><span class="grow"></span><span class="hleg"><i class="o"></i>uit<i class="g"></i>in</span></div><div class="panel-b hcats">
    ${cats.map(([k,v])=>`<div class="hcat" title="${esc(k)}: in ${eur(v.in)}, uit ${eur(v.uit)}"><span class="hcat-n">${esc(k)}</span><div class="hcat-b"><span class="l"><i style="width:${(v.uit/max*100).toFixed(1)}%"></i></span><span class="r"><i style="width:${(v.in/max*100).toFixed(1)}%"></i></span></div><b class="hcat-v ${v.in-v.uit>=0?"in":"out"}">${sg(v.in-v.uit)}</b></div>`).join("")||'<div class="empty">Geen transacties.</div>'}</div></div>
  <div class="panel"><div class="panel-h"><h2>Kerncijfers ${sel.jaar}</h2>${sel.jaar===JAAR?`<span class="grow"></span><button class="btn sm" data-act="naarBoekjaar" data-v="${sel.jaar}">Open in Boekhouding</button>`:""}</div><div class="panel-b">
    <div class="hkc"><div><span>Inkomsten</span><b class="in">${eur(sel.tin)}</b></div><div><span>Uitgaven</span><b class="out">${eur(sel.tuit)}</b></div><div><span>Resultaat</span><b class="${res>=0?"in":"out"}">${sg(res)}</b></div></div>
    <table class="hsal"><thead><tr><th></th><th>Kas</th><th>Rekening</th><th>Totaal</th></tr></thead><tbody>
    <tr><th>Begin</th><td>${eur(sel.beginKas)}</td><td>${eur(sel.beginRekening)}</td><td>${eur(sel.beginKas+sel.beginRekening)}</td></tr>
    <tr><th>Einde</th><td>${eur(sel.eindKas)}</td><td>${eur(sel.eindRek)}</td><td><b>${eur(sel.eindKas+sel.eindRek)}</b></td></tr></tbody></table></div></div></div>
  <div class="panel"><div class="panel-h"><h2>Transacties ${sel.jaar}</h2><span class="grow"></span><span style="font-size:13px;color:var(--muted)">${sel.rows.length} transacties</span></div>${histRows(sel.rows.slice().reverse(),false)}</div>`;
}
function histRows(rows,metJaar){
  const P=rows.some(b=>String(b.partij||"").trim());
  const cols=[["Nr","num","58px"],...(metJaar?[["Jaar","","58px"]]:[]),["Datum","","96px"],["Categorie","","18%"],["Mededeling","",""],...(P?[["Betaald aan / ontvangen van","","16%"]]:[]),["Rek./kas","","86px"],["In","num","104px"],["Uit","num","104px"],...(metJaar?[]:[["Saldo kas","num","112px"],["Saldo rekening","num","124px"]])];
  return `<div class="tw htw"><table class="rcards htab" data-main="${metJaar?4:3}"><colgroup>${cols.map(c=>`<col${c[2]?` style="width:${c[2]}"`:""}>`).join("")}</colgroup><thead><tr>${cols.map(c=>`<th${c[1]?` class="${c[1]}"`:""}>${c[0]}</th>`).join("")}</tr></thead><tbody>
  ${rows.map(b=>`<tr><td class="num muted">${b.nr??""}</td>${metJaar?`<td>${esc(String(b.datum||"").slice(0,4))}</td>`:""}<td class="nowrap">${fmtDate(b.datum)}</td><td class="ell" title="${esc(b.categorie)}">${esc(b.categorie)}</td><td class="ell" title="${esc(b.mededeling)}">${esc(b.mededeling)}</td>${P?`<td class="ell" title="${esc(b.partij||"")}">${esc(b.partij||"")}</td>`:""}<td>${esc(b.rekening)}</td>
  <td class="num in nowrap">${b.richting!=="uit"?eur(b.bedrag):""}</td><td class="num out nowrap">${b.richting==="uit"?eur(b.bedrag):""}</td>${metJaar?"":`<td class="num nowrap${b.rekening==="Kas"?" hsel":" muted"}">${eur(b._kas)}</td><td class="num nowrap${b.rekening!=="Kas"?" hsel":" muted"}">${eur(b._rek)}</td>`}</tr>`).join("")||`<tr><td colspan="${cols.length}" class="empty">Geen transacties gevonden.</td></tr>`}</tbody></table></div>`;
}
function histChart(L){
  const W=900,H=230,P=46,B=26,n=L.length;const vals=L.map(j=>j.eindKas+j.eindRek);const hi=Math.max(1,...vals)*1.12;
  const step=(W-P-10)/n,bw=Math.min(46,step*.62),y=v=>12+(hi-v)/hi*(H-B-12);
  const ticks=[0,hi/2/1.12,hi/1.12].map(v=>Math.round(v/1000)*1000);
  const k1=v=>(Math.round(v/100)/10).toLocaleString("nl-BE")+"k";
  return `<div class="tw"><svg viewBox="0 0 ${W} ${H}" style="width:100%;min-width:560px;height:auto;display:block" role="img" aria-label="Saldo op 31 december per jaar, kas en rekening">
  ${ticks.map(v=>`<line x1="${P}" x2="${W-6}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${P-6}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="var(--muted)">${Math.round(v/1000)}k</text>`).join("")}
  ${L.map((j,i)=>{const x=P+i*step+(step-bw)/2,v=vals[i],k=Math.max(0,j.eindKas),r=Math.max(0,j.eindRek);const on=j.jaar===UI.histJaar||(!UI.histJaar&&i===n-1);const o=on?1:.5;
    return `<g data-act="histJaar" data-v="${j.jaar}" style="cursor:pointer"><title>${j.jaar}: kas ${eur(j.eindKas)}, rekening ${eur(j.eindRek)}, totaal ${eur(v)}</title>
    <rect x="${x}" y="${y(k)}" width="${bw}" height="${Math.max(0,y(0)-y(k))}" fill="var(--hk-kas)" fill-opacity="${o}"/>
    <rect x="${x}" y="${y(k+r)}" width="${bw}" height="${Math.max(1,y(k)-y(k+r))}" fill="var(--accent)" fill-opacity="${o}"/>
    <text x="${x+bw/2}" y="${H-8}" text-anchor="middle" font-size="11.5" fill="${on?"var(--ink)":"var(--muted)"}" font-weight="${on?700:400}">${j.jaar}</text>
    <text x="${x+bw/2}" y="${y(v)-6}" text-anchor="middle" font-size="10.5" fill="var(--ink)" font-weight="${on?700:400}">${k1(v)}</text></g>`}).join("")}
  </svg></div><div class="hk-leg"><span><i style="background:var(--accent)"></i>Rekening</span><span><i style="background:var(--hk-kas)"></i>Kas</span><span class="muted">Het getal boven elke staaf is het totaal. Klik op een jaar voor de details.</span></div>`;
}
function exportHist(){
  const L=alleJaren(),wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(L.map(j=>({Jaar:j.jaar,"Begin kas":j.beginKas,"Begin rekening":j.beginRekening,Inkomsten:j.tin,Uitgaven:j.tuit,Resultaat:r2(j.tin-j.tuit),"Eind kas":j.eindKas,"Eind rekening":j.eindRek,"Eind totaal":r2(j.eindKas+j.eindRek),Transacties:j.rows.length}))),"Overzicht");
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
    ${K.length?`<div class="list">${rows}</div><p class="muted small" style="margin:0">Nieuwe verrichtingen worden automatisch opgehaald om 9u, 13u en 17u en lopen langs de regels. Wat geen regel heeft, komt bij Te verwerken. De bank vraagt periodiek om de toestemming te vernieuwen: koppel dan opnieuw.</p>`:
    `<p style="margin:0">Koppel de rekening van de vriendenkring. Je wordt doorgestuurd naar je bank om toestemming te geven. Daarna haalt de app om 9u, 13u en 17u de nieuwe verrichtingen op.</p>`}
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
function bankOntkoppel(id){confirmBox("De koppeling met de bank verwijderen? De transacties die al opgehaald zijn, blijven staan.","Ontkoppelen",async()=>{try{await api("/api/bank/unlink",{method:"POST",body:JSON.stringify({id})});toast("Koppeling verwijderd.");await loadBank(true)}catch(e){toast(e.message,true)}})}

/* ---------- mails ---------- */
function _oud_groepen(){
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
function _oud_vul(t,r){
  const c=cfg();
  let s=String(t||"");
  s=s.split("Beste xnaamx,").join("Beste "+r.voornaam+",").split(/xnaamx xvoornaamx lidgeld \d{4}/).join(r.mededeling).split("xx euro").join(r.bedrag+" euro").split("xnaamx").join(r.voornaam||"");
  const map={voornaam:r.voornaam||"",naam:r.naam||"",bedrag:String(r.bedrag??""),jaar:String(JAAR),mededeling:r.mededeling||"",bedrijf:r.bedrijf||"",rekeningnummer:c.rekeningnummer||"[rekeningnummer]",vereniging:c.vereniging||""};
  return s.replace(/\{(\w+)\}/g,(m,k)=>k in map?map[k]:m);
}
const textToHtml=t=>'<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#111">'+String(t).split(/\n{2,}/).map(p=>"<p>"+esc(p).replace(/\n/g,"<br>")+"</p>").join("")+"</div>";
const htmlToText=h=>{const d=new DOMParser().parseFromString(h,"text/html");d.querySelectorAll("br").forEach(b=>b.replaceWith("\n"));d.querySelectorAll("p,div,tr,h1,h2,h3,li").forEach(p=>p.append("\n"));return (d.body.textContent||"").replace(/\n{3,}/g,"\n\n").trim()};
let MAIL=null;
function _oud_mailState(){
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
    ${MAILSMTP===null?(mailSmtpLaad(),'<div class="muted small">Verzendinstellingen laden…</div>'):MAILSMTP.ingesteld?`<button class="btn primary" data-w data-act="mailSend"${met.length?"":" disabled"}>${ic("mails")}${met.length} ${met.length===1?"mail":"mails"} versturen</button>
    <button class="btn" data-w data-act="mailTest"${met.length?"":" disabled"}>Testmail naar mezelf (${esc(ME?ME.email:"")})</button>
    <div style="font-size:13.5px;color:var(--muted)">Elke ontvanger krijgt een eigen mail met de juiste naam en het juiste bedrag, verstuurd vanaf <b>${esc(MAILSMTP.van.email)}</b>.</div><div id="mailProg"></div>`:`<div class="note">Rechtstreeks versturen is nog niet ingesteld. Vul in Vercel <span class="kbd">SMTP_HOST</span>, <span class="kbd">SMTP_PORT</span>, <span class="kbd">SMTP_USER</span> en <span class="kbd">SMTP_PASS</span> in.</div>`}
    <details><summary style="cursor:pointer;font-weight:600">Andere manieren</summary><div style="display:flex;flex-direction:column;gap:10px;margin-top:10px">
    <button class="btn" data-act="mailZip"${met.length?"":" disabled"}>${ic("download")}${met.length} mails downloaden als concepten (.zip)</button>
    <div style="font-size:13.5px;color:var(--muted)">Pak het zip-bestand uit en dubbelklik een mail: ze opent in Outlook als klaar-te-versturen concept, met de juiste naam en het juiste bedrag.</div>
    <button class="btn" data-act="mailCopy"${met.length?"":" disabled"}>${ic("copy")}Alle adressen kopiëren (voor BCC)</button>
    <div style="font-size:13.5px;color:var(--muted)">Voor één algemene mail: plak de adressen in het BCC-veld. Velden zoals {voornaam} worden dan niet ingevuld.</div>
    <details><summary style="cursor:pointer;font-weight:600">Eén voor één openen in je mailprogramma</summary><div class="list" style="margin-top:6px;max-height:320px;overflow:auto">
      ${met.map((r,i)=>`<div class="li"><span class="grow trunc">${esc(r.label)} <span style="color:var(--muted)">${esc(r.email)}</span></span><a class="btn sm" href="${esc(mailto(r,M))}" target="_blank" rel="noopener">Open</a></div>`).join("")}
    </div></details></div></details>
  </div></div></div></div>`},});
VIEWS.mails.after=()=>{mailPreview()};
let MAILSMTP=null,MAILBUSY=false;
async function mailSmtpLaad(){try{MAILSMTP=await api("/api/mail")}catch(e){MAILSMTP={ingesteld:false,van:{}}}if(route()==="mails")render(true)}
function _oud_mailBericht(r,M,aan){return{aan:aan||r.email,aanNaam:r.label||"",onderwerp:vul(M.onderwerp,r),html:mailHtml(r,M)}}
async function _oud_mailVerstuur(lijst,label){if(MAILBUSY)return;MAILBUSY=true;const prog=()=>$("#mailProg");let ok=0;const fout=[];
  try{for(let i=0;i<lijst.length;i+=10){const deel=lijst.slice(i,i+10);const p=prog();if(p)p.innerHTML=`<div class="note info">Bezig met versturen: ${i} van ${lijst.length}…</div>`;
      try{const j=await api("/api/mail",{method:"POST",body:JSON.stringify({berichten:deel})});for(const x of j.resultaten||[])x.ok?ok++:fout.push(x.aan+" ("+(x.fout||"mislukt")+")")}
      catch(e){deel.forEach(m=>fout.push(m.aan+" ("+e.message+")"))}}}
  finally{MAILBUSY=false}
  const p=prog();if(p)p.innerHTML=`<div class="note ${fout.length?"":"info"}"><b>${ok}</b> ${ok===1?"mail":"mails"} verstuurd${label?" ("+esc(label)+")":""}.${fout.length?`<br>Niet gelukt (${fout.length}): ${fout.map(esc).join(", ")}`:""}</div>`;
  toast(fout.length?ok+" verstuurd, "+fout.length+" niet gelukt.":ok+" "+(ok===1?"mail":"mails")+" verstuurd.",!!fout.length)}
function _oud_mailRecips(){const G=groepen();const g=G.find(x=>x.id===UI.mailGroep)||G[0];return g.list.filter(r=>r.email)}
function _oud_mailHtml(r,M){return M.isHtml?vul(M.body,r):textToHtml(vul(M.body,r))}
function mailto(r,M){const text=M.isHtml?htmlToText(vul(M.body,r)):vul(M.body,r);let u="mailto:"+encodeURIComponent(r.email)+"?subject="+encodeURIComponent(vul(M.onderwerp,r))+"&body="+encodeURIComponent(text);return u.length>1900?"mailto:"+encodeURIComponent(r.email)+"?subject="+encodeURIComponent(vul(M.onderwerp,r)):u}
function _oud_mailPreview(){
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

VIEWS.logboek=()=>({title:"Logboek",actions:LOG_CLIENT?"":'<button class="btn" data-act="logVernieuw">Vernieuwen</button>',body(){logStart();
  if(!LOGS.loaded)return instTabs("logboek")+'<div class="panel"><div class="empty">Logboek laden…</div></div>';
  if(LOGS.err)return instTabs("logboek")+`<div class="note">Het logboek kon niet geladen worden${typeof LOGS.err==="string"?": "+esc(LOGS.err):""}.${LOG_CLIENT?"":" Voer eerst het bestand <b>supabase/logboek.sql</b> uit in de SQL Editor van Supabase."}</div>`;
  const q=norm(UI.logQ||""),T=UI.logT||"",W=UI.logW||"";const wies=[...new Set(LOGS.rows.map(e=>e.wie).filter(Boolean))].sort();
  let L=LOGS.rows;if(T)L=L.filter(e=>e.tabel===T);if(W)L=L.filter(e=>e.wie===W);
  if(q)L=L.filter(e=>norm(logOnderwerp(e).replace(/<[^>]+>/g," ")+" "+(e.wie||"")+" "+JSON.stringify(e.nieuw||{})+JSON.stringify(e.oud||{})).includes(q));
  const N=UI.logN||100;const dt=s=>{const d=new Date(s);return isNaN(d)?"":d.toLocaleDateString("nl-BE",{day:"numeric",month:"short",year:"numeric"})+" "+d.toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"})};
  const AP={nieuw:["ok","Toegevoegd"],gewijzigd:["info","Gewijzigd"],verwijderd:["nok","Verwijderd"],bulk:["neutral","Import"]};
  return instTabs("logboek")+`<div class="bar"><div class="search">${ic("search")}<input id="logQ" data-live data-input="logQ" placeholder="Zoek op naam, wie of inhoud" value="${esc(UI.logQ||"")}"></div>
  <select class="sel" data-change="logT" aria-label="Soort">${selOpts([["","Alles"],["leden","Ledenlijst"],["jaarleden","Punten en kalenders"],["boekingen","Transacties en betalingen"]],T)}</select>
  <select class="sel" data-change="logW" aria-label="Wie">${selOpts([["","Iedereen"],...wies.map(w=>[w,w])],W)}</select></div>
  <div class="panel"><div class="tw"><table class="rcards logt" data-main="2"><thead><tr><th>Wanneer</th><th>Wie</th><th>Over</th><th>Wat</th><th>Wijziging</th></tr></thead><tbody>
  ${L.slice(0,N).map(e=>{const [c,l]=AP[e.actie]||["neutral",e.actie];return `<tr><td class="nowrap muted">${dt(e.ts)}</td><td class="trunc">${esc(e.wie||"")}</td><td><span class="lg-t">${LOG_TYPE[e.tabel]||esc(e.tabel||"")}</span> ${logOnderwerp(e)}</td><td><span class="pill ${c}">${l}</span></td><td>${logRegels(e)}</td></tr>`}).join("")||'<tr><td colspan="5" class="empty">'+(LOGS.rows.length?"Niets gevonden met deze filters.":"Nog geen wijzigingen gelogd. Vanaf nu wordt elke aanpassing aan leden, punten en transacties hier bijgehouden.")+'</td></tr>'}
  </tbody></table></div>${L.length>N||!LOGS.done?`<div style="padding:12px 16px;border-top:1px solid var(--line);display:flex;gap:10px;align-items:center"><span class="muted" style="font-size:13px">${Math.min(N,L.length)} van ${L.length}${LOGS.done?"":"+"} getoond</span><span class="grow"></span><button class="btn sm" data-act="logMeer">Meer tonen</button></div>`:""}</div>`}});
/* ---------- instellingen ---------- */
VIEWS.instellingen=()=>({title:"Instellingen",sub:"Boekjaren, puntensysteem, lijsten en back-ups",body(){
  const C=ctx(),c=cfg(),j=C.c,ys=jaren(),last=ys[ys.length-1];
  const d=canWrite?"":" disabled";
  return instTabs("instellingen")+`<div class="panel"><div class="panel-h"><h2>Actief boekjaar</h2></div><div class="panel-b bar"><select class="sel" id="actiefJaar" data-change="actiefJaar" aria-label="Actief boekjaar"${d}>${ys.map(y=>`<option${y===JAAR?" selected":""}>${y}</option>`).join("")}</select><span style="color:var(--muted);font-size:13.5px;flex:1 1 260px">Dit is het jaar dat iedereen ziet in het dashboard, de leden, de boekhouding, de punten en de kalenders. Oudere jaren bekijk je via Boekhouding › Historiek.</span></div></div>
  <div class="grid g2" style="align-items:start">
  <form class="panel" id="fJaar"><div class="panel-h"><h2>Punten en kalenders ${JAAR}</h2></div><div class="panel-b"><div class="form">
    <div class="fld"><label for="jW1">Punten per kaart</label><input id="jW1" name="w_kaarten" inputmode="numeric" value="${j.gewichten.kaarten}"${d}></div>
    <div class="fld"><label for="jW2">Punten per kalenderdoos</label><input id="jW2" name="w_kalenders" inputmode="numeric" value="${j.gewichten.kalenders}"${d}></div>
    <div class="fld"><label for="jW3">Punten per shift</label><input id="jW3" name="w_shifts" inputmode="numeric" value="${j.gewichten.shifts}"${d}></div>
    <div class="fld"><label for="jW4">Punten per vergadering</label><input id="jW4" name="w_vergaderingen" inputmode="numeric" value="${j.gewichten.vergaderingen}"${d}></div>
    <div class="fld"><label for="jZ">Zilver vanaf (punten)</label><input id="jZ" name="d_zilver" inputmode="numeric" value="${j.drempels.zilver}"${d}></div>
    <div class="fld"><label for="jG">Goud vanaf (punten)</label><input id="jG" name="d_goud" inputmode="numeric" value="${j.drempels.goud}"${d}></div>
    <div class="fld"><label for="jStock">Kalenderdozen dit jaar</label><input id="jStock" name="kalenderStock" inputmode="numeric" value="${j.kalenderStock}"${d}></div>
    <div class="fld"><label for="jPerDoos">Kalenders per doos</label><input id="jPerDoos" name="perDoos" inputmode="numeric" value="${j.perDoos}"${d}></div>
    <div class="full bar" data-w><button class="btn primary" type="submit">Boekjaar bewaren</button></div></div></div></form>
  <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
  <div class="panel" data-w><div class="panel-h"><h2>Nieuw boekjaar</h2></div><div class="panel-b" style="display:flex;flex-direction:column;gap:10px">
    ${ys.length?`<p style="margin:0">Open ${last+1} met de eindsaldi van ${last} als beginsaldo. Leden, sponsors en instellingen gaan mee; punten, kalenders en lidgeld starten op nul.</p><button class="btn primary" data-act="nieuwJaar" style="align-self:flex-start">Boekjaar ${last+1} openen</button>`:`<p style="margin:0">Er is nog geen boekjaar.</p><button class="btn primary" data-act="eersteJaar" style="align-self:flex-start">Boekjaar ${new Date().getFullYear()} starten</button>`}
  </div></div>
  <div class="panel"><div class="panel-h"><h2>Exporteren en importeren</h2></div><div class="panel-b" style="display:flex;flex-direction:column;gap:10px">
    <button class="btn" data-act="exportXlsx" style="align-self:flex-start">${ic("download")}Boekjaar ${JAAR} als Excel</button>
    <button class="btn" data-act="exportJson" style="align-self:flex-start">${ic("download")}Volledige back-up (.json)</button>
    <label class="btn" data-w for="restoreFile" style="align-self:flex-start;cursor:pointer">${ic("upload")}Back-up terugzetten (.json)</label><input type="file" id="restoreFile" accept=".json,application/json" hidden>
    <button class="btn" data-w data-act="importExcel" style="align-self:flex-start">${ic("upload")}Oud VBHA Excel-bestand importeren</button>
    <span style="font-size:13px;color:var(--muted)">Maak af en toe een back-up en bewaar die op een veilige plaats.</span></div></div>
  </div></div>
  <div class="note info" style="margin:0">Beginsaldi, lidgeld, rekeningnummer en de categorieën van de boekhouding stel je in via het tandwiel op de pagina <a href="#boekhouding">Boekhouding</a>. De categorieën van de leden vind je onder het tandwiel op de <a href="#leden">Ledenlijst</a>.</div>
  <form class="panel" id="fCfg"><div class="panel-h"><h2>Algemeen</h2></div><div class="panel-b"><div class="form">
    <div class="fld"><label for="cNaam">Naam vereniging</label><input id="cNaam" name="vereniging" value="${esc(c.vereniging)}"${d}></div>
    <div class="full bar" data-w><button class="btn primary" type="submit">Bewaren</button></div></div></div></form>
  <div class="panel"><div class="panel-h"><h2>Inschrijfformulier voor nieuwe leden</h2></div><div class="panel-b" style="display:flex;flex-direction:column;gap:10px"><span style="font-size:14px;color:var(--muted)">Deel deze link met wie lid wil worden. Iedereen kan het formulier invullen zonder aan te melden. Nieuwe leden komen meteen in de ledenlijst en je krijgt een melding op het dashboard.</span><div class="bar" style="margin:0"><input class="sel" style="flex:1;min-width:0" readonly value="${esc(location.origin+"/inschrijven")}" aria-label="Link naar het inschrijfformulier" onclick="this.select()"><button class="btn" data-act="kopieerLink" data-v="${esc(location.origin+"/inschrijven")}">${ic("copy")}Kopiëren</button><a class="btn" href="/inschrijven" target="_blank" rel="noopener">Openen</a></div></div></div>
  <div class="note info">Toegang geven: nodig een bestuurslid uit in Supabase via Authentication › Users › Invite user. Na het kiezen van een wachtwoord kan die persoon alles bekijken en bewerken. Voor alleen-lezen zet je de rol in de tabel <span class="kbd">bestuur</span> op <span class="kbd">lezer</span>. Je bent aangemeld als <b>${esc(ME?ME.email:"")}</b>.</div>`}});

/* ============ modals ============ */
function modal(title,body,foot,{wide=false,onClose}={}){
  $("#modal").innerHTML=`<div class="modal-bg" data-act="closeModalBg"><div class="modal${wide?" wide":""}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-h"><h3>${esc(title)}</h3><button class="btn ghost sm" data-act="closeModal" aria-label="Sluiten">${ic("x")}</button></div><div class="modal-b">${body}</div>${foot?`<div class="modal-f">${foot}</div>`:""}</div></div>`;
  MODAL_CLOSE=onClose||null;const f=$("#modal input:not([type=hidden]):not([disabled]),#modal select,#modal textarea");if(f&&!window.matchMedia("(max-width:760px)").matches)setTimeout(()=>f.focus(),30);
}
let MODAL_CLOSE=null,MODAL_DOWN=null;
document.addEventListener("pointerdown",e=>{MODAL_DOWN=e.target},true);
function closeModal(){$("#modal").innerHTML="";if(MODAL_CLOSE){const f=MODAL_CLOSE;MODAL_CLOSE=null;f()}}
function confirmBox(text,label,fn){modal("Bevestigen",`<p style="margin:0">${text}</p>`,`<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="cfOk">${esc(label)}</button>`);$("#cfOk").onclick=()=>{closeModal();fn()}}
function toast(msg,bad){const t=$("#toast");t.className="toast"+(bad?" bad":"");t.textContent=msg;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>{t.hidden=true},bad?5000:2600)}
const fld=(id,label,input,cls="")=>`<div class="fld ${cls}"><label for="${id}">${label}</label>${input}</div>`;
const inp=(id,val,attrs="")=>`<input id="${id}"${/(^|\s)name=/.test(attrs)?"":` name="${id}"`} value="${esc(val??"")}" ${attrs}>`;
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
  <label class="sp-nat full" for="geenLid"><input type="checkbox" id="geenLid"${l.geenLid?" checked":""}><span><b>Geen lid</b><small>Verdwijnt uit de ledenlijst, de mails en de inschrijfpagina's. Je vindt de persoon nog terug via de zoekbalk.</small></span></label>
  <div class="err full" id="lidErr"></div></form>`}
function readLid(){const f=formData($("#fLid"));const e=$("#lidErr");
  if(!f.naam.trim()||!f.voornaam.trim()){e.textContent="Vul naam en voornaam in.";return null}
  if(!f.categorie){e.textContent="Kies een categorie.";return null}
  const ls_=parseInt(f.lidSinds,10),lt=parseInt(f.lidTot,10);
  return{naam:f.naam.trim(),voornaam:f.voornaam.trim(),adres:f.adres.trim(),email:f.email.trim(),telefoon:f.telefoon.trim(),categorie:f.categorie,lidSinds:isNaN(ls_)?null:ls_,info:f.info.trim(),lidTot:isNaN(lt)?null:lt,geenLid:!!($("#geenLid")&&$("#geenLid").checked)}}
function nieuwLid(){modal("Nieuw lid",lidForm(),`<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="lidOk">Lid toevoegen</button>`);
  $("#lidOk").onclick=async()=>{const d=readLid();if(!d)return;let id=slug(d.naam+"-"+d.voornaam);if(S.leden.has(id)){$("#lidErr").textContent="Er bestaat al een lid met deze naam.";return}
    closeModal();await write("leden",id,d);toast(naamVol(d)+" is toegevoegd.")}}
function toonLid(id){
  const C=ctx(),r=C.rows.get(id);if(!r)return;const l=r.lid;
  const b=r.lg.boeking;
  const body=`<div class="grid g2"><dl class="kv"><dt>Adres</dt><dd>${esc(l.adres)||"–"}</dd><dt>E-mail</dt><dd>${esc(l.email)||"–"}</dd><dt>Telefoon</dt><dd>${esc(l.telefoon)||"–"}</dd><dt>Categorie</dt><dd>${esc(l.categorie)}</dd><dt>Lid sinds</dt><dd>${esc(l.lidSinds||"–")}${r.jaren!=null?" ("+r.jaren+" jaar)":""}</dd>${l.info?`<dt>Info</dt><dd>${esc(l.info)}</dd>`:""}${l.lidTot?`<dt>Lid tot</dt><dd>${l.lidTot}</dd>`:""}${l.geenLid?`<dt>Status</dt><dd><span class="pill neutral">Geen lid</span></dd>`:""}</dl>
   <div style="display:flex;flex-direction:column;gap:10px"><div><b>Lidgeld ${JAAR}</b> &nbsp;${lgPill(r)} <span style="color:var(--muted)">${eur(r.bedrag)}</span></div>
   <div style="font-size:13.5px;color:var(--muted)">${b?`Gevonden in transactie ${b.nr??""} van ${fmtDate(b.datum)}: “${esc(b.mededeling)}”`:esc(r.lg.bron)||"Geen betaling gevonden met naam, voornaam en het woord lidgeld in de mededeling."}</div>
   <div class="fld" data-w><label for="lgOv">Lidgeldstatus</label><select id="lgOv" data-lgov="${esc(id)}">${selOpts([["","Automatisch (uit de boekhouding)"],["OK","Manueel: betaald"],["NOK","Manueel: niet betaald"]],r.jl.lidgeld||"")}</select></div>
   ${!r.lg.ok?`<button class="btn primary" data-w data-act="lidgeldBetaald" data-id="${esc(id)}" style="align-self:flex-start">Lidgeld ontvangen boeken</button>`:""}
   ${l.categorie!=="Erewacht"?`<div><b>Punten ${JAAR}</b>: ${r.p.totaal} &nbsp;${medal(r.status)}</div>`:""}</div></div>`+lidgeldHistHtml(l,r);
  modal(naamVol(l),body,`<button class="btn ghost danger" data-w id="lidDel">Verwijderen</button><span class="grow"></span><button class="btn" data-act="closeModal">Sluiten</button><button class="btn primary" data-w id="lidEdit">Gegevens wijzigen</button>`,{wide:true});
  $("#lidEdit").onclick=()=>{modal("Lid wijzigen",lidForm(l),`<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="lidOk">Bewaren</button>`);
    $("#lidOk").onclick=async()=>{const d=readLid();if(!d)return;closeModal();await write("leden",id,{...stripId(S.leden.get(id)||l),...d});toast(d.geenLid&&!l.geenLid?naamVol(d)+" staat niet meer in de ledenlijst.":"Gegevens bewaard.")}};
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
  <div class="tw" style="max-height:300px;border:1px solid var(--line);border-radius:8px"><table class="rcards"><thead><tr><th>Jaar</th><th>Status</th><th>Datum</th><th class="num">Bedrag</th><th>Mededeling</th></tr></thead><tbody>${rows}</tbody></table></div>
  <div style="color:var(--muted);font-size:12.5px;margin-top:6px">Gezocht op naam, voornaam en "lidgeld" in de boekhouding van alle jaren. Een betaling met een ander jaartal in de mededeling (bv. "lidgeld 2024" betaald in januari 2025) telt voor dat jaar.</div></div>`;
}
function lidgeldBetaald(id){
  const C=ctx(),r=C.rows.get(id),l=r.lid;
  boekingForm({datum:todayISO().startsWith(String(JAAR))?todayISO():JAAR+"-12-31",categorie:"Lidgeld",mededeling:`${l.naam} ${l.voornaam} lidgeld ${JAAR}`,partij:naamVol(l),rekening:"Kas",bedrag:r.bedrag,richting:"in",lidId:id},null,"Lidgeld ontvangen");
}

/* ---------- transactie ---------- */
function boekingForm(b,id,title){
  const c=cfg();const C=ctx();
  const ledenOpts=[["","— geen —"],...C.leden.map(l=>[l.id,l.naam+" "+l.voornaam])];
  const info=id?`<div class="full muted small">Bron: ${esc(bronLabel(b))}${b.bankRef?" · Bankreferentie "+esc(b.bankRef):""}${b.regelNaam?" · "+esc(b.regelNaam):""}${b.status==="controle"?' · <span class="pill warn">nog te controleren</span>':""}</div>`:"";
  modal(title||(id?"Transactie "+(b.nr??"")+" wijzigen":"Nieuwe transactie"),`<form id="fBoek" class="form">
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
    closeModal();await write("boekingen",id||newId("boekingen"),d);toast(id?"Transactie bewaard.":"Transactie "+nr+" toegevoegd.");
  };
  if(id){$("#bDel").onclick=()=>confirmBox("Transactie "+esc(b.nr??"")+" (“"+esc(b.mededeling||b.partij)+"”, "+eur(b.bedrag)+") verwijderen?","Verwijderen",async()=>{await write("boekingen",id,null,{del:true});toast("Transactie verwijderd.")});
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
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(L.map(b=>({Nr:b.nr,Datum:fmtDate(b.datum),Categorie:b.categorie,Tegenpartij:b.partij,"Rekening tegenpartij":b.iban||"",Mededeling:b.mededeling,"Rekening/Kas":b.rekening,In:b.richting!=="uit"?b.bedrag:"",Uit:b.richting==="uit"?b.bedrag:"",Bron:bronLabel(b),Bankreferentie:b.bankRef||""}))),"Transacties "+JAAR);
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
  closeModal();toast(ops.length+" transacties geïmporteerd"+(open?", "+open+" te verwerken.":"."));
  if(open)location.hash="verwerken";
}

/* ---------- sponsor ---------- */
function sponsorForm(s,id){
  modal(id?spNaam(s):"Nieuwe sponsor",`<form id="fSp" class="form">
   ${fld("sW","Weergavenaam",inp("sW",s.weergave,'name="weergave" placeholder="Zoals we de sponsor kennen, bv. Hubo"'))}${fld("sB","Bedrijfsnaam (officieel) *",inp("sB",s.bedrijf,'name="bedrijf" placeholder="bv. Jasam"'))}${fld("sV","Voornaam contact",inp("sV",s.voornaam,'name="voornaam"'))}${fld("sN","Naam contact",inp("sN",s.naam,'name="naam"'))}
   ${fld("sA","Adres",inp("sA",s.adres,'name="adres"'),"full")}${fld("sE","E-mail",inp("sE",s.email,'name="email" type="email"'))}${fld("sT","Telefoon",inp("sT",s.telefoon,'name="telefoon"'))}
   ${fld("sK","KBO-nummer",inp("sK",s.kbo,'name="kbo"'))}${fld("sBd","Bedrag (€)",inp("sBd",s.bedrag,'name="bedrag" inputmode="decimal"'))}
   <label class="full sp-nat"><input type="checkbox" id="sNat"${(s.naturaJaren||[]).includes(JAAR)?" checked":""}><span><b>Voldaan in ${JAAR}</b><small>Sponsoring in natura, of op een andere manier in orde zonder betaling</small></span></label>${id?spBetHtml(id):""}<div class="err full" id="spErr"></div></form>`,
   `${id?'<button class="btn ghost danger" data-w id="spDel">Verwijderen</button><span class="grow"></span>':""}<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" data-w id="spOk">Bewaren</button>`);
  if(!canWrite)$$("#fSp input").forEach(i=>i.disabled=true);
  if(!s)s={};
  $("#spOk").onclick=async()=>{const f=formData($("#fSp"));if(!f.bedrijf.trim()){$("#spErr").textContent="Vul de naam van het bedrijf in.";return}
    const nj=new Set((s.naturaJaren||[]).map(Number));if($("#sNat").checked)nj.add(JAAR);else nj.delete(JAAR);
    const d={...stripId(s),...f,bedrijf:f.bedrijf.trim(),weergave:String(f.weergave||"").trim(),bedrag:num(f.bedrag),naturaJaren:[...nj].sort()};closeModal();await write("sponsors",id||newId("sponsors"),d);toast("Sponsor bewaard.")};
  if(id)spBetBind(id);
  if(id)$("#spDel").onclick=()=>confirmBox("Sponsor <b>"+esc(spNaam(s))+"</b> verwijderen?","Verwijderen",async()=>{await write("sponsors",id,null,{del:true});toast("Sponsor verwijderd.")});
}

/* ---------- kalenderlijst ---------- */
const stripId=o=>{const {id,...r}=o||{};return r};
function setJL(lidId,patch){const id=JAAR+"_"+lidId;const prev=S.jaarleden.get(id)||null;const cur=prev||{jaar:JAAR,lidId};const d={...stripId(cur),jaar:JAAR,lidId,...patch};S.jaarleden.set(id,{...d,id});dirty=true;return write("jaarleden",id,d,{oud:prev})}
function setJLid(id,patch){const cur=S.jaarleden.get(id);if(!cur)return;const d={...stripId(cur),...patch};S.jaarleden.set(id,{...d,id});dirty=true;return write("jaarleden",id,d,{oud:cur})}

/* ---------- jaar & export ---------- */
async function saveJaar(f){
  const J0=jaarCfg(JAAR);const g=(k,def)=>f[k]===undefined?def:num(f[k]);const d={jaar:JAAR,beginKas:r2(g("beginKas",J0.beginKas)),beginRekening:r2(g("beginRekening",J0.beginRekening)),lidgeld:{gewoon:g("lg_gewoon",J0.lidgeld.gewoon),erewacht:g("lg_erewacht",J0.lidgeld.erewacht)},
    gewichten:{kaarten:g("w_kaarten"),kalenders:g("w_kalenders"),shifts:g("w_shifts"),vergaderingen:g("w_vergaderingen")},drempels:{zilver:g("d_zilver"),goud:g("d_goud")},kalenderStock:g("kalenderStock"),perDoos:Math.max(1,g("perDoos")||100),kaartUrl:String(f.kaartUrl||"").trim()};
  await write("jaren",String(JAAR),{...stripId(S.jaren.get(String(JAAR))),...d});toast("Boekjaar "+JAAR+" bewaard.");
}
async function nieuwJaar(){const ys=jaren(),last=ys[ys.length-1];const prevJ=JAAR;JAAR=last;dirty=true;const C=ctx();const c=C.c;JAAR=prevJ;dirty=true;
  confirmBox(`Boekjaar <b>${last+1}</b> openen met beginsaldo kas ${eur(C.kas)} en rekening ${eur(C.rek)}?`,"Openen",async()=>{
    await write("jaren",String(last+1),{jaar:last+1,beginKas:C.kas,beginRekening:C.rek,gewichten:c.gewichten,drempels:c.drempels,korting:c.korting,lidgeld:c.lidgeld,kalenderStock:c.kalenderStock,perDoos:c.perDoos});
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
  let i=0,done=0;let logs=[];
  if(LOG_CLIENT){const lo=ops.filter(o=>LOG_COLS.has(o[0]));if(lo.length&&lo.length<=50)logs=lo.map(o=>logEntry(o[0],o[1],(S[o[0]]&&S[o[0]].get(o[1]))||null,o[2]));
    else if(lo.length){const per={};lo.forEach(o=>per[o[0]]=(per[o[0]]||0)+1);const main=Object.entries(per).sort((a,b)=>b[1]-a[1])[0][0];
      logs=[{ts:new Date().toISOString(),wie:ME_NAME||"Onbekend",tabel:main,doc_id:"",actie:"bulk",info:Object.entries(per).map(([c,n])=>n+" "+({leden:"leden",jaarleden:"punten/kalenderregels",boekingen:"transacties"}[c]||c)).join(", ")+" in één keer aangepast (import of bulkactie)",oud:null,nieuw:null}]}}
  const worker=async()=>{while(i<ops.length){const op=ops[i++];
    for(let a=0;;a++){try{const ref=db.collection(op[0]).doc(op[1]);await(op[2]===null?ref.delete():ref.set(op[2]));break}
      catch(e){if(a<5&&e&&(e.code==="resource_exhausted"||e.code==="unavailable")){await new Promise(r=>setTimeout(r,600*(a+1)+Math.random()*500));continue}throw e}}
    onProg(++done)}};
  await Promise.all([worker(),worker(),worker(),worker()]);
  logWrite(logs);
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
  area.innerHTML=`<div class="note info"><b>Boekjaar ${P.Y}</b>: ${P.leden.length} leden, ${P.boekingen.length} transacties, ${P.jaarleden.length} punten- en kalenderregels, ${P.sponsors.length} sponsors. Beginsaldo kas ${eur(P.jaar.beginKas)}, rekening ${eur(P.jaar.beginRekening)}.</div>
   ${bestaand?`<div class="note">Boekjaar ${P.Y} bevat al ${bestaand} transacties. Die worden vervangen door de transacties uit dit bestand, net als de punten en kalenders van ${P.Y}.</div>`:""}
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
  if(!e.target.closest("#acct"))closeAcct();
  if(e.target.closest("td.chk"))return;
  const t=e.target.closest("[data-act]");if(!t)return;const a=t.dataset.act,id=t.dataset.id;
  if(a==="closeModalBg"){if(e.target===t&&MODAL_DOWN===t&&!t.querySelector("input:not([type=hidden]),textarea,select,[contenteditable]"))closeModal();return}
  switch(a){
    case"closeModal":closeModal();break;
    case"logout":await SB.auth.signOut();location.href="/";break;
    case"pwVergeten":{const em=($("#lEmail")||{}).value||"";if(!em.trim()){$("#lErr").textContent="Vul eerst je e-mailadres in.";break}
      const {error}=await SB.auth.resetPasswordForEmail(em.trim(),{redirectTo:location.origin+"/"});$("#lErr").textContent="";$("#lMsg").textContent=error?"Versturen lukte niet: "+error.message:"Als dit adres toegang heeft, krijg je zo een mail om een nieuw wachtwoord te kiezen.";break}
    case"bankKoppel":bankKoppel();break;
    case"bankSync":bankSync(t);break;
    case"bankOntkoppel":bankOntkoppel(id);break;
    case"kopieerLink":{try{await navigator.clipboard.writeText(t.dataset.v);toast("Link gekopieerd.")}catch(e){toast("Kopiëren lukte niet. Selecteer de link en kopieer hem zelf.",true)}break}
    case"acctMenu":{const m=$("#acctMenu");const open=m.hidden;m.hidden=!open;t.setAttribute("aria-expanded",String(open));break}
    case"acctClose":closeAcct();break;
    case"step":{if(!canWrite)break;const f=t.dataset.f,d=+t.dataset.d;if(t.dataset.k==="kal"){const cur=S.jaarleden.get(id);if(!cur)break;const v=Math.max(0,(cur[f]||0)+d);await setJLid(id,{[f]:v})}else{const cur=S.jaarleden.get(JAAR+"_"+id)||{};const v=Math.max(0,(cur[f]||0)+d);await setJL(id,{[f]:v})}renderBody();break}
    case"xAdd":{const L=extraLijnen(S.jaarleden.get(JAAR+"_"+id)||{}).map(x=>({...x}));if(!L.length)L.push({tekst:"",punten:0});L.push({tekst:"",punten:0});await saveExtras(id,L);renderBody();const ins=document.querySelectorAll(`[data-xf="tekst"][data-id="${CSS.escape(id)}"]`);if(ins.length)ins[ins.length-1].focus();break}
    case"xDel":{const L=extraLijnen(S.jaarleden.get(JAAR+"_"+id)||{}).map(x=>({...x}));L.splice(+t.dataset.i,1);await saveExtras(id,L);renderBody();break}
    case"sheetOpen":openSheet(id);break;
    case"sheetClose":closeSheet();break;
    case"sheetBg":if(e.target===t)closeSheet();break;
    case"navdd":{const m=$("#navmenu");if(HOVER&&!m.hidden&&m.dataset.for===t.dataset.id)break;openNavMenu(t);break}
    case"toonNietBetaald":UI.ledenF="nok";UI.ledenCat="";UI.ledenQ="";saveUI();break;
    case"toonAlleLeden":UI.ledenF="alle";UI.ledenCat="";UI.ledenQ="";saveUI();break;
    case"filterRek":Object.assign(UI,{boekRek:t.dataset.v,boekQ:"",boekMaand:"",boekCat:"",boekDir:"",boekPage:0});saveUI();break;
    case"ledenF":UI.ledenF=t.dataset.v;saveUI();$$(".seg button[data-act=ledenF]").forEach(b=>b.classList.toggle("on",b===t));$("#ledenList").innerHTML=ledenTable();break;
    case"boekRek":UI.boekRek=t.dataset.v;UI.boekPage=0;saveUI();renderBody();break;
    case"boekDir":UI.boekDir=t.dataset.v;UI.boekPage=0;saveUI();renderBody();break;
    case"filtersWis":Object.assign(UI,{boekQ:"",boekMaand:"",boekCat:"",boekRek:"",boekDir:"",boekPage:0});saveUI();renderBody();break;
    case"boekSort":{const k=t.dataset.v;const s=UI.boekSort||{k:"datum",d:-1};UI.boekSort=s.k===k?{k,d:-s.d}:{k,d:k==="datum"||k==="bedrag"||k==="nr"?-1:1};UI.boekPage=0;saveUI();refreshJournal();break}
    case"page":UI.boekPage=(UI.boekPage||0)+(+t.dataset.v);refreshJournal();{const el=$("#boekList");if(el)el.scrollIntoView({block:"start"})}break;
    case"filterCat":Object.assign(UI,{boekCat:t.dataset.v,boekMaand:"",boekQ:"",boekRek:"",boekDir:"",boekPage:0});saveUI();location.hash="boekingen";break;
    case"filterMaand":Object.assign(UI,{boekMaand:t.dataset.v,boekCat:"",boekQ:"",boekPage:0});saveUI();location.hash="boekingen";break;
    case"selClear":SEL.clear();refreshJournal();break;
    case"bulkCat":{const v=$("#bulkCat").value;if(!v){toast("Kies eerst een categorie.",true);break}const n=await patchBoekingen([...SEL],b=>({categorie:v,status:null,lidId:v==="Lidgeld"?(b.lidId||findLid(b)):(b.lidId||null)}),"Categorie toegekend aan {n} transacties.");if(n){SEL.clear();refreshJournal()}break}
    case"bulkOk":{const n=await patchBoekingen([...SEL],b=>b.categorie&&b.status==="controle"?{status:null}:null,"{n} transacties gemarkeerd als gecontroleerd.");if(n){SEL.clear();refreshJournal()}break}
    case"bulkDel":{const ids=[...SEL];confirmBox("<b>"+ids.length+" transacties</b> definitief verwijderen?","Verwijderen",async()=>{try{await writeMany(ids.map(i=>["boekingen",i,null]),()=>{});SEL.clear();toast(ids.length+" transacties verwijderd.")}catch(err){handleWriteError(err)}});break}
    case"vOk":{const el=$('[data-vcat="'+CSS.escape(id)+'"]');const v=el&&el.value;if(!v){toast("Kies eerst een categorie.",true);break}await patchBoekingen([id],b=>({categorie:v,status:null,lidId:v==="Lidgeld"?(b.lidId||findLid(b)):(b.lidId||null)}),"Transactie bevestigd.");break}
    case"alleBevestigen":{const m=new Map();for(const b of teVerwerken(ctx())){const el=$('[data-vcat="'+CSS.escape(b.id)+'"]');if(el&&el.value)m.set(b.id,el.value)}if(!m.size){toast("Er zijn geen voorstellen om te bevestigen.",true);break}
      await patchBoekingen([...m.keys()],b=>({categorie:m.get(b.id),status:null,lidId:m.get(b.id)==="Lidgeld"?(b.lidId||findLid(b)):(b.lidId||null)}),"{n} transacties bevestigd.");break}
    case"regelsToepassen":await patchBoekingen(teVerwerken(ctx()).map(b=>b.id),b=>{const s=suggest(b);if(!s)return null;if(b.categorie===s.categorie&&!(s.zeker&&b.status==="controle"))return null;return{categorie:s.categorie,status:s.zeker?null:"controle",regelNaam:s.naam,lidId:s.categorie==="Lidgeld"?(b.lidId||findLid(b)):(b.lidId||null)}},"Regels toegepast op {n} transacties.");break;
    case"regelVan":{const b=S.boekingen.get(id);if(b)regelVan(b);break}
    case"nieuweRegel":regelForm({},null);break;
    case"regelEdit":{const r=S.regels.get(id);if(r)regelForm(r,id);break}
    case"regelUp":case"regelDown":{const R=[...S.regels.values()].sort(byVolg);const i=R.findIndex(r=>r.id===id);const j=a==="regelUp"?i-1:i+1;if(i<0||j<0||j>=R.length)break;
      const ops=R.map((r,k)=>[r,((k===i?j:k===j?i:k)+1)*10]).filter(([r,v])=>r.volgorde!==v).map(([r,v])=>["regels",r.id,{...stripId(r),volgorde:v}]);try{await writeMany(ops,()=>{})}catch(err){handleWriteError(err)}break}
    case"exportBoek":exportBoek();break;
    case"reglement":toonReglement();break;
    case"reglPrint":{const h=$("#modal .regl");if(!h)break;const wdw=window.open("","_blank");if(!wdw){toast("Je browser blokkeerde het afdrukvenster.",true);break}wdw.document.write(`<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Reglement puntensysteem VBHA</title><style>body{font:14px/1.5 system-ui,sans-serif;max-width:720px;margin:32px auto;padding:0 16px;color:#111}h1{font-size:22px;text-align:center}h4{margin:20px 0 6px;font-size:15px}table{border-collapse:collapse;width:100%;margin:8px 0}th,td{border:1px solid #999;padding:4px 8px;text-align:left}th{background:#eee}.medal i{display:none}.regl-end{border:1px solid #999;background:#eee;padding:8px 10px;margin-top:20px}</style></head><body><h1>Reglement PUNTENSYSTEEM</h1>${h.innerHTML}</body></html>`);wdw.document.close();wdw.focus();setTimeout(()=>wdw.print(),200);break}
    case"puntInst":puntInst();break;
    case"finInst":finInst();break;
    case"ledenInst":ledenInst();break;
    case"ledenSort":{const v=t.dataset.v,cur=ledenSort();let n;
      if(v==="naam")n=cur.k==="naam"?{k:"voornaam",d:1}:{k:"naam",d:1};
      else n=cur.k===v?{k:v,d:-cur.d}:{k:v,d:(v==="status"||v==="lidgeld")?-1:1};
      UI.ledenSort=n;saveUI();$("#ledenList").innerHTML=ledenTable();break}
    case"inschrGezien":{const L=nieuweInschr();for(const r of L){const col=S.banket.has(r.id)?"banket":"kinderfeest";const {id:_i,...rest}=r;await write(col,r.id,{...rest,nieuw:false})}toast("Melding afgevinkt.");break}
    case"nieuwGezien":{const L=nieuweLeden();for(const l of L){const {id:_i,nieuw,...rest}=l;await write("leden",l.id,{...rest,nieuw:false})}toast(L.length===1?"Melding afgevinkt.":L.length+" meldingen afgevinkt.");break}
    case"logMeer":logMeer();break;
    case"logVernieuw":LOGS.rows=[];LOGS.loaded=false;LOGS.done=false;UI.logN=100;renderBody();break;
    case"puntNaam":UI.puntSort=UI.puntSort==="naam"?"voornaam":"naam";saveUI();renderBody();break;
    case"puntSort":{let v=t.dataset.v;if(v==="naam"&&UI.puntSort==="naam")v="voornaam";UI.puntSort=v;saveUI();renderBody();break}
    case"nieuwLid":nieuwLid();break;
    case"toonLid":toonLid(id);break;
    case"kalOpen":{KAL_OPEN.has(id)?KAL_OPEN.delete(id):KAL_OPEN.add(id);const el=$("#kalList");if(el)el.innerHTML=kalTable();break}
    case"ptOpen":{PT_OPEN.has(id)?PT_OPEN.delete(id):PT_OPEN.add(id);const el=$("#puntList");if(el)el.innerHTML=puntTable();break}
    case"lidgeldBetaald":closeModal();lidgeldBetaald(id);break;
    case"nieuweBoeking":boekingForm({},null);break;
    case"toonBoeking":{const b=S.boekingen.get(id);if(b)canWrite?boekingForm(b,id):toast("Je hebt alleen leesrechten.");break}
    case"importBank":importBank();break;
    case"nieuweSponsor":sponsorForm({},null);break;
    case"spVanBoeking":{const b=S.boekingen.get(id);if(b){const nm=String(b.partij||"").replace(/\b(bv|bvba|nv|vzw|sprl|srl)\b\.?/gi,"").replace(/\s+/g," ").trim();sponsorForm({bedrijf:nm.toLowerCase().replace(/(^|[\s'(-])\p{L}/gu,m=>m.toUpperCase()),bedrag:b.bedrag},null)}break}
    case"spSort":{const k=t.dataset.v;const c=UI.spSort||{k:"bedrijf",d:1};UI.spSort=c.k===k?{k,d:-c.d}:{k,d:k==="bedrijf"?1:-1};render(true);break}
    case"toonSponsor":sponsorForm(S.sponsors.get(id),id);break;
    case"spToewijzen":spToewijzen(id);break;
    case"bkNieuw":bkForm({personen:1,menu1:"Normaal"},null);break;
    case"bkToon":{const r=S.banket.get(id);if(r)bkForm(r,id);break}
    case"bkImport":bkImportDialog();break;
    case"bkInst":bkInst();break;
    case"bkExport":bkExport();break;
    case"bkF":UI.bkF=t.dataset.v;saveUI();$$(".seg button[data-act=bkF]").forEach(b=>b.classList.toggle("on",b===t));$("#bkList").innerHTML=bkTable();break;
    case"kalToevoegen":kalToevoegen();break;
    case"krNaam":krVraagNaam();break;
    case"krToon":krGoto(id);break;
    case"krWis":krZet("todo",id);break;
    case"krWijk":krWijk(id);break;
    case"krWisAlles":krWisAlles();break;
    case"kalOphalen":kalMee(id);break;
    case"kalKlaar":kalKlaarForm(id);break;
    case"mailChip":{const ta=$("#mBody");const v=t.dataset.v;const s=ta.selectionStart??ta.value.length;ta.value=ta.value.slice(0,s)+v+ta.value.slice(ta.selectionEnd??s);ta.focus();ta.selectionStart=ta.selectionEnd=s+v.length;MAIL.body=ta.value;MAIL.touched=true;mailPreview();break}
    case"mailPrev":MAIL.idx--;mailPreview();break;
    case"mailNext":MAIL.idx++;mailPreview();break;
    case"mailToText":MAIL.body=htmlToText(MAIL.body);MAIL.isHtml=false;render();break;
    case"mailSave":{const M=MAIL;if(!M.naam.trim()){toast("Geef het sjabloon eerst een naam.",true);$("#mNaam").focus();break}
      const tid=M.tplId||newId("templates");await write("templates",tid,{naam:M.naam.trim(),onderwerp:M.onderwerp,body:M.body,isHtml:M.isHtml,groep:UI.mailGroep});M.tplId=tid;UI.mailTpl=tid;saveUI();toast("Sjabloon bewaard.");break}
    case"mailDel":confirmBox("Sjabloon <b>"+esc(MAIL.naam)+"</b> verwijderen?","Verwijderen",async()=>{await write("templates",MAIL.tplId,null,{del:true});MAIL=null;UI.mailTpl="";saveUI();render()});break;
    case"mailCopy":{const list=mailRecips().map(r=>r.email).join("; ");try{await navigator.clipboard.writeText(list);toast(mailRecips().length+" adressen gekopieerd.")}catch(err){modal("Adressen",`<textarea style="width:100%;min-height:200px" readonly id="adrTa">${esc(list)}</textarea><span style="color:var(--muted)">Selecteer alles en kopieer.</span>`,"");setTimeout(()=>{const ta=$("#adrTa");ta&&ta.select()},50)}break}
    case"mailTest":{const list=mailRecips();if(!list.length||!ME)break;await mailVerstuur([{...mailBericht(list[0],MAIL,ME.email),onderwerp:"[TEST] "+vul(MAIL.onderwerp,list[0])}],"testmail naar "+ME.email);break}
    case"mailSend":{const list=mailRecips();if(!list.length)break;const n=list.length,w=n===1?"mail":"mails";
      modal("Mails versturen",`<div class="stack" style="gap:12px"><p style="margin:0">Je staat op het punt om <b>${n} ${w}</b> te versturen. Dit kan niet ongedaan gemaakt worden.</p>
       <dl class="kv"><dt>Van</dt><dd>${esc((MAILSMTP&&MAILSMTP.van.naam?MAILSMTP.van.naam+" ":"")+"<"+(MAILSMTP&&MAILSMTP.van.email||"")+">")}</dd><dt>Onderwerp</dt><dd>${esc(vul(MAIL.onderwerp,list[0]))}</dd><dt>Eerste ontvangers</dt><dd>${list.slice(0,3).map(r=>esc(r.label||r.email)).join(", ")}${n>3?" en nog "+(n-3):""}</dd></dl>
       <label class="sp-nat"><input type="checkbox" id="msOk"><span><b>Ja, verstuur ${n} ${w}</b><small>Stuur bij twijfel eerst een testmail naar jezelf.</small></span></label></div>`,
       `<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="msGo" disabled>Versturen</button>`);
      $("#msOk").onchange=e=>{$("#msGo").disabled=!e.target.checked};
      $("#msGo").onclick=()=>{if(!$("#msOk").checked)return;closeModal();mailVerstuur(list.map(r=>mailBericht(r,MAIL)))};break}
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
    if(m){const el=$(m[0]);if(el)el.innerHTML=m[1]()}else if(t.dataset.input==="bkQ"){const el=$("#bkList");if(el)el.innerHTML=bkTable()}else if(t.dataset.input==="spQ"||t.dataset.input==="logQ"){const fid="#"+t.dataset.input;if(t.dataset.input==="logQ")UI.logN=100;clearTimeout(input.t);input.t=setTimeout(()=>{renderBody();const i=$(fid);if(i){i.focus();i.selectionStart=i.selectionEnd=i.value.length}},250)}}
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
  if(t.id==="bkFile"&&t.files[0]){bkRead(t.files[0]);return}
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
    if(t.dataset.jl==="_x"){const id=t.dataset.id,i=+t.dataset.xi;const L=extraLijnen(S.jaarleden.get(JAAR+"_"+id)||{}).map(x=>({...x}));if(!L[i])L[i]={tekst:"",punten:0};L[i][t.dataset.xf]=t.dataset.xf==="punten"?Math.max(0,Math.round(num(t.value))):t.value.trim();if(!L[i].tekst&&!L[i].punten&&L.length>1)L.splice(i,1);await saveExtras(id,L)}
    else if(t.dataset.jl){const f=t.dataset.jl;const v=f==="extraTekst"?t.value.trim():Math.max(0,num(t.value));await setJL(t.dataset.id,{[f]:v})}
    else{const v=Math.max(0,Math.round(num(t.value)));await setJLid(t.dataset.id,{[t.dataset.kal]:v})}
    const ae=document.activeElement;if(ae&&ae.dataset&&(ae.dataset.jl||ae.dataset.kal)&&ae!==t)pending=true;else if(PTR){pending=false;DEFER=true}else{pending=false;renderBody()}
    return}
  const c=t.dataset.change;if(!c)return;
  if(c==="ledenSortSel"){const v=t.value;UI.ledenSort={k:v,d:(v==="status"||v==="lidgeld")?-1:1};saveUI();$("#ledenList").innerHTML=ledenTable();return}
  if(c==="logT"||c==="logW"){UI[c]=t.value;UI.logN=100;renderBody();return}
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
  if(f.id==="fBk"){const d=formData(f);await write("config","banket",{...stripId(S.config.get("banket")),prijs:num(d.prijs)||65,deadline:String(d.deadline||"").trim(),...(/^\d{4}-\d{2}-\d{2}$/.test(d.datum||"")?{datum:d.datum}:{})});toast("Instellingen banket bewaard.");return}
  if(f.id==="fCfg"){const d=formData(f);const lines=s=>String(s).split("\n").map(x=>x.trim()).filter(Boolean);
    await write("config","algemeen",{...stripId(S.config.get("algemeen")),vereniging:d.vereniging.trim()});toast("Instellingen bewaard.");}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("#modal").innerHTML)closeModal()});
document.addEventListener("focusout",e=>{const t=e.target;if(t.dataset&&(t.dataset.kal||t.dataset.jl)){setTimeout(()=>{const ae=document.activeElement;if(!(ae&&ae.dataset&&(ae.dataset.kal||ae.dataset.jl))&&pending){pending=false;if(PTR)DEFER=true;else renderBody()}},0)}});


"use strict";
/* ============ Kinderfeest ============
   Inschrijvingen staan in de collectie "kinderfeest": {jaar, lid, lidId, email, opmerking, kinderen:[{naam,geb}], bron, aangemeld, gfKey}
   Instellingen per boekjaar in config/"kf_<jaar>": {datum, tijd, locatie, leeftijd, formUrl} */
ICON.kinderfeest='<path d="M4 11h16v10H4zM2.5 7.5h19V11h-19zM12 7.5V21"/><path d="M12 7.5C10.5 4 7 3.5 7 5.8 7 7.5 12 7.5 12 7.5zM12 7.5c1.5-3.5 5-4 5-1.7 0 1.7-5 1.7-5 1.7z"/>';
{const adm=NAV.find(n=>n.id==="administratie");if(adm&&!adm.items.some(i=>i[0]==="kinderfeest"))adm.items.push(["kinderfeest","Kinderfeest"]);}
if(!ROUTES.some(r=>r[0]==="kinderfeest"))ROUTES.push(["kinderfeest","Kinderfeest"]);
S.kinderfeest=S.kinderfeest||new Map();
const KF_PUBLIEK="/kinderfeest";
const KF_FORM="https://docs.google.com/forms/d/1nSPBTS3L0th1wRGPxII_8p30y5pv4ZaSZ8lQMhA2-TM/edit#responses";
const kfCfg=()=>Object.assign({datum:JAAR+"-12-19",tijd:"14u30",locatie:"VTI - Sinte Annalaan 99b, Aalst",leeftijd:12,formUrl:KF_PUBLIEK},S.config.get("kf_"+JAAR)||{});
let KFQ="";
function kfLeeftijd(geb,op){if(!geb||!/^\d{4}-\d{2}-\d{2}$/.test(geb))return null;const [y,m,d]=geb.split("-").map(Number);const [Y,M,D]=op.split("-").map(Number);let a=Y-y;if(M<m||(M===m&&D<d))a--;return a}
function kfLidVan(naam){const n=norm(naam);if(!n)return null;for(const l of S.leden.values()){const a=norm((l.voornaam||"")+" "+(l.naam||"")),b=norm((l.naam||"")+" "+(l.voornaam||""));if(n===a||n===b)return l}return null}
function kfLijst(){return [...S.kinderfeest.values()].filter(r=>r.jaar===JAAR).sort((a,b)=>String(b.aangemeld||"").localeCompare(String(a.aangemeld||"")))}
function kfStats(){const c=kfCfg(),L=kfLijst();const per=new Map();let kids=0,cadeau=0,ouder=0,onbekend=0;
  for(const r of L)for(const k of (r.kinderen||[])){kids++;const a=kfLeeftijd(k.geb,c.datum);if(a==null){onbekend++;cadeau++;continue}if(a>c.leeftijd){ouder++;continue}cadeau++;const x=Math.max(0,a);per.set(x,(per.get(x)||0)+1)}
  return {c,L,kids,cadeau,ouder,onbekend,per}}
function kfDubbel(L){const m={};for(const r of L){const e=norm(r.email);if(e)m[e]=(m[e]||0)+1}return m}

VIEWS.kinderfeest=()=>({title:"Kinderfeest",sub:"Inschrijvingen kinderfeest",
  actions:`<a class="btn" href="${KF_PUBLIEK}" target="_blank" rel="noopener" title="Openbare inschrijfpagina, om te delen met de leden (${esc(insStatus(kfCfg(),JAAR+"-12-07").label)})">${ic("deel")}Inschrijfpagina${insPill(insStatus(kfCfg(),JAAR+"-12-07"))}</a><button class="btn primary" data-w data-act="kfNieuw">${ic("plus")}Nieuwe inschrijving</button><button class="btn iconbtn" data-w data-act="kfInst" title="Instellingen kinderfeest" aria-label="Instellingen kinderfeest">${ic("instellingen")}</button>`,
  body(){const st=kfStats(),c=st.c;const q=norm(KFQ);const dub=kfDubbel(st.L);
    const list=q?st.L.filter(r=>norm([r.lid,r.email,r.opmerking,...(r.kinderen||[]).map(k=>k.naam)].join(" ")).includes(q)):st.L;
    const max=Math.max(1,...st.per.values());const ages=[];for(let a=0;a<=c.leeftijd;a++)ages.push(a);
    return `
    <div class="tiles"><div class="tile hero"><span class="lbl">Ingeschreven kinderen</span><span class="val">${st.kids}</span><span class="hint">${st.L.length} ${st.L.length===1?"inschrijving":"inschrijvingen"}</span></div>
      </div>
    <div class="panel"><div class="panel-h"><h2>Cadeautjes per leeftijd</h2></div><div class="panel-b"><div class="kf-ages">
      ${ages.map(a=>{const n=st.per.get(a)||0;return `<div class="kf-age${n?"":" zero"}"><b>${n}</b><i><em style="width:${Math.round(n/max*100)}%"></em></i><span>${a===0?"&lt; 1":a}<small> jaar</small></span></div>`}).join("")}
      ${st.onbekend?`<div class="kf-age"><b>${st.onbekend}</b><i><em style="width:0"></em></i><span>onbekend</span></div>`:""}
    </div></div></div>
    <div class="bar"><div class="search">${ic("search")}<input id="kfQ" data-kfq data-live placeholder="Zoek op lid, kind of e-mail" value="${esc(KFQ)}"></div></div>
    <div class="panel"><div class="tw" id="kfList">${kfTable(list,dub,c)}</div></div>`}});

function kfTable(list,dub,c){
  const mob=`<div class="mlist" role="list">${list.map(r=>{const l=kfLidVan(r.lid);const kids=r.kinderen||[];
    return `<button type="button" class="ml-row" role="listitem" data-act="kfToon" data-id="${esc(r.id)}"><span class="ml-m"><span class="ml-n"><b>${esc(r.lid)}</b>${l?"":' <span class="pill warn">niet in ledenlijst</span>'}${dub[norm(r.email)]>1?' <span class="pill warn">dubbel?</span>':""}</span>
      <span class="ml-s kf-ms">${kids.map(k=>{const a=kfLeeftijd(k.geb,c.datum);return `<span class="kf-k${a!=null&&a>c.leeftijd?" oud":""}">${esc(k.naam)}<span>${a==null?"?":a+" j"}</span></span>`}).join("")||"geen kinderen"}</span></span>
      <span class="pm-tot"><b>${kids.length}</b><small>${kids.length===1?"kind":"kinderen"}</small></span><span class="ml-chev" aria-hidden="true">›</span></button>`}).join("")||`<div class="empty">${KFQ?"Geen inschrijvingen gevonden.":"Nog geen inschrijvingen voor "+JAAR+"."}</div>`}</div>`;
  return mob+`<table class="rcards dsk-only"><thead><tr><th>Lid</th><th>E-mail</th><th>Kinderen</th><th class="num">Aantal</th><th>Ingeschreven</th><th>Bron</th></tr></thead><tbody>
  ${list.map(r=>{const l=kfLidVan(r.lid);const kids=r.kinderen||[];
    return `<tr class="click" data-act="kfToon" data-id="${esc(r.id)}"><td><b>${esc(r.lid)}</b>${l?"":' <span class="pill warn">niet in ledenlijst</span>'}${dub[norm(r.email)]>1?' <span class="pill warn">mogelijk dubbel</span>':""}${r.opmerking?`<div class="muted small">${esc(r.opmerking)}</div>`:""}</td>
    <td class="trunc">${esc(r.email)}</td>
    <td><div class="kf-kl">${kids.map(k=>{const a=kfLeeftijd(k.geb,c.datum);return `<span class="kf-k${a!=null&&a>c.leeftijd?" oud":""}">${esc(k.naam)}<span>${a==null?"?":a+" j"}</span></span>`}).join("")}</div></td>
    <td class="num">${kids.length}</td><td class="nowrap">${r.aangemeld?esc(fmtDate(String(r.aangemeld).slice(0,10))):""}</td>
    <td>${r.bron==="formulier"?'<span class="pill info">Formulier</span>':'<span class="pill neutral">Manueel</span>'}</td></tr>`}).join("")||`<tr><td colspan="6" class="empty">${KFQ?"Geen inschrijvingen gevonden.":"Nog geen inschrijvingen voor "+JAAR+"."}</td></tr>`}
  </tbody></table>`}

/* ---------- formulier met kinderen (+ kind toevoegen) ---------- */
function kfKidRow(k,i){return `<div class="kf-kid"><span class="kf-n">Kind ${i+1}</span><input class="kf-naam" data-kfk="naam" placeholder="Naam kind" aria-label="Naam kind ${i+1}" value="${esc(k.naam||"")}"><input class="kf-geb" data-kfk="geb" type="date" aria-label="Geboortedatum kind ${i+1}" value="${esc(k.geb||"")}"><button type="button" class="kf-del" data-kfdel title="Kind verwijderen" aria-label="Kind ${i+1} verwijderen">${ic("x")}</button></div>`}
function kfKidsRead(){return $$("#kfKids .kf-kid").map(el=>({naam:el.querySelector('[data-kfk=naam]').value.trim(),geb:el.querySelector('[data-kfk=geb]').value}))}
function kfKidsDraw(kids){const box=$("#kfKids");box.innerHTML=kids.map(kfKidRow).join("");const dels=$$("#kfKids .kf-del");if(dels.length===1)dels[0].disabled=true;if(!canWrite)$$("#kfKids input,#kfKids button").forEach(x=>x.disabled=true)}
function kfForm(r,id){
  const leden=[...S.leden.values()].map(naamVol).map(s=>s.trim()).filter(Boolean).sort((a,b)=>a.localeCompare(b,"nl"));
  modal(id?r.lid:"Nieuwe inschrijving kinderfeest",`<form id="fKf" class="form" autocomplete="off">
    ${fld("kfL","Naam lid *",inp("kfL",r.lid,'name="lid" list="kfLeden"'))}${fld("kfE","E-mailadres",inp("kfE",r.email,'name="email" type="email"'))}
    <datalist id="kfLeden">${leden.map(n=>`<option value="${esc(n)}">`).join("")}</datalist>
    <div class="fld full"><label>Kinderen *</label><div class="kf-kids" id="kfKids"></div>${canWrite?`<button type="button" class="kf-add" data-kfadd>${ic("plus")}Kind toevoegen</button>`:""}</div>
    ${fld("kfO","Opmerking",inp("kfO",r.opmerking,'name="opmerking"'),"full")}
    <div class="err full" id="kfErr"></div></form>`,
    `${id?'<button class="btn ghost danger" data-w id="kfDel">Verwijderen</button><span class="grow"></span>':""}<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" data-w id="kfOk">Bewaren</button>`);
  kfKidsDraw((r.kinderen&&r.kinderen.length)?r.kinderen:[{naam:"",geb:""}]);
  if(!canWrite)$$("#fKf input").forEach(i=>i.disabled=true);
  $("#kfOk").onclick=async()=>{const f={lid:$("#kfL").value,email:$("#kfE").value,opmerking:$("#kfO").value};const kids=kfKidsRead().filter(k=>k.naam||k.geb);
    if(!f.lid.trim()){$("#kfErr").textContent="Vul de naam van het lid in.";$("#kfL").focus();return}
    if(!kids.length){$("#kfErr").textContent="Voeg minstens één kind toe.";return}
    if(kids.some(k=>!k.naam)){$("#kfErr").textContent="Elk kind heeft een naam nodig.";return}
    const l=kfLidVan(f.lid);
    const d={...stripId(r),jaar:r.jaar||JAAR,lid:f.lid.trim(),lidId:l?l.id:null,email:f.email.trim()||(l&&l.email)||"",opmerking:f.opmerking.trim(),kinderen:kids,bron:r.bron||"manueel",aangemeld:r.aangemeld||new Date().toISOString()};
    closeModal();await write("kinderfeest",id||newId("kinderfeest"),d);toast("Inschrijving bewaard.")};
  if(id)$("#kfDel").onclick=()=>confirmBox("Inschrijving van <b>"+esc(r.lid)+"</b> verwijderen?","Verwijderen",async()=>{await write("kinderfeest",id,null,{del:true});toast("Inschrijving verwijderd.")});
}
function kfInst(){const c=kfCfg();
  modal("Kinderfeest "+JAAR,`<form id="fKfI" class="form">
    ${fld("kiD","Datum feest",inp("kiD",c.datum,'name="datum" type="date"'))}${fld("kiT","Uur",inp("kiT",c.tijd,'name="tijd"'))}
    ${fld("kiL","Locatie",inp("kiL",c.locatie,'name="locatie"'),"full")}
    ${fld("kiA","Cadeautje tot en met leeftijd",inp("kiA",c.leeftijd,'name="leeftijd" type="number" min="0" max="18"'))}
    <div class="fld"><label>&nbsp;</label><span class="help">De leeftijd wordt berekend op de dag van het feest.</span></div>
    ${insVelden(c,JAAR+"-12-07","")}
</form>`,
    `<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" data-w id="kiOk">Bewaren</button>`);
  $("#kiOk").onclick=async()=>{const f={datum:$("#kiD").value,tijd:$("#kiT").value,locatie:$("#kiL").value,leeftijd:$("#kiA").value},ins=insLees();closeModal();await write("config","kf_"+JAAR,{...stripId(S.config.get("kf_"+JAAR)||{}),open:ins.open,...(/^\d{4}-\d{2}-\d{2}$/.test(ins.inschrijvenTot)?{inschrijvenTot:ins.inschrijvenTot}:{}),datum:f.datum,tijd:f.tijd.trim(),locatie:f.locatie.trim(),leeftijd:Math.max(0,Math.round(num(f.leeftijd)))||12});toast("Instellingen kinderfeest bewaard.")}}

/* ---------- import uit Google Forms (antwoordenblad als .xlsx of .csv) ---------- */
let KFIMP=null;
function kfDatum(v){if(v==null||v==="")return "";
  if(v instanceof Date&&!isNaN(v))return v.getFullYear()+"-"+String(v.getMonth()+1).padStart(2,"0")+"-"+String(v.getDate()).padStart(2,"0");
  if(typeof v==="number"){const p=XLSX.SSF.parse_date_code(v);return p?p.y+"-"+String(p.m).padStart(2,"0")+"-"+String(p.d).padStart(2,"0"):""}
  const s=String(v).trim();let m=s.match(/^(\d{4})[\-\/.](\d{1,2})[\-\/.](\d{1,2})/);if(m)return m[1]+"-"+m[2].padStart(2,"0")+"-"+m[3].padStart(2,"0");
  m=s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);if(m){const y=m[3].length===2?"20"+m[3]:m[3];return y+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0")}return ""}
function kfTijd(v){const d=kfDatum(v);if(!d)return "";if(v instanceof Date)return v.toISOString();const m=String(v).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);return d+"T"+(m?m[1].padStart(2,"0")+":"+m[2]+":"+(m[3]||"00"):"12:00:00")}
function kfParse(rows){if(!rows.length)throw new Error("Het bestand is leeg.");
  const H=rows[0].map(h=>norm(h));const fi=re=>H.findIndex(h=>re.test(h));
  const iT=fi(/tijdstempel|timestamp/),iL=fi(/naam lid|^lid$|naam van het lid/),iE=fi(/e-?mail/);
  if(iL<0)throw new Error("Kolom 'Naam lid' niet gevonden. Gebruik het antwoordenblad van het formulier Kinderfeest.");
  const pairs=[];H.forEach((h,i)=>{if(i!==iL&&/^naam/.test(h)&&!/lid/.test(h)){let g=-1;for(let j=i+1;j<Math.min(H.length,i+3);j++)if(/geboorte/.test(H[j])){g=j;break}pairs.push([i,g])}});
  const out=[];
  for(const row of rows.slice(1)){const lid=String(row[iL]??"").trim();if(!lid)continue;
    const kids=pairs.map(([n,g])=>({naam:String(row[n]??"").trim(),geb:g>=0?kfDatum(row[g]):""})).filter(k=>k.naam);
    const ts=iT>=0?kfTijd(row[iT]):"";const email=iE>=0?String(row[iE]??"").trim():"";
    const key="gf-"+slug(email||lid)+"-"+(ts.replace(/\D/g,"").slice(0,14)||slug(kids.map(k=>k.naam).join("-")));
    out.push({key,lid,email,kinderen:kids,aangemeld:ts||new Date().toISOString()})}
  return out}
function kfImport(){KFIMP=null;
  modal("Google Forms importeren",`<p style="margin:0">Open het <a href="${KF_FORM}" target="_blank" rel="noopener">Google-formulier</a>, ga naar <b>Antwoorden</b> › <b>⋮</b> › <b>Antwoorden downloaden (.csv)</b> en kies hier het gedownloade bestand (.zip, .csv of .xlsx). Inschrijvingen die al geïmporteerd zijn, worden bijgewerkt in plaats van dubbel toegevoegd.</p>
    <div><label class="btn primary" for="kfFile" style="cursor:pointer">${ic("upload")}Bestand kiezen</label><input type="file" id="kfFile" accept=".zip,.csv,.xlsx,.xls" hidden></div><div id="kfImpArea"></div>`,"",{wide:true});}
async function kfReadFile(file){if(/\.zip$/i.test(file.name)){try{const z=await JSZip.loadAsync(await file.arrayBuffer());const f=Object.values(z.files).find(x=>/\.csv$/i.test(x.name));if(!f)throw new Error("Geen .csv gevonden in het zip-bestand.");kfRows(XLSX.read(await f.async("string"),{type:"string",raw:true}))}catch(e){$("#kfImpArea").innerHTML=`<div class="note">${esc(e.message||"Dit bestand kon niet gelezen worden.")}</div>`}return}
  const rd=new FileReader();const isCsv=/\.csv$/i.test(file.name);
  rd.onload=()=>{try{kfRows(isCsv?XLSX.read(String(rd.result),{type:"string",raw:true}):XLSX.read(new Uint8Array(rd.result),{type:"array",cellDates:true}))}
    catch(e){$("#kfImpArea").innerHTML=`<div class="note">${esc(e.message||"Dit bestand kon niet gelezen worden.")}</div>`}};
  isCsv?rd.readAsText(file):rd.readAsArrayBuffer(file)}
function kfRows(wb){const ws=wb.Sheets[wb.SheetNames[0]];const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:""});
  const items=kfParse(rows);const bestaand=new Map([...S.kinderfeest.values()].filter(r=>r.gfKey).map(r=>[r.gfKey,r]));
  KFIMP=items.map(x=>({...x,bestaat:bestaand.get(x.key)||null}));kfImpDraw()}
function kfImpDraw(){const L=KFIMP||[];const nieuw=L.filter(x=>!x.bestaat).length;const c=kfCfg();
  $("#kfImpArea").innerHTML=L.length?`<div class="sumbar boxed"><span><b>${L.length}</b> inschrijvingen</span><span><b>${L.reduce((s,x)=>s+x.kinderen.length,0)}</b> kinderen</span><span><b class="in">${nieuw}</b> nieuw</span><span><b>${L.length-nieuw}</b> al geïmporteerd (wordt bijgewerkt)</span><span>Boekjaar <b>${JAAR}</b></span></div>
    <div class="tw" style="max-height:340px"><table><thead><tr><th>Lid</th><th>E-mail</th><th>Kinderen</th><th>Ingeschreven</th><th></th></tr></thead><tbody>${L.map(x=>`<tr><td><b>${esc(x.lid)}</b></td><td class="trunc">${esc(x.email)}</td><td><div class="kf-kl">${x.kinderen.map(k=>{const a=kfLeeftijd(k.geb,c.datum);return `<span class="kf-k">${esc(k.naam)}<span>${a==null?"?":a+" j"}</span></span>`}).join("")}</div></td><td class="nowrap">${esc(fmtDate(x.aangemeld.slice(0,10)))}</td><td>${x.bestaat?'<span class="pill neutral">bestaat</span>':'<span class="pill ok">nieuw</span>'}</td></tr>`).join("")}</tbody></table></div>
    <div style="display:flex;justify-content:flex-end"><button class="btn primary" data-w id="kfImpGo">${L.length} inschrijvingen importeren</button></div>`:'<div class="note">Geen inschrijvingen gevonden in dit bestand.</div>';
  const b=$("#kfImpGo");if(b)b.onclick=async()=>{b.disabled=true;IMPORTING=true;
    const ops=L.map(x=>{const old=x.bestaat;const l=kfLidVan(x.lid);return ["kinderfeest",old?old.id:x.key,{...(old?stripId(old):{}),jaar:old?old.jaar:JAAR,lid:x.lid,lidId:l?l.id:null,email:x.email,kinderen:x.kinderen,opmerking:old?old.opmerking||"":"",bron:"formulier",aangemeld:x.aangemeld,gfKey:x.key}]});
    try{await writeMany(ops,()=>{})}catch(e){IMPORTING=false;handleWriteError(e);render();return}
    IMPORTING=false;closeModal();toast(L.length+" inschrijvingen geïmporteerd.");render(true)}}

/* ---------- export ---------- */
async function kfExport(){const st=kfStats(),c=st.c;const wb=XLSX.utils.book_new();
  const kids=[];for(const r of st.L)for(const k of (r.kinderen||[])){const a=kfLeeftijd(k.geb,c.datum);kids.push({Kind:k.naam,Geboortedatum:fmtDate(k.geb),"Leeftijd op feest":a??"",Cadeautje:a==null||a<=c.leeftijd?"ja":"nee",Lid:r.lid,"E-mail":r.email})}
  kids.sort((a,b)=>(a["Leeftijd op feest"]===""?99:a["Leeftijd op feest"])-(b["Leeftijd op feest"]===""?99:b["Leeftijd op feest"])||String(a.Kind).localeCompare(String(b.Kind),"nl"));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(kids),"Kinderen");
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(st.L.map(r=>({Lid:r.lid,"E-mail":r.email,"Aantal kinderen":(r.kinderen||[]).length,Kinderen:(r.kinderen||[]).map(k=>k.naam).join(", "),Ingeschreven:fmtDate(String(r.aangemeld||"").slice(0,10)),Bron:r.bron==="formulier"?"Formulier":"Manueel",Opmerking:r.opmerking||""}))),"Inschrijvingen");
  const ages=[];for(let a=0;a<=c.leeftijd;a++)ages.push({Leeftijd:a,"Aantal cadeautjes":st.per.get(a)||0});if(st.onbekend)ages.push({Leeftijd:"onbekend","Aantal cadeautjes":st.onbekend});
  XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(ages),"Cadeautjes");
  const out=XLSX.write(wb,{bookType:"xlsx",type:"array"});await save("Kinderfeest "+JAAR+".xlsx",new Blob([out],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}))}

/* ---------- events ---------- */
document.addEventListener("click",e=>{
  if(e.target.closest("[data-kfadd]")){const kids=kfKidsRead();kids.push({naam:"",geb:""});kfKidsDraw(kids);const ins=$$("#kfKids [data-kfk=naam]");ins[ins.length-1].focus();return}
  const del=e.target.closest("[data-kfdel]");if(del){const rows=$$("#kfKids .kf-kid");const i=rows.indexOf(del.closest(".kf-kid"));const kids=kfKidsRead();kids.splice(i,1);kfKidsDraw(kids.length?kids:[{naam:"",geb:""}]);return}
  const t=e.target.closest("[data-act]");if(!t)return;
  switch(t.dataset.act){
    case"kfNieuw":kfForm({},null);break;
    case"kfToon":{const r=S.kinderfeest.get(t.dataset.id);if(r)kfForm(r,r.id);break}
    case"kfInst":kfInst();break;
    case"kfImport":kfImport();break;
    case"kfExport":kfExport();break;
  }
});
document.addEventListener("input",e=>{if(e.target.dataset&&e.target.dataset.kfq!==undefined){KFQ=e.target.value;const st=kfStats();const q=norm(KFQ);
  const list=q?st.L.filter(r=>norm([r.lid,r.email,r.opmerking,...(r.kinderen||[]).map(k=>k.naam)].join(" ")).includes(q)):st.L;const el=$("#kfList");if(el)el.innerHTML=kfTable(list,kfDubbel(st.L),st.c)}});
document.addEventListener("change",e=>{if(e.target.id==="kfFile"&&e.target.files[0])kfReadFile(e.target.files[0])});

/* ============ Agenda: activiteitenkalender en vergaderingen (verslagen) ============
   Collecties: "activiteiten" {titel, datum (yyyy-mm-dd), uur, locatie, info}
               "vergaderingen" {soort, titel, datum, uur, locatie, agenda, aanwezig, verontschuldigd, verslag}
   Banket en kinderfeest komen automatisch in de kalender (datum uit hun instellingen). */
{const c=NAV.find(n=>n.id==="communicatie");
 if(c&&!c.items.some(i=>i[0]==="agenda"))c.items.unshift(["agenda","Agenda"]);}
if(!ROUTES.some(r=>r[0]==="agenda"))ROUTES.push(["agenda","Agenda"]);

ICON.verslagen='<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9.5 12.5h6M9.5 16.5h6"/>';
ICON.agenda='<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M7.5 14h2M11 14h2M14.5 14h2M7.5 17.5h2M11 17.5h2"/>';
const VG_SOORT=["Bestuursvergadering","Algemene vergadering","Werkgroep","Andere"];
const AG={m:null,dag:null,oud:false,q:""};
const agId=p=>p+"-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,6);
const agD=iso=>{const [y,m,d]=String(iso||"").split("-").map(Number);return new Date(y,(m||1)-1,d||1,12)};
const agLang=iso=>agD(iso).toLocaleDateString("nl-BE",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
const agKort=iso=>agD(iso).toLocaleDateString("nl-BE",{weekday:"short",day:"numeric",month:"short"});
const agDagen=iso=>Math.round((agD(iso)-agD(todayISO()))/864e5);
const agWanneer=iso=>{const n=agDagen(iso);return n===0?"vandaag":n===1?"morgen":n===-1?"gisteren":n>1&&n<=13?"over "+n+" dagen":n>13&&n<70?"over "+Math.round(n/7)+" weken":n<0?Math.abs(n)+" dagen geleden":""};
// Komt het item in de activiteitenmail ({agenda})? Activiteiten, banket en kinderfeest standaard wel; vergaderingen enkel de algemene.
const vgInMail=v=>typeof v.inMail==="boolean"?v.inMail:/algemene/i.test(v.soort||"");
const agMailVink=(id,aan)=>`<label class="sp-nat full" for="${id}"><input type="checkbox" id="${id}"${aan?" checked":""}${canWrite?"":" disabled"}><span><b>Opnemen in de activiteitenmail</b><small>Verschijnt als kader in mails met het blok {agenda}.</small></span></label>`;
function agItems(){const out=[];
  for(const a of S.activiteiten.values())if(a.datum)out.push({id:a.id,t:"act",datum:a.datum,uur:a.uur||"",titel:a.titel||"Activiteit",locatie:a.locatie||"",info:a.info||"",inMail:a.inMail!==false});
  for(const v of S.vergaderingen.values())if(v.datum)out.push({id:v.id,t:"verg",datum:v.datum,uur:v.uur||"",titel:v.titel||v.soort||"Vergadering",locatie:v.locatie||"",inMail:vgInMail(v)});
  try{const k=kfCfg();if(k.datum)out.push({id:"kf",t:"auto",href:"kinderfeest",datum:k.datum,uur:k.tijd||"",titel:"Kinderfeest",locatie:k.locatie||"",info:k.info||"",inMail:k.inMail!==false})}catch(e){}
  const b=bkCfg();if(b.datum)out.push({id:"bk",t:"auto",href:"banket",datum:b.datum,uur:b.uur||"",titel:"Banket",locatie:b.locatie||"",info:b.info||"",inMail:b.inMail!==false});
  return out.sort((x,y)=>(x.datum+x.uur).localeCompare(y.datum+y.uur))}
const agSoort=x=>x.t==="verg"?["verg","Vergadering"]:["act","Activiteit"];
const agAttr=x=>`data-act="${x.t==="verg"?"vgToon":x.t==="auto"?"agAuto":"agToon"}" data-id="${esc(x.id)}"`;
function agRij(x){const d=agD(x.datum),[c,l]=agSoort(x);const w=agWanneer(x.datum);
  return `<a class="ag-r" ${agAttr(x)}><span class="ag-dt ${c}"><b>${d.getDate()}</b><span>${d.toLocaleDateString("nl-BE",{month:"short"}).replace(".","")}</span></span>
  <span class="ag-m"><b class="trunc">${esc(x.titel)}${x.inMail?`<span class="ag-mail" title="Komt in de activiteitenmail" aria-label="Komt in de activiteitenmail">${ic("mails")}</span>`:""}</b><span class="trunc">${esc([agKort(x.datum),x.uur,x.locatie].filter(Boolean).join(" · "))}</span></span></a>`}

/* ---------- dashboard: mini-kalender en volgende vergadering ---------- */
function agMaand(L){const t=todayISO();const m=AG.m||t.slice(0,7);const [Y,M]=m.split("-").map(Number);
  const first=new Date(Y,M-1,1),start=(first.getDay()+6)%7,dim=new Date(Y,M,0).getDate();
  const per={};for(const x of L){if(x.datum.slice(0,7)===m)(per[x.datum]=per[x.datum]||[]).push(x)}
  let cells="";for(let i=0;i<start;i++)cells+="<span></span>";
  for(let d=1;d<=dim;d++){const iso=m+"-"+String(d).padStart(2,"0"),ev=per[iso]||[];
    cells+=`<button type="button" class="agc-d${iso===t?" nu":""}${ev.length?" ev":""}${AG.dag===iso?" sel":""}" data-act="agDag" data-v="${iso}" aria-label="${esc(agLang(iso))}${ev.length?": "+esc(ev.map(x=>x.titel).join(", ")):""}">${d}${ev.length?`<i>${ev.slice(0,3).map(x=>`<em class="${agSoort(x)[0]}"></em>`).join("")}</i>`:""}</button>`}
  const titel=first.toLocaleDateString("nl-BE",{month:"long",year:"numeric"});
  return `<div class="agc"><div class="agc-h"><button type="button" class="btn sm ghost" data-act="agMaand" data-v="-1" aria-label="Vorige maand">‹</button><b>${titel}</b><button type="button" class="btn sm ghost" data-act="agMaand" data-v="1" aria-label="Volgende maand">›</button></div>
  <div class="agc-g">${["ma","di","wo","do","vr","za","zo"].map(x=>`<span class="agc-w">${x}</span>`).join("")}${cells}</div></div>`}
function agBinnenkort(L){const t=todayISO();let R;
  if(AG.dag){R=L.filter(x=>x.datum===AG.dag);return `<div class="ag-sub"><span>${esc(agLang(AG.dag))}</span><button type="button" class="btn sm ghost" data-act="agDag" data-v="">Binnenkort tonen</button></div>`+(R.length?R.map(agRij).join(""):'<div class="empty" style="padding:10px 0">Niets gepland op deze dag.</div>')}
  R=L.filter(x=>x.datum>=t).slice(0,4);
  return `<div class="ag-sub"><span>Binnenkort</span></div>`+(R.length?R.map(agRij).join(""):'<div class="empty" style="padding:10px 0">Er staat niets gepland.</div>')}
function agVolgende(){const t=todayISO();const V=[...S.vergaderingen.values()].filter(v=>v.datum>=t).sort((a,b)=>(a.datum+(a.uur||"")).localeCompare(b.datum+(b.uur||"")));const v=V[0];
  const laatste=[...S.vergaderingen.values()].filter(x=>x.datum<t&&String(x.verslag||"").trim()).sort((a,b)=>b.datum.localeCompare(a.datum))[0];
  const lv=laatste?`<a class="vg-last" data-act="vgToon" data-id="${esc(laatste.id)}">${ic("verslagen")}<span>Laatste verslag: <b>${esc(laatste.titel||laatste.soort||"Vergadering")}</b> van ${esc(agKort(laatste.datum))}</span></a>`:"";
  if(!v)return `<div class="empty" style="padding:22px 0 18px">Er is nog geen volgende vergadering gepland.${canWrite?`<div style="margin-top:12px"><button class="btn" data-act="vgNieuw">${ic("plus")}Vergadering plannen</button></div>`:""}</div>${lv}`;
  const d=agD(v.datum),w=agWanneer(v.datum);
  return `<a class="vg-next" data-act="vgToon" data-id="${esc(v.id)}"><span class="vg-cal"><span>${d.toLocaleDateString("nl-BE",{month:"short"}).replace(".","")}</span><b>${d.getDate()}</b><span>${d.toLocaleDateString("nl-BE",{weekday:"short"})}</span></span>
   <span class="vg-i"><b>${esc(v.titel||v.soort||"Vergadering")}</b>${v.titel&&v.soort?`<span class="muted">${esc(v.soort)}</span>`:""}<span>${esc([agLang(v.datum),v.uur].filter(Boolean).join(" om "))}</span>${v.locatie?`<span class="muted">${esc(v.locatie)}</span>`:""}${w?`<span class="pill info" style="align-self:flex-start;margin-top:4px">${w}</span>`:""}</span></a>
   ${String(v.agenda||"").trim()?`<div class="vg-ag"><span class="lbl">Agenda</span><div>${esc(v.agenda)}</div></div>`:""}${lv}`}
function agendaSectie(){const t=todayISO(),R=agItems().filter(x=>x.datum>=t).slice(0,6);
  return `<section class="dsec" aria-label="Activiteiten"><div class="dsec-h"><span class="dsec-ic">${ic("agenda")}</span><h2>Agenda</h2><span class="grow"></span><a class="btn sm ghost" href="#agenda">Naar agenda ›</a></div>
  <div class="panel"><div class="ag-list big">${R.length?R.map(x=>{const [c,l]=agSoort(x);return agRij(x).replace('</a>',`<span class="pill ${c==="verg"?"info":"warn"}">${esc(l)}</span></a>`)}).join(""):`<div class="empty">Er staat niets gepland.${canWrite?` <a href="#agenda">Activiteit toevoegen</a>`:""}</div>`}</div></div></section>`}
function agDashRefresh(){const el=$("#agDash");if(!el)return;const L=agItems();el.innerHTML=agMaand(L)+`<div class="ag-list" id="agList">${agBinnenkort(L)}</div>`}

/* ---------- pagina Kalender (Activiteiten › Kalender) ---------- */
VIEWS.agenda=()=>({title:"Agenda",actions:'<button class="btn primary" data-w data-act="agNieuw">'+ic("plus")+'Toevoegen</button>',body(){
  const t=todayISO(),L=agItems(),R=AG.oud?L.filter(x=>x.datum<t).reverse():L.filter(x=>x.datum>=t);
  const groups=new Map();for(const x of R){const k=x.datum.slice(0,7);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(x)}
  return `<div class="bar"><div class="seg"><button type="button" data-act="agOud" data-v="0" class="${AG.oud?"":"on"}">Komend</button><button type="button" data-act="agOud" data-v="1" class="${AG.oud?"on":""}">Voorbij</button></div></div>
  ${groups.size?[...groups].map(([k,xs])=>`<div class="panel"><div class="panel-h"><h2 style="text-transform:capitalize">${agD(k+"-01").toLocaleDateString("nl-BE",{month:"long",year:"numeric"})}</h2><span class="grow"></span><span class="muted small">${xs.length} ${xs.length===1?"item":"items"}</span></div><div class="ag-list big">${xs.map(x=>{const [c,l]=agSoort(x);return agRij(x).replace('</a>',`<span class="pill ${c==="verg"?"info":"warn"}">${esc(l)}</span></a>`)}).join("")}</div></div>`).join(""):`<div class="panel"><div class="empty">${AG.oud?"Nog geen voorbije activiteiten.":"Er staat nog niets gepland."}${canWrite&&!AG.oud?`<div style="margin-top:12px"><button class="btn primary" data-act="agNieuw">${ic("plus")}Activiteit toevoegen</button></div>`:""}</div></div>`}`}});
const agTypeSel=t=>`<div class="fld full"><span class="lbl">Wat voeg je toe?</span><div class="seg ag-type"><button type="button" data-act="agType" data-v="act" class="${t==="act"?"on":""}">Activiteit</button><button type="button" data-act="agType" data-v="verg" class="${t==="verg"?"on":""}">Vergadering</button></div></div>`;
function agForm(a,id){const d=canWrite?"":" disabled";a=a||{};
  modal(id?"Activiteit wijzigen":"Toevoegen aan de agenda",`<form id="fAg" class="form">${id?"":agTypeSel("act")}
   ${fld("agT","Wat",inp("agT",a.titel,'maxlength="120" placeholder="bv. Jaarmarkt, Paasmaandagwandeling"'+d),"full")}
   ${fld("agD","Datum",`<input id="agD" type="date" value="${esc(a.datum||AG.dag||todayISO())}"${d}>`)}${fld("agU","Uur",inp("agU",a.uur,'maxlength="20" placeholder="bv. 14u00"'+d))}
   ${fld("agL","Waar",inp("agL",a.locatie,'maxlength="160"'+d),"full")}
   ${fld("agI","Meer info",`<textarea id="agI" maxlength="2000"${d}>${esc(a.info||"")}</textarea>`,"full")}${agMailVink("agM",a.inMail!==false)}<div class="err full" id="agErr"></div></form>`,
   `${id&&canWrite?'<button class="btn danger" id="agDel" style="margin-right:auto">Verwijderen</button>':""}<button class="btn" data-act="closeModal">${canWrite?"Annuleren":"Sluiten"}</button>${canWrite?'<button class="btn primary" id="agOk">Bewaren</button>':""}`);
  if(!canWrite)return;
  $("#agOk").onclick=async()=>{const r={titel:$("#agT").value.trim(),datum:$("#agD").value,uur:$("#agU").value.trim(),locatie:$("#agL").value.trim(),info:$("#agI").value.trim(),inMail:$("#agM").checked};
    if(!r.titel){$("#agErr").textContent="Vul in wat er te doen is.";return}if(!/^\d{4}-\d{2}-\d{2}$/.test(r.datum)){$("#agErr").textContent="Kies een datum.";return}
    closeModal();await write("activiteiten",id||agId("act"),{...(id?stripId(S.activiteiten.get(id)||{}):{}),...r});toast("Activiteit bewaard.")};
  const del=$("#agDel");if(del)del.onclick=()=>confirmBox(`<b>${esc(a.titel||"Deze activiteit")}</b> verwijderen?`,"Verwijderen",async()=>{await write("activiteiten",id,null,{del:true});toast("Activiteit verwijderd.")})}

/* ---------- banket en kinderfeest als agenda-item: zelfde eigenschappenscherm, bewaart in hun instellingen ---------- */
function agAutoForm(id){const bk=id==="bk",c=bk?bkCfg():kfCfg(),d=canWrite?"":" disabled",naam=bk?"Banket":"Kinderfeest";
  modal(naam,`<form id="fAa" class="form">
   ${fld("aaD","Datum",`<input id="aaD" type="date" value="${esc(c.datum||"")}"${d}>`)}${fld("aaU","Uur",inp("aaU",bk?c.uur:c.tijd,'maxlength="20" placeholder="bv. 19u00"'+d))}
   ${fld("aaL","Waar",inp("aaL",c.locatie,'maxlength="160"'+d),"full")}
   ${fld("aaI","Meer info",`<textarea id="aaI" maxlength="2000" placeholder="Komt in de activiteitenmail onder datum, uur en plaats"${d}>${esc(c.info||"")}</textarea>`,"full")}
   ${agMailVink("aaM",c.inMail!==false)}
   <div class="muted small full">Zolang de inschrijvingen open zijn, krijgt het kader in de mail ook een knop naar de inschrijfpagina. Prijs en inschrijvingen stel je in op de pagina ${naam.toLowerCase()}.</div>
   <div class="err full" id="aaErr"></div></form>`,
   `<a class="btn" href="#${bk?"banket":"kinderfeest"}" data-act="closeModal" style="margin-right:auto">Naar ${naam.toLowerCase()} ›</a><button class="btn" data-act="closeModal">${canWrite?"Annuleren":"Sluiten"}</button>${canWrite?'<button class="btn primary" id="aaOk">Bewaren</button>':""}`);
  if(!canWrite)return;
  $("#aaOk").onclick=async()=>{const r={datum:$("#aaD").value,locatie:$("#aaL").value.trim(),info:$("#aaI").value.trim(),inMail:$("#aaM").checked};const u=$("#aaU").value.trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(r.datum)){$("#aaErr").textContent="Kies een datum.";return}
    const k=bk?"banket":"kf_"+JAAR;closeModal();await write("config",k,{...stripId(S.config.get(k)||{}),...r,...(bk?{uur:u}:{tijd:u})});toast(naam+" bewaard.")}}

/* ---------- pagina Verslagen vergaderingen (Communicatie) ---------- */
VIEWS.verslagen=()=>({title:"Verslagen vergaderingen",actions:'<button class="btn primary" data-w data-act="vgNieuw">'+ic("plus")+'Nieuwe vergadering</button>',body(){
  const t=todayISO(),q=norm(AG.q);let L=[...S.vergaderingen.values()].filter(v=>v.datum);
  if(q)L=L.filter(v=>norm([v.titel,v.soort,v.locatie,v.agenda,v.verslag,v.aanwezig].join(" ")).includes(q));
  const komend=L.filter(v=>v.datum>=t).sort((a,b)=>a.datum.localeCompare(b.datum)),voorbij=L.filter(v=>v.datum<t).sort((a,b)=>b.datum.localeCompare(a.datum));
  const rij=v=>{const has=String(v.verslag||"").trim();const d=agD(v.datum);return `<a class="ag-r" data-act="vgToon" data-id="${esc(v.id)}"><span class="ag-dt verg"><b>${d.getDate()}</b><span>${d.toLocaleDateString("nl-BE",{month:"short"}).replace(".","")}</span></span>
    <span class="ag-m"><b class="trunc">${esc(v.titel||v.soort||"Vergadering")}</b><span class="trunc">${esc([agLang(v.datum),v.uur,v.locatie].filter(Boolean).join(" · "))}</span></span>
    ${v.datum>=t?`<span class="pill info">gepland</span>`:has?`<span class="pill ok">verslag</span>`:`<span class="pill warn">nog geen verslag</span>`}</a>`};
  return `<div class="bar"><div class="search">${ic("search")}<input id="vgQ" data-vgq placeholder="Zoek in agenda's en verslagen" value="${esc(AG.q)}"></div></div><div id="vgList">
  ${komend.length?`<div class="panel"><div class="panel-h"><h2>Gepland</h2></div><div class="ag-list big">${komend.map(rij).join("")}</div></div>`:""}
  <div class="panel"><div class="panel-h"><h2>Voorbije vergaderingen</h2><span class="grow"></span><span class="muted small">${voorbij.length}</span></div><div class="ag-list big">${voorbij.map(rij).join("")||`<div class="empty">${q?"Niets gevonden.":"Nog geen vergaderingen."}</div>`}</div></div></div>`}});
function vgForm(v,id){const d=canWrite?"":" disabled";v=v||{soort:"Bestuursvergadering",datum:AG.dag||todayISO(),uur:"20u00"};
  const ta=(k,l,ph,h)=>fld("vg_"+k,l,`<textarea id="vg_${k}" style="min-height:${h}px" placeholder="${ph}"${d}>${esc(v[k]||"")}</textarea>`,"full");
  modal(id?(v.titel||v.soort||"Vergadering")+" · "+fmtDate(v.datum):(AG.fromKal?"Toevoegen aan de agenda":"Nieuwe vergadering"),`<form id="fVg" class="form">${id||!AG.fromKal?"":agTypeSel("verg")}
   ${fld("vg_soort","Soort",`<select id="vg_soort" class="sel"${d}>${selOpts(VG_SOORT,v.soort||"Bestuursvergadering")}</select>`)}${fld("vg_titel","Titel (optioneel)",inp("vg_titel",v.titel,'maxlength="120" placeholder="bv. Voorbereiding banket"'+d))}
   ${fld("vg_datum","Datum",`<input id="vg_datum" type="date" value="${esc(v.datum||"")}"${d}>`)}${fld("vg_uur","Uur",inp("vg_uur",v.uur,'maxlength="20" placeholder="bv. 20u00"'+d))}
   ${fld("vg_locatie","Waar",inp("vg_locatie",v.locatie,'maxlength="160" placeholder="bv. Kazerne, refter"'+d),"full")}
   ${ta("agenda","Agenda","Eén punt per regel",110)}
   ${agMailVink("vg_mail",vgInMail(v))}
<div class="err full" id="vgErr"></div></form>`,
   `${id&&canWrite?'<button class="btn danger" id="vgDel" style="margin-right:auto">Verwijderen</button>':""}<button class="btn" data-act="closeModal">${canWrite?"Annuleren":"Sluiten"}</button>${canWrite?'<button class="btn primary" id="vgOk">Bewaren</button>':""}`,{});
  const pr=$("#vgPrint");if(pr)pr.onclick=()=>vgPrint(S.vergaderingen.get(id)||v);
  if(!canWrite)return;
  $("#vgOk").onclick=async()=>{const g=k=>$("#vg_"+k).value.trim();const r={soort:$("#vg_soort").value,titel:g("titel"),datum:$("#vg_datum").value,uur:g("uur"),locatie:g("locatie"),agenda:g("agenda"),inMail:$("#vg_mail").checked};
    if(!/^\d{4}-\d{2}-\d{2}$/.test(r.datum)){$("#vgErr").textContent="Kies een datum.";return}
    closeModal();await write("vergaderingen",id||agId("verg"),{...(id?stripId(S.vergaderingen.get(id)||{}):{}),...r});toast("Vergadering bewaard.")};
  const del=$("#vgDel");if(del)del.onclick=()=>confirmBox(`De vergadering van <b>${esc(fmtDate(v.datum))}</b> en het verslag verwijderen?`,"Verwijderen",async()=>{await write("vergaderingen",id,null,{del:true});toast("Vergadering verwijderd.")})}
function vgPrint(v){const w=window.open("","_blank");if(!w){toast("Je browser blokkeerde het afdrukvenster.",true);return}
  const blok=(t,x)=>String(x||"").trim()?`<h2>${t}</h2><div class="t">${esc(x)}</div>`:"";
  w.document.write(`<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>${esc((v.titel||v.soort||"Vergadering")+" "+fmtDate(v.datum))}</title><style>body{font:14px/1.55 system-ui,sans-serif;max-width:720px;margin:32px auto;padding:0 20px;color:#111}h1{font-size:22px;margin:0 0 4px}.m{color:#555;margin:0 0 22px}h2{font-size:13px;text-transform:uppercase;letter-spacing:.05em;color:#555;margin:22px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px}.t{white-space:pre-wrap}.v{color:#777;font-size:12px;margin-bottom:6px}</style></head><body>
  <div class="v">${esc(cfg().vereniging||"")}</div><h1>${esc(v.titel||v.soort||"Vergadering")}</h1><p class="m">${esc([v.titel?v.soort:"",agLang(v.datum),v.uur,v.locatie].filter(Boolean).join(" · "))}</p>
  ${blok("Aanwezig",v.aanwezig)}${blok("Verontschuldigd",v.verontschuldigd)}${blok("Agenda",v.agenda)}${blok("Verslag",v.verslag)}<script>setTimeout(()=>print(),300)<\/script></body></html>`);w.document.close()}

/* ---------- events ---------- */
document.addEventListener("click",e=>{const t=e.target.closest("[data-act]");if(!t)return;
  switch(t.dataset.act){
    case"agMaand":{e.preventDefault();const b=(AG.m||todayISO().slice(0,7)).split("-").map(Number);const d=new Date(b[0],b[1]-1+Number(t.dataset.v),1);AG.m=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0");AG.dag=null;agDashRefresh();break}
    case"agDag":e.preventDefault();AG.dag=t.dataset.v&&AG.dag!==t.dataset.v?t.dataset.v:null;agDashRefresh();break;
    case"agOud":AG.oud=t.dataset.v==="1";render(true);break;
    case"agNieuw":AG.fromKal=true;agForm(null,null);break;
    case"agType":{e.preventDefault();const g=x=>{const el=$("#"+x);return el?el.value:""};
      if(t.dataset.v==="verg"&&$("#fAg")){const v={soort:"Bestuursvergadering",titel:g("agT"),datum:g("agD"),uur:g("agU")||"20u00",locatie:g("agL"),agenda:g("agI")};AG.fromKal=true;vgForm(v,null)}
      else if(t.dataset.v==="act"&&$("#fVg")){agForm({titel:g("vg_titel"),datum:g("vg_datum"),uur:g("vg_uur"),locatie:g("vg_locatie"),info:g("vg_agenda")},null)}break}
    case"agAuto":e.preventDefault();agAutoForm(t.dataset.id);break;
    case"agToon":{e.preventDefault();const a=S.activiteiten.get(t.dataset.id);if(a)agForm(a,a.id);break}
    case"vgNieuw":AG.fromKal=false;vgForm(null,null);break;
    case"vgToon":{e.preventDefault();const v=S.vergaderingen.get(t.dataset.id);if(v)vgForm(v,v.id);break}
  }});
document.addEventListener("input",e=>{if(e.target.dataset&&e.target.dataset.vgq!==undefined){AG.q=e.target.value;const pos=e.target.selectionStart;render(true);const i=$("#vgQ");if(i){i.focus();try{i.setSelectionRange(pos,pos)}catch(x){}}}});

/* ============ Documenten (Administratie › Documenten) ============
   Bestanden in Supabase Storage (bucket "documenten", privé), gegevens in de tabel "documenten":
   {naam, pad, map, grootte, type, omschrijving, door, op} */
const DOC_BUCKET="documenten";
const DOC_MAPPEN=["Draaiboeken","Verslagen","Brieven","Reglementen","Andere"];
const DOC={map:"",q:"",busy:false};
{const a=NAV.find(n=>n.id==="communicatie");if(a&&!a.items.some(i=>i[0]==="documenten")){const k=a.items.findIndex(i=>i[0]==="mails");a.items.splice(k<0?a.items.length:k,0,["documenten","Documenten"])}}
if(!ROUTES.some(r=>r[0]==="documenten"))ROUTES.push(["documenten","Documenten"]);
ICON.link='<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>';
ICON.documenten='<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>';
const docKB=n=>n<1024?n+" B":n<1048576?Math.round(n/1024)+" kB":(n/1048576).toLocaleString("nl-BE",{maximumFractionDigits:1})+" MB";
const docExt=n=>{const m=String(n||"").match(/\.([a-z0-9]{1,5})$/i);return m?m[1].toLowerCase():""};
const docKleur=e=>/^(pdf)$/.test(e)?"pdf":/^(docx?|odt|rtf|txt)$/.test(e)?"doc":/^(xlsx?|xlsm|ods|csv)$/.test(e)?"xls":/^(pptx?|odp)$/.test(e)?"ppt":/^(jpe?g|png|gif|webp|heic|svg)$/.test(e)?"img":"oth";
const docVeilig=n=>String(n).normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^A-Za-z0-9._-]+/g,"_").replace(/_+/g,"_").slice(-90)||"bestand";
function docLijst(){let L=[...S.documenten.values()];if(DOC.map)L=L.filter(d=>d.map===DOC.map);
  const q=norm(DOC.q);if(q)L=L.filter(d=>norm([d.naam,d.map,d.omschrijving,d.door].join(" ")).includes(q));
  return L.sort((a,b)=>String(b.op||"").localeCompare(String(a.op||"")))}
function docTabel(){const L=docLijst();const dt=s=>{const d=new Date(s);return isNaN(d)?"":d.toLocaleDateString("nl-BE",{day:"numeric",month:"short",year:"numeric"})};
  const mob=`<div class="mlist" role="list">${L.map(d=>{const e=docExt(d.naam);return `<div class="ml-row doc-mr" role="listitem"><a class="doc-n" data-act="docOpen" data-id="${esc(d.id)}" href="#documenten"><span class="doc-ic ${docKleur(e)}">${esc((e||"?").slice(0,4).toUpperCase())}</span>
    <span class="ml-m"><span class="ml-n"><b>${esc(d.naam)}</b></span><span class="ml-s">${esc(d.map||"Andere")}<span class="ml-dot">·</span>${docKB(d.grootte||0)}<span class="ml-dot">·</span>${dt(d.op)}</span>${d.rol?`<span class="doc-rol">${ic("link")}Knop ${d.rol==="sponsordossier"?"Sponsordossier":"Reglement"}</span>`:""}${d.omschrijving?`<span class="ml-s">${esc(d.omschrijving)}</span>`:""}</span></a>
    <span class="doc-ma"><button type="button" class="iconbtn2" data-act="docDown" data-id="${esc(d.id)}" aria-label="${esc(d.naam)} downloaden">${ic("download")}</button>${canWrite?`<button type="button" class="iconbtn2" data-act="docEdit" data-id="${esc(d.id)}" aria-label="${esc(d.naam)} wijzigen">${ic("instellingen")}</button>`:""}</span></div>`}).join("")||`<div class="empty">${DOC.q||DOC.map?"Geen documenten gevonden.":"Nog geen documenten."}</div>`}</div>`;
  return mob+`<div class="tw dsk-only"><table class="rcards doct" data-main="0"><thead><tr><th>Naam</th><th>Map</th><th class="num">Grootte</th><th>Toegevoegd</th><th></th></tr></thead><tbody>
  ${L.map(d=>{const e=docExt(d.naam);return `<tr><td><a class="doc-n" data-act="docOpen" data-id="${esc(d.id)}" href="#documenten"><span class="doc-ic ${docKleur(e)}">${esc((e||"?").slice(0,4).toUpperCase())}</span><span class="doc-t"><b>${esc(d.naam)}</b>${d.rol?`<span class="doc-rol">${ic("link")}Knop ${d.rol==="sponsordossier"?"Sponsordossier":"Reglement"}</span>`:""}${d.omschrijving?`<span>${esc(d.omschrijving)}</span>`:""}</span></a></td>
   <td><span class="pill neutral">${esc(d.map||"Andere")}</span></td><td class="num nowrap muted">${docKB(d.grootte||0)}</td><td class="nowrap muted">${dt(d.op)}${d.door?`<div class="small">${esc(d.door)}</div>`:""}</td>
   <td class="nowrap doc-a"><button type="button" class="btn sm" data-act="docDown" data-id="${esc(d.id)}" title="Downloaden" aria-label="${esc(d.naam)} downloaden">${ic("download")}</button>${canWrite?`<button type="button" class="btn sm" data-act="docEdit" data-id="${esc(d.id)}" title="Wijzigen" aria-label="${esc(d.naam)} wijzigen">${ic("instellingen")}</button>`:""}</td></tr>`}).join("")||`<tr><td colspan="5" class="empty">${DOC.q||DOC.map?"Geen documenten gevonden.":"Nog geen documenten. Sleep bestanden hierboven of klik op Bestanden kiezen."}</td></tr>`}
  </tbody></table></div>`}
VIEWS.documenten=()=>({title:"Documenten",body(){const all=[...S.documenten.values()];const n=m=>all.filter(d=>d.map===m).length;
  return `${canWrite?`<div class="doc-up"><div class="doc-drop" id="docDrop"><span class="doc-drop-ic">${ic("upload")}</span><span class="doc-drop-t"><span><b>Sleep bestanden hierheen</b> of <label for="docFile" class="doc-lnk">kies bestanden</label></span><small>Draaiboeken, verslagen, brieven… tot 50 MB per bestand</small></span>
    <span class="doc-drop-map"><label for="docMap">Opladen in map</label><select id="docMap" class="sel">${selOpts(DOC_MAPPEN,DOC.map||"Draaiboeken")}</select></span></div><input type="file" id="docFile" multiple hidden><label for="docFile" class="btn primary doc-mup">${ic("upload")}Bestand opladen</label><div id="docProg"></div></div>`:""}
  <div class="bar"><div class="search">${ic("search")}<input id="docQ" data-docq placeholder="Zoek op naam of omschrijving" value="${esc(DOC.q)}"></div>
   <div class="seg doc-seg">${[["","Alle",all.length],...DOC_MAPPEN.map(m=>[m,m,n(m)])].map(([v,l,c])=>`<button type="button" data-act="docMapF" data-v="${esc(v)}" class="${DOC.map===v?"on":""}">${esc(l)}${c?` <span class="muted">${c}</span>`:""}</button>`).join("")}</div></div>
  <div class="panel" id="docList">${docTabel()}</div>`}});
async function docUpload(files){if(!canWrite||!files||!files.length)return;const map=($("#docMap")||{}).value||"Andere";const prog=$("#docProg");let ok=0,fout=[];
  DOC.busy=true;
  for(const f of files){if(f.size>50*1048576){fout.push(f.name+" (groter dan 50 MB)");continue}
    if(prog)prog.innerHTML=`<div class="note info">Bezig met opladen: <b>${esc(f.name)}</b> (${ok+fout.length+1} van ${files.length})…</div>`;
    const id=agId("doc"),pad=`${docVeilig(map)}/${id}-${docVeilig(f.name)}`;
    try{const {error}=await SB.storage.from(DOC_BUCKET).upload(pad,f,{contentType:f.type||"application/octet-stream",upsert:false});if(error)throw error;
      await write("documenten",id,{naam:f.name,pad,map,grootte:f.size,type:f.type||"",omschrijving:"",door:ME_NAME||"",op:new Date().toISOString()});ok++}
    catch(e){fout.push(f.name+(e&&e.message?" ("+e.message+")":""))}}
  DOC.busy=false;if(prog)prog.innerHTML=fout.length?`<div class="note">Niet gelukt: ${fout.map(esc).join(", ")}</div>`:"";
  if(ok)toast(ok===1?"Document opgeladen.":ok+" documenten opgeladen.");render(true)}
async function docUrl(d,download){const {data,error}=await SB.storage.from(DOC_BUCKET).createSignedUrl(d.pad,120,download?{download:d.naam}:undefined);if(error)throw error;return data.signedUrl}
async function docOpen(d,download){const w=download?null:window.open("","_blank");
  try{const u=await docUrl(d,download);if(w)w.location.href=u;else{const a=document.createElement("a");a.href=u;a.rel="noopener";document.body.append(a);a.click();a.remove()}}
  catch(e){if(w)w.close();toast("Het document kon niet geopend worden"+(e&&e.message?": "+e.message:"")+".",true)}}
function docEdit(d){
  modal("Document",`<form id="fDoc" class="form">${fld("dcN","Naam",inp("dcN",d.naam,'maxlength="160"'),"full")}${fld("dcM","Map",`<select id="dcM" class="sel">${selOpts(DOC_MAPPEN,d.map||"Andere")}</select>`)}${fld("dcG","Grootte",`<input id="dcG" value="${esc(docKB(d.grootte||0))}" disabled>`)}${fld("dcR","Koppelen aan knop",`<select id="dcR" class="sel">${selOpts(DOC_ROLLEN,d.rol||"")}</select>`,"full")}
  ${fld("dcO","Omschrijving",`<textarea id="dcO" maxlength="400" placeholder="Optioneel, bv. voor welk jaar of welke activiteit">${esc(d.omschrijving||"")}</textarea>`,"full")}</form>`,
  `<button class="btn danger" id="dcDel" style="margin-right:auto">Verwijderen</button><button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="dcOk">Bewaren</button>`);
  $("#dcOk").onclick=async()=>{const r={naam:$("#dcN").value.trim()||d.naam,map:$("#dcM").value,omschrijving:$("#dcO").value.trim(),rol:$("#dcR").value};closeModal();if(r.rol)for(const o of S.documenten.values())if(o.id!==d.id&&o.rol===r.rol)await write("documenten",o.id,{...stripId(o),rol:""});await write("documenten",d.id,{...stripId(d),...r});toast("Document bewaard.")};
  $("#dcDel").onclick=()=>confirmBox(`<b>${esc(d.naam)}</b> definitief verwijderen?`,"Verwijderen",async()=>{
    try{const {error}=await SB.storage.from(DOC_BUCKET).remove([d.pad]);if(error)throw error}catch(e){toast("Het bestand kon niet verwijderd worden: "+(e&&e.message||""),true);return}
    await write("documenten",d.id,null,{del:true});toast("Document verwijderd.")})}

/* gekoppelde documenten: een document kan dienen als "Sponsordossier" (knop op Sponsors) of "Reglement" (knop op Puntensysteem) */
const DOC_ROLLEN=[["","Niet gekoppeld"],["sponsordossier","Knop Sponsordossier (Sponsors)"],["reglement","Knop Reglement (Puntensysteem)"]];
const DOC_ROL_ZOEK={sponsordossier:/sponsor\s*dossier|sponsordossier/i,reglement:/reglement/i};
function docVoorRol(rol){const L=[...S.documenten.values()].sort((a,b)=>String(b.op||"").localeCompare(String(a.op||"")));
  return L.find(d=>d.rol===rol)||L.find(d=>!d.rol&&DOC_ROL_ZOEK[rol]&&DOC_ROL_ZOEK[rol].test(d.naam||""))||null}
document.addEventListener("click",e=>{const t=e.target.closest('[data-act="docRol"]');if(!t)return;const d=docVoorRol(t.dataset.v);
  if(d){docOpen(d,false);return}
  if(t.dataset.v==="reglement"&&typeof toonReglement==="function"){toonReglement();return}
  toast("Er is nog geen sponsordossier. Laad het op bij Administratie › Documenten en koppel het via het tandwieltje.",true)});
document.addEventListener("click",e=>{const t=e.target.closest("[data-act]");if(!t)return;const d=S.documenten.get(t.dataset.id);
  switch(t.dataset.act){
    case"docMapF":DOC.map=t.dataset.v;render(true);break;
    case"docOpen":e.preventDefault();if(d)docOpen(d,false);break;
    case"docDown":if(d)docOpen(d,true);break;
    case"docEdit":if(d)docEdit(d);break;
  }});
document.addEventListener("change",e=>{if(e.target.id==="docFile"){docUpload([...e.target.files]);e.target.value=""}});
document.addEventListener("input",e=>{if(e.target.dataset&&e.target.dataset.docq!==undefined){DOC.q=e.target.value;const el=$("#docList");if(el)el.innerHTML=docTabel()}});
["dragenter","dragover"].forEach(ev=>document.addEventListener(ev,e=>{const z=e.target.closest&&e.target.closest("#docDrop");if(!z)return;e.preventDefault();z.classList.add("on")}));
["dragleave","drop"].forEach(ev=>document.addEventListener(ev,e=>{const z=e.target.closest&&e.target.closest("#docDrop");if(!z)return;e.preventDefault();z.classList.remove("on");if(ev==="drop"&&e.dataTransfer&&e.dataTransfer.files.length)docUpload([...e.dataTransfer.files])}));

/* ============ Foto's (Activiteiten › Foto's) ============
   Collectie "fotoalbums": {titel, jaar, datum, link, fotograaf, omschrijving, cover} — een album is een link naar een externe galerij (bv. Pixieset). */
{const a=NAV.find(n=>n.id==="administratie");if(a&&!a.items.some(i=>i[0]==="fotos"))a.items.push(["fotos","Foto's"]);}
if(!ROUTES.some(r=>r[0]==="fotos"))ROUTES.push(["fotos","Foto's"]);
ICON.fotos='<rect x="3" y="6" width="18" height="14" rx="2.5"/><path d="M8.5 6l1.5-2h4l1.5 2"/><circle cx="12" cy="13" r="3.6"/>';
const FT={q:""};
const ftLink=u=>/^https?:\/\//i.test(String(u||"").trim())?String(u).trim():"";
const ftHost=u=>{try{return new URL(u).hostname.replace(/^www\./,"")}catch(e){return""}};
function ftLijst(){const q=norm(FT.q);let L=[...S.fotoalbums.values()];if(q)L=L.filter(a=>norm([a.titel,a.jaar,a.fotograaf,a.omschrijving].join(" ")).includes(q));
  return L.sort((a,b)=>String(b.datum||b.jaar||"").localeCompare(String(a.datum||a.jaar||""))||String(a.titel||"").localeCompare(String(b.titel||""),"nl"))}
function ftKaarten(){const L=ftLijst();
  if(!L.length)return `<div class="panel"><div class="empty">${FT.q?"Geen albums gevonden.":"Nog geen fotoalbums."}${canWrite&&!FT.q?`<div style="margin-top:12px"><button class="btn primary" data-act="ftNieuw">${ic("plus")}Album toevoegen</button></div>`:""}</div></div>`;
  return `<div class="ft-grid">${L.map(a=>{const u=ftLink(a.link),c=ftLink(a.cover);const sub=[a.datum?fmtDate(a.datum):a.jaar,a.fotograaf].filter(Boolean).join(" · ");
    return `<div class="ft-card">${u?`<a class="ft-hit" href="${esc(u)}" target="_blank" rel="noopener" aria-label="${esc(a.titel||"Album")} openen"></a>`:""}<div class="ft-img${c?"":" leeg"}" >${c?`<img src="${esc(c)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:`<span>${ic("fotos")}</span>`}</div>
      <div class="ft-b"><div class="ft-t"><b>${esc(a.titel||"Album")}</b>${sub?`<span>${esc(sub)}</span>`:""}${a.omschrijving?`<span class="ft-o">${esc(a.omschrijving)}</span>`:""}</div>
      ${canWrite?`<button type="button" class="btn sm iconbtn ft-edit" data-act="ftEdit" data-id="${esc(a.id)}" aria-label="Album wijzigen" title="Wijzigen">${ic("instellingen")}</button>`:""}
      ${u?`<div class="ft-h">${esc(ftHost(u))}</div>`:""}</div></div>`}).join("")}</div>`}
VIEWS.fotos=()=>({title:"Foto's",actions:'<button class="btn primary" data-w data-act="ftNieuw">'+ic("plus")+'Album toevoegen</button>',body(){
  return `<div class="bar"><div class="search">${ic("search")}<input id="ftQ" data-ftq placeholder="Zoek album, jaar of fotograaf" value="${esc(FT.q)}"></div></div><div id="ftList">${ftKaarten()}</div>`}});
function ftForm(a,id){a=a||{jaar:JAAR};
  modal(id?"Album wijzigen":"Fotoalbum toevoegen",`<form id="fFt" class="form">
   ${fld("ftT","Titel",inp("ftT",a.titel,'maxlength="120" placeholder="bv. Banket 2025"'),"full")}
   ${fld("ftL","Link naar het album",inp("ftL",a.link,'type="url" maxlength="400" placeholder="https://…"'),"full")}
   ${fld("ftJ","Jaar",inp("ftJ",a.jaar,'inputmode="numeric" maxlength="4"'))}${fld("ftD","Datum (optioneel)",`<input id="ftD" type="date" value="${esc(a.datum||"")}">`)}
   ${fld("ftF","Fotograaf",inp("ftF",a.fotograaf,'maxlength="120"'),"full")}
   ${fld("ftC","Coverfoto (link naar een afbeelding, optioneel)",inp("ftC",a.cover,'type="url" maxlength="600" placeholder="Rechtermuisklik op een foto › Afbeeldingsadres kopiëren"'),"full")}
   ${fld("ftO","Omschrijving",`<textarea id="ftO" maxlength="400">${esc(a.omschrijving||"")}</textarea>`,"full")}<div class="err full" id="ftErr"></div></form>`,
   `${id?'<button class="btn danger" id="ftDel" style="margin-right:auto">Verwijderen</button>':""}<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="ftOk">Bewaren</button>`);
  $("#ftOk").onclick=async()=>{const r={titel:$("#ftT").value.trim(),link:$("#ftL").value.trim(),jaar:parseInt($("#ftJ").value,10)||null,datum:$("#ftD").value,fotograaf:$("#ftF").value.trim(),cover:$("#ftC").value.trim(),omschrijving:$("#ftO").value.trim()};
    if(!r.titel){$("#ftErr").textContent="Geef het album een titel.";return}if(!ftLink(r.link)){$("#ftErr").textContent="Vul de link naar het album in (begint met https://).";return}
    if(r.datum&&!r.jaar)r.jaar=Number(r.datum.slice(0,4));closeModal();await write("fotoalbums",id||agId("album"),{...(id?stripId(S.fotoalbums.get(id)||{}):{}),...r});toast("Album bewaard.")};
  const del=$("#ftDel");if(del)del.onclick=()=>confirmBox(`Album <b>${esc(a.titel||"")}</b> verwijderen? De foto's zelf blijven gewoon in de externe galerij staan.`,"Verwijderen",async()=>{await write("fotoalbums",id,null,{del:true});toast("Album verwijderd.")})}
document.addEventListener("click",e=>{const t=e.target.closest("[data-act]");if(!t)return;
  if(t.dataset.act==="ftNieuw")ftForm(null,null);
  else if(t.dataset.act==="ftEdit"){const a=S.fotoalbums.get(t.dataset.id);if(a)ftForm(a,a.id)}});
document.addEventListener("input",e=>{if(e.target.dataset&&e.target.dataset.ftq!==undefined){FT.q=e.target.value;const el=$("#ftList");if(el)el.innerHTML=ftKaarten()}});

/* ============ Mails: sjablonen in huisstijl, doelgroepen, voorbeeld en verzendgeschiedenis ============
   Sjabloon (collectie "templates"): {naam, categorie, groep, onderwerp, body, opmaak:"huisstijl", isHtml:true}
     body = inhoud in eenvoudige HTML (p, h3, strong, em, a, ul/li, <div data-blok="kader">, <p data-blok="knop">);
     bij verzenden wordt die in de huisstijl gezet (logo, rode balken, kaders met gouden rand) met inline stijlen.
   Oudere sjablonen: isHtml zonder opmaak = volledige HTML zoals opgeladen; zonder isHtml = gewone tekst.
   Verzendgeschiedenis: collectie "mailings" {datum, onderwerp, sjabloon, groep, aantal, ok, fout[], door}. */
// Menu Administratie: Mails meteen onder Agenda.
{const c=NAV.find(n=>n.id==="communicatie");if(c){const m=c.items.findIndex(i=>i[0]==="mails");if(m>=0){const [it]=c.items.splice(m,1);const a=c.items.findIndex(i=>i[0]==="agenda");c.items.splice(a+1,0,it)}}}
const ML_CATS=["Lidgeld","Activiteiten","Kalenders","Banket","Kinderfeest","Algemeen"];
const ML_LOGO="https://impro.usercontent.one/appid/oneComWsb/domain/vbha.be/media/vbha.be/onewebmedia/logo%20VBHA%201.png";
const ML_FONT="font-family:Helvetica,Arial,sans-serif;";
const ML_VELDEN=[
  ["Persoon",[["voornaam","Voornaam"],["naam","Volledige naam"],["bedrag","Bedrag"],["mededeling","Mededeling"],["bedrijf","Bedrijf (sponsors)"]]],
  ["Vereniging",[["jaar","Jaar"],["volgend_jaar","Volgend jaar"],["rekeningnummer","Rekeningnummer"]]],
  ["Banket",[["banket_datum","Datum"],["banket_uur","Uur"],["banket_locatie","Locatie"],["banket_prijs","Prijs per persoon"],["banket_tot","Inschrijven tot"]]],
  ["Kinderfeest",[["kinderfeest_datum","Datum"],["kinderfeest_uur","Uur"],["kinderfeest_locatie","Locatie"],["kinderfeest_tot","Inschrijven tot"]]],
  ["Links",[["link_banket","Inschrijven banket"],["link_kinderfeest","Inschrijven kinderfeest"],["link_lidgeld","Lidgeld betalen (persoonlijk)"],["link_inschrijven","Lid worden"],["link_kaart","Kaart kalenderronde"]]]];
const ML_LINKS=[["{link_lidgeld}","Lidgeld betalen (Bancontact of QR)"],["{link_banket}","Inschrijfpagina banket"],["{link_kinderfeest}","Inschrijfpagina kinderfeest"],["{link_inschrijven}","Lid worden"],["{link_kaart}","Kaart kalenderronde"]];
const ML_NIEUW='<p>Beste {voornaam},</p><p><br></p><p>Met vriendelijke groeten,<br><strong>Het bestuur</strong></p>';
const mlId=()=>"m-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,6);
const mlLang=iso=>{const [y,m,d]=String(iso||"").split("-").map(Number);if(!y)return"";const s=new Date(y,m-1,d,12).toLocaleDateString("nl-BE",{weekday:"long",day:"numeric",month:"long",year:"numeric"});return s.charAt(0).toUpperCase()+s.slice(1)};
const mlKort=iso=>{const [y,m,d]=String(iso||"").split("-").map(Number);return y?d+" "+INS_MAAND[m-1]+" "+y:""};
let ML_RANGE=null,ML_LAST="";

/* ---------- doelgroepen ---------- */
function groepen(){
  const C=ctx();const cur=C.leden.map(l=>C.rows.get(l.id));
  const lidR=r=>({lidId:r.lid.id,email:r.lid.email,voornaam:r.lid.voornaam,naam:naamVol(r.lid),bedrag:r.bedrag,mededeling:`${r.lid.naam} ${r.lid.voornaam} lidgeld ${JAAR}`,label:naamVol(r.lid)});
  const B=mlGeblok();const G=[];const add=(sect,id,label,list)=>{const seen=new Set(),geblokt=[];G.push({sect,id,label,geblokt,list:list.filter(r=>{const k=String(r.email||"").trim().toLowerCase();if(!k)return true;if(seen.has(k))return false;seen.add(k);if(B[k]){geblokt.push(r);return false}return true})})};
  add("Leden","alle","Alle leden",cur.map(lidR));
  add("Leden","lidgeld","Uitnodiging lidgeld (zonder ere-voorzitters)",cur.filter(r=>!isEreVoorzitter(r.lid)).map(lidR));
  add("Leden","herinnering","Lidgeld nog niet betaald",cur.filter(r=>!r.lg.ok&&!isEreVoorzitter(r.lid)).map(lidR));
  add("Leden","betaald","Actieve leden (lidgeld in orde)",cur.filter(r=>r.lg.ok).map(lidR));
  add("Leden","betaald-niet-ere","Actieve leden zonder erewacht",cur.filter(r=>r.lg.ok&&r.lid.categorie!=="Erewacht").map(lidR));
  add("Leden","erewacht","Erewacht",cur.filter(r=>r.lid.categorie==="Erewacht").map(lidR));
  for(const k of cfg().ledenCategorieen.filter(k=>k!=="Erewacht"&&cur.some(r=>r.lid.categorie===k)))add("Leden","cat:"+k,"Categorie: "+k,cur.filter(r=>r.lid.categorie===k).map(lidR));
  const bk=bkRows().map(x=>{const l=(x.r.lidId&&S.leden.get(x.r.lidId))||x.lid;return{...x,l}});
  const bkR=(x,open)=>({email:x.l&&x.l.email||x.r.email||"",voornaam:x.l?x.l.voornaam:String(x.r.naam||"").split(" ").slice(1).join(" "),naam:x.r.naam||"",
    bedrag:open?r2(Math.max(0,x.due-(x.p.bedrag||0))):x.due,mededeling:`${x.r.naam} Banket ${JAAR}`,label:x.r.naam||(x.l?naamVol(x.l):"")});
  add("Banket","bk-alle","Ingeschreven voor het banket",bk.map(x=>bkR(x,false)));
  add("Banket","bk-open","Ingeschreven, betaling nog niet ontvangen",bk.filter(x=>!x.p.ok).map(x=>bkR(x,true)));
  const inBk=new Set(bk.map(x=>x.l&&x.l.id).filter(Boolean));
  add("Banket","bk-niet","Actieve leden die nog niet ingeschreven zijn",cur.filter(r=>r.lg.ok&&!inBk.has(r.lid.id)).map(lidR));
  if(typeof kfLijst==="function")add("Kinderfeest","kf","Ingeschreven voor het kinderfeest",kfLijst().map(r=>{const l=r.lidId&&S.leden.get(r.lidId);
    return{email:r.email||(l&&l.email)||"",voornaam:l?l.voornaam:"",naam:l?naamVol(l):(r.lid||""),bedrag:"",mededeling:"",label:l?naamVol(l):(r.lid||r.email||"")}}));
  add("Andere","sponsors","Alle sponsors",[...S.sponsors.values()].map(s=>({email:s.email,voornaam:s.voornaam||"",naam:s.naam||"",bedrijf:spNaam(s),bedrag:num(s.bedrag),mededeling:"",label:spNaam(s)||s.naam||""})));
  add("Andere","los","Losse e-mailadressen",mlLos().map(e=>({email:e,voornaam:"",naam:"",bedrag:"",mededeling:"",label:e})));
  return G;
}
const mlGeblok=()=>(S.config.get("mail")||{}).geblokkeerd||{};
async function mlGeblokZet(adressen,reden,weg){const B={...mlGeblok()};for(const a of adressen){const k=String(a).trim().toLowerCase();if(!k)continue;if(weg)delete B[k];else B[k]={reden:reden||"",datum:todayISO()}}
  await write("config","mail",{...stripId(S.config.get("mail")||{}),geblokkeerd:B})}
function mlLos(){return [...new Set(String(UI.mailLos||"").split(/[\s,;]+/).map(x=>x.trim().toLowerCase()).filter(x=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(x)))]}
function mlGroep(){const G=groepen();return G.find(x=>x.id===UI.mailGroep)||G[0]}
function mailRecips(){const M=mailState();const uit=M.uit||new Set();return mlGroep().list.filter(r=>r.email&&!uit.has(String(r.email).toLowerCase()))}

/* ---------- velden invullen ---------- */
function mlMap(r){const c=cfg(),b=bkCfg();let k={};try{k=kfCfg()}catch(e){}
  const bkTot=insTot(b,JAAR+"-12-01"),kfTot=insTot(k,JAAR+"-12-07"),O=location.origin;
  return{voornaam:r.voornaam||"",naam:r.naam||"",bedrag:r.bedrag===""||r.bedrag==null?"":fmtBedrag(r.bedrag),jaar:String(JAAR),volgend_jaar:String(JAAR+1),mededeling:r.mededeling||"",bedrijf:r.bedrijf||"",
    rekeningnummer:c.rekeningnummer||"BE43 9730 6810 0401",vereniging:c.vereniging||"Vriendenkring Brandweer Hoofdpost Aalst",
    banket_datum:mlLang(b.datum),banket_uur:b.uur||"",banket_locatie:b.locatie||"",banket_prijs:fmtBedrag(num(b.prijs))+" euro",banket_tot:mlKort(bkTot),
    kinderfeest_datum:mlLang(k.datum),kinderfeest_uur:k.tijd||"",kinderfeest_locatie:k.locatie||"",kinderfeest_tot:mlKort(kfTot),
    link_lidgeld:r.lidId&&Number(r.bedrag)>0?`${O}/lidgeld?l=${encodeURIComponent(r.lidId)}&j=${JAAR}&b=${Number(r.bedrag)}&t=@@SIG@@`:O+"/inschrijven",link_banket:O+"/banket",link_kinderfeest:O+"/kinderfeest",link_inschrijven:O+"/inschrijven",link_kaart:O+"/kaart"}}
const fmtBedrag=v=>{const n=Number(v);if(!isFinite(n))return String(v??"");return Number.isInteger(n)?String(n):n.toFixed(2).replace(".",",")};
const mlLegacy=s=>String(s).split("Beste xnaamx,").join("Beste {voornaam},").split(/xnaamx xvoornaamx lidgeld \d{4}/).join("{mededeling}").split("xx euro").join("{bedrag} euro").split("xnaamx").join("{voornaam}");
function vul(t,r,html){
  let s=String(t||"");const m=mlMap(r);
  s=mlLegacy(s);
  if(html)s=s.replace(/<p>\s*\{agenda\}\s*<\/p>/g,"{agenda}").replace(/\{agenda\}/g,()=>mlAgendaHtml());
  s=s.replace(/\{(\w+)\}/g,(x,k)=>k in m?(html?esc(m[k]):m[k]):x);
  return s.replace(/Beste\s+,/g,"Beste,")
}
function mlAgendaItems(){const nu=todayISO();
  return agItems().filter(x=>x.datum>=nu&&x.inMail)}
function mlAgendaHtml(){const L=mlAgendaItems();if(!L.length)return"<p><em>Er staan momenteel geen activiteiten gepland.</em></p>";
  return L.map(x=>{const rij=[`&bull; <strong>Datum:</strong> ${esc(mlLang(x.datum))}`];if(x.uur)rij.push(`&bull; <strong>Tijd:</strong> ${esc(x.uur)}`);if(x.locatie)rij.push(`&bull; <strong>Locatie:</strong> ${esc(x.locatie)}`);
    let extra=x.info?`<p>${esc(x.info).replace(/\n/g,"<br>")}</p>`:"";
    if(x.id==="bk"||x.id==="kf"){const c=x.id==="bk"?bkCfg():kfCfg();const st=insStatus(c,JAAR+(x.id==="bk"?"-12-01":"-12-07"));
      if(st.open)extra+=`<p>Inschrijven kan tot en met ${esc(mlKort(st.tot))}.</p><p data-blok="knop"><a href="${location.origin}/${x.id==="bk"?"banket":"kinderfeest"}">Inschrijven ${x.id==="bk"?"banket":"kinderfeest"}</a></p>`}
    return `<div data-blok="kader"><h2>${esc(x.titel)}</h2>${rij.map(p=>"<p>"+p+"</p>").join("")}${extra}</div>`}).join("")}

/* ---------- huisstijl ---------- */
function mlStijl(inner){
  const d=new DOMParser().parseFromString("<div id=r>"+inner+"</div>","text/html");const R=d.getElementById("r");
  R.querySelectorAll("script,style,iframe,object,embed,link,meta,form,input,button").forEach(n=>n.remove());
  R.querySelectorAll("*").forEach(n=>{for(const a of [...n.attributes])if(/^on/i.test(a.name))n.removeAttribute(a.name)});
  const st=(sel,css)=>R.querySelectorAll(sel).forEach(n=>n.setAttribute("style",css+(n.getAttribute("style")||"")));
  st("a","color:#b30000;text-decoration:underline;");
  R.querySelectorAll('[data-blok="knop"]').forEach(p=>{const a=p.querySelector("a");const href=a?a.getAttribute("href"):"#";const t=(a||p).textContent.trim();
    const tb=d.createElement("div");tb.innerHTML=`<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width:100%;margin:10px 0 20px 0;border-collapse:collapse"><tr><td align="center" style="text-align:center;padding:0"><table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto;border-collapse:separate"><tr><td align="center" bgcolor="#b30000" style="border-radius:4px;padding:13px 28px;text-align:center;min-width:200px"><a href="${esc(href)}" target="_blank" style="${ML_FONT}font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none;display:inline-block;text-align:center">${esc(t)}</a></td></tr></table></td></tr></table>`;p.replaceWith(tb.firstChild)});
  R.querySelectorAll('[data-blok="kader"]').forEach(k=>{k.querySelectorAll("h2").forEach(h=>h.setAttribute("style","color:#b30000;font-size:18px;font-weight:bold;margin:0 0 10px 0;"));
    k.querySelectorAll("p").forEach(p=>{if(!p.closest("table"))p.setAttribute("style","margin:0 0 5px 0;")});
    const tb=d.createElement("div");tb.innerHTML=`<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:6px 0 18px 0;border-collapse:collapse"><tr><td bgcolor="#fff9f9" style="padding:18px 24px;border-left:5px solid #C1A057;background-color:#fff9f9;${ML_FONT}font-size:15px;color:#222222;line-height:1.5"></td></tr></table>`;
    const td=tb.querySelector("td");while(k.firstChild)td.appendChild(k.firstChild);k.replaceWith(tb.firstChild)});
  st("h3","color:#b30000;font-size:17px;font-weight:bold;margin:22px 0 10px 0;");
  st("h2:not([style])","color:#b30000;font-size:18px;font-weight:bold;margin:22px 0 10px 0;");
  R.querySelectorAll("p:not([style])").forEach(p=>p.setAttribute("style","margin:0 0 15px 0;"));
  st("ul,ol","margin:0 0 15px 0;padding-left:22px;");st("li","margin:0 0 6px 0;");
  return R.innerHTML;
}
function mlKader(inner){const c=cfg();const ver=esc(c.vereniging||"Vriendenkring Brandweer Hoofdpost Aalst");const afm=esc((MAILSMTP&&MAILSMTP.van&&MAILSMTP.van.email)||"dries@vbha.be");
  return `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${ver}</title></head><body style="margin:0;padding:0;background:#f7f7f7">
<table role="presentation" border="0" width="100%" cellspacing="0" cellpadding="0" bgcolor="#f7f7f7" style="margin:0;padding:0"><tr><td align="center" valign="top" style="padding:25px 10px">
<table role="presentation" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="width:100%;max-width:680px;border-collapse:collapse">
<tr><td align="center" bgcolor="#f7f7f7" style="padding:20px"><img src="${ML_LOGO}" alt="${ver}" width="220" height="84" style="display:block;width:220px;height:84px;border:0;outline:none;text-decoration:none"></td></tr>
<tr><td style="border-top:8px solid #b30000;padding:0"></td></tr>
<tr><td bgcolor="#ffffff" style="${ML_FONT}font-size:15px;color:#222222;line-height:1.5;padding:28px 40px 22px">${inner}</td></tr>
<tr><td style="border-top:8px solid #b30000;padding:0"></td></tr>
<tr><td align="center" bgcolor="#f7f7f7" style="${ML_FONT}font-size:12px;color:#888888;line-height:1.5;padding:14px 20px">${ver} &middot; <a href="https://www.vbha.be" style="color:#888888;text-decoration:underline">www.vbha.be</a><br>Liever geen mails meer van ons? <a href="mailto:${afm}?subject=Afmelden%20mails%20VBHA" style="color:#888888;text-decoration:underline">Meld je af</a>.</td></tr>
</table></td></tr></table></body></html>`}
function mailHtml(r,M){
  if(M.opmaak==="huisstijl")return mlKader(mlStijl(vul(M.body,r,true)));
  if(M.isHtml)return vul(M.body,r,true);
  return mlKader(mlStijl(String(vul(M.body,r)).split(/\n{2,}/).map(p=>"<p>"+esc(p).replace(/\n/g,"<br>")+"</p>").join("")));
}

/* ---------- toestand ---------- */
function mlVanTpl(t){return t?{tplId:t.id,naam:t.naam||"",categorie:t.categorie||"Algemeen",groep:t.groep||"",onderwerp:t.onderwerp||"",body:t.body||"",opmaak:t.opmaak||"",isHtml:!!t.isHtml,idx:0,dirty:false,bron:false,uit:new Set()}
  :{tplId:"",naam:"",categorie:"Algemeen",groep:"",onderwerp:"VBHA - Nieuws van de vriendenkring",body:ML_NIEUW,opmaak:"huisstijl",isHtml:true,idx:0,dirty:false,bron:false,uit:new Set(),nieuw:true}}
function mailState(){
  if(MAIL&&!MAIL.uit)MAIL=null;
  if(MAIL&&!MAIL.dirty&&!MAIL.tplId&&!MAIL.nieuw&&S.templates.size)MAIL=null;
  if(!MAIL){const t=S.templates.get(UI.mailTpl)||mlTpls()[0]||null;MAIL=mlVanTpl(t);if(t&&t.groep&&!UI.mailGroep)UI.mailGroep=t.groep}
  return MAIL}
function mlTpls(){const o=c=>{const i=ML_CATS.indexOf(c||"Algemeen");return i<0?99:i};
  return [...S.templates.values()].sort((a,b)=>o(a.categorie)-o(b.categorie)||(a.naam||"").localeCompare(b.naam||"","nl"))}
function mlKies(id){const t=S.templates.get(id);MAIL=mlVanTpl(t||null);UI.mailTpl=t?t.id:"";if(t&&t.groep&&groepen().some(g=>g.id===t.groep))UI.mailGroep=t.groep;saveUI();render(true)}
function mlWissel(fn){if(MAIL&&MAIL.dirty)confirmBox("Je hebt niet-bewaarde wijzigingen in <b>"+esc(MAIL.naam||"dit bericht")+"</b>. Toch verdergaan?","Verdergaan",fn);else fn()}

/* ---------- pagina ---------- */
VIEWS.mails=()=>({title:"Mails",actions:'<button class="btn" data-w data-act="mlNieuw">'+ic("plus")+'Nieuw sjabloon</button>',body(){
  const M=mailState();const G=groepen();const g=G.find(x=>x.id===UI.mailGroep)||G[0];if(g.id!==UI.mailGroep)UI.mailGroep=g.id;
  const tpls=mlTpls();const cats=[...new Set([...ML_CATS,...tpls.map(t=>t.categorie||"Algemeen")])];
  const uit=M.uit,met=g.list.filter(r=>r.email),zonder=g.list.filter(r=>!r.email),actief=met.filter(r=>!uit.has(String(r.email).toLowerCase()));
  const sects=[...new Set(G.map(x=>x.sect))];
  const tg=M.groep&&G.find(x=>x.id===M.groep);
  const d=canWrite?"":" disabled";
  return `<div class="ml-grid">
  <div class="panel ml-ed-p"><div class="panel-h"><h2>Bericht</h2><span class="grow"></span>
    <select class="sel ml-tpl" data-change="mlTpl" aria-label="Sjabloon">${M.tplId?"":`<option value="" selected>${esc(M.naam||"Nieuw sjabloon")}</option>`}${cats.filter(c=>tpls.some(t=>(t.categorie||"Algemeen")===c)).map(c=>`<optgroup label="${esc(c)}">${tpls.filter(t=>(t.categorie||"Algemeen")===c).map(t=>`<option value="${esc(t.id)}"${t.id===M.tplId?" selected":""}>${esc(t.naam||"Zonder naam")}</option>`).join("")}</optgroup>`).join("")}</select></div>
  <div class="panel-b"><div class="form">
    <div class="fld"><label for="mNaam">Naam sjabloon</label><input id="mNaam" data-mlv="naam" value="${esc(M.naam)}" placeholder="bv. Uitnodiging banket"${d}></div>
    <div class="fld"><label for="mCat">Categorie</label><select id="mCat" class="sel" data-mlv="categorie"${d}>${cats.map(c=>`<option${c===M.categorie?" selected":""}>${esc(c)}</option>`).join("")}</select></div>
    <div class="fld full"><label for="mOnd">Onderwerp</label><input id="mOnd" data-mlv="onderwerp" value="${esc(M.onderwerp)}"${d}></div>
    <div class="fld full"><span class="lbl">Inhoud</span>${M.opmaak==="huisstijl"?mlEditor(M):`<textarea id="mlRaw" data-mlv="body" spellcheck="${M.isHtml?"false":"true"}" class="ml-raw"${d}>${esc(M.body)}</textarea>
      <div class="note" style="margin-top:8px">${M.isHtml?"Dit is een volledig HTML-bestand.":"Dit is een sjabloon in gewone tekst."} <button class="btn sm" data-act="mlNaarHuisstijl"${d}>Omzetten naar huisstijl</button></div>`}</div>
    <div class="full bar ml-acts">${canWrite?`<button class="btn primary" data-act="mlSave">${M.tplId?"Bewaren":"Sjabloon bewaren"}</button>${M.tplId?'<button class="btn" data-act="mlKopie">Kopie maken</button>':""}
      <label class="btn ghost" for="mlFile" style="cursor:pointer">${ic("upload")}HTML laden</label><input type="file" id="mlFile" accept=".html,.htm,text/html" hidden>
      <span class="grow"></span>${M.tplId?'<button class="btn ghost danger" data-act="mlDel">Verwijderen</button>':""}`:""}<span class="ml-dirty" id="mlDirty">${M.dirty?"Niet bewaard":""}</span></div>
  </div></div></div>
  <div class="ml-side">
  <div class="panel"><div class="panel-h"><h2>Ontvangers</h2><span class="grow"></span><span class="pill ${actief.length?"info":"neutral"}">${actief.length}</span></div><div class="panel-b stack" style="gap:10px">
    <select class="sel" data-change="mlGroep" aria-label="Doelgroep">${sects.map(s=>`<optgroup label="${esc(s)}">${G.filter(x=>x.sect===s).map(x=>`<option value="${esc(x.id)}"${x.id===g.id?" selected":""}>${esc(x.label)} (${x.list.filter(r=>r.email).length})</option>`).join("")}</optgroup>`).join("")}</select>
    ${g.id==="los"?`<textarea id="mlLos" class="ml-los" placeholder="Plak hier e-mailadressen, gescheiden door een komma of een nieuwe regel">${esc(UI.mailLos||"")}</textarea>`:""}
    ${tg&&tg.id!==g.id?`<div class="ml-tip">Dit sjabloon is bedoeld voor <b>${esc(tg.label)}</b>. <button class="linkbtn" data-act="mlGroepTpl">Kiezen</button></div>`:""}
    <div class="muted small">${actief.length} ${actief.length===1?"ontvanger":"ontvangers"}${uit.size&&met.length>actief.length?` (${met.length-actief.length} uitgezonderd)`:""}${zonder.length?` · ${zonder.length} zonder e-mailadres`:""}</div>
    ${met.length?`<details class="ml-lijst"><summary>Ontvangers bekijken of uitzonderen</summary><div class="ml-rl">${met.map(r=>{const k=String(r.email).toLowerCase();return `<label><input type="checkbox" data-mluit="${esc(k)}"${uit.has(k)?"":" checked"}><span class="trunc"><b>${esc(r.label)}</b> ${esc(r.email)}</span></label>`}).join("")}</div></details>`:""}
    ${mlBlokUI(g)}
    ${zonder.length?`<details class="ml-lijst"><summary>Zonder e-mailadres (${zonder.length})</summary><div class="ml-rl muted">${zonder.map(r=>`<div>${esc(r.label)}</div>`).join("")}</div></details>`:""}
  </div></div>
  <div class="panel"><div class="panel-h"><h2>Voorbeeld</h2><span class="grow"></span>
    <div class="seg" role="group" aria-label="Weergave"><button class="${UI.mlDev==="gsm"?"":"on"}" data-act="mlDev" data-v="pc">Computer</button><button class="${UI.mlDev==="gsm"?"on":""}" data-act="mlDev" data-v="gsm">Gsm</button></div></div>
    <div class="panel-b stack" style="gap:10px"><div class="ml-head" id="mHead"></div><div class="ml-prev${UI.mlDev==="gsm"?" gsm":""}"><iframe id="mlFrame" title="Voorbeeld van de mail" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe></div></div></div>
  <div class="panel"><div class="panel-h"><h2>Versturen</h2></div><div class="panel-b stack" style="gap:10px">
    ${MAILSMTP===null?(mailSmtpLaad(),'<div class="muted small">Verzendinstellingen laden…</div>'):MAILSMTP.ingesteld?`
    <button class="btn primary" data-act="mlSend"${actief.length&&canWrite?"":" disabled"}>${ic("mails")}${actief.length} ${actief.length===1?"mail":"mails"} versturen</button>
    <div class="ml-test"><input id="mlTestAan" type="email" value="${esc(UI.mlTestAan||(ME?ME.email:""))}" aria-label="Testmail naar"><button class="btn" data-act="mlTest"${actief.length&&canWrite?"":" disabled"}>Testmail</button></div>
<div id="mailProg">${ML_LAST}</div>`
    :`<div class="note">Rechtstreeks versturen is nog niet ingesteld (SMTP-gegevens in Vercel).</div>`}
    <details><summary style="cursor:pointer;font-weight:600;font-size:14px">Andere manieren</summary><div class="stack" style="gap:8px;margin-top:10px">
      <button class="btn" data-act="mailZip"${actief.length?"":" disabled"}>${ic("download")}Concepten downloaden (.zip)</button>
      <button class="btn" data-act="mailCopy"${actief.length?"":" disabled"}>${ic("copy")}Adressen kopiëren (voor BCC)</button></div></details>
  </div></div>
  ${mlHistoriek()}
  </div></div>`}});
function mlBlokUI(g){const B=mlGeblok(),keys=Object.keys(B).sort();const hier=new Set(g.geblokt.map(r=>String(r.email).toLowerCase()));
  return `<details class="ml-lijst"><summary>Geen mails meer sturen (${keys.length})${hier.size?` · ${hier.size} in deze groep`:""}</summary><div class="ml-rl">
    <div class="muted small" style="margin:2px 0 6px">Afgemelde of foute adressen krijgen nooit meer een mail, in geen enkele groep. Zo blijft je afzender betrouwbaar voor spamfilters.</div>
    ${keys.map(k=>`<div class="ml-bl"><span class="trunc"><b>${esc(k)}</b> ${esc(B[k].reden||"")}${B[k].datum?" · "+esc(fmtDate(B[k].datum)):""}</span>${canWrite?`<button class="btn sm ghost" data-act="mlDeblok" data-v="${esc(k)}">Terugzetten</button>`:""}</div>`).join("")||'<div class="muted small">Nog geen adressen.</div>'}
    ${canWrite?`<div class="ml-bladd"><input id="mlBlokIn" placeholder="e-mailadres dat zich afmeldde"><button class="btn sm" data-act="mlBlokAdd">Toevoegen</button></div>`:""}</div></details>`}
function mlEditor(M){const d=!canWrite;const b=(act,t,lab,extra="")=>`<button type="button" class="ml-tb-b" data-mltb="${act}" title="${esc(lab)}" aria-label="${esc(lab)}"${extra}${d?" disabled":""}>${t}</button>`;
  return `<div class="ml-tb" role="toolbar" aria-label="Opmaak">
    ${b("bold","<b>B</b>","Vet")}${b("italic","<i>I</i>","Cursief")}${b("h3","Kop","Tussentitel")}${b("ul","&bull; Lijst","Opsomming")}${b("link","Link","Link")}<span class="ml-sep"></span>
    ${b("kader","Kader","Kader in huisstijl")}${b("knop","Knop","Rode knop met link")}${b("agenda","Agenda","Komende activiteiten uit de agenda")}<span class="ml-sep"></span>
    <span class="ml-dd">${b("velden","Veld &#9662;","Veld invoegen",' aria-haspopup="true"')}<div class="ml-ddm" id="mlDdm" hidden>${ML_VELDEN.map(([s,L])=>`<div class="ml-dds">${esc(s)}</div>`+L.map(([k,l])=>`<button type="button" data-mlveld="${k}"><span>${esc(l)}</span><code>{${k}}</code></button>`).join("")).join("")}</div></span>
    <span class="grow"></span>${b("bron",M.bron?"Opmaak":"HTML",M.bron?"Terug naar opmaak":"HTML-code bekijken")}</div>
  ${M.bron?`<textarea id="mlRaw" data-mlv="body" class="ml-raw" spellcheck="false"${d?" disabled":""}>${esc(M.body)}</textarea>`:`<div id="mlEd" class="ml-ed" contenteditable="${d?"false":"true"}" spellcheck="true">${M.body}</div>`}
  <span class="help">Velden zoals <span class="kbd">{voornaam}</span> worden per ontvanger ingevuld. <span class="kbd">{agenda}</span> wordt de lijst met komende activiteiten die in de agenda aangevinkt staan voor de mail. Logo, rode balken en lettertype komen er bij het versturen vanzelf bij.</span>`}
function mlHistoriek(){const L=[...(S.mailings||new Map()).values()].sort((a,b)=>String(b.datum||"").localeCompare(String(a.datum||"")));if(!L.length)return"";
  const N=UI.mlHistN||5;const dt=s=>{const x=new Date(s);return isNaN(x)?"":x.toLocaleDateString("nl-BE",{day:"numeric",month:"short",year:"numeric"})+" "+x.toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"})};
  return `<div class="panel"><div class="panel-h"><h2>Verzonden</h2></div><div class="list">${L.slice(0,N).map(m=>`<div class="li ml-h"><div class="grow" style="min-width:0"><div class="trunc"><b>${esc(m.onderwerp||"")}</b></div>
    <div class="muted small trunc">${esc(dt(m.datum))} · ${esc(m.groep||"")}${m.door?" · "+esc(m.door):""}</div></div><span class="pill ${m.fout&&m.fout.length?"warn":"ok"}" title="${esc((m.fout||[]).join(", "))}">${m.ok||0}${m.fout&&m.fout.length?" / "+m.aantal:""}</span></div>`).join("")}</div>
    ${L.length>N?'<div style="padding:10px 16px;border-top:1px solid var(--line)"><button class="btn sm" data-act="mlHistMeer">Meer tonen</button></div>':""}</div>`}
VIEWS.mails.after=()=>{mailPreview();const ed=$("#mlEd");if(ed&&!ed.dataset.init){ed.dataset.init=1}};

/* ---------- voorbeeld ---------- */
let ML_T=null;
function mailPreview(){const M=mailState(),list=mailRecips();const fr=$("#mlFrame"),hd=$("#mHead");if(!fr)return;
  const dummy={email:"",voornaam:"Voornaam",naam:"Naam Voornaam",bedrag:30,mededeling:"Naam Voornaam "+(/^bk/.test(UI.mailGroep||"")?"Banket":"lidgeld")+" "+JAAR,label:"(geen ontvangers)"};
  M.idx=Math.max(0,Math.min(M.idx||0,Math.max(0,list.length-1)));const r=list[M.idx]||dummy;
  hd.innerHTML=`<div class="ml-nav"><button class="btn sm" data-act="mlPrev" aria-label="Vorige"${M.idx>0?"":" disabled"}>‹</button><span>${list.length?(M.idx+1)+" / "+list.length:"geen ontvangers"}</span><button class="btn sm" data-act="mlNext" aria-label="Volgende"${M.idx<list.length-1?"":" disabled"}>›</button></div>
    <div class="ml-meta"><div><span>Aan</span><b class="trunc">${esc(r.label)}${r.email?` <small>&lt;${esc(r.email)}&gt;</small>`:""}</b></div><div><span>Onderwerp</span><b class="trunc">${esc(vul(M.onderwerp,r))}</b></div></div>`;
  const h=mailHtml(r,M).replace("<head>",'<head><base target="_blank">');
  fr.onload=()=>{try{const b=fr.contentDocument.documentElement;fr.style.height=Math.max(320,b.scrollHeight+4)+"px"}catch(e){}};
  fr.srcdoc=h}
const mlPrevLater=()=>{clearTimeout(ML_T);ML_T=setTimeout(mailPreview,250)};
function mlDirty(){MAIL.dirty=true;const e=$("#mlDirty");if(e)e.textContent="Niet bewaard"}

/* ---------- editor ---------- */
function mlSaveRange(){const s=getSelection();const ed=$("#mlEd");if(ed&&s.rangeCount&&ed.contains(s.anchorNode))ML_RANGE=s.getRangeAt(0).cloneRange()}
function mlRestore(){const ed=$("#mlEd");if(!ed)return;ed.focus();const s=getSelection();if(ML_RANGE&&ed.contains(ML_RANGE.startContainer)){s.removeAllRanges();s.addRange(ML_RANGE)}else{const r=document.createRange();r.selectNodeContents(ed);r.collapse(false);s.removeAllRanges();s.addRange(r)}}
function mlSync(){const ed=$("#mlEd");if(!ed)return;MAIL.body=ed.innerHTML;mlDirty();mlPrevLater()}
function mlIns(html){mlRestore();document.execCommand("insertHTML",false,html);mlSync()}
function mlInsBlok(html){const ed=$("#mlEd");mlRestore();let n=getSelection().anchorNode;while(n&&n.parentNode!==ed)n=n.parentNode;
  const t=document.createElement("div");t.innerHTML=html;const nodes=[...t.childNodes];const leeg=n&&n.nodeType===1&&n.tagName==="P"&&!n.textContent.trim()&&!n.dataset.blok;
  if(!n)nodes.forEach(x=>ed.appendChild(x));else{let ref=n;for(const x of nodes){ref.after(x);ref=x}if(leeg)n.remove()}
  const last=nodes[nodes.length-1];if(!last.nextSibling){const p=document.createElement("p");p.innerHTML="<br>";last.after(p)}
  const r=document.createRange();r.selectNodeContents(last.nextSibling);r.collapse(true);const s=getSelection();s.removeAllRanges();s.addRange(r);mlSync()}
function mlTb(act){const ed=$("#mlEd");
  if(act==="bron"){if(!MAIL.bron&&ed)MAIL.body=ed.innerHTML;MAIL.bron=!MAIL.bron;renderBody();return}
  if(!ed)return;
  if(act==="velden"){const m=$("#mlDdm");m.hidden=!m.hidden;return}
  if(act==="bold"||act==="italic"){mlRestore();document.execCommand(act);mlSync();return}
  if(act==="ul"){mlRestore();document.execCommand("insertUnorderedList");mlSync();return}
  if(act==="h3"){mlRestore();const cur=document.queryCommandValue("formatBlock");document.execCommand("formatBlock",false,/h3/i.test(cur)?"p":"h3");mlSync();return}
  if(act==="agenda"){mlInsBlok("<p>{agenda}</p>");return}
  if(act==="kader"){mlInsBlok('<div data-blok="kader"><h2>Titel</h2><p>&bull; <strong>Datum:</strong> </p><p>&bull; <strong>Tijd:</strong> </p><p>&bull; <strong>Locatie:</strong> </p></div>');return}
  if(act==="link"||act==="knop"){const sel=String(getSelection()).trim();const knop=act==="knop";
    modal(knop?"Knop invoegen":"Link invoegen",`<div class="form">
      ${fld("mlLt",knop?"Tekst op de knop":"Tekst",`<input id="mlLt" value="${esc(sel)}" placeholder="${knop?"bv. Inschrijven voor het banket":"bv. klik hier"}">`,"full")}
      ${fld("mlLs","Waarheen",`<select id="mlLs" class="sel">${ML_LINKS.map(([v,l])=>`<option value="${v}">${esc(l)}</option>`).join("")}<option value="">Ander webadres…</option></select>`,"full")}
      ${fld("mlLu","Webadres",`<input id="mlLu" placeholder="https://…">`,"full ml-lu")}</div>`,
      `<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="mlLok">Invoegen</button>`);
    const sync=()=>{$(".ml-lu").style.display=$("#mlLs").value?"none":""};$("#mlLs").onchange=sync;sync();
    $("#mlLok").onclick=()=>{const t=$("#mlLt").value.trim();let u=$("#mlLs").value||$("#mlLu").value.trim();if(!t||!u){toast("Vul een tekst en een bestemming in.",true);return}
      if(!$("#mlLs").value&&!/^(https?:|mailto:|\{)/i.test(u))u=/@/.test(u)?"mailto:"+u:"https://"+u;closeModal();
      knop?mlInsBlok(`<p data-blok="knop"><a href="${esc(u)}">${esc(t)}</a></p>`):mlIns(`<a href="${esc(u)}">${esc(t)}</a>&nbsp;`)};return}
}
document.addEventListener("mousedown",e=>{if(e.target.closest("[data-mltb],[data-mlveld]")){mlSaveRange();e.preventDefault()}});
document.addEventListener("selectionchange",()=>{if(document.activeElement&&document.activeElement.id==="mlEd")mlSaveRange()});
document.addEventListener("click",e=>{
  const tb=e.target.closest("[data-mltb]");if(tb){mlTb(tb.dataset.mltb);return}
  const v=e.target.closest("[data-mlveld]");if(v){$("#mlDdm").hidden=true;mlRestore();document.execCommand("insertText",false,"{"+v.dataset.mlveld+"}");mlSync();return}
  if(!e.target.closest(".ml-dd")){const m=$("#mlDdm");if(m)m.hidden=true}
  const t=e.target.closest("[data-act]");if(!t)return;const a=t.dataset.act;if(!a.startsWith("ml"))return;
  ({mlNieuw:()=>mlWissel(()=>{MAIL=mlVanTpl(null);UI.mailTpl="";saveUI();render(true);setTimeout(()=>{const n=$("#mNaam");if(n)n.focus()},30)}),
    mlPrev:()=>{MAIL.idx--;mailPreview()},mlNext:()=>{MAIL.idx++;mailPreview()},
    mlDev:()=>{UI.mlDev=t.dataset.v;saveUI();renderBody()},
    mlGroepTpl:()=>{UI.mailGroep=MAIL.groep;MAIL.uit=new Set();MAIL.idx=0;saveUI();renderBody()},
    mlHistMeer:()=>{UI.mlHistN=(UI.mlHistN||5)+20;renderBody()},
    mlNaarHuisstijl:()=>{const M=MAIL;let b=M.body;
      if(M.isHtml){const d=new DOMParser().parseFromString(b,"text/html");const cel=[...d.querySelectorAll("td")].filter(x=>!x.querySelector("td")&&x.querySelector("p,h2"));
        b=cel.length?cel.map(x=>x.querySelector("h2")?'<div data-blok="kader">'+x.innerHTML+"</div>":x.innerHTML).join(""):d.body.innerHTML}
      else b=String(b).split(/\n{2,}/).map(p=>"<p>"+esc(p).replace(/\n/g,"<br>")+"</p>").join("");
      M.body=mlLegacy(b.replace(/\s(style|class|bgcolor|align|width|height)="[^"]*"/g,"").replace(/<!--.*?-->/gs,""));M.opmaak="huisstijl";M.isHtml=true;mlDirty();renderBody()},
    mlSave:()=>mlBewaar(false),mlKopie:()=>mlBewaar(true),
    mlDel:()=>confirmBox("Sjabloon <b>"+esc(MAIL.naam)+"</b> verwijderen?","Verwijderen",async()=>{await write("templates",MAIL.tplId,null,{del:true});MAIL=null;UI.mailTpl="";saveUI();render(true)}),
    mlTest:()=>mlTest(),
    mlDeblok:()=>mlGeblokZet([t.dataset.v],"",true).then(()=>toast("Adres teruggezet.")),
    mlBlokAdd:()=>{const v=String(($("#mlBlokIn")||{}).value||"").trim().toLowerCase();if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(v)){toast("Vul een geldig e-mailadres in.",true);return}mlGeblokZet([v],"afgemeld").then(()=>toast(v+" krijgt geen mails meer."))},
    mlFoutBlok:()=>{const v=ML_FOUT.filter(x=>/SMTP: 5\d\d/.test(x.fout));mlGeblokZet(v.map(x=>x.aan),"geweigerd door de server").then(()=>{ML_LAST="";toast(v.length+" adressen worden niet meer gemaild.")})},mlSend:()=>mlSend()})[a]?.();
});
document.addEventListener("input",e=>{const t=e.target;if(!MAIL)return;
  if(t.id==="mlEd"){mlSync();return}
  if(t.dataset&&t.dataset.mlv){MAIL[t.dataset.mlv]=t.value;mlDirty();mlPrevLater();return}
  if(t.id==="mlLos"){UI.mailLos=t.value;saveUI();clearTimeout(ML_T);ML_T=setTimeout(()=>{const pos=t.selectionStart;renderBody();const n=$("#mlLos");if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(x){}}},700)}});
document.addEventListener("change",e=>{const t=e.target;
  if(t.dataset&&t.dataset.mluit!==undefined){const k=t.dataset.mluit;t.checked?MAIL.uit.delete(k):MAIL.uit.add(k);renderBody();return}
  if(t.dataset&&t.dataset.mlv==="categorie"){MAIL.categorie=t.value;mlDirty();return}
  if(t.dataset&&t.dataset.change==="mlGroep"){UI.mailGroep=t.value;saveUI();MAIL.idx=0;MAIL.uit=new Set();renderBody();return}
  if(t.dataset&&t.dataset.change==="mlTpl"){const v=t.value;t.value=MAIL.tplId||"";mlWissel(()=>mlKies(v));return}
  if(t.id==="mlFile"&&t.files[0]){const f=t.files[0];const rd=new FileReader();rd.onload=()=>{MAIL=mlVanTpl(null);MAIL.nieuw=true;MAIL.body=String(rd.result);MAIL.opmaak="";MAIL.isHtml=true;MAIL.naam=f.name.replace(/\.html?$/i,"").replace(/[_-]+/g," ");MAIL.dirty=true;UI.mailTpl="";render(true)};rd.readAsText(f);t.value=""}});
document.addEventListener("paste",e=>{if(e.target.closest&&e.target.closest("#mlEd")){e.preventDefault();const tx=(e.clipboardData||window.clipboardData).getData("text/plain");
  document.execCommand("insertHTML",false,tx.split(/\r?\n\r?\n/).map(p=>esc(p).replace(/\r?\n/g,"<br>")).join("</p><p>"));mlSync()}});
document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="s"&&route()==="mails"&&canWrite){e.preventDefault();mlBewaar(false)}});

async function mlBewaar(kopie){const M=MAIL;const ed=$("#mlEd");if(ed)M.body=ed.innerHTML;
  if(!M.naam.trim()){toast("Geef het sjabloon eerst een naam.",true);const n=$("#mNaam");if(n)n.focus();return}
  const id=kopie||!M.tplId?"tpl-"+mlId():M.tplId;const naam=kopie?M.naam.trim()+" (kopie)":M.naam.trim();
  await write("templates",id,{naam,categorie:M.categorie||"Algemeen",groep:UI.mailGroep||M.groep||"",onderwerp:M.onderwerp,body:M.body,opmaak:M.opmaak||"",isHtml:!!M.isHtml});
  M.tplId=id;M.naam=naam;M.groep=UI.mailGroep||M.groep;M.dirty=false;M.nieuw=false;UI.mailTpl=id;saveUI();toast(kopie?"Kopie gemaakt.":"Sjabloon bewaard.");render(true)}

/* ---------- versturen ---------- */
// Verzendtempo: one.com laat 250 ontvangers per 5 minuten en 1500 per uur toe. We sturen in pakjes van 10 met een pauze ertussen,
// zodat we ruim onder die grens blijven en ontvangende servers geen plotse piek zien. Tijdelijke weigeringen (4xx) krijgen na een minuut een tweede kans.
const mlWacht=ms=>new Promise(r=>setTimeout(r,ms));
let ML_FOUT=[];
async function mailVerstuur(lijst,label){if(MAILBUSY)return{ok:0,fout:["bezig"]};MAILBUSY=true;const prog=()=>$("#mailProg");let ok=0;const F=[];
  const pauze=lijst.length>200?13000:lijst.length>10?4000:0,t0=Date.now();
  const toon=(i,extra)=>{const p=prog();if(!p)return;const rest=Math.max(0,Math.ceil((lijst.length-i)/10)*pauze/1000);
    p.innerHTML=`<div class="ml-prog"><div style="width:${Math.round(i/lijst.length*100)}%"></div></div><div class="muted small">${extra||`Bezig: ${i} van ${lijst.length} verstuurd${rest>20?` · nog ongeveer ${Math.ceil(rest/60)} min`:""}…`} Laat dit venster open.</div>`};
  const stuur=async deel=>{try{const j=await api("/api/mail",{method:"POST",body:JSON.stringify({berichten:deel})});return deel.map((m,k)=>{const x=(j.resultaten||[])[k]||{};return{m,ok:!!x.ok,fout:x.fout||"mislukt"}})}
    catch(e){return deel.map(m=>({m,ok:false,fout:e.message,net:true}))}};
  const tijdelijk=x=>x.net||/SMTP: 4\d\d|time-out|ECONN|socket/i.test(x.fout);
  try{const opnieuw=[];
    for(let i=0;i<lijst.length;i+=10){const t=Date.now();toon(i);
      for(const x of await stuur(lijst.slice(i,i+10)))x.ok?ok++:tijdelijk(x)?opnieuw.push(x.m):F.push({aan:x.m.aan,fout:x.fout});
      if(i+10<lijst.length)await mlWacht(Math.max(0,pauze-(Date.now()-t)))}
    if(opnieuw.length){toon(lijst.length-opnieuw.length,`${opnieuw.length} ${opnieuw.length===1?"mail werd":"mails werden"} tijdelijk geweigerd, nieuwe poging over een minuut…`);await mlWacht(60000);
      for(let i=0;i<opnieuw.length;i+=10){for(const x of await stuur(opnieuw.slice(i,i+10)))x.ok?ok++:F.push({aan:x.m.aan,fout:x.fout});if(i+10<opnieuw.length)await mlWacht(pauze||4000)}}}
  finally{MAILBUSY=false}
  ML_FOUT=F;const vast=F.filter(x=>/SMTP: 5\d\d/.test(x.fout));
  ML_LAST=`<div class="note ${F.length?"":"info"}"><b>${ok}</b> ${ok===1?"mail":"mails"} verstuurd${label?" ("+esc(label)+")":""}.${F.length?`<br>Niet gelukt (${F.length}): ${F.map(x=>esc(x.aan+" ("+x.fout.replace(/^SMTP:\s*/,"")+")")).join(", ")}`:""}
    ${vast.length&&canWrite?`<div style="margin-top:8px"><button class="btn sm" data-act="mlFoutBlok">${vast.length} ${vast.length===1?"fout adres":"foute adressen"} niet meer mailen</button></div>`:""}</div>`;
  const p=prog();if(p)p.innerHTML=ML_LAST;
  toast(F.length?ok+" verstuurd, "+F.length+" niet gelukt.":ok+" "+(ok===1?"mail":"mails")+" verstuurd.",!!F.length);return{ok,fout:F.map(x=>x.aan+" ("+x.fout+")")}}
function mailBericht(r,M,aan){return{aan:aan||r.email,aanNaam:r.label||"",onderwerp:vul(M.onderwerp,r),html:mailHtml(r,M)}}
async function mlTest(){const list=mailRecips();if(!list.length)return;const r=list[Math.min(MAIL.idx||0,list.length-1)];
  const aan=String(($("#mlTestAan")||{}).value||(ME&&ME.email)||"").trim();if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(aan)){toast("Vul een geldig e-mailadres in voor de testmail.",true);return}
  UI.mlTestAan=aan===(ME&&ME.email)?"":aan;saveUI();
  await mailVerstuur([{...mailBericht(r,MAIL,aan),aanNaam:"",onderwerp:"[TEST] "+vul(MAIL.onderwerp,r)}],"testmail naar "+aan+" met de gegevens van "+r.label)}
function mlSend(){const list=mailRecips();if(!list.length)return;const n=list.length,w=n===1?"mail":"mails",g=mlGroep(),M=MAIL;
  if(/\{\w+\}/.test(vul(M.onderwerp,list[0])+mlStijl(vul(M.body,list[0],true)).replace(/<[^>]+>/g,""))){toast("Er staat nog een onbekend veld tussen accolades in het bericht.",true)}
  modal("Mails versturen",`<div class="stack" style="gap:12px"><p style="margin:0">Je staat op het punt om <b>${n} ${w}</b> te versturen. Dit kan niet ongedaan gemaakt worden.</p>
    <dl class="kv"><dt>Van</dt><dd>${esc((MAILSMTP&&MAILSMTP.van.naam?MAILSMTP.van.naam+" ":"")+"<"+(MAILSMTP&&MAILSMTP.van.email||"")+">")}</dd><dt>Aan</dt><dd>${esc(g.label)} (${n})</dd><dt>Onderwerp</dt><dd>${esc(vul(M.onderwerp,list[0]))}</dd></dl>
    ${n>200?`<div class="note info">Om binnen de verzendlimiet van one.com te blijven duurt dit ongeveer ${Math.ceil(n/10*13/60)} minuten. Laat de pagina open tot alles verstuurd is.</div>`:""}
    ${M.dirty?'<div class="note">Het sjabloon heeft niet-bewaarde wijzigingen. Die worden wel zo verstuurd.</div>':""}
    <label class="sp-nat"><input type="checkbox" id="msOk"><span><b>Ja, verstuur ${n} ${w}</b><small>Stuur bij twijfel eerst een testmail naar jezelf.</small></span></label></div>`,
    `<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="msGo" disabled>Versturen</button>`);
  $("#msOk").onchange=e=>{$("#msGo").disabled=!e.target.checked};
  $("#msGo").onclick=async()=>{if(!$("#msOk").checked)return;closeModal();const res=await mailVerstuur(list.map(r=>mailBericht(r,M)));
    try{await write("mailings",mlId(),{datum:new Date().toISOString(),onderwerp:vul(M.onderwerp,{}),sjabloon:M.naam||"",sjabloonId:M.tplId||"",groep:g.label,aantal:n,ok:res.ok,fout:res.fout.slice(0,200),door:ME?ME.email:""})}catch(e){}}}

/* ============ Rollen en gebruikersbeheer ============
   admin      = alles, ook gebruikers beheren   (oude naam: "bewerker")
   boekhouder = alles lezen, enkel de boekhouding wijzigen
   lezer      = alles lezen, niets wijzigen
   De database (RLS) dwingt dit ook af; de app toont of verbergt enkel de knoppen. */
let ROL="lezer",GB=null;
const ROL_LBL={admin:"Administrator",boekhouder:"Boekhouding",lezer:"Alleen lezen"};
const ROL_UITLEG={admin:"Alles bekijken en wijzigen, ook gebruikers beheren.",boekhouder:"Alles bekijken, enkel de boekhouding wijzigen.",lezer:"Alles bekijken, niets wijzigen."};
const BOEK_ROUTES=new Set(["boekhouding","boekingen","verwerken","historiek","bank"]);
function magSchrijven(r){r=r||route();return ROL==="admin"||(ROL==="boekhouder"&&BOEK_ROUTES.has(r))}
if(!ROUTES.some(r=>r[0]==="gebruikers"))ROUTES.push(["gebruikers","Gebruikers"]);
ICON.gebruikers='<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.9-3 3-4.6 5.5-4.6s4.6 1.6 5.5 4.6"/><circle cx="17" cy="9" r="2.4"/><path d="M15.5 14.6c2.3-.4 4.3.9 5 3.4"/>';
ICON.sleutel='<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>';

function gbMenu(){const m=$("#acctMenu");if(!m||m.querySelector("[data-gbm]"))return;const lo=m.querySelector('[data-act="logout"]');
  const html=(ROL==="admin"?`<a href="#gebruikers" class="acct-i" role="menuitem" data-act="acctClose" data-gbm>${ic("gebruikers")}Gebruikers</a>`:"")+(ROL_ECHT==="admin"?`<button type="button" class="acct-i" role="menuitem" data-act="gbSimKies" data-gbm>${ic("leden")}Bekijken als…</button>`:"")+`<button type="button" class="acct-i" role="menuitem" data-act="gbWw" data-gbm>${ic("sleutel")}Wachtwoord wijzigen</button>`;
  if(lo)lo.insertAdjacentHTML("beforebegin",html);else m.insertAdjacentHTML("beforeend",html)}

async function gbLaad(){try{GB=await api("/api/gebruikers")}catch(e){GB={fout:e.message,gebruikers:[]}}if(route()==="gebruikers")renderBody()}
const gbDt=s=>{if(!s)return"nog nooit";const x=new Date(s);return x.toLocaleDateString("nl-BE",{day:"numeric",month:"short",year:"numeric"})+" "+x.toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"})};
VIEWS.gebruikers=()=>({title:"Gebruikers",actions:ROL==="admin"?'<button class="btn primary" data-act="gbNieuw">'+ic("plus")+'Gebruiker toevoegen</button>':"",body(){
  if(ROL!=="admin")return '<div class="panel"><div class="empty">Enkel een administrator kan gebruikers beheren.</div></div>';
  if(!GB){gbLaad();return '<div class="panel"><div class="empty">Gebruikers laden…</div></div>'}
  if(GB.fout)return `<div class="note">${esc(GB.fout)}</div>`;
  const L=GB.gebruikers;
  return `<div class="gb-rollen">${["admin","boekhouder","lezer"].map(r=>`<div class="gb-rol"><span class="pill ${r==="admin"?"info":r==="boekhouder"?"ok":"neutral"}">${ROL_LBL[r]}</span><span class="muted small">${ROL_UITLEG[r]}</span></div>`).join("")}</div>
  <div class="panel"><div class="panel-h"><h2>Wie heeft toegang</h2><span class="grow"></span><span class="muted small">${L.length}</span></div><div class="list">
  ${L.map(u=>`<div class="li gb-li"><span class="acct-av gb-av">${esc(((u.naam||u.email)[0]||"?").toUpperCase())}</span><div class="grow" style="min-width:0">
    <div class="trunc"><b>${esc(u.naam||u.email)}</b>${u.ik?' <span class="muted small">(jij)</span>':""}</div><div class="gb-rm"><span class="pill ${u.rol==="admin"?"info":u.rol==="boekhouder"?"ok":"neutral"}">${ROL_LBL[u.rol]||esc(u.rol)}</span></div>
    <div class="muted small trunc">${u.naam?esc(u.email)+" · ":""}laatst aangemeld: ${esc(gbDt(u.laatst))}${u.tijdelijk?' · <span class="gb-tmp">tijdelijk wachtwoord</span>':""}</div></div>
    <span class="pill gb-rp ${u.rol==="admin"?"info":u.rol==="boekhouder"?"ok":"neutral"}">${ROL_LBL[u.rol]||esc(u.rol)}</span>
    <button class="btn sm" data-act="gbEdit" data-id="${esc(u.id)}">Wijzigen</button></div>`).join("")||'<div class="empty">Nog niemand.</div>'}</div></div>`}});

const gbRolSel=(id,v)=>`<div class="gb-rkeus" role="radiogroup" aria-label="Rechten">${["admin","boekhouder","lezer"].map(r=>`<label class="sp-nat"><input type="radio" name="${id}" value="${r}"${r===v?" checked":""}><span><b>${ROL_LBL[r]}</b><small>${ROL_UITLEG[r]}</small></span></label>`).join("")}</div>`;
function gbToonWw(titel,u,r){modal(titel,`<div class="stack" style="gap:12px">
   <p style="margin:0">${r.gemaild?`De gegevens werden gemaild naar <b>${esc(u.email)}</b>.`:`Geef deze gegevens door aan <b>${esc(u.naam||u.email)}</b>.`} Bij de eerste aanmelding kiest ${esc((u.naam||"").split(" ")[0]||"de gebruiker")} meteen een eigen wachtwoord.</p>
   <dl class="kv"><dt>Adres</dt><dd>${esc(location.origin.replace(/^https?:\/\//,""))}</dd><dt>E-mailadres</dt><dd>${esc(u.email)}</dd><dt>Tijdelijk wachtwoord</dt><dd><code class="gb-ww">${esc(r.wachtwoord)}</code></dd></dl>
   <div class="muted small">Dit wachtwoord wordt nergens bewaard en is hier maar één keer te zien.</div></div>`,
   `<button class="btn" id="gbCopy">${ic("copy")}Kopiëren</button><button class="btn primary" data-act="closeModal">Klaar</button>`);
  $("#gbCopy").onclick=()=>{navigator.clipboard.writeText(`Adres: ${location.origin}\nE-mailadres: ${u.email}\nTijdelijk wachtwoord: ${r.wachtwoord}`).then(()=>toast("Gekopieerd."))}}
function gbNieuw(){const mail=GB&&GB.mail;
  modal("Gebruiker toevoegen",`<form id="fGb" class="form">
   ${fld("gbN","Naam",'<input id="gbN" maxlength="80" placeholder="bv. Jojanneke Lariviere">',"full")}
   ${fld("gbE","E-mailadres",'<input id="gbE" type="email" maxlength="160" placeholder="naam@voorbeeld.be">',"full")}
   <div class="fld full"><span class="lbl">Rechten</span>${gbRolSel("gbR","lezer")}</div>
   ${mail?'<label class="sp-nat full"><input type="checkbox" id="gbM" checked><span><b>Aanmeldgegevens mailen</b><small>Met het adres van de app en een tijdelijk wachtwoord.</small></span></label>':""}
   <div class="err full" id="gbErr"></div></form>`,
   `<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="gbOk">Toevoegen</button>`);
  $("#gbOk").onclick=async()=>{const u={naam:$("#gbN").value.trim(),email:$("#gbE").value.trim().toLowerCase(),rol:($('input[name="gbR"]:checked')||{}).value};
    if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(u.email)){$("#gbErr").textContent="Vul een geldig e-mailadres in.";return}
    $("#gbOk").disabled=true;try{const r=await api("/api/gebruikers",{method:"POST",body:JSON.stringify({actie:"nieuw",...u,mail:!!($("#gbM")&&$("#gbM").checked)})});closeModal();gbToonWw("Gebruiker toegevoegd",u,r);gbLaad()}
    catch(e){$("#gbErr").textContent=e.message;$("#gbOk").disabled=false}}}
function gbEdit(id){const u=GB.gebruikers.find(x=>x.id===id);if(!u)return;const mail=GB.mail;
  modal(u.naam||u.email,`<form id="fGb" class="form">
   ${fld("gbN","Naam",`<input id="gbN" maxlength="80" value="${esc(u.naam)}">`,"full")}
   <div class="fld full"><span class="lbl">E-mailadres</span><div>${esc(u.email)}</div></div>
   <div class="fld full"><span class="lbl">Rechten</span>${gbRolSel("gbR",u.rol)}</div>
   <div class="fld full"><span class="lbl">Wachtwoord vergeten?</span><div class="bar" style="gap:8px"><button type="button" class="btn sm" id="gbReset">${ic("sleutel")}Nieuw tijdelijk wachtwoord</button>${mail?'<label class="muted small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="gbM" checked>ook mailen</label>':""}</div></div>
   <div class="err full" id="gbErr"></div></form>`,
   `${u.ik?"":'<button class="btn danger" id="gbDel" style="margin-right:auto">Toegang intrekken</button>'}<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="gbOk">Bewaren</button>`);
  $("#gbOk").onclick=async()=>{const r={naam:$("#gbN").value.trim(),rol:($('input[name="gbR"]:checked')||{}).value};
    try{await api("/api/gebruikers",{method:"POST",body:JSON.stringify({actie:"wijzig",id,...r})});closeModal();toast("Bewaard.");gbLaad()}catch(e){$("#gbErr").textContent=e.message}};
  $("#gbReset").onclick=async()=>{try{const r=await api("/api/gebruikers",{method:"POST",body:JSON.stringify({actie:"reset",id,mail:!!($("#gbM")&&$("#gbM").checked)})});closeModal();gbToonWw("Nieuw tijdelijk wachtwoord",u,r);gbLaad()}catch(e){$("#gbErr").textContent=e.message}};
  const d=$("#gbDel");if(d)d.onclick=()=>confirmBox(`<b>${esc(u.naam||u.email)}</b> kan daarna niet meer aanmelden. Toegang intrekken?`,"Intrekken",async()=>{try{await api("/api/gebruikers",{method:"POST",body:JSON.stringify({actie:"verwijder",id})});toast("Toegang ingetrokken.");gbLaad()}catch(e){toast(e.message,true)}})}
function gbWw(){modal("Wachtwoord wijzigen",`<form id="fWw" class="form">
   ${fld("ww1","Nieuw wachtwoord",'<input id="ww1" type="password" autocomplete="new-password" minlength="8">',"full")}
   ${fld("ww2","Herhaal wachtwoord",'<input id="ww2" type="password" autocomplete="new-password" minlength="8">',"full")}<div class="err full" id="wwErr"></div></form>`,
   `<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="wwOk">Bewaren</button>`);
  $("#wwOk").onclick=async()=>{const a=$("#ww1").value,b=$("#ww2").value;if(a.length<8){$("#wwErr").textContent="Gebruik minstens 8 tekens.";return}if(a!==b){$("#wwErr").textContent="De twee wachtwoorden zijn niet gelijk.";return}
    const {error}=await SB.auth.updateUser({password:a,data:{tijdelijk:false}});if(error){$("#wwErr").textContent=error.message;return}closeModal();toast("Wachtwoord gewijzigd.")}}
document.addEventListener("click",e=>{const t=e.target.closest("[data-act]");if(!t)return;
  ({gbNieuw,gbEdit:()=>gbEdit(t.dataset.id),gbWw:()=>{closeAcct();gbWw()}})[t.dataset.act]?.()});

/* ---------- Bekijken als (enkel voor een administrator) ----------
   Toont de app zoals iemand met een ander profiel ze ziet: knoppen en pagina's volgen dat profiel.
   Het is een voorvertoning in deze browser; je blijft aangemeld als jezelf. */
let ROL_ECHT=null;
function gbSimStart(){if(ROL_ECHT!=="admin")return;let s=null;try{s=sessionStorage.getItem("vbhaSimRol")}catch(e){}if(s&&s!=="admin"&&ROL_LBL[s])gbSim(s,true)}
function gbSim(rol,stil){if(ROL_ECHT!=="admin")return;ROL=rol||"admin";try{rol&&rol!=="admin"?sessionStorage.setItem("vbhaSimRol",rol):sessionStorage.removeItem("vbhaSimRol")}catch(e){}
  canWrite=magSchrijven();applyRO();const w=$("#who");if(w){w.textContent=ROL_LBL[ROL]+(ROL!==ROL_ECHT?" (voorvertoning)":"");w.classList.toggle("ro",ROL==="lezer")}
  const m=$("#acctMenu");if(m)m.querySelectorAll("[data-gbm]").forEach(x=>x.remove());gbMenu();gbBanner();
  if(route()==="gebruikers"&&ROL!=="admin")location.hash="dashboard";render(true);if(!stil)toast(ROL===ROL_ECHT?"Je ziet de app terug als administrator.":"Je bekijkt de app nu als "+ROL_LBL[ROL].toLowerCase()+".")}
function gbBanner(){let b=$("#simBar");if(ROL===ROL_ECHT||!ROL_ECHT){if(b)b.remove();document.body.classList.remove("sim");return}
  if(!b){b=document.createElement("div");b.id="simBar";b.className="sim-bar";b.setAttribute("role","status");document.body.prepend(b)}document.body.classList.add("sim");
  b.innerHTML=`${ic("gebruikers")}<span class="sim-t">Je bekijkt de app als <b>${esc(ROL_LBL[ROL])}</b>: ${esc(ROL_UITLEG[ROL])}</span><button type="button" class="btn sm" data-act="gbSimStop">Stoppen</button>`}
function gbSimKies(){closeAcct();modal("Bekijken als",`<p style="margin:0 0 12px;color:var(--muted)">Zie de app zoals iemand met een ander profiel ze ziet. Je blijft aangemeld als jezelf; dit geldt enkel in dit venster.</p>
  <div class="gb-rkeus">${["admin","boekhouder","lezer"].map(r=>`<label class="sp-nat"><input type="radio" name="simR" value="${r}"${r===ROL?" checked":""}><span><b>${ROL_LBL[r]}${r==="admin"?" (jezelf)":""}</b><small>${ROL_UITLEG[r]}</small></span></label>`).join("")}</div>`,
  `<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="simOk">Bekijken</button>`);
  $("#simOk").onclick=()=>{const r=($('input[name="simR"]:checked')||{}).value||"admin";closeModal();gbSim(r)}}
document.addEventListener("click",e=>{const t=e.target.closest("[data-act]");if(!t)return;
  ({gbSimKies,gbSimStop:()=>gbSim("admin")})[t.dataset.act]?.()});

/* ============ Kalenders: dozen meegeven en afgewerkt melden ============
   Elke beweging gaat via een venster met een duidelijk aantal en een voorvertoning, en komt in een logboek per persoon
   (jaarleden.kalLog: [{t:"mee"|"klaar"|"terug"|"corr", n, at, door, op, uit}]). De laatste beweging kan je ongedaan maken.
   kalOpgehaald = dozen in handen (nog bezig), kalUitgevoerd = afgewerkte dozen (telt voor de punten). */
ICON.check='<path d="M5 12.5l4.5 4.5L19 7.5"/>';
const KAL_T={mee:"Meegegeven",klaar:"Afgewerkt",terug:"Teruggebracht",corr:"Correctie"};
const kalDt=s=>{const d=new Date(s);return isNaN(d)?"":d.toLocaleDateString("nl-BE",{day:"numeric",month:"short"})+" "+d.toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"})};
const kalDoos=n=>n===1?"1 doos":n+" dozen";
function kalLaatste(j){const L=j.kalLog||[];return L.length?L[L.length-1]:null}
function kalTable(){
  const C=ctx(),k=kalStats(C),q=norm(UI.kalQ),w=C.c.gewichten.kalenders;
  let list=k.rows.map(j=>({j,n:kalNaam(j)}));if(q)list=list.filter(x=>norm(x.n).includes(q));
  list.sort((a,b)=>(b.j.kalUitgevoerd||0)-(a.j.kalUitgevoerd||0)||(b.j.kalOpgehaald||0)-(a.j.kalOpgehaald||0)||a.n.localeCompare(b.n,"nl"));
  const knoppen=(j,cls)=>canWrite?`<button class="btn ${cls}" data-act="kalOphalen" data-id="${esc(j.id)}">${ic("plus")}Meegeven</button><button class="btn ${cls} primary" data-act="kalKlaar" data-id="${esc(j.id)}"${(j.kalOpgehaald||0)>0?"":" disabled"}>${ic("check")}Afgewerkt</button>`:"";
  const laatst=j=>{const l=kalLaatste(j);return l?`${KAL_T[l.t]||""} ${l.t==="corr"?"":kalDoos(l.n)} · ${kalDt(l.at)}`:""};
  const mob=`<div class="mlist" role="list">${list.map((x,i)=>{const id=x.j.id,open=KAL_OPEN.has(id),op=x.j.kalOpgehaald||0,ui=x.j.kalUitgevoerd||0;
    return `<div class="pm${open?" open":""}" role="listitem"><button type="button" class="ml-row" data-act="kalOpen" data-id="${esc(id)}" aria-expanded="${open}"><span class="ml-rank">${i+1}</span>
      <span class="ml-m"><span class="ml-n"><b>${esc(x.n)}</b>${x.j.lidId?"":' <span class="pill neutral">geen lid</span>'}</span><span class="ml-s">${op} in handen<span class="ml-dot">·</span>${ui} afgewerkt</span></span>
      <span class="pm-tot"><b>${ui*w}</b><small>punten</small></span><span class="ml-chev" aria-hidden="true">›</span></button>
      ${open?`<div class="pm-d">${canWrite?`<div class="pm-a">${knoppen(x.j,"")}</div>`:""}<button type="button" class="btn ghost sm" data-act="kalLog" data-id="${esc(id)}" style="align-self:flex-start">Geschiedenis en correctie</button></div>`:""}</div>`}).join("")||'<div class="empty">Nog niemand heeft kalenders opgehaald in '+JAAR+'.</div>'}</div>`;
  return mob+`<div class="tw dsk-only"><table class="rcards kal-t" data-main="1"><colgroup><col style="width:56px"><col><col style="width:130px"><col style="width:130px"><col style="width:130px"><col style="width:250px"></colgroup><thead><tr><th class="c">#</th><th>Persoon</th><th class="c">In handen</th><th class="c">Afgewerkt</th><th class="c">Punten</th><th></th></tr></thead><tbody>
  ${list.map((x,i)=>`<tr><td class="c muted">${i+1}</td><td><button type="button" class="kr-link" data-act="kalLog" data-id="${esc(x.j.id)}" title="Geschiedenis en correctie"><b>${esc(x.n)}</b></button>${x.j.lidId?"":' <span class="pill neutral">geen lid</span>'}</td>
  <td class="c"><span class="kal-n${(x.j.kalOpgehaald||0)?" on":""}">${x.j.kalOpgehaald||0}</span></td><td class="c"><span class="kal-n">${x.j.kalUitgevoerd||0}</span></td>
  <td class="c"><b>${(x.j.kalUitgevoerd||0)*w}</b></td>
  <td class="kal-a">${knoppen(x.j,"sm")}</td></tr>`).join("")||'<tr><td colspan="6" class="empty">Nog niemand heeft kalenders opgehaald in '+JAAR+'. Gebruik <b>Persoon toevoegen</b>.</td></tr>'}
  </tbody></table></div>`;
}

/* aantal kiezen: grote − en + en snelkeuzes */
function kalAantal(id,start,max){return `<div class="kal-pick" data-max="${max==null?"":max}"><button type="button" class="kal-pb" data-kp="-1" aria-label="Eén minder">−</button>
  <input id="${id}" class="kal-pn" type="number" inputmode="numeric" min="1"${max!=null?` max="${max}"`:""} value="${start}" aria-label="Aantal dozen"><button type="button" class="kal-pb" data-kp="1" aria-label="Eén meer">+</button></div>
  <div class="kal-chips">${[1,2,3,5,10].filter(n=>max==null||n<=max).map(n=>`<button type="button" class="kal-chip" data-kc="${n}">${n}</button>`).join("")}${max!=null&&max>1&&![1,2,3,5,10].includes(max)?`<button type="button" class="kal-chip" data-kc="${max}">alle ${max}</button>`:""}</div>`}
function kalLees(id,max){let n=parseInt(($("#"+id)||{}).value,10);if(!(n>0))return 0;if(max!=null)n=Math.min(n,max);return n}
document.addEventListener("click",e=>{const p=e.target.closest(".kal-pick [data-kp]");const c=e.target.closest("[data-kc]");
  if(p){const box=p.closest(".kal-pick"),i=box.querySelector("input"),mx=box.dataset.max===""?Infinity:+box.dataset.max;i.value=Math.max(1,Math.min(mx,(parseInt(i.value,10)||0)+Number(p.dataset.kp)));i.dispatchEvent(new Event("input",{bubbles:true}))}
  if(c){const i=document.querySelector(".modal .kal-pn");if(i){i.value=c.dataset.kc;i.dispatchEvent(new Event("input",{bubbles:true}))}}});

function kalBeweeg(id,t,n,extra){const j=S.jaarleden.get(id);if(!j)return;const op=j.kalOpgehaald||0,ui=j.kalUitgevoerd||0;
  const nieuw=t==="mee"?{op:op+n,ui}:t==="klaar"?{op:op-n,ui:ui+n}:t==="terug"?{op:op-n,ui}:{op:extra.op,ui:extra.ui};
  const log=[...(j.kalLog||[]),{t,n,at:new Date().toISOString(),door:ME_NAME||"",van:{op,ui},...(t==="corr"?{naar:{op:extra.op,ui:extra.ui}}:{}),...(extra&&extra.reden?{reden:extra.reden}:{})}].slice(-200);
  setJLid(id,{kalOpgehaald:Math.max(0,nieuw.op),kalUitgevoerd:Math.max(0,nieuw.ui),kalLog:log});
  const naam=kalNaam(j),tekst=t==="mee"?`${kalDoos(n)} meegegeven aan ${naam}`:t==="klaar"?`${kalDoos(n)} afgewerkt door ${naam}`:t==="terug"?`${kalDoos(n)} van ${naam} terug in stock`:`Aantallen van ${naam} gecorrigeerd`;
  kalUndoToast(tekst,id);renderBody()}
function kalUndo(id){const j=S.jaarleden.get(id);const L=[...(j&&j.kalLog||[])];const l=L.pop();if(!l||!l.van)return;
  setJLid(id,{kalOpgehaald:l.van.op,kalUitgevoerd:l.van.ui,kalLog:L});toast("Ongedaan gemaakt.");renderBody()}
function kalUndoToast(msg,id){const t=$("#toast");t.className="toast";t.innerHTML=`${esc(msg)} <button type="button" class="kal-undo" data-act="kalUndo" data-id="${esc(id)}">Ongedaan maken</button>`;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>{t.hidden=true},8000)}

function kalMee(id){const j=S.jaarleden.get(id);if(!j||!canWrite)return;const C=ctx(),k=kalStats(C),naam=kalNaam(j),op=j.kalOpgehaald||0;
  modal("Dozen meegeven",`<div class="stack kal-dlg"><p style="margin:0">Hoeveel dozen geef je mee aan <b>${esc(naam)}</b>?</p>${kalAantal("kalN",1,null)}
   <div class="kal-voor" id="kalVoor"></div></div>`,`<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="kalOk">Meegeven</button>`);
  const upd=()=>{const n=kalLees("kalN");$("#kalVoor").innerHTML=n?`<div><span>${esc(naam)} heeft dan</span><b>${kalDoos(op+n)}</b><small>in handen (nu ${op})</small></div><div><span>Stock</span><b>${k.stock-n}</b><small>dozen (nu ${k.stock})</small></div>`:"";$("#kalOk").textContent=n?`${kalDoos(n)} meegeven`:"Meegeven";$("#kalOk").disabled=!n};
  $("#kalN").addEventListener("input",upd);upd();setTimeout(()=>$("#kalN").select(),40);
  $("#kalOk").onclick=()=>{const n=kalLees("kalN");if(!n)return;closeModal();kalBeweeg(id,"mee",n)}}
function kalKlaarForm(id){const j=S.jaarleden.get(id);if(!j||!canWrite)return;const naam=kalNaam(j),op=j.kalOpgehaald||0,ui=j.kalUitgevoerd||0,w=ctx().c.gewichten.kalenders;if(!op)return;
  modal("Dozen terugmelden",`<div class="stack kal-dlg"><p style="margin:0"><b>${esc(naam)}</b> heeft ${kalDoos(op)} in handen.</p>
   <div class="seg kal-soort" role="radiogroup"><button type="button" class="on" data-ks="klaar">Volledig afgewerkt</button><button type="button" data-ks="terug">Onaangeroerd terug</button></div>
   ${kalAantal("kalN",op===1?1:1,op)}<div class="kal-voor" id="kalVoor"></div></div>`,`<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="kalOk">Bevestigen</button>`);
  let soort="klaar";const upd=()=>{const n=kalLees("kalN",op);
    $("#kalVoor").innerHTML=!n?"":soort==="klaar"?`<div><span>Nog in handen</span><b>${op-n}</b><small>dozen</small></div><div><span>Afgewerkt</span><b>${ui+n}</b><small>dozen · +${n*w} punten</small></div>`:`<div><span>Nog in handen</span><b>${op-n}</b><small>dozen</small></div><div><span>Terug in stock</span><b>+${n}</b><small>geen punten</small></div>`;
    $("#kalOk").textContent=!n?"Bevestigen":soort==="klaar"?`${kalDoos(n)} afgewerkt`:`${kalDoos(n)} terug in stock`;$("#kalOk").disabled=!n};
  document.querySelectorAll("[data-ks]").forEach(b=>b.onclick=()=>{soort=b.dataset.ks;document.querySelectorAll("[data-ks]").forEach(x=>x.classList.toggle("on",x===b));upd()});
  $("#kalN").addEventListener("input",upd);upd();
  $("#kalOk").onclick=()=>{const n=kalLees("kalN",op);if(!n)return;closeModal();kalBeweeg(id,soort,n)}}
function kalLogForm(id){const j=S.jaarleden.get(id);if(!j)return;const naam=kalNaam(j),L=[...(j.kalLog||[])].reverse();
  modal(naam,`<div class="stack" style="gap:14px"><div class="kal-voor"><div><span>In handen</span><b>${j.kalOpgehaald||0}</b><small>dozen</small></div><div><span>Afgewerkt</span><b>${j.kalUitgevoerd||0}</b><small>dozen</small></div></div>
   <div><div class="lbl" style="margin-bottom:6px">Geschiedenis</div>${L.length?`<div class="kal-log">${L.map((l,i)=>`<div><span class="kal-lt ${l.t}">${KAL_T[l.t]||l.t}</span><b>${l.t==="corr"&&l.van&&l.naar?`in handen ${l.van.op}→${l.naar.op}, afgewerkt ${l.van.ui}→${l.naar.ui}`:kalDoos(l.n)}</b><span class="muted">${esc(kalDt(l.at))}${l.door?" · "+esc(l.door):""}${l.reden?" · "+esc(l.reden):""}</span></div>`).join("")}</div>`:'<div class="muted small">Nog geen bewegingen geregistreerd (aantallen van voor dit systeem).</div>'}</div>
   ${canWrite?`<details class="kal-corr"><summary>Aantallen corrigeren</summary><div class="form" style="margin-top:10px">${fld("kcO","In handen",`<input id="kcO" type="number" min="0" inputmode="numeric" value="${j.kalOpgehaald||0}">`)}${fld("kcU","Afgewerkt",`<input id="kcU" type="number" min="0" inputmode="numeric" value="${j.kalUitgevoerd||0}">`)}${fld("kcR","Reden",'<input id="kcR" maxlength="120" placeholder="bv. telfout bij het meegeven">',"full")}<div class="full"><button type="button" class="btn" id="kcOk">Correctie bewaren</button></div></div></details>`:""}</div>`,
   `${canWrite&&L.length&&L[0].van?'<button class="btn" id="kalUndoB" style="margin-right:auto">Laatste ongedaan maken</button>':""}<button class="btn primary" data-act="closeModal">Sluiten</button>`);
  const u=$("#kalUndoB");if(u)u.onclick=()=>{closeModal();kalUndo(id)};
  const c=$("#kcOk");if(c)c.onclick=()=>{const o=Math.max(0,parseInt($("#kcO").value,10)||0),ui=Math.max(0,parseInt($("#kcU").value,10)||0),r=$("#kcR").value.trim();if(o===(j.kalOpgehaald||0)&&ui===(j.kalUitgevoerd||0)){closeModal();return}closeModal();kalBeweeg(id,"corr",0,{op:o,ui,reden:r})}}

/* persoon toevoegen: typen en de naam vult aan */
function kalToevoegen(){
  const C=ctx(),k=kalStats(C);const inL=new Set(k.rows.map(j=>j.lidId));
  const L=C.leden.filter(l=>!inL.has(l.id)).map(l=>({id:l.id,n:naamVol(l).trim(),z:norm(l.voornaam+" "+l.naam+" "+l.naam+" "+l.voornaam)})).sort((a,b)=>a.n.localeCompare(b.n,"nl"));
  modal("Persoon aan kalenderlijst toevoegen",`<div class="form">
   <div class="fld full kal-ac"><label for="kWie">Naam</label><input id="kWie" autocomplete="off" placeholder="Begin te typen…" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="kSug"><div class="kal-sug" id="kSug" role="listbox" hidden></div>
    <span class="help" id="kHelp">Kies een lid uit de lijst. Staat de persoon er niet in, typ dan gewoon de volledige naam.</span></div>
   <div class="fld full"><span class="lbl">Dozen meegeven</span>${kalAantal("kalN",1,null)}</div><div class="err full" id="kErr"></div></div>`,
   `<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="kOk">Toevoegen</button>`);
  let gekozen=null,act=-1,hits=[];const inp=$("#kWie"),sug=$("#kSug");
  const toon=()=>{const q=norm(inp.value);hits=q?L.filter(x=>q.split(/\s+/).every(w=>x.z.includes(w))).slice(0,8):[];act=hits.length?0:-1;
    sug.innerHTML=hits.map((x,i)=>`<button type="button" role="option" data-i="${i}" class="${i===act?"on":""}">${esc(x.n)}</button>`).join("")+(q&&!hits.some(x=>norm(x.n)===q)?`<div class="kal-sug-n">Geen lid? Dan voeg je <b>${esc(inp.value.trim())}</b> toe als niet-lid.</div>`:"");
    sug.hidden=!q;inp.setAttribute("aria-expanded",String(!!q))};
  const kies=x=>{gekozen=x;inp.value=x.n;sug.hidden=true;$("#kHelp").innerHTML=`Lid gekozen: <b>${esc(x.n)}</b>`};
  inp.addEventListener("input",()=>{gekozen=null;$("#kHelp").textContent="Kies een lid uit de lijst. Staat de persoon er niet in, typ dan gewoon de volledige naam.";toon()});
  inp.addEventListener("keydown",e=>{if(sug.hidden||!hits.length){if(e.key==="Enter"){e.preventDefault();$("#kOk").click()}return}
    if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();act=(act+(e.key==="ArrowDown"?1:-1)+hits.length)%hits.length;sug.querySelectorAll("[data-i]").forEach((b,i)=>b.classList.toggle("on",i===act))}
    else if(e.key==="Enter"){e.preventDefault();if(act>=0)kies(hits[act])}else if(e.key==="Escape"){sug.hidden=true}});
  sug.addEventListener("mousedown",e=>{const b=e.target.closest("[data-i]");if(b){e.preventDefault();kies(hits[+b.dataset.i])}});
  inp.addEventListener("blur",()=>setTimeout(()=>{sug.hidden=true},120));
  setTimeout(()=>inp.focus(),40);
  $("#kOk").onclick=async()=>{const naam=inp.value.trim(),n=kalLees("kalN");
    if(!gekozen){const ex=L.find(x=>norm(x.n)===norm(naam));if(ex)gekozen=ex}
    if(!naam){$("#kErr").textContent="Vul een naam in.";inp.focus();return}
    const lid=gekozen?gekozen.id:null;const id=JAAR+"_"+(lid||"x-"+slug(naam));const cur=S.jaarleden.get(id)||{};closeModal();
    const op=cur.kalOpgehaald||0,ui=cur.kalUitgevoerd||0;
    const log=[...(cur.kalLog||[]),...(n?[{t:"mee",n,at:new Date().toISOString(),door:ME_NAME||"",van:{op,ui}}]:[])];
    await write("jaarleden",id,{...stripId(cur),jaar:JAAR,lidId:lid,naam:lid?"":naam,kal:true,kalToegevoegd:true,kalOpgehaald:op+n,kalUitgevoerd:ui,kalLog:log});
    toast((lid?gekozen.n:naam)+" toegevoegd"+(n?" met "+kalDoos(n):"")+".")};
}
document.addEventListener("click",e=>{const t=e.target.closest("[data-act]");if(!t)return;
  ({kalLog:()=>kalLogForm(t.dataset.id),kalUndo:()=>{$("#toast").hidden=true;kalUndo(t.dataset.id)}})[t.dataset.act]?.()});

/* ============ Sponsors: betalingen bekijken en manueel toewijzen ============ */
function spBetHtml(id){const C=ctx(),K=spKoppel(C),k=K.per.get(id),s=S.sponsors.get(id)||{};const L=k?k.L:[];
  return `<div class="full sp-bet"><div class="sp-bet-h"><b>Betalingen ${JAAR}</b><span class="muted small">${eur(k?k.som:0)} van ${eur(num(s.bedrag))}</span></div>
  ${L.length?`<div class="sp-bet-l">${L.map(b=>`<div class="sp-bet-r"><span class="grow" style="min-width:0"><span class="trunc"><b>${eur(b.bedrag)}</b> · ${fmtDate(b.datum)} · ${esc(b.partij||"")}</span><span class="muted small trunc">${esc(b.mededeling||"")} · <span class="sp-hoe ${b._hoe}">${b._hoe==="manueel"?"manueel toegewezen":"automatisch herkend"}</span></span></span>${canWrite?`<button type="button" class="btn sm ghost" data-spweg="${esc(b.id)}" title="${b._hoe==="manueel"?"Toewijzing ongedaan maken":"Hoort niet bij deze sponsor"}">Loskoppelen</button>`:""}</div>`).join("")}</div>`:'<div class="muted small">Nog geen betaling gevonden.</div>'}
  ${canWrite?`<div class="sp-bet-add"><select id="spBetSel" class="sel" aria-label="Transactie toewijzen"><option value="">Transactie toewijzen…</option>${spKandidaten(id).map(b=>`<option value="${esc(b.id)}">${esc(fmtDate(b.datum)+" · "+eur(b.bedrag)+" · "+(b.partij||"")+(b.mededeling?" · "+b.mededeling:"")).slice(0,110)}</option>`).join("")}</select><button type="button" class="btn sm" id="spBetOk">Toewijzen</button></div>`:""}</div>`}
/* kandidaten: inkomende transacties van dit boekjaar die nog niet bij een sponsor horen; Sponsoring eerst, dan gelijk bedrag */
function spKandidaten(id){const C=ctx(),K=spKoppel(C),s=S.sponsors.get(id)||{},bez=new Set();for(const k of K.per.values())k.L.forEach(b=>bez.add(b.id));
  return C.boek.filter(b=>b.richting!=="uit"&&!bez.has(b.id)&&b.categorie!=="Lidgeld").sort((a,b)=>((b.categorie==="Sponsoring")-(a.categorie==="Sponsoring"))||((Math.abs(b.bedrag-num(s.bedrag))<0.01)-(Math.abs(a.bedrag-num(s.bedrag))<0.01))||String(b.datum).localeCompare(String(a.datum))).slice(0,150)}
async function spZetBoeking(bid,sid){const b=S.boekingen.get(bid);if(!b)return;const d={...stripId(b),sponsorId:sid};S.boekingen.set(bid,{...d,id:bid});dirty=true;await write("boekingen",bid,d);dirty=true}
function spBetVernieuw(id){const el=$(".sp-bet");if(!el)return;el.outerHTML=spBetHtml(id);spBetBind(id)}
function spBetBind(id){const ok=$("#spBetOk");if(ok)ok.onclick=async()=>{const v=$("#spBetSel").value;if(!v){toast("Kies eerst een transactie.",true);return}await spZetBoeking(v,id);toast("Transactie toegewezen aan "+spNaam(S.sponsors.get(id))+".");spBetVernieuw(id)};
  $$("[data-spweg]").forEach(btn=>btn.onclick=async()=>{const b=S.boekingen.get(btn.dataset.spweg);if(!b)return;await spZetBoeking(b.id,b.sponsorId&&b.sponsorId!=="-"?"":"-");toast("Losgekoppeld.");spBetVernieuw(id)})}
/* betaling zonder sponsor toewijzen aan een sponsor (vanuit de lijst onderaan) */
function spToewijzen(bid){const b=S.boekingen.get(bid);if(!b)return;const C=ctx(),hay=norm((b.mededeling||"")+" "+(b.partij||"")).replace(/[^a-z0-9]+/g," "),hw=hay.split(" "),hz=hay.replace(/ /g,"");
  const L=[...S.sponsors.values()].map(s=>({s,sc:spScore(spToks(s),hay,hw,hz)+(Math.abs(num(s.bedrag)-b.bedrag)<0.01?3:0)})).sort((a,x)=>x.sc-a.sc||spNaam(a.s).localeCompare(spNaam(x.s),"nl"));
  modal("Betaling toewijzen",`<div class="stack" style="gap:12px"><div class="kv-b"><b>${eur(b.bedrag)}</b> · ${fmtDate(b.datum)} · ${esc(b.partij||"")}<div class="muted small">${esc(b.mededeling||"")}</div></div>
   <div class="fld"><label for="spTw">Sponsor</label><select id="spTw" class="sel">${L.map(x=>`<option value="${esc(x.s.id)}">${esc(spNaam(x.s))}${x.s.weergave&&x.s.bedrijf?" ("+esc(x.s.bedrijf)+")":""} · ${eur(num(x.s.bedrag))}</option>`).join("")}</select></div>
   <label class="sp-nat"><input type="checkbox" id="spGeen"><span><b>Geen sponsorbetaling</b><small>Deze transactie hoort bij geen enkele sponsor en verschijnt hier niet meer.</small></span></label></div>`,
   `<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" id="spTwOk">Bewaren</button>`);
  $("#spGeen").onchange=e=>{$("#spTw").disabled=e.target.checked};
  $("#spTwOk").onclick=async()=>{const geen=$("#spGeen").checked,sid=geen?"-":$("#spTw").value;closeModal();await spZetBoeking(bid,sid);toast(geen?"Aangeduid als geen sponsorbetaling.":"Toegewezen aan "+spNaam(S.sponsors.get(sid))+".")}}

/* ============ Instellingen › Herinneringen ============
   Herinneringsmail voor vergaderingen (config "herinneringen"): de server (api/_lib/herinnering.js) leest deze instellingen;
   een geplande taak in Supabase roept elk uur aan en de server verstuurt enkel op het gekozen uur. */
if(!ROUTES.some(r=>r[0]==="herinneringen"))ROUTES.push(["herinneringen","Herinneringen"]);
const HR_DEF={aan:true,ontvangers:"bestuur@vbha.be",dagen:5,uur:8,soorten:[]};
const hrCfg=()=>({...HR_DEF,...(S.config.get("herinneringen")||{})});
VIEWS.herinneringen=()=>({title:"Instellingen",sub:"Herinneringen",body(){
  const c=hrCfg(),d=canWrite?"":" disabled",nu=todayISO();
  const komend=[...S.vergaderingen.values()].filter(v=>v.datum&&v.datum>=nu&&(!c.soorten.length||c.soorten.includes(v.soort||"Andere"))).sort((a,b)=>a.datum.localeCompare(b.datum)).slice(0,5);
  const verstuurOp=v=>{const [y,m,dd]=v.datum.split("-").map(Number);const t=new Date(y,m-1,dd-c.dagen,12);const iso=t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0");return iso<nu?"vandaag of morgen":agLang(iso)+" om "+c.uur+"u"};
  return instTabs("herinneringen")+`<div class="grid g2" style="align-items:start">
  <form class="panel" id="fHr"><div class="panel-h"><h2>Herinnering vergaderingen</h2></div><div class="panel-b"><div class="form">
    <label class="sp-nat full" for="hrAan"><input type="checkbox" id="hrAan"${c.aan?" checked":""}${d}><span><b>Herinneringsmail versturen</b><small>Automatisch een mail met datum, uur, locatie en agenda vóór elke vergadering in de agenda.</small></span></label>
    ${fld("hrAanW","Ontvangers",`<input id="hrAanW" value="${esc(c.ontvangers)}" placeholder="bestuur@vbha.be"${d}>`,"full")}
    <span class="help full muted small" style="margin-top:-6px;color:var(--muted)">Meerdere adressen scheid je met een komma.</span>
    ${fld("hrDagen","Hoeveel dagen vooraf",`<select id="hrDagen" class="sel"${d}>${[1,2,3,4,5,6,7,10,14].map(n=>`<option value="${n}"${n===Number(c.dagen)?" selected":""}>${n} ${n===1?"dag":"dagen"}</option>`).join("")}</select>`)}
    ${fld("hrUur","Op welk uur",`<select id="hrUur" class="sel"${d}>${[6,7,8,9,10,11,12,13,14,15,16,17,18,19,20].map(n=>`<option value="${n}"${n===Number(c.uur)?" selected":""}>${n}u00</option>`).join("")}</select>`)}
    <div class="fld full"><span class="lbl">Voor welke vergaderingen</span><div class="hr-soorten">${VG_SOORT.map(s=>`<label><input type="checkbox" name="hrS" value="${esc(s)}"${!c.soorten.length||c.soorten.includes(s)?" checked":""}${d}>${esc(s)}</label>`).join("")}</div></div>
    ${canWrite?`<div class="full bar"><button class="btn primary" type="button" id="hrOk">Bewaren</button><button class="btn" type="button" id="hrTest">Voorbeeld naar mezelf sturen</button></div>`:""}
  </div></div></form>
  <div class="panel"><div class="panel-h"><h2>Volgende herinneringen</h2></div>${!c.aan?'<div class="empty">Herinneringen staan uit.</div>':komend.length?`<div class="list">${komend.map(v=>`<div class="li" style="display:block;padding:12px 16px"><div><b>${esc(v.titel||v.soort||"Vergadering")}</b> <span class="muted small">${esc(agLang(v.datum))}${v.uur?" om "+esc(v.uur):""}</span></div>
     <div class="muted small">${v.herinnerdVoor===v.datum?"✓ Herinnering verstuurd":"Herinnering op "+esc(verstuurOp(v))}</div></div>`).join("")}</div>`:'<div class="empty">Geen komende vergaderingen in de agenda.</div>'}</div></div>`}});
async function hrBewaar(){const ont=$("#hrAanW").value.split(/[,;\s]+/).map(x=>x.trim()).filter(Boolean);const fout=ont.filter(x=>!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(x));
  if($("#hrAan").checked&&!ont.length){toast("Vul minstens één ontvanger in.",true);return}if(fout.length){toast("Geen geldig e-mailadres: "+fout.join(", "),true);return}
  const alle=$$('input[name="hrS"]'),aan=alle.filter(i=>i.checked).map(i=>i.value);if(!aan.length){toast("Kies minstens één soort vergadering.",true);return}
  await write("config","herinneringen",{...stripId(S.config.get("herinneringen")||{}),aan:$("#hrAan").checked,ontvangers:ont.join(", "),dagen:Number($("#hrDagen").value),uur:Number($("#hrUur").value),soorten:aan.length===alle.length?[]:aan});toast("Herinneringen bewaard.")}
async function hrTest(b){b.disabled=true;try{const j=await api("/api/mail?f=herinnering-test",{method:"POST",body:"{}"});toast("Voorbeeld verstuurd naar "+j.aan+".")}catch(x){toast(x.message,true)}finally{b.disabled=false}}
document.addEventListener("click",e=>{const t=e.target.closest("#hrOk,#hrTest");if(!t)return;if(t.id==="hrOk")hrBewaar();else hrTest(t)});

/* ============ Boekhouding › Facturen ============
   Collectie "facturen" (zie api/_lib/factuur.js voor het datamodel). Concepten bewaart de app zelf; definitief maken
   (uniek nummer + gestructureerde mededeling), de PDF en het mailen gebeuren op de server (/api/mail?f=factuur).
   Betaald = overschrijving met de gestructureerde mededeling of het factuurnummer, online betaling, of manueel. */
if(!COLS.includes("facturen")){COLS.push("facturen");S.facturen=new Map()}
if(!ROUTES.some(r=>r[0]==="facturen"))ROUTES.push(["facturen","Facturen"]);
{const b=NAV.find(n=>n.id==="boekhouding");if(b&&!b.items.some(i=>i[0]==="facturen")){const k=b.items.findIndex(i=>i[0]==="boekingen");b.items.splice(k<0?1:k+1,0,["facturen","Facturen"])}}
if(typeof BOEK_ROUTES!=="undefined")BOEK_ROUTES.add("facturen");
LOG_TYPE.facturen="Factuur";
ICON.facturen='<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 11h6M10 14.5h6M10 18h3.5"/>';
ICON.tandwiel='<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>';

const FC={f:"alle",q:"",jaar:"alle"};
const FC_DEF={voorvoegsel:"F",creditVoorvoegsel:"C",start:{},vervaldagen:30,bic:"ARSPBE22",adres:"",kbo:"",email:"",telefoon:"",website:"vbha.be",voettekst:"",kopie:"",mailOnderwerp:"",mailTekst:"",herinnering:{aan:false,dagenNaVerval:7,interval:14,max:2}};
const fcCfg=()=>{const c=S.config.get("facturen")||{};return{...FC_DEF,...c,herinnering:{...FC_DEF.herinnering,...(c.herinnering||{})}}};
const fcMag=()=>ROL==="admin"||ROL==="boekhouder";
const fcOgm=d=>d&&d.length===12?`+++${d.slice(0,3)}/${d.slice(3,7)}/${d.slice(7)}+++`:"";
function fcTot(f){const per={};let excl=0;for(const l of f.lijnen||[]){const b=r2(num(l.aantal)*num(l.prijs)),t=num(l.btw);excl+=b;if(t)per[t]=(per[t]||0)+b*t/100}
  const btw=Object.entries(per).map(([t,b])=>({tarief:Number(t),bedrag:r2(b)})).sort((a,b)=>a.tarief-b.tarief);excl=r2(excl);return{excl,btw,totaal:r2(excl+btw.reduce((s,b)=>s+b.bedrag,0))}}
function fcHoort(b,f){if(!b||b.richting==="uit"||!f.nr)return false;if(b.factuurId)return b.factuurId===f.id;const m=String(b.mededeling||"");
  if(f.ogm&&m.replace(/\D/g,"").includes(f.ogm))return true;const re=new RegExp("(^|[^A-Z0-9])"+String(f.nr).toUpperCase().replace(/[^A-Z0-9]/g,"")+"($|[^0-9])");return re.test(m.toUpperCase().replace(/\s+/g,""))||re.test(m.toUpperCase())}
function fcBetaal(f){const T=fcTot(f).totaal,L=[...S.boekingen.values()].filter(b=>fcHoort(b,f));let o=L.reduce((s,b)=>s+num(b.bedrag),0);
  const on=f.betaling&&f.betaling.status==="SUCCEEDED"?num(f.betaling.bedrag):0;if(on&&!L.some(b=>Math.abs(b.bedrag-on)<0.01))o+=on;o=r2(o);
  const betaald=!!f.betaaldManueel||(T>0&&o>=T-0.005);const laatst=L.map(b=>b.datum).sort().pop()||(f.betaling&&f.betaling.betaaldOp?String(f.betaling.betaaldOp).slice(0,10):null)||(f.betaaldManueel&&f.betaaldManueel.op)||null;
  return{totaal:T,ontvangen:o,open:r2(Math.max(0,T-o)),betaald,laatst,L,online:on}}
// concept | open | deels | vervallen | betaald | gecrediteerd | credit
function fcStatus(f){if(!f.nr)return"concept";if(f.type==="credit")return"credit";if(f.status==="gecrediteerd")return"gecrediteerd";const b=fcBetaal(f);if(b.betaald)return"betaald";if(f.vervaldatum&&f.vervaldatum<todayISO())return"vervallen";return b.ontvangen>0?"deels":"open"}
const FC_ST={concept:["neutral","Concept"],open:["info","Open"],deels:["warn","Deels betaald"],vervallen:["nok","Vervallen"],betaald:["ok","✓ Betaald"],gecrediteerd:["neutral","Gecrediteerd"],credit:["neutral","Creditnota"]};
const fcPill=st=>`<span class="pill ${FC_ST[st][0]}">${FC_ST[st][1]}</span>`;
const fcLijst=()=>[...S.facturen.values()].sort((a,b)=>(!a.nr)-(!b.nr)||String(b.datum||"").localeCompare(String(a.datum||""))||(b.seq||0)-(a.seq||0)||String(b.aangemaakt||"").localeCompare(String(a.aangemaakt||"")));
const fcNaam=f=>(f.klant&&f.klant.naam)||"(geen klant)";

VIEWS.facturen=()=>({title:"Facturen",sub:"Facturen en creditnota's met automatische opvolging van de betalingen",
  actions:fcMag()?`<button class="btn" data-fc="instel" title="Instellingen facturatie">${ic("tandwiel")}<span class="fc-hl">Instellingen</span></button><button class="btn primary" data-fc="nieuw">${ic("plus")}Nieuwe factuur</button>`:"",
  body(){
  const alle=fcLijst(),st=new Map(alle.map(f=>[f.id,fcStatus(f)]));
  const jaren=[...new Set(alle.map(f=>String(f.datum||"").slice(0,4)).filter(Boolean))].sort().reverse();
  const fact=alle.filter(f=>f.type!=="credit"&&f.nr&&st.get(f.id)!=="gecrediteerd");
  const openL=fact.filter(f=>["open","deels","vervallen"].includes(st.get(f.id)));
  const openT=openL.reduce((s,f)=>s+fcBetaal(f).open,0),verv=openL.filter(f=>st.get(f.id)==="vervallen"),vervT=verv.reduce((s,f)=>s+fcBetaal(f).open,0);
  const dit=String(new Date().getFullYear()),gefT=fact.filter(f=>String(f.datum).startsWith(dit)).reduce((s,f)=>s+fcTot(f).totaal,0);
  const nCon=alle.filter(f=>!f.nr).length;
  const q=norm(FC.q);
  let L=alle.filter(f=>{const s=st.get(f.id);
    if(FC.f==="concept"&&s!=="concept")return false;if(FC.f==="open"&&!["open","deels","vervallen"].includes(s))return false;if(FC.f==="vervallen"&&s!=="vervallen")return false;
    if(FC.f==="betaald"&&s!=="betaald")return false;if(FC.f==="credit"&&!(s==="credit"||s==="gecrediteerd"))return false;
    if(FC.jaar!=="alle"&&!String(f.datum||"").startsWith(FC.jaar))return false;
    if(q&&!norm([f.nr,fcOgm(f.ogm),f.ogm,fcNaam(f),f.klant&&f.klant.contact,f.klant&&f.klant.email,f.referentie,...(f.lijnen||[]).map(l=>l.omschrijving),String(fcTot(f).totaal)].join(" ")).includes(q))return false;return true});
  const chip=(k,l,n)=>`<button type="button" class="fc-chip${FC.f===k?" on":""}" data-fc="filter" data-v="${k}">${l}${n!=null?` <span>${n}</span>`:""}</button>`;
  const rij=f=>{const s=st.get(f.id),T=fcTot(f),b=f.nr&&f.type!=="credit"?fcBetaal(f):null;return{s,T,b}};
  return `<div class="tiles"><div class="tile"><span class="lbl">Openstaand</span><span class="val">${eur(openT)}</span><span class="muted small">${openL.length} ${openL.length===1?"factuur":"facturen"}</span></div>
   <div class="tile"><span class="lbl">Vervallen</span><span class="val${vervT>0?" out":""}">${eur(vervT)}</span><span class="muted small">${verv.length} ${verv.length===1?"factuur":"facturen"}</span></div>
   <div class="tile"><span class="lbl">Gefactureerd ${dit}</span><span class="val">${eur(gefT)}</span></div>
   <div class="tile"><span class="lbl">Concepten</span><span class="val">${nCon}</span></div></div>
  <div class="bar fc-bar"><div class="search">${ic("search")}<input id="fcQ" placeholder="Zoek op nummer, klant, mededeling of bedrag" value="${esc(FC.q)}" autocomplete="off"></div>
   ${jaren.length>1?`<select class="sel" id="fcJaar" aria-label="Jaar"><option value="alle">Alle jaren</option>${jaren.map(j=>`<option${FC.jaar===j?" selected":""}>${j}</option>`).join("")}</select>`:""}</div>
  <div class="fc-chips" role="tablist">${chip("alle","Alle")}${chip("open","Openstaand",openL.length)}${chip("vervallen","Vervallen",verv.length)}${chip("betaald","Betaald")}${chip("concept","Concepten",nCon)}${chip("credit","Creditnota's")}</div>
  <div class="panel">${!L.length?`<div class="empty">${alle.length?"Geen facturen gevonden.":`Nog geen facturen.${fcMag()?`<div style="margin-top:12px"><button class="btn primary" data-fc="nieuw">${ic("plus")}Eerste factuur maken</button></div>`:""}`}</div>`:`
   <div class="mlist" role="list">${L.map(f=>{const{s,T,b}=rij(f);return `<button type="button" class="ml-row" role="listitem" data-fc="open" data-id="${esc(f.id)}"><span class="ml-m"><span class="ml-n"><b>${esc(fcNaam(f))}</b></span>
     <span class="ml-s">${f.nr?esc(f.nr):"concept"}<span class="ml-dot">·</span>${eur(T.totaal)}${f.datum?'<span class="ml-dot">·</span>'+fmtDate(f.datum):""}</span></span><span class="ml-r">${fcPill(s)}</span><span class="ml-chev" aria-hidden="true">›</span></button>`}).join("")}</div>
   <div class="tw dsk-only"><table class="rcards fc-tab"><thead><tr><th>Nummer</th><th>Datum</th><th>Klant</th><th>Vervaldatum</th><th class="num">Bedrag</th><th class="num">Open</th><th>Status</th></tr></thead><tbody>
   ${L.map(f=>{const{s,T,b}=rij(f);return `<tr class="click" data-fc="open" data-id="${esc(f.id)}"><td class="nowrap"><b>${f.nr?esc(f.nr):'<span class="muted">concept</span>'}</b>${f.ogm?`<div class="muted small mono">${esc(fcOgm(f.ogm))}</div>`:""}</td>
     <td class="nowrap">${fmtDate(f.datum)}</td><td><b>${esc(fcNaam(f))}</b>${(f.lijnen||[])[0]?`<div class="muted small trunc">${esc(f.lijnen[0].omschrijving||"")}</div>`:""}</td>
     <td class="nowrap${s==="vervallen"?" out":""}">${f.type==="credit"?"":fmtDate(f.vervaldatum)}</td><td class="num nowrap">${f.type==="credit"?"−":""}${eur(T.totaal)}</td><td class="num nowrap">${b&&!b.betaald&&s!=="gecrediteerd"?eur(b.open):""}</td><td>${fcPill(s)}</td></tr>`}).join("")}</tbody></table></div>`}</div>`}});

/* ---------- details van een definitieve factuur ---------- */
function fcDetail(id){const f=S.facturen.get(id);if(!f)return;if(!f.nr)return fcEdit(f);
  const s=fcStatus(f),T=fcTot(f),b=f.type==="credit"?null:fcBetaal(f),k=f.klant||{},cr=f.type==="credit",m=fcMag();
  const orig=cr&&f.factuurId?S.facturen.get(f.factuurId):null,cn=f.creditId?S.facturen.get(f.creditId):null;
  const kand=b&&!b.betaald&&s!=="gecrediteerd"?[...S.boekingen.values()].filter(x=>x.richting!=="uit"&&!x.factuurId&&!b.L.includes(x)&&x.datum>=String(f.datum).slice(0,10)).sort((x,y)=>((Math.abs(y.bedrag-b.open)<0.01)-(Math.abs(x.bedrag-b.open)<0.01))||String(y.datum).localeCompare(String(x.datum))).slice(0,120):[];
  const log=(f.verzonden||[]).slice().reverse();
  modal((cr?"Creditnota ":"Factuur ")+f.nr,`<div class="fc-det">
   <div class="fc-dh"><div><div class="fc-dk">${esc(k.naam||"")}</div><div class="muted small">${[k.contact,k.email].filter(Boolean).map(esc).join(" · ")}</div></div><div>${fcPill(s)}</div></div>
   <dl class="kv fc-kv"><dt>${cr?"Datum":"Factuurdatum"}</dt><dd>${fmtDate(f.datum)}</dd>${cr?"":`<dt>Vervaldatum</dt><dd class="${s==="vervallen"?"out":""}">${fmtDate(f.vervaldatum)}</dd>`}
    <dt>Bedrag</dt><dd><b>${eur(T.totaal)}</b>${T.btw.length?` <span class="muted small">(${eur(T.excl)} excl. btw)</span>`:""}</dd>
    ${f.ogm?`<dt>Mededeling</dt><dd><span class="mono">${esc(fcOgm(f.ogm))}</span> <button type="button" class="btn sm ghost" data-fc="kopie" data-v="${esc(fcOgm(f.ogm))}" title="Kopiëren">${ic("copy")}</button></dd>`:""}
    ${f.categorie?`<dt>Categorie</dt><dd>${esc(f.categorie)}</dd>`:""}${f.referentie?`<dt>Referentie</dt><dd>${esc(f.referentie)}</dd>`:""}
    ${orig?`<dt>Betreft</dt><dd><a href="#" data-fc="open" data-id="${esc(orig.id)}">Factuur ${esc(orig.nr)}</a></dd>`:""}${cn?`<dt>Gecrediteerd</dt><dd><a href="#" data-fc="open" data-id="${esc(cn.id)}">Creditnota ${esc(cn.nr)}</a></dd>`:""}</dl>
   <div class="fc-lijnen">${(f.lijnen||[]).map(l=>`<div><span>${esc(l.omschrijving||"")}${num(l.aantal)!==1?` <span class="muted">× ${esc(String(l.aantal).replace(".",","))}</span>`:""}</span><b>${eur(r2(num(l.aantal)*num(l.prijs)))}</b></div>`).join("")}</div>
   ${b?`<div class="fc-sec"><h4>Betalingen</h4>${b.L.length||b.online||f.betaaldManueel?`<div class="fc-bl">${b.L.map(x=>`<div><span><b>${eur(x.bedrag)}</b> · ${fmtDate(x.datum)} · ${esc(x.partij||"")}<span class="muted small"> ${esc(x.mededeling||"")}${x.factuurId?" · manueel toegewezen":""}</span></span>${m&&x.factuurId?`<button type="button" class="btn sm ghost" data-fc="loskoppel" data-id="${esc(x.id)}" data-f="${esc(id)}">Loskoppelen</button>`:""}</div>`).join("")}
      ${b.online&&!b.L.some(x=>Math.abs(x.bedrag-b.online)<0.01)?`<div><span><b>${eur(b.online)}</b> · online met Bancontact${f.betaling.betaaldOp?" op "+fmtDate(String(f.betaling.betaaldOp).slice(0,10)):""}</span></div>`:""}
      ${f.betaaldManueel?`<div><span>Manueel als betaald aangeduid op ${fmtDate(f.betaaldManueel.op)}${f.betaaldManueel.opmerking?" · "+esc(f.betaaldManueel.opmerking):""}</span>${m?`<button type="button" class="btn sm ghost" data-fc="onbetaald" data-id="${esc(id)}">Ongedaan maken</button>`:""}</div>`:""}</div>`:`<div class="muted small">Nog geen betaling ontvangen. Overschrijvingen met de mededeling ${esc(fcOgm(f.ogm)||f.nr)} worden automatisch herkend bij de bankimport.</div>`}
     ${b.ontvangen>0&&!b.betaald?`<div class="small" style="margin-top:6px">Nog open: <b>${eur(b.open)}</b></div>`:""}
     ${m&&kand.length?`<div class="sp-bet-add" style="margin-top:10px"><select id="fcKand" class="sel" aria-label="Transactie toewijzen"><option value="">Transactie toewijzen…</option>${kand.map(x=>`<option value="${esc(x.id)}">${esc((fmtDate(x.datum)+" · "+eur(x.bedrag)+" · "+(x.partij||"")+(x.mededeling?" · "+x.mededeling:"")).slice(0,110))}</option>`).join("")}</select><button type="button" class="btn sm" data-fc="toewijzen" data-id="${esc(id)}">Toewijzen</button></div>`:""}</div>`:""}
   <div class="fc-sec"><h4>Verzonden</h4>${log.length?`<div class="fc-log">${log.map(v=>`<div><span class="pill ${v.ok?"ok":"nok"}">${v.ok?"✓":"✗"}</span><span>${v.soort==="herinnering"?"Herinnering":v.soort==="credit"?"Creditnota":"Factuur"} naar <b>${esc(v.aan)}</b></span><span class="muted small">${new Date(v.op).toLocaleString("nl-BE",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"})}${v.fout?" · "+esc(v.fout):""}</span></div>`).join("")}</div>`:'<div class="muted small">Nog niet gemaild.</div>'}</div>
   ${f.opmerking?`<div class="fc-sec"><h4>Opmerking op de factuur</h4><div class="small">${esc(f.opmerking).replace(/\n/g,"<br>")}</div></div>`:""}
  </div>`,
  `<button class="btn" data-fc="pdf" data-id="${esc(id)}">${ic("download")}PDF</button>
   ${m?`<div class="fc-meer"><button class="btn" data-fc="meer" aria-haspopup="true">Meer…</button><div class="fc-menu" hidden>
     <button type="button" data-fc="mailen" data-id="${esc(id)}">${cr?"Creditnota":"Factuur"} opnieuw mailen</button>
     ${b&&!b.betaald&&s!=="gecrediteerd"?`<button type="button" data-fc="herinnering" data-id="${esc(id)}">Herinnering sturen</button><button type="button" data-fc="link" data-id="${esc(id)}">Betaallink kopiëren</button><button type="button" data-fc="betaald" data-id="${esc(id)}">Als betaald aanduiden</button>`:""}
     ${!cr&&s!=="gecrediteerd"?`<button type="button" data-fc="credit" data-id="${esc(id)}">Creditnota maken</button>`:""}
     <button type="button" data-fc="dupliceer" data-id="${esc(id)}">Kopie als nieuw concept</button>
     ${!cr&&b&&!b.betaald?`<button type="button" data-fc="geenher" data-id="${esc(id)}">${f.geenHerinnering?"Automatische herinneringen weer aanzetten":"Geen automatische herinneringen"}</button>`:""}</div></div>`:""}
   <span class="grow"></span><button class="btn primary" data-act="closeModal">Sluiten</button>`,{wide:true})}

/* ---------- bewerken (concept) ---------- */
let FCE=null;
const fcBtw=v=>`<select class="sel fc-btw" aria-label="Btw">${[0,6,12,21].map(t=>`<option value="${t}"${num(v)===t?" selected":""}>${t}%</option>`).join("")}</select>`;
const fcLijnHtml=(l,i)=>`<div class="fc-l" data-i="${i}"><textarea class="fc-om" rows="1" placeholder="Omschrijving" aria-label="Omschrijving">${esc(l.omschrijving||"")}</textarea>
  <input class="fc-aa" inputmode="decimal" value="${esc(String(l.aantal??1).replace(".",","))}" aria-label="Aantal"><input class="fc-pr" inputmode="decimal" value="${l.prijs===""||l.prijs==null?"":esc(String(l.prijs).replace(".",","))}" placeholder="0,00" aria-label="Prijs per stuk">
  ${fcBtw(l.btw)}<span class="fc-lt num">${eur(r2(num(l.aantal)*num(l.prijs)))}</span><button type="button" class="btn sm ghost" data-fc="lijnweg" aria-label="Lijn verwijderen">${ic("x")}</button></div>`;
function fcKlanten(){const o=[];for(const s of S.sponsors.values())o.push({lbl:spNaam(s)+(s.bedrijf&&norm(s.bedrijf)!==norm(spNaam(s))?" ("+s.bedrijf+")":"")+" · sponsor",k:{naam:s.bedrijf||spNaam(s),contact:[s.voornaam,s.naam].filter(Boolean).join(" "),adres:s.adres||"",btw:s.kbo||"",email:s.email||"",sponsorId:s.id,lidId:""},bedrag:num(s.bedrag)});
  for(const l of S.leden.values())if(!l.geenLid)o.push({lbl:[l.naam,l.voornaam].filter(Boolean).join(" ")+" · lid",k:{naam:[l.voornaam,l.naam].filter(Boolean).join(" "),contact:"",adres:l.adres||"",btw:"",email:l.email||"",sponsorId:"",lidId:l.id}});
  const gezien=new Set();for(const f of fcLijst()){const k=f.klant||{};if(!k.naam||k.sponsorId||k.lidId||gezien.has(norm(k.naam)))continue;gezien.add(norm(k.naam));o.push({lbl:k.naam+" · eerdere klant",k:{...k}})}
  return o}
function fcEdit(f,{nieuw=false}={}){
  const c=fcCfg(),cats=catList(ctx());
  f=f?JSON.parse(JSON.stringify(f)):{type:"factuur",klant:{},lijnen:[{omschrijving:"",aantal:1,prijs:"",btw:0}],datum:todayISO(),categorie:"Sponsoring"};
  if(!f.lijnen||!f.lijnen.length)f.lijnen=[{omschrijving:"",aantal:1,prijs:"",btw:0}];
  FCE={f,id:f.id||null,K:fcKlanten()};const k=f.klant||{},cr=f.type==="credit";
  const verval=f.vervaldatum||(()=>{const d=new Date((f.datum||todayISO())+"T12:00");d.setDate(d.getDate()+num(c.vervaldagen||30));return d.toISOString().slice(0,10)})();
  modal(cr?"Creditnota (concept)":f.id?"Factuur (concept)":"Nieuwe factuur",`<form id="fFc" class="form fc-form" autocomplete="off">
   <div class="fld full fc-zoek"><label for="fcKz">Klant zoeken</label><input id="fcKz" list="fcKl" placeholder="Typ een sponsor, lid of eerdere klant"><datalist id="fcKl">${FCE.K.map(x=>`<option value="${esc(x.lbl)}"></option>`).join("")}</datalist><span class="help">Of vul de gegevens hieronder zelf in.</span></div>
   ${fld("fcN","Naam / bedrijf *",inp("fcN",k.naam,'name="naam"'))}${fld("fcC","T.a.v.",inp("fcC",k.contact,'name="contact" placeholder="Contactpersoon"'))}
   <div class="fld full"><label for="fcA">Adres</label><textarea id="fcA" name="adres" rows="2" placeholder="Straat en nummer&#10;Postcode en gemeente">${esc(k.adres||"")}</textarea></div>
   ${fld("fcE","E-mail (voor verzending)",inp("fcE",k.email,'name="email" type="email" inputmode="email"'))}${fld("fcB","Btw- / ondernemingsnr.",inp("fcB",k.btw,'name="btw"'))}
   ${fld("fcD",cr?"Datum":"Factuurdatum",inp("fcD",f.datum,'type="date"'))}${cr?"":fld("fcV","Vervaldatum",inp("fcV",verval,'type="date"'))}
   ${fld("fcR","Uw referentie",inp("fcR",f.referentie,'placeholder="bv. bestelbon (optioneel)"'))}${cr?"":fld("fcCat","Categorie in de boekhouding",`<select id="fcCat" class="sel"><option value="">—</option>${cats.map(x=>`<option${x===f.categorie?" selected":""}>${esc(x)}</option>`).join("")}</select>`)}
   <div class="fld full"><span class="lbl">Lijnen</span><div class="fc-lh"><span>Omschrijving</span><span>Aantal</span><span>Prijs</span><span>Btw</span><span class="num">Totaal</span><span></span></div>
    <div id="fcL">${f.lijnen.map(fcLijnHtml).join("")}</div><button type="button" class="btn sm" data-fc="lijn" style="margin-top:8px">${ic("plus")}Lijn toevoegen</button>
    <div class="fc-tot" id="fcTot"></div></div>
   <div class="fld full"><label for="fcO">Opmerking op de factuur</label><textarea id="fcO" rows="2" placeholder="bv. Bedankt voor je steun!">${esc(f.opmerking||"")}</textarea></div>
   <div class="err full" id="fcErr"></div></form>`,
   `${f.id?`<button class="btn ghost danger" data-fc="weg">Verwijderen</button>`:""}<button class="btn" data-fc="voorbeeld">${ic("download")}Voorbeeld</button><span class="grow"></span>
    <button class="btn" data-fc="bewaar">Bewaren als concept</button><button class="btn primary" data-fc="verstuur">${cr?"Definitief maken en mailen":"Definitief maken en mailen"}</button>`,{wide:true});
  fcTotaal();$$("#fcL .fc-om").forEach(fcGroei)}
function fcGroei(t){t.style.height="auto";t.style.height=Math.min(160,t.scrollHeight+2)+"px"}
function fcLees(){const f=FCE.f,g=s=>{const e=$(s);return e?e.value.trim():""};
  f.klant={...(f.klant||{}),naam:g("#fcN"),contact:g("#fcC"),adres:$("#fcA").value.trim(),email:g("#fcE"),btw:g("#fcB")};
  f.datum=g("#fcD")||todayISO();if($("#fcV"))f.vervaldatum=g("#fcV");f.referentie=g("#fcR");if($("#fcCat"))f.categorie=$("#fcCat").value;f.opmerking=$("#fcO").value.trim();
  f.lijnen=$$("#fcL .fc-l").map(r=>({omschrijving:r.querySelector(".fc-om").value.trim(),aantal:num(r.querySelector(".fc-aa").value)||0,prijs:r2(num(r.querySelector(".fc-pr").value)),btw:num(r.querySelector(".fc-btw").value)})).filter(l=>l.omschrijving||l.prijs);
  return f}
function fcTotaal(){const L=$$("#fcL .fc-l").map(r=>{const l={aantal:num(r.querySelector(".fc-aa").value),prijs:num(r.querySelector(".fc-pr").value),btw:num(r.querySelector(".fc-btw").value)};r.querySelector(".fc-lt").textContent=eur(r2(l.aantal*l.prijs));return l});
  const T=fcTot({lijnen:L}),el=$("#fcTot");if(!el)return;el.innerHTML=(T.btw.length?`<div><span>Totaal excl. btw</span><b>${eur(T.excl)}</b></div>${T.btw.map(b=>`<div><span>Btw ${b.tarief}%</span><b>${eur(b.bedrag)}</b></div>`).join("")}`:"")+`<div class="fc-tt"><span>Totaal</span><b>${eur(T.totaal)}</b></div>`}
async function fcBewaarConcept(stil,f0){const f=f0||fcLees();
  if(!f.klant.naam&&!f.lijnen.length){const e=$("#fcErr");if(e)e.textContent="Vul minstens een klant of een lijn in.";return null}
  const id=FCE.id||("fc-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,6));
  const d={...stripId(f),type:f.type||"factuur",status:"concept",aangemaakt:f.aangemaakt||new Date().toISOString(),door:f.door||ME_NAME,totaal:fcTot(f).totaal};
  FCE.id=id;FCE.f={...d,id};S.facturen.set(id,{...d,id});dirty=true;await write("facturen",id,d);if(!stil)toast("Concept bewaard.");return id}
async function fcVerstuur(){const f=fcLees();const err=$("#fcErr");
  if(!f.klant.naam){err.textContent="Vul de naam van de klant in.";return}if(!f.lijnen.length||!f.lijnen.some(l=>l.prijs)){err.textContent="Voeg minstens één lijn met een prijs toe.";return}
  if(f.type!=="credit"&&f.vervaldatum&&f.vervaldatum<f.datum){err.textContent="De vervaldatum ligt vóór de factuurdatum.";return}
  const mail=f.klant.email;if(mail&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(mail)){err.textContent="Dit e-mailadres klopt niet.";return}
  const T=fcTot(f).totaal,cr=f.type==="credit";
  confirmBox(`${cr?"Creditnota":"Factuur"} voor <b>${esc(f.klant.naam)}</b> van <b>${eur(T)}</b> definitief maken?<br><span class="muted small">Ze krijgt een uniek nummer en kan daarna niet meer gewijzigd worden${cr?"":" (wel crediteren)"}.</span>${mail?`<br><br>De ${cr?"creditnota":"factuur"} wordt met de PDF in bijlage gemaild naar <b>${esc(mail)}</b>${cr?"":", met een knop om meteen online te betalen"}.`:`<br><br><b>Er is geen e-mailadres</b>: de ${cr?"creditnota":"factuur"} wordt enkel definitief gemaakt, je kan de PDF daarna downloaden.`}`,mail?"Definitief maken en mailen":"Definitief maken",async()=>{
    try{const id=await fcBewaarConcept(true,f);if(!id)return;toast("Bezig…");
      const j=await api("/api/mail?f=factuur",{method:"POST",body:JSON.stringify({actie:mail?"versturen":"definitief",id})});
      if(j.data){S.facturen.set(id,{...j.data,id});dirty=true;renderBody()}toast(`${cr?"Creditnota":"Factuur"} ${j.nr} ${mail?"gemaild naar "+mail:"aangemaakt"}.`);if(j.data)fcDetail(id)}
    catch(x){toast(x.message,true);const f=S.facturen.get(FCE&&FCE.id);if(f&&!f.nr)setTimeout(()=>fcEdit(f),300)}})}
async function fcPdf(id,btn){if(btn)btn.disabled=true;
  try{const j=await api("/api/mail?f=factuur",{method:"POST",body:JSON.stringify({actie:"pdf",id})});
    const bin=atob(j.pdf),a=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)a[i]=bin.charCodeAt(i);
    const url=URL.createObjectURL(new Blob([a],{type:"application/pdf"})),l=document.createElement("a");l.href=url;l.download=j.naam;
    if(!/iPhone|iPad|Android/i.test(navigator.userAgent))l.target="_blank";document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(url),60000)}
  catch(x){toast(x.message,true)}finally{if(btn)btn.disabled=false}}
function fcKies(lbl){const x=FCE&&FCE.K.find(o=>o.lbl===lbl);if(!x)return;const k=x.k;
  $("#fcN").value=k.naam||"";$("#fcC").value=k.contact||"";$("#fcA").value=k.adres||"";$("#fcE").value=k.email||"";$("#fcB").value=k.btw||"";$("#fcKz").value="";
  FCE.f.klant={...k};
  const rows=$$("#fcL .fc-l"),leeg=rows.length===1&&!rows[0].querySelector(".fc-om").value.trim()&&!rows[0].querySelector(".fc-pr").value.trim();
  if(leeg&&k.sponsorId){rows[0].querySelector(".fc-om").value="Sponsoring "+(JAAR||new Date().getFullYear());if(x.bedrag)rows[0].querySelector(".fc-pr").value=String(x.bedrag).replace(".",",");const c=$("#fcCat");if(c)c.value="Sponsoring";fcTotaal()}
  if(!k.email)toast("Let op: voor deze klant is geen e-mailadres gekend.",true)}

/* ---------- instellingen ---------- */
function fcInstel(){const c=fcCfg(),H=c.herinnering,j=new Date().getFullYear(),pre=c.voorvoegsel||"F";
  const hoogste=Math.max(0,...[...S.facturen.values()].filter(f=>String(f.nr||"").startsWith(pre+j)).map(f=>num(f.seq)),...[...S.boekingen.values()].map(b=>{const m=String(b.mededeling||"").replace(/\s+/g,"").toUpperCase().match(new RegExp(pre+j+"(\\d{3,6})"));return m?Number(m[1]):0}));
  const volgend=Math.max(num((c.start||{})[pre+j])||1,hoogste+1);
  modal("Instellingen facturatie",`<form id="fFcI" class="form">
   <div class="fc-sec full"><h4>Gegevens van de vereniging op de factuur</h4><p class="muted small" style="margin:0">De naam van de vereniging en het rekeningnummer komen uit Instellingen › Algemeen.</p></div>
   <div class="fld full"><label for="fiAd">Adres</label><textarea id="fiAd" rows="2" placeholder="Straat en nummer&#10;Postcode en gemeente">${esc(c.adres)}</textarea></div>
   ${fld("fiKbo","Ondernemingsnummer",inp("fiKbo",c.kbo,'placeholder="0123.456.789"'))}${fld("fiBic","BIC van de bank",inp("fiBic",c.bic))}
   ${fld("fiMail","E-mail (antwoorden komen hier)",inp("fiMail",c.email,'type="email" placeholder="penningmeester@vbha.be"'))}${fld("fiTel","Telefoon",inp("fiTel",c.telefoon))}
   ${fld("fiWeb","Website",inp("fiWeb",c.website))}${fld("fiVd","Betaaltermijn",`<select id="fiVd" class="sel">${[8,10,14,15,21,30,45,60].map(n=>`<option value="${n}"${n===num(c.vervaldagen)?" selected":""}>${n} dagen</option>`).join("")}</select>`)}
   <div class="fld full"><label for="fiVt">Voettekst (bv. btw-vermelding)</label><textarea id="fiVt" rows="2" placeholder="bv. Vereniging niet onderworpen aan btw.">${esc(c.voettekst)}</textarea></div>
   <div class="fc-sec full"><h4>Nummering</h4></div>
   ${fld("fiNr","Volgend factuurnummer "+j,`<div class="fc-nr"><span>${esc(pre)}${j}</span><input id="fiNr" inputmode="numeric" value="${String(volgend).padStart(3,"0")}"></div>`)}
   <div class="help full muted small" style="margin-top:-6px">Hoogste nummer tot nu toe: ${hoogste?esc(pre+j+String(hoogste).padStart(3,"0")):"geen"} (ook nummers in de mededeling van overschrijvingen tellen mee). Een nummer wordt nooit twee keer gebruikt.</div>
   <div class="fc-sec full"><h4>Mail</h4></div>
   ${fld("fiOnd","Onderwerp",inp("fiOnd",c.mailOnderwerp,'placeholder="Factuur {nr} - {vereniging}"'),"full")}
   <div class="fld full"><label for="fiTxt">Tekst boven de factuurgegevens</label><textarea id="fiTxt" rows="3" placeholder="Hartelijk dank voor je steun aan de {vereniging}. In bijlage vind je factuur {nr}.">${esc(c.mailTekst)}</textarea><span class="help">Je kan {naam}, {nr}, {bedrag}, {vervaldatum} en {vereniging} gebruiken. De betaalgegevens, de betaalknop en de PDF worden altijd toegevoegd.</span></div>
   ${fld("fiKop","Kopie van elke mail naar",inp("fiKop",c.kopie,'placeholder="bv. penningmeester@vbha.be"'),"full")}
   <div class="fc-sec full"><h4>Automatische herinneringen</h4></div>
   <label class="sp-nat full" for="fiHa"><input type="checkbox" id="fiHa"${H.aan?" checked":""}><span><b>Herinnering mailen bij onbetaalde facturen</b><small>Elke ochtend controleert de server de vervallen facturen. Betaalde facturen worden overgeslagen.</small></span></label>
   ${fld("fiHd","Eerste herinnering",`<select id="fiHd" class="sel">${[1,3,5,7,10,14,21,30].map(n=>`<option value="${n}"${n===num(H.dagenNaVerval)?" selected":""}>${n} dagen na de vervaldatum</option>`).join("")}</select>`)}
   ${fld("fiHi","Daarna",`<select id="fiHi" class="sel">${[7,10,14,21,30].map(n=>`<option value="${n}"${n===num(H.interval)?" selected":""}>om de ${n} dagen</option>`).join("")}</select>`)}
   ${fld("fiHm","Maximum aantal herinneringen",`<select id="fiHm" class="sel">${[1,2,3,4].map(n=>`<option value="${n}"${n===num(H.max)?" selected":""}>${n}</option>`).join("")}</select>`)}
   <div class="err full" id="fiErr"></div></form>`,`<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" data-fc="instelOk" data-v="${volgend}">Bewaren</button>`,{wide:true})}
async function fcInstelBewaar(volgend){const c=fcCfg(),j=new Date().getFullYear(),pre=c.voorvoegsel||"F",g=s=>$(s).value.trim();
  const nr=parseInt(g("#fiNr"),10);if(!(nr>=1)){$("#fiErr").textContent="Vul een geldig volgnummer in.";return}
  const kop=g("#fiKop").split(/[,;\s]+/).filter(Boolean);if(kop.some(x=>!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(x))){$("#fiErr").textContent="Het kopie-adres klopt niet.";return}
  const start={...(c.start||{})};if(nr!==volgend)start[pre+j]=nr;
  const d={...stripId(S.config.get("facturen")||{}),adres:$("#fiAd").value.trim(),kbo:g("#fiKbo"),bic:g("#fiBic"),email:g("#fiMail"),telefoon:g("#fiTel"),website:g("#fiWeb"),vervaldagen:num($("#fiVd").value),voettekst:$("#fiVt").value.trim(),
    start,mailOnderwerp:g("#fiOnd"),mailTekst:$("#fiTxt").value.trim(),kopie:kop.join(", "),herinnering:{aan:$("#fiHa").checked,dagenNaVerval:num($("#fiHd").value),interval:num($("#fiHi").value),max:num($("#fiHm").value)}};
  try{await write("config","facturen",d);closeModal();toast("Instellingen bewaard.")}catch(x){$("#fiErr").textContent="Bewaren lukte niet: "+(x.message||"")}}

/* ---------- acties ---------- */
async function fcActie(actie,id,extra={}){try{return await api("/api/mail?f=factuur",{method:"POST",body:JSON.stringify({actie,id,...extra})})}catch(x){toast(x.message,true);return null}}
async function fcZet(id,patch){const f=S.facturen.get(id);if(!f)return;const d={...stripId(f),...patch};for(const k in patch)if(patch[k]===undefined)delete d[k];S.facturen.set(id,{...d,id});dirty=true;await write("facturen",id,d)}
async function fcBoeking(bid,patch){const b=S.boekingen.get(bid);if(!b)return;const d={...stripId(b),...patch};for(const k in patch)if(patch[k]===undefined)delete d[k];S.boekingen.set(bid,{...d,id:bid});dirty=true;await write("boekingen",bid,d);dirty=true}
function fcMailVraag(id,soort){const f=S.facturen.get(id);if(!f)return;const k=f.klant||{};
  modal(soort==="herinnering"?"Herinnering sturen":"Opnieuw mailen",`<div class="form"><p class="full" style="margin:0">${soort==="herinnering"?`Een herinnering voor factuur <b>${esc(f.nr)}</b> (nog open: <b>${eur(fcBetaal(f).open)}</b>) met de PDF en de betaalknop.`:`${f.type==="credit"?"Creditnota":"Factuur"} <b>${esc(f.nr)}</b> opnieuw mailen met de PDF in bijlage.`}</p>
   ${fld("fcAan","Naar",inp("fcAan",k.email,'type="email"'),"full")}<div class="err full" id="fcAErr"></div></div>`,
   `<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" data-fc="mailOk" data-id="${esc(id)}" data-v="${soort}">Versturen</button>`)}
async function fcMailOk(btn){const id=btn.dataset.id,soort=btn.dataset.v,aan=$("#fcAan").value.trim();
  if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(aan)){$("#fcAErr").textContent="Vul een geldig e-mailadres in.";return}
  btn.disabled=true;const f=S.facturen.get(id);
  if(f&&!(f.klant&&f.klant.email))await fcZet(id,{klant:{...(f.klant||{}),email:aan}});
  const j=await fcActie(soort==="herinnering"?"herinnering":"versturen",id,{aan});btn.disabled=false;if(j){if(j.data){S.facturen.set(id,{...j.data,id});dirty=true}closeModal();toast((soort==="herinnering"?"Herinnering":"Mail")+" verstuurd naar "+aan+".");fcDetail(id)}}
function fcCredit(id){const f=S.facturen.get(id);if(!f)return;const b=fcBetaal(f);
  confirmBox(`Een creditnota maken voor factuur <b>${esc(f.nr)}</b> (${eur(fcTot(f).totaal)})?${b.ontvangen>0?`<br><br><b>Let op:</b> op deze factuur werd al ${eur(b.ontvangen)} ontvangen. Die moet je zelf terugstorten.`:""}<br><span class="muted small">Je kan de lijnen nog aanpassen (bv. voor een gedeeltelijke creditering) voor je ze definitief maakt.</span>`,"Creditnota maken",()=>{
    fcEdit({type:"credit",factuurId:id,factuurNr:f.nr,klant:{...f.klant},lijnen:(f.lijnen||[]).map(l=>({...l})),datum:todayISO(),categorie:f.categorie,referentie:f.referentie,opmerking:`Creditnota voor factuur ${f.nr} van ${fmtDate(f.datum)}.`})})}
function fcDupliceer(id){const f=S.facturen.get(id);if(!f)return;fcEdit({type:"factuur",klant:{...f.klant},lijnen:(f.lijnen||[]).map(l=>({...l})),datum:todayISO(),categorie:f.categorie,opmerking:f.opmerking})}

// betaalde facturen: transactie krijgt de categorie en (bij een sponsor) de koppeling met de sponsor
let fcSyncT=0;
function fcSync(){clearTimeout(fcSyncT);fcSyncT=setTimeout(async()=>{if(!fcMag()||(typeof ROL_ECHT!=="undefined"&&ROL_ECHT!==ROL))return;
  for(const f of S.facturen.values()){if(!f.nr||f.type==="credit")continue;const k=f.klant||{};
    for(const b of [...S.boekingen.values()].filter(x=>fcHoort(x,f))){const p={};
      if(!b.categorie&&f.categorie)p.categorie=f.categorie;if(k.sponsorId&&!b.sponsorId&&S.sponsors.has(k.sponsorId))p.sponsorId=k.sponsorId;
      if(Object.keys(p).length)try{await fcBoeking(b.id,p)}catch(e){}}}},1500)}

document.addEventListener("click",async e=>{const t=e.target.closest("[data-fc]");
  if(!t){const m=$(".fc-menu:not([hidden])");if(m&&!e.target.closest(".fc-meer"))m.hidden=true;return}
  const a=t.dataset.fc,id=t.dataset.id;if(t.tagName==="A")e.preventDefault();
  switch(a){
    case"nieuw":fcEdit(null,{nieuw:true});break;
    case"instel":fcInstel();break;
    case"instelOk":fcInstelBewaar(num(t.dataset.v));break;
    case"filter":FC.f=t.dataset.v;renderBody();break;
    case"open":fcDetail(id);break;
    case"lijn":{const box=$("#fcL"),i=box.children.length;box.insertAdjacentHTML("beforeend",fcLijnHtml({omschrijving:"",aantal:1,prijs:"",btw:(FCE.f.lijnen.slice(-1)[0]||{}).btw||0},i));box.lastElementChild.querySelector(".fc-om").focus();fcTotaal();break}
    case"lijnweg":{const r=t.closest(".fc-l");if($$("#fcL .fc-l").length>1)r.remove();else{r.querySelectorAll("textarea,input").forEach(i=>i.value="");r.querySelector(".fc-aa").value="1"}fcTotaal();break}
    case"bewaar":if(await fcBewaarConcept())closeModal();break;
    case"verstuur":fcVerstuur();break;
    case"voorbeeld":{const i=await fcBewaarConcept(true);if(i)fcPdf(i,t);break}
    case"weg":confirmBox("Dit concept verwijderen?","Verwijderen",async()=>{await write("facturen",FCE.id,null,{del:true});toast("Concept verwijderd.")});break;
    case"pdf":fcPdf(id,t);break;
    case"meer":{const m=t.nextElementSibling;m.hidden=!m.hidden;break}
    case"mailen":fcMailVraag(id,"factuur");break;
    case"herinnering":fcMailVraag(id,"herinnering");break;
    case"mailOk":fcMailOk(t);break;
    case"link":{const j=await fcActie("link",id);if(j){try{await navigator.clipboard.writeText(j.link);toast("Betaallink gekopieerd.")}catch(x){prompt("Betaallink",j.link)}}break}
    case"kopie":try{await navigator.clipboard.writeText(t.dataset.v);toast("Gekopieerd.")}catch(x){}break;
    case"betaald":{const f=S.facturen.get(id);modal("Als betaald aanduiden",`<div class="form"><p class="full" style="margin:0">Gebruik dit enkel als de betaling niet via de rekening binnenkwam (bv. cash) of niet automatisch herkend wordt. Een overschrijving kan je beter <b>toewijzen</b> in de details van de factuur.</p>
       ${fld("fcBo","Betaald op",inp("fcBo",todayISO(),'type="date"'))}${fld("fcBm","Opmerking",inp("fcBm","",'placeholder="bv. cash betaald op het banket"'))}</div>`,`<button class="btn" data-act="closeModal">Annuleren</button><button class="btn primary" data-fc="betaaldOk" data-id="${esc(id)}">Als betaald aanduiden</button>`);break}
    case"betaaldOk":await fcZet(id,{betaaldManueel:{op:$("#fcBo").value||todayISO(),opmerking:$("#fcBm").value.trim(),door:ME_NAME}});closeModal();toast("Factuur als betaald aangeduid.");fcDetail(id);break;
    case"onbetaald":await fcZet(id,{betaaldManueel:undefined});fcDetail(id);break;
    case"toewijzen":{const v=$("#fcKand").value;if(!v){toast("Kies eerst een transactie.",true);break}await fcBoeking(v,{factuurId:id});toast("Transactie toegewezen.");fcSync();fcDetail(id);break}
    case"loskoppel":await fcBoeking(id,{factuurId:undefined});toast("Losgekoppeld.");fcDetail(t.dataset.f);break;
    case"credit":fcCredit(id);break;
    case"dupliceer":fcDupliceer(id);break;
    case"geenher":{const f=S.facturen.get(id);await fcZet(id,{geenHerinnering:f.geenHerinnering?undefined:true});toast(f.geenHerinnering?"Automatische herinneringen staan weer aan.":"Geen automatische herinneringen voor deze factuur.");fcDetail(id);break}
    case"sponsor":{const s=S.sponsors.get(id);if(!s)break;closeModal();location.hash="#facturen";setTimeout(()=>{fcEdit(null);const x=FCE.K.find(o=>o.k.sponsorId===id);if(x)fcKies(x.lbl)},120);break}
  }});
document.addEventListener("input",e=>{const t=e.target;
  if(t.id==="fcQ"){FC.q=t.value;clearTimeout(fcSyncT.q);fcSyncT.q=setTimeout(()=>{renderBody();const i=$("#fcQ");if(i){i.focus();i.selectionStart=i.selectionEnd=i.value.length}},250);return}
  if(t.closest&&t.closest("#fcL")){if(t.classList.contains("fc-om"))fcGroei(t);fcTotaal()}
  if(t.id==="fcKz"&&FCE&&FCE.K.some(o=>o.lbl===t.value))fcKies(t.value)});
document.addEventListener("change",e=>{const t=e.target;if(t.id==="fcJaar"){FC.jaar=t.value;renderBody()}if(t.classList&&t.classList.contains("fc-btw"))fcTotaal();
  if(t.id==="fcD"&&$("#fcV")){const d=new Date(t.value+"T12:00");if(!isNaN(d)){d.setDate(d.getDate()+num(fcCfg().vervaldagen||30));$("#fcV").value=d.toISOString().slice(0,10)}}});
// sponsorfiche: knop "Factuur maken"
{const _sf=sponsorForm;sponsorForm=function(s,id){_sf(s,id);if(id&&fcMag()){const ok=$("#spOk");if(ok)ok.insertAdjacentHTML("beforebegin",`<button class="btn" data-fc="sponsor" data-id="${esc(id)}">${ic("facturen")}Factuur maken</button>`)}}}
// na elke render: facturen-pagina houdt de koppeling met de transacties bij
VIEWS.facturen.after=()=>fcSync();
