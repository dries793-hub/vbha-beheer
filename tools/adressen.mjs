// Haalt de openbare adressen rond Aalst (gebied van de kalenderronde) op uit het Adressenregister (Digitaal Vlaanderen), voor de telling per straat (kalenders).
// Uitvoer: uit/aalst.tsv met straat, postcode, huisnummer, busnummer, status, lat, lng.
import fs from "fs";
fs.mkdirSync("uit", { recursive: true });
const W = "https://geo.api.vlaanderen.be/Adressenregister/wfs";
const rijen = [];
for (let start = 0; start < 200000; start += 10000) {
  const u = W + "?service=WFS&version=2.0.0&request=GetFeature&typeNames=Adressenregister:Adres&outputFormat=application/json&srsName=EPSG:4326&sortBy=ObjectId"
    + "&count=10000&startIndex=" + start + "&CQL_FILTER=" + encodeURIComponent("BBOX(AdresPositie,50.9045,3.9743,50.9998,4.0981,'EPSG:4326')");
  const r = await fetch(u); const t = await r.text(); let j;
  try { j = JSON.parse(t); } catch { fs.writeFileSync("uit/fout.txt", t.slice(0, 5000)); throw new Error("geen json"); }
  for (const f of j.features || []) { const p = f.properties, c = f.geometry ? f.geometry.coordinates : [null, null];
    rijen.push([p.Straatnaam, p.PostinfoObjectId + " " + p.Gemeentenaam, p.Huisnummer, p.Busnummer || "", p.AdresStatus, c[1], c[0]].join("\t")); }
  if ((j.features || []).length < 10000) break;
}
fs.writeFileSync("uit/aalst.tsv", rijen.join("\n"));
console.log(rijen.length);
