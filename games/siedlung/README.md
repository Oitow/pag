# Siedlung

Aufbauspiel im Stil von Manor Lords, aber anders. Mobil im Hochformat, Single-File `index.html` mit Three.js (CDN).

## Features
- Prozedurale Insel: Buchten, Erosion, Fluss, Seen, Biome (Wiese, Wald, Birken, Heide, Sumpf, Fels, Schnee)
- Trampelpfade entstehen dort, wo NPCs laufen; gepflasterte Wege per Malen
- Ressourcen: Holz, Stein, Bretter, Nahrung (Beeren, Fisch, Fleisch, Brot)
- Ketten: Acker → Mühle → Bäckerei, Sägewerk, Fischer, Jäger
- Benannte Dorfbewohner, Zufriedenheit, Tag/Nacht, Jahreszeiten
- Bevölkerung: Familien mit Nachnamen, Haushalte, Alter (Kinder wachsen zu Arbeitern heran, Ruhestand ab 66, Tod im Alter), Geburten bei Wohnraum + Nahrung + Zufriedenheit
- Gesundheit: Hunger und Kälte schwächen, Kräuterhütte 🌿 heilt; Kälte/Krankheit senken die Zufriedenheit
- Winter: Häuser heizen mit Brennholz 🔥 (Holzhacker) oder doppelt so viel Holz; kürzere Arbeitstage
- Jahreszeiten: Äcker wachsen Frühling–Sommer, Ernte bis Herbst, Frost vernichtet Ungeerntetes; Beeren saisonal; Jahreszeit + Jahr im HUD
- Ereignisse: Wanderer bitten um Aufnahme, Missernte, Hausbrand (Brunnen in der Nähe → Nachbarn löschen)
- Weiler → Dorf → Kleinstadt, 18 Aufgaben, Speichern im Browser
- Tiere, Wolken, Sternenhimmel, Wind in Pflanzen, Auto-Qualität

## Steuerung
1 Finger verschieben · 2 Finger zoomen/drehen · Gebäude antippen für Info

## Tests
`tests/` enthält einen Node-Testlauf mit Fake-THREE (`sh tests/mk.sh`, dann `node tests/drive2.mjs`; Bevölkerung: `node tests/drive_pop.mjs`).
