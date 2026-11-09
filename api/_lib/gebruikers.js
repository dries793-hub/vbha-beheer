import crypto from "node:crypto";
import { requireUser, httpErr, isAdminRol } from "./sb.js";
import { smtpConfigured, afzender, verstuur } from "./smtp.js";
import { huisstijl, knop } from "./bevestiging.js";

// Gebruikersbeheer (enkel voor een admin).
// GET                                           -> {gebruikers:[{id,email,naam,rol,laatst,tijdelijk,ik}], mail}
// POST {actie:"nieuw", email, naam, rol, mail}  -> {wachtwoord, gemaild}
// POST {actie:"wijzig", id, naam, rol}
// POST {actie:"reset", id, mail}                -> {wachtwoord, gemaild}
// POST {actie:"verwijder", id}
const ROLLEN = ["admin", "boekhouder", "lezer"];
const ROL_NAAM = { admin: "administrator", boekhouder: "boekhouding", lezer: "alleen lezen" };
const geldigMail = e => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(e);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Leesbaar tijdelijk wachtwoord, zonder tekens die je makkelijk verwart (0/O, 1/l/I).
function tijdelijkWachtwoord() {
  const A = "abcdefghjkmnpqrstuvwxyz", B = "ABCDEFGHJKMNPQRSTUVWXYZ", C = "23456789";
  const k = (set, n) => Array.from(crypto.randomBytes(n), x => set[x % set.length]).join("");
  return k(B, 1) + k(A, 4) + "-" + k(C, 4) + "-" + k(A + B, 3);
}
async function alleGebruikers(sb) {
  const out = [];
  for (let page = 1; page < 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    out.push(...data.users);
    if (data.users.length < 200) break;
  }
  return out;
}
export function welkomMail({ naam, email, rol, wachtwoord, url, reset }) {
  const groet = naam ? "Beste " + esc(String(naam).split(" ")[0]) + "," : "Hallo,";
  const html = huisstijl(`<p style="margin:0 0 15px">${groet}</p>
<p style="margin:0 0 15px">${reset ? "Er werd een nieuw tijdelijk wachtwoord voor je aangemaakt voor" : "Je hebt nu toegang tot"} de beheeromgeving van de Vriendenkring Brandweer Hoofdpost Aalst, met de rechten <b>${esc(ROL_NAAM[rol] || rol)}</b>.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 18px"><tr><td bgcolor="#fff9f9" style="padding:16px 20px;border-left:5px solid #C1A057;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#222222">
<p style="margin:0 0 5px"><b>Adres:</b> <a href="${esc(url)}" style="color:#b30000;text-decoration:underline">${esc(url.replace(/^https?:\/\//, ""))}</a></p>
<p style="margin:0 0 5px"><b>E-mailadres:</b> ${esc(email)}</p>
<p style="margin:0"><b>Tijdelijk wachtwoord:</b> <span style="font-family:Consolas,Menlo,monospace;font-size:16px">${esc(wachtwoord)}</span></p></td></tr></table>
<p style="margin:0 0 15px">Bij je eerste aanmelding kies je meteen je eigen wachtwoord. Het tijdelijke wachtwoord werkt daarna niet meer.</p>
${knop("Aanmelden", url)}
`, "Vriendenkring Brandweer Hoofdpost Aalst");
  return { aan: email, aanNaam: naam || "", onderwerp: reset ? "VBHA - Nieuw tijdelijk wachtwoord" : "VBHA - Je toegang tot de beheeromgeving", html };
}

export const FUNCTIES = ["leden", "punten", "overzicht", "financien", "facturen", "begroting", "historiek", "kassa", "kalenders", "kalverdeling", "fuif", "banket", "kinderfeest", "familiedag", "jaarmarkt", "agenda", "mails", "sponsors", "documenten", "website", "shiften", "fotos", "webshop"];
export async function gebruikers(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const { user, sb } = await requireUser(req, { write: true });
  // vaste adressen: de link in de welkomstmail mag niet afhangen van een (vervalsbare) Host-header
  const h = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim().toLowerCase();
  const url = "https://" + (/^(vbha-beheer\.vercel\.app|beheer\.vbha\.be)$/.test(h) ? h : "vbha-beheer.vercel.app");
  if (req.method === "GET") {
    const [{ data: rijen, error }, users] = await Promise.all([sb.from("bestuur").select("user_id,email,naam,rol,rechten,created_at"), alleGebruikers(sb)]);
    if (error) throw error;
    const U = new Map(users.map(u => [u.id, u]));
    const lijst = rijen.map(r => { const u = U.get(r.user_id) || {}; return { id: r.user_id, email: u.email || r.email, naam: r.naam || "", rol: r.rol === "bewerker" ? "admin" : r.rol, rechten: r.rechten || null, laatst: u.last_sign_in_at || null, tijdelijk: !!(u.user_metadata && u.user_metadata.tijdelijk), ik: r.user_id === user.id }; });
    lijst.sort((a, b) => ROLLEN.indexOf(a.rol) - ROLLEN.indexOf(b.rol) || (a.naam || a.email).localeCompare(b.naam || b.email, "nl"));
    return res.status(200).json({ gebruikers: lijst, mail: smtpConfigured() });
  }
  if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");
  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const rol = b.rol === undefined ? undefined : String(b.rol);
  if (rol !== undefined && !ROLLEN.includes(rol)) throw httpErr(400, "Onbekende rol.");
  const naam = b.naam === undefined ? undefined : String(b.naam).trim().slice(0, 80);
  const mailen = async m => { if (!b.mail || !smtpConfigured()) return false; const [r] = await verstuur([{ ...m, van: afzender() }]); return !!(r && r.ok); };
  const admins = async () => { const { data } = await sb.from("bestuur").select("user_id,rol"); return (data || []).filter(r => isAdminRol(r.rol)).map(r => r.user_id); };

  if (b.actie === "nieuw") {
    const email = String(b.email || "").trim().toLowerCase();
    if (!geldigMail(email)) throw httpErr(400, "Vul een geldig e-mailadres in.");
    if (!rol) throw httpErr(400, "Kies een rol.");
    const ww = tijdelijkWachtwoord();
    let id;
    const bestaand = (await alleGebruikers(sb)).find(u => String(u.email || "").toLowerCase() === email);
    if (bestaand) {
      id = bestaand.id;
      const { data: rij } = await sb.from("bestuur").select("user_id").eq("user_id", id).maybeSingle();
      if (rij) throw httpErr(409, "Deze persoon heeft al toegang.");
      const { error } = await sb.auth.admin.updateUserById(id, { password: ww, email_confirm: true, user_metadata: { ...(bestaand.user_metadata || {}), tijdelijk: true } });
      if (error) throw error;
    } else {
      const { data, error } = await sb.auth.admin.createUser({ email, password: ww, email_confirm: true, user_metadata: { tijdelijk: true, naam: naam || "" } });
      if (error) throw error;
      id = data.user.id;
    }
    const { error: e2 } = await sb.from("bestuur").upsert({ user_id: id, email, naam: naam || null, rol }, { onConflict: "user_id" });
    if (e2) throw e2;
    const gemaild = await mailen(welkomMail({ naam, email, rol, wachtwoord: ww, url }));
    return res.status(200).json({ id, wachtwoord: ww, gemaild });
  }
  const id = String(b.id || "");
  const { data: rij } = await sb.from("bestuur").select("user_id,email,naam,rol").eq("user_id", id).maybeSingle();
  if (!rij) throw httpErr(404, "Gebruiker niet gevonden.");
  if (b.actie === "wijzig") {
    if (rol && !isAdminRol(rol) && isAdminRol(rij.rol) && (await admins()).length <= 1) throw httpErr(400, "Er moet minstens één administrator blijven.");
    const upd = {}; if (rol) upd.rol = rol; if (naam !== undefined) upd.naam = naam || null;
    if (b.rechten !== undefined) {
      // null = volgens het profiel; anders per functie "geen", "lezen" of "bewerken"
      if (b.rechten === null) upd.rechten = null;
      else {
        const R = {}; for (const f of FUNCTIES) { const v = b.rechten && b.rechten[f]; R[f] = ["geen", "lezen", "bewerken"].includes(v) ? v : "geen"; }
        upd.rechten = R;
      }
    }
    const { error } = await sb.from("bestuur").update(upd).eq("user_id", id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  }
  if (b.actie === "reset") {
    const ww = tijdelijkWachtwoord();
    const { data: u } = await sb.auth.admin.getUserById(id);
    const { error } = await sb.auth.admin.updateUserById(id, { password: ww, user_metadata: { ...((u && u.user && u.user.user_metadata) || {}), tijdelijk: true } });
    if (error) throw error;
    const email = (u && u.user && u.user.email) || rij.email;
    const gemaild = await mailen(welkomMail({ naam: rij.naam, email, rol: rij.rol === "bewerker" ? "admin" : rij.rol, wachtwoord: ww, url, reset: true }));
    return res.status(200).json({ wachtwoord: ww, gemaild });
  }
  if (b.actie === "verwijder") {
    if (id === user.id) throw httpErr(400, "Je kan jezelf niet verwijderen.");
    if (isAdminRol(rij.rol) && (await admins()).length <= 1) throw httpErr(400, "Er moet minstens één administrator blijven.");
    const { error } = await sb.from("bestuur").delete().eq("user_id", id);
    if (error) throw error;
    await sb.auth.admin.deleteUser(id).catch(() => {});
    return res.status(200).json({ ok: true });
  }
  throw httpErr(400, "Onbekende actie.");
}
