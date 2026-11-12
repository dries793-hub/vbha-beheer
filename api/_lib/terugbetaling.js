/* Terugbetalingen en onkostennota's (geld dat de vriendenkring aan iemand moet betalen).
   Tabel terugbetalingen (enkel via de server): {id, status, data}
     status: aangevraagd (link verstuurd, wacht op IBAN) | ingediend (wacht op goedkeuring) | goedgekeurd (klaar om te betalen)
             | betaald | geweigerd
     data: {soort:"terugbetaling"|"onkosten", naam, email, bedrag, reden, iban, datum, bon:{pad,type,naam}, lidId, door, op, ...}
   - App (functie facturen): POST /api/mail?f=terug {actie: lijst | maak | zet | weg | bon}
   - Openbaar: /api/terug  GET ?i&t (persoonlijke link) · POST {i,t,iban,naam} · POST {actie:"onkost", ...} (onkostennota indienen)
   Een IBAN wordt nooit in de openbare pagina teruggetoond. */
import crypto from "node:crypto";
import { admin, httpErr, sendError, requireUser } from "./sb.js";
import { body, rateLimit, clean, vandaagISO } from "./publiek.js";

const BUCKET = "documenten";
const sleutel = () => String(process.env.BETAAL_GEHEIM || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
export const tbToken = id => crypto.createHmac("sha256", sleutel()).update(`vbha-terug|${id}`).digest("base64url").slice(0, 22);
const klopt = (id, t) => { if (!sleutel() || !id || typeof t !== "string") return false; const a = Buffer.from(tbToken(id)), b = Buffer.from(t); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const site = () => "https://vbha.be"; // openbare links altijd via het eigen domein
export const tbLink = id => `${site()}/terugbetaling?i=${encodeURIComponent(id)}&t=${tbToken(id)}`;
export const onkostLink = () => `${site()}/terugbetaling`;
const nu = () => new Date().toISOString();
const r2 = n => Math.round(n * 100) / 100;
export function ibanOk(i) {
  i = String(i || "").replace(/\s+/g, "").toUpperCase(); if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(i)) return false;
  const r = (i.slice(4) + i.slice(0, 4)).replace(/[A-Z]/g, c => c.charCodeAt(0) - 55); let m = 0; for (const ch of r) m = (m * 10 + Number(ch)) % 97; return m === 1;
}
const bedragVan = v => { const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return n > 0 && n < 100000 ? r2(n) : 0; };
const mailOk = e => !e || /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(e);

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
      if (!ibanOk(iban)) throw httpErr(400, "Dit rekeningnummer (IBAN) klopt niet.");
      if (!bedrag) throw httpErr(400, "Vul een geldig bedrag in.");
      if (!reden) throw httpErr(400, "Schrijf kort waarvoor de kosten waren.");
      const id = "ok-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const bon = await bonBewaar(sb, id, b.bon);
      const { error } = await sb.from("terugbetalingen").insert({ id, status: "ingediend", data: { soort: "onkosten", naam, email, iban, bedrag, reden, datum, bon, op: nu(), nieuw: true } });
      if (error) throw error;
      try { const { meldPush } = await import("./push.js"); await meldPush(sb, "boek", { titel: "Nieuwe onkostennota", tekst: `${naam} · € ${bedrag.toFixed(2).replace(".", ",")} · ${reden.slice(0, 60)}`, url: "/#terug", tag: "tb-" + id }); } catch (e) { console.error("push onkost", e); }
      return res.status(200).json({ ok: true });
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
    try { const { meldPush } = await import("./push.js"); await meldPush(sb, "boek", { titel: "Rekeningnummer doorgegeven", tekst: `${d.naam} · € ${Number(d.bedrag).toFixed(2).replace(".", ",")} klaar om terug te betalen`, url: "/#terug", tag: "tb-" + id }); } catch (e) { console.error("push terug", e); }
    d.iban = iban; return res.status(200).json({ ...toon(), ibanGekend: true, ibanEind: iban.slice(-4), status: row.status === "aangevraagd" ? "goedgekeurd" : row.status });
  } catch (e) { sendError(res, e); }
}

/* ---------- app ---------- */
export async function terugApp(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") throw httpErr(405, "Gebruik POST");
    const b = body(req), lees = b.actie === "lijst" || b.actie === "bon";
    const { user } = await requireUser(req, lees ? { functie: "facturen" } : { write: true, functie: "facturen" });
    const sb = admin();
    let wie = user.email || ""; try { const { data } = await sb.from("bestuur").select("naam").eq("user_id", user.id).maybeSingle(); if (data && data.naam) wie = data.naam; } catch {}
    const lijst = async () => { const { data, error } = await sb.from("terugbetalingen").select("id,data,status,gemaakt,gewijzigd").order("gemaakt", { ascending: false }).limit(300); if (error) throw error;
      return { ok: true, lijst: (data || []).map(r => ({ ...r, link: r.data.soort === "terugbetaling" ? tbLink(r.id) : null })), onkostLink: onkostLink() }; };
    if (b.actie === "lijst") return res.status(200).json(await lijst());
    if (b.actie === "bon") {
      const { data: r } = await sb.from("terugbetalingen").select("data").eq("id", String(b.id || "")).maybeSingle(); if (!r || !r.data.bon) throw httpErr(404, "Geen bewijsstuk.");
      const { data } = await sb.storage.from(BUCKET).createSignedUrl(r.data.bon.pad, 600); return res.status(200).json({ ok: true, url: data ? data.signedUrl : "" });
    }
    if (b.actie === "maak") { // terugbetaling aanmaken: link om het IBAN op te vragen (of meteen met IBAN)
      const naam = clean(b.naam, 80), bedrag = bedragVan(b.bedrag), reden = clean(b.reden, 300), email = clean(b.email, 160), iban = String(b.iban || "").replace(/\s+/g, "").toUpperCase();
      if (!naam) throw httpErr(400, "Vul de naam in."); if (!bedrag) throw httpErr(400, "Vul een geldig bedrag in."); if (!reden) throw httpErr(400, "Vul de reden in.");
      if (!mailOk(email)) throw httpErr(400, "Dit e-mailadres klopt niet."); if (iban && !ibanOk(iban)) throw httpErr(400, "Dit IBAN-nummer klopt niet.");
      const id = "tb-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const { error } = await sb.from("terugbetalingen").insert({ id, status: iban ? "goedgekeurd" : "aangevraagd", data: { soort: "terugbetaling", naam, email, bedrag, reden, iban: iban || "", lidId: clean(b.lidId, 60), categorie: clean(b.categorie, 60), door: wie, op: nu() } });
      if (error) throw error;
      return res.status(200).json({ ...(await lijst()), id, link: tbLink(id) });
    }
    const { data: row } = await sb.from("terugbetalingen").select("id,data,status").eq("id", String(b.id || "")).maybeSingle(); if (!row) throw httpErr(404, "Niet gevonden.");
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
      const d = { ...row.data }, naam = clean(b.naam, 80), bedrag = bedragVan(b.bedrag), reden = clean(b.reden, 300), email = clean(b.email, 160), iban = String(b.iban || "").replace(/\s+/g, "").toUpperCase();
      if (!naam) throw httpErr(400, "Vul de naam in."); if (!bedrag) throw httpErr(400, "Vul een geldig bedrag in."); if (!reden) throw httpErr(400, "Vul de reden in.");
      if (!mailOk(email)) throw httpErr(400, "Dit e-mailadres klopt niet."); if (iban && !ibanOk(iban)) throw httpErr(400, "Dit IBAN-nummer klopt niet.");
      Object.assign(d, { naam, bedrag, reden, email, iban, ...(/^\d{4}-\d{2}-\d{2}$/.test(b.datum || "") ? { datum: b.datum } : {}), gewijzigdDoor: wie });
      const st = row.status === "aangevraagd" && iban ? "goedgekeurd" : row.status === "goedgekeurd" && !iban ? "aangevraagd" : row.status;
      const { error } = await sb.from("terugbetalingen").update({ data: d, status: st, gewijzigd: nu() }).eq("id", row.id); if (error) throw error;
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
