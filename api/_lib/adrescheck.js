/* Een volledig adres: straat, huisnummer, postcode (4 cijfers) en gemeente. */
export const adresVolledig = s => { s = String(s || "").trim(); return /[A-Za-zÀ-ÿ]{2,}/.test(s) && /\b[1-9]\d{3}\s+[A-Za-zÀ-ÿ'’][A-Za-zÀ-ÿ'’ .\-]+/.test(s) && /[A-Za-zÀ-ÿ.]\s*\d+\s*[A-Za-z]?\b(?=.*\b[1-9]\d{3}\b)/.test(s); };
export const ADRES_FOUT = "Vul je volledige adres in: straat, huisnummer, postcode en gemeente (bv. Kerkstraat 12, 9300 Aalst).";
