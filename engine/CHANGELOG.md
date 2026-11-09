# Engine-Changelog

## 2026-11 – Himmel, Tag/Nacht, Wetter
- world/sky 1.0.0: Shader-Himmelskuppel (Verlauf, Sonne mit Glut, Mond, funkelnde Sterne, Nebelband am Horizont) – Idee aus siedlung übernommen
- world/daynight 1.0.0: Tageszeit 0..24 h mit Geschwindigkeit/Pause; reine Rechnung `tageszeitZustand` (ohne THREE) für Sonnen-/Mondrichtung, Licht-, Umgebungs-, Nebel- und Himmelsfarben, Bewölkung
- world/weather 1.0.0: Regen als Linien-Partikel um die Kamera, Nebel je Wetterstärke, Bewölkungswert für daynight
- games/testwelt: Himmel + Tag/Nacht + Wetter eingebaut (Uhrzeit-Regler, Zeit-Pause, Wetterknopf)

## 2026-11 – Testwelt
- world/worldgen/worldgen-adapter 1.0.0: Welt in Metern für Figuren/Kamera (bodenHoehe, wasserHoehe, hindernisse, Startpunkt) – passt zu docs/FIGUREN-SYSTEM.md
- world/terrain-mesh 1.0.0: Gelände mit Biomfarben, Seen/Flüsse, Meer
- world/scatter-mesh 1.0.0: Bäume, Büsche, Felsen … als InstancedMesh je Typ
- games/testwelt: begehbare 3D-Testwelt (Figurensystem-Steckplatz mit Platzhalter)

## 2026-11 – Phase 0
- core/rng 1.0.0, core/noise 1.0.0 (aus planet/js/noise.js, plus 2D-Simplex, fbm2, ridged2, warp2), core/math 1.0.0
- test/fake-dom 1.0.0 (Browser-Attrappe für Node-Tests; THREE läuft in Tests echt aus node_modules)
- world/worldgen 1.0.0: Weltgenerator-Pipeline (Form, Höhe, Erosion, Hydrologie, Flüsse, Klima, Biome, Orte, Objekte), 13 Presets, Chunk-Modus, Abfragen, A*-Wegsuche, Worker-Übergabe
- games/weltlabor: Vorschauseite für den Weltgenerator
- Werkzeuge: tools/katalog.mjs (Katalog + Prüfung + Schichtregeln), tools/build.mjs (esbuild → dist/<spiel>.html), tests/smoke.mjs
