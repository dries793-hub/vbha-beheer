import { requireUser, httpErr } from "./sb.js";
import { smtpConfigured, afzender, verstuur } from "./smtp.js";
import { Pdf, afbreken } from "./pdf.js";
import { LOGO, WATERMERK } from "./logo_pdf.js";
import { fcConfig } from "./factuur.js";
import { huisstijl, kaderBlok, tabel, rij, p, esc, eur, lang } from "./bevestiging.js";

/* ============ Sponsorbevestiging ============
   Bewijsstuk voor de boekhouding van een sponsor: wat de vereniging ontving (in natura of in geld), de waarde,
   en de tegenprestatie (reclame). Geen fiscaal attest voor giften: de sponsor boekt dit als reclamekost.
   POST /api/mail?f=sponsorbev {actie: pdf|mail, sponsorId, omschrijving, waarde, datum, soort: natura|geld, tegenprestatie,
     ondertekenaar, functie, aan}
   Elke bevestiging krijgt een nummer SB<jaar>-<volgnr> en wordt bij de sponsor gelogd (data.bevestigingen). */

const dmy = iso => { if (!iso) return ""; const [y, m, d] = String(iso).slice(0, 10).split("-"); return `${d}/${m}/${y}`; };
const geld = n => "€ " + Number(n || 0).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ROOD = "#b30000", GRIJS = "#666666", LICHT = "#f4f1ea";
const sponsorNaam = s => String(s.bedrijf || s.weergave || "").trim();
const contactNaam = s => [s.voornaam, s.naam].filter(Boolean).join(" ").trim();

export function bevPdf(b, s, cfg, hand) {
  const pdf = new Pdf(), L = 50, R = 545, W = R - L;
  pdf.vlak(0, 0, 595, 6, ROOD);
  pdf.beeld(L, 30, 46, 46 * LOGO.h / LOGO.w, LOGO);
  let y = 32;
  pdf.tekst(L + 58, y, cfg.naamJuridisch || cfg.vereniging, { size: 12, bold: true }); y += 16;
  for (const r of [...String(cfg.adres || "").split(/\r?\n/).filter(Boolean), [cfg.kbo ? "Ondernemingsnr. " + cfg.kbo : "", cfg.rpr].filter(Boolean).join("  ·  "), [cfg.email, cfg.telefoon].filter(Boolean).join("  ·  "), cfg.website].filter(Boolean)) { pdf.tekst(L + 58, y, r, { size: 8.5, kleur: GRIJS }); y += 11; }
  y = Math.max(y, 88) + 14;
  pdf.tekst(L, y, "SPONSORBEVESTIGING", { size: 20, bold: true, kleur: ROOD }); y += 40;

  // sponsor links, gegevens rechts
  pdf.tekst(L, y, "SPONSOR", { size: 7.5, bold: true, kleur: GRIJS });
  let ky = y + 13;
  pdf.tekst(L, ky, sponsorNaam(s), { size: 11, bold: true }); ky += 14;
  for (const r of [contactNaam(s) ? "T.a.v. " + contactNaam(s) : "", ...String(s.adres || "").split(/\r?\n|,\s*(?=\d{4}\s)/).map(x => x.trim()).filter(Boolean), s.kbo ? "Ondernemingsnr. " + s.kbo : ""].filter(Boolean)) { pdf.tekst(L, ky, r, { size: 9.5 }); ky += 12.5; }
  const gx = 330, gw = R - gx, rijen = [["Nummer", b.nr], ["Datum", dmy(b.opgemaakt)]];
  pdf.vlak(gx, y - 4, gw, rijen.length * 16 + 10, LICHT);
  let gy = y + 3;
  for (const [a, v] of rijen) { pdf.tekst(gx + 10, gy, a, { size: 8.5, kleur: GRIJS }); pdf.tekst(R - 10, gy, v, { size: 9.5, bold: a === "Nummer", align: "right" }); gy += 16; }
  y = Math.max(ky, gy + 6) + 24;

  const alinea = (t, opt = {}) => { for (const r of afbreken(t, opt.size || 10.5, !!opt.bold, W)) { pdf.tekst(L, y, r, { size: opt.size || 10.5, bold: !!opt.bold, kleur: opt.kleur }); y += (opt.size || 10.5) * 1.45; } y += 8; };
  const natura = b.soort !== "geld";
  alinea(`De ${cfg.naamJuridisch || cfg.vereniging} bevestigt dat zij van ${sponsorNaam(s)} de volgende sponsoring ${natura ? "in natura " : ""}heeft ontvangen:`);

  // tabel
  pdf.vlak(L, y, W, 22, "#222222");
  pdf.tekst(L + 10, y + 6, "Omschrijving", { size: 9, bold: true, kleur: "#ffffff" });
  pdf.tekst(R - 10, y + 6, natura ? "Waarde" : "Bedrag", { size: 9, bold: true, kleur: "#ffffff", align: "right" });
  y += 22;
  const om = afbreken(b.omschrijving, 10, false, W - 140), hR = Math.max(26, om.length * 14 + 12);
  pdf.vlak(L, y, W, hR, LICHT);
  om.forEach((r, i) => pdf.tekst(L + 10, y + 8 + i * 14, r, { size: 10 }));
  pdf.tekst(R - 10, y + 8, geld(b.waarde), { size: 10.5, bold: true, align: "right" });
  y += hR;
  pdf.lijn(L, y, R, y, "#222222", 0.8); y += 8;
  if (b.datum) { pdf.tekst(L + 10, y, `${natura ? "Ontvangen" : "Betaald"} op ${dmy(b.datum)}`, { size: 9, kleur: GRIJS }); y += 14; }
  y += 14;

  if (b.tegenprestatie) {
    pdf.tekst(L, y, "TEGENPRESTATIE", { size: 7.5, bold: true, kleur: GRIJS }); y += 14;
    alinea(`Als tegenprestatie vermeldt de vereniging ${sponsorNaam(s)} als sponsor: ${b.tegenprestatie.replace(/\.\s*$/, "")}.`);
  }
  alinea(`Wij danken ${sponsorNaam(s)} hartelijk voor de steun.`, { kleur: "#222222" });
  y += 10;
  pdf.tekst(L, y, `Aalst, ${dmy(b.opgemaakt)}`, { size: 10.5 }); y += 18;
  if (hand) { const hw = 150, hh = hw * hand.h / hand.w; pdf.beeld(L - 4, y, hw, hh, hand); y += hh + 4; } else y += 16;
  if (b.ondertekenaar) { pdf.tekst(L, y, b.ondertekenaar, { size: 10.5, bold: true }); y += 14; }
  pdf.tekst(L, y, b.functie || "Namens de " + cfg.vereniging, { size: 9.5, kleur: GRIJS }); y += 30;

  // voet
  const wmW = 400, wmH = wmW * WATERMERK.h / WATERMERK.w;
  pdf.achtergrond((595 - wmW) / 2, (842 - wmH) / 2 + 30, wmW, wmH, WATERMERK);
  pdf.lijn(L, 790, R, 790, "#dddddd");
  const voet = [cfg.voettekst || "", "Dit document is een bewijsstuk van sponsoring met tegenprestatie (reclame), geen fiscaal attest voor giften.", `${cfg.naamJuridisch || cfg.vereniging}${cfg.kbo ? " · " + cfg.kbo : ""}${cfg.rpr ? " · " + cfg.rpr : ""}`].filter(Boolean);
  let vy = 797;
  for (const v of voet) for (const r of afbreken(v, 7.5, false, W)) { pdf.tekst(L, vy, r, { size: 7.5, kleur: GRIJS }); vy += 10; }
  return pdf.bytes({ titel: `Sponsorbevestiging ${b.nr} - ${cfg.vereniging}`, auteur: cfg.vereniging });
}
const pdfNaam = (b, s) => `Sponsorbevestiging ${b.nr} ${sponsorNaam(s)}.pdf`.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ");

function bevMail(b, s, cfg) {
  const natura = b.soort !== "geld";
  let html = p(`Beste ${esc(contactNaam(s) || sponsorNaam(s))},`)
    + p(`Hartelijk dank voor je steun aan de ${esc(cfg.vereniging)}. Zoals gevraagd vind je in bijlage de bevestiging van je sponsoring voor je boekhouding.`)
    + kaderBlok("Sponsorbevestiging " + esc(b.nr), tabel([
      rij("Omschrijving", esc(b.omschrijving)),
      rij(natura ? "Waarde" : "Bedrag", `<b>${eur(b.waarde)}</b>`),
      b.datum ? rij(natura ? "Ontvangen op" : "Betaald op", esc(lang(b.datum))) : "",
      b.tegenprestatie ? rij("Tegenprestatie", esc(b.tegenprestatie)) : "",
    ]))
    + p("Vragen? Antwoord gewoon op deze mail.", "margin:0 0 15px;font-size:13.5px;color:#666666");
  return { onderwerp: `Sponsorbevestiging ${b.nr} - ${cfg.vereniging}`, html: huisstijl(html, cfg.vereniging) };
}

// Handtekening (tabel "handtekeningen", enkel leesbaar voor de server): wordt enkel gebruikt als de ondertekenaar exact die naam heeft.
const nmH = x => String(x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]+/g, " ").trim();
async function handtekening(sb, naam) {
  if (!naam) return null;
  try { const { data } = await sb.from("handtekeningen").select("naam,beeld"); const r = (data || []).find(x => nmH(x.naam) === nmH(naam)); return r && r.beeld && r.beeld.w ? r.beeld : null; }
  catch (e) { console.error("handtekening", e); return null; }
}
const isMail = a => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(a);
const datumOk = d => !d || /^\d{4}-\d{2}-\d{2}$/.test(d);

async function volgNr(sb, jaar) {
  const { data } = await sb.from("sponsors").select("data");
  let max = 0;
  for (const r of data || []) for (const x of (r.data && r.data.bevestigingen) || []) { const m = String(x.nr || "").match(/^SB(\d{4})-(\d+)$/); if (m && +m[1] === jaar) max = Math.max(max, +m[2]); }
  return `SB${jaar}-${String(max + 1).padStart(3, "0")}`;
}

export async function sponsorBevestiging(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") throw httpErr(405, "Gebruik POST");
  const { sb, user } = await requireUser(req, { boek: true });
  const b0 = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const { data: row } = await sb.from("sponsors").select("id,data").eq("id", String(b0.sponsorId || "")).maybeSingle();
  if (!row) throw httpErr(404, "Sponsor niet gevonden.");
  const s = row.data || {};
  if (!sponsorNaam(s)) throw httpErr(400, "Vul eerst de bedrijfsnaam van de sponsor in.");
  const waarde = Math.round(Number(String(b0.waarde ?? "").replace(",", ".")) * 100) / 100;
  if (!(waarde > 0) || waarde > 1e6) throw httpErr(400, "Vul de waarde of het bedrag in.");
  const omschrijving = String(b0.omschrijving || "").trim().slice(0, 300);
  if (!omschrijving) throw httpErr(400, "Vul in wat je ontvangen hebt.");
  if (!datumOk(b0.datum)) throw httpErr(400, "De datum klopt niet.");
  const opgemaakt = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Brussels" }).format(new Date());
  const cfg = await fcConfig(sb);
  const actie = String(b0.actie || "pdf");
  const b = {
    soort: b0.soort === "geld" ? "geld" : "natura", omschrijving, waarde, datum: b0.datum || "", opgemaakt,
    tegenprestatie: String(b0.tegenprestatie || "").trim().slice(0, 400),
    ondertekenaar: String(b0.ondertekenaar || "").trim().slice(0, 80), functie: String(b0.functie || "").trim().slice(0, 60),
  };
  // voorbeeld (geen nummer, niet gelogd)
  if (actie === "voorbeeld") { b.nr = "voorbeeld"; return res.status(200).json({ naam: pdfNaam(b, s), pdf: bevPdf(b, s, cfg, await handtekening(sb, b.ondertekenaar)).toString("base64") }); }
  b.nr = await volgNr(sb, Number(opgemaakt.slice(0, 4)));
  const hand = await handtekening(sb, b.ondertekenaar);
  const pdfb = bevPdf(b, s, cfg, hand), log = { ...b, op: new Date().toISOString(), door: user.email || "" };
  if (actie === "mail") {
    const aan = String(b0.aan || s.email || "").trim();
    if (!isMail(aan)) throw httpErr(400, "Geen geldig e-mailadres voor deze sponsor.");
    if (!smtpConfigured()) throw httpErr(501, "Versturen is niet ingesteld (SMTP in Vercel).");
    const m = bevMail(b, s, cfg);
    const berichten = [{ aan, aanNaam: contactNaam(s) || sponsorNaam(s), onderwerp: m.onderwerp, html: m.html, van: afzender(), bijlagen: [{ naam: pdfNaam(b, s), type: "application/pdf", data: pdfb }], antwoordAan: undefined }];
    const kopie = String(cfg.kopie || "").split(/[,;\s]+/).filter(x => /@/.test(x) && x.toLowerCase() !== aan.toLowerCase());
    for (const k of kopie) berichten.push({ ...berichten[0], aan: k, aanNaam: "", onderwerp: "[Kopie] " + m.onderwerp });
    const r = await verstuur(berichten);
    log.aan = aan; log.ok = !!(r[0] && r[0].ok);
    if (!log.ok) log.fout = (r[0] && r[0].fout) || "onbekende fout";
  }
  const { data: vers } = await sb.from("sponsors").select("data").eq("id", row.id).maybeSingle();
  const d = (vers && vers.data) || s;
  await sb.from("sponsors").update({ data: { ...d, bevestigingen: [...(d.bevestigingen || []), log] } }).eq("id", row.id);
  if (actie === "mail" && !log.ok) throw httpErr(502, "Versturen mislukt: " + log.fout);
  return res.status(200).json({ nr: b.nr, naam: pdfNaam(b, s), pdf: pdfb.toString("base64"), log });
}
