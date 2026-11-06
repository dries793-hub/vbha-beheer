// Mollie — Payments API v2 (https://docs.mollie.com/reference/create-payment)
// Nodig in Vercel: MOLLIE_API_KEY (live_… of test_… uit het Mollie-dashboard › Ontwikkelaars › API-sleutels)
// Optioneel:       MOLLIE_METHODS = bv. "bancontact" (standaard) of "bancontact,kbc,belfius,creditcard"

export function mollieConfigured() { return !!String(process.env.MOLLIE_API_KEY || "").trim(); }

async function call(path, { method = "GET", body } = {}) {
  const r = await fetch("https://api.mollie.com/v2" + path, {
    method,
    headers: { Authorization: "Bearer " + String(process.env.MOLLIE_API_KEY).trim(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await r.text();
  let j = null; try { j = txt ? JSON.parse(txt) : null; } catch { /* geen json */ }
  if (!r.ok) { const e = new Error("Mollie: " + (j?.detail || j?.title || r.status)); e.status = 502; throw e; }
  return j;
}

// Mollie-statussen omzetten naar de statussen die de rest van de app gebruikt
const STATUS = { open: "PENDING", pending: "PENDING", authorized: "AUTHORIZED", paid: "SUCCEEDED", failed: "FAILED", expired: "EXPIRED", canceled: "CANCELLED" };
const norm = s => STATUS[s] || String(s || "").toUpperCase();

export async function maakBetaling({ bedrag, omschrijving, referentie, callbackUrl, redirectUrl }) {
  const methods = String(process.env.MOLLIE_METHODS || "bancontact").split(",").map(s => s.trim()).filter(Boolean);
  const p = await call("/payments", {
    method: "POST",
    body: {
      amount: { currency: "EUR", value: Number(bedrag).toFixed(2) },
      description: String(omschrijving).slice(0, 255),
      redirectUrl, webhookUrl: callbackUrl,
      method: methods.length === 1 ? methods[0] : methods,
      locale: "nl_BE",
      metadata: { referentie: String(referentie).slice(0, 100) },
    },
  });
  return { id: p.id, status: norm(p.status), verlooptOp: p.expiresAt || null, deeplink: null, qrcode: null, checkout: p._links?.checkout?.href || null, provider: "mollie" };
}

export async function haalBetaling(id) {
  const p = await call("/payments/" + encodeURIComponent(id));
  return { id: p.id, status: norm(p.status), bedrag: Number(p.amount?.value) || 0, betaaldOp: p.paidAt || null, reference: p.metadata?.referentie || "", debiteur: p.details?.consumerName || "" };
}
