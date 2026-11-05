import { requireUser, sendError, httpErr } from "../_lib/sb.js";
import { configured, eb } from "../_lib/enable.js";

// Lijst van Belgische banken die Enable Banking ondersteunt.
export default async function handler(req, res) {
  try {
    await requireUser(req);
    if (!configured()) throw httpErr(501, "Enable Banking is nog niet ingesteld");
    const country = String(req.query.country || "BE").toUpperCase().slice(0, 2);
    const r = await eb(`/aspsps?country=${encodeURIComponent(country)}&service=AIS`);
    const aspsps = (r.aspsps || []).map(a => ({ name: a.name, country: a.country, psu_types: a.psu_types, maximum_consent_validity: a.maximum_consent_validity }));
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.status(200).json({ aspsps });
  } catch (e) { sendError(res, e); }
}
