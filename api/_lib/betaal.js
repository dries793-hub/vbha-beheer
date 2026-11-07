import { maakBetaling, haalBetaling, EIND, providerNaam } from "./betaalprovider.js";
import { betalingGelukt } from "./bevestiging.js";

// Online betalingen (Mollie of Bancontact Pay) voor records in de tabellen "leden" (lidgeld) en "banket".
// Elk record bewaart zijn betaling in data.betaling = {id, status, bedrag, jaar, deeplink, qrcode, ...}.
export const BETAALTABELLEN = ["leden", "banket", "facturen"];

export function siteUrl(req) {
  const s = String(process.env.SITE_URL || "").trim().replace(/\/+$/, "");
  if (s) return s;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return "https://" + host;
}

async function bewaar(sb, tabel, id, data) {
  const { error } = await sb.from(tabel).update({ data }).eq("id", id);
  if (error) throw error;
}

function omschrijving(tabel, d, jaar) {
  if (tabel === "facturen") return `Factuur ${d.nr}`;
  return tabel === "banket" ? `${d.naam} Banket ${jaar}` : `${d.naam} ${d.voornaam} Lidgeld ${jaar}`;
}

// Nieuwe betaling (of de lopende hergebruiken als die nog geldig is).
export async function startBetaling(sb, req, tabel, row, { bedrag, jaar, terug }) {
  const d = row.data, cur = d.betaling;
  // Een betaling van een vorig jaar (of voor een ander bedrag) telt niet mee.
  const zelfde = cur && String(cur.jaar) === String(jaar) && Number(cur.bedrag) === Number(bedrag);
  if (zelfde && cur.status === "SUCCEEDED") return cur;
  if (zelfde && !EIND.has(cur.status) && cur.verlooptOp && Date.parse(cur.verlooptOp) - Date.now() > 20000) return cur;
  const b = await maakBetaling({
    bedrag, omschrijving: omschrijving(tabel, d, jaar),
    referentie: tabel === "facturen" ? "VBHA " + d.nr : "VBHA " + (tabel === "banket" ? "B" : "L") + jaar + " " + row.id.slice(0, 20),
    callbackUrl: siteUrl(req) + "/api/bancontact/callback",
    redirectUrl: siteUrl(req) + (terug || ((tabel === "banket" ? "/banket" : "/inschrijven") + "?betaling=terug")),
  });
  const betaling = { ...b, bedrag, jaar, gestart: new Date().toISOString() };
  await bewaar(sb, tabel, row.id, { ...d, betaling });
  return betaling;
}

// Vraagt de status op bij de provider; bij succes wordt het lidgeld / banket op betaald gezet.
export async function controleerBetaling(sb, tabel, row) {
  const d = row.data, cur = d.betaling;
  if (!cur?.id) return null;
  if (cur.status === "SUCCEEDED") return cur;
  const p = await haalBetaling(cur.id);
  const betaling = { ...cur, status: p.status, betaaldOp: p.betaaldOp || cur.betaaldOp || null };
  if (p.status !== cur.status) await bewaar(sb, tabel, row.id, { ...d, betaling });
  if (p.status === "SUCCEEDED" && tabel === "leden") await zetLidgeldBetaald(sb, row.id, cur.jaar, p);
  if (p.status === "SUCCEEDED" && cur.status !== "SUCCEEDED") { try { if (tabel === "facturen") await (await import("./factuur.js")).factuurOnlineBetaald(sb, row.id); else await betalingGelukt(sb, tabel, row.id); } catch (e) { console.error("bevestiging", e); } }
  return betaling;
}

async function zetLidgeldBetaald(sb, lidId, jaar, p) {
  const id = jaar + "_" + lidId;
  const { data: row } = await sb.from("jaarleden").select("data").eq("id", id).maybeSingle();
  const d = row?.data || { jaar: Number(jaar), lidId };
  const dag = new Date(p.betaaldOp || Date.now()).toLocaleDateString("nl-BE", { timeZone: "Europe/Brussels" });
  const nieuw = { ...d, jaar: Number(jaar), lidId, lidgeld: "OK", lidgeldBron: `Betaald online (${providerNaam()}) op ${dag} (€${p.bedrag.toFixed(2).replace(".", ",")})`, bancontactId: p.id };
  const { error } = await sb.from("jaarleden").upsert({ id, data: nieuw });
  if (error) throw error;
}
