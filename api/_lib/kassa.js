import crypto from "node:crypto";
import { admin, httpErr, sendError, requireUser } from "./sb.js";
import { body, configDoc, algemeen, rateLimit } from "./publiek.js";
import { onlineConfigured } from "./betaalprovider.js";

/* ============ Kassa (fuif, kinderfeest, jaarmarkt) ============
   Config "kassa": { actief: "fuif"|"kinderfeest"|"jaarmarkt", scan: true, code: {code, sinds},
                     activiteiten: { <act>: { tegels: [{id, naam, prijs, kleur, icoon, inkom}] } } }
   Tabel "kassa": één rij per verkoop
     data {activiteit, jaar, items:[{id, naam, prijs, aantal, inkom}], bedrag, betaalwijze: bancontact|cash, status: wacht|betaald|verlopen,
           aangemeld, betaaldOp, betaalToken, betaling, ontvangen (cash)}
   Openbaar: POST /api/kassa {actie, token, ...} met een kassacode (gastlogin, 1 dag geldig). */

export const ACTS = { fuif: "In Vier en Vlam", kinderfeest: "Kinderfeest", jaarmarkt: "Jaarmarkt" };
const tid = () => "t" + crypto.randomBytes(4).toString("hex");
export function standaardTegels(act, fuif) {
  if (act === "fuif") {
    const kp = Number(fuif && (fuif.kassaPrijs || fuif.prijs)) || 7, dr = (fuif && Array.isArray(fuif.drank) ? fuif.drank : [20, 50]).map(Number).filter(v => v > 0);
    return [{ id: "inkom", naam: "Inkom", prijs: kp, kleur: "rood", icoon: "ticket", inkom: true }, ...dr.map(v => ({ id: "d" + v, naam: "Drankkaart €" + v, prijs: v, kleur: "goud", icoon: "bier" }))];
  }
  if (act === "kinderfeest") return [{ id: tid(), naam: "Frisdrank", prijs: 1.5, kleur: "blauw", icoon: "frisdrank" }, { id: tid(), naam: "Koffie", prijs: 1.5, kleur: "bruin", icoon: "koffie" }, { id: tid(), naam: "Taart", prijs: 2, kleur: "roze", icoon: "taart" }];
  return [{ id: tid(), naam: "Bier", prijs: 2.5, kleur: "goud", icoon: "bier" }, { id: tid(), naam: "Frisdrank", prijs: 2, kleur: "blauw", icoon: "frisdrank" }, { id: tid(), naam: "Koffie", prijs: 2, kleur: "bruin", icoon: "koffie" }];
}
export async function kassaCfg(sb) {
  const [k, f, A] = await Promise.all([configDoc(sb, "kassa"), configDoc(sb, "fuif"), algemeen(sb)]);
  const actief = ACTS[k.actief] ? k.actief : "fuif";
  const code = k.code && k.code.code ? k.code : (f.kassa && f.kassa.code ? f.kassa : null); // oude kassacode van de fuif
  const acts = k.activiteiten || {};
  const tegels = (Array.isArray(acts[actief] && acts[actief].tegels) ? acts[actief].tegels : standaardTegels(actief, f))
    .map(t => ({ id: String(t.id), naam: String(t.naam || "").slice(0, 40), prijs: Math.round(Math.max(0, Number(t.prijs) || 0) * 100) / 100, kleur: t.kleur || "grijs", icoon: t.icoon || "", inkom: !!t.inkom })).filter(t => t.naam && t.prijs > 0);
  const jaar = actief === "fuif" ? (Number(String(f.datum || "").slice(0, 4)) || A.jaar) : A.jaar;
  return { k, actief, naam: actief === "fuif" ? (f.naam || ACTS.fuif) : ACTS[actief], tegels, scan: k.scan !== false && actief === "fuif", code, jaar };
}
// kassacode: 1 dag (24 uur) geldig vanaf het aanmaken
const sleutel = () => String(process.env.BETAAL_GEHEIM || process.env.SUPABASE_SERVICE_ROLE_KEY || "");
const sig = (exp, code) => crypto.createHmac("sha256", sleutel()).update(`vbha-kassa|${exp}|${String(code).toUpperCase()}`).digest("base64url").slice(0, 32);
export const codeTot = code => code && code.code ? (Date.parse(code.sinds || "") || 0) + 24 * 3600 * 1000 : 0;
function tokenOk(K, token) {
  const code = K.code && K.code.code; if (!code || !sleutel() || Date.now() > codeTot(K.code)) return false;
  const [exp, s] = String(token || "").split("."); if (!/^\d{10,13}$/.test(exp || "") || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sig(exp, code)), b = Buffer.from(String(s || "")); return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const rond = n => Math.round(n * 100) / 100;
async function haal(sb, id) { const { data } = await sb.from("kassa").select("id,data").eq("id", String(id || "")).maybeSingle(); return data; }
async function totalen(sb, act, jaar) {
  const out = []; for (let from = 0; ; from += 1000) { const { data, error } = await sb.from("kassa").select("data").eq("data->>activiteit", act).eq("data->>jaar", String(jaar)).eq("data->>status", "betaald").range(from, from + 999); if (error) throw error; out.push(...data); if (data.length < 1000) break; }
  const per = {}; let bc = 0, cash = 0;
  for (const { data: d } of out) { for (const i of d.items || []) per[i.naam] = (per[i.naam] || 0) + (Number(i.aantal) || 0); if (d.betaalwijze === "cash") cash += Number(d.bedrag) || 0; else bc += Number(d.bedrag) || 0; }
  return { verkopen: out.length, per, bancontact: rond(bc), cash: rond(cash) };
}

/* ---------- openbaar: /api/kassa ---------- */
export default async function kassaPubliek(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") throw httpErr(405, "Gebruik POST");
    const sb = admin(), b = body(req), K = await kassaCfg(sb);
    if (b.actie === "login") {
      await rateLimit(sb, req, "kassalogin", 10, 900, httpErr);
      const code = K.code && K.code.code, inv = String(b.code || "").trim().toUpperCase().replace(/\s+/g, "");
      const a = Buffer.from(String(code || "").toUpperCase()), x = Buffer.from(inv);
      if (!code || a.length !== x.length || !crypto.timingSafeEqual(a, x)) throw httpErr(403, "Deze kassacode klopt niet.");
      if (Date.now() > codeTot(K.code)) throw httpErr(403, "Deze kassacode is verlopen (een code is 1 dag geldig). Vraag een nieuwe code aan het bestuur.");
      const exp = String(Math.min(Date.now() + 24 * 3600 * 1000, codeTot(K.code)));
      return res.status(200).json({ ok: true, token: exp + "." + sig(exp, code), tot: Number(exp) });
    }
    if (!tokenOk(K, b.token)) throw httpErr(401, "Je kassatoegang is verlopen. Geef een geldige kassacode in.");
    await rateLimit(sb, req, "kassa", 900, 600, httpErr);
    if (b.actie === "stand") {
      let fuif = null;
      if (K.actief === "fuif") { const { fuifStand } = await import("./fuif.js"); fuif = await fuifStand(sb, K.jaar); }
      return res.status(200).json({ ok: true, activiteit: K.actief, naam: K.naam, tegels: K.tegels, scan: K.scan, online: onlineConfigured(), jaar: K.jaar, totalen: await totalen(sb, K.actief, K.jaar), fuif });
    }
    if (b.actie === "scan") { if (!K.scan) throw httpErr(403, "Scannen staat uit."); const { scanTicket } = await import("./fuif.js"); return res.status(200).json(await scanTicket(sb, b.code, "kassa (gast)", false)); }
    if (b.actie === "verkoop") {
      const want = b.items || {}, cash = b.betaalwijze === "cash";
      const items = K.tegels.map(t => ({ id: t.id, naam: t.naam, prijs: t.prijs, aantal: Math.max(0, Math.min(200, Math.floor(Number(want[t.id])) || 0)), ...(t.inkom ? { inkom: true } : {}) })).filter(i => i.aantal);
      if (!items.length) throw httpErr(400, "Kies minstens één item.");
      const bedrag = rond(items.reduce((n, i) => n + i.aantal * i.prijs, 0));
      if (b.bedrag != null && Math.abs(Number(b.bedrag) - bedrag) > 0.001) throw httpErr(409, "De prijzen werden intussen aangepast. Herlaad de kassa.");
      const id = "k" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex"), token = crypto.randomBytes(18).toString("base64url"), nu = new Date().toISOString();
      const row = { id, data: { activiteit: K.actief, jaar: K.jaar, items, bedrag, betaalwijze: cash ? "cash" : "bancontact", status: cash ? "betaald" : "wacht", aangemeld: nu, betaalToken: token, ...(cash ? { betaaldOp: nu, ontvangen: Number(b.ontvangen) || null } : {}) } };
      if (!cash && !onlineConfigured()) throw httpErr(501, "Bancontact is niet ingesteld.");
      const { error } = await sb.from("kassa").insert(row); if (error) throw error;
      if (cash) return res.status(200).json({ ok: true, id, bedrag, status: "SUCCEEDED" });
      const { startBetaling } = await import("./betaal.js");
      let bt; try { bt = await startBetaling(sb, req, "kassa", row, { bedrag, jaar: K.jaar, terug: "/kassa" }); }
      catch (e) { console.error("kassa betaling", e); await sb.from("kassa").delete().eq("id", id); throw httpErr(502, "De betaling kon niet gestart worden. Probeer opnieuw."); }
      return res.status(200).json({ ok: true, id, bedrag, deeplink: bt.deeplink, qrcode: bt.qrcode, checkout: bt.checkout, verlooptOp: bt.verlooptOp });
    }
    const row = await haal(sb, b.id); if (!row) throw httpErr(404, "Verkoop niet gevonden.");
    if (b.actie === "status") {
      if (row.data.status === "betaald") return res.status(200).json({ ok: true, status: "SUCCEEDED" });
      const { controleerBetaling } = await import("./betaal.js"); const st = await controleerBetaling(sb, "kassa", row);
      return res.status(200).json({ ok: true, status: st && st.status });
    }
    if (b.actie === "stop") { if (row.data.status === "wacht") await sb.from("kassa").update({ data: { ...row.data, status: "verlopen", gestopt: new Date().toISOString() } }).eq("id", row.id).eq("data->>status", "wacht"); return res.status(200).json({ ok: true }); }
    if (b.actie === "nieuweqr") {
      if (row.data.status !== "wacht") throw httpErr(409, "Deze verkoop is afgesloten.");
      const { startBetaling } = await import("./betaal.js"); const bt = await startBetaling(sb, req, "kassa", row, { bedrag: row.data.bedrag, jaar: row.data.jaar, terug: "/kassa" });
      return res.status(200).json({ ok: true, deeplink: bt.deeplink, qrcode: bt.qrcode, checkout: bt.checkout, verlooptOp: bt.verlooptOp });
    }
    throw httpErr(400, "Onbekende actie.");
  } catch (e) { sendError(res, e); }
}

// na een gelukte Bancontact-betaling (vanuit controleerBetaling / callback)
export async function kassaBetaald(sb, id) {
  const row = await haal(sb, id); if (!row || row.data.status === "betaald") return;
  await sb.from("kassa").update({ data: { ...row.data, status: "betaald", betaaldOp: (row.data.betaling && row.data.betaling.betaaldOp) || new Date().toISOString() } }).eq("id", id).in("data->>status", ["wacht", "verlopen"]);
}
// geplande taak: lopende betalingen nakijken, oude op "verlopen"
export async function kassaCron(sb) {
  const { data } = await sb.from("kassa").select("id,data").eq("data->>status", "wacht").limit(40);
  const { controleerBetaling } = await import("./betaal.js"); let n = 0;
  for (const r of data || []) {
    try { const st = r.data.betaling && r.data.betaling.id ? await controleerBetaling(sb, "kassa", r) : null;
      if (st && st.status === "SUCCEEDED") { await kassaBetaald(sb, r.id); n++; continue; }
      if (Date.now() - Date.parse(r.data.aangemeld || 0) > 30 * 60000) await sb.from("kassa").update({ data: { ...r.data, status: "verlopen" } }).eq("id", r.id).eq("data->>status", "wacht");
    } catch (e) { console.error("kassa cron", e); }
  }
  return { betaald: n };
}
// app (admin): POST /api/mail?f=kassa {actie:"wis", id}
export async function kassaApi(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const { sb, rol } = await requireUser(req, { write: true }), b = body(req);
  if (b.actie === "wis") {
    if (!["admin", "bewerker"].includes(rol)) throw httpErr(403, "Enkel een administrator kan transacties wissen.");
    const { error } = await sb.from("kassa").delete().eq("id", String(b.id || "")); if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  if (b.actie === "controle") { const row = await haal(sb, b.id); if (!row) throw httpErr(404, "Niet gevonden."); const { controleerBetaling } = await import("./betaal.js"); const st = await controleerBetaling(sb, "kassa", row); return res.status(200).json({ ok: true, status: st && st.status }); }
  throw httpErr(400, "Onbekende actie.");
}
