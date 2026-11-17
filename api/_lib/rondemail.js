// Kalenderronde: mail naar het lid zodra het bestuur zijn reservatie (melding via de openbare kaart) goedkeurt.
// De app stuurt de straatnamen, adressen en dozen mee (de stratenlijst zit enkel in de app); het adres komt uit de ledenlijst.
import { admin, requireUser, httpErr } from "./sb.js";
import { huisstijl, kaderBlok, knop, p, esc, site } from "./bevestiging.js";
import { algemeen } from "./publiek.js";
import { verstuur } from "./smtp.js";
import { tekenRonde } from "./lidlink.js";

export async function rondeMailApi(req, res) {
  if (req.method !== "POST") throw httpErr(405, "Gebruik POST");
  await requireUser(req, { write: true, functie: "ronde" });
  let b = req.body || {}; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  const sb = admin(), ids = [...new Set((Array.isArray(b.ids) ? b.ids : [b.id]).map(String).filter(Boolean))].slice(0, 30);
  if (!ids.length) throw httpErr(400, "Geen melding");
  const { data: M } = await sb.from("rondemeldingen").select("id,data").in("id", ids);
  if (!M || M.length !== ids.length) throw httpErr(404, "Melding niet gevonden");
  if (M.some(r => (r.data || {}).stand !== "goedgekeurd")) throw httpErr(400, "Melding is niet goedgekeurd");
  if (new Set(M.map(r => r.data.lidId || "")).size !== 1) throw httpErr(400, "Meldingen van verschillende personen");
  if (M.every(r => r.data.mail && r.data.mail.op)) return res.status(200).json({ ok: true, al: true });
  const d = M[0].data;
  if (d.soort === "done") return res.status(200).json({ ok: true, overgeslagen: "bedeeld" });
  const { data: l } = d.lidId ? await sb.from("leden").select("data").eq("id", d.lidId).maybeSingle() : { data: null };
  const lid = (l && l.data) || {}, email = String(lid.email || "").trim();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email)) return res.status(200).json({ ok: false, reden: "geen e-mailadres" });
  const S = (Array.isArray(b.straten) ? b.straten : []).slice(0, 80).map(x => ({ naam: String(x.naam || "").slice(0, 120), a: Math.max(0, Math.round(Number(x.adressen) || 0)) })).filter(x => x.naam);
  const tot = S.reduce((t, x) => t + x.a, 0), doz = Math.max(0, Math.round(Number(b.dozen) || 0)), A = await algemeen(sb).catch(() => ({}));
  const html = huisstijl(
    p(`Beste ${esc(lid.voornaam || "lid")},`)
    + p(`Je reservatie voor de kalenderronde is goedgekeurd. Deze ${S.length === 1 ? "straat staat" : "straten staan"} nu op jouw naam:`)
    + kaderBlok("Jouw straten", S.map(x => p(`<b>${esc(x.naam)}</b> · ${x.a} ${x.a === 1 ? "adres" : "adressen"}`, "margin:0 0 6px")).join(""))
    + p(`Samen zijn dat <b>± ${tot} adressen</b>. Voorzie <b>${doz} ${doz === 1 ? "doos" : "dozen"}</b> kalenders.`)
    + p("Bedankt om mee te helpen met de kalenderronde!")
    + knop("Bekijk de kaart", site() + (d.lidId && A.jaar ? `/kaart?k=${encodeURIComponent(d.lidId)}&j=${A.jaar}&t=${tekenRonde(d.lidId, A.jaar)}` : "/kaart")),
    A.vereniging || "Vriendenkring Brandweer Hoofdpost Aalst");
  const [r] = await verstuur([{ aan: email, aanNaam: `${lid.voornaam || ""} ${lid.naam || ""}`.trim(), onderwerp: "Je straten voor de kalenderronde zijn gereserveerd", html, label: "Reservatie kalenderronde" }]);
  if (r && r.ok) for (const x of M) await sb.from("rondemeldingen").update({ data: { ...x.data, mail: { op: new Date().toISOString(), aan: email } } }).eq("id", x.id);
  return res.status(200).json({ ok: !!(r && r.ok), fout: r && r.fout });
}
