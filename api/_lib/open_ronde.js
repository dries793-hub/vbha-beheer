import { admin, sendError, httpErr } from "./sb.js";
import crypto from "node:crypto";
import { algemeen, actieveLeden, rateLimit, norm } from "./publiek.js";
import { meldPush } from "./push.js";

// Openbare stand van de kalenderronde voor de kaart op /kaart: status en datum per straat (zonder namen).
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=20");
  try {
    if (req.method === "POST") return await melding(req, res);
    if (req.method !== "GET") throw httpErr(405, "Gebruik GET");
    if (req.query && req.query.wie) return await wieReserveerde(req, res);
    const sb = admin();
    const A = await algemeen(sb);
    const out = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from("ronde").select("data").eq("data->>jaar", String(A.jaar)).range(from, from + 999);
      if (error) throw error;
      for (const r of data) { const d = r.data || {}; if (d.straat) out.push({ s: d.straat, st: d.status === "reserved" ? "r" : "d", at: d.at || "" }); }
      if (data.length < 1000) break;
    }
    const { data: pd } = await sb.from("jaren").select("data").eq("id", String(A.jaar)).maybeSingle();
    res.status(200).json({ jaar: A.jaar, perDoos: Number(pd?.data?.perDoos) || 100, straten: out, nu: new Date().toISOString() });
  } catch (e) { sendError(res, e); }
}

/* POST /api/ronde  {straten:[id], soort:"r"|"d", lidId, website}
   Een lid meldt straten als gereserveerd of gedaan. Dat komt NIET meteen op de kaart: het bestuur controleert eerst
   (tabel rondemeldingen, stand "open"); pas na goedkeuring in de app worden de straten aangeduid. */
async function melding(req, res) {
  res.setHeader("Cache-Control", "no-store");
  let b = req.body || {}; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  if (b.website) return res.status(200).json({ ok: true }); // honeypot
  const sb = admin();
  await rateLimit(sb, req, "rondemelding", 12, 3600, httpErr);
  const straten = [...new Set((Array.isArray(b.straten) ? b.straten : []).map(String).filter(s => /^[\w.~-]{1,80}$/.test(s)))].slice(0, 60);
  if (!straten.length) throw httpErr(400, "Kies minstens één straat.");
  const soort = b.soort === "d" ? "done" : b.soort === "r" ? "reserved" : null;
  if (!soort) throw httpErr(400, "Kies gereserveerd of gedaan.");
  const A = await algemeen(sb);
  const lid = (await actieveLeden(sb, A.jaar)).find(l => l.id === String(b.lidId || ""));
  if (!lid) throw httpErr(400, "Kies je naam uit de ledenlijst.");
  // al bedeelde straten kunnen niet meer gemeld worden; gereserveerde enkel nog als bedeeld
  { const st = {}, W = new Set(straten);
    for (let from = 0; ; from += 1000) {
      const { data: cur, error: e0 } = await sb.from("ronde").select("data").eq("data->>jaar", String(A.jaar)).range(from, from + 999);
      if (e0) throw e0;
      for (const r of cur) { const d = r.data || {}; if (d.straat && W.has(d.straat)) st[d.straat] = d.status === "reserved" ? "r" : "d"; }
      if (cur.length < 1000) break;
    }
    if (straten.some(s => st[s] === "d")) throw httpErr(400, "Een of meer straten zijn al bedeeld. Haal ze uit je selectie.");
    if (soort === "reserved" && straten.some(s => st[s] === "r")) throw httpErr(400, "Een of meer straten zijn al gereserveerd. Die kan je enkel nog als bedeeld doorgeven."); }
  const id = "m" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
  const toon = lid.voornaam && lid.an ? `${lid.voornaam} ${lid.an}` : lid.naam;
  const { error } = await sb.from("rondemeldingen").insert({ id, data: { jaar: A.jaar, straten, soort, lidId: lid.id, naam: lid.naam, toon, op: new Date().toISOString(), stand: "open" } });
  if (error) throw error;
  try { await meldPush(sb, "admin", { titel: "Kalenderronde: melding te controleren", tekst: `${toon} meldt ${straten.length} ${straten.length === 1 ? "straat" : "straten"} als ${soort === "done" ? "gedaan" : "gereserveerd"}`, url: "/#ronde" }); } catch (e) {}
  return res.status(200).json({ ok: true });
}

/* GET /api/ronde?wie=straat1,straat2: wie reserveerde deze straten (om bij "bedeeld" de naam al in te vullen).
   Geeft enkel id en naam van het lid terug, zoals de naamsuggesties in het meldvenster. */
async function wieReserveerde(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const W = new Set(String(req.query.wie).split(",").map(s => s.trim()).filter(s => /^[\w.~-]{1,80}$/.test(s)).slice(0, 60));
  if (!W.size) return res.status(200).json([]);
  const sb = admin(), A = await algemeen(sb), rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("ronde").select("data").eq("data->>jaar", String(A.jaar)).range(from, from + 999);
    if (error) throw error;
    for (const r of data) { const d = r.data || {}; if (d.straat && W.has(d.straat) && d.status === "reserved") rows.push(d); }
    if (data.length < 1000) break;
  }
  if (!rows.length) return res.status(200).json([]);
  const L = await actieveLeden(sb, A.jaar), out = [], gezien = new Set();
  const nm = x => norm(x).replace(/\s+/g, " ");
  for (const d of rows) {
    const l = (d.lidId && L.find(x => x.id === d.lidId)) || (d.by && L.find(x => nm(x.naam) === nm(d.by) || nm(x.voornaam + " " + x.an) === nm(d.by)));
    if (!l || gezien.has(l.id)) continue; gezien.add(l.id);
    out.push({ id: l.id, toon: l.voornaam && l.an ? `${l.voornaam} ${l.an}` : l.naam, naam: l.naam });
  }
  res.status(200).json(out);
}
