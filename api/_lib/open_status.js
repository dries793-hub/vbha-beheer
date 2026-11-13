import { admin, sendError, httpErr } from "./sb.js";
import { smtpConfigured, afzender, verstuur } from "./smtp.js";
import { huisstijl, kaderBlok, knop, tabel, rij, p, esc, site } from "./bevestiging.js";
import { algemeen, body, masker, rateLimit } from "./publiek.js";
import { kloptStatus } from "./lidlink.js";
import { lidStatus, jaarCfg } from "./status.js";

/* /api/reglement (GET): de cijfers van het reglement (openbaar).
   /api/status (POST {l, j, t}): persoonlijke pagina via de ondertekende link uit de mail: status van het huidige werkjaar
   en de punten die dit werkjaar per onderdeel verzameld werden (en wat dat betekent voor volgend jaar). */
const KLEUR = { GEEN: "#9aa0a6", BRONS: "#a5703f", ZILVER: "#8d959e", GOUD: "#c19a2e" };
export async function reglement(req, res) {
  res.setHeader("Cache-Control", "public, max-age=300");
  const sb = admin(), A = await algemeen(sb), j = Number(req.query?.j) || A.jaar, c = await jaarCfg(sb, j);
  return res.status(200).json({ jaar: j, vereniging: A.vereniging, gewichten: c.gewichten, drempels: c.drempels, korting: c.korting });
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
    const { data: jr } = await sb.from("jaarleden").select("data").eq("id", Y + "_" + l).maybeSingle(); const J = (jr && jr.data) || {};
    const onderdelen = [
      { naam: "Kalenders bussen", aantal: J.kalUitgevoerd || 0, eenheid: ["doos", "dozen"], per: w.kalenders },
      { naam: "Hulp bij activiteiten", aantal: J.shifts || 0, eenheid: ["shift", "shiften"], per: w.shifts },
      { naam: "Verkoop kaarten fuif", aantal: J.kaarten || 0, eenheid: ["kaart", "kaarten"], per: w.kaarten },
      { naam: "Vergaderingen", aantal: J.vergaderingen || 0, eenheid: ["vergadering", "vergaderingen"], per: w.vergaderingen }
    ].map(o => ({ ...o, punten: o.aantal * (o.per || 0) }));
    if (J.extraPunten) onderdelen.push({ naam: J.extraTekst ? "Extra: " + J.extraTekst : "Extra punten", aantal: null, punten: J.extraPunten || 0 });
    const totaal = onderdelen.reduce((t, o) => t + o.punten, 0), ere = L.categorie === "Erewacht", vrij = !ere && !!J.vrijstelling;
    const volgend = ere || vrij ? "GOUD" : totaal >= dr.goud ? "GOUD" : totaal >= dr.zilver ? "ZILVER" : totaal >= (dr.brons || 0) ? "BRONS" : "GEEN";
    const tot = volgend === "GOUD" ? 0 : (volgend === "ZILVER" ? dr.goud : volgend === "BRONS" ? dr.zilver : dr.brons) - totaal;
    return res.status(200).json({ ok: true, voornaam: L.voornaam || "", jaar: Y,
      nu: { status: S.status, korting: S.korting, ere: S.ere, vrij: S.vrij, start: S.start, puntenJaar: S.puntenJaar },
      punten: { totaal, onderdelen, volgend, ere, vrij, nodig: tot > 0 ? tot : 0, naar: volgend === "GEEN" ? "BRONS" : volgend === "BRONS" ? "ZILVER" : volgend === "ZILVER" ? "GOUD" : null, kortingVolgend: Number(c.korting[volgend.toLowerCase()]) || 0 },
      drempels: { brons: 0, ...dr } });
  } catch (e) { sendError(res, e); }
}
