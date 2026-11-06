// Geeft de publieke Supabase-gegevens aan de browser. De anon key is publiek;
// de beveiliging zit in de Row Level Security-regels van de database.
export default function handler(req, res) {
  // Alleen https://<project>.supabase.co, zonder / of /rest/v1 op het einde
  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim().replace(/\/(rest|auth)\/v1.*$/i, "").replace(/\/+$/, "");
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return res.status(500).json({ error: "SUPABASE_URL of SUPABASE_ANON_KEY ontbreekt" });
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(200).json({ supabaseUrl, supabaseAnonKey });
}
