import crypto from "node:crypto";

// Ondertekende betaallink voor het lidgeld van een bestaand lid: /lidgeld?l=<lidId>&j=<jaar>&b=<bedrag>&t=<handtekening>
// Alleen de server kent de sleutel, dus niemand kan zelf een link (of een ander bedrag) maken.
const sleutel = () => String(process.env.BETAAL_GEHEIM || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
export function teken(l, j, b) {
  return crypto.createHmac("sha256", sleutel()).update(`vbha-lidgeld|${l}|${j}|${Number(b).toFixed(2)}`).digest("base64url").slice(0, 22);
}
export function klopt(l, j, b, t) {
  if (!sleutel() || !l || !/^\d{4}$/.test(String(j)) || !(Number(b) > 0) || typeof t !== "string") return false;
  const a = Buffer.from(teken(l, j, b)), c = Buffer.from(t);
  return a.length === c.length && crypto.timingSafeEqual(a, c);
}
// Ondertekende link "status opvragen": /status?l=<lidId>&j=<jaar>&t=<handtekening>
export function tekenStatus(l, j) { return crypto.createHmac("sha256", sleutel()).update(`vbha-status|${l}|${j}`).digest("base64url").slice(0, 22); }
export function kloptStatus(l, j, t) {
  if (!sleutel() || !l || !/^\d{4}$/.test(String(j)) || typeof t !== "string") return false;
  const a = Buffer.from(tekenStatus(l, j)), c = Buffer.from(t);
  return a.length === c.length && crypto.timingSafeEqual(a, c);
}
// Ondertekende link "straten van vorig jaar opnieuw reserveren": /kaart?l=<lidId>&j=<jaar>&t=<handtekening>
export function tekenRonde(l, j) { return crypto.createHmac("sha256", sleutel()).update(`vbha-ronde|${l}|${j}`).digest("base64url").slice(0, 22); }
export function kloptRonde(l, j, t) {
  if (!sleutel() || !l || !/^\d{4}$/.test(String(j)) || typeof t !== "string") return false;
  const a = Buffer.from(tekenRonde(l, j)), c = Buffer.from(t);
  return a.length === c.length && crypto.timingSafeEqual(a, c);
}
// Vervangt in een mail elke "/lidgeld?l=..&j=..&b=..&t=@@SIG@@" door de echte handtekening.
export function ondertekenLinks(html) {
  return String(html).replace(/\/lidgeld\?l=([^&"'\s<>]+)&(amp;)?j=(\d{4})&(amp;)?b=([\d.]+)&(amp;)?t=@@SIG@@/g,
    (m, l, a1, j, a2, b, a3) => m.replace("@@SIG@@", teken(decodeURIComponent(l), j, b)))
    .replace(/\/status\?l=([^&"'\s<>]+)&(amp;)?j=(\d{4})&(amp;)?t=@@SIG@@/g, (m, l, a1, j) => m.replace("@@SIG@@", tekenStatus(decodeURIComponent(l), j)))
    .replace(/\/kaart\?l=([^&"'\s<>]+)&(amp;)?j=(\d{4})&(amp;)?t=@@SIG@@/g, (m, l, a1, j) => m.replace("@@SIG@@", tekenRonde(decodeURIComponent(l), j)));
}
