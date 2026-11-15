// Statistieken: bezoek aan de openbare website (eigen teller, zonder cookies of IP-adres) en cijfers van Facebook en Instagram.
// - telApi (openbaar, /api/tel): één paginaweergave tellen per dag, pagina, bron en soort toestel (tabel site_bezoek).
// - statsApi (/api/mail?f=stats): overzicht voor de app.
import { admin, requireUser, httpErr, isAdminRol, isDbCron } from "./sb.js";

const PADEN = ["/", "/shop", "/steun", "/kalender", "/fuif", "/familiedag", "/kinderfeest", "/banket", "/album", "/inschrijven", "/sponsor", "/privacy", "/reglement", "/lidgeld"];
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch/i;

function bronVan(ref, q) {
  q = String(q || "").toLowerCase();
  if (/^(fb|facebook)/.test(q)) return "Facebook";
  if (/^(ig|instagram)/.test(q)) return "Instagram";
  if (/^(mail|e-?mail|nieuwsbrief)/.test(q)) return "Mail";
  if (/^(qr|flyer|affiche)/.test(q)) return "QR-code";
  let h = ""; try { h = new URL(String(ref || "")).hostname.replace(/^www\./, "").toLowerCase(); } catch {}
  if (!h) return "Rechtstreeks";
  if (/(^|\.)vbha\.be$|vercel\.app$/.test(h)) return "Rechtstreeks";
  if (/facebook\.com$|fb\.com$|fb\.me$|messenger\.com$/.test(h)) return "Facebook";
  if (/instagram\.com$/.test(h)) return "Instagram";
  if (/(^|\.)google\./.test(h)) return "Google";
  if (/bing\.com$|duckduckgo\.com$|ecosia\.org$|yahoo\./.test(h)) return "Andere zoekmachine";
  if (/mail|outlook|gmail|telenet|skynet|proximus/.test(h)) return "Mail";
  if (/whatsapp|wa\.me|t\.co$|twitter|x\.com$|linkedin|tiktok/.test(h)) return "Andere sociale media";
  return h.slice(0, 40);
}

export async function telApi(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(204).end();
  const ua = String(req.headers["user-agent"] || "");
  if (!ua || BOT.test(ua)) return res.status(204).end();
  let b = req.body || {}; if (typeof b === "string") { try { b = JSON.parse(b.slice(0, 2000)); } catch { b = {}; } }
  let p = String(b.p || "/").split(/[?#]/)[0].replace(/\.html$/, "").replace(/\/+$/, "") || "/";
  if (!PADEN.includes(p)) p = "andere";
  const toestel = /mobi|android|iphone|ipod/i.test(ua) ? "gsm" : /ipad|tablet/i.test(ua) ? "tablet" : "computer";
  try { await admin().rpc("site_tel", { p_pad: p, p_bron: bronVan(b.r, b.q), p_toestel: toestel, p_nieuw: !!b.n }); } catch {}
  return res.status(204).end();
}

/* ---------- Meta (Facebook + Instagram) ---------- */
const GRAPH = "https://graph.facebook.com/v21.0";
const env = k => String(process.env[k] || "").trim();
async function g(pad, params = {}) {
  const q = new URLSearchParams({ ...params, access_token: env("META_PAGE_TOKEN") });
  const r = await fetch(`${GRAPH}/${pad}?${q}`); const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(((j.error && j.error.message) || "Meta gaf een fout (" + r.status + ")").slice(0, 200));
  return j;
}
const probeer = async f => { try { return await f(); } catch (e) { return { fout: e.message }; } };
const som = j => (j && j.data && j.data[0] && (j.data[0].values || []).reduce((a, v) => a + (typeof v.value === "number" ? v.value : 0), 0)) ?? null;
const totaal = j => (j && j.data ? Object.fromEntries(j.data.map(m => [m.name, m.total_value ? m.total_value.value : som({ data: [m] })])) : {});

async function facebook(ids) {
  const id = env("META_PAGE_ID"); if (!id || !env("META_PAGE_TOKEN")) return null;
  const uit = { kanaal: "facebook" };
  const p = await probeer(() => g(id, { fields: "name,followers_count,fan_count,link" }));
  if (p.fout) return { ...uit, fout: p.fout };
  Object.assign(uit, { naam: p.name, volgers: p.followers_count ?? p.fan_count ?? null, fans: p.fan_count ?? null, link: "https://www.facebook.com/vbha.aalst" });
  const until = Math.floor(Date.now() / 1000), since = until - 28 * 86400;
  uit.metriek = {}; uit.metriekFout = {};
  // Meta schrapte eind 2025 een deel van de paginacijfers: per cijfer de nieuwe naam eerst, dan de oude
  const M = { bereik: ["page_total_media_view_unique", "page_impressions_unique"], weergaven: ["page_media_view", "page_impressions"], interacties: ["page_post_engagements"], bezoeken: ["page_views_total"], nieuweVolgers: ["page_daily_follows_unique", "page_follows"] };
  for (const [k, namen] of Object.entries(M)) for (const m of namen) {
    const j = await probeer(() => g(`${id}/insights`, { metric: m, period: "day", since, until }));
    if (j.fout) { uit.metriekFout[k] = m + ": " + j.fout; continue; }
    if (j.data && j.data.length) { uit.metriek[k] = som(j); delete uit.metriekFout[k]; break; }
    uit.metriekFout[k] = m + ": geen gegevens";
  }
  const F = "message,created_time,permalink_url,full_picture,shares,reactions.summary(true).limit(0),comments.summary(true).limit(0)";
  let P = await probeer(() => g(`${id}/published_posts`, { fields: F, limit: 8 }));
  if (P.fout && ids && ids.length) { // zonder leesrecht op de tijdlijn: de posts die de app zelf plaatste, één voor één
    const L = []; for (const pid of ids.slice(0, 8)) { const x = await probeer(() => g(pid, { fields: F })); if (!x.fout) L.push(x); else if (!L.length && pid === ids[0]) { L.fout = x.fout; } }
    if (L.length) P = { data: L }; else P = { fout: L.fout || P.fout };
  }
  uit.posts = P.fout ? [] : (P.data || []).map(x => ({ tekst: String(x.message || "").slice(0, 140), op: x.created_time, url: x.permalink_url, foto: x.full_picture || "",
    reacties: x.reactions && x.reactions.summary ? x.reactions.summary.total_count : null, commentaren: x.comments && x.comments.summary ? x.comments.summary.total_count : null, gedeeld: x.shares ? x.shares.count : 0 }));
  if (P.fout) uit.postsFout = P.fout;
  return uit;
}

async function instagram() {
  const id = env("META_IG_USER_ID"); if (!id || !env("META_PAGE_TOKEN")) return null;
  const uit = { kanaal: "instagram" };
  const p = await probeer(() => g(id, { fields: "username,followers_count,media_count" }));
  if (p.fout) return { ...uit, fout: p.fout };
  Object.assign(uit, { naam: p.username, volgers: p.followers_count ?? null, berichten: p.media_count ?? null, link: "https://www.instagram.com/" + (p.username || "vbha.aalst") });
  const until = Math.floor(Date.now() / 1000), since = until - 28 * 86400;
  const j = await probeer(() => g(`${id}/insights`, { metric: "reach,profile_views,accounts_engaged,total_interactions", period: "day", metric_type: "total_value", since, until }));
  uit.metriek = j.fout ? {} : totaal(j); uit.metriekFout = {};
  if (j.fout) { const r = await probeer(() => g(`${id}/insights`, { metric: "reach", period: "day", since, until })); if (!r.fout) uit.metriek.reach = som(r); else uit.metriekFout.alles = r.fout; }
  const M = await probeer(() => g(`${id}/media`, { fields: "caption,timestamp,permalink,like_count,comments_count,media_type,media_url,thumbnail_url", limit: 8 }));
  uit.posts = M.fout ? [] : (M.data || []).map(x => ({ tekst: String(x.caption || "").slice(0, 140), op: x.timestamp, url: x.permalink, foto: x.media_type === "VIDEO" ? x.thumbnail_url || "" : x.media_url || "",
    reacties: x.like_count ?? null, commentaren: x.comments_count ?? null }));
  if (M.fout) uit.postsFout = M.fout;
  return uit;
}

export async function statsApi(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") throw httpErr(405, "Gebruik POST");
  if (!(await isDbCron(req))) { // geplande taak (sleutel) mag ook: volgers dagelijks bijhouden
    const { rol, rechten } = await requireUser(req);
    if (!isAdminRol(rol) && rechten && rechten.statistieken === "geen") throw httpErr(403, "Geen toegang");
  }
  let b = req.body || {}; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  const sb = admin(), dagen = Math.min(400, Math.max(7, Number(b.dagen) || 30));
  const van = new Date(Date.now() - (dagen * 2) * 864e5).toISOString().slice(0, 10); // dubbele periode: vergelijking met de periode ervoor
  const rijen = [];
  for (let s = 0; ; s += 1000) { const { data, error } = await sb.from("site_bezoek").select("dag,pad,bron,toestel,weergaven,bezoeken").gte("dag", van).range(s, s + 999); if (error) throw error; rijen.push(...data); if (data.length < 1000) break; }
  const { data: eerste } = await sb.from("site_bezoek").select("dag").order("dag").limit(1);
  let social = [];
  if (b.social !== false) {
    const { data: eigen } = await sb.from("social_posts").select("data,gewijzigd").in("status", ["gepubliceerd", "deels"]).order("gewijzigd", { ascending: false }).limit(12);
    const fbIds = (eigen || []).map(r => r.data && r.data.resultaten && r.data.resultaten.facebook && r.data.resultaten.facebook.ok && r.data.resultaten.facebook.id).filter(Boolean);
    social = (await Promise.all([facebook(fbIds), instagram()])).filter(Boolean);
    const dag = new Date().toISOString().slice(0, 10);
    const st = social.filter(s => typeof s.volgers === "number").map(s => ({ dag, kanaal: s.kanaal, volgers: s.volgers }));
    if (st.length) await sb.from("social_stand").upsert(st);
  }
  const { data: stand } = await sb.from("social_stand").select("dag,kanaal,volgers").gte("dag", new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10)).order("dag");
  return res.status(200).json({ rijen, sinds: eerste && eerste[0] ? eerste[0].dag : null, social, stand: stand || [] });
}
