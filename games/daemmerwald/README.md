# 🌲 Der Dämmerwald

MMO-Startgebiet (Bauplan: `docs/WELT-DAEMMERWALD.md`, Stil: `docs/ART-DIRECTION.md`): Ankunft am stillen Wasser, dann ein Pfad nach Norden
zwischen 100–140 m hohen Bäumen – Tor der Alten → Wurzelbogen → gestürzter Riese → Lichtung mit Lichtsäule und Menhir („Weiter zur Enklave“).
Keine Aufgaben in Version 1: gehen, schauen, staunen. Es geht um echte Größe (Mensch = 1.8 m), Dämmerlicht und Dunst-Tiefe.

## Steuerung
Handy: links Stick, rechts wischen = umsehen, zwei Finger = Zoom. PC: WASD/Pfeile, Maus ziehen, Mausrad, Umschalt = rennen, Leertaste = springen.

## URL
`?ort=ufer|tor|bogen|stamm|lichtung` · `?q=niedrig|mittel|hoch` (Splats 40 k / 90 k / 160 k, Pixel ≤ 1 / 1.5 / 2; Handy startet auf `niedrig`) ·
`?splats=0` (ohne Gauß-Splats) · `?test=1` (ohne Intro, feste Zeit, setzt `window.daemmerwald.bereit`) · `?debug` (fps, Calls, Dreiecke, Splats).
Konsole: `daemmerwald.gehe('bogen')`, `daemmerwald.zahlen`.

## Aufbau (`js/`)
| Datei | Aufgabe |
|---|---|
| `main.js` | nur Verdrahtung, Qualität, UI |
| `plan-daten.js` | reine Daten: Pfad (x als Funktion von z), Orte, Riesen-Varianten, Helden-Bäume, gestreute Riesen |
| `gelaende.js` | Höhenfunktion (Ufer → Kies → Waldboden mit Hohlweg, eben um Riesen), Netz mit Vertexfarben, Wasser mit Himmelsspiegelung |
| `wald.js` | Riesen aus `engine/models/natur/riesenbaum.js` als InstancedMesh (nah fein / fern grob), Wurzel-Kollision, Fern-Silhouetten |
| `bewuchs.js` | Maßstabs-Anker aus dem Baukasten: normale Bäume 8–16 m, Farn, Pilze, Steine, Schilf, Totholz (entsättigt) |
| `dinge.js` | Boot, Laternen, Wanderer am Tor, gestürzter Riese, Menhir, Wegweiser, Leuchtpilze |
| `licht.js` | Dämmerung, exp²-Dunst + Höhendunst, Verlaufshimmel, Lichtbahnen, Glühwürmchen, Vögel |
| `splats.js` | eine Gauß-Wolke: Laub/Moos der Riesen (nach Pfad-Nähe ausgedünnt), Bodendunst, Moosteppich, Lichtstaub |
| `figur.js` | Engine-Figur + Folgekamera (Sichtfeld 50°, tief) |

## Prüfen
`node --test tests/daemmerwald-daten.test.mjs` · `node tools/bild.mjs daemmerwald --query "?ort=tor&test=1" --warte 24000` (Software-Renderer ist langsam).
