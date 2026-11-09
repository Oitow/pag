# 🌍 Testwelt

Begehbare 3D-Welt zum Ausprobieren der Engine-Bausteine. Hier landet alles, was neu in den Baukasten kommt.

- **Welt:** Weltgenerator (`engine/world/worldgen`) – alle Presets, Seed (🎲), Größe 128/256. Ergebnis wird als 3D-Gelände
  (`engine/world/terrain-mesh`) mit Seen, Flüssen und Meer gezeichnet, Bäume/Büsche/Felsen als Instanzen (`engine/world/scatter-mesh`).
- **Maßstab:** 2 m je Gitterzelle, Höhe × 60 m → die Standard-Insel ist ca. 512 × 512 m.
- **Himmel & Tageszeit:** Shader-Himmel mit Sonne, Mond und Sternen (`engine/world/sky.js`), Tag/Nacht-Licht, Nebel- und
  Himmelsfarben (`engine/world/daynight.js`, ein Tag = 10 min). Oben: Regler = Uhrzeit, ⏸/▶ = Zeit anhalten,
  ☀/🌧/⛈ = Wetter klar/Regen/Sturm (`engine/world/weather.js`: Regenlinien + dichterer Nebel + Bewölkung).
- **Figur:** Steckplatz `js/figur.js`. Liegt das Engine-Figurensystem (`docs/FIGUREN-SYSTEM.md`: move-input, character-motor,
  character-model, character-animator, follow-camera) im Repo, wird es automatisch geladen. Sonst läuft ein Platzhalter
  (Kapsel, `js/platzhalter.js` + `js/steuerung.js`). Die Figur bekommt die Welt über den Welt-Adapter
  (`engine/world/worldgen/worldgen-adapter.js`: `bodenHoehe`, `wasserHoehe`, `hindernisse`).
- **Steuerung:** WASD/Pfeile, Shift = rennen, Leertaste = springen, Maus ziehen = Kamera, Mausrad = Zoom.
  Handy: linke Hälfte = Stick, rechte Hälfte ziehen = Kamera, zwei Finger = Zoom, Knöpfe ⤒ springen und » rennen.
- **Springen:** 🚩 Startplatz, 🏘 nächstes Dorf, ▲ nächster Gipfel, Karte oben rechts antippen = dorthin.
- **URL:** `?preset=archipel&seed=7&groesse=128&zeit=20` (`&debug` legt `window.testwelt` für Tests an).

**Start:** `python3 -m http.server` im Repo-Root → `http://localhost:8000/games/testwelt/`.
Die Einzeldatei (`npm run build` → `dist/testwelt.html`) läuft per Doppelklick, dann immer mit Platzhalter-Figur.

**Wenn das Figurensystem gemergt ist:** in `js/figur.js` die dynamischen Importe durch statische ersetzen,
`platzhalter.js` und `steuerung.js` löschen, `ignoriere` in `spiel.json` entfernen.
