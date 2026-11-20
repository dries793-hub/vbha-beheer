import crypto from "node:crypto";
import { lidStatus, tegoedSaldo } from "./status.js";
import { admin, sendError, httpErr } from "./sb.js";
import { epcPayload, qrSvg } from "./epc.js";
import { onlineConfigured as bcConfigured } from "./betaalprovider.js";
import { startBetaling } from "./betaal.js";
import { wachtOpBetaling, stuurBevestiging } from "./bevestiging.js";
import { clean, body, nieuwId, vandaag, algemeen, configDoc, spamCheck, actieveLeden, inschrijving, alIngeschreven, AL_TEKST, rateLimit } from "./publiek.js";
import { meldPush } from "./push.js";
import { kloptVul } from "./lidlink.js";

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
/* reglement 2027: korting volgens de status (art. 20, vanaf statusjaar 2028) voor de gezinsleden op de inschrijving, gasten betalen de volle prijs (art. 21.3);
   goudtegoed (art. 22) als extra korting */
async function fdVoordeel(sb, I, lidId) {
  if (!lidId) return { korting: 0, status: null, tegoed: 0 };
  const S = await lidStatus(sb, lidId, I.jaar), T = S.tegoed ? await tegoedSaldo(sb, lidId, I.jaar, S) : { saldo: 0 };
  return { korting: S.cfgVorig && S.cfgVorig.nieuw ? S.korting : 0, status: S.cfgVorig && S.cfgVorig.nieuw ? S.status : null, basisStatus: !!S.basis, viaPartner: S.viaPartner ? S.viaPartner.status : null, tegoed: T.saldo };
}
const geldigMail = a => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(a);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const sb = admin();
    if (req.method === "GET") {
      const I = await fdInfo(sb), lidId = String(req.query?.lid || "");
      // persoonlijke link uit de mail: het lid staat vast, geen naam of e-mailadres meer in te vullen
      if (req.query && req.query.v) {
        const v = String(req.query.v);
        if (!kloptVul("fd", v, I.jaar, String(req.query.t || ""))) return res.status(200).json(I);
        const l = (await actieveLeden(sb, I.jaar)).find(x => x.id === v); if (!l) return res.status(200).json(I);
        // aantallen van vorig jaar alvast invullen (enkel via de persoonlijke, ondertekende link)
        let vorig = null;
        try { const { data: v } = await sb.from("familiedag").select("data").eq("data->>jaar", String(I.jaar - 1)).eq("data->>lidId", l.id).limit(1);
          const d = v && v[0] && v[0].data; if (d) { const a = {}; for (const x of d.lijnen || []) if (x && x.id && I.prijzen.some(p => p.id === x.id)) a[x.id] = Number(x.aantal) || 0; vorig = { aantallen: a, gasten: d.gasten || {}, opmerking: d.opmerking || "" }; } } catch (e) {}
        return res.status(200).json({ ...I, vul: { lidId: l.id, lid: l.voornaam && l.an ? `${l.voornaam} ${l.an}` : l.naam, voornaam: l.voornaam || "", vorig } });
      }
      if (!lidId) return res.status(200).json(I);
      await rateLimit(sb, req, "lidinfo", 60, 600, httpErr);
      if (!(await actieveLeden(sb, I.jaar)).some(l => l.id === lidId)) throw httpErr(404, "Lid niet gevonden.");
      if (await alIngeschreven(sb, "familiedag", I.jaar, lidId)) return res.status(200).json({ al: true, melding: AL_TEKST("de familiedag", I.jaar) });
      const V = await fdVoordeel(sb, I, lidId);
      return res.status(200).json({ ok: true, ...V });
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
    // korting voor het gezin (gasten volle prijs) en goudtegoed
    const V = await fdVoordeel(sb, I, lidId);
    const gasten = {}; let gezin = 0;
    for (const l of B.lijnen) { const g = Math.max(0, Math.min(l.aantal, parseInt(b.gasten && b.gasten[l.id], 10) || 0)); if (g) gasten[l.id] = g; gezin += (l.aantal - g) * l.prijs; }
    const kortingBedrag = V.korting > 0 ? Math.round(gezin * V.korting) / 100 : 0;
    const naKorting = Math.round((B.totaal - kortingBedrag) * 100) / 100;
    const teg = Math.round(Math.max(0, Math.min(Number(String(b.tegoed || 0).replace(",", ".")) || 0, V.tegoed || 0, naKorting)) * 100) / 100;
    B.vol = B.totaal; B.totaal = Math.round((naKorting - teg) * 100) / 100;
    const token = I.online && B.totaal > 0 ? crypto.randomBytes(18).toString("base64url") : null;
    const id = nieuwId("fd");
    const d = { jaar: I.jaar, bron: "formulier", ingediend: vandaag(), aangemeld: new Date().toISOString(), nieuw: true, naam, lidId, email, lijnen: B.lijnen, personen: B.personen,
      opmerking: clean(b.opmerking, 400), teBetalen: B.totaal, betaald: null,
      ...(kortingBedrag > 0 ? { status: V.status, korting: V.korting, kortingBedrag, volPrijs: B.vol, ...(Object.keys(gasten).length ? { gasten } : {}) } : {}), ...(teg > 0 ? { tegoed: [{ lidId, bedrag: teg }] } : {}), ...(token ? { betaalToken: token } : {}) };
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
    await meldPush(sb, "iedereen", { titel: "Nieuwe inschrijving familiedag", tekst: `${naam} · ${B.personen} ${B.personen === 1 ? "persoon" : "personen"}`, url: "/#familiedag", tag: "ins-fd-" + id, lidId }).catch(() => {});
    try { if (online) await wachtOpBetaling(sb, "familiedag", id); else await stuurBevestiging(sb, "familiedag", id); } catch (e) { console.error("bevestiging", e); }
    res.status(200).json({ ok: true, jaar: I.jaar, voornaam, bedrag: B.totaal, kortingBedrag, tegoed: teg, lijnen: B.lijnen, personen: B.personen, rekeningnummer: B.totaal > 0 ? I.rekeningnummer : null, begunstigde: I.vereniging, mededeling, qr, online, deadline: I.totTekst });
  } catch (e) { sendError(res, e); }
}
