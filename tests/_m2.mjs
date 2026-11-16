import {createRequire} from 'module';const require=createRequire(import.meta.url);const {chromium}=require('playwright');import fs from 'fs';const ROOT='/home/claude/vbha-beheer/public';
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1000,height:700}});const err=[];p.on('pageerror',e=>err.push(e.message));
await p.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/'))return r.fulfill({json:{jaar:2026,perDoos:100,straten:[],open:[]}});
  const f=ROOT+(u.pathname==='/kaart'?'/kaart.html':u.pathname);return fs.existsSync(f)&&fs.statSync(f).isFile()?r.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':'application/octet-stream'}):r.fulfill({status:404,body:''})});
await p.goto('http://vbha.test/kaart');await p.waitForTimeout(2500);console.log('ms',await p.evaluate(()=>KRE.ms));
for(const n of process.argv.slice(3)){await p.evaluate(n=>{const s=KR_STREETS.find(x=>x.n===n);if(s){krZoomTo(s.id);KR.map.setZoom(18)}},n);await p.waitForTimeout(900);await p.screenshot({path:process.argv[2]+'/m3_'+n.slice(0,8).replace(/ /g,'_')+'.png'})}
await p.evaluate(()=>{const s=KR_STREETS.find(x=>x.n==='Merestraat');krSelect(s.id);krZoomTo(s.id)});await p.waitForTimeout(400);await p.click('#krDlL');await p.waitForTimeout(800);await p.screenshot({path:process.argv[2]+'/m3_deel.png'});
console.log('fouten',JSON.stringify(err));await b.close();
