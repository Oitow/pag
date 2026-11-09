# Engine-Changelog

## 2026-11 – Phase 0
- core/rng 1.0.0, core/noise 1.0.0 (aus planet/js/noise.js, plus 2D-Simplex, fbm2, ridged2, warp2), core/math 1.0.0
- test/fake-dom 1.0.0 (Browser-Attrappe für Node-Tests; THREE läuft in Tests echt aus node_modules)
- Werkzeuge: tools/katalog.mjs (Katalog + Prüfung + Schichtregeln), tools/build.mjs (esbuild → dist/<spiel>.html), tests/smoke.mjs

## 2026-11 – Figuren-System (1.0.0, entwurf)
- render/mesh-builder; models/character: character-look, character-rig, character-parts, character-parts-kopf, character-model, character-pose, character-clips, character-gang, character-animator
- gameplay: character-motor, character-steering, character (Klebstoff); input: move-input, touch-stick; camera: follow-camera
- Vertrag: docs/FIGUREN-SYSTEM.md · Testspiel: games/figuren-labor
