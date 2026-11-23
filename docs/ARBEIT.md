# Wer arbeitet woran?

> Jede KI trägt sich hier ein, **bevor** sie anfängt, und trägt sich aus, wenn ihr PR gemergt ist.
> Eine Zeile = ein Branch = ein Modul (oder ein Labor/Spiel). Steht ein Bereich schon drin: nicht anfassen, sondern Goi fragen.
> Zuständig heißt: nur diese Dateien ändern (Bausteine aus `engine/spiel/module-register.js`, Spalte `bausteine`).

| Bereich / Modul | KI | Branch | Seit | Ziel |
|---|---|---|---|---|
| Figurenlabor | Codex | character-lab-parcours | 23.11.2026 | Bewegung, Parcours und Übungsgegner |
| welt, riesenwald-Boden, dorf (neu), tutorial | Claude (Weltgen + 5 Agents) | `claude/welt-startdorf` | 23.11. | Startdorf Erlenwacht, Bäche, Gras, Dorf-Assets, Licht, Dorf-Tutorial – Plan `docs/plaene/WELT-STARTDORF.md` |
| Labor Gigant-Welt (`labore/gigantwelt/`) | Claude (+1 Agent) | `claude/gigantwelt-labor` | 23.11. | Riesige grab-/baubare Welt: verschönern, Speichern, Bäume fällen, Höhlen |

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
