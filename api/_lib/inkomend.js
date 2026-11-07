import crypto from "node:crypto";
import { admin, requireUser, httpErr } from "./sb.js";
import { Imap, leesMail, kopTekst, adres } from "./imap.js";

/* ============ Inkomende facturen per mail ============
   Een aparte mailbox (bv. facturen@vbha.be) waar jij of Jojanneke facturen naartoe doorsturen (of leveranciers rechtstreeks).
   Elke 10 minuten (geplande taak "bevestigingen") haalt de server nieuwe mails op via IMAP, bewaart de PDF-bijlagen in
   Documenten › Inkomende facturen (data.inkomend = {van, vanNaam, onderwerp, ontvangen, mailId, leverancier}) en markeert de mail als gelezen.
   Het koppelen aan de transactie gebeurt in de app (boeking.documentId), met een voorstel op basis van de tekst in de PDF.
   Vercel-omgevingsvariabelen: INKOMEND_IMAP_USER, INKOMEND_IMAP_PASS, optioneel INKOMEND_IMAP_HOST (imap.one.com) en INKOMEND_IMAP_PORT (993). */

const MAP = "Inkomende facturen", BUCKET = "documenten";
const env = () => ({ host: process.env.INKOMEND_IMAP_HOST || "imap.one.com", port: Number(process.env.INKOMEND_IMAP_PORT || 993), user: process.env.INKOMEND_IMAP_USER || "", pass: process.env.INKOMEND_IMAP_PASS || "", tlsOk: process.env.INKOMEND_IMAP_INSECURE !== "1" });
export const inkomendIngesteld = () => { const e = env(); return !!(e.user && e.pass); };
const veilig = n => String(n).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/_+/g, "_").slice(-90) || "factuur.pdf";
const isPdf = b => /pdf/i.test(b.type) || /\.pdf$/i.test(b.naam) || (b.data && b.data.subarray(0, 5).toString("latin1") === "%PDF-");
const isBeeld = b => /^image\/(jpe?g|png|heic|heif)$/i.test(b.type) && b.data.length > 80000; // foto van een kasticket; logo's in handtekeningen zijn kleiner
// bij een doorgestuurde mail: de oorspronkelijke afzender uit de tekst halen
function leverancierUit(tekst, onderwerp) {
  const m = String(tekst || "").match(/^\s*(?:>\s*)?(?:Van|From|De)\s*:\s*(.+)$/im);
  if (m) { const a = adres(m[1]); return a.naam || a.email; }
  return "";
}

async function log(sb, items) {
  const { data } = await sb.from("config").select("data").eq("id", "inkomend").maybeSingle();
  const d = (data && data.data) || {};
  await sb.from("config").upsert({ id: "inkomend", data: { ...d, laatsteKeer: new Date().toISOString(), log: [...items, ...(d.log || [])].slice(0, 30) } });
}

export async function inkomendOphalen(sb, { max = 15 } = {}) {
  if (!inkomendIngesteld()) return { ingesteld: false };
  const e = env(), c = new Imap({ host: e.host, port: e.port, rejectUnauthorized: e.tlsOk });
  const L = [], nieuw = [];
  await c.open();
  try {
    await c.login(e.user, e.pass);
    await c.select("INBOX");
    const uids = (await c.zoek("UNSEEN")).slice(0, max);
    for (const uid of uids) {
      let item = { op: new Date().toISOString() };
      try {
        const raw = await c.haal(uid);
        if (!raw) { await c.gelezen(uid); continue; }
        if (raw.length > 30 * 1048576) { item = { ...item, status: "te groot" }; L.push(item); await c.gelezen(uid); continue; }
        const m = leesMail(raw), H = m.koppen, van = adres(H.from), onderwerp = kopTekst(H.subject || "").slice(0, 200);
        const mailId = String(H["message-id"] || "").trim() || crypto.createHash("sha1").update(raw).digest("hex");
        const ontvangen = (() => { const d = new Date(H.date || ""); return isNaN(d) ? new Date().toISOString() : d.toISOString(); })();
        item = { ...item, van: van.email, onderwerp };
        const bij = m.bijlagen.filter(b => b.data && b.data.length > 0 && (isPdf(b) || isBeeld(b)));
        if (!bij.length) { item.status = "geen PDF"; L.push(item); await c.gelezen(uid); continue; }
        const { data: al } = await sb.from("documenten").select("id").eq("data->inkomend->>mailId", mailId).limit(1);
        if (al && al.length) { item.status = "al ontvangen"; L.push(item); await c.gelezen(uid); continue; }
        const leverancier = leverancierUit(m.tekst, onderwerp);
        let n = 0;
        for (const b of bij) {
          const id = "doc-" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex"), naam = (b.naam && b.naam !== "bijlage" ? b.naam : (onderwerp || "factuur") + (isPdf(b) ? ".pdf" : ".jpg")).slice(0, 150);
          const pad = `${MAP}/${id}-${veilig(naam)}`, type = isPdf(b) ? "application/pdf" : b.type;
          const { error } = await sb.storage.from(BUCKET).upload(pad, b.data, { contentType: type, upsert: false });
          if (error) throw error;
          const { error: e2 } = await sb.from("documenten").insert({ id, data: { naam, pad, map: MAP, grootte: b.data.length, type, omschrijving: onderwerp, door: van.naam || van.email, op: new Date().toISOString(),
            inkomend: { van: van.email, vanNaam: van.naam, onderwerp, ontvangen, mailId, leverancier, nieuw: true } } });
          if (e2) throw e2;
          n++; nieuw.push(id);
        }
        item.status = n + " bijlage" + (n === 1 ? "" : "n"); L.push(item);
        await c.gelezen(uid);
      } catch (err) { item.status = "fout: " + String(err.message || err).slice(0, 120); L.push(item); console.error("inkomend", uid, err); }
    }
  } finally { await c.sluit(); }
  await log(sb, L);
  return { ingesteld: true, nieuw: nieuw.length, verwerkt: L.length };
}

/* ---------- api: /api/mail?f=inkomend ---------- */
export async function inkomendApi(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") { await requireUser(req); return res.status(200).json({ ingesteld: inkomendIngesteld(), adres: env().user || null }); }
  if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");
  const { sb } = await requireUser(req, { boek: true });
  if (!inkomendIngesteld()) throw httpErr(501, "De mailbox voor inkomende facturen is nog niet ingesteld.");
  try { return res.status(200).json(await inkomendOphalen(sb)); }
  catch (e) { throw httpErr(502, "Ophalen lukte niet: " + (e.message || e)); }
}
export async function inkomendCron(sb) { if (!inkomendIngesteld()) return null; return inkomendOphalen(sb); }
