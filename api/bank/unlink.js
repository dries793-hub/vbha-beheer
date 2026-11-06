import { requireUser, sendError, httpErr } from "../_lib/sb.js";
import { eb } from "../_lib/enable.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") throw httpErr(405, "Gebruik POST");
    const { sb } = await requireUser(req, { boek: true });
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const id = String(body.id || "");
    if (!id) throw httpErr(400, "Geen koppeling opgegeven");
    try { await eb(`/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }); } catch (e) { console.warn("sessie verwijderen bij bank mislukt", e.message); }
    const { error } = await sb.from("bank_koppelingen").delete().eq("id", id);
    if (error) throw error;
    res.status(200).json({ ok: true });
  } catch (e) { sendError(res, e); }
}
