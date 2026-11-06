import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export function admin() {
  const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/(rest|auth)\/v1.*$/i, "").replace(/\/+$/, ""), key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url || !key) throw httpErr(500, "SUPABASE_URL of SUPABASE_SERVICE_ROLE_KEY ontbreekt");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function httpErr(status, message) { const e = new Error(message); e.status = status; return e; }

export function sendError(res, e) {
  if (!e.status || e.status >= 500) console.error(e);
  res.status(e.status || 500).json({ error: e.message || "Serverfout" });
}

// Rollen: admin (alles), boekhouder (enkel de boekhouding wijzigen), lezer (alleen lezen). "bewerker" is de oude naam voor admin.
export const isAdminRol = r => r === "admin" || r === "bewerker";
export const isBoekRol = r => isAdminRol(r) || r === "boekhouder";

// Controleert het Supabase-token uit de Authorization-header en de rol in 'bestuur'.
// write: enkel admin. boek: admin of boekhouder.
export async function requireUser(req, { write = false, boek = false } = {}) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) throw httpErr(401, "Niet aangemeld");
  const sb = admin();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) throw httpErr(401, "Niet aangemeld");
  const { data: rol } = await sb.from("bestuur").select("rol").eq("user_id", data.user.id).maybeSingle();
  if (!rol) throw httpErr(403, "Geen toegang");
  if (write && !isAdminRol(rol.rol)) throw httpErr(403, "Je hebt hiervoor geen rechten");
  if (boek && !isBoekRol(rol.rol)) throw httpErr(403, "Je hebt alleen leesrechten");
  return { user: data.user, rol: rol.rol, sb };
}

export function isCron(req) {
  const s = process.env.CRON_SECRET;
  return !!s && req.headers.authorization === `Bearer ${s}`;
}

// Geplande taak vanuit Supabase (pg_cron, 9u/13u/17u): stuurt de sleutel uit de afgeschermde tabel cron_geheim mee.
export async function isDbCron(req) {
  const h = String(req.headers["x-vbha-cron"] || "");
  if (h.length < 32) return false;
  const { data } = await admin().from("cron_geheim").select("sleutel").eq("id", 1).maybeSingle();
  const k = String(data?.sleutel || "");
  return k.length === h.length && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(h));
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
