# Engine-Changelog

## 2026-11 – Gelände-LOD (Weltengine Teil 4)
- world/terrain-chunks 1.0.0: Gelände in Kacheln mit 4 LOD-Stufen nach Kameraabstand, Skirts gegen Risse, Frustum-Culling,
  Streaming um die Kamera mit Zeitbudget pro Frame, Objekte nur in nahen Kacheln; `debug()` liefert Kacheln, Dreiecke, Draw Calls
- world/terrain-lod 1.0.0 (reine Logik): LOD-Wahl mit Hysterese, Index-Puffer je LOD inkl. Skirts, Kachel-Planung, Warteschlange mit Budget
- world/terrain-quelle 1.0.0 (reine Logik): Höhen/Biome/Objekte je Kachel aus endlicher Welt oder Chunk-Generator, füllt Vertex-Puffer
- world/chunk-adapter 1.0.0: Welt-Adapter für den unendlichen Modus (gleiche Schnittstelle wie worldgen-adapter, Chunk-Cache)
- world/scatter-mesh 1.1.0: exportiert zusätzlich `formName` und `BLUMEN_FARBEN` (additiv)
- games/testwelt: Größe 512, Preset „unendlich“ über Chunks, Debug-Anzeige oben links (FPS, Kacheln, LOD, Dreiecke, Draw Calls)

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
