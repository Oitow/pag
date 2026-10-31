# Siedlung

Aufbauspiel im Stil von Manor Lords, aber anders. Mobil im Hochformat, Single-File `index.html` mit Three.js (CDN).

## Features
- Prozedurale Insel: Buchten, Erosion, Fluss, Seen, Biome (Wiese, Wald, Birken, Heide, Sumpf, Fels, Schnee)
- Trampelpfade entstehen dort, wo NPCs laufen; gepflasterte Wege per Malen
- Ressourcen: Holz, Stein, Bretter, Nahrung (Beeren, Fisch, Fleisch, Brot)
- Ketten: Acker → Mühle → Bäckerei, Sägewerk, Fischer, Jäger
- Handwerk: Erzmine (an Felsen) → Schmiede → Werkzeug (Arbeit 25 % schneller), Lehmgrube (am Wasser) → Ziegelei → Ziegel, Schäferei mit Schafen → Weberei → Kleidung (+Zufriedenheit)
- Lagerplatz je Ware (Lager +150, Speicher +300), Ziegelhaus für 6 Bewohner
- Benannte Dorfbewohner, Zufriedenheit, Tag/Nacht, Jahreszeiten
- Weiler → Dorf → Kleinstadt, 23 Aufgaben, Speichern im Browser
- Tiere, Wolken, Sternenhimmel, Wind in Pflanzen, Auto-Qualität

## Steuerung
1 Finger verschieben · 2 Finger zoomen/drehen · Gebäude antippen für Info

## Tests
`tests/` enthält einen Node-Testlauf mit Fake-THREE (`sh tests/mk.sh`, dann `node tests/drive2.mjs`).
