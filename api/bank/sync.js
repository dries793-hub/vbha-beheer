import crypto from "node:crypto";
import { admin, requireUser, isCron, isDbCron, sendError, selectAll, httpErr } from "../_lib/sb.js";
import { configured, eb, mapTransaction } from "../_lib/enable.js";
import { norm, suggest, partijIndex, findLid } from "../_lib/regels.js";
import { meldPush } from "../_lib/push.js";
import { splitsBulk } from "../_lib/bcsplit.js";

const slug = s => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
const r2 = n => Math.round(n * 100) / 100;

// Haalt nieuwe verrichtingen op voor alle gekoppelde rekeningen en boekt ze.
// Wordt dagelijks om 13u aangeroepen door een geplande taak in Supabase (pg_cron, functie bank_sync_cron) of via de knop "Nu ophalen".
export default async function handler(req, res) {
  try {
    let sb, manueel = false;
    if (isCron(req) || await isDbCron(req)) sb = admin();
    else { if (req.method !== "POST") throw httpErr(405, "Gebruik POST"); ({ sb } = await requireUser(req, { boek: true })); manueel = true; }
    if (!configured()) throw httpErr(501, "Enable Banking is nog niet ingesteld");
    // wie zelf ophaalt, is aanwezig: PSU-headers meesturen (telt dan niet mee voor de daglimiet van de bank)
    const ip = manueel ? String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "").split(",")[0].trim() : "";
    const result = await syncAll(sb, { manueel, psu: ip ? { ip, ua: String(req.headers["user-agent"] || "").slice(0, 300) } : null });
    res.status(200).json(result);
  } catch (e) { sendError(res, e); }
}

/* Verrichtingen ophalen vanaf een datum. Volgt de continuation_key van de bank. Sommige banken (bv. Argenta) geven per
   antwoord maar een beperkt aantal verrichtingen (de recentste) zonder vervolgsleutel: dan het oudere stuk apart opvragen
   (tot de dag van de oudste ontvangen verrichting), zodat er bij drukke dagen niets wegvalt. */
async function haalTx(acc, dateFrom, psu) {
  const alle = new Map(), sleutel = t => String(t.entry_reference || t.transaction_id || JSON.stringify([t.booking_date, t.transaction_amount, t.remittance_information]));
  let dateTo = null;
  for (let ronde = 0; ronde < 8; ronde++) {
    const deel = []; let ck = null, guard = 0;
    do {
      const q = new URLSearchParams({ date_from: dateFrom, transaction_status: "BOOK" });
      if (dateTo) q.set("date_to", dateTo);
      if (ck) q.set("continuation_key", ck);
      const r = await eb(`/accounts/${encodeURIComponent(acc.uid)}/transactions?${q}`, { psu });
      deel.push(...(r.transactions || []));
      ck = r.continuation_key || null;
    } while (ck && ++guard < 50);
    const voor = alle.size; for (const t of deel) alle.set(sleutel(t), t);
    // een "rond" aantal zonder vervolgsleutel wijst op een afgekapt antwoord: het oudere deel apart opvragen
    if (deel.length < 25 || deel.length % 25 !== 0) break;
    const oudste = deel.map(t => String(t.booking_date || t.value_date || "").slice(0, 10)).filter(Boolean).sort()[0];
    if (!oudste || oudste <= dateFrom || oudste === dateTo || alle.size === voor) break;
    dateTo = oudste;
  }
  return [...alle.values()];
}

// Saldo van de rekening bij de bank. Banken beperken automatische opvragingen (PSD2: ongeveer 4 per dag),
// dus automatisch hooguit één keer per dag; met "Nu ophalen" altijd.
const VOORKEUR = ["CLBD", "ITBD", "XPCD", "CLAV", "ITAV", "OPBD"];
async function haalSaldo(acc, psu) {
  const r = await eb(`/accounts/${encodeURIComponent(acc.uid)}/balances`, { psu });
  const L = (r.balances || []).filter(b => b.balance_amount && b.balance_amount.amount != null);
  if (!L.length) return null;
  L.sort((a, b) => (VOORKEUR.indexOf(a.balance_type) + 1 || 99) - (VOORKEUR.indexOf(b.balance_type) + 1 || 99));
  const b = L[0], geboekt = ["CLBD", "OPBD", "ITBD", "XPCD"].includes(b.balance_type);
  return { bedrag: r2(Number(b.balance_amount.amount)), munt: b.balance_amount.currency || "EUR", type: b.balance_type || "", naam: b.name || "",
    datum: b.reference_date || String(b.last_change_date_time || "").slice(0, 10) || null, geboekt, op: new Date().toISOString() };
}
export async function syncAll(sb, { manueel = false, psu = null } = {}) {
  const { data: kops, error } = await sb.from("bank_koppelingen").select("id,data");
  if (error) throw error;
  const totaal = { nieuw: 0, dubbel: 0, open: 0, rekeningen: 0, fouten: [] };
  if (!kops?.length) return totaal;

  const regels = (await selectAll(sb, "regels")).map(r => ({ id: r.id, ...r.data }));
  const leden = (await selectAll(sb, "leden")).map(r => ({ id: r.id, ...r.data }));
  const facturen = (await selectAll(sb, "facturen").catch(() => [])).map(r => ({ id: r.id, ...r.data })).filter(f => f.nr && f.type !== "credit");
  const sponsors = (await selectAll(sb, "sponsors").catch(() => [])).map(r => ({ id: r.id, ...r.data }));
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
    // vertrekken van de laatste ophaling die echt gelukt is (niet van een poging die op de daglimiet botste), met 4 dagen overlap
    const basis = d.laatste_ok || d.laatste_sync;
    const vanaf = basis ? new Date(new Date(basis).getTime() - 4 * 86400000) : eersteVanaf;
    let ok = false;
    const dateFrom = vanaf.toISOString().slice(0, 10);
    for (const acc of d.accounts || []) {
      totaal.rekeningen++;
      try {
        const txs = await haalTx(acc, dateFrom, psu);
        if (!txs.length) totaal.leeg = (totaal.leeg || 0) + 1; // de bank gaf geen verrichtingen terug (bv. limiet van automatische opvragingen bereikt)
        const r = await boekTransacties(sb, txs, { regels, leden, facturen, sponsors, bron: d.aspsp || "Bank" });
        // controlelijst voor de saldocontrole in de app: de verrichtingen bij de bank (bij manueel ophalen tot 89 dagen terug)
        try {
          let lijst = txs, van = dateFrom;
          if (manueel) {
            const v = new Date(Math.max(new Date(`${nu.getFullYear()}-01-01`).getTime(), nu.getTime() - 89 * 86400000)).toISOString().slice(0, 10);
            if (v < dateFrom) { lijst = await haalTx(acc, v, psu); van = v; }
          }
          const tx = lijst.map(mapTransaction).filter(b => b.datum && b.bedrag).map(b => ({ d: b.datum, b: b.bedrag, r: b.richting, ref: b.bankRef || "", p: String(b.partij || "").slice(0, 60), m: String(b.mededeling || "").slice(0, 80) }));
          // een bredere lijst van een vorige keer aanvullen in plaats van overschrijven
          const oud = acc.controle && acc.controle.van && acc.controle.van < van && Array.isArray(acc.controle.tx) ? acc.controle : null;
          acc.controle = oud ? { van: oud.van, op: nu.toISOString(), tx: [...oud.tx.filter(x => x.d < van), ...tx].slice(-800) } : { van, op: nu.toISOString(), tx: tx.slice(-800) };
        } catch (e) { console.warn("controle", e.message); acc.controleFout = String(e.message || e).slice(0, 200); }
        totaal.nieuw += r.nieuw; totaal.dubbel += r.dubbel; totaal.open += r.open; ok = true;
      } catch (e) { totaal.fouten.push(`${acc.iban || acc.uid}: ${e.message}`); }
      // saldo altijd mee ophalen (de automatische ophaling gebeurt nog maar één keer per dag); anders blijft er een saldo van eerder
      // die dag staan terwijl er intussen nieuwe verrichtingen ingelezen zijn, en toont de app een vals verschil
      {
        try { const sd = await haalSaldo(acc, psu); if (sd) { acc.saldo = sd; totaal.saldo = r2((totaal.saldo || 0) + sd.bedrag); } }
        catch (e) { console.warn("saldo", acc.iban || acc.uid, e.message); if (acc.saldo) acc.saldo = { ...acc.saldo, fout: e.message.slice(0, 160) }; }
      }
    }
    await sb.from("bank_koppelingen").update({ data: { ...d, laatste_sync: nu.toISOString(), ...(ok ? { laatste_ok: nu.toISOString() } : {}) } }).eq("id", k.id);
  }
  // Bancontact-bulkstortingen meteen opsplitsen volgens de online betalingen van die dag (rest: Kalenders)
  try { const sp = await splitsBulk(sb); if (sp.gesplitst) totaal.gesplitst = sp.gesplitst; } catch (e) { console.error("splitsBulk", e); }
  // kastickets (betaald met de bankkaart van de vriendenkring) aan de nieuwe transacties koppelen
  try { const { kasticketKoppel } = await import("../_lib/terugbetaling.js"); const kt = await kasticketKoppel(sb); if (kt.gekoppeld) totaal.kastickets = kt.gekoppeld; } catch (e) { console.error("kasticket", e); }
  if (totaal.nieuw || totaal.fouten.length || !manueel) { // automatische ophaling altijd loggen, ook zonder nieuwe transacties
    await sb.from("imports").insert({ id: crypto.randomUUID(), data: { tijd: nu.toISOString(), bestand: "Enable Banking", bron: "api", jaar: nu.getFullYear(), nieuw: totaal.nieuw, dubbel: totaal.dubbel, open: totaal.open, fouten: totaal.fouten, ...(totaal.leeg ? { leeg: totaal.leeg } : {}) } });
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

/* Inkomende betaling van een eigen factuur (gestructureerde mededeling of factuurnummer) of van een gekende sponsor:
   categorie van de factuur (anders Sponsoring) en de sponsor meteen invullen, nog vóór de automatische regels. */
const ogmUit = t => { const m = String(t || "").match(/\+{3}\s*(\d{3})\s*\/\s*(\d{4})\s*\/\s*(\d{5})\s*\+{3}/) || String(t || "").match(/(?:^|\D)(\d{3})(\d{4})(\d{5})(?:\D|$)/); return m ? m[1] + m[2] + m[3] : ""; };
function eigenFactuur(b, facturen, sponsors) {
  if (b.richting !== "in") return null;
  const ogm = ogmUit(b.mededeling), nrM = String(b.mededeling || "").toUpperCase().replace(/\s+/g, "").match(/F\d{6,7}/);
  const f = (facturen || []).find(x => (ogm && String(x.ogm || "") === ogm) || (nrM && String(x.nr || "").toUpperCase() === nrM[0]));
  if (f) { const sp = (f.klant && f.klant.sponsorId) || ""; return { categorie: f.categorie || (sp ? "Sponsoring" : ""), sponsorId: sp || null, naam: "Factuur " + f.nr }; }
  const p = norm(b.partij); if (!p || Math.abs(b.bedrag) < 50) return null;
  const s = (sponsors || []).find(x => { const n = norm(x.bedrijf || ""); return n.length >= 5 && (p === n || p.includes(n) || (p.length >= 8 && n.includes(p))); });
  return s ? { categorie: "Sponsoring", sponsorId: s.id, naam: "Sponsor " + (s.bedrijf || "") } : null;
}

export async function boekTransacties(sb, txs, { regels, leden, facturen = [], sponsors = [] }) {
  const items = txs.map(mapTransaction).filter(b => b.datum && b.bedrag);
  const jaren = [...new Set(items.map(b => Number(b.datum.slice(0, 4))))];
  const out = { nieuw: 0, dubbel: 0, open: 0 };
  for (const jaar of jaren) {
    const bestaand = (await selectAll(sb, "boekingen", q => q.eq("jaar", jaar))).map(r => ({ id: r.id, ...r.data }));
    const pidx = partijIndex(bestaand);
    const ids = new Set(bestaand.map(b => b.id));
    const refs = new Set(bestaand.map(b => b.bankRef).filter(Boolean));
    // vergelijken op datum/bedrag/partij enkel met transacties zonder bankreferentie (oude CSV-imports en manuele boekingen):
    // twee echte, identieke betalingen op dezelfde dag (bv. twee keer € 7 via de kaartlezer) hebben elk een eigen bankreferentie
    // geen opgesplitste delen (bulkVan) of eerder via de bank ingelezen boekingen: een deel van een Bancontact-storting
    // (bv. € 130 banket) mag een echte, andere storting van hetzelfde bedrag op dezelfde dag niet als "dubbel" laten wegvallen
    const fuzzy = new Set(bestaand.filter(b => !b.bankRef && !b.bulkVan && b.bron !== "api" && !String(b.id).startsWith("eb-")).map(b => `${b.datum}|${r2(b.bedrag)}|${b.richting || "in"}|${norm(b.partij)}`));
    let nr = bestaand.reduce((m, b) => Math.max(m, Number(b.nr) || 0), 0);
    const nieuw = items.filter(b => Number(b.datum.slice(0, 4)) === jaar).sort((a, c) => a.datum.localeCompare(c.datum));
    for (const b of nieuw) {
      const id = b.bankRef ? `eb-${slug(b.bankRef).slice(0, 120)}` : `eb-${crypto.createHash("sha1").update(`${b.datum}|${b.bedrag}|${b.richting}|${b.partij}|${b.mededeling}`).digest("hex").slice(0, 24)}`;
      const fz = `${b.datum}|${b.bedrag}|${b.richting}|${norm(b.partij)}`;
      if (ids.has(id) || (b.bankRef && refs.has(b.bankRef)) || fuzzy.has(fz)) { out.dubbel++; continue; }
      const ef = eigenFactuur(b, facturen, sponsors);
      const s = ef && ef.categorie ? { categorie: ef.categorie, naam: ef.naam, zeker: true } : suggest(b, regels, pidx);
      const categorie = s ? s.categorie : "";
      const status = s && !s.zeker ? "controle" : null;
      const data = { ...b, jaar, nr: ++nr, categorie, rekening: "Rekening", bron: "api", status, regelNaam: s ? s.naam : "", lidId: categorie === "Lidgeld" ? findLid(b, leden, jaar) : null, ...(ef && ef.sponsorId ? { sponsorId: ef.sponsorId } : {}) };
      const { error } = await sb.from("boekingen").insert({ id, data });
      if (error) { if (error.code === "23505") { out.dubbel++; nr--; continue; } throw error; }
      // fuzzy enkel voor transacties zonder bankreferentie: twee echte, identieke betalingen met elk een eigen referentie blijven allebei
      ids.add(id); if (b.bankRef) refs.add(b.bankRef); else fuzzy.add(fz); out.nieuw++;
      if (!categorie || status) out.open++;
    }
  }
  return out;
}
