import { admin, requireUser, sendError, httpErr } from "./sb.js";
import { clean, body, nieuwId, algemeen, configDoc, spamCheck, actieveLeden, inschrijving, rateLimit, datumTekst } from "./publiek.js";
import { meldPush } from "./push.js";
import { kloptVul, tekenVul } from "./lidlink.js";
import { registreer, sysMail } from "./sjabloon.js";
import { huisstijl, kaderBlok, knop, tabel, rij, p, esc, lang, site } from "./bevestiging.js";
import { smtpConfigured } from "./smtp.js";

/* ============ Uitwisseling Pontoise (vbha.be/pontoise) ============
   Elk jaar gaat een groep (max. 10, instelbaar) collega's een weekend naar de brandweer van Pontoise (Frankrijk).
   Leden stellen zich kandidaat via de openbare pagina (of de persoonlijke link uit de uitnodiging); de selectie gebeurt in de beheerapp.
   Config "pontoise": { jaar, titel, datum, datumTot, info, open, inschrijvenTot, max, meldAan, malusKeer, malusVorig, uitgenodigd:{<jaar>:{op,aantal,door}} }
   Collectie "pontoise": { jaar, lidId, naam, email, gsm, opmerking, rol:"kandidaat"|"begeleider", keuze:null|"mee"|"reserve"|"niet", bron, aangemeld } */
export async function ptInfo(sb) {
  const A = await algemeen(sb), c = await configDoc(sb, "pontoise");
  const jaar = Number(c.jaar) || A.jaar + 1, datum = /^\d{4}-\d{2}-\d{2}$/.test(c.datum || "") ? c.datum : "";
  const ins = inschrijving(c, datum || jaar + "-01-01");
  return { A, jaar, titel: c.titel || "Uitwisseling Pontoise " + jaar, datum, datumTot: /^\d{4}-\d{2}-\d{2}$/.test(c.datumTot || "") ? c.datumTot : "", info: c.info || "",
    max: Math.max(1, Number(c.max) || 10), meldAan: String(c.meldAan || "").trim(), open: ins.open && !!datum, tot: ins.tot, totTekst: ins.totTekst, gesloten: datum ? ins.gesloten : "manueel", ingesteld: !!datum };
}
const publiek = I => ({ jaar: I.jaar, titel: I.titel, datum: I.datum, datumTot: I.datumTot, info: I.info, max: I.max, open: I.open, tot: I.tot, totTekst: I.totTekst, gesloten: I.gesloten, ingesteld: I.ingesteld });
const geldigMail = a => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(a);
const ptLink = (lidId, jaar) => `${site()}/pontoise?v=${encodeURIComponent(lidId)}&j=${jaar}&t=${encodeURIComponent(tekenVul("pt", lidId, jaar))}`;
// in een zin: "van <b>vrijdag 15 januari</b> tot en met <b>zondag 17 januari 2027</b>" (één dag: "op <b>…</b>")
const weekendZin = I => { const k = x => esc(lang(x).replace(/^./, c => c.toLowerCase())); if (!I.datum) return "op een datum die nog volgt"; if (!I.datumTot || I.datumTot === I.datum) return `op <b>${k(I.datum)}</b>`;
  return `van <b>${k(I.datum).replace(/ \d{4}$/, "")}</b> tot en met <b>${k(I.datumTot)}</b>`; };
const weekend = I => { if (!I.datum) return "datum volgt"; const a = lang(I.datum); if (!I.datumTot || I.datumTot === I.datum) return a; return a.replace(/ \d{4}$/, "") + " tot en met " + lang(I.datumTot).replace(/^./, c => c.toLowerCase()); };
async function alKandidaat(sb, jaar, lidId) {
  const { data } = await sb.from("pontoise").select("id").eq("data->>lidId", String(lidId)).eq("data->>jaar", String(jaar)).limit(1);
  return !!(data && data.length);
}
const AL = jaar => `Je staat al op de lijst voor de uitwisseling met Pontoise ${jaar}. Wil je iets wijzigen? Mail dan naar info@vbha.be.`;

/* ---------- sjablonen ---------- */
registreer({ key: "pontoise-uitnodiging", naam: "Pontoise: uitnodiging om je kandidaat te stellen", wanneer: "Als de beheerder in Activiteiten › Pontoise de actieve leden uitnodigt.",
  onderwerp: "Ga je mee naar Pontoise? Weekend {weekend_kort}",
  body: p("Dag {voornaam}!")
    + p("Ook dit jaar trekken we met een groep collega's naar onze vrienden van de brandweer van <b>Pontoise</b> (Frankrijk). Het weekend gaat door {weekend_zin}.")
    + kaderBlok("Hoe gaat het in zijn werk?", p("Er kunnen maximaal <b>{max} collega's</b> mee. Stel je kandidaat via de knop hieronder{als:tot} (ten laatste op {tot}){/als:tot}. Zijn er meer kandidaten dan plaatsen, dan maken we een selectie. Daarbij houden we rekening met je inzet voor de vriendenkring en je betrokkenheid bij de verbroedering met Pontoise. Collega’s die nog niet of minder vaak mee waren, krijgen ook graag een kans.", "margin:0"))
    + "<p>{knop_inschrijven}</p>"
    + p("Na de inschrijvingen laten we je weten of je mee kan."),
  velden: [["voornaam", "Voornaam"], ["jaar", "Jaar"], ["weekend_zin", "Weekend in een zin (van … tot en met …)"], ["weekend", "Datum weekend (lang)"], ["weekend_kort", "Datum weekend (kort)"], ["max", "Aantal plaatsen"], ["tot", "Kandidaat stellen tot"], ["link_inschrijven", "Persoonlijke link"], ["knop_inschrijven", "Knop kandidaat stellen"]],
  voorbeeld: { voornaam: "Jan", jaar: "2027", weekend_zin: "van <b>vrijdag 15 januari</b> tot en met <b>zondag 17 januari 2027</b>", weekend: "vrijdag 15 januari tot en met zondag 17 januari 2027", weekend_kort: "15 januari 2027", max: "10", tot: "15 december", link_inschrijven: "https://vbha.be/pontoise" } });
registreer({ key: "pontoise-bevestiging", naam: "Pontoise: bevestiging kandidatuur", wanneer: "Nadat een lid zich kandidaat stelde voor de uitwisseling met Pontoise.",
  onderwerp: "Je kandidatuur voor Pontoise {jaar} is goed ontvangen",
  body: p("Dag {voornaam}!")
    + p("Bedankt! Je kandidatuur voor de uitwisseling met <b>Pontoise</b> is goed ontvangen.") + "{gegevens}"
    + p("Er kunnen maximaal {max} collega's mee. Na de inschrijvingen maken we de selectie en laten we je weten of je mee kan."),
  velden: [["voornaam", "Voornaam"], ["jaar", "Jaar"], ["max", "Aantal plaatsen"], ["gegevens", "Tabel met de gegevens"]],
  voorbeeld: { voornaam: "Jan", jaar: "2027", max: "10", gegevens: "" } });
registreer({ key: "pontoise-melding", naam: "Pontoise: melding nieuwe kandidaat", wanneer: "Bij elke nieuwe kandidaat voor Pontoise, naar het adres in de instellingen van Pontoise (standaard info@vbha.be).",
  onderwerp: "Nieuwe kandidaat Pontoise: {naam}",
  body: p("Hallo!") + p("<b>{naam}</b> stelde zich kandidaat voor de uitwisseling met Pontoise {jaar}.") + "{gegevens}"
    + p("Er zijn nu <b>{aantal}</b> kandidaten voor {max} plaatsen.") + "<p>{knop_app}</p>",
  velden: [["naam", "Naam kandidaat"], ["jaar", "Jaar"], ["aantal", "Aantal kandidaten"], ["max", "Aantal plaatsen"], ["gegevens", "Tabel met de gegevens"], ["knop_app", "Knop naar de beheerapp"]],
  voorbeeld: { naam: "Peeters Jan", jaar: "2027", aantal: "4", max: "10", gegevens: "" } });

export async function uitnodigingMail(sb, I, l) {
  const link = ptLink(l.id, I.jaar);
  const m = await sysMail(sb, "pontoise-uitnodiging", { voornaam: esc(l.voornaam || l.naam), jaar: I.jaar, weekend: esc(weekend(I).replace(/^./, c => c.toLowerCase())), weekend_zin: weekendZin(I), weekend_kort: esc(I.datum ? datumTekst(I.datum) : "datum volgt"),
    max: I.max, tot: I.open && I.tot ? esc(datumTekst(I.tot).replace(/ \d{4}$/, "")) : "", link_inschrijven: esc(link), knop_inschrijven: knop("Ik ga graag mee", link) });
  return { onderwerp: m.onderwerp, html: huisstijl(m.html, I.A.vereniging) };
}
async function verstuurNu(sb, batch, berichten) {
  if (!berichten.length) return 0;
  const { error } = await sb.from("mail_wachtrij").insert(berichten.map(data => ({ batch, data }))); if (error) throw error;
  return berichten.length;
}

/* ---------- openbare pagina ---------- */
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const sb = admin();
    if (req.method === "GET") {
      const I = await ptInfo(sb), lidId = String(req.query?.lid || "");
      if (req.query && req.query.v) { // persoonlijke link uit de uitnodiging
        const v = String(req.query.v);
        if (!kloptVul("pt", v, I.jaar, String(req.query.t || ""))) return res.status(200).json(publiek(I));
        const l = (await actieveLeden(sb, I.A.jaar)).find(x => x.id === v); if (!l) return res.status(200).json(publiek(I));
        const al = await alKandidaat(sb, I.jaar, l.id);
        return res.status(200).json({ ...publiek(I), vul: { lidId: l.id, lid: l.voornaam && l.an ? `${l.voornaam} ${l.an}` : l.naam, voornaam: l.voornaam || "", al: al ? AL(I.jaar) : "" } });
      }
      if (!lidId) return res.status(200).json(publiek(I));
      await rateLimit(sb, req, "lidinfo", 60, 600, httpErr);
      if (!(await actieveLeden(sb, I.A.jaar)).some(l => l.id === lidId)) throw httpErr(404, "Lid niet gevonden.");
      if (await alKandidaat(sb, I.jaar, lidId)) return res.status(200).json({ al: true, melding: AL(I.jaar) });
      return res.status(200).json({ ok: true });
    }
    if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");
    const b = body(req);
    await rateLimit(sb, req, "post", 20, 3600, httpErr);
    if (await spamCheck(sb, "pontoise", b, httpErr)) return res.status(200).json({ ok: true });
    const I = await ptInfo(sb);
    if (!I.open) throw httpErr(403, "Kandidaat stellen voor Pontoise kan op dit moment niet.");
    const l = (await actieveLeden(sb, I.A.jaar)).find(x => x.id === String(b.lidId || ""));
    if (!l) throw httpErr(400, "Kies je naam uit de lijst van leden.");
    if (await alKandidaat(sb, I.jaar, l.id)) throw httpErr(409, AL(I.jaar));
    const { data: lr } = await sb.from("leden").select("data").eq("id", l.id).maybeSingle();
    const ld = (lr && lr.data) || {};
    let email = clean(ld.email || "", 160); const eigen = clean(b.email, 160).toLowerCase(); if (eigen && geldigMail(eigen)) email = eigen;
    const gsm = clean(b.gsm, 30) || clean(ld.gsm || ld.telefoon || "", 30);
    const id = nieuwId("pt");
    const d = { jaar: I.jaar, lidId: l.id, naam: l.naam, email, gsm, opmerking: clean(b.opmerking, 400), rol: "kandidaat", keuze: null, bron: "formulier", aangemeld: new Date().toISOString(), nieuw: true };
    const { error } = await sb.from("pontoise").insert({ id, data: d }); if (error) throw error;
    const { count } = await sb.from("pontoise").select("id", { count: "exact", head: true }).eq("data->>jaar", String(I.jaar));
    const gegevens = tabel([rij("Naam", esc(l.naam)), rij("Weekend", esc(weekend(I))), gsm ? rij("Gsm", esc(gsm)) : "", d.opmerking ? rij("Opmerking", esc(d.opmerking)) : ""].filter(Boolean));
    const mails = [];
    try {
      if (smtpConfigured() && geldigMail(email)) { const m = await sysMail(sb, "pontoise-bevestiging", { voornaam: esc(l.voornaam || l.naam), jaar: I.jaar, max: I.max, gegevens });
        mails.push({ aan: email, aanNaam: l.naam, onderwerp: m.onderwerp, html: huisstijl(m.html, I.A.vereniging) }); }
      const meld = I.meldAan || "info@vbha.be";
      if (smtpConfigured() && geldigMail(meld)) { const m = await sysMail(sb, "pontoise-melding", { naam: esc(l.naam), jaar: I.jaar, aantal: count || 1, max: I.max, gegevens, knop_app: knop("Bekijk de kandidaten", "https://beheer.vbha.be/#pontoise") });
        mails.push({ aan: meld, aanNaam: "Pontoise", onderwerp: m.onderwerp, html: huisstijl(m.html, I.A.vereniging), ...(geldigMail(email) ? { antwoordAan: email } : {}) }); }
      await verstuurNu(sb, "pontoise-" + I.jaar, mails);
    } catch (e) { console.error("pontoise mail", e); }
    await meldPush(sb, "iedereen", { titel: "Nieuwe kandidaat Pontoise", tekst: `${l.naam} · ${count || 1} ${count === 1 ? "kandidaat" : "kandidaten"} voor ${I.max} plaatsen`, url: "/#pontoise", tag: "ins-pt-" + id, lidId: l.id }).catch(() => {});
    res.status(200).json({ ok: true, jaar: I.jaar, voornaam: l.voornaam || l.naam, naam: l.naam, weekend: weekend(I), max: I.max });
  } catch (e) { sendError(res, e); }
}

/* ---------- beheerapp: uitnodiging naar de actieve leden ----------
   POST /api/mail?f=pontoise {actie:"aantal"|"test"|"uitnodigen", erewacht:bool} */
export async function pontoiseApp(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const { sb: usb, user } = await requireUser(req, { write: true, functie: "pontoise" });
    const sb = admin(); let b = req.body || {}; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
    const I = await ptInfo(sb);
    if (!I.datum) throw httpErr(400, "Stel eerst de datum van het weekend in (tandwiel).");
    const L = await actieveLeden(sb, I.A.jaar);
    const { data: lr } = await sb.from("leden").select("id,data").limit(3000); const LD = new Map((lr || []).map(r => [r.id, r.data || {}]));
    const { data: pr } = await sb.from("pontoise").select("data").eq("data->>jaar", String(I.jaar)); const al = new Set((pr || []).map(r => (r.data || {}).lidId).filter(Boolean));
    const doel = L.filter(l => { const d = LD.get(l.id) || {}; if (al.has(l.id) || d.test || d.overleden) return false; if (!b.erewacht && d.categorie === "Erewacht") return false; return geldigMail(String(d.email || l.em || "").trim()); })
      .map(l => ({ ...l, email: String((LD.get(l.id) || {}).email || l.em).trim() }));
    const c = await configDoc(sb, "pontoise"), vorige = ((c.uitgenodigd || {})[I.jaar]) || null;
    if (b.actie === "aantal") return res.status(200).json({ aantal: doel.length, al: al.size, vorige, smtp: smtpConfigured(), open: I.open, jaar: I.jaar });
    if (!smtpConfigured()) throw httpErr(501, "Versturen is niet ingesteld.");
    if (b.actie === "test") {
      const naar = String(user && user.email || "").trim(); if (!geldigMail(naar)) throw httpErr(400, "Geen e-mailadres gevonden voor jouw account.");
      const vb = doel[0] || L[0]; if (!vb) throw httpErr(400, "Geen leden gevonden.");
      const m = await uitnodigingMail(sb, I, vb);
      await verstuurNu(sb, "pontoise-voorbeeld", [{ aan: naar, aanNaam: "Voorbeeld", onderwerp: "[Voorbeeld] " + m.onderwerp, html: m.html }]);
      return res.status(200).json({ ok: true, naar });
    }
    if (b.actie !== "uitnodigen") throw httpErr(400, "Onbekende actie.");
    if (!I.open) throw httpErr(400, "Kandidaat stellen staat niet open. Zet de inschrijvingen open in de instellingen van Pontoise.");
    const berichten = []; for (const l of doel) { const m = await uitnodigingMail(sb, I, l); berichten.push({ aan: l.email, aanNaam: l.naam, onderwerp: m.onderwerp, html: m.html }); }
    for (let i = 0; i < berichten.length; i += 200) await verstuurNu(sb, "pontoise-uitnodiging-" + I.jaar, berichten.slice(i, i + 200));
    const { data: c2 } = await sb.from("config").select("data").eq("id", "pontoise").maybeSingle(); const d2 = (c2 && c2.data) || {};
    await sb.from("config").upsert({ id: "pontoise", data: { ...d2, uitgenodigd: { ...(d2.uitgenodigd || {}), [I.jaar]: { op: new Date().toISOString(), aantal: berichten.length, door: (user && user.email) || "" } } } });
    void usb;
    return res.status(200).json({ ok: true, aantal: berichten.length });
  } catch (e) { sendError(res, e); }
}
