import crypto from "node:crypto";
import { admin, sendError, httpErr } from "./sb.js";
import { epcPayload, qrSvg } from "./epc.js";
import { onlineConfigured as bcConfigured } from "./betaalprovider.js";
import { startBetaling } from "./betaal.js";
import { clean, body, nieuwId, vandaag, algemeen, configDoc, spamCheck, actieveLeden, inschrijving } from "./publiek.js";

// Openbare banketinschrijving: komt rechtstreeks in Administratie › Banket, met online betaling.
async function info(sb) {
  const A = await algemeen(sb);
  const c = await configDoc(sb, "banket");
  const ins = inschrijving(c, A.jaar + "-12-01");
  return { ...A, prijs: Number(c.prijs) || 65, deadline: ins.totTekst.replace(/ \d{4}$/, ""), online: bcConfigured(), open: ins.open, tot: ins.tot, totTekst: ins.totTekst, gesloten: ins.gesloten };
}
const menu = v => /veg/i.test(String(v || "")) ? "Vegetarisch" : "Normaal";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const sb = admin();
    if (req.method === "GET") return res.status(200).json(await info(sb));
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
    const teBetalen = Math.round(personen * I.prijs * 100) / 100;
    const token = I.online ? crypto.randomBytes(18).toString("base64url") : null;
    const id = nieuwId("web");
    const d = {
      jaar: I.jaar, bron: "formulier", ingediend: vandaag(), aangemeld: new Date().toISOString(), nieuw: true,
      naam, lidId: lidRij.id, personen, menu1: menu(b.menu1), menu2: personen === 2 ? menu(b.menu2) : "", opmerking: clean(b.opmerking, 400),
      betaald: null, teBetalen, ...(token ? { betaalToken: token } : {}),
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
    res.status(200).json({ ok: true, jaar: I.jaar, bedrag: teBetalen, rekeningnummer: I.rekeningnummer, begunstigde: I.vereniging, mededeling, qr, online, personen, deadline: I.deadline, naam, voornaam: lidRij.voornaam || "" });
  } catch (e) { sendError(res, e); }
}
