// Persoonlijke code achter de knoppen in mails: elke knop krijgt bij het versturen een eigen code per ontvanger
// (tabel mail_knoppen). Een klik gaat via /api/mail?f=klik&c=<code>, wordt bewaard (mail_kliks) en stuurt meteen door.
import crypto from "node:crypto";
import { admin } from "./sb.js";
import { site } from "./bevestiging.js";

const ontsnap = s => String(s).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const tekst = s => String(s || "").replace(/<[^>]+>/g, "").replace(/&rarr;|→/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().slice(0, 120);

// knoppen herkennen: Outlook-knop (v:roundrect) en de gewone knop (rood kader) uit knop() in de app en op de server
export async function knoppenVolgen(html, email, label) {
  if (!html || !email || !/v:roundrect|border:1\.5px solid/.test(html)) return html;
  const codes = new Map(), rijen = [];
  const code = (url, knop) => { const k = url + "|" + knop; if (!codes.has(k)) { const c = crypto.randomBytes(12).toString("base64url"); codes.set(k, c); rijen.push({ code: c, email: String(email).toLowerCase(), label: String(label || "").slice(0, 200), knop, url }); } return codes.get(k); };
  const basis = site() + "/api/mail?f=klik&c=";
  const ok = u => /^https?:\/\//i.test(u) && !/\/api\/mail\?f=klik/.test(u);
  let uit = html.replace(/(<v:roundrect\b[^>]*?\bhref=")([^"]+)("[^>]*>[\s\S]*?<center[^>]*>)([\s\S]*?)(<\/center>)/g, (m, a, u, b, t, e) => { const url = ontsnap(u); return ok(url) ? a + basis + code(url, tekst(t)) + b + t + e : m; });
  uit = uit.replace(/(<a href=")([^"]+)("[^>]*border:1\.5px solid[^>]*>)([\s\S]*?)(<\/a>)/g, (m, a, u, b, t, e) => { const url = ontsnap(u); return ok(url) ? a + basis + code(url, tekst(t)) + b + t + e : m; });
  if (!rijen.length) return html;
  try { const { error } = await admin().from("mail_knoppen").insert(rijen); if (error) throw error; } catch (e) { console.error("knoppen volgen", e.message); return html; }
  return uit;
}

export async function klikApi(req, res) {
  const c = String((req.query && req.query.c) || "");
  const sb = admin();
  let url = site();
  if (/^[\w-]{10,40}$/.test(c)) {
    const { data } = await sb.from("mail_knoppen").select("url").eq("code", c).maybeSingle();
    if (data && /^https?:\/\//i.test(data.url)) { url = data.url; try { await sb.from("mail_kliks").insert({ code: c }); } catch (e) { console.error("klik", e.message); } }
  }
  res.setHeader("Cache-Control", "no-store");
  res.statusCode = 302; res.setHeader("Location", url); return res.end();
}
