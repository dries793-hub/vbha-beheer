import { admin, sendError, httpErr } from "./sb.js";
import { stuurBevestiging } from "./bevestiging.js";
import { clean, body, nieuwId, algemeen, configDoc, spamCheck, actieveLeden, inschrijving, alIngeschreven, AL_TEKST, rateLimit, vandaagISO, masker } from "./publiek.js";
import { meldPush } from "./push.js";
import { kfCadeauPubliek } from "./kfcadeau.js";

/* ---------- kinderen onthouden per lid (tabel lid_kinderen, enkel via de server) ----------
   Na elke inschrijving worden de kinderen van het lid bijgehouden; wie 12 of ouder wordt, wist de nachtelijke opkuis.
   Voorinvullen gebeurt NIET op basis van enkel de naam (dan kan iedereen de kinderen van een lid zien),
   maar via een persoonlijke link die naar het e-mailadres van het lid gemaild wordt: /kinderfeest?v=<lidId>&t=<handtekening>. */
import crypto from "node:crypto";
const vSleutel = () => String(process.env.BETAAL_GEHEIM || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const vToken = (lidId, jaar) => crypto.createHmac("sha256", vSleutel()).update(`vbha-kfvul|${lidId}|${jaar}`).digest("base64url").slice(0, 22);
const vKlopt = (lidId, jaar, t) => { const a = Buffer.from(vToken(lidId, jaar)), b = Buffer.from(String(t || "")); return !!vSleutel() && a.length === b.length && crypto.timingSafeEqual(a, b); };
const nrm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
async function onthoud(sb, lidId, kinderen) {
  const { data: r } = await sb.from("lid_kinderen").select("kinderen").eq("lid_id", lidId).maybeSingle();
  const L = [...((r && r.kinderen) || [])];
  for (const k of kinderen) { const i = L.findIndex(x => nrm(x.naam) === nrm(k.naam)); if (i >= 0) L[i] = { naam: k.naam, geb: k.geb }; else L.push({ naam: k.naam, geb: k.geb }); }
  await sb.from("lid_kinderen").upsert({ lid_id: lidId, kinderen: L, bijgewerkt: new Date().toISOString() });
}
async function bekendeKinderen(sb, lidId, I) {
  const { data: r } = await sb.from("lid_kinderen").select("kinderen").eq("lid_id", lidId).maybeSingle();
  const [Y, M, D] = String(I.datum).split("-").map(Number);
  const lft = g => { const [y, m, d] = String(g).split("-").map(Number); let x = Y - y; if (M < m || (M === m && D < d)) x--; return x; };
  return ((r && r.kinderen) || []).filter(k => k.geb && lft(k.geb) >= 0 && lft(k.geb) <= I.leeftijd);
}

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
      // persoonlijke link uit de mail: lid en kinderen voorinvullen
      if (req.query && req.query.v) {
        const v = String(req.query.v);
        if (!vKlopt(v, I.jaar, req.query.t)) throw httpErr(404, "Deze link is niet (meer) geldig.");
        const l = (await actieveLeden(sb, I.jaar)).find(x => x.id === v); if (!l) throw httpErr(404, "Deze link is niet (meer) geldig.");
        return res.status(200).json({ ...I, vul: { lidId: l.id, lid: l.voornaam && l.an ? `${l.voornaam} ${l.an}` : l.naam, mail: masker(l.em), kinderen: await bekendeKinderen(sb, l.id, I) } });
      }
      if (!lidId) return res.status(200).json(I);
      await rateLimit(sb, req, "lidinfo", 60, 600, httpErr);
      const al = await alIngeschreven(sb, "kinderfeest", I.jaar, lidId);
      return res.status(200).json(al ? { al: true, melding: AL_TEKST("het kinderfeest", I.jaar) } : { al: false });
    }
    if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");
    const b = body(req);
    // naam van het lid + hetzelfde e-mailadres als bekend (bij het lid of bij een vorige inschrijving): kinderen voorinvullen
    if (b.actie === "herken") {
      await rateLimit(sb, req, "kfherken", 15, 3600, httpErr);
      const I = await info(sb), lidId = String(b.lidId || ""), em = nrm(b.email);
      if (!lidId || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(em)) return res.status(200).json({ kinderen: [] });
      const { data: lr } = await sb.from("leden").select("data").eq("id", lidId).maybeSingle();
      let ok = !!(lr && lr.data && nrm(lr.data.email) === em);
      if (!ok) { const { data: vk } = await sb.from("kinderfeest").select("data").eq("data->>lidId", lidId); ok = (vk || []).some(r => nrm(r.data && r.data.email) === em); }
      return res.status(200).json({ kinderen: ok ? await bekendeKinderen(sb, lidId, I) : [] });
    }
    // link om de kinderen van vorig jaar in te vullen, naar het e-mailadres van het lid
    if (b.actie === "vullink") {
      await rateLimit(sb, req, "kfvul", 5, 3600, httpErr);
      const I = await info(sb), lidId = String(b.lidId || "");
      const { data: lr } = await sb.from("leden").select("id,data").eq("id", lidId).maybeSingle();
      const aan = String((lr && lr.data && lr.data.email) || "").trim();
      if (lr && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(aan) && (await bekendeKinderen(sb, lidId, I)).length) {
        try {
          const { verstuur, afzender, smtpConfigured } = await import("./smtp.js");
          if (smtpConfigured()) {
            const { huisstijl } = await import("./bevestiging.js"), A = await algemeen(sb);
            const site = "https://vbha.be", url = `${site}/kinderfeest?v=${encodeURIComponent(lidId)}&t=${vToken(lidId, I.jaar)}`;
            const vn = (lr.data.voornaam || "").trim(), esc = x => String(x ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
            const html = `<p style="margin:0 0 15px">Beste ${esc(vn)},</p><p style="margin:0 0 15px">Met de knop hieronder open je de inschrijving voor het kinderfeest ${I.jaar}, met je kinderen al ingevuld.</p>
<table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 18px"><tr><td bgcolor="#C0161F" style="border-radius:8px"><a href="${esc(url)}" style="display:inline-block;padding:12px 22px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px">Kinderen invullen</a></td></tr></table>`;
            await verstuur([{ aan, aanNaam: vn, onderwerp: `VBHA - Inschrijving kinderfeest ${I.jaar}`, html: huisstijl(html, A.vereniging), van: afzender() }]);
          }
        } catch (e) { console.error("kfvul", e); }
      }
      return res.status(200).json({ ok: true }); // altijd hetzelfde antwoord: verraadt niet of er kinderen gekend zijn
    }
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
    try { await onthoud(sb, lidRij.id, kinderen); } catch (e) { console.error("onthoud", e); }
    await meldPush(sb, "iedereen", { titel: "Nieuwe inschrijving kinderfeest", tekst: `${lid} · ${kinderen.length} ${kinderen.length === 1 ? "kind" : "kinderen"}`, url: "/#kinderfeest", tag: "ins-kf-" + kid });
    try { await stuurBevestiging(sb, "kinderfeest", kid); } catch (e) { console.error("bevestiging", e); }
    // cadeaukiezer aan en nog binnen de termijn: meteen de persoonlijke keuzelink teruggeven
    let cadeau = null;
    try { const { kfcLink, kfcInstellingen, budgetVan } = await import("./kfcadeau.js"); const c = await configDoc(sb, "kf_" + I.jaar), M = kfcInstellingen(c, I.jaar);
      if (M.cadeau !== false && M.keuze === true && vandaagISO() <= M.tot && kinderen.some(k => budgetVan(k.geb, M).budget != null)) cadeau = kfcLink(kid).replace(/^https?:\/\/[^/]+/, ""); } catch (e) { console.error("kfc link", e); }
    res.status(200).json({ ok: true, ...I, kinderen, cadeau });
  } catch (e) { sendError(res, e); }
}
