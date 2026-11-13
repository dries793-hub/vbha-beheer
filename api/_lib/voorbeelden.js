/* EENMALIG: van elke soort mail die de app verstuurt een voorbeeld naar één adres (via de mailwachtrij). Wordt na gebruik verwijderd. */
const AAN = "dries@vbha.be";
export async function alleVoorbeelden(sb) {
  const B = await import("./bevestiging.js"), { huisstijl, kaderBlok, knop, p, esc, site } = B;
  const { algemeen } = await import("./publiek.js"), A = await algemeen(sb).catch(() => ({ vereniging: "Vriendenkring Brandweer Hoofdpost Aalst" }));
  const een = async (t, q) => { const { data } = await (q ? q(sb.from(t).select("id,data")) : sb.from(t).select("id,data")).limit(1); return data && data[0]; };
  const L = [], fout = [], nr = { n: 0 };
  const zet = (label, m) => { if (!m || !m.html) { fout.push(label + ": geen inhoud"); return; } nr.n++; L.push({ batch: "voorbeelden-" + new Date().toISOString().slice(0, 10), data: { aan: AAN, aanNaam: "Dries", onderwerp: `[Voorbeeld ${String(nr.n).padStart(2, "0")}] ${label} – ${m.onderwerp || ""}`.trim(), html: m.html, label: "Voorbeeld " + label } }); };
  const probeer = async (label, f) => { try { const m = await f(); zet(label, m); } catch (e) { fout.push(label + ": " + (e.message || e)); } };
  const lid = (await sb.from("leden").select("id,data").eq("id", "uyttersprot-dries").maybeSingle()).data || await een("leden");
  // inschrijvingen en betalingen
  await probeer("Bevestiging banket", async () => B.mailBanket(sb, await een("banket")));
  await probeer("Bevestiging nieuw lid", async () => B.mailNieuwLid(sb, { ...lid, data: { ...lid.data, email: AAN } }));
  await probeer("Bevestiging kinderfeest", async () => { const r = await een("kinderfeest"); return B.mailKinderfeest(sb, { ...r, data: { ...r.data, email: AAN } }); });
  await probeer("Bevestiging familiedag", async () => { const r = await een("familiedag"); if (!r) throw new Error("geen inschrijving familiedag"); return B.mailFamiliedag(sb, { ...r, data: { ...r.data, email: AAN } }); });
  await probeer("Betaling ontvangen (lidgeld)", async () => B.mailBetaald(sb, "leden", { ...lid, data: { ...lid.data, email: AAN, betaling: { jaar: 2026, bedrag: 30, status: "SUCCEEDED", betaaldOp: new Date().toISOString() } } }));
  // betalingsherinneringen
  const BH = await import("./betaalherinnering.js");
  await probeer("Betalingsherinnering lidgeld", async () => BH.lidgeldMail({ id: lid.id, naam: `${lid.data.naam} ${lid.data.voornaam}`, voornaam: lid.data.voornaam, jaar: 2027, bedrag: 30 }, A));
  await probeer("Betalingsherinnering banket", async () => BH.banketMail({ naam: `${lid.data.naam} ${lid.data.voornaam}`, voornaam: lid.data.voornaam, jaar: 2026, bedrag: 130, feest: "2026-12-12" }, A));
  // punten en status
  const G = await import("./goudmail.js");
  await probeer("Proficiat goudstatus", async () => ({ onderwerp: "Proficiat: je behaalde de goudstatus voor 2027!", html: G.goudHtml(lid.data.voornaam, 2026, A) }));
  await probeer("Nieuwe punten", async () => ({ onderwerp: "Nieuwe punten: je totaal is nu 110 pt", html: G.puntenHtml(lid.data.voornaam, 2026, { regels: [{ naam: "kalenders bussen", pt: 50, n: "2 dozen" }], totaal: 110, status: "goud", statusNieuw: true, statusVorig: "zilver" }, A) }));
  await probeer("Status opvragen", async () => { const { statusHtml } = await import("./open_status.js"); return { onderwerp: "VBHA - Jouw status 2027: Goud", html: huisstijl(statusHtml(lid.data, { status: "GOUD", korting: 50, punten: 120 }, 2027), A.vereniging) }; });
  // vergaderingen
  const H = await import("./herinnering.js");
  await probeer("Herinnering vergadering", async () => { const { data } = await sb.from("vergaderingen").select("id,data").order("id", { ascending: false }).limit(1); const v = { ...(data && data[0] && data[0].data), id: data && data[0] && data[0].id }; const m = H.mail(v, 3, site(), { dagen: 5 }); return { onderwerp: m.onderwerp, html: m.html }; });
  await probeer("Vergadering afgerond (verslag)", async () => { const { data } = await sb.from("vergaderingen").select("id,data").order("id", { ascending: false }).limit(1); const v = data[0].data; const r = await H.afgerondMail(v, null, true); return { onderwerp: r.onderwerp, html: r.huisstijl(r.html, A.vereniging) }; });
  // facturen
  const F = await import("./factuur.js");
  const fr = await een("facturen", q => q.not("data->>nr", "is", null)), fcfg = await F.fcConfig(sb);
  if (fr) { const f = { ...fr.data, id: fr.id };
    await probeer("Factuur", async () => F.factuurMail(f, fcfg, "factuur"));
    await probeer("Herinnering factuur", async () => F.factuurMail(f, fcfg, "herinnering", { open: F.totalen(f).totaal, n: 1 }));
    await probeer("Aanmaning factuur", async () => F.factuurMail(f, fcfg, "aanmaning", { open: F.totalen(f).totaal }));
    await probeer("Creditnota", async () => F.factuurMail({ ...f, type: "credit" }, fcfg, "factuur")); } else fout.push("Facturen: geen factuur gevonden");
  // sponsors
  const sp = await een("sponsors"), S = await import("./open_sponsor.js");
  await probeer("Sponsor: bevestiging inschrijving", async () => { const C = await S.spConfig(sb); const ins = { kj: 2027, bedrag: 250, formuleNaam: "Logo op de kalender", factuur: false }; return S.bevestigingMail(sp.data, ins, C, { factuur: null, link: S.sponsorBetaalLink(sp.id, 2027, 250), mededeling: S.sponsorMededeling(sp.data, 2027), nieuw: true }); });
  await probeer("Sponsor: melding voor het bestuur", async () => { const C = await S.spConfig(sb); return S.meldingMail(sp.data, { kj: 2027, bedrag: 250, formuleNaam: "Logo op de kalender", factuur: false, logo: true }, C, true); });
  await probeer("Sponsorbevestiging (attest)", async () => { const SB2 = await import("./sponsorbev.js"); return SB2.bevMail({ nr: "2026-001", soort: "geld", bedrag: 250, datum: "2026-11-13" }, sp.data, { vereniging: A.vereniging }); });
  await probeer("Fuif: uitnodiging sponsorkaarten", async () => { const FU = await import("./fuif.js"); const c = await FU.fuifCfg(sb); return FU.sponsorUitnodigingMail(sp.data, sp.id, 2027, c); });
  // terugbetalingen
  await probeer("Terugbetaling: link om rekeningnummer door te geven", async () => ({ onderwerp: "VBHA - Terugbetaling: geef je rekeningnummer door", html: huisstijl(p(`Beste ${esc(lid.data.voornaam)},`) + p("De Vriendenkring wil je <b>€ 25,00</b> terugbetalen voor <b>drank bestuursvergadering</b>. Geef via de knop je rekeningnummer door, dan schrijven we het bedrag over.") + knop("Rekeningnummer doorgeven", site() + "/onkosten"), A.vereniging) }));
  // gebruikers
  await probeer("Toegang beheeromgeving (nieuwe gebruiker)", async () => { const GB = await import("./gebruikers.js"); const m = GB.welkomMail({ naam: "Dries Uyttersprot", email: AAN, rol: "lezer", wachtwoord: "Voorbeeld-123", url: "https://vbha-beheer.vercel.app" }); return { onderwerp: m.onderwerp || m.subject, html: m.html }; });
  // sjablonen uit de app (opmaak huisstijl), met voorbeeldwaarden
  const { data: T } = await sb.from("templates").select("id,data").order("id");
  const V = { voornaam: lid.data.voornaam, naam: lid.data.naam, jaar: "2027", volgend_jaar: "2027", bedrag: "30", rekeningnummer: A.rekeningnummer || "BE43 9730 6810 0401", mededeling: `${lid.data.naam} ${lid.data.voornaam} Lidgeld 2027`, vereniging: A.vereniging };
  for (const t of T || []) await probeer("Sjabloon: " + (t.data.naam || t.id), async () => { const d = t.data || {}; const vul = s => String(s || "").replace(/\{([a-z_]+)\}/g, (m, k) => V[k] != null ? esc(V[k]) : k.startsWith("link_") ? site() : m);
    let body = vul(d.body || ""); if (!d.isHtml) body = body.split(/\n{2,}/).map(x => p(x.replace(/\n/g, "<br>"))).join("");
    return { onderwerp: vul(d.onderwerp).replace(/&amp;/g, "&"), html: huisstijl(body, A.vereniging, { groet: false }) }; });
  if (L.length) { const { error } = await sb.from("mail_wachtrij").insert(L); if (error) throw error; }
  return { ok: true, aantal: L.length, fout };
}
