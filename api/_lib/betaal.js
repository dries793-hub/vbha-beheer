import { maakBetaling, haalBetaling, EIND } from "./bancontact.js";

export function siteUrl(req) {
  const s = String(process.env.SITE_URL || "").trim().replace(/\/+$/, "");
  if (s) return s;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return "https://" + host;
}

async function bewaarLid(sb, id, data) {
  const { error } = await sb.from("leden").update({ data }).eq("id", id);
  if (error) throw error;
}

// Nieuwe betaling voor een lid (of de lopende hergebruiken als die nog geldig is).
export async function startBetaling(sb, req, lidRow, { bedrag, jaar }) {
  const lid = lidRow.data, cur = lid.betaling;
  if (cur && cur.status === "SUCCEEDED") return cur;
  if (cur && !EIND.has(cur.status) && cur.verlooptOp && Date.parse(cur.verlooptOp) - Date.now() > 20000) return cur;
  const mededeling = `${lid.naam} ${lid.voornaam} Lidgeld ${jaar}`;
  const b = await maakBetaling({ bedrag, omschrijving: mededeling, referentie: "VBHA " + jaar + " " + lidRow.id.slice(0, 22), callbackUrl: siteUrl(req) + "/api/bancontact/callback" });
  const betaling = { ...b, bedrag, jaar, gestart: new Date().toISOString() };
  await bewaarLid(sb, lidRow.id, { ...lid, betaling });
  return betaling;
}

// Vraagt de status op bij Bancontact en zet het lidgeld op betaald als de betaling gelukt is.
export async function controleerBetaling(sb, lidRow) {
  const lid = lidRow.data, cur = lid.betaling;
  if (!cur?.id) return null;
  if (cur.status === "SUCCEEDED") return cur;
  const p = await haalBetaling(cur.id);
  const betaling = { ...cur, status: p.status, betaaldOp: p.betaaldOp || cur.betaaldOp || null };
  if (p.status !== cur.status) await bewaarLid(sb, lidRow.id, { ...lid, betaling });
  if (p.status === "SUCCEEDED") await zetLidgeldBetaald(sb, lidRow.id, cur.jaar, p);
  return betaling;
}

async function zetLidgeldBetaald(sb, lidId, jaar, p) {
  const id = jaar + "_" + lidId;
  const { data: row } = await sb.from("jaarleden").select("data").eq("id", id).maybeSingle();
  const d = row?.data || { jaar: Number(jaar), lidId };
  const dag = new Date(p.betaaldOp || Date.now()).toLocaleDateString("nl-BE", { timeZone: "Europe/Brussels" });
  const nieuw = { ...d, jaar: Number(jaar), lidId, lidgeld: "OK", lidgeldBron: `Betaald met Bancontact Pay op ${dag} (€${p.bedrag.toFixed(2).replace(".", ",")})`, bancontactId: p.id };
  const { error } = await sb.from("jaarleden").upsert({ id, data: nieuw });
  if (error) throw error;
}

/* ---------- banket ---------- */
async function bewaarBanket(sb, id, data) {
  const { error } = await sb.from("banket").update({ data }).eq("id", id);
  if (error) throw error;
}

// Nieuwe Bancontact-betaling voor een banketinschrijving (of de lopende hergebruiken).
export async function startBanketBetaling(sb, req, row) {
  const d = row.data, cur = d.betaling;
  if (cur && cur.status === "SUCCEEDED") return cur;
  if (cur && !EIND.has(cur.status) && cur.verlooptOp && Date.parse(cur.verlooptOp) - Date.now() > 20000) return cur;
  const bedrag = Number(d.bedrag) || 0;
  const b = await maakBetaling({ bedrag, omschrijving: `${d.naam} Banket ${d.jaar}`, referentie: "VBHA Banket " + d.jaar + " " + String(d.lidId || row.id).slice(0, 14), callbackUrl: siteUrl(req) + "/api/bancontact/callback" });
  const betaling = { ...b, bedrag, jaar: d.jaar, gestart: new Date().toISOString() };
  await bewaarBanket(sb, row.id, { ...d, betaling });
  return betaling;
}

// Vraagt de status op bij Bancontact en zet de inschrijving op betaald als de betaling gelukt is.
export async function controleerBanketBetaling(sb, row) {
  const d = row.data, cur = d.betaling;
  if (!cur?.id) return null;
  if (cur.status === "SUCCEEDED") return cur;
  const p = await haalBetaling(cur.id);
  const betaling = { ...cur, status: p.status, betaaldOp: p.betaaldOp || cur.betaaldOp || null };
  let nieuw = { ...d, betaling };
  if (p.status === "SUCCEEDED") {
    const dag = new Date(p.betaaldOp || Date.now()).toLocaleDateString("nl-BE", { timeZone: "Europe/Brussels" });
    nieuw = { ...nieuw, betaald: "OK", betaaldBron: `Betaald met Bancontact Pay op ${dag} (€${p.bedrag.toFixed(2).replace(".", ",")})` };
  }
  if (p.status !== cur.status) await bewaarBanket(sb, row.id, nieuw);
  return betaling;
}
