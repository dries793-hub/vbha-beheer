import { isDbCron, httpErr } from "./sb.js";
// TIJDELIJK (eenmalige import van ontbrekende straten voor de kalenderronde): straten en huisnummers uit OpenStreetMap.
// Enkel via de geplande-taaksleutel. Wordt na de import weer verwijderd.
export async function osmTmp(req, res) {
  if (!(await isDbCron(req))) throw httpErr(403, "Geen toegang");
  const B = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  res.setHeader("Cache-Control", "no-store");
  if (B.url) { // verkennen: enkel geo.api.vlaanderen.be
    const u = new URL(B.url); if (u.hostname !== "geo.api.vlaanderen.be") throw httpErr(400, "host");
    const r = await fetch(u, { headers: { "User-Agent": "vbha-beheer" } }); const t = await r.text();
    return res.status(200).json({ status: r.status, len: t.length, tekst: t.slice(B.van || 0, (B.van || 0) + (B.max || 20000)) });
  }
  if (B.adressen) { // alle adrespunten in de bbox ophalen (WFS, per 10000) en tellen per straat en per gebied (ringen in B.ringen)
    const ringen = B.ringen || {}, inRing = (p, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [yi, xi] = r[i], [yj, xj] = r[j]; if (((yi > p[0]) !== (yj > p[0])) && (p[1] < (xj - xi) * (p[0] - yi) / (yj - yi) + xi)) c = !c; } return c; };
    const gebied = p => { for (const [n, rs] of Object.entries(ringen)) if (rs.some(r => inRing(p, r))) return n; return null; };
    const tel = {}, uniek = new Set(); let start = 0, totaal = 0, voorbeeld = null;
    for (let pag = 0; pag < 12; pag++) {
      const u = new URL("https://geo.api.vlaanderen.be/Adressenregister/wfs");
      Object.entries({ service: "WFS", version: "2.0.0", request: "GetFeature", typeNames: B.adressen, outputFormat: "application/json", srsName: "EPSG:4326", count: "10000", startIndex: String(start), bbox: "50.9068,3.9824,50.9949,4.0960,EPSG:4326" }).forEach(([k, v]) => u.searchParams.set(k, v));
      const r = await fetch(u, { headers: { "User-Agent": "vbha-beheer" } }); if (!r.ok) return res.status(200).json({ fout: r.status, tekst: (await r.text()).slice(0, 1500), tel, totaal });
      const j = await r.json(), F = j.features || []; if (!voorbeeld && F[0]) voorbeeld = F[0];
      for (const f of F) { const pr = f.properties || {}, c = f.geometry && f.geometry.coordinates; if (!c) continue;
        const st = pr[B.straat] || pr.StraatNaam || pr.straatnaam || "", nr = pr[B.huisnr] || pr.Huisnummer || pr.huisnummer || "", bus = pr[B.bus] || pr.Busnummer || "";
        const g = gebied([c[1], c[0]]); if (!g) continue; const k = st + "|" + g; const id = k + "|" + nr; if (B.zonderBus !== false && uniek.has(id)) continue; uniek.add(id); tel[k] = (tel[k] || 0) + 1; totaal++; }
      if (F.length < 10000) break; start += 10000;
    }
    return res.status(200).json({ totaal, tel, voorbeeld });
  }
  const bb = "50.9068,3.9824,50.9949,4.0960";
  const q = `[out:json][timeout:90];(way["highway"]["name"](${bb});node["addr:housenumber"]["addr:street"](${bb});way["addr:housenumber"]["addr:street"](${bb}););out tags center geom qt;`;
  const r = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "vbha-beheer kalenderronde" }, body: "data=" + encodeURIComponent(q) });
  if (!r.ok) throw httpErr(502, "Overpass " + r.status + ": " + (await r.text()).slice(0, 200));
  const j = await r.json(), W = [], A = [];
  const rd = x => Math.round(x * 1e5) / 1e5;
  for (const e of j.elements || []) {
    const t = e.tags || {};
    if (e.type === "way" && t.highway && t.name && e.geometry) W.push([t.name, t.highway, e.geometry.map(p => [rd(p.lat), rd(p.lon)])]);
    if (t["addr:housenumber"] && t["addr:street"]) { const c = e.type === "node" ? [e.lat, e.lon] : e.center ? [e.center.lat, e.center.lon] : null; if (c) A.push([t["addr:street"], t["addr:housenumber"], Math.round(c[0] * 1e4) / 1e4, Math.round(c[1] * 1e4) / 1e4]); }
  }
  return res.status(200).json({ W, A });
}
