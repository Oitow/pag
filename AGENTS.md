# PAG – Regeln für jede KI (Claude, Gemini, Codex, …)

> Diese Datei gilt für **alle** KIs und Agents. `CLAUDE.md` und `GEMINI.md` verweisen nur hierher (plus Werkzeug-Kleinkram).
> Deutsch in UI, Kommentaren, Commits. Spiele laufen auf dem Handy und per Doppelklick (file://). Three.js überall **0.170.0** (Import-Map, CDN).
> Goi arbeitet meist am Handy und per Sprache: kurze Antworten, Ergebnis zuerst, immer der Pages-Link zum Ausprobieren
> (`https://oitow.github.io/pag/<pfad>/`).

## Was liegt wo?
| Ordner | Was | Wer darf rein |
|---|---|---|
| `engine/` | 🧰 Baukasten: alle Bausteine + Spiel-Module (`engine/spiel/modul-*.js`) | wer für das Modul eingetragen ist ([`docs/ARBEIT.md`](docs/ARBEIT.md)) |
| `labore/<x>/` | 🔬 Labore: Bausteine einzeln ansehen/feintunen | zuständige KI des Bereichs |
| `testfeld/` | 🧪 gemeinsames Testfeld: alle Module zusammen, `?nur=<modul>` einzeln | nur der Zusammenführ-Schritt ändert Code hier |
| `erlenwacht/` | 🏰 das echte Spiel: nur Module auf Stufe `spiel` | nur der Zusammenführ-Schritt |
| `spiele/<x>/` | 🎮 eigenständige Spiele + alte Prototypen (meist ohne Engine) | nur wenn Goi genau dieses Spiel nennt |
| `docs/` | Stand, Regeln, Baupläne (`docs/plaene/`), Bilder (`docs/bilder/`) | |
| `tests/`, `tools/` | Spiel-Daten-Tests, Smoke-Test, Build, Bildschirmfotos, Katalog | |

Ablauf **Labor → Testfeld → Spiel** und wann ein Modul aufsteigen darf: [`docs/MODULE.md`](docs/MODULE.md).

## Wegweiser (nur lesen, was zum Thema gehört)
| Thema | Datei |
|---|---|
| Wo stehen wir? / Wer arbeitet woran? | `docs/STAND.md` · `docs/ARBEIT.md` · Festlegungen: `docs/ENTSCHEIDUNGEN.md` |
| Module, Stufen, Zuständigkeit | `docs/MODULE.md` · `engine/spiel/module-register.js` · Verträge: `docs/plaene/ERLENWACHT-MODULE.md` |
| Wie soll es aussehen? | `docs/ART-DIRECTION.md` – Pflicht für jede neue Welt / jedes neue Modell |
| SDF, Gauß-Splats, Budgets | `docs/RENDER-TECHNIK.md` |
| Testen, Bilder machen, Cloud ohne Netz | `docs/TESTEN.md` |
| Baukasten / Engine-Fahrplan / MMO-Plan | `docs/plaene/BAUKASTEN-PLAN.md`, `docs/plaene/ENGINE-FAHRPLAN.md`, `docs/plaene/ERLENWACHT-MMO-PLAN.md` |
| Baupläne | `docs/plaene/WELT-DAEMMERWALD.md`, `WELT-ENKLAVE.md`, `FIGUREN-SYSTEM.md`, `KAMPF-SYSTEM.md`, `NATUR-ASSETS.md` |
Ziel: das MMO **Erlenwacht**. Gebaut und ausprobiert wird hier in PAG; umgezogen (Repo `Oitow/Erlenwacht`) erst, wenn ein Gebiet spielbar ist.

## Mehrere KIs gleichzeitig – so gibt es keinen Salat
1. **Vor dem Start** in `docs/ARBEIT.md` eintragen: Bereich/Modul, KI, Branch. Steht der Bereich schon drin → nicht anfassen, Goi fragen.
2. **Ein Branch = ein Modul.** Branch-Name `<ki>/<modul>-<thema>`, z. B. `claude/kampf-bogen`, `gemini/welt-fluesse`. Nie direkt auf `main`.
3. **Nur eigene Dateien:** die `bausteine` des Moduls im Register + das eigene Labor. Fremden Engine-Code nur lesen.
   Braucht man etwas aus einem fremden Modul → additiv (neue optionale Option) oder als Wunsch in den PR schreiben.
4. **Geteilte Dateien** (`module-register.js`-Stufen, `KATALOG.md`, `CHANGELOG.md`, `STAND.md`, `README.md`, `index.html`) ändert nur der
   **Zusammenführ-Schritt** – siehe `docs/ARBEIT.md`. Katalog nie von Hand mergen: `npm run katalog`.
5. **Testen isoliert:** `testfeld/?nur=<modul>&test=1`. Ins gemeinsame Testfeld (Stufe `testfeld`) kommt ein Modul erst per Zusammenführ-PR.
6. Beim Fertigwerden: PR mit „Was / Geprüft / Nicht geprüft“, aus `docs/ARBEIT.md` austragen.

## Baukasten zuerst
1. Vor neuem Code: `engine/KATALOG.md` lesen (erst Übersicht/Tags, dann `grep -n -A12 "### <modul>" engine/KATALOG.md`).
2. Passt ein Baustein: importieren (`import { … } from '../../engine/…'`). Engine-Code NIE abtippen, NIE in ein Spiel kopieren.
3. Engine-Quelltext nur lesen, wenn der Katalog nicht reicht – gezielt: `grep -n "export" engine/x.js`, dann Zeilenbereich.
4. Dateien nur per Shell kopieren (`cp`, `cp -r`), nie per Lesen+Schreiben.

## Neues Wiederverwendbares → Engine
- In ≥2 Orten gebraucht oder offensichtlich generisch → nach `engine/<schicht>/`: Modul-Kopf (Format wie `engine/core/rng.js`),
  Test `x.test.mjs` daneben, `npm run katalog`. Spielspezifisches bleibt im Ordner des Spiels/Labors.
- Modulvertrag: ≤ ~300 Zeilen, eine Aufgabe, keine Globals, Fabrik `createX(opts)` mit Defaults + `dispose()`,
  Zufall nur über Seed (`engine/core/rng.js`), THREE nur via `import * as THREE from 'three'`, reine Logik ohne THREE.
- Schichten (nur abwärts importieren): core → render → world/models → input/audio/camera → gameplay → ui → spiel.

## Engine-API ändern
- Additiv (neue optionale Option) → Minor-Version im Kopf erhöhen.
- Brechend → Major erhöhen + ALLE Nutzer im selben PR anpassen (`grep -rl "engine/<pfad>" erlenwacht testfeld labore spiele`).
- Eintrag in `engine/CHANGELOG.md` (im Zusammenführ-Schritt). Im PR eigener Abschnitt „Engine“.

## Tests – wenige, aber nützliche
- Reine Logik bekommt einen Test daneben (`x.test.mjs`), höchstens ~5 Tests je Aufgabe. Prüfen, was kaputtgehen kann
  (Determinismus per Seed, Grenzen, Verträge zwischen Modulen) – keine Tests, die nur Konstanten abschreiben.
- Keine Wegwerf-Skripte (`t.js`, `drive*.mjs`, …) committen. Was man nur zum Ausprobieren braucht, gehört in ein Labor oder bleibt lokal.
- Seiten/Labore mit `spiel.json` laufen automatisch im Smoke-Test und im Build.
- Vor jedem Commit: `npm run test:schnell` (Engine) bzw. `npm test` (inkl. Smoke). Ausgaben kürzen: `npm test 2>&1 | tail -30`.

## Spiele & Labore baubar machen
- `<ort>/spiel.json` (Vorbild `erlenwacht/spiel.json`) → `npm run build` → `dist/<name>.html`. `dist/` ist generiert: nie lesen, nie committen.
- Welche Ordner als Ort zählen: `tools/orte.mjs`.

## Sehen statt glauben
- Alles Sichtbare gilt erst als fertig, wenn ein Bild gemacht UND angesehen wurde: `node tools/bild.mjs <ort> --query "?ort=…&test=1"`.
- Jede Szene hat `?test=1` (ohne Intro) und `?ort=`-Sprungmarken.
- Nie „fertig“ melden für Ungeprüftes. Was nicht geprüft werden konnte (echtes Handy, Build), steht in `docs/STAND.md` unter „Läuft / kaputt“.
- Größen immer in Metern, Mensch = 1.8 m (`docs/ART-DIRECTION.md` §1).

## Tokens sparen
- Nie ganze Riesendateien lesen (`spiele/siedlung/index.html`, `spiele/viniland/viniland.html`, `dist/`). Erst grep, dann Zeilenbereich.
- Keine Zusammenfassungen von Code, den du nicht änderst. Kurze Abschlussberichte.
