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
