# Wer arbeitet woran?

> Jede KI trägt sich hier ein, **bevor** sie anfängt, und trägt sich aus, wenn ihr PR gemergt ist.
> Eine Zeile = ein Branch = ein Modul (oder ein Labor/Spiel). Steht ein Bereich schon drin: nicht anfassen, sondern Goi fragen.
> Zuständig heißt: nur diese Dateien ändern (Bausteine aus `engine/spiel/module-register.js`, Spalte `bausteine`).

| Bereich / Modul | KI | Branch | Seit | Ziel |
|---|---|---|---|---|
| Projektübersicht | Codex | `codex/projektuebersicht` | 25.11. | README und Pages zusammenführen |
| Figurenlabor | Codex | character-lab-parcours | 23.11.2026 | Bewegung, Parcours und Übungsgegner |
| Figur organisch (figur-form, figur-haut, figur-koerper, figur-kleidung, figur-haar, Galerie im Figurenlabor) | Claude (+2 Agents) | `claude/figur-organisch` | 23.11. | Figuren aus einem glatten SDF-Körper mit Skinning statt Klötzen |
| welt, riesenwald-Boden, dorf (neu), tutorial | Claude (Weltgen + 5 Agents) | `claude/welt-startdorf` | 23.11. | Startdorf Erlenwacht, Bäche, Gras, Dorf-Assets, Licht, Dorf-Tutorial – Plan `docs/plaene/WELT-STARTDORF.md` |
| Wildgrund/Erde: Astbäume (`engine/models/natur/astbaum.js`, `labore/erde/js/natur.js`, Baum-Galerie) | Claude | `claude/erde-baeume-aeste` | 25.11. | Bäume mit echten Ästen, Zweigen, Blättern statt Kugel-Kronen; danach Wasser/Küste, Bodendetail, Licht |
| Erde-Fundament: Voxel-Nahzone (`engine/world/voxel-kugel.js`, `labore/erde/js/voxel-erde.js`, Graben/Kollision in `planet.js`, `aktionen.js`) | Claude | `claude/erde-fundament` | 25.11. | Gruben + Tunnel mit echten Schichten, Plan `docs/plaene/ERDE-FUNDAMENT.md` |
| Erde-Labor (`labore/erde`) + geteilte Natur-Assets/Mond nach `engine/` | Claude (+ Agents) | `claude/erde-aufraeumen`, danach `claude/erde-*` | 24.11. | Spiel-Module auf dem Planeten: Überleben, Herstellen, Bauen, Tiere, Gleiter, Schmiede, Tagebuch, Figur (fertig auf `claude/erde-nacht`), Felder (läuft) |

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
