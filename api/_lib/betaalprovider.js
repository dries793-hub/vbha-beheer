// Online betalen gebeurt uitsluitend via Bancontact Pay (BANCONTACT_API_KEY). Geen andere betaalprovider.
import * as bc from "./bancontact.js";

export const onlineConfigured = () => bc.bcConfigured();
export const providerNaam = () => "Bancontact";
export const maakBetaling = a => bc.maakBetaling(a);
export const haalBetaling = id => bc.haalBetaling(id);
export const EIND = new Set(["SUCCEEDED", "FAILED", "EXPIRED", "CANCELLED", "AUTHORIZATION_FAILED", "VOIDED"]);
