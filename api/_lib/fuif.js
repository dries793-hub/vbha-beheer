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

export const FUIF_DEF = { naam: "In Vier en Vlam", datum: "", deuren: "", locatie: "", prijs: 5, open: true, max: 0, perBestelling: 10, info: "", drankAan: true, drank: [20, 50], drankKorting: 10 };
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
    if (req.method === "GET" && q.qr) {
      const code = String(q.qr).toUpperCase(); if (!CODE_RE.test(code)) throw httpErr(404, "Niet gevonden");
      res.setHeader("Content-Type", "image/png"); res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.status(200).send(qrPng(ticketUrl(code), 8, 4));
    }
    res.setHeader("Cache-Control", "no-store");
    const { c, A } = await fuifCfg(sb);
    const ev = { naam: c.naam, datum: c.datum, datumTekst: c.datum ? lang(c.datum) : "", deuren: c.deuren, locatie: c.locatie, info: c.info, jaar: c.jaar };
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
    if (req.method === "GET" && q.zoek != null) {
      await rateLimit(sb, req, "fuifzoek", 120, 600, httpErr);
      return res.status(200).json(zoekLeden(await fuifLeden(sb, c.jaar), String(q.zoek)).map(l => ({ id: l.id, naam: l.naam })));
    }
    if (req.method === "GET") {
      const n = c.max ? await bezet(sb, c.jaar) : 0, vrij = c.max ? Math.max(0, c.max - n) : null;
      const voorbij = isVoorbij(c);
      return res.status(200).json({ ...ev, prijs: c.prijs, open: c.open !== false && !!c.datum && !voorbij && (vrij == null || vrij > 0), gesloten: c.open === false || !c.datum ? "manueel" : voorbij ? "voorbij" : vrij === 0 ? "uitverkocht" : null, vrij, verkoopTot: verkoopTot(c), perBestelling: c.perBestelling, dranken: c.dranken, drankKorting: c.drankKorting, online: onlineConfigured(), vereniging: A.vereniging });
    }
    if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");

    // ---- bestellen ----
    const b = body(req);
    if (String(b.actie || "").startsWith("kassa-")) return await kassaApi(sb, req, res, b, c);
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
const naamVan = t => isDrank(t) ? `Drankkaart ${geld(t.waarde).replace(",00", "")}` : "Ticket";
export function ticketPdf(d, c) {
  const pdf = new Pdf(), L = 60, R = 535, ROOD = "#b30000", GRIJS = "#666666", GOUD = "#b07a12";
  const nT = d.tickets.filter(t => !isDrank(t)).length;
  d.tickets.forEach((t, i) => {
    if (i) pdf.nieuwePagina();
    const dr = isDrank(t), kl = dr ? GOUD : ROOD, van = dr ? d.tickets.filter(x => isDrank(x) && x.waarde === t.waarde).length : nT;
    pdf.vlak(0, 0, 595, 8, kl);
    pdf.beeld(L, 40, 54, 54 * LOGO.h / LOGO.w, LOGO);
    pdf.tekst(L + 70, 48, dr ? "DRANKKAART · VOORVERKOOP" : "TICKET", { size: 10, bold: true, kleur: kl });
    pdf.tekst(L + 70, 64, dr ? `Drankkaart ${geld(t.waarde).replace(",00", "")}` : c.naam, { size: 24, bold: true });
    pdf.tekst(L + 70, 94, dr ? `${c.naam}  ·  ${c.datum ? lang(c.datum) : ""}` : [c.datum ? lang(c.datum) : "", c.deuren ? "deuren " + c.deuren : ""].filter(Boolean).join("  ·  "), { size: 11 });
    if (c.locatie) pdf.tekst(L + 70, 110, c.locatie, { size: 11, kleur: GRIJS });
    const q = qrMatrix(ticketUrl(t.code)), maat = 300, qx = (595 - maat) / 2, qy = 170;
    pdf.vlak(qx - 16, qy - 16, maat + 32, maat + 32, "#ffffff"); pdf.kader(qx - 16, qy - 16, maat + 32, maat + 32, dr ? GOUD : "#dddddd", 1);
    pdf.qr(qx, qy, maat, q.n, q.donker);
    pdf.tekst(297.5, qy + maat + 34, t.code.replace(/(.{4})(?=.)/g, "$1 "), { size: 16, bold: true, align: "center" });
    pdf.tekst(297.5, qy + maat + 56, `${naamVan(t)} ${t.nr} van ${van}`, { size: 11, kleur: GRIJS, align: "center" });
    let y = qy + maat + 100;
    pdf.lijn(L, y, R, y, "#dddddd"); y += 18;
    pdf.tekst(L, y, "Op naam van", { size: 9, kleur: GRIJS }); pdf.tekst(L + 110, y, [d.voornaam, d.naam].filter(Boolean).join(" "), { size: 10.5 }); y += 28;
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
  const html = p(`Beste ${esc(d.voornaam || "")},`.replace(" ,", ","))
    + p(`Bedankt voor je bestelling! Je betaling van <b>${eur(d.bedrag)}</b> is goed ontvangen. Hieronder vind je ${wat} voor <b>${esc(c.naam)}</b>.`)
    + kaderBlok(esc(c.naam), tabel([rij("Wanneer", esc(wanneer(c))), rij("Waar", esc(c.locatie || "")), n ? rij("Tickets", `${n} × ${eur(d.prijs)}`) : "",
      ...(d.drank || []).map(k => rij(`Drankkaart ${eur(k.waarde)}`, `${k.aantal} × ${eur(k.prijs)} <span style="color:#1a7f45">(voorverkoop, je bespaart ${eur((k.waarde - k.prijs) * k.aantal)})</span>`)),
      rij("Op naam van", esc([d.voornaam, d.naam].filter(Boolean).join(" ")))]))
    + (d.korting > 0 ? p(`<b style="color:#1a7f45">Dankzij de voorverkoop bespaar je ${eur(d.korting)} op je drankkaarten.</b>`) : "")
    + p(`Toon de QR-codes aan de kassa, op je gsm of afgedrukt. Elke code is één keer geldig${n > 1 ? ", dus geef je vrienden elk hun eigen ticket" : ""}.${D.length ? " Je drankkaarten wissel je aan de kassa om met de gele QR-codes." : ""} Alles zit ook als PDF in bijlage.`)
    + T.map(t => blok(t, `TICKET ${t.nr} VAN ${n}`, "#b30000")).join("")
    + D.map(t => blok(t, `DRANKKAART ${eur(t.waarde).replace(",00", "")} · ${t.nr} VAN ${D.filter(x => x.waarde === t.waarde).length}`, "#b07a12")).join("")
    + knop("Online bekijken", bestelUrl(row.id, d.betaalToken))
    + p("Gekochte tickets en drankkaarten worden niet terugbetaald en kunnen niet geannuleerd worden.", "margin:0 0 15px;font-size:13.5px;color:#666666")
    + (c.info ? p(esc(c.info), "margin:0 0 15px;font-size:13.5px;color:#666666") : "")
    + p("Tot op de fuif!");
  const ond = n ? `Je ${n === 1 ? "ticket" : "tickets"} voor ${c.naam}` : `Je ${D.length === 1 ? "drankkaart" : "drankkaarten"} voor ${c.naam}`;
  const [r] = await verstuur([{ aan: naar, aanNaam: [d.voornaam, d.naam].filter(Boolean).join(" "), onderwerp: ond, html: huisstijl(html, A.vereniging), van: afzender(), bijlagen: [{ naam: `Tickets ${c.naam}.pdf`, type: "application/pdf", data: ticketPdf(d, c) }] }]);
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
// Gastlogin kassa: een kassacode (ingesteld in de app) geeft 24 uur lang enkel toegang tot scannen.
const kassaSleutel = () => String(process.env.BETAAL_GEHEIM || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const kassaSig = (exp, code) => crypto.createHmac("sha256", kassaSleutel()).update(`vbha-kassa|${exp}|${String(code).toUpperCase()}`).digest("base64url").slice(0, 32);
function kassaOk(c, token) {
  const code = c.kassa && c.kassa.code; if (!code || !kassaSleutel()) return false;
  const [exp, sig] = String(token || "").split("."); if (!/^\d{10,13}$/.test(exp || "") || Number(exp) < Date.now()) return false;
  const a = Buffer.from(kassaSig(exp, code)), b = Buffer.from(String(sig || "")); return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// aanbod aan de kassa: inkom aan kassaprijs en drankkaarten aan volle waarde
export const kassaAanbod = c => ({ kassaPrijs: Math.max(0, Number(c.kassaPrijs) || Number(c.prijs) || 0), dranken: (Array.isArray(c.drank) ? c.drank : []).map(Number).filter(v => v > 0 && v <= 500).sort((a, b) => a - b).map(v => ({ id: "d" + String(v).replace(/\D/g, ""), waarde: v })) });
async function kassaApi(sb, req, res, b, c) {
  if (b.actie === "kassa-login") {
    await rateLimit(sb, req, "kassalogin", 10, 900, httpErr);
    const code = c.kassa && c.kassa.code, in_ = String(b.code || "").trim().toUpperCase().replace(/\s+/g, "");
    const a = Buffer.from(String(code || "").toUpperCase()), x = Buffer.from(in_);
    if (!code || a.length !== x.length || !crypto.timingSafeEqual(a, x)) throw httpErr(403, "Deze kassacode klopt niet.");
    const exp = String(Date.now() + 24 * 3600 * 1000);
    return res.status(200).json({ ok: true, token: exp + "." + kassaSig(exp, code), naam: c.naam, tot: Number(exp) });
  }
  if (!kassaOk(c, b.token)) throw httpErr(401, "Je kassatoegang is verlopen. Geef de kassacode opnieuw in.");
  await rateLimit(sb, req, "kassascan", 600, 600, httpErr);
  if (b.actie === "kassa-scan") return res.status(200).json(await scanTicket(sb, b.code, "kassa (gast)", false));
  if (b.actie === "kassa-stand") {
    const L = (await bestellingen(sb, c.jaar)).filter(r => r.data.status === "betaald"), on = L.filter(r => r.data.bron !== "kassa"), ka = L.filter(r => r.data.bron === "kassa");
    const T = on.flatMap(r => (r.data.tickets || []).filter(x => !isDrank(x))), kT = ka.reduce((n, r) => n + (Number(r.data.aantal) || 0), 0);
    return res.status(200).json({ ok: true, tickets: T.length, binnen: T.filter(x => x.gescand).length + kT, kassa: { tickets: kT, bedrag: Math.round(ka.reduce((n, r) => n + (Number(r.data.bedrag) || 0), 0) * 100) / 100 }, naam: c.naam, ...kassaAanbod(c) });
  }
  if (b.actie === "kassa-verkoop") {
    const A = kassaAanbod(c), want = b.items || {}, cash = b.betaalwijze === "cash";
    const aantal = Math.max(0, Math.min(100, Math.floor(Number(want.ticket)) || 0));
    const drank = A.dranken.map(k => ({ id: k.id, waarde: k.waarde, prijs: k.waarde, aantal: Math.max(0, Math.min(100, Math.floor(Number(want[k.id])) || 0)) })).filter(k => k.aantal);
    if (!aantal && !drank.length) throw httpErr(400, "Kies minstens één kaart.");
    const bedrag = Math.round((aantal * A.kassaPrijs + drank.reduce((n, k) => n + k.aantal * k.waarde, 0)) * 100) / 100;
    const id = "k" + c.jaar + "-" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex"), token = crypto.randomBytes(18).toString("base64url");
    const row = { id, data: { jaar: c.jaar, bron: "kassa", voornaam: "Kassa", naam: "", aantal, prijs: A.kassaPrijs, drank, bedrag, betaalwijze: cash ? "cash" : "bancontact", aangemeld: new Date().toISOString(), betaalToken: token, status: cash ? "betaald" : "wacht", tickets: [], ...(cash ? { betaaldOp: new Date().toISOString() } : {}) } };
    const { error } = await sb.from("tickets").insert(row); if (error) throw error;
    if (cash) return res.status(200).json({ ok: true, id, bedrag, status: "SUCCEEDED" });
    if (!onlineConfigured()) { await sb.from("tickets").delete().eq("id", id); throw httpErr(501, "Bancontact is niet ingesteld."); }
    const { startBetaling } = await import("./betaal.js");
    let bt; try { bt = await startBetaling(sb, req, "tickets", row, { bedrag, jaar: c.jaar, terug: "/kassa" }); }
    catch (e) { console.error("kassa betaling", e); await sb.from("tickets").delete().eq("id", id); throw httpErr(502, "De betaling kon niet gestart worden. Probeer opnieuw."); }
    return res.status(200).json({ ok: true, id, token, bedrag, qrcode: bt.qrcode, deeplink: bt.deeplink, verlooptOp: bt.verlooptOp });
  }
  if (b.actie === "kassa-status" || b.actie === "kassa-stop") {
    const { data: row } = await sb.from("tickets").select("id,data").eq("id", String(b.id || "")).maybeSingle();
    if (!row || row.data.bron !== "kassa") throw httpErr(404, "Verkoop niet gevonden.");
    if (b.actie === "kassa-stop") { if (row.data.status === "wacht") await sb.from("tickets").update({ data: { ...row.data, status: "verlopen", gestopt: new Date().toISOString() } }).eq("id", row.id).eq("data->>status", "wacht"); return res.status(200).json({ ok: true }); }
    if (row.data.status === "betaald") return res.status(200).json({ ok: true, status: "SUCCEEDED" });
    const { controleerBetaling } = await import("./betaal.js");
    const st = await controleerBetaling(sb, "tickets", row);
    return res.status(200).json({ ok: true, status: st && st.status });
  }
  if (b.actie === "kassa-nieuweqr") {
    const { data: row } = await sb.from("tickets").select("id,data").eq("id", String(b.id || "")).maybeSingle();
    if (!row || row.data.bron !== "kassa" || row.data.status !== "wacht") throw httpErr(404, "Verkoop niet gevonden.");
    const { startBetaling } = await import("./betaal.js");
    const bt = await startBetaling(sb, req, "tickets", row, { bedrag: row.data.bedrag, jaar: row.data.jaar, terug: "/kassa" });
    return res.status(200).json({ ok: true, qrcode: bt.qrcode, deeplink: bt.deeplink, verlooptOp: bt.verlooptOp });
  }
  throw httpErr(400, "Onbekende actie.");
}

/* ---------- app: scannen en beheren (POST /api/mail?f=fuif) ---------- */
export async function fuifApi(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const b = body(req), actie = String(b.actie || "");
  if (actie === "scan" || actie === "bekijk") {
    const { user, sb } = await requireUser(req);
    return res.status(200).json(await scanTicket(sb, b.code, user.email || "", actie === "bekijk"));
  }
  const { sb, user, rol } = await requireUser(req, { write: true });
  const { data: r } = await sb.from("tickets").select("id,data").eq("id", String(b.id || "")).maybeSingle();
  if (!r) throw httpErr(404, "Bestelling niet gevonden.");
  const d = r.data;
  if (actie === "mail") { if (d.status !== "betaald") throw httpErr(400, "Deze bestelling is niet betaald."); const ok = await stuurTickets(sb, r, clean(b.aan, 120) || d.email); if (!ok) throw httpErr(502, "Versturen lukte niet."); return res.status(200).json({ ok: true }); }
  if (actie === "pdf") { if (d.status !== "betaald") throw httpErr(400, "Deze bestelling is niet betaald."); const { c } = await fuifCfg(sb); return res.status(200).json({ ok: true, naam: `Tickets ${c.naam} ${d.voornaam} ${d.naam}.pdf`, pdf: ticketPdf(d, c).toString("base64") }); }
  if (actie === "ontscan") { const code = codeUit(b.code); const tickets = d.tickets.map(x => x.code === code ? { ...x, gescand: null } : x); await sb.from("tickets").update({ data: { ...d, tickets } }).eq("id", r.id); return res.status(200).json({ ok: true }); }
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
