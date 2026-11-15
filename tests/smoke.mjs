// Rooktest: opent elke pagina van de beheer-app met nepgegevens en faalt bij een JavaScript-fout.
// Gebruik: node smoke.mjs [pad/naar/public]
import {createRequire} from 'module';const require=createRequire(import.meta.url);const {chromium}=require('playwright');import fs from 'fs';
const ROOT=process.argv[2]||'/home/claude/vbha-beheer/public';
const J=2026,iso=(m,d)=>`${J}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
const FX={
  bestuur:{rol:"admin",naam:"Test Beheerder",rechten:null},
  config:[{id:"algemeen",data:{vereniging:"VBHA",actiefJaar:J,boekCategorieen:["Lidgeld","Banket","Kalenders","Sponsoring","Andere kosten"],overlopend:{cats:["Kalenders"],maand:5}}},{id:"facturen",data:{}}],
  jaren:[{id:String(J-1),data:{jaar:J-1,beginKas:100,beginRekening:1000,kalenderStock:150,perDoos:100}},{id:String(J),data:{jaar:J,beginKas:200,beginRekening:2000,kalenderStock:200,perDoos:100}}],
  leden:[{id:"jansen-jan",data:{naam:"Jansen",voornaam:"Jan",email:"jan@x.test",lidSinds:"2010",categorie:"Lid"}},{id:"peeters-piet",data:{naam:"Peeters",voornaam:"Piet",lidSinds:"2026",categorie:"Erewacht"}}],
  jaarleden:[{id:J+"_jansen-jan",data:{jaar:J,lidId:"jansen-jan",kalUitgevoerd:3,lidgeld:"OK"}}],
  boekingen:[
    {id:"b1",data:{jaar:J,datum:iso(11,3),bedrag:20,richting:"in",rekening:"Rekening",categorie:"Kalenders",partij:"Klant A",mededeling:"kalender"}},
    {id:"b2",data:{jaar:J,datum:iso(11,4),bedrag:545,richting:"in",rekening:"Rekening",categorie:"Kalenders",partij:"BANCONTACT PAYCONIQ COMPANY NV",mededeling:"Bancontact 03/11: kalenders via QR-code (41 betalingen)"}},
    {id:"b3",data:{jaar:J,datum:iso(10,1),bedrag:900,richting:"uit",rekening:"Rekening",categorie:"Kalenders",partij:"Drukkerij"}},
    {id:"b4",data:{jaar:J,datum:iso(2,1),bedrag:30,richting:"in",rekening:"Kas",categorie:"Lidgeld",lidId:"jansen-jan"}},
    {id:"b5",data:{jaar:J,datum:iso(3,1),bedrag:500,richting:"in",rekening:"Rekening",categorie:"Sponsoring",partij:"Sponsor"}},
    {id:"b6",data:{jaar:J-1,datum:"2025-11-20",bedrag:15,richting:"in",rekening:"Rekening",categorie:"Kalenders",partij:"Klant B"}}],
  sponsors:[{id:"s1",data:{naam:"Sponsor",bedrag:500,jaar:J}}],
  activiteiten:[{id:"a1",data:{titel:"Banket",datum:iso(11,28),locatie:"Zaal"}}],
  vergaderingen:[{id:"v1",data:{datum:iso(11,4),soort:"Bestuursvergadering"}}],
  banket:[{id:"k1",data:{jaar:J,naam:"Jan Jansen",lidId:"jansen-jan",personen:2}}],
  facturen:[{id:"f1",data:{nr:"F2026-001",datum:iso(5,1),vervaldatum:iso(6,1),klant:{naam:"Klant"},lijnen:[{omschrijving:"x",aantal:1,prijs:100}]}}],
};
const b=await chromium.launch(),fouten=[];let totaal=0;
const PROFIELEN=[{rol:"admin",naam:"Test Beheerder",rechten:null},{rol:"boekhouder",naam:"Boekhouder",rechten:{financien:"bewerken",kalenders:"lezen"}},{rol:"lezer",naam:"Lezer",rechten:{kalenders:"bewerken","kalenders:kalenders":"geen",leden:"lezen"}}];
for(const prof of PROFIELEN){FX.bestuur=prof;const pf=prof.rol;

const ctx=await b.newContext({viewport:{width:1280,height:900}});
const sessie={access_token:"a.b.c",refresh_token:"r",token_type:"bearer",expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:"u1",email:"test@vbha.test",aud:"authenticated",role:"authenticated",user_metadata:{}}};
await ctx.addInitScript(s=>{try{localStorage.setItem("sb-sb-auth-token",s)}catch(e){}},JSON.stringify(sessie));
await ctx.route('**/*',async r=>{const u=new URL(r.request().url()),m=r.request().method();
  if(u.hostname==='t.test'){
    if(u.pathname==='/api/config')return r.fulfill({json:{supabaseUrl:"https://sb.test",supabaseAnonKey:"anon"}});
    if(u.pathname.startsWith('/api/')){if(u.pathname==='/api/gebruikers')return r.fulfill({json:{gebruikers:[{id:'u1',email:'test@vbha.test',rol:'admin',naam:'Test'},{id:'u2',email:'l@x.test',rol:'lezer',naam:'Lezer',rechten:{kalenders:'lezen'}}]}});if(u.searchParams.get('f')==='bcsplit')return r.fulfill({json:{betalingen:[{a:10,d:iso(11,3),t:"10:00"},{a:20,d:iso(11,4),t:"11:00"}],onderweg:0}});return r.fulfill({json:{}})}
    const f=ROOT+(u.pathname==='/'?'/beheer.html':u.pathname);return fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':'application/octet-stream'}):r.fulfill({status:404,body:''})}
  if(u.hostname==='sb.test'){
    if(u.pathname.startsWith('/auth/v1/user'))return r.fulfill({json:sessie.user});
    if(u.pathname.startsWith('/auth/'))return r.fulfill({json:sessie});
    const t=u.pathname.split('/').pop();
    if(m!=='GET'&&m!=='HEAD')return r.fulfill({status:201,json:[]});
    const acc=(r.request().headers()['accept']||'');
    if(t==='bestuur')return r.fulfill({json:FX.bestuur});
    const rows=FX[t]||[];
    if(acc.includes('vnd.pgrst.object'))return r.fulfill({json:rows[0]||null});
    return r.fulfill({json:rows,headers:{'content-range':`0-${Math.max(0,rows.length-1)}/${rows.length}`}})}
  return r.fulfill({status:404,body:''})});
const p=await ctx.newPage();
p.on('pageerror',e=>fouten.push(`[${pf} ${p.url().split('#')[1]||''}] ${e.message}`));
p.on('console',c=>{if(c.type()==='error'&&!/Failed to load resource|WebSocket|websocket|realtime/i.test(c.text()))fouten.push(`[${pf} console ${p.url().split('#')[1]||''}] ${c.text().slice(0,200)}`)});
await p.goto('http://t.test/#dashboard');await p.waitForTimeout(2500);
try{await p.waitForFunction(()=>window.XLSX&&window.JSZip,null,{timeout:8000})}catch(e){fouten.push(pf+': Excel/zip-bibliotheek niet geladen')}
if(pf==="admin"){const k=await p.evaluate(()=>({s:KR_STREETS.length,d:KR_DELEN.size,e:KR_DEEL.size,b:KR.byId.size,o:KR_SORTED.length,a:Array.isArray(KR_STREETS),it:[...KR_DELEN.values()].flat().length}));if(!(k.s>100&&k.d===k.s&&k.b===k.s&&k.o===k.s&&k.e===k.it&&k.a))fouten.push("kalenderronde-gegevens fout: "+JSON.stringify(k));else console.log("kalenderronde:",k.s,"straten,",k.e,"delen")}
const routes=await p.evaluate(()=>typeof ROUTES!=="undefined"?ROUTES.map(r=>r[0]):[]);
if(!routes.length)fouten.push('App niet gestart (ROUTES leeg)');
const leeg=[];totaal+=routes.length;
for(const r of routes){await p.evaluate(h=>{location.hash="#"+h},r);await p.waitForTimeout(350);
  const ok=await p.evaluate(()=>{const m=document.querySelector("#body")||document.querySelector("#main");return m?m.innerText.trim().length:0});if(!ok)leeg.push(r)}
// instellingen-vensters en enkele knoppen

// vaste onderdelen die zichtbaar moeten zijn
const MOET={admin:{instellingen:["Jaardocumenten","Testlid","Vaste waarden"],kalfin:["Totale winst","Vergelijking met vorig jaar"]},boekhouder:{instellingen:["Jaardocumenten"]}};
for(const [r,T] of Object.entries(MOET[pf]||{})){await p.evaluate(h=>{location.hash="#"+h},r);await p.waitForTimeout(600);const t=await p.evaluate(()=>document.body.innerText);for(const x of T)if(!t.includes(x))fouten.push(`${pf} ${r}: "${x}" ontbreekt`)}
if(leeg.length)console.log(pf+" leeg: "+leeg.join(", "));await ctx.close()}
await b.close();
console.log(`${totaal} pagina's getest (${PROFIELEN.map(p=>p.rol).join(", ")})`);
if(fouten.length){console.log("FOUTEN:\n"+[...new Set(fouten)].join("\n"));process.exit(1)}
console.log("OK");
