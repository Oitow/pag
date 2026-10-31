# Siedlung

Aufbauspiel im Stil von Manor Lords, aber anders. Mobil im Hochformat, Single-File `index.html` mit Three.js (CDN).

## Features
- Prozedurale Insel: Buchten, Erosion, Fluss, Seen, Biome (Wiese, Wald, Birken, Heide, Sumpf, Fels, Schnee)
- Trampelpfade entstehen dort, wo NPCs laufen; gepflasterte Wege per Malen
- Ressourcen: Holz, Stein, Bretter, Nahrung (Beeren, Fisch, Fleisch, Brot)
- Ketten: Acker → Mühle → Bäckerei, Sägewerk, Fischer, Jäger
- Benannte Dorfbewohner, Zufriedenheit, Tag/Nacht, Jahreszeiten
- Weiler → Dorf → Kleinstadt → Marktflecken → Stadt (Anforderungen: Einwohner, Zufriedenheit, Gebäude; gesperrte Gebäude zeigen ihre Bedingung), 23 Aufgaben, Speichern im Browser
- Ausbau: Haus → Fachwerkhaus, Bürgerhaus → Patrizierhaus, Werkstätten +1 Arbeitsplatz (Produktion 25 % schneller); Arbeiterzahl pro Gebäude mit −/+ wählbar
- Neue Gebäude: Kirche (Marktflecken), Denkmal (Stadt)
- 📊 Statistik: Bevölkerung, Zufriedenheit nach Faktoren, Vorräte mit Trend pro Minute + Sparklines; Trendpfeile in der Ressourcenleiste
- Einsteiger-Tipps (abschaltbar), ☰ → ⚙️ Optionen: Grafikstufe, Tempo, Ton (Platzhalter), Tutorial neu, Spielstand zurücksetzen
- Tiere, Wolken, Sternenhimmel, Wind in Pflanzen, Auto-Qualität

## Steuerung
1 Finger verschieben · 2 Finger zoomen/drehen · Gebäude antippen für Info

## Tests
`tests/` enthält einen Node-Testlauf mit Fake-THREE (`sh tests/mk.sh`, dann `node tests/drive2.mjs` und `node tests/drive_ui.mjs` für Ausbau/Statistik/Stufen).
