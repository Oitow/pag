# 🌲 Der Dämmerwald – Bauplan (MMO-Startgebiet · echte Größe · SDF + Gauß-Splats)

> Neues Spiel `games/daemmerwald/`: Ankunft am Wasser → Pfad durch den Dämmerwald zwischen RIESIGEN Bäumen → Lichtung (später weiter zur Enklave).
> Ziel ist das **Gefühl von Größe** (Shadow of the Colossus), nicht Spielzeug. Regeln: `CLAUDE.md`, Stil: `docs/ART-DIRECTION.md`, Technik: `docs/RENDER-TECHNIK.md`.
> 3 Bau-Agenten parallel (A Splats · B SDF + Riesenbaum · C Szene), danach Integration + Sicht-Prüfung mit `node tools/bild.mjs`.

## 0 · Konventionen
- Meter, **y oben**. Ufer bei z ≈ 0, **Wasser im Süden (z < 0)**, der Pfad läuft nach **Norden (+z)** bis z ≈ 420. Breite x ∈ [−140, 140].
- Mensch = **1.8 m**. Alles andere wird daran gemessen – keine „gefühlten“ Größen.
- Zufall nur `engine/core/rng.js`. Modulkopf wie `engine/core/rng.js`. ≤ ~300 Zeilen je Datei. Fabrik `createX(opts)` + `dispose()`. Test daneben.
- **Meshes bestimmen** Kollision und Spiel. SDF formt die Meshes. Splats sind **nur Aussehen** (abschaltbar: `?splats=0`).
- Agenten schreiben nur ihre Dateien. NICHT anfassen: `KATALOG.md`, `CHANGELOG.md`, `docs/STAND.md`, `README.md`, `index.html` (macht der Integrator). Kein git commit.
- Kein PS1-Raster in diesem Spiel (weiche Formen, klare Auflösung). Three.js 0.170.0, WebGL2, kein WebGPU, keine fremden Bibliotheken.

## 1 · Maßstab (das Wichtigste)
| Ding | Maß |
|---|---|
| Riesenbaum | Höhe 90–140 m, Stamm Ø 9–14 m am Boden (über den Wurzeln), Wurzelanläufe 15–28 m weit, Wurzelrücken 1–5 m hoch |
| Krone | beginnt erst ab ~55 % der Höhe; unten ist der Stamm kahl (Säulenhalle) |
| Normaler Baum (Engine `baum`) | 8–16 m – steht als **Vergleich** zwischen den Riesen und reicht ihnen nicht mal bis zum ersten Ast |
| Farn / Pilz / Kiesel | 0.2–1.2 m – Kleinkram in echter Größe direkt am Pfad |
| Pfad | 2.5–3.5 m breit; Boot am Ufer 4.5 m; Laterne 2.2 m; Wanderer-Silhouette 1.8 m neben einer Wurzel |
Größe entsteht durch: (1) bekannte kleine Dinge neben großen, (2) **Luftperspektive** – ferne Stämme verblassen im Dunst zu Silhouetten,
(3) Details in mehreren Größenordnungen am selben Objekt (Rindenfurchen 0.3 m, Moospolster, Wurzeln, Stamm), (4) Kamera tief, Sichtfeld 50°, Fernebene ≥ 1500 m,
(5) man sieht die Krone nie ganz – sie verschwindet im Dunst, (6) langsame Bewegung in der Ferne (Vögel als Punkte, treibender Nebel).

## 2 · Ablauf / Orte (`?ort=…`)
| ort | z | Bild |
|---|---|---|
| `ufer` (Start) | 0 | Kiesstrand, Boot, stilles Wasser im Rücken; vor einem die Baumwand, 100 m hoch |
| `tor` | 70 | „Tor der Alten“: zwei Riesen links/rechts, der Pfad geht zwischen ihren Wurzeln hindurch |
| `bogen` | 160 | Wurzelbogen: eine Wurzel spannt sich über den Pfad (lichte Höhe ≥ 4 m) |
| `stamm` | 250 | gestürzter Riese liegt quer – der Pfad führt durch eine Kerbe / darüber |
| `lichtung` | 400 | Lichtung mit Lichtsäule und Menhir; Schild „Zur Enklave“ → Link `../enklave/` |
Licht: **Dämmerung**. Tiefe warme Sonne von Süd-West (vom Wasser her) wirft lange Lichtbahnen in den Wald; Schatten kühl blaugrün.
Glühwürmchen, leuchtende Pilze (biolumineszent, sparsam), Dunst in Bodennähe. Keine Aufgaben-Logik in Version 1 – nur gehen, schauen, staunen.

## 3 · Engine-Verträge (fest – Agenten bauen parallel dagegen)

### A · `engine/render/gauss-wolke.js` (+ `gauss-sortierung.js`, `gauss-saat.js`)
Echte 3D-Gauß-Splats, **prozedural erzeugt** (keine Scans): jeder Splat = Ellipsoid (Mitte, 3 Standardabweichungen in m, Drehung, Farbe, Deckkraft).
Gezeichnet als instanzierte Vierecke, 3D-Kovarianz → 2D-Kovarianz im Vertex-Shader (wie 3DGS), `exp(-0.5·d²)` im Fragment, vormultipliziertes Alpha,
hinten→vorn sortiert (Zähl-Sortierung auf Tiefe, gedrosselt), `depthTest` an, `depthWrite` aus → Meshes verdecken Splats korrekt.
```js
createGaussWolke({ max = 120000, sortiereAlle = 3, maxPixel = 220 }) -> {
  mesh,                       // THREE.Mesh, frustumCulled = false, renderOrder hoch – in die Szene hängen
  anzahl,
  fuege(daten, { matrix = null /* THREE.Matrix4: verschiebt/dreht/skaliert */, anteil = 1 /* 0..1 gleichmäßig ausdünnen */ } = {}) -> anzahl neu,
  leere(),
  setze({ nebelFarbe /* THREE.Color */, nebelDichte /* exp²-Dichte wie FogExp2 */, licht /* [r,g,b] Faktor */, wind /* 0..1 */ }),
  update(kamera, zeit, breitePx, hoehePx),   // sortiert bei Bedarf, setzt Uniformen
  dispose() }
```
`daten` (flach, lokal): `{ anzahl, position: Float32Array(3n), skala: Float32Array(3n), drehung: Float32Array(4n) /* Quaternion xyzw */, farbe: Float32Array(3n) /* linear 0..1 */, deck: Float32Array(n), wind: Float32Array(n) /* 0 = starr … 1 = wiegt */ }`
`gauss-saat.js` (rein, ohne THREE):
```js
createSplatDaten(start = 1024) -> { anzahl, plus(x,y,z, sx,sy,sz, qx,qy,qz,qw, r,g,b, deck, wind = 0), fertig() -> daten }
quatAusNormale(nx, ny, nz, dreh /* rad um die Normale */, out = [0,0,0,1]) -> out     // lokale z-Achse = Normale (flache Scheibe: sz klein)
saatAufNetz(ziel /* SplatDaten */, netz /* { position, normal, index } */, { anzahl, seed, groesse = [0.15, 0.5], flach = 0.25, abheben = 0.03, deck = 0.9, wind = 0,
            farbe /* (x,y,z,nx,ny,nz,zufall) -> [r,g,b] | null = hier keinen Splat */ }) -> gesetzt
```
`gauss-sortierung.js` (rein): `createTiefenSortierer(max) -> { sortiere(position /* Float32Array 3n */, anzahl, blick /* [x,y,z] */, auge /* [x,y,z] */) -> Uint32Array Reihenfolge hinten→vorn }`.
Budget: 120 k Splats müssen auf einem Mittelklasse-Handy flüssig bleiben → Splat-Größe am Bildschirm auf `maxPixel` begrenzen, winzige (< 1 px) verwerfen.

### B · `engine/core/sdf.js`, `engine/core/sdf-netz.js`, `engine/models/natur/riesenbaum.js` (+ `riesenbaum-form.js`)
```js
createSdf({ glatt = 0.6 }) -> {                                   // rein, schnell (flache Arrays, keine Objekte je Abtastung)
  kapsel(a, b, ra, rb = ra, glatt?), kugel(m, r, glatt?), ellipsoid(m, radien, glatt?),   // a, b, m = [x,y,z]; weiche Vereinigung (smooth-min)
  abzugKugel(m, r, glatt?),                                       // weiche Aushöhlung
  stoerung(fn /* (x,y,z) -> m, wird addiert: Rinde, Furchen */),
  abstand(x, y, z) -> m (innen negativ), normale(x, y, z, out) -> out, grenzen() -> { min, max } }
sdfNetz(sdf, { zelle = 0.5, grenzen = sdf.grenzen(), maxZellen = 3e6 }) -> { position, normal, index, dreiecke }     // Surface Nets, glatte Normalen aus dem Gradienten
sdfHoehenkarte(sdf, { zelle = 0.5, grenzen, maxHoehe = 6 }) -> { x0, z0, zelle, breite, tiefe, hoehe: Float32Array /* NaN = nichts */, hoeheBei(x, z) }
```
```js
createRiesenbaum({ seed, hoehe = 110, stammRadius = 5.5, wurzeln = 7, wurzelWeite = 22, detail = 1, bogen = false /* eine Wurzel als Bogen */ }) -> {
  geometrie,        // EINE BufferGeometry (position, normal, color): Wurzeln + Stammfuß bis ~30 m aus dem SDF-Netz, darüber verjüngter Stamm + dicke Hauptäste
  splats,           // daten (lokal, Baumfuß = Ursprung): Moos auf Wurzelrücken/Wetterseite, Flechten, Kronen-Laub als große weiche Blobs (wind > 0), Bartflechten
  kollision,        // { stammRadius, hoehenkarte } – Wurzeln sind begehbar, der Stamm ist ein Kreis-Hindernis
  masse,            // { hoehe, stammRadius, kronenAb, kronenRadius, grenzen }
  dispose() }
```
Die reine Form (Skelett + SDF, ohne THREE) liegt in `riesenbaum-form.js` und ist getestet (Determinismus, Maße, Budget).
Budget je Baum-Variante: ≤ 60 k Dreiecke, ≤ 9 k Splats, Bauzeit ≤ ~600 ms am PC. Die Szene baut 4–5 Varianten und instanziert sie.

### C · `games/daemmerwald/`
`index.html`, `spiel.json`, `README.md`, `js/main.js` (nur Verdrahtung), `js/gelaende.js` (Höhenfunktion + Netz + `bodenHoehe`), `js/plan-daten.js` (Pfad-Spline, Orte, Helden-Bäume – reine Daten),
`js/wald.js` (Riesen instanziert + Vergleichs-Bäume/Farn/Fels aus der Engine + Fern-Silhouetten), `js/licht.js` (Dämmerung, Dunst, Lichtbahnen, Glühwürmchen, Pilze), `js/figur.js` (Engine-Figur + Kamera, schlank).
URL: `?ort=ufer|tor|bogen|stamm|lichtung` · `?q=niedrig|mittel|hoch` · `?splats=0` · `?test=1` · `?debug`. Debug-Griff `window.daemmerwald`.
Qualität: `niedrig` 40 k Splats / Pixel ≤ 1 · `mittel` 90 k / ≤ 1.5 · `hoch` 160 k / ≤ 2; automatische Rückstufung über `engine/render/qualitaet.js`.
Draw-Calls Ziel ≤ 80. Hochformat am Handy muss funktionieren (Touch-Stick aus `engine/input/move-input.js`).

## 4 · Abnahme
1. `node --test` der neuen Module grün, `npm run test:schnell` grün.
2. `node tools/bild.mjs daemmerwald --query "?ort=<ort>&test=1"` für alle 5 Orte ohne Konsolen-Fehler – und die Bilder **angesehen**:
   Wirkt der Mensch winzig? Verschwinden die Kronen im Dunst? Ist die Tiefe gestaffelt (nah dunkel/satt → fern blass)?
3. `?splats=0` läuft und sieht noch nach Wald aus (Rückfall).
