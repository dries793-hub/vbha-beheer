// Automatische back-up: elke week (pg_cron "backup") een volledige kopie van de gegevens als gecomprimeerd JSON-bestand
// in de afgeschermde opslag "backups" (enkel de server kan erbij). De 8 recentste blijven bewaard.
// Formaat: { _meta, <tabel>: [rijen] }. Tabellen met (id, data) staan als {...data, id}, zoals de app ze terugzet
// (Instellingen › Back-up terugzetten); andere tabellen staan rij per rij zoals in de database.
import zlib from "node:zlib";
import { admin, requireUser, isDbCron, httpErr } from "./sb.js";

const BUCKET = "backups", BEWAAR = 8;
// geheimen en tijdelijke gegevens niet mee
const NIET = new Set(["cron_geheim", "push_sleutel", "bank_auth", "inkomend_geheim", "ratelimit", "mail_wachtrij", "logboek", "cron_log", "app_fouten"]);
const TABELLEN = ["leden", "boekingen", "jaarleden", "sponsors", "jaren", "templates", "config", "archief", "regels", "imports", "ronde", "banket", "kinderfeest",
  "activiteiten", "vergaderingen", "documenten", "fotoalbums", "mailings", "facturen", "familiedag", "pontoise", "pontoise_bezoek", "tickets", "kalenderaanvragen", "kassa", "rondemeldingen",
  "shop_items", "shop_orders", "bestuur", "lid_iban", "lid_kinderen", "terugbetalingen", "kassatel", "social_posts", "deellinks", "handtekeningen",
  "bank_koppelingen", "punten_mailstand", "meldingen_gelezen", "push_abonnementen", "bancontact_tx", "beelden"].filter(t => !NIET.has(t));

async function alles(sb, t) {
  const uit = [];
  for (let van = 0; ; van += 1000) {
    const { data, error } = await sb.from(t).select("*").range(van, van + 999);
    if (error) { if (/does not exist|schema cache/i.test(error.message)) return null; throw new Error(t + ": " + error.message); }
    uit.push(...data); if (data.length < 1000) break;
  }
  return uit;
}

export async function maakBackup(sb) {
  const doc = { _meta: { gemaakt: new Date().toISOString(), app: "VBHA Beheer", tabellen: {} } };
  for (const t of TABELLEN) {
    const R = await alles(sb, t); if (!R) continue;
    const idData = R.length && Object.keys(R[0]).every(k => ["id", "data", "user_id", "bijgewerkt", "gewijzigd", "op"].includes(k)) && "data" in R[0];
    doc[t] = idData ? R.map(r => ({ ...(r.data || {}), id: r.id })) : R;
    doc._meta.tabellen[t] = R.length;
  }
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(doc)));
  const naam = `vbha-${doc._meta.gemaakt.slice(0, 10)}-${doc._meta.gemaakt.slice(11, 16).replace(":", "")}.json.gz`;
  const { error } = await sb.storage.from(BUCKET).upload(naam, gz, { contentType: "application/gzip", upsert: true });
  if (error) throw new Error("Opslaan mislukt: " + error.message);
  // oude back-ups weg
  const L = await lijst(sb);
  const weg = L.slice(BEWAAR).map(x => x.naam);
  if (weg.length) await sb.storage.from(BUCKET).remove(weg);
  return { naam, grootte: gz.length, tabellen: Object.keys(doc._meta.tabellen).length, rijen: Object.values(doc._meta.tabellen).reduce((a, b) => a + b, 0) };
}

async function lijst(sb) {
  const { data, error } = await sb.storage.from(BUCKET).list("", { limit: 100, sortBy: { column: "name", order: "desc" } });
  if (error) throw error;
  return (data || []).filter(f => f.name.endsWith(".json.gz")).map(f => ({ naam: f.name, op: f.created_at, grootte: f.metadata && f.metadata.size }));
}

export async function backupApi(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Gebruik POST" });
  let b = req.body || {}; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  if (await isDbCron(req)) return res.status(200).json(await maakBackup(admin()));
  await requireUser(req, { write: true }); // enkel administrators
  const sb = admin();
  if (b.actie === "lijst") return res.status(200).json({ backups: await lijst(sb) });
  if (b.actie === "maak") return res.status(200).json(await maakBackup(sb));
  if (b.actie === "link") {
    const naam = String(b.naam || ""); if (!/^vbha-[\d-]+\.json\.gz$/.test(naam)) throw httpErr(400, "Ongeldige naam");
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(naam, 120, { download: naam });
    if (error) throw error;
    return res.status(200).json({ url: data.signedUrl });
  }
  throw httpErr(400, "Onbekende actie");
}
