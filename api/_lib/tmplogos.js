// TIJDELIJK: uitgeknipte sponsorlogo's (public/w/logos) in Documenten › Sponsors › Logo's zetten en aan de sponsor koppelen.
import { admin, isDbCron, httpErr } from "./sb.js";
const site = () => String(process.env.SITE_URL || "https://vbha-beheer.vercel.app").replace(/\/+$/, "");
const M = [["l00","f7b7ca04-1ad8-455f-aac6-9e6f78d0b35e"],["l01","e6ec6f9d-6c9c-4bbe-a9b0-58738af88eb4"],["l02","aalsterse-dakwerken"],["l03","zakenkantoor-bombeke"],["l04","tweewielers-van-impe"],
  ["l05","e57e4641-16e6-4852-b2f2-fd13e1134ffc"],["l06","87973985-ae0e-42f4-8464-03c2c6cdc123"],["l07","e7c721ef-0f2e-42aa-9fa7-a1e7b8eaa2ff"],["l08","7ddf8508-b8a0-4ef0-a808-2ed8f165b3c6"],["l09","hubo-jasam"],
  ["l10","b2034aff-50c8-4f1e-bc0b-4fd35c8e8d63"],["l11","788d84fa-502d-4dbd-bdf2-a0a6f02f9b21"],["l12","cafe-zeppelin-rokalist"],["l13","962e8868-c852-4259-90f1-0f0c50386ff0"],["l14","7f1093a5-c0f1-48a4-b5e6-a08b7d3db3f7"],
  ["l15",null,"ABC Drukkerij"],["l16","6e9f254e-d7d1-4e3d-8ccd-328aa0116168"],["l17","01944994-7fe8-4314-883d-11e82b13b393"],["l18","5f3e2b15-1b14-4193-ab66-a52359817b7a"],["l19","brouwerij-deneef-moortgat-tdn-services"],
  ["l20","de-soeptrien-pulmenti"],["l21","cottyn-advocatenkantoor"],["l22","helixe"],["l23","c13ad504-22fb-4a71-ab30-6c7195393289"],["l24","6803e986-8a37-4796-9452-257028868ec5"],["l25","0bdffe48-a1c7-479e-90ba-106953fef4f8"]];
const slug = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export async function tmpLogos(req, res) {
  if (!(await isDbCron(req))) throw httpErr(403, "Geen toegang");
  const sb = admin(), uit = [], MAP = "Sponsors/Logo's";
  const { data: al } = await sb.from("documenten").select("id,data").eq("data->>map", MAP);
  for (const [f, sid, losNaam] of M) {
    try {
      let naam = losNaam;
      if (sid) { const { data: s } = await sb.from("sponsors").select("data").eq("id", sid).maybeSingle(); if (!s) { uit.push(f + ": sponsor niet gevonden"); continue; } naam = s.data.weergave || s.data.bedrijf; }
      if (sid && (al || []).some(r => r.data.sponsorId === sid)) { uit.push(f + ": heeft al een logo"); continue; }
      const r = await fetch(`${site()}/w/logos/${f}.png`); if (!r.ok) { uit.push(f + ": download " + r.status); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      const id = "doc-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6), pad = `Sponsors/${id}-${slug(naam)}-logo.png`;
      const { error } = await sb.storage.from("documenten").upload(pad, buf, { contentType: "image/png", upsert: false }); if (error) throw error;
      const d = { naam: `Logo ${naam}.png`, pad, map: MAP, grootte: buf.length, type: "image/png", omschrijving: `Logo ${naam} · uitgeknipt uit de sponsorlijst 2027`, door: "Automatisch", op: new Date().toISOString(), ...(sid ? { sponsorId: sid } : {}) };
      const { error: e2 } = await sb.from("documenten").insert({ id, data: d }); if (e2) throw e2;
      uit.push(f + ": ok " + naam);
    } catch (e) { uit.push(f + ": fout " + e.message); }
  }
  res.status(200).json({ uit });
}
