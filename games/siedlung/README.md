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
- Bevölkerung: Familien mit Nachnamen, Haushalte, Alter (Kinder wachsen zu Arbeitern heran, Ruhestand ab 66, Tod im Alter), Geburten bei Wohnraum + Nahrung + Zufriedenheit
- Gesundheit: Hunger und Kälte schwächen, Kräuterhütte 🌿 heilt; Kälte/Krankheit senken die Zufriedenheit
- Winter: Häuser heizen mit Brennholz 🔥 (Holzhacker) oder doppelt so viel Holz; kürzere Arbeitstage
- Jahreszeiten: Äcker wachsen Frühling–Sommer, Ernte bis Herbst, Frost vernichtet Ungeerntetes; Beeren saisonal; Jahreszeit + Jahr im HUD
- Ereignisse: Wanderer bitten um Aufnahme, Missernte, Hausbrand (Brunnen in der Nähe → Nachbarn löschen)
- Weiler → Dorf → Kleinstadt → Marktflecken → Stadt (Anforderungen: Einwohner, Zufriedenheit, Gebäude; gesperrte Gebäude zeigen ihre Bedingung), 23 Aufgaben, Speichern im Browser
- Ausbau: Haus → Fachwerkhaus, Bürgerhaus → Patrizierhaus, Werkstätten +1 Arbeitsplatz (Produktion 25 % schneller); Arbeiterzahl pro Gebäude mit −/+ wählbar
- Neue Gebäude: Kirche (Marktflecken), Denkmal (Stadt)
- 📊 Statistik: Bevölkerung, Zufriedenheit nach Faktoren, Vorräte mit Trend pro Minute + Sparklines; Trendpfeile in der Ressourcenleiste
- Einsteiger-Tipps (abschaltbar), ☰ → ⚙️ Optionen: Grafikstufe, Tempo, Ton (Platzhalter), Tutorial neu, Spielstand zurücksetzen
- Tiere, Wolken, Sternenhimmel, Wind in Pflanzen, Auto-Qualität
- Wetter: Sonnig / Bewölkt / Regen / Gewitter (Blitze, Sturm in Pflanzen) / Schnee (nur Winter), weiche Übergänge, Symbol im HUD (antippen = Info), wird gespeichert
  - Regen lässt Äcker ~35 % schneller wachsen, bei Gewitter pausieren die Fischer
  - Regen/Schnee als Shader-Partikel um die Kamera, Menge nach Auto-Qualität
- Jahreszeiten-Optik: Laubbäume färben sich im Herbst, Blüte im Frühling, Schneedecke auf Boden, Dächern und Bäumen im Winter, Blumen nur in der warmen Zeit
- Leben: Vogelschwärme + Zugvögel (V-Formation), Schornsteinrauch, springende Fische, Glühwürmchen in Sommernächten

## Steuerung
1 Finger verschieben · 2 Finger zoomen/drehen · Gebäude antippen für Info

## Tests
`tests/` enthält einen Node-Testlauf mit Fake-THREE (`sh tests/mk.sh`, dann `node tests/drive2.mjs`; außerdem `drive_econ.mjs`, `drive_pop.mjs`, `drive_ui.mjs`, `drive_weather.mjs`).
