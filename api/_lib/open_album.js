import crypto from "node:crypto";
import { admin, sendError, httpErr } from "./sb.js";
import { rateLimit } from "./publiek.js";

/* Openbaar fotoalbum (Activiteiten › Foto's › eigen album). GET ?f=album&c=<albumId>.<token>
   Enkel gepubliceerde albums met het juiste token. De foto's staan in de afgeschermde opslag;
   we geven tijdelijke links (6 uur) naar de versies met watermerk (pub = groot, klein = overzicht). */
const gelijk = (a, b) => { a = Buffer.from(String(a)); b = Buffer.from(String(b)); return a.length === b.length && crypto.timingSafeEqual(a, b); };

export default async function album(req, res) {
  try {
    if (req.method !== "GET") throw httpErr(405, "Niet toegelaten");
    const c = String(req.query.c || ""), i = c.lastIndexOf(".");
    const id = c.slice(0, i), t = c.slice(i + 1);
    if (i < 1 || !/^[\w-]{3,80}$/.test(id) || !/^[A-Za-z0-9]{16,64}$/.test(t)) throw httpErr(404, "Dit album bestaat niet (meer).");
    const sb = admin();
    await rateLimit(sb, req, "album", 120, 600, httpErr);
    const { data: row } = await sb.from("fotoalbums").select("id,data").eq("id", id).maybeSingle();
    const a = row && row.data;
    if (!a || a.soort !== "eigen" || a.status !== "gepubliceerd" || !a.publiek || !gelijk(a.publiek.token, t)) throw httpErr(404, "Dit album bestaat niet (meer) of is nog niet gepubliceerd.");
    const F = (a.publiek.fotos || []).filter(f => f && /^[\w-]{3,40}$/.test(f.id));
    const paden = F.flatMap(f => [`Albums/${id}/pub/${f.id}.jpg`, `Albums/${id}/klein/${f.id}.jpg`]);
    const urls = {};
    for (let k = 0; k < paden.length; k += 200) {
      const { data, error } = await sb.storage.from("documenten").createSignedUrls(paden.slice(k, k + 200), 6 * 3600);
      if (error) throw error;
      for (const d of data || []) if (d.signedUrl) urls[d.path] = d.signedUrl;
    }
    const fotos = F.map(f => ({ id: f.id, w: f.w, h: f.h, g: urls[`Albums/${id}/pub/${f.id}.jpg`], k: urls[`Albums/${id}/klein/${f.id}.jpg`] })).filter(f => f.g && f.k);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    return res.status(200).json({ titel: a.titel || "Fotoalbum", datum: a.datum || "", omschrijving: a.omschrijving || "", fotograaf: a.fotograaf || "", cover: a.cover || (fotos[0] && fotos[0].id) || null, fotos });
  } catch (e) { return sendError(res, e); }
}
