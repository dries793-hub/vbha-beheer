/* Status van een lid (brons/zilver/goud) voor werkjaar J: volgens het reglement tellen de punten van werkjaar J-1.
   Erewacht = steeds goud; vrijstelling (jaarleden.vrijstelling) ook. Kortingspercentages uit de instellingen van jaar J. Gedeeld door banket en "status opvragen". */
export const DEF = { gewichten: { kaarten: 1, kalenders: 25, shifts: 35, vergaderingen: 20 }, drempels: { zilver: 65, goud: 100 }, korting: { brons: 20, zilver: 35, goud: 50 } };
export async function jaarCfg(sb, Y) {
  const { data } = await sb.from("jaren").select("data").eq("id", String(Y)).maybeSingle(); const j = (data && data.data) || {};
  return { gewichten: { ...DEF.gewichten, ...(j.gewichten || {}) }, drempels: { ...DEF.drempels, ...(j.drempels || {}) }, korting: { ...DEF.korting, ...(j.korting || {}) } };
}
export const PUNTEN_START = 2026; // eerste werkjaar waarin punten verzameld werden
export async function lidStatus(sb, lidId, jaar) {
  const vorig = jaar - 1;
  const [{ data: lid }, { data: jl }, cv, cj] = await Promise.all([sb.from("leden").select("data").eq("id", lidId).maybeSingle(), sb.from("jaarleden").select("data").eq("id", vorig + "_" + lidId).maybeSingle(), jaarCfg(sb, vorig), jaarCfg(sb, jaar)]);
  const L = (lid && lid.data) || {}, j = (jl && jl.data) || {}, w = cv.gewichten;
  const punten = (j.kaarten || 0) * w.kaarten + (j.kalUitgevoerd || 0) * w.kalenders + (j.shifts || 0) * w.shifts + (j.vergaderingen || 0) * w.vergaderingen + (j.extraPunten || 0);
  const ere = L.categorie === "Erewacht";
  const vrij = !ere && !!j.vrijstelling; // vrijstelling puntensysteem voor werkjaar J-1 (ziekte, werkonderbreking…) = goud
  const start = !ere && !vrij && vorig < PUNTEN_START; // vóór de start van het puntensysteem telt iedereen als goud
  const status = ere || vrij || start ? "GOUD" : punten >= cv.drempels.goud ? "GOUD" : punten >= cv.drempels.zilver ? "ZILVER" : "BRONS";
  const korting = Math.max(0, Math.min(100, Number(cj.korting[status.toLowerCase()]) || 0));
  return { status, korting, punten, puntenJaar: vorig, ere, vrij, start, lid: L, cfg: cj, cfgVorig: cv };
}
