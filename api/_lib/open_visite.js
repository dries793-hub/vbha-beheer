import crypto from "node:crypto";
import { admin, requireUser, sendError, httpErr } from "./sb.js";
import { clean, body, nieuwId, algemeen, configDoc, spamCheck, inschrijving, rateLimit } from "./publiek.js";
import { meldPush } from "./push.js";
import { registreer, sysMail } from "./sjabloon.js";
import { huisstijl, tabel, rij, p, esc, knop, site } from "./bevestiging.js";
import { smtpConfigured } from "./smtp.js";

/* ============ Bezoek van de collega's van Pontoise (Franstalige pagina vbha.be/visite) ============
   Zij komen elk jaar in het weekend van het banket (vrijdag tot en met zondag). Ze geven door met hoeveel personen (max. 8)
   en hun namen, zodat we de activiteiten kunnen plannen.
   Config "pontoise_bezoek": { jaar, van, tot, inschrijvenTot, open, max, info, contacten:"a@x.fr, b@y.fr", meldAan, uitgenodigd:{<jaar>:{op,aantal}} }
   Collectie "pontoise_bezoek": { jaar, contact:{naam,email,tel}, aantal, personen:[{naam}], opmerking, aangemeld, bron, token } */
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"], JOUR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
export const fr = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); if (!m) return ""; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12)); return `${JOUR[d.getUTCDay()]} ${+m[3]} ${MOIS[+m[2] - 1]} ${m[1]}`; };
const plus = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const geldig = a => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(a);
export async function bzInfo(sb) {
  const A = await algemeen(sb), c = await configDoc(sb, "pontoise_bezoek"), B = await configDoc(sb, "banket");
  const bk = /^\d{4}-\d{2}-\d{2}$/.test(B.datum || "") ? B.datum : "";
  const jaar = Number(c.jaar) || Number(bk.slice(0, 4)) || A.jaar;
  const van = /^\d{4}-\d{2}-\d{2}$/.test(c.van || "") ? c.van : bk && Number(bk.slice(0, 4)) === jaar ? plus(bk, -1) : "";
  const tot = /^\d{4}-\d{2}-\d{2}$/.test(c.tot || "") ? c.tot : van ? plus(van, 2) : "";
  const ins = inschrijving(c, jaar + "-09-30");
  return { A, jaar, van, tot, max: Math.max(1, Math.min(30, Number(c.max) || 8)), info: c.info || "", contacten: String(c.contacten || ""), meldAan: String(c.meldAan || "").trim(),
    open: ins.open && !!van, deadline: ins.tot, ingesteld: !!van };
}
const periode = I => I.van ? (I.tot && I.tot !== I.van ? `du ${fr(I.van).replace(/ \d{4}$/, "")} au ${fr(I.tot)}` : `le ${fr(I.van)}`) : "date à confirmer";
const publiek = I => ({ jaar: I.jaar, van: I.van, tot: I.tot, max: I.max, info: I.info, open: I.open, deadline: I.deadline, deadlineTekst: I.deadline ? fr(I.deadline) : "", periode: periode(I), ingesteld: I.ingesteld });
const linkVan = t => `${site()}/visite${t ? "?k=" + encodeURIComponent(t) : ""}`;

registreer({ key: "visite-invitation", naam: "Pontoise: uitnodiging bezoek (Frans)", wanneer: "Als de beheerder in Pontoise › Pontoise naar Aalst de uitnodiging verstuurt.",
  onderwerp: "Visite à Alost {jaar} : inscription",
  body: p("Chers collègues, chers amis,") + p("C'est avec grand plaisir que nous vous accueillerons à nouveau à Alost {periode}, à l'occasion de notre banquet annuel.")
    + p("Pour bien préparer votre séjour et les activités, merci de nous indiquer <b>combien de personnes</b> viendront (maximum {max}) ainsi que <b>leurs noms</b>{als:deadline}, au plus tard le <b>{deadline}</b>{/als:deadline}.")
    + "<p>{knop_inscription}</p>" + p("Au plaisir de vous revoir très bientôt !") + p("Bien amicalement,<br><b>Le comité de la Vriendenkring Brandweer Hoofdpost Aalst</b>"),
  velden: [["jaar", "Jaar"], ["periode", "Periode (du … au …)"], ["max", "Maximum personen"], ["deadline", "Doorgeven tegen"], ["lien", "Link"], ["knop_inscription", "Knop inschrijven"]],
  voorbeeld: { jaar: "2027", periode: "du vendredi 10 décembre au dimanche 12 décembre 2027", max: "8", deadline: "jeudi 30 septembre 2027", lien: "https://vbha.be/visite" } });
registreer({ key: "visite-confirmation", naam: "Pontoise: bevestiging bezoek (Frans)", wanneer: "Nadat de collega's van Pontoise hun bezoek doorgaven.",
  onderwerp: "Votre inscription pour Alost {jaar} est bien reçue",
  body: p("Bonjour {prenom},") + p("Merci ! Nous avons bien reçu votre inscription pour votre visite à Alost {periode}.") + "{gegevens}"
    + p("Une modification ? Utilisez le bouton ci-dessous.") + "<p>{knop_modifier}</p>" + p("À très bientôt,<br><b>Le comité de la Vriendenkring Brandweer Hoofdpost Aalst</b>"),
  velden: [["prenom", "Voornaam contactpersoon"], ["jaar", "Jaar"], ["periode", "Periode"], ["gegevens", "Tabel met de gegevens"], ["knop_modifier", "Knop wijzigen"]],
  voorbeeld: { prenom: "Pierre", jaar: "2027", periode: "du vendredi 10 au dimanche 12 décembre 2027", gegevens: "" } });
registreer({ key: "visite-melding", naam: "Pontoise: melding bezoek doorgegeven", wanneer: "Als de collega's van Pontoise hun bezoek doorgeven of wijzigen.",
  onderwerp: "Pontoise komt naar Aalst: {aantal} personen",
  body: p("Hallo!") + p("De collega's van Pontoise gaven hun bezoek {jaar} door{als:wijziging} (wijziging){/als:wijziging}.") + "{gegevens}" + "<p>{knop_app}</p>",
  velden: [["jaar", "Jaar"], ["aantal", "Aantal personen"], ["gegevens", "Tabel met de gegevens"], ["wijziging", "Voorwaarde: wijziging"], ["knop_app", "Knop naar de beheerapp"]],
  voorbeeld: { jaar: "2027", aantal: "6", gegevens: "" } });

const gegevensTabel = (d, nl) => tabel([rij(nl ? "Contactpersoon" : "Contact", esc(d.contact.naam)), d.contact.email ? rij("E-mail", esc(d.contact.email)) : "", d.contact.tel ? rij(nl ? "Telefoon" : "Téléphone", esc(d.contact.tel)) : "",
  rij(nl ? "Aantal personen" : "Personnes", String(d.aantal)), rij(nl ? "Namen" : "Noms", d.personen.map(x => esc(x.naam)).join("<br>")), d.opmerking ? rij(nl ? "Opmerking" : "Remarques", esc(d.opmerking)) : ""].filter(Boolean));

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const sb = admin(), I = await bzInfo(sb);
    if (req.method === "GET") {
      const k = String(req.query?.k || "");
      if (k && /^[\w-]{16,64}$/.test(k)) {
        await rateLimit(sb, req, "lidinfo", 60, 600, httpErr);
        const { data } = await sb.from("pontoise_bezoek").select("id,data").eq("data->>token", k).limit(1);
        const d = data && data[0] && data[0].data;
        if (d && Number(d.jaar) === I.jaar) return res.status(200).json({ ...publiek(I), bestaand: { contact: d.contact, aantal: d.aantal, personen: d.personen, opmerking: d.opmerking || "" } });
      }
      return res.status(200).json(publiek(I));
    }
    if (req.method !== "POST") throw httpErr(405, "Méthode non autorisée");
    const b = body(req);
    await rateLimit(sb, req, "post", 20, 3600, httpErr);
    if (await spamCheck(sb, "pontoise_bezoek", b, httpErr)) return res.status(200).json({ ok: true });
    if (!I.open) throw httpErr(403, "Les inscriptions sont fermées. Contactez-nous à info@vbha.be.");
    const contact = { naam: clean(b.naam, 100), email: clean(b.email, 160).toLowerCase(), tel: clean(b.tel, 40) };
    if (contact.naam.length < 3) throw httpErr(400, "Indiquez le nom de la personne de contact.");
    if (!geldig(contact.email)) throw httpErr(400, "Indiquez une adresse e-mail valide.");
    const personen = (Array.isArray(b.personen) ? b.personen : []).map(x => ({ naam: clean(x && x.naam != null ? x.naam : x, 100) })).filter(x => x.naam.length >= 2).slice(0, I.max);
    const aantal = Math.max(1, Math.min(I.max, parseInt(b.aantal, 10) || personen.length));
    if (personen.length !== aantal) throw httpErr(400, `Indiquez le nom de chaque personne (${aantal}).`);
    const opmerking = clean(b.opmerking, 600);
    // wijzigen via de link uit de bevestiging (token), anders een nieuwe inschrijving
    let id = null, token = String(b.k || ""), wijziging = false, oud = null;
    if (/^[\w-]{16,64}$/.test(token)) { const { data } = await sb.from("pontoise_bezoek").select("id,data").eq("data->>token", token).limit(1); if (data && data[0] && Number(data[0].data.jaar) === I.jaar) { id = data[0].id; oud = data[0].data; wijziging = true; } }
    if (!id) { id = nieuwId("pb"); token = crypto.randomBytes(18).toString("base64url"); }
    const d = { ...(oud || {}), jaar: I.jaar, contact, aantal, personen, opmerking, bron: oud ? oud.bron || "formulier" : "formulier", aangemeld: oud ? oud.aangemeld : new Date().toISOString(), gewijzigd: oud ? new Date().toISOString() : null, token, nieuw: true };
    const { error } = await sb.from("pontoise_bezoek").upsert({ id, data: d }); if (error) throw error;
    try {
      if (smtpConfigured()) {
        const L = [];
        const m1 = await sysMail(sb, "visite-confirmation", { prenom: esc(contact.naam.split(" ")[0]), jaar: I.jaar, periode: esc(periode(I)), gegevens: gegevensTabel(d, false), knop_modifier: knop("Modifier mon inscription", linkVan(token)) });
        L.push({ aan: contact.email, aanNaam: contact.naam, onderwerp: m1.onderwerp, html: huisstijl(m1.html, I.A.vereniging, { groet: false, extern: true }) });
        const meld = I.meldAan || "info@vbha.be";
        if (geldig(meld)) { const m2 = await sysMail(sb, "visite-melding", { jaar: I.jaar, aantal, wijziging, gegevens: gegevensTabel(d, true), knop_app: knop("Bekijk in de beheerapp", "https://beheer.vbha.be/#pontoise") });
          L.push({ aan: meld, aanNaam: "Pontoise", onderwerp: m2.onderwerp, html: huisstijl(m2.html, I.A.vereniging), antwoordAan: contact.email }); }
        const { error: e2 } = await sb.from("mail_wachtrij").insert(L.map(data => ({ batch: "visite-" + I.jaar, data }))); if (e2) throw e2;
      }
    } catch (e) { console.error("visite mail", e); }
    await meldPush(sb, "iedereen", { titel: wijziging ? "Pontoise wijzigde hun bezoek" : "Pontoise komt naar Aalst", tekst: `${aantal} ${aantal === 1 ? "persoon" : "personen"} · ${contact.naam}`, url: "/#pontoise", tag: "ins-pb-" + id }).catch(() => {});
    res.status(200).json({ ok: true, wijziging, aantal, periode: periode(I), prenom: contact.naam.split(" ")[0], k: token });
  } catch (e) { sendError(res, e); }
}

/* beheerapp: uitnodiging (Frans) naar de contactadressen. POST /api/mail?f=visite {actie:"test"|"versturen", aan?} */
export async function visiteApp(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    let b = req.body || {}; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
    const { user } = await requireUser(req, { write: true, functie: "pontoise" });
    const sb = admin(), I = await bzInfo(sb);
    if (!smtpConfigured()) throw httpErr(501, "Versturen is niet ingesteld.");
    if (!I.van) throw httpErr(400, "Stel eerst de data van het bezoek in (tandwiel).");
    const m = await sysMail(sb, "visite-invitation", { jaar: I.jaar, periode: esc(periode(I)), max: I.max, deadline: I.deadline ? esc(fr(I.deadline)) : "", lien: esc(linkVan("")), knop_inscription: knop("Inscrire notre délégation", linkVan("")) });
    const html = huisstijl(m.html, I.A.vereniging, { groet: false, extern: true });
    if (b.actie === "test") {
      const naar = String((user && user.email) || "").trim(); if (!geldig(naar)) throw httpErr(400, "Geen e-mailadres gevonden voor jouw account.");
      const { error } = await sb.from("mail_wachtrij").insert({ batch: "visite-voorbeeld", data: { aan: naar, aanNaam: "Voorbeeld", onderwerp: "[Voorbeeld] " + m.onderwerp, html } }); if (error) throw error;
      return res.status(200).json({ ok: true, naar });
    }
    if (b.actie !== "versturen") throw httpErr(400, "Onbekende actie.");
    if (!I.open) throw httpErr(400, "De inschrijvingen staan niet open. Zet ze eerst open in de instellingen (tandwiel).");
    const aan = [...new Set(String(b.aan != null ? b.aan : I.contacten).split(/[\s,;]+/).map(x => x.trim().toLowerCase()).filter(geldig))].slice(0, 20);
    if (!aan.length) throw httpErr(400, "Vul minstens één e-mailadres in.");
    const { error } = await sb.from("mail_wachtrij").insert(aan.map(a => ({ batch: "visite-uitnodiging-" + I.jaar, data: { aan: a, aanNaam: "", onderwerp: m.onderwerp, html, antwoordAan: I.meldAan || "info@vbha.be" } }))); if (error) throw error;
    const c = await configDoc(sb, "pontoise_bezoek");
    await sb.from("config").upsert({ id: "pontoise_bezoek", data: { ...c, contacten: aan.join(", "), uitgenodigd: { ...(c.uitgenodigd || {}), [I.jaar]: { op: new Date().toISOString(), aantal: aan.length, door: (user && user.email) || "" } } } });
    return res.status(200).json({ ok: true, aantal: aan.length });
  } catch (e) { sendError(res, e); }
}
