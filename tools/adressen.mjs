// Haalt de openbare adressen van Aalst (Adressenregister, Digitaal Vlaanderen) op voor de telling per straat (kalenders).
import fs from "fs";
fs.mkdirSync("uit", { recursive: true });
const W = "https://geo.api.vlaanderen.be/Adressenregister/wfs";
const cap = await (await fetch(W + "?service=WFS&version=2.0.0&request=GetCapabilities")).text();
fs.writeFileSync("uit/cap.xml", cap);
const types = [...cap.matchAll(/<(?:wfs:)?Name>([^<]+)<\/(?:wfs:)?Name>/g)].map(m => m[1]);
fs.writeFileSync("uit/types.txt", types.join("\n"));
for (const t of types) {
  const d = await (await fetch(W + "?service=WFS&version=2.0.0&request=DescribeFeatureType&typeNames=" + encodeURIComponent(t))).text();
  fs.writeFileSync("uit/desc-" + t.replace(/\W/g, "_") + ".xml", d);
  const s = await (await fetch(W + "?service=WFS&version=2.0.0&request=GetFeature&count=3&outputFormat=application/json&typeNames=" + encodeURIComponent(t))).text();
  fs.writeFileSync("uit/voorbeeld-" + t.replace(/\W/g, "_") + ".json", s);
}
