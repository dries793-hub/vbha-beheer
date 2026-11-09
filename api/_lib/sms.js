import { requireUser, httpErr, sendError } from "./sb.js";

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
    if (req.method === "GET") { await requireUser(req); return res.status(200).json({ aan: smsAan(), afzender: afzender() }); }
    if (req.method !== "POST") throw httpErr(405, "Niet toegelaten");
    await requireUser(req, { write: true, functie: "agenda" });
    if (!smsAan()) throw httpErr(503, "De sms-dienst is nog niet ingesteld.");
    let b = req.body || {}; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
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
    return res.status(200).json({ resultaten, kost: Math.round(kost * 1000) / 1000 });
  } catch (e) { return sendError(res, e); }
}
