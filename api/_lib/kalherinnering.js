import { admin, requireUser, sendError, httpErr } from "./sb.js";
import { algemeen, configDoc } from "./publiek.js";
import { tekenRonde } from "./lidlink.js";
import { registreer, sysMail } from "./sjabloon.js";
import { huisstijl, knop, p, esc, lang, plusDagen, site } from "./bevestiging.js";
import { smtpConfigured } from "./smtp.js";
import { meldPush } from "./push.js";

/* ============ Kalenders: herinnering aan wie nog dozen in handen heeft ============
   Een ingesteld aantal dagen vóór "In de bus tegen" (jaren.kalTegen, tandwiel bij Kalenders › Verdeling) krijgt elk lid met
   dozen in handen (jaarleden.kalOpgehaald > 0) één vriendelijke mail. Eén ronde per jaar, vanaf 10u, via de mailwachtrij.
   Config "kalherinnering": {aan, dagen, verstuurd:{[jaar]:{op, aantal, ids}}}
   POST /api/mail?f=kalherinnering {actie:"stand"|"test"} */
export const KH_DEF = { aan: true, dagen: 7 };
const geldig = a => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(String(a || ""));
const vandaagBxl = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Brussels" }).format(new Date());
const uurBxl = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", hour: "2-digit", hour12: false }).format(new Date()));
const getal = n => Number(n || 0).toLocaleString("nl-BE", { maximumFractionDigits: 2 });
export const dozenTekst = n => n === 1 ? "1 doos" : n === 0.5 ? "een halve doos" : n === 0.25 ? "een kwart doos" : getal(n) + " dozen";

registreer({ key: "kalender-herinnering", naam: "Kalenders: herinnering dozen in handen",
  wanneer: "Een ingesteld aantal dagen vóór de deadline “In de bus tegen” (Kalenders › Verdeling › tandwiel), aan leden die nog dozen in handen hebben.",
  onderwerp: "Nog even doorzetten: de laatste kalenders in de bus 📬",
  body: p("Dag {voornaam}!") + p("Eerst en vooral: <b>bedankt</b> om mee te helpen met de kalenderronde. Dankzij jouw inzet vinden heel wat Aalstenaars onze kalender in hun brievenbus.")
    + p("Volgens onze lijst heb je nog <b>{dozen}</b> in handen. Op <b>{deadline}</b> willen we alle kalenders in de bus hebben, nog <b>{dagen}</b> dus. Hopelijk lukt het om ook die laatste kalenders tijdig rond te krijgen!")
    + p("Lukt het niet om alles rond te krijgen, of ben je al klaar maar staat dat nog niet in onze lijst? Laat het ons gewoon even weten, dan zoeken we samen een oplossing.")
    + "{als:link_kaart}<p>{knop_kaart}</p>{/als:link_kaart}"
    + p("Nogmaals bedankt en veel succes met de laatste loodjes!"),
  velden: [["voornaam", "Voornaam"], ["dozen", "Dozen in handen (bv. 2 dozen)"], ["deadline", "In de bus tegen (lang)"], ["dagen", "Nog … dagen (bv. 7 dagen)"], ["jaar", "Jaar"], ["link_kaart", "Persoonlijke link naar de kaart"], ["knop_kaart", "Knop naar de kaart"]],
  voorbeeld: { voornaam: "Jan", dozen: "2 dozen", deadline: "donderdag 10 december", dagen: "7 dagen", jaar: "2026", link_kaart: "https://vbha.be/kaart" } });

async function stand(sb) {
  const A = await algemeen(sb), jaar = Number(A.jaar), c = { ...KH_DEF, ...(await configDoc(sb, "kalherinnering")) };
  const { data: J } = await sb.from("jaren").select("data").eq("id", String(jaar)).maybeSingle();
  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(String(J?.data?.kalTegen || "")) ? J.data.kalTegen : "";
  const dagen = Math.max(1, Math.min(60, Number(c.dagen) || 7)), op = deadline ? plusDagen(deadline, -dagen) : "";
  const { data: R, error } = await sb.from("jaarleden").select("id,data").like("id", jaar + "\\_%"); if (error) throw error;
  const H = (R || []).filter(r => (Number(r.data?.kalOpgehaald) || 0) > 0);
  const ids = H.map(r => r.data.lidId).filter(Boolean);
  const L = new Map(); for (let i = 0; i < ids.length; i += 200) { const { data } = await sb.from("leden").select("id,data").in("id", ids.slice(i, i + 200)); for (const l of data || []) L.set(l.id, l.data || {}); }
  const lijst = H.map(r => { const l = r.data.lidId ? L.get(r.data.lidId) : null;
    return { id: r.id, lidId: r.data.lidId || null, naam: l ? `${l.naam || ""} ${l.voornaam || ""}`.trim() : (r.data.naam || ""), voornaam: (l && l.voornaam) || "", aan: l ? String(l.email || "").trim() : "", dozen: Number(r.data.kalOpgehaald) || 0 }; });
  const vorige = (c.verstuurd || {})[jaar] || null;
  return { A, jaar, c, aan: c.aan !== false, dagen, deadline, op, lijst, vorige };
}

async function mailVoor(sb, X, x, vandaag) {
  const rest = Math.max(0, Math.round((Date.parse(X.deadline) - Date.parse(vandaag || vandaagBxl())) / 864e5));
  const link = x.lidId ? site() + `/kaart?k=${encodeURIComponent(x.lidId)}&j=${X.jaar}&t=${tekenRonde(x.lidId, X.jaar)}` : "";
  const m = await sysMail(sb, "kalender-herinnering", { voornaam: esc(x.voornaam || x.naam), dozen: esc(dozenTekst(x.dozen)), deadline: esc(lang(X.deadline).replace(/ \d{4}$/, "")),
    dagen: rest === 1 ? "1 dag" : rest + " dagen", jaar: String(X.jaar), link_kaart: link ? esc(link) : "", knop_kaart: link ? knop("Bekijk jouw straten op de kaart", link) : "" });
  return { onderwerp: m.onderwerp, html: huisstijl(m.html, X.A.vereniging) };
}

/* geplande taak (elke minuut via de mailwachtrij-cron): één ronde per jaar */
export async function kalHerinneringCron(sb) {
  { // snelle controle vóór de ledenlijst geladen wordt
    const c = { ...KH_DEF, ...(await configDoc(sb, "kalherinnering")) }; if (c.aan === false) return { uit: true };
    const A = await algemeen(sb); if ((c.verstuurd || {})[A.jaar]) return { al: c.verstuurd[A.jaar].op };
    const { data: J } = await sb.from("jaren").select("data").eq("id", String(A.jaar)).maybeSingle(); const t = String(J?.data?.kalTegen || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t) || vandaagBxl() < plusDagen(t, -(Math.max(1, Math.min(60, Number(c.dagen) || 7)))) || vandaagBxl() > t) return { wacht: true };
  }
  const X = await stand(sb); if (!X.aan) return { uit: true };
  const nu = vandaagBxl();
  if (!X.deadline || nu < X.op || nu > X.deadline || uurBxl() < 10) return { wacht: X.op || null };
  if (X.vorige) return { al: X.vorige.op };
  if (!smtpConfigured()) return { geenSmtp: true };
  const doel = X.lijst.filter(x => geldig(x.aan)), berichten = [];
  for (const x of doel) { const m = await mailVoor(sb, X, x, nu); berichten.push({ batch: "kalender-herinnering-" + X.jaar, data: { aan: x.aan, aanNaam: x.naam, onderwerp: m.onderwerp, html: m.html } }); }
  // eerst als verstuurd noteren (nooit twee keer), dan in de wachtrij
  const c2 = await configDoc(sb, "kalherinnering");
  await sb.from("config").upsert({ id: "kalherinnering", data: { ...c2, verstuurd: { ...(c2.verstuurd || {}), [X.jaar]: { op: new Date().toISOString(), aantal: berichten.length, zonder: X.lijst.length - doel.length, ids: doel.map(x => x.id) } } } });
  for (let i = 0; i < berichten.length; i += 200) { const { error } = await sb.from("mail_wachtrij").insert(berichten.slice(i, i + 200)); if (error) throw error; }
  if (berichten.length) { try { await meldPush(sb, "beheerder", { titel: "Herinnering kalenders verstuurd", tekst: `${berichten.length} ${berichten.length === 1 ? "lid" : "leden"} met dozen in handen kregen een herinnering.`, url: "/#kalenders", tag: "kal-herinnering" }); } catch (e) { console.error("kh push", e); } }
  return { verstuurd: berichten.length };
}

export async function kalHerinneringApi(req, res) {
  try {
    res.setHeader("Cache-Control", "no-store");
    let b = req.body || {}; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
    const { user } = await requireUser(req, { write: true, functie: "kalverdeling" });
    const sb = admin(), X = await stand(sb);
    if (b.actie === "stand") return res.status(200).json({ jaar: X.jaar, aan: X.aan, dagen: X.dagen, deadline: X.deadline, op: X.op, aantal: X.lijst.filter(x => geldig(x.aan)).length, zonder: X.lijst.filter(x => !geldig(x.aan)).map(x => x.naam), vorige: X.vorige ? { op: X.vorige.op, aantal: X.vorige.aantal } : null, smtp: smtpConfigured() });
    if (b.actie !== "test") throw httpErr(400, "Onbekende actie.");
    if (!smtpConfigured()) throw httpErr(501, "Versturen is niet ingesteld.");
    if (!X.deadline) throw httpErr(400, "Vul eerst “In de bus tegen” in.");
    const naar = String((user && user.email) || "").trim(); if (!geldig(naar)) throw httpErr(400, "Geen e-mailadres gevonden voor jouw account.");
    const vb = X.lijst.find(x => x.lidId) || { lidId: null, naam: "Jan", voornaam: "Jan", dozen: 2 };
    const m = await mailVoor(sb, X, vb, X.op);
    const { error } = await sb.from("mail_wachtrij").insert({ batch: "kalender-herinnering-voorbeeld", data: { aan: naar, aanNaam: "Voorbeeld", onderwerp: "[Voorbeeld] " + m.onderwerp, html: m.html } }); if (error) throw error;
    return res.status(200).json({ ok: true, naar });
  } catch (e) { sendError(res, e); }
}
