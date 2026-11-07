import { admin, isDbCron, httpErr, requireUser } from "./sb.js";
import { smtpConfigured, afzender, verstuur } from "./smtp.js";
import { vandaagISO, configDoc } from "./publiek.js";

// Herinneringsmail vóór een vergadering uit de agenda (collectie "vergaderingen").
// Instellingen in config "herinneringen" (app: Instellingen › Herinneringen): aan, ontvangers, dagen vooraf, uur, soorten.
// Een geplande taak in Supabase (pg_cron, functie herinnering_cron) roept elk uur aan; er wordt enkel verstuurd op het gekozen uur.
// Een vergadering die binnen de termijn valt en nog geen herinnering kreeg, krijgt er één (ook als een dag gemist werd).
const DEF = { aan: true, ontvangers: "bestuur@vbha.be", dagen: 5, uur: 8, soorten: [] };
const instellingen = async sb => ({ ...DEF, ...(await configDoc(sb, "herinneringen")) });
const uurNu = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", hour: "2-digit", hour12: false }).format(new Date()));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const plusDagen = (iso, n) => { const [y, m, d] = iso.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.toISOString().slice(0, 10); };
const lang = iso => { const [y, m, d] = iso.split("-").map(Number); const s = new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }); return s.charAt(0).toUpperCase() + s.slice(1); };
const dagenTot = (van, tot) => Math.round((Date.parse(tot + "T12:00:00Z") - Date.parse(van + "T12:00:00Z")) / 864e5);
const F = "font-family:Helvetica,Arial,sans-serif;";

function mail(v, n, url, cfg) {
  const titel = v.titel || v.soort || "Vergadering";
  const punten = String(v.agenda || "").split(/\r?\n/).map(x => x.replace(/^\s*[-•*\d.)]+\s*/, "").trim()).filter(Boolean);
  const wanneer = n === 0 ? "vandaag" : n === 1 ? "morgen" : "over " + n + " dagen";
  const html = `<!DOCTYPE html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f7f7f7">
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="#f7f7f7"><tr><td align="center" style="padding:25px 10px">
<table role="presentation" border="0" cellspacing="0" cellpadding="0" bgcolor="#ffffff" style="width:100%;max-width:640px;border-collapse:collapse">
<tr><td align="center" bgcolor="#f7f7f7" style="padding:20px"><img src="https://impro.usercontent.one/appid/oneComWsb/domain/vbha.be/media/vbha.be/onewebmedia/logo%20VBHA%201.png" alt="Vriendenkring Brandweer Hoofdpost Aalst" width="220" height="84" style="display:block;width:220px;height:84px;border:0"></td></tr>
<tr><td style="border-top:8px solid #b30000;padding:0"></td></tr>
<tr><td style="${F}font-size:15px;line-height:1.5;color:#222222;padding:28px 40px 24px">
<p style="margin:0 0 15px">Beste bestuursleden,</p>
<p style="margin:0 0 15px">Een herinnering: ${wanneer} is er een <b>${esc((v.soort || "vergadering").toLowerCase())}</b>.</p>
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:6px 0 18px;border-collapse:collapse"><tr><td bgcolor="#fff9f9" style="padding:18px 24px;border-left:5px solid #C1A057;${F}font-size:15px;color:#222222;line-height:1.5">
<h2 style="color:#b30000;font-size:18px;font-weight:bold;margin:0 0 10px">${esc(titel)}</h2>
<p style="margin:0 0 5px">&bull; <b>Datum:</b> ${esc(lang(v.datum))}</p>
${v.uur ? `<p style="margin:0 0 5px">&bull; <b>Uur:</b> ${esc(v.uur)}</p>` : ""}
${v.locatie ? `<p style="margin:0 0 5px">&bull; <b>Locatie:</b> ${esc(v.locatie)}</p>` : ""}
${punten.length ? `<p style="margin:12px 0 5px"><b>Agenda</b></p><ol style="margin:0;padding-left:22px">${punten.map(p => `<li style="margin:0 0 4px">${esc(p)}</li>`).join("")}</ol>` : ""}
</td></tr></table>
<p style="margin:0 0 15px">Kan je er niet bij zijn? Laat het dan even weten.</p>
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:4px 0 18px"><tr><td align="center"><table role="presentation" border="0" cellspacing="0" cellpadding="0"><tr><td bgcolor="#b30000" style="border-radius:4px;padding:12px 26px"><a href="${esc(url)}/#agenda" style="${F}font-size:16px;font-weight:bold;color:#ffffff;text-decoration:none">Agenda openen</a></td></tr></table></td></tr></table>
<p style="margin:0;color:#888888;font-size:12.5px">Deze herinnering wordt automatisch verstuurd vanuit VBHA Beheer, ${cfg.dagen} ${cfg.dagen === 1 ? "dag" : "dagen"} voor elke vergadering in de agenda.</p>
</td></tr><tr><td style="border-top:8px solid #b30000;padding:0"></td></tr></table></td></tr></table></body></html>`;
  return { aan: "", aanNaam: "Bestuur VBHA", onderwerp: `Herinnering: ${titel} op ${lang(v.datum).replace(/ \d{4}$/, "").replace(/^./, c => c.toLowerCase())}${v.uur ? " om " + v.uur : ""}`, html };
}

const ontvangers = cfg => String(cfg.ontvangers || "").split(/[,;\s]+/).map(x => x.trim()).filter(x => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(x));
const site = () => String(process.env.SITE_URL || "https://vbha-beheer.vercel.app").replace(/\/+$/, "");

export async function herinneringen(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!(await isDbCron(req))) throw httpErr(403, "Geen toegang");
  if (!smtpConfigured()) throw httpErr(501, "Versturen is niet ingesteld");
  const sb = admin(), cfg = await instellingen(sb), nu = vandaagISO();
  if (!cfg.aan) return res.status(200).json({ uit: true });
  if (uurNu() !== Number(cfg.uur)) return res.status(200).json({ wacht: true, uur: cfg.uur });
  const aan = ontvangers(cfg); if (!aan.length) return res.status(200).json({ geenOntvangers: true });
  const tot = plusDagen(nu, Number(cfg.dagen) || 5);
  const { data, error } = await sb.from("vergaderingen").select("id,data").gte("data->>datum", nu).lte("data->>datum", tot);
  if (error) throw error;
  const verstuurd = [];
  for (const r of data || []) {
    const v = r.data || {};
    if (!v.datum || v.herinnerdVoor === v.datum) continue; // al verstuurd voor deze datum (bij een nieuwe datum komt er een nieuwe herinnering)
    if (cfg.soorten && cfg.soorten.length && !cfg.soorten.includes(v.soort || "Andere")) continue;
    const m = mail(v, dagenTot(nu, v.datum), site(), cfg);
    const uit = await verstuur(aan.map(a => ({ ...m, aan: a, van: afzender() })));
    if (uit.some(x => x && x.ok)) {
      await sb.from("vergaderingen").update({ data: { ...v, herinnerdVoor: v.datum, herinnerdOp: new Date().toISOString() } }).eq("id", r.id);
      verstuurd.push(r.id);
    }
  }
  res.status(200).json({ vandaag: nu, verstuurd });
}

// Voorbeeld van de herinnering naar de aangemelde administrator (knop in Instellingen › Herinneringen)
export async function herinneringTest(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") throw httpErr(405, "Gebruik POST");
  const { user, sb } = await requireUser(req, { write: true });
  if (!smtpConfigured()) throw httpErr(501, "Versturen is niet ingesteld");
  const cfg = await instellingen(admin()), nu = vandaagISO();
  const { data } = await admin().from("vergaderingen").select("id,data").gte("data->>datum", nu).order("data->>datum", { ascending: true }).limit(1);
  const v = (data && data[0] && data[0].data) || { soort: "Bestuursvergadering", datum: plusDagen(nu, Number(cfg.dagen) || 5), uur: "19u30", locatie: "Kazerne Aalst", agenda: "Verslag vorige vergadering\nVaria" };
  const m = mail(v, dagenTot(nu, v.datum), site(), cfg);
  const [r] = await verstuur([{ ...m, aan: user.email, onderwerp: "[VOORBEELD] " + m.onderwerp, van: afzender() }]);
  if (!r || !r.ok) throw httpErr(502, "Versturen lukte niet" + (r && r.fout ? ": " + r.fout : ""));
  res.status(200).json({ ok: true, aan: user.email });
}
