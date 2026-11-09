import crypto from "node:crypto";
import { admin, httpErr, sendError, requireUser } from "./sb.js";
import { clean, body, configDoc, algemeen, spamCheck, rateLimit, DEF_IBAN } from "./publiek.js";
import { adresVolledig, ADRES_FOUT } from "./adrescheck.js";
import { onlineConfigured } from "./betaalprovider.js";
import { smtpConfigured, afzender, verstuur } from "./smtp.js";
import { huisstijl, kaderBlok, knop, tabel, rij, p, esc, eur, site } from "./bevestiging.js";
import { epcPayload, qrSvg } from "./epc.js";
import { meldPush } from "./push.js";

/* ============ Webshop VBHA ============
   shop_items: {naam, prijs, beschrijving, gewicht (gram), voorraad (leeg = onbeperkt), actief, volgorde, afbeeldingen:[id], hoofd: id}
     afbeeldingen staan in de tabel "beelden" (id "shop-…", data {mime, web: base64}).
   shop_orders: {nr, jaar, items:[{id, naam, prijs, aantal, gewicht}], subtotaal, verzendkost, totaal, gewicht, levering: post|afhalen,
     betaalwijze: bancontact|overschrijving|cash, klant:{voornaam, naam, email, telefoon, adres}, opmerking, status: nieuw|betaald|verzonden|klaar|afgehaald|geannuleerd,
     betaald (bool), betaling, betaalToken, aangemeld, mail:{bevestiging, ...}}
   config "shop": {open, naam, intro, afhaaladres, verpakking (g), gratisVanaf, tarieven:[{tot (g), prijs}], info} */

export const SHOP_DEF = { open: false, naam: "VBHA webshop", intro: "Steun de Vriendenkring Brandweer Aalst met een patch of ander aandenken.", afhaaladres: "Kazerne Brandweer Aalst, Vrijheidstraat, 9300 Aalst", verpakking: 20, gratisVanaf: 0,
  tarieven: [{ tot: 100, prijs: 2.5, naam: "Brief (1 zegel)" }, { tot: 350, prijs: 4.5, naam: "Brief (2 zegels)" }, { tot: 2000, prijs: 9, naam: "Pakje tot 2 kg" }, { tot: 5000, prijs: 12, naam: "Pakje tot 5 kg" }, { tot: 10000, prijs: 16, naam: "Pakje tot 10 kg" }] };
const rond = n => Math.round(n * 100) / 100;
export async function shopCfg(sb) {
  const c = { ...SHOP_DEF, ...(await configDoc(sb, "shop")) };
  c.tarieven = (Array.isArray(c.tarieven) && c.tarieven.length ? c.tarieven : SHOP_DEF.tarieven).map(t => ({ tot: Math.max(1, Number(t.tot) || 0), prijs: Math.max(0, Number(t.prijs) || 0), naam: String(t.naam || "") })).sort((a, b) => a.tot - b.tot);
  c.verpakking = Math.max(0, Number(c.verpakking) || 0); c.gratisVanaf = Math.max(0, Number(c.gratisVanaf) || 0);
  return c;
}
export function verzendkost(c, gewicht, subtotaal) {
  if (c.gratisVanaf && subtotaal >= c.gratisVanaf) return { prijs: 0, naam: "Gratis verzending" };
  const g = gewicht + c.verpakking, t = c.tarieven.find(x => g <= x.tot);
  return t ? { prijs: t.prijs, naam: t.naam || `tot ${t.tot} g` } : null;
}
async function items(sb) {
  const { data, error } = await sb.from("shop_items").select("id,data"); if (error) throw error;
  return (data || []).map(r => ({ id: r.id, ...r.data })).filter(i => i.actief !== false && i.naam && Number(i.prijs) > 0)
    .sort((a, b) => (Number(a.volgorde) || 0) - (Number(b.volgorde) || 0) || String(a.naam).localeCompare(String(b.naam), "nl"));
}
const pubItem = i => ({ id: i.id, naam: i.naam, prijs: Number(i.prijs), beschrijving: i.beschrijving || "", gewicht: Number(i.gewicht) || 0, hoofd: i.hoofd || (i.afbeeldingen || [])[0] || null, afbeeldingen: i.afbeeldingen || [], uitverkocht: i.voorraad !== "" && i.voorraad != null && Number(i.voorraad) <= 0, voorraad: i.voorraad !== "" && i.voorraad != null ? Number(i.voorraad) : null });
const imgUrl = id => `${site()}/api/shop?img=${encodeURIComponent(id)}`;
const orderUrl = (id, t) => `${site()}/shop?b=${encodeURIComponent(id)}&t=${encodeURIComponent(t)}`;
const mededeling = d => `Webshop ${d.nr} ${d.klant.naam}`.slice(0, 140);
async function volgNr(sb, jaar) {
  const { data } = await sb.from("shop_orders").select("data->>nr").eq("data->>jaar", String(jaar));
  let max = 0; for (const r of data || []) { const m = String(r.nr || "").match(/-(\d+)$/); if (m) max = Math.max(max, +m[1]); }
  return `W${jaar}-${String(max + 1).padStart(3, "0")}`;
}

/* ---------- openbaar: /api/shop ---------- */
export default async function shopPubliek(req, res) {
  try {
    const sb = admin(), q = req.query || {};
    if (req.method === "GET" && q.img) {
      const id = String(q.img); if (!/^shop-[\w-]{4,60}$/.test(id)) throw httpErr(404, "Niet gevonden");
      const { data } = await sb.from("beelden").select("data").eq("id", id).maybeSingle(); if (!data || !data.data || !data.data.web) throw httpErr(404, "Niet gevonden");
      res.setHeader("Content-Type", data.data.mime || "image/jpeg"); res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.status(200).send(Buffer.from(data.data.web, "base64"));
    }
    res.setHeader("Cache-Control", "no-store");
    const c = await shopCfg(sb), A = await algemeen(sb);
    if (req.method === "GET" && q.b) {
      await rateLimit(sb, req, "shopb", 120, 600, httpErr);
      const { data: r } = await sb.from("shop_orders").select("id,data").eq("id", String(q.b)).maybeSingle();
      if (!r || r.data.betaalToken !== String(q.t || "")) throw httpErr(404, "Bestelling niet gevonden.");
      const d = r.data;
      return res.status(200).json({ nr: d.nr, status: d.status, betaald: !!d.betaald, items: d.items, subtotaal: d.subtotaal, verzendkost: d.verzendkost, totaal: d.totaal, levering: d.levering, betaalwijze: d.betaalwijze, voornaam: d.klant.voornaam,
        ...(d.betaalwijze === "overschrijving" && !d.betaald ? { iban: A.rekeningnummer || DEF_IBAN, begunstigde: A.vereniging, mededeling: mededeling(d), qr: qrSvg(epcPayload({ naam: A.vereniging, iban: A.rekeningnummer || DEF_IBAN, bedrag: d.totaal, mededeling: mededeling(d) })) } : {}) });
    }
    if (req.method === "GET") {
      return res.status(200).json({ open: c.open !== false, naam: c.naam, intro: c.intro, info: c.info || "", afhaaladres: c.afhaaladres, verpakking: c.verpakking, gratisVanaf: c.gratisVanaf, tarieven: c.tarieven, online: onlineConfigured(), items: (await items(sb)).map(pubItem) });
    }
    if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");

    // ---- bestellen ----
    const b = body(req);
    if (await spamCheck(sb, "shop_orders", b, httpErr)) return res.status(200).json({ ok: true });
    await rateLimit(sb, req, "shop", 15, 3600, httpErr);
    if (c.open === false) throw httpErr(403, "De webshop is momenteel gesloten.");
    const klant = { voornaam: clean(b.voornaam, 80), naam: clean(b.naam, 80), email: clean(b.email, 120).toLowerCase(), telefoon: clean(b.telefoon, 40), adres: clean(b.adres, 200) };
    if (!klant.voornaam || !klant.naam) throw httpErr(400, "Vul je voornaam en naam in.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(klant.email)) throw httpErr(400, "Dit e-mailadres lijkt niet te kloppen.");
    if (klant.telefoon.replace(/\D/g, "").length < 8) throw httpErr(400, "Vul een geldig telefoonnummer in.");
    if (!adresVolledig(klant.adres)) throw httpErr(400, ADRES_FOUT);
    const levering = b.levering === "afhalen" ? "afhalen" : "post";
    const betaalwijze = ["bancontact", "overschrijving", "cash"].includes(b.betaalwijze) ? b.betaalwijze : "";
    if (!betaalwijze) throw httpErr(400, "Kies hoe je betaalt.");
    if (betaalwijze === "cash" && levering !== "afhalen") throw httpErr(400, "Cash betalen kan enkel bij afhalen in de kazerne.");
    if (betaalwijze === "bancontact" && !onlineConfigured()) throw httpErr(400, "Bancontact is momenteel niet beschikbaar. Kies overschrijving.");
    const alle = new Map((await items(sb)).map(i => [i.id, i])), want = b.items || {};
    const lijn = [];
    for (const [id, n] of Object.entries(want)) {
      const i = alle.get(id), aantal = Math.floor(Number(n)) || 0; if (!i || aantal <= 0) continue;
      if (aantal > 50) throw httpErr(400, "Maximaal 50 stuks per artikel.");
      if (i.voorraad !== "" && i.voorraad != null && aantal > Number(i.voorraad)) throw httpErr(409, Number(i.voorraad) > 0 ? `Van ${i.naam} zijn er nog maar ${i.voorraad} beschikbaar.` : `${i.naam} is uitverkocht.`);
      lijn.push({ id, naam: i.naam, prijs: Number(i.prijs), aantal, gewicht: Number(i.gewicht) || 0 });
    }
    if (!lijn.length) throw httpErr(400, "Je winkelmandje is leeg.");
    const subtotaal = rond(lijn.reduce((n, l) => n + l.prijs * l.aantal, 0)), gewicht = lijn.reduce((n, l) => n + l.gewicht * l.aantal, 0);
    let vk = { prijs: 0, naam: "Afhalen in de kazerne" };
    if (levering === "post") { vk = verzendkost(c, gewicht, subtotaal); if (!vk) throw httpErr(400, "Deze bestelling is te zwaar om op te sturen. Kies afhalen of neem contact op via info@vbha.be."); }
    const totaal = rond(subtotaal + vk.prijs);
    if (b.totaal != null && Math.abs(Number(b.totaal) - totaal) > 0.001) throw httpErr(409, "De prijzen werden intussen aangepast. Herlaad de pagina.");
    const jaar = Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric" }).format(new Date()));
    const id = "w" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex"), token = crypto.randomBytes(18).toString("base64url");
    const d = { nr: await volgNr(sb, jaar), jaar, items: lijn, subtotaal, verzendkost: vk.prijs, verzendNaam: vk.naam, totaal, gewicht, levering, betaalwijze, klant, opmerking: clean(b.opmerking, 500),
      status: "nieuw", betaald: false, betaalToken: token, bron: "formulier", aangemeld: new Date().toISOString(), nieuw: true };
    const { error } = await sb.from("shop_orders").insert({ id, data: d }); if (error) throw error;
    // voorraad verminderen
    for (const l of lijn) { const i = alle.get(l.id); if (i.voorraad !== "" && i.voorraad != null) { const { id: _x, ...rest } = i; await sb.from("shop_items").update({ data: { ...rest, voorraad: Math.max(0, Number(i.voorraad) - l.aantal) } }).eq("id", l.id); } }
    try { await meldPush(sb, "iedereen", { titel: "Nieuwe bestelling webshop", tekst: `${d.nr} · ${klant.voornaam} ${klant.naam} · ${eur(totaal)} · ${levering === "post" ? "verzenden" : "afhalen"} · ${betaalwijze}`, url: "/#webshop", tag: "shop-" + id }); } catch (e) { console.error("shop push", e); }
    let online = null;
    if (betaalwijze === "bancontact") {
      const { startBetaling } = await import("./betaal.js");
      try { const bt = await startBetaling(sb, req, "shop_orders", { id, data: d }, { bedrag: totaal, jaar, terug: "/shop?betaling=terug" }); online = { t: "shop_orders", id, token, deeplink: bt.deeplink, qrcode: bt.qrcode, checkout: bt.checkout, verlooptOp: bt.verlooptOp }; }
      catch (e) { console.error("shop betaling", e); }
    } else { try { await shopMail(sb, id, "bevestiging"); } catch (e) { console.error("shop mail", e); } }
    res.status(200).json({ ok: true, id, token, nr: d.nr, totaal, betaalwijze, levering, online, voornaam: klant.voornaam });
  } catch (e) { sendError(res, e); }
}

/* ---------- mails ---------- */
export async function shopMail(sb, id, soort) {
  if (!smtpConfigured()) return false;
  const { data: r } = await sb.from("shop_orders").select("id,data").eq("id", id).maybeSingle(); if (!r) return false;
  const d = r.data, c = await shopCfg(sb), A = await algemeen(sb), iban = A.rekeningnummer || DEF_IBAN;
  const lijnen = tabel([...d.items.map(l => rij(`${l.aantal} × ${l.naam}`, eur(l.prijs * l.aantal))), rij(d.levering === "post" ? "Verzending met bpost" : "Afhalen in de kazerne", d.verzendkost ? eur(d.verzendkost) : "gratis"), rij("Totaal", `<b>${eur(d.totaal)}</b>`)]);
  const lev = d.levering === "post" ? `We sturen je bestelling met bpost naar:<br><b>${esc(d.klant.adres)}</b>` : `Je haalt je bestelling af in de kazerne (${esc(c.afhaaladres)}). We nemen contact met je op om een moment af te spreken.`;
  let ond, html;
  if (soort === "bevestiging") {
    const bet = d.betaald ? kaderBlok("&#10003; Betaling ontvangen", p(`We ontvingen je betaling van <b>${eur(d.totaal)}</b>.`, "margin:0"), "#1a7f45", "#f1faf4")
      : d.betaalwijze === "cash" ? kaderBlok("Betalen bij afhalen", p(`Je betaalt <b>${eur(d.totaal)}</b> cash wanneer je de bestelling afhaalt.`, "margin:0"))
      : kaderBlok("Nog te betalen", tabel([rij("Bedrag", `<b>${eur(d.totaal)}</b>`), rij("Rekening", `<b>${esc(iban)}</b>`), rij("Begunstigde", esc(A.vereniging)), rij("Mededeling", `<b>${esc(mededeling(d))}</b>`)])
        + p("We verwerken je bestelling zodra je betaling binnen is.", "margin:10px 0 0;font-size:13.5px;color:#666666"), "#b30000", "#fdf2f2") + knop("Betaalgegevens en QR-code bekijken", orderUrl(r.id, d.betaalToken));
    ond = `Je bestelling ${d.nr} bij de VBHA webshop`;
    html = p(`Beste ${esc(d.klant.voornaam)},`) + p(`Bedankt voor je bestelling! Hieronder vind je een overzicht.`) + kaderBlok(`Bestelling ${esc(d.nr)}`, lijnen) + bet + p(lev) + (d.opmerking ? p(`<i>Jouw opmerking: ${esc(d.opmerking)}</i>`, "margin:0 0 15px;color:#666666") : "") + (c.info ? p(esc(c.info), "margin:0 0 15px;font-size:13.5px;color:#666666") : "");
  } else if (soort === "verzonden") {
    ond = `Je bestelling ${d.nr} is verzonden`; html = p(`Beste ${esc(d.klant.voornaam)},`) + p(`Goed nieuws: je bestelling <b>${esc(d.nr)}</b> is vandaag met bpost verzonden naar ${esc(d.klant.adres)}.`) + kaderBlok(`Bestelling ${esc(d.nr)}`, lijnen) + p("Bedankt voor je steun aan de Vriendenkring!");
  } else if (soort === "klaar") {
    ond = `Je bestelling ${d.nr} ligt klaar`; html = p(`Beste ${esc(d.klant.voornaam)},`) + p(`Je bestelling <b>${esc(d.nr)}</b> ligt klaar in de kazerne (${esc(c.afhaaladres)}). We nemen contact met je op om een moment af te spreken${d.betaalwijze === "cash" && !d.betaald ? `; je betaalt dan <b>${eur(d.totaal)}</b> cash` : ""}.`) + kaderBlok(`Bestelling ${esc(d.nr)}`, lijnen);
  } else return false;
  const [x] = await verstuur([{ aan: d.klant.email, aanNaam: `${d.klant.voornaam} ${d.klant.naam}`, onderwerp: ond, html: huisstijl(html, A.vereniging), van: afzender() }]);
  if (x && x.ok) { const { data: n } = await sb.from("shop_orders").select("data").eq("id", id).maybeSingle(); await sb.from("shop_orders").update({ data: { ...n.data, mail: { ...(n.data.mail || {}), [soort]: new Date().toISOString() } } }).eq("id", id); }
  return !!(x && x.ok);
}
export async function shopBetaald(sb, id) {
  const { data: r } = await sb.from("shop_orders").select("id,data").eq("id", id).maybeSingle(); if (!r || r.data.betaald) return;
  const d = r.data;
  const { data: upd } = await sb.from("shop_orders").update({ data: { ...d, betaald: true, betaaldOp: (d.betaling && d.betaling.betaaldOp) || new Date().toISOString(), status: d.status === "nieuw" ? "betaald" : d.status } }).eq("id", id).eq("data->>betaald", "false").select("id");
  if (!upd || !upd.length) return;
  try { await shopMail(sb, id, "bevestiging"); } catch (e) { console.error("shop mail", e); }
}
// geplande taak: lopende Bancontact-betalingen nakijken; na 20 minuten zonder betaling: bevestiging met overschrijving
export async function shopCron(sb) {
  const { data } = await sb.from("shop_orders").select("id,data").eq("data->>betaalwijze", "bancontact").eq("data->>betaald", "false").eq("data->>status", "nieuw").limit(30);
  const { controleerBetaling } = await import("./betaal.js"); let n = 0;
  for (const r of data || []) {
    try {
      const st = r.data.betaling && r.data.betaling.id ? await controleerBetaling(sb, "shop_orders", r) : null;
      if (st && st.status === "SUCCEEDED") { await shopBetaald(sb, r.id); n++; continue; }
      if (!(r.data.mail && r.data.mail.bevestiging) && Date.now() - Date.parse(r.data.aangemeld) > 20 * 60000) {
        await sb.from("shop_orders").update({ data: { ...r.data, betaalwijze: "overschrijving", bancontactMislukt: true } }).eq("id", r.id);
        await shopMail(sb, r.id, "bevestiging");
      }
    } catch (e) { console.error("shop cron", e); }
  }
  return { betaald: n };
}
// app: POST /api/mail?f=shop {actie:"status", id, status, mail} | {actie:"mail", id, soort}
export async function shopApi(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const { sb } = await requireUser(req, { write: true, functie: "webshop" }), b = body(req);
  const { data: r } = await sb.from("shop_orders").select("id,data").eq("id", String(b.id || "")).maybeSingle(); if (!r) throw httpErr(404, "Bestelling niet gevonden.");
  if (b.actie === "status") {
    const st = String(b.status || ""); if (!["nieuw", "betaald", "verzonden", "klaar", "afgehaald", "geannuleerd"].includes(st)) throw httpErr(400, "Onbekende status.");
    const d = { ...r.data, status: st, nieuw: false, ...(st === "betaald" || b.betaald ? { betaald: true, betaaldOp: r.data.betaaldOp || new Date().toISOString() } : {}), [`${st}Op`]: new Date().toISOString() };
    await sb.from("shop_orders").update({ data: d }).eq("id", r.id);
    let gemaild = false; if (b.mail && (st === "verzonden" || st === "klaar")) gemaild = await shopMail(sb, r.id, st);
    return res.status(200).json({ ok: true, gemaild });
  }
  if (b.actie === "mail") return res.status(200).json({ ok: await shopMail(sb, r.id, String(b.soort || "bevestiging")) });
  throw httpErr(400, "Onbekende actie.");
}
