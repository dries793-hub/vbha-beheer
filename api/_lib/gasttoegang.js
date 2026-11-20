import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { admin, requireUser, httpErr, isAdminRol, IS_TEST, DB_SCHEMA } from "./sb.js";
import { rateLimit } from "./publiek.js";

/* ============ Tijdelijke leestoegang tot de testomgeving (bv. voor een co-pilot) ============
   Werkt UITSLUITEND in de testomgeving (schema "test"); op productie geeft dit altijd een fout.
   POST /api/config?f=gast {actie:"maak"}            (beheerder) -> {link, tot}   link 24 uur geldig
   POST /api/config?f=gast {actie:"gebruik", token}  (iedereen met de link) -> {sessie}
   POST /api/config?f=gast {actie:"intrekken"}       (beheerder) -> alle gastlinks vervallen meteen
   - Eén vaste gastgebruiker (testgast@test.vbha.be) met rol "lezer" in test.bestuur, nooit in public.bestuur:
     de echte gegevens blijven dus onbereikbaar (de rechten in de database lezen voor productie enkel public.bestuur).
   - De link bevat een willekeurige sleutel; enkel de SHA-256 ervan staat in test.gast_toegang (geen leesrechten voor de app).
   - Na de vervaldatum geven de rechtenfuncties van het testschema (test.gast_ok) en requireUser geen toegang meer. */
const GAST_MAIL = "testgast@test.vbha.be", GELDIG_UUR = 24;
const hash = t => crypto.createHash("sha256").update(String(t)).digest("hex");
const body = req => (typeof req.body === "string" ? (() => { try { return JSON.parse(req.body || "{}"); } catch (e) { return {}; } })() : req.body || {});

async function gastGebruiker(sb) {
  const { data: r } = await sb.from("gast_toegang").select("user_id").limit(1).maybeSingle();
  if (r && r.user_id) { const { data } = await sb.auth.admin.getUserById(r.user_id); if (data && data.user) return data.user; }
  const pw = crypto.randomBytes(24).toString("base64url");
  const { data, error } = await sb.auth.admin.createUser({ email: GAST_MAIL, password: pw, email_confirm: true, user_metadata: { naam: "Testgast" } });
  if (!error && data && data.user) return data.user;
  for (let page = 1; page < 20; page++) {
    const { data: L, error: e2 } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (e2) throw e2;
    const u = L.users.find(x => String(x.email || "").toLowerCase() === GAST_MAIL);
    if (u) return u;
    if (L.users.length < 200) break;
  }
  throw error || new Error("Gastgebruiker aanmaken lukte niet.");
}

export async function gastToegang(req, res) {
  if (!IS_TEST || DB_SCHEMA !== "test") throw httpErr(403, "Enkel beschikbaar in de testomgeving.");
  if (req.method !== "POST") throw httpErr(405, "Gebruik POST");
  const b = body(req), sb = admin();
  if (b.actie === "maak" || b.actie === "intrekken") {
    const u = await requireUser(req);
    if (!isAdminRol(u.rol)) throw httpErr(403, "Enkel voor de beheerder.");
    if (b.actie === "intrekken") { await sb.from("gast_toegang").update({ tot: new Date().toISOString() }).gt("tot", new Date().toISOString()); return res.status(200).json({ ok: true }); }
    const g = await gastGebruiker(sb);
    const token = crypto.randomBytes(24).toString("base64url"), tot = new Date(Date.now() + GELDIG_UUR * 3600e3).toISOString();
    const { error } = await sb.from("gast_toegang").insert({ user_id: g.id, token_hash: hash(token), tot, door: (u.user && u.user.email) || null });
    if (error) throw error;
    const host = String(req.headers["x-forwarded-host"] || req.headers.host || "test.vbha.be");
    return res.status(200).json({ link: `https://${host}/?gast=${encodeURIComponent(token)}`, tot });
  }
  if (b.actie === "gebruik") {
    await rateLimit(sb, req, "gast", 20, 3600, httpErr);
    const t = String(b.token || "");
    if (t.length < 20) throw httpErr(400, "Ongeldige link.");
    const { data: r } = await sb.from("gast_toegang").select("user_id,tot").eq("token_hash", hash(t)).maybeSingle();
    if (!r || !(new Date(r.tot) > new Date())) throw httpErr(403, "Deze testlink is verlopen of ongeldig. Vraag een nieuwe link.");
    // enkel lezen, enkel in het testschema
    const { error: e1 } = await sb.from("bestuur").upsert({ user_id: r.user_id, email: GAST_MAIL, naam: "Testgast", rol: "lezer", rechten: null }, { onConflict: "user_id" });
    if (e1) throw e1;
    const pw = crypto.randomBytes(24).toString("base64url");
    const { error: e2 } = await sb.auth.admin.updateUserById(r.user_id, { password: pw });
    if (e2) throw e2;
    const url = String(process.env.SUPABASE_URL || "").trim().replace(/\/(rest|auth)\/v1.*$/i, "").replace(/\/+$/, "");
    const anon = createClient(url, String(process.env.SUPABASE_ANON_KEY || ""), { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: s, error: e3 } = await anon.auth.signInWithPassword({ email: GAST_MAIL, password: pw });
    if (e3 || !s || !s.session) throw httpErr(500, "Aanmelden lukte niet.");
    return res.status(200).json({ sessie: s.session, tot: r.tot });
  }
  throw httpErr(400, "Onbekende actie");
}
