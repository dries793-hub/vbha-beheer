// Online betalen gebeurt uitsluitend via Bancontact Pay (BANCONTACT_API_KEY). Geen andere betaalprovider.
import * as bc from "./bancontact.js";

export const onlineConfigured = () => process.env.VBHA_TEST !== "1" && process.env.VERCEL_ENV !== "preview" && bc.bcConfigured(); // testomgeving: geen echte betalingen
export const providerNaam = () => "Bancontact";
export const maakBetaling = a => bc.maakBetaling(a);
export const haalBetaling = id => bc.haalBetaling(id);
export const EIND = new Set(["SUCCEEDED", "FAILED", "EXPIRED", "CANCELLED", "AUTHORIZATION_FAILED", "VOIDED"]);
