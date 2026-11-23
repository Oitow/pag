# Bauplan: Startgebiet + Dorf Erlenwacht (Welt v3)

> Branch `claude/welt-startdorf`. Ziel: Valheim/Enshrouded-Gefühl – lebendiger Boden (Gras), echte Flüsse/Bäche, ein Dorf als Treffpunkt
> mit Licht in der Nacht, Zäunen, Feldern, Brücke, Tutorial durchs Dorf. Charaktere macht eine andere KI → `engine/models/character/`,
> `engine/gameplay/character*.js`, `engine/spiel/modul-spieler.js` NICHT anfassen.
> Maße in Metern (Mensch 1.8 m). Welt: −z = Norden. Dorfmitte (0, 600), Boden dort flach ≈ 24 m.

## Teile und wer sie baut

| # | Teil | Dateien (nur diese!) |
|---|---|---|
| A | Dorf-Assets | `engine/models/bau/dorf-teile.js` + `.test.mjs` |
| B | Dorf-Plan (reine Logik) | `engine/world/dorf-plan.js` + `.test.mjs` |
| C | Bau-Instanzen + Licht-Pool | `engine/render/bau-instanzen.js`, `engine/render/licht-pool.js` + Tests |
| D | Gras/Bodendecker am Spieler | `engine/world/gras-feld.js` + `.test.mjs` |
| E | Tutorial im Dorf | `engine/spiel/modul-tutorial.js`, `engine/spiel/tutorial-daten.js` (+ bestehender Test) |
| Haupt | Bäche/Flüsse, Wasser, Zusammenbau | `engine/world/welt-regionen.js`, `engine/world/fluss-mesh.js`, `engine/spiel/modul-welt.js`, `engine/spiel/modul-dorf.js`, Register, Doku |

Allgemein (AGENTS.md): Modul-Kopf wie `engine/core/rng.js`, ≤ ~300 Zeilen je Datei, `createX(opts)` + `dispose()`, Zufall nur per Seed
(`engine/core/rng.js`: `createRng`, `hashSeed`, `hash2`), THREE nur `import * as THREE from 'three'`, höchstens ~5 Tests je Datei, keine
Wegwerf-Skripte, nichts committen (das macht das Hauptmodell). Geteilte Dateien (KATALOG, module.js, module-register.js, STAND) nicht anfassen.

## A – Dorf-Assets (`engine/models/bau/dorf-teile.js`)
Format exakt wie `engine/models/bau/wegbau.js` / `licht.js`: `createMeshBuilder` aus `render/mesh-builder.js`, Farben `FARBEN` + `asset()`,
`kasten()`/`kreis()` aus `bau-basis.js`. Rückgabe `asset { name, variante, geometrie, leucht, kollision, anker, masse, dreiecke, dispose }`.
Ursprung = Mitte am Boden, Vorderseite = +z. Low-Poly, je Asset ≤ 600 Dreiecke (Brücke ≤ 1200).
- `createBruecke({ seed, laenge = 10, breite = 3 })` – Holzbrücke mit leichtem Bogen (Mitte +0.6 m), Geländer, Pfosten; liegt entlang z.
  Kollision: begehbare Kästen als Stufen-Polygon (mehrere `kasten(..., { begehbar: true })` mit passenden `y0`/`hoehe`) + Geländer als nicht begehbare Kästen.
  `masse { breite, tiefe: laenge, hoehe }`.
- `createHolzstapel({ seed })` – Brennholz unter kleinem Pultdach (1.6 × 0.8 m).
- `createKarren({ seed })` – Handkarren mit 2 Rädern (2.2 m).
- `createBeet({ seed, variante 0-2 })` – Gemüsebeet 3 × 1.5 m (Erdrücken + Pflanzenreihen: Kohl / Lauch / Kürbis). Kollision keine.
- `createAnschlagbrett({ seed })` – Schwarzes Brett mit Dach + 4 Zetteln, `anker.interaktion = { x:0, z:0.8 }`.
- `createSchrein({ seed })` – Bindestein/Wegschrein (1.8 m, Runen als `leucht`, Licht-Anker bläulich `FARBEN.kristall`), `anker.interaktion`.
- `createPalisade({ seed, variante 0-1 })` – 3-m-Segment angespitzter Pfähle (2.6 m), reihbar entlang x.
- `createHeuhaufen({ seed })`, `createSteg({ seed, laenge = 8 })` (Bootssteg auf Pfählen, begehbar).
Test: jedes Asset baut, hat Dreiecke unter Budget, `masse` passt zur Boundingbox (±20 %), deterministisch per Seed.

## B – Dorf-Plan (`engine/world/dorf-plan.js`, ohne THREE)
```
createDorfPlan({ seed, mitte:{x,z}, radius = 115, hoehe(x,z), wasser(x,z)->bool, wege:[[{x,z}…] mit .id .breite], masse:{typ:{breite,tiefe}} })
  -> { teile:[{ id, typ, variante, x, z, winkel, y }], punkte:{ id:{x,z,y,winkel} }, gassen:[[{x,z}…] mit .breite], felder:[{x,z,bx,bz,winkel}],
       sperren:[{x,z,r}], lichter:[{x,y,z,art}], pruefe() -> [fehler] }
```
- `winkel`: Drehung um Y, Vorderseite (+z des Assets) zeigt nach `(sin w, cos w)` – Gebäude schauen mit der Tür zur Gasse/Platz.
- `typ` = Name der Fabrik ohne `create`, klein: `haus`, `taverne`, `schmiede`, `tempel`, `wachturm`, `marktstand`, `brunnen`, `bank`, `fass`, `kiste`,
  `banner`, `laterne`, `lagerfeuer`, `zaun`, `wegweiser`, `bruecke`, `holzstapel`, `karren`, `beet`, `anschlagbrett`, `schrein`, `palisade`, `heuhaufen`, `steg`, `trainingspuppe`, `zielscheibe` (`models/bau/uebung.js`), `mauerturm`, `torhaus` (`models/bau/mauer.js`).
- **Kern (handgesetzt, relativ zur Mitte):** Dorfplatz r ≈ 16 m: Brunnen in der Mitte, Lagerfeuer 6 m östlich mit 3 Bänken im Halbkreis,
  Anschlagbrett + Schrein am Nordrand, 3 Marktstände am Westrand, 2 Banner. Taverne an der Ostseite (Tür zum Platz), Schmiede am Südeingang,
  Tempel im Nordwesten, Wachturm am Nord- und am Süd-Ausgang des Hauptwegs, Übungsplatz (2 Puppen) bei der Südwache.
- **Prozedural:** 9–12 Häuser entlang der Wege (`wege`, im Dorfradius) und 2 neuer Gassen; Abstand zur Wegmitte = breite/2 + 3…5 m + halbe Haustiefe,
  Tür zum Weg; keine Überlappung (gedrehte Rechtecke + 1.5 m Luft), nicht im Wasser, nicht auf dem Platz. Hinter ~60 % der Häuser ein Garten:
  Zaunsegmente (2 m, `zaun`) als Rechteck mit Lücke, 1–2 Beete drin. Felder (`felder`) außen im Osten.
- Laternen alle ~16 m beidseitig versetzt entlang Wegen/Gassen im Dorf, Fackel-Lichter kommen aus den Gebäude-Ankern (macht C).
- `punkte`: `platz`, `brunnen`, `feuer`, `anschlagbrett`, `schrein`, `markt`, `taverne`, `schmiede`, `tempel`, `tor-sued`, `tor-nord`, `uebung`,
  NPC-Stellen `npc-wirt`, `npc-schmied`, `npc-haendler`, `npc-priester`, `npc-wache` (vor der Tür/neben dem Stand, Blick zum Platz).
- `sperren`: Kreise, in denen die Welt keine Bäume/Felsen streuen soll (Platz, jedes Gebäude, Gärten).
- `y` = `hoehe(x,z)` am Ursprung (bei Gebäuden: Minimum über die vier Ecken, Gebäude haben Sockel).
- `pruefe()`: keine Überlappung, alles im Radius, kein Teil im Wasser, Tür jedes Hauses ≤ 12 m von Weg/Gasse/Platz, Laternenabstand.
Test: deterministisch, `pruefe()` leer für 3 Seeds mit einer Test-Höhe (flach) + Testwegen, mindestens 9 Häuser, alle Punkte da.

## C – Bau-Instanzen + Licht-Pool (`engine/render/`)
Vorbild: `labore/enklave/js/stadt.js` (dort Spiel-spezifisch – Generisches hierher übernehmen, das Labor bleibt unverändert).
```
createBauInstanzen({ teile, fabriken:{typ:(opts)->asset}, kollision /* world/kollision, optional */, material?, schatten = true })
  -> { gruppe: THREE.Group, lichter:[{x,y,z,farbe,staerke,art}], anker:[{teilId, typ, art, x, y, z, winkel, daten}], koerperIds, assets, dreiecke, dispose() }
```
- Gleiche `typ#variante` → ein `InstancedMesh`; alle `leucht`-Geometrien → ein zusammengeführtes Mesh mit Leucht-Material (Farbe × `nacht`).
- Asset-Kollision (`kasten`/`kreis`, lokal) in Weltkoordinaten drehen/verschieben und in `kollision.fuege` eintragen (y0 + teil.y).
- `anker`: Weltlage aller Asset-Anker (`tuer`, `station`, `interaktion`, `sitz`, `schild`, `kamin`) – für Tutorial/Stationen/Rauch.
- `setzeNacht(n 0..1)` am Ergebnis-Objekt: Leuchtmaterial dunkel am Tag, hell nachts.
```
createLichtPool({ szene, lichter, anzahl = 4 /* niedrig: 2 */, reichweite = 16, schatten = false })
  -> { update(dt, fokus{x,z}, nacht 0..1), anzahl, dispose() }
```
- `anzahl` PointLights, alle 0.4 s neu auf die nächsten Lichter zum Fokus verteilt (Lagerfeuer bevorzugt), weich ein-/ausblenden,
  Feuer/Fackeln flackern (seedbares Rauschen, kein Math.random), Laternen tags aus. Reine Auswahl-Funktion `waehleLichter(lichter, fokus, n)` exportieren + testen.

## D – Gras-Feld (`engine/world/gras-feld.js`)
```
createGrasFeld({ karte /* hoehe, biom, farbe, wasserHoehe, abstandZumWeg */, seed, weite = 45 /* niedrig 28 */, dichte = 1, sperren?:()=>[{x,z,r}] })
  -> { mesh /* THREE.Object3D */, update(dt, fokus{x,z}, zeit), setzeDichte(d), anzahl, dispose() }
```
- Grashalm-Büschel als **ein** `InstancedMesh` (oder wenige Kacheln) um den Fokus, Kacheln 16 m, nur neu gesetzt beim Kachelwechsel.
- Halm-Geometrie: 3–5 gekreuzte, sich verjüngende Streifen (≈ 0.35–0.7 m), Farbe = Bodenfarbe (`karte.farbe`) heller an der Spitze.
- Wind + Ausblenden am Rand im Vertex-Shader (onBeforeCompile auf MeshLambert/Standard, wie `render/natur-material.js` `patcheShader`).
- Kein Gras: auf Wegen (`abstandZumWeg < breite`), im Wasser, auf Fels/Strand, steil, in `sperren` (Dorfplatz, Häuser). Dichte je Biom (Wiese voll, Wald halb, Heide wenig).
- Budget: hoch ≤ 60 000 Halme, niedrig ≤ 15 000; ein Draw-Call. Reine Platzierung `grasPunkte(karte, kachel, {seed,dichte})` exportieren + testen (deterministisch, nicht auf Weg/Wasser).

## E – Tutorial im Dorf (`modul-tutorial.js`, `tutorial-daten.js`)
Neues optionales Modul **`dorf`** (baut das Hauptmodell) – API:
```
dorf = { punkt(id) -> {x,z,y,winkel}|null, punkte, ziele:[{ id, pos:{x,z,y}, radius, text, art }], benutze(id, wer) -> {ok, text}, onBenutzt(fn) }
```
Ereignisse: `dorf:benutzt {id, art}` (art: `brunnen`, `anschlagbrett`, `schrein`, `amboss`, `feuer`), `dorf:gebunden {x,z}`.
- Tutorial bekommt `optional: [..., 'dorf']`. Wenn da: NPCs dürfen statt `versatz` ein Feld `punkt: 'npc-wirt'` haben (Position/Blick aus `dorf.punkt`),
  sonst wie bisher (`ort` + `versatz`). Die `dorf.ziele` werden in die eigene Interaktion (`ia.melde`) eingetragen, Auslösen ruft `dorf.benutze`.
- Neue Aufgaben-Kette nach „Erreiche die Siedlung“: Treffpunkt Brunnen (gehe-zu `punkt: 'brunnen'`) → Brandt sprechen → am Schrein binden
  (Aufgabe wartet auf Ereignis `dorf:gebunden`) → Anschlagbrett lesen → Schmied sprechen (Amboss) → Wirt in der Taverne → weiter wie bisher (Hochland/Wölfe).
  Neue NPCs: Wirtin Hedda (`npc-wirt`), Schmied Oskar (`npc-schmied`), Händlerin Mira (`npc-haendler`), Schwester Ilse (`npc-priester`); Brandt an `npc-wache`.
  Vorlagen nur aus den vorhandenen Figuren-Vorlagen nehmen (nachsehen, wie `brandt` es macht) – keine Figuren-Dateien ändern.
- Ohne `dorf` muss alles laufen wie vorher (Aufgaben mit `punkt` fallen auf `ort: 'siedlung'` zurück).
- Bestehende Tests grün halten (`tests/*.test.mjs`, `engine/spiel/tutorial-daten.test.mjs`), höchstens 3 neue Tests.

## Haupt – Bäche, Wasser, Zusammenbau
- `welt-regionen` v1.2: mehrere Flüsse (`fluesse:[{id,name,proben}]`, `fluss` bleibt = Hauptfluss): **Erlbach** von einer Quelle im Hochland (≈ 330, 350)
  am Ostrand des Dorfes vorbei (x ≈ 110) durch den Dämmerwald zum Meer – Start am Wasser bekommt eine Bachmündung.
- `world/fluss-mesh.js`: Wasserband je Fluss mit Fließ-UV, animierten Wellen-Normalen und Schaum am Ufer; Ufer-Streu (Schilf, Steine) über `welt-streu`.
- `modul-dorf.js`: Plan (B) + Assets (A) + Instanzen/Licht (C) + Stationen/Schrein/Brunnen + `welt.sperreObjekte` + Ziele für das Tutorial.
- `modul-welt.js`: Gras (D) + neues Wasser einbauen. Testfeld `?nur=dorf`, Sprungmarken `?ort=siedlung`, `?weltblick=brunnen`.
