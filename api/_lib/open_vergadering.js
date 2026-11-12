/* Bestuursvergadering: aanwezig of verontschuldigd doorgeven.
   - Openbaar (link in de herinneringsmail): /vergadering?i=<id>&t=<handtekening>
     GET /api/vergadering?i&t -> vergadering + bestuursleden + antwoorden; POST {i,t,lid,s} -> antwoord bewaren.
   - App: POST /api/mail?f=vgaanw {actie:"zet", id, lid, s} of {actie:"link", id}.
     Wie Agenda mag bewerken (of admin) zet het voor iedereen, anderen enkel voor zichzelf (naam = bestuurslid).
   Bewaard bij de vergadering: antwoorden = { <lidId>: {s:"aanwezig"|"verontschuldigd", op, via, door} }.
   Bij "Vergadering afronden" worden de aanwezigen hieruit vooraf aangeduid. */
import crypto from "node:crypto";
import { admin, httpErr, sendError, requireUser } from "./sb.js";
import { body, rateLimit, vandaagISO } from "./publiek.js";

const sleutel = () => String(process.env.BETAAL_GEHEIM || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
export const vgToken = id => crypto.createHmac("sha256", sleutel()).update(`vbha-vergadering|${id}`).digest("base64url").slice(0, 22);
function klopt(id, t) {
  if (!sleutel() || !id || typeof t !== "string") return false;
  const a = Buffer.from(vgToken(id)), b = Buffer.from(t);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// persoonlijke link per bestuurslid (ook zonder account): enkel voor dat lid geldig
export const vgLidToken = (id, lid) => crypto.createHmac("sha256", sleutel()).update(`vbha-vergadering|${id}|${lid}`).digest("base64url").slice(0, 22);
function kloptLid(id, lid, t) {
  if (!sleutel() || !id || !lid || typeof t !== "string") return false;
  const a = Buffer.from(vgLidToken(id, lid)), b = Buffer.from(t);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const site = () => String(process.env.SITE_URL || "https://vbha-beheer.vercel.app").replace(/\/+$/, "");
export const vgLink = id => `${site()}/vergadering?i=${encodeURIComponent(id)}&t=${vgToken(id)}`;
export const vgLidLink = (id, lid, s) => `${site()}/vergadering?i=${encodeURIComponent(id)}&l=${encodeURIComponent(lid)}&t=${vgLidToken(id, lid)}${s ? "&s=" + s : ""}`;
export const vgBestuur = v => /bestuur/i.test((v && v.soort) || "");
const S_OK = ["aanwezig", "verontschuldigd"];
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

async function bestuursleden(sb) {
  const { data, error } = await sb.from("leden").select("id,data").eq("data->>bestuur", "true"); if (error) throw error;
  return (data || []).filter(r => !r.data.geenLid).map(r => ({ id: r.id, voornaam: r.data.voornaam || "", naam: r.data.naam || "" }))
    .sort((a, b) => (a.voornaam + a.naam).localeCompare(b.voornaam + b.naam, "nl"));
}
async function vergadering(sb, id) {
  const { data } = await sb.from("vergaderingen").select("id,data").eq("id", String(id || "")).maybeSingle();
  return data;
}
const open = v => !v.afgerond && String(v.datum || "") >= vandaagISO();
async function zet(sb, vid, lid, s, via, door) {
  const val = S_OK.includes(s) ? { s, op: new Date().toISOString(), via, ...(door ? { door: String(door).slice(0, 80) } : {}) } : null;
  const { data, error } = await sb.rpc("vg_antwoord", { vid, lid, val }); if (error) throw error;
  return data || {};
}

/* ---------- openbaar ---------- */
export default async function vergaderingPubliek(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const sb = admin(), b = req.method === "POST" ? body(req) : (req.query || {});
    const id = String(b.i || ""), t = String(b.t || ""), eigen = String(b.l || "");
    if (eigen ? !kloptLid(id, eigen, t) : !klopt(id, t)) throw httpErr(404, "Deze link is niet (meer) geldig.");
    const row = await vergadering(sb, id); if (!row) throw httpErr(404, "Deze vergadering bestaat niet meer.");
    const v = row.data || {}; if (!vgBestuur(v)) throw httpErr(404, "Deze link is niet (meer) geldig.");
    const L = await bestuursleden(sb);
    const zicht = eigen ? L.filter(l => l.id === eigen) : L;
    const uit = ant => ({ ok: true, eigen: !!eigen, titel: v.titel || v.soort || "Bestuursvergadering", soort: v.soort || "", datum: v.datum, uur: v.uur || "", locatie: v.locatie || "", open: open(v),
      leden: zicht.map(l => ({ id: l.id, naam: (l.voornaam + " " + l.naam).trim() })), antwoorden: Object.fromEntries(Object.entries(ant || {}).map(([k, x]) => [k, x && x.s])) });
    if (req.method === "GET") return res.status(200).json(uit(v.antwoorden));
    if (req.method !== "POST") throw httpErr(405, "Niet toegelaten");
    await rateLimit(sb, req, "vergadering", 40, 600, httpErr);
    if (!open(v)) throw httpErr(409, "Deze vergadering is voorbij; doorgeven kan niet meer.");
    const lid = String(b.lid || ""); if (!zicht.some(l => l.id === lid)) throw httpErr(400, eigen ? "Deze link is enkel voor je eigen antwoord." : "Kies je naam in de lijst.");
    const s = String(b.s || ""); if (s && !S_OK.includes(s)) throw httpErr(400, "Kies aanwezig of verontschuldigd.");
    return res.status(200).json(uit(await zet(sb, id, lid, s, "link")));
  } catch (e) { sendError(res, e); }
}

/* ---------- app ---------- */
export async function vergaderingApp(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") throw httpErr(405, "Gebruik POST");
  const { user, rol, rechten, sb } = await requireUser(req, {}), b = body(req);
  const row = await vergadering(sb, b.id); if (!row) throw httpErr(404, "Vergadering niet gevonden.");
  if (!vgBestuur(row.data)) throw httpErr(400, "Enkel voor bestuursvergaderingen.");
  const alles = ["admin", "bewerker"].includes(rol) || !!(rechten && rechten.agenda === "bewerken");
  if (b.actie === "link") return res.status(200).json({ ok: true, link: vgLink(row.id) });
  if (b.actie !== "zet") throw httpErr(400, "Onbekende actie.");
  const L = await bestuursleden(sb), lid = String(b.lid || ""), l = L.find(x => x.id === lid);
  if (!l) throw httpErr(400, "Geen bestuurslid.");
  const { data: me } = await sb.from("bestuur").select("naam").eq("user_id", user.id).maybeSingle();
  if (!alles && norm(me && me.naam) !== norm(l.voornaam + " " + l.naam)) throw httpErr(403, "Je kan enkel je eigen aanwezigheid doorgeven.");
  const s = String(b.s || ""); if (s && !S_OK.includes(s)) throw httpErr(400, "Kies aanwezig of verontschuldigd.");
  return res.status(200).json({ ok: true, antwoorden: await zet(sb, row.id, lid, s, "app", me && me.naam) });
}
