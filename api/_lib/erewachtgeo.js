import { admin, requireUser, httpErr } from "./sb.js";
import { zoekPuntSlim, binnen } from "./open_kalender.js";
/* Erewacht op de kalenderkaart: adres van elk lid in de categorie Erewacht omzetten naar een punt (geo.api.vlaanderen.be)
   en bewaren in leden.data.geo = {adres, lat, lng, binnen}. Enkel opnieuw opzoeken als het adres veranderde. */
export async function erewachtGeoApi(req, res) {
  if (req.method !== "POST") throw httpErr(405, "Gebruik POST");
  await requireUser(req, { write: true });
  const sb = admin();
  const { data, error } = await sb.from("leden").select("id,data").eq("data->>categorie", "Erewacht").limit(500);
  if (error) throw error;
  const todo = (data || []).filter(r => { const a = String(r.data.adres || "").trim(), g = r.data.geo; return a && (!g || g.adres !== a); }).slice(0, 60);
  let n = 0;
  for (let i = 0; i < todo.length; i += 6) {
    await Promise.all(todo.slice(i, i + 6).map(async r => {
      const a = String(r.data.adres).trim(), P = await zoekPuntSlim(a);
      const geo = P && P.lat ? { adres: a, lat: +P.lat, lng: +P.lng, binnen: binnen([P.lat, P.lng]), exact: !!P.huisnummer } : { adres: a, lat: null, lng: null, binnen: false };
      const { error: e } = await sb.from("leden").update({ data: { ...r.data, geo } }).eq("id", r.id); if (!e) n++;
    }));
  }
  const { data: L } = await sb.from("leden").select("id,data->geo").eq("data->>categorie", "Erewacht").limit(500);
  return res.status(200).json({ ok: true, bijgewerkt: n, geo: Object.fromEntries((L || []).map(r => [r.id, r.geo || null])) });
}
