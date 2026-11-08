import crypto from "node:crypto";
import { admin, httpErr, sendError, requireUser } from "./sb.js";
import { clean, body, norm, algemeen, configDoc, spamCheck, rateLimit, actieveLeden, zoekLeden, vandaagISO } from "./publiek.js";
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

export const FUIF_DEF = { naam: "In Vier en Vlam", datum: "", deuren: "", locatie: "", prijs: 5, open: true, max: 0, perBestelling: 10, info: "" };
const CODE_ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const nieuweCode = () => { const b = crypto.randomBytes(12); let s = ""; for (const x of b) s += CODE_ABC[x % 32]; return s; };
const CODE_RE = /^[A-Z2-9]{12}$/;
export const codeUit = s => { const m = String(s || "").toUpperCase().match(/(?:[?&]C=)?([A-Z2-9]{12})(?![A-Z2-9])/); return m ? m[1] : ""; };
const geld = n => "€ " + Number(n || 0).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function fuifCfg(sb) {
  const c = { ...FUIF_DEF, ...(await configDoc(sb, "fuif")) }, A = await algemeen(sb);
  c.prijs = Math.max(0, Number(c.prijs) || 0); c.max = Math.max(0, Number(c.max) || 0); c.perBestelling = Math.min(50, Math.max(1, Number(c.perBestelling) || 10));
  c.jaar = Number(String(c.datum || "").slice(0, 4)) || A.jaar;
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
const wanneer = c => [c.datum ? lang(c.datum) : "", c.deuren ? "deuren " + c.deuren : ""].filter(Boolean).join(", ");

/* ---------- openbaar: /api/fuif ---------- */
export default async function fuifPubliek(req, res) {
  try {
    const sb = admin(), q = req.query || {};
    if (req.method === "GET" && q.qr) {
      const code = String(q.qr).toUpperCase(); if (!CODE_RE.test(code)) throw httpErr(404, "Niet gevonden");
      res.setHeader("Content-Type", "image/png"); res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.status(200).send(qrPng(ticketUrl(code), 8, 4));
    }
    if (req.method === "GET" && q.sri === "jsqr") { // TIJDELIJK: SRI-hash van jsQR bepalen
      const r = await fetch("https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"); const buf = Buffer.from(await r.arrayBuffer());
      return res.status(200).json({ status: r.status, bytes: buf.length, sri: "sha384-" + crypto.createHash("sha384").update(buf).digest("base64"), begin: buf.slice(0, 120).toString() });
    }
    res.setHeader("Cache-Control", "no-store");
    const { c, A } = await fuifCfg(sb);
    const ev = { naam: c.naam, datum: c.datum, datumTekst: c.datum ? lang(c.datum) : "", deuren: c.deuren, locatie: c.locatie, info: c.info, jaar: c.jaar };
    if (req.method === "GET" && q.c) {
      await rateLimit(sb, req, "ticket", 120, 600, httpErr);
      const code = codeUit(q.c); const r = code && await zoekTicket(sb, code); if (!r) throw httpErr(404, "Dit ticket bestaat niet.");
      const t = r.data.tickets.find(x => x.code === code), d = r.data;
      return res.status(200).json({ ev, tickets: [{ code, nr: t.nr, van: d.tickets.length, gescand: t.gescand ? t.gescand.op : null }], naam: [d.voornaam, d.naam].filter(Boolean).join(" "), geldig: d.status === "betaald", status: d.status });
    }
    if (req.method === "GET" && q.b) {
      await rateLimit(sb, req, "ticket", 120, 600, httpErr);
      const { data: r } = await sb.from("tickets").select("id,data").eq("id", String(q.b)).maybeSingle();
      if (!r || !r.data.betaalToken || r.data.betaalToken !== String(q.t || "")) throw httpErr(404, "Deze tickets werden niet gevonden.");
      const d = r.data;
      return res.status(200).json({ ev, tickets: (d.tickets || []).map(t => ({ code: t.code, nr: t.nr, van: d.tickets.length, gescand: t.gescand ? t.gescand.op : null })), naam: [d.voornaam, d.naam].filter(Boolean).join(" "), geldig: d.status === "betaald", status: d.status, aantal: d.aantal, bedrag: d.bedrag });
    }
    if (req.method === "GET" && q.zoek != null) {
      await rateLimit(sb, req, "fuifzoek", 120, 600, httpErr);
      return res.status(200).json(zoekLeden(await actieveLeden(sb, c.jaar), String(q.zoek)).map(l => ({ id: l.id, naam: l.naam })));
    }
    if (req.method === "GET") {
      const n = c.max ? await bezet(sb, c.jaar) : 0, vrij = c.max ? Math.max(0, c.max - n) : null;
      const voorbij = c.datum && vandaagISO() > c.datum;
      return res.status(200).json({ ...ev, prijs: c.prijs, open: c.open !== false && !voorbij && (vrij == null || vrij > 0), gesloten: c.open === false ? "manueel" : voorbij ? "voorbij" : vrij === 0 ? "uitverkocht" : null, vrij, perBestelling: c.perBestelling, online: onlineConfigured(), vereniging: A.vereniging });
    }
    if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");

    // ---- bestellen ----
    const b = body(req);
    if (await spamCheck(sb, "tickets", b, httpErr)) return res.status(200).json({ ok: true });
    await rateLimit(sb, req, "fuif", 15, 3600, httpErr);
    if (!onlineConfigured()) throw httpErr(501, "Online betalen is nog niet ingesteld. Probeer het later opnieuw.");
    if (c.open === false) throw httpErr(403, "De ticketverkoop is gesloten.");
    if (c.datum && vandaagISO() > c.datum) throw httpErr(403, "De ticketverkoop is afgelopen.");
    if (!(c.prijs > 0)) throw httpErr(403, "De ticketprijs is nog niet ingesteld.");
    const d = { naam: clean(b.naam, 80), voornaam: clean(b.voornaam, 80), adres: clean(b.adres, 200), email: clean(b.email, 120).toLowerCase(), telefoon: clean(b.telefoon, 40) };
    if (!d.voornaam || !d.naam) throw httpErr(400, "Vul je voornaam en naam in.");
    if (!adresVolledig(d.adres)) throw httpErr(400, ADRES_FOUT);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) throw httpErr(400, "Dit e-mailadres lijkt niet te kloppen. Daar sturen we je tickets naartoe.");
    const aantal = Math.floor(Number(b.aantal));
    if (!(aantal >= 1 && aantal <= c.perBestelling)) throw httpErr(400, `Kies tussen 1 en ${c.perBestelling} tickets.`);
    if (c.max) { const vrij = c.max - await bezet(sb, c.jaar); if (vrij <= 0) throw httpErr(409, "De tickets zijn uitverkocht."); if (aantal > vrij) throw httpErr(409, `Er ${vrij === 1 ? "is" : "zijn"} nog maar ${vrij} ${vrij === 1 ? "ticket" : "tickets"} beschikbaar.`); }
    // via welk lid (optioneel): gekozen uit de lijst (id) of vrij ingetypt (dan zoeken we het lid op naam)
    let via = null; const viaTekst = clean(b.viaTekst || b.via, 100), viaId = clean(b.viaId, 80);
    if (viaId || viaTekst) {
      const L = await actieveLeden(sb, c.jaar);
      let lid = viaId ? L.find(l => l.id === viaId) : null;
      if (!lid && viaTekst) { const t = norm(viaTekst).replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean).sort().join(" "); const hits = L.filter(l => norm(l.naam).replace(/[^a-z ]/g, " ").split(/\s+/).filter(Boolean).sort().join(" ") === t); if (hits.length === 1) lid = hits[0]; }
      via = { tekst: viaTekst || (lid ? lid.naam : ""), lidId: lid ? lid.id : null, naam: lid ? lid.naam : null };
    }
    const id = "t" + c.jaar + "-" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex"), token = crypto.randomBytes(18).toString("base64url");
    const bedrag = Math.round(aantal * c.prijs * 100) / 100;
    const row = { id, data: { jaar: c.jaar, ...d, aantal, prijs: c.prijs, bedrag, via, bron: "formulier", aangemeld: new Date().toISOString(), betaalToken: token, status: "wacht", tickets: [] } };
    const { error } = await sb.from("tickets").insert(row); if (error) throw error;
    const { startBetaling } = await import("./betaal.js");
    let bt;
    try { bt = await startBetaling(sb, req, "tickets", row, { bedrag, jaar: c.jaar, terug: "/fuif?betaling=terug" }); }
    catch (e) { console.error("fuif betaling", e); await sb.from("tickets").delete().eq("id", id); throw httpErr(502, "De betaling kon niet gestart worden. Probeer het zo meteen opnieuw."); }
    res.status(200).json({ ok: true, id, token, bedrag, aantal, voornaam: d.voornaam, online: { t: "tickets", id, token, deeplink: bt.deeplink, qrcode: bt.qrcode, checkout: bt.checkout, verlooptOp: bt.verlooptOp, provider: bt.provider || null } });
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
  const d = r.data, tickets = d.tickets && d.tickets.length ? d.tickets : Array.from({ length: Number(d.aantal) || 1 }, (_, i) => ({ code: nieuweCode(), nr: i + 1, gescand: null }));
  const punten = d.via && d.via.lidId ? { lidId: d.via.lidId, jaar: d.jaar, aantal: tickets.length } : null;
  const nieuw = { ...d, status: "betaald", betaaldOp: (d.betaling && d.betaling.betaaldOp) || new Date().toISOString(), tickets, ...(punten ? { punten } : {}) };
  // enkel als de bestelling nog op "wacht" (of "verlopen") staat: zo krijgt niemand twee keer tickets of punten
  const { data: upd, error } = await sb.from("tickets").update({ data: nieuw }).eq("id", id).in("data->>status", ["wacht", "verlopen"]).select("id");
  if (error) throw error; if (!upd || !upd.length) return;
  try { if (punten) await puntenBij(sb, punten.lidId, punten.jaar, punten.aantal); } catch (e) { console.error("fuif punten", e); }
  try { await stuurTickets(sb, { id, data: nieuw }); } catch (e) { console.error("fuif mail", e); }
  try { await meldPush(sb, "iedereen", { titel: "Tickets verkocht", tekst: `${nieuw.voornaam} ${nieuw.naam}: ${tickets.length} ${tickets.length === 1 ? "ticket" : "tickets"} (${eur(nieuw.bedrag)})${punten ? " via " + (d.via.naam || "") : ""}`, url: "/#fuif", tag: "fuif-" + id }); } catch (e) { console.error("fuif push", e); }
}

/* ---------- ticket-PDF en mail ---------- */
export function ticketPdf(d, c) {
  const pdf = new Pdf(), L = 60, R = 535, W = R - L, ROOD = "#b30000", GRIJS = "#666666";
  d.tickets.forEach((t, i) => {
    if (i) pdf.nieuwePagina();
    pdf.vlak(0, 0, 595, 8, ROOD);
    pdf.beeld(L, 40, 54, 54 * LOGO.h / LOGO.w, LOGO);
    pdf.tekst(L + 70, 48, "TICKET", { size: 10, bold: true, kleur: ROOD });
    pdf.tekst(L + 70, 64, c.naam, { size: 24, bold: true });
    pdf.tekst(L + 70, 94, [c.datum ? lang(c.datum) : "", c.deuren ? "deuren " + c.deuren : ""].filter(Boolean).join("  ·  "), { size: 11 });
    if (c.locatie) pdf.tekst(L + 70, 110, c.locatie, { size: 11, kleur: GRIJS });
    const q = qrMatrix(ticketUrl(t.code)), maat = 300, qx = (595 - maat) / 2, qy = 170;
    pdf.vlak(qx - 16, qy - 16, maat + 32, maat + 32, "#ffffff"); pdf.kader(qx - 16, qy - 16, maat + 32, maat + 32, "#dddddd", 1);
    pdf.qr(qx, qy, maat, q.n, q.donker);
    pdf.tekst(297.5, qy + maat + 34, t.code.replace(/(.{4})(?=.)/g, "$1 "), { size: 16, bold: true, align: "center" });
    pdf.tekst(297.5, qy + maat + 56, `Ticket ${t.nr} van ${d.tickets.length}`, { size: 11, kleur: GRIJS, align: "center" });
    let y = qy + maat + 100;
    pdf.lijn(L, y, R, y, "#dddddd"); y += 18;
    for (const [a, v] of [["Op naam van", [d.voornaam, d.naam].filter(Boolean).join(" ")], ["Bestelling", `${d.aantal} × ${geld(d.prijs)} = ${geld(d.bedrag)} (betaald)`]]) { pdf.tekst(L, y, a, { size: 9, kleur: GRIJS }); pdf.tekst(L + 110, y, v, { size: 10.5 }); y += 18; }
    y += 10;
    pdf.tekst(L, y, "Toon deze QR-code aan de kassa, op je gsm of afgedrukt. Elke code is één keer geldig.", { size: 9.5, kleur: GRIJS });
    pdf.vlak(0, 834, 595, 8, ROOD);
  });
  return Buffer.from(pdf.bytes({ titel: `Tickets ${c.naam}`, auteur: "VBHA" }));
}
export async function stuurTickets(sb, row, aan) {
  if (!smtpConfigured()) return false;
  const d = row.data, { c, A } = await fuifCfg(sb), naar = String(aan || d.email || "").trim();
  if (!naar || !(d.tickets || []).length) return false;
  const n = d.tickets.length;
  const html = p(`Beste ${esc(d.voornaam || "")},`.replace(" ,", ","))
    + p(`Bedankt voor je bestelling! Je betaling van <b>${eur(d.bedrag)}</b> is goed ontvangen. Hieronder ${n === 1 ? "vind je je ticket" : `vind je je ${n} tickets`} voor <b>${esc(c.naam)}</b>.`)
    + kaderBlok(esc(c.naam), tabel([rij("Wanneer", esc(wanneer(c))), rij("Waar", esc(c.locatie || "")), rij("Tickets", `${n} × ${eur(d.prijs)}`), rij("Op naam van", esc([d.voornaam, d.naam].filter(Boolean).join(" ")))]))
    + p(`Toon ${n === 1 ? "de QR-code" : "de QR-codes"} aan de kassa, op je gsm of afgedrukt. Elke code is één keer geldig${n > 1 ? ", dus geef je vrienden elk hun eigen ticket" : ""}. De tickets zitten ook als PDF in bijlage.`)
    + d.tickets.map(t => `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 16px;border:1px solid #e3e3e3;border-radius:8px"><tr><td align="center" style="padding:18px 12px">
      <div style="font-size:12px;letter-spacing:.12em;color:#b30000;font-weight:bold;margin:0 0 8px">TICKET ${t.nr} VAN ${n}</div>
      <img src="${qrUrl(t.code)}" alt="QR-code ticket ${t.nr}" width="220" height="220" style="display:block;width:220px;height:220px;border:0;margin:0 auto">
      <div style="font-family:Menlo,Consolas,monospace;font-size:16px;font-weight:bold;letter-spacing:.08em;margin-top:8px">${t.code.replace(/(.{4})(?=.)/g, "$1 ")}</div></td></tr></table>`).join("")
    + knop(n === 1 ? "Ticket online bekijken" : "Tickets online bekijken", bestelUrl(row.id, d.betaalToken))
    + (c.info ? p(esc(c.info), "margin:0 0 15px;font-size:13.5px;color:#666666") : "")
    + p("Tot op de fuif!");
  const [r] = await verstuur([{ aan: naar, aanNaam: [d.voornaam, d.naam].filter(Boolean).join(" "), onderwerp: `Je ${n === 1 ? "ticket" : "tickets"} voor ${c.naam}`, html: huisstijl(html, A.vereniging), van: afzender(), bijlagen: [{ naam: `Tickets ${c.naam}.pdf`, type: "application/pdf", data: ticketPdf(d, c) }] }]);
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

/* ---------- app: scannen en beheren (POST /api/mail?f=fuif) ---------- */
export async function fuifApi(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const b = body(req), actie = String(b.actie || "");
  if (actie === "scan" || actie === "bekijk") {
    const { user, sb } = await requireUser(req);
    const code = codeUit(b.code); if (!code) return res.status(200).json({ ok: false, reden: "Geen geldige ticketcode." });
    const r = await zoekTicket(sb, code); if (!r) return res.status(200).json({ ok: false, reden: "Onbekend ticket. Dit is geen ticket van onze fuif." });
    const d = r.data, t = d.tickets.find(x => x.code === code), { c } = await fuifCfg(sb);
    const info = { code, nr: t.nr, van: d.tickets.length, naam: [d.voornaam, d.naam].filter(Boolean).join(" "), bestelling: r.id, jaar: d.jaar };
    if (d.status !== "betaald") return res.status(200).json({ ok: false, reden: d.status === "geannuleerd" ? "Dit ticket werd geannuleerd." : "Dit ticket is niet betaald.", ...info });
    if (Number(d.jaar) !== Number(c.jaar)) return res.status(200).json({ ok: false, reden: `Dit ticket is voor de fuif van ${d.jaar}.`, ...info });
    if (t.gescand) return res.status(200).json({ ok: false, al: true, reden: "Dit ticket werd al gescand.", op: t.gescand.op, door: t.gescand.door, ...info });
    if (actie === "bekijk") return res.status(200).json({ ok: true, bekijk: true, ...info });
    const op = new Date().toISOString(), tickets = d.tickets.map(x => x.code === code ? { ...x, gescand: { op, door: user.email || "" } } : x);
    // alleen als het ticket intussen niet door een andere kassa gescand werd
    const { data: upd } = await sb.from("tickets").update({ data: { ...d, tickets } }).eq("id", r.id).not("data", "cs", JSON.stringify({ tickets: [{ code, gescand: {} }] })).select("id");
    if (!upd || !upd.length) return res.status(200).json({ ok: false, al: true, reden: "Dit ticket werd net al gescand.", ...info });
    const bin = tickets.filter(x => x.gescand).length;
    return res.status(200).json({ ok: true, op, binnen: bin, ...info });
  }
  const { sb, user } = await requireUser(req, { write: true });
  const { data: r } = await sb.from("tickets").select("id,data").eq("id", String(b.id || "")).maybeSingle();
  if (!r) throw httpErr(404, "Bestelling niet gevonden.");
  const d = r.data;
  if (actie === "mail") { if (d.status !== "betaald") throw httpErr(400, "Deze bestelling is niet betaald."); const ok = await stuurTickets(sb, r, clean(b.aan, 120) || d.email); if (!ok) throw httpErr(502, "Versturen lukte niet."); return res.status(200).json({ ok: true }); }
  if (actie === "pdf") { if (d.status !== "betaald") throw httpErr(400, "Deze bestelling is niet betaald."); const { c } = await fuifCfg(sb); return res.status(200).json({ ok: true, naam: `Tickets ${c.naam} ${d.voornaam} ${d.naam}.pdf`, pdf: ticketPdf(d, c).toString("base64") }); }
  if (actie === "ontscan") { const code = codeUit(b.code); const tickets = d.tickets.map(x => x.code === code ? { ...x, gescand: null } : x); await sb.from("tickets").update({ data: { ...d, tickets } }).eq("id", r.id); return res.status(200).json({ ok: true }); }
  if (actie === "annuleer") {
    if (d.status === "geannuleerd") return res.status(200).json({ ok: true });
    if (d.punten) await puntenBij(sb, d.punten.lidId, d.punten.jaar, -d.punten.aantal);
    await sb.from("tickets").update({ data: { ...d, status: "geannuleerd", geannuleerd: { op: new Date().toISOString(), door: user.email || "" }, punten: null } }).eq("id", r.id);
    return res.status(200).json({ ok: true });
  }
  if (actie === "koppel") { // tickets (alsnog) aan een lid toekennen voor het puntensysteem, of loskoppelen
    const lidId = clean(b.lidId, 80) || null;
    if (d.punten) await puntenBij(sb, d.punten.lidId, d.punten.jaar, -d.punten.aantal);
    let naam = null; if (lidId) { const { data: l } = await sb.from("leden").select("data").eq("id", lidId).maybeSingle(); if (!l) throw httpErr(404, "Lid niet gevonden."); naam = `${l.data.naam || ""} ${l.data.voornaam || ""}`.trim(); }
    const punten = lidId && d.status === "betaald" ? { lidId, jaar: d.jaar, aantal: (d.tickets || []).length } : null;
    if (punten) await puntenBij(sb, punten.lidId, punten.jaar, punten.aantal);
    await sb.from("tickets").update({ data: { ...d, via: lidId ? { ...(d.via || {}), lidId, naam, tekst: (d.via && d.via.tekst) || naam } : (d.via ? { ...d.via, lidId: null, naam: null } : null), punten } }).eq("id", r.id);
    return res.status(200).json({ ok: true });
  }
  if (actie === "controle") { const { controleerBetaling } = await import("./betaal.js"); const s = await controleerBetaling(sb, "tickets", r); return res.status(200).json({ ok: true, status: s && s.status }); }
  throw httpErr(400, "Onbekende actie.");
}
