# PAG – Regeln für den Agenten

Deutsch in UI, Kommentaren, Commits. Spiele müssen auf dem Handy und per Doppelklick (file://) laufen.
Plan & Abläufe: `docs/BAUKASTEN-PLAN.md`. Three.js überall **0.170.0** (Import-Map, CDN).

## Baukasten zuerst
1. Vor neuem Code: `engine/KATALOG.md` lesen (erst Übersicht/Tags, dann `grep -n -A12 "### <modul>" engine/KATALOG.md`).
2. Passt ein Modul: importieren (`import { … } from '../../engine/…'`). Engine-Code NIE abtippen, NIE in ein Spiel kopieren.
3. Engine-Quelltext nur lesen, wenn der Katalog nicht reicht – gezielt: `grep -n "export" engine/x.js`, dann Zeilenbereich.
4. Dateien nur per Shell kopieren (`cp`, `cp -r`), nie per Lesen+Schreiben.

## Neues Wiederverwendbares → Engine
- In ≥2 Spielen gebraucht oder offensichtlich generisch → nach `engine/<schicht>/` befördern:
  Modul-Kopf (Format wie `engine/core/rng.js`), Test `x.test.mjs` daneben, `npm run katalog`.
- Spielspezifisches bleibt in `games/<spiel>/`.
- Modulvertrag: ≤ ~300 Zeilen, eine Aufgabe, keine Globals, Fabrik `createX(opts)` mit Defaults + `dispose()`,
  Zufall nur über Seed (`engine/core/rng.js`), THREE nur via `import * as THREE from 'three'`, reine Logik ohne THREE.
- Schichten (nur abwärts importieren): core → render → world/models → input/audio/camera → gameplay → ui.

## Engine-API ändern
- Additiv (neue optionale Option) → Minor-Version im Kopf erhöhen.
- Brechend → Major erhöhen + ALLE Nutzer im selben PR anpassen (`grep -rl "engine/<pfad>" games`).
- Eintrag in `engine/CHANGELOG.md`. Im PR eigener Abschnitt „Engine“.

## Spiele
- Spiel baubar/testbar machen: `games/<spiel>/spiel.json` (siehe `games/viniland/spiel.json`).
- `npm run build` → `dist/<spiel>.html` (Einzeldatei). `dist/` ist generiert: nie lesen, nie committen.

## Tokens sparen
- Nie ganze Riesendateien lesen (`games/siedlung/index.html`, `games/viniland/viniland.html`, `dist/`). Erst grep, dann Zeilenbereich.
- Testausgaben kürzen: `npm test 2>&1 | tail -30`.
- Keine Zusammenfassungen von Code, den du nicht änderst. Kurze Abschlussberichte.

## Arbeitsteilung (Limit schonen)
Das Hauptmodell plant, entscheidet und löst den schwierigen Kern. Alles andere wird delegiert (`.claude/agents/`):
- `sucher` (Haiku) – Stellen finden, bevor irgendwas Großes gelesen wird.
- `bauer` (Sonnet) – klar beschriebene Aufgaben umsetzen. Auftrag immer mit Dateien, Ziel, Abnahmekriterium.
- `tester` (Haiku) – Tests/Build laufen lassen, meldet nur GRÜN/ROT.
- `pruefer` (Sonnet) – Diff-Review, nur bei großen Änderungen.
Selbst machen: Architektur, neue Algorithmen, Performance-Probleme, Fehlersuche mit unklarer Ursache.
Sitzungen: `/start` liest `docs/STAND.md`, `/ende` schreibt sie. Ein Thema pro Sitzung.

## Vor jedem Commit
`npm run test:schnell` (Engine) bzw. `npm test` (inkl. Smoke). README des Spiels + Spielliste in `/README.md` aktualisieren.
