// Enable Banking API: https://enablebanking.com/docs/api/reference/
import crypto from "node:crypto";

const BASE = "https://api.enablebanking.com";
const b64url = x => Buffer.from(x).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

export function configured() {
  return !!(process.env.ENABLE_BANKING_APP_ID && process.env.ENABLE_BANKING_PRIVATE_KEY);
}

export function privateKey() {
  // Vercel bewaart meerregelige waarden soms met letterlijke \n
  return String(process.env.ENABLE_BANKING_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim();
}

export function makeJwt(appId = process.env.ENABLE_BANKING_APP_ID, key = privateKey()) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ typ: "JWT", alg: "RS256", kid: appId }));
  const payload = b64url(JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat: now, exp: now + 3600 }));
  const sig = crypto.sign("RSA-SHA256", Buffer.from(`${header}.${payload}`), key);
  return `${header}.${payload}.${b64url(sig)}`;
}

export async function eb(path, { method = "GET", body } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${makeJwt()}`, "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!r.ok) {
    const e = new Error(`Enable Banking ${r.status}: ${json.message || json.detail || json.error || text.slice(0, 200)}`);
    e.status = 502; e.detail = json; throw e;
  }
  return json;
}

// Zet een Enable Banking-transactie om naar een VBHA-boeking (zonder categorie).
export function mapTransaction(t) {
  const amount = Number(t?.transaction_amount?.amount || 0);
  const uit = t?.credit_debit_indicator ? t.credit_debit_indicator === "DBIT" : amount < 0;
  const party = uit ? t?.creditor : t?.debtor;
  const partyAccount = uit ? t?.creditor_account : t?.debtor_account;
  const rem = Array.isArray(t?.remittance_information) ? t.remittance_information.join(" ") : String(t?.remittance_information || "");
  const mededeling = (rem.trim() || t?.reference_number || t?.note || "").replace(/\s+/g, " ").trim();
  const datum = String(t?.booking_date || t?.value_date || t?.transaction_date || "").slice(0, 10);
  const bankRef = String(t?.entry_reference || t?.transaction_id || "").trim();
  return {
    datum,
    bedrag: Math.round(Math.abs(amount) * 100) / 100,
    richting: uit ? "uit" : "in",
    partij: String(party?.name || "").replace(/\s+/g, " ").trim(),
    iban: String(partyAccount?.iban || "").replace(/\s+/g, "").trim(),
    mededeling,
    bankRef,
  };
}
