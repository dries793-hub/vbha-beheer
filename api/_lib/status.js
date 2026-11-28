/* Status van een lid (brons/zilver/goud) voor werkjaar J: volgens het reglement tellen de punten van werkjaar J-1.
   Erewacht = steeds goud; vrijstelling (jaarleden.vrijstelling) ook. Kortingspercentages uit de instellingen van jaar J. Gedeeld door banket en "status opvragen". */
export const DEF = { gewichten: { kaarten: 1, kalenders: 25, shifts: 35, vergaderingen: 20 }, drempels: { brons: 0, zilver: 65, goud: 100 }, korting: { brons: 20, zilver: 35, goud: 50 } };
/* ---- Reglement puntensysteem versie 2027 (schakelaar config algemeen.reglement2027) ----
   Art. 31: het goudtegoed geldt al voor statusjaar 2027 (punten 2026); al de rest voor punten vanaf puntenjaar 2027 (statusjaar 2028). */
export const REG27 = { start: 2027, gewichten: { kaarten: 5, kalenders: 20, shifts: 50, vergaderingen: 20 }, drempels: { brons: 10, zilver: 65, goud: 100 },
  korting: { brons: 20, zilver: 35, goud: 50 }, tegoedPerPunt: 0.1, tegoedStart: 2027, kalDeadline: "12-10", kfPct: { GOUD: 100, ZILVER: 80, BRONS: 50, GEEN: 0 } };
export async function reg27Aan(sb) { const { data } = await sb.from("config").select("data").eq("id", "algemeen").maybeSingle(); return !!(data && data.data && data.data.reglement2027); }
export async function jaarCfg(sb, Y, aan) {
  const [{ data }, r27] = await Promise.all([sb.from("jaren").select("data").eq("id", String(Y)).maybeSingle(), aan == null ? reg27Aan(sb) : aan]); const j = (data && data.data) || {};
  const c = { gewichten: { ...DEF.gewichten, ...(j.gewichten || {}) }, drempels: { ...DEF.drempels, ...(j.drempels || {}) }, korting: { ...DEF.korting, ...(j.korting || {}) }, jaar: Y, r27: !!r27 };
  if (r27 && Y >= REG27.start) { c.nieuw = true; const o = j.r27 || {}; c.tegoedPerPunt = o.tegoedPerPunt != null ? Number(o.tegoedPerPunt) : REG27.tegoedPerPunt; c.kfPct = { ...REG27.kfPct, ...(o.kfPct || {}) }; c.gewichten = { ...REG27.gewichten, ...(o.gewichten || {}) }; c.drempels = { ...REG27.drempels, ...(o.drempels || {}) }; c.kalDeadline = (j.kalDeadline && /^\d{2}-\d{2}$/.test(j.kalDeadline) ? j.kalDeadline : REG27.kalDeadline); }
  return c;
}
/* aantal activiteiten waarop het lid hielp (art. 6: 50 punten per activiteit, ongeacht het aantal shiften) */
export function aantalAct(j) {
  const L = Array.isArray(j.shiftLijst) ? j.shiftLijst : [], K = new Set();
  for (const x of L) if ((Number(x.n) || 0) > 0) K.add(x.act || (x.t || "") + "|" + (x.d || ""));
  const inLijst = L.reduce((t, x) => t + (Number(x.n) || 0), 0), rest = Math.max(0, (Number(j.shifts) || 0) - inLijst);
  return K.size + rest;
}
/* dozen die na de deadline afgewerkt werden, tellen niet mee (art. 5.3) */
export function dozenNaDeadline(j, c) {
  if (!c || !c.nieuw || !c.kalDeadline) return 0; const grens = `${c.jaar}-${c.kalDeadline}T23:59:59`;
  return (Array.isArray(j.kalLog) ? j.kalLog : []).filter(x => x && x.t === "klaar" && x.at && String(x.at) > grens).reduce((t, x) => t + (Number(x.n) || 0), 0);
}
/* punten per onderdeel volgens het reglement van dat jaar */
export function puntenDelen(j, c, lid) {
  const w = c.gewichten;
  if (!c.nieuw) return { kaarten: (j.kaarten || 0) * w.kaarten, kalenders: (j.kalUitgevoerd || 0) * w.kalenders, shifts: (j.shifts || 0) * w.shifts + (Number(j.shiftPt) || 0), vergaderingen: (j.vergaderingen || 0) * w.vergaderingen, extra: j.extraPunten || 0 };
  const best = !lid || !!lid.bestuur;
  return { kaarten: (j.kaarten || 0) * w.kaarten, kalenders: Math.max(0, (j.kalUitgevoerd || 0) - dozenNaDeadline(j, c)) * w.kalenders, shifts: aantalAct(j) * w.shifts + (Number(j.shiftPt) || 0),
    vergaderingen: best ? (j.vergaderingen || 0) * w.vergaderingen : 0, extra: j.extraPunten || 0 };
}
export function puntenVan(j, c, lid) { const d = puntenDelen(j || {}, c, lid); return d.kaarten + d.kalenders + d.shifts + d.vergaderingen + d.extra; }
export const statusUit = (pt, dr) => pt >= dr.goud ? "GOUD" : pt >= dr.zilver ? "ZILVER" : pt >= (dr.brons || 0) ? "BRONS" : "GEEN";
export const PUNTEN_START = 2026; // eerste werkjaar waarin punten verzameld werden
export async function lidStatus(sb, lidId, jaar, { partner = true } = {}) {
  const vorig = jaar - 1, aan = await reg27Aan(sb);
  const [{ data: lid }, { data: jl }, { data: jl2 }, cv, cj] = await Promise.all([sb.from("leden").select("data").eq("id", lidId).maybeSingle(), sb.from("jaarleden").select("data").eq("id", vorig + "_" + lidId).maybeSingle(),
    sb.from("jaarleden").select("data").eq("id", (vorig - 1) + "_" + lidId).maybeSingle(), jaarCfg(sb, vorig, aan), jaarCfg(sb, jaar, aan)]);
  const L = (lid && lid.data) || {}, j = (jl && jl.data) || {};
  const punten = puntenVan(j, cv, L);
  const ere = /erewacht/i.test([].concat(L.categorie || []).join(" "));
  const vrij = !ere && !!j.vrijstelling; // vrijstelling puntensysteem voor werkjaar J-1
  const start = !ere && !vrij && vorig < PUNTEN_START; // vóór de start van het puntensysteem telt iedereen als goud
  const nieuwLid = cv.nieuw && !ere && Number(L.lidSinds) === jaar; // art. 18: wie in de loop van het jaar lid wordt, is dat jaar brons
  let status;
  if (ere || start) status = "GOUD";
  else if (nieuwLid) status = "BRONS";
  else if (vrij) {
    if (cv.nieuw) { // art. 19: met een vrijstelling behoud je de status die je in het lopende jaar (J-1) hebt
      const cvv = await jaarCfg(sb, vorig - 1, aan), jv = (jl2 && jl2.data) || {};
      status = vorig - 1 < PUNTEN_START || jv.vrijstelling ? "GOUD" : Number(L.lidSinds) === vorig ? "BRONS" : statusUit(puntenVan(jv, cvv, L), cvv.drempels);
    } else status = "GOUD";
  } else status = statusUit(punten, cv.drempels);
  // art. 17: twee leden in hetzelfde gezin: de hoogste status van beide
  let viaPartner = null;
  if (partner && cj.r27 && L.partnerId && L.partnerId !== lidId) {
    try { const P = await lidStatus(sb, L.partnerId, jaar, { partner: false }); if (RANG[P.status] > RANG[status]) { viaPartner = { id: L.partnerId, status: P.status }; status = P.status; } } catch (e) {}
  }
  const korting = Math.max(0, Math.min(100, Number(cj.korting[status.toLowerCase()]) || 0));
  // art. 22: goudtegoed (€ 0,10 per punt boven de goudgrens), enkel met eigen punten
  const tegoed = aan && jaar >= REG27.tegoedStart && !ere && !vrij && !start && punten >= cv.drempels.goud ? Math.round((punten - cv.drempels.goud) * (cv.tegoedPerPunt ?? REG27.tegoedPerPunt) * 100) / 100 : 0;
  return { status, korting, punten, puntenJaar: vorig, ere, vrij, start, nieuwLid, viaPartner, tegoed, r27: aan, basis: cv.nieuw && status === "GEEN", lid: L, cfg: cj, cfgVorig: cv };
}
export const RANG = { GEEN: 0, BRONS: 1, ZILVER: 2, GOUD: 3 };
/* tegoed: wat al gebruikt werd bij inschrijvingen van het statusjaar (banket, familiedag, kinderfeest) + manuele correcties (jaarleden.tegoedCorr) */
export const TEGOED_TABELLEN = ["banket", "familiedag", "kinderfeest", "huur"];
export async function tegoedGebruikt(sb, lidId, jaar, behalve) {
  let t = 0;
  for (const tab of TEGOED_TABELLEN) {
    const { data } = await sb.from(tab).select("id,data").eq("data->>jaar", String(jaar)).not("data->tegoed", "is", null).limit(1000);
    for (const r of data || []) { if (behalve && r.id === behalve) continue; for (const x of Array.isArray(r.data.tegoed) ? r.data.tegoed : []) if (x && x.lidId === lidId) t += Number(x.bedrag) || 0; }
  }
  const { data: jl } = await sb.from("jaarleden").select("data").eq("id", jaar + "_" + lidId).maybeSingle();
  for (const x of (jl && jl.data && Array.isArray(jl.data.tegoedCorr) ? jl.data.tegoedCorr : [])) t += Number(x.bedrag) || 0;
  return Math.round(t * 100) / 100;
}
export async function tegoedSaldo(sb, lidId, jaar, S) {
  S = S || await lidStatus(sb, lidId, jaar, { partner: false });
  if (!S.tegoed) return { tegoed: 0, gebruikt: 0, saldo: 0 };
  const g = await tegoedGebruikt(sb, lidId, jaar);
  return { tegoed: S.tegoed, gebruikt: g, saldo: Math.max(0, Math.round((S.tegoed - g) * 100) / 100) };
}
