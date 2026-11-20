import { gebruikers } from "./_lib/gebruikers.js";
import { gastToegang } from "./_lib/gasttoegang.js";
import { sendError } from "./_lib/sb.js";
// Geeft de publieke Supabase-gegevens aan de browser. De anon key is publiek;
// de beveiliging zit in de Row Level Security-regels van de database.
export default async function handler(req, res) {
  // /api/gebruikers komt hier binnen (rewrite in vercel.json): gebruikersbeheer voor de admin.
  if (req.query && req.query.f === "gebruikers") { try { return await gebruikers(req, res); } catch (e) { return sendError(res, e); } }
  // tijdelijke leestoegang tot de testomgeving (enkel in het testschema)
  if (req.query && req.query.f === "gast") { try { return await gastToegang(req, res); } catch (e) { return sendError(res, e); } }
  // Alleen https://<project>.supabase.co, zonder / of /rest/v1 op het einde
  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim().replace(/\/(rest|auth)\/v1.*$/i, "").replace(/\/+$/, "");
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return res.status(500).json({ error: "SUPABASE_URL of SUPABASE_ANON_KEY ontbreekt" });
  res.setHeader("Cache-Control", "public, max-age=300");
  const schema = String(process.env.DB_SCHEMA || (process.env.VERCEL_ENV === "preview" ? "test" : "public")).trim() || "public";
  res.status(200).json({ supabaseUrl, supabaseAnonKey, schema, test: process.env.VBHA_TEST === "1" || process.env.VERCEL_ENV === "preview" || schema !== "public" });
}
