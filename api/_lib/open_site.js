import fs from "node:fs";
import path from "node:path";
import { admin, httpErr, sendError, requireUser } from "./sb.js";

/* Openbare startpagina vbha.be, samengesteld volgens Administratie › Website (config/"website"):
   { blokken:{viv,kalender,steun,sponsors}, kal_titel, kal_tekst, viv_titel, viv_datum, viv_tekst,
     fotos:{ kalender:{pad,v,w,h}, viv:{pad,v,w,h} } }
   Sjabloon: public/site.html met <!--blok:x-->…<!--/blok:x--> en data-s="sleutel" (tekst) / data-s-img="blok" (foto).
   GET  ?f=site                      → de pagina (kort gecachet op het CDN)
   POST ?f=site  {cfg}               → voorbeeld met niet-bewaarde instellingen (enkel bestuur)
   GET  ?f=sitefoto&k=blok&v=versie  → de foto van een blok (lang gecachet; nieuwe versie = nieuwe v) */

export const SITE_DEF = { blokken: { viv: false, kalender: true, steun: true, sponsors: true } };
const BLOKKEN = ["viv", "kalender", "steun", "sponsors"];
const TEKST = { kal_titel: 140, kal_tekst: 600, viv_titel: 140, viv_datum: 120, viv_tekst: 800, viv_knop_klein: 60 };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let TPL = null;
async function sjabloon(req) {
  if (TPL) return TPL;
  try { TPL = fs.readFileSync(path.join(process.cwd(), "public", "site.html"), "utf8"); return TPL; } catch (e) { /* valt terug op het statische bestand */ }
  const r = await fetch("https://" + String(req.headers.host || "vbha.be") + "/site.html");
  if (!r.ok) throw httpErr(500, "Sjabloon niet gevonden");
  TPL = await r.text(); return TPL;
}

export function schoon(c) {
  c = c && typeof c === "object" ? c : {};
  const o = { blokken: { ...SITE_DEF.blokken } };
  for (const k of BLOKKEN) if (c.blokken && k in c.blokken) o.blokken[k] = !!c.blokken[k];
  for (const [k, max] of Object.entries(TEKST)) if (typeof c[k] === "string" && c[k].trim()) o[k] = c[k].trim().slice(0, max);
  o.fotos = {};
  for (const k of ["kalender", "viv"]) { const f = c.fotos && c.fotos[k]; if (f && typeof f.pad === "string" && f.pad.startsWith("Website/")) o.fotos[k] = { pad: f.pad, v: String(f.v || "1").replace(/\W/g, "").slice(0, 20), w: Number(f.w) || 1600, h: Number(f.h) || 1067 }; }
  return o;
}

export function bouw(tpl, c, basis) {
  let s = tpl;
  for (const k of BLOKKEN) if (!c.blokken[k]) s = s.replace(new RegExp(`<!--blok:${k}-->[\\s\\S]*?<!--/blok:${k}-->`), "");
  for (const k of Object.keys(TEKST)) if (c[k]) s = s.replace(new RegExp(`(<[^>]*\\bdata-s="${k}"[^>]*>)[\\s\\S]*?(</)`), (m, a, b) => a + esc(c[k]) + b);
  let og = null;
  for (const k of ["viv", "kalender"]) {
    const f = c.fotos[k];
    if (f) {
      const url = `/api/openbaar?f=sitefoto&k=${k}&v=${f.v}`;
      s = s.replace(new RegExp(`<img data-s-img="${k}" src="[^"]*"([^>]*?) width="\\d+" height="\\d+"`), `<img data-s-img="${k}" src="${url}"$1 width="${f.w}" height="${f.h}"`);
      if (c.blokken[k] && !og) og = basis + url;
    } else if (k === "viv") {
      // geen foto voor In Vier en Vlam: tekst over de volle breedte
      s = s.replace(/<figure class="photo" data-s-fig="viv">[\s\S]*?<\/figure>/, "").replace('<section class="hero viv"', '<section class="hero viv zonder"');
    } else if (c.blokken.kalender && !og) og = basis + "/w/kalender-2027.jpg";
  }
  if (og) s = s.replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${esc(og)}">`);
  // de eerste zichtbare titel is de h1
  if (c.blokken.viv && c.blokken.kalender) s = s.replace(/<h1 data-s="kal_titel">([\s\S]*?)<\/h1>/, '<h2 data-s="kal_titel" style="font-size:clamp(1.8rem,3vw,2.4rem);line-height:1.15;font-weight:700">$1</h2>');
  if (c.blokken.viv && !c.blokken.kalender) s = s.replace(/<h2 style="[^"]*" data-s="viv_titel">([\s\S]*?)<\/h2>/, '<h1 data-s="viv_titel">$1</h1>');
  return s;
}

async function leesCfg(sb) {
  const { data } = await sb.from("config").select("data").eq("id", "website").maybeSingle();
  return schoon(data && data.data);
}

export default async function site(req, res) {
  try {
    const sb = admin();
    if (req.query.f === "sitefoto") {
      const k = String(req.query.k || "");
      if (!["kalender", "viv"].includes(k)) throw httpErr(404, "Niet gevonden");
      const c = await leesCfg(sb), f = c.fotos[k];
      if (!f) throw httpErr(404, "Geen foto");
      const { data, error } = await sb.storage.from("documenten").download(f.pad);
      if (error || !data) throw httpErr(404, "Geen foto");
      const buf = Buffer.from(await data.arrayBuffer());
      res.setHeader("Content-Type", data.type || "image/jpeg");
      // de URL bevat de versie: een nieuwe foto krijgt een nieuwe URL
      res.setHeader("Cache-Control", String(req.query.v || "") === f.v ? "public, max-age=86400, s-maxage=31536000, immutable" : "public, max-age=60, s-maxage=60");
      return res.status(200).send(buf);
    }
    const basis = "https://" + String(req.headers.host || "vbha.be");
    if (req.method === "POST") {
      await requireUser(req, { write: true });
      let b = req.body || {}; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
      const huidig = await leesCfg(sb), c = schoon(b.cfg);
      // nieuwe (nog niet bewaarde) foto's toont het voorbeeld via een tijdelijke link
      for (const k of ["kalender", "viv"]) if (c.fotos[k] && (!huidig.fotos[k] || huidig.fotos[k].pad !== c.fotos[k].pad)) {
        const { data } = await sb.storage.from("documenten").createSignedUrl(c.fotos[k].pad, 600);
        if (data) c.fotos[k].tijdelijk = data.signedUrl;
      }
      let html = bouw(await sjabloon(req), c, basis);
      for (const k of ["kalender", "viv"]) if (c.fotos[k] && c.fotos[k].tijdelijk) html = html.replace(`src="/api/openbaar?f=sitefoto&k=${k}&v=${c.fotos[k].v}"`, `src="${esc(c.fotos[k].tijdelijk)}"`);
      html = html.replace("<head>", `<head><base href="${basis}/">`).replace("<body>", '<body><div style="position:sticky;top:0;z-index:99;background:#111;color:#fff;text-align:center;padding:8px;font:600 14px system-ui">Voorbeeld – nog niet gepubliceerd</div>');
      return res.status(200).json({ html });
    }
    let html;
    try { html = bouw(await sjabloon(req), await leesCfg(sb), basis); }
    catch (e) { console.error(e); html = bouw(await sjabloon(req), schoon({}), basis); }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=60, stale-while-revalidate=600");
    return res.status(200).send(html);
  } catch (e) { return sendError(res, e); }
}
