import { admin, sendError, httpErr } from "./sb.js";
import { vandaagISO, rateLimit } from "./publiek.js";

/* Openbare deellink voor een map in Documenten: /deel?t=<token>  ->  GET /api/deel?t=<token>
   Geeft de bestanden van die map (en eventueel de submappen) met tijdelijke downloadlinks (1 uur). Niets anders uit de app. */
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  try {
    if (req.method !== "GET") throw httpErr(405, "Gebruik GET");
    const t = String(req.query?.t || "");
    if (!/^[A-Za-z0-9_-]{20,80}$/.test(t)) throw httpErr(404, "Deze link bestaat niet (meer).");
    const sb = admin(); await rateLimit(sb, req, "deel", 120, 600, httpErr);
    const { data: row } = await sb.from("deellinks").select("id,data").eq("id", t).maybeSingle();
    const d = row && row.data;
    if (!d || d.ingetrokken) throw httpErr(404, "Deze link bestaat niet (meer). Vraag een nieuwe link aan wie hem deelde.");
    if (d.tot && vandaagISO() > d.tot) throw httpErr(410, "Deze link is verlopen. Vraag een nieuwe link aan wie hem deelde.");
    const map = String(d.map || "");
    const { data: docs, error } = await sb.from("documenten").select("id,data").limit(2000);
    if (error) throw error;
    const L = (docs || []).map(r => r.data || {}).filter(x => { const m = x.map || "Andere"; return m === map || (d.submappen && m.startsWith(map + "/")); })
      .sort((a, b) => String(a.map || "").localeCompare(String(b.map || ""), "nl") || String(a.naam || "").localeCompare(String(b.naam || ""), "nl"));
    const bestanden = [];
    for (const x of L) {
      if (!x.pad) continue;
      const { data: s1 } = await sb.storage.from("documenten").createSignedUrl(x.pad, 3600, { download: x.naam || true });
      const { data: s2 } = /^image\//.test(x.type || "") || /\.(png|jpe?g|gif|webp|svg)$/i.test(x.naam || "") ? await sb.storage.from("documenten").createSignedUrl(x.pad, 3600) : { data: null };
      bestanden.push({ naam: x.naam || "bestand", grootte: x.grootte || 0, type: x.type || "", sub: x.map && x.map !== map ? x.map.slice(map.length + 1) : "", url: s1 && s1.signedUrl, voorbeeld: s2 && s2.signedUrl });
    }
    try { await sb.from("deellinks").update({ data: { ...d, geopend: (Number(d.geopend) || 0) + 1, laatst: new Date().toISOString() } }).eq("id", t); } catch (e) {}
    return res.status(200).json({ map: map.split("/").pop(), pad: map.split("/").join(" › "), voor: d.voor || "", tot: d.tot || "", bestanden });
  } catch (e) { sendError(res, e); }
}
