# Siedlung

Aufbauspiel im Stil von Manor Lords, aber anders. Mobil im Hochformat, Single-File `index.html` mit Three.js (CDN).

## Features
- Prozedurale Insel: Buchten, Erosion, Fluss, Seen, Biome (Wiese, Wald, Birken, Heide, Sumpf, Fels, Schnee)
- Trampelpfade entstehen dort, wo NPCs laufen; gepflasterte Wege per Malen
- Ressourcen: Holz, Stein, Bretter, Nahrung (Beeren, Fisch, Fleisch, Brot)
- Ketten: Acker → Mühle → Bäckerei, Sägewerk, Fischer, Jäger
- Benannte Dorfbewohner, Zufriedenheit, Tag/Nacht, Jahreszeiten
- Weiler → Dorf → Kleinstadt, 18 Aufgaben, Speichern im Browser
- Tiere, Wolken, Sternenhimmel, Wind in Pflanzen, Auto-Qualität
- Malerische Low-Poly-Natur (Abschnitt „Natur-Geometrie“): verbeulte Knubbel-Kronen mit Fake-AO per Vertexfarbe (innen/unten dunkel, oben hell), sichtbare Stämme und Äste; Eiche breit, Birke schlank mit dunklen Flecken, Tanne mit hängenden Etagen, Kiefer mit Schirm-Polstern; Dürrständer und Jungbäume; je Baum eigene Breite/Höhe/Neigung; einfachere Kronen bei niedriger Auto-Qualität (`setVegLOD`)
- Felsen mit Schichtstufen, Moos und Kieseln; Beerenbüsche, Farne im Wald, Grashalme, Blumen, Rohrkolben, Fliegenpilze, bemooste Totholzstämme
- Dorfbewohner mit Kittel, Gürtel, Hautton, Haar/Kapuze/Hut; Rehe mit Gelenkbeinen und Geweih (Böcke), Hasen mit langen Ohren, Vögel mit Flügeln

## Steuerung
1 Finger verschieben · 2 Finger zoomen/drehen · Gebäude antippen für Info

## Tests
`tests/` enthält einen Node-Testlauf mit Fake-THREE (`sh tests/mk.sh`, dann `node tests/drive2.mjs`).
