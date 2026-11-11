import { admin, isDbCron, httpErr, requireUser } from "./sb.js";
import { smtpConfigured, afzender, verstuur } from "./smtp.js";
import { vandaagISO, configDoc } from "./publiek.js";
import { pushVanDaag } from "./push.js";
import { huisstijl } from "./bevestiging.js";
import { vgLink, vgBestuur } from "./open_vergadering.js";

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

export function mail(v, n, url, cfg) {
  const titel = v.titel || v.soort || "Vergadering";
  const punten = String(v.agenda || "").split(/\r?\n/).map(x => x.replace(/^\s*[-•*\d.)]+\s*/, "").trim()).filter(Boolean);
  const wanneer = n === 0 ? "vandaag" : n === 1 ? "morgen" : "over " + n + " dagen";
  const html = huisstijl(`<p style="margin:0 0 15px">Beste bestuursleden,</p>
<p style="margin:0 0 15px">Een herinnering: ${wanneer} is er een <b>${esc((v.soort || "vergadering").toLowerCase())}</b>.</p>
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:6px 0 18px;border-collapse:collapse"><tr><td bgcolor="#fff9f9" style="padding:18px 24px;border-left:5px solid #C1A057;${F}font-size:15px;color:#222222;line-height:1.5">
<h2 style="color:#b30000;font-size:18px;font-weight:bold;margin:0 0 10px">${esc(titel)}</h2>
<p style="margin:0 0 5px">&bull; <b>Datum:</b> ${esc(lang(v.datum))}</p>
${v.uur ? `<p style="margin:0 0 5px">&bull; <b>Uur:</b> ${esc(v.uur)}</p>` : ""}
${v.locatie ? `<p style="margin:0 0 5px">&bull; <b>Locatie:</b> ${esc(v.locatie)}</p>` : ""}
${punten.length ? `<p style="margin:12px 0 5px"><b>Agenda</b></p><ol style="margin:0;padding-left:22px">${punten.map(p => `<li style="margin:0 0 4px">${esc(p)}</li>`).join("")}</ol>` : ""}
</td></tr></table>
${v.id && vgBestuur(v) ? `<p style="margin:0 0 12px">Ben je erbij? Duid hieronder aan of je <b>aanwezig</b> of <b>verontschuldigd</b> bent.</p>
<table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 18px"><tr><td bgcolor="#C0161F" style="border-radius:8px"><a href="${esc(vgLink(v.id))}" style="display:inline-block;padding:12px 22px;${F}font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px">Aanwezig of verontschuldigd</a></td></tr></table>` : `<p style="margin:0 0 15px">Kan je er niet bij zijn? Laat het dan even weten.</p>`}
<p style="margin:0;color:#888888;font-size:12.5px">Deze herinnering wordt automatisch verstuurd vanuit VBHA Beheer, ${cfg.dagen} ${cfg.dagen === 1 ? "dag" : "dagen"} voor elke vergadering in de agenda.</p>
`, "Vriendenkring Brandweer Hoofdpost Aalst", { groet: false });
  return { aan: "", aanNaam: "Bestuur VBHA", onderwerp: `Herinnering: ${titel} op ${lang(v.datum).replace(/ \d{4}$/, "").replace(/^./, c => c.toLowerCase())}${v.uur ? " om " + v.uur : ""}`, html };
}

const ontvangers = cfg => String(cfg.ontvangers || "").split(/[,;\s]+/).map(x => x.trim()).filter(x => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(x));
// + de e-mailadressen van alle gebruikers van de app (tabel bestuur), zonder dubbels
async function alleOntvangers(sb, cfg) {
  const L = [...ontvangers(cfg)];
  const { data } = await sb.from("bestuur").select("email");
  for (const r of data || []) { const e = String((r && r.email) || "").trim(); if (/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(e)) L.push(e); }
  const gezien = new Set(); return L.filter(e => { const k = e.toLowerCase(); if (gezien.has(k)) return false; gezien.add(k); return true; });
}
const site = () => String(process.env.SITE_URL || "https://vbha-beheer.vercel.app").replace(/\/+$/, "");

export async function herinneringen(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!(await isDbCron(req))) throw httpErr(403, "Geen toegang");
  const sb = admin(), cfg = await instellingen(sb), nu = vandaagISO();
  // pushmeldingen op de dag zelf (eigen aan/uit en eigen uur)
  let push = null;
  try { push = await pushVanDaag(sb, cfg, nu, uurNu()); } catch (e) { console.error("push", e); push = { fout: e.message }; }
  if (!smtpConfigured()) return res.status(200).json({ push, mail: "niet ingesteld" });
  if (!cfg.aan) return res.status(200).json({ uit: true, push });
  if (uurNu() !== Number(cfg.uur)) return res.status(200).json({ wacht: true, uur: cfg.uur, push });
  const aan = await alleOntvangers(sb, cfg); if (!aan.length) return res.status(200).json({ geenOntvangers: true });
  const tot = plusDagen(nu, Number(cfg.dagen) || 5);
  const { data, error } = await sb.from("vergaderingen").select("id,data").gte("data->>datum", nu).lte("data->>datum", tot);
  if (error) throw error;
  const verstuurd = [];
  for (const r of data || []) {
    const v = r.data || {};
    if (!v.datum || v.herinnerdVoor === v.datum) continue; // al verstuurd voor deze datum (bij een nieuwe datum komt er een nieuwe herinnering)
    if (cfg.soorten && cfg.soorten.length && !cfg.soorten.includes(v.soort || "Andere")) continue;
    const m = mail({ ...v, id: r.id }, dagenTot(nu, v.datum), site(), cfg);
    const uit = await verstuur(aan.map((a, i) => ({ ...m, aan: a, van: afzender(), ...(i ? { geenBcc: true } : {}) })));
    if (uit.some(x => x && x.ok)) {
      await sb.from("vergaderingen").update({ data: { ...v, herinnerdVoor: v.datum, herinnerdOp: new Date().toISOString() } }).eq("id", r.id);
      verstuurd.push(r.id);
    }
  }
  res.status(200).json({ vandaag: nu, verstuurd, push });
}

// Voorbeeld van de herinnering naar de aangemelde administrator (knop in Instellingen › Herinneringen)
export async function herinneringTest(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") throw httpErr(405, "Gebruik POST");
  const { user, sb } = await requireUser(req, { write: true, functie: "agenda" });
  if (!smtpConfigured()) throw httpErr(501, "Versturen is niet ingesteld");
  const cfg = await instellingen(admin()), nu = vandaagISO();
  const { data } = await admin().from("vergaderingen").select("id,data").gte("data->>datum", nu).order("data->>datum", { ascending: true }).limit(1);
  const v = (data && data[0] && { ...data[0].data, id: data[0].id }) || { soort: "Bestuursvergadering", datum: plusDagen(nu, Number(cfg.dagen) || 5), uur: "19u30", locatie: "Kazerne Aalst", agenda: "Verslag vorige vergadering\nVaria" };
  const m = mail(v, dagenTot(nu, v.datum), site(), cfg);
  const [r] = await verstuur([{ ...m, aan: user.email, onderwerp: "[VOORBEELD] " + m.onderwerp, van: afzender() }]);
  if (!r || !r.ok) throw httpErr(502, "Versturen lukte niet" + (r && r.fout ? ": " + r.fout : ""));
  res.status(200).json({ ok: true, aan: user.email });
}

/* ---------- vergadering afgerond: verslag (PDF) + datum van de volgende vergadering naar het bestuur ----------
   POST /api/mail?f=vergadering-afgerond {id}  (aangemeld, administrator)
   De app laadt het verslag op in Documenten (bucket "documenten"), maakt de volgende vergadering aan en zet
   data.afgerond = {op, door, volgendeId, verslagDoc} op de afgeronde vergadering. */
export async function afgerondMail(v, nv, bijlagenLen) {
  const bijlagen = { length: bijlagenLen ? 1 : 0 };
  const { huisstijl, kaderBlok, tabel, rij, p } = await import("./bevestiging.js");
  const soort = (v.soort || "vergadering").toLowerCase(), titel = v.titel || v.soort || "Vergadering";
  const punten = nv ? String(nv.agenda || "").split(/\r?\n/).map(x => x.replace(/^\s*[-•*\d.)]+\s*/, "").trim()).filter(Boolean) : [];
  let html = p("Beste bestuursleden,") + p(`De ${esc(soort)} van ${esc(lang(v.datum).replace(/^./, c => c.toLowerCase()))} is afgerond. ${bijlagen.length ? "In bijlage vind je het <b>verslag</b>." : ""}`);
  if (v.aanwezig || v.verontschuldigd) html += kaderBlok("Aanwezigheid", tabel([rij("Aanwezig", esc(v.aanwezig || "-")), rij("Verontschuldigd", esc(v.verontschuldigd || "-"))]));
  if (nv) html += kaderBlok("Volgende " + esc((nv.soort || "vergadering").toLowerCase()), tabel([
    rij("Datum", `<b>${esc(lang(nv.datum))}</b>`), nv.uur ? rij("Uur", esc(nv.uur)) : "", nv.locatie ? rij("Locatie", esc(nv.locatie)) : "", nv.titel ? rij("Onderwerp", esc(nv.titel)) : ""])
    + (punten.length ? `<p style="margin:12px 0 5px"><b>Agenda</b></p><ol style="margin:0;padding-left:22px">${punten.map(x => `<li style="margin:0 0 4px">${esc(x)}</li>`).join("")}</ol>` : ""));
  if (nv && nv.id && vgBestuur(nv)) html += p("Zet de datum alvast in je agenda en laat weten of je erbij bent:") + `<table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 18px"><tr><td bgcolor="#C0161F" style="border-radius:8px"><a href="${esc(vgLink(nv.id))}" style="display:inline-block;padding:12px 22px;${F}font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px">Aanwezig of verontschuldigd</a></td></tr></table>`;
  else html += p(nv ? "Zet de datum alvast in je agenda. Kan je er niet bij zijn? Laat het dan even weten." : "Opmerkingen bij het verslag? Antwoord gewoon op deze mail.");
  const onderwerp = `Verslag ${titel.toLowerCase() === soort ? soort : titel} ${lang(v.datum).replace(/^\S+ /, "")}${nv ? " - volgende vergadering " + lang(nv.datum).replace(/ \d{4}$/, "").replace(/^./, c => c.toLowerCase()) : ""}`;
  return { onderwerp, html, huisstijl };
}
export async function vergaderingAfgerond(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") throw httpErr(405, "Gebruik POST");
  const { sb } = await requireUser(req, { write: true });
  if (!smtpConfigured()) throw httpErr(501, "Versturen is niet ingesteld (SMTP in Vercel).");
  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const { data: r } = await sb.from("vergaderingen").select("id,data").eq("id", String(b.id || "")).maybeSingle();
  if (!r) throw httpErr(404, "Vergadering niet gevonden");
  const v = r.data || {}, af = v.afgerond || {};
  const { data: vr } = af.volgendeId ? await sb.from("vergaderingen").select("data").eq("id", af.volgendeId).maybeSingle() : { data: null };
  const nv = vr && vr.data && { ...vr.data, id: af.volgendeId };
  const bijlagen = [];
  if (af.verslagDoc) {
    const { data: doc } = await sb.from("documenten").select("data").eq("id", af.verslagDoc).maybeSingle();
    if (doc && doc.data && doc.data.pad) {
      const { data: blob, error } = await sb.storage.from("documenten").download(doc.data.pad);
      if (error) throw httpErr(500, "Het verslag kon niet gelezen worden: " + error.message);
      bijlagen.push({ naam: doc.data.naam || "Verslag.pdf", type: doc.data.type || "application/pdf", data: Buffer.from(await blob.arrayBuffer()) });
    }
  }
  const cfg = await instellingen(sb), aan = await alleOntvangers(sb, cfg);
  if (!aan.length) throw httpErr(400, "Er zijn geen ontvangers ingesteld (Instellingen › Herinneringen).");
  const { onderwerp, html, huisstijl } = await afgerondMail(v, nv, bijlagen.length > 0);
  const m = { aanNaam: "Bestuur VBHA", onderwerp, html: huisstijl(html, "Vriendenkring Brandweer Hoofdpost Aalst"), bijlagen, van: afzender() };
  const uit = await verstuur(aan.map((a, i) => ({ ...m, aan: a, ...(i ? { geenBcc: true } : {}) })));
  const ok = uit.some(x => x && x.ok);
  if (!ok) throw httpErr(502, "Versturen mislukt: " + ((uit[0] && uit[0].fout) || "onbekende fout"));
  await sb.from("vergaderingen").update({ data: { ...v, afgerond: { ...af, gemaild: new Date().toISOString(), aan: aan.join(", ") } } }).eq("id", r.id);
  res.status(200).json({ aan, bijlage: bijlagen.length > 0 });
}
