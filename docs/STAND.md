# Stand

> Wird von `/ende` überschrieben und von `/start` gelesen. Höchstens 35 Zeilen. Dauerhafte Festlegungen: `docs/ENTSCHEIDUNGEN.md`.

## Zuletzt gemacht
- **Wildgrund Sicht + Gras (26.11. nachmittags)**: kein Dunst-Schleier mehr bei klarem Wetter (Luftperspektive gedeckelt, Nebel nur bei Wetter), Ruckeln beim Hinunterfliegen behoben (Natur rechnete bei jedem Neuaufbau alle Stücke aufs Netz um; Bergschatten jedes Bild neu), Gras-Teppich auf der GPU (`labore/erde/js/gras-teppich.js`, Regler „Gras“), Boden unter Gras grüner, filmische Tonwerte (ACES), Himmelslicht in Himmelsfarbe
- **Wildgrund Boden (26.11. mittags)**: Natur sitzt jetzt genau auf dem gezeichneten Gelände-Netz (`labore/erde/js/boden-netz.js`, nichts steckt mehr im Boden/schwebt), Bodentextur neu (an die Welt geheftet statt an die Kamera → rutscht nicht mehr, keine Wurm-Linien, Fels-Schichten auf jede Entfernung), Graben/Aufschütten räumt Gras im Umkreis mit weg
- **Wildgrund Welt-Fundament (26.11.)**: Bergschatten (`labore/erde/js/fernschatten.js`, ±1,6 km), Gelände-AO, Grafik-Stufen Niedrig/Mittel/Hoch/Ultra + Fenster „Grafik ⚙“ mit Einzelreglern, Wasser-Kräusel; Topografie: Tafelberge/Schluchten, Küstenklippen, Kare, Felsbänder, Schutthalden (`?ort=tafel`)
- **Erde-Labor wird ein Spiel (Nacht 24./25.11.)**: Andock-Stelle `labore/erde/js/erweiterungen.js` + Module Überleben (Hunger, Durst, Wärme, Tod), Herstellen (14+ Rezepte, Kleidung), Bauen (Fundament/Wand/Dach/Treppe/Lagerfeuer/Werkbank, Einrasten, Kollision, draufstehen), Tiere (Reh, Hase, Keiler, Wolf; Jagd), Gleiter, Felder, Schmelze/Eisen, Tagebuch – Plan `docs/plaene/ERDE-UEBERLEBEN.md`. Welt: Vulkane mit Krater/Lava/Rauch, Wolkendecke, Dünen, Küste ohne Wasserzacken, Fernwald ohne Krümel
- **Aufgeräumt (24.11.)**: geteilte Natur-Assets + Mond aus fremden Laboren nach `engine/models/natur/` bzw. `engine/render/mond.js`; Gigantwelt-Fundstellen seltener; Hauptseite verlinkt Erde/Gigantwelt/Naturstimmungen
- **Startdorf Erlenwacht (23.11.)**: Modul `dorf` (Stufe spiel) – Platz mit Brunnen als Treffpunkt, Taverne, Schmiede, Tempel, 2 Wachtürme, ~10 Häuser mit Gärten/Zäunen, Palisade, Felder, Brücke, 23 Laternen + Nachtlicht; Erlbach (Hochland → Dorf → Klamm → Dämmerwald → Strand); Gras um den Spieler; Dorf-Tutorial (Brunnen → Schrein → Anschlagbrett → Schmied → Wirtin). Plan `docs/plaene/WELT-STARTDORF.md`
- **Aufgeräumt (23.11.)**: games/ aufgeteilt → `erlenwacht/` (Spiel), `testfeld/` (neu, alle Module), `labore/` (figuren, natur, welt, handwerk = alte Testwelt, daemmerwald, enklave), `spiele/` (alte/eigene Spiele); docs → `docs/plaene/`, `docs/bilder/`
- Modul-Stufen labor → testfeld → spiel in `engine/spiel/module-register.js`; Erlenwacht lädt nur `spiel`, Testfeld `?nur=<modul>` testet einzeln
- Regeln für alle KIs in `AGENTS.md` (CLAUDE.md/GEMINI.md verweisen), Zuständigkeit in `docs/ARBEIT.md`, Ablauf in `docs/MODULE.md`
- Tests: Wegwerf-Skripte (siedlung/tests, Dummy-Daten, planet-smoke) raus; neu: Register-Test, Daten-Verträge (Beute↔Gegenstände↔Gegner, Klassen↔Zauber); alle alten Spiele im Smoke-Test
- Vorher: Erlenwacht wird ein MMO (Klassen, Stufen, Beute, Gegner + Boss, Tutorial, Chat/Menü, Welt v2), siehe `docs/plaene/ERLENWACHT-MMO-PLAN.md`

## Läuft / kaputt
- Erde Gras 26.11.: Erde-Tests grün, Bilder Wiese/Ufer/Küste ohne Konsolenfehler. NICHT geprüft: echte Bildrate am Handy (Gras Mittel ≈ 150k, Hoch ≈ 700k Dreiecke max.), Fliegen von oben nach unten am echten Gerät
- Erde-Welt 26.11.: Tests grün, Bilder (Küste/Mittel, Fluss/Hoch) ohne Konsolenfehler. NICHT geprüft: echtes Handy (Bildrate mit Bergschatten), Ultra-Stufe, Stufenkanten der Tafelberge beim LOD-Wechsel (können ~10 m springen)
- Erde: Bilder aller neuen Teile angesehen, `tests/erde-*` grün, Smoke ok. NICHT geprüft: echtes Handy (Bildrate mit Tieren/Wolken/Bauteilen, Touch in Bau-Leiste/Fenstern), lange Spielsitzung am Stück
- Dorf: Bilder angesehen (Platz, Südtor, Brücke, Nacht, Bach im Wald, Strandmündung), 852 Engine-Tests grün, Smoke erlenwacht/testfeld ok. NICHT geprüft: Dorf-Tutorial am Stück, Schrein-Wiedererscheinen, Bildrate Gras am Handy (`?gras=0` schaltet ab)
- `npm test` grün (813 Engine-Tests, Smoke 8 Spiele); Bilder hochkant angesehen: Titel, Start (Alwe, Verfolger), Hochland (Wölfe/Keiler im Kampf), Wolfsfels – keine Konsolen-Fehler
- NICHT geprüft: echtes Handy (Bildrate, Touch-Layout mit Stick + Leiste bei 228 px), Fortsetzen/Laden eines Spielstands, Trank benutzen, ganze Quest-Kette am Stück, `npm run build`
- Bekannt: Boss am Wolfsfels im Bild nicht zu sehen (Lage prüfen); Wölfe/Keiler etwas dunkel/plump; Irrlicht-Kern leuchtet nicht extra; Fluss kann auf grobem LOD schweben;
  modul-kampf 339 Zeilen (> 300); Chat zeigt beim Start abgeschnittenen Intro-Satz; alte Offene Punkte (Wurzeln begehbar, Abendgold) bleiben

## Nächster Schritt
- Goi entscheidet: welche Module zurück auf Stufe `testfeld` (alle 12 stehen noch auf `spiel`, damit Erlenwacht gleich bleibt); alte Branches/PRs #8 #9 #11 löschen?
- Am Handy spielen: Tutorial bis Brandt, Bildrate + Touch melden
- Boss-Platz + Licht am Wolfsfels prüfen, Tränke benutzbar machen (Inventar → ents.heile), Gegner-Materialien heller
- Netzwerk-Prototyp auf `entitaeten.aenderungenSeit` + `befehle` (echte Mitspieler im Chat)

## Ideen-Parkplatz
- SDF-Kreaturen und -Zauber, Splat-LOD nach Entfernung, Koloss-Silhouette fern zwischen den Stämmen
- Sammelspiel mit den Voxel-Tieren; Händler in Erlenwacht; Dungeons
