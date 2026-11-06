// Gedeelde hulpjes voor de openbare formulieren (geen login nodig).
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

// Leden van het actieve jaar (lid sinds ≤ jaar, lid tot leeg of ≥ jaar), voor de naamkeuze op de inschrijfpagina's.
let LEDEN_CACHE = null;
export async function actieveLeden(sb, jaar) {
  if (LEDEN_CACHE && LEDEN_CACHE.jaar === jaar && Date.now() - LEDEN_CACHE.t < 60000) return LEDEN_CACHE.L;
  const L = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("leden").select("id,data").range(from, from + 999);
    if (error) throw error;
    for (const r of data) {
      const l = r.data || {};
      if (!l.naam || l.dubbelVan) continue;
      if (l.lidSinds && Number(l.lidSinds) > jaar) continue;
      if (l.lidTot && Number(l.lidTot) < jaar) continue;
      L.push({ id: r.id, naam: `${l.naam} ${l.voornaam || ""}`.replace(/\s+/g, " ").trim() });
    }
    if (data.length < 1000) break;
  }
  L.sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
  LEDEN_CACHE = { jaar, t: Date.now(), L };
  return L;
}
// Zoeken op (een deel van) naam en/of voornaam; geeft enkel id + naam terug, maximaal 8.
export function zoekLeden(L, q) {
  const t = norm(q).split(/\s+/).filter(Boolean);
  if (!t.length || norm(q).replace(/\s/g, "").length < 2) return [];
  return L.filter(l => { const n = norm(l.naam); return t.every(x => n.split(/[\s'-]+/).some(w => w.startsWith(x)) || n.includes(x)); }).slice(0, 8);
}
