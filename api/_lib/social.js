/* Sociale media: posts klaarzetten en (meteen of op een tijdstip) publiceren op Facebook, Instagram en de eigen website.
   Tabel social_posts (enkel via de server): {id, data, status, plan}
     data = {tekst, link, titel, fotos:[{pad,w,h}], kanalen:{facebook,instagram,website}, door, gemaakt,
             resultaten:{facebook|instagram|website:{ok, id, url, fout, op}}}
     status: concept | gepland | bezig | gepubliceerd | deels | fout
   Nodig in Vercel voor Facebook/Instagram (Meta Graph API):
     META_PAGE_ID     id van de Facebook-pagina
     META_PAGE_TOKEN  paginatoken (lange levensduur) met pages_manage_posts, pages_read_engagement, instagram_basic, instagram_content_publish
     META_IG_USER_ID  id van het zakelijke Instagram-account dat aan de pagina gekoppeld is
   Website: de post komt als eigen onderdeel bovenaan vbha.be (config "website", eigen + fotos).
   /api/mail?f=social  POST {actie:"lijst"|"bewaar"|"verwijder"|"publiceer", ...} (functie "social"), of de geplande taak (pg_cron, elke 5 min). */
import { admin, requireUser, httpErr, sendError, isDbCron } from "./sb.js";

const GRAPH = "https://graph.facebook.com/v21.0";
const env = k => String(process.env[k] || "").trim();
export const fbAan = () => !!(env("META_PAGE_ID") && env("META_PAGE_TOKEN"));
export const igAan = () => !!(env("META_IG_USER_ID") && env("META_PAGE_TOKEN"));
const BUCKET = "documenten";
const nu = () => new Date().toISOString();
const t = (s, n) => String(s ?? "").trim().slice(0, n);
const veiligeUrl = u => { u = String(u || "").trim(); return /^https?:\/\/[^\s"'<>]+$/i.test(u) ? u.slice(0, 500) : ""; };

async function graph(pad, params, methode = "POST") {
  const q = new URLSearchParams({ ...params, access_token: env("META_PAGE_TOKEN") });
  const r = methode === "GET" ? await fetch(`${GRAPH}/${pad}?${q}`) : await fetch(`${GRAPH}/${pad}`, { method: "POST", body: q });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const e = j.error || {};
    const m = e.code === 190 ? "Het Meta-token is verlopen of ongeldig." : e.code === 10 || e.code === 200 ? "Het Meta-token mist de nodige rechten." : (e.error_user_msg || e.message || "Meta gaf een fout (" + r.status + ").");
    throw new Error(m.slice(0, 300));
  }
  return j;
}
async function fotoUrls(sb, fotos) {
  const L = [];
  for (const f of fotos) { const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(f.pad, 3600); if (error || !data) throw new Error("Foto niet gevonden."); L.push(data.signedUrl); }
  return L;
}
const wacht = ms => new Promise(r => setTimeout(r, ms));

async function naarFacebook(sb, d) {
  const page = env("META_PAGE_ID"), bericht = d.tekst + (d.link ? "\n\n" + d.link : ""); // bij foto's staat de link in de tekst
  let postId;
  if (!d.fotos.length) postId = (await graph(`${page}/feed`, { message: d.tekst, ...(d.link ? { link: d.link } : {}) })).id;
  else {
    const urls = await fotoUrls(sb, d.fotos);
    if (urls.length === 1) { const j = await graph(`${page}/photos`, { url: urls[0], caption: bericht }); postId = j.post_id || j.id; }
    else {
      const ids = []; for (const u of urls) ids.push((await graph(`${page}/photos`, { url: u, published: "false" })).id);
      postId = (await graph(`${page}/feed`, { message: bericht, attached_media: JSON.stringify(ids.map(id => ({ media_fbid: id }))) })).id;
    }
  }
  return { id: postId, url: `https://www.facebook.com/${postId}` };
}
async function igKlaar(id) { // Instagram verwerkt de foto eerst; wachten tot de container klaar is
  for (let i = 0; i < 15; i++) { const j = await graph(id, { fields: "status_code" }, "GET"); if (j.status_code === "FINISHED") return; if (j.status_code === "ERROR") throw new Error("Instagram kon de foto niet verwerken (formaat?)."); await wacht(2000); }
  throw new Error("Instagram verwerkte de foto niet op tijd.");
}
async function naarInstagram(sb, d) {
  if (!d.fotos.length) throw new Error("Instagram vraagt minstens één foto.");
  const ig = env("META_IG_USER_ID"), urls = await fotoUrls(sb, d.fotos.slice(0, 10)), caption = d.tekst + (d.link ? "\n\n" + d.link : "");
  let creatie;
  if (urls.length === 1) { creatie = (await graph(`${ig}/media`, { image_url: urls[0], caption })).id; }
  else {
    const kids = []; for (const u of urls) { const id = (await graph(`${ig}/media`, { image_url: u, is_carousel_item: "true" })).id; kids.push(id); }
    for (const k of kids) await igKlaar(k);
    creatie = (await graph(`${ig}/media`, { media_type: "CAROUSEL", children: kids.join(","), caption })).id;
  }
  await igKlaar(creatie);
  const id = (await graph(`${ig}/media_publish`, { creation_id: creatie })).id;
  let url = ""; try { url = (await graph(id, { fields: "permalink" }, "GET")).permalink || ""; } catch {}
  return { id, url };
}
/* Website: de meest recente post (kanaal Website) staat bovenaan vbha.be in de sectie "Nieuws van de vriendenkring" (config website.nieuws + fotos.nieuws). */
async function zetNieuws(sb, id, d, datum) {
  const { data: row } = await sb.from("config").select("data").eq("id", "website").maybeSingle();
  const c = (row && row.data) || {}, fotos = { ...(c.fotos || {}) }, oud = fotos.nieuws && fotos.nieuws.pad;
  delete fotos.nieuws;
  if (d && d.fotos.length) {
    const f = d.fotos[0], v = Date.now().toString(36), pad = `Website/nieuws-${v}.jpg`;
    const { error } = await sb.storage.from(BUCKET).copy(f.pad, pad); if (error) throw new Error("Foto kon niet naar de website gekopieerd worden.");
    fotos.nieuws = { pad, v, w: f.w || null, h: f.h || null };
  }
  const knop = d && d.webKnop && d.webKnop.aan && (d.webKnop.url || d.link) ? { label: t(d.webKnop.label, 60) || "Meer info", url: d.webKnop.url || d.link } : null;
  const nieuws = d ? { id, titel: t(d.titel, 140), tekst: t(d.tekst, 2200), knop, datum } : null;
  const { error } = await sb.from("config").upsert({ id: "website", data: { ...c, nieuws, fotos } }); if (error) throw error;
  if (oud) await sb.storage.from(BUCKET).remove([oud]).catch(() => {});
}
async function naarWebsite(sb, id, d) { await zetNieuws(sb, id, d, nu()); return { id: "nieuws", url: "https://vbha.be/#nieuws" }; }
async function vanWebsite(sb, id) { // post verwijderd: de vorige websitepost komt terug, of de sectie verdwijnt
  const { data: row } = await sb.from("config").select("data").eq("id", "website").maybeSingle();
  if (!row || !row.data.nieuws || row.data.nieuws.id !== id) return;
  const { data: P } = await sb.from("social_posts").select("id,data").neq("id", id).in("status", ["gepubliceerd", "deels"]).order("gewijzigd", { ascending: false }).limit(30);
  const vorige = (P || []).filter(r => r.data.resultaten && r.data.resultaten.website && r.data.resultaten.website.ok).sort((a, b) => String(b.data.resultaten.website.op).localeCompare(String(a.data.resultaten.website.op)))[0];
  await zetNieuws(sb, vorige ? vorige.id : null, vorige ? vorige.data : null, vorige ? vorige.data.resultaten.website.op : null);
}

/* één post publiceren op de gekozen kanalen; kanalen die al gelukt zijn, worden overgeslagen (opnieuw proberen na een fout) */
async function publiceer(sb, row) {
  const { data: claim } = await sb.from("social_posts").update({ status: "bezig", gewijzigd: nu() }).eq("id", row.id).in("status", ["concept", "gepland", "fout", "deels"]).select("id,data").maybeSingle();
  if (!claim) return null; // al bezig of gepubliceerd
  const d = claim.data, R = { ...(d.resultaten || {}) };
  const doe = [["facebook", () => { if (!fbAan()) throw new Error("Facebook is nog niet gekoppeld."); return naarFacebook(sb, d); }],
    ["instagram", () => { if (!igAan()) throw new Error("Instagram is nog niet gekoppeld."); return naarInstagram(sb, d); }],
    ["website", () => naarWebsite(sb, row.id, d)]];
  for (const [k, f] of doe) {
    if (!d.kanalen[k] || (R[k] && R[k].ok)) continue;
    try { R[k] = { ok: true, ...(await f()), op: nu() }; } catch (e) { R[k] = { ok: false, fout: String(e.message || e).slice(0, 300), op: nu() }; }
  }
  const K = Object.keys(d.kanalen).filter(k => d.kanalen[k]), ok = K.filter(k => R[k] && R[k].ok).length;
  const status = ok === K.length ? "gepubliceerd" : ok ? "deels" : "fout";
  const nieuw = { ...d, resultaten: R, gepubliceerd: ok ? nu() : d.gepubliceerd || null };
  await sb.from("social_posts").update({ data: nieuw, status, gewijzigd: nu() }).eq("id", row.id);
  try { await sb.from("logboek").insert({ wie: d.door || "Automatisch (app)", tabel: "social", doc_id: row.id, actie: status, nieuw: { tekst: t(d.tekst, 200), resultaten: R } }); } catch {}
  return { id: row.id, status, data: nieuw };
}

function schoon(p) {
  const fotos = (Array.isArray(p.fotos) ? p.fotos : []).slice(0, 10).filter(f => f && typeof f.pad === "string" && f.pad.startsWith("Social/")).map(f => ({ pad: f.pad, w: Number(f.w) || null, h: Number(f.h) || null }));
  const k = p.kanalen || {};
  return { tekst: t(p.tekst, 2200), titel: t(p.titel, 140), link: veiligeUrl(p.link), fotos, kanalen: { facebook: !!k.facebook, instagram: !!k.instagram, website: !!k.website },
    webKnop: p.webKnop && p.webKnop.aan ? { aan: true, label: t(p.webKnop.label, 60) || "Meer info", url: veiligeUrl(p.webKnop.url) } : { aan: false } };
}

export default async function socialApi(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") throw httpErr(405, "Gebruik POST");
    if (await isDbCron(req)) { // geplande taak: posts waarvan het tijdstip voorbij is
      const sb = admin(); const { data } = await sb.from("social_posts").select("id,data").eq("status", "gepland").lte("plan", nu()).limit(5);
      const uit = []; for (const r of data || []) uit.push(await publiceer(sb, r));
      return res.status(200).json({ ok: true, gepubliceerd: uit.filter(Boolean).length });
    }
    let b = req.body || {}; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
    const lijst = b.actie === "lijst";
    const { user } = await requireUser(req, lijst ? { functie: "social" } : { write: true, functie: "social" });
    const sb = admin();
    const geef = async () => { const { data, error } = await sb.from("social_posts").select("id,data,status,plan,gewijzigd").order("gewijzigd", { ascending: false }).limit(60); if (error) throw error;
      const P = data || [], pads = [...new Set(P.flatMap(r => (r.data.fotos || []).map(f => f.pad)))], U = {};
      if (pads.length) { const { data: su } = await sb.storage.from(BUCKET).createSignedUrls(pads, 3600); for (const x of su || []) if (x.signedUrl) U[x.path] = x.signedUrl; }
      return { ok: true, posts: P.map(r => ({ ...r, data: { ...r.data, fotos: (r.data.fotos || []).map(f => ({ ...f, url: U[f.pad] || "" })) } })), koppeling: { facebook: fbAan(), instagram: igAan() } }; };
    if (lijst) return res.status(200).json(await geef());
    let wie = user.email || ""; try { const { data } = await sb.from("bestuur").select("naam").eq("user_id", user.id).maybeSingle(); if (data && data.naam) wie = data.naam; } catch {}

    if (b.actie === "foto") { // foto opladen (in de browser al verkleind tot JPEG); de opslag zelf is enkel via de server bereikbaar
      const m = String(b.data || "").match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/); if (!m) throw httpErr(400, "Enkel JPEG-foto's.");
      const buf = Buffer.from(m[1], "base64"); if (buf.length > 3.5e6) throw httpErr(413, "De foto is te groot.");
      const pad = `Social/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}.jpg`;
      const { error } = await sb.storage.from(BUCKET).upload(pad, buf, { contentType: "image/jpeg" }); if (error) throw error;
      const { data: su } = await sb.storage.from(BUCKET).createSignedUrl(pad, 3600);
      return res.status(200).json({ ok: true, pad, url: su ? su.signedUrl : "" });
    }
    if (b.actie === "bewaar") {
      const p = schoon(b.post || {}), id = /^[\w-]{6,40}$/.test(String(b.id || "")) ? String(b.id) : "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      if (!p.tekst && !p.fotos.length) throw httpErr(400, "Schrijf een tekst of voeg een foto toe.");
      if (!Object.values(p.kanalen).some(Boolean)) throw httpErr(400, "Kies minstens één kanaal.");
      if (p.kanalen.instagram && !p.fotos.length) throw httpErr(400, "Instagram vraagt minstens één foto.");
      if (p.kanalen.website && !p.titel) throw httpErr(400, "Geef een titel voor de website.");
      const { data: oud } = await sb.from("social_posts").select("data,status").eq("id", id).maybeSingle();
      if (oud && ["bezig", "gepubliceerd"].includes(oud.status)) throw httpErr(409, "Deze post is al gepubliceerd.");
      const modus = b.modus === "nu" ? "nu" : b.modus === "plan" ? "plan" : "concept";
      let plan = null;
      if (modus === "plan") { const x = new Date(b.plan); if (isNaN(x)) throw httpErr(400, "Kies een geldig tijdstip."); if (x < new Date(Date.now() - 60000)) throw httpErr(400, "Het tijdstip ligt in het verleden."); plan = x.toISOString(); }
      const data = { ...(oud ? oud.data : {}), ...p, door: (oud && oud.data.door) || wie, gemaakt: (oud && oud.data.gemaakt) || nu(), gewijzigdDoor: wie };
      // foto's die niet meer gebruikt worden opruimen
      const weg = ((oud && oud.data.fotos) || []).map(f => f.pad).filter(x => !p.fotos.some(f => f.pad === x)); if (weg.length) await sb.storage.from(BUCKET).remove(weg).catch(() => {});
      const { error } = await sb.from("social_posts").upsert({ id, data, status: modus === "plan" ? "gepland" : (oud && ["fout", "deels"].includes(oud.status) ? oud.status : "concept"), plan, gewijzigd: nu() }); if (error) throw error;
      let pub = null; if (modus === "nu") pub = await publiceer(sb, { id, data });
      return res.status(200).json({ ...(await geef()), id, pub });
    }
    if (b.actie === "publiceer") {
      const { data: row } = await sb.from("social_posts").select("id,data").eq("id", String(b.id || "")).maybeSingle(); if (!row) throw httpErr(404, "Post niet gevonden.");
      const pub = await publiceer(sb, row); if (!pub) throw httpErr(409, "Deze post is al gepubliceerd of wordt nu gepubliceerd.");
      return res.status(200).json({ ...(await geef()), pub });
    }
    if (b.actie === "verwijder") {
      const { data: row } = await sb.from("social_posts").select("id,data,status").eq("id", String(b.id || "")).maybeSingle(); if (!row) throw httpErr(404, "Post niet gevonden.");
      if (row.status === "bezig") throw httpErr(409, "Deze post wordt nu gepubliceerd.");
      // van de eigen website halen kan; op Facebook en Instagram blijft hij staan (daar zelf verwijderen)
      if (row.data.resultaten && row.data.resultaten.website && row.data.resultaten.website.ok) await vanWebsite(sb, row.id);
      const pads = (row.data.fotos || []).map(f => f.pad); if (pads.length) await sb.storage.from(BUCKET).remove(pads).catch(() => {});
      await sb.from("social_posts").delete().eq("id", row.id);
      return res.status(200).json(await geef());
    }
    throw httpErr(400, "Onbekende actie.");
  } catch (e) { return sendError(res, e); }
}

