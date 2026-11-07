import { admin, sendError, httpErr } from "./sb.js";
import { algemeen, clean, body, nieuwId, spamCheck, rateLimit, norm } from "./publiek.js";
import { meldPush } from "./push.js";

/* ============ Openbare aanvraag "kalender aan huis" ============
   POST /api/kalender {adres, naam?, email?, opmerking?, website (honeypot), duur}
   Het adres wordt opgezocht in het Adressenregister (Geolocation Vlaanderen) voor de stip op de kalenderkaart.
   Tabel kalenderaanvragen: data {jaar, adres, naam, email, opmerking, lat, lng, gevonden, bron, aangemeld, status: open|gedaan, nieuw} */
async function zoekPunt(q) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch("https://geo.api.vlaanderen.be/geolocation/v4/Location?c=1&q=" + encodeURIComponent(q), { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const x = ((await r.json()).LocationResult || [])[0];
    if (!x || !x.Location) return null;
    return { lat: x.Location.Lat_WGS84, lng: x.Location.Lon_WGS84, adres: x.FormattedAddress || "", huisnummer: !!x.Housenumber };
  } catch (e) { console.error("geocode", e.message); return null; } finally { clearTimeout(t); }
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") throw httpErr(405, "Gebruik POST");
    const sb = admin(), b = body(req);
    if (await spamCheck(sb, "kalenderaanvragen", b, httpErr)) return res.status(200).json({ ok: true });
    await rateLimit(sb, req, "kalender", 10, 3600, httpErr);
    const adres = clean(b.adres, 160);
    if (adres.length < 6 || !/\d/.test(adres)) throw httpErr(400, "Vul je volledige adres in, met huisnummer.");
    const email = clean(b.email, 120);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw httpErr(400, "Dit e-mailadres klopt niet.");
    const A = await algemeen(sb), jaar = A.jaar;
    const P = await zoekPunt(adres);
    const vast = P && P.huisnummer ? P.adres : adres;
    // hetzelfde adres dit jaar al doorgegeven? Dan niet dubbel.
    const { data: al } = await sb.from("kalenderaanvragen").select("id,data").eq("data->>jaar", String(jaar)).limit(2000);
    if ((al || []).some(r => norm(r.data.adres).replace(/[^a-z0-9]/g, "") === norm(vast).replace(/[^a-z0-9]/g, ""))) return res.status(200).json({ ok: true, al: true, adres: vast, jaar });
    const d = { jaar, adres: vast, ingetypt: adres !== vast ? adres : undefined, naam: clean(b.naam, 80), email, opmerking: clean(b.opmerking, 300),
      lat: P ? P.lat : null, lng: P ? P.lng : null, gevonden: !!(P && P.huisnummer), bron: "formulier", aangemeld: new Date().toISOString(), status: "open", nieuw: true };
    const id = nieuwId("kal");
    const { error } = await sb.from("kalenderaanvragen").insert({ id, data: d });
    if (error) throw error;
    await meldPush(sb, "iedereen", { titel: "Kalender aan huis gevraagd", tekst: vast + (d.naam ? " · " + d.naam : ""), url: "/#ronde", tag: "kal-" + id });
    res.status(200).json({ ok: true, adres: vast, jaar });
  } catch (e) { sendError(res, e); }
}
