import { admin, sendError, httpErr } from "./_lib/sb.js";

// Openbaar inschrijfformulier voor het kinderfeest (geen login nodig).
// GET  -> gegevens voor de pagina (datum, uur, locatie, leeftijdsgrens)
// POST -> bewaart de inschrijving in de tabel "kinderfeest", gemarkeerd als "nieuw"

const MAX_KIDS = 10;
const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const slug = s => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
const clean = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

function leeftijd(geb, op) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(geb || "")) return null;
  const [y, m, d] = geb.split("-").map(Number), [Y, M, D] = op.split("-").map(Number);
  let a = Y - y; if (M < m || (M === m && D < d)) a--; return a;
}

async function info(sb) {
  const { data: cfgRow } = await sb.from("config").select("data").eq("id", "algemeen").maybeSingle();
  const c = cfgRow?.data || {};
  const jaar = Number(c.actiefJaar) || new Date().getFullYear();
  const { data: kRow } = await sb.from("config").select("data").eq("id", "kf_" + jaar).maybeSingle();
  const k = kRow?.data || {};
  return {
    vereniging: c.vereniging || "Vriendenkring Brandweer Hoofdpost Aalst", jaar,
    datum: k.datum || jaar + "-12-19", tijd: k.tijd || "14u30", locatie: k.locatie || "VTI - Sinte Annalaan 99b, Aalst",
    leeftijd: Number(k.leeftijd) || 12, open: k.open !== false,
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const sb = admin();
    if (req.method === "GET") return res.status(200).json(await info(sb));
    if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");

    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    // eenvoudige spambescherming: verborgen veld en minimale invultijd
    if (b.website) return res.status(200).json({ ok: true });
    if (Number(b.duur) > 0 && Number(b.duur) < 2500) throw httpErr(400, "Dat ging wel erg snel. Probeer het opnieuw.");

    const I = await info(sb);
    if (!I.open) throw httpErr(400, "De inschrijvingen voor het kinderfeest zijn afgesloten.");
    const lid = clean(b.lid, 120), email = clean(b.email, 120).toLowerCase();
    if (!lid) throw httpErr(400, "Vul de naam van het lid in.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw httpErr(400, "Dit e-mailadres lijkt niet te kloppen.");
    const kids = (Array.isArray(b.kinderen) ? b.kinderen : []).slice(0, MAX_KIDS)
      .map(k => ({ naam: clean(k && k.naam, 80), geb: clean(k && k.geb, 10) }))
      .filter(k => k.naam || k.geb);
    if (!kids.length) throw httpErr(400, "Vul minstens één kind in.");
    for (const k of kids) {
      if (!k.naam) throw httpErr(400, "Elk kind heeft een naam nodig.");
      const a = leeftijd(k.geb, I.datum);
      if (a == null || a < 0 || a > 25) throw httpErr(400, "Controleer de geboortedatum van " + k.naam + ".");
    }

    // niet meer dan 30 inschrijvingen per uur (bescherming tegen misbruik)
    const uurGeleden = new Date(Date.now() - 3600 * 1000).toISOString();
    const { count } = await sb.from("kinderfeest").select("id", { count: "exact", head: true }).eq("data->>bron", "formulier").gte("data->>aangemeld", uurGeleden);
    if ((count || 0) >= 30) throw httpErr(429, "Er zijn net veel inschrijvingen binnengekomen. Probeer het later opnieuw.");

    // lid opzoeken in de ledenlijst (naam + voornaam, in eender welke volgorde)
    let lidId = null;
    try {
      const n = norm(lid);
      const { data: leden } = await sb.from("leden").select("id,data").limit(2000);
      const hit = (leden || []).find(r => { const d = r.data || {}; return n === norm((d.voornaam || "") + " " + (d.naam || "")) || n === norm((d.naam || "") + " " + (d.voornaam || "")) });
      if (hit) lidId = hit.id;
    } catch (e) { console.error("lid zoeken", e); }

    const id = "web-" + I.jaar + "-" + slug(lid).slice(0, 40) + "-" + Date.now().toString(36);
    const doc = { jaar: I.jaar, lid, lidId, email, opmerking: clean(b.opmerking, 300), kinderen: kids, bron: "formulier", nieuw: true, aangemeld: new Date().toISOString() };
    const { error } = await sb.from("kinderfeest").insert({ id, data: doc });
    if (error) throw error;
    res.status(200).json({ ok: true, jaar: I.jaar, datum: I.datum, tijd: I.tijd, locatie: I.locatie, kinderen: kids.map(k => ({ naam: k.naam, leeftijd: leeftijd(k.geb, I.datum) })) });
  } catch (e) { sendError(res, e); }
}
