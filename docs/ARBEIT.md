# Wer arbeitet woran?

> Jede KI trägt sich hier ein, **bevor** sie anfängt, und trägt sich aus, wenn ihr PR gemergt ist.
> Eine Zeile = ein Branch = ein Modul (oder ein Labor/Spiel). Steht ein Bereich schon drin: nicht anfassen, sondern Goi fragen.
> Zuständig heißt: nur diese Dateien ändern (Bausteine aus `engine/spiel/module-register.js`, Spalte `bausteine`).

| Bereich / Modul | KI | Branch | Seit | Ziel |
|---|---|---|---|---|
| Figurenlabor | Codex | character-lab-parcours | 23.11.2026 | Bewegung, Parcours und Übungsgegner |
| Figur organisch (figur-form, figur-haut, figur-koerper, figur-kleidung, figur-haar, Galerie im Figurenlabor) | Claude (+2 Agents) | `claude/figur-organisch` | 23.11. | Figuren aus einem glatten SDF-Körper mit Skinning statt Klötzen |
| welt, riesenwald-Boden, dorf (neu), tutorial | Claude (Weltgen + 5 Agents) | `claude/welt-startdorf` | 23.11. | Startdorf Erlenwacht, Bäche, Gras, Dorf-Assets, Licht, Dorf-Tutorial – Plan `docs/plaene/WELT-STARTDORF.md` |
| Wildgrund/Erde: Astbäume (`engine/models/natur/astbaum.js`, `labore/erde/js/natur.js`, Baum-Galerie) | Claude | `claude/erde-baeume-aeste` | 25.11. | Bäume mit echten Ästen, Zweigen, Blättern statt Kugel-Kronen; danach Wasser/Küste, Bodendetail, Licht |
| Wildgrund A1 Welt-Fundament: Graben/Höhlen (`graben-feld.js`, `eingriffe.js`, `voxel-erde.js`, `aktionen.js`, `engine/world/voxel-kugel.js`), Kacheln/Flug-FPS (`kachel-*.js`, `planet-baum.js`), Höhe/Wasser (`planet-hoehe.js`, `geologie.js`, `boden-netz.js`) | Claude (Agent) | `claude/erde-fundament` | 27.11. | Plan `docs/plaene/WILDGRUND-SCHLACHTPLAN.md` A1 |
| Wildgrund A0 Stil & Asset-Technik (`labore/stil/`, `docs/plaene/WILDGRUND-STIL.md`) | Codex | `codex/wildgrund-stil` | 27.11. | 3 Looks im Vergleich + Asset-Vertrag |
| Wildgrund A2 Licht & Atmosphäre (`dunst.js`, `wolken.js`, `gluehen.js`, `fernschatten.js`, `zeit-wetter.js`, neu `licht-*.js`) | Claude (Agent) | `claude/erde-licht` | 27.11. | Dämmerwald-Stimmung, echte Nacht, Fackellicht |
| Wildgrund A3 Masse & Absturzschutz (neu `labore/erde/js/masse-*.js`) | Claude (Agent) | `claude/erde-masse` | 27.11. | 20 000 Bauteile, Speicherwächter, Stand je Kachel |
| Riesenjagd (`spiele/riesenjagd`): Seil-Haken, Riesen erklettern, Sternenfall | Claude | `claude/riesenjagd` | 25.11. | Spielbarer Kern: Wald der Riesen, Troll + Zyklop, Haken/Klettern/Runen/Großzauber |
| Erde-Labor (`labore/erde`) + geteilte Natur-Assets/Mond nach `engine/` | Claude (+ Agents) | `claude/erde-aufraeumen`, danach `claude/erde-*` | 24.11. | Spiel-Module auf dem Planeten: Überleben, Herstellen, Bauen, Tiere, Gleiter, Schmiede, Tagebuch, Figur (fertig auf `claude/erde-nacht`), Felder (läuft) |
| Tree Lab (`labore/treeclaude/`) – prozedurale Bäume Eiche/Birke/Kiefer, Wald-LOD, Messfahrt | Claude | `claude/treeclaude` | 26.11. | Exemplar + begehbarer Wald, 3 Stile, Benchmark, kleine API |

## Geteilte Dateien (nur beim Zusammenführen ändern)
Diese Dateien fasst nur der **Zusammenführ-Schritt** an (ein eigener Branch/PR, nachdem die Modul-PRs drin sind),
sonst gibt es Konflikte zwischen den KIs:
`engine/spiel/module-register.js` (Stufen), `engine/spiel/module.js`, `engine/KATALOG.md` (wird per `npm run katalog` erzeugt),
`engine/CHANGELOG.md`, `docs/STAND.md`, `README.md`, `index.html`.

Ausnahme: Ein neues Modul darf sich selbst in `module.js` + `module-register.js` mit `stufe: 'labor'` eintragen (nur die eigene Zeile).
Den Katalog nie von Hand mergen – bei Konflikt `npm run katalog` neu laufen lassen.

## Offene Branches (Stand Aufräumen 23.11.2026)
Alt und vermutlich überholt (PRs #8, #9, #11 vom 09.11. – Himmel, Wasser, Gelände-LOD; vieles davon ist inzwischen anders in `engine/world/` gelandet).
Dazu ~25 gemergte Arbeits-Branches (`ccr-*`, `claude/*`, `welt/*` …). Löschen erst, wenn Goi zustimmt.
