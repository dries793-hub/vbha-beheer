import crypto from "node:crypto";
import { admin, sendError, httpErr } from "./_lib/sb.js";
import { epcPayload, qrSvg } from "./_lib/epc.js";
import { bcConfigured } from "./_lib/bancontact.js";
import { startBetaling } from "./_lib/betaal.js";
import { clean, body, nieuwId, vandaag, algemeen, configDoc, spamCheck } from "./_lib/publiek.js";

// Openbare banketinschrijving: komt rechtstreeks in Administratie › Banket, met online betaling.
async function info(sb) {
  const A = await algemeen(sb);
  const c = await configDoc(sb, "banket");
  return { ...A, prijs: Number(c.prijs) || 65, deadline: c.deadline || "1 december", online: bcConfigured() };
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
    const naam = clean(b.naam, 100), personen = Number(b.personen) === 2 ? 2 : 1;
    if (!naam) throw httpErr(400, "Vul je naam in.");
    if (!b.menu1) throw httpErr(400, "Kies je menu.");
    if (personen === 2 && !b.menu2) throw httpErr(400, "Kies het menu voor je partner.");
    const teBetalen = Math.round(personen * I.prijs * 100) / 100;
    const token = I.online ? crypto.randomBytes(18).toString("base64url") : null;
    const id = nieuwId("web");
    const d = {
      jaar: I.jaar, bron: "formulier", ingediend: vandaag(), aangemeld: new Date().toISOString(), nieuw: true,
      naam, personen, menu1: menu(b.menu1), menu2: personen === 2 ? menu(b.menu2) : "", opmerking: clean(b.opmerking, 400),
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
        online = { t: "banket", id, token, deeplink: bt.deeplink, qrcode: bt.qrcode, checkout: bt.checkout, verlooptOp: bt.verlooptOp };
      } catch (e) { console.error("Bancontact", e); }
    }
    res.status(200).json({ ok: true, jaar: I.jaar, bedrag: teBetalen, rekeningnummer: I.rekeningnummer, begunstigde: I.vereniging, mededeling, qr, online, personen, deadline: I.deadline });
  } catch (e) { sendError(res, e); }
}
