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

/* App (admin): leden die de goudstatus behaalden een proficiat-mail sturen of overslaan.
   POST /api/mail?f=goud {actie:"mail"|"overslaan", lidIds:[...]} */
export async function goudApp(req, res) {
  const { requireUser, admin, httpErr, sendError } = await import("./sb.js");
  try {
    if (req.method !== "POST") throw httpErr(405, "Gebruik POST");
    const { rol } = await requireUser(req, { write: true });
    if (rol !== "admin") throw httpErr(403, "Enkel voor de administrator.");
    let b = req.body || {}; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
    const sb = admin(), ids = (Array.isArray(b.lidIds) ? b.lidIds : []).map(String).slice(0, 100);
    if (!ids.length) throw httpErr(400, "Geen leden gekozen.");
    const { data: alg } = await sb.from("config").select("data").eq("id", "algemeen").maybeSingle();
    const Y = Number(b.jaar) || Number(alg && alg.data && alg.data.actiefJaar) || huidigJaar();
    const A = await algemeen(sb).catch(() => ({}));
    const { data: leden } = await sb.from("leden").select("id,data").in("id", ids);
    const nu = new Date().toISOString(), mails = [], uit = [];
    for (const l of leden || []) {
      const jid = Y + "_" + l.id; const { data: jr } = await sb.from("jaarleden").select("id,data").eq("id", jid).maybeSingle();
      const jd = (jr && jr.data) || { jaar: Y, lidId: l.id };
      const mail = b.actie === "mail" && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(String(l.data.email || "").trim());
      if (mail) mails.push({ batch: "goud-" + Y, data: { aan: String(l.data.email).trim(), aanNaam: `${l.data.voornaam || ""} ${l.data.naam || ""}`.trim(), onderwerp: `Proficiat: je behaalde de goudstatus voor ${Y + 1}!`, html: goudHtml(l.data.voornaam, Y, A), label: "Goudstatus" } });
      const gm = { op: nu, via: "app", verstuurd: mail, ...(b.actie !== "mail" ? { reden: "overgeslagen" } : !mail ? { reden: "geen e-mailadres" } : {}) };
      const { error } = await sb.from("jaarleden").upsert({ id: jid, data: { ...jd, goudMail: gm } }); if (error) throw error;
      uit.push({ lidId: l.id, verstuurd: mail });
    }
    if (mails.length) { const { error } = await sb.from("mail_wachtrij").insert(mails); if (error) throw error; }
    return res.status(200).json({ ok: true, resultaten: uit, mails: mails.length });
  } catch (e) { return sendError(res, e); }
}

/* Automatische mails bij nieuwe punten en/of bij een wijziging van status (aan te zetten in config algemeen: puntenMail.aan, statusMail.aan).
   Per lid wordt in de afgeschermde tabel punten_mailstand bijgehouden wat het laatst gemeld werd. Pas als er 30 minuten niets meer aan het lid veranderde,
   gaat er één mail (zo krijgt wie meerdere dozen na elkaar ingevuld krijgt maar één bericht). De eerste keer worden enkel de standen bewaard. */
const ONDERDELEN = [["kaarten", "kaarten", "verkoop kaarten fuif"], ["kalUitgevoerd", "kalenders", "kalenders bussen"], ["shifts", "shifts", "hulp bij activiteiten"], ["vergaderingen", "vergaderingen", "vergaderingen"]];
const STATUS = { brons: "Brons", zilver: "Zilver", goud: "Goud" };
const statusVan = (pt, dr) => pt >= dr.goud ? "goud" : pt >= dr.zilver ? "zilver" : "brons";
const stand = j => ({ kaarten: j.kaarten || 0, kalUitgevoerd: j.kalUitgevoerd || 0, shifts: j.shifts || 0, vergaderingen: j.vergaderingen || 0, extraPunten: j.extraPunten || 0 });
export function puntenHtml(voornaam, Y, { regels, totaal, status, statusNieuw, statusVorig }, A) {
  const st = `<b>${STATUS[status]}</b>`;
  return huisstijl(
    p(`Beste ${esc(voornaam || "lid")},`)
    + (regels.length ? p("Zonet werden er nieuwe punten voor je toegevoegd:") + kaderBlok("Nieuwe punten", regels.map(r => p(`<b>+${r.pt} pt</b> voor ${esc(r.naam)}${r.n ? ` (${r.n})` : ""}`, "margin:0 0 6px")).join("")) : "")
    + p(`Jouw totaal voor ${Y} bedraagt nu <b>${totaal} punten</b>. ${statusNieuw ? `Daarmee ga je van ${STATUS[statusVorig]} naar ${st} voor ${Y + 1}.` : `Daarmee is je status voor ${Y + 1} ${st}.`}`)
    + p("Bedankt voor je inzet voor de Vriendenkring!")
    + knop("Reglement puntensysteem", site() + "/reglement"),
    A.vereniging || "Vriendenkring Brandweer Hoofdpost Aalst");
}
export async function puntenCron(sb) {
  const { data: alg } = await sb.from("config").select("data").eq("id", "algemeen").maybeSingle();
  const C = (alg && alg.data) || {}, PM = C.puntenMail || {}, SM = C.statusMail || {}, GM = C.goudMail || {};
  if (PM.aan !== true && SM.aan !== true) return { uit: true };
  const Y = Number(C.actiefJaar) || huidigJaar(), cfg = await jaarCfg(sb, Y), w = cfg.gewichten, dr = cfg.drempels;
  const { data: jl } = await sb.from("jaarleden").select("id,data,updated_at").like("id", Y + "\\_%").limit(3000);
  const { data: ms } = await sb.from("punten_mailstand").select("id,stand").like("id", Y + "\\_%").limit(3000);
  const MS = new Map((ms || []).map(r => [r.id, r.stand]));
  const sleutel = `${PM.aan === true ? "p" : ""}${SM.aan === true ? "s" : ""}-${Y}`, eersteKeer = C.puntenStart !== sleutel;
  const rust = Date.now() - 30 * 60000, verschil = [];
  for (const r of jl || []) {
    const j = r.data || {}, nu = stand(j), pt = punten(j, w), st = statusVan(pt, dr), m = MS.get(r.id);
    if (!m || eersteKeer) { verschil.push({ r, nu, pt, st, init: true }); continue; }
    const meer = Object.keys(nu).some(k => nu[k] > (m[k] || 0)), ander = st !== m.status;
    if (!meer && !ander) continue;
    if (new Date(r.updated_at || 0).getTime() > rust) continue; // nog even wachten tot het invullen klaar is
    verschil.push({ r, nu, pt, st, m, meer, ander });
  }
  if (!verschil.length) { if (eersteKeer) await sb.from("config").update({ data: { ...C, puntenStart: sleutel } }).eq("id", "algemeen"); return { nieuw: 0 }; }
  const ids = [...new Set(verschil.filter(x => !x.init).map(x => x.r.data.lidId || x.r.id.slice(String(Y).length + 1)))];
  const { data: leden } = ids.length ? await sb.from("leden").select("id,data").in("id", ids) : { data: [] };
  const L = new Map((leden || []).map(r => [r.id, r.data])), A = await algemeen(sb).catch(() => ({}));
  const mails = [], standen = [];
  for (const x of verschil) {
    const nieuwStand = { ...x.nu, status: x.st, op: new Date().toISOString() };
    if (!x.init) {
      const lidId = x.r.data.lidId || x.r.id.slice(String(Y).length + 1), lid = L.get(lidId) || {}, j = x.r.data;
      const ok = lid.naam && !lid.geenLid && lid.categorie !== "Erewacht" && !j.vrijstelling && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(String(lid.email || "").trim());
      const regels = [];
      for (const [k, wk, naam] of ONDERDELEN) { const d = x.nu[k] - (x.m[k] || 0); if (d > 0) regels.push({ naam, pt: d * (w[wk] || 0), n: k === "kalUitgevoerd" ? `${d} ${d === 1 ? "doos" : "dozen"}` : k === "kaarten" ? `${d} ${d === 1 ? "kaart" : "kaarten"}` : k === "shifts" ? `${d} ${d === 1 ? "shift" : "shiften"}` : `${d}` }); }
      const de = x.nu.extraPunten - (x.m.extraPunten || 0); if (de > 0) regels.push({ naam: j.extraTekst ? "extra: " + j.extraTekst : "extra punten", pt: de, n: "" });
      const goudVia = x.ander && x.st === "goud" && GM.aan !== false; // de proficiat-mail voor goud gaat apart
      const stuurPunten = PM.aan === true && regels.length, stuurStatus = SM.aan === true && x.ander && !goudVia && statusRang(x.st) > statusRang(x.m.status);
      if (ok && (stuurPunten || stuurStatus)) {
        const statusNieuw = SM.aan === true && x.ander && statusRang(x.st) > statusRang(x.m.status);
        mails.push({ batch: "punten-" + Y, data: { aan: String(lid.email).trim(), aanNaam: `${lid.voornaam || ""} ${lid.naam || ""}`.trim(),
          onderwerp: statusNieuw && !goudVia ? `Je status voor ${Y + 1}: ${STATUS[x.st]}` : `Nieuwe punten: je totaal is nu ${x.pt} pt`,
          html: puntenHtml(lid.voornaam, Y, { regels: PM.aan === true ? regels : [], totaal: x.pt, status: x.st, statusNieuw: statusNieuw && !goudVia, statusVorig: x.m.status }, A), label: "Punten " + `${lid.voornaam || ""} ${lid.naam || ""}`.trim() } });
      }
    }
    standen.push({ id: x.r.id, stand: nieuwStand, op: nieuwStand.op });
  }
  if (mails.length) { const { error } = await sb.from("mail_wachtrij").insert(mails); if (error) throw error; }
  if (standen.length) { const { error } = await sb.from("punten_mailstand").upsert(standen); if (error) throw error; }
  if (eersteKeer) await sb.from("config").update({ data: { ...C, puntenStart: sleutel } }).eq("id", "algemeen");
  return { bekeken: verschil.length, mails: mails.length, eersteKeer };
}
const statusRang = s => ({ brons: 1, zilver: 2, goud: 3 })[s] || 0;
