import { admin, sendError, httpErr } from "./sb.js";
import { smtpConfigured, afzender, verstuur } from "./smtp.js";
import { huisstijl, kaderBlok, knop, tabel, rij, p, esc, site } from "./bevestiging.js";
import { algemeen, body, masker, rateLimit } from "./publiek.js";
import { kloptStatus } from "./lidlink.js";
import { lidStatus, jaarCfg } from "./status.js";

// extra inspanningen: elke lijn apart (oudere gegevens: één lijn met de samengevoegde tekst)
const extraRijen = J => { const L = Array.isArray(J.extras) ? J.extras.filter(x => x && ((x.tekst || "").trim() || Number(x.punten))) : (J.extraPunten ? [{ tekst: J.extraTekst || "", punten: J.extraPunten }] : []);
  return L.map(x => ({ naam: (x.tekst || "").trim() ? "Extra inspanning: " + (x.tekst || "").trim() : "Extra inspanning", aantal: null, punten: Number(x.punten) || 0 })); };
/* /api/reglement (GET): de cijfers van het reglement (openbaar).
   /api/status (POST {l, j, t}): persoonlijke pagina via de ondertekende link uit de mail: status van het huidige werkjaar
   en de punten die dit werkjaar per onderdeel verzameld werden (en wat dat betekent voor volgend jaar). */
const KLEUR = { GEEN: "#9aa0a6", BRONS: "#a5703f", ZILVER: "#8d959e", GOUD: "#c19a2e" };
// tekst van het reglement (staat niet meer in de openbare pagina: enkel wie toegang heeft, krijgt hem)
const medal = s => `<span class="medal ${s}">${s === "GEEN" ? "GEEN STATUS" : s}</span>`;
function reglementHtml(c) { const w = c.gewichten, dr = c.drempels, k = c.korting;
  return `<div class="card regl">
  <h2>1. Doelstellingen</h2><ul><li>Leden stimuleren om actief deel te nemen.</li><li>Extra inzet belonen met tastbare voordelen.</li></ul>
  <h2>2. Basisprincipes</h2><ul><li>Elk lid betaalt het standaard lidgeld.</li><li>Leden verdienen punten voor hun inzet.</li><li>De punten die je verzamelt in werkjaar (X) gelden voor het daaropvolgende inzetjaar (X+1).</li><li>Maximale korting per activiteit: ${k.goud}% van de kostprijs.</li><li>Geldigheid: 1 jaar. Punten worden jaarlijks op 1 januari op 0 gezet (geen overdracht).</li><li>Erewachters betalen wel hun lidgeld, maar genieten steeds de maximale korting van ${k.goud}% en nemen niet deel aan het puntensysteem.</li></ul>
  <h2>3. Toekenning van punten</h2><p>Elke taak of activiteit krijgt een specifieke puntenwaarde. Na elke activiteit registreert het bestuur de punten van de deelnemers in de VBHA Beheer-applicatie. Via je persoonlijke statuspagina kan je je puntensaldo op elk moment raadplegen. Het blijft de verantwoordelijkheid van elk lid om dit saldo regelmatig te controleren.</p>
  <table class="rtab"><thead><tr><th>Activiteit</th><th>Punten</th></tr></thead><tbody><tr><td>Verkoop kaarten fuif (per stuk)</td><td>${w.kaarten}</td></tr><tr><td>Bussen kalenders (per doos)</td><td>${w.kalenders}</td></tr><tr><td>Hulp bij activiteit (shift/opbouw/afbraak)</td><td>${w.shifts}</td></tr><tr><td>Extra inspanning (ontwerp kalender, aanbrengen sponsor, …)</td><td>50</td></tr><tr><td>Aanwezigheid op vergaderingen (bestuur)</td><td>${w.vergaderingen}</td></tr></tbody></table>
  <h2>4. Omzetting van punten in korting</h2><p>De verzamelde punten worden omgezet in een korting op de kostprijs van betalende activiteiten (bv. banket).</p>
  <table class="rtab"><thead><tr><th>Punten per jaar</th><th>Voordeel</th><th>Type lid</th></tr></thead><tbody>${dr.brons>0?`<tr><td>0–${dr.brons-1}</td><td>geen korting</td><td>${medal("GEEN")}</td></tr>`:""}<tr><td>${dr.brons||0}–${dr.zilver-1}</td><td>${k.brons}% korting</td><td>${medal("BRONS")}</td></tr><tr><td>${dr.zilver}–${dr.goud-1}</td><td>${k.zilver}% korting</td><td>${medal("ZILVER")}</td></tr><tr><td>${dr.goud} of meer</td><td>${k.goud}% korting</td><td>${medal("GOUD")}</td></tr></tbody></table>
  <h2>5. Regels rond gebruik</h2><ul><li>Punten zijn strikt persoonsgebonden en kunnen onder geen enkele voorwaarde verkocht, overgedragen of gedeeld worden met andere leden. Ze dienen uitsluitend ter beloning van de individuele inzet van het lid.</li><li>Punten die tijdens een werkjaar worden verzameld, zijn geldig voor het daaropvolgende inzetjaar. Ze kunnen enkel tijdens dat inzetjaar ingezet worden en vervallen bij de jaarlijkse reset. Punten doorschuiven naar een volgend werkjaar kan niet. Zo start elk lid elk jaar opnieuw met gelijke kansen.</li><li>Inzet wordt gewaardeerd op basis van vastgelegde categorieën. Het bestuur kan bij bijzondere inspanningen bijkomende punten toekennen.</li><li>Enkel leden die hun jaarlijkse lidgeld betaald hebben, kunnen punten verzamelen en inruilen. Is het lidgeld niet betaald, dan vervallen alle rechten op deelname aan het puntensysteem.</li><li>Punten geven recht op een korting van maximum ${k.goud}% van de kostprijs van een betalende activiteit. Volledig gratis deelnemen aan een activiteit is dus niet mogelijk.</li><li>Meent een lid te weinig punten ontvangen te hebben, dan kan dit binnen een redelijke termijn gemeld worden bij het bestuur. Het bestuur bekijkt de melding en neemt een definitieve, bindende beslissing.</li><li>Er is geen maximumaantal punten dat een lid kan verzamelen. Enkel de korting per activiteit is begrensd.</li><li>Enkel leden van de vriendenkring komen in aanmerking om punten te verzamelen. Brengt een lid een extern persoon (bv. partner) mee om te helpen, dan krijgt dat lid hiervoor extra punten.</li><li>Het bestuur kan tijdens het jaar extra afspraken maken voor activiteiten die spontaan tot stand komen en niet in dit reglement vermeld staan.</li></ul>
  <div class="regl-end"><b>Afsluitende opmerking</b><br>Het systeem is bedoeld om inzet zichtbaar en belonend te maken, niet om leden uit te melken of te rangschikken.</div>
</div>`; }
/* Het reglement is enkel bereikbaar via een persoonlijke link (mail of statuspagina: l, j, t zoals de statuslink)
   of voor wie aangemeld is in VBHA Beheer (token van de sessie). */
export async function reglement(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  const sb = admin(), q = req.query || {};
  let ok = kloptStatus(String(q.l || ""), Number(q.j), String(q.t || ""));
  if (!ok) { const tok = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (tok) { try { const { data } = await sb.auth.getUser(tok); if (data?.user) { const { data: b } = await sb.from("bestuur").select("user_id").eq("user_id", data.user.id).maybeSingle(); ok = !!b; } } catch (e) { ok = false; } } }
  if (!ok) { await rateLimit(sb, req, "reglement", 30, 3600, httpErr); return res.status(403).json({ error: "Het reglement is enkel te bekijken via de persoonlijke link uit je mail of via je statuspagina." }); }
  const A = await algemeen(sb), j = A.jaar, c = await jaarCfg(sb, j);
  return res.status(200).json({ jaar: j, vereniging: A.vereniging, html: reglementHtml(c) });
}
export function statusHtml(L, S, j) {
  const badge = `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${KLEUR[S.status]};color:#ffffff;font-weight:bold;letter-spacing:.5px">${esc(S.status === "GEEN" ? "GEEN STATUS" : S.status)}</span>`;
  return p(`Beste ${esc(L.voornaam || L.naam || "")},`) + p(`Je vroeg je status op voor het werkjaar <b>${j}</b>.`)
    + kaderBlok("Jouw status " + j, tabel([rij("Status", badge), rij("Korting", `<b>${S.korting}%</b> op de kostprijs van betalende activiteiten (bv. het banket)`)]))
    + p(S.ere ? "Als lid van de erewacht geniet je steeds de maximale korting." : S.vrij ? `Omdat je in ${S.puntenJaar} vrijgesteld was van het puntensysteem, krijg je de goudstatus.` : S.start ? `Het puntensysteem startte pas in ${S.puntenJaar + 1}. Daarom krijgt iedereen dit jaar de goudstatus.` : `Je status is gebaseerd op de punten die je in ${S.puntenJaar} verdiende met je inzet voor de vereniging.`)
    + p("Hoe je punten verdient en wat elke status betekent, lees je in het reglement:") + knop("Reglement puntensysteem bekijken", site() + "/reglement")
    + p("Klopt er volgens jou iets niet? Antwoord dan gewoon op deze mail.", "margin:0 0 15px;font-size:13.5px;color:#666666");
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const sb = admin();
    if (req.method === "GET" && String(req.query?.f || "") === "reglement" || /\/api\/reglement\b/.test(String(req.url || ""))) return await reglement(req, res);
    if (req.method !== "POST") throw httpErr(405, "Gebruik POST");
    await rateLimit(sb, req, "status", 20, 3600, httpErr);
    const b = body(req), l = String(b.l || ""), j = Number(b.j);
    if (!kloptStatus(l, j, String(b.t || ""))) throw httpErr(400, "Deze link is niet (meer) geldig. Gebruik de link uit je mail.");
    const { data: row } = await sb.from("leden").select("data").eq("id", l).maybeSingle();
    if (!row) throw httpErr(404, "Dit lid werd niet gevonden.");
    // persoonlijke statuspagina: status van dit werkjaar + de punten die dit jaar al verzameld zijn (geldt het hele jaar, ook met een link van vorig jaar)
    const L = row.data || {}, A = await algemeen(sb), Y = Number(A.jaar) || j;
    const S = await lidStatus(sb, l, Y), c = await jaarCfg(sb, Y), w = c.gewichten, dr = c.drempels;
    const [{ data: jr }, { data: jv }] = await Promise.all([sb.from("jaarleden").select("data").eq("id", Y + "_" + l).maybeSingle(), sb.from("jaarleden").select("data").eq("id", (Y - 1) + "_" + l).maybeSingle()]);
    const J = (jr && jr.data) || {}, JV = (jv && jv.data) || {};
    const delen = (J, w) => { const o = [
      { naam: "Kalenders bussen", aantal: J.kalUitgevoerd || 0, eenheid: ["doos", "dozen"], per: w.kalenders },
      { naam: "Hulp bij activiteiten", aantal: J.shifts || 0, eenheid: ["keer geholpen", "keer geholpen"], per: w.shifts, vast: Number(J.shiftPt) || 0 },
      { naam: "Verkoop kaarten fuif", aantal: J.kaarten || 0, eenheid: ["kaart", "kaarten"], per: w.kaarten },
      { naam: "Vergaderingen", aantal: J.vergaderingen || 0, eenheid: ["vergadering", "vergaderingen"], per: w.vergaderingen }
    ].map(x => ({ ...x, punten: x.aantal * (x.per || 0) + (x.vast || 0) }));
      o.push(...extraRijen(J)); return o; };
    const vorigDelen = S.ere || S.vrij || S.start ? [] : delen(JV, S.cfgVorig.gewichten);
    // bij welke activiteiten het lid hielp (uit de shiftenmodule of manueel in het puntensysteem)
    const shDetail = (() => { const L = Array.isArray(J.shiftLijst) ? J.shiftLijst.filter(x => x && (Number(x.n) > 0 || Number(x.pt) > 0)) : []; if (!L.length) return null;
      const d = L.map(x => ({ naam: String(x.t || "Activiteit").slice(0, 80), datum: /^\d{4}-\d{2}-\d{2}$/.test(x.d || "") ? x.d : "", aantal: Number(x.n) || 0, punten: (Number(x.n) || 0) * (w.shifts || 0) + (Number(x.pt) || 0), ...(Number(x.pt) > 0 ? { pt: Number(x.pt) } : {}), ...(x.pa ? { partner: true } : {}) })).sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
      const rest = (Number(J.shifts) || 0) - d.reduce((t, x) => t + x.aantal, 0); if (rest > 0) d.push({ naam: "Andere", datum: "", aantal: rest, punten: rest * (w.shifts || 0) }); return d; })();
    const onderdelen = [
      { naam: "Kalenders bussen", aantal: J.kalUitgevoerd || 0, eenheid: ["doos", "dozen"], per: w.kalenders },
      { naam: "Hulp bij activiteiten", aantal: (J.shifts || 0) || (Number(J.shiftPt) ? null : 0), eenheid: ["keer geholpen", "keer geholpen"], per: w.shifts, vast: Number(J.shiftPt) || 0, ...(shDetail ? { detail: shDetail } : {}) },
      { naam: "Verkoop kaarten fuif", aantal: J.kaarten || 0, eenheid: ["kaart", "kaarten"], per: w.kaarten },
      { naam: "Vergaderingen", aantal: J.vergaderingen || 0, eenheid: ["vergadering", "vergaderingen"], per: w.vergaderingen }
    ].map(o => ({ ...o, punten: (o.aantal || 0) * (o.per || 0) + (o.vast || 0) }));
    onderdelen.push(...extraRijen(J));
    const totaal = onderdelen.reduce((t, o) => t + o.punten, 0), ere = L.categorie === "Erewacht", vrij = !ere && !!J.vrijstelling;
    const volgend = ere || vrij ? "GOUD" : totaal >= dr.goud ? "GOUD" : totaal >= dr.zilver ? "ZILVER" : totaal >= (dr.brons || 0) ? "BRONS" : "GEEN";
    const tot = volgend === "GOUD" ? 0 : (volgend === "ZILVER" ? dr.goud : volgend === "BRONS" ? dr.zilver : dr.brons) - totaal;
    // plaats in de rangschikking van dit jaar (gedeelde plaats bij evenveel punten; testlid telt niet mee)
    let rang = null;
    if (totaal > 0) {
      const [{ data: alleJ }, { data: alleL }] = await Promise.all([sb.from("jaarleden").select("id,data").eq("data->>jaar", String(Y)).limit(2000), sb.from("leden").select("id,data").limit(2000)]);
      const actief = new Set((alleL || []).filter(r => r.data && !r.data.geenLid && !r.data.test && r.id !== "test-vbha" && (!r.data.lidTot || Number(String(r.data.lidTot).slice(0, 4)) >= Y)).map(r => r.id));
      actief.add(l);
      const pt = new Map(); for (const r of alleJ || []) { const id = r.data && r.data.lidId; if (actief.has(id)) pt.set(id, delen(r.data, w).reduce((t, o) => t + o.punten, 0)); }
      pt.set(l, totaal);
      rang = { plaats: 1 + [...pt.values()].filter(v => v > totaal).length, gedeeld: [...pt.values()].filter(v => v === totaal).length > 1, van: actief.size };
    }
    return res.status(200).json({ ok: true, voornaam: L.voornaam || "", jaar: Y, rang,
      nu: { status: S.status, korting: S.korting, ere: S.ere, vrij: S.vrij, start: S.start, puntenJaar: S.puntenJaar, onderdelen: vorigDelen, totaal: vorigDelen.reduce((t, o) => t + o.punten, 0) },
      punten: { totaal, onderdelen, volgend, ere, vrij, nodig: tot > 0 ? tot : 0, naar: volgend === "GEEN" ? "BRONS" : volgend === "BRONS" ? "ZILVER" : volgend === "ZILVER" ? "GOUD" : null, kortingVolgend: Number(c.korting[volgend.toLowerCase()]) || 0 },
      drempels: { brons: 0, ...dr } });
  } catch (e) { sendError(res, e); }
}
