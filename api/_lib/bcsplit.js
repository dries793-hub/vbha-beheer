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
  ["tickets", r => ({ cat: "Fuif", wie: [r.voornaam, r.naam].filter(Boolean).join(" ") || "tickets" })],
  ["shop_orders", r => ({ cat: "Webshop", wie: r.klant ? [r.klant.voornaam, r.klant.naam].filter(Boolean).join(" ") : "bestelling" })],
  ["kassa", r => ({ cat: KASSA_CAT[r.activiteit] || "Andere opbrengsten", wie: "kassa" })],
  ["sponsors", r => ({ cat: "Sponsoring", wie: r.bedrijf || r.naam })],
  ["facturen", r => ({ cat: (r.categorie || "Andere opbrengsten"), wie: r.nr ? "factuur " + r.nr : "factuur" })],
];
export const isBulk = b => b && b.rekening !== "Kas" && b.richting !== "uit" && /bancontact|payconiq/i.test(b.partij || "") && RE.test(String(b.mededeling || "").trim());

async function onlinePerDag(sb) {
  const per = new Map();
  for (const [tabel, f] of BRONNEN) {
    let rows = [];
    try { rows = await selectAll(sb, tabel); } catch (e) { continue; }
    for (const row of rows) {
      const d = row.data || {}, b = d.betaling;
      if (!b || b.status !== "SUCCEEDED" || !b.betaaldOp || !(Number(b.bedrag) > 0)) continue;
      const dag = dagBxl(b.betaaldOp), x = f({ ...d, _id: row.id });
      (per.get(dag) || per.set(dag, []).get(dag)).push({ ...x, bedrag: r2(Number(b.bedrag)), bron: tabel, id: row.id });
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
  const per = await onlinePerDag(sb);
  let nr = {};
  for (const b of alle) nr[b.jaar] = Math.max(nr[b.jaar] || 0, Number(b.nr) || 0);
  for (const b of todo) {
    const m = String(b.mededeling).trim().match(RE), dag = `${m[1]}-${m[2]}-${m[3]}`;
    const L = per.get(dag) || [], totaal = r2(Number(b.bedrag) || 0), gekend = r2(L.reduce((s, x) => s + x.bedrag, 0));
    if (gekend > totaal + 0.001) { uit.overgeslagen.push({ id: b.id, reden: `online betalingen van ${dag} (${gekend}) zijn meer dan de storting (${totaal})` }); continue; }
    // groeperen: lidgeld per lid, de rest per categorie
    const groep = new Map();
    for (const x of L) { const k = x.cat === "Lidgeld" && x.lidId ? "L:" + x.lidId : "C:" + x.cat; const g = groep.get(k) || { cat: x.cat, lidId: x.cat === "Lidgeld" ? x.lidId || null : null, bedrag: 0, wie: [] }; g.bedrag = r2(g.bedrag + x.bedrag); if (x.wie) g.wie.push(x.wie); groep.set(k, g); }
    const delen = [...groep.values()];
    const rest = r2(totaal - gekend);
    if (rest > 0.004) delen.push({ cat: "Kalenders", lidId: null, bedrag: rest, wie: [], rest: true });
    if (!delen.length) continue;
    const dagTxt = `${m[3]}/${m[2]}`;
    const med = d => d.rest ? `Bancontact ${dagTxt}: niet via de app (bv. kalenders)` : `Bancontact ${dagTxt}: ${d.cat}${d.wie.length ? " – " + [...new Set(d.wie)].slice(0, 6).join(", ") + (d.wie.length > 6 ? " …" : "") : ""}`;
    const basis = { ...b }; delete basis.id;
    if (proef) { uit.plan.push({ id: b.id, dag, totaal, delen: delen.map(d => ({ cat: d.cat, bedrag: d.bedrag, mededeling: med(d) })) }); continue; }
    const [eerste, ...andere] = delen;
    const bulk = { totaal, dag, delen: delen.length, mededeling: b.mededeling, op: new Date().toISOString() };
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
  return uit;
}
