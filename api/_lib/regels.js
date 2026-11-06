// Dezelfde regel-logica als in de browser (public/app.js): eerste passende regel wint,
// anders een voorstel op basis van eerdere boekingen van dezelfde tegenpartij.
export const norm = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const OPS = { bevat: "bevat", begint: "begint met", gelijk: "is gelijk aan" };

export function matchRegel(r, b) {
  const raw = String(r.waarde || ""); if (!raw.trim()) return false;
  if (r.richting && r.richting !== "beide" && r.richting !== (b.richting === "uit" ? "uit" : "in")) return false;
  const iban = r.veld === "iban";
  const v = iban ? norm(raw).replace(/\s/g, "") : norm(raw);
  const fields = r.veld === "partij" ? [b.partij] : iban ? [b.iban] : r.veld === "alles" ? [b.mededeling, b.partij] : [b.mededeling];
  return fields.some(f => { let t = norm(f); if (iban) t = t.replace(/\s/g, ""); if (!t) return false;
    return r.op === "begint" ? t.startsWith(v) : r.op === "gelijk" ? t === v : t.includes(v); });
}

export function partijIndex(boekingen) {
  const m = new Map();
  for (const b of boekingen) {
    if (!b.categorie || b.status === "controle") continue;
    const p = norm(b.partij); if (p.length < 4) continue;
    if (!m.has(p)) m.set(p, new Map());
    const c = m.get(p); c.set(b.categorie, (c.get(b.categorie) || 0) + 1);
  }
  return m;
}

export function suggest(b, regels, pidx) {
  const actief = regels.filter(r => r.actief !== false).sort((a, c) => (a.volgorde || 0) - (c.volgorde || 0));
  for (const r of actief) if (matchRegel(r, b)) return { categorie: r.categorie, naam: "Regel: " + (r.naam || `${OPS[r.op] || "bevat"} “${r.waarde}”`), zeker: true };
  const c = pidx.get(norm(b.partij));
  if (c && c.size === 1) { const [cat, n] = [...c.entries()][0]; if (n >= 2) return { categorie: cat, naam: `Zelfde tegenpartij als ${n} eerdere boekingen`, zeker: false }; }
  return null;
}

export function findLid(b, leden, jaar) {
  const t = norm(`${b.mededeling || ""} ${b.partij || ""}`);
  const hits = leden.filter(l => !l.geenLid && (!l.lidTot || l.lidTot >= jaar) && (!l.lidSinds || l.lidSinds <= jaar) && norm(l.naam) && norm(l.voornaam) && t.includes(norm(l.naam)) && t.includes(norm(l.voornaam)));
  return hits.length === 1 ? hits[0].id : null;
}
