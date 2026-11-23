# 🏰 Die Enklave – Bauplan (Welt · Tutorial · Stadt · Assets)

> Neues Spiel `labore/enklave/`: Tutorial-Tal → Pfad → ummauerte Stadt. Grundstein für das spätere MMO (Startgebiet + erste Stadt).
> 4 Bau-Agenten arbeiten **parallel** (A1–A4, §6), danach der Integrator (I). Regeln: `CLAUDE.md`, Mehrspieler: `docs/plaene/ENGINE-FAHRPLAN.md`.

## 0 · Konventionen (gelten für alle)
- Meter, **y oben**, Blick/Front = `(sin yaw, cos yaw)` in (x, z); yaw 0 = +z. Drehung lokal→Welt wie `THREE rotation.y = w`:
  `x = px + lx·cos w + lz·sin w`, `z = pz − lx·sin w + lz·cos w` (so auch `labore/handwerk/js/lager.js`, `world/kollision`-Kasten, `gameplay/tueren`).
- Zufall nur `engine/core/rng.js` (`rng(hashSeed('name', seed, …))`), kein `Math.random()`. Modulkopf exakt wie `engine/core/rng.js`
  (@modul @zweck @api @beispiel @tags @version 1.0.0 @status entwurf @three). ≤ ~300 Zeilen je Datei, sonst teilen.
- Fabrik `create<X>(opts)` mit Defaults + `dispose()`; reine Logik ohne THREE/DOM; Test `x.test.mjs` daneben (`node:test`).
- Agenten schreiben **nur ihre Dateien** + je einen Eintrag in `engine/CHANGELOG.md` (oben anhängen). `npm run katalog` darf jeder laufen lassen;
  Konflikte in `KATALOG.md` löst der Integrator durch erneutes `npm run katalog`. Kein Agent ändert bestehende Engine-Module.

## 1 · Spielidee & Ablauf
Man erwacht im **Tal der Ersten Schritte** (Lichtung, Bach, Lagerfeuer, Zelt, Mentorin **Alwine**). Stationen der Reihe nach (Daten: `tutorial-daten.js`):

| # | Schritt (Aufgaben-Art) | Ort (relativ Tal-Mitte) | Engine dahinter |
|---|---|---|---|
| 1 | „Sprich mit Alwine“ (sprich-mit `mentor`) | Lagerfeuer (0, 0) | interaktion, figur-schild |
| 2 | Laufen + Kamera: „Geh zum Steinkreis“ (gehe-zu, r 3) | (12, −8) | move-input, follow-camera |
| 3 | Springen: „Spring über den Bach“ (gehe-zu jenseits, benutze `sprung`) | Bach bei lx≈22, Stamm (22, 8) | character-motor, kollision |
| 4 | „Sprich mit Späher Bo“ (sprich-mit `bo`) | (32, 2) | interaktion |
| 5 | „Sammle 3 Heilkräuter“ (sammle `heilkraut` 3) + „Öffne den Rucksack“ (benutze `inventar`) | um (36, −12) | welt-dinge, inventar, inventar-ansicht |
| 6 | „Schlag die Trainingspuppe“ (benutze `treffer:puppe` 5) | (38, 12) | nahkampf, kampf |
| 7 | „Wirke Funkenschlag auf die Zielscheibe“ (benutze `zauber:*` 2) | (44, 18) | zauber, zauber-effekte |
| 8 | „Vertreibe die Ratten“ (besiege `ratte` 6; signal `ratten-klein`) | Tal-Ostrand (50, 0) | horde, horde-mesh, ratte |
| 9 | „Großzauber-Kostprobe: Flutwelle!“ (benutze `gross:welle`, besiege `ratte` 12; signal `ratten-welle`) | (52, 0) | grosszauber(-welle) |
| 10 | „Folge dem Weg nach Osten“ (gehe-zu Wegweiser) | Tal-Ausgang (55, −15) | wegweiser-Asset |
| 11 | „Überquere die Brücke“ (gehe-zu Brückenende) | Fluss | wege-mesh, wege-lage |
| 12 | „Blick vom Aussichtspunkt“ (gehe-zu + warte 3 s, Kamerafahrt zur Enklave) | Kuppe | follow-camera.fahrt |
| 13 | „Erreiche das Tor der Enklave“ (gehe-zu, r 6) → Wachen grüßen, Tor öffnet | Tor-Vorplatz | tueren, character-brain |

Ende: großes Banner **„Willkommen in der Enklave“**, Belohnung (Münzen, Umhang), Tutorial = fertig (gespeichert). Danach freies Erkunden
der Stadt: Marktplatz mit Brunnen, 4 Händlerstände, 5 Häuser, Taverne, Schmiede (Station `amboss`), Wachturm, Tempel/Zauberturm,
~10 NPCs mit Tagesablauf (Händler 7–19 Uhr am Stand, danach Taverne; Schmied hämmert; Wachen am Tor + Patrouille; Priesterin am Tempel).
Wegrand: Laternen alle ~25 m, Wegweiser an Abzweigen, Bänke am Aussichtspunkt. Länge Lagerfeuer → Tor **≈ 420 m** (Tal-Ausgang → Tor-Vorplatz ≈ 355 m, mit Kurven).

## 2 · Weltaufbau: fester Seed + deterministischer Plan
**Welt:** `createWorld({ preset: 'insel', seed: hashSeed('enklave', 1), breite: 256, tiefe: 256, qualitaet: 'normal', form: { radius: 0.95 },
wasser: { flussMenge: 0.45 }, orte: { doerfer: 0 }, stufen: plan.stufen })`; Adapter `{ hoehenSkala: 60, meterProZelle: 2.5 }` → **640 × 640 m**,
Meer am Horizont. Gelände 256² (≈130 k Dreiecke, wie Testwelt). Gewässer/Pfade mind. 1 Zelle breit (2.5 m). Kein Zufallsfund von Orten: das neue Modul **`engine/world/welt-plan.js`**
liefert **worldgen-Stufen**, die das Höhenfeld formen, *bevor* Wasser, Orte, Wege und Objekte berechnet werden – Bäume entstehen in
freien Bereichen gar nicht erst (`FLAG.FREI`), Brücken/Wege haben das Format von `worldgen-wege` → `wege-lage`, `wege-mesh`, `terrain-farben` funktionieren unverändert.

**Stufen** (Einhängen über `opts.stufen`, siehe `worldgen.js` `stufenliste`):
1. `plan-gelaende` (nach `erosion`): Zonen formen, Gewässer-Rinnen mit stetem Gefälle zum Meer graben, Platz-Grundflächen einebnen.
2. `plan-wasser` (nach `fluesse`): sichert jedes Plan-Gewässer – Zellen bekommen `FLAG.FLUSS`, `flussBreite`, `wasserstand` (Bett um `tiefe`
   unter Ufer), Eintrag in `welt.fluesse` (`{ punkte: Float32Array [x,y…], breite: Float32Array je Punkt, muendung }`), falls die Hydrologie sie verfehlt hat.
3. `orte` (ersetzt): `welt.orte = { start: Spawn, doerfer: [Enklave-Mitte], poi: [{ art: 'aussicht', … }] }` (Generator-Einheiten = Zelle), `FLAG.ORT|FREI` auf Zonen.
4. `wege` (ersetzt): Pfade als Spline (1 Punkt/Zelle) → **Höhenprofil** mit Vor-/Rückwärts-Begrenzung `|dh/ds| ≤ maxGefaelle` (Damm/Einschnitt,
   Böschung `rand` m weich), Wasserzellen bleiben unberührt und werden **Brücken** (`{x,y,laenge,dx,dy}`; Ufer ≥ Wasser + 0.6 m);
   Zellen `FLAG.WEG|FREI`; `welt.wege = [{ von, nach, punkte, laenge, bruecken }]`, `welt.wegKnoten`. Plätze mit `boden: 'weg'` → `FLAG.WEG` (Marktplatz/Straßen braun).
Höhen intern normiert: `h = meter / hoehenSkala`; Gitter `gx = x / meterProZelle + breite/2` (Ursprung Kartenmitte wie `worldgen-adapter`).

**Plan-Format** (reine Daten, Meter, Welt-Koordinaten; `lx/lz` = lokal zur Zone mit deren `drehung`):
```js
{ zonen: [ { id, art: 'plateau'|'mulde'|'kuppe'|'eben'|'frei', x, z, radius | streifen: [[x,z],[x,z]], breite,
             drehung = 0, hoehe?: m absolut | anheben = 0 (m über Median der Zone), tiefe? (mulde), rand = 15 (Übergang m),
             frei = 1 (Anteil des Radius ohne Objekte), minLand = 2 (m über Meer) } ],
  gewaesser: [ { id, punkte: [[x,z]…] (Quelle → Mündung), breite, tiefe, rinne = 3×breite (Talbreite m) } ],
  pfade:     [ { id, punkte: [[x,z]…], breite = 3, maxGefaelle = 0.14, rand = 4, frei = 3, von: 'tal', nach: 'enklave' } ],
  ringe:     [ { id, zone, radius, ecken = 8, tor: 0 (Ecken-Index-Seite, die nach lokal +z zeigt), segment = 6, turm = 4.5, torBreite = 9 } ],
  plaetze:   [ { id, art, variante = 0, x, z | zone, lx, lz, winkel = 0, bx, bz (halbe Grundfläche), ebnen = bx ≥ 1.5, boden?: 'weg', daten? } ],
  spawn: { x, z, yaw } }
```
**API `welt-plan.js`** (Form-Rechnungen in `welt-plan-formen.js`, beide ohne THREE):
```js
createWeltPlan(plan, { meterProZelle = 2, hoehenSkala = 60 }) -> {
  plan,                               // aufgelöst + eingefroren: alle Plätze in Welt-x/z/winkel, Ring-Plätze ergänzt
  stufen,                             // [{name:'plan-gelaende',nach:'erosion',run},{name:'plan-wasser',nach:'fluesse',run},{name:'orte',run},{name:'wege',run}]
  zone(id), zoneBei(x, z) -> id|null, platz(id), plaetze(art?) -> [platz],
  pfad(id) -> { punkte: Float32Array [x,z,…] (m), laenge, bruecken: [{x,z,laenge,winkel}] } | null (erst nach createWorld),
  lokalZuWelt(platz, lx, lz) -> {x,z}, koerperZuWelt(koerper, platz, y) -> koerper,   // y = Bodenhöhe des Platzes
  pruefe(adapter) -> { ok, fehler: [text], werte: { pfadLaenge, maxGefaelle, maxUnebenheit, objekteImWeg, ueberlappungen } },
  dispose() }
ringPlaetze(ring, zone) -> [platz]   // Mauer-Segmente (art 'mauer', sx = Streckung), Türme an Ecken ('mauer-turm'), Torhaus ('torhaus') an lokal +z, Front nach außen
profil(hoehen, abstaende, maxGefaelle, fest = [0, n-1]) -> Float32Array
```
**Startwerte `labore/enklave/js/plan-daten.js`** (Integrator; mit `pruefe()` nachjustieren): Tal `mulde` (−175, 150) r 55, tiefe 5, frei 0.75;
Enklave `plateau` (150, −137) r 46, anheben 6, rand 22, drehung = atan2(−325, 287) ≈ −0.847 (lokal +z zeigt zum Tal); Aussicht `kuppe` (60, −20)
r 9, anheben 4; Sichtachse `frei` streifen [[60,−20],[125,−115]] breite 18. Fluss: [[−50,−250],[−19,−125],[0,0],[−6,137],[31,300]] breite 6 tiefe 1.5;
Bach: [[−153,75],[−153,125],[−154,175],[−148,250],[−138,305]] breite 2 tiefe 0.5. Pfad `hauptweg`: [[−120,135],[−95,105],[−75,70],[−50,40],[−25,15],
[22,−8] (Brücke bei ≈ (0, 3)),[60,−20] (Aussicht),[90,−50],[105,−80],[118.5,−109.2]] (Ende = Tor-Vorplatz lokal (0, 42); Tor selbst ≈ (125.1, −114.9)).
Spawn: Tal lokal (−3, 2), yaw zum Feuer. Ring `mauer`: r 36, 8 Ecken, Tor an lokal +z.
Plätze lokal Enklave (lx, lz, winkel): torhaus (0, 33.3, 0) · strasse `eben`/`boden:'weg'` (0, 18) bx 2 bz 15 · markt (0, 2) r 9 `boden:'weg'` · brunnen (0, 2) ·
stände (−7, 6, π/2) (7, 6, −π/2) (−7, −3, π/2) (7, −3, −π/2) · taverne (−12, 17, π/2) · schmiede (12, 17, −π/2) · tempel (0, −22, 0) ·
wachturm (−23, −9, 1.2) · häuser (−21, 4, π/2, v0) (21, 4, −π/2, v1) (−15, −15, 0.79, v1) (15, −15, −0.79, v0) (24, −8, −1.25, v0) · Laternen/Bänke/Wegweiser
entlang `hauptweg` (Integrator verteilt per `pfad().punkte` alle 25 m, seitlich 2.5 m). Tal-Plätze: lagerfeuer, zelt, steinkreis, stamm, puppe, zielscheibe, wegweiser.

## 3 · Assets (`engine/models/bau/`, Low-Poly, Vertexfarben über `render/mesh-builder`)
**Vertrag jedes Assets** – `create<Name>({ seed = 1, variante = 0, … }) -> asset`:
`{ name, variante, geometrie (position/normal/color; Ursprung Mitte Grundfläche, y = 0 Boden, Sockel bis y = −0.5, Front/Tür nach +z),
leucht (Geometrie|null: Flammen, Fenster, Kristall – Spiel zeichnet unbeleuchtet, ohne Schatten), kollision ([Körper lokal wie world/kollision]),
anker ({ tuer?, fackeln?: [{x,y,z}], licht?: [{x,y,z,farbe,staerke}], station?: {art,x,z}, wachen?: [{x,z,winkel}], sitz?, schild?, fluegel?: [{x,z,angel}] }),
masse ({ breite (x), tiefe (z), hoehe }), dreiecke, dispose() }`. Budget: Kleinteil ≤ 400, Gebäude ≤ 1500 Dreiecke (inkl. leucht).
Stil: kräftige, leicht entsättigte Farben, Fachwerk/Stein/Holz, Dächer überstehend 0.4 m, Farbvariation über `seed` (mesh-builder `jitter`).
Gemeinsam: **`engine/models/bau/bau-basis.js`** (liegt bereits im Repo – A2 und A3 importieren nur):
```js
/**
 * @modul    bau-basis
 * @zweck    Gemeinsame Farben und Helfer für Bau-Assets: lokale Kollisions-Körper, Asset-Ergebnis mit dispose
 * @api      FARBEN ; kasten(x,z,bx,bz,hoehe,{winkel,y0,begehbar}) -> koerper ; kreis(x,z,radius,hoehe,{y0,begehbar}) -> koerper ; asset(teile) -> asset
 * @beispiel
 *   import { FARBEN, kasten, asset } from '../../engine/models/bau/bau-basis.js';
 *   const kiste = asset({ name: 'kiste', geometrie, kollision: [kasten(0, 0, 0.4, 0.4, 0.8)], masse: { breite: 0.8, tiefe: 0.8, hoehe: 0.8 } });
 * @tags     bau, gebaeude, asset, farben, kollision
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
export const FARBEN = Object.freeze({ putz: '#d8cdb4', putzDunkel: '#b9ab8f', fachwerk: '#5a3d29', holz: '#8a6240', holzDunkel: '#5b3f27',
  holzHell: '#b08a5a', stein: '#9b968c', steinDunkel: '#726d65', steinHell: '#bdb7aa', dachRot: '#9a4a32', dachSchiefer: '#4e5766',
  stroh: '#c8a85a', metall: '#5d6168', eisen: '#3c3f44', gold: '#c9a23a', fenster: '#2b313a', stoffRot: '#a5332c', stoffBlau: '#2f5c8a',
  stoffGruen: '#4d7a3a', stoffGelb: '#c99a2e', glut: '#ff8a2a', flamme: '#ffc65a', licht: '#ffe3a0', wasser: '#3f7fa8', kristall: '#7fd8ff' });
export const kasten = (x, z, bx, bz, hoehe, { winkel = 0, y0 = 0, begehbar = false } = {}) =>
  ({ form: 'kasten', x, z, bx, bz, winkel, y0: y0 - 0.3, hoehe: hoehe + 0.3, begehbar });
export const kreis = (x, z, radius, hoehe, { y0 = 0, begehbar = false } = {}) =>
  ({ form: 'kreis', x, z, radius, y0: y0 - 0.3, hoehe: hoehe + 0.3, begehbar });
export function asset({ name, variante = 0, geometrie, leucht = null, kollision = [], anker = {}, masse }) {
  return { name, variante, geometrie, leucht, kollision, anker, masse,
    dreiecke: (geometrie.attributes.position.count + (leucht ? leucht.attributes.position.count : 0)) / 3,
    dispose() { geometrie.dispose(); leucht?.dispose(); } };
}
```
**A2 · Gebäude** (B × T × H m, Δ = max. Dreiecke):

| Datei · Fabrik | Maße | Inhalt / Anker | Δ |
|---|---|---|---|
| `haus.js` · `createHaus` v0 | 6 × 5 × 6.5 | Fachwerk, Satteldach rot, Fensterläden; tuer (Front), fackeln 1, licht (Fenster) | 1200 |
| `haus.js` · v1 | 7 × 6 × 7.5 | Steinhaus, Schieferdach, Kamin, Vordach; tuer, kamin {x,y,z} | 1200 |
| `taverne.js` · `createTaverne` | 10 × 8 × 8.5 | 2 Geschosse, Erker, Vordach mit Bänken, Ausleger-Schild (Krug); tuer 1.4 breit, sitz [..], licht 3 | 1500 |
| `schmiede.js` · `createSchmiede` | 7 × 6 × 5 | Steinsockel, offener Pultdach-Anbau, Esse (leucht glut), Wasserbottich; station {art:'amboss'}, licht | 1400 |
| `wachturm.js` · `createWachturm` | 4.5 × 4.5 × 11 | Stein, Holz-Obergeschoss mit Zinnen, Flagge; fackeln 2, wachen 1 (oben, nur Deko) | 900 |
| `tempel.js` · `createTempel` | 10 × 12 × 14 | Halle 8 × 6 × 6 + runder Zauberturm Ø 6, Kegeldach blau, schwebender Kristall (leucht); tuer, licht | 1500 |
| `mauer.js` · `createMauer` | 6 × 1.4 × 4.5 | Segment mit Zinnen, Wehrgang angedeutet; Kollision 1 Kasten (in x streckbar: `sx`) | 250 |
| `mauer.js` · `createMauerTurm` | Ø 4.5 × 7.5 | 8-eckig, Zinnenkranz, Schießscharten; fackeln 1 | 400 |
| `mauer.js` · `createTorhaus` | 9 × 6 × 8.5 | Durchgang 4.8 × 4.2 (frei!), Zinnen, 2 Banner-Halter; Kollision = 2 Pfeiler + Sturz (y0 4.2); fluegel [{x:±1.2,z:0,angel}], wachen 2 (außen), fackeln 2 | 1200 |
| `mauer.js` · `createTorfluegel` | 2.4 × 4.1 × 0.25 | Bohlen + Eisenbänder, **zentriert** (x ∈ ±1.2, y 0…4.1) – passt zu `gameplay/tueren` (Pivot an angelPos, Blatt ±breite/2) | 150 |

**A3 · Kleinkram** (Dateien gruppiert, je ≤ 300 Zeilen):

| Datei | Fabriken (Maße m · Δ) |
|---|---|
| `markt.js` | `createMarktstand` 3 × 2 × 2.6, Stoffdach Farbe je variante 0–3, Waren-Kisten (350) · `createBrunnen` Ø 2.6 × 3, Holzdach + Kurbel, Wasserfläche (400) · `createBank` 1.8 × 0.5 × 0.85, sitz (80) |
| `vorrat.js` | `createFass` Ø 0.7 × 0.9 (120) · `createKiste` 0.8 × 0.8 × 0.8, v1 = flach 1.2 × 0.8 × 0.5 (60) · `createBanner` Stange 4 m + Tuch 0.9 × 2, Farbe je variante (100) |
| `licht.js` | `createLaterne` Pfahl 2.8 m, Laterne leucht, licht-Anker (120) · `createFackel` Wandfackel 0.6 m, leucht (60) · `createLagerfeuer` Steinring Ø 1.4, Scheite, Flammen leucht (200) |
| `wegbau.js` | `createWegweiser` Pfahl 2.4 m + `schilder: [{ winkel, text }]` 1–3 Pfeilbretter, anker.schild (150) · `createZaun` Segment 2 × 1.1, v0 Latten, v1 Flechtwerk (120) · `createSteinkreis` Ø 4, 7 Steine (300) |
| `uebung.js` | `createTrainingspuppe` 1.8 hoch, Pfahl + Strohsack + Querbalken (250) · `createZielscheibe` Ø 1.2 auf Gestell (150) · `createZelt` 3 × 3 × 2.4, Eingang +z (200) · `createAmboss` 0.9 × 0.4 × 0.8 (100) |

Fluss-Brücke: **`world/wege-mesh` reicht** (Plan liefert `bruecken`), keine eigene Brücke. Liegender Stamm über dem Bach: `totholz` (`liegenderStamm`) + Kollisions-Kasten.

## 4 · Aufgaben-Logik + Anzeige
**`engine/gameplay/aufgaben.js`** (ohne THREE/DOM; eine Instanz je Spieler → Server kann dieselben `melde()`-Befehle nachrechnen):
```js
createAufgaben({ daten, ereignisse = null, zaehle = null /* (dingId) => Anzahl im Inventar */, ortVon = null /* (name) => {x,z}|null */ }) -> {
  starte(id) -> bool, status(id) -> 'neu'|'aktiv'|'fertig', aktiv() -> [id], fertig(id) -> bool,
  melde(art, info) -> Anzahl betroffener Schritte,   // 'gesprochen' {mit} · 'gesammelt' {id, anzahl=1} · 'besiegt' {art, anzahl=1} · 'benutzt' {was, anzahl=1}
  update(dt, wer /* {x,z} */) -> ereignisse[],        // gehe-zu (Abstand ≤ radius), warte (Zeit; mit ort nur im radius), sammle über zaehle()
  aktuell(id?) -> { aufgabe:{id,name}, schritt, index, anzahl, wert, ziel, anteil, text, hinweis, ort:{x,z}|null } | null,
  springe(id, schritt /* Index|id */), brichAb(id), zustand() -> { v: 1, aktiv: {id: {schritt, wert, zeit}}, fertig: [id] }, laden(z),
  onAenderung(fn) -> abmelden, dispose() }
pruefeDaten(daten) -> [fehlerText]      // reine Prüfung, auch für Spiele-Tests
```
Aufgabe: `{ id, name, schritte: [...], belohnung?: { gegenstaende: [{id, anzahl}], text }, danach?: id }`. Schritt:
`{ id, art: 'gehe-zu'|'sprich-mit'|'sammle'|'besiege'|'benutze'|'warte', text, hinweis?, ort?: {x,z}|'platz-id', radius = 3, ziel? (npc-id bzw. Gegner-Art),
ding?, was? ('sprung', 'inventar', 'treffer:puppe', 'zauber:*' = Präfix-Platzhalter), anzahl = 1, dauer?, signal?, signalEnde?, sagt?: [text] }`.
Ereignisse (`ereignisse.sende`): `aufgabe:start`, `aufgabe:schritt` {aufgabe, schritt, index}, `aufgabe:fortschritt` {…, wert, ziel},
`aufgabe:schritt-fertig`, `aufgabe:fertig` {aufgabe, belohnung}, `aufgabe:signal` {aufgabe, schritt, name} (bei Schrittstart `signal`, beim Ende `signalEnde`).
Gleiche Eingaben → gleiche Ereignisfolge; keine Funktionen in den Daten (serialisierbar).

**`engine/ui/aufgaben-anzeige.js`** (DOM + THREE nur für `Vector3.project`):
```js
createAufgabenAnzeige({ eltern = document.body, oben = 12, links = 12, zIndex = 20, rand = 28 }) -> {
  element, setze(info | null /* = aufgaben.aktuell() */), ziel(punkt | null /* {x,y,z} */),
  update(kamera, dt, spielerPos?),   // im Bild: Raute + „42 m“ über dem Ziel; außerhalb/hinter der Kamera: Pfeil am Bildschirmrand, gedreht
  blitz(text, { dauer = 2.5, gross = false }),   // „Geschafft!“ bzw. großes Banner „Willkommen in der Enklave“
  zeige(an), sichtbar, dispose() }
randLage({ x, y, z } /* NDC aus project() */, breite, hoehe, rand) -> { x, y, winkel, imBild }   // rein, getestet
```
Ziel-Zeile oben links: Titel (klein), Schritt-Text, Fortschritt „3 / 6“ + Balken; fingerfreundlich, Stile inline, `pointer-events: none`.

## 5 · Integration `labore/enklave/`
```
index.html  spiel.json  README.md
js/main.js         Renderer, Schleife (core/schleife), Himmel/Uhr/Wetter, Speicher 'pag-enklave', ?frisch ?schritt=<id> ?start=tor ?debug
js/plan-daten.js   ENKLAVE_PLAN (§2 Startwerte)
js/welt.js         createWeltPlan → createWorld → Adapter → terrain-mesh, scatter-mesh, wege-mesh + mitBruecken → kollision; pruefe() bei ?debug
js/stadt.js        Plätze → InstancedMesh je (art, variante) + leucht-Instanzen; koerperZuWelt → kollision.fuege; Tor (tueren, 2 Flügel), Station amboss, Wegrand-Deko
js/bau-assets.js   (falls nötig) Zuordnung art → create-Fabrik; generisch? → I befördert nach engine/models/bau/bau-assets.js
js/npcs.js         Mentorin, Bo, Wachen, Händler, Schmied, Wirt, Priesterin, Kinder (character + character-brain-Plan, mimik:false), figur-schild
js/figur.js        cp labore/handwerk/js/figur.js, angepasst · js/kampf.js: cp aus labore/figuren/js/{kampf,zauber,horde,grosszauber}-spiel.js, zusammengeführt
js/tutorial.js     aufgaben + aufgaben-anzeige + hud; Signale → Ratten spawnen, Großzauber freischalten; melde() aus Interaktion/Kampf/Inventar
js/tutorial-daten.js  TUTORIAL (A4)
```
Engine: worldgen, worldgen-adapter, welt-plan, terrain-mesh, scatter-mesh (+ natur-assets), wege-mesh/wege-lage, kollision, himmel/himmel-stand, wetter,
core/zeit, schleife, speicher, ereignisse, register, rng · character, move-input, follow-camera, ziel-wahl · interaktion, inventar, welt-dinge, koerper,
tueren, stationen, character-brain · kampf, nahkampf, zauber, horde, grosszauber(-welle) + render/horde-mesh, zauber-effekte, grosszauber-mesh,
models/kreaturen/ratte, models/bau/* · ui/hud, figur-schild, inventar-ansicht, kampf-leiste, treffer-zahlen, menue, aufgaben-anzeige · render/qualitaet.

**Handy-Budget:** Draw-Calls ≤ 120 (Anzeige bei `?debug`: `renderer.info.render.calls`). Gelände 3 · Natur ≤ 35 (`objekte: { artDichte: { bodendecker: 0.5 } }`,
`bodendeckerWeite: 60`, `fernWeite: 120`) · Brücken ≤ 3 · Stadt ≤ 30 (Instanzen je Asset-Art, leucht gemeinsam) · Figuren: nur ≤ 6 NPCs sichtbar
(< 40 m, `mimik: false`), NPC-Logik nur < 60 m · Horde 2 · Effekte/Himmel ≤ 15. Nebel `himmel.setNebel(60, 230)`, Kamera-far 400.
Schatten nur nah: `createHimmel({ schattenWeite: 30, schattenAufloesung: 1024 })`; Gebäude/Mauer `castShadow`, Kleinkram nur `receiveShadow`.
Echte PointLights max. 3 (Lagerfeuer, Tor, nächste Laterne), sonst nur leucht-Geometrie. `render/qualitaet` senkt Pixelverhältnis/Schatten.
Startseite: Eintrag in `/index.html` (wie Testwelt: `<a href="labore/enklave/"><b>🏰 Die Enklave</b><span>Tutorial-Tal, Weg und ummauerte Stadt</span></a>`) + Zeile in `/README.md`.
`spiel.json`: `{ "eintrag": "js/main.js", "html": "index.html", "entfernen": ["<a id=\"back\" href=\"../../\">← Spiele</a>"], "smoke": { "query": "?frisch", "warte": 8000 } }`.

## 6 · Aufträge
**A1 · welt-plan** – Dateien: `engine/world/welt-plan.js`, `engine/world/welt-plan-formen.js`, Tests daneben. API/Format/Stufen §2. Nutzt nur
`worldgen-grid` (FLAG, WASSER), `core/math`; importiert nichts aus render. Abnahme (Test mit kleinem eigenem Plan, 128², meterProZelle 4 für Tempo):
`ringPlaetze` (8 Türme, Segmente füllen Seiten lückenlos ±0.2 m, Torhaus an lokal +z, Fronten zeigen nach außen) · `lokalZuWelt` (lokal (0,1) → Mitte + (sin w, cos w)) ·
`profil` (Gefälle ≤ max, feste Punkte unverändert) · nach `createWorld({ stufen })`: Plateau eben (max−min `bodenHoehe` in 0.9·r ≤ 0.3 m), Platz-Grundflächen
≤ 0.3 m uneben, keine Objekte in Plätzen/frei-Zonen/auf Pfad, ≥ 80 % der Gewässer-Punkte mit Wasser über Boden, Pfad über Fluss → `bruecken ≥ 1` und
`brueckenLagen(adapter)` ≥ 1, `pruefe(adapter).ok`, zwei Läufe → gleicher `hashArrays(hoehe, flags)`. 256²-Welt mit Plan in Node < 3 s.

**A2 · Gebäude** – Dateien: `engine/models/bau/bau-basis.js` (Inhalt §3), `haus.js`, `taverne.js`, `schmiede.js`, `wachturm.js`, `tempel.js`, `mauer.js` + Tests.
Nur `render/mesh-builder` (+ `core/rng`) benutzen. Abnahme je Fabrik/variante: position/normal/color vorhanden · Dreiecke ≤ Budget · Bounding-Box passt zu
`masse` (±5 %, y ≥ −0.6) · Kollision gültig (kasten/kreis, Körper innerhalb der Grundfläche) · Torhaus-Durchgang frei (kein Körper bei x ∈ ±2.3 unter y 4.2) ·
Anker vorhanden (Tür an +z-Front) · gleicher seed → gleiche Geometrie, andere variante → andere · `dispose()` wirft nicht.

**A3 · Kleinkram** – Dateien: `engine/models/bau/markt.js`, `vorrat.js`, `licht.js`, `wegbau.js`, `uebung.js` + Tests; `bau-basis.js` importieren (§3).
Abnahme wie A2 (Budgets §3) · leucht-Geometrie bei Laterne/Fackel/Lagerfeuer · Wegweiser: je Schild ein Brett in Richtung `winkel`, anker.schild mit Texten ·
Trainingspuppe/Zielscheibe: Kollision Zylinder · Zaun-Segment Länge genau 2 m (aneinanderreihbar).

**A4 · Aufgaben + Anzeige** – Dateien: `engine/gameplay/aufgaben.js`, `engine/ui/aufgaben-anzeige.js` + Tests (`engine/test/fake-dom.mjs`),
`labore/enklave/js/tutorial-daten.js` (`export const TUTORIAL = [{ id: 'tutorial', name: 'Erste Schritte', … }]`, 13 Schritte §1, Orte als Platz-IDs
bzw. `{x,z}` relativ → absolut mit Tal-Mitte (−175, 150), Texte + `sagt` der Mentorin, Signale `ratten-klein`, `ratten-welle`, `kamera-aussicht`, `tor-auf`)
und `tests/enklave-daten.test.mjs` (`pruefeDaten(TUTORIAL)` leer). Abnahme: jede Schritt-Art einzeln getestet, Platzhalter `zauber:*`, `danach` startet Folgeaufgabe,
Ereignisreihenfolge, `zustand()` → `laden()` mitten im Schritt ergibt gleiches `aktuell()`, `springe`, `randLage` (Ziel rechts außen → x = breite − rand, winkel ≈ 0;
hinter der Kamera → gespiegelt am Rand), Anzeige `setze(null)` blendet aus, `dispose()` entfernt DOM.

**I · Integrator** – nach A1–A4: Dateien §5. Reihenfolge: (1) `welt.js` + `plan-daten.js`, `pruefe()` grün, Lagerfeuer → Tor ≥ 400 m; (2) `stadt.js` (alle Plätze,
Tor mit 2 Flügeln über `tueren`, Kollision, Station `amboss`); (3) Figur, NPCs mit Tagesablauf; (4) Kampf/Horde/Großzauber aus Figuren-Labor-Vorbild;
(5) `tutorial.js` (alle 13 Schritte durchspielbar, `?schritt=` zum Testen, Spielstand speichert Fortschritt + Position); (6) Banner am Tor.
Abnahme: `npm test` grün (inkl. Smoke `dist/enklave.html`), läuft per Doppelklick und auf dem Handy (Touch-Knöpfe: Springen, Angriff, Zauber, Groß, E),
≤ 120 Draw-Calls in der Stadt, ≥ 30 FPS Mittelklasse-Handy, README des Spiels + Spielliste + Startseite, `npm run katalog`, CHANGELOG-Einträge vollständig,
PR mit Abschnitt „Engine“ (neue Module: welt-plan, bau/*, aufgaben, aufgaben-anzeige).

## 7 · Offene Entscheidungen
- Innenräume vorerst nein (Türen nur Deko, später `gameplay/bau-raster`) · Dialog vorerst `sagt` + Sprechblasen (`gameplay/dialog` später, Etappe 6).
- MMO: Tutorial-Tal als private Instanz je Spieler vs. gemeinsame Zone (Zonen-IDs trennen es schon) · größere Welten/zweite Stadt brauchen Chunk-Strom (Etappe 5).
- Pfadlänge: 640-m-Karte gibt ≈ 420 m ab Lagerfeuer; für 500 m+ entweder Karte 320² oder stärker geschwungener Pfad.
