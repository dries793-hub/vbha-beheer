import { selectAll } from "./sb.js";

/* Bancontact Pay stort online betalingen per dag in één bedrag ("BulkRecon"), bv. mededeling "20261108-…-BulkRecon-…".
   Die storting wordt opgesplitst volgens de online betalingen die de app zelf die dag registreerde
   (banket, lidgeld, familiedag, fuiftickets, webshop, kassa, sponsoring). Wat overblijft (bv. kalenders betaald
   via de vaste QR-code) gaat naar Kalenders. De oorspronkelijke transactie wordt het eerste deel; de andere delen
   krijgen hetzelfde bankafschrift (bulkVan). Enkel transacties die nog geen categorie hebben (of nog te controleren zijn). */
const RE = /^(\d{4})(\d{2})(\d{2})-.*bulkrecon/i;
const r2 = n => Math.round(n * 100) / 100;
const dagBxl = iso => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const KASSA_CAT = { fuif: "Fuif", kinderfeest: "Kinderfeest", jaarmarkt: "Jaarmarkt" };
const BRONNEN = [
  ["banket", r => ({ cat: "Banket", wie: r.naam })],
  ["leden", r => ({ cat: "Lidgeld", wie: [r.voornaam, r.naam].filter(Boolean).join(" "), lidId: r._id })],
  ["familiedag", r => ({ cat: "Familiedag", wie: r.naam })],
  ["kinderfeest", r => ({ cat: "Kinderfeest", wie: (r.lid || "") + " (bijbetaling cadeau)" })],
  ["tickets", r => ({ cat: "Fuif", wie: [r.voornaam, r.naam].filter(Boolean).join(" ") || "tickets" })],
  ["shop_orders", r => ({ cat: "Webshop", wie: r.klant ? [r.klant.voornaam, r.klant.naam].filter(Boolean).join(" ") : "bestelling" })],
  // kassa: per categorie van de verkochte tegels (bv. Boekje 150 jaar -> "150 jaar"), de rest bij de activiteit
  ["kassa", r => { const def = KASSA_CAT[r.activiteit] || "Andere opbrengsten", m = new Map();
    for (const i of r.items || []) { const c = i.categorie || (r._tegelCat && r._tegelCat[i.id]) || def; m.set(c, r2((m.get(c) || 0) + (Number(i.aantal) || 0) * (Number(i.prijs) || 0))); }
    if (m.size <= 1) return { cat: [...m.keys()][0] || def, wie: "kassa" };
    return [...m.entries()].map(([cat, bedrag]) => ({ cat, wie: "kassa", bedrag })); }],
  ["sponsors", r => ({ cat: "Sponsoring", wie: r.bedrijf || r.naam })],
  ["facturen", r => ({ cat: (r.categorie || "Andere opbrengsten"), wie: r.nr ? "factuur " + r.nr : "factuur" })],
];
export const payoutVan = med => { const m = String(med || "").trim().match(/^\d{8}-([a-z0-9]+)-/i); return m ? m[1] : null; };
export const isBulk = b => b && b.rekening !== "Kas" && b.richting !== "uit" && /bancontact|payconiq/i.test(b.partij || "") && RE.test(String(b.mededeling || "").trim());

async function onlinePerDag(sb, perTx) {
  const per = new Map();
  // categorie per tegel uit de kassa-instellingen (voor verkopen van vóór de categorie in de verkoop zelf werd bewaard)
  let TC = null; const tegelCats = async () => { if (TC) return TC; TC = {}; try { const { data } = await sb.from("config").select("data").eq("id", "kassa").maybeSingle(); for (const a of Object.values((data && data.data && data.data.activiteiten) || {})) for (const t of a.tegels || []) if (t.categorie) TC[t.id] = t.categorie; } catch (e) {} return TC; };
  for (const [tabel, f] of BRONNEN) {
    let rows = [];
    try { rows = await selectAll(sb, tabel); } catch (e) { continue; }
    for (const row of rows) {
      const d = row.data || {}, b = d.betaling;
      if (!b || b.status !== "SUCCEEDED" || !b.betaaldOp || !(Number(b.bedrag) > 0)) continue;
      const dag = dagBxl(b.betaaldOp), x = f({ ...d, _id: row.id, _tegelCat: tabel === "kassa" ? await tegelCats() : null });
      const L = per.get(dag) || per.set(dag, []).get(dag);
      const n0 = L.length;
      if (Array.isArray(x)) { // één betaling verdeeld over meerdere categorieën; afronding op het laatste deel
        let rest = r2(Number(b.bedrag));
        x.forEach((y, i) => { const bd = i === x.length - 1 ? rest : Math.min(rest, r2(y.bedrag)); rest = r2(rest - bd); L.push({ ...y, bedrag: bd, bron: tabel, id: row.id }); });
      } else L.push({ ...x, bedrag: r2(Number(b.bedrag)), bron: tabel, id: row.id });
      if (perTx && b.id) perTx.set(String(b.id), L.slice(n0));
    }
  }
  return per;
}

export async function splitsBulk(sb, { ids = null, proef = false } = {}) {
  const jaar = new Date().getFullYear();
  const alle = [];
  for (const j of [jaar - 1, jaar]) alle.push(...(await selectAll(sb, "boekingen", q => q.eq("jaar", j))).map(r => ({ id: r.id, ...r.data })));
  const todo = alle.filter(b => isBulk(b) && !b.bulk && !b.bulkVan && (ids ? ids.includes(b.id) : (!b.categorie || b.status === "controle")));
  const uit = { gesplitst: 0, delen: 0, overgeslagen: [], plan: [] };
  if (!todo.length) return uit;
  const perTx = new Map(), per = await onlinePerDag(sb, perTx);
  let nr = {};
  for (const b of alle) nr[b.jaar] = Math.max(nr[b.jaar] || 0, Number(b.nr) || 0);
  // 1) stortingen waarvan de uitbetaling in een opgeladen Bancontact-export staat: exact per betaling
  const exact = await exportSplits(sb, todo, perTx, nr, proef, uit);
  for (let i = todo.length - 1; i >= 0; i--) if (exact.has(todo[i].id)) todo.splice(i, 1);
  if (!todo.length) return uit;
  // Bancontact stort de betalingen van één dag soms in meerdere bedragen (meerdere stortingen met dezelfde datum):
  // die worden samen verdeeld. Wat van die dag al eerder werd uitgesplitst, telt niet opnieuw mee.
  const perDag = new Map();
  for (const b of todo) { const m = String(b.mededeling).trim().match(RE), dag = `${m[1]}-${m[2]}-${m[3]}`; (perDag.get(dag) || perDag.set(dag, []).get(dag)).push(b); }
  const dagVan = b => { if (b.bulk && b.bulk.dag) return b.bulk.dag; const o = b.bulkVan && alle.find(x => x.id === b.bulkVan); return o && o.bulk ? o.bulk.dag : null; };
  for (const [dag, G] of perDag) {
    G.sort((a, b) => (Number(b.bedrag) || 0) - (Number(a.bedrag) || 0));
    const [jj, mm, dd] = dag.split("-"), dagTxt = `${dd}/${mm}`;
    const L = per.get(dag) || [], totaal = r2(G.reduce((s, b) => s + (Number(b.bedrag) || 0), 0));
    // elke online betaling apart (lidgeld, banket, familiedag, tickets, webshop, sponsoring, facturen); de kassa per categorie
    const groep = new Map();
    for (const x of L) { const k = x.bron === "kassa" ? "K:" + x.cat : "P:" + x.bron + ":" + x.id + ":" + x.cat; const g = groep.get(k) || { cat: x.cat, lidId: x.cat === "Lidgeld" ? x.lidId || null : null, bedrag: 0, wie: [] }; g.bedrag = r2(g.bedrag + x.bedrag); if (x.wie) g.wie.push(x.wie); groep.set(k, g); }
    // al uitgesplitst voor deze dag (vorige storting van dezelfde dag): per categorie aftrekken
    const al = new Map();
    for (const b of alle) if (b.regelNaam === "Bancontact uitgesplitst" && !/niet via de app/.test(b.mededeling || "") && dagVan(b) === dag) al.set(b.categorie, r2((al.get(b.categorie) || 0) + (Number(b.bedrag) || 0)));
    const delen = [];
    for (const g of groep.values()) { const af = Math.min(al.get(g.cat) || 0, g.bedrag); if (af) al.set(g.cat, r2(al.get(g.cat) - af)); const bd = r2(g.bedrag - af); if (bd > 0.004) delen.push({ ...g, bedrag: bd }); }
    const gekend = r2(delen.reduce((s, d) => s + d.bedrag, 0));
    if (gekend > totaal + 0.001) { for (const b of G) uit.overgeslagen.push({ id: b.id, reden: `online betalingen van ${dag} (${gekend}) zijn meer dan de storting${G.length > 1 ? "en" : ""} (${totaal})` }); continue; }
    const rest = r2(totaal - gekend);
    if (rest > 0.004) delen.push({ cat: "Kalenders", lidId: null, bedrag: rest, wie: [], rest: true });
    if (!delen.length) continue;
    const med = d => d.rest ? `Bancontact ${dagTxt}: niet via de app (bv. kalenders)` : `Bancontact ${dagTxt}: ${d.cat}${d.wie.length ? " – " + [...new Set(d.wie)].slice(0, 6).join(", ") + (d.wie.length > 6 ? " …" : "") : ""}`;
    // de delen over de stortingen verdelen: elke storting wordt precies gevuld (een deel kan over twee stortingen lopen)
    const rij = delen.map(d => ({ ...d })), verdeeld = G.map(b => { let plaats = r2(Number(b.bedrag) || 0); const D = [];
      while (plaats > 0.004 && rij.length) { const d = rij[0], bd = r2(Math.min(d.bedrag, plaats)); D.push({ ...d, bedrag: bd }); d.bedrag = r2(d.bedrag - bd); plaats = r2(plaats - bd); if (d.bedrag <= 0.004) rij.shift(); }
      return { b, D }; });
    for (const { b, D } of verdeeld) {
      if (!D.length) continue;
      if (proef) { uit.plan.push({ id: b.id, dag, totaal: r2(Number(b.bedrag) || 0), delen: D.map(d => ({ cat: d.cat, bedrag: d.bedrag, mededeling: med(d) })) }); continue; }
      const basis = { ...b }; delete basis.id;
      const [eerste, ...andere] = D;
      const bulk = { totaal: r2(Number(b.bedrag) || 0), dag, delen: D.length, mededeling: b.mededeling, op: new Date().toISOString(), ...(G.length > 1 ? { samenMet: G.filter(x => x.id !== b.id).map(x => x.id) } : {}) };
      const upd = { ...basis, bedrag: eerste.bedrag, categorie: eerste.cat, lidId: eerste.lidId, status: null, regelNaam: "Bancontact uitgesplitst", mededeling: med(eerste), bulk };
      const { error: e1 } = await sb.from("boekingen").update({ data: upd }).eq("id", b.id); if (e1) throw e1;
      let i = 0;
      for (const d of andere) {
        i++; nr[b.jaar] = (nr[b.jaar] || 0) + 1;
        const { bankRef, ...zonderRef } = basis;
        const data = { ...zonderRef, nr: nr[b.jaar], bedrag: d.bedrag, categorie: d.cat, lidId: d.lidId, status: null, regelNaam: "Bancontact uitgesplitst", mededeling: med(d), bulkVan: b.id };
        const { error } = await sb.from("boekingen").upsert({ id: `${b.id}-d${i}`, data }); if (error) throw error;
        uit.delen++;
      }
      uit.gesplitst++;
    }
  }
  return uit;
}

/* Exacte opsplitsing volgens de opgeladen Bancontact-export (tabel bancontact_tx, per uitbetaling = payoutId in de mededeling).
   Elke betaling die de app kent (zelfde Bancontact-id) krijgt haar eigen deel; de rest (vaste QR-code: kalenders, steun) één deel Kalenders. */
async function exportSplits(sb, todo, perTx, nr, proef, uit) {
  const klaar = new Set(), P = new Map();
  for (const b of todo) { const p = payoutVan(b.mededeling); if (p) P.set(b.id, p); }
  if (!P.size) return klaar;
  const { data: rows } = await sb.from("bancontact_tx").select("id,payout,data").in("payout", [...new Set(P.values())]);
  const perP = new Map(); for (const r of rows || []) (perP.get(r.payout) || perP.set(r.payout, []).get(r.payout)).push(r.data);
  for (const b of todo) {
    const p = P.get(b.id), X = p && perP.get(p); if (!X || !X.length) continue;
    const som = r2(X.reduce((s, x) => s + (Number(x.amount) || 0), 0)), totaal = r2(Number(b.bedrag) || 0);
    if (Math.abs(som - totaal) > 0.004) { uit.overgeslagen.push({ id: b.id, reden: `export voor uitbetaling ${p}: ${som} ≠ storting ${totaal}` }); continue; }
    const dag = String(b.mededeling).trim().replace(/^(\d{4})(\d{2})(\d{2}).*/, "$1-$2-$3"), [, mm, dd] = dag.split("-"), dagTxt = `${dd}/${mm}`;
    const groep = new Map(); let qr = 0, qrN = 0;
    for (const x of X) {
      const L = perTx.get(String(x.id));
      if (L && L.length) for (const y of L) { const k = y.bron === "kassa" ? "K:" + y.cat : "P:" + y.bron + ":" + y.id + ":" + y.cat; const g = groep.get(k) || { cat: y.cat, lidId: y.cat === "Lidgeld" ? y.lidId || null : null, bedrag: 0, wie: [] }; g.bedrag = r2(g.bedrag + y.bedrag); if (y.wie && !g.wie.includes(y.wie)) g.wie.push(y.wie); groep.set(k, g); }
      else { qr = r2(qr + (Number(x.amount) || 0)); qrN++; }
    }
    const delen = [...groep.values()];
    // wat de app kent maar met een ander bedrag in de export: verschil naar de QR-rest
    const gekend = r2(delen.reduce((s, d) => s + d.bedrag, 0)); const rest = r2(totaal - gekend);
    if (rest < -0.004) { uit.overgeslagen.push({ id: b.id, reden: `app-betalingen (${gekend}) groter dan storting (${totaal})` }); continue; }
    if (rest > 0.004) delen.push({ cat: "Kalenders", lidId: null, bedrag: rest, wie: [], rest: true, n: qrN });
    const med = d => d.rest ? `Bancontact ${dagTxt}: kalenders via QR-code (${d.n} ${d.n === 1 ? "betaling" : "betalingen"})` : `Bancontact ${dagTxt}: ${d.cat}${d.wie.length ? " – " + d.wie.slice(0, 6).join(", ") + (d.wie.length > 6 ? " …" : "") : ""}`;
    klaar.add(b.id);
    if (proef) { uit.plan.push({ id: b.id, dag, totaal, export: true, delen: delen.map(d => ({ cat: d.cat, bedrag: d.bedrag, mededeling: med(d) })) }); continue; }
    const basis = { ...b }; delete basis.id;
    const [eerste, ...andere] = delen;
    const bulk = { totaal, dag, payout: p, export: true, delen: delen.length, mededeling: b.mededeling, op: new Date().toISOString() };
    const { error: e1 } = await sb.from("boekingen").update({ data: { ...basis, bedrag: eerste.bedrag, categorie: eerste.cat, lidId: eerste.lidId, status: null, regelNaam: "Bancontact uitgesplitst", mededeling: med(eerste), bulk } }).eq("id", b.id); if (e1) throw e1;
    let i = 0;
    for (const d of andere) {
      i++; nr[b.jaar] = (nr[b.jaar] || 0) + 1;
      const { bankRef, ...zonderRef } = basis;
      const { error } = await sb.from("boekingen").upsert({ id: `${b.id}-d${i}`, data: { ...zonderRef, nr: nr[b.jaar], bedrag: d.bedrag, categorie: d.cat, lidId: d.lidId, status: null, regelNaam: "Bancontact uitgesplitst", mededeling: med(d), bulkVan: b.id } }); if (error) throw error;
      uit.delen++;
    }
    uit.gesplitst++;
  }
  return klaar;
}

/* Bancontact-export (CSV uit het Bancontact-portaal) opslaan en de betrokken stortingen opnieuw (exact) opsplitsen.
   Stortingen die al per dag werden opgesplitst, worden eerst teruggezet. */
export async function bcExport(sb, rijen) {
  // ook exports zonder payoutId (volledige export van het account): dan blijft een eerder bewaarde uitbetaling behouden
  const R = (Array.isArray(rijen) ? rijen : []).filter(x => x && x.id && x.status !== "FAILED" && String(x.type || "CREDIT").toUpperCase() === "CREDIT" && String(x.status || "SUCCEEDED").toUpperCase() === "SUCCEEDED")
    .map(x => ({ id: String(x.id).slice(0, 60), payout: x.payoutId ? String(x.payoutId).slice(0, 60) : null, data: { id: String(x.id), amount: r2(Number(String(x.amount).replace(",", ".")) || 0), date: String(x.date || ""), time: String(x.time || ""), description: String(x.description || "").slice(0, 200), reference: String(x.reference || "").slice(0, 120), debtorName: String(x.debtorName || x.debtor_name || "").slice(0, 120), technology: String(x.technology || ""), payoutId: x.payoutId ? String(x.payoutId) : "" } }));
  if (!R.length) return { opgeslagen: 0, gesplitst: 0, uitbetalingen: 0 };
  const zonder = R.filter(r => !r.payout).map(r => r.id);
  for (let i = 0; i < zonder.length; i += 300) {
    const { data: oud } = await sb.from("bancontact_tx").select("id,payout").in("id", zonder.slice(i, i + 300)).not("payout", "is", null);
    const M = new Map((oud || []).map(o => [o.id, o.payout]));
    for (const r of R) if (!r.payout && M.has(r.id)) { r.payout = M.get(r.id); r.data.payoutId = r.payout; }
  }
  for (let i = 0; i < R.length; i += 500) { const { error } = await sb.from("bancontact_tx").upsert(R.slice(i, i + 500)); if (error) throw error; }
  const payouts = new Set(rijen.filter(x => x && x.id && x.payoutId).map(x => String(x.payoutId).slice(0, 60)));
  // stortingen in de boekhouding met een van die uitbetalingen: terugzetten als ze nog niet exact gesplitst zijn
  const jaar = new Date().getFullYear(), alle = [];
  for (const j of [jaar - 1, jaar]) alle.push(...(await selectAll(sb, "boekingen", q => q.eq("jaar", j))).map(r => ({ id: r.id, ...r.data })));
  const ids = [];
  for (const b of alle) {
    if (b.bulkVan) continue;
    const med = b.bulk ? b.bulk.mededeling : b.mededeling, p = payoutVan(med);
    if (!p || !payouts.has(p) || (b.bulk && b.bulk.export)) continue;
    if (b.bulk) { // per dag gesplitst: delen weg, origineel terug
      const delen = alle.filter(x => x.bulkVan === b.id);
      for (const d of delen) { const { error } = await sb.from("boekingen").delete().eq("id", d.id); if (error) throw error; }
      const terug = { ...b }; delete terug.id; delete terug.bulk;
      Object.assign(terug, { bedrag: b.bulk.totaal, mededeling: b.bulk.mededeling, categorie: null, regelNaam: null, lidId: null, status: null });
      const { error } = await sb.from("boekingen").update({ data: terug }).eq("id", b.id); if (error) throw error;
    } else if (b.categorie && b.status !== "controle") { // als geheel geboekt (bv. Kalenders): opnieuw laten verdelen
      const terug = { ...b }; delete terug.id; Object.assign(terug, { categorie: null, regelNaam: null, status: null });
      const { error } = await sb.from("boekingen").update({ data: terug }).eq("id", b.id); if (error) throw error;
    }
    ids.push(b.id);
  }
  const sp = ids.length ? await splitsBulk(sb, { ids }) : { gesplitst: 0, delen: 0, overgeslagen: [] };
  return { opgeslagen: R.length, uitbetalingen: payouts.size, stortingen: ids.length, ...sp };
}

/* Kalenders › Financieel: losse betalingen via de vaste QR-code (uit de opgeladen export), zonder de betalingen die de app zelf kent */
export async function kalStat(sb, jaar) {
  const perTx = new Map(); await onlinePerDag(sb, perTx);
  const rows = await selectAll(sb, "bancontact_tx");
  const J = Number(jaar), van = `${J}-11-01`, tot = `${J + 1}-01-31`;
  // dagen waarvan de Bancontact-storting (niet uitgesplitst) bij een andere activiteit staat (jaarmarkt, kinderfeest, …): niet meetellen
  const dagCat = new Map();
  for (const j of [J, J + 1]) for (const r of await selectAll(sb, "boekingen", q => q.eq("jaar", j))) { const b = r.data || {};
    if (b.bulkVan || b.bulk || b.richting === "uit" || !/bancontact|payconiq|segregated/i.test(b.partij || "")) continue;
    const m = String(b.mededeling || "").trim().match(/^(\d{4})(\d{2})(\d{2})/); if (!m) continue;
    const d = `${m[1]}-${m[2]}-${m[3]}`, S = dagCat.get(d) || dagCat.set(d, new Set()).get(d); S.add(b.categorie || ""); }
  const L = [];
  for (const r of rows) { const d = r.data || {}; if (perTx.has(String(d.id || r.id)) || /^VBHA /.test(d.reference || "")) continue;
    const m = String(d.date || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (!m) continue;
    const iso = `${m[3]}-${m[2]}-${m[1]}`; if (iso < van || iso > tot) continue;
    const S = dagCat.get(iso); if (S && !S.has("Kalenders")) continue;
    L.push({ a: r2(Number(d.amount) || 0), d: iso, t: String(d.time || "").slice(0, 5) }); }
  const laatst = rows.reduce((m, r) => { const x = String((r.data && r.data.date) || "").split("/").reverse().join("-"); return x > m ? x : m; }, "");
  return { betalingen: L.sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t)), laatsteExport: laatst || null };
}
