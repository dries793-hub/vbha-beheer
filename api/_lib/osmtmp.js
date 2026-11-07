import { isDbCron, httpErr } from "./sb.js";
// TIJDELIJK (eenmalige import van ontbrekende straten voor de kalenderronde): straten en huisnummers uit OpenStreetMap.
// Enkel via de geplande-taaksleutel. Wordt na de import weer verwijderd.
export async function osmTmp(req, res) {
  if (!(await isDbCron(req))) throw httpErr(403, "Geen toegang");
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
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ W, A });
}
