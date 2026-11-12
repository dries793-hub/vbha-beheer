/* Terugbetalingen en onkostennota's (geld dat de vriendenkring aan iemand moet betalen).
   Tabel terugbetalingen (enkel via de server): {id, status, data}
     status: aangevraagd (link verstuurd, wacht op IBAN) | ingediend (wacht op goedkeuring) | goedgekeurd (klaar om te betalen)
             | betaald | geweigerd
     data: {soort:"terugbetaling"|"onkosten", naam, email, bedrag, reden, iban, datum, bon:{pad,type,naam}, lidId, door, op, ...}
   - App (functie facturen): POST /api/mail?f=terug {actie: lijst | maak | zet | weg | bon}
   - Openbaar: /api/terug  GET ?i&t (persoonlijke link) · POST {i,t,iban,naam} · POST {actie:"onkost", ...} (onkostennota indienen)
   Een IBAN wordt nooit in de openbare pagina teruggetoond. */
import crypto from "node:crypto";
import { admin, httpErr, sendError, requireUser, isAdminRol } from "./sb.js";
import { body, rateLimit, clean, vandaagISO } from "./publiek.js";

const BUCKET = "documenten";
const sleutel = () => String(process.env.BETAAL_GEHEIM || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
export const tbToken = id => crypto.createHmac("sha256", sleutel()).update(`vbha-terug|${id}`).digest("base64url").slice(0, 22);
const klopt = (id, t) => { if (!sleutel() || !id || typeof t !== "string") return false; const a = Buffer.from(tbToken(id)), b = Buffer.from(t); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const site = () => "https://vbha.be"; // openbare links altijd via het eigen domein
export const tbLink = id => `${site()}/onkosten?i=${encodeURIComponent(id)}&t=${tbToken(id)}`;
export const onkostLink = () => `${site()}/onkosten`;
const nu = () => new Date().toISOString();
const r2 = n => Math.round(n * 100) / 100;
export function ibanOk(i) {
  i = String(i || "").replace(/\s+/g, "").toUpperCase(); if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(i)) return false;
  const r = (i.slice(4) + i.slice(0, 4)).replace(/[A-Z]/g, c => c.charCodeAt(0) - 55); let m = 0; for (const ch of r) m = (m * 10 + Number(ch)) % 97; return m === 1;
}
const bedragVan = v => { const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return n > 0 && n < 100000 ? r2(n) : 0; };
const mailOk = e => !e || /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(e);

/* rekeningnummer van een vorige terugbetaling of onkostennota onthouden (zelfde lid, anders zelfde naam) */
async function lidIbanZet(sb, lidId, iban, bron) { if (!lidId || !ibanOk(iban)) return; try { await sb.from("lid_iban").upsert({ lid_id: lidId, iban: String(iban).replace(/\s+/g, "").toUpperCase(), bron: String(bron || "").slice(0, 60), op: nu() }); } catch (e) { console.error("lid_iban", e); } }
async function bekendIban(sb, lidId, naam) {
  if (lidId) { const { data } = await sb.from("lid_iban").select("iban").eq("lid_id", lidId).maybeSingle(); if (data && ibanOk(data.iban)) return data.iban; }
  const q = sb.from("terugbetalingen").select("data,gemaakt").neq("data->>iban", "").order("gemaakt", { ascending: false }).limit(1);
  if (lidId) { const { data } = await q.eq("data->>lidId", lidId); if (data && data[0] && ibanOk(data[0].data.iban)) return data[0].data.iban; }
  const n = String(naam || "").trim(); if (!n) return "";
  const { data } = await sb.from("terugbetalingen").select("data,gemaakt").neq("data->>iban", "").ilike("data->>naam", n.replace(/[%_]/g, "")).order("gemaakt", { ascending: false }).limit(1);
  return data && data[0] && ibanOk(data[0].data.iban) ? data[0].data.iban : "";
}
/* bon (foto of PDF) bewaren: in de browser al verkleind; max. 4 MB */
async function bonBewaar(sb, id, b) {
  if (!b || !b.data) return null;
  const m = String(b.data).match(/^data:(image\/jpeg|image\/png|application\/pdf);base64,([A-Za-z0-9+/=]+)$/); if (!m) throw httpErr(400, "Enkel een foto of een PDF als bewijsstuk.");
  const buf = Buffer.from(m[2], "base64"); if (buf.length > 4e6) throw httpErr(413, "Het bewijsstuk is te groot (max. 4 MB).");
  const ext = m[1] === "application/pdf" ? "pdf" : m[1] === "image/png" ? "png" : "jpg", pad = `Onkosten/${id}-${Date.now().toString(36)}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(pad, buf, { contentType: m[1] }); if (error) throw error;
  return { pad, type: m[1], naam: clean(b.naam, 120) || "bewijsstuk." + ext };
}

/* ---------- openbaar ---------- */
export default async function terugPubliek(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const sb = admin(), b = req.method === "POST" ? body(req) : (req.query || {});
    if (req.method === "POST" && b.actie === "onkost") { // onkostennota indienen (zonder link)
      await rateLimit(sb, req, "onkost", 8, 3600, httpErr);
      if (b.website) return res.status(200).json({ ok: true }); // honeypot
      const naam = clean(b.naam, 80), email = clean(b.email, 160), iban = String(b.iban || "").replace(/\s+/g, "").toUpperCase(), bedrag = bedragVan(b.bedrag), reden = clean(b.reden, 300), datum = /^\d{4}-\d{2}-\d{2}$/.test(b.datum || "") ? b.datum : vandaagISO();
      if (!naam) throw httpErr(400, "Vul je naam in.");
      if (!mailOk(email)) throw httpErr(400, "Dit e-mailadres klopt niet.");
      if (iban && !ibanOk(iban)) throw httpErr(400, "Dit rekeningnummer (IBAN) klopt niet.");
      if (!bedrag) throw httpErr(400, "Vul een geldig bedrag in.");
      if (!reden) throw httpErr(400, "Schrijf kort waarvoor de kosten waren.");
      // gekozen lid: e-mailadres en lidnummer uit de ledenlijst (het formulier vraagt geen e-mailadres meer)
      let lidId = "", lidMail = "";
      if (b.lidId) { const { data: l } = await sb.from("leden").select("id,data").eq("id", String(b.lidId).slice(0, 60)).maybeSingle(); if (l && !l.data.geenLid) { lidId = l.id; lidMail = String(l.data.email || "").trim(); } }
      const ibanOk2 = iban || await bekendIban(sb, lidId, lidId ? "" : naam);
      // via het openbare formulier mag een gekend rekeningnummer van een lid nooit overschreven worden (iedereen kan een naam kiezen)
      let gekend = ""; if (iban && lidId) { const { data: g } = await sb.from("lid_iban").select("iban").eq("lid_id", lidId).maybeSingle(); gekend = g && ibanOk(g.iban) ? g.iban : ""; }
      const ibanAnders = !!(gekend && gekend !== iban);
      if (!ibanOk2) throw httpErr(400, "Vul je rekeningnummer (IBAN) in.");
      const id = "ok-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const bon = await bonBewaar(sb, id, b.bon);
      const { error } = await sb.from("terugbetalingen").insert({ id, status: "ingediend", data: { soort: "onkosten", naam, email: email || (mailOk(lidMail) ? lidMail : ""), lidId, iban: ibanOk2, ibanVorig: !iban, bedrag, reden, datum, bon, ...(!bon && b.geenBon ? { geenBon: true } : {}), ...(ibanAnders ? { ibanAnders: gekend.slice(-4) } : {}), op: nu(), nieuw: true } });
      if (error) throw error;
      if (iban && lidId && !gekend) await lidIbanZet(sb, lidId, iban, "onkostennota");
      try { const { meldPush } = await import("./push.js"); await meldPush(sb, "boek", { titel: "Nieuwe onkostennota", tekst: `${naam} · € ${bedrag.toFixed(2).replace(".", ",")} · ${reden.slice(0, 60)}`, url: "/#terug", tag: "tb-" + id }); } catch (e) { console.error("push onkost", e); }
      return res.status(200).json({ ok: true });
    }
    if (req.method === "GET" && b.lid) { // onkostenformulier: gekend rekeningnummer van het gekozen lid, gedeeltelijk verborgen
      await rateLimit(sb, req, "lidiban", 30, 600, httpErr);
      const { data } = await sb.from("lid_iban").select("iban").eq("lid_id", String(b.lid).slice(0, 60)).maybeSingle();
      const ib = data && ibanOk(data.iban) ? String(data.iban) : "";
      return res.status(200).json({ ok: true, iban: ib ? ib.slice(0, 4) + " •••• •••• " + ib.slice(-4) : "" });
    }
    // persoonlijke link: IBAN doorgeven voor een terugbetaling
    const id = String(b.i || ""), t = String(b.t || "");
    if (!klopt(id, t)) throw httpErr(404, "Deze link is niet (meer) geldig.");
    const { data: row } = await sb.from("terugbetalingen").select("id,data,status").eq("id", id).maybeSingle();
    if (!row) throw httpErr(404, "Deze link is niet (meer) geldig.");
    const d = row.data || {}, toon = () => ({ ok: true, naam: d.naam || "", bedrag: d.bedrag, reden: d.reden || "", status: row.status, ibanGekend: !!d.iban, ibanEind: d.iban ? String(d.iban).slice(-4) : "" });
    if (req.method === "GET") return res.status(200).json(toon());
    if (req.method !== "POST") throw httpErr(405, "Niet toegelaten");
    await rateLimit(sb, req, "terug", 20, 3600, httpErr);
    if (["betaald", "geweigerd"].includes(row.status)) throw httpErr(409, row.status === "betaald" ? "Deze terugbetaling is al uitgevoerd." : "Deze aanvraag is afgesloten.");
    const iban = String(b.iban || "").replace(/\s+/g, "").toUpperCase(); if (!ibanOk(iban)) throw httpErr(400, "Dit rekeningnummer (IBAN) klopt niet.");
    const tnv = clean(b.tnv, 80) || d.naam;
    const nieuw = { ...d, iban, tnv, ibanOp: nu(), nieuw: true };
    const { error } = await sb.from("terugbetalingen").update({ data: nieuw, status: row.status === "aangevraagd" ? "goedgekeurd" : row.status, gewijzigd: nu() }).eq("id", id); if (error) throw error;
    if (d.lidId) await lidIbanZet(sb, d.lidId, iban, "terugbetaling");
    try { const { meldPush } = await import("./push.js"); await meldPush(sb, "boek", { titel: "Rekeningnummer doorgegeven", tekst: `${d.naam} · € ${Number(d.bedrag).toFixed(2).replace(".", ",")} klaar om terug te betalen`, url: "/#terug", tag: "tb-" + id }); } catch (e) { console.error("push terug", e); }
    d.iban = iban; return res.status(200).json({ ...toon(), ibanGekend: true, ibanEind: iban.slice(-4), status: row.status === "aangevraagd" ? "goedgekeurd" : row.status });
  } catch (e) { sendError(res, e); }
}

/* ---------- app ---------- */
export async function terugApp(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") throw httpErr(405, "Gebruik POST");
    const b = body(req);
    // iedereen van het bestuur mag een terugbetaling ingeven en zijn eigen aanvragen zien, bewerken of verwijderen (zolang niet betaald);
    // goedkeuren, betalen en alles van anderen: enkel admin en wie Terugbetalingen mag bewerken (boekhouding)
    const { user, rol, rechten } = await requireUser(req), adm = isAdminRol(rol);
    const vol = adm || (rechten ? rechten.terug === "bewerken" : rol === "boekhouder");
    const ibanRecht = vol || !!(rechten && (rechten.facturen === "bewerken" || rechten.financien === "bewerken"));
    const sb = admin();
    const { data: mij } = await sb.from("leden").select("id").ilike("data->>email", String(user.email || "").replace(/[%_]/g, "")).limit(1);
    const mijnLid = mij && mij[0] ? mij[0].id : "";
    const eigen = r => !!r && !!r.data && (r.data.doorId === user.id || (!!mijnLid && r.data.lidId === mijnLid && !r.data.doorId));
    const vrij = r => eigen(r) && !["betaald", "goedgekeurd"].includes(r.status);
    const masker = ib => ib ? String(ib).slice(0, 4) + " •••• •••• " + String(ib).slice(-4) : "";
    let wie = user.email || ""; try { const { data } = await sb.from("bestuur").select("naam").eq("user_id", user.id).maybeSingle(); if (data && data.naam) wie = data.naam; } catch {}
    const lijst = async () => { const { data, error } = await sb.from("terugbetalingen").select("id,data,status,gemaakt,gewijzigd").order("gemaakt", { ascending: false }).limit(300); if (error) throw error;
      return { ok: true, vol, lijst: (data || []).filter(r => vol || eigen(r)).map(r => ({ ...r, eigen: eigen(r), ...(vol ? {} : { data: { ...r.data, iban: masker(r.data.iban) } }), link: vol && r.data.soort === "terugbetaling" ? tbLink(r.id) : null })), onkostLink: onkostLink() }; };
    if (b.actie === "lijst") return res.status(200).json(await lijst());
    if (b.actie === "bon") {
      const { data: r } = await sb.from("terugbetalingen").select("data,status").eq("id", String(b.id || "")).maybeSingle(); if (!r || !r.data.bon || !(vol || eigen(r))) throw httpErr(404, "Geen bewijsstuk.");
      const { data } = await sb.storage.from(BUCKET).createSignedUrl(r.data.bon.pad, 600); return res.status(200).json({ ok: true, url: data ? data.signedUrl : "" });
    }
    if (b.actie === "lidiban" && !ibanRecht) { // gewone gebruiker: gedeeltelijk verborgen (voor het formulier)
      const { data } = await sb.from("lid_iban").select("iban").eq("lid_id", String(b.lidId || "")).maybeSingle(); return res.status(200).json({ ok: true, iban: "", masker: data && ibanOk(data.iban) ? masker(data.iban) : "" }); }
    if (b.actie === "lidiban") { const { data } = await sb.from("lid_iban").select("iban,bron,op").eq("lid_id", String(b.lidId || "")).maybeSingle(); return res.status(200).json({ ok: true, iban: data ? data.iban : "", op: data ? data.op : null }); }
    if (b.actie !== "maak" && !["bewerk", "weg"].includes(b.actie) && !vol && !(ibanRecht && b.actie === "lidibanZet")) throw httpErr(403, "Je hebt hiervoor geen rechten");
    if (b.actie === "lidibanZet") { const lidId = clean(b.lidId, 60), iban = String(b.iban || "").replace(/\s+/g, "").toUpperCase(); if (!lidId) throw httpErr(400, "Geen lid.");
      if (!iban) { await sb.from("lid_iban").delete().eq("lid_id", lidId); return res.status(200).json({ ok: true, iban: "" }); }
      if (!ibanOk(iban)) throw httpErr(400, "Dit IBAN-nummer klopt niet."); await lidIbanZet(sb, lidId, iban, "app"); return res.status(200).json({ ok: true, iban }); }
    if (b.actie === "mailOnkost") { // algemene link voor onkostennota's naar een lid mailen (gekend e-mailadres uit de ledenlijst)
      const { data: l } = await sb.from("leden").select("id,data").eq("id", String(b.lidId || "")).maybeSingle();
      if (!l) throw httpErr(404, "Lid niet gevonden."); const aan = String(l.data.email || "").trim(); if (!mailOk(aan) || !aan) throw httpErr(400, "Van dit lid is geen e-mailadres gekend.");
      const { huisstijl, kaderBlok, knop, p, esc } = await import("./bevestiging.js");
      const html = huisstijl(p(`Beste ${esc(l.data.voornaam || "lid")},`)
        + p("Heb je kosten gemaakt voor de Vriendenkring? Via de knop hieronder vraag je ze eenvoudig terug.")
        + kaderBlok("Hoe werkt het?", p("Kies je naam, vul het bedrag en de reden in, voeg een foto van het kasticket of de factuur toe en geef je rekeningnummer door. Na goedkeuring storten we het bedrag terug.", "margin:0"))
        + knop("Onkosten terugvragen", onkostLink()), "Vriendenkring Brandweer Hoofdpost Aalst");
      const { error } = await sb.from("mail_wachtrij").insert({ batch: "onkost-" + l.id + "-" + Date.now().toString(36), data: { aan, aanNaam: `${l.data.voornaam || ""} ${l.data.naam || ""}`.trim(), onderwerp: "Onkosten terugvragen bij de Vriendenkring", html, label: "Onkostennota" } });
      if (error) throw error;
      return res.status(200).json({ ok: true, aan });
    }
    if (b.actie === "maak") { // terugbetaling aanmaken: link om het IBAN op te vragen (of meteen met IBAN)
      const naam = clean(b.naam, 80), bedrag = bedragVan(b.bedrag), reden = clean(b.reden, 300), email = clean(b.email, 160), iban = String(b.iban || "").replace(/\s+/g, "").toUpperCase();
      if (!naam) throw httpErr(400, "Vul de naam in."); if (!bedrag) throw httpErr(400, "Vul een geldig bedrag in."); if (!reden) throw httpErr(400, "Vul de reden in.");
      if (!mailOk(email)) throw httpErr(400, "Dit e-mailadres klopt niet."); if (iban && !ibanOk(iban)) throw httpErr(400, "Dit IBAN-nummer klopt niet.");
      const id = "tb-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), lidId = clean(b.lidId, 60);
      const vorig = iban ? "" : await bekendIban(sb, lidId, naam), ib = iban || vorig;
      let em = email; if (!em && lidId) { const { data: l } = await sb.from("leden").select("data").eq("id", lidId).maybeSingle(); const m = String(l?.data?.email || "").trim(); if (m && mailOk(m)) em = m; }
      const datum = /^\d{4}-\d{2}-\d{2}$/.test(b.datum || "") ? b.datum : "", bon = await bonBewaar(sb, id, b.bon);
      let ibanAnders = ""; if (!vol && iban && lidId) { const { data: g } = await sb.from("lid_iban").select("iban").eq("lid_id", lidId).maybeSingle(); if (g && ibanOk(g.iban) && g.iban !== iban) ibanAnders = g.iban.slice(-4); }
      const { error } = await sb.from("terugbetalingen").insert({ id, status: vol ? (ib ? "goedgekeurd" : "aangevraagd") : "ingediend", data: { soort: vol ? "terugbetaling" : "onkosten", doorId: user.id, ...(vol ? {} : { nieuw: true }), ...(ibanAnders ? { ibanAnders } : {}), naam, email: em, bedrag, reden, ...(datum ? { datum } : {}), ...(bon ? { bon } : {}), ...(!bon && b.geenBon ? { geenBon: true } : {}), iban: ib || "", ...(vorig ? { ibanVorig: true } : {}), lidId, categorie: clean(b.categorie, 60), door: wie, op: nu() } });
      if (error) throw error;
      if (iban && lidId && (vol || !ibanAnders)) await lidIbanZet(sb, lidId, iban, "app");
      if (!vol) try { const { meldPush } = await import("./push.js"); await meldPush(sb, "boek", { titel: "Nieuwe onkostennota", tekst: `${naam} · € ${bedrag.toFixed(2).replace(".", ",")} · ${reden.slice(0, 60)}`, url: "/#terug", tag: "tb-" + id }); } catch (e) { console.error("push onkost", e); }
      return res.status(200).json({ ...(await lijst()), id, link: vol ? tbLink(id) : null, ibanVorig: !!vorig });
    }
    const { data: row } = await sb.from("terugbetalingen").select("id,data,status").eq("id", String(b.id || "")).maybeSingle(); if (!row) throw httpErr(404, "Niet gevonden.");
    if (!vol && !vrij(row)) throw httpErr(403, row && eigen(row) ? "Deze terugbetaling is al goedgekeurd of betaald en kan niet meer gewijzigd worden." : "Je hebt hiervoor geen rechten");
    if (b.actie === "zet") {
      const st = String(b.status || ""), d = { ...row.data, nieuw: false };
      if (!["aangevraagd", "ingediend", "goedgekeurd", "betaald", "geweigerd"].includes(st)) throw httpErr(400, "Onbekende status.");
      if (st === "goedgekeurd" && !d.iban) throw httpErr(400, "Er is nog geen rekeningnummer.");
      if (b.bedrag != null) { const n = bedragVan(b.bedrag); if (!n) throw httpErr(400, "Ongeldig bedrag."); d.bedrag = n; }
      if (b.categorie != null) d.categorie = clean(b.categorie, 60);
      d[st + "Op"] = nu(); d[st + "Door"] = wie; if (b.reden != null && st === "geweigerd") d.weigerReden = clean(b.reden, 300);
      const { error } = await sb.from("terugbetalingen").update({ status: st, data: d, gewijzigd: nu() }).eq("id", row.id); if (error) throw error;
      return res.status(200).json(await lijst());
    }
    if (b.actie === "bewerk") { // eigenschappen aanpassen
      const d = { ...row.data }, naam = clean(b.naam, 80), bedrag = bedragVan(b.bedrag), reden = clean(b.reden, 300), email = clean(b.email, 160);
      let iban = String(b.iban || "").replace(/\s+/g, "").toUpperCase(); if (iban.includes("•") || (!vol && !iban)) iban = row.data.iban || "";
      if (!naam) throw httpErr(400, "Vul de naam in."); if (!bedrag) throw httpErr(400, "Vul een geldig bedrag in."); if (!reden) throw httpErr(400, "Vul de reden in.");
      if (!mailOk(email)) throw httpErr(400, "Dit e-mailadres klopt niet."); if (iban && !ibanOk(iban)) throw httpErr(400, "Dit IBAN-nummer klopt niet.");
      Object.assign(d, { naam, bedrag, reden, email, iban, ...(/^\d{4}-\d{2}-\d{2}$/.test(b.datum || "") ? { datum: b.datum } : {}), gewijzigdDoor: wie });
      const st = !vol ? row.status : row.status === "aangevraagd" && iban ? "goedgekeurd" : row.status === "goedgekeurd" && !iban ? "aangevraagd" : row.status;
      const { error } = await sb.from("terugbetalingen").update({ data: d, status: st, gewijzigd: nu() }).eq("id", row.id); if (error) throw error;
      if (vol && iban && d.lidId) await lidIbanZet(sb, d.lidId, iban, "app");
      return res.status(200).json(await lijst());
    }
    if (b.actie === "mail") { // link om het rekeningnummer door te geven per mail versturen (via de mailwachtrij)
      const d = row.data, aan = clean(b.email || d.email, 160);
      if (!aan || !mailOk(aan)) throw httpErr(400, "Geen geldig e-mailadres.");
      if (d.iban && row.status !== "aangevraagd") throw httpErr(409, "Het rekeningnummer is al gekend.");
      const { huisstijl, kaderBlok, knop, p, esc } = await import("./bevestiging.js");
      const vn = String(d.naam || "").split(" ")[0], bd = "€ " + Number(d.bedrag).toFixed(2).replace(".", ",");
      const html = huisstijl(p(`Beste ${esc(vn || "lid")},`)
        + p(`De Vriendenkring betaalt je <b>${bd}</b> terug${d.reden ? ` voor <b>${esc(d.reden)}</b>` : ""}.`)
        + kaderBlok("Wat moet je doen?", p("Geef via de knop hieronder je rekeningnummer (IBAN) door. Daarna schrijven we het bedrag zo snel mogelijk naar je over.", "margin:0"))
        + knop("Rekeningnummer doorgeven", tbLink(row.id)), "Vriendenkring Brandweer Hoofdpost Aalst");
      const { error } = await sb.from("mail_wachtrij").insert({ batch: "terug-" + row.id, data: { aan, aanNaam: d.naam || "", onderwerp: "Terugbetaling: geef je rekeningnummer door", html, label: "Terugbetaling" } });
      if (error) throw error;
      const nd = { ...d, email: aan, gemaild: [...(d.gemaild || []), { op: nu(), aan, door: wie }] };
      await sb.from("terugbetalingen").update({ data: nd, gewijzigd: nu() }).eq("id", row.id);
      return res.status(200).json({ ...(await lijst()), ok: true, aan });
    }
    if (b.actie === "gezien") { await sb.from("terugbetalingen").update({ data: { ...row.data, nieuw: false } }).eq("id", row.id); return res.status(200).json(await lijst()); }
    if (b.actie === "weg") {
      if (row.data.bon && row.data.bon.pad) await sb.storage.from(BUCKET).remove([row.data.bon.pad]).catch(() => {});
      await sb.from("terugbetalingen").delete().eq("id", row.id); return res.status(200).json(await lijst());
    }
    throw httpErr(400, "Onbekende actie.");
  } catch (e) { sendError(res, e); }
}
