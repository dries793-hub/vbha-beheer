import { admin, sendError, httpErr } from "./sb.js";
import { algemeen, clean, body, nieuwId, spamCheck, rateLimit, norm } from "./publiek.js";
import { meldPush } from "./push.js";
import { adresVolledig, ADRES_FOUT } from "./adrescheck.js";
import KS from "./kalstraten.js";

/* ---- controle tegen de kalenderronde: ligt het adres in de verdeelregio en is die straat (dat stuk straat) al bedeeld? ---- */
const inRing = (p, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const yi = r[i][0], xi = r[i][1], yj = r[j][0], xj = r[j][1]; if (((yi > p[0]) !== (yj > p[0])) && (p[1] < (xj - xi) * (p[0] - yi) / (yj - yi) + xi)) c = !c; } return c; };
const binnen = p => !KS.grens.length || KS.grens.some(r => inRing(p, r));
const nm = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
function afstand(p, a, b) { // meter van punt p tot lijnstuk a-b
  const k = Math.cos(p[0] * Math.PI / 180) * 111320, X = q => [(q[1] - p[1]) * k, (q[0] - p[0]) * 111320];
  const A = X(a), B = X(b), dx = B[0] - A[0], dy = B[1] - A[1], L = dx * dx + dy * dy;
  const t = L ? Math.max(0, Math.min(1, -(A[0] * dx + A[1] * dy) / L)) : 0;
  return Math.hypot(A[0] + t * dx, A[1] + t * dy);
}
function dichtsteDeel(p, straat) {
  const s = nm(straat); let best = null;
  for (const d of KS.delen) {
    const zelfde = s && nm(d.n) === s; if (s && !zelfde) continue;
    for (const l of d.g) for (let i = 1; i < l.length; i++) { const m = afstand(p, l[i - 1], l[i]); if (!best || m < best.m) best = { d, m }; }
  }
  return best && best.m < (s ? 400 : 80) ? best.d : null;
}

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
    return { lat: x.Location.Lat_WGS84, lng: x.Location.Lon_WGS84, adres: x.FormattedAddress || "", huisnummer: !!x.Housenumber, straat: x.Thoroughfarename || "" };
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
    if (!adresVolledig(adres)) throw httpErr(400, ADRES_FOUT);
    const email = clean(b.email, 120);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw httpErr(400, "Dit e-mailadres klopt niet.");
    const A = await algemeen(sb), jaar = A.jaar;
    const P = await zoekPunt(adres);
    const vast = P && P.huisnummer ? P.adres : adres;
    // controle tegen de kalenderronde
    let deel = null, toch = !!b.toch;
    if (P && P.lat && P.lng) {
      const p = [P.lat, P.lng];
      if (!binnen(p)) throw httpErr(422, "Dit adres ligt buiten de wijken waar wij de kalender bedelen (Aalst-centrum, Gijzegem, Hofstade en Nieuwerkerken). Je kan de kalender wel steunen via de knop op vbha.be.");
      deel = dichtsteDeel(p, P.straat) || dichtsteDeel(p, "");
      if (deel && !toch) {
        const { data: rr } = await sb.from("ronde").select("id,data").in("id", [`${jaar}_${deel.id}`, `${jaar}_${deel.sid}`]);
        const klaar = (rr || []).find(r => r.data && r.data.status !== "reserved" && r.data.straat);
        if (klaar) return res.status(200).json({ ok: false, gedaan: true, straat: deel.n, op: klaar.data.at || null, adres: vast, jaar });
      }
    }
    // hetzelfde adres dit jaar al doorgegeven? Dan niet dubbel.
    const { data: al } = await sb.from("kalenderaanvragen").select("id,data").eq("data->>jaar", String(jaar)).limit(2000);
    if ((al || []).some(r => norm(r.data.adres).replace(/[^a-z0-9]/g, "") === norm(vast).replace(/[^a-z0-9]/g, ""))) return res.status(200).json({ ok: true, al: true, adres: vast, jaar });
    const d = { jaar, adres: vast, ingetypt: adres !== vast ? adres : undefined, naam: clean(b.naam, 80), email, opmerking: clean(b.opmerking, 300),
      lat: P ? P.lat : null, lng: P ? P.lng : null, gevonden: !!(P && P.huisnummer), straat: deel ? deel.id : undefined, tochNiet: toch || undefined, bron: "formulier", aangemeld: new Date().toISOString(), status: "open", nieuw: true };
    const id = nieuwId("kal");
    const { error } = await sb.from("kalenderaanvragen").insert({ id, data: d });
    if (error) throw error;
    await meldPush(sb, "iedereen", { titel: toch ? "Kalender toch niet ontvangen" : "Kalender aan huis gevraagd", tekst: vast + (d.naam ? " · " + d.naam : "") + (toch ? " (straat stond als bedeeld)" : ""), url: "/#ronde", tag: "kal-" + id });
    res.status(200).json({ ok: true, adres: vast, jaar });
  } catch (e) { sendError(res, e); }
}
