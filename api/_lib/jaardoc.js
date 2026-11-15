// Jaardocumenten (jaarrekening, jaarverslag) als PDF in de VBHA-huisstijl.
// De app stelt de inhoud samen (secties met tekst en tabellen); de server zet ze op papier.
// doc = { titel, sub, secties: [{ kop, tekst: [alinea], tabel: { kols: [..], rijen: [{ c: [..], t: "kop"|"tot"|"sub" }], breed: [..] } , handtekening: [namen] }] }
import { Pdf, afbreken } from "./pdf.js";
import { LOGO } from "./logo_pdf.js";

const ROOD = "#b30000", GRIJS = "#666666", LICHT = "#f4f1ea", LIJN = "#e2e2e2";
const geld = n => (n < 0 ? "- " : "") + "€ " + Math.abs(Number(n || 0)).toLocaleString("nl-BE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cel = v => typeof v === "number" ? geld(v) : v == null ? "" : String(v);

export function jaardocPdf(doc, cfg) {
  const pdf = new Pdf(), L = 50, R = 545, Wb = R - L, ONDER = 780;
  let pagina = 0;
  const kop = () => {
    pagina++;
    pdf.vlak(0, 0, 595, 6, ROOD);
    pdf.beeld(L, 28, 40, 40 * LOGO.h / LOGO.w, LOGO);
    pdf.tekst(L + 52, 32, cfg.naamJuridisch || cfg.vereniging || "VBHA", { size: 11, bold: true });
    const reg = [String(cfg.adres || "").split(/\r?\n/).filter(Boolean).join(", "), [cfg.kbo ? "Ondernemingsnr. " + cfg.kbo : "", cfg.rpr].filter(Boolean).join("  ·  ")].filter(Boolean);
    reg.forEach((r, i) => pdf.tekst(L + 52, 47 + i * 11, r, { size: 8, kleur: GRIJS }));
    pdf.tekst(R, 32, doc.titel || "", { size: 15, bold: true, kleur: ROOD, align: "right" });
    if (doc.sub) pdf.tekst(R, 52, doc.sub, { size: 8.5, kleur: GRIJS, align: "right" });
    pdf.lijn(L, 84, R, 84, LIJN);
    pdf.tekst(R, 810, "Pagina " + pagina, { size: 7.5, kleur: GRIJS, align: "right" });
    pdf.tekst(L, 810, (cfg.vereniging || "") + " · " + (doc.titel || ""), { size: 7.5, kleur: GRIJS });
    return 100;
  };
  let y = kop();
  const plaats = h => { if (y + h > ONDER) { pdf.nieuwePagina(); y = kop(); return true; } return false; };

  for (const s of doc.secties || []) {
    plaats(60);
    if (s.kop) { pdf.tekst(L, y, s.kop, { size: 12, bold: true, kleur: ROOD }); y += 20; }
    for (const a of s.tekst || []) {
      const regels = afbreken(String(a), 9.5, false, Wb);
      for (const r of regels) { plaats(13); pdf.tekst(L, y, r, { size: 9.5 }); y += 13; }
      y += 5;
    }
    const T = s.tabel;
    if (T && T.rijen && T.rijen.length) {
      const n = T.kols.length, br = T.breed || [Wb - (n - 1) * 85, ...Array(n - 1).fill(85)];
      const xs = []; let x = L; for (const b of br) { xs.push(x); x += b; }
      const kopRij = () => {
        pdf.vlak(L, y, Wb, 18, "#222222");
        T.kols.forEach((k, i) => pdf.tekst(i ? xs[i] + br[i] - 6 : L + 6, y + 5, String(k), { size: 8.5, bold: true, kleur: "#ffffff", align: i ? "right" : "left" }));
        y += 22;
      };
      kopRij();
      for (const r of T.rijen) {
        const c = r.c || r, t = r.t;
        const regels = afbreken(cel(c[0]), 9, t === "kop" || t === "tot", br[0] - 12 - (t === "sub" ? 12 : 0)), h = Math.max(1, regels.length) * 12 + 5;
        if (plaats(h + 4)) kopRij();
        if (t === "kop") { pdf.vlak(L, y - 3, Wb, h + 1, LICHT); }
        if (t === "tot") { pdf.lijn(L, y - 3, R, y - 3, "#222222", 0.8); }
        regels.forEach((rg, i) => pdf.tekst(L + 6 + (t === "sub" ? 12 : 0), y + i * 12, rg, { size: 9, bold: t === "kop" || t === "tot", kleur: t === "sub" ? "#444444" : "#222222" }));
        for (let i = 1; i < n; i++) pdf.tekst(xs[i] + br[i] - 6, y, cel(c[i]), { size: 9, bold: t === "kop" || t === "tot", align: "right", kleur: typeof c[i] === "number" && c[i] < 0 ? ROOD : "#222222" });
        y += h; if (t !== "kop") pdf.lijn(L, y - 3, R, y - 3, LIJN);
      }
      y += 10;
    }
    if (s.handtekening && s.handtekening.length) {
      plaats(90); y += 10;
      const w = Wb / s.handtekening.length;
      s.handtekening.forEach((nm, i) => { const x0 = L + i * w; pdf.lijn(x0, y + 45, x0 + w - 30, y + 45, "#999999"); pdf.tekst(x0, y + 50, nm, { size: 8.5, kleur: GRIJS }); });
      y += 70;
    }
    y += 10;
  }
  return pdf.bytes({ titel: doc.titel || "", auteur: cfg.vereniging || "" });
}

export async function jaardocApi(req, res) {
  const { requireUser, admin } = await import("./sb.js");
  if (req.method !== "POST") return res.status(405).json({ error: "Gebruik POST" });
  await requireUser(req, { boek: true });
  let b = req.body || {}; if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  const doc = b.doc || {}; if (!Array.isArray(doc.secties) || doc.secties.length > 60) return res.status(400).json({ error: "Ongeldig document." });
  const { fcConfig } = await import("./factuur.js"); const cfg = await fcConfig(admin());
  const bytes = jaardocPdf(doc, cfg);
  return res.status(200).json({ pdf: Buffer.from(bytes).toString("base64"), naam: String(b.naam || "document.pdf").replace(/[^\w .()-]/g, "") });
}
