# Erlenwacht – MMO-Ausbau (Bauplan, 6 Agents parallel)

> Baut auf `docs/ERLENWACHT-MODULE.md` auf (Modul-Form, Weltkarte, APIs). Branch `erlenwacht-mmo`.
> Jeder Agent fasst NUR seine Dateien an. `KATALOG.md`, `CHANGELOG.md`, `STAND.md`, `module-liste.js` schreibt nur das Hauptmodell.

## Spielablauf (Ziel)
Titel → **Held erstellen** (Name, Klasse, Aussehen) → Start am Strand → **Tutorial** (Mentorin Alwe) → Waldtor → Ratten am Waldrand →
Beute aufheben + anlegen → durch den Dämmerwald → Erlenwacht (Hauptmann Brandt) → Hochlandlager → Moor → Boss „Wolfsfels“.
Stufe 1–15, Talentpunkte ab Stufe 2, neue Fähigkeiten bei 1/3/5/8/12. Speichern automatisch + im Menü.

## Regeln für alle Agents
- **Tests: höchstens 5** (`test(...)`-Aufrufe) je Agent, eine Testdatei, nur reine Logik. Nur eigene Tests laufen lassen:
  `node --test engine/x/y.test.mjs`. Kein `npm test` / `npm run katalog` (macht das Hauptmodell am Ende).
- **Leistung (Handy!)**: je Modul ≤ +8 Draw-Calls (InstancedMesh, geteilte Materialien), keine Speicher-Anlage pro Bild
  (Vektoren vorab), DOM höchstens 10×/s aktualisieren, nur Text ändern wenn er sich ändert, `render.stufe.name === 'niedrig'` beachten.
- Modul-Kopf wie `engine/core/rng.js` (@modul … @status), Deutsch, kein `Math.random()`, alles in `dispose()` weg, UI nur unter `render.ui`.
- Optionale Nachbarn können fehlen (`ctx.optional(n)` → null) – Modul muss trotzdem laufen.
- Ein Bild ansehen ist erwünscht, wenn es Sichtbares gibt: `node tools/bild.mjs erlenwacht --query "?test=1&ort=tor" --hoch` (siehe `docs/TESTEN.md`).
- Abschlussbericht ≤ 10 Zeilen: Dateien, API, Testergebnis, Offenes.

## Bildschirm-Aufteilung (Handy hochkant zuerst)
| Bereich | Wer |
|---|---|
| oben links: Spieler-Rahmen (Name, Stufe, Leben, Ressource, XP-Leiste dünn) | oberflaeche |
| oben Mitte: Ziel-Rahmen (Lock-On-Ziel, Stufe, Leben) | oberflaeche |
| oben rechts: ☰ Menü-Knopf + Minikarte (≈ 92 px) darunter | oberflaeche |
| rechts unter der Karte: Aufgaben-Verfolger (max. 3 Zeilen) | tutorial (eigenes Element, `top: 170px; right: 8px`) |
| links Mitte/unten über dem Stick: Chat (eingeklappt 3 Zeilen, tippen = groß) | oberflaeche |
| unten: Stick links, Knopf-Bogen rechts (⚔ ⤒ 🌀 🏃 🎯 💬) | spieler (fertig) |
| über dem Knopf-Bogen: EINE Aktionsleiste (Handy `unten: 228px`) | kampf (Krieger/Waldläufer) ODER zauber (Magier) |
| Mitte: Sprechblasen/Dialog-Fenster der NPCs | tutorial |

## Ereignisse (Bus `ctx.ereignisse`, `sende(name, daten)` / `an(name, fn)`)
Vorhanden: `ent:neu|treffer|tod|weg`, `spieler:aktion {name}`, `zauber:wirke {name}`. Bei `ent:tod` lebt die Entität noch (`lebt:false`) → `hole(id)` geht.
Neu:
- `fort:xp {menge, gesamt, stufe, grund}` · `fort:stufe {stufe, punkte}` · `fort:drop {id, pos, gegenstand, seltenheit}`
- `fort:beute {gegenstand, anzahl, name, seltenheit}` (aufgehoben) · `fort:ausgeruestet {sockel, gegenstand|null}` · `fort:talent {id, stufe}`
- `kampf:faehigkeit {name, klasse}` · `kampf:angriff {waffe, treffer}`
- `aufgabe:neu {id, titel}` · `aufgabe:schritt {id, text, anteil}` · `aufgabe:fertig {id, titel}`
- `chat:sende {kanal, text, von?, farbe?}` – **jeder darf senden**, oberflaeche zeigt an. Kanäle: `system`, `kampf`, `beute`, `sagen`, `aufgabe`, `welt`.
- `gegner:boss {id, phase, name}` · `gegner:warnung {pos, radius, dauer}` (Boden-Ring vor Boss-Angriff)

## Gegenstände (Fortschritt besitzt das Register)
Gegenstand-ID als Text. Ausrüstung trägt `daten = { stufe, seltenheit, werte:{…}, affixe:[…] }` (Inventar-Platz-Daten).
Seltenheit: `gewoehnlich` #c8c8c8 · `selten` #4aa3ff · `episch` #b46cff · `legendaer` #ffa63a.
Sockel: `waffe, kopf, brust, beine, fuesse, schmuck`. Werte-Namen: `staerke, intellekt, geschick, ausdauer, ruestung, schaden, zauberkraft, krit, tempo, leben, mana`.
Beute-Tabellen per Name: `ratte, riesenratte, wolf, keiler, irrlicht, boss` (+ `kiste`).

## Modul-APIs (neu)
**fortschritt** (Agent 1) `braucht: ['entitaeten'], optional: ['render','spieler','welt']`, Optionen `{ name, klasse: 'krieger'|'magier'|'waldlaeufer' }`:
`{ held:{name,klasse}, stufe, xp, xpNaechste, gibXp(n, grund), gibGegenstand(id, anzahl=1, daten?) -> rest, inventar /* gameplay/inventar */,
 register, ausruestung:{ hole(sockel), lege(platz)->bool, ab(sockel)->bool, alle() }, werte() -> {…}, talente:{ punkte, baum, stufe(id), hat(id), lerne(id)->{ok,grund} },
 seltenheitFarbe(s), beschreibe(gegenstandId, daten) -> {name, zeilen:[…], farbe}, drops /* liegende Beute */ }`.
XP für Gegner: `ent.daten.xp` (sonst 5 × stufe). Wendet Werte auf die Spieler-Entität an (`lebenMax` über `aendere`). Beute fällt bei `ent:tod` (Team feind) nach `ent.daten.beute`, liegt als leuchtender Beutel (1 InstancedMesh), wird im Umkreis 2 m automatisch aufgehoben. Spieler-Tod: kein Verlust. Zustand/lade vollständig.

**kampf** (Agent 3) `braucht: ['spieler','entitaeten'], optional: ['fortschritt','zauber','gegner','render']`:
`{ klasse, angriff(), nutze(name)->bool, leiste /* gameplay/faehigkeiten */, ressource:{name,wert,max}, faehigkeiten /* freigeschaltete Namen */ }`.
Nahkampf über `gameplay/nahkampf` (+ `nahkampf-daten` WAFFEN), Taste F / Knopf ⚔ = `spieler.eingabe.gedrueckt('aktion1')`. Schaden über `entitaeten.schade` (`quelle: spieler.id`), Werte aus `fortschritt.werte()`.
Klassen-Daten in `engine/gameplay/klassen-daten.js`. Magier: ruft `zauber.setzeLeiste(namen)` mit den freigeschalteten Zaubern; andere Klassen: `zauber.setzeLeiste([])` und eigene `ui/kampf-leiste`.

**zauber** (Agent 3 ergänzt additiv): `setzeLeiste(namen)` (leer = Leiste aus), Minor-Version.

**gegner** (Agent 2): wie bisher + neue Arten, Stufen je Lager (`ort.stufe`), Boss am Ort der Art `boss`. Entität: `daten: { stufe, xp, beute, art, boss? }`.

**welt** (Agent 6): wie bisher + `orte` bekommen `stufe` (Gegnerlager) und neue Orte (siehe Agent 6). Neue Region-Grenze weich.

**tutorial** (Agent 5) `braucht: ['welt','spieler'], optional: ['entitaeten','fortschritt','kampf','render','himmel']`: `{ aufgaben /* gameplay/aufgaben */, npcs, sprich(npcId) }`.

**oberflaeche** (Agent 4) `braucht: ['render'], optional: alles`: `{ chat, menue, hud, minikarte, zeigeFenster(name) }`. Hört auf alle Ereignisse oben.

## Agents & Dateien
| # | Agent | Dateien (nur diese!) |
|---|---|---|
| 1 | Fortschritt + Beute | `engine/gameplay/progression.js`, `engine/gameplay/beute.js`, `engine/gameplay/gegenstaende-daten.js`, `engine/gameplay/progression.test.mjs`, `engine/spiel/modul-fortschritt.js` |
| 2 | Gegner + Boss | `engine/models/kreaturen/wolf.js`, `keiler.js`, `irrlicht.js`, `engine/gameplay/horde.js` (additiv: Arten), `engine/gameplay/gegner-lager.js` (additiv), `engine/gameplay/boss.js`, `engine/gameplay/boss.test.mjs`, `engine/spiel/modul-gegner.js` |
| 3 | Kampf + Fähigkeiten | `engine/gameplay/klassen-daten.js`, `engine/gameplay/klassen.test.mjs`, `engine/spiel/modul-kampf.js`, `engine/spiel/modul-zauber.js` (nur `setzeLeiste`) |
| 4 | Oberfläche (Menü, Chat, HUD, Figur-Editor, Start) | `engine/ui/chat.js`, `engine/ui/chat.test.mjs`, `engine/ui/figur-editor.js`, `engine/ui/minikarte.js`, `engine/spiel/modul-oberflaeche.js`, `games/erlenwacht/index.html`, `games/erlenwacht/js/main.js`, `games/erlenwacht/js/start.js` |
| 5 | Tutorial + Quest-NPCs | `engine/spiel/modul-tutorial.js`, `engine/spiel/tutorial-daten.js`, `engine/spiel/tutorial-daten.test.mjs` |
| 6 | Weltgenerator v2 | `engine/world/welt-regionen.js`, `engine/world/welt-streu.js`, `engine/world/fern-wald.js`, `engine/world/welt-regionen-v2.test.mjs`, `engine/spiel/modul-welt.js` |
