import { admin, sendError, httpErr } from "./sb.js";
import crypto from "node:crypto";
import { algemeen, actieveLeden, rateLimit } from "./publiek.js";
import { meldPush } from "./push.js";

// Openbare stand van de kalenderronde voor de kaart op /kaart: status en datum per straat (zonder namen).
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=20");
  try {
    if (req.method === "POST") return await melding(req, res);
    if (req.method !== "GET") throw httpErr(405, "Gebruik GET");
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
  const id = "m" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
  const toon = lid.voornaam && lid.an ? `${lid.voornaam} ${lid.an}` : lid.naam;
  const { error } = await sb.from("rondemeldingen").insert({ id, data: { jaar: A.jaar, straten, soort, lidId: lid.id, naam: lid.naam, toon, op: new Date().toISOString(), stand: "open" } });
  if (error) throw error;
  try { await meldPush(sb, "admin", { titel: "Kalenderronde: melding te controleren", tekst: `${toon} meldt ${straten.length} ${straten.length === 1 ? "straat" : "straten"} als ${soort === "done" ? "gedaan" : "gereserveerd"}`, url: "/#ronde" }); } catch (e) {}
  return res.status(200).json({ ok: true });
}
