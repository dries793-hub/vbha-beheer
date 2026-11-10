import { requireUser, sendError, httpErr } from "./_lib/sb.js";
import { smtpConfigured, afzender, verstuur } from "./_lib/smtp.js";
import { ondertekenLinks } from "./_lib/lidlink.js";
import { herinneringen, herinneringTest, vergaderingAfgerond } from "./_lib/herinnering.js";
import { bevestigingenCron, kfVoorbeeld } from "./_lib/bevestiging.js";
import { factuurActie } from "./_lib/factuur.js";
import { sponsorBevestiging } from "./_lib/sponsorbev.js";
import { betaalHerinneringApi } from "./_lib/betaalherinnering.js";
import { pushApi } from "./_lib/push.js";
import { inkomendApi } from "./_lib/inkomend.js";
import { inWachtrij, wachtrijCron } from "./_lib/wachtrij.js";
import { fuifApi } from "./_lib/fuif.js";
import { kassaApi } from "./_lib/kassa.js";
import { shopApi } from "./_lib/shop.js";
import r2Api from "./_lib/r2.js";
import smsApi from "./_lib/sms.js";

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
    if (req.query && req.query.f === "betaalherinnering") return await betaalHerinneringApi(req, res); // voorbeeld automatische betalingsherinneringen
    if (req.query && req.query.f === "sponsorbev") return await sponsorBevestiging(req, res); // sponsorbevestiging (PDF / mail)
    if (req.query && req.query.f === "kf-voorbeeld") return await kfVoorbeeld(req, res); // voorbeeld bevestigingsmail kinderfeest
    if (req.query && req.query.f === "sms") return await smsApi(req, res); // sms via BudgetSMS (shiften)
    if (req.query && req.query.f === "bcsplit") { // Bancontact-bulkstortingen opsplitsen (knop in de app of beheerder met geplande-taaksleutel)
      const { requireUser, isDbCron, admin } = await import("./_lib/sb.js"); const { splitsBulk } = await import("./_lib/bcsplit.js");
      let sb; if (req.method === "POST" && await isDbCron(req)) sb = admin(); else { if (req.method !== "POST") return res.status(405).json({ error: "Gebruik POST" }); await requireUser(req, { boek: true }); sb = admin(); }
      let b = req.body || {}; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
      return res.status(200).json(await splitsBulk(sb, { ids: Array.isArray(b.ids) ? b.ids.slice(0, 50).map(String) : null, proef: !!b.proef }));
    }
    if (req.query && req.query.f === "r2") return await r2Api(req, res); // fotoalbums: tijdelijke links naar Cloudflare R2
    if (req.query && req.query.f === "shop") return await shopApi(req, res); // webshop: status van een bestelling, mails
    if (req.query && req.query.f === "kfcadeau") { const { kfCadeauApp } = await import("./_lib/kfcadeau.js"); return await kfCadeauApp(req, res); } // kinderfeest: cadeaulink, prijzen en voorraad opnieuw controleren
    if (req.query && req.query.f === "kassa") return await kassaApi(req, res); // kassa: transacties wissen of nakijken
    if (req.query && req.query.f === "fuif") return await fuifApi(req, res); // fuif: tickets scannen en bestellingen beheren
    if (req.query && req.query.f === "wachtrij") return await wachtrijCron(req, res); // geplande taak: bulkmails uit de wachtrij versturen
    if (req.query && req.query.f === "bevestigingen") return await bevestigingenCron(req, res); // geplande taak: bevestigingen na 20 min zonder online betaling
    if (req.method === "GET") { await requireUser(req); return res.status(200).json({ ingesteld: smtpConfigured(), van: afzender() }); }
    if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");
    await requireUser(req, { write: true, functie: "mails" });
    if (!smtpConfigured()) throw httpErr(501, "Versturen is niet ingesteld (SMTP_HOST, SMTP_USER, SMTP_PASS in Vercel).");
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    if (b.wachtrij) return await inWachtrij(req, res, b); // bulkmail: in de wachtrij, de server verstuurt ze gespreid
    const L = (Array.isArray(b.berichten) ? b.berichten : []).slice(0, 15)
      .map(m => ({ aan: String(m.aan || "").trim(), aanNaam: String(m.aanNaam || "").slice(0, 120), onderwerp: String(m.onderwerp || "").slice(0, 300), html: String(m.html || "").slice(0, 300000), antwoordAan: m.antwoordAan ? String(m.antwoordAan).trim() : "" }))
      .filter(m => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(m.aan) && m.onderwerp);
    if (!L.length) throw httpErr(400, "Geen geldige berichten.");
    for (const m of L) m.html = ondertekenLinks(m.html); // betaallinks voor het lidgeld
    const r = await verstuur(L, { geenLog: true }); // staat al in het logboek als verzending (mailings)
    res.status(200).json({ resultaten: L.map((m, i) => ({ aan: m.aan, ...r[i] })) });
  } catch (e) { sendError(res, e); }
}
