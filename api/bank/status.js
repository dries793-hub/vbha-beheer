import { requireUser, sendError } from "../_lib/sb.js";
import { configured } from "../_lib/enable.js";

export default async function handler(req, res) {
  try {
    const { sb, rol, rechten } = await requireUser(req);
    // de lijst met verrichtingen (saldocontrole) enkel voor wie de financiën mag zien
    const fin = ["admin", "bewerker"].includes(rol) || (rechten ? ["financien", "overzicht", "historiek"].some(f => ["lezen", "bewerken"].includes(rechten[f])) : rol === "boekhouder");
    if (!configured()) return res.status(200).json({ configured: false, koppelingen: [] });
    const { data, error } = await sb.from("bank_koppelingen").select("id,data,created_at").order("created_at");
    if (error) throw error;
    res.status(200).json({ configured: true, koppelingen: (data || []).map(r => ({ id: r.id, ...r.data, accounts: (r.data?.accounts || []).map(a => fin ? a : (({ controle, ...x }) => x)(a)) })) });
  } catch (e) { sendError(res, e); }
}
