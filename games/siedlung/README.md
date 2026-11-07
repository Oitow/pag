# Siedlung

Aufbauspiel im Stil von Manor Lords, aber anders. Mobil im Hochformat, Single-File `index.html` mit Three.js (CDN).

## Features
- Prozedurale Insel (256×256 Felder, doppelte Kantenlänge; Spielstand-Version 2 – alte 128er-Stände werden mit Hinweis verworfen): Domain-Warp, Gratgebirge, Steilküsten neben Stränden, Tropfen-Erosion, 2–3 Flüsse (Dijkstra von Bergquellen bis ins Meer, mäandernd), Seen, Waldcluster mit Lichtungen, geglätteter Startplatz nahe Wasser und Wald; Biome (Wiese, Wald, Birken, Heide, Sumpf, Fels, Schnee)
- Engine (Stimmung: warmes Sonnenlicht, kühle Schatten, Dunst in Tälern):
  - Terrain in 64 Chunks à 32×32 Feldern mit 3 LOD-Stufen (Schürzen gegen Risse), Distanz-Culling hinter dem Nebel; Splatting-Shader (Fels an Hängen mit Schichtung, Sand, Erde/Pflaster, Waldboden, Makro-Variation, Detail-Normalen, Schnee/Nässe), Wege-Abnutzung und Äcker überträgt nur geänderte Chunks
  - Atmosphäre als globaler Shader-Patch aller Materialien: Distanz- + Höhennebel (Morgendunst), Sonnen-Streulicht, Farbkorrektur, Vignette und Filmkorn ohne Extra-Renderpass; ACES-Tonemapping
  - Wasser mit Tiefentextur, Fresnel, Himmelsreflexion, Sonnenglanz, Uferschaum und Wellennormalen
  - Schatten: enger, auf Texel gerasterter Ausschnitt folgt der Kamera
  - Statische Vegetation/Deko in räumlichen Chunks (`CInst`, gleiche API wie InstancedMesh) mit Frustum- und Distanz-Culling
  - Qualitätsstufen 0–3 (Auto bei < 30 fps): Pixeldichte (max. 1,5), Schattenauflösung, Terrain-LOD-Distanzen, einfacher Terrain-Shader, Gras-/Blumendichte, Sichtweiten, Korn
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
- Malerische Low-Poly-Natur (Abschnitt „Natur-Geometrie“): verbeulte Knubbel-Kronen mit Fake-AO per Vertexfarbe (innen/unten dunkel, oben hell), sichtbare Stämme und Äste; Eiche breit, Birke schlank mit dunklen Flecken, Tanne mit hängenden Etagen, Kiefer mit Schirm-Polstern; Dürrständer und Jungbäume; je Baum eigene Breite/Höhe/Neigung; einfachere Kronen bei niedriger Auto-Qualität (`setVegLOD`)
- Felsen mit Schichtstufen, Moos und Kieseln; Beerenbüsche, Farne im Wald, Grashalme, Blumen, Rohrkolben, Fliegenpilze, bemooste Totholzstämme
- Dorfbewohner mit Kittel, Gürtel, Hautton, Haar/Kapuze/Hut; Rehe mit Gelenkbeinen und Geweih (Böcke), Hasen mit langen Ohren, Vögel mit Flügeln
- Wetter: Sonnig / Bewölkt / Regen / Gewitter (Blitze, Sturm in Pflanzen) / Schnee (nur Winter), weiche Übergänge, Symbol im HUD (antippen = Info), wird gespeichert
  - Regen lässt Äcker ~35 % schneller wachsen, bei Gewitter pausieren die Fischer
  - Regen/Schnee als Shader-Partikel um die Kamera, Menge nach Auto-Qualität
- Jahreszeiten-Optik: Laubbäume färben sich im Herbst, Blüte im Frühling, Schneedecke auf Boden, Dächern und Bäumen im Winter, Blumen nur in der warmen Zeit
- Gebäude-Look: handgemachtes, raues Dorf – Fachwerk mit Streben, Steinsockel mit Ecksteinen, Dächer mit Dicke, Überstand und Durchhang (Reet mit ausgefranster Traufe, Ziegel, Schiefer, Schindeln, Moos), Läden, Blumenkästen, Türrahmen, Schornsteine und viel Kleinkram (Fässer, Kisten, Säcke, Holzstapel, Karren, Zäune, Werkzeug, Laternen)
  - 6 prozedurale Canvas-Texturen (256 px: Holz, Putz, Stein, Ziegel, Dachziegel, Reet), Vertexfarben mit Flächenrauschen und Boden-Schmutz, gedämpfte Farben; `bake()` fasst weiter pro Material zusammen (~3–8 Draw-Calls, ≲3k Dreiecke je Gebäude)
  - Wohnhäuser in 3 Varianten (Putzfarbe, Dachart, Läden, Requisiten), Auswahl per Position (`tmplFor`); Baustelle mit Gerüst und Leiter, Pflaster aus gewölbten Einzelsteinen, Weizen in Reihen, detailliertere Traglasten
- Leben: Vogelschwärme + Zugvögel (V-Formation), Schornsteinrauch, springende Fische, Glühwürmchen in Sommernächten

## Steuerung
1 Finger verschieben · 2 Finger zoomen/drehen · Gebäude antippen für Info

## Tests
`tests/` enthält einen Node-Testlauf mit Fake-THREE (`sh tests/mk.sh`, dann `node tests/drive2.mjs`; außerdem `drive_econ.mjs`, `drive_pop.mjs`, `drive_ui.mjs`, `drive_weather.mjs`).
