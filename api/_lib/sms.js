import { requireUser, httpErr, sendError, isDbCron, admin } from "./sb.js";

/* Sms via BudgetSMS (https://www.budgetsms.net), HTTP API sendsms.
   Nodig in Vercel: BUDGETSMS_USERNAME, BUDGETSMS_USERID, BUDGETSMS_HANDLE; optioneel BUDGETSMS_FROM (afzender, max. 11 letters/cijfers, standaard VBHA,
   of een gsm-nummer in internationaal formaat zonder +, bv. 32476123456, als leden moeten kunnen antwoorden).
   In het BudgetSMS-dashboard moet de IP-controle uit staan: de servers van Vercel hebben geen vast IP-adres. */
const env = k => String(process.env[k] || "").trim();
export const smsAan = () => !!(env("BUDGETSMS_USERNAME") && env("BUDGETSMS_USERID") && env("BUDGETSMS_HANDLE"));
const afzender = () => { const f = env("BUDGETSMS_FROM") || "VBHA"; return /^[A-Za-z0-9]{1,11}$/.test(f) || /^\d{8,16}$/.test(f) ? f : "VBHA"; };
// +32476123456 / 0476 12 34 56 / 0032… → 32476123456
export function nummer(t) {
  let d = String(t || "").replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1); else if (d.startsWith("00")) d = d.slice(2); else if (d.startsWith("0") && d.length >= 9) d = "32" + d.slice(1);
  return /^\d{9,15}$/.test(d) ? d : "";
}
const FOUT = { 1001: "Niet genoeg tegoed bij BudgetSMS", 1002: "Gebruikersgegevens BudgetSMS kloppen niet", 1003: "Account BudgetSMS is niet actief", 1004: "IP-controle staat aan bij BudgetSMS (zet ze uit)", 2004: "Afzender ongeldig", 2010: "Nummer verkeerd geformatteerd", 2011: "Nummer ongeldig", 2012: "Tekst te lang", 3001: "Geen route naar dit nummer", 3003: "Nummer ongeldig" };
export async function stuurSms(to, msg) {
  const q = new URLSearchParams({ username: env("BUDGETSMS_USERNAME"), userid: env("BUDGETSMS_USERID"), handle: env("BUDGETSMS_HANDLE"), msg: String(msg).slice(0, 612), from: afzender(), to, price: "1" });
  const r = await fetch("https://api.budgetsms.net/sendsms/?" + q.toString());
  const t = (await r.text()).trim();
  const m = t.match(/^OK\s+(\S+)(?:\s+([\d.]+)\s+(\d+))?/);
  if (m) return { ok: true, id: m[1], prijs: m[2] ? Number(m[2]) : null, delen: m[3] ? Number(m[3]) : null };
  const e = (t.match(/^ERR\s+(\d+)/) || [])[1];
  return { ok: false, code: e || null, fout: FOUT[e] || (e ? "Foutcode " + e : t.slice(0, 80) || "Onbekende fout") };
}

/* /api/mail?f=sms   GET → {aan, afzender}   POST {berichten:[{tel, tekst, label}]} → {resultaten:[{label, ok, fout}], kost} */
export default async function smsApi(req, res) {
  try {
    // controle door de beheerder (geplande-taaksleutel): enkel het tegoed opvragen, er wordt niets verstuurd
    if (req.method === "POST" && await isDbCron(req)) {
      if (!smsAan()) return res.status(200).json({ aan: false });
      const q = new URLSearchParams({ username: env("BUDGETSMS_USERNAME"), userid: env("BUDGETSMS_USERID"), handle: env("BUDGETSMS_HANDLE") });
      const t = (await (await fetch("https://api.budgetsms.net/checkcredit/?" + q.toString())).text()).trim();
      const e = (t.match(/^ERR\s+(\d+)/) || [])[1];
      return res.status(200).json({ aan: true, afzender: afzender(), antwoord: /^OK/.test(t) ? "OK, tegoed " + t.replace(/^OK\s*/, "") : (FOUT[e] || t.slice(0, 60)) });
    }
    if (req.method === "GET") {
      // ?tegoed=1: pagina Sms (functie sms) toont ook het resterende tegoed
      if (req.query && req.query.tegoed) { await requireUser(req, { functie: "sms" });
        if (!smsAan()) return res.status(200).json({ aan: false, afzender: afzender() });
        let tegoed = null;
        try { const q = new URLSearchParams({ username: env("BUDGETSMS_USERNAME"), userid: env("BUDGETSMS_USERID"), handle: env("BUDGETSMS_HANDLE") });
          const t = (await (await fetch("https://api.budgetsms.net/checkcredit/?" + q.toString())).text()).trim(); const m = t.match(/^OK\s+([\d.]+)/); if (m) tegoed = "€ " + Number(m[1]).toFixed(2).replace(".", ","); } catch {}
        return res.status(200).json({ aan: true, afzender: afzender(), tegoed });
      }
      await requireUser(req); return res.status(200).json({ aan: smsAan(), afzender: afzender() });
    }
    if (req.method !== "POST") throw httpErr(405, "Niet toegelaten");
    let b = req.body || {}; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
    const module = b.module === "sms";
    const { user, sb } = await requireUser(req, { write: true, functie: module ? "sms" : "shiften" });
    if (!smsAan()) throw httpErr(503, "De sms-dienst is nog niet ingesteld.");
    const L = (Array.isArray(b.berichten) ? b.berichten : []).slice(0, 40);
    if (!L.length) throw httpErr(400, "Geen berichten.");
    const resultaten = []; let kost = 0;
    for (const m of L) {
      const to = nummer(m.tel), tekst = String(m.tekst || "").trim(), label = String(m.label || "").slice(0, 80);
      if (!to) { resultaten.push({ label, ok: false, fout: "Ongeldig gsm-nummer" }); continue; }
      if (!tekst) { resultaten.push({ label, ok: false, fout: "Lege tekst" }); continue; }
      try { const r = await stuurSms(to, tekst); if (r.prijs) kost += r.prijs; resultaten.push({ label, ok: r.ok, fout: r.fout || null, id: r.id || null });
        if (!r.ok && ["1001", "1002", "1003", "1004"].includes(r.code)) { for (const x of L.slice(L.indexOf(m) + 1)) resultaten.push({ label: String(x.label || "").slice(0, 80), ok: false, fout: r.fout }); break; } }
      catch (e) { resultaten.push({ label, ok: false, fout: "BudgetSMS niet bereikbaar" }); }
    }
    // sms'en van de pagina Sms komen in het logboek (tabel sms): de pagina toont er de verzendingen uit
    if (module) try {
      let wie = user && user.email || "";
      try { const { data } = await (sb || admin()).from("bestuur").select("naam").eq("user_id", user.id).maybeSingle(); if (data && data.naam) wie = data.naam; } catch {}
      const batch = String(b.batch || "").slice(0, 40), tekst = String(L[0] && L[0].tekst || "").slice(0, 300);
      const rows = L.map((m, i) => ({ wie: String(wie).slice(0, 120), tabel: "sms", doc_id: nummer(m.tel) || String(m.label || "").slice(0, 80), actie: "verstuurd",
        nieuw: { batch, aan: String(m.label || "").slice(0, 80), tekst: String(m.tekst || "").slice(0, 640), ok: !!(resultaten[i] && resultaten[i].ok), ...(resultaten[i] && resultaten[i].fout ? { fout: resultaten[i].fout } : {}) } }));
      if (rows.length) await admin().from("logboek").insert(rows);
    } catch (e) { console.error("logboek sms", e); }
    return res.status(200).json({ resultaten, kost: Math.round(kost * 1000) / 1000 });
  } catch (e) { return sendError(res, e); }
}
