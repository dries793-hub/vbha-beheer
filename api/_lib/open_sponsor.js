import crypto from "node:crypto";
import { admin, sendError, httpErr } from "./sb.js";
import { epcPayload, qrSvg } from "./epc.js";
import { onlineConfigured } from "./betaalprovider.js";
import { smtpConfigured, afzender, verstuur } from "./smtp.js";
import { clean, body, norm, slug, algemeen, configDoc, spamCheck, vandaagISO, datumTekst, DEF_IBAN, rateLimit } from "./publiek.js";
import { huisstijl, kaderBlok, knop, tabel, rij, p, esc, eur, site } from "./bevestiging.js";
import { fcConfig, maakDefinitief, factuurPdf, pdfNaam, betaalLink, ogmFmt } from "./factuur.js";
import { meldPush } from "./push.js";

/* ============ Openbare sponsorinschrijving (/sponsor) ============
   Config "sponsoring" (app: Sponsors › tandwiel): {open, kalenderjaar, deadline, formules:[{id,naam,bedrag,omschrijving}], vrij:{aan,min}, melding}
   Een inschrijving maakt of vernieuwt een sponsor (tabel "sponsors"):
     data.inschrijvingen[kalenderjaar] = {formule, formuleNaam, bedrag, factuur, factuurId, op}, data.bedrag = bedrag, data.nieuw = true
   Met factuur: factuur in Boekhouding › Facturen (definitief, gestructureerde mededeling) en de PDF in bijlage bij de bevestiging.
   Zonder factuur: betaallink /sponsor?b=<id>&t=<handtekening> (Bancontact of overschrijven met "Sponsoring <jaar> <bedrijf>"). */

export const SP_DEF_FORMULES = [
  { id: "brandweerman", naam: "Brandweerman", bedrag: 150, omschrijving: "1 vak · 1 maand · Toegankelijk instappakket" },
  { id: "sergeant", naam: "Sergeant", bedrag: 250, omschrijving: "Dubbel vak · 1 maand · Meer ruimte voor uw logo" },
  { id: "luitenant", naam: "Luitenant", bedrag: 500, omschrijving: "Dubbel vak · om de 2 maanden · 6 vermeldingen per jaar" },
  { id: "kolonel", naam: "Kolonel", bedrag: 1000, omschrijving: "Dubbel vak · elke maand · 12 maanden topzichtbaarheid" },
];
export async function spConfig(sb) {
  const c = await configDoc(sb, "sponsoring"), A = await algemeen(sb);
  // standaard: de volgende kalender waarvoor nog sponsors gezocht worden (vanaf september schuift die een jaar op)
  const nu = new Date(), kj = Number(c.kalenderjaar) || (nu.getFullYear() + (nu.getMonth() >= 8 ? 2 : 1));
  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(String(c.deadline || "")) ? c.deadline : (kj - 1) + "-09-01";
  return {
    open: c.open !== false, kalenderjaar: kj, deadline, formules: Array.isArray(c.formules) && c.formules.length ? c.formules : SP_DEF_FORMULES,
    vrij: { aan: true, min: 50, ...(c.vrij || {}) }, melding: c.melding ?? "info@vbha.be", logoMail: c.logoMail || "info@vbha.be",
    vereniging: A.vereniging, iban: A.rekeningnummer || DEF_IBAN,
  };
}
const sleutel = () => String(process.env.BETAAL_GEHEIM || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
export const tekenSponsor = (id, kj, b) => crypto.createHmac("sha256", sleutel()).update(`vbha-sponsor|${id}|${kj}|${Number(b).toFixed(2)}`).digest("base64url").slice(0, 22);
export function sponsorKlopt(id, kj, b, t) { if (!sleutel() || !id || typeof t !== "string") return false; const a = Buffer.from(tekenSponsor(id, kj, b)), c = Buffer.from(t); return a.length === c.length && crypto.timingSafeEqual(a, c); }
export const sponsorBetaalLink = (id, kj, b) => `${site()}/sponsor?b=${encodeURIComponent(id)}&j=${kj}&a=${Number(b)}&t=${tekenSponsor(id, kj, b)}`;
const naamVan = d => String(d.weergave || d.bedrijf || "").trim();
export const sponsorMededeling = (d, kj) => `Sponsoring ${kj} ${d.bedrijf || d.weergave || ""}`.replace(/\s+/g, " ").trim().slice(0, 140);
const okMail = e => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(e);

async function alleSponsors(sb) { const { data, error } = await sb.from("sponsors").select("id,data").limit(2000); if (error) throw error; return data || []; }

/* ---------- mails ---------- */
/* ---------- logo: meegestuurd als base64, bewaard in Documenten › Sponsors › Logo's ---------- */
export const LOGO_MAP = "Sponsors/Logo's";
const LOGO_TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", pdf: "application/pdf", eps: "application/postscript", ai: "application/postscript", tif: "image/tiff", tiff: "image/tiff" };
const LOGO_MAX = 3.5 * 1048576;
const veiligNaam = n => String(n).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/_+/g, "_").slice(-80) || "logo";
function logoUit(b) {
  const l = b && b.logo; if (!l || typeof l.data !== "string" || !l.data) return null;
  const naam = String(l.naam || "logo").slice(0, 120), ext = (naam.match(/\.([a-z0-9]{2,5})$/i) || [])[1]?.toLowerCase() || "";
  if (!LOGO_TYPES[ext]) throw httpErr(400, "Dit bestandstype kunnen we niet aanvaarden als logo. Gebruik PNG, JPG, SVG, PDF, EPS of AI.");
  const data = Buffer.from(l.data.replace(/^data:[^,]*,/, ""), "base64");
  if (data.length < 50) throw httpErr(400, "Het logo lijkt leeg te zijn.");
  if (data.length > LOGO_MAX) throw httpErr(413, "Het logo is te groot (max. 3,5 MB). Stuur het dan via mail.");
  return { naam, ext, type: LOGO_TYPES[ext], data };
}
async function bewaarLogo(sb, logo, d, id, kj) {
  const did = "doc-" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
  const pad = `Sponsors/${did}-${veiligNaam(slug(d.bedrijf).slice(0, 40) + "-logo." + logo.ext)}`;
  const { error } = await sb.storage.from("documenten").upload(pad, logo.data, { contentType: logo.type, upsert: false });
  if (error) throw error;
  const { error: e2 } = await sb.from("documenten").insert({ id: did, data: { naam: `Logo ${d.bedrijf}.${logo.ext}`, pad, map: LOGO_MAP, grootte: logo.data.length, type: logo.type,
    omschrijving: `Logo ${d.bedrijf} · kalender ${kj} · origineel: ${logo.naam}`, door: "Sponsorformulier", op: new Date().toISOString(), sponsorId: id } });
  if (e2) throw e2;
  return did;
}

function bevestigingMail(d, ins, C, { factuur, link, mededeling, nieuw }) {
  const vn = String(d.voornaam || "").trim();
  let html = p(vn ? `Beste ${esc(vn)},` : "Beste,")
    + p(nieuw ? `Hartelijk dank om sponsor te worden van de <b>brandweerkalender ${ins.kj}</b>! Dankzij uw steun kunnen we onze leden in moeilijke momenten bijstaan en onze werking versterken.` : `Hartelijk dank om uw sponsoring van de <b>brandweerkalender ${ins.kj}</b> te vernieuwen. Wij waarderen uw blijvende steun enorm!`)
    + kaderBlok("Uw sponsoring", tabel([rij("Bedrijf", `<b>${esc(d.bedrijf)}</b>`), rij("Formule", esc(ins.formuleNaam)), rij("Bedrag", `<b>${eur(ins.bedrag)}</b>`), rij("Kalender", String(ins.kj))]));
  if (factuur) html += p(`In bijlage vindt u factuur <b>${esc(factuur.nr)}</b>.`);
  html += kaderBlok("Betalen", tabel([rij("Bedrag", `<b>${eur(ins.bedrag)}</b>`), rij("Rekening", `<b>${esc(String(C.iban).replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim())}</b>`), rij("Begunstigde", esc(C.vereniging)), rij("Mededeling", `<b>${esc(mededeling)}</b>`), rij("Te betalen vóór", `<b>${esc(datumTekst(C.deadline))}</b>`)])
    + p("Gebruik exact deze mededeling, dan wordt uw betaling automatisch herkend.", "margin:10px 0 0;font-size:13.5px;color:#666666"))
    + knop("Online betalen met Bancontact of QR-code", link)
    + (ins.logo ? p("We ontvingen ook uw <b>logo</b>. Hartelijk dank!")
      : p(`<b>We ontvingen nog geen logo.</b> Stuur uw logo (liefst in hoge resolutie of als vectorbestand) nog door naar <a href="mailto:${esc(C.logoMail)}">${esc(C.logoMail)}</a>, of antwoord gewoon op deze mail.`));
  return { onderwerp: `Bevestiging sponsoring brandweerkalender ${ins.kj}${factuur ? " - factuur " + factuur.nr : ""}`, html: huisstijl(html, C.vereniging) };
}
function meldingMail(d, ins, C, nieuw) {
  const html = p(`${nieuw ? "Nieuwe sponsor" : "Sponsoring vernieuwd"} via de inschrijfpagina.`)
    + kaderBlok(esc(d.bedrijf), tabel([rij("Formule", esc(ins.formuleNaam)), rij("Bedrag", eur(ins.bedrag)), rij("Factuur", ins.factuur ? "ja" + (ins.factuurNr ? " (" + esc(ins.factuurNr) + ")" : "") : "nee"), rij("Logo", ins.logo ? "opgeladen (Documenten › Sponsors › Logo's)" : "<b>nog niet ontvangen</b>"),
      rij("Contact", esc([d.voornaam, d.naam].filter(Boolean).join(" "))), rij("E-mail", esc(d.email)), rij("Telefoon", esc(d.telefoon)), rij("Adres", esc(d.adres)), rij("Btw", esc(d.kbo))]))
    + p("Je vindt de sponsor in VBHA Beheer › Sponsors.");
  return { onderwerp: `${nieuw ? "Nieuwe sponsor" : "Sponsoring vernieuwd"}: ${d.bedrijf} (${ins.formuleNaam}, ${eur(ins.bedrag)})`, html: huisstijl(html, C.vereniging) };
}

/* ---------- api: /api/sponsor ---------- */
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const sb = admin(), C = await spConfig(sb);
    if (req.method === "GET") {
      const q = String(req.query?.q || "");
      if (q) { // bestaande sponsor zoeken: enkel de naam, geen contactgegevens
        await rateLimit(sb, req, "sponsorzoek", 100, 600, httpErr);
        const t = norm(q); if (t.replace(/\s/g, "").length < 2) return res.status(200).json({ sponsors: [] });
        const L = (await alleSponsors(sb)).map(r => ({ id: r.id, naam: naamVan(r.data || {}) })).filter(x => x.naam && norm(x.naam).includes(t)).sort((a, b) => a.naam.localeCompare(b.naam, "nl")).slice(0, 8);
        return res.status(200).json({ sponsors: L });
      }
      return res.status(200).json({ open: C.open && vandaagISO() <= C.deadline, gesloten: !C.open ? "manueel" : vandaagISO() > C.deadline ? "verlopen" : null, kalenderjaar: C.kalenderjaar, deadline: C.deadline, deadlineTekst: datumTekst(C.deadline), formules: C.formules, vrij: C.vrij, vereniging: C.vereniging, logoMail: C.logoMail, online: onlineConfigured() });
    }
    if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");
    const b = body(req);
    await rateLimit(sb, req, "post", 20, 3600, httpErr);
    if (await spamCheck(sb, "sponsors", b, httpErr)) return res.status(200).json({ ok: true });
    if (!C.open) throw httpErr(403, "De inschrijvingen voor sponsoring zijn momenteel gesloten.");
    if (C.deadline && vandaagISO() > C.deadline) throw httpErr(403, `De inschrijvingen voor de brandweerkalender ${C.kalenderjaar} zijn afgesloten sinds ${datumTekst(C.deadline)}.`);
    // formule en bedrag
    let formule = C.formules.find(f => f.id === String(b.formule || "")), bedrag, formuleNaam;
    if (formule) { bedrag = Number(formule.bedrag); formuleNaam = formule.naam; }
    else if (b.formule === "vrij" && C.vrij.aan) { bedrag = Math.round(Number(String(b.bedrag || "").replace(",", ".")) * 100) / 100; formuleNaam = "Vrije bijdrage"; if (!(bedrag >= Number(C.vrij.min || 0)) || bedrag > 100000) throw httpErr(400, `Een vrije bijdrage is minstens ${eur(C.vrij.min)}.`); }
    else throw httpErr(400, "Kies een sponsorformule.");
    // gegevens
    const g = {
      bedrijf: clean(b.bedrijf, 120), voornaam: clean(b.voornaam, 60), naam: clean(b.naam, 80), adres: clean([b.straat, b.gemeente].filter(Boolean).join(", "), 200),
      kbo: clean(b.btw, 30).toUpperCase().replace(/\s+/g, ""), email: clean(b.email, 120).toLowerCase(), telefoon: clean(b.telefoon, 40),
    };
    const wilFactuur = !!b.factuur, logo = logoUit(b);
    let id = String(b.sponsorId || ""), oud = null;
    if (id) { const { data } = await sb.from("sponsors").select("id,data").eq("id", id).maybeSingle(); if (!data) throw httpErr(400, "Deze sponsor werd niet gevonden. Kies 'Nieuwe sponsor'."); oud = data.data || {}; }
    const d = { ...(oud || {}) };
    for (const [k, v] of Object.entries(g)) if (v) d[k] = v; // bij vernieuwen: lege velden houden de gekende gegevens
    if (!d.bedrijf) throw httpErr(400, "Vul de naam van uw bedrijf of handelszaak in.");
    if (!okMail(String(d.email || ""))) throw httpErr(400, "Vul een geldig e-mailadres in; daar sturen we de bevestiging naartoe.");
    if (wilFactuur && !d.adres) throw httpErr(400, "Voor een factuur hebben we uw adres nodig.");
    const nieuw = !oud;
    if (nieuw) { id = slug(d.bedrijf).slice(0, 40) + "-" + crypto.randomBytes(3).toString("hex"); d.bron = "formulier"; }
    const kj = C.kalenderjaar;
    const ins = { kj, formule: formule ? formule.id : "vrij", formuleNaam, bedrag, factuur: wilFactuur, op: new Date().toISOString(), nieuw };
    d.bedrag = bedrag; d.aangemeld = ins.op; d.nieuw = true;
    d.inschrijvingen = { ...(d.inschrijvingen || {}), [kj]: ins };
    const { error } = await sb.from("sponsors").upsert({ id, data: d });
    if (error) throw error;
    if (logo) {
      try { const did = await bewaarLogo(sb, logo, d, id, kj); ins.logo = true; ins.logoId = did; d.logoId = did; d.inschrijvingen[kj] = ins; await sb.from("sponsors").update({ data: d }).eq("id", id); }
      catch (e) { console.error("logo sponsor", e); ins.logo = false; }
    }

    // factuur (in het facturatiesysteem, definitief met uniek nummer en gestructureerde mededeling)
    let factuur = null, fcfg = null;
    if (wilFactuur) {
      try {
        fcfg = await fcConfig(sb);
        const fid = "fc-" + Date.now().toString(36) + "-" + crypto.randomBytes(2).toString("hex");
        const vandaag = vandaagISO();
        const fd = { type: "factuur", status: "concept", datum: vandaag, vervaldatum: C.deadline > vandaag ? C.deadline : "", bron: "sponsorformulier",
          klant: { naam: d.bedrijf, contact: [d.voornaam, d.naam].filter(Boolean).join(" "), adres: String(d.adres || "").replace(/,\s*(?=\d{4}\s)/, "\n"), btw: d.kbo || "", email: d.email, sponsorId: id },
          lijnen: [{ omschrijving: `Sponsoring brandweerkalender ${kj} - formule ${formuleNaam}`, aantal: 1, prijs: bedrag, btw: 0 }], categorie: "Sponsoring", opmerking: "Hartelijk dank voor uw steun!", aangemaakt: new Date().toISOString(), door: "Sponsorformulier" };
        const { error: e1 } = await sb.from("facturen").insert({ id: fid, data: fd });
        if (e1) throw e1;
        const row = await maakDefinitief(sb, { id: fid, data: fd }, fcfg);
        factuur = { id: fid, ...row.data };
        ins.factuurId = fid; ins.factuurNr = factuur.nr;
        d.inschrijvingen[kj] = ins;
        await sb.from("sponsors").update({ data: d }).eq("id", id);
      } catch (e) { console.error("factuur sponsor", e); factuur = null; }
    }
    const mededeling = factuur ? ogmFmt(factuur.ogm) : sponsorMededeling(d, kj);
    const link = factuur ? betaalLink(factuur.id) : sponsorBetaalLink(id, kj, bedrag);

    // bevestiging (met de factuur in bijlage) + melding voor het bestuur
    if (smtpConfigured()) {
      try {
        const m = bevestigingMail(d, ins, C, { factuur, link, mededeling, nieuw });
        const bijlagen = factuur ? [{ naam: pdfNaam(factuur), type: "application/pdf", data: factuurPdf(factuur, fcfg) }] : undefined;
        const L = [{ aan: d.email, aanNaam: [d.voornaam, d.naam].filter(Boolean).join(" ") || d.bedrijf, onderwerp: m.onderwerp, html: m.html, van: afzender(), bijlagen }];
        const meld = String(C.melding || "").split(/[,;\s]+/).filter(okMail);
        if (meld.length) { const mm = meldingMail(d, ins, C, nieuw); for (const a of meld) L.push({ aan: a, aanNaam: "", onderwerp: mm.onderwerp, html: mm.html, van: afzender(), antwoordAan: d.email }); }
        const r = await verstuur(L);
        if (factuur) {
          const { data: fr } = await sb.from("facturen").select("data").eq("id", factuur.id).maybeSingle();
          if (fr) await sb.from("facturen").update({ data: { ...fr.data, verzonden: [...(fr.data.verzonden || []), { op: new Date().toISOString(), aan: d.email, soort: "factuur", ok: !!(r[0] && r[0].ok) }] } }).eq("id", factuur.id);
        }
        const { data: sr } = await sb.from("sponsors").select("data").eq("id", id).maybeSingle();
        if (sr) { const dd = sr.data; dd.inschrijvingen[kj] = { ...dd.inschrijvingen[kj], bevestigd: !!(r[0] && r[0].ok) }; await sb.from("sponsors").update({ data: dd }).eq("id", id); }
      } catch (e) { console.error("bevestiging sponsor", e); }
    }
    await meldPush(sb, "boek", { titel: nieuw ? "Nieuwe sponsor ingeschreven" : "Sponsorinschrijving ontvangen", tekst: `${d.bedrijf}${formuleNaam ? " · " + formuleNaam : ""}${bedrag ? " · € " + Number(bedrag).toLocaleString("nl-BE") : ""}`, url: "/#sponsors", tag: "sponsor-" + id });
    let qr = null;
    try { qr = qrSvg(epcPayload({ naam: C.vereniging, iban: C.iban, bedrag, mededeling })); } catch (e) { console.error("QR", e); }
    res.status(200).json({ ok: true, nieuw, bedrijf: d.bedrijf, formule: formuleNaam, bedrag, kalenderjaar: kj, mededeling, rekeningnummer: C.iban, begunstigde: C.vereniging, qr,
      deadlineTekst: datumTekst(C.deadline), factuur: factuur ? { nr: factuur.nr } : null, logo: !!ins.logo, logoMail: C.logoMail, betaalLink: link, online: onlineConfigured() });
  } catch (e) { sendError(res, e); }
}

/* ---------- betaallink zonder factuur: /api/betaling?sp=<id>&j=&a=&t= ---------- */
export async function sponsorLink(req, res, b, { startBetaling, controleerBetaling }) {
  const id = String(b.sp || ""), kj = String(b.j || ""), bedrag = Number(b.a), t = String(b.t || "");
  if (!sponsorKlopt(id, kj, bedrag, t)) throw httpErr(404, "Deze betaallink is ongeldig. Gebruik de link uit de mail of neem contact met ons op.");
  const sb = admin(), C = await spConfig(sb);
  const { data: row } = await sb.from("sponsors").select("id,data").eq("id", id).maybeSingle();
  if (!row) throw httpErr(404, "Deze sponsor werd niet gevonden.");
  const d = row.data || {};
  const terug = `/sponsor?b=${encodeURIComponent(id)}&j=${kj}&a=${bedrag}&t=${encodeURIComponent(t)}&betaling=terug`;
  const pub = x => x ? { status: x.status, deeplink: x.deeplink, qrcode: x.qrcode, checkout: x.checkout, provider: x.provider || null, verlooptOp: x.verlooptOp, bedrag: x.bedrag } : { status: null };
  const cur = d.betaling && String(d.betaling.jaar) === kj && Number(d.betaling.bedrag) === bedrag ? d.betaling : null;
  if (req.method === "POST") {
    if (!onlineConfigured()) throw httpErr(501, "Online betalen is niet ingesteld");
    return res.status(200).json(pub(await startBetaling(sb, req, "sponsors", row, { bedrag, jaar: kj, terug })));
  }
  let online = null;
  if (cur && cur.id && onlineConfigured()) { try { online = pub(await controleerBetaling(sb, "sponsors", row)); } catch (e) { online = pub(cur); } }
  const mededeling = sponsorMededeling(d, kj);
  let qr = null; try { qr = qrSvg(epcPayload({ naam: C.vereniging, iban: C.iban, bedrag, mededeling })); } catch (e) {}
  res.status(200).json({ bedrijf: d.bedrijf, kalenderjaar: kj, bedrag, mededeling, rekeningnummer: C.iban, begunstigde: C.vereniging, qr, betaald: !!(online && online.status === "SUCCEEDED"), online, kanOnline: onlineConfigured(), deadlineTekst: datumTekst(C.deadline) });
}

/* ---------- online betaling gelukt (zonder factuur): korte bevestiging ---------- */
export async function sponsorBetaald(sb, id) {
  if (!smtpConfigured()) return;
  const { data: row } = await sb.from("sponsors").select("data").eq("id", id).maybeSingle(); if (!row) return;
  const d = row.data, bt = d.betaling || {}; if (bt.bevestigd || !okMail(String(d.email || ""))) return;
  const C = await spConfig(sb);
  const html = p(d.voornaam ? `Beste ${esc(d.voornaam)},` : "Beste,") + kaderBlok("&#10003; Betaling ontvangen", p(`We ontvingen uw betaling van <b>${eur(bt.bedrag)}</b> voor de sponsoring van de brandweerkalender ${esc(bt.jaar)} via Bancontact. Hartelijk dank voor uw steun!`, "margin:0"), "#1a7f45", "#f1faf4");
  await verstuur([{ aan: d.email, aanNaam: d.bedrijf, onderwerp: `Betaling ontvangen - sponsoring brandweerkalender ${bt.jaar}`, html: huisstijl(html, C.vereniging), van: afzender() }]);
  await sb.from("sponsors").update({ data: { ...d, betaling: { ...bt, bevestigd: true } } }).eq("id", id);
}
