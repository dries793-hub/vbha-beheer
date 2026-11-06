import { admin, sendError, httpErr } from "./sb.js";
import { algemeen, actieveLeden, zoekLeden } from "./publiek.js";

// Naamsuggesties voor de inschrijfpagina's (banket, kinderfeest): GET ?q=pee → [{id, naam}]
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "GET") throw httpErr(405, "Gebruik GET");
    const sb = admin();
    const A = await algemeen(sb);
    res.status(200).json(zoekLeden(await actieveLeden(sb, A.jaar), String(req.query?.q || "").slice(0, 60)));
  } catch (e) { sendError(res, e); }
}
