import { admin, sendError, httpErr } from "./sb.js";
import { stuurBevestiging } from "./bevestiging.js";
import { clean, body, nieuwId, algemeen, configDoc, spamCheck, actieveLeden, inschrijving, alIngeschreven, AL_TEKST, rateLimit, vandaagISO } from "./publiek.js";
import { meldPush } from "./push.js";
import { kfCadeauPubliek } from "./kfcadeau.js";

// Openbare inschrijving kinderfeest: komt rechtstreeks in Administratie › Kinderfeest.
async function info(sb) {
  const A = await algemeen(sb);
  const c = await configDoc(sb, "kf_" + A.jaar);
  const ins = inschrijving(c, A.jaar + "-12-07");
  return { open: ins.open, tot: ins.tot, totTekst: ins.totTekst, gesloten: ins.gesloten, jaar: A.jaar, datum: c.datum || A.jaar + "-12-19", tijd: c.tijd || "14u30", locatie: c.locatie || "VTI - Sinte Annalaan 99b, Aalst", leeftijd: Number.isFinite(Number(c.leeftijd)) && c.leeftijd !== "" && c.leeftijd != null ? Number(c.leeftijd) : 11 };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    // cadeau kiezen via de persoonlijke link uit de bevestigingsmail
    if ((req.method === "GET" && req.query && req.query.cadeau) || (req.method === "POST" && (() => { try { return !!body(req).cadeau; } catch { return false; } })())) return await kfCadeauPubliek(req, res);
    const sb = admin();
    if (req.method === "GET") {
      const I = await info(sb), lidId = String(req.query?.lid || "");
      if (!lidId) return res.status(200).json(I);
      await rateLimit(sb, req, "lidinfo", 60, 600, httpErr);
      const al = await alIngeschreven(sb, "kinderfeest", I.jaar, lidId);
      return res.status(200).json(al ? { al: true, melding: AL_TEKST("het kinderfeest", I.jaar) } : { al: false });
    }
    if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");
    const b = body(req);
    await rateLimit(sb, req, "post", 20, 3600, httpErr);
    if (await spamCheck(sb, "kinderfeest", b, httpErr)) return res.status(200).json({ ok: true });
    const I = await info(sb);
    if (!I.open) throw httpErr(403, "De inschrijvingen voor het kinderfeest zijn afgesloten.");
    const lidRij = (await actieveLeden(sb, I.jaar)).find(l => l.id === String(b.lidId || ""));
    if (!lidRij) throw httpErr(400, "Kies de naam van het lid uit de lijst.");
    if (await alIngeschreven(sb, "kinderfeest", I.jaar, lidRij.id)) throw httpErr(409, AL_TEKST("het kinderfeest", I.jaar));
    const lid = lidRij.naam;
    // "lidMail": de inschrijver liet het bekende adres van het lid staan (dat adres krijgt de browser enkel verborgen te zien)
    const email = b.lidMail && lidRij.em ? lidRij.em : clean(b.email, 120).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw httpErr(400, "Vul een geldig e-mailadres in.");
    const kinderen = (Array.isArray(b.kinderen) ? b.kinderen : []).slice(0, 8)
      .map(k => ({ naam: clean(k && k.naam, 80), geb: /^\d{4}-\d{2}-\d{2}$/.test(String(k && k.geb)) ? String(k.geb) : "" }))
      .filter(k => k.naam);
    if (!kinderen.length) throw httpErr(400, "Voeg minstens één kind toe.");
    if (kinderen.some(k => !k.geb)) throw httpErr(400, "Vul voor elk kind een geldige geboortedatum in.");
    { const [Y, M, D] = String(I.datum).split("-").map(Number);
      const lft = g => { const [y, m, d] = g.split("-").map(Number); let x = Y - y; if (M < m || (M === m && D < d)) x--; return x; };
      const te = kinderen.find(k => lft(k.geb) > I.leeftijd);
      if (te) throw httpErr(400, `${te.naam} is op de dag van het feest al ${lft(te.geb)} jaar en kan niet meer ingeschreven worden.`); }
    const d = { jaar: I.jaar, lid, lidId: lidRij.id, email, opmerking: clean(b.opmerking, 400), kinderen, bron: "formulier", aangemeld: new Date().toISOString(), nieuw: true };
    const kid = nieuwId("web");
    const { error } = await sb.from("kinderfeest").insert({ id: kid, data: d });
    if (error) throw error;
    await meldPush(sb, "iedereen", { titel: "Nieuwe inschrijving kinderfeest", tekst: `${lid} · ${kinderen.length} ${kinderen.length === 1 ? "kind" : "kinderen"}`, url: "/#kinderfeest", tag: "ins-kf-" + kid });
    try { await stuurBevestiging(sb, "kinderfeest", kid); } catch (e) { console.error("bevestiging", e); }
    // cadeaukiezer aan en nog binnen de termijn: meteen de persoonlijke keuzelink teruggeven
    let cadeau = null;
    try { const { kfcLink, kfcInstellingen, budgetVan } = await import("./kfcadeau.js"); const c = await configDoc(sb, "kf_" + I.jaar), M = kfcInstellingen(c, I.jaar);
      if (M.cadeau !== false && M.keuze === true && vandaagISO() <= M.tot && kinderen.some(k => budgetVan(k.geb, M).budget != null)) cadeau = kfcLink(kid).replace(/^https?:\/\/[^/]+/, ""); } catch (e) { console.error("kfc link", e); }
    res.status(200).json({ ok: true, ...I, kinderen, cadeau });
  } catch (e) { sendError(res, e); }
}
