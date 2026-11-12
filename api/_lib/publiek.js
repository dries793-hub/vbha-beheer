// Gedeelde hulpjes voor de openbare formulieren (geen login nodig).
import crypto from "node:crypto";
export const DEF_IBAN = "BE43 9730 6810 0401";
export const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
export const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
export const slug = s => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
export const body = req => typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
export const nieuwId = pre => pre + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
export const vandaag = () => { const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Brussels" })); return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear(); };

export async function algemeen(sb) {
  const { data } = await sb.from("config").select("data").eq("id", "algemeen").maybeSingle();
  const c = data?.data || {};
  return { jaar: Number(c.actiefJaar) || new Date().getFullYear(), vereniging: c.vereniging || "Vriendenkring Brandweer Hoofdpost Aalst", rekeningnummer: c.rekeningnummer || DEF_IBAN };
}
export async function configDoc(sb, id) {
  const { data } = await sb.from("config").select("data").eq("id", id).maybeSingle();
  return data?.data || {};
}
// eenvoudige spambescherming: verborgen veld, minimale invultijd, maximum per uur
export async function spamCheck(sb, tabel, b, httpErr) {
  if (b.website) return "stil";
  if (Number(b.duur) > 0 && Number(b.duur) < 2500) throw httpErr(400, "Dat ging wel erg snel. Probeer het opnieuw.");
  const uurGeleden = new Date(Date.now() - 3600 * 1000).toISOString();
  const { count } = await sb.from(tabel).select("id", { count: "exact", head: true }).eq("data->>bron", "formulier").gte("data->>aangemeld", uurGeleden);
  if ((count || 0) >= 40) throw httpErr(429, "Er zijn net veel inschrijvingen binnengekomen. Probeer het later opnieuw.");
  return null;
}

// Actieve leden van het jaar: lid in dat jaar (lid sinds ≤ jaar, lid tot leeg of ≥ jaar) én in orde met het lidgeld,
// met dezelfde regels als de app: ere-voorzitter, manueel OK/NOK in jaarleden, of een lidgeldbetaling in de transacties.
async function alleRijen(sb, tabel, jaar) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(tabel).select("id,data");
    if (jaar != null) q = q.eq("data->>jaar", String(jaar));
    const { data, error } = await q.range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}
// Transacties die als lidgeld voor dit jaar tellen: die van het boekjaar (tenzij doorgeschoven naar een ander jaar)
// plus betalingen uit een ander boekjaar met data.lidgeldJaar = jaar (bv. dubbel betaald en gebruikt voor het volgende jaar).
export async function lidgeldBoekingen(sb, jaar) {
  const [eigen, ander] = await Promise.all([alleRijen(sb, "boekingen", jaar), sb.from("boekingen").select("id,data").eq("data->>lidgeldJaar", String(jaar)).limit(1000)]);
  if (ander.error) throw ander.error;
  const L = eigen.filter(r => !(r.data && r.data.lidgeldJaar) || Number(r.data.lidgeldJaar) === Number(jaar));
  for (const r of ander.data || []) if (!L.some(x => x.id === r.id)) L.push(r);
  return L.filter(r => !r.data || r.data.richting !== "uit");
}
let LEDEN_CACHE = null;
export async function actieveLeden(sb, jaar) {
  if (LEDEN_CACHE && LEDEN_CACHE.jaar === jaar && Date.now() - LEDEN_CACHE.t < 60000) return LEDEN_CACHE.L;
  const [leden, jl, boek] = await Promise.all([alleRijen(sb, "leden"), alleRijen(sb, "jaarleden", jaar), lidgeldBoekingen(sb, jaar)]);
  const JL = new Map(jl.map(r => [r.id, r.data || {}]));
  const nm = x => norm(x).replace(/\s+/g, " ");
  const lidBoek = boek.map(r => r.data || {}).map(b => ({ lidId: b.lidId, m: nm(b.mededeling) })).filter(b => b.lidId || b.m.includes("lidgeld"));
  const L = [];
  for (const r of leden) {
    const l = r.data || {};
    if (!l.naam || l.dubbelVan) continue;
    if (l.lidSinds && Number(l.lidSinds) > jaar) continue;
    if (l.lidTot && Number(l.lidTot) < jaar) continue;
    if (l.geenLid) continue; // manueel aangeduid als geen lid
    const j = JL.get(jaar + "_" + r.id) || {};
    let ok;
    if (nm(l.info).includes("ere-voorzitter")) ok = true;
    else if (j.lidgeld === "OK") ok = true;
    else if (j.lidgeld === "NOK") ok = false;
    else { const n1 = nm(l.naam), n2 = nm(l.voornaam), kp = x => String(x || "").replace(/[^a-z0-9]/g, ""), k1 = kp(n1), k2 = kp(n2); ok = lidBoek.some(b => b.lidId === r.id || (n1 && n2 && b.m.includes("lidgeld") && ((b.m.includes(n1) && b.m.includes(n2)) || (k1 && k2 && kp(b.m).includes(k1) && kp(b.m).includes(k2))))); }
    if (!ok) continue;
    L.push({ id: r.id, naam: `${l.naam} ${l.voornaam || ""}`.replace(/\s+/g, " ").trim(), voornaam: String(l.voornaam || "").trim(), an: String(l.naam || "").trim(), em: String(l.email || "").trim().toLowerCase() });
  }
  L.sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
  LEDEN_CACHE = { jaar, t: Date.now(), L };
  return L;
}
// E-mailadres gedeeltelijk verbergen (deze lijst is openbaar): "dries.u@telenet.be" -> "dr•••@telenet.be"
export function masker(e) { const m = /^([^@\s]+)@([^@\s]+\.[^@\s]+)$/.exec(String(e || "")); if (!m) return ""; return m[1].slice(0, Math.min(2, m[1].length - 1 || 1)) + "•••@" + m[2]; }
// Zoeken op (een deel van) naam en/of voornaam; geeft enkel id + naam terug, maximaal 8.
export function zoekLeden(L, q) {
  const ap = x => norm(x).replace(/[’‘`´']/g, "'");
  const t = ap(q).split(/\s+/).filter(Boolean);
  if (!t.length || norm(q).replace(/\s/g, "").length < 3) return []; // min. 3 letters: de ledenlijst mag niet af te lopen zijn
  return L.filter(l => { const n = ap(l.naam), c = n.replace(/[^a-z0-9 ]/g, ""); return t.every(x => n.split(/[\s'-]+/).some(w => w.startsWith(x)) || n.includes(x) || (x.replace(/[^a-z0-9]/g, "").length >= 3 && c.split(" ").some(w => w.startsWith(x.replace(/[^a-z0-9]/g, ""))))); }).slice(0, 8).map(l => ({ id: l.id, naam: l.naam, toon: l.voornaam && l.an ? `${l.voornaam} ${l.an}` : l.naam, mail: masker(l.em) }));
}

// Inschrijvingen open of gesloten: manueel (open:false) of na de laatste dag (tot en met "tot", Belgische tijd).
export const vandaagISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const datumTekst = iso => { const [y, m, d] = String(iso).split("-").map(Number); return d + " " + ["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"][m - 1] + (y ? " " + y : ""); };
export function inschrijving(c, defTot) {
  const tot = /^\d{4}-\d{2}-\d{2}$/.test(String(c.inschrijvenTot || "")) ? c.inschrijvenTot : defTot;
  const manueel = c.open === false;
  const open = !manueel && vandaagISO() <= tot;
  return { open, tot, totTekst: datumTekst(tot), gesloten: open ? null : manueel ? "manueel" : "verlopen" };
}

// Een lid kan zich per jaar maar één keer inschrijven (banket, kinderfeest).
export async function alIngeschreven(sb, tabel, jaar, lidId) {
  if (!lidId) return false;
  const { data, error } = await sb.from(tabel).select("id").eq("data->>lidId", String(lidId)).eq("data->>jaar", String(jaar)).limit(1);
  if (error) throw error;
  return !!(data && data.length);
}
export const AL_TEKST = (wat, jaar) => `Je bent al ingeschreven voor ${wat} ${jaar}. Een lid kan zich maar één keer inschrijven. Wil je iets wijzigen? Mail dan naar info@vbha.be.`;

// Beperkt het aantal aanvragen per IP-adres (bv. om de ledenlijst niet te kunnen "afschrapen"). Faalt open bij een databasefout.
export async function rateLimit(sb, req, soort, max, sec, httpErr) {
  const ip = String(req.headers["x-real-ip"] || req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  const k = soort + ":" + crypto.createHash("sha256").update(ip + "|" + (process.env.SUPABASE_URL || "")).digest("base64url").slice(0, 32);
  try { const { data, error } = await sb.rpc("rl_hit", { p_k: k, p_max: max, p_sec: sec }); if (!error && data === false) throw httpErr(429, "Te veel aanvragen. Wacht even en probeer het dan opnieuw."); }
  catch (e) { if (e.status === 429) throw e; console.error("ratelimit", e); }
}
