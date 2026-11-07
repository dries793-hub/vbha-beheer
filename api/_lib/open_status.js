import { admin, sendError, httpErr } from "./sb.js";
import { smtpConfigured, afzender, verstuur } from "./smtp.js";
import { huisstijl, kaderBlok, knop, tabel, rij, p, esc, site } from "./bevestiging.js";
import { algemeen, body, masker } from "./publiek.js";
import { kloptStatus } from "./lidlink.js";
import { lidStatus, jaarCfg } from "./status.js";

/* /api/reglement (GET): de cijfers van het reglement (openbaar).
   /api/status (POST {l, j, t}): een lid vraagt via de ondertekende link uit de mail zijn status op voor werkjaar j;
   de status gaat per mail naar het gekende adres van het lid (zonder exacte punten). Max. 1 mail per 10 minuten. */
const KLEUR = { BRONS: "#a5703f", ZILVER: "#8d959e", GOUD: "#c19a2e" };
export async function reglement(req, res) {
  res.setHeader("Cache-Control", "public, max-age=300");
  const sb = admin(), A = await algemeen(sb), j = Number(req.query?.j) || A.jaar, c = await jaarCfg(sb, j);
  return res.status(200).json({ jaar: j, vereniging: A.vereniging, gewichten: c.gewichten, drempels: c.drempels, korting: c.korting });
}
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const sb = admin();
    if (req.method === "GET" && String(req.query?.f || "") === "reglement" || /\/api\/reglement\b/.test(String(req.url || ""))) return await reglement(req, res);
    if (req.method !== "POST") throw httpErr(405, "Gebruik POST");
    const b = body(req), l = String(b.l || ""), j = Number(b.j);
    if (!kloptStatus(l, j, String(b.t || ""))) throw httpErr(400, "Deze link is niet (meer) geldig. Gebruik de link uit je mail.");
    const { data: row } = await sb.from("leden").select("data").eq("id", l).maybeSingle();
    if (!row) throw httpErr(404, "Dit lid werd niet gevonden.");
    const L = row.data || {}, aan = String(L.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(aan)) throw httpErr(400, "We hebben geen e-mailadres van je. Antwoord op de mail van het bestuur om je status te vragen.");
    const laatst = Date.parse(L.statusGevraagd || "") || 0;
    if (Date.now() - laatst < 10 * 60000) return res.status(200).json({ ok: true, aan: masker(aan), al: true });
    if (!smtpConfigured()) throw httpErr(503, "Mails versturen lukt op dit moment niet. Probeer het later opnieuw.");
    const S = await lidStatus(sb, l, j), A = await algemeen(sb), naam = S.status.charAt(0) + S.status.slice(1).toLowerCase();
    const badge = `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${KLEUR[S.status]};color:#ffffff;font-weight:bold;letter-spacing:.5px">${esc(S.status)}</span>`;
    const html = p(`Beste ${esc(L.voornaam || L.naam || "")},`) + p(`Je vroeg je status op voor het werkjaar <b>${j}</b>.`)
      + kaderBlok("Jouw status " + j, tabel([rij("Status", badge), rij("Korting", `<b>${S.korting}%</b> op de kostprijs van betalende activiteiten (bv. het banket)`)]))
      + p(S.ere ? "Als lid van de erewacht geniet je steeds de maximale korting." : `Je status is gebaseerd op de punten die je in ${S.puntenJaar} verdiende met je inzet voor de vereniging.`)
      + p("Hoe je punten verdient en wat elke status betekent, lees je in het reglement:") + knop("Reglement puntensysteem bekijken", site() + "/reglement")
      + p("Klopt er volgens jou iets niet? Antwoord dan gewoon op deze mail.", "margin:0 0 15px;font-size:13.5px;color:#666666");
    const [r] = await verstuur([{ aan, aanNaam: [L.voornaam, L.naam].filter(Boolean).join(" "), onderwerp: `VBHA - Jouw status ${j}: ${naam}`, html: huisstijl(html, A.vereniging), van: afzender() }]);
    if (!r || !r.ok) throw httpErr(502, "De mail kon niet verstuurd worden. Probeer het later opnieuw.");
    await sb.from("leden").update({ data: { ...L, statusGevraagd: new Date().toISOString() } }).eq("id", l);
    return res.status(200).json({ ok: true, aan: masker(aan) });
  } catch (e) { sendError(res, e); }
}
