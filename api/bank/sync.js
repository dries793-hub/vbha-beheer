import crypto from "node:crypto";
import { admin, requireUser, isCron, isDbCron, sendError, selectAll, httpErr } from "../_lib/sb.js";
import { configured, eb, mapTransaction } from "../_lib/enable.js";
import { norm, suggest, partijIndex, findLid } from "../_lib/regels.js";
import { meldPush } from "../_lib/push.js";
import { splitsBulk } from "../_lib/bcsplit.js";

const slug = s => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
const r2 = n => Math.round(n * 100) / 100;

// Haalt nieuwe verrichtingen op voor alle gekoppelde rekeningen en boekt ze.
// Wordt om 9u, 13u en 17u aangeroepen door een geplande taak in Supabase (pg_cron, functie bank_sync_cron) of via de knop "Nu ophalen".
export default async function handler(req, res) {
  try {
    let sb, manueel = false;
    if (isCron(req) || await isDbCron(req)) sb = admin();
    else { if (req.method !== "POST") throw httpErr(405, "Gebruik POST"); ({ sb } = await requireUser(req, { boek: true })); manueel = true; }
    if (!configured()) throw httpErr(501, "Enable Banking is nog niet ingesteld");
    const result = await syncAll(sb, { manueel });
    res.status(200).json(result);
  } catch (e) { sendError(res, e); }
}

// Saldo van de rekening bij de bank. Banken beperken automatische opvragingen (PSD2: ongeveer 4 per dag),
// dus automatisch hooguit één keer per dag; met "Nu ophalen" altijd.
const VOORKEUR = ["CLBD", "ITBD", "XPCD", "CLAV", "ITAV", "OPBD"];
async function haalSaldo(acc) {
  const r = await eb(`/accounts/${encodeURIComponent(acc.uid)}/balances`);
  const L = (r.balances || []).filter(b => b.balance_amount && b.balance_amount.amount != null);
  if (!L.length) return null;
  L.sort((a, b) => (VOORKEUR.indexOf(a.balance_type) + 1 || 99) - (VOORKEUR.indexOf(b.balance_type) + 1 || 99));
  const b = L[0], geboekt = ["CLBD", "OPBD", "ITBD", "XPCD"].includes(b.balance_type);
  return { bedrag: r2(Number(b.balance_amount.amount)), munt: b.balance_amount.currency || "EUR", type: b.balance_type || "", naam: b.name || "",
    datum: b.reference_date || String(b.last_change_date_time || "").slice(0, 10) || null, geboekt, op: new Date().toISOString() };
}
export async function syncAll(sb, { manueel = false } = {}) {
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
      if (manueel || !acc.saldo || String(acc.saldo.op || "").slice(0, 10) !== nu.toISOString().slice(0, 10)) {
        try { const sd = await haalSaldo(acc); if (sd) { acc.saldo = sd; totaal.saldo = r2((totaal.saldo || 0) + sd.bedrag); } }
        catch (e) { console.warn("saldo", acc.iban || acc.uid, e.message); if (acc.saldo) acc.saldo = { ...acc.saldo, fout: e.message.slice(0, 160) }; }
      }
    }
    await sb.from("bank_koppelingen").update({ data: { ...d, laatste_sync: nu.toISOString() } }).eq("id", k.id);
  }
  // Bancontact-bulkstortingen meteen opsplitsen volgens de online betalingen van die dag (rest: Kalenders)
  try { const sp = await splitsBulk(sb); if (sp.gesplitst) totaal.gesplitst = sp.gesplitst; } catch (e) { console.error("splitsBulk", e); }
  if (totaal.nieuw || totaal.fouten.length || !manueel) { // automatische ophaling altijd loggen, ook zonder nieuwe transacties
    await sb.from("imports").insert({ id: crypto.randomUUID(), data: { tijd: nu.toISOString(), bestand: "Enable Banking", bron: "api", jaar: nu.getFullYear(), nieuw: totaal.nieuw, dubbel: totaal.dubbel, open: totaal.open, fouten: totaal.fouten } });
  }
  try { await bankPush(sb, kops, totaal, nu); } catch (e) { console.error("bankPush", e); }
  return totaal;
}
// pushmeldingen: nieuwe transacties te verwerken, en (één keer per dag) een verlopen of bijna verlopen toestemming
async function bankPush(sb, kops, totaal, nu) {
  if (totaal.open) await meldPush(sb, "boek", { titel: totaal.open === 1 ? "1 transactie te verwerken" : totaal.open + " transacties te verwerken", tekst: `${totaal.nieuw} nieuwe verrichting${totaal.nieuw === 1 ? "" : "en"} opgehaald van de bank`, url: "/#verwerken", tag: "verwerken" });
  const dag = nu.toISOString().slice(0, 10), L = kops.map(k => k.data || {}).filter(d => d.valid_until).map(d => ({ d, n: Math.floor((new Date(d.valid_until) - nu) / 864e5) })).filter(x => x.n < 7);
  if (!L.length) return;
  const { data: c } = await sb.from("config").select("data").eq("id", "bankmelding").maybeSingle();
  if (c && c.data && c.data.dag === dag) return;
  await sb.from("config").upsert({ id: "bankmelding", data: { dag } });
  const weg = L.some(x => x.n < 0), x = L[0];
  await meldPush(sb, "boek", { titel: weg ? "Koppeling met de bank verlopen" : "Koppeling met de bank verloopt binnenkort", tekst: weg ? `${x.d.aspsp || "Bank"}: er worden geen verrichtingen meer opgehaald. Koppel opnieuw.` : `${x.d.aspsp || "Bank"}: nog ${x.n} ${x.n === 1 ? "dag" : "dagen"} geldig. Koppel opnieuw om de toestemming te vernieuwen.`, url: "/#bank", tag: "bank" });
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
