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
    const haal = async qq => {
      const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 6000);
      try { const r = await fetch("https://geo.api.vlaanderen.be/geolocation/v4/Location?c=5&q=" + encodeURIComponent(qq), { signal: ctrl.signal, headers: { Accept: "application/json" } }); if (!r.ok) throw new Error("status " + r.status); return ((await r.json()).LocationResult || []); }
      catch (e) { console.error("adres", e.message); return []; } finally { clearTimeout(t); }
    };
    // zonder postcode of gemeente: adressen in Aalst (en deelgemeenten) eerst voorstellen
    const metPlaats = /\b\d{4}\b/.test(q) || /,/.test(q);
    const [A, B] = await Promise.all([metPlaats ? [] : haal(q + " Aalst"), haal(q)]);
    const gezien = new Set(), L = [];
    for (const x of [...A.filter(x => x.Municipality === "Aalst"), ...B]) {
      const o = { s: x.Thoroughfarename || "", n: x.Housenumber || "", p: x.Zipcode || "", g: x.Municipality || "", t: x.LocationType || "", l: x.FormattedAddress || "" };
      const k = [o.s, o.n, o.p].join("|"); if (!o.s || gezien.has(k)) continue; gezien.add(k); L.push(o);
    }
    L.splice(6);
    res.status(200).json(L);
  } catch (e) { sendError(res, e); }
}
