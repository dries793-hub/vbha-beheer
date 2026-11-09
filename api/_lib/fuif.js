import crypto from "node:crypto";
import { admin, httpErr, sendError, requireUser } from "./sb.js";
import { clean, body, norm, algemeen, configDoc, spamCheck, rateLimit, zoekLeden, vandaagISO } from "./publiek.js";
import { adresVolledig, ADRES_FOUT } from "./adrescheck.js";
import { onlineConfigured } from "./betaalprovider.js";
import { smtpConfigured, afzender, verstuur } from "./smtp.js";
import { huisstijl, kaderBlok, knop, tabel, rij, p, esc, eur, lang, site } from "./bevestiging.js";
import { Pdf } from "./pdf.js";
import { LOGO } from "./logo_pdf.js";
import { qrMatrix } from "./epc.js";
import { qrPng } from "./png.js";
import { meldPush } from "./push.js";

/* ============ Fuif "In Vier en Vlam": online tickets ============
   Tabel "tickets": één rij per bestelling
     data {jaar, naam, voornaam, adres, email, telefoon, aantal, prijs, bedrag, via:{tekst, lidId, naam}, bron:"formulier",
           aangemeld, betaalToken, betaling, status: wacht|betaald|verlopen|geannuleerd, betaaldOp,
           tickets:[{code, nr, gescand:{op, door}|null}], punten:{lidId, jaar, aantal}, mail:{op, aan}}
   Config "fuif": naam, datum, deuren, locatie, prijs, open, max (0 = onbeperkt), perBestelling, info.
   Een ticket-QR bevat de link <site>/ticket?c=<code>; de scanner in de app leest de code uit die link.
   Punten: kies je bij de aankoop een lid, dan krijgt dat lid per betaald ticket een "kaart" in het puntensysteem (jaarleden.kaarten). */

export const FUIF_DEF = { sponsorTickets: 10, sponsorDrank: 50, naam: "In Vier en Vlam", datum: "", deuren: "", locatie: "", prijs: 5, open: true, max: 0, perBestelling: 10, info: "", drankAan: true, drank: [20, 50], drankKorting: 10 };
const CODE_ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const nieuweCode = () => { const b = crypto.randomBytes(12); let s = ""; for (const x of b) s += CODE_ABC[x % 32]; return s; };
const CODE_RE = /^[A-Z2-9]{12}$/;
export const codeUit = s => { const m = String(s || "").toUpperCase().match(/(?:[?&]C=)?([A-Z2-9]{12})(?![A-Z2-9])/); return m ? m[1] : ""; };
const geld = n => "€ " + Number(n || 0).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function fuifCfg(sb) {
  const c = { ...FUIF_DEF, ...(await configDoc(sb, "fuif")) }, A = await algemeen(sb);
  c.prijs = Math.max(0, Number(c.prijs) || 0); c.max = Math.max(0, Number(c.max) || 0); c.perBestelling = Math.min(50, Math.max(1, Number(c.perBestelling) || 10));
  c.jaar = Number(String(c.datum || "").slice(0, 4)) || A.jaar;
  c.drankKorting = Math.min(90, Math.max(0, Number(c.drankKorting) || 0));
  c.dranken = c.drankAan === false ? [] : [...new Set((Array.isArray(c.drank) ? c.drank : []).map(Number).filter(v => v > 0 && v <= 500))].sort((a, b) => a - b)
    .map(v => ({ id: "d" + String(v).replace(/\D/g, ""), waarde: v, prijs: Math.round(v * (100 - c.drankKorting)) / 100 }));
  return { c, A };
}
async function bestellingen(sb, jaar) {
  const out = [];
  for (let from = 0; ; from += 1000) { const { data, error } = await sb.from("tickets").select("id,data").eq("data->>jaar", String(jaar)).range(from, from + 999); if (error) throw error; out.push(...data); if (data.length < 1000) break; }
  return out;
}
// verkocht + (nog lopende betalingen van de laatste 15 minuten, die houden plaatsen vast)
async function bezet(sb, jaar) {
  const L = await bestellingen(sb, jaar), grens = new Date(Date.now() - 15 * 60000).toISOString();
  return L.reduce((n, r) => n + (r.data.status === "betaald" || (r.data.status === "wacht" && String(r.data.aangemeld || "") > grens) ? Number(r.data.aantal) || 0 : 0), 0);
}
async function zoekTicket(sb, code) {
  const { data } = await sb.from("tickets").select("id,data").contains("data", { tickets: [{ code }] }).limit(1);
  return data && data[0] || null;
}
const ticketUrl = code => `${site()}/ticket?c=${code}`;
const bestelUrl = (id, t) => `${site()}/ticket?b=${encodeURIComponent(id)}&t=${encodeURIComponent(t)}`;
const qrUrl = code => `${site()}/api/fuif?qr=${code}`;
const isDrank = t => t && t.soort === "drank";
const pub = (t, d) => ({ code: t.code, nr: t.nr, van: isDrank(t) ? (d.tickets || []).filter(x => isDrank(x) && x.waarde === t.waarde).length : (d.tickets || []).filter(x => !isDrank(x)).length, soort: t.soort || "ticket", waarde: t.waarde || null, gescand: t.gescand ? t.gescand.op : null });
// online verkoop loopt tot de start van de fuif (datum + uur uit "deuren", Belgische tijd); zonder uur tot het einde van die dag
export function verkoopTot(c) { if (!c.datum) return ""; const m = String(c.deuren || "").match(/(\d{1,2})\s*[u:h.]\s*(\d{2})?/i); return m ? `${c.datum}T${String(Math.min(23, +m[1])).padStart(2, "0")}:${m[2] || "00"}` : `${c.datum}T23:59`; }
const nuBxl = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date()).replace(" ", "T");
const isVoorbij = c => !!c.datum && nuBxl() >= verkoopTot(c);
// leden voor "via welk lid": iedereen in de ledenlijst die lid is (geen "geen lid", niet gestopt vóór het jaar van de fuif), los van het lidgeld
let FL_CACHE = null;
async function fuifLeden(sb, jaar) {
  if (FL_CACHE && FL_CACHE.jaar === jaar && Date.now() - FL_CACHE.t < 60000) return FL_CACHE.L;
  const L = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("leden").select("id,data").range(from, from + 999); if (error) throw error;
    for (const r of data) { const l = r.data || {}; if (!l.naam || l.dubbelVan || l.geenLid) continue; if (l.lidTot && Number(l.lidTot) < jaar - 1) continue;
      L.push({ id: r.id, naam: `${l.naam} ${l.voornaam || ""}`.replace(/\s+/g, " ").trim(), voornaam: String(l.voornaam || "").trim(), em: "" }); }
    if (data.length < 1000) break;
  }
  L.sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
  FL_CACHE = { jaar, t: Date.now(), L }; return L;
}
const wanneer = c => [c.datum ? lang(c.datum) : "", c.deuren ? "deuren " + c.deuren : ""].filter(Boolean).join(", ");

/* ---------- openbaar: /api/fuif ---------- */
export default async function fuifPubliek(req, res) {
  try {
    const sb = admin(), q = req.query || {};
    if (req.method === "GET" && q.header != null) {
      const b = await fuifHeader(sb, false); if (!b || !b.web) throw httpErr(404, "Geen afbeelding");
      res.setHeader("Content-Type", b.mime || "image/jpeg"); res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.status(200).send(Buffer.from(b.web, "base64"));
    }
    if (req.method === "GET" && q.qr) {
      const code = String(q.qr).toUpperCase(); if (!CODE_RE.test(code)) throw httpErr(404, "Niet gevonden");
      res.setHeader("Content-Type", "image/png"); res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.status(200).send(qrPng(ticketUrl(code), 8, 4));
    }
    res.setHeader("Cache-Control", "no-store");
    const { c, A } = await fuifCfg(sb);
    const ev = { header: c.header ? `/api/fuif?header=${encodeURIComponent(c.header)}` : null, naam: c.naam, datum: c.datum, datumTekst: c.datum ? lang(c.datum) : "", deuren: c.deuren, locatie: c.locatie, info: c.info, jaar: c.jaar };
    if (req.method === "GET" && q.c) {
      await rateLimit(sb, req, "ticket", 120, 600, httpErr);
      const code = codeUit(q.c); const r = code && await zoekTicket(sb, code); if (!r) throw httpErr(404, "Dit ticket bestaat niet.");
      const t = r.data.tickets.find(x => x.code === code), d = r.data;
      return res.status(200).json({ ev, tickets: [pub(t, d)], naam: [d.voornaam, d.naam].filter(Boolean).join(" "), geldig: d.status === "betaald", status: d.status });
    }
    if (req.method === "GET" && q.b) {
      await rateLimit(sb, req, "ticket", 120, 600, httpErr);
      const { data: r } = await sb.from("tickets").select("id,data").eq("id", String(q.b)).maybeSingle();
      if (!r || !r.data.betaalToken || r.data.betaalToken !== String(q.t || "")) throw httpErr(404, "Deze tickets werden niet gevonden.");
      const d = r.data;
      return res.status(200).json({ ev, tickets: (d.tickets || []).map(t => pub(t, d)), drank: d.drank || [], naam: [d.voornaam, d.naam].filter(Boolean).join(" "), geldig: d.status === "betaald", status: d.status, aantal: d.aantal, bedrag: d.bedrag });
    }
    if (req.method === "GET" && q.g) {
      await rateLimit(sb, req, "spkaart", 60, 600, httpErr);
      const r = await gastRij(sb, q.g, q.t), d = r.data;
      return res.status(200).json({ ev, gast: true, bedrijf: d.organisatie || "", voornaam: d.voornaam || "", naam: d.naam || "", aantal: d.aantal || 0, drank: (d.drank && d.drank[0] && d.drank[0].waarde) || 0, boodschap: d.boodschap || "",
        status: d.status === "betaald" ? "aangevraagd" : d.status === "geannuleerd" ? "ingetrokken" : isVoorbij(c) ? "voorbij" : "open", op: d.betaaldOp || null, aan: d.mail ? d.mail.aan : d.email, bekijk: d.status === "betaald" ? bestelUrl(r.id, d.betaalToken) : null });
    }
    if (req.method === "GET" && q.sp) {
      await rateLimit(sb, req, "spkaart", 60, 600, httpErr);
      const { s: sp, jk } = await sponsorUitLink(sb, q);
      const k = ((sp.data.geschenk || {})[jk] || {}).kaarten;
      let bekijk = null;
      if (k && k.ticketId) { const { data: r } = await sb.from("tickets").select("id,data").eq("id", k.ticketId).maybeSingle(); if (r && r.data.status === "betaald") bekijk = bestelUrl(r.id, r.data.betaalToken); }
      return res.status(200).json({ ev, bedrijf: sp.data.bedrijf || "", voornaam: sp.data.voornaam || "", aantal: c.sponsorTickets, drank: c.sponsorDrank,
        status: k ? "aangevraagd" : isVoorbij(c) ? "voorbij" : "open", op: k ? k.op : null, aan: k && k.mail ? k.mail.aan : null, papier: !!(k && k.papier), bekijk });
    }
    if (req.method === "GET" && q.zoek != null) {
      await rateLimit(sb, req, "fuifzoek", 120, 600, httpErr);
      return res.status(200).json(zoekLeden(await fuifLeden(sb, c.jaar), String(q.zoek)).map(l => ({ id: l.id, naam: l.naam, toon: l.toon })));
    }
    if (req.method === "GET") {
      const n = c.max ? await bezet(sb, c.jaar) : 0, vrij = c.max ? Math.max(0, c.max - n) : null;
      const voorbij = isVoorbij(c);
      return res.status(200).json({ ...ev, prijs: c.prijs, open: c.open !== false && !!c.datum && !voorbij && (vrij == null || vrij > 0), gesloten: c.open === false || !c.datum ? "manueel" : voorbij ? "voorbij" : vrij === 0 ? "uitverkocht" : null, vrij, verkoopTot: verkoopTot(c), perBestelling: c.perBestelling, dranken: c.dranken, drankKorting: c.drankKorting, online: onlineConfigured(), vereniging: A.vereniging });
    }
    if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");

    if (body(req).actie === "gastclaim") {
      await rateLimit(sb, req, "spkaart", 20, 600, httpErr);
      const b = body(req), r = await gastRij(sb, b.g, b.t);
      if (r.data.status === "betaald") throw httpErr(409, "Al aangevraagd.");
      if (r.data.status !== "uitgenodigd") throw httpErr(403, "Deze uitnodiging is niet meer geldig.");
      if (isVoorbij(c)) throw httpErr(403, "De fuif is voorbij; aanvragen kan niet meer.");
      const x = await gastClaim(sb, r);
      return res.status(200).json({ ok: true, ...x });
    }
    if (body(req).actie === "sponsorclaim") {
      await rateLimit(sb, req, "spkaart", 20, 600, httpErr);
      const b = body(req), { s: sp, jk } = await sponsorUitLink(sb, b);
      if (isVoorbij(c)) throw httpErr(403, "De fuif is voorbij; aanvragen kan niet meer.");
      const r = await sponsorKaarten(sb, { sponsorId: sp.id, jaar: jk }, { email: "sponsor (via mail)" });
      return res.status(200).json({ ok: true, mail: r.mail, aan: r.aan, aantal: r.kaarten.aantal, drank: r.kaarten.drank, bekijk: r.bekijk });
    }
    // ---- bestellen ----
    const b = body(req);
    if (await spamCheck(sb, "tickets", b, httpErr)) return res.status(200).json({ ok: true });
    await rateLimit(sb, req, "fuif", 15, 3600, httpErr);
    if (!onlineConfigured()) throw httpErr(501, "Online betalen is nog niet ingesteld. Probeer het later opnieuw.");
    if (c.open === false || !c.datum) throw httpErr(403, "De ticketverkoop is gesloten.");
    if (isVoorbij(c)) throw httpErr(403, "De online ticketverkoop is afgelopen.");
    if (!(c.prijs > 0)) throw httpErr(403, "De ticketprijs is nog niet ingesteld.");
    const d = { naam: clean(b.naam, 80), voornaam: clean(b.voornaam, 80), adres: clean(b.adres, 200), email: clean(b.email, 120).toLowerCase(), telefoon: clean(b.telefoon, 40) };
    if (!d.voornaam || !d.naam) throw httpErr(400, "Vul je voornaam en naam in.");
    if (!adresVolledig(d.adres)) throw httpErr(400, ADRES_FOUT);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) throw httpErr(400, "Dit e-mailadres lijkt niet te kloppen. Daar sturen we je tickets naartoe.");
    const aantal = Math.floor(Number(b.aantal)) || 0;
    if (!(aantal >= 0 && aantal <= c.perBestelling)) throw httpErr(400, `Je kan maximaal ${c.perBestelling} tickets per keer bestellen.`);
    // drankkaarten in voorverkoop (met korting): b.drank = {d20: 2, d50: 1}
    const drank = c.dranken.map(k => ({ id: k.id, waarde: k.waarde, prijs: k.prijs, aantal: Math.max(0, Math.min(20, Math.floor(Number((b.drank || {})[k.id])) || 0)) })).filter(k => k.aantal > 0);
    const nDrank = drank.reduce((n, k) => n + k.aantal, 0);
    if (!aantal && !nDrank) throw httpErr(400, "Kies minstens één ticket of drankkaart.");
    if (c.max && aantal) { const vrij = c.max - await bezet(sb, c.jaar); if (vrij <= 0) throw httpErr(409, "De tickets zijn uitverkocht."); if (aantal > vrij) throw httpErr(409, `Er ${vrij === 1 ? "is" : "zijn"} nog maar ${vrij} ${vrij === 1 ? "ticket" : "tickets"} beschikbaar.`); }
    // via welk lid (optioneel): gekozen uit de lijst (id) of vrij ingetypt (dan zoeken we het lid op naam)
    let via = null; const viaTekst = clean(b.viaTekst || b.via, 100), viaId = clean(b.viaId, 80);
    if (viaId || viaTekst) {
      const L = await fuifLeden(sb, c.jaar);
      let lid = viaId ? L.find(l => l.id === viaId) : null;
      if (!lid && viaTekst) { const t = norm(viaTekst).replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean).sort().join(" "); const hits = L.filter(l => norm(l.naam).replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean).sort().join(" ") === t); if (hits.length === 1) lid = hits[0]; }
      via = { tekst: viaTekst || (lid ? lid.naam : ""), lidId: lid ? lid.id : null, naam: lid ? lid.naam : null };
    }
    const id = "t" + c.jaar + "-" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex"), token = crypto.randomBytes(18).toString("base64url");
    const bedrag = Math.round((aantal * c.prijs + drank.reduce((n, k) => n + k.aantal * k.prijs, 0)) * 100) / 100;
    const korting = Math.round(drank.reduce((n, k) => n + k.aantal * (k.waarde - k.prijs), 0) * 100) / 100;
    const row = { id, data: { jaar: c.jaar, ...d, aantal, prijs: c.prijs, drank, korting, bedrag, via, bron: "formulier", aangemeld: new Date().toISOString(), betaalToken: token, status: "wacht", tickets: [] } };
    const { error } = await sb.from("tickets").insert(row); if (error) throw error;
    const { startBetaling } = await import("./betaal.js");
    let bt;
    try { bt = await startBetaling(sb, req, "tickets", row, { bedrag, jaar: c.jaar, terug: "/fuif?betaling=terug" }); }
    catch (e) { console.error("fuif betaling", e); await sb.from("tickets").delete().eq("id", id); throw httpErr(502, "De betaling kon niet gestart worden. Probeer het zo meteen opnieuw."); }
    res.status(200).json({ ok: true, id, token, bedrag, aantal, drank, korting, voornaam: d.voornaam, online: { t: "tickets", id, token, deeplink: bt.deeplink, qrcode: bt.qrcode, checkout: bt.checkout, verlooptOp: bt.verlooptOp, provider: bt.provider || null } });
  } catch (e) { sendError(res, e); }
}

/* ---------- na een geslaagde betaling ---------- */
async function puntenBij(sb, lidId, jaar, delta) {
  if (!lidId || !delta) return;
  const id = jaar + "_" + lidId;
  const { data: r } = await sb.from("jaarleden").select("data").eq("id", id).maybeSingle();
  const d = r && r.data || { jaar: Number(jaar), lidId };
  const { error } = await sb.from("jaarleden").upsert({ id, data: { ...d, jaar: Number(jaar), lidId, kaarten: Math.max(0, (Number(d.kaarten) || 0) + delta) } });
  if (error) throw error;
}
export async function fuifBetaald(sb, id) {
  const { data: r } = await sb.from("tickets").select("id,data").eq("id", id).maybeSingle();
  if (!r || r.data.status === "betaald" || r.data.status === "geannuleerd") return;
  const d = r.data;
  if (d.bron === "kassa") { // verkoop aan de kassa: geen QR-codes of mail, enkel tellen
    await sb.from("tickets").update({ data: { ...d, status: "betaald", betaaldOp: (d.betaling && d.betaling.betaaldOp) || new Date().toISOString() } }).eq("id", id).in("data->>status", ["wacht", "verlopen"]);
    return;
  }
  let tickets = d.tickets && d.tickets.length ? d.tickets : null;
  if (!tickets) {
    tickets = Array.from({ length: Number(d.aantal) || 0 }, (_, i) => ({ code: nieuweCode(), nr: i + 1, soort: "ticket", gescand: null }));
    for (const k of d.drank || []) for (let i = 0; i < k.aantal; i++) tickets.push({ code: nieuweCode(), nr: i + 1, soort: "drank", waarde: k.waarde, gescand: null });
  }
  const nT = tickets.filter(t => !isDrank(t)).length, nD = tickets.length - nT;
  const punten = d.via && d.via.lidId && nT ? { lidId: d.via.lidId, jaar: d.jaar, aantal: nT } : null;
  const nieuw = { ...d, status: "betaald", betaaldOp: (d.betaling && d.betaling.betaaldOp) || new Date().toISOString(), tickets, ...(punten ? { punten } : {}) };
  // enkel als de bestelling nog op "wacht" (of "verlopen") staat: zo krijgt niemand twee keer tickets of punten
  const { data: upd, error } = await sb.from("tickets").update({ data: nieuw }).eq("id", id).in("data->>status", ["wacht", "verlopen"]).select("id");
  if (error) throw error; if (!upd || !upd.length) return;
  try { if (punten) await puntenBij(sb, punten.lidId, punten.jaar, punten.aantal); } catch (e) { console.error("fuif punten", e); }
  try { await stuurTickets(sb, { id, data: nieuw }); } catch (e) { console.error("fuif mail", e); }
  const wat = [nT ? `${nT} ${nT === 1 ? "ticket" : "tickets"}` : "", nD ? `${nD} ${nD === 1 ? "drankkaart" : "drankkaarten"}` : ""].filter(Boolean).join(" + ");
  try { await meldPush(sb, "iedereen", { titel: "Fuif: bestelling betaald", tekst: `${nieuw.voornaam} ${nieuw.naam}: ${wat} (${eur(nieuw.bedrag)})${punten ? " via " + (d.via.naam || "") : ""}`, url: "/#fuif", tag: "fuif-" + id }); } catch (e) { console.error("fuif push", e); }
}

/* ---------- ticket-PDF en mail ---------- */
const opNaam = d => d.bron === "genodigde" && d.organisatie ? [[d.voornaam, d.naam].filter(Boolean).join(" "), d.organisatie].filter(Boolean).join(" · ") : d.bron === "sponsor" && d.bedrijf ? [d.bedrijf, [d.voornaam, d.naam].filter(Boolean).join(" ")].filter(Boolean).join(" · ") : [d.voornaam, d.naam].filter(Boolean).join(" ");
const naamVan = t => isDrank(t) ? `Drankkaart ${geld(t.waarde).replace(",00", "")}` : "Ticket";
// header (affiche/banner) uit de tabel "beelden": web = JPEG (base64), pdf = {w, h, data (zlib RGB, base64)}
export async function fuifHeader(sb, metPdf) {
  try { const { data } = await sb.from("beelden").select("data").eq("id", "fuif-header").maybeSingle(); const b = data && data.data; if (!b) return null; return metPdf ? (b.pdf && b.pdf.w ? b.pdf : null) : b; }
  catch (e) { console.error("fuif header", e); return null; }
}
export function ticketPdf(d, c, kop) {
  const pdf = new Pdf(), L = 60, R = 535, ROOD = "#b30000", GRIJS = "#666666", GOUD = "#b07a12";
  let hW = 0, hH = 0; if (kop && kop.w && kop.h) { hW = 475; hH = hW * kop.h / kop.w; if (hH > 150) { hH = 150; hW = hH * kop.w / kop.h; } }
  const dy = hH ? hH + 14 : 0;
  const nT = d.tickets.filter(t => !isDrank(t)).length;
  d.tickets.forEach((t, i) => {
    if (i) pdf.nieuwePagina();
    const dr = isDrank(t), kl = dr ? GOUD : ROOD, van = dr ? d.tickets.filter(x => isDrank(x) && x.waarde === t.waarde).length : nT;
    pdf.vlak(0, 0, 595, 8, kl);
    if (hH) pdf.beeld((595 - hW) / 2, 18, hW, hH, kop);
    const Y = v => v + dy;
    pdf.beeld(L, Y(40), 54, 54 * LOGO.h / LOGO.w, LOGO);
    pdf.tekst(L + 70, Y(48), dr ? "DRANKKAART · VOORVERKOOP" : "TICKET", { size: 10, bold: true, kleur: kl });
    pdf.tekst(L + 70, Y(64), dr ? `Drankkaart ${geld(t.waarde).replace(",00", "")}` : c.naam, { size: 24, bold: true });
    pdf.tekst(L + 70, Y(94), dr ? `${c.naam}  ·  ${c.datum ? lang(c.datum) : ""}` : [c.datum ? lang(c.datum) : "", c.deuren ? "deuren " + c.deuren : ""].filter(Boolean).join("  ·  "), { size: 11 });
    if (c.locatie) pdf.tekst(L + 70, Y(110), c.locatie, { size: 11, kleur: GRIJS });
    const q = qrMatrix(ticketUrl(t.code)), maat = 160, qx = (595 - maat) / 2, qy = Y(170);
    pdf.vlak(qx - 16, qy - 16, maat + 32, maat + 32, "#ffffff"); pdf.kader(qx - 16, qy - 16, maat + 32, maat + 32, dr ? GOUD : "#dddddd", 1);
    pdf.qr(qx, qy, maat, q.n, q.donker);
    pdf.tekst(297.5, qy + maat + 34, t.code.replace(/(.{4})(?=.)/g, "$1 "), { size: 16, bold: true, align: "center" });
    pdf.tekst(297.5, qy + maat + 56, `${naamVan(t)} ${t.nr} van ${van}`, { size: 11, kleur: GRIJS, align: "center" });
    let y = qy + maat + 100;
    pdf.lijn(L, y, R, y, "#dddddd"); y += 18;
    pdf.tekst(L, y, "Op naam van", { size: 9, kleur: GRIJS }); pdf.tekst(L + 110, y, opNaam(d), { size: 10.5 }); y += 28;
    pdf.tekst(L, y, dr ? "Wissel deze QR-code aan de kassa om tegen je drankkaart. Elke code is één keer geldig." : "Toon deze QR-code aan de kassa, op je gsm of afgedrukt. Elke code is één keer geldig.", { size: 9.5, kleur: GRIJS });
    pdf.vlak(0, 834, 595, 8, kl);
  });
  return Buffer.from(pdf.bytes({ titel: `Tickets ${c.naam}`, auteur: "VBHA" }));
}
export async function stuurTickets(sb, row, aan) {
  if (!smtpConfigured()) return false;
  const d = row.data, { c, A } = await fuifCfg(sb), naar = String(aan || d.email || "").trim();
  if (!naar || !(d.tickets || []).length) return false;
  const T = d.tickets.filter(t => !isDrank(t)), D = d.tickets.filter(isDrank), n = T.length;
  const wat = [n ? (n === 1 ? "je ticket" : `je ${n} tickets`) : "", D.length ? (D.length === 1 ? "je drankkaart" : `je ${D.length} drankkaarten`) : ""].filter(Boolean).join(" en ");
  const blok = (t, kop, kl) => `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 16px;border:1px solid ${kl === "#b30000" ? "#e3e3e3" : "#e8d3a6"};border-radius:8px"><tr><td align="center" style="padding:18px 12px">
      <div style="font-size:12px;letter-spacing:.12em;color:${kl};font-weight:bold;margin:0 0 8px">${kop}</div>
      <img src="${qrUrl(t.code)}" alt="QR-code ${esc(kop.toLowerCase())}" width="220" height="220" style="display:block;width:220px;height:220px;border:0;margin:0 auto">
      <div style="font-family:Menlo,Consolas,monospace;font-size:16px;font-weight:bold;letter-spacing:.08em;margin-top:8px">${t.code.replace(/(.{4})(?=.)/g, "$1 ")}</div></td></tr></table>`;
  const sp = d.bron === "sponsor" || d.bron === "genodigde", gast = d.bron === "genodigde";
  const html = p(`Beste ${esc(d.voornaam || "")},`.replace(" ,", ","))
    + (gast ? p(`Fijn dat je erbij bent! Hieronder vind je ${wat} voor onze fuif <b>${esc(c.naam)}</b>, aangeboden door de Vriendenkring.`)
      : sp ? p(`Hartelijk dank om de brandweerkalender te sponsoren${d.bedrijf ? ` met <b>${esc(d.bedrijf)}</b>` : ""}! Als dank krijg je van de Vriendenkring ${wat} voor onze jaarlijkse fuif <b>${esc(c.naam)}</b>. Je vindt ze hieronder.`)
      : p(`Bedankt voor je bestelling! Je betaling van <b>${eur(d.bedrag)}</b> is goed ontvangen. Hieronder vind je ${wat} voor <b>${esc(c.naam)}</b>.`))
    + kaderBlok(esc(c.naam), tabel([rij("Wanneer", esc(wanneer(c))), rij("Waar", esc(c.locatie || "")), n ? rij("Tickets", sp ? `${n} inkomkaarten (geschenk)` : `${n} × ${eur(d.prijs)}`) : "",
      ...(d.drank || []).map(k => rij(`Drankkaart ${eur(k.waarde)}`, sp ? `${k.aantal} × (geschenk)` : `${k.aantal} × ${eur(k.prijs)} <span style="color:#1a7f45">(voorverkoop, je bespaart ${eur((k.waarde - k.prijs) * k.aantal)})</span>`)),
      rij("Op naam van", esc(opNaam(d)))]))
    + (!sp && d.korting > 0 ? p(`<b style="color:#1a7f45">Dankzij de voorverkoop bespaar je ${eur(d.korting)} op je drankkaarten.</b>`) : "")
    + p(`Toon de QR-codes aan de kassa, op je gsm of afgedrukt. Elke code is één keer geldig${n > 1 ? ", dus geef je vrienden elk hun eigen ticket" : ""}.${D.length ? " Je drankkaarten wissel je aan de kassa om met de gele QR-codes." : ""} Alles zit ook als PDF in bijlage.`)
    + T.map(t => blok(t, `TICKET ${t.nr} VAN ${n}`, "#b30000")).join("")
    + D.map(t => blok(t, `DRANKKAART ${eur(t.waarde).replace(",00", "")} · ${t.nr} VAN ${D.filter(x => x.waarde === t.waarde).length}`, "#b07a12")).join("")
    + knop("Online bekijken", bestelUrl(row.id, d.betaalToken))
    + (sp ? "" : p("Gekochte tickets en drankkaarten worden niet terugbetaald en kunnen niet geannuleerd worden.", "margin:0 0 15px;font-size:13.5px;color:#666666"))
    + (c.info ? p(esc(c.info), "margin:0 0 15px;font-size:13.5px;color:#666666") : "")
    + p("Tot op de fuif!");
  const ond = gast ? `Je tickets voor ${c.naam}` : sp ? `Bedankt voor je sponsoring: ${wat.replace(/^je /, "").replace(" en je ", " en ")} voor ${c.naam}` : n ? `Je ${n === 1 ? "ticket" : "tickets"} voor ${c.naam}` : `Je ${D.length === 1 ? "drankkaart" : "drankkaarten"} voor ${c.naam}`;
  const [r] = await verstuur([{ aan: naar, aanNaam: [d.voornaam, d.naam].filter(Boolean).join(" "), onderwerp: ond, html: huisstijl(html, A.vereniging), van: afzender(), bijlagen: [{ naam: `Tickets ${c.naam}.pdf`, type: "application/pdf", data: ticketPdf(d, c, await fuifHeader(sb, true)) }] }]);
  if (r && r.ok) await sb.from("tickets").update({ data: { ...d, mail: { op: new Date().toISOString(), aan: naar } } }).eq("id", row.id);
  return !!(r && r.ok);
}

/* ---------- geplande taak (elke 10 minuten, via bevestigingenCron) ---------- */
export async function fuifCron(sb) {
  const { controleerBetaling } = await import("./betaal.js");
  const { data } = await sb.from("tickets").select("id,data").eq("data->>status", "wacht").limit(40);
  const uit = { betaald: 0, verlopen: 0 };
  for (const r of data || []) {
    try {
      const b = r.data.betaling; let st = b && b.status;
      if (b && b.id) { const n = await controleerBetaling(sb, "tickets", r); st = n && n.status; }
      if (st === "SUCCEEDED") { await fuifBetaald(sb, r.id); uit.betaald++; continue; }
      const oud = Date.now() - Date.parse(r.data.aangemeld || 0) > 60 * 60000;
      if (oud || /^(EXPIRED|FAILED|CANCELED|CANCELLED|AUTHORIZATION_FAILED)$/i.test(st || "") && Date.now() - Date.parse(r.data.aangemeld || 0) > 30 * 60000) {
        await sb.from("tickets").update({ data: { ...r.data, status: "verlopen" } }).eq("id", r.id).eq("data->>status", "wacht"); uit.verlopen++;
      }
    } catch (e) { console.error("fuif cron", e); }
  }
  return uit;
}

/* ---------- scannen (app én gastlogin aan de kassa) ---------- */
export async function scanTicket(sb, ruw, door, alleenBekijk) {
  const code = codeUit(ruw); if (!code) return { ok: false, reden: "Geen geldige ticketcode." };
  const r = await zoekTicket(sb, code); if (!r) return { ok: false, reden: "Onbekend ticket. Dit is geen ticket van onze fuif." };
  const d = r.data, t = d.tickets.find(x => x.code === code), { c } = await fuifCfg(sb);
  const P = pub(t, d), info = { code, nr: t.nr, van: P.van, soort: P.soort, waarde: P.waarde, naam: [d.voornaam, d.naam].filter(Boolean).join(" "), jaar: d.jaar };
  if (d.status !== "betaald") return { ok: false, reden: d.status === "geannuleerd" ? "Dit ticket werd geannuleerd." : "Dit ticket is niet betaald.", ...info };
  if (Number(d.jaar) !== Number(c.jaar)) return { ok: false, reden: `Dit ticket is voor de fuif van ${d.jaar}.`, ...info };
  if (t.gescand) return { ok: false, al: true, reden: isDrank(t) ? "Deze drankkaart werd al afgehaald." : "Dit ticket werd al gescand.", op: t.gescand.op, ...info };
  if (alleenBekijk) return { ok: true, bekijk: true, ...info };
  const op = new Date().toISOString(), tickets = d.tickets.map(x => x.code === code ? { ...x, gescand: { op, door: door || "" } } : x);
  // alleen als het ticket intussen niet door een andere kassa gescand werd
  const { data: upd } = await sb.from("tickets").update({ data: { ...d, tickets } }).eq("id", r.id).not("data", "cs", JSON.stringify({ tickets: [{ code, gescand: {} }] })).select("id");
  if (!upd || !upd.length) return { ok: false, al: true, reden: "Dit ticket werd net al gescand.", ...info };
  return { ok: true, op, ...info };
}
// stand voor de kassa: online tickets (gescand) en inkom verkocht aan de kassa
export async function fuifStand(sb, jaar) {
  const L = (await bestellingen(sb, jaar)).filter(r => r.data.status === "betaald");
  const T = L.flatMap(r => (r.data.tickets || []).filter(x => !isDrank(x)));
  const { data: K } = await sb.from("kassa").select("data").eq("data->>activiteit", "fuif").eq("data->>jaar", String(jaar)).eq("data->>status", "betaald");
  const kT = (K || []).reduce((n, r) => n + (r.data.items || []).filter(i => i.inkom).reduce((m, i) => m + (Number(i.aantal) || 0), 0), 0);
  return { tickets: T.length, gescand: T.filter(x => x.gescand).length, kassaInkom: kT, binnen: T.filter(x => x.gescand).length + kT };
}

/* ---------- app: scannen en beheren (POST /api/mail?f=fuif) ---------- */
export async function fuifApi(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const b = body(req), actie = String(b.actie || "");
  if (actie === "scan" || actie === "bekijk") {
    const { user, sb } = await requireUser(req);
    return res.status(200).json(await scanTicket(sb, b.code, user.email || "", actie === "bekijk"));
  }
  const { sb, user, rol } = await requireUser(req, { write: true, functie: "fuif" });
  if (actie === "sponsor") return res.status(200).json(await sponsorKaarten(sb, b, user));
  if (actie === "sponsoruitnodiging") return res.status(200).json(await sponsorUitnodigen(sb, b, user));
  if (actie === "gast") return res.status(200).json(await gastBewaar(sb, b, user));
  if (actie === "gastweg") { const { data: g } = await sb.from("tickets").select("id,data").eq("id", String(b.id || "")).maybeSingle(); if (!g || g.data.bron !== "genodigde") throw httpErr(404, "Niet gevonden."); if (g.data.status !== "uitgenodigd") throw httpErr(409, "Deze genodigde vroeg de tickets al aan. Annuleer via de bestelling."); const { error } = await sb.from("tickets").delete().eq("id", g.id).eq("data->>status", "uitgenodigd"); if (error) throw error; return res.status(200).json({ ok: true }); }
  if (actie === "gastmail") return res.status(200).json(await gastUitnodigen(sb, [String(b.id || "")], user));
  const { data: r } = await sb.from("tickets").select("id,data").eq("id", String(b.id || "")).maybeSingle();
  if (!r) throw httpErr(404, "Bestelling niet gevonden.");
  const d = r.data;
  if (actie === "mail") { if (d.status !== "betaald") throw httpErr(400, "Deze bestelling is niet betaald."); const ok = await stuurTickets(sb, r, clean(b.aan, 120) || d.email); if (!ok) throw httpErr(502, "Versturen lukte niet."); return res.status(200).json({ ok: true }); }
  if (actie === "pdf") { if (d.status !== "betaald") throw httpErr(400, "Deze bestelling is niet betaald."); const { c } = await fuifCfg(sb); return res.status(200).json({ ok: true, naam: `Tickets ${c.naam} ${d.voornaam} ${d.naam}.pdf`, pdf: ticketPdf(d, c, await fuifHeader(sb, true)).toString("base64") }); }
  if (actie === "ontscan") { const code = codeUit(b.code); const tickets = d.tickets.map(x => x.code === code ? { ...x, gescand: null } : x); await sb.from("tickets").update({ data: { ...d, tickets } }).eq("id", r.id); return res.status(200).json({ ok: true }); }
  if (actie === "wis") { // enkel administrator: bestelling of kassatransactie volledig verwijderen
    if (!["admin", "bewerker"].includes(rol)) throw httpErr(403, "Enkel een administrator kan transacties wissen.");
    if (d.punten) await puntenBij(sb, d.punten.lidId, d.punten.jaar, -d.punten.aantal);
    const { error } = await sb.from("tickets").delete().eq("id", r.id); if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  if (actie === "annuleer") { // gekochte tickets zijn niet annuleerbaar; enkel een administrator kan dit uitzonderlijk
    if (!["admin", "bewerker"].includes(rol)) throw httpErr(403, "Enkel een administrator kan tickets annuleren.");
    if (d.status === "geannuleerd") return res.status(200).json({ ok: true });
    if (d.punten) await puntenBij(sb, d.punten.lidId, d.punten.jaar, -d.punten.aantal);
    await sb.from("tickets").update({ data: { ...d, status: "geannuleerd", geannuleerd: { op: new Date().toISOString(), door: user.email || "" }, punten: null } }).eq("id", r.id);
    return res.status(200).json({ ok: true });
  }
  if (actie === "koppel") { // tickets (alsnog) aan een lid toekennen voor het puntensysteem, of loskoppelen
    const lidId = clean(b.lidId, 80) || null;
    if (d.punten) await puntenBij(sb, d.punten.lidId, d.punten.jaar, -d.punten.aantal);
    let naam = null; if (lidId) { const { data: l } = await sb.from("leden").select("data").eq("id", lidId).maybeSingle(); if (!l) throw httpErr(404, "Lid niet gevonden."); naam = `${l.data.naam || ""} ${l.data.voornaam || ""}`.trim(); }
    const nT = (d.tickets || []).filter(x => !isDrank(x)).length, punten = lidId && d.status === "betaald" && nT ? { lidId, jaar: d.jaar, aantal: nT } : null;
    if (punten) await puntenBij(sb, punten.lidId, punten.jaar, punten.aantal);
    await sb.from("tickets").update({ data: { ...d, via: lidId ? { ...(d.via || {}), lidId, naam, tekst: (d.via && d.via.tekst) || naam } : (d.via ? { ...d.via, lidId: null, naam: null } : null), punten } }).eq("id", r.id);
    return res.status(200).json({ ok: true });
  }
  if (actie === "controle") { const { controleerBetaling } = await import("./betaal.js"); const s = await controleerBetaling(sb, "tickets", r); return res.status(200).json({ ok: true, status: s && s.status }); }
  throw httpErr(400, "Onbekende actie.");
}

/* ---------- sponsors: inkomkaarten + drankkaart als geschenk (gratis, met QR, telt mee in de fuif) ----------
   sponsor.data.geschenk[jaar].kaarten = {op, door, ticketId, aantal, drank, mail:{op, aan}} */
async function sponsorKaarten(sb, b, user) {
  const sid = clean(b.sponsorId, 80), jk = String(Math.floor(Number(b.jaar)) || "");
  if (!sid || !/^20\d\d$/.test(jk)) throw httpErr(400, "Sponsor of jaar ontbreekt.");
  const { data: s } = await sb.from("sponsors").select("id,data").eq("id", sid).maybeSingle();
  if (!s) throw httpErr(404, "Sponsor niet gevonden.");
  const { c } = await fuifCfg(sb), sd = s.data || {};
  const G = { ...(sd.geschenk || {}) }, g = { ...(G[jk] || {}) };
  if (g.kaarten) throw httpErr(409, g.kaarten.papier ? "De kaarten werden al op papier gegeven." : "De tickets en drankkaart werden al aangevraagd en gemaild.");
  const aantal = Math.max(0, Math.min(50, Math.floor(Number(b.aantal ?? c.sponsorTickets)) || 0));
  const dw = Math.max(0, Math.min(500, Number(b.drank ?? c.sponsorDrank) || 0));
  if (!aantal && !dw) throw httpErr(400, "Kies minstens één ticket of een drankkaart.");
  const aan = clean(b.aan || sd.email, 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(aan)) throw httpErr(400, "Deze sponsor heeft geen geldig e-mailadres. Vul het eerst in bij de sponsor.");
  const tickets = Array.from({ length: aantal }, (_, i) => ({ code: nieuweCode(), nr: i + 1, soort: "ticket", gescand: null }));
  if (dw) tickets.push({ code: nieuweCode(), nr: 1, soort: "drank", waarde: dw, gescand: null });
  const nu = new Date().toISOString(), id = `tsp-${jk}-${sid}`.slice(0, 120); // vaste id: een sponsor kan maar één keer kaarten krijgen
  const data = { jaar: c.jaar, bron: "sponsor", sponsorId: sid, sponsorJaar: Number(jk), bedrijf: sd.bedrijf || "", voornaam: sd.voornaam || "", naam: sd.naam || "", adres: sd.adres || "", email: aan, telefoon: sd.telefoon || "",
    aantal, prijs: 0, drank: dw ? [{ id: "d" + dw, waarde: dw, prijs: 0, aantal: 1 }] : [], korting: 0, bedrag: 0, via: null, aangemeld: nu, betaalToken: crypto.randomBytes(18).toString("base64url"),
    status: "betaald", betaaldOp: nu, door: user.email || "", tickets };
  const { error } = await sb.from("tickets").insert({ id, data });
  if (error) { if (error.code === "23505") throw httpErr(409, "De tickets en drankkaart werden al aangevraagd en gemaild."); throw error; }
  let ok = false; try { ok = await stuurTickets(sb, { id, data }, aan); } catch (e) { console.error("sponsor kaarten mail", e); }
  // sponsor opnieuw lezen: ondertussen kan iemand in de app iets aangepast hebben
  const { data: s2 } = await sb.from("sponsors").select("data").eq("id", sid).maybeSingle(); const sd2 = (s2 && s2.data) || sd;
  const G2 = { ...(sd2.geschenk || {}) }, g2 = { ...(G2[jk] || {}) };
  g2.kaarten = { op: nu, door: user.email || "", ticketId: id, aantal, drank: dw, mail: ok ? { op: new Date().toISOString(), aan } : null };
  G2[jk] = g2;
  const { error: e2 } = await sb.from("sponsors").update({ data: { ...sd2, geschenk: G2 } }).eq("id", sid); if (e2) throw e2;
  try { await meldPush(sb, "iedereen", { titel: "Sponsor vroeg fuifkaarten aan", tekst: `${sd2.bedrijf || ""}: ${aantal} tickets${dw ? " + drankkaart " + eur(dw) : ""}`, url: "/#sponsors", tag: "spk-" + id }); } catch (e) { }
  return { ok: true, ticketId: id, mail: ok, aan, kaarten: g2.kaarten, bekijk: bestelUrl(id, data.betaalToken) };
}

// Persoonlijke link in de uitnodigingsmail: /sponsorkaarten?sp=<id>&j=<jaar>&t=<handtekening>
const spSleutel = () => String(process.env.BETAAL_GEHEIM || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const tekenSp = (sid, j) => crypto.createHmac("sha256", spSleutel()).update(`vbha-sponsorkaarten|${sid}|${j}`).digest("base64url").slice(0, 22);
const sponsorLink = (sid, j) => `${site()}/sponsorkaarten?sp=${encodeURIComponent(sid)}&j=${j}&t=${tekenSp(sid, j)}`;
async function sponsorUitLink(sb, q) {
  const sid = String(q.sp || q.s || "").slice(0, 80), jk = String(q.j || ""), t = String(q.t || "");
  const a = Buffer.from(tekenSp(sid, jk)), b = Buffer.from(t);
  if (!spSleutel() || !sid || !/^20\d\d$/.test(jk) || a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw httpErr(404, "Deze link is niet geldig.");
  const { data: s } = await sb.from("sponsors").select("id,data").eq("id", sid).maybeSingle();
  if (!s) throw httpErr(404, "Deze link is niet meer geldig.");
  return { s, jk };
}
export function sponsorUitnodigingMail(sd, sid, jk, c) {
  const wat = [c.sponsorTickets ? `${c.sponsorTickets} inkomkaarten` : "", c.sponsorDrank ? `een drankkaart van ${eur(c.sponsorDrank)}` : ""].filter(Boolean).join(" en ");
  const html = p(`Beste ${esc(sd.voornaam || "")},`.replace(" ,", ","))
    + p(`Hartelijk dank om de brandweerkalender te sponsoren${sd.bedrijf ? ` met <b>${esc(sd.bedrijf)}</b>` : ""}! Als dank bieden we je graag ${wat} aan voor onze jaarlijkse fuif <b>${esc(c.naam)}</b>.`)
    + kaderBlok(esc(c.naam), tabel([rij("Wanneer", esc(wanneer(c))), c.locatie ? rij("Waar", esc(c.locatie)) : "", rij("Jouw bedankje", esc(wat))].filter(Boolean)))
    + p(`Kom je graag? Klik dan op de knop hieronder. We maken de tickets en de drankkaart meteen aan op naam van ${esc(sd.bedrijf || "je bedrijf")} en mailen ze door met QR-codes.`)
    + knop("Mijn tickets en drankkaart aanvragen", sponsorLink(sid, jk))
    + p("De knop werkt één keer. Kom je niet? Dan hoef je niets te doen.", "margin:0 0 15px;font-size:13.5px;color:#666666")
    + p("Nogmaals bedankt voor je steun!");
  return { onderwerp: `Bedankt voor je sponsoring: gratis tickets voor ${c.naam}`, html };
}
async function sponsorUitnodigen(sb, b, user) {
  const jk = String(Math.floor(Number(b.jaar)) || ""); if (!/^20\d\d$/.test(jk)) throw httpErr(400, "Jaar ontbreekt.");
  const ids = (Array.isArray(b.ids) ? b.ids : []).map(x => String(x).slice(0, 80)).slice(0, 200);
  if (!ids.length) throw httpErr(400, "Kies minstens één sponsor.");
  const { c, A } = await fuifCfg(sb);
  if (!c.datum) throw httpErr(400, "Stel eerst de datum van de fuif in.");
  if (isVoorbij(c)) throw httpErr(400, "De fuif is voorbij.");
  const { data: rows, error } = await sb.from("sponsors").select("id,data").in("id", ids); if (error) throw error;
  const nu = new Date().toISOString(), batch = `sponsorkaarten-${jk}-${Date.now().toString(36)}`, berichten = [], ok = [], over = [];
  for (const r of rows || []) {
    const sd = r.data || {}, g = (sd.geschenk || {})[jk] || {}, aan = String(sd.email || "").trim();
    if (g.kaarten) { over.push({ id: r.id, reden: "kreeg al kaarten" }); continue; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(aan)) { over.push({ id: r.id, reden: "geen e-mailadres" }); continue; }
    const m = sponsorUitnodigingMail(sd, r.id, jk, c);
    berichten.push({ batch, data: { aan, aanNaam: [sd.voornaam, sd.naam].filter(Boolean).join(" ") || sd.bedrijf || "", onderwerp: m.onderwerp, html: huisstijl(m.html, A.vereniging), label: "Uitnodiging fuifkaarten sponsors" } });
    ok.push(r);
  }
  if (berichten.length) { const { error: e } = await sb.from("mail_wachtrij").insert(berichten); if (e) throw e; }
  for (const r of ok) {
    const G = { ...((r.data || {}).geschenk || {}) }; G[jk] = { ...(G[jk] || {}), uitnodiging: { op: nu, door: user.email || "", aan: r.data.email } };
    await sb.from("sponsors").update({ data: { ...r.data, geschenk: G } }).eq("id", r.id);
  }
  return { ok: true, aantal: ok.length, over };
}

/* ---------- genodigden (bevriende vriendenkringen, sympathisanten): gratis tickets na bevestiging via de knop in hun mail ----------
   Rij in "tickets" met bron "genodigde", status "uitgenodigd" (nog geen QR-codes). Drukt de genodigde op de knop, dan wordt de rij
   één keer omgezet naar "betaald" met tickets en mail. Link: /sponsorkaarten?g=<id>&t=<betaalToken> */
const gastLink = (id, t) => `${site()}/sponsorkaarten?g=${encodeURIComponent(id)}&t=${encodeURIComponent(t)}`;
async function gastRij(sb, id, t) {
  const { data: r } = await sb.from("tickets").select("id,data").eq("id", String(id || "").slice(0, 120)).maybeSingle();
  if (!r || r.data.bron !== "genodigde" || !r.data.betaalToken || String(t || "") !== r.data.betaalToken) throw httpErr(404, "Deze link is niet geldig.");
  return r;
}
async function gastBewaar(sb, b, user) {
  const { c } = await fuifCfg(sb);
  const d = { voornaam: clean(b.voornaam, 80), naam: clean(b.naam, 80), organisatie: clean(b.organisatie, 120), email: clean(b.email, 120).toLowerCase(), boodschap: clean(b.boodschap, 600) };
  if (!d.voornaam && !d.naam && !d.organisatie) throw httpErr(400, "Vul een naam of organisatie in.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) throw httpErr(400, "Vul een geldig e-mailadres in.");
  const aantal = Math.max(0, Math.min(50, Math.floor(Number(b.aantal)) || 0)), dw = Math.max(0, Math.min(500, Number(b.drank) || 0));
  if (!aantal && !dw) throw httpErr(400, "Kies minstens één ticket of een drankkaart.");
  let id = clean(b.id, 120), oud = null;
  if (id) { const { data: r } = await sb.from("tickets").select("id,data").eq("id", id).maybeSingle(); if (!r || r.data.bron !== "genodigde") throw httpErr(404, "Niet gevonden."); if (r.data.status !== "uitgenodigd") throw httpErr(409, "Deze genodigde vroeg de tickets al aan; aanpassen kan niet meer."); oud = r.data; }
  else id = "tg" + c.jaar + "-" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
  const data = { ...(oud || { jaar: c.jaar, bron: "genodigde", status: "uitgenodigd", aangemeld: new Date().toISOString(), betaalToken: crypto.randomBytes(18).toString("base64url"), tickets: [], prijs: 0, bedrag: 0, korting: 0, via: null, door: user.email || "" }),
    ...d, aantal, drank: dw ? [{ id: "d" + dw, waarde: dw, prijs: 0, aantal: 1 }] : [] };
  const { error } = oud ? await sb.from("tickets").update({ data }).eq("id", id) : await sb.from("tickets").insert({ id, data }); if (error) throw error;
  let gemaild = 0; if (b.mail) gemaild = (await gastUitnodigen(sb, [id], user)).aantal;
  return { ok: true, id, gemaild };
}
async function gastUitnodigen(sb, ids, user) {
  const { c, A } = await fuifCfg(sb);
  if (!c.datum) throw httpErr(400, "Stel eerst de datum van de fuif in.");
  if (isVoorbij(c)) throw httpErr(400, "De fuif is voorbij.");
  const { data: rows, error } = await sb.from("tickets").select("id,data").in("id", ids.slice(0, 200)); if (error) throw error;
  const batch = `genodigden-${c.jaar}-${Date.now().toString(36)}`, berichten = [], ok = [];
  for (const r of rows || []) {
    const d = r.data; if (d.bron !== "genodigde" || d.status !== "uitgenodigd") continue;
    const dw = (d.drank && d.drank[0] && d.drank[0].waarde) || 0;
    const wat = [d.aantal ? `${d.aantal} ${d.aantal === 1 ? "gratis inkomkaart" : "gratis inkomkaarten"}` : "", dw ? `een drankkaart van ${eur(dw)}` : ""].filter(Boolean).join(" en ");
    const html = p(`Beste ${esc(d.voornaam || d.organisatie || "")},`.replace(" ,", ","))
      + p(`Graag nodigen we ${d.organisatie ? `jullie van <b>${esc(d.organisatie)}</b>` : "je"} uit op onze jaarlijkse fuif <b>${esc(c.naam)}</b>. We bieden ${d.organisatie ? "jullie" : "je"} ${wat} aan.`)
      + (d.boodschap ? p(esc(d.boodschap).replace(/\n/g, "<br>")) : "")
      + kaderBlok(esc(c.naam), tabel([rij("Wanneer", esc(wanneer(c))), c.locatie ? rij("Waar", esc(c.locatie)) : "", rij("Voor jou", esc(wat))].filter(Boolean)))
      + p("Kom je? Klik dan op de knop hieronder. We maken de tickets meteen aan en mailen ze door met QR-codes.")
      + knop("Mijn tickets aanvragen", gastLink(r.id, d.betaalToken))
      + p("De knop werkt één keer. Kom je niet? Dan hoef je niets te doen.", "margin:0 0 15px;font-size:13.5px;color:#666666")
      + p("Hopelijk tot dan!");
    berichten.push({ batch, data: { aan: d.email, aanNaam: [d.voornaam, d.naam].filter(Boolean).join(" ") || d.organisatie || "", onderwerp: `Uitnodiging: gratis tickets voor ${c.naam}`, html: huisstijl(html, A.vereniging), label: "Uitnodiging genodigden fuif" } });
    ok.push(r);
  }
  if (berichten.length) { const { error: e } = await sb.from("mail_wachtrij").insert(berichten); if (e) throw e; }
  const nu = new Date().toISOString();
  for (const r of ok) await sb.from("tickets").update({ data: { ...r.data, uitnodiging: { op: nu, door: user.email || "", aan: r.data.email, n: ((r.data.uitnodiging && r.data.uitnodiging.n) || 0) + 1 } } }).eq("id", r.id).eq("data->>status", "uitgenodigd");
  return { ok: true, aantal: ok.length };
}
async function gastClaim(sb, r) {
  const d = r.data, dw = (d.drank && d.drank[0] && d.drank[0].waarde) || 0;
  const tickets = Array.from({ length: Number(d.aantal) || 0 }, (_, i) => ({ code: nieuweCode(), nr: i + 1, soort: "ticket", gescand: null }));
  if (dw) tickets.push({ code: nieuweCode(), nr: 1, soort: "drank", waarde: dw, gescand: null });
  const nieuw = { ...d, status: "betaald", betaaldOp: new Date().toISOString(), tickets };
  // enkel als de rij nog op "uitgenodigd" staat: twee keer drukken maakt geen dubbele tickets
  const { data: upd, error } = await sb.from("tickets").update({ data: nieuw }).eq("id", r.id).eq("data->>status", "uitgenodigd").select("id");
  if (error) throw error; if (!upd || !upd.length) throw httpErr(409, "Al aangevraagd.");
  let ok = false; try { ok = await stuurTickets(sb, { id: r.id, data: nieuw }); } catch (e) { console.error("gast mail", e); }
  try { await meldPush(sb, "iedereen", { titel: "Genodigde vroeg fuiftickets aan", tekst: `${d.organisatie || [d.voornaam, d.naam].filter(Boolean).join(" ")}: ${d.aantal || 0} tickets${dw ? " + drankkaart " + eur(dw) : ""}`, url: "/#fuif", tag: "gast-" + r.id }); } catch (e) { }
  return { mail: ok, aan: d.email, aantal: d.aantal || 0, drank: dw, bekijk: bestelUrl(r.id, d.betaalToken) };
}
