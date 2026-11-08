# 🧪 Weltlabor

Vorschau für den Weltgenerator aus `engine/world/worldgen/`. Kein Spiel, sondern ein Werkzeug, mit dem du Welten für Spiele ausprobierst.

- **Presets:** Insel, Archipel, Kontinent, Gebirge, Wüste, Tundra, Sumpfland, Vulkaninsel, Canyon, Flachland, Küste, Hochebene, Unendlich
- **Einstellungen:** Seed (🎲 würfelt einen neuen), Größe 128/256/512, Qualität schnell/normal/hoch
- **Regler:** Gebirge, Küstenform, Erosion, Flüsse, Temperatur, Feuchte, Wind, Objektdichte
- **Ebenen:** Biome, Höhe, Feuchte, Temperatur, Schatten, Flüsse, Objekte, Orte (Start 🚩, Dörfer, Gipfel ▲)
- **Modus „Chunks“:** setzt die Karte aus 64er-Chunks zusammen und zeigt so, dass die Kanten nahtlos sind
- Die Erzeugung läuft in einem Web Worker (`worker.js`). Geht das nicht, läuft sie im Hauptthread. Angezeigt werden die Zeiten pro Stufe.
- Antippen oder Überfahren der Karte zeigt Biom, Höhe, Temperatur und Feuchte an der Stelle.

**Start:** im Repo-Root `python3 -m http.server` ausführen und dann `http://localhost:8000/games/weltlabor/` öffnen.
Weil die Seite ES-Module und einen Worker nutzt, startet sie nicht per Doppelklick (`file://`).

Dateien: `index.html` (Oberfläche), `labor.js` (Regler und Zeichnen), `erzeuge.js` (Welt oder Chunks erzeugen), `worker.js`.
