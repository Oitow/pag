# Stand

> Wird von `/ende` überschrieben und von `/start` gelesen. Höchstens 35 Zeilen. Dauerhafte Festlegungen: `docs/ENTSCHEIDUNGEN.md`.

## Zuletzt gemacht
- **Aufgeräumt (23.11.)**: games/ aufgeteilt → `erlenwacht/` (Spiel), `testfeld/` (neu, alle Module), `labore/` (figuren, natur, welt, handwerk = alte Testwelt, daemmerwald, enklave), `spiele/` (alte/eigene Spiele); docs → `docs/plaene/`, `docs/bilder/`
- Modul-Stufen labor → testfeld → spiel in `engine/spiel/module-register.js`; Erlenwacht lädt nur `spiel`, Testfeld `?nur=<modul>` testet einzeln
- Regeln für alle KIs in `AGENTS.md` (CLAUDE.md/GEMINI.md verweisen), Zuständigkeit in `docs/ARBEIT.md`, Ablauf in `docs/MODULE.md`
- Tests: Wegwerf-Skripte (siedlung/tests, Dummy-Daten, planet-smoke) raus; neu: Register-Test, Daten-Verträge (Beute↔Gegenstände↔Gegner, Klassen↔Zauber); alle alten Spiele im Smoke-Test
- Vorher: Erlenwacht wird ein MMO (Klassen, Stufen, Beute, Gegner + Boss, Tutorial, Chat/Menü, Welt v2), siehe `docs/plaene/ERLENWACHT-MMO-PLAN.md`

## Läuft / kaputt
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
