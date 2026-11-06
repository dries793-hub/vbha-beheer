import { admin, sendError, httpErr } from "./sb.js";
import { algemeen } from "./publiek.js";

// Openbare stand van de kalenderronde voor de kaart op /kaart: status, wie en wanneer per straat.
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, max-age=20");
  try {
    if (req.method !== "GET") throw httpErr(405, "Gebruik GET");
    const sb = admin();
    const A = await algemeen(sb);
    const out = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from("ronde").select("data").eq("data->>jaar", String(A.jaar)).range(from, from + 999);
      if (error) throw error;
      for (const r of data) { const d = r.data || {}; if (d.straat) out.push({ s: d.straat, st: d.status === "reserved" ? "r" : "d", by: d.by || "", at: d.at || "" }); }
      if (data.length < 1000) break;
    }
    const { data: pd } = await sb.from("jaren").select("data").eq("id", String(A.jaar)).maybeSingle();
    res.status(200).json({ jaar: A.jaar, perDoos: Number(pd?.data?.perDoos) || 100, straten: out, nu: new Date().toISOString() });
  } catch (e) { sendError(res, e); }
}
