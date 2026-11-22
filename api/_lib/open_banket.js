import crypto from "node:crypto";
import { lidStatus, tegoedSaldo } from "./status.js";
import { admin, sendError, httpErr, requireUser } from "./sb.js";
import { epcPayload, qrSvg } from "./epc.js";
import { onlineConfigured as bcConfigured } from "./betaalprovider.js";
import { startBetaling } from "./betaal.js";
import { wachtOpBetaling, stuurBevestiging } from "./bevestiging.js";
import { clean, body, nieuwId, vandaag, algemeen, configDoc, spamCheck, actieveLeden, inschrijving, alIngeschreven, AL_TEKST, rateLimit } from "./publiek.js";
import { meldPush } from "./push.js";
import { kloptVul } from "./lidlink.js";

// Openbare banketinschrijving: komt rechtstreeks in Administratie › Banket, met online betaling.
async function info(sb) {
  const A = await algemeen(sb);
  const c = await configDoc(sb, "banket");
  const ins = inschrijving(c, A.jaar + "-12-01");
  return { ...A, datum: /^\d{4}-\d{2}-\d{2}$/.test(c.datum || "") ? c.datum : "", uur: String(c.uur || ""), locatie: String(c.locatie || ""), prijs: Number(c.prijs) || 65, kortingAan: !!c.kortingAan, goudMelding: !!c.kortingAan && (Number(String(c.datum || "").slice(0, 4)) || Number(A.jaar)) === 2026 /* startjaar puntensysteem: vast enkel in 2026 */, deadline: ins.totTekst.replace(/ \d{4}$/, ""), online: bcConfigured(), open: ins.open, tot: ins.tot, totTekst: ins.totTekst, gesloten: ins.gesloten };
}
/* korting volgens het puntensysteem: status uit de punten van het vorige jaar (zie status.js) */
export async function banketPrijs(sb, I, lidId) {
  const basis = I.prijs;
  if (!lidId) return { prijs: basis, basis, status: null, korting: 0, tegoed: 0 };
  const S = await lidStatus(sb, lidId, I.jaar);
  // goudtegoed (reglement 2027, art. 22): los van de kortingsinstelling te gebruiken
  const T = S.tegoed ? await tegoedSaldo(sb, lidId, I.jaar, S) : { saldo: 0 };
  if (!I.kortingAan) return { prijs: basis, basis, status: null, korting: 0, tegoed: T.saldo };
  return { prijs: Math.round(basis * (100 - S.korting)) / 100, basis, status: S.status, korting: S.korting, punten: S.punten, puntenJaar: S.puntenJaar, start: !!S.start, ere: !!S.ere, tegoed: T.saldo, viaPartner: S.viaPartner ? S.viaPartner.status : null, basisStatus: !!S.basis };
}
const menu = v => /veg/i.test(String(v || "")) ? "Vegetarisch" : "Vlees en vis";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const sb = admin();
    if (req.method === "GET") {
      const I = await info(sb), lidId = String(req.query?.lid || "");
      // persoonlijke link uit de mail: naam van het lid vooraf invullen
      if (req.query && req.query.v) {
        const v = String(req.query.v);
        if (!kloptVul("bk", v, I.jaar, String(req.query.t || ""))) return res.status(200).json(I);
        const l = (await actieveLeden(sb, I.jaar)).find(x => x.id === v); if (!l) return res.status(200).json(I);
        // keuzes van vorig jaar alvast invullen (enkel via de persoonlijke, ondertekende link)
        let vorig = null;
        try { const { data: v } = await sb.from("banket").select("data").eq("data->>jaar", String(I.jaar - 1)).eq("data->>lidId", l.id).limit(1);
          const d = v && v[0] && v[0].data; if (d) vorig = { personen: d.personen === 2 ? 2 : 1, menu1: d.menu1 || "", menu2: d.menu2 || "", opmerking1: d.opmerking1 ?? "", opmerking2: d.opmerking2 ?? "" }; } catch (e) {}
        return res.status(200).json({ ...I, vul: { lidId: l.id, lid: l.voornaam && l.an ? `${l.voornaam} ${l.an}` : l.naam, voornaam: l.voornaam || "", vorig } });
      }
      if (!lidId) return res.status(200).json(I);
      // beheer-app (herberekenen van bestaande inschrijvingen): ingelogde gebruiker, geen "al ingeschreven"-controle
      const beheer = req.query && req.query.her ? !!(await requireUser(req).catch(() => null)) : false;
      if (!beheer) await rateLimit(sb, req, "lidinfo", 60, 600, httpErr);
      if (!(await actieveLeden(sb, I.jaar)).some(l => l.id === lidId)) throw httpErr(404, "Lid niet gevonden.");
      if (!beheer && await alIngeschreven(sb, "banket", I.jaar, lidId)) return res.status(200).json({ al: true, melding: AL_TEKST("het banket", I.jaar) });
      const P = await banketPrijs(sb, I, lidId);
      return res.status(200).json({ prijs: P.prijs, basis: P.basis, status: P.status, korting: P.korting, puntenJaar: P.puntenJaar || null, start: !!P.start, ere: !!P.ere, tegoed: P.tegoed || 0, viaPartner: P.viaPartner || null, basisStatus: !!P.basisStatus });
    }
    if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");
    const b = body(req);
    await rateLimit(sb, req, "post", 20, 3600, httpErr);
    if (await spamCheck(sb, "banket", b, httpErr)) return res.status(200).json({ ok: true });
    const I = await info(sb);
    if (!I.open) throw httpErr(403, "De inschrijvingen voor het banket zijn afgesloten.");
    const lidRij = (await actieveLeden(sb, I.jaar)).find(l => l.id === String(b.lidId || ""));
    if (!lidRij) throw httpErr(400, "Kies je naam uit de lijst van leden.");
    const naam = lidRij.naam, personen = Number(b.personen) === 2 ? 2 : 1;
    if (!b.menu1) throw httpErr(400, "Kies je menu.");
    if (personen === 2 && !b.menu2) throw httpErr(400, "Kies het menu voor je partner.");
    const [al, P] = await Promise.all([alIngeschreven(sb, "banket", I.jaar, lidRij.id), banketPrijs(sb, I, lidRij.id)]);
    if (al) throw httpErr(409, AL_TEKST("het banket", I.jaar));
    const volTeBetalen = Math.round(personen * P.prijs * 100) / 100;
    // goudtegoed: het lid kiest hoeveel het gebruikt (nooit meer dan het saldo of de prijs)
    const teg = Math.max(0, Math.min(Number(String(b.tegoed || 0).replace(",", ".")) || 0, P.tegoed || 0, volTeBetalen)), tegR = Math.round(teg * 100) / 100;
    const teBetalen = Math.round((volTeBetalen - tegR) * 100) / 100;
    const token = I.online && teBetalen > 0 ? crypto.randomBytes(18).toString("base64url") : null;
    const id = nieuwId("web");
    const d = {
      jaar: I.jaar, bron: "formulier", ingediend: vandaag(), aangemeld: new Date().toISOString(), nieuw: true,
      naam, lidId: lidRij.id, personen, menu1: menu(b.menu1), menu2: personen === 2 ? menu(b.menu2) : "", opmerking1: clean(b.opmerking1 ?? b.opmerking, 300), opmerking2: personen === 2 ? clean(b.opmerking2, 300) : "",
      opmerking: [clean(b.opmerking1 ?? b.opmerking, 300) ? (personen === 2 ? "Jij: " : "") + clean(b.opmerking1 ?? b.opmerking, 300) : "", personen === 2 && clean(b.opmerking2, 300) ? "Partner: " + clean(b.opmerking2, 300) : ""].filter(Boolean).join(" · "),
      betaald: teBetalen > 0 ? null : "OK", teBetalen, prijsPP: P.prijs, ...(tegR > 0 ? { tegoed: [{ lidId: lidRij.id, bedrag: tegR }] } : {}), ...(P.status ? { status: P.status, korting: P.korting } : {}), ...(token ? { betaalToken: token } : {}),
    };
    const { error } = await sb.from("banket").insert({ id, data: d });
    if (error) throw error;
    const mededeling = `${naam} Banket ${I.jaar}`;
    let qr = null;
    try { qr = qrSvg(epcPayload({ naam: I.vereniging, iban: I.rekeningnummer, bedrag: teBetalen, mededeling })); } catch (e) { console.error("QR", e); }
    let online = null;
    // melding naar het bestuur loopt gelijktijdig met het klaarzetten van de betaling (sneller antwoord)
    const push = meldPush(sb, "iedereen", { titel: "Nieuwe inschrijving banket", tekst: `${naam} · ${d.personen === 2 ? "2 personen" : "1 persoon"}`, url: "/#banket", tag: "ins-banket-" + id, lidId: lidRij.id }).catch(() => null);
    if (token) {
      try {
        const bt = await startBetaling(sb, req, "banket", { id, data: d }, { bedrag: teBetalen, jaar: I.jaar });
        online = { t: "banket", id, token, deeplink: bt.deeplink, qrcode: bt.qrcode, checkout: bt.checkout, verlooptOp: bt.verlooptOp, provider: bt.provider || null };
      } catch (e) { console.error("Bancontact", e); }
    }
    // bevestigingsmail: bij online betalen wachten op de uitkomst, anders meteen (met de gegevens om over te schrijven)
    try { if (online) await wachtOpBetaling(sb, "banket", id); else await stuurBevestiging(sb, "banket", id); } catch (e) { console.error("bevestiging", e); }
    await push;
    res.status(200).json({ ok: true, jaar: I.jaar, bedrag: teBetalen, tegoed: tegR, prijsPP: P.prijs, status: P.status, korting: P.korting, basis: P.basis, rekeningnummer: I.rekeningnummer, begunstigde: I.vereniging, mededeling, qr, online, personen, deadline: I.deadline, naam, voornaam: lidRij.voornaam || "" });
  } catch (e) { sendError(res, e); }
}
