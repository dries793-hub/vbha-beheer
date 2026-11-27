import { admin, requireUser, sendError, httpErr } from "./sb.js";
import { algemeen, configDoc, actieveLeden, inschrijving, datumTekst, norm } from "./publiek.js";
import { tekenVul } from "./lidlink.js";
import { registreer, sysMail } from "./sjabloon.js";
import { huisstijl, kaderBlok, knop, tabel, rij, p, esc, lang, site, eur } from "./bevestiging.js";
import { smtpConfigured } from "./smtp.js";

/* ============ Leden uitnodigen voor een activiteit (banket, kinderfeest, familiedag, Pontoise) ============
   POST /api/mail?f=uitnodiging {soort, actie:"aantal"|"test"|"versturen", doel:"actief"|"alle", overslaan:bool, erewacht:bool}
   Elk lid krijgt een persoonlijke mail met een knop naar de inschrijfpagina (naam vooraf ingevuld; dat lukt voor actieve leden).
   Verstuurd via de mailwachtrij. Bijgehouden in config "uitnodigingen": {"<soort>-<jaar>": {op, aantal, doel, door}}. */
const geldig = a => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(a);
const toks = s => norm(s).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(x => x.length > 1);
const kort = iso => iso ? datumTekst(iso).replace(/ \d{4}$/, "") : "";
const klein = s => String(s || "").replace(/^./, c => c.toLowerCase());

const P = (t, s) => p(t, s);
registreer({ key: "uitnodiging-banket", naam: "Banket: uitnodiging", wanneer: "Als de beheerder in Banket op “Leden uitnodigen” klikt.",
  onderwerp: "Uitnodiging: ons banket van {datum_kort}",
  body: P("Dag {voornaam}!") + P("Op <b>{datum}</b> houden we ons jaarlijks banket.{als:info} {info}{/als:info}") + "{gegevens}" + "<p>{knop_inschrijven}</p>"
    + "{als:tot}" + P("Inschrijven kan tot en met <b>{tot}</b>.") + "{/als:tot}",
  velden: [["voornaam", "Voornaam"], ["jaar", "Jaar"], ["datum", "Datum (lang)"], ["datum_kort", "Datum (kort)"], ["info", "Info uit de instellingen"], ["tot", "Inschrijven tot"], ["gegevens", "Tabel met de gegevens"], ["link_inschrijven", "Persoonlijke link"], ["knop_inschrijven", "Knop inschrijven"]],
  voorbeeld: { voornaam: "Jan", jaar: "2026", datum: "zaterdag 12 december 2026", datum_kort: "12 december", info: "", tot: "1 december", gegevens: "", link_inschrijven: "https://vbha.be/banket" } });
registreer({ key: "uitnodiging-kinderfeest", naam: "Kinderfeest: uitnodiging", wanneer: "Als de beheerder in Kinderfeest op “Leden uitnodigen” klikt.",
  onderwerp: "Uitnodiging: kinderfeest op {datum_kort}",
  body: P("Dag {voornaam}!") + P("Op <b>{datum}</b> is het kinderfeest.{als:info} {info}{/als:info}") + "{gegevens}"
    + kaderBlok("Cadeau", P("Bij de inschrijving kies je zelf het cadeau voor elk kind. Het budget hangt af van je status.", "margin:0")) + "<p>{knop_inschrijven}</p>"
    + "{als:tot}" + P("Inschrijven kan tot en met <b>{tot}</b>.") + "{/als:tot}",
  velden: [["voornaam", "Voornaam"], ["jaar", "Jaar"], ["datum", "Datum (lang)"], ["datum_kort", "Datum (kort)"], ["info", "Info uit de instellingen"], ["tot", "Inschrijven tot"], ["gegevens", "Tabel met de gegevens"], ["link_inschrijven", "Persoonlijke link"], ["knop_inschrijven", "Knop inschrijven"]],
  voorbeeld: { voornaam: "Jan", jaar: "2026", datum: "zaterdag 19 december 2026", datum_kort: "19 december", info: "", tot: "7 december", gegevens: "", link_inschrijven: "https://vbha.be/kinderfeest" } });
registreer({ key: "uitnodiging-familiedag", naam: "Familiedag: uitnodiging", wanneer: "Als de beheerder in Familiedag op “Leden uitnodigen” klikt.",
  onderwerp: "Uitnodiging: {titel_klein}",
  body: P("Dag {voornaam}!") + P("Op <b>{datum}</b> trekken we met het hele gezin op familiedag.{als:info} {info}{/als:info}") + "{gegevens}" + "<p>{knop_inschrijven}</p>"
    + "{als:tot}" + P("Inschrijven kan tot en met <b>{tot}</b>.") + "{/als:tot}",
  velden: [["voornaam", "Voornaam"], ["jaar", "Jaar"], ["titel", "Titel"], ["titel_klein", "Titel (in een zin)"], ["datum", "Datum (lang)"], ["datum_kort", "Datum (kort)"], ["info", "Info uit de instellingen"], ["tot", "Inschrijven tot"], ["gegevens", "Tabel met de gegevens"], ["link_inschrijven", "Persoonlijke link"], ["knop_inschrijven", "Knop inschrijven"]],
  voorbeeld: { voornaam: "Jan", jaar: "2027", titel: "Familiedag 2027", titel_klein: "familiedag 2027", datum: "zaterdag 5 juni 2027", datum_kort: "5 juni", info: "", tot: "15 mei", gegevens: "", link_inschrijven: "https://vbha.be/familiedag" } });

/* per activiteit: instellingen, tabel met inschrijvingen, link en mail */
async function activiteit(sb, soort) {
  const A = await algemeen(sb);
  if (soort === "banket") {
    const c = await configDoc(sb, "banket"), jaar = Number(String(c.datum || "").slice(0, 4)) || A.jaar, ins = inschrijving(c, jaar + "-12-01");
    return { A, soort, jaar, tabel: "banket", pad: "banket", sig: "bk", sjabloon: "uitnodiging-banket", titel: "Banket " + jaar, datum: c.datum || "", open: ins.open && !!c.datum, tot: ins.tot,
      knop: "Schrijf je in voor het banket", info: c.info || "", rijen: [["Wanneer", c.datum ? lang(c.datum) : ""], ["Uur", c.uur || ""], ["Waar", c.locatie || ""]] };
  }
  if (soort === "kinderfeest") {
    const c = await configDoc(sb, "kf_" + A.jaar), ins = inschrijving(c, A.jaar + "-12-07");
    return { A, soort, jaar: A.jaar, tabel: "kinderfeest", pad: "kinderfeest", sig: "kf", sjabloon: "uitnodiging-kinderfeest", titel: "Kinderfeest " + A.jaar, datum: c.datum || "", open: ins.open && !!c.datum, tot: ins.tot,
      knop: "Schrijf je kinderen in", info: c.info || "", rijen: [["Wanneer", c.datum ? lang(c.datum) : ""], ["Uur", c.tijd || ""], ["Waar", c.locatie || ""]] };
  }
  if (soort === "familiedag") {
    const c = await configDoc(sb, "fd_" + A.jaar), ins = inschrijving(c, c.datum || A.jaar + "-12-31"), titel = c.titel || "Familiedag " + A.jaar;
    const pr = (Array.isArray(c.prijzen) ? c.prijzen : []).filter(x => x && x.naam).map(x => `${x.naam}${x.uitleg ? " (" + x.uitleg + ")" : ""}: ${Number(x.prijs) > 0 ? (x.lidGratis ? "gratis voor leden" : eur(Number(x.prijs))) : "gratis"}`).join(" · ");
    return { A, soort, jaar: A.jaar, tabel: "familiedag", pad: "familiedag", sig: "fd", sjabloon: "uitnodiging-familiedag", titel, datum: c.datum || "", open: ins.open && !!c.datum, tot: ins.tot,
      knop: "Schrijf je gezin in", info: c.info || "", rijen: [["Wanneer", c.datum ? lang(c.datum) : ""], ["Uur", c.uur || ""], ["Waar", c.locatie || ""], ["Prijs", pr]] };
  }
  if (soort === "pontoise") {
    const { ptInfo } = await import("./open_pontoise.js"); const I = await ptInfo(sb);
    return { A, soort, jaar: I.jaar, tabel: "pontoise", pad: "pontoise", sig: "pt", sjabloon: "pontoise-uitnodiging", titel: I.titel, datum: I.datum, open: I.open, tot: I.tot, I };
  }
  throw httpErr(400, "Onbekende activiteit.");
}
const linkVan = (X, lidId) => `${site()}/${X.pad}?v=${encodeURIComponent(lidId)}&j=${X.jaar}&t=${encodeURIComponent(tekenVul(X.sig, lidId, X.jaar))}`;
async function mailVoor(sb, X, l) {
  if (X.soort === "pontoise") { const { uitnodigingMail } = await import("./open_pontoise.js"); return uitnodigingMail(sb, X.I, l); }
  const link = linkVan(X, l.id);
  const m = await sysMail(sb, X.sjabloon, { voornaam: esc(l.voornaam || l.naam), jaar: X.jaar, titel: esc(X.titel), titel_klein: esc(klein(X.titel)), datum: esc(X.datum ? klein(lang(X.datum)) : "binnenkort"), datum_kort: esc(kort(X.datum)),
    info: esc(X.info), tot: X.tot ? esc(kort(X.tot)) : "", gegevens: tabel(X.rijen.filter(r => r[1]).map(r => rij(r[0], esc(r[1])))), link_inschrijven: esc(link), knop_inschrijven: knop(X.knop, link) });
  return { onderwerp: m.onderwerp, html: huisstijl(m.html, X.A.vereniging) };
}
/* wie krijgt de mail */
async function doelgroep(sb, X, b) {
  const { data: lr } = await sb.from("leden").select("id,data").limit(3000);
  const LD = new Map((lr || []).map(r => [r.id, r.data || {}]));
  let L;
  if (b.doel === "alle") {
    L = [...LD.entries()].filter(([id, d]) => d.naam && !d.geenLid && !d.overleden && !d.test && !(d.dubbelVan && LD.has(d.dubbelVan)) && !(d.lidTot && Number(d.lidTot) < X.A.jaar) && !(d.lidSinds && Number(d.lidSinds) > X.A.jaar))
      .map(([id, d]) => ({ id, naam: `${d.naam} ${d.voornaam || ""}`.trim(), voornaam: String(d.voornaam || "").trim() }));
  } else L = (await actieveLeden(sb, X.A.jaar)).filter(l => !(LD.get(l.id) || {}).test);
  // al ingeschreven: gekoppeld lid, of op naam (zonder koppeling ingevoerd); banket: ook de partner van wie met 2 personen inschreef
  const { data: rows } = await sb.from(X.tabel).select("data").eq("data->>jaar", String(X.jaar));
  const D = (rows || []).map(r => r.data || {}), ins = new Set(D.map(d => d.lidId).filter(Boolean)), namen = D.map(d => toks(d.naam || d.lid || ""));
  if (X.soort === "banket") for (const d of D) if (d.personen === 2 && d.lidId) { const pid = (LD.get(d.lidId) || {}).partnerId; if (pid) ins.add(pid); for (const [id, x] of LD) if (x.partnerId === d.lidId) ins.add(id); }
  const isIn = l => { if (ins.has(l.id)) return true; const t = toks(l.naam); return t.length >= 2 && namen.some(n => t.every(x => n.includes(x))); };
  const metMail = l => geldig(String((LD.get(l.id) || {}).email || "").trim());
  let al = 0, ere = 0, zonder = 0; const uit = [];
  for (const l of L) {
    const d = LD.get(l.id) || {};
    if (isIn(l)) { al++; if (b.overslaan !== false) continue; }
    if (d.categorie === "Erewacht" && !b.erewacht) { ere++; continue; }
    if (!metMail(l)) { zonder++; continue; }
    uit.push({ ...l, email: String(d.email).trim() });
  }
  return { lijst: uit, totaal: L.length, al, ere, zonder };
}

export async function uitnodigingApi(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    let b = req.body || {}; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
    const soort = String(b.soort || "");
    if (!["banket", "kinderfeest", "familiedag", "pontoise"].includes(soort)) throw httpErr(400, "Onbekende activiteit.");
    const { user } = await requireUser(req, { write: true, functie: soort });
    const sb = admin(), X = await activiteit(sb, soort);
    const cfg = await configDoc(sb, "uitnodigingen"), sleutel = soort + "-" + X.jaar;
    let vorige = cfg[sleutel] || null;
    if (!vorige && soort === "pontoise") { const c = await configDoc(sb, "pontoise"); vorige = ((c.uitgenodigd || {})[X.jaar]) || null; }
    const G = await doelgroep(sb, X, b);
    if (b.actie === "aantal") return res.status(200).json({ aantal: G.lijst.length, totaal: G.totaal, al: G.al, ere: G.ere, zonder: G.zonder, vorige, open: X.open, datum: X.datum, jaar: X.jaar, titel: X.titel, smtp: smtpConfigured() });
    if (!smtpConfigured()) throw httpErr(501, "Versturen is niet ingesteld.");
    if (!X.datum) throw httpErr(400, "Stel eerst de datum in (tandwiel).");
    if (b.actie === "test") {
      const naar = String((user && user.email) || "").trim(); if (!geldig(naar)) throw httpErr(400, "Geen e-mailadres gevonden voor jouw account.");
      const vb = G.lijst[0] || (await actieveLeden(sb, X.A.jaar))[0]; if (!vb) throw httpErr(400, "Geen leden gevonden.");
      const m = await mailVoor(sb, X, vb);
      const { error } = await sb.from("mail_wachtrij").insert({ batch: "uitnodiging-voorbeeld", data: { aan: naar, aanNaam: "Voorbeeld", onderwerp: "[Voorbeeld] " + m.onderwerp, html: m.html } }); if (error) throw error;
      return res.status(200).json({ ok: true, naar });
    }
    if (b.actie !== "versturen") throw httpErr(400, "Onbekende actie.");
    if (!X.open) throw httpErr(400, "De inschrijvingen staan niet open. Zet ze eerst open in de instellingen (tandwiel).");
    if (!G.lijst.length) throw httpErr(400, "Er is niemand om uit te nodigen.");
    const berichten = []; for (const l of G.lijst) { const m = await mailVoor(sb, X, l); berichten.push({ batch: "uitnodiging-" + sleutel, data: { aan: l.email, aanNaam: l.naam, onderwerp: m.onderwerp, html: m.html } }); }
    for (let i = 0; i < berichten.length; i += 200) { const { error } = await sb.from("mail_wachtrij").insert(berichten.slice(i, i + 200)); if (error) throw error; }
    const c2 = await configDoc(sb, "uitnodigingen");
    await sb.from("config").upsert({ id: "uitnodigingen", data: { ...c2, [sleutel]: { op: new Date().toISOString(), aantal: berichten.length, doel: b.doel === "alle" ? "alle" : "actief", door: (user && user.email) || "" } } });
    return res.status(200).json({ ok: true, aantal: berichten.length });
  } catch (e) { sendError(res, e); }
}
