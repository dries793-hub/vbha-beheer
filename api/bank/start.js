import crypto from "node:crypto";
import { requireUser, sendError, httpErr } from "../_lib/sb.js";
import { configured, eb } from "../_lib/enable.js";

// Start de toestemming bij de bank en geeft de URL terug waar de gebruiker naartoe moet.
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") throw httpErr(405, "Gebruik POST");
    const { user, sb } = await requireUser(req, { write: true });
    if (!configured()) throw httpErr(501, "Enable Banking is nog niet ingesteld");
    const site = String(process.env.SITE_URL || "").replace(/\/+$/, "");
    if (!site) throw httpErr(500, "SITE_URL ontbreekt");
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const aspsp = String(body.aspsp || "").trim();
    if (!aspsp) throw httpErr(400, "Kies een bank");
    const psuType = body.psuType === "personal" ? "personal" : "business";
    const maxSec = Number(body.maxSeconds) || 180 * 86400;
    const geldigTot = new Date(Date.now() + Math.min(maxSec, 180 * 86400) * 1000 - 3600 * 1000).toISOString();
    const state = crypto.randomUUID();
    await sb.from("bank_auth").delete().lt("created_at", new Date(Date.now() - 86400000).toISOString());
    const { error } = await sb.from("bank_auth").insert({ state, user_id: user.id, data: { aspsp, psuType } });
    if (error) throw error;
    const r = await eb("/auth", {
      method: "POST",
      body: { access: { valid_until: geldigTot }, aspsp: { name: aspsp, country: "BE" }, state, redirect_url: `${site}/api/bank/callback`, psu_type: psuType },
    });
    res.status(200).json({ url: r.url });
  } catch (e) { sendError(res, e); }
}
