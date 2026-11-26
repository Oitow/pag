# 🌳 Tree Lab (`labore/treeclaude/`)

Prozedurale, spieltaugliche Bäume (Eiche, Birke, Kiefer) – ein Generator für den Nah-Baum **und** den begehbaren Wald.
Eine Datei: `index.html` · Three.js **0.170.0** (Import-Map) · keine Downloads, alle Texturen werden erzeugt.

Ausprobieren: https://oitow.github.io/pag/labore/treeclaude/

## Bedienung
- **Exemplar**: ziehen = drehen, Rad/Pinch = zoomen (Rinde bis Silhouette), Sonne im Feld „Licht & Wind“, Mensch 1,8 m einblendbar.
- **Wald**: WASD/Pfeile + Maus ziehen, am Handy Joystick links + Wischen. Dichte 100–5000 Bäume, Anzeige „platziert / sichtbar“.
- **Stil** (Naturalistisch / Malerisch / PS2) ist unabhängig von **Grafik** (Mobil / Ausgewogen / Hoch / Eigene).
- **Messfahrt 20 s**: feste Route, fester Wald-Seed 4242, 2 s Aufwärmen, Ergebnis-Tabelle + „📋 Ergebnisse“ (mit Gerät/GPU).

URL-Parameter: `?ansicht=wald`, `?art=oak|birch|pine`, `?stil=natural|painterly|ps2`, `?seed=`, `?alter=0.05–1`,
`?dichte=`, `?misch=1`, `?preset=mobile|balanced|high`, `?bench=1` (Messfahrt sofort), `?ort=rinde|unten|nah|weit`, `?test=1`.

## Wie es funktioniert (kurz)
- **Skelett**: verbundene Asthierarchie (Stamm → Leitäste → Äste → Zweige), jeder Ast mit eigenem Seed aus dem Elternast.
  **Alter** schneidet nur ab: jeder Ast hat eine Geburtszeit, wächst danach in die Länge. Dicke nach Röhrenmodell
  (Querschnitt = Summe der Kinder) → bestehende Äste werden dicker, neue kommen dazu, die Form bleibt (gleicher Seed = gleicher Baum).
- **Rinde**: Röhren mit Parallel-Transport-Rahmen, UV-v läuft entlang jedes Asts (Maserung folgt dem Ast), Wurzelanlauf mit Lappen, Astkragen.
- **Laub**: Blattgruppen-Karten (6-eckig zugeschnitten statt Quadrat → weniger Overdraw), Lücken aus 3D-Rauschen,
  Kugel-Normalen, Durchscheinen gegen die Sonne, hellere Blattunterseiten.
- **Wind**: ein Vertex-Shader für alles; Zweige und Blätter erben Phase + Auslenkung ihres Elternasts → kohärent.
- **Wald**: Bibliothek aus 8 (Mischwald 15) Seed-Varianten; je Variante LOD0 (voll), LOD1 (Stamm + Hauptäste, wenige große Laubkarten)
  und ein Impostor im gemeinsamen 4×4-Atlas (alle fernen Bäume = 1 Draw-Call). Instancing mit geteilten Materialien,
  32-m-Zellen mit Frustum-Culling, LOD-Übergänge per Bildschirm-Dither überblendet. Erzeugung zeitgeteilt (ein Baum pro Frame).

## API (in `index.html`, Abschnitt 4 → `window.TreeLab`)
```js
// Einzelner Baum
const tree = TreeLab.createTree(
  { species: 'oak', seed: 7, age: 0.8, height: 17, girth: 1, spread: 1, dens: 1, foliage: 1 },
  { style: 'natural', lod: 0, detail: 1 });
scene.add(tree.object);            // tree.info: tris, height, crownR, trunkR, ms

// Wald
const forest = TreeLab.createForest({ renderer, scene, count: 2000, seed: 3,
  tree: { species: 'pine', seed: 11 }, mix: false, style: 'natural', detail: 0.75,
  heightFn: (x, z) => meinTerrain(x, z) });
await forest.ready;
forest.setLOD({ near: 16, mid: 50, far: 230 });

// pro Frame
TreeLab.update(dt, camera, sunDir, { strength: 0.6, quality: 2 });   // Wind + Durchscheinen
forest.update(camera, sunDir);                                       // Culling + LOD
const nah = forest.nearTrunks(spieler.x, spieler.z);                 // einfache Stamm-Kollision

// aufräumen
tree.dispose(); forest.dispose(); TreeLab.disposeMaterials('natural');
```

## Geprüft (Headless-Chromium mit SwiftShader, also Software-Renderer – kein echtes Handy!)
- Beide Ansichten öffnen ohne Konsolen-Fehler; Hochformat 412×915 bedienbar.
- Gleicher Seed → identische Geometrie, anderer Seed → andere; Alter 0,5 → 1,0: 282 → 857 Äste, Stammradius 0,35 → 0,71 m,
  alle 282 jungen Äste behalten exakt ihre Form.
- Alle drei Stile und alle drei Arten per Bildschirmfoto angesehen.
- Messfahrt liefert Werte. Gemessen: SwiftShader (CPU), 576×324 (Skala 0,6), 300 Bäume, Preset Mobil, Eiche naturalistisch:
  **13,1 FPS, Median 66,7 ms, P95 100 ms, 10 Draw-Calls, 0,09 M Dreiecke**. Im Software-Renderer sagt die Bildrate nichts über ein echtes Gerät aus.
- Draw-Calls (Ausgewogen, nicht Messfahrt): 1500 Bäume ≈ 23–33, 5000 Bäume ≈ 33, Mischwald 5000 ≈ 59; Dreiecke 1,3–2,4 M.

## Nicht geprüft
- **60 FPS auf echtem Android/Desktop-GPU** – bitte die Messfahrt auf dem Handy laufen lassen und „📋 Ergebnisse“ teilen.
- Adaptive Auflösung nur logisch, nicht auf einem echten Gerät beobachtet.
- Kein `spiel.json` (Einzeldatei ohne Modul-Eintrag) → läuft nicht im Smoke-Test/Build.
