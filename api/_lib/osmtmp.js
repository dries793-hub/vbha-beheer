import { isDbCron, httpErr } from "./sb.js";
// TIJDELIJK (eenmalige import van ontbrekende straten voor de kalenderronde): straten en huisnummers uit OpenStreetMap.
// Enkel via de geplande-taaksleutel. Wordt na de import weer verwijderd.
export async function osmTmp(req, res) {
  if (!(await isDbCron(req))) throw httpErr(403, "Geen toegang");
  const B = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  res.setHeader("Cache-Control", "no-store");
  if (B.url) { // verkennen: enkel geo.api.vlaanderen.be
    const u = new URL(B.url); if (!["geo.api.vlaanderen.be", "api.basisregisters.vlaanderen.be"].includes(u.hostname)) throw httpErr(400, "host");
    const r = await fetch(u, { headers: { "User-Agent": "vbha-beheer" } }); const t = await r.text();
    return res.status(200).json({ status: r.status, len: t.length, tekst: t.slice(B.van || 0, (B.van || 0) + (B.max || 20000)) });
  }
  if (B.posStraten) { // per straat de adrespunten (WFS) en tellen per gebied (ringen in B.ringen), uniek per huisnummer, enkel InGebruik
    const ringen = B.ringen || {}, inRing = (p, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [yi, xi] = r[i], [yj, xj] = r[j]; if (((yi > p[0]) !== (yj > p[0])) && (p[1] < (xj - xi) * (p[0] - yi) / (yj - yi) + xi)) c = !c; } return c; };
    const gebied = p => { for (const [n, rs] of Object.entries(ringen)) if (rs.some(r => inRing(p, r))) return n; return "buiten"; };
    const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const uit = {}, L = B.posStraten.slice(0, 300); let i = 0;
    const een = async n => { const f = `<fes:Filter xmlns:fes="http://www.opengis.net/fes/2.0"><fes:And><fes:PropertyIsEqualTo><fes:ValueReference>Straatnaam</fes:ValueReference><fes:Literal>${esc(n)}</fes:Literal></fes:PropertyIsEqualTo><fes:PropertyIsEqualTo><fes:ValueReference>Gemeentenaam</fes:ValueReference><fes:Literal>${esc(B.gemeente || "Aalst")}</fes:Literal></fes:PropertyIsEqualTo></fes:And></fes:Filter>`;
      const u = new URL("https://geo.api.vlaanderen.be/Adressenregister/wfs"); Object.entries({ service: "WFS", version: "2.0.0", request: "GetFeature", typeNames: "Adressenregister:Adres", outputFormat: "application/json", srsName: "EPSG:4326", count: "3000", propertyName: "Huisnummer,AdresStatus,AdresPositie", FILTER: f }).forEach(([k, v]) => u.searchParams.set(k, v));
      const r = await fetch(u, { headers: { "User-Agent": "vbha-beheer" } }); if (!r.ok) { uit[n] = { fout: r.status }; return; }
      const j = await r.json(), per = {};
      for (const ft of j.features || []) { const pr = ft.properties || {}; if (pr.AdresStatus && pr.AdresStatus !== "InGebruik") continue; const c = ft.geometry && ft.geometry.coordinates; if (!c) continue; const g = gebied([c[1], c[0]]); (per[g] = per[g] || new Set()).add(String(pr.Huisnummer || "").toLowerCase()); }
      uit[n] = Object.fromEntries(Object.entries(per).map(([g, s]) => [g, s.size])); };
    const werker = async () => { while (i < L.length) { const n = L[i++]; try { await een(n); } catch (e) { uit[n] = { fout: String(e.message || e).slice(0, 80) }; } } };
    await Promise.all([werker(), werker(), werker(), werker(), werker(), werker()]);
    return res.status(200).json({ uit });
  }
  if (B.straten) { // per straatnaam het aantal adressen in de gemeente (adressenregister, status inGebruik)
    const uit = {}, L = B.straten.slice(0, 400); let i = 0, fouten = 0;
    const een = async n => { let tot = 0; const nrs = new Set(); let off = 0;
      for (let pag = 0; pag < 6; pag++) {
        const u = new URL("https://api.basisregisters.vlaanderen.be/v2/adressen"); u.searchParams.set("gemeentenaam", B.gemeente || "Aalst"); u.searchParams.set("straatnaam", n); u.searchParams.set("status", "inGebruik"); u.searchParams.set("limit", "500"); u.searchParams.set("offset", String(off));
        const r = await fetch(u, { headers: { Accept: "application/ld+json", "User-Agent": "vbha-beheer" } }); if (!r.ok) { fouten++; uit[n] = { fout: r.status }; return; }
        const j = await r.json(), A = j.adressen || []; for (const a of A) { tot++; nrs.add(String(a.huisnummer || "").toLowerCase()); }
        if (A.length < 500) break; off += 500; }
      uit[n] = { tot, uniek: nrs.size }; };
    const werker = async () => { while (i < L.length) { const n = L[i++]; try { await een(n); } catch (e) { uit[n] = { fout: String(e.message || e).slice(0, 80) }; } } };
    await Promise.all([werker(), werker(), werker(), werker(), werker(), werker()]);
    return res.status(200).json({ uit, fouten });
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
