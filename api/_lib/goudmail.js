import { jaarCfg } from "./status.js";
import { huisstijl, kaderBlok, knop, p, esc, site } from "./bevestiging.js";
import { algemeen } from "./publiek.js";

/* Automatische proficiat-mail: zodra een lid met de punten van dit werkjaar de goudstatus voor volgend jaar haalt.
   - Niet voor de erewacht (die is altijd goud) en niet voor wie enkel door een vrijstelling goud is.
   - Eén keer per lid per jaar (jaarleden.goudMail = {op}).
   - Uit te schakelen in config algemeen: goudMail.aan = false.
   - Bij de eerste start worden de leden die al goud waren enkel aangeduid (geen mail); zij krijgen de tussenstand-mail. */
const huidigJaar = () => Number(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric" }).format(new Date()));
const punten = (j, w) => (j.kaarten || 0) * w.kaarten + (j.kalUitgevoerd || 0) * w.kalenders + (j.shifts || 0) * w.shifts + (j.vergaderingen || 0) * w.vergaderingen + (j.extraPunten || 0);

export function goudHtml(voornaam, jaar, A) {
  const volgend = jaar + 1;
  return huisstijl(
    p(`Beste ${esc(voornaam || "lid")},`)
    + p(`<b>Proficiat!</b> Met je inzet dit jaar heb je de <b>goudstatus voor ${volgend}</b> behaald.`)
    + kaderBlok("Wat betekent dat?", p(`Als goudlid geniet je in ${volgend} van de <b>maximale korting</b> op onze betalende activiteiten, zoals het banket.`, "margin:0"))
    + p("Hartelijk dank voor je bijdrage aan de Vriendenkring. Dankzij leden zoals jij kunnen we elk jaar mooie activiteiten organiseren.")
    + knop("Reglement puntensysteem", site() + "/reglement"),
    A.vereniging || "Vriendenkring Brandweer Hoofdpost Aalst");
}

export async function goudCron(sb) {
  const { data: alg } = await sb.from("config").select("data").eq("id", "algemeen").maybeSingle();
  const G = (alg && alg.data && alg.data.goudMail) || {};
  if (G.aan === false) return { uit: true };
  const Y = Number(alg && alg.data && alg.data.actiefJaar) || huidigJaar();
  const cfg = await jaarCfg(sb, Y), w = cfg.gewichten, grens = cfg.drempels.goud;
  const { data: jl } = await sb.from("jaarleden").select("id,data").like("id", Y + "\\_%").limit(2000);
  const kandidaten = (jl || []).filter(r => !r.data.goudMail && punten(r.data, w) >= grens);
  if (!kandidaten.length) return { nieuw: 0 };
  const ids = kandidaten.map(r => r.data.lidId || r.id.slice(String(Y).length + 1));
  const { data: leden } = await sb.from("leden").select("id,data").in("id", ids);
  const L = new Map((leden || []).map(r => [r.id, r.data]));
  const eersteKeer = G.gestart !== Y; // eerste start in dit jaar: bestaande goudleden enkel aanduiden
  const A = await algemeen(sb).catch(() => ({}));
  const nu = new Date().toISOString(), mails = [], zet = [];
  for (const r of kandidaten) {
    const lidId = r.data.lidId || r.id.slice(String(Y).length + 1), lid = L.get(lidId);
    if (!lid) continue;
    const ere = lid.categorie === "Erewacht";
    const mail = !eersteKeer && !ere && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(String(lid.email || "").trim());
    zet.push({ id: r.id, data: { ...r.data, goudMail: { op: nu, verstuurd: mail, ...(ere ? { reden: "erewacht" } : eersteKeer ? { reden: "al goud bij de start" } : !mail ? { reden: "geen e-mailadres" } : {}) } } });
    if (mail) mails.push({ batch: "goud-" + Y, data: { aan: String(lid.email).trim(), aanNaam: `${lid.voornaam || ""} ${lid.naam || ""}`.trim(), onderwerp: `Proficiat: je behaalde de goudstatus voor ${Y + 1}!`, html: goudHtml(lid.voornaam, Y, A), label: "Goudstatus" } });
  }
  if (mails.length) { const { error } = await sb.from("mail_wachtrij").insert(mails); if (error) throw error; }
  for (const z of zet) await sb.from("jaarleden").update({ data: z.data }).eq("id", z.id);
  if (eersteKeer) await sb.from("config").update({ data: { ...alg.data, goudMail: { ...G, aan: G.aan !== false, gestart: Y } } }).eq("id", "algemeen");
  return { nieuw: zet.length, mails: mails.length, eersteKeer };
}
