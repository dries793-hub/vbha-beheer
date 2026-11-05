import crypto from "node:crypto";
import { admin, requireUser, isCron, sendError, selectAll, httpErr } from "../_lib/sb.js";
import { configured, eb, mapTransaction } from "../_lib/enable.js";
import { norm, suggest, partijIndex, findLid } from "../_lib/regels.js";

const slug = s => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
const r2 = n => Math.round(n * 100) / 100;

// Haalt nieuwe verrichtingen op voor alle gekoppelde rekeningen en boekt ze.
// Wordt elke ochtend door Vercel Cron aangeroepen (zie vercel.json) of via de knop "Nu ophalen".
export default async function handler(req, res) {
  try {
    let sb;
    if (isCron(req)) sb = admin();
    else { if (req.method !== "POST") throw httpErr(405, "Gebruik POST"); ({ sb } = await requireUser(req, { write: true })); }
    if (!configured()) throw httpErr(501, "Enable Banking is nog niet ingesteld");
    const result = await syncAll(sb);
    res.status(200).json(result);
  } catch (e) { sendError(res, e); }
}

export async function syncAll(sb) {
  const { data: kops, error } = await sb.from("bank_koppelingen").select("id,data");
  if (error) throw error;
  const totaal = { nieuw: 0, dubbel: 0, open: 0, rekeningen: 0, fouten: [] };
  if (!kops?.length) return totaal;

  const regels = (await selectAll(sb, "regels")).map(r => ({ id: r.id, ...r.data }));
  const leden = (await selectAll(sb, "leden")).map(r => ({ id: r.id, ...r.data }));
  const nu = new Date();
  // Eerste synchronisatie: begin na de laatste bestaande rekeningboeking, zodat
  // verrichtingen die al via Excel of een bankbestand ingelezen zijn niet dubbel komen.
  let eersteVanaf = process.env.SYNC_VANAF ? new Date(process.env.SYNC_VANAF) : null;
  if (!eersteVanaf) {
    const huidig = (await selectAll(sb, "boekingen", q => q.eq("jaar", nu.getFullYear()))).map(r => r.data).filter(b => b.rekening !== "Kas" && b.datum);
    const max = huidig.reduce((m, b) => (b.datum > m ? b.datum : m), "");
    eersteVanaf = max ? new Date(new Date(max).getTime() + 86400000) : new Date(`${nu.getFullYear()}-01-01`);
  }

  for (const k of kops) {
    const d = k.data || {};
    if (d.valid_until && new Date(d.valid_until) < nu) { totaal.fouten.push(`Toestemming voor ${d.aspsp} is verlopen: koppel opnieuw.`); continue; }
    const vanaf = d.laatste_sync ? new Date(new Date(d.laatste_sync).getTime() - 10 * 86400000) : eersteVanaf;
    const dateFrom = vanaf.toISOString().slice(0, 10);
    for (const acc of d.accounts || []) {
      totaal.rekeningen++;
      try {
        const txs = [];
        let ck = null, guard = 0;
        do {
          const q = new URLSearchParams({ date_from: dateFrom, transaction_status: "BOOK" });
          if (ck) q.set("continuation_key", ck);
          const r = await eb(`/accounts/${encodeURIComponent(acc.uid)}/transactions?${q}`);
          txs.push(...(r.transactions || []));
          ck = r.continuation_key || null;
        } while (ck && ++guard < 50);
        const r = await boekTransacties(sb, txs, { regels, leden, bron: d.aspsp || "Bank" });
        totaal.nieuw += r.nieuw; totaal.dubbel += r.dubbel; totaal.open += r.open;
      } catch (e) { totaal.fouten.push(`${acc.iban || acc.uid}: ${e.message}`); }
    }
    await sb.from("bank_koppelingen").update({ data: { ...d, laatste_sync: nu.toISOString() } }).eq("id", k.id);
  }
  if (totaal.nieuw || totaal.fouten.length) {
    await sb.from("imports").insert({ id: crypto.randomUUID(), data: { tijd: nu.toISOString(), bestand: "Enable Banking", bron: "api", jaar: nu.getFullYear(), nieuw: totaal.nieuw, dubbel: totaal.dubbel, open: totaal.open, fouten: totaal.fouten } });
  }
  return totaal;
}

export async function boekTransacties(sb, txs, { regels, leden }) {
  const items = txs.map(mapTransaction).filter(b => b.datum && b.bedrag);
  const jaren = [...new Set(items.map(b => Number(b.datum.slice(0, 4))))];
  const out = { nieuw: 0, dubbel: 0, open: 0 };
  for (const jaar of jaren) {
    const bestaand = (await selectAll(sb, "boekingen", q => q.eq("jaar", jaar))).map(r => ({ id: r.id, ...r.data }));
    const pidx = partijIndex(bestaand);
    const ids = new Set(bestaand.map(b => b.id));
    const refs = new Set(bestaand.map(b => b.bankRef).filter(Boolean));
    const fuzzy = new Set(bestaand.map(b => `${b.datum}|${r2(b.bedrag)}|${b.richting || "in"}|${norm(b.partij)}`));
    let nr = bestaand.reduce((m, b) => Math.max(m, Number(b.nr) || 0), 0);
    const nieuw = items.filter(b => Number(b.datum.slice(0, 4)) === jaar).sort((a, c) => a.datum.localeCompare(c.datum));
    for (const b of nieuw) {
      const id = b.bankRef ? `eb-${slug(b.bankRef).slice(0, 120)}` : `eb-${crypto.createHash("sha1").update(`${b.datum}|${b.bedrag}|${b.richting}|${b.partij}|${b.mededeling}`).digest("hex").slice(0, 24)}`;
      const fz = `${b.datum}|${b.bedrag}|${b.richting}|${norm(b.partij)}`;
      if (ids.has(id) || (b.bankRef && refs.has(b.bankRef)) || fuzzy.has(fz)) { out.dubbel++; continue; }
      const s = suggest(b, regels, pidx);
      const categorie = s ? s.categorie : "";
      const status = s && !s.zeker ? "controle" : null;
      const data = { ...b, jaar, nr: ++nr, categorie, rekening: "Rekening", bron: "api", status, regelNaam: s ? s.naam : "", lidId: categorie === "Lidgeld" ? findLid(b, leden, jaar) : null };
      const { error } = await sb.from("boekingen").insert({ id, data });
      if (error) { if (error.code === "23505") { out.dubbel++; nr--; continue; } throw error; }
      ids.add(id); if (b.bankRef) refs.add(b.bankRef); fuzzy.add(fz); out.nieuw++;
      if (!categorie || status) out.open++;
    }
  }
  return out;
}
