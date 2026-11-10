import { FACTUUR_ADRES } from "./smtp.js";
import crypto from "node:crypto";
import { admin, requireUser, httpErr } from "./sb.js";
import { Imap, leesMail, kopTekst, adres, koppen } from "./imap.js";
import { meldPush } from "./push.js";

/* ============ Inkomende facturen per mail ============
   De app leest een mailbox (instelbaar in Boekhouding › Inkomende facturen › tandwiel; standaard vbha@telenet.be).
   Elke 10 minuten (geplande taak "bevestigingen") worden nieuwe mails bekeken. De mailbox wordt NIET gewijzigd: mails blijven
   ongelezen staan; de app onthoudt zelf tot welke mail ze gekomen is (UID). Enkel mails met een PDF die op een factuur lijken
   (woord in onderwerp/bestandsnaam, of van een vertrouwde afzender) worden bewaard in Documenten › Inkomende facturen.
   Config "inkomend" (geen geheimen): {adres, host, port, map, filter:{aan, woorden, afzenders}, uidValidity, lastUid, laatsteKeer, log}
   Wachtwoord: afgeschermde tabel inkomend_geheim (enkel via deze server). Reserve: INKOMEND_IMAP_USER / INKOMEND_IMAP_PASS in Vercel. */

const MAP = "Inkomende facturen", BUCKET = "documenten";
export const INK_DEF = { adres: "boekhouding@vbha.be", host: "imap.one.com", port: 993, map: "INBOX", filter: { aan: true, woorden: "factuur, invoice, rekening, nota, creditnota", afzenders: "" } };
const HOSTS = { "telenet.be": "imap.telenet.be", "vbha.be": "imap.one.com", "gmail.com": "imap.gmail.com", "outlook.com": "outlook.office365.com", "hotmail.com": "outlook.office365.com", "skynet.be": "imap.proximus.be", "proximus.be": "imap.proximus.be" };
export const hostVoor = a => HOSTS[String(a || "").split("@")[1]?.toLowerCase()] || "";

// Het wachtwoord van de mailbox staat versleuteld in de database (AES-256-GCM, sleutel enkel in Vercel).
const encKey = () => crypto.createHash("sha256").update("vbha-inkomend|" + String(process.env.BETAAL_GEHEIM || process.env.SUPABASE_SERVICE_ROLE_KEY || "")).digest();
function versleutel(t) { const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", encKey(), iv); const d = Buffer.concat([c.update(String(t), "utf8"), c.final()]); return "enc:v1:" + Buffer.concat([iv, c.getAuthTag(), d]).toString("base64"); }
function ontsleutel(v) { v = String(v || ""); if (!v.startsWith("enc:v1:")) return v; try { const b = Buffer.from(v.slice(7), "base64"), d = crypto.createDecipheriv("aes-256-gcm", encKey(), b.subarray(0, 12)); d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8"); } catch (e) { console.error("ontsleutelen mislukt"); return ""; } }
async function instellingen(sb) {
  const { data } = await sb.from("config").select("data").eq("id", "inkomend").maybeSingle();
  const c = (data && data.data) || {};
  const { data: g } = await sb.from("inkomend_geheim").select("wachtwoord").eq("id", 1).maybeSingle();
  // oud, onversleuteld wachtwoord meteen versleuteld terugschrijven
  if (g && g.wachtwoord && !String(g.wachtwoord).startsWith("enc:v1:")) { try { await sb.from("inkomend_geheim").update({ wachtwoord: versleutel(g.wachtwoord) }).eq("id", 1); } catch (e) {} }
  if (g) g.wachtwoord = ontsleutel(g.wachtwoord);
  const adresEnv = process.env.INKOMEND_IMAP_USER || "", passEnv = process.env.INKOMEND_IMAP_PASS || "";
  const r = { ...INK_DEF, ...c, filter: { ...INK_DEF.filter, ...(c.filter || {}) } };
  // boekhouding@vbha.be: hetzelfde wachtwoord als voor het versturen van de facturen (SMTP_FACTUUR_PASS in Vercel)
  const fcEigen = String(r.adres || "").trim().toLowerCase() === FACTUUR_ADRES().toLowerCase() && process.env.SMTP_FACTUUR_PASS ? process.env.SMTP_FACTUUR_PASS : "";
  r.pass = fcEigen || (g && g.wachtwoord) || (adresEnv && adresEnv === r.adres ? passEnv : "") || (!c.adres && passEnv ? passEnv : "");
  if (!c.adres && adresEnv) r.adres = adresEnv;
  r.host = r.host || hostVoor(r.adres) || "imap.one.com"; r.port = Number(r.port) || 993;
  return r;
}
async function bewaarCfg(sb, patch) {
  const { data } = await sb.from("config").select("data").eq("id", "inkomend").maybeSingle();
  await sb.from("config").upsert({ id: "inkomend", data: { ...((data && data.data) || {}), ...patch } });
}
const veilig = n => String(n).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/_+/g, "_").slice(-90) || "factuur.pdf";
const isPdf = b => /pdf/i.test(b.type) || /\.pdf$/i.test(b.naam) || (b.data && b.data.subarray(0, 5).toString("latin1") === "%PDF-");
const lijst = s => String(s || "").split(/[,;\n]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
function leverancierUit(tekst) { const m = String(tekst || "").match(/^\s*(?:>\s*)?(?:Van|From|De)\s*:\s*(.+)$/im); if (m) { const a = adres(m[1]); return a.naam || a.email; } return ""; }
const imapDatum = d => `${d.getUTCDate()}-${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getUTCMonth()]}-${d.getUTCFullYear()}`;

export async function inkomendOphalen(sb, { max = 25, test = false } = {}) {
  const C = await instellingen(sb);
  if (!C.adres || !C.pass) return { ingesteld: false };
  const c = new Imap({ host: C.host, port: C.port, rejectUnauthorized: process.env.INKOMEND_IMAP_INSECURE !== "1" });
  const L = [], nieuw = [];
  await c.open();
  try {
    await c.login(C.adres, C.pass);
    const sel = await c.select(C.map || "INBOX", { alleenLezen: true });
    if (test) return { ingesteld: true, ok: true, mails: sel.bestaat };
    const opnieuw = !C.lastUid || C.uidValidity !== sel.uidValidity;
    let uids = opnieuw ? await c.zoek("SINCE " + imapDatum(new Date(Date.now() - 30 * 864e5))) : (await c.zoek(`UID ${Number(C.lastUid) + 1}:*`)).filter(u => u > Number(C.lastUid));
    uids = uids.sort((a, b) => a - b).slice(0, max);
    const woorden = lijst(C.filter.woorden), vertrouwd = lijst(C.filter.afzenders);
    const lijktFactuur = s => woorden.some(w => String(s || "").toLowerCase().includes(w));
    let laatste = opnieuw ? 0 : Number(C.lastUid);
    for (const uid of uids) {
      let item = null;
      try {
        const k = await c.kop(uid), H = koppen(k.kop), van = adres(H.from), onderwerp = kopTekst(H.subject || "").slice(0, 200);
        const ct = String(H["content-type"] || "").toLowerCase();
        const kanBijlage = /multipart\/(mixed|related|report)/.test(ct) || /application\/pdf/.test(ct);
        if (!kanBijlage || k.grootte > 25 * 1048576) { laatste = uid; continue; }
        const raw = await c.haal(uid); if (!raw) { laatste = uid; continue; }
        const m = leesMail(raw);
        const pdfs = m.bijlagen.filter(b => b.data && b.data.length > 1000 && isPdf(b));
        if (!pdfs.length) { laatste = uid; continue; }
        // onze eigen uitgaande facturen (kopie naar de boekhouding) zijn geen inkomende facturen
        const eigen = [FACTUUR_ADRES(), process.env.SMTP_NOREPLY_USER || "noreply@vbha.be", process.env.SMTP_USER || ""].map(x => String(x).trim().toLowerCase()).filter(Boolean);
        if (eigen.includes(String(van.email || "").toLowerCase()) || pdfs.every(b => /^Vriendenkring-Brandweer-Hoofdpost-Aalst_(F|C|Aanmaning)/i.test(b.naam || "") || /^(Factuur|Creditnota|Aanmaning)[-_ ]?[FC]?\d{7}/i.test(b.naam || ""))) {
          L.push({ op: new Date().toISOString(), van: van.email, onderwerp, status: "eigen factuur overgeslagen" }); laatste = uid; continue;
        }
        const vanVertrouwd = vertrouwd.includes(van.email);
        const ok = !C.filter.aan || vanVertrouwd || lijktFactuur(onderwerp) || pdfs.some(b => lijktFactuur(b.naam));
        item = { op: new Date().toISOString(), van: van.email, onderwerp };
        if (!ok) { item.status = "PDF overgeslagen (lijkt geen factuur)"; L.push(item); laatste = uid; continue; }
        const mailId = String(H["message-id"] || "").trim() || crypto.createHash("sha1").update(raw).digest("hex");
        const { data: al } = await sb.from("documenten").select("id").eq("data->inkomend->>mailId", mailId).limit(1);
        if (al && al.length) { item.status = "al ontvangen"; L.push(item); laatste = uid; continue; }
        const ontvangen = (() => { const d = new Date(H.date || ""); return isNaN(d) ? new Date().toISOString() : d.toISOString(); })();
        const leverancier = leverancierUit(m.tekst);
        let n = 0;
        for (const b of pdfs) {
          const id = "doc-" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex"), naam = (b.naam && b.naam !== "bijlage" ? b.naam : (onderwerp || "factuur") + ".pdf").slice(0, 150);
          const pad = `${MAP}/${id}-${veilig(naam)}`;
          const { error } = await sb.storage.from(BUCKET).upload(pad, b.data, { contentType: "application/pdf", upsert: false });
          if (error) throw error;
          const { error: e2 } = await sb.from("documenten").insert({ id, data: { naam, pad, map: MAP, grootte: b.data.length, type: "application/pdf", omschrijving: onderwerp, door: van.naam || van.email, op: new Date().toISOString(),
            inkomend: { van: van.email, vanNaam: van.naam, onderwerp, ontvangen, mailId, leverancier: leverancier || (vanVertrouwd ? "" : van.naam), nieuw: true } } });
          if (e2) throw e2;
          n++; nieuw.push(id);
        }
        item.status = n + " PDF bewaard"; L.push(item); laatste = uid;
      } catch (err) { L.push({ ...(item || { op: new Date().toISOString() }), status: "fout: " + String(err.message || err).slice(0, 120) }); console.error("inkomend", uid, err); break; }
    }
    const { data: d0 } = await sb.from("config").select("data").eq("id", "inkomend").maybeSingle();
    const oud = (d0 && d0.data) || {};
    await bewaarCfg(sb, { uidValidity: sel.uidValidity, lastUid: Math.max(laatste, opnieuw ? 0 : Number(C.lastUid) || 0), laatsteKeer: new Date().toISOString(), fout: null, log: [...L, ...(oud.log || [])].slice(0, 30) });
  } catch (e) {
    await bewaarCfg(sb, { laatsteKeer: new Date().toISOString(), fout: String(e.message || e).slice(0, 200) });
    throw e;
  } finally { await c.sluit(); }
  if (nieuw.length) { const v = L.filter(x => /PDF bewaard/.test(x.status || "")).map(x => x.vanNaam || x.van).filter(Boolean); await meldPush(sb, "boek", { titel: nieuw.length === 1 ? "Nieuwe inkomende factuur" : nieuw.length + " nieuwe inkomende facturen", tekst: [...new Set(v)].slice(0, 3).join(", ") || "Te koppelen aan een transactie", url: "/#inkomend", tag: "inkomend" }); }
  return { ingesteld: true, nieuw: nieuw.length, bekeken: L.length };
}

/* ---------- api: /api/mail?f=inkomend ---------- */
// GET -> instellingen (zonder wachtwoord)   POST {actie: ophalen | test | instellingen, adres, host, port, map, filter, wachtwoord}
export async function inkomendApi(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") {
    const { sb } = await requireUser(req); const C = await instellingen(sb);
    return res.status(200).json({ ingesteld: !!(C.adres && C.pass), wachtwoordGezet: !!C.pass, adres: C.adres, host: C.host, port: C.port, map: C.map, filter: C.filter, laatsteKeer: C.laatsteKeer || null, fout: C.fout || null, log: (C.log || []).slice(0, 15) });
  }
  if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");
  const { sb } = await requireUser(req, { boek: true, functie: "facturen" });
  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  if (b.actie === "instellingen") {
    const a = String(b.adres || "").trim().toLowerCase();
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(a)) throw httpErr(400, "Vul een geldig e-mailadres in.");
    const host = String(b.host || "").trim() || hostVoor(a); if (!/^[a-z0-9.-]+$/i.test(host)) throw httpErr(400, "Vul de IMAP-server in (bv. imap.telenet.be).");
    const port = Number(b.port) || 993, map = String(b.map || "INBOX").trim() || "INBOX";
    const C = await instellingen(sb), ander = a !== C.adres || host !== C.host || map !== C.map;
    await bewaarCfg(sb, { adres: a, host, port, map, filter: { aan: b.filter?.aan !== false, woorden: String(b.filter?.woorden || "").slice(0, 300), afzenders: String(b.filter?.afzenders || "").slice(0, 500) }, ...(ander ? { lastUid: 0, uidValidity: 0 } : {}) });
    if (typeof b.wachtwoord === "string" && b.wachtwoord) {
      const { error } = await sb.from("inkomend_geheim").upsert({ id: 1, wachtwoord: versleutel(b.wachtwoord), gewijzigd: new Date().toISOString() });
      if (error) throw error;
    }
    return res.status(200).json({ ok: true });
  }
  if (b.actie === "test") {
    try { const r = await inkomendOphalen(sb, { test: true }); if (!r.ingesteld) throw new Error("Vul het adres en het wachtwoord in."); return res.status(200).json(r); }
    catch (e) { throw httpErr(502, "Verbinding mislukt: " + (e.message || e)); }
  }
  try { return res.status(200).json(await inkomendOphalen(sb)); }
  catch (e) { throw httpErr(502, "Ophalen lukte niet: " + (e.message || e)); }
}
export async function inkomendCron(sb) { return inkomendOphalen(sb); }
