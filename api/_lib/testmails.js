// TIJDELIJK: alle mails uit de app één keer met testgegevens naar één adres (enkel via de geplande taak, x-vbha-cron).
import { admin, isDbCron, httpErr } from "./sb.js";
import { verstuur, testOpvang, afzender } from "./smtp.js";
import { mailBanket, mailNieuwLid, mailKinderfeest, mailBetaald, huisstijl } from "./bevestiging.js";
import { factuurMail, factuurPdf, factuurOnlineBetaald, fcConfig, pdfNaam } from "./factuur.js";
import { stuurTickets } from "./fuif.js";
import { shopMail } from "./shop.js";
import { bevestigingMail, meldingMail, sponsorBetaald, spConfig } from "./open_sponsor.js";
import { bevMail, bevPdf } from "./sponsorbev.js";
import { mail as vergMail, afgerondMail } from "./herinnering.js";
import { banketMail, lidgeldMail } from "./betaalherinnering.js";
import { welkomMail } from "./gebruikers.js";
import { statusHtml } from "./open_status.js";
import { algemeen } from "./publiek.js";

const AAN = "dries.uyttersprot@telenet.be";
const ECHT = new Set(["config", "jaren", "beelden"]); // enkel lezen

function nepSb(echt, nep) {
  const bouwer = tabel => {
    let id = null, schrijf = false;
    const rows = nep[tabel] || {};
    const lijst = () => Object.entries(rows).map(([i, data]) => ({ id: i, data }));
    const q = {
      select: () => q, eq: (k, v) => { if (k === "id") id = String(v); return q; }, gte: () => q, lte: () => q, lt: () => q, gt: () => q, neq: () => q, in: () => q,
      order: () => q, limit: () => q, range: () => q, like: () => q, ilike: () => q, is: () => q, not: () => q, or: () => q, filter: () => q, contains: () => q,
      update: () => { schrijf = true; return q; }, insert: () => { schrijf = true; return q; }, upsert: () => { schrijf = true; return q; }, delete: () => { schrijf = true; return q; },
      maybeSingle: async () => ({ data: id && rows[id] ? { id, data: rows[id] } : null, error: null }),
      single: async () => ({ data: id && rows[id] ? { id, data: rows[id] } : null, error: null }),
      then: (ok, nok) => Promise.resolve(schrijf ? { data: null, error: null } : { data: id ? lijst().filter(r => r.id === id) : lijst(), error: null, count: 0 }).then(ok, nok),
    };
    return q;
  };
  return { from: t => ECHT.has(t) ? echt.from(t) : bouwer(t), storage: { from: () => ({ download: async () => ({ data: null, error: { message: "test" } }) }) }, rpc: async () => ({ data: null, error: null }) };
}

export async function testMails(req, res) {
  if (!(await isDbCron(req))) throw httpErr(403, "Geen toegang");
  const echt = admin();
  const nu = new Date(), iso = nu.toISOString(), dag = iso.slice(0, 10), jaar = nu.getFullYear();
  const plus = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const LID = { naam: "Testmans", voornaam: "Jan", email: AAN, adres: "Teststraat 1, 9300 Aalst", telefoon: "0470 12 34 56", categorie: "Gewoon lid", lidSinds: jaar, aangemeld: iso };
  const nep = {
    leden: { "test-lid": LID, "test-lid-betaald": { ...LID, betaling: { status: "SUCCEEDED", bedrag: 30, jaar, betaaldOp: iso }, lidgeldBedrag: 30 } },
    banket: { "test-bk": { jaar, lidId: "test-lid", naam: "Testmans Jan", personen: 2, menu1: "Vlees", menu2: "Vis", teBetalen: 130, opmerking: "Testinschrijving", betaling: { status: "SUCCEEDED", bedrag: 130, betaaldOp: iso } } },
    kinderfeest: {},
    tickets: {
      "test-tk": { voornaam: "Jan", naam: "Testmans", email: AAN, adres: "Teststraat 1, 9300 Aalst", bedrag: 46, prijs: 5, korting: 2, betaalToken: "test",
        drank: [{ waarde: 20, aantal: 1, prijs: 18 }, { waarde: 50, aantal: 0, prijs: 45 }].filter(x => x.aantal),
        tickets: [{ code: "TESTAB23CD45", nr: 1 }, { code: "TESTEF67GH89", nr: 2 }, { code: "TESTJK23LM45", nr: 1, soort: "drank", waarde: 20 }] },
    },
    shop_orders: {
      "test-so1": { nr: `W${jaar}-001`, items: [{ naam: "Patch VBHA", aantal: 2, prijs: 10 }], levering: "post", verzendNaam: "bpost pakje", verzendkost: 7.5, totaal: 27.5, gewicht: 60,
        klant: { voornaam: "Jan", naam: "Testmans", email: AAN, adres: "Teststraat 1, 9300 Aalst", telefoon: "0470 12 34 56" }, betaald: false, betaalwijze: "overschrijving", betaalToken: "test", opmerking: "Testbestelling" },
      "test-so2": { nr: `W${jaar}-002`, items: [{ naam: "Patch VBHA", aantal: 1, prijs: 10 }], levering: "afhalen", verzendkost: 0, totaal: 10, gewicht: 30,
        klant: { voornaam: "Jan", naam: "Testmans", email: AAN, adres: "Teststraat 1, 9300 Aalst" }, betaald: false, betaalwijze: "cash", betaalToken: "test" },
    },
    facturen: { "test-fc": { nr: `${jaar}-999`, datum: dag, vervaldatum: plus(30), klant: { naam: "Testbedrijf BV", contact: "Jan Testmans", adres: "Teststraat 1\n9300 Aalst", email: AAN, btw: "BE0123.456.789" },
      lijnen: [{ omschrijving: "Sponsoring brandweerkalender (test)", aantal: 1, prijs: 150, btw: 21 }], betaling: { status: "SUCCEEDED", bedrag: 181.5, betaaldOp: iso } } },
    sponsors: { "test-sp": { bedrijf: "Testbedrijf BV", voornaam: "Jan", naam: "Testmans", email: AAN, telefoon: "053 12 34 56", adres: "Teststraat 1, 9300 Aalst", kbo: "BE0123.456.789", betaling: { status: "SUCCEEDED", bedrag: 150, jaar: jaar + 1 } } },
  };
  const sb = nepSb(echt, nep);
  const lijst = [], fouten = [];
  const doe = async (naam, fn) => { const voor = lijst.length; try { await testOpvang.run(lijst, fn); if (lijst.length === voor) fouten.push(naam + ": niets gemaakt"); else for (let i = voor; i < lijst.length; i++) lijst[i]._naam = naam; } catch (e) { fouten.push(naam + ": " + e.message); } };
  const zend = m => verstuur([m]);
  const A = await algemeen(echt);

  // bevestigingen inschrijvingen
  await doe("Nieuw lid (nog te betalen)", async () => zend(await mailNieuwLid(sb, { id: "test-lid", data: { ...LID, lidgeldBedrag: 30 } })));
  await doe("Nieuw lid (betaald)", async () => zend(await mailNieuwLid(sb, { id: "test-lid-betaald", data: nep.leden["test-lid-betaald"] })));
  await doe("Banket (nog te betalen)", async () => zend(await mailBanket(sb, { id: "test-bk", data: { ...nep.banket["test-bk"], betaling: null } })));
  await doe("Banket (betaald)", async () => zend(await mailBanket(sb, { id: "test-bk", data: nep.banket["test-bk"] })));
  await doe("Betaling ontvangen lidgeld", async () => zend(await mailBetaald(sb, "leden", { id: "test-lid-betaald", data: nep.leden["test-lid-betaald"] })));
  await doe("Betaling ontvangen banket", async () => zend(await mailBetaald(sb, "banket", { id: "test-bk", data: nep.banket["test-bk"] })));
  await doe("Kinderfeest", async () => { const m = await mailKinderfeest(sb, { id: "test-kf", data: { jaar: A.jaar, email: AAN, lid: "Testmans Jan", voornaam: "Jan", kinderen: [{ naam: "Lotte Testmans", geb: (A.jaar - 7) + "-03-14" }, { naam: "Mats Testmans", geb: (A.jaar - 3) + "-09-02" }], opmerking: "Test" } }); m.cc = []; return zend(m); });

  // fuif
  await doe("Fuif tickets + drankkaart", () => stuurTickets(sb, { id: "test-tk", data: nep.tickets["test-tk"] }, AAN));

  // webshop
  await doe("Webshop bevestiging (overschrijving, bpost)", () => shopMail(sb, "test-so1", "bevestiging"));
  await doe("Webshop bevestiging (cash, afhalen)", () => shopMail(sb, "test-so2", "bevestiging"));
  await doe("Webshop verzonden", () => shopMail(sb, "test-so1", "verzonden"));
  await doe("Webshop ligt klaar", () => shopMail(sb, "test-so2", "klaar"));

  // facturen
  const cfg = await fcConfig(echt), f = { ...nep.facturen["test-fc"], id: "test-fc" };
  const fz = (m, ff, st) => zend({ aan: AAN, onderwerp: m.onderwerp, html: m.html, van: afzender(), bijlagen: [{ naam: pdfNaam(ff), type: "application/pdf", data: factuurPdf(ff, cfg, { status: st }) }] });
  await doe("Factuur", () => fz(factuurMail(f, cfg, "factuur"), f));
  await doe("Factuur herinnering", () => fz(factuurMail({ ...f, vervaldatum: plus(-10) }, cfg, "herinnering", { open: 181.5, ontvangen: 0, betaald: false }), f, { open: 181.5, ontvangen: 0, betaald: false }));
  await doe("Creditnota", () => { const c = { ...f, type: "credit", nr: `C${jaar}-999`, factuurNr: f.nr }; return fz(factuurMail(c, cfg, "factuur"), c); });
  await doe("Factuur online betaald", () => factuurOnlineBetaald(sb, "test-fc"));

  // sponsors
  const C = await spConfig(echt), sp = nep.sponsors["test-sp"], ins = { kj: jaar + 1, formuleNaam: "Gouden sponsor (test)", bedrag: 150, logo: false, factuur: true, factuurNr: f.nr };
  await doe("Sponsor bevestiging (inschrijfpagina)", () => { const m = bevestigingMail(sp, ins, C, { factuur: { nr: f.nr }, link: "https://vbha-beheer.vercel.app/sponsor", mededeling: "Sponsoring test", nieuw: true }); return zend({ aan: AAN, ...m, van: afzender() }); });
  await doe("Sponsor melding aan bestuur", () => { const m = meldingMail(sp, ins, C, true); return zend({ aan: AAN, ...m, van: afzender() }); });
  await doe("Sponsor betaling ontvangen", () => sponsorBetaald(sb, "test-sp"));
  await doe("Sponsorbevestiging (boekhouding)", () => { const b = { soort: "natura", omschrijving: "Drank voor het banket (test)", waarde: 250, datum: dag, opgemaakt: dag, tegenprestatie: "Logo op de kalender", ondertekenaar: "", functie: "", nr: `SB${jaar}-999` }; const m = bevMail(b, sp, cfg); return zend({ aan: AAN, ...m, van: afzender(), bijlagen: [{ naam: "Sponsorbevestiging test.pdf", type: "application/pdf", data: bevPdf(b, sp, cfg, null) }] }); });

  // vergaderingen
  const v = { soort: "Bestuursvergadering", titel: "Bestuursvergadering", datum: plus(5), uur: "19u30", locatie: "Kazerne Aalst", agenda: "Verslag vorige vergadering\nBanket\nVaria", aanwezig: "Jan, Piet, Joris", verontschuldigd: "Korneel" };
  await doe("Herinnering vergadering", () => zend({ ...vergMail(v, 5, "", { dagen: 5 }), aan: AAN, van: afzender() }));
  await doe("Vergadering afgerond", async () => { const m = await afgerondMail({ ...v, datum: dag }, { ...v, datum: plus(30) }, false); return zend({ aan: AAN, aanNaam: "Bestuur VBHA", onderwerp: m.onderwerp, html: m.huisstijl(m.html, A.vereniging), van: afzender() }); });

  // betalingsherinneringen
  await doe("Herinnering betaling banket", () => { const m = banketMail({ naam: "Testmans Jan", voornaam: "Jan", bedrag: 130, jaar: A.jaar, feest: A.jaar + "-12-12" }, A); return zend({ aan: AAN, ...m, van: afzender() }); });
  await doe("Herinnering lidgeld", () => { const m = lidgeldMail({ id: "test-lid", naam: "Testmans Jan", voornaam: "Jan", bedrag: 30, jaar: A.jaar }, A); return zend({ aan: AAN, ...m, van: afzender() }); });

  // gebruikers en status
  await doe("Welkom nieuwe gebruiker", () => zend({ ...welkomMail({ naam: "Jan Testmans", email: AAN, rol: "bewerker", wachtwoord: "Test-1234-abcd", url: "https://vbha-beheer.vercel.app", reset: false }), van: afzender() }));
  await doe("Nieuw tijdelijk wachtwoord", () => zend({ ...welkomMail({ naam: "Jan Testmans", email: AAN, rol: "bewerker", wachtwoord: "Test-5678-efgh", url: "https://vbha-beheer.vercel.app", reset: true }), van: afzender() }));
  await doe("Status opvragen (lid)", () => zend({ aan: AAN, onderwerp: `VBHA - Jouw status ${A.jaar}: Zilver`, html: huisstijl(statusHtml(LID, { status: "ZILVER", korting: 10, puntenJaar: A.jaar - 1, ere: false }, A.jaar), A.vereniging), van: afzender() }));

  // nastuur-regels (bulkmails voor nieuwe leden)
  try {
    const { data: ns } = await echt.from("config").select("data").eq("id", "nastuur").maybeSingle();
    for (const [tpl, R] of Object.entries((ns && ns.data && ns.data.regels) || {})) {
      if (!R || !R.html) continue;
      const vul = t => String(t || "").split("@@VOORNAAM@@").join("Jan").split("@@NAAM@@").join("Jan Testmans");
      await doe("Nasturen nieuwe leden: " + tpl, () => zend({ aan: AAN, onderwerp: vul(R.onderwerp), html: vul(R.html), van: afzender() }));
    }
  } catch (e) { fouten.push("nastuur: " + e.message); }

  // alles in één verbinding versturen, naar het testadres, zonder kopieën
  const B = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}), alleen = Array.isArray(B.alleen) ? B.alleen : null;
  const uit = lijst.filter(m => !alleen || alleen.includes(m._naam)).map(m => ({ ...m, aan: AAN, aanNaam: "Test", cc: [], geenBcc: true, onderwerp: "[TEST] " + String(m.onderwerp || "").replace(/^\[TEST\]\s*/, "") }))
    .filter(m => !/^\[TEST\] \[Kopie\]/.test(m.onderwerp));
  const r = uit.length ? await verstuur(uit) : [];
  res.status(200).json({ aantal: uit.length, ok: r.filter(x => x && x.ok).length, mails: uit.map((m, i) => ({ naam: m._naam, onderwerp: m.onderwerp, ok: !!(r[i] && r[i].ok), fout: r[i] && r[i].fout })), fouten });
}
