# Gigant-Welt – Labor

Riesige, grab- und baubare Welt im Browser (Single-File, Three.js 0.170).
Ausprobieren: https://oitow.github.io/pag/labore/gigantwelt/

## Technik (Kurz)
- **Fern-Terrain:** GPU-Clipmap, 10 LOD-Ringe (bis ~32 km), Höhe per Gradient-Noise im Vertex-Shader, CDLOD-Morph gegen Risse.
  CPU-Noise (`heightAt`) ist bit-gleich zur GPU (`GLSL_NOISE`) – für Platzierung und Physik.
- **Nahzone (40–80 m):** Voxel 0,5 m, Chunks 16 m (32³), Surface Nets, Materialien (Erde, Gras, Stein, Sand, Lehm, Holz),
  AO + Himmelsverdeckung im Vertex. Edits = Liste von Operationen (Graben/Auftragen/Ebnen, Kugel/Würfel), pro Chunk indiziert und
  beim Neuerzeugen wiederholt. Terrain wird über eine 32×32-Masken-Textur dort ausgeblendet, wo Voxel fertig sind.
- **Bäume:** 2 Arten (Mammut 45–100 m, Urwaldriese mit Brettwurzeln), je 3 LODs, Instancing, Sichtkegel-Culling,
  Schatten-Proxies (Layer 1) nur im Nahbereich, ferne Bäume sinken weich ein + Waldfarbe im Terrain bis zum Horizont.
- **Gras/Büsche/Steine:** gecachte Zellen (16/32 m), zeitlich gestaffelte Erzeugung, Wind im Shader.
- Auto-Auflösung, Qualitätsstufen Niedrig/Mittel/Hoch, HUD mit FPS/Dreiecken/Draws.

## Offen / Ideen
Speichern (localStorage), Bäume fällen, echte Höhlen, Worker fürs Meshing, schöneres Licht/Nebel, Wasser.
Wiederverwendbares später nach `engine/world/` (Clipmap, Voxel-Nahzone) – siehe AGENTS.md „Neues Wiederverwendbares → Engine“.
