# Gigant-Welt – Bauplan Runde 2 (23.11.2026)

Ziel: größer, höher, natürlicher, schöner, modularer – ohne Handy-Performance zu verlieren.
Budget Handy (Stufe „Mittel“): ≤ 1,5 M Dreiecke, ≤ 120 Draw Calls, 45+ FPS.

## Dateien und wer sie besitzt (ein Agent = ein Branch = eigene Dateien)
| Datei | Besitzer / Branch | Inhalt |
|---|---|---|
| `js/rauschen.js` | eingefroren (nur Hauptmodell) | Noise, `heightAt`, `GLSL_NOISE`, `FRAG_COMMON` – bleibt Referenz, bis `gelaende.js` integriert ist |
| `index.html` + `js/main.js`, `js/terrain.js`, `js/himmel.js`, `js/vegetation.js`, `js/voxel.js`, `js/bauen.js`, `js/spieler.js`, `js/hud.js` | A · `claude/gigantwelt-module` | Aufteilung der jetzigen Seite, Verhalten 1:1 |
| `js/baeume.js`, `js/bodenpflanzen.js`, `galerie.html` | B · `claude/gigantwelt-baeume` | neue Baum-/Pflanzen-Geometrien |
| `js/atmosphaere.js`, `himmel-test.html` | C · `claude/gigantwelt-himmel` | Himmel, Wolken, Tag/Nacht, Höhennebel |
| `js/gelaende.js`, `js/gelaende.test.mjs` | D · `claude/gigantwelt-gelaende` | neue Weltform + Biome (CPU + GLSL bit-gleich) |
Zusammenführen + Einbau macht das Hauptmodell (danach Runde 3).

## Verträge
**B – `js/baeume.js`**
- `export const BAUM_ARTEN = { mammut, urwald, eiche, kiefer, birke, … }` je `{ name, hoehe:[min,max], stamm: relRadiusBasis, biome:['wald','wiese',…] }`
- `export function baumGeometrie(art, lod)` → `THREE.BufferGeometry`, Höhe 1 (Basis y=0, Spitze y≈1), indiziert, Attribute nur
  `position`, `normal`, `color` (linear). Budgets: LOD0 ≤ 1200 Dreiecke, LOD1 ≤ 220, LOD2 ≤ 40. Deterministisch.
- `js/bodenpflanzen.js`: `export const PFLANZEN_ARTEN`, `export function pflanzenGeometrie(art)` (Farn, Blumen, Pilze, Totholz, Moos-Findling …),
  echte Größe in Metern, ≤ 150 Dreiecke, gleiche Attribute.
**C – `js/atmosphaere.js`**
- `export function createAtmosphaere({ scene, renderer, sonne, hemi })` → `{ setSonne(elevGrad, azGrad), setZeit(stunde), update(dt, camPos), sonnenRichtung: Vector3, dispose() }`
- Ersetzt den Himmel aus `himmel.js` (gleiches Verhalten über `setSonne`). Höhennebel global über ShaderChunk (`fog_pars_fragment`/`fog_fragment`),
  wirkt auf alle Lambert/Phong-Materialien. Kein Postprocessing, ein Draw Call für den Himmel.
**D – `js/gelaende.js`**
- `export function hoeheAt(x, z)`, `export function biomAt(x, z)` → `{ wald, wiese, fels, sand, schnee }` (Gewichte 0..1),
  `export const GLSL_GELAENDE` mit `float terrH(vec2 p, float sp)` und `float forestG(vec2 p, float h, float sp)` – gleiche Signaturen wie heute,
  damit Terrain/Voxel sie ohne Umbau nutzen. Baut auf `gn/fbm/ridged/ss/GLSL_NOISE` aus `rauschen.js` auf (importieren, nicht kopieren).
- `sp` = Oktaven-Ausblendung wie in `fbmG` (für grobe LOD-Ringe). Bei sp ≤ 2 m muss GPU = CPU sein (< 1 cm).

## Regeln für alle
Deutsch, Three 0.170 (Import-Map), nur eigene Dateien, ≤ 5 Tests, große Dateien nur per grep + Zeilenbereich lesen.
Bilder: `docs/TESTEN.md` „Cloud ohne Netz“ – Three liegt schon unter `/home/claude/three-src` (nur verlinken).
Am Ende: push auf den eigenen Branch, Bericht ≤ 10 Zeilen.

## Schnittstellen (Stand Aufteilung, Agent A)
Muster: `main.js` baut den Kontext `K` und ruft `createX(K)` in der Reihenfolge himmel, terrain, voxel, vegetation, spieler, bauen, hud.
Jedes Modul hängt sich als `K.<name>` ein; Querzugriffe (`K.veg…`, `K.vox…`) passieren erst zur Laufzeit, nie beim Erzeugen. Keine Globals außer `K`.
**K (main.js):** `isTouch, $, DPR, PRESETS, renderer, scene, camera, U` (fest) · `Q, qKey, maxPR, curPR, shadowsOn, pos, yaw, pitch, vy, fly, grounded, flySpeed, upIn, forceRebuild` (veränderlich) · `hemi, sun, SH` (von himmel) · `keys, joy, look` (von spieler) · `himmel, terrain, vox, veg, spieler, bauen, hud`.
| Modul | Exporte | nutzt von K |
|---|---|---|
| `himmel.js` `createHimmel` | `setSun(el,az)`, `placeShadowCam()`, `follow(pos)`, `updatePollen(now,dt)`, `pollen`, `sunDir` (+ Höhennebel-ShaderChunks, hemi/sun) | scene, camera, $, Q, shadowsOn, pos |
| `terrain.js` `createTerrain` | `LEVELS`, `water`, `build(N)`, `update(x,z)` (+Wasser folgt), `levels`, `markMaterials()` | scene, U |
| `voxel.js` `createVoxel` | `VS, CW, PAL, OPS, chunks, dens, raycast, pump, updateMask, evict, reset, applyEdits, scheduleSave, loadWorld, refreshStats, vstat, vOffsLen, vPtr` | scene, U (setzt uMask), $, Q, veg |
| `vegetation.js` `createVegetation` (+ `offsets`, `key`) | `treeL, bushL, grassL, layers, felled, stats, materials, pump, pending, evict, updView, rebuildTrees/Bushes/Grass, editOp, afterEdits, resetLayers, fellTree` | scene, camera, U, Q, yaw, pitch, SH, forceRebuild, vox |
| `spieler.js` `createSpieler` | `findSpawn, move(dt), toggleFly` | renderer, pos, Zustand (yaw…upIn), vox.dens, veg.treeL |
| `bauen.js` `createBauen` | `update(now)` | renderer, camera, scene, pos, fly, yaw, look, vox, veg |
| `hud.js` `createHud` | `update(now), applyQuality(key), setShadows(on), HINT` | renderer, sun, U, PRESETS, Q, Zustand, terrain, veg, vox, himmel |
Einbau-Hinweise: Himmel ersetzen = `himmel.js` austauschen (gleiche 6 Exporte). Baum-Geometrien (B) ersetzen die Funktionen `treeA/treeB/bushGeo/rockGeo/grassGeo` in `vegetation.js`. Gelände (D): `rauschen.js`-Import in terrain/voxel/vegetation/spieler/hud/main.
Hinweis: `vegetation.js` hat ~390 Zeilen (Geometrien + Zellen + Aufbau); beim Einbau von B natürlich teilbar.
