import crypto from "node:crypto";
import { lidStatus } from "./status.js";
import { admin, sendError, httpErr } from "./sb.js";
import { epcPayload, qrSvg } from "./epc.js";
import { onlineConfigured as bcConfigured } from "./betaalprovider.js";
import { startBetaling } from "./betaal.js";
import { wachtOpBetaling, stuurBevestiging } from "./bevestiging.js";
import { clean, body, nieuwId, vandaag, algemeen, configDoc, spamCheck, actieveLeden, inschrijving } from "./publiek.js";

// Openbare banketinschrijving: komt rechtstreeks in Administratie › Banket, met online betaling.
async function info(sb) {
  const A = await algemeen(sb);
  const c = await configDoc(sb, "banket");
  const ins = inschrijving(c, A.jaar + "-12-01");
  return { ...A, prijs: Number(c.prijs) || 65, kortingAan: !!c.kortingAan, deadline: ins.totTekst.replace(/ \d{4}$/, ""), online: bcConfigured(), open: ins.open, tot: ins.tot, totTekst: ins.totTekst, gesloten: ins.gesloten };
}
/* korting volgens het puntensysteem: status uit de punten van het vorige jaar (zie status.js) */
export async function banketPrijs(sb, I, lidId) {
  const basis = I.prijs;
  if (!I.kortingAan || !lidId) return { prijs: basis, basis, status: null, korting: 0 };
  const S = await lidStatus(sb, lidId, I.jaar);
  return { prijs: Math.round(basis * (100 - S.korting)) / 100, basis, status: S.status, korting: S.korting, punten: S.punten, puntenJaar: S.puntenJaar };
}
const menu = v => /veg/i.test(String(v || "")) ? "Vegetarisch" : "Normaal";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const sb = admin();
    if (req.method === "GET") {
      const I = await info(sb), lidId = String(req.query?.lid || "");
      if (!lidId) return res.status(200).json(I);
      if (!(await actieveLeden(sb, I.jaar)).some(l => l.id === lidId)) throw httpErr(404, "Lid niet gevonden.");
      const P = await banketPrijs(sb, I, lidId);
      return res.status(200).json({ prijs: P.prijs, basis: P.basis, status: P.status, korting: P.korting, puntenJaar: P.puntenJaar || null });
    }
    if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");
    const b = body(req);
    if (await spamCheck(sb, "banket", b, httpErr)) return res.status(200).json({ ok: true });
    const I = await info(sb);
    if (!I.open) throw httpErr(403, "De inschrijvingen voor het banket zijn afgesloten.");
    const lidRij = (await actieveLeden(sb, I.jaar)).find(l => l.id === String(b.lidId || ""));
    if (!lidRij) throw httpErr(400, "Kies je naam uit de lijst van leden.");
    const naam = lidRij.naam, personen = Number(b.personen) === 2 ? 2 : 1;
    if (!b.menu1) throw httpErr(400, "Kies je menu.");
    if (personen === 2 && !b.menu2) throw httpErr(400, "Kies het menu voor je partner.");
    const P = await banketPrijs(sb, I, lidRij.id);
    const teBetalen = Math.round(personen * P.prijs * 100) / 100;
    const token = I.online ? crypto.randomBytes(18).toString("base64url") : null;
    const id = nieuwId("web");
    const d = {
      jaar: I.jaar, bron: "formulier", ingediend: vandaag(), aangemeld: new Date().toISOString(), nieuw: true,
      naam, lidId: lidRij.id, personen, menu1: menu(b.menu1), menu2: personen === 2 ? menu(b.menu2) : "", opmerking: clean(b.opmerking, 400),
      betaald: null, teBetalen, prijsPP: P.prijs, ...(P.status ? { status: P.status, korting: P.korting } : {}), ...(token ? { betaalToken: token } : {}),
    };
    const { error } = await sb.from("banket").insert({ id, data: d });
    if (error) throw error;
    const mededeling = `${naam} Banket ${I.jaar}`;
    let qr = null;
    try { qr = qrSvg(epcPayload({ naam: I.vereniging, iban: I.rekeningnummer, bedrag: teBetalen, mededeling })); } catch (e) { console.error("QR", e); }
    let online = null;
    if (token) {
      try {
        const bt = await startBetaling(sb, req, "banket", { id, data: d }, { bedrag: teBetalen, jaar: I.jaar });
        online = { t: "banket", id, token, deeplink: bt.deeplink, qrcode: bt.qrcode, checkout: bt.checkout, verlooptOp: bt.verlooptOp, provider: bt.provider || null };
      } catch (e) { console.error("Bancontact", e); }
    }
    // bevestigingsmail: bij online betalen wachten op de uitkomst, anders meteen (met de gegevens om over te schrijven)
    try { if (online) await wachtOpBetaling(sb, "banket", id); else await stuurBevestiging(sb, "banket", id); } catch (e) { console.error("bevestiging", e); }
    res.status(200).json({ ok: true, jaar: I.jaar, bedrag: teBetalen, prijsPP: P.prijs, status: P.status, korting: P.korting, basis: P.basis, rekeningnummer: I.rekeningnummer, begunstigde: I.vereniging, mededeling, qr, online, personen, deadline: I.deadline, naam, voornaam: lidRij.voornaam || "" });
  } catch (e) { sendError(res, e); }
}
