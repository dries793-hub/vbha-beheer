import { admin, requireUser, httpErr } from "./sb.js";
import { smtpConfigured } from "./smtp.js";
import { algemeen, configDoc, norm, DEF_IBAN, lidgeldBoekingen } from "./publiek.js";
import { teken, tekenVul } from "./lidlink.js";
import { registreer, sysMail } from "./sjabloon.js";
import { huisstijl, kaderBlok, knop, tabel, rij, p, esc, eur, lang, plusDagen, site } from "./bevestiging.js";
import { meldPush } from "./push.js";

/* ============ Automatische betalingsherinneringen: banket en lidgeld ============
   Config "betaalherinnering": {banket:{aan,basis:"termijn"|"inschrijving",dagenNaVerval,interval,max}, lidgeld:{aan,jaar,vervaldatum,dagenNaVerval,interval,max}, uur,
     laatsteDag, log:[{op, soort, id, naam, aan, n, bedrag}], gezienTot}
   - Banket: te betalen vóór de inschrijvingsdeadline (config banket.inschrijvenTot), geen herinneringen meer vanaf de dag van het banket.
   - Lidgeld: te betalen vóór de vervaldatum in de instellingen (standaard 31 januari van het werkjaar); nieuwe leden binnen 14 dagen na hun inschrijving.
   Betaald = dezelfde regels als de app (manueel OK, online betaald, of een overeenkomstige transactie).
   Eén ronde per dag (vanaf het ingestelde uur), via de mailwachtrij (one.com-limieten). Log per inschrijving / per lid. */

export const BH_DEF = {
  uur: 10,
  banket: { aan: true, basis: "termijn", dagenNaVerval: 3, interval: 7, max: 2 },
  lidgeld: { aan: true, jaar: null, vervaldatum: "", dagenNaVerval: 7, interval: 14, max: 2 },
  inschrijven: { aan: false, dagenVoor: 7 },
};
const vandaagBxl = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Brussels" }).format(new Date());
const uurBxl = () => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", hour: "2-digit", hour12: false }).format(new Date()));
const r2 = n => Math.round(Number(n || 0) * 100) / 100;
const geldig = a => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/.test(String(a || ""));
const nm = x => norm(x).replace(/\s+/g, " ");
const toks = s => norm(s).split(/[^a-z0-9]+/).filter(t => t.length >= 3);

export async function bhConfig(sb) {
  const c = await configDoc(sb, "betaalherinnering"), A = await algemeen(sb);
  const nu = vandaagBxl(), Y = Number(nu.slice(0, 4)), M = Number(nu.slice(5, 7));
  const lg = { ...BH_DEF.lidgeld, ...(c.lidgeld || {}) };
  // standaard: het werkjaar waarvoor nu lidgeld gevraagd wordt (vanaf oktober het volgende jaar)
  if (!lg.jaar) lg.jaar = M >= 10 ? Y + 1 : Y;
  if (!lg.vervaldatum) lg.vervaldatum = lg.jaar + "-01-31";
  return { ...BH_DEF, ...c, banket: { ...BH_DEF.banket, ...(c.banket || {}) }, lidgeld: lg, inschrijven: { ...BH_DEF.inschrijven, ...(c.inschrijven || {}) }, A };
}

async function alle(sb, tabel, jaar) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(tabel).select("id,data");
    if (jaar != null) q = q.eq("data->>jaar", String(jaar));
    const { data, error } = await q.range(from, from + 999);
    if (error) throw error;
    out.push(...data); if (data.length < 1000) break;
  }
  return out;
}
// mag er vandaag een (volgende) herinnering?
function aanDeBeurt(log, verval, R, nu) {
  const n = (log || []).length;
  if (n >= Number(R.max || 0)) return false;
  const eerste = plusDagen(verval, Number(R.dagenNaVerval) || 0);
  if (nu < eerste) return false;
  if (n) { const laatst = String(log[n - 1].op || "").slice(0, 10); if (nu < plusDagen(laatst, Number(R.interval) || 7)) return false; }
  return true;
}

/* ---------- banket ---------- */
async function banketLijst(sb, cfg, nu) {
  const B = await configDoc(sb, "banket"), A = cfg.A;
  const jaar = Number(String(B.datum || "").slice(0, 4)) || A.jaar;
  const verval = B.inschrijvenTot || jaar + "-12-01", feest = B.datum || jaar + "-12-12";
  const [rows, boek, leden] = await Promise.all([alle(sb, "banket", jaar), alle(sb, "boekingen", jaar), alle(sb, "leden")]);
  const LD = new Map(leden.map(r => [r.id, r.data || {}]));
  const BK = boek.map(r => r.data || {}).filter(b => b.richting !== "uit").map(b => ({ ...b, _m: norm(b.mededeling), _p: norm(b.partij), _c: b.categorie }));
  const out = [];
  for (const r of rows) {
    const d = r.data || {};
    const due = r2((d.personen === 2 ? 2 : 1) * (d.prijsPP != null && d.prijsPP !== "" ? Number(d.prijsPP) : Number(B.prijs) || 65) - (Array.isArray(d.tegoed) ? d.tegoed.reduce((t, x) => t + (Number(x.bedrag) || 0), 0) : 0));
    let betaald = false;
    if (d.betaald === "OK") betaald = true; else if (d.betaald === "NOK") betaald = false;
    else if (d.betaling && d.betaling.status === "SUCCEEDED") betaald = true;
    else { const t = toks(d.naam); if (t.length) { const s = BK.filter(b => (b._c === "Banket" || b._m.includes("banket")) && t.every(x => (b._m + " " + b._p).includes(x))).reduce((a, b) => a + Number(b.bedrag || 0), 0); betaald = s > 0 && s >= due - 0.01; } }
    if (betaald || !(due > 0)) continue;
    const L = d.lidId ? LD.get(d.lidId) || {} : {};
    const aan = String(L.email || d.email || "").trim();
    // vertrekpunt: de inschrijvingstermijn (standaard) of de dag van inschrijving (instelling "basis": "inschrijving")
    let v = verval;
    if (cfg.banket.basis === "inschrijving") { const ins = /^\d{4}-\d{2}-\d{2}/.test(String(d.aangemeld || "")) ? String(d.aangemeld).slice(0, 10) : (/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(d.ingediend || "")) || []).slice(1).reverse().join("-"); if (/^\d{4}-\d{2}-\d{2}$/.test(ins)) v = ins; }
    out.push({ soort: "banket", tabel: "banket", id: r.id, row: r, naam: d.naam, voornaam: L.voornaam || "", aan, bedrag: due, jaar, verval: v, feest, log: d.betaalHerinneringen || [] });
  }
  return { lijst: out, jaar, verval, feest };
}
const BH_KADER = (meded, A, x) => tabel([rij("Bedrag", `<b>${eur(x.bedrag)}</b>`), rij("Rekening", `<b>${esc(A.rekeningnummer || DEF_IBAN)}</b>`), rij("Begunstigde", esc(A.vereniging)), rij("Mededeling", `<b>${esc(meded)}</b>`)]);
const KLEIN = t => p(t, "margin:0 0 15px;font-size:13.5px;color:#666666");
registreer({ key: "herinnering-banket", naam: "Herinnering betaling banket", wanneer: "Volgens de instellingen bij Financiën › Betaalherinneringen, aan wie ingeschreven is voor het banket maar nog niet betaalde.",
  onderwerp: "VBHA - Herinnering betaling banket {jaar}",
  body: p("Dag {voornaam}!") + p("Bedankt voor je inschrijving voor ons banket van {datum}. Volgens onze gegevens hebben we je betaling nog niet ontvangen.")
    + p("Pas wanneer je betaling binnen is, is je inschrijving definitief. Mogen we je vragen het bedrag zo snel mogelijk over te schrijven?")
    + kaderBlok("Nog te betalen", "{overschrijving}", "#b30000", "#fdf2f2")
    + KLEIN("Heb je intussen al betaald? Dan kruisten onze berichten elkaar en mag je deze herinnering als niet verzonden beschouwen. Kan je toch niet komen? Laat het ons dan weten door op deze mail te antwoorden."),
  velden: [["voornaam", "Voornaam"], ["naam", "Naam"], ["jaar", "Jaar"], ["datum", "Datum banket"], ["bedrag", "Bedrag"], ["mededeling", "Mededeling"], ["overschrijving", "Tabel overschrijving"]],
  voorbeeld: { voornaam: "Jan", naam: "Peeters Jan", jaar: "2026", datum: "zaterdag 12 december 2026", bedrag: "€65,00", mededeling: "Peeters Jan Banket 2026" } });
export async function banketMail(sb, x, A) {
  const meded = `${x.naam} Banket ${x.jaar}`;
  const m = await sysMail(sb, "herinnering-banket", { voornaam: esc(x.voornaam || x.naam), naam: esc(x.naam), jaar: x.jaar, datum: esc(lang(x.feest)), bedrag: eur(x.bedrag), mededeling: esc(meded), overschrijving: BH_KADER(meded, A, x) });
  return { onderwerp: m.onderwerp, html: huisstijl(m.html, A.vereniging) };
}

/* ---------- lidgeld ---------- */
async function lidgeldLijst(sb, cfg) {
  const J = Number(cfg.lidgeld.jaar), verval = cfg.lidgeld.vervaldatum;
  const [leden, jl, boek, jaren] = await Promise.all([alle(sb, "leden"), alle(sb, "jaarleden", J), lidgeldBoekingen(sb, J), sb.from("jaren").select("data").eq("id", String(J)).maybeSingle()]);
  const jc = (jaren.data && jaren.data.data) || {}, LG = { gewoon: 30, erewacht: 20, ...(jc.lidgeld || {}) };
  const JL = new Map(jl.map(r => [r.id, r.data || {}]));
  const lidBoek = boek.map(r => r.data || {}).filter(b => b.richting !== "uit").map(b => ({ lidId: b.lidId, m: nm(b.mededeling), c: norm(b.categorie) })).filter(b => b.lidId || b.m.includes("lidgeld") || b.c.startsWith("lidgeld"));
  const out = [];
  for (const r of leden) {
    const l = r.data || {};
    if (!l.naam || l.dubbelVan || l.geenLid) continue;
    if (l.lidSinds && Number(l.lidSinds) > J) continue;
    if (l.lidTot && Number(l.lidTot) < J) continue;
    if (nm(l.info).includes("ere-voorzitter")) continue;
    const j = JL.get(J + "_" + r.id) || {};
    if (j.lidgeld === "OK" || j.lidgeld === "NOK") { if (j.lidgeld === "OK") continue; } // NOK = bewust niet betaald: wel herinneren
    else { const n1 = nm(l.naam), n2 = nm(l.voornaam), kp = x => String(x || "").replace(/[^a-z0-9]/g, ""), k1 = kp(n1), k2 = kp(n2); if (lidBoek.some(b => b.lidId === r.id || (n1 && n2 && (b.m.includes("lidgeld") || b.c.startsWith("lidgeld")) && ((b.m.includes(n1) && b.m.includes(n2)) || (k1 && k2 && kp(b.m).includes(k1) && kp(b.m).includes(k2)))))) continue; }
    if (l.betaling && l.betaling.status === "SUCCEEDED" && Number(l.betaling.jaar) === J) continue;
    const bedrag = Number(l.categorie === "Erewacht" ? LG.erewacht : LG.gewoon) || 0;
    if (!(bedrag > 0)) continue;
    // nieuwe leden (inschrijving via het formulier in dat jaar): 14 dagen na hun inschrijving
    const ins = l.aangemeld && String(l.aangemeld).slice(0, 4) === String(J) ? plusDagen(String(l.aangemeld).slice(0, 10), 14) : "";
    out.push({ soort: "lidgeld", tabel: "jaarleden", id: r.id, naam: `${l.naam} ${l.voornaam || ""}`.trim(), voornaam: l.voornaam || "", aan: String(l.email || "").trim(), bedrag, jaar: J, verval: ins && ins > verval ? ins : verval, log: j.lidgeldHerinneringen || [] });
  }
  return { lijst: out, jaar: J, verval };
}
registreer({ key: "herinnering-lidgeld", naam: "Herinnering lidgeld", wanneer: "Volgens de instellingen bij Financiën › Betaalherinneringen, aan leden die hun lidgeld nog niet betaalden.",
  onderwerp: "VBHA - Herinnering lidgeld {jaar}",
  body: p("Dag {voornaam}!")
    + p("Een tijdje geleden vroegen we je om je lidmaatschap van de <b>{vereniging}</b> voor {jaar} te verlengen. Na controle van onze rekeningen stellen we vast dat we je lidgeld nog niet mochten ontvangen.")
    + p("Mogen we je vriendelijk vragen om het lidgeld zo snel mogelijk over te maken? Betaal eenvoudig online met Bancontact via de knop hieronder. Op de betaalpagina kan je ook een QR-code scannen met je bankapp.")
    + "<p>{knop_betalen}</p>" + kaderBlok("Liever zelf overschrijven?", "{overschrijving}")
    + KLEIN("Is dit ondertussen al geregeld, of wil je je lidmaatschap stopzetten? Laat het ons dan weten door gewoon op deze mail te antwoorden.")
    + p("Alvast bedankt om dit in orde te brengen."),
  velden: [["voornaam", "Voornaam"], ["naam", "Naam"], ["vereniging", "Naam vereniging"], ["jaar", "Jaar"], ["bedrag", "Bedrag"], ["mededeling", "Mededeling"], ["link_betalen", "Link online betalen"], ["knop_betalen", "Knop online betalen"], ["overschrijving", "Tabel overschrijving"]],
  voorbeeld: { voornaam: "Jan", naam: "Peeters Jan", vereniging: "Vriendenkring Brandweer Hoofdpost Aalst", jaar: "2026", bedrag: "€30,00", mededeling: "Peeters Jan Lidgeld 2026", link_betalen: "https://vbha.be/lidgeld" } });
export async function lidgeldMail(sb, x, A) {
  const meded = `${x.naam} Lidgeld ${x.jaar}`;
  const link = `${site()}/lidgeld?l=${encodeURIComponent(x.id)}&j=${x.jaar}&b=${Number(x.bedrag)}&t=${encodeURIComponent(teken(x.id, x.jaar, x.bedrag))}`;
  const m = await sysMail(sb, "herinnering-lidgeld", { voornaam: esc(x.voornaam || x.naam), naam: esc(x.naam), vereniging: esc(A.vereniging), jaar: x.jaar, bedrag: eur(x.bedrag), mededeling: esc(meded),
    link_betalen: esc(link), knop_betalen: knop("Betaal je lidgeld met Bancontact", link), overschrijving: BH_KADER(meded, A, x) });
  return { onderwerp: m.onderwerp, html: huisstijl(m.html, A.vereniging) };
}


/* ---------- herinnering om in te schrijven voor het banket ----------
   Aan alle leden die hun lidgeld voor het banketjaar betaalden en nog niet ingeschreven zijn, één keer per jaar,
   een ingesteld aantal dagen vóór de inschrijvingsdeadline (config banket.inschrijvenTot), zolang de inschrijvingen open zijn. */
async function inschrijvenLijst(sb, cfg, nu) {
  const B = await configDoc(sb, "banket"), A = cfg.A;
  const jaar = Number(String(B.datum || "").slice(0, 4)) || A.jaar;
  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(String(B.inschrijvenTot || "")) ? B.inschrijvenTot : jaar + "-12-01", feest = B.datum || jaar + "-12-12";
  const vanaf = plusDagen(deadline, -(Number(cfg.inschrijven.dagenVoor) || 7));
  const [leden, rows, onb] = await Promise.all([alle(sb, "leden"), alle(sb, "banket", jaar), lidgeldLijst(sb, { lidgeld: { jaar, vervaldatum: jaar + "-01-31" } })]);
  const nietBetaald = new Set(onb.lijst.map(x => x.id));
  const ins = rows.map(r => r.data || {}), insLid = new Set(ins.map(d => d.lidId).filter(Boolean)), insNaam = ins.map(d => toks(d.naam));
  const al = (((cfg.inschrijvenVerstuurd || {})[jaar]) || []);
  const out = [];
  for (const r of leden) {
    const l = r.data || {};
    if (!l.naam || l.dubbelVan || l.geenLid || l.overleden) continue;
    if (l.lidSinds && Number(l.lidSinds) > jaar) continue;
    if (l.lidTot && Number(l.lidTot) < jaar) continue;
    if (nm(l.info).includes("ere-voorzitter")) continue;
    if (nietBetaald.has(r.id)) continue; // lidgeld nog niet betaald
    if (insLid.has(r.id)) continue;
    const t = toks(`${l.naam} ${l.voornaam || ""}`); if (t.length >= 2 && insNaam.some(n => t.every(x => n.includes(x)))) continue; // ingeschreven zonder koppeling
    out.push({ soort: "inschrijven", id: r.id, naam: `${l.naam} ${l.voornaam || ""}`.trim(), voornaam: l.voornaam || "", aan: String(l.email || "").trim(), jaar, deadline, feest, al: al.includes(r.id) });
  }
  return { lijst: out, jaar, deadline, feest, vanaf, open: B.open !== false };
}
registreer({ key: "banket-inschrijven", naam: "Herinnering inschrijven banket", wanneer: "Een ingesteld aantal dagen vóór de inschrijvingsdeadline (Banket › tandwiel), aan leden die hun lidgeld betaalden maar nog niet ingeschreven zijn.",
  onderwerp: "VBHA - Schrijf je nog in voor ons banket van {datum_kort}",
  body: p("Dag {voornaam}!")
    + p("Op <b>{datum}</b> houden we ons jaarlijks banket. We zagen dat je nog niet ingeschreven bent, en we zouden je er heel graag bij hebben!")
    + p("Inschrijven kan nog tot en met <b>{deadline}</b>. Via de knop hieronder staat je naam al ingevuld.")
    + "<p>{knop_inschrijven}</p>"
    + KLEIN("Ben je intussen al ingeschreven, of kan je er dit jaar niet bij zijn? Dan mag je deze mail als niet verzonden beschouwen."),
  velden: [["voornaam", "Voornaam"], ["naam", "Naam"], ["jaar", "Jaar"], ["datum", "Datum banket"], ["datum_kort", "Datum banket (kort)"], ["deadline", "Inschrijven tot en met"], ["link_inschrijven", "Link inschrijfpagina"], ["knop_inschrijven", "Knop inschrijven"]],
  voorbeeld: { voornaam: "Jan", naam: "Peeters Jan", jaar: "2026", datum: "zaterdag 12 december 2026", datum_kort: "12 december", deadline: "dinsdag 1 december", link_inschrijven: "https://vbha.be/banket" } });
const kortDatum = iso => { const [y, m, d] = String(iso).split("-").map(Number); return d + " " + ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"][m - 1]; };
export async function inschrijvenMail(sb, x, A) {
  const link = `${site()}/banket?v=${encodeURIComponent(x.id)}&j=${x.jaar}&t=${encodeURIComponent(tekenVul("bk", x.id, x.jaar))}`;
  const m = await sysMail(sb, "banket-inschrijven", { voornaam: esc(x.voornaam || x.naam), naam: esc(x.naam), jaar: x.jaar, datum: esc(lang(x.feest).replace(/^./, c => c.toLowerCase())), datum_kort: esc(kortDatum(x.feest)),
    deadline: esc(lang(x.deadline).replace(/ \d{4}$/, "").replace(/^./, c => c.toLowerCase())), link_inschrijven: esc(link), knop_inschrijven: knop("Schrijf je in voor het banket", link) });
  return { onderwerp: m.onderwerp, html: huisstijl(m.html, A.vereniging) };
}
/* ---------- planning (ook voor het voorbeeld in de instellingen) ---------- */
async function plan(sb, cfg, nu) {
  const res = { banket: null, lidgeld: null };
  const bk = await banketLijst(sb, cfg, nu);
  res.banket = { ...bk, lijst: undefined, open: bk.lijst.length, zonderMail: bk.lijst.filter(x => !geldig(x.aan)).length,
    nu: !cfg.banket.aan || nu >= bk.feest ? [] : bk.lijst.filter(x => geldig(x.aan) && aanDeBeurt(x.log, x.verval, cfg.banket, nu)), alle: bk.lijst };
  const lg = await lidgeldLijst(sb, cfg);
  res.lidgeld = { ...lg, lijst: undefined, open: lg.lijst.length, zonderMail: lg.lijst.filter(x => !geldig(x.aan)).length,
    nu: !cfg.lidgeld.aan ? [] : lg.lijst.filter(x => geldig(x.aan) && aanDeBeurt(x.log, x.verval, cfg.lidgeld, nu)), alle: lg.lijst };
  const ik = await inschrijvenLijst(sb, cfg, nu);
  res.inschrijven = { ...ik, lijst: undefined, open: ik.lijst.length, zonderMail: ik.lijst.filter(x => !geldig(x.aan)).length,
    nu: !cfg.inschrijven.aan || !ik.open || nu < ik.vanaf || nu > ik.deadline ? [] : ik.lijst.filter(x => geldig(x.aan) && !x.al), alle: ik.lijst };
  return res;
}

// GET /api/mail?f=betaalherinnering -> voorbeeld: wie krijgt bij de volgende ronde een herinnering (aangemeld, boekhouding)
export async function betaalHerinneringApi(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const { sb } = await requireUser(req, { boek: true });
  const cfg = await bhConfig(sb), nu = vandaagBxl(), P = await plan(sb, cfg, nu);
  const kort = x => ({ id: x.id, naam: x.naam, aan: x.aan ? x.aan.replace(/^(.{2}).*@/, "$1•••@") : "", bedrag: x.bedrag, n: x.log.length, eerste: plusDagen(x.verval, Number((x.soort === "banket" ? cfg.banket : cfg.lidgeld).dagenNaVerval) || 0) });
  return res.status(200).json({
    vandaag: nu, smtp: smtpConfigured(),
    banket: { jaar: P.banket.jaar, verval: P.banket.verval, feest: P.banket.feest, open: P.banket.open, zonderMail: P.banket.zonderMail, nu: P.banket.nu.map(kort) },
    lidgeld: { jaar: P.lidgeld.jaar, verval: P.lidgeld.verval, open: P.lidgeld.open, zonderMail: P.lidgeld.zonderMail, nu: P.lidgeld.nu.map(kort) },
    inschrijven: { jaar: P.inschrijven.jaar, deadline: P.inschrijven.deadline, vanaf: P.inschrijven.vanaf, open: P.inschrijven.open, aantal: P.inschrijven.alle.filter(x => !x.al).length, zonderMail: P.inschrijven.zonderMail, al: P.inschrijven.alle.filter(x => x.al).length,
      wie: P.inschrijven.alle.filter(x => !x.al).map(x => ({ id: x.id, naam: x.naam, aan: x.aan ? x.aan.replace(/^(.{2}).*@/, "$1•••@") : "" })) },
  });
}

// geplande taak (vanuit de bevestigingen-cron, elke 10 minuten): één ronde per dag vanaf het ingestelde uur
export async function betaalHerinneringCron(sb) {
  if (!smtpConfigured()) return { mail: "niet ingesteld" };
  const cfg = await bhConfig(sb), nu = vandaagBxl();
  if (!cfg.banket.aan && !cfg.lidgeld.aan && !cfg.inschrijven.aan) return { uit: true };
  if (cfg.laatsteDag === nu || uurBxl() < Number(cfg.uur ?? 10)) return { wacht: true };
  // eerst de dag vastleggen: een tweede aanroep (of een fout halverwege) mag nooit dubbel mailen
  const { data: cur } = await sb.from("config").select("data").eq("id", "betaalherinnering").maybeSingle();
  await sb.from("config").upsert({ id: "betaalherinnering", data: { ...((cur && cur.data) || {}), laatsteDag: nu } });
  const P = await plan(sb, cfg, nu), A = cfg.A, batch = "betaalherinnering-" + nu, berichten = [], log = [];
  const ikIds = [];
  for (const x of P.inschrijven.nu) {
    const m = await inschrijvenMail(sb, x, A);
    berichten.push({ batch: "banket-inschrijven-" + x.jaar, data: { aan: x.aan, aanNaam: x.naam, onderwerp: m.onderwerp, html: m.html } }); ikIds.push(x.id);
  }
  for (const x of [...P.banket.nu, ...P.lidgeld.nu]) {
    const m = x.soort === "banket" ? await banketMail(sb, x, A) : await lidgeldMail(sb, x, A);
    berichten.push({ batch, data: { aan: x.aan, aanNaam: x.naam, onderwerp: m.onderwerp, html: m.html } });
    const e = { op: new Date().toISOString(), aan: x.aan, n: x.log.length + 1 };
    // per inschrijving / per lid bijhouden
    if (x.soort === "banket") {
      const { data: r } = await sb.from("banket").select("data").eq("id", x.id).maybeSingle();
      if (r) await sb.from("banket").update({ data: { ...r.data, betaalHerinneringen: [...(r.data.betaalHerinneringen || []), e] } }).eq("id", x.id);
    } else {
      const jid = x.jaar + "_" + x.id;
      const { data: r } = await sb.from("jaarleden").select("data").eq("id", jid).maybeSingle();
      const d = (r && r.data) || { jaar: x.jaar, lidId: x.id };
      await sb.from("jaarleden").upsert({ id: jid, data: { ...d, jaar: x.jaar, lidId: x.id, lidgeldHerinneringen: [...(d.lidgeldHerinneringen || []), e] } });
    }
    log.push({ op: e.op, soort: x.soort, id: x.id, naam: x.naam, aan: x.aan, n: e.n, bedrag: x.bedrag, jaar: x.jaar });
  }
  if (berichten.length) { const { error } = await sb.from("mail_wachtrij").insert(berichten); if (error) throw error; }
  const { data: c2 } = await sb.from("config").select("data").eq("id", "betaalherinnering").maybeSingle();
  const d2 = (c2 && c2.data) || {};
  const IV = { ...(d2.inschrijvenVerstuurd || {}) }; if (ikIds.length) IV[P.inschrijven.jaar] = [...new Set([...(IV[P.inschrijven.jaar] || []), ...ikIds])];
  await sb.from("config").upsert({ id: "betaalherinnering", data: { ...d2, laatsteDag: nu, inschrijvenVerstuurd: IV, laatsteRonde: { op: new Date().toISOString(), banket: P.banket.nu.length, lidgeld: P.lidgeld.nu.length, inschrijven: ikIds.length }, log: [...log, ...(d2.log || [])].slice(0, 300) } });
  if (log.length) await meldPush(sb, "boek", { titel: log.length === 1 ? "Betalingsherinnering verstuurd" : log.length + " betalingsherinneringen verstuurd", tekst: [P.banket.nu.length ? P.banket.nu.length + " banket" : "", P.lidgeld.nu.length ? P.lidgeld.nu.length + " lidgeld" : ""].filter(Boolean).join(" · ") + (log.length <= 3 ? ": " + log.map(x => x.naam).join(", ") : ""), url: "/#dashboard", tag: "betaalherinnering" });
  if (ikIds.length) await meldPush(sb, "boek", { titel: ikIds.length === 1 ? "Herinnering inschrijven banket verstuurd" : ikIds.length + " herinneringen om in te schrijven voor het banket verstuurd", tekst: "Aan leden met betaald lidgeld die nog niet ingeschreven waren." }).catch(() => {});
  return { banket: P.banket.nu.length, lidgeld: P.lidgeld.nu.length, inschrijven: ikIds.length };
}
