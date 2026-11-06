// Bancontact Pay (vroeger Payconiq) — Merchant Payment API v3.
// Nodig in Vercel: BANCONTACT_API_KEY (de API-sleutel van je betaalprofiel)
// Optioneel:       BANCONTACT_ENV=ext om te testen in de testomgeving (standaard: productie)

export function bcConfigured() { return !!String(process.env.BANCONTACT_API_KEY || "").trim(); }

function base() {
  const eigen = String(process.env.BANCONTACT_API_URL || "").trim().replace(/\/+$/, "");
  if (eigen) return eigen;
  return String(process.env.BANCONTACT_ENV || "").trim().toLowerCase() === "ext"
    ? "https://api.ext.payconiq.com/v3" : "https://api.payconiq.com/v3";
}

// Controle van de sleutel zonder iets te betalen: vraagt een onbestaande betaling op.
// 404 = sleutel aanvaard, 401/403 = sleutel geweigerd. Probeert ook de nieuwe Bancontact Pro-hosts.
export async function testSleutel() {
  const key = String(process.env.BANCONTACT_API_KEY || "").trim();
  if (!key) return { ingesteld: false };
  const hosts = [...new Set([base(), "https://api.payconiq.com/v3", "https://api.ext.payconiq.com/v3", "https://merchant.api.bancontact.net/v3"])];
  const out = [];
  for (const h of hosts) {
    try {
      const r = await fetch(h + "/payments/vbha-sleuteltest", { headers: { Authorization: "Bearer " + key } });
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
export async function maakBetaling({ bedrag, omschrijving, referentie, callbackUrl }) {
  const p = await call("/payments", {
    method: "POST",
    body: { amount: Math.round(Number(bedrag) * 100), currency: "EUR", description: String(omschrijving).slice(0, 140), reference: String(referentie).slice(0, 35), callbackUrl },
  });
  const L = p?._links || {};
  return { id: p.paymentId, status: p.status, verlooptOp: p.expiresAt || p.expireAt || null, deeplink: L.deeplink?.href || null, qrcode: L.qrcode?.href || null, checkout: L.checkout?.href || null };
}

export async function haalBetaling(id) {
  const p = await call("/payments/" + encodeURIComponent(id));
  return { id: p.paymentId, status: p.status, bedrag: (Number(p.totalAmount ?? p.amount) || 0) / 100, betaaldOp: p.succeededAt || null, reference: p.reference || "", debiteur: p.debtor?.name || "" };
}

export const EIND = new Set(["SUCCEEDED", "FAILED", "EXPIRED", "CANCELLED", "AUTHORIZATION_FAILED"]);
