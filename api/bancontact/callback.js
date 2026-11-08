import { admin } from "../_lib/sb.js";
import { onlineConfigured } from "../_lib/betaalprovider.js";
import { controleerBetaling, BETAALTABELLEN } from "../_lib/betaal.js";

// Bancontact Pay (JSON met paymentId) meldt hier een statuswijziging. We vertrouwen de inhoud niet blind:
// de status wordt altijd opnieuw opgevraagd bij Bancontact met onze eigen API-sleutel.
export default async function handler(req, res) {
  try {
    if (req.method !== "POST" || !onlineConfigured()) return res.status(200).end();
    let b = req.body || {};
    if (typeof b === "string") { try { b = JSON.parse(b || "{}"); } catch { b = Object.fromEntries(new URLSearchParams(b)); } }
    const pid = String(b.paymentId || b.id || "");
    if (!pid) return res.status(200).end();
    const sb = admin();
    for (const t of BETAALTABELLEN) {
      const { data: rows } = await sb.from(t).select("id,data").eq("data->betaling->>id", pid).limit(1);
      if (rows && rows[0]) { await controleerBetaling(sb, t, rows[0]); break; }
    }
    res.status(200).end();
  } catch (e) {
    console.error(e);
    res.status(500).end(); // Bancontact probeert het dan later opnieuw
  }
}
