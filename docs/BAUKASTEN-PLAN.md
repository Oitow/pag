# 🧰 PAG-Baukasten – Plan & Workflow

Ziel: Eine eigene, modulare Engine in `engine/`, die alle Spiele teilen und die mit jedem Spiel wächst.
Die KI **bindet fertige, getestete Bausteine ein**, statt sie neu zu schreiben – das spart Tokens, Zeit und Fehler.

> Stand: Plan, noch nicht umgesetzt. Entstanden aus zwei Analysen des Repos (Architektur + KI-Workflow).

---

## 1. Ausgangslage (was im Repo gefunden wurde)

- Vieles existiert mehrfach: Noise/Zufall (Planet, Siedlung, Viniland, Wurzelwerk), Speichern (6 Spiele), Touch/Tastatur (fast alle), Audio (Viniland, Wurzelwerk).
- **Voxel-Tier-Loader 4× kopiert** (planet `tiere-loader.js`, autobattler, sammelspiel, voxel-tiere/welt.html). Er lädt per `fetch` – **unter `file://` (Doppelklick) geht das nicht**, dort ist der Start heute schon kaputt.
- Three.js gemischt: 0.160 (~305×) und 0.170 (Viniland).
- Kein `package.json`, kein `CLAUDE.md`, keine CI. Tests laufen einzeln von Hand.
- Schon vorhanden und wiederverwendbar: `viniland/tests/bundle.py` (Single-File-Bundler), `siedlung/tests/stub.mjs` (Fake-THREE für Node-Tests), `tests/planet-smoke.mjs` (Playwright-Smoke-Test).
- Beste Grafik steckt in **Siedlung** (Atmosphäre, Wasser, Terrain-LOD, Wetter, Auto-Qualität), beste Eingabe/Audio in **Viniland**, bester Noise in **Planet** (`js/noise.js`, schon ES-Modul).

---

## 2. Aufbau der Engine

```
engine/
  KATALOG.md          ← automatisch erzeugt: alle Bausteine mit Kurz-API (liest die KI!)
  CHANGELOG.md
  three.js            ← einzige Stelle mit der Three-Version (0.170.0)
  core/     rng  noise  math  loop  save  events
  render/   renderer  quality  atmosphere  psx  cinst  geo  textures  shadow-follow
  world/    terrain-grid  terrain-sphere/  worldgen-island  water  sky  clouds
            daynight  seasons  weather  particles
  models/   nature  buildings  build-kit  characters  voxel-animals  tiere/(Daten)
  input/    keyboard  gamepad  touch  actions
  audio/    sfx  music
  camera/   follow  orbit-rts
  gameplay/ pathfind  fsm-ai  economy  combat  loot
  ui/       toast  panel  options  hud  theme.css
  test/     fake-three.mjs  three-hook.mjs  fake-dom.mjs
games/_vorlage/       ← Startpunkt für jedes neue Spiel
tools/    build.mjs  katalog.mjs
tests/    smoke.mjs
```

### Woher die Bausteine kommen

| Baustein | Beste Quelle heute | Nutzer |
|---|---|---|
| core/rng, noise | `planet/js/noise.js` + 2D-Noise aus siedlung (Z. 93–100) | alle |
| core/math | `viniland/js/kit.js` (`clamp/lerp/damp`) | alle |
| core/loop | siedlung `loop()` (dt-Begrenzung, Fehleranzeige) | alle 3D |
| core/save | siedlung `serialize/applySave`, viniland `options.js` | alle |
| render/renderer, quality | siedlung (ACES, Schatten, Qualitätsstufen, Auto < 30 fps) | alle 3D |
| render/atmosphere | siedlung Z. 443–483 (Nebel, Streulicht, Grading, Korn) | siedlung, viniland, planet |
| render/psx ✅ | `viniland/js/psx.js` → `engine/render/psx.js` (Viniland selbst nutzt noch die eigene Datei) | Retro-Spiele, figuren-labor, testwelt |
| render/cinst | siedlung `class CInst` (Instanzen mit Culling) | siedlung, viniland, planet |
| render/geo, textures | siedlung `mergeGeos`, Canvas-Texturen; viniland `MeshBuilder` | alle Generatoren |
| world/terrain-grid | siedlung (64 Chunks, 3 LOD, Splat-Shader) | siedlung, viniland |
| world/terrain-sphere | planet `planet-chunk/terrain/worker.js` | planet |
| world/worldgen-island | siedlung `createWorld` (Erosion, Flüsse, Seen) | siedlung, neue Spiele |
| world/water, sky, weather, seasons | siedlung | alle 3D |
| models/nature, buildings | siedlung (Bäume, Felsen, Gebäude-`bake`) | siedlung, planet, viniland |
| models/characters | viniland `players.js`, planet `spieler-modell.js` | alle |
| models/voxel-animals | planet `tiere-loader.js` (ersetzt 4 Kopien) | planet, autobattler, sammelspiel, welt |
| input/* | `viniland/js/input.js` (Gamepad, Splitscreen) + planet Touch-Stick + siedlung Pan/Pinch | alle |
| camera/* | viniland `FollowCamera`, siedlung RTS-Kamera | alle 3D |
| audio/sfx, music | `viniland/js/audio.js` (aufteilen) | alle |
| gameplay/pathfind | siedlung A* | siedlung, planet, viniland |
| gameplay/fsm-ai | planet `kreaturen.js` (grasen/flucht/jagd) | planet, viniland, sammelspiel |
| gameplay/economy | siedlung Ressourcen/Produktionsketten | siedlung, sammelspiel, planet |
| gameplay/combat, loot | viniland `combat.js`, `loot.js`; autobattler-Simulation | viniland, planet, autobattler |
| ui/* | siedlung Toasts/Panels, viniland `OPTION_DEFS` | alle |

### Regeln für jeden Baustein (Modulvertrag)

- ES-Modul, nur benannte Exporte, Dateiname kebab-case.
- Fabrik-Funktion: `createX({ …optionen })` → `{ …api, update(dt), dispose() }`. Alle Optionen haben Standardwerte.
- **Keine globalen Variablen.** `window`/DOM nur in `input/`, `ui/`, `core/loop`.
- THREE nur über `import * as THREE from 'three'` (Import-Map → `engine/three.js`, eine Version).
- Reine Logik (rng, noise, pathfind, economy, worldgen) **ohne THREE** → in Node testbar.
- Zufall immer mit Seed (`rng`-Instanz übergeben), nie `Math.random` in Generatoren.
- **Klein:** Richtwert ≤ 300 Zeilen / 15 KB, sonst aufteilen.
- Deutsche Texte direkt im Modul, überschreibbar über `opts.texte`.
- Pflicht-Kopf (daraus entsteht der Katalog):

```js
/**
 * @modul    rng
 * @zweck    Deterministischer Zufall (mulberry32) + Hilfen
 * @api      rng(seed) -> ()=>number ; pick(r,arr) ; range(r,a,b)
 * @beispiel
 *   import { rng, pick } from '../../engine/core/rng.js';
 *   const r = rng(42);
 *   const baum = pick(r, ['eiche','tanne']);
 * @tags     zufall, seed, welt
 * @version  1.0.0
 * @status   stabil        // entwurf | stabil | veraltet
 * @three    nein
 */
```

### Schichten (verhindert Kabelsalat)

`core` → `render` → `world`/`models` → `input`/`audio`/`camera` → `gameplay` → `ui`

- Importe nur **abwärts**. `gameplay` zeichnet nichts (nur Daten + Events), `ui` kennt keine Spielobjekte (nur Callbacks).
- Querverbindungen über `core/events.js`.
- Ein Test prüft die Importe automatisch und schlägt bei Verstoß fehl.

### Versionen & Stabilität

- Jeder Baustein hat eine Version im Kopf (`@version`).
- **Kleine Änderung** = nur neue, optionale Optionen → Minor-Version hoch, kein Spiel bricht.
- **Brechende Änderung** = Major-Version hoch **und alle nutzenden Spiele im selben PR anpassen** (`grep -rl "engine/<modul>" games`). Alle Tests müssen grün sein.
- `CHANGELOG.md` pro Änderung. Engine-Änderungen nie „nebenbei“ in einem Spiel-PR verstecken.

---

## 3. Werkzeuge

### KATALOG.md – das Herzstück fürs Token-Sparen
- Wird von `tools/katalog.mjs` aus den Modul-Köpfen **erzeugt**, nie von Hand bearbeitet.
- Oben: Tag-Tabelle (Tag → Module) und eine Zeile pro Modul. Darunter pro Modul: Pfad, Version, Zweck, API, 3-Zeilen-Beispiel, „Genutzt von“ (automatisch per grep).
- `node tools/katalog.mjs --check` schlägt fehl, wenn der Katalog veraltet ist, ein Kopf fehlt oder eine `@api`-Funktion nicht exportiert wird. Läuft in `npm test`.
- Die KI liest **nur den Katalog** (2–4k Tokens) statt Quellcode (oft 20k+).

### Bauen: `tools/build.mjs` (esbuild)
- **esbuild** statt dem selbstgebauten `bundle.py`: kann Unterordner, `export *`, dynamische Importe (braucht Planet) und ist ein einziges kleines Paket.
- Jedes Spiel hat `spiel.json`: `{ "eintrag": "js/main.js", "html": "index.html" }`.
- Ergebnis: `dist/<spiel>.html` – **eine Datei, Doppelklick-Start bleibt erhalten**.
- Three bleibt auf dem CDN (feste Version in der Import-Map). Optional `--offline` packt Three mit ein (+~650 KB).
- Voxel-Tier-Daten werden beim Bauen als Datenmodul eingebunden → kein `fetch` mehr → **Doppelklick-Start von autobattler, sammelspiel, planet wieder heil**.
- `dist/` steht in `.gitignore`. Gebaut wird in der CI, nicht vom Agenten (sonst 600-KB-Diffs in jedem PR).

**Entwickeln:** `python3 -m http.server` im Repo-Root → Spiele laufen direkt als ES-Module.

### Testen
- **Unit-Tests:** `engine/**/x.test.mjs` mit `node:test`, ohne Zusatzpakete. Fake-THREE aus `siedlung/tests/stub.mjs` verallgemeinert; `three` wird per Loader-Hook umgeleitet.
- **Generatoren:** Snapshot-Tests mit festem Seed (Hash der Vertex-/Tile-Arrays) → merkt sofort, wenn sich eine Welt unbeabsichtigt ändert.
- **Smoke-Test pro Spiel** (`tests/smoke.mjs`, aus `planet-smoke.mjs`): Spiel in Chromium laden, 5 s laufen lassen, Fehler = rot. Zusätzlich `dist/<spiel>.html` per `file://` → prüft Doppelklick-Start. CDN wird auf lokales `node_modules/three` umgeleitet.
- `package.json`:
  ```json
  "test":         "node tools/katalog.mjs --check && node --import ./engine/test/three-hook.mjs --test engine tests && node tests/smoke.mjs",
  "test:schnell": "node tools/katalog.mjs --check && node --import ./engine/test/three-hook.mjs --test engine",
  "build":        "node tools/build.mjs",
  "katalog":      "node tools/katalog.mjs"
  ```
- **CI** (`.github/workflows/ci.yml`): `npm test` + `npm run build` bei jedem PR → grüner/roter Haken auch am Handy sichtbar. Auf `main` zusätzlich Deploy auf **GitHub Pages** (Spiele direkt im Browser spielbar, plus „⬇ Einzeldatei“-Link).

### CLAUDE.md – Regeln für die KI (Entwurf, < 80 Zeilen halten)

```md
# PAG – Regeln für den Agenten
Deutsch in UI, Kommentaren, Commits. Spiele müssen per Doppelklick (file://) und auf dem Handy laufen.

## Baukasten zuerst
1. Vor neuem Code: engine/KATALOG.md lesen (erst Tag-Tabelle, dann grep -n "<tag>").
2. Passt ein Modul: importieren. Engine-Code NIE abtippen, NIE in ein Spiel kopieren.
3. Engine-Quelltext nur lesen, wenn der Katalog nicht reicht – gezielt: grep -n "export", dann Zeilenbereich.
4. Dateien nur per Shell kopieren (cp, cp -r games/_vorlage games/neu), nie per Lesen+Schreiben.

## Neues Wiederverwendbares
- In ≥2 Spielen gebraucht oder offensichtlich generisch → nach engine/ befördern:
  Modul-Kopf, Test, npm run katalog.
- Spielspezifisches bleibt in games/<spiel>/js/.
- Modulvertrag einhalten: klein, keine Globals, Seed statt Math.random, THREE nur über 'three'.

## Engine-API ändern
- Additiv → Minor hoch. Brechend → Major hoch + ALLE Nutzer im selben PR anpassen.
- Engine-Änderungen im PR unter eigenem Abschnitt „Engine“.

## Tokens sparen
- Nie ganze Riesendateien lesen (siedlung/index.html, dist/, *.html-Bundles). Erst grep, dann Zeilenbereich.
- dist/ ist generiert: nie lesen, nie ändern.
- Testausgaben kürzen: npm test 2>&1 | tail -30.
- Kurze Abschlussberichte.

## Vor jedem Commit
npm test. README des Spiels + Spielliste in /README.md aktualisieren.
```

---

## 4. Umsetzung in Phasen

| Phase | Inhalt | Nutzen |
|---|---|---|
| **0 – Fundament** | `package.json`, `CLAUDE.md`, `engine/three.js` (0.170), `core/rng+noise+math`, Fake-THREE, `katalog.mjs`, `build.mjs`, Smoke-Test, CI | Grundgerüst, ab jetzt wächst alles automatisch mit |
| **1 – Größte Doppelung** | `models/voxel-animals` + Tierdaten (ersetzt 4 Kopien), `core/save`, `ui/toast`, `ui/options` | Doppelklick-Start wieder heil, 4 Spiele profitieren sofort |
| **2 – Eingabe & Ton** | `input/*` aus Viniland + Touch aus Planet/Siedlung, `audio/sfx+music` | Gamepad + Touch + Musik für alle |
| **3 – Render-Kern** | renderer, quality, cinst, atmosphere, shadow-follow, geo, textures (aus Siedlung) | Siedlungs-Optik für Planet/Viniland |
| **4 – Welt** | sky, daynight/seasons, weather, water, terrain-grid, worldgen-island | Neue Welten in Minuten |
| **5 – Modelle & Gameplay** | nature, buildings, characters, pathfind, fsm-ai, economy, combat, loot | Neue Spiele fast nur noch Spiellogik |
| **danach** | `games/_vorlage` fertigstellen | Start jedes neuen Spiels per `cp -r` |

**Reihenfolge der Spiele:**
1. **Viniland = Pilot** – schon modular, hat Bundler und `CONTRACT.md`.
2. **Sammelspiel + Autobattler** – klein, profitieren sofort von den Voxel-Tieren.
3. **Planet**, dann **Wurzelwerk**.
4. **Siedlung zuletzt** – sie ist die Quelle der Grafik (275 KB, hohes Risiko). Erst Code nur *herauskopieren*, das Spiel selbst erst nach Phase 4 umstellen.

---

## 5. Abläufe (Checklisten + Handy-Prompts)

### (a) Neues Spiel
> „Neues Spiel *Bienenstock*: Aufbau, Waben bauen, Touch. Nutze Baukasten.“
1. `cp -r games/_vorlage games/bienenstock` (Import-Map, Renderer, Kamera, Loop, Input – alles schon aus der Engine).
2. Katalog nach Tags durchsuchen, Module auswählen.
3. Nur Spiellogik in `js/` schreiben.
4. In `/README.md` + `/index.html` eintragen → `npm test` → PR.

### (b) Feature in bestehendem Spiel
> „Siedlung: Brücken über Flüsse. Erst Katalog prüfen.“
1. Katalog prüfen; im Spiel per grep die Stelle finden, nur den Zeilenbereich lesen.
2. Umsetzen. Generisches → Ablauf (c).
3. Test ergänzen, `npm test`, Spiel-README aktualisieren.

### (c) Code in die Engine befördern
> „Befördere den Viniland-Gamepad-Input in die Engine.“
1. Per `git mv`/`cp` nach `engine/<bereich>/` – nicht neu tippen.
2. Spielbezüge entfernen, Abhängigkeiten als Optionen.
3. Modul-Kopf + Test + `npm run katalog`.
4. Ursprungsspiel auf Import umstellen, Smoke-Test grün.

### (d) Engine-Baustein verbessern
> „Engine: Wasser schöner machen, API gleich lassen.“
1. Nutzer finden: `grep -rl "engine/world/water" games`.
2. Erst Test, der das jetzige Verhalten festhält.
3. Ändern, Version hoch, CHANGELOG.
4. Smoke-Tests aller Nutzer grün. Bei brechender API alle Spiele im selben PR anpassen.

### (e) Bestehendes Spiel umziehen
> „Migriere Wurzelwerk auf den Baukasten, Schritt 1: nur Kamera + Input.“
1. Ist-Zustand sichern (Smoke-Test + Screenshot).
2. **Pro PR nur ein Teilsystem** ersetzen, Tests grün halten.
3. Reihenfolge: Three-Version → Loader → Noise/RNG → Input → Rest.

---

## 6. Token-Bilanz (realistisch)

| Situation | Ersparnis | Warum |
|---|---|---|
| Neues Spiel | **40–60 %** | Grundgerüst wird importiert statt geschrieben; Katalog (2–4k) statt Quellcode (20k+) lesen |
| Feature in bestehendem Spiel | 10–25 % | Meiste Tokens gehen ins Verstehen des Spielcodes, Tests, Korrekturen |
| Umzug eines großen Spiels | **kostet** einmalig ~100–300k | Lohnt nur für Spiele, die weiterentwickelt werden |

Schreiben (Ausgabe) kostet etwa 5× so viel wie Lesen (Eingabe) – deshalb wirkt „importieren statt schreiben“ so stark.

**Token-Fresser, die vermieden werden:**
- Ganze Riesendateien oder `dist/` lesen
- Dateien per Lesen+Schreiben kopieren statt `cp`
- Engine-Code lesen, obwohl der Katalog reicht
- Ungekürzte Testausgaben, viele Screenshots
- Generierte Bundles committen
- Bausteine nachbauen, weil man sie nicht findet → gute Tags im Katalog
- Riesige `CLAUDE.md` (wird jede Sitzung geladen)

---

## 7. Nächster Schritt

**Phase 0 ist umgesetzt.** Abweichung vom Plan: Tests nutzen echtes THREE aus `node_modules` (läuft in Node ohne Rendern) statt Fake-THREE; `engine/test/fake-dom.mjs` liefert nur die Browser-Attrappe. Die Three-Version steht in der Import-Map jedes Spiels (0.170.0).
Nächster Schritt: Phase 1 (Voxel-Tiere, Speichern, Toasts, Optionen).
Prompt: „Setze Phase 1 vom Baukasten-Plan um.“
