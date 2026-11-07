import { admin, requireUser, isDbCron, httpErr } from "./sb.js";
import { smtpConfigured, verstuur } from "./smtp.js";
import { ondertekenLinks } from "./lidlink.js";

/* ============ Wachtrij voor bulkmails ============
   one.com laat 25 mails per 5 minuten en 250 per uur toe (help.one.com). Daarom zet de app bulkmails in de tabel mail_wachtrij
   en verstuurt de server ze zelf: elke minuut (Supabase pg_cron "mailwachtrij") hoogstens LIMIET_5/5 mails, met marge voor
   bevestigingsmails en dergelijke. Weigert one.com toch ("Too many mails", "Rate limited"), dan pauzeert de hele wachtrij 6 minuten.
   Het venster in de app mag dicht: de mails gaan verder. */
const LIMIET_5 = 18, LIMIET_60 = 200, PER_MINUUT = 4, MAX_POGING = 6;
const TRAAG = ["zonezuidoost.be"], TRAAG_5 = 6; // ontvangende domeinen die snel terugsturen: max. 6 per 5 minuten
const dom = a => String(a || "").split("@")[1]?.toLowerCase() || "";
const isTraag = d => TRAAG.some(t => d === t || d.endsWith("." + t));
const geldig = a => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(a);

// POST /api/mail {wachtrij: "<batch>", berichten:[...]} -> berichten in de wachtrij (links ondertekend)
export async function inWachtrij(req, res, b) {
  await requireUser(req, { write: true });
  if (!smtpConfigured()) throw httpErr(501, "Versturen is niet ingesteld.");
  const batch = String(b.wachtrij || "").slice(0, 80); if (!/^[\w.-]+$/.test(batch)) throw httpErr(400, "Ongeldige wachtrij.");
  const L = (Array.isArray(b.berichten) ? b.berichten : []).slice(0, 25)
    .map(m => ({ aan: String(m.aan || "").trim(), aanNaam: String(m.aanNaam || "").slice(0, 120), onderwerp: String(m.onderwerp || "").slice(0, 300), html: ondertekenLinks(String(m.html || "").slice(0, 300000)), antwoordAan: m.antwoordAan ? String(m.antwoordAan).trim() : "", label: String(b.label || "").slice(0, 120) }))
    .filter(m => geldig(m.aan) && m.onderwerp);
  if (!L.length) throw httpErr(400, "Geen geldige berichten.");
  const { error } = await admin().from("mail_wachtrij").insert(L.map(data => ({ batch, data })));
  if (error) throw error;
  return res.status(200).json({ ok: true, aantal: L.length });
}

async function pauze(sb) { const { data } = await sb.from("config").select("data").eq("id", "mailwachtrij").maybeSingle(); return Date.parse((data && data.data && data.data.pauzeTot) || "") || 0; }
async function zetPauze(sb, ms, reden) { await sb.from("config").upsert({ id: "mailwachtrij", data: { pauzeTot: new Date(Date.now() + ms).toISOString(), reden: String(reden || "").slice(0, 200) } }); }

// geplande taak (elke minuut): volgende mails versturen
export async function wachtrijCron(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!(await isDbCron(req))) throw httpErr(403, "Geen toegang");
  const sb = admin();
  // mails die bij een onderbroken aanroep op "bezig" bleven staan: opnieuw in de rij
  await sb.from("mail_wachtrij").update({ status: "wacht" }).eq("status", "bezig").lt("volgende", new Date(Date.now() - 5 * 60000).toISOString());
  if (Date.now() < await pauze(sb)) return res.status(200).json({ pauze: true });
  const nu = Date.now(), iso = ms => new Date(nu - ms).toISOString();
  const [{ count: n5 }, { count: n60 }] = await Promise.all([
    sb.from("mail_wachtrij").select("id", { count: "exact", head: true }).eq("status", "ok").gte("verstuurd", iso(5 * 60000)),
    sb.from("mail_wachtrij").select("id", { count: "exact", head: true }).eq("status", "ok").gte("verstuurd", iso(60 * 60000))]);
  const ruimte = Math.min(PER_MINUUT, LIMIET_5 - (n5 || 0), LIMIET_60 - (n60 || 0));
  if (ruimte <= 0) return res.status(200).json({ wacht: true, n5, n60 });
  const { data: recent } = await sb.from("mail_wachtrij").select("data").eq("status", "ok").gte("verstuurd", iso(5 * 60000)).limit(50);
  const perDom = new Map(); for (const r of recent || []) { const d = dom(r.data.aan); perDom.set(d, (perDom.get(d) || 0) + 1); }
  const { data: kand } = await sb.from("mail_wachtrij").select("id,data,poging").eq("status", "wacht").lte("volgende", new Date().toISOString()).order("id").limit(60);
  const pak = [];
  for (const r of kand || []) { if (pak.length >= ruimte) break; const d = dom(r.data.aan); if (isTraag(d) && (perDom.get(d) || 0) >= TRAAG_5) continue; perDom.set(d, (perDom.get(d) || 0) + 1); pak.push(r); }
  if (!pak.length) return res.status(200).json({ niets: true });
  // eerst "bezig" zetten, zodat een tweede aanroep dezelfde mails niet opnieuw neemt
  await sb.from("mail_wachtrij").update({ status: "bezig", volgende: new Date().toISOString() }).in("id", pak.map(r => r.id));
  let R;
  try { R = await verstuur(pak.map(r => r.data)); }
  catch (e) { R = pak.map(() => ({ ok: false, fout: String(e.message || e) })); }
  let limiet = false;
  for (let i = 0; i < pak.length; i++) {
    const r = pak[i], x = R[i] || { ok: false, fout: "geen antwoord" };
    if (x.ok) { await sb.from("mail_wachtrij").update({ status: "ok", verstuurd: new Date().toISOString(), fout: null }).eq("id", r.id); continue; }
    const f = String(x.fout || ""), tijdelijk = !/SMTP: 5\d\d/.test(f);
    if (/too many|rate limit|slow down|R2\]|M7\]/i.test(f)) limiet = true;
    const p = (r.poging || 0) + 1;
    if (tijdelijk && p < MAX_POGING) await sb.from("mail_wachtrij").update({ status: "wacht", poging: p, fout: f.slice(0, 300), volgende: new Date(Date.now() + 6 * 60000 * p).toISOString() }).eq("id", r.id);
    else await sb.from("mail_wachtrij").update({ status: "fout", poging: p, fout: f.slice(0, 300) }).eq("id", r.id);
  }
  if (limiet) await zetPauze(sb, 6 * 60000, "one.com: te veel mails");
  return res.status(200).json({ verstuurd: R.filter(x => x && x.ok).length, van: pak.length, limiet });
}
