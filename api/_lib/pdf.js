// Kleine PDF-schrijver zonder extra pakketten: A4, Helvetica / Helvetica-Bold (WinAnsi), tekst, lijnen, vlakken, één RGB-afbeelding en QR.
// Coördinaten van linksboven (x naar rechts, y naar beneden) in punten; 1 mm = 2.835 pt.
import zlib from "node:zlib";

const W_REG = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 761, 556, 556, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 556, 611, 556, 556, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 556, 500, 667, 278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611, 667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278, 556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500];
const W_BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 761, 556, 611, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 611, 611, 611, 611, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 611, 500, 667, 278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333, 400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611, 722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278, 722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611, 556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278, 611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556];
const CP = { 0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f };
// Unicode -> WinAnsi-bytes (onbekende tekens worden "?")
export function ansi(s) {
  const out = [];
  for (const ch of String(s ?? "").normalize("NFC")) {
    const c = ch.codePointAt(0);
    if (c === 9) out.push(32);
    else if (c >= 32 && c < 127) out.push(c);
    else if (c >= 0xa0 && c <= 0xff) out.push(c);
    else if (CP[c]) out.push(CP[c]);
    else if (c === 0x202f || c === 0x2009) out.push(32);
    else out.push(63);
  }
  return out;
}
export function breedte(s, size, bold) { const T = bold ? W_BOLD : W_REG; let w = 0; for (const c of ansi(s)) w += T[c - 32] || 556; return w * size / 1000; }
// Breekt tekst af op woorden zodat elke regel binnen maxW past (harde regeleinden blijven behouden).
export function afbreken(s, size, bold, maxW) {
  const uit = [];
  for (const alinea of String(s ?? "").split(/\r?\n/)) {
    let r = "";
    for (const woord of alinea.split(/ +/)) {
      const t = r ? r + " " + woord : woord;
      if (breedte(t, size, bold) <= maxW || !r) { r = t; continue; }
      uit.push(r); r = woord;
    }
    uit.push(r);
  }
  return uit;
}
const kleur = c => { if (!c) return [0, 0, 0]; const h = c.replace("#", ""); return [0, 2, 4].map(i => +(parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)); };
const f = n => +Number(n).toFixed(2);

export class Pdf {
  constructor() { this.paginas = []; this.H = 842; this.Wd = 595; this.beelden = []; this.nieuwePagina(); }
  nieuwePagina() { this.ops = []; this.paginas.push(this.ops); return this; }
  tekst(x, y, s, { size = 10, bold = false, kleur: k = "#222222", align = "left" } = {}) {
    if (s == null || s === "") return this;
    const w = breedte(s, size, bold);
    if (align === "right") x -= w; else if (align === "center") x -= w / 2;
    const hex = ansi(s).map(b => b.toString(16).padStart(2, "0")).join("");
    this.ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${kleur(k).join(" ")} rg ${f(x)} ${f(this.H - y - size * 0.8)} Td <${hex}> Tj ET`);
    return this;
  }
  vlak(x, y, w, h, k) { this.ops.push(`${kleur(k).join(" ")} rg ${f(x)} ${f(this.H - y - h)} ${f(w)} ${f(h)} re f`); return this; }
  kader(x, y, w, h, k = "#cccccc", dikte = 0.6) { this.ops.push(`${kleur(k).join(" ")} RG ${dikte} w ${f(x)} ${f(this.H - y - h)} ${f(w)} ${f(h)} re S`); return this; }
  lijn(x1, y1, x2, y2, k = "#cccccc", dikte = 0.6) { this.ops.push(`${kleur(k).join(" ")} RG ${dikte} w ${f(x1)} ${f(this.H - y1)} m ${f(x2)} ${f(this.H - y2)} l S`); return this; }
  // RGB-beeld (zlib-gecomprimeerde ruwe pixels)
  beeld(x, y, w, h, img) {
    let i = this.beelden.indexOf(img); if (i < 0) { this.beelden.push(img); i = this.beelden.length - 1; }
    this.ops.push(`q ${f(w)} 0 0 ${f(h)} ${f(x)} ${f(this.H - y - h)} cm /Im${i} Do Q`); return this;
  }
  // beeld onder alle andere inhoud van de huidige pagina (watermerk)
  achtergrond(x, y, w, h, img) { const n = this.ops.length; this.beeld(x, y, w, h, img); this.ops.unshift(this.ops.splice(n, 1)[0]); return this; }
  // QR-code: n x n modules, donker(r, c) -> boolean
  qr(x, y, maat, n, donker) {
    const m = maat / n; let d = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (donker(r, c)) d += `${f(x + c * m)} ${f(this.H - y - (r + 1) * m)} ${f(m + 0.02)} ${f(m + 0.02)} re `;
    this.ops.push(`0 0 0 rg ${d}f`); return this;
  }
  bytes({ titel = "", auteur = "" } = {}) {
    const objs = [];
    const add = s => { objs.push(s); return objs.length; };
    const catalog = add(null), pages = add(null);
    const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const im = this.beelden.map(b => { const data = Buffer.from(b.data, "base64"); return add({ dict: `<< /Type /XObject /Subtype /Image /Width ${b.w} /Height ${b.h} /ColorSpace /${b.cs || "DeviceRGB"} /BitsPerComponent 8 /Filter /FlateDecode /Length ${data.length} >>`, data }); });
    const xo = im.length ? "/XObject << " + im.map((o, i) => `/Im${i} ${o} 0 R`).join(" ") + " >>" : "";
    const kids = [];
    for (const ops of this.paginas) {
      const inhoud = zlib.deflateSync(Buffer.from(ops.join("\n"), "latin1"));
      const c = add({ dict: `<< /Length ${inhoud.length} /Filter /FlateDecode >>`, data: inhoud });
      kids.push(add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${this.Wd} ${this.H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> ${xo} >> /Contents ${c} 0 R >>`));
    }
    objs[catalog - 1] = `<< /Type /Catalog /Pages ${pages} 0 R >>`;
    objs[pages - 1] = `<< /Type /Pages /Kids [${kids.map(k => k + " 0 R").join(" ")}] /Count ${kids.length} >>`;
    const hexs = s => "<feff" + Buffer.from(String(s), "utf16le").swap16().toString("hex") + ">";
    const info = add(`<< /Title ${hexs(titel)} /Author ${hexs(auteur)} /Producer (VBHA Beheer) /CreationDate (D:${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}Z) >>`);
    const delen = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
    let pos = delen[0].length; const xref = [];
    objs.forEach((o, i) => {
      xref.push(pos);
      const b = typeof o === "string" ? Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, "latin1")
        : Buffer.concat([Buffer.from(`${i + 1} 0 obj\n${o.dict}\nstream\n`, "latin1"), o.data, Buffer.from("\nendstream\nendobj\n", "latin1")]);
      delen.push(b); pos += b.length;
    });
    const x = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + xref.map(p => String(p).padStart(10, "0") + " 00000 n \n").join("")
      + `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
    delen.push(Buffer.from(x, "latin1"));
    return Buffer.concat(delen);
  }
}
