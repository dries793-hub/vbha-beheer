import { admin, sendError, httpErr } from "./sb.js";
import { clean, body, nieuwId, algemeen, configDoc, spamCheck } from "./publiek.js";

// Openbare inschrijving kinderfeest: komt rechtstreeks in Administratie › Kinderfeest.
async function info(sb) {
  const A = await algemeen(sb);
  const c = await configDoc(sb, "kf_" + A.jaar);
  return { jaar: A.jaar, datum: c.datum || A.jaar + "-12-19", tijd: c.tijd || "14u30", locatie: c.locatie || "VTI - Sinte Annalaan 99b, Aalst", leeftijd: Number(c.leeftijd) || 12 };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const sb = admin();
    if (req.method === "GET") return res.status(200).json(await info(sb));
    if (req.method !== "POST") throw httpErr(405, "Gebruik GET of POST");
    const b = body(req);
    if (await spamCheck(sb, "kinderfeest", b, httpErr)) return res.status(200).json({ ok: true });
    const I = await info(sb);
    const lid = clean(b.lid, 100), email = clean(b.email, 120).toLowerCase();
    if (!lid) throw httpErr(400, "Vul de naam van het lid in.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw httpErr(400, "Vul een geldig e-mailadres in.");
    const kinderen = (Array.isArray(b.kinderen) ? b.kinderen : []).slice(0, 8)
      .map(k => ({ naam: clean(k && k.naam, 80), geb: /^\d{4}-\d{2}-\d{2}$/.test(String(k && k.geb)) ? String(k.geb) : "" }))
      .filter(k => k.naam);
    if (!kinderen.length) throw httpErr(400, "Voeg minstens één kind toe.");
    if (kinderen.some(k => !k.geb)) throw httpErr(400, "Vul voor elk kind een geldige geboortedatum in.");
    const d = { jaar: I.jaar, lid, lidId: null, email, opmerking: clean(b.opmerking, 400), kinderen, bron: "formulier", aangemeld: new Date().toISOString(), nieuw: true };
    const { error } = await sb.from("kinderfeest").insert({ id: nieuwId("web"), data: d });
    if (error) throw error;
    res.status(200).json({ ok: true, ...I, kinderen });
  } catch (e) { sendError(res, e); }
}
