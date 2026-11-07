import { requireUser, sendError, httpErr } from "./_lib/sb.js";
import { smtpConfigured, afzender, verstuur } from "./_lib/smtp.js";
import { ondertekenLinks } from "./_lib/lidlink.js";
import { herinneringen, herinneringTest, vergaderingAfgerond } from "./_lib/herinnering.js";
import { bevestigingenCron } from "./_lib/bevestiging.js";
import { factuurActie } from "./_lib/factuur.js";
import { pushApi } from "./_lib/push.js";
import { inkomendApi } from "./_lib/inkomend.js";

// Mails versturen vanuit Communicatie › Mails (enkel voor bewerkers).
// GET  -> {ingesteld, van}
// POST {berichten:[{aan, aanNaam, onderwerp, html}]} -> {resultaten:[{aan, ok, fout}]}  (max. 15 per aanroep)
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.query && req.query.f === "herinnering") return await herinneringen(req, res); // geplande taak (Supabase pg_cron)
    if (req.query && req.query.f === "herinnering-test") return await herinneringTest(req, res); // voorbeeld naar de administrator
    if (req.query && req.query.f === "vergadering-afgerond") return await vergaderingAfgerond(req, res); // verslag + volgende vergadering naar het bestuur
    if (req.query && req.query.f === "inkomend") return await inkomendApi(req, res); // inkomende facturen uit de mailbox
    if (req.query && req.query.f === "push") return await pushApi(req, res); // pushmeldingen: toestel aan- of afmelden, testmelding
    if (req.query && req.query.f === "factuur") return await factuurActie(req, res); // facturatie: PDF, definitief maken, versturen, herinnering
    if (req.query && req.query.f === "bevestigingen") return await bevestigingenCron(req, res); // geplande taak: bevestigingen na 20 min zonder online betaling
    if (req.method === "GET") { await requireUser(req); return res.status(200).json({ ingesteld: smtpConfigured(), van: afzender() }); }
    if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");
    await requireUser(req, { write: true });
    if (!smtpConfigured()) throw httpErr(501, "Versturen is niet ingesteld (SMTP_HOST, SMTP_USER, SMTP_PASS in Vercel).");
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const L = (Array.isArray(b.berichten) ? b.berichten : []).slice(0, 15)
      .map(m => ({ aan: String(m.aan || "").trim(), aanNaam: String(m.aanNaam || "").slice(0, 120), onderwerp: String(m.onderwerp || "").slice(0, 300), html: String(m.html || "").slice(0, 300000), antwoordAan: m.antwoordAan ? String(m.antwoordAan).trim() : "" }))
      .filter(m => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(m.aan) && m.onderwerp);
    if (!L.length) throw httpErr(400, "Geen geldige berichten.");
    for (const m of L) m.html = ondertekenLinks(m.html); // betaallinks voor het lidgeld
    const r = await verstuur(L);
    res.status(200).json({ resultaten: L.map((m, i) => ({ aan: m.aan, ...r[i] })) });
  } catch (e) { sendError(res, e); }
}
