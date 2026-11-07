// Minimale SMTP-client (TLS op poort 465, AUTH LOGIN) zonder extra pakketten.
// Nodig in Vercel: SMTP_HOST (bv. send.one.com), SMTP_PORT (465), SMTP_USER, SMTP_PASS. Optioneel: MAIL_FROM_NAAM.
import tls from "node:tls";
import crypto from "node:crypto";

export const smtpConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
export const afzender = () => ({ email: String(process.env.SMTP_FROM || process.env.SMTP_USER || "").trim(), naam: String(process.env.MAIL_FROM_NAAM || "").trim() });

const b64 = s => Buffer.from(String(s), "utf8").toString("base64");
const hdr = s => /^[\x20-\x7e]*$/.test(s) ? s : "=?UTF-8?B?" + b64(s) + "?=";
const adres = (email, naam) => (naam ? hdr(naam.replace(/["\r\n]/g, "")) + " " : "") + "<" + email + ">";
const wrap = s => s.replace(/.{1,76}/g, "$&\r\n");
const ENT = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", bull: "•", euro: "€", middot: "·", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", hellip: "…", euml: "ë", eacute: "é", egrave: "è", ouml: "ö", iuml: "ï" };
// Leesbare tekstversie (spamfilters wantrouwen mails zonder of met een lege tekstversie): links blijven zichtbaar als "tekst (adres)".
const tekstVan = html => String(html)
  .replace(/<head[\s\S]*?<\/head>/i, "").replace(/<(style|script)[\s\S]*?<\/\1>/gi, "").replace(/<!--[\s\S]*?-->/g, "")
  .replace(/<div[^>]*data-pre[^>]*>[\s\S]*?<\/div>/i, "")
  .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, h, t) => { const tt = t.replace(/<[^>]+>/g, "").trim(); h = h.replace(/^mailto:/i, "").split("?")[0]; return tt && tt !== h ? tt + " (" + h + ")" : h; })
  .replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|h\d|li|tr|table)>/gi, "\n").replace(/<li[^>]*>/gi, "- ").replace(/<[^>]+>/g, "")
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&([a-z]+);/gi, (m, n) => ENT[n] ?? m)
  .split("\n").map(l => l.replace(/[ \t ]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim();

// bijlagen: [{naam, type, data: Buffer}] -> multipart/mixed met daarin de tekst- en html-versie.
export function bouwBericht({ van, aan, aanNaam, onderwerp, html, antwoordAan, bijlagen }) {
  const grens = "vbha-" + crypto.randomBytes(8).toString("hex");
  const buiten = "vbhm-" + crypto.randomBytes(8).toString("hex");
  const mixed = Array.isArray(bijlagen) && bijlagen.length > 0;
  const domein = van.email.split("@")[1] || "localhost";
  const volledig = /<html/i.test(html) ? html : `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
  return [
    "From: " + adres(van.email, van.naam),
    "To: " + adres(aan, aanNaam),
    ...(antwoordAan ? ["Reply-To: " + antwoordAan] : []),
    // Afmeldlink in de kop: Gmail, Outlook en Apple Mail tonen dan een nette "Afmelden"-knop in plaats van "Spam melden".
    "List-Unsubscribe: <mailto:" + (process.env.MAIL_AFMELDEN || van.email) + "?subject=Afmelden%20mails%20VBHA>",
    "X-Auto-Response-Suppress: OOF, AutoReply",
    "Subject: " + hdr(onderwerp),
    "Date: " + new Date().toUTCString().replace("GMT", "+0000"),
    // Gewone vorm (tijd.teller.willekeurig) i.p.v. een UUID: SpamAssassin vindt een UUID-achtige ID verdacht.
    "Message-ID: <" + new Date().toISOString().replace(/\D/g, "").slice(0, 14) + "." + crypto.randomBytes(5).toString("hex") + ".vbha@" + domein + ">",
    "MIME-Version: 1.0",
    ...(mixed ? [`Content-Type: multipart/mixed; boundary="${buiten}"`, "", "--" + buiten] : []),
    `Content-Type: multipart/alternative; boundary="${grens}"`,
    "",
    "--" + grens, "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64", "", wrap(b64(tekstVan(volledig))),
    "--" + grens, "Content-Type: text/html; charset=utf-8", "Content-Transfer-Encoding: base64", "", wrap(b64(volledig)),
    "--" + grens + "--",
    ...(mixed ? bijlagen.flatMap(a => {
      const naam = String(a.naam || "bijlage").replace(/["\r\n]/g, "");
      const kop = /^[\x20-\x7e]*$/.test(naam) ? `"${naam}"` : `"${hdr(naam)}"`;
      return ["", "--" + buiten, `Content-Type: ${a.type || "application/octet-stream"}; name=${kop}`, "Content-Transfer-Encoding: base64", `Content-Disposition: attachment; filename=${kop}`, "", wrap(Buffer.from(a.data).toString("base64")).replace(/\r\n$/, "")];
    }).concat(["--" + buiten + "--"]) : []),
    "",
  ].join("\r\n");
}

// Opent één verbinding en verstuurt de berichten na elkaar. Geeft per bericht {ok, fout} terug.
export async function verstuur(berichten) {
  const host = process.env.SMTP_HOST, port = Number(process.env.SMTP_PORT) || 465;
  const sock = tls.connect({ host, port, servername: host });
  sock.setEncoding("utf8");
  let buf = "", wacht = null;
  sock.on("data", d => { buf += d; check(); });
  const fout = new Promise((_, rej) => { sock.on("error", rej); sock.setTimeout(20000, () => rej(new Error("SMTP time-out"))); });
  fout.catch(() => {});
  function check() {
    if (!wacht) return;
    const lines = buf.split("\r\n"); const done = lines.findIndex(l => /^\d{3} /.test(l));
    if (done < 0) return;
    const resp = lines.slice(0, done + 1).join("\n"); buf = lines.slice(done + 1).join("\r\n");
    const w = wacht; wacht = null; w(resp);
  }
  const lees = () => Promise.race([new Promise(r => { wacht = r; check(); }), fout]);
  const cmd = async (c, verwacht) => { if (c != null) sock.write(c + "\r\n"); const r = await lees(); if (!String(r).startsWith(String(verwacht))) throw new Error("SMTP: " + String(r).split("\n").pop()); return r; };
  const uit = [];
  try {
    await cmd(null, 220);
    await cmd("EHLO vbha-beheer", 250);
    await cmd("AUTH LOGIN", 334);
    await cmd(b64(process.env.SMTP_USER), 334);
    await cmd(b64(process.env.SMTP_PASS), 235);
    const van = afzender();
    for (const m of berichten) {
      try {
        await cmd(`MAIL FROM:<${van.email}>`, 250);
        await cmd(`RCPT TO:<${m.aan}>`, 25);
        await cmd("DATA", 354);
        const data = bouwBericht({ van, ...m }).replace(/^\./gm, "..");
        await cmd(data + "\r\n.", 250);
        uit.push({ ok: true });
      } catch (e) { uit.push({ ok: false, fout: e.message }); try { await cmd("RSET", 250); } catch {} }
    }
    try { sock.write("QUIT\r\n"); } catch {}
  } finally { sock.end(); }
  return uit;
}
