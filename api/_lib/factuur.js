import crypto from "node:crypto";
import { admin, requireUser, isDbCron, httpErr } from "./sb.js";
import { smtpConfigured, factuurAfzender, FACTUUR_ADRES, verstuur } from "./smtp.js";
import { algemeen, configDoc, DEF_IBAN } from "./publiek.js";
import { Pdf, afbreken, breedte } from "./pdf.js";
import { LOGO, WATERMERK } from "./logo_pdf.js";
import { epcPayload, qrSvg, qrMatrix } from "./epc.js";
import { huisstijl, kaderBlok, knop, tabel, rij, p, esc, eur, lang, kort, vandaag, plusDagen, site } from "./bevestiging.js";
import { meldPush } from "./push.js";

/* ============ Facturatie ============
   Tabel "facturen": data = {type: factuur|credit, status: concept|open|gecrediteerd, nr, seq, jaar, ogm, datum, vervaldatum,
     klant: {naam, contact, adres, btw, email, sponsorId, lidId}, lijnen: [{omschrijving, aantal, prijs, btw}], opmerking, referentie,
     categorie, factuurId (creditnota -> factuur), creditId, verzonden: [{op, aan, soort, ok}], betaling (online), betaaldManueel: {op, opmerking}, totaal}
   Config "facturen": gegevens van de vereniging op de factuur, nummering, betaaltermijn, mailtekst en automatische herinneringen.
   Nummer: F + jaar + volgnummer (F2026019), uniek afgedwongen door de database. Mededeling: Belgische gestructureerde mededeling (OGM)
   jaar(4) + volgnummer(6) + controle (mod 97), zodat elke overschrijving automatisch aan de juiste factuur gekoppeld wordt. */

export const FC_DEF = {
  btwPlichtig: false, // vzw niet btw-plichtig: geen btw op de facturen, wel de vermelding BTW_VRIJ
  voorvoegsel: "F", creditVoorvoegsel: "C", start: {}, vervaldagen: 30, bic: "ARSPBE22",
  adres: "", kbo: "", email: "", telefoon: "", website: "vbha.be",
  voettekst: "", kopie: "", mailOnderwerp: "", mailTekst: "", rechtsvorm: "vzw", rpr: "RPR Gent, afdeling Dendermonde",
  herinnering: { aan: false, dagenNaVerval: 7, interval: 14, max: 2 },
};
export async function fcConfig(sb) {
  const c = await configDoc(sb, "facturen"), A = await algemeen(sb);
  const r = { ...FC_DEF, ...c, herinnering: { ...FC_DEF.herinnering, ...(c.herinnering || {}) }, vereniging: A.vereniging, iban: A.rekeningnummer || DEF_IBAN };
  // juridische naam op de factuur (Wetboek van vennootschappen en verenigingen: naam + rechtsvorm, zetel, ondernemingsnummer, RPR)
  const rv = String(r.rechtsvorm || "").trim();
  r.naamJuridisch = rv && !new RegExp("\\b" + rv.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(r.vereniging) ? r.vereniging + " " + rv : r.vereniging;
  if (r.voorwaarden == null) r.voorwaarden = VOORWAARDEN_DEF;
  return r;
}
export const VOORWAARDEN_DEF = "Betaalbaar binnen {termijn} dagen na factuurdatum, door overschrijving met de vermelde gestructureerde mededeling. Bij niet-betaling op de vervaldag is van rechtswege en zonder voorafgaande ingebrekestelling een verwijlintrest verschuldigd volgens de wet van 2 augustus 2002 betreffende de bestrijding van de betalingsachterstand bij handelstransacties, vermeerderd met een forfaitaire schadevergoeding van € 40. Klachten over deze factuur worden schriftelijk gemeld binnen 8 dagen na ontvangst.";

/* ---------- nummers en mededeling ---------- */
export function ogmVan(jaar, seq) {
  const basis = String(jaar).slice(-4).padStart(4, "0") + String(seq).padStart(6, "0").slice(-6);
  const c = Number(BigInt(basis) % 97n) || 97;
  return basis + String(c).padStart(2, "0");
}
export const ogmFmt = d => d && d.length === 12 ? `+++${d.slice(0, 3)}/${d.slice(3, 7)}/${d.slice(7)}+++` : "";
export const ogmGeldig = d => /^\d{12}$/.test(d) && (Number(BigInt(d.slice(0, 10)) % 97n) || 97) === Number(d.slice(10));
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
export function totalen(d) {
  const per = {}; let excl = 0;
  for (const l of d.lijnen || []) {
    const bedrag = r2((Number(l.aantal) || 0) * (Number(l.prijs) || 0)), t = Number(l.btw) || 0;
    excl += bedrag; if (t) per[t] = (per[t] || 0) + bedrag * t / 100;
  }
  const btw = Object.entries(per).map(([t, b]) => ({ tarief: Number(t), bedrag: r2(b) })).sort((a, b) => a.tarief - b.tarief);
  excl = r2(excl);
  return { excl, btw, totaal: r2(excl + btw.reduce((s, b) => s + b.bedrag, 0)) };
}
const cijfers = s => String(s || "").replace(/\D/g, "");
const compact = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
// Welke transacties horen bij deze factuur? Gestructureerde mededeling, factuurnummer in de vrije mededeling, of manueel toegewezen.
export function hoortBij(b, f) {
  if (!b || b.richting === "uit" || !f.nr) return false;
  if (b.factuurId) return b.factuurId === f.id;
  const m = String(b.mededeling || "");
  if (f.ogm && cijfers(m).includes(f.ogm)) return true;
  const re = new RegExp("(^|[^A-Z0-9])" + compact(f.nr) + "($|[^0-9])");
  return re.test(m.toUpperCase().replace(/\s+/g, "")) || re.test(m.toUpperCase());
}
export function betaalStatus(f, boekingen) {
  const T = r2(totalen(f).totaal + (f.aanmaning && Number(f.aanmaning.kosten) || 0)), L = (boekingen || []).filter(b => hoortBij(b, f));
  let ontvangen = L.reduce((s, b) => s + (Number(b.bedrag) || 0), 0);
  const online = f.betaling && f.betaling.status === "SUCCEEDED" ? Number(f.betaling.bedrag) || 0 : 0;
  if (online && !L.some(b => Math.abs(b.bedrag - online) < 0.01)) ontvangen += online;
  ontvangen = r2(ontvangen);
  const betaald = !!f.betaaldManueel || (T > 0 && ontvangen >= T - 0.005);
  const laatst = L.map(b => b.datum).sort().pop() || (f.betaling && f.betaling.betaaldOp ? String(f.betaling.betaaldOp).slice(0, 10) : null) || (f.betaaldManueel && f.betaaldManueel.op) || null;
  return { totaal: T, ontvangen, open: r2(Math.max(0, T - ontvangen)), betaald, laatst, boekingen: L };
}

/* ---------- aanmaning: verwijlintrest en forfaitaire schadevergoeding ----------
   Wet van 2 augustus 2002 (betalingsachterstand bij handelstransacties): interest van rechtswege vanaf de dag na de vervaldag
   aan de rentevoet die de FOD Financiën per semester bekendmaakt (2e semester 2026: 10,5%), plus een forfaitaire vergoeding
   voor invorderingskosten van € 40. De administrator kan beide aanpassen in de instellingen van Facturen. */
export const AANMANING_DEF = { pct: 10.5, forfait: 40, termijn: 8 };
export function aanmaningBerekend(f, cfg, st, opties = {}) {
  const A = { ...AANMANING_DEF, ...(cfg.aanmaning || {}) };
  const open = r2(Math.max(0, (st ? st.open : totalen(f).totaal) - (f.aanmaning && Number(f.aanmaning.kosten) || 0)));
  const dag = vandaag(), dagen = f.vervaldatum && dag > f.vervaldatum ? Math.round((Date.parse(dag) - Date.parse(f.vervaldatum)) / 864e5) : 0;
  const pct = opties.pct != null ? Number(opties.pct) : Number(A.pct) || 0;
  const intrest = opties.intrest != null ? r2(Number(opties.intrest) || 0) : r2(open * pct / 100 * dagen / 365);
  const forfait = opties.forfait != null ? r2(Number(opties.forfait) || 0) : r2(Number(A.forfait) || 0);
  const termijn = Number(opties.termijn) || Number(A.termijn) || 8;
  return { op: new Date().toISOString(), dag, open, dagen, pct, intrest, forfait, kosten: r2(intrest + forfait), totaal: r2(open + intrest + forfait), tot: plusDagen(dag, termijn), termijn };
}

/* ---------- ondertekende link naar de betaalpagina ---------- */
const sleutel = () => String(process.env.BETAAL_GEHEIM || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
export const tekenFactuur = id => crypto.createHmac("sha256", sleutel()).update("vbha-factuur|" + id).digest("base64url").slice(0, 22);
export function factuurKlopt(id, t) {
  if (!sleutel() || !id || typeof t !== "string") return false;
  const a = Buffer.from(tekenFactuur(id)), b = Buffer.from(t);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
export const betaalLink = id => `${site()}/factuur?f=${encodeURIComponent(id)}&t=${tekenFactuur(id)}`;


/* ---------- PDF ---------- */
const dmy = iso => { if (!iso) return ""; const [y, m, d] = String(iso).slice(0, 10).split("-"); return `${d}/${m}/${y}`; };
const geld = n => "€ " + Number(n || 0).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const aantalTxt = n => Number(n || 0).toLocaleString("nl-BE", { maximumFractionDigits: 2 });
const ROOD = "#b30000", GRIJS = "#666666", LICHT = "#f4f1ea", GOUD = "#C1A057";

export const BTW_VRIJ = "Vereniging niet onderworpen aan de btw.";
export function factuurPdf(f, cfg, { status, aanmaning: AM } = {}) {
  if (!cfg.btwPlichtig) f = { ...f, lijnen: (f.lijnen || []).map(l => ({ ...l, btw: 0 })) };
  const pdf = new Pdf(), L = 50, R = 545, Wb = R - L;
  const credit = f.type === "credit", concept = !f.nr;
  const T = totalen(f), metBtw = T.btw.length > 0 || (f.lijnen || []).some(l => Number(l.btw));
  const titel = AM ? "AANMANING" : concept ? (credit ? "CREDITNOTA (concept)" : "FACTUUR (concept)") : credit ? "CREDITNOTA" : "FACTUUR";

  function kop(eerste) {
    pdf.vlak(0, 0, 595, 6, ROOD);
    pdf.beeld(L, 30, 46, 46 * LOGO.h / LOGO.w, LOGO);
    let y = 32;
    pdf.tekst(L + 58, y, cfg.naamJuridisch || cfg.vereniging, { size: 12, bold: true }); y += 16;
    for (const r of [...String(cfg.adres || "").split(/\r?\n/).filter(Boolean), [cfg.kbo ? "Ondernemingsnr. " + cfg.kbo : "", cfg.rpr].filter(Boolean).join("  ·  "), [cfg.email, cfg.telefoon].filter(Boolean).join("  ·  "), cfg.website].filter(Boolean)) { pdf.tekst(L + 58, y, r, { size: 8.5, kleur: GRIJS }); y += 11; }
    pdf.tekst(R, 32, titel, { size: concept ? 16 : 22, bold: true, kleur: ROOD, align: "right" });
    if (!eerste) pdf.tekst(R, 58, (credit ? "Creditnota " : "Factuur ") + (f.nr || ""), { size: 9, kleur: GRIJS, align: "right" });
    return Math.max(y, 88) + 14;
  }
  let y = kop(true);

  // klant (links) en factuurgegevens (rechts)
  const k = f.klant || {};
  pdf.tekst(L, y, credit ? "CREDITNOTA AAN" : "FACTUUR AAN", { size: 7.5, bold: true, kleur: GRIJS });
  let ky = y + 13;
  pdf.tekst(L, ky, k.naam || "", { size: 11, bold: true }); ky += 14;
  for (const r of [k.contact ? "T.a.v. " + k.contact : "", ...String(k.adres || "").split(/\r?\n|,\s*(?=\d{4}\s)/).map(s => s.trim()).filter(Boolean), k.btw ? "Btw/ondernemingsnr. " + k.btw : ""].filter(Boolean)) { pdf.tekst(L, ky, r, { size: 9.5 }); ky += 12.5; }

  const gx = 330, gw = R - gx;
  const rijen = [[credit ? "Creditnotanummer" : "Factuurnummer", f.nr || "concept"], [credit ? "Datum" : "Factuurdatum", dmy(f.datum)]];
  if (!credit) rijen.push([AM ? "Oorspr. vervaldatum" : "Vervaldatum", dmy(f.vervaldatum)]);
  if (AM) rijen.push(["Datum aanmaning", dmy(AM.dag)], ["Te betalen uiterlijk", dmy(AM.tot)]);
  if (credit && f.factuurNr) rijen.push(["Betreft factuur", f.factuurNr]);
  if (f.referentie) rijen.push(["Uw referentie", f.referentie]);
  pdf.vlak(gx, y - 4, gw, rijen.length * 16 + 10, LICHT);
  let gy = y + 3;
  for (const [a, b] of rijen) { pdf.tekst(gx + 10, gy, a, { size: 8.5, kleur: GRIJS }); pdf.tekst(R - 10, gy, b, { size: 9.5, bold: a.endsWith("nummer"), align: "right" }); gy += 16; }
  y = Math.max(ky, gy + 6) + 18;

  // lijnen
  const kol = metBtw ? { oms: L + 8, aantal: 345, prijs: 420, btw: 465, tot: R - 8 } : { oms: L + 8, aantal: 375, prijs: 455, tot: R - 8 };
  const omsW = (metBtw ? 300 : 320) - 16;
  const kopRij = () => {
    pdf.vlak(L, y, Wb, 20, "#222222");
    pdf.tekst(kol.oms, y + 6, "Omschrijving", { size: 8.5, bold: true, kleur: "#ffffff" });
    pdf.tekst(kol.aantal, y + 6, "Aantal", { size: 8.5, bold: true, kleur: "#ffffff", align: "right" });
    pdf.tekst(kol.prijs, y + 6, "Prijs", { size: 8.5, bold: true, kleur: "#ffffff", align: "right" });
    if (metBtw) pdf.tekst(kol.btw, y + 6, "Btw", { size: 8.5, bold: true, kleur: "#ffffff", align: "right" });
    pdf.tekst(kol.tot, y + 6, metBtw ? "Totaal excl." : "Totaal", { size: 8.5, bold: true, kleur: "#ffffff", align: "right" });
    y += 26;
  };
  kopRij();
  const ONDER = 760;
  for (const l of f.lijnen || []) {
    const regels = afbreken(l.omschrijving || "", 9.5, false, omsW), h = regels.length * 12.5 + 8;
    if (y + h > ONDER) { pdf.nieuwePagina(); y = kop(false); kopRij(); }
    regels.forEach((r, i) => pdf.tekst(kol.oms, y + i * 12.5, r, { size: 9.5 }));
    pdf.tekst(kol.aantal, y, aantalTxt(l.aantal), { size: 9.5, align: "right" });
    pdf.tekst(kol.prijs, y, geld(l.prijs), { size: 9.5, align: "right" });
    if (metBtw) pdf.tekst(kol.btw, y, (Number(l.btw) || 0) + "%", { size: 9.5, align: "right" });
    pdf.tekst(kol.tot, y, geld(r2((Number(l.aantal) || 0) * (Number(l.prijs) || 0))), { size: 9.5, align: "right" });
    y += h; pdf.lijn(L, y - 4, R, y - 4, "#e2e2e2");
  }

  // totalen
  const totRijen = metBtw ? [["Totaal excl. btw", geld(T.excl)], ...T.btw.map(b => [`Btw ${b.tarief}%`, geld(b.bedrag)])] : [];
  if (y + 30 + totRijen.length * 15 > ONDER) { pdf.nieuwePagina(); y = kop(false); }
  y += 6;
  for (const [a, b] of totRijen) { pdf.tekst(430, y, a, { size: 9.5, kleur: GRIJS, align: "right" }); pdf.tekst(R - 8, y, b, { size: 9.5, align: "right" }); y += 15; }
  if (AM) {
    // aanmaning: factuurbedrag, wat al betaald is, en de bijkomende kosten
    pdf.tekst(312, y + 6, "Factuurbedrag", { size: 10, bold: true }); pdf.tekst(R - 8, y + 6, geld(T.totaal), { size: 10, bold: true, align: "right" }); y += 20;
    const rest = [];
    if (r2(T.totaal - AM.open) > 0.004) rest.push(["Reeds ontvangen", "- " + geld(r2(T.totaal - AM.open))]);
    if (AM.intrest) rest.push([`Verwijlintrest ${String(AM.pct).replace(".", ",")}% op ${AM.dagen} dagen`, geld(AM.intrest)]);
    if (AM.forfait) rest.push(["Forfaitaire schadevergoeding", geld(AM.forfait)]);
    for (const [a, b] of rest) { pdf.tekst(312, y, a, { size: 9.5, kleur: GRIJS }); pdf.tekst(R - 8, y, b, { size: 9.5, align: "right" }); y += 15; }
    y += 4;
  } else pdf.vlak(300, y - 2, R - 300, 26, ROOD);
  if (AM) pdf.vlak(300, y - 2, R - 300, 26, ROOD);
  pdf.tekst(312, y + 6, credit ? "Totaal gecrediteerd" : "Totaal te betalen", { size: 11, bold: true, kleur: "#ffffff" });
  pdf.tekst(R - 8, y + 6, geld(AM ? AM.totaal : T.totaal), { size: 12, bold: true, kleur: "#ffffff", align: "right" });
  y += 40;
  if (AM) {
    const txt = `Ondanks onze factuur${(f.verzonden || []).some(v => v.soort === "herinnering" && v.ok) || f.eerderHerinnerd ? " en herinnering" : ""} ontvingen wij nog geen${AM.open < T.totaal - 0.004 ? " volledige" : ""} betaling. Overeenkomstig onze betalingsvoorwaarden en de wet van 2 augustus 2002 betreffende de bestrijding van de betalingsachterstand bij handelstransacties zijn van rechtswege verwijlintresten en een forfaitaire schadevergoeding verschuldigd. Gelieve het totaal uiterlijk op ${dmy(AM.tot)} te betalen. Zonder betaling binnen deze termijn zetten wij verdere stappen tot invordering.`;
    const regels = afbreken(txt, 9.5, false, Wb);
    regels.forEach((rg, i) => pdf.tekst(L, y + i * 12.5, rg, { size: 9.5 }));
    y += regels.length * 12.5 + 14;
  }

  if (f.opmerking) {
    const regels = afbreken(f.opmerking, 9.5, false, Wb);
    if (y + regels.length * 12.5 + 10 > ONDER) { pdf.nieuwePagina(); y = kop(false); }
    regels.forEach((r, i) => pdf.tekst(L, y + i * 12.5, r, { size: 9.5 }));
    y += regels.length * 12.5 + 14;
  }

  // betaalgegevens met QR-code (niet bij een creditnota)
  const st = status || null;
  if (!credit && T.totaal > 0) {
    const bh = st && st.betaald ? 46 : 112;
    // betalingsvoorwaarden net boven het betaalblok
    const vw = String(cfg.voorwaarden || "").replace(/\{termijn\}/g, String(Number(cfg.vervaldagen) || 30)).trim();
    const vr = vw ? afbreken(vw, 7.5, false, Wb) : [], vh = vr.length ? vr.length * 9.5 + 16 : 0;
    if (y + vh + bh + 6 > ONDER) { pdf.nieuwePagina(); y = kop(false); }
    if (vr.length) {
      const vy = ONDER - bh - 8 - vh;
      pdf.tekst(L, vy, "BETALINGSVOORWAARDEN", { size: 6.5, bold: true, kleur: GRIJS });
      vr.forEach((r, i) => pdf.tekst(L, vy + 11 + i * 9.5, r, { size: 7.5, kleur: GRIJS }));
    }
    y = ONDER - bh; // altijd onderaan de pagina, net boven de voettekst
    if (st && st.betaald) {
      pdf.vlak(L, y, Wb, 46, "#f1faf4"); pdf.vlak(L, y, 4, 46, "#1a7f45");
      pdf.tekst(L + 16, y + 10, "BETAALD", { size: 13, bold: true, kleur: "#1a7f45" });
      const bc = f.betaling && f.betaling.status === "SUCCEEDED";
      pdf.tekst(L + 16, y + 28, bc ? `Online betaald met Bancontact${f.betaling.betaaldOp ? " op " + dmy(String(f.betaling.betaaldOp).slice(0, 10)) : ""} (${geld(f.betaling.bedrag || st.ontvangen)}). Bedankt!` : st.laatst ? "Ontvangen op " + dmy(st.laatst) + ". Bedankt!" : "Bedankt voor je betaling.", { size: 9.5, kleur: GRIJS });
    } else {
      const te = st ? st.open : T.totaal;
      pdf.vlak(L, y, Wb, bh, LICHT); pdf.vlak(L, y, 4, bh, GOUD);
      pdf.tekst(L + 16, y + 12, "BETAALGEGEVENS", { size: 8, bold: true, kleur: GRIJS });
      const bx = L + 16, vx = L + 112; let by = y + 30;
      const regel = (a, b, vet) => { pdf.tekst(bx, by, a, { size: 9, kleur: GRIJS }); pdf.tekst(vx, by, b, { size: vet ? 10.5 : 9.5, bold: !!vet }); by += 15; };
      regel("Te betalen", geld(te), true);
      regel("Rekening", String(cfg.iban).replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim() + (cfg.bic ? "   BIC " + cfg.bic : ""));
      regel("Begunstigde", cfg.vereniging);
      regel("Mededeling", f.ogm ? ogmFmt(f.ogm) : f.nr || "volgt bij het versturen", !!(f.ogm || f.nr));
      if (AM) regel("Uiterlijk op", dmy(AM.tot)); else if (f.vervaldatum) regel("Uiterlijk op", dmy(f.vervaldatum));
      {
        // ook in het concept (voorbeeld): dan nog zonder mededeling, die volgt bij het versturen
        try {
          const q = qrMatrix(epcPayload({ naam: cfg.vereniging, iban: cfg.iban, bedrag: te, mededeling: f.ogm ? ogmFmt(f.ogm) : f.nr || "" }));
          const qm = 84, qx = R - qm - 14;
          pdf.vlak(qx - 4, y + 10, qm + 8, qm + 8, "#ffffff");
          pdf.qr(qx, y + 14, qm, q.n, q.donker);
          pdf.tekst(qx + qm / 2, y + bh - 10 + 2, f.nr ? "Scan met je bankapp" : "Voorbeeld", { size: 7, kleur: GRIJS, align: "center" });
        } catch (e) { console.error("QR in PDF", e); }
      }
    }
  }

  // watermerk (VBHA-woordmerk) en voettekst op elke pagina
  const wmW = 400, wmH = wmW * WATERMERK.h / WATERMERK.w;
  const voet = [[cfg.btwPlichtig ? "" : BTW_VRIJ, cfg.voettekst || ""].filter(Boolean).join(" "), `${cfg.naamJuridisch || cfg.vereniging}${cfg.kbo ? " · " + cfg.kbo : ""}${cfg.rpr ? " · " + cfg.rpr : ""} · ${String(cfg.iban).replace(/\s+/g, "")}`].filter(Boolean);
  pdf.paginas.forEach((ops, i) => {
    pdf.ops = ops;
    pdf.achtergrond((595 - wmW) / 2, (842 - wmH) / 2 + 30, wmW, wmH, WATERMERK);
    pdf.lijn(L, 790, R, 790, "#dddddd");
    let vy = 797;
    for (const v of voet) for (const r of afbreken(v, 7.5, false, Wb - 60)) { pdf.tekst(L, vy, r, { size: 7.5, kleur: GRIJS }); vy += 10; }
    pdf.tekst(R, 797, `Pagina ${i + 1}/${pdf.paginas.length}`, { size: 7.5, kleur: GRIJS, align: "right" });
  });
  return pdf.bytes({ titel: `${credit ? "Creditnota" : "Factuur"} ${f.nr || "concept"} - ${cfg.vereniging}`, auteur: cfg.vereniging });
}
export const pdfNaam = f => `${f.type === "credit" ? "Creditnota" : "Factuur"} ${f.nr || "concept"}.pdf`;

/* ---------- mail ---------- */
// aanspreking: bij sponsors enkel de voornaam van het contact (of gewoon "Beste,"); anders contact of naam
function groetVan(k) {
  if (k.sponsorId) { const vn = String(k.voornaam || String(k.contact || "").trim().split(/\s+/)[0] || "").trim(); return vn ? `Beste ${esc(vn)},` : "Beste,"; }
  // contactpersoon: enkel de voornaam ("Beste Sem,"); zonder contactpersoon de naam van de klant
  if (k.contact) { const vn = String(k.contact).trim().split(/\s+/)[0]; return `Beste ${esc(vn)},`; }
  return `Beste ${esc(k.naam || "")},`.replace(" ,", ",");
}
function vul(t, f, cfg, T) {
  return String(t || "").replace(/\{(\w+)\}/g, (m, k) => ({ naam: (f.klant && (f.klant.contact || f.klant.naam)) || "", nr: f.nr || "", bedrag: eur(T.totaal), vervaldatum: kort(f.vervaldatum), vereniging: cfg.vereniging }[k] ?? m));
}
export function factuurMail(f, cfg, soort = "factuur", status, extra = "") {
  const T = totalen(f), k = f.klant || {}, credit = f.type === "credit";
  const groet = groetVan(k);
  const open = status ? status.open : T.totaal;
  let html = p(groet), onderwerp;
  if (credit) {
    onderwerp = `Creditnota ${f.nr} - ${cfg.vereniging}`;
    html += p(`In bijlage vind je creditnota <b>${esc(f.nr)}</b>${f.factuurNr ? ` voor factuur <b>${esc(f.factuurNr)}</b>` : ""} ten bedrage van <b>${eur(T.totaal)}</b>.`)
      + p(f.factuurNr ? `Hiermee vervalt het openstaande bedrag van die factuur. Je hoeft niets te doen.` : `Je hoeft niets te doen.`);
  } else if (soort === "aanmaning" && f.aanmaning) {
    const A = f.aanmaning;
    onderwerp = `Aanmaning: factuur ${f.nr} - ${cfg.vereniging}`;
    html += p(`Ondanks onze factuur${(f.verzonden || []).some(v => v.soort === "herinnering" && v.ok) || f.eerderHerinnerd ? " en onze herinnering" : ""} hebben wij voor factuur <b>${esc(f.nr)}</b> van ${esc(kort(f.datum))} nog geen${status && status.ontvangen > 0 ? " volledige" : ""} betaling ontvangen. De vervaldatum was ${esc(kort(f.vervaldatum))}.`)
      + p(`Zoals vermeld in onze betalingsvoorwaarden rekenen wij vanaf nu verwijlintresten en een forfaitaire schadevergoeding aan.`)
      + p(`Wij vragen je het totaal van <b>${eur(A.totaal)}</b> uiterlijk op <b>${esc(lang(A.tot).replace(/^\p{Lu}/u, c => c.toLowerCase()))}</b> over te schrijven. Zonder betaling binnen deze termijn zien wij ons genoodzaakt verdere stappen tot invordering te zetten.`)
      + String(extra || "").trim().split(/\n\s*\n/).filter(x => x.trim()).map(x => p(esc(x.trim()).replace(/\n/g, "<br>"))).join("")
      + p(`Heb je intussen al betaald? Dan kruisten onze berichten elkaar en mag je deze aanmaning als niet verzonden beschouwen.`, "margin:0 0 15px;font-size:13.5px;color:#666666");
    html += kaderBlok("Aanmaning factuur " + esc(f.nr), tabel([
      rij("Openstaand bedrag", eur(A.open)),
      A.intrest ? rij(`Verwijlintrest ${String(A.pct).replace(".", ",")}% (${A.dagen} dagen)`, eur(A.intrest)) : "",
      A.forfait ? rij("Forfaitaire schadevergoeding", eur(A.forfait)) : "",
      rij("Totaal te betalen", `<b>${eur(A.totaal)}</b>`),
      rij("Uiterlijk op", `<b>${esc(lang(A.tot).replace(/^\p{Lu}/u, c => c.toLowerCase()))}</b>`),
    ]));
    html += kaderBlok("Betalen", tabel([rij("Bedrag", `<b>${eur(open)}</b>`), rij("Rekening", `<b>${esc(String(cfg.iban).replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim())}</b>`), rij("Begunstigde", esc(cfg.vereniging)), rij("Mededeling", `<b>${esc(ogmFmt(f.ogm) || f.nr)}</b>`)]), "#b30000", "#fdf2f2")
      + knop("Online betalen met Bancontact of QR-code", betaalLink(f.id))
      + p(`Vragen? Antwoord gewoon op deze mail.`, "margin:0 0 15px;font-size:13.5px;color:#666666");
    return { onderwerp, html: huisstijl(html, cfg.vereniging) };
  } else if (soort === "herinnering") {
    const n = (f.verzonden || []).filter(v => v.soort === "herinnering" && v.ok).length + 1;
    onderwerp = `${n > 1 ? n + "e herinnering" : "Herinnering"}: factuur ${f.nr} - ${cfg.vereniging}`;
    html += p(`Volgens onze gegevens is factuur <b>${esc(f.nr)}</b> van ${esc(kort(f.datum))} nog niet${status && status.ontvangen > 0 ? " volledig" : ""} betaald. De vervaldatum was ${esc(kort(f.vervaldatum))}.`)
      + p(`Mogen we je vragen het openstaande bedrag van <b>${eur(open)}</b> zo snel mogelijk over te schrijven? De factuur zit opnieuw in bijlage.`)
      + p(`Heb je intussen al betaald? Dan kruisten onze berichten elkaar en mag je deze herinnering als niet verzonden beschouwen.`, "margin:0 0 15px;font-size:13.5px;color:#666666");
  } else {
    onderwerp = vul(cfg.mailOnderwerp, f, cfg, T) || `Factuur ${f.nr} - ${cfg.vereniging}`;
    html += (cfg.mailTekst ? vul(cfg.mailTekst, f, cfg, T).split(/\n{2,}/).map(a => p(esc(a).replace(/\n/g, "<br>"))).join("") : p(`Hartelijk dank voor je steun aan de ${esc(cfg.vereniging)}. In bijlage vind je factuur <b>${esc(f.nr)}</b>.`));
  }
  html += kaderBlok(credit ? "Creditnota " + esc(f.nr) : "Factuur " + esc(f.nr), tabel([
    rij(credit ? "Datum" : "Factuurdatum", esc(lang(f.datum))),
    credit ? "" : rij("Vervaldatum", `<b>${esc(lang(f.vervaldatum))}</b>`),
    rij("Bedrag", `<b>${eur(T.totaal)}</b>`),
    status && status.ontvangen > 0 && !status.betaald ? rij("Nog te betalen", `<b>${eur(open)}</b>`) : "",
  ]));
  if (!credit && open > 0) {
    html += kaderBlok("Betalen", tabel([rij("Bedrag", `<b>${eur(open)}</b>`), rij("Rekening", `<b>${esc(String(cfg.iban).replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim())}</b>`), rij("Begunstigde", esc(cfg.vereniging)), rij("Mededeling", `<b>${esc(ogmFmt(f.ogm) || f.nr)}</b>`)])
      + p("Gebruik exact deze gestructureerde mededeling, dan wordt je betaling automatisch aan de factuur gekoppeld.", "margin:10px 0 0;font-size:13.5px;color:#666666"), "#b30000", "#fdf2f2")
      + knop("Online betalen met Bancontact of QR-code", betaalLink(f.id));
  }
  html += p(`Vragen over deze ${credit ? "creditnota" : "factuur"}? Antwoord gewoon op deze mail.`, "margin:0 0 15px;font-size:13.5px;color:#666666");
  return { onderwerp, html: huisstijl(html, cfg.vereniging) };
}

/* ---------- opslag ---------- */
async function haal(sb, id) { const { data } = await sb.from("facturen").select("id,data").eq("id", id).maybeSingle(); return data; }
async function bewaar(sb, id, data) { const { error } = await sb.from("facturen").update({ data }).eq("id", id); if (error) throw error; return data; }
async function boekingenVoor(sb, f) {
  const van = plusDagen(f.datum || vandaag(), -3);
  const { data, error } = await sb.from("boekingen").select("id,data").gte("data->>datum", van).limit(2000);
  if (error) throw error;
  return (data || []).map(r => ({ ...r.data, id: r.id }));
}
export async function statusVan(sb, row) { const f = { ...row.data, id: row.id }; return betaalStatus(f, await boekingenVoor(sb, f)); }

// Concept -> definitief: uniek nummer (F2026019), gestructureerde mededeling, datum en vervaldatum.
export async function maakDefinitief(sb, row, cfg) {
  const d = row.data;
  if (d.nr) return row;
  const credit = d.type === "credit", pre = credit ? cfg.creditVoorvoegsel || "C" : cfg.voorvoegsel || "F";
  if (!(d.lijnen || []).length) throw httpErr(400, "Voeg minstens één lijn toe.");
  if (!(d.klant && d.klant.naam)) throw httpErr(400, "Vul de klant in.");
  const datum = d.datum || vandaag(), jaar = Number(datum.slice(0, 4));
  for (let poging = 0; poging < 6; poging++) {
    const { data: rows, error } = await sb.from("facturen").select("data").like("data->>nr", pre + jaar + "%").limit(5000);
    if (error) throw error;
    const max = Math.max(0, ...(rows || []).map(r => Number(r.data.seq) || Number(String(r.data.nr).slice(pre.length + 4)) || 0));
    // nummers die al buiten de app gebruikt werden (bv. F2026018 in de mededeling van een overschrijving) worden overgeslagen
    const { data: bk } = await sb.from("boekingen").select("data").ilike("data->>mededeling", "%" + pre + jaar + "%").limit(2000);
    const re = new RegExp(pre + jaar + "(\\d{3,6})", "i");
    const extern = Math.max(0, ...(bk || []).map(r => { const m = String(r.data.mededeling || "").replace(/\s+/g, "").match(re); return m ? Number(m[1]) : 0; }));
    const start = Math.max(Number((cfg.start || {})[pre + jaar]) || 1, extern + 1);
    const seq = Math.max(start, max + 1) + poging;
    const nr = pre + jaar + String(seq).padStart(3, "0");
    const T = totalen(d);
    const nieuw = { ...d, status: "open", nr, seq, jaar, datum, ogm: credit ? "" : ogmVan(jaar, seq),
      vervaldatum: credit ? "" : (d.vervaldatum && d.vervaldatum >= datum ? d.vervaldatum : plusDagen(datum, Number(cfg.vervaldagen) || 30)),
      totaal: T.totaal, definitiefOp: new Date().toISOString() };
    const { error: e2 } = await sb.from("facturen").update({ data: nieuw }).eq("id", row.id);
    if (!e2) {
      if (credit && d.factuurId) { const o = await haal(sb, d.factuurId); if (o) await bewaar(sb, o.id, { ...o.data, status: "gecrediteerd", creditId: row.id, creditNr: nr }); }
      return { id: row.id, data: nieuw };
    }
    if (e2.code !== "23505") throw e2; // ander nummer proberen als iemand tegelijk een factuur maakte
  }
  throw httpErr(409, "Kon geen uniek factuurnummer toekennen. Probeer opnieuw.");
}

async function verstuurFactuur(sb, row, cfg, soort, aanExtra, extraTekst) {
  const f = { ...row.data, id: row.id };
  const aan = String(aanExtra || (f.klant && f.klant.email) || "").trim();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(aan)) throw httpErr(400, "Geen geldig e-mailadres voor deze klant.");
  if (!smtpConfigured()) throw httpErr(501, "Versturen is niet ingesteld (SMTP in Vercel).");
  const st = f.type === "credit" ? null : await statusVan(sb, row);
  if ((soort === "herinnering" || soort === "aanmaning") && st && st.betaald) throw httpErr(409, "Deze factuur is al betaald.");
  const m = factuurMail(f, cfg, soort, st, extraTekst);
  const bijlagen = [{ naam: soort === "aanmaning" ? pdfNaam(f).replace(/^Factuur/i, "Aanmaning") : pdfNaam(f), type: "application/pdf", data: factuurPdf(f, cfg, { status: st, aanmaning: soort === "aanmaning" ? f.aanmaning : null }) }];
  const berichten = [{ aan, aanNaam: (f.klant && (f.klant.contact || f.klant.naam)) || "", onderwerp: m.onderwerp, html: m.html, van: factuurAfzender(), bijlagen, antwoordAan: FACTUUR_ADRES() }];
  const kopie = String(cfg.kopie || "").split(/[,;\s]+/).filter(x => /@/.test(x) && x.toLowerCase() !== aan.toLowerCase());
  for (const k of kopie) berichten.push({ ...berichten[0], aan: k, aanNaam: "", onderwerp: "[Kopie] " + m.onderwerp });
  const r = await verstuur(berichten, { factuur: true });
  const ok = !!(r[0] && r[0].ok);
  const vers = await haal(sb, row.id);
  const log = { op: new Date().toISOString(), aan, soort: f.type === "credit" ? "credit" : soort, ok, ...(ok ? {} : { fout: r[0] && r[0].fout }) };
  await bewaar(sb, row.id, { ...vers.data, verzonden: [...(vers.data.verzonden || []), log] });
  if (!ok) throw httpErr(502, "Versturen mislukt: " + ((r[0] && r[0].fout) || "onbekende fout"));
  return log;
}

/* ---------- api: /api/mail?f=factuur  (aangemeld, rol boekhouding) ---------- */
// POST {actie: pdf|definitief|versturen|herinnering|link, id, aan?}
export async function factuurActie(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") throw httpErr(405, "Gebruik POST");
  const { sb } = await requireUser(req, { boek: true, functie: "facturen" });
  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const cfg = await fcConfig(sb);
  let row = await haal(sb, String(b.id || ""));
  if (!row) throw httpErr(404, "Factuur niet gevonden. Bewaar ze eerst.");
  const actie = String(b.actie || "");
  if (actie === "pdf") {
    const f = { ...row.data, id: row.id };
    const st = f.nr && f.type !== "credit" ? await statusVan(sb, row) : null;
    return res.status(200).json({ naam: pdfNaam(f), pdf: factuurPdf(f, cfg, { status: st }).toString("base64") });
  }
  if (actie === "link") return res.status(200).json({ link: betaalLink(row.id) });
  if (actie === "definitief" || actie === "versturen") {
    row = await maakDefinitief(sb, row, cfg);
    let log = null;
    if (actie === "versturen") log = await verstuurFactuur(sb, row, cfg, "factuur", b.aan);
    return res.status(200).json({ nr: row.data.nr, log, data: (await haal(sb, row.id)).data });
  }
  if (actie === "aanmaningVoorstel" || actie === "aanmaningPdf" || actie === "aanmaning") {
    if (!row.data.nr || row.data.type === "credit") throw httpErr(400, "Een aanmaning kan enkel voor een definitieve factuur.");
    const st0 = await statusVan(sb, row);
    if (st0.betaald) throw httpErr(409, "Deze factuur is al betaald.");
    const A = aanmaningBerekend({ ...row.data, id: row.id }, cfg, st0, b.opties || {});
    if (actie === "aanmaningVoorstel") return res.status(200).json({ aanmaning: A, klantBtw: !!(row.data.klant && row.data.klant.btw) });
    const f2 = { ...row.data, id: row.id, aanmaning: A };
    if (actie === "aanmaningPdf") { const st2 = betaalStatus(f2, st0.boekingen); return res.status(200).json({ naam: pdfNaam(f2).replace(/^Factuur/i, "Aanmaning"), pdf: factuurPdf(f2, cfg, { status: st2, aanmaning: A }).toString("base64") }); }
    // eerst de kosten bewaren, dan versturen (de status rekent ze mee)
    await bewaar(sb, row.id, { ...row.data, aanmaning: A, geenHerinnering: true });
    let log;
    try { log = await verstuurFactuur(sb, await haal(sb, row.id), cfg, "aanmaning", b.aan, String(b.tekst || "").slice(0, 2000)); }
    catch (e) { const nu = await haal(sb, row.id); const { aanmaning, ...rest } = nu.data; await bewaar(sb, row.id, { ...rest, ...(row.data.aanmaning ? { aanmaning: row.data.aanmaning } : {}), geenHerinnering: !!row.data.geenHerinnering }); throw e; }
    return res.status(200).json({ log, data: (await haal(sb, row.id)).data });
  }
  if (actie === "kostenWeg") { const { aanmaning, ...rest } = row.data; await bewaar(sb, row.id, { ...rest, ...(aanmaning ? { aanmaningVervallen: { ...aanmaning, weg: new Date().toISOString() } } : {}) }); return res.status(200).json({ data: (await haal(sb, row.id)).data }); }
  if (actie === "herinnering") {
    if (!row.data.nr) throw httpErr(400, "Deze factuur is nog een concept.");
    const log = await verstuurFactuur(sb, row, cfg, "herinnering", b.aan);
    return res.status(200).json({ log, data: (await haal(sb, row.id)).data });
  }
  throw httpErr(400, "Onbekende actie");
}

/* ---------- openbaar: /api/betaling?fa=<id>&t=<handtekening>[&pdf=1] ---------- */
export async function factuurPubliek(req, res, b, { onlineConfigured, startBetaling, controleerBetaling }) {
  const id = String(b.fa || ""), t = String(b.t || "");
  if (!factuurKlopt(id, t)) throw httpErr(404, "Deze link is ongeldig. Gebruik de link uit de mail of neem contact met ons op.");
  const sb = admin();
  let row = await haal(sb, id);
  if (!row || !row.data.nr || row.data.type === "credit") throw httpErr(404, "Deze factuur werd niet gevonden.");
  const cfg = await fcConfig(sb);
  if (req.method === "POST") {
    if (!onlineConfigured()) throw httpErr(501, "Online betalen is niet ingesteld");
    const st = await statusVan(sb, row);
    if (st.betaald || row.data.status === "gecrediteerd") throw httpErr(409, "Deze factuur is al in orde.");
    const bt = await startBetaling(sb, req, "facturen", row, { bedrag: st.open, jaar: row.data.jaar, terug: `/factuur?f=${encodeURIComponent(id)}&t=${encodeURIComponent(t)}&betaling=terug` });
    return res.status(200).json(pub(bt));
  }
  let online = null;
  if (row.data.betaling && row.data.betaling.id && onlineConfigured()) {
    try { online = pub(await controleerBetaling(sb, "facturen", row)); row = await haal(sb, id); } catch (e) { online = pub(row.data.betaling); }
  }
  const f = { ...row.data, id: row.id }, st = await statusVan(sb, row);
  if (b.pdf) {
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${pdfNaam(f)}"`);
    return res.status(200).send(factuurPdf(f, cfg, { status: st }));
  }
  const med = ogmFmt(f.ogm) || f.nr;
  let qr = null;
  if (!st.betaald) { try { qr = qrSvg(epcPayload({ naam: cfg.vereniging, iban: cfg.iban, bedrag: st.open, mededeling: med })); } catch (e) { console.error("QR", e); } }
  res.status(200).json({
    nr: f.nr, datum: f.datum, vervaldatum: f.vervaldatum, klant: (f.klant && f.klant.naam) || "", lijnen: (f.lijnen || []).map(l => ({ omschrijving: l.omschrijving, bedrag: r2((Number(l.aantal) || 0) * (Number(l.prijs) || 0)) })),
    totaal: st.totaal, open: st.open, betaald: st.betaald || f.status === "gecrediteerd", betaaldOp: st.laatst, mededeling: med, rekeningnummer: cfg.iban, bic: cfg.bic, begunstigde: cfg.vereniging,
    qr, online, kanOnline: onlineConfigured(),
  });
}
const pub = b => b ? { status: b.status, deeplink: b.deeplink, qrcode: b.qrcode, checkout: b.checkout, provider: b.provider || null, verlooptOp: b.verlooptOp, bedrag: b.bedrag } : { status: null };

/* opgeroepen zodra een online betaling van een factuur gelukt is: korte bevestiging */
export async function factuurOnlineBetaald(sb, id) {
  if (!smtpConfigured()) return;
  const row = await haal(sb, id); if (!row) return;
  const f = row.data, b = f.betaling || {};
  if (b.bevestigd) return;
  const aan = String((f.klant && f.klant.email) || "").trim();
  if (aan) {
    const cfg = await fcConfig(sb);
    const html = p(groetVan(f.klant || {}))
      + kaderBlok("&#10003; Betaling ontvangen", p(`We ontvingen je betaling van <b>${eur(b.bedrag)}</b> voor factuur <b>${esc(f.nr)}</b> via Bancontact. Hartelijk dank!`, "margin:0"), "#1a7f45", "#f1faf4");
    // de factuur met de vermelding "BETAALD (Bancontact)" mee in bijlage
    let bijlagen;
    try { const st = await statusVan(sb, row); bijlagen = [{ naam: pdfNaam(f), type: "application/pdf", data: factuurPdf({ ...f, id }, cfg, { status: st }) }]; } catch (e) { console.error("pdf betaald", e); }
    await verstuur([{ aan, aanNaam: (f.klant && f.klant.naam) || "", onderwerp: `Betaling ontvangen voor factuur ${f.nr}`, html: huisstijl(html + (bijlagen ? p("In bijlage vind je de factuur, met de vermelding dat ze betaald is.") : ""), cfg.vereniging), van: factuurAfzender(), antwoordAan: FACTUUR_ADRES(), ...(bijlagen ? { bijlagen } : {}) }], { factuur: true });
  }
  const vers = await haal(sb, id);
  await bewaar(sb, id, { ...vers.data, betaling: { ...vers.data.betaling, bevestigd: true } });
  await meldPush(sb, "boek", { titel: `Factuur ${f.nr} betaald`, tekst: `${(f.klant && f.klant.naam) || ""} · ${eur(b.bedrag)} online ontvangen`, url: "/#facturen", tag: "fc-" + id });
}

/* ---------- geplande taak (samen met de bevestigingen, elke 10 minuten): automatische herinneringen, één keer per dag ---------- */
const uurBrussel = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", hour: "2-digit", hour12: false }).format(new Date()));
export async function factuurCron(sb) {
  const cfg = await fcConfig(sb), H = cfg.herinnering, dag = vandaag();
  if (!H.aan || !smtpConfigured() || uurBrussel() < (Number(H.uur) || 10) || cfg.herinneringDag === dag) return [];
  const { data: rij0 } = await sb.from("config").select("data").eq("id", "facturen").maybeSingle();
  await sb.from("config").upsert({ id: "facturen", data: { ...((rij0 && rij0.data) || {}), herinneringDag: dag } });
  const { data: rows, error } = await sb.from("facturen").select("id,data").eq("data->>status", "open").eq("data->>type", "factuur").lt("data->>vervaldatum", plusDagen(dag, -(Number(H.dagenNaVerval) || 0) + 1)).limit(200);
  if (error) throw error;
  const uit = [];
  for (const row of rows || []) {
    const f = row.data;
    if (f.betaaldManueel || f.geenHerinnering || !(f.klant && f.klant.email)) continue;
    if (!(f.verzonden || []).some(v => v.ok && v.soort === "factuur")) continue; // enkel facturen die de klant al per mail kreeg
    const H0 = (f.verzonden || []).filter(v => v.soort === "herinnering" && v.ok);
    if (H0.length >= (Number(H.max) || 0)) continue;
    const laatste = (f.verzonden || []).filter(v => v.ok).map(v => v.op.slice(0, 10)).sort().pop();
    if (laatste && laatste > plusDagen(dag, -(Number(H.interval) || 14))) continue;
    try { const st = await statusVan(sb, row); if (st.betaald) continue; await verstuurFactuur(sb, row, cfg, "herinnering"); uit.push(f.nr); } catch (e) { console.error("herinnering factuur", f.nr, e); }
    if (uit.length >= 20) break;
  }
  return uit;
}
