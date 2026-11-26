# ⚔️ Schlachtplan Wildgrund (`labore/erde`)

> **Dragon's Dogma × Valheim × Witcher** – Hardcore-Survival, epischer Maßstab, riesige Bosse, tiefes Bauen,
> alles prozedural, düstere Fantasy-Welt auf einem ganzen Planeten. Handy-Browser zuerst (Xiaomi 14T Pro ≈ 80–100 FPS heute).
> Stimmung: Dämmerwald (`docs/ART-DIRECTION.md`), aber mit besserem Licht und mehr Atmosphäre.
> Stand 27.11.2026. Ältere Teilpläne bleiben gültig: `ERDE-FUNDAMENT.md` (Boden), `ERDE-UEBERLEBEN.md` (Spiel-Module).

## Was es schon gibt (nicht neu bauen, ausbauen)
Geologie/Klima/Biome, Bodenschichten + Gestein, Graben als Höhenfeld (`graben-feld.js`), Gras-Teppich, Astbäume + Impostor,
Wetter/Wolken, Überleben (Hunger/Durst/Wärme), Herstellen, Bauen (Fundament/Wand/Dach), Schmiede, Gleiter, Tiere, Tagebuch, Figur.

## Die 5 Säulen
1. **Welt** – Planet fest und schön: Topografie, Meere, Flüsse, Höhlen, Graben ohne Grafikfehler, Sichtweite bis zum Horizont.
2. **Stimmung** – Licht, Dunst, Nacht, Wetter machen das Spiel düster und groß (nicht die Polygonzahl).
3. **Masse** – Dörfer/Lager mit zehntausenden Teilen laufen, nichts stürzt ab (Speicher!).
4. **Überleben & Bauen** – hart, tief, mit Statik und Fortschritt über Materialien.
5. **Episch** – Riesen-Bosse (Shadow of the Colossus / Dragon's Dogma), große Zauber, Ruinen, Dörfer, Aufträge (Witcher).

## Wellen
| Welle | Agent | Thema | hängt ab von |
|---|---|---|---|
| 1 | A0 | Stil & Asset-Technik | – |
| 1 | A1 | Welt-Fundament (Graben, Höhlen, Flug-FPS, Wasser) | – |
| 1 | A2 | Licht & Atmosphäre | – |
| 1 | A3 | Masse & Absturzschutz | – |
| 2 | A4 | Tiefes Bauen (Statik, Stockwerke, Lager, Dorf) | A0, A3 |
| 2 | A5 | Hardcore-Survival & Progression | A1 |
| 3 | A6 | Kampf & Riesen-Bosse | A0, A3, Figur |
| 3 | A7 | Prozedurale Inhalte: Ruinen, Dörfer, NPCs, Höhlen-Dungeons, Aufträge | A0, A3, A4 |

---

## A0 · Stil & Asset-Technik — Branch `claude/wildgrund-stil`
**Frage:** Welcher Look ist am schönsten *und* trägt später tausende Objekte am Handy?
- Neues Labor `labore/stil/` (eigene `index.html` + `spiel.json`): **dieselbe Szene** (Waldrand mit Riesenbaum, Fels, Holzhütte, Lagerfeuer,
  Figur 1.8 m, 200 m Fernsicht) in **3 Looks**, umschaltbar `?look=a|b|c`:
  - **a** Vertexfarben/Low-Poly wie heute, aber mit besserem Licht
  - **b** PS2-artig: kleiner gemeinsamer Textur-Atlas (z. B. 1024², 32 px je Kachel), leichte Pixelung/Dithering, Vertex-Licht-Anteil
  - **c** Misch: einfache Formen, Detail aus Shader (triplanares Rausch-Detail, Kanten-Abnutzung, AO aus Krümmung) + Splat-Moos
- Je Look Anzeige: FPS, Draw-Calls, Dreiecke, Geometrie-/Textur-Speicher (`renderer.info`).
- Ergebnis: `docs/plaene/WILDGRUND-STIL.md` = **Asset-Vertrag**: ein Material (oder sehr wenige) für alle Bauteile/Requisiten,
  Atlas-Regeln, Dreieck-Budget je Objektart, Pflicht-LOD-Stufen + Impostor, Ursprung/Maße (m, +Y oben).
- Goi entscheidet den Look nach eigenem Test. Kein Umbau von `labore/erde` in diesem Branch.

## A1 · Welt-Fundament — Branch `claude/erde-fundament` (übernimmt die bestehende Zeile)
- **Graben neu & sauber:** Höhenfeld (`graben-feld.js`) bleibt die Basis. Tunnel/Überhänge/Höhlen als **exakte Mischung** laut
  `ERDE-FUNDAMENT.md` §0: lokale Voxel-Dichte aus dem *gezeichneten* Höhenfeld, Rand auf das Kachelnetz schnappen, Höhenfeld-Vierecke
  aus dem Index nehmen statt `discard`, triplanar, Stoff je Schicht. Keine Stufen, keine Nähte, kein FPS-Einbruch je Schlag
  (Neubau nur des betroffenen Teilwürfels, im Worker).
- **Flug-FPS:** beim Herunterfliegen 10–12 FPS → Kachel-Austausch drosseln (Budget Kacheln/Bild, Priorität nach Bildschirmgröße),
  Natur-/Gras-Neubau nicht im selben Bild wie Kachelbau. Ziel: nie unter ~40 FPS beim Sinkflug.
- Natürliche Höhlen (wenige, groß, mit Eingang am Hang), Flüsse/Meere ohne Durchscheinen.
- Dateien: `graben-feld.js`, `eingriffe.js`, `voxel-erde.js`, `aktionen.js`, `kachel-*.js`, `planet-baum.js`, `planet-hoehe.js`,
  `geologie.js`, `boden-netz.js`, `engine/world/voxel-kugel.js`.

## A2 · Licht & Atmosphäre — Branch `claude/erde-licht`
- Dämmerwald-Gefühl auf dem Planeten: Höhennebel/Luftperspektive (Nebel nur durch Wetter dicht, sonst Sichtweite!),
  billige Lichtstrahlen (Sonnenstrahlen durch Kronen/Wolken als Screen-Space-Streifen oder Licht-Karten), farbige Schatten.
- **Echte Nacht:** dunkel, Mond/Sterne, Fackel/Lagerfeuer als Punktlicht mit Flackern (Budget: wenige echte Lichter, Rest als
  Glüh-Sprite + Vertex-Licht). Gefühl: „Nachts geht man nicht ohne Licht raus.“
- Farbstimmung (Color-Grading) je Biom/Wetter/Tageszeit, schwebende Partikel (Staub, Pollen, Glühwürmchen).
- Alles über das Grafik-Fenster regelbar, Handy = Mittel.
- Dateien: `dunst.js`, `wolken.js`, `gluehen.js`, `fernschatten.js`, `zeit-wetter.js`, neu `licht-*.js`.

## A3 · Masse & Absturzschutz — Branch `claude/erde-masse`
- Neues System für **Bauteile/Requisiten in großer Zahl**: Instanzen je Teil-Art, ruhende Teile je 80-m-Kachel zu **einem**
  Netz verschmolzen (neu verschmelzen erst nach Bauen/Abriss, im Worker), fern nur Impostor/Silhouette der ganzen Siedlung.
- Objekt-Budget je Kachel + **Speicherwächter**: misst Geometrie/Texturen, senkt Detail stufenweise, bevor Android den Tab
  abschießt; `dispose()` überall, wo Kacheln gehen.
- Spielstand je Kachel (gebaute Teile, Kisten-Inhalt) speichern/streamen statt einer Riesenliste.
- Stresstest `?stress=dorf` (20 000 Teile) und `?stress=lager` (500 Kisten): FPS/Speicher im HUD.
- Dateien: neu `labore/erde/js/masse-*.js` (+ Engine-Baustein, falls generisch), Andock über `erweiterungen.js`.
  `bauen.js`/`bauteile.js` nur lesen – A4 stellt später auf das neue System um.

## A4 · Tiefes Bauen (Welle 2) — `claude/erde-bauen`
Statik wie Valheim (Tragkraft je Material, Einsturz), Stockwerke, Keller (mit Graben verbunden), Türen/Fenster, Palisaden, Kisten/Lager,
Dorf-Vorlagen; nutzt A3-Masse und A0-Vertrag.

## A5 · Hardcore-Survival & Progression (Welle 2) — `claude/erde-ueberleben`
Wunden/Blutung, Krankheit, Verderb, Erschöpfung, Gefahr durch Nacht/Kälte/Sturm, optional Permadeath; Fortschritt über Erze und
Stationen (Stein → Kupfer → Bronze → Eisen → …), Biome als Schwierigkeitsringe.

## A6 · Kampf & Riesen-Bosse (Welle 3) — `claude/erde-riesen`
Riesen (Troll, Zyklop, …) mit echten Maßen (15–40 m), Schwachstellen, zerbrechbare Körperteile, Bewegung langsam und schwer;
große Zauber im Dragon's-Dogma-Stil; Lock-on auf Körperteile. Nutzt `KAMPF-SYSTEM.md` + Erfahrungen aus `spiele/riesenjagd`.

## A7 · Prozedurale Inhalte (Welle 3) — `claude/erde-inhalte`
Ruinen, Wachtürme, verlassene und bewohnte Dörfer (NPCs, Händler), Höhlen-Dungeons, Monster-Aufträge, Lore-Fundstücke – alles per Seed.

---

## Regeln für jeden Agent (Tokens sparen!)
- Lesen: `AGENTS.md`, diesen Plan, den eigenen Teilplan, `labore/erde/README.md` – sonst nur per `grep` + Zeilenbereich.
- **Höchstens 3–5 Stichproben:** Node-Tests für reine Logik (`node --test …`), ein Ladetest (`npm test 2>&1 | tail -30`),
  höchstens 2 Bildschirmfotos (`node tools/bild.mjs`). Keine Test-Schleifen, keine Wegwerf-Skripte. Goi testet am Handy.
- Nur eigene Dateien. `planet.js` ist geteilt: dort nur Import + Aufruf-Zeilen ergänzen (klein halten, Konflikte löst der Zusammenführ-Schritt).
- Neues Spiel-Modul dockt über `erweiterungen.js` an (Vertrag oben in der Datei), Module reden über `welt.dienste`.
- Jeder neue Teil hat einen Testschalter (`?…=`) und steht in einer Zeile in `labore/erde/README.md`-Tabelle (Wunsch im PR, Zusammenführ-Schritt trägt ein).
- Abschluss: PR mit „Was / Geprüft / Nicht geprüft“ + Pages-Link + 3 Dinge, die Goi am Handy testen soll.
