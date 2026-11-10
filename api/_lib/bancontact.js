// Bancontact Pay (vroeger Payconiq) — Merchant Payment API v3.
// Nodig in Vercel: BANCONTACT_API_KEY (de API-sleutel van je betaalprofiel)
// Optioneel:       BANCONTACT_ENV=ext om te testen in de testomgeving (standaard: productie)

export function bcConfigured() { return !!String(process.env.BANCONTACT_API_KEY || "").trim(); }

function base() {
  const eigen = String(process.env.BANCONTACT_API_URL || "").trim().replace(/\/+$/, "");
  if (eigen) return eigen;
  // Bancontact Pro (2025+): merchant.api.bancontact.net; BANCONTACT_ENV=preprod voor de testomgeving.
  // De oude Payconiq-hosts (api.payconiq.com) aanvaarden de nieuwe Bancontact Pro-sleutels niet.
  return ["ext", "preprod", "test"].includes(String(process.env.BANCONTACT_ENV || "").trim().toLowerCase())
    ? "https://merchant.api.preprod.bancontact.net/v3" : "https://merchant.api.bancontact.net/v3";
}

// Controle van de sleutel zonder iets te betalen: vraagt een onbestaande betaling op.
// 404 = sleutel aanvaard, 401/403 = sleutel geweigerd. Probeert ook de nieuwe Bancontact Pro-hosts.
export async function testSleutel() {
  const key = String(process.env.BANCONTACT_API_KEY || "").trim();
  if (!key) return { ingesteld: false };
  const hosts = [...new Set([base(), "https://merchant.api.bancontact.net/v3", "https://api.payconiq.com/v3"])];
  const out = [];
  for (const h of hosts) {
    try {
      const r = await fetch(h + "/payments/a1b2c3d4e5f6a1b2c3d4e5f6", { headers: { Authorization: "Bearer " + key } });
      const t = (await r.text()).slice(0, 160);
      out.push({ host: h, status: r.status, oordeel: r.status === 404 ? "sleutel aanvaard" : r.status === 401 || r.status === 403 ? "sleutel geweigerd" : "onduidelijk", antwoord: t });
    } catch (e) { out.push({ host: h, fout: String(e.message || e).slice(0, 120) }); }
  }
  return { ingesteld: true, sleutelEindigtOp: key.slice(-4), huidig: base(), resultaten: out };
}

async function call(path, { method = "GET", body } = {}) {
  const r = await fetch(base() + path, {
    method,
    headers: { Authorization: "Bearer " + String(process.env.BANCONTACT_API_KEY).trim(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  let j = null; try { j = txt ? JSON.parse(txt) : null; } catch { /* geen json */ }
  if (!r.ok) {
    const e = new Error("Bancontact Pay: " + (j?.message || j?.code || r.status));
    e.status = 502; throw e;
  }
  return j;
}

// Maakt een betaling aan. amount in euro, wordt omgezet naar centen.
export async function maakBetaling({ bedrag, omschrijving, referentie, callbackUrl, redirectUrl }) {
  const p = await call("/payments", {
    method: "POST",
    body: { amount: Math.round(Number(bedrag) * 100), currency: "EUR", description: String(omschrijving).slice(0, 140), reference: String(referentie).slice(0, 35), callbackUrl, ...(redirectUrl ? { returnUrl: redirectUrl } : {}) },
  });
  const L = p?._links || {};
  return { id: p.paymentId, status: p.status, verlooptOp: p.expiresAt || p.expireAt || null, deeplink: L.deeplink?.href || null, qrcode: L.qrcode?.href || null, checkout: L.checkout?.href || null };
}

export async function haalBetaling(id) {
  const p = await call("/payments/" + encodeURIComponent(id));
  return { id: p.paymentId, status: p.status, bedrag: (Number(p.totalAmount ?? p.amount) || 0) / 100, betaaldOp: p.succeededAt || null, reference: p.reference || "", debiteur: p.debtor?.name || "" };
}

export const EIND = new Set(["SUCCEEDED", "FAILED", "EXPIRED", "CANCELLED", "AUTHORIZATION_FAILED", "VOIDED"]);

// Verkenning (geen persoonsgegevens): hoeveel betalingen ziet deze sleutel, en is reconciliatie bereikbaar?
export async function verken() {
  const key = String(process.env.BANCONTACT_API_KEY || "").trim();
  if (!key) return { ingesteld: false };
  const H = { Authorization: "Bearer " + key, "Content-Type": "application/json" };
  const out = {};
  try {
    const from = new Date(Date.now() - 30 * 864e5).toISOString().replace(/\.\d+Z$/, "Z");
    const r = await fetch(base() + "/payments/search?page=0&size=100", { method: "POST", headers: H, body: JSON.stringify({ from }) });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
    const L = j?.details || [];
    out.zoek = { status: r.status, totaal: j?.totalElements ?? null, inPagina: L.length,
      statussen: L.reduce((a, p) => (a[p.status] = (a[p.status] || 0) + 1, a), {}),
      velden: L[0] ? Object.keys(L[0]) : [], kanalen: [...new Set(L.map(p => p.channel || p.paymentChannel).filter(Boolean))],
      fout: r.ok ? null : t.slice(0, 200) };
  } catch (e) { out.zoek = { fout: String(e.message || e) }; }
  for (const pad of ["/reconciliation/payouts", "/reconciliation/payments?startDate=" + new Date(Date.now() - 20 * 864e5).toISOString().slice(0, 10) + "&endDate=" + new Date().toISOString().slice(0, 10)]) {
    try { const r = await fetch(base() + pad, { headers: H }); out[pad.split("?")[0]] = { status: r.status, antwoord: (await r.text()).slice(0, 200) }; }
    catch (e) { out[pad] = { fout: String(e.message || e) }; }
  }
  return out;
}

// Verkenning van alle betalingen van het profiel (zonder persoonsgegevens): app-betalingen (referentie "VBHA…")
// versus andere (bv. de vaste QR-code), per status en per dag, en welke velden zo'n andere betaling heeft.
export async function verkenAlles(dagen = 60) {
  const key = String(process.env.BANCONTACT_API_KEY || "").trim();
  if (!key) return { ingesteld: false };
  const H = { Authorization: "Bearer " + key, "Content-Type": "application/json" };
  const from = new Date(Date.now() - dagen * 864e5).toISOString().replace(/\.\d+Z$/, "Z"), to = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const L = []; let totaal = null, fout = null, status = null;
  for (let page = 0; page < 10; page++) {
    const r = await fetch(base() + `/payments/search?page=${page}&size=100`, { method: "POST", headers: H, body: JSON.stringify({ from, to }) });
    status = r.status; const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
    if (!r.ok) { fout = t.slice(0, 300); break; }
    totaal = j?.totalElements ?? totaal; const d = j?.details || []; L.push(...d);
    if (d.length < 100) break;
  }
  const sleutels = (o, p = "") => o && typeof o === "object" ? Object.entries(o).flatMap(([k, v]) => v && typeof v === "object" && !Array.isArray(v) ? sleutels(v, p + k + ".") : [p + k]) : [];
  const groep = p => /^VBHA/i.test(String(p.reference || "")) ? "app" : "andere";
  const out = { status, fout, totaal, opgehaald: L.length, groepen: {} };
  for (const p of L) {
    const g = groep(p), x = out.groepen[g] || (out.groepen[g] = { aantal: 0, statussen: {}, kanalen: {}, metNaam: 0, metReferentie: 0, metOmschrijving: 0, perDag: {}, velden: [] });
    x.aantal++; x.statussen[p.status] = (x.statussen[p.status] || 0) + 1;
    const k = p.channel || p.paymentChannel || p.type || "?"; x.kanalen[k] = (x.kanalen[k] || 0) + 1;
    if (p.debtor && p.debtor.name) x.metNaam++; if (p.reference) x.metReferentie++; if (p.description) x.metOmschrijving++;
    if (p.status === "SUCCEEDED") { const d = String(p.succeededAt || p.createdAt || "").slice(0, 10); x.perDag[d] = Math.round(((x.perDag[d] || 0) + (Number(p.totalAmount ?? p.amount) || 0) / 100) * 100) / 100; }
    for (const s of sleutels(p)) if (!x.velden.includes(s)) x.velden.push(s);
  }
  return out;
}
