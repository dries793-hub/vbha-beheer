import crypto from "node:crypto";
import { admin, sendError, httpErr } from "./sb.js";
import { epcPayload, qrSvg } from "./epc.js";
import { onlineConfigured as bcConfigured } from "./betaalprovider.js";
import { startBetaling } from "./betaal.js";
import { wachtOpBetaling, stuurBevestiging } from "./bevestiging.js";
import { clean, body, nieuwId, vandaag, algemeen, configDoc, spamCheck, actieveLeden, inschrijving, alIngeschreven, AL_TEKST, rateLimit } from "./publiek.js";
import { meldPush } from "./push.js";

/* Openbare inschrijving familiedag (vbha.be/familiedag). Instellingen in config "fd_<jaar>":
   { titel, datum, uur, locatie, info, open, inschrijvenTot, nietLeden, prijzen:[{id, naam, uitleg, prijs, lidGratis}] }
   Een prijs met lidGratis kost niets als een lid inschrijft (op kosten van de vriendenkring). Is het totaal 0, dan geen betaling. */
export const FD_PRIJZEN = [{ id: "volw", naam: "Volwassene", uitleg: "", prijs: 15, lidGratis: false }, { id: "kind", naam: "Kind", uitleg: "3 tot 12 jaar", prijs: 8, lidGratis: false }, { id: "klein", naam: "Kind onder 3 jaar", uitleg: "", prijs: 0, lidGratis: false }];
export async function fdInfo(sb) {
  const A = await algemeen(sb);
  const c = await configDoc(sb, "fd_" + A.jaar);
  const ins = inschrijving(c, c.datum || A.jaar + "-12-31");
  const prijzen = (Array.isArray(c.prijzen) && c.prijzen.length ? c.prijzen : FD_PRIJZEN).filter(p => p && p.id && p.naam).slice(0, 12)
    .map(p => ({ id: String(p.id).slice(0, 20), naam: String(p.naam).slice(0, 60), uitleg: String(p.uitleg || "").slice(0, 80), prijs: Math.max(0, Math.round((Number(p.prijs) || 0) * 100) / 100), lidGratis: !!p.lidGratis }));
  return { ...A, titel: c.titel || "Familiedag " + A.jaar, datum: c.datum || "", uur: c.uur || "", locatie: c.locatie || "", info: c.info || "", nietLeden: !!c.nietLeden, prijzen, online: bcConfigured(), open: ins.open && !!c.datum, tot: ins.tot, totTekst: ins.totTekst, gesloten: c.datum ? ins.gesloten : "manueel", ingesteld: !!c.datum };
}
export function fdBereken(I, aantallen, isLid) {
  const lijnen = [];
  for (const p of I.prijzen) {
    const n = Math.max(0, Math.min(30, parseInt(aantallen && aantallen[p.id], 10) || 0));
    if (!n) continue;
    const prijs = isLid && p.lidGratis ? 0 : p.prijs;
    lijnen.push({ id: p.id, naam: p.naam, aantal: n, prijs, totaal: Math.round(n * prijs * 100) / 100, gratis: isLid && p.lidGratis && p.prijs > 0 });
  }
  return { lijnen, personen: lijnen.reduce((s, l) => s + l.aantal, 0), totaal: Math.round(lijnen.reduce((s, l) => s + l.totaal, 0) * 100) / 100 };
}
const geldigMail = a => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(a);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const sb = admin();
    if (req.method === "GET") {
      const I = await fdInfo(sb), lidId = String(req.query?.lid || "");
      if (!lidId) return res.status(200).json(I);
      await rateLimit(sb, req, "lidinfo", 60, 600, httpErr);
      if (!(await actieveLeden(sb, I.jaar)).some(l => l.id === lidId)) throw httpErr(404, "Lid niet gevonden.");
      if (await alIngeschreven(sb, "familiedag", I.jaar, lidId)) return res.status(200).json({ al: true, melding: AL_TEKST("de familiedag", I.jaar) });
      return res.status(200).json({ ok: true });
    }
    if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");
    const b = body(req);
    await rateLimit(sb, req, "post", 20, 3600, httpErr);
    if (await spamCheck(sb, "familiedag", b, httpErr)) return res.status(200).json({ ok: true });
    const I = await fdInfo(sb);
    if (!I.open) throw httpErr(403, "De inschrijvingen voor de familiedag zijn afgesloten.");
    let naam, lidId = null, email = "", voornaam = "";
    if (b.lidId) {
      const l = (await actieveLeden(sb, I.jaar)).find(x => x.id === String(b.lidId));
      if (!l) throw httpErr(400, "Kies je naam uit de lijst van leden.");
      if (await alIngeschreven(sb, "familiedag", I.jaar, l.id)) throw httpErr(409, AL_TEKST("de familiedag", I.jaar));
      const { data: lr } = await sb.from("leden").select("data").eq("id", l.id).maybeSingle();
      naam = l.naam; lidId = l.id; email = clean((lr && lr.data && lr.data.email) || "", 160); voornaam = (lr && lr.data && lr.data.voornaam) || "";
      const eigen = clean(b.email, 160).toLowerCase(); if (eigen && geldigMail(eigen)) email = eigen;
    } else {
      if (!I.nietLeden) throw httpErr(400, "Kies je naam uit de lijst van leden.");
      naam = clean(b.naam, 100); email = clean(b.email, 160).toLowerCase();
      if (naam.length < 3) throw httpErr(400, "Vul je naam in.");
      if (!geldigMail(email)) throw httpErr(400, "Vul een geldig e-mailadres in.");
      voornaam = naam.split(" ")[0];
    }
    const B = fdBereken(I, b.aantallen, !!lidId);
    if (!B.personen) throw httpErr(400, "Kies met hoeveel personen je komt.");
    const token = I.online && B.totaal > 0 ? crypto.randomBytes(18).toString("base64url") : null;
    const id = nieuwId("fd");
    const d = { jaar: I.jaar, bron: "formulier", ingediend: vandaag(), aangemeld: new Date().toISOString(), nieuw: true, naam, lidId, email, lijnen: B.lijnen, personen: B.personen,
      opmerking: clean(b.opmerking, 400), teBetalen: B.totaal, betaald: null, ...(token ? { betaalToken: token } : {}) };
    const { error } = await sb.from("familiedag").insert({ id, data: d });
    if (error) throw error;
    const mededeling = `${naam} Familiedag ${I.jaar}`;
    let qr = null, online = null;
    if (B.totaal > 0) {
      try { qr = qrSvg(epcPayload({ naam: I.vereniging, iban: I.rekeningnummer, bedrag: B.totaal, mededeling })); } catch (e) { console.error("QR", e); }
      if (token) {
        try { const bt = await startBetaling(sb, req, "familiedag", { id, data: d }, { bedrag: B.totaal, jaar: I.jaar, terug: "/familiedag?betaling=terug" });
          online = { t: "familiedag", id, token, deeplink: bt.deeplink, qrcode: bt.qrcode, checkout: bt.checkout, verlooptOp: bt.verlooptOp, provider: bt.provider || null }; } catch (e) { console.error("Bancontact", e); }
      }
    }
    await meldPush(sb, "iedereen", { titel: "Nieuwe inschrijving familiedag", tekst: `${naam} · ${B.personen} ${B.personen === 1 ? "persoon" : "personen"}`, url: "/#familiedag", tag: "ins-fd-" + id }).catch(() => {});
    try { if (online) await wachtOpBetaling(sb, "familiedag", id); else await stuurBevestiging(sb, "familiedag", id); } catch (e) { console.error("bevestiging", e); }
    res.status(200).json({ ok: true, jaar: I.jaar, voornaam, bedrag: B.totaal, lijnen: B.lijnen, personen: B.personen, rekeningnummer: B.totaal > 0 ? I.rekeningnummer : null, begunstigde: I.vereniging, mededeling, qr, online, deadline: I.totTekst });
  } catch (e) { sendError(res, e); }
}
