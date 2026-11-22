// Maakt api/_lib/kr_adressen.js uit public/kaart.html (aantal adressen per straat en per stuk). Gebruik: node tools/kr_adressen.mjs
import { createRequire } from "node:module"; const { chromium } = createRequire(import.meta.url)("playwright");
import fs from "node:fs";
const b = await chromium.launch(); const p = await b.newPage();
await p.route("**/api/**", r => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
await p.route(/^https?:\/\/(?!localhost)/, r => r.abort());
await p.goto("file://" + new URL("../public/kaart.html", import.meta.url).pathname);
await p.waitForTimeout(800);
const o = await p.evaluate(() => { const m = {}; for (const s of KR_ALLE) m[s.id] = s.a; for (const [id, d] of KR_DEEL) m[id] = d.a; return { m, n: KR_ALLE.length, d: KR_DEEL.size, tot: KR_STREETS.reduce((t, s) => t + s.a, 0), hid: KR_ALLE.filter(s => !KR_STREETS.includes(s)).map(s => s.id) }; });
await b.close();
const out = process.argv[2] || new URL("../api/_lib/kr_adressen.js", import.meta.url).pathname;
fs.writeFileSync(out, `// GEGENEREERD uit public/kaart.html (KR_ALLE en KR_DEEL): aantal adressen per straat en per stuk straat ("straat~n").\n// Zelfde cijfers als op de kaart; de server rekent hiermee bij reserveren en melden. Opnieuw maken: node tools/kr_adressen.mjs\nexport default ${JSON.stringify(o.m)};\n`);
console.log(o.n, o.d, o.tot, o.hid, fs.statSync(out).size);
