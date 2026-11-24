// Kalenderronde: mail naar het lid zodra het bestuur zijn reservatie (melding via de openbare kaart) goedkeurt.
// De app stuurt de straatnamen, adressen en dozen mee (de stratenlijst zit enkel in de app); het adres komt uit de ledenlijst.
import { admin, requireUser, httpErr } from "./sb.js";
import { huisstijl, kaderBlok, knop, p, esc, site } from "./bevestiging.js";
import { algemeen } from "./publiek.js";
import { verstuur, smtpConfigured } from "./smtp.js";
import { tekenRonde } from "./lidlink.js";
import { registreer, sysMail } from "./sjabloon.js";

registreer({ key: "ronde-reservatie", naam: "Kalenderronde: reservatie bevestigd", wanneer: "Na een reservatie van straten op de openbare kaart. De server wacht 15 minuten na de laatste reservatie, zodat alle straten die het lid kort na elkaar koos in één mail staan.",
  onderwerp: "Je straten voor de kalenderronde zijn gereserveerd",
  body: p("Dag {voornaam}!") + p("Bedankt voor je reservatie voor de kalenderronde. {als:een}Deze straat staat{/als:een}{niet:een}Deze straten staan{/niet:een} nu op jouw naam:")
    + kaderBlok("Jouw straten", "{straten}") + p("Samen zijn dat <b>± {adressen} adressen</b>. Voorzie <b>{dozen}</b> kalenders.") + p("Bedankt om mee te helpen met de kalenderronde!") + "<p>{knop_kaart}</p>",
  velden: [["voornaam", "Voornaam"], ["straten", "Lijst met de straten"], ["aantal_straten", "Aantal straten"], ["adressen", "Aantal adressen"], ["dozen", "Aantal dozen (bv. 3 dozen)"], ["link_kaart", "Persoonlijke link naar de kaart"], ["knop_kaart", "Knop naar de kaart"], ["een", "Voorwaarde: één straat"]],
  voorbeeld: { voornaam: "Jan", aantal_straten: "2", adressen: "170", dozen: "2 dozen", link_kaart: "https://vbha.be/kaart", een: "" } });

/* Reservaties via de openbare kaart (ronde-rijen met "bron", nog zonder "mailOp"): één mail per lid met alle straten,
   pas 15 minuten na zijn laatste reservatie (wie straat per straat reserveert, krijgt dus maar één mail).
   Wordt elke minuut aangeroepen door de geplande taak van de mailwachtrij. */
const WACHT = 15 * 60000;
export async function reservatieMails(sb) {
  const A = await algemeen(sb).catch(() => ({})); if (!A.jaar) return { n: 0 };
  const { data: R, error } = await sb.from("ronde").select("id,data").eq("data->>jaar", String(A.jaar)).eq("data->>status", "reserved").not("data->bron", "is", null).is("data->mailOp", null).limit(500);
  if (error) throw error;
  const G = new Map(); for (const r of R || []) { const d = r.data || {}; if (!d.lidId) continue; if (!G.has(d.lidId)) G.set(d.lidId, []); G.get(d.lidId).push(r); }
  const nu = Date.now(), uit = [];
  const ADR = (await import("./kr_adressen.js")).default, NM = (await import("./kr_namen.js")).default;
  const { data: J } = await sb.from("jaren").select("data").eq("id", String(A.jaar)).maybeSingle(); const per = Number(J?.data?.perDoos) || 100;
  for (const [lidId, rs] of G) {
    const laatst = Math.max(...rs.map(r => Date.parse(r.data.at || "") || 0)); if (nu - laatst < WACHT) continue; // nog even wachten: misschien reserveert het lid nog straten
    const merk = async extra => { for (const r of rs) await sb.from("ronde").update({ data: { ...r.data, mailOp: new Date().toISOString(), ...extra } }).eq("id", r.id).is("data->mailOp", null); };
    if (!smtpConfigured()) { await merk({ mailNiet: "testomgeving" }); continue; }
    const { data: l } = await sb.from("leden").select("data").eq("id", lidId).maybeSingle();
    const lid = (l && l.data) || {}, email = String(lid.email || "").trim();
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(email)) { await merk({ mailNiet: "geen e-mailadres" }); continue; }
    await merk({}); // eerst markeren: nooit twee mails voor dezelfde reservatie
    const per1 = new Map(); for (const r of rs) { const id = String(r.data.straat || ""), sid = id.split("~")[0], k = NM[sid] || sid; per1.set(k, { deel: (per1.get(k)?.deel) || id.includes("~"), a: (per1.get(k)?.a || 0) + (Number(ADR[id]) || 0) }); }
    const S = [...per1].map(([naam, x]) => ({ naam: naam + (x.deel ? " (deel)" : ""), a: x.a })).sort((a, b) => a.naam.localeCompare(b.naam, "nl"));
    const tot = S.reduce((t, x) => t + x.a, 0), doz = Math.max(1, Math.ceil(tot / per));
    const kaartLink = site() + `/kaart?k=${encodeURIComponent(lidId)}&j=${A.jaar}&t=${tekenRonde(lidId, A.jaar)}`;
    const m = await sysMail(sb, "ronde-reservatie", { voornaam: esc(lid.voornaam || "lid"), een: S.length === 1, aantal_straten: S.length,
      straten: S.map(x => p(`<b>${esc(x.naam)}</b> · ${x.a} ${x.a === 1 ? "adres" : "adressen"}`, "margin:0 0 6px")).join(""), adressen: tot, dozen: `${doz} ${doz === 1 ? "doos" : "dozen"}`,
      link_kaart: esc(kaartLink), knop_kaart: knop("Bekijk de kaart", kaartLink) });
    const html = huisstijl(m.html, A.vereniging || "Vriendenkring Brandweer Hoofdpost Aalst");
    const [r] = await verstuur([{ aan: email, aanNaam: `${lid.voornaam || ""} ${lid.naam || ""}`.trim(), onderwerp: m.onderwerp, html, label: "Reservatie kalenderronde" }]);
    uit.push({ ok: !!(r && r.ok), straten: S.length });
    if (!(r && r.ok)) for (const x of rs) { const { data: c } = await sb.from("ronde").select("data").eq("id", x.id).maybeSingle(); if (c) await sb.from("ronde").update({ data: { ...c.data, mailFout: String(r && r.fout || "mislukt").slice(0, 200) } }).eq("id", x.id); }
  }
  return { n: uit.length };
}

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
  const kaartLink = site() + (d.lidId && A.jaar ? `/kaart?k=${encodeURIComponent(d.lidId)}&j=${A.jaar}&t=${tekenRonde(d.lidId, A.jaar)}` : "/kaart");
  const m = await sysMail(sb, "ronde-reservatie", { voornaam: esc(lid.voornaam || "lid"), een: S.length === 1, aantal_straten: S.length,
    straten: S.map(x => p(`<b>${esc(x.naam)}</b> · ${x.a} ${x.a === 1 ? "adres" : "adressen"}`, "margin:0 0 6px")).join(""), adressen: tot, dozen: `${doz} ${doz === 1 ? "doos" : "dozen"}`,
    link_kaart: esc(kaartLink), knop_kaart: knop("Bekijk de kaart", kaartLink) });
  const html = huisstijl(m.html, A.vereniging || "Vriendenkring Brandweer Hoofdpost Aalst");
  const [r] = await verstuur([{ aan: email, aanNaam: `${lid.voornaam || ""} ${lid.naam || ""}`.trim(), onderwerp: m.onderwerp, html, label: "Reservatie kalenderronde" }]);
  if (r && r.ok) for (const x of M) await sb.from("rondemeldingen").update({ data: { ...x.data, mail: { op: new Date().toISOString(), aan: email } } }).eq("id", x.id);
  return res.status(200).json({ ok: !!(r && r.ok), fout: r && r.fout });
}
