# 🌍 Testwelt

Begehbare 3D-Welt zum Ausprobieren der Engine-Bausteine. Hier landet alles, was neu in den Baukasten kommt.

- **Welt:** Weltgenerator (`engine/world/worldgen`) – alle Presets, Seed (🎲), Größe 128/256. Ergebnis wird als 3D-Gelände
  (`engine/world/terrain-mesh`) mit Seen, Flüssen und Meer gezeichnet, Bäume/Büsche/Felsen als Instanzen (`engine/world/scatter-mesh`).
- **Wege:** Wegenetz zwischen Start und Dörfern (`worldgen-wege`), als Erdweg im Gelände eingefärbt und auf der Karte eingezeichnet.
  Über Flüsse führen Holzbrücken (`engine/world/wege-mesh`), die Figur läuft darüber (`engine/world/wege-lage`: `mitBruecken`).
- **Natur:** prozedurale Natur-Assets (`engine/models/natur/natur-assets.js`, 4 Varianten je Typ, echte Meter) mit
  Wind-Material (`engine/render/natur-material.js`, `objekte.update(zeit, { kamera })` je Bild). Instanzen in 128-m-Kacheln,
  weiter als 160 m → Detailstufe 0, Bodendecker blenden ab 110 m aus. Felsen × 1,4 / Felsbrocken × 1,8 (`typSkala`).
  Einzelne Assets ansehen: [🌿 Natur-Labor](../natur-labor/).
- **Maßstab:** 2 m je Gitterzelle, Höhe × 60 m → die Standard-Insel ist ca. 512 × 512 m.
- **Figur:** `js/figur.js` – Engine-Figurensystem (`docs/FIGUREN-SYSTEM.md`): `gameplay/character` (Motor + Modell + Animator),
  `input/move-input`, `camera/follow-camera` (Kollision mit Gelände/Bäumen, Ich-Sicht beim Reinzoomen, Presets, Lock-On).
  Die Welt kommt über den Welt-Adapter (`engine/world/worldgen/worldgen-adapter.js`: `bodenHoehe`, `wasserHoehe`, `hindernisse`).
- **Dorfbewohner:** `js/dorf.js` – am Start und in bis zu 4 Dörfern je 2–4 NPCs mit `gameplay/character-brain` (wandern,
  vormittags arbeiten, untereinander plaudern), Namensschildern und Sprechblasen (`engine/ui/figur-schild`).
  Sie schauen dich an, wenn du nahe kommst; ansprechen mit E / 💬. Spielzeit: 1 Stunde je 30 s (Anzeige unten links).
- **Dinge & Handeln:** `js/sachen.js` – Kollisions-Welt (`engine/world/kollision`): Kisten-Treppe neben dem Start zum Draufspringen,
  Figuren schieben sich aneinander vorbei. Äpfel und Pilze liegen herum (`gameplay/welt-dinge` + leichte Physik `gameplay/koerper`:
  fallen, rollen, schwimmen, lassen sich wegkicken). E / 💬 = aufheben, ansprechen; **E halten** vor einem Baum/Fels = fällen/abbauen
  (`gameplay/interaktion`), Holz und Steine fallen heraus. Inventarleiste unten (`gameplay/inventar`): Platz antippen = in die Hand (`gameplay/hand`), nochmal antippen = ablegen.
  🔨 = Axt/Hacke herstellen (`gameplay/rezepte`); mit dem Werkzeug in der Hand geht Fällen/Abbauen dreimal so schnell, es nutzt sich ab.
  Bäume und Felsen wachsen nach einigen Spieltagen nach (`gameplay/rohstoffe`).
- **Himmel & Wetter:** Tag/Nacht mit Sonne, Mond (Phasen), Sternen und Wolken (`engine/world/himmel`, `himmel-stand`), Wetter nach
  Biom-Klima und Jahreszeit (`engine/world/wetter`), Regen/Schnee (`engine/render/niederschlag`). ⏩ = 3 Stunden vor, Wetterknopf = nächstes Wetter.
- **Zeit & Spielstand:** Spieluhr mit Tagen und Jahreszeiten (`engine/core/zeit`), Schleife (`engine/core/schleife`), Uhr, Wetter und
  Position, Inventar, herumliegende Dinge und gefällte Bäume werden alle 10 s gespeichert (`engine/core/speicher`); `&frisch` in der URL ignoriert den Spielstand.
- **Steuerung:** WASD/Pfeile, Shift = rennen, Leertaste = springen, Q = Rolle/Dash, V = gleiten, E = aufheben/ansprechen (halten = fällen),
  T = Ziel erfassen/wechseln (Lock-On), Maus ziehen = Kamera, Mausrad = Zoom (ganz rein = Ich-Sicht), 🎥 = Kamera-Ansicht.
  Handy: Stick links (erscheint unter dem Finger), rechte Hälfte ziehen = Kamera, zwei Finger = Zoom, Knöpfe unten rechts
  (⤒ springen, 🌀 Rolle, 🪂 gleiten, 🎯 Ziel, 💬 nur, wenn es etwas zu tun gibt). Gamepad geht auch.
- **Springen:** 🚩 Startplatz, 🏘 nächstes Dorf, ▲ nächster Gipfel, Karte oben rechts antippen = dorthin.
- **URL:** `?preset=archipel&seed=7&groesse=128` (`&debug` legt `window.testwelt` für Tests an).

**Start:** `python3 -m http.server` im Repo-Root → `http://localhost:8000/games/testwelt/`.
Die Einzeldatei (`npm run build` → `dist/testwelt.html`) läuft per Doppelklick mit derselben Figur.
