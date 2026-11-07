import { admin, sendError, httpErr } from "./sb.js";
import { rateLimit } from "./publiek.js";

// Adressuggesties (Geolocation Service van Digitaal Vlaanderen, adressen uit het Adressenregister):
// GET /api/adres?q=kerkstraat 1 aal -> [{s: straat, n: huisnummer, p: postcode, g: gemeente, t: soort, l: label}]
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, max-age=300");
  try {
    if (req.method !== "GET") throw httpErr(405, "Gebruik GET");
    const q = String(req.query?.q || "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
    if (q.length < 3) return res.status(200).json([]);
    await rateLimit(admin(), req, "adres", 300, 600, httpErr);
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 6000);
    let j;
    try {
      const r = await fetch("https://geo.api.vlaanderen.be/geolocation/v4/Location?c=5&q=" + encodeURIComponent(q), { signal: ctrl.signal, headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error("status " + r.status);
      j = await r.json();
    } catch (e) { console.error("adres", e.message); return res.status(200).json([]); } finally { clearTimeout(t); }
    const L = (j && j.LocationResult || []).map(x => ({ s: x.Thoroughfarename || "", n: x.Housenumber || "", p: x.Zipcode || "", g: x.Municipality || "", t: x.LocationType || "", l: x.FormattedAddress || "" })).filter(x => x.s);
    res.status(200).json(L);
  } catch (e) { sendError(res, e); }
}
