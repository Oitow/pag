# Engine-Changelog

## 2026-11 – Weltengine: Chunk-Flüsse und Schnappschüsse
- world/worldgen/worldgen-chunkfluss 1.0.0 (neu): chunk-lokale Flussnetze aus einem Knotengitter (Seed + Position), begrenzter Zufluss, Überlauf flacher Senken, kleine Seen in Senken – nahtlos ohne globale Stufen
- world/worldgen/worldgen-chunks 1.1.0 (additiv): Flussmodus 'netz' ist Standard (alter Modus über `chunk.flussModus: 'rauschen'`, Werte dort unverändert); Chunks liefern zusätzlich `wasser` und `seen`, neu `seenIn()`, `dispose()`, `samplePunkt` füllt optional `aus[8]` (Wasserspiegel). Signaturen von generateChunk/sampleHeight unverändert, die Höhenwerte im Standardmodus ändern sich.
- world/worldgen/worldgen-presets 1.1.0: neue Optionen `chunk.flussModus`, `chunk.netz`
- worldgen-snapshot.test.mjs: Hash-Schnappschüsse für 8 Presets und beide Chunk-Flussmodi
- games/weltlabor: Chunk-Modus nutzt Wasserspiegel und Seen aus den Chunks

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
