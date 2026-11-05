import { admin } from "../_lib/sb.js";
import { eb } from "../_lib/enable.js";

// De bank stuurt de gebruiker hierheen terug met ?code=...&state=...
export default async function handler(req, res) {
  const site = String(process.env.SITE_URL || "").replace(/\/+$/, "");
  const terug = (ok, reden) => res.redirect(302, `${site}/?bank=${ok ? "ok" : "fout"}${reden ? "&reden=" + encodeURIComponent(reden) : ""}#bank`);
  try {
    const { code, state, error, error_description } = req.query;
    if (error) return terug(false, error_description || error);
    if (!code || !state) return terug(false, "geen code ontvangen");
    const sb = admin();
    const { data: st } = await sb.from("bank_auth").select("*").eq("state", state).maybeSingle();
    if (!st) return terug(false, "onbekende of verlopen aanvraag");
    await sb.from("bank_auth").delete().eq("state", state);
    const s = await eb("/sessions", { method: "POST", body: { code } });
    const accounts = (s.accounts || []).map(a => ({
      uid: a.uid || a, iban: a.account_id?.iban || "", naam: a.name || a.product || "", valuta: a.currency || "EUR",
    }));
    const { error: e2 } = await sb.from("bank_koppelingen").upsert({
      id: s.session_id,
      data: { aspsp: s.aspsp?.name || st.data?.aspsp || "", psu_type: s.psu_type, valid_until: s.access?.valid_until || null, accounts, gekoppeld_door: st.user_id, gekoppeld_op: new Date().toISOString(), laatste_sync: null },
    });
    if (e2) throw e2;
    return terug(true);
  } catch (e) {
    console.error(e);
    return terug(false, e.message?.slice(0, 120));
  }
}
