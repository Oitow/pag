# 🌍 Testwelt

Begehbare 3D-Welt zum Ausprobieren der Engine-Bausteine. Hier landet alles, was neu in den Baukasten kommt.

- **Welt:** Weltgenerator (`engine/world/worldgen`) – alle Presets, Seed (🎲), Größe 128/256. Ergebnis wird als 3D-Gelände
  (`engine/world/terrain-mesh`) mit Seen, Flüssen und Meer gezeichnet, Bäume/Büsche/Felsen als Instanzen (`engine/world/scatter-mesh`).
- **Maßstab:** 2 m je Gitterzelle, Höhe × 60 m → die Standard-Insel ist ca. 512 × 512 m.
- **Figur:** `js/figur.js` – Engine-Figurensystem (`docs/FIGUREN-SYSTEM.md`): `gameplay/character` (Motor + Modell + Animator),
  `input/move-input`, `camera/follow-camera` (Kollision mit Gelände/Bäumen, Ich-Sicht beim Reinzoomen, Presets, Lock-On).
  Die Welt kommt über den Welt-Adapter (`engine/world/worldgen/worldgen-adapter.js`: `bodenHoehe`, `wasserHoehe`, `hindernisse`).
- **Dorfbewohner:** `js/dorf.js` – am Start und in bis zu 4 Dörfern je 2–4 NPCs mit `gameplay/character-brain` (wandern,
  vormittags arbeiten, untereinander plaudern), Namensschildern und Sprechblasen (`engine/ui/figur-schild`).
  Sie schauen dich an, wenn du nahe kommst; ansprechen mit E / 💬. Spielzeit: 1 Stunde je 30 s (Anzeige unten links).
- **Steuerung:** WASD/Pfeile, Shift = rennen, Leertaste = springen, Q = Rolle/Dash, V = gleiten, E = ansprechen,
  T = Ziel erfassen/wechseln (Lock-On), Maus ziehen = Kamera, Mausrad = Zoom (ganz rein = Ich-Sicht), 🎥 = Kamera-Ansicht.
  Handy: Stick links (erscheint unter dem Finger), rechte Hälfte ziehen = Kamera, zwei Finger = Zoom, Knöpfe unten rechts
  (⤒ springen, 🌀 Rolle, 🪂 gleiten, 🎯 Ziel, 💬 nur in der Nähe eines Bewohners). Gamepad geht auch.
- **Springen:** 🚩 Startplatz, 🏘 nächstes Dorf, ▲ nächster Gipfel, Karte oben rechts antippen = dorthin.
- **URL:** `?preset=archipel&seed=7&groesse=128` (`&debug` legt `window.testwelt` für Tests an).

**Start:** `python3 -m http.server` im Repo-Root → `http://localhost:8000/games/testwelt/`.
Die Einzeldatei (`npm run build` → `dist/testwelt.html`) läuft per Doppelklick mit derselben Figur.
