import tls from "node:tls";

/* Kleine IMAP-client (TLS, poort 993) en MIME-lezer, zonder extra pakketten.
   Genoeg om nieuwe mails op te halen, de bijlagen eruit te halen en ze als gelezen te markeren. */

export class Imap {
  constructor({ host, port = 993, rejectUnauthorized = true }) { this.o = { host, port, rejectUnauthorized }; this.n = 0; this.buf = Buffer.alloc(0); this.wacht = null; }
  open(timeoutMs = 20000) {
    return new Promise((ok, nok) => {
      const s = tls.connect({ host: this.o.host, port: this.o.port, servername: this.o.host, rejectUnauthorized: this.o.rejectUnauthorized });
      this.s = s; s.setTimeout(timeoutMs, () => { s.destroy(new Error("IMAP: time-out")); });
      s.on("data", d => { this.buf = Buffer.concat([this.buf, d]); this._pomp(); });
      s.on("error", e => { if (this.wacht) { const w = this.wacht; this.wacht = null; w.nok(e); } else nok(e); });
      s.on("close", () => { if (this.wacht) { const w = this.wacht; this.wacht = null; w.nok(new Error("IMAP: verbinding gesloten")); } });
      this.wacht = { tag: null, delen: [], ok: () => ok(), nok };
      this._pomp();
    });
  }
  // leest regels; literals {n} worden als Buffer bewaard
  _pomp() {
    const w = this.wacht; if (!w) return;
    for (;;) {
      if (w.literal != null) {
        if (this.buf.length < w.literal) return;
        w.delen.push(this.buf.subarray(0, w.literal)); this.buf = this.buf.subarray(w.literal); w.literal = null; continue;
      }
      const i = this.buf.indexOf("\r\n"); if (i < 0) return;
      const lijn = this.buf.subarray(0, i).toString("latin1"); this.buf = this.buf.subarray(i + 2);
      w.delen.push(lijn);
      const m = lijn.match(/\{(\d+)\}$/); if (m) { w.literal = Number(m[1]); continue; }
      if (w.tag === null && /^\* (OK|PREAUTH)/i.test(lijn)) { this.wacht = null; return w.ok(w.delen); }
      if (w.tag && lijn.startsWith(w.tag + " ")) {
        this.wacht = null;
        if (/^\S+ OK/i.test(lijn)) return w.ok(w.delen);
        return w.nok(new Error("IMAP: " + lijn.replace(/^\S+\s+/, "").slice(0, 200)));
      }
    }
  }
  cmd(c) {
    return new Promise((ok, nok) => {
      const tag = "V" + String(++this.n).padStart(3, "0");
      this.wacht = { tag, delen: [], ok, nok };
      this.s.write(`${tag} ${c}\r\n`);
      this._pomp();
    });
  }
  static q(s) { return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'; }
  async login(user, pass) { await this.cmd(`LOGIN ${Imap.q(user)} ${Imap.q(pass)}`); }
  async select(map = "INBOX", { alleenLezen = false } = {}) {
    const r = await this.cmd(`${alleenLezen ? "EXAMINE" : "SELECT"} ${Imap.q(map)}`);
    const t = r.filter(x => typeof x === "string").join("\n");
    return { uidValidity: Number((t.match(/UIDVALIDITY (\d+)/i) || [])[1] || 0), bestaat: Number((t.match(/\* (\d+) EXISTS/i) || [])[1] || 0) };
  }
  // kop + grootte zonder de mail als gelezen te markeren
  async kop(uid) {
    const r = await this.cmd(`UID FETCH ${uid} (RFC822.SIZE BODY.PEEK[HEADER.FIELDS (FROM SUBJECT MESSAGE-ID DATE CONTENT-TYPE)])`);
    const t = r.filter(x => typeof x === "string").join(" "), k = r.find(x => Buffer.isBuffer(x));
    return { grootte: Number((t.match(/RFC822\.SIZE (\d+)/i) || [])[1] || 0), kop: k ? k.toString("latin1") : "" };
  }
  async zoek(criteria = "UNSEEN") {
    const r = await this.cmd(`UID SEARCH ${criteria}`);
    const l = r.find(x => typeof x === "string" && /^\* SEARCH/i.test(x)) || "";
    return l.replace(/^\* SEARCH/i, "").trim().split(/\s+/).filter(Boolean).map(Number);
  }
  async haal(uid) {
    const r = await this.cmd(`UID FETCH ${uid} (BODY.PEEK[])`);
    return r.find(x => Buffer.isBuffer(x)) || null;
  }
  async gelezen(uid) { await this.cmd(`UID STORE ${uid} +FLAGS.SILENT (\\Seen)`); }
  async sluit() { try { await this.cmd("LOGOUT"); } catch (e) {} try { this.s.end(); } catch (e) {} }
}

/* ---------- MIME ---------- */
function woorden(s) { // RFC 2047 =?utf-8?B?...?= / =?iso-8859-1?Q?...?=
  return String(s || "").replace(/\?=\s+=\?/g, "?==?").replace(/=\?([^?]+)\?([bqBQ])\?([^?]*)\?=/g, (m, cs, enc, t) => {
    try {
      const b = enc.toUpperCase() === "B" ? Buffer.from(t, "base64") : Buffer.from(t.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (x, h) => String.fromCharCode(parseInt(h, 16))), "latin1");
      return new TextDecoder(/utf-?8/i.test(cs) ? "utf-8" : /1252/.test(cs) ? "windows-1252" : "latin1").decode(b);
    } catch (e) { return t; }
  });
}
export function koppen(tekst) {
  const H = {}; let laatst = null;
  for (const l of tekst.split(/\r?\n/)) {
    if (/^[ \t]/.test(l) && laatst) { H[laatst] += " " + l.trim(); continue; }
    const i = l.indexOf(":"); if (i < 1) continue;
    laatst = l.slice(0, i).trim().toLowerCase(); H[laatst] = (H[laatst] ? H[laatst] + ", " : "") + l.slice(i + 1).trim();
  }
  return H;
}
function param(h, naam) {
  if (!h) return "";
  const s = String(h);
  // RFC 2231: filename*=utf-8''... (ook in stukken filename*0*=)
  const st = [...s.matchAll(new RegExp(naam + "\\*(\\d+)?\\*?=([^;]+)", "gi"))];
  if (st.length) {
    let v = st.map(m => m[2].trim().replace(/^"|"$/g, "")).join("");
    const m = v.match(/^([^']*)'[^']*'(.*)$/); if (m) { try { v = new TextDecoder(/utf-?8/i.test(m[1]) || !m[1] ? "utf-8" : "latin1").decode(Buffer.from(m[2].replace(/%([0-9a-f]{2})/gi, (x, h) => String.fromCharCode(parseInt(h, 16))), "latin1")); } catch (e) { v = m[2]; } }
    return v;
  }
  const m = s.match(new RegExp("(?:^|;)\\s*" + naam + "\\s*=\\s*(\"([^\"]*)\"|[^;]+)", "i"));
  return m ? woorden((m[2] ?? m[1]).trim()) : "";
}
function decodeer(body, cte) {
  cte = String(cte || "").toLowerCase();
  if (cte === "base64") return Buffer.from(body.replace(/[^A-Za-z0-9+/=]/g, ""), "base64");
  if (cte === "quoted-printable") return Buffer.from(body.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (m, h) => String.fromCharCode(parseInt(h, 16))), "latin1");
  return Buffer.from(body, "latin1");
}
// geeft {koppen, bijlagen:[{naam,type,data}], tekst}
export function leesMail(raw, diepte = 0) {
  const s = Buffer.isBuffer(raw) ? raw.toString("latin1") : String(raw);
  const i = s.search(/\r?\n\r?\n/); const kop = i < 0 ? s : s.slice(0, i), rest = i < 0 ? "" : s.slice(i).replace(/^\r?\n\r?\n/, "");
  const H = koppen(kop), ct = H["content-type"] || "text/plain", type = ct.split(";")[0].trim().toLowerCase();
  const uit = { koppen: H, bijlagen: [], tekst: "" };
  if (type.startsWith("multipart/")) {
    const g = param(ct, "boundary"); if (!g) return uit;
    const delen = rest.split(new RegExp("\\r?\\n?--" + g.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:--)?[ \\t]*(?:\\r?\\n|$)")).slice(1);
    for (const d of delen) { if (!d.trim()) continue; const r = leesMail(d, diepte + 1); uit.bijlagen.push(...r.bijlagen); if (!uit.tekst && r.tekst) uit.tekst = r.tekst; }
    return uit;
  }
  if (type === "message/rfc822" && diepte < 5) { const r = leesMail(decodeer(rest, H["content-transfer-encoding"]), diepte + 1); uit.bijlagen.push(...r.bijlagen); uit.tekst = r.tekst; return uit; }
  const disp = H["content-disposition"] || "";
  const naam = param(disp, "filename") || param(ct, "name");
  const data = decodeer(rest, H["content-transfer-encoding"]);
  if (naam || /^attachment/i.test(disp) || type === "application/pdf") uit.bijlagen.push({ naam: naam || "bijlage", type, data });
  else if (type === "text/plain") uit.tekst = data.toString(/utf-?8/i.test(param(ct, "charset")) || !param(ct, "charset") ? "utf8" : "latin1");
  return uit;
}
export const kopTekst = woorden;
export function adres(h) { const s = woorden(h || ""), m = s.match(/<([^>]+)>/); return { naam: m ? s.replace(/<[^>]*>/, "").replace(/"/g, "").trim() : "", email: (m ? m[1] : s).trim().toLowerCase() }; }
