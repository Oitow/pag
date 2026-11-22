# 🌲 Der Dämmerwald

MMO-Startgebiet (Bauplan: `docs/plaene/WELT-DAEMMERWALD.md`, Stil: `docs/ART-DIRECTION.md`): Ankunft am stillen Wasser, dann ein Pfad nach Norden
zwischen 100–140 m hohen Bäumen – Tor der Alten → Wurzelbogen → gestürzter Riese → Lichtung mit Lichtsäule und Menhir („Weiter zur Enklave“).
Keine Aufgaben in Version 1: gehen, schauen, staunen. Es geht um echte Größe (Mensch = 1.8 m), Dämmerlicht und Dunst-Tiefe.
Tag-Nacht-Zyklus (ein Tag ≈ 20 min, Start in der goldenen Abendstunde): Sonne und Mond wandern, Licht fällt durch echte Lücken im Kronendach
(Sonnentupfer, Lichtstrahlen, leuchtender Staub nur im Licht); nachts kühles Mondlicht, Sterne, Glühwürmchen und Laternen.

## Steuerung
Handy: links Stick, rechts wischen = umsehen, zwei Finger = Zoom. PC: WASD/Pfeile, Maus ziehen, Mausrad, Umschalt = rennen, Leertaste = springen.

## URL
`?ort=ufer|tor|bogen|stamm|lichtung` · `?q=niedrig|mittel|hoch` (Splats 40 k / 90 k / 160 k, Pixel ≤ 1 / 1.5 / 2; Handy startet auf `niedrig`) ·
`?splats=0` (ohne Gauß-Splats) · `?test=1` (ohne Intro, Uhr steht, setzt `window.daemmerwald.bereit`) · `?debug` (fps, Calls, Dreiecke, Splats, Uhrzeit, Lichtkarte).
`?zeit=6.5` (Startstunde 0–24, Standard 17.75 = goldene Stunde; mit `?test=1` feste Zeit) · `?tempo=50` (echte Sekunden je Spielstunde, Standard 50 ≈ 20 min je Tag) ·
`?licht=einfach` (ohne Kronen-Lichtkarte: keine Sonnentupfer, Strahlen an festen Stellen – billig).
Konsole: `daemmerwald.gehe('bogen')`, `daemmerwald.zeit(23)` (Uhr stellen; ohne Zahl = aktuelle Stunde), `daemmerwald.zahlen`.

## Aufbau (`js/`)
| Datei | Aufgabe |
|---|---|
| `main.js` | nur Verdrahtung, Qualität, UI |
| `plan-daten.js` | reine Daten: Pfad (x als Funktion von z), Orte, Riesen-Varianten, Helden-Bäume, gestreute Riesen |
| `gelaende.js` | Höhenfunktion (Ufer → Kies → Waldboden mit Hohlweg, eben um Riesen), Netz mit Vertexfarben, Wasser mit Himmelsspiegelung |
| `wald.js` | Riesen aus `engine/models/natur/riesenbaum.js` als InstancedMesh (nah fein / fern grob), Wurzel-Kollision, Fern-Silhouetten |
| `bewuchs.js` | Maßstabs-Anker aus dem Baukasten: normale Bäume 8–16 m, Pilze, Steine, Schilf, Totholz (entsättigt) + Urwald-Unterwuchs (Wedelfarn, Unterholz, Moos, Wurzelschösslinge, Laub) über `worldgen-scatter` `verteile` mit `URWALD_OBJEKTE`: Pfad/Stämme frei, dichter an Stammfüßen, nach außen ausgedünnt, Lichtung frei |
| `dinge.js` | Boot, Laternen, Wanderer am Tor, gestürzter Riese, Menhir, Wegweiser, Leuchtpilze |
| `tageslicht.js` | reine Daten: Sonnen-/Mondbahn (engine `world/himmel-stand`, gedreht auf die Welt), Wald-Palette über die Sonnenhöhe (Nacht → blaue Stunde → Sonnenuntergang → goldene Stunde → Mittag) |
| `licht.js` | Tag-Nacht-Licht (Sonne/Mond, Halbkugel, Gegenlicht), exp²-Dunst + Höhendunst, Verlaufshimmel mit Sternen, Kronen-Lichtkarte (`engine/render/kronen-lichtkarte`: Sonnentupfer, Strahlen nur in Lücken, Lichtstaub), Glühwürmchen, Vögel |
| `kronen.js` | Laub der Riesen als Blatt-Karten (ein Draw-Call), Kronen-Lücken entlang der Mittagssonne über dem Pfad |
| `splats.js` | eine Gauß-Wolke: Laub/Moos der Riesen (nach Pfad-Nähe ausgedünnt), Bodendunst, Moosteppich, Pilz-Schein (Lichtstaub nur bei `?licht=einfach`); Licht-Faktor folgt der Tageszeit |
| `figur.js` | Engine-Figur + Folgekamera (Sichtfeld 50°, tief) |

## Prüfen
`node --test tests/daemmerwald-daten.test.mjs` · `node tools/bild.mjs daemmerwald --query "?ort=tor&test=1&zeit=8" --warte 24000` (Software-Renderer ist langsam).
