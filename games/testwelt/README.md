# 🌍 Testwelt

Begehbare 3D-Welt zum Ausprobieren der Engine-Bausteine. Hier landet alles, was neu in den Baukasten kommt.

- **Welt:** Weltgenerator (`engine/world/worldgen`) – alle Presets, Seed (🎲), Größe 128/256/512. Der Boden kommt als LOD-Kacheln
  (`engine/world/terrain-chunks`: 4 Stufen, Frustum-Culling, Streaming mit Budget), Bäume/Büsche/Felsen nur in nahen Kacheln.
  Seen, Flüsse und Meer zeichnet weiter `engine/world/terrain-mesh` (dessen Boden ist ausgeblendet).
- **Unendlich:** Preset „Unendlich (Chunks)“ nutzt den Chunk-Generator (`createChunkGenerator` + `engine/world/chunk-adapter`),
  Kacheln werden um die Kamera nachgeladen; die Karte ist dann aus, 🏘/▲ ohne Funktion, Meer als einfache Fläche.
- **Debug:** oben links FPS, sichtbare/geladene Kacheln, Kacheln je LOD, Dreiecke und Draw Calls (`renderer.info`), Objekte.
- **Maßstab:** 2 m je Gitterzelle, Höhe × 60 m → die Standard-Insel ist ca. 512 × 512 m.
- **Figur:** Steckplatz `js/figur.js`. Liegt das Engine-Figurensystem (`docs/FIGUREN-SYSTEM.md`: move-input, character-motor,
  character-model, character-animator, follow-camera) im Repo, wird es automatisch geladen. Sonst läuft ein Platzhalter
  (Kapsel, `js/platzhalter.js` + `js/steuerung.js`). Die Figur bekommt die Welt über den Welt-Adapter
  (`engine/world/worldgen/worldgen-adapter.js`: `bodenHoehe`, `wasserHoehe`, `hindernisse`).
- **Steuerung:** WASD/Pfeile, Shift = rennen, Leertaste = springen, Maus ziehen = Kamera, Mausrad = Zoom.
  Handy: linke Hälfte = Stick, rechte Hälfte ziehen = Kamera, zwei Finger = Zoom, Knöpfe ⤒ springen und » rennen.
- **Springen:** 🚩 Startplatz, 🏘 nächstes Dorf, ▲ nächster Gipfel, Karte oben rechts antippen = dorthin.
- **URL:** `?preset=archipel&seed=7&groesse=128` (`&debug` legt `window.testwelt` mit `figur`, `adapter`, `kacheln` für Tests an).

**Start:** `python3 -m http.server` im Repo-Root → `http://localhost:8000/games/testwelt/`.
Die Einzeldatei (`npm run build` → `dist/testwelt.html`) läuft per Doppelklick, dann immer mit Platzhalter-Figur.

**Wenn das Figurensystem gemergt ist:** in `js/figur.js` die dynamischen Importe durch statische ersetzen,
`platzhalter.js` und `steuerung.js` löschen, `ignoriere` in `spiel.json` entfernen.
