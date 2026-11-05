import { requireUser, sendError } from "../_lib/sb.js";
import { configured } from "../_lib/enable.js";

export default async function handler(req, res) {
  try {
    const { sb } = await requireUser(req);
    if (!configured()) return res.status(200).json({ configured: false, koppelingen: [] });
    const { data, error } = await sb.from("bank_koppelingen").select("id,data,created_at").order("created_at");
    if (error) throw error;
    res.status(200).json({ configured: true, koppelingen: (data || []).map(r => ({ id: r.id, ...r.data })) });
  } catch (e) { sendError(res, e); }
}
