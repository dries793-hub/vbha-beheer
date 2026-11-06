// Kiest de online betaalprovider: Mollie als MOLLIE_API_KEY ingesteld is, anders Bancontact Pay (BANCONTACT_API_KEY).
import * as mollie from "./mollie.js";
import * as bc from "./bancontact.js";

const P = () => (mollie.mollieConfigured() ? mollie : bc);
export const onlineConfigured = () => mollie.mollieConfigured() || bc.bcConfigured();
export const providerNaam = () => (mollie.mollieConfigured() ? "Mollie" : "Bancontact");
export const maakBetaling = a => P().maakBetaling(a);
export const haalBetaling = id => (String(id).startsWith("tr_") ? mollie.haalBetaling(id) : bc.haalBetaling(id));
export const EIND = new Set(["SUCCEEDED", "FAILED", "EXPIRED", "CANCELLED", "AUTHORIZATION_FAILED", "VOIDED"]);
