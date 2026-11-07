import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const QRCode = require("./qr/index.cjs");
const ECL = require("./qr/QRErrorCorrectLevel.cjs");

// EPC-QR (SEPA-overschrijving, ook "GiroCode"): bankapps vullen begunstigde, IBAN, bedrag en mededeling zelf in.
export function epcPayload({ naam, iban, bedrag, mededeling }) {
  const amt = "EUR" + Number(bedrag).toFixed(2);
  return ["BCD", "002", "1", "SCT", "", String(naam).slice(0, 70), String(iban).replace(/\s+/g, "").toUpperCase(), amt, "", "", String(mededeling).slice(0, 140)].join("\n");
}

// Geeft een SVG terug (zwart op wit, met stille zone), klaar om in de pagina te zetten.
export function qrSvg(text) {
  const qr = new QRCode(-1, ECL.M);
  qr.addData(Buffer.from(text, "utf8").toString("latin1"));
  qr.make();
  const n = qr.getModuleCount(), q = 4, size = n + q * 2;
  let d = "";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + q} ${r + q}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR-code voor de overschrijving"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}

// Ruwe QR-matrix (voor de factuur-PDF): {n, donker(r, c)}
export function qrMatrix(text) {
  const qr = new QRCode(-1, ECL.M);
  qr.addData(Buffer.from(text, "utf8").toString("latin1"));
  qr.make();
  return { n: qr.getModuleCount(), donker: (r, c) => qr.isDark(r, c) };
}
