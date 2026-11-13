/* Sociale media-iconen onderaan elke uitgaande mail (afbeeldingen op vbha.be/mail/, werken in alle mailprogramma's). */
const BASIS = "https://vbha.be";
const ICONEN = [["fb", "https://www.facebook.com/vbha.aalst", "Facebook"], ["ig", "https://www.instagram.com/vbha.aalst", "Instagram"], ["mail", "mailto:info@vbha.be", "Mail"]];
export function socialRij() {
  return `<!--vb-social--><table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto"><tr>${ICONEN.map(([k, u, t]) =>
    `<td style="padding:0 4px"><a href="${u}" target="_blank" style="text-decoration:none"><img src="${BASIS}/mail/${k}.png" width="26" height="26" alt="${t}" style="display:block;width:26px;height:26px;border:0"></a></td>`).join("")}</tr></table>`;
}
/* in een mail zonder iconen (bv. sjablonen uit de app) de iconen onderaan toevoegen */
export function metSocial(html) {
  const h = String(html || "");
  if (h.includes("<!--vb-social-->")) return h;
  const blok = `<div style="padding:18px 0 8px;text-align:center">${socialRij()}</div>`;
  return /<\/body>/i.test(h) ? h.replace(/<\/body>/i, blok + "</body>") : h + blok;
}
