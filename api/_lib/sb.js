import { createClient } from "@supabase/supabase-js";

export function admin() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw httpErr(500, "SUPABASE_URL of SUPABASE_SERVICE_ROLE_KEY ontbreekt");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function httpErr(status, message) { const e = new Error(message); e.status = status; return e; }

export function sendError(res, e) {
  if (!e.status || e.status >= 500) console.error(e);
  res.status(e.status || 500).json({ error: e.message || "Serverfout" });
}

// Controleert het Supabase-token uit de Authorization-header en de rol in 'bestuur'.
export async function requireUser(req, { write = false } = {}) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) throw httpErr(401, "Niet aangemeld");
  const sb = admin();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) throw httpErr(401, "Niet aangemeld");
  const { data: rol } = await sb.from("bestuur").select("rol").eq("user_id", data.user.id).maybeSingle();
  if (!rol) throw httpErr(403, "Geen toegang");
  if (write && rol.rol !== "bewerker") throw httpErr(403, "Je hebt alleen leesrechten");
  return { user: data.user, rol: rol.rol, sb };
}

export function isCron(req) {
  const s = process.env.CRON_SECRET;
  return !!s && req.headers.authorization === `Bearer ${s}`;
}

// Leest alle rijen van een tabel (per 1000).
export async function selectAll(sb, table, build = q => q) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(sb.from(table).select("id,data")).order("id").range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}
