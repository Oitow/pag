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
- Wetter: Sonnig / Bewölkt / Regen / Gewitter (Blitze, Sturm in Pflanzen) / Schnee (nur Winter), weiche Übergänge, Symbol im HUD (antippen = Info), wird gespeichert
  - Regen lässt Äcker ~35 % schneller wachsen, bei Gewitter pausieren die Fischer
  - Regen/Schnee als Shader-Partikel um die Kamera, Menge nach Auto-Qualität
- Jahreszeiten-Optik: Laubbäume färben sich im Herbst, Blüte im Frühling, Schneedecke auf Boden, Dächern und Bäumen im Winter, Blumen nur in der warmen Zeit
- Leben: Vogelschwärme + Zugvögel (V-Formation), Schornsteinrauch, springende Fische, Glühwürmchen in Sommernächten

## Steuerung
1 Finger verschieben · 2 Finger zoomen/drehen · Gebäude antippen für Info

## Tests
`tests/` enthält einen Node-Testlauf mit Fake-THREE (`sh tests/mk.sh`, dann `node tests/drive2.mjs`; Wetter: `node tests/drive_weather.mjs`).
