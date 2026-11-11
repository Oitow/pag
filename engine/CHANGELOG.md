# Engine-Changelog

## 2026-11 – PS1-Look aus Viniland
- render/psx 1.0.1 (neu): PS1-Look für eine ganze Szene – `wendeAn(szene)` patcht alle Materialien (vorhandene Shader-Hooks wie Randlicht/Wind bleiben), Eckpunkte rasten ein, Farbstufen mit Bayer-Dithering, `aufloesung()` für grobe Pixel, Stimmung (Kontrast, Sättigung, Tönung, Vignette je Ansicht/Splitscreen), live an/aus über `setze({ an })`
- world/himmel 1.1.0 (additiv): Shader endet mit `#include <dithering_fragment>` – der Himmel macht beim PS1-Look mit (ohne `psx` unverändert)
- games/figuren-labor, games/testwelt: PS1-Look eingebaut und abschaltbar (☰ → Mehr bzw. ☰ → Optionen)

## 2026-11 – Etappe 2 (Kern): Welt verändern
- world/welt-aenderung 1.1.0 (neu): Änderungs-Schicht über der erzeugten Welt – Pinsel heben/senken/glätten/ebnen in Metern, Objekte entfernen, Sperrzonen (Wasser, Ufer, Wege, eigene per `sperreUmkreis`), Grenzen, Rückgängig/Wiederholen, `festschreiben()` für Bauplätze, Spielstand = nur Unterschiede zum Seed
- world/terrain-mesh 1.2.0 (additiv): `aktualisiere(bereich, { erde, erdFarbe })` baut nur das geänderte Stück neu (Höhen, Normalen exakt wie beim Komplettbau, Erd-Tönung), lädt nur die betroffenen Zeilen hoch
- world/scatter-mesh 2.2.0 (additiv): `setzeAufBoden(bereich)` setzt Objekte nach einer Gelände-Änderung wieder auf den Boden
- games/testwelt: Schaufel = graben (gibt Erde), Erde = aufschütten; Gelände-Änderungen im Spielstand; Bauplatz fürs Lager wird eingeebnet

## 2026-11 – Etappe 3 (Rest): Türen, Truhen, Stationen, HUD und Menü
- gameplay/tueren 1.0.1 (neu): Türen/Tore – auf/zu mit weicher Animation, Kollisions-Körper nur solange zu, Schlüssel, Selbstschließen, blockiert wenn jemand in der Öffnung steht
- gameplay/behaelter 1.0.0 (neu): Truhen mit eigenem Inventar – öffnen je Figur, Schloss, umlagern, schließt beim Weggehen, Spielstand
- gameplay/stationen 1.0.0 (neu): Werkbank & Co. als Orte; `beiWem(wer)` passt direkt in `rezepte.pruefe(…, { stationen })`
- gameplay/inventar 1.2.0 (additiv): `uebertrage(von, platz, nach, anzahl?)` zwischen zwei Inventaren (Daten bleiben erhalten)
- ui/hud 1.0.0 (neu): Hinweis-Zeile mit Fortschritt, Kurzmeldungen (zusammenzählbar), Balken, Bereiche für Leisten
- ui/inventar-ansicht 1.0.1 (neu): Inventar als Reihe/Raster (Schnellleiste, Rucksack, Truhe) mit Anzahl, Haltbarkeit, Tippen/Halten
- ui/menue 1.0.0 (neu): Menü/Fenster mit Seiten (Knopf, Schalter, Regler, Auswahl, eigene Elemente) + `spielstandEintraege()` für Speicherplätze
- test/fake-dom 1.1.0 (additiv): echte Eltern/Kinder (append, remove, insertBefore, replaceChildren), abmeldbare Hörer, `dispatch` mit Ereignis-Objekt, `click()`
- games/testwelt: Schuppen mit Tür, Truhe und Werkbank neben dem Start; Leiste, Hinweise und Fenster kommen aus der Engine; ☰ Pause-Menü mit Spielständen und Optionen

## 2026-11 – Etappe 3: Herstellen, Rohstoffe, Hand
- gameplay/rezepte 1.0.0 (neu): Rezepte als Daten (Zutaten, Werkzeug, Station), prüfen und herstellen – alles oder nichts
- gameplay/rohstoffe 1.0.0 (neu): abbaubare Quellen mit Beute per Seed, Werkzeug nötig oder nur schneller, Abnutzung, Nachwachsen nach Spielzeit, Spielstand
- gameplay/hand 1.0.0 (neu): gewählter Inventar-Platz als „in der Hand“, Wechsel-Meldung zum Ausrüsten, Haltbarkeit bis zum Zerbrechen
- gameplay/inventar 1.1.0 (additiv): `setzeDaten(platz, daten|null)` für Einzelstücke
- gameplay/welt-dinge 1.1.0 (additiv): `wirf(…, { daten })` – Werkzeuge behalten ihre Haltbarkeit beim Ablegen
- games/testwelt: Axt und Hacke herstellen (🔨), in die Hand nehmen, damit schneller fällen/abbauen; Bäume und Felsen wachsen nach

## 2026-11 – Fundament: Kollision, leichte Physik, Dinge & Handeln
- world/kollision 1.0.0 (neu): Kollisions-Welt über dem Adapter – bewegliche/entfernbare Zylinder und gedrehte Kästen mit Höhe (draufsteigen, drüberspringen, weich aneinander vorbei), Strahl-Test gegen Gelände und Körper
- gameplay/koerper 1.0.0 (neu): leichte Physik für lose Dinge (fallen, abprallen, Reibung, haften/rutschen am Hang, schwimmen/sinken, einschlafen), fester Zeitschritt
- gameplay/welt-dinge 1.0.0 (neu): Gegenstände in der Welt – ablegen, werfen, aufheben, Stapel zusammenlegen, Lebensdauer, Spielstand
- gameplay/interaktion 1.0.0 (neu): bestes Ziel in Reichweite/Blick, sofort oder gedrückt halten mit Fortschritt
- gameplay/inventar 1.0.0 (neu): Plätze, Stapel, Gewicht, Speichern/Laden
- core/ereignisse 1.0.0 (neu): Event-Bus mit Prioritäten und Warteschlange (feste Reihenfolge je Schritt)
- core/register 1.0.0 (neu): Datenkatalog (Gegenstände …) mit stabilen Nummern für Spielstand/Netz
- core/raum-gitter 1.0.0 (neu): räumliches Raster für bewegliche Dinge (Umkreis, Nächster)
- core/schnappschuss-puffer 1.0.0 (neu): weiches Interpolieren verspäteter Zustände (Mehrspieler-Grundlage)
- gameplay/character-motor 1.2.0 (additiv): reicht Fußhöhe an `welt.bodenHoehe(x, z, y)` und `{ y, hoehe, ausser }` an `welt.hindernisse` (alte Adapter ignorieren das); feinere Unterschritte bei hohem Tempo (kein Durchtunneln dünner Stämme); `speichern()`/`laden()`; Option/Feld `kollisionsId`
- gameplay/character 1.2.0 (additiv): meldet sich in einer Kollisions-Welt selbst als weicher Zylinder an (`koerper: false` schaltet ab)
- world/worldgen/worldgen-adapter 1.2.0 (additiv): `hindernisNah`, `setHindernis(objektIndex, aktiv)`, `alleHindernisse` – Bäume/Felsen lassen sich abbauen
- world/scatter-mesh 2.1.0 (additiv): `verstecke(objektIndex)`, `lage(objektIndex)`
- games/testwelt: Kisten-Treppe, Äpfel/Pilze aufheben, Inventarleiste (antippen = ablegen), Bäume fällen/Felsen abbauen, Figuren schieben sich aneinander vorbei, alles im Spielstand

## 2026-11 – Figuren: schönerer Look, Zauber
- render/figur-material 1.0.0 (neu): Figuren-Material mit Randlicht, aufgehellter Schattenseite, kräftigeren Farben
- models/character/character-model 1.2.0: nutzt standardmäßig `figurMaterial()` (eigenes `material` geht weiter)
- models/character/character-clips-zauber 1.0.0 (neu): 6 Zauber-Gesten (zauberWurf, -Stoss, -Finger, -Himmel, -Boden, -Selbst); character-clips 1.2.0 registriert sie
- gameplay/zauber 1.0.0 (neu): 10 Zauber als Daten, Zauberbuch mit Mana, Abklingzeit, Wirkzeit, Geschossen, Treffer-Ereignissen (ohne THREE)
- render/zauber-effekte 1.0.0 (neu): Partikel, Geschoss-Kugeln, Ringe, Blitze, Erdstacheln, Aura, Meteor-Sturz aus Pools
- input/touch-stick 1.1.1: Knöpfe ab dem 5. sitzen höher (der 6. Knopf lag halb unter dem Bildschirmrand)
- games/figuren-labor: Zauberleiste + ✨-Knopf, Leben/Mana, ☰-Menü als Blatt mit Reitern (Handy unten, groß links)

## 2026-11 – Lebendige Welt (Fahrplan Etappe 1)
- core/zeit 1.0.0 (neu): Spieluhr mit Tagen, Jahreszeiten, Ereignissen, Pause/Tempo, Speicherstand
- core/schleife 1.0.0 (neu): Spielschleife mit festem oder variablem Zeitschritt, FPS, Tab-Pause
- core/speicher 1.0.0 (neu): Spielstände in Slots (Version + Migration, TypedArrays, Export/Import, Autospeichern, Ersatz ohne localStorage)
- world/himmel-stand 1.0.0 (neu): Sonnen-/Mondbahn, Mondphase, Himmels- und Lichtfarben über den Tag, Wetter-Einfluss (reine Daten)
- world/himmel 1.0.0 (neu): Himmelskuppel (Verlauf, Sonne, Mond, Wolken), Sterne, Sonnen-/Mondlicht mit mitlaufendem Schatten, Umgebungslicht, Nebel
- world/wetter 1.0.0 (neu): Wetterverlauf per Seed nach Klima (klar … gewitter, schnee, nebel, sturm), weiche Übergänge, Wind, Blitz, Nässe
- render/niederschlag 1.0.0 (neu): Regen/Schnee als ein Points-Objekt um die Kamera (Bewegung im Shader)
- games/testwelt: Tag/Nacht, Wetter, Spieluhr mit Jahreszeiten, Autospeichern; Knöpfe ⏩ und Wetter
- docs/ENGINE-FAHRPLAN.md: Etappenplan für die ganze Engine

## 2026-11 – Weltengine: Wege in 3D
- world/wege-lage 1.0.0 (neu): Lage der Brücken in Metern, `mitBruecken(adapter, lagen)` macht sie begehbar
- world/wege-mesh 1.0.0 (neu): Holzbrücken (Bohlen, Geländer, Pfeiler) je Flussquerung
- world/terrain-farben 1.1.0 (additiv): Wegzellen (FLAG.WEG) werden als Erdweg eingefärbt, abschaltbar mit `wege: false`; Welten ohne Wege unverändert
- world/worldgen/worldgen-wege 1.1.0: Brücken haben `dx`/`dy` (Richtung); `x`/`y` ist jetzt die Mitte zwischen beiden Ufern und `laenge` die Spannweite von Ufer zu Ufer (vorher Anzahl Flusszellen)
- games/testwelt: Wege an, Brücken begehbar, Wege auf der Karte

## 2026-11 – Weltengine: Wegenetz
- world/worldgen/worldgen-wege 1.0.0 (neu): Stufe „wege“ zwischen „orte“ und „objekte“ – Spannbaum plus Abkürzungen über Start, Dörfer und gewählte Sehenswürdigkeiten, A* um Steilhänge, geteilte Strecken, Brücken über Flüsse. Standardmäßig aus (`wege: { aktiv: true }`), bestehende Welten und Schnappschüsse bleiben gleich.
- world/worldgen/worldgen 1.1.0 (additiv): `welt.wege`, `welt.wegKnoten`, Stufe „wege“ in STANDARD_STUFEN, Wege im Worker-Transfer
- world/worldgen/worldgen-path 1.1.0 (additiv): Optionen `faktor(i)` und `minKosten`
- world/worldgen/worldgen-grid 1.1.0 (additiv): `FLAG.WEG` (128)
- world/worldgen/worldgen-presets 1.2.0 (additiv): Optionen `wege`
- games/weltlabor: Ebene „Wege“ mit Brücken

## 2026-11 – Natur-Assets und schönere Welt
- Neu: models/natur – prozedurale Low-Poly-Assets per Seed (Vertrag: docs/NATUR-ASSETS.md): natur-basis, baum-arten/-skelett/baum
  (14 Baumarten, Jahreszeiten, Alter), fels-form/fels (6 Felstypen, 5 Gesteine, Moos/Schnee), totholz-form/totholz,
  pflanze-formen/-basis/-blume/-busch/-boden/-wueste (13 Typen), natur-assets (Registry + Varianten-Cache)
- Neu: render/natur-material – Vertexfarben-Material mit Wind-Shader (Attribut wind, Instanz-Phase, Schatten schwingt mit, Fern-Ausblenden)
- world/scatter-mesh 2.0.0 (Verhalten geändert): nutzt Asset-Cache (opts.assets), Varianten je Typ, Kacheln + Fern-Detail, Wind via update();
  unbekannte Typen werden weggelassen statt als Busch gezeichnet, Seerosen auf Wasserhöhe. Nutzer angepasst: testwelt
- world/terrain-mesh 1.1.0 + neu terrain-farben: weiche Biomübergänge, Wiesenflecken, Hangfels mit Bändern, Ufer, Schnee mit Rauschgrenze
- worldgen-scatter 1.1.0 + neu worldgen-vegetation: Vegetation in Ebenen (neue Arten totholz, unterholz, geroell, seerose, bodendecker),
  Typwahl nach Höhe/Temperatur/Feuchte; Option objekte.artDichte. worldgen-chunks 1.2.0, worldgen-adapter 1.1.0 (Radien neuer Typen),
  worldgen-height 1.1.0 (optionale Felsstufen). Schnappschüsse neu (nur Objekte geändert)
- Spiele: neues natur-labor (Asset-Betrachter); testwelt mit neuen Assets und Wind; weltlabor-Kartenfarben

## 2026-11 – Figuren-System ausgebaut (alle additiv, Minor-Versionen)
- Aussehen: render/mesh-builder 1.1 (torus, lathe); character-look 1.1 (neue Haare/Bärte/Kleidung/Hüte, brille/schal/schmuck,
  Körper schultern/muskeln, Feld ausdruck, TEIL_NAMEN, AUSDRUECKE, 9 neue Vorlagen); character-model 1.1 (Mimik: setAusdruck,
  setAugen, setLider, blinzeln, updateGesicht; setAusdruck(null) = Grundmimik aus dem Look); character-parts/-kopf 1.1, aufgeteilt in
  character-parts-basis/-torso/-becken/-ruecken/-haar/-hut/-zubehoer/-gesicht; neu: character-ausruestung (16 Gegenstände)
- Animation: character-animator/-clips/-gang/-pose 1.1; neu: character-clips-mehr (24 Clips), character-anim-blick/-hang/-idle/-zustand,
  character-sekundaer (Nachschwingen), character-reaktion (Treffer, Umfallen, Aufstehen)
- Bewegung/KI: character-motor 1.1 (Rolle, Dash, Doppelsprung, Gleiten, Tauchen, Schleichen, Kantenschutz, Betäubung),
  character-steering 1.1 (Patrouille, Umkreisen, Abstand, Verstecken, Schwarm); neu: character-motor-tuning, character-steering-extra,
  character-gruppe, character-sinne (Sehen/Hören/Gedächtnis), character-brain (Zustandsautomat mit Tagesplan)
- Steuerung: follow-camera 1.1 (Ich-Sicht, Presets, Kamerafahrt, Hindernis-Kollision, weiches Lock-On), move-input 1.1 (Belegung als Daten,
  neue Aktionen rollen/gleiten/tauchen/aktion1/2/interagieren/ziel; stickRadius jetzt 'auto'), touch-stick 1.1; neu: camera/ziel-wahl,
  ui/figur-schild (Namensschild, Sprechblase, Lebensbalken)
- gameplay/character 1.1: Brain-Option, sage, ausruesten/ablegen, setAusdruck(name,{dauer}), treffer/umfallen/aufstehen, blickZu;
  Fehler behoben: Getter (z. B. look) waren nach setLook eingefroren
- Spiele: testwelt läuft mit echter Figur + 14 Dorfbewohnern (Brain); figuren-labor mit Ausrüstung, Ausdrücken, Brain-NPCs

## 2026-11 – Figuren-System (1.0.0, entwurf)
- render/mesh-builder; models/character: character-look, character-rig, character-parts, character-parts-kopf, character-model, character-pose, character-clips, character-gang, character-animator
- gameplay: character-motor, character-steering, character (Klebstoff); input: move-input, touch-stick; camera: follow-camera
- Vertrag: docs/FIGUREN-SYSTEM.md · Testspiel: games/figuren-labor

## 2026-11 – Weltengine: Chunk-Flüsse und Schnappschüsse
- world/worldgen/worldgen-chunkfluss 1.0.0 (neu): chunk-lokale Flussnetze aus einem Knotengitter (Seed + Position), begrenzter Zufluss, Überlauf flacher Senken, kleine Seen in Senken – nahtlos ohne globale Stufen
- world/worldgen/worldgen-chunks 1.1.0 (additiv): Flussmodus 'netz' ist Standard (alter Modus über `chunk.flussModus: 'rauschen'`, Werte dort unverändert); Chunks liefern zusätzlich `wasser` und `seen`, neu `seenIn()`, `dispose()`, `samplePunkt` füllt optional `aus[8]` (Wasserspiegel). Signaturen von generateChunk/sampleHeight unverändert, die Höhenwerte im Standardmodus ändern sich.
- world/worldgen/worldgen-presets 1.1.0: neue Optionen `chunk.flussModus`, `chunk.netz`
- worldgen-snapshot.test.mjs: Hash-Schnappschüsse für 8 Presets und beide Chunk-Flussmodi
- games/weltlabor: Chunk-Modus nutzt Wasserspiegel und Seen aus den Chunks

## 2026-11 – Testwelt
- world/worldgen/worldgen-adapter 1.0.0: Welt in Metern für Figuren/Kamera (bodenHoehe, wasserHoehe, hindernisse, Startpunkt) – passt zu docs/FIGUREN-SYSTEM.md
- world/terrain-mesh 1.0.0: Gelände mit Biomfarben, Seen/Flüsse, Meer
- world/scatter-mesh 1.0.0: Bäume, Büsche, Felsen … als InstancedMesh je Typ
- games/testwelt: begehbare 3D-Testwelt (Figurensystem-Steckplatz mit Platzhalter)

## 2026-11 – Phase 0
- core/rng 1.0.0, core/noise 1.0.0 (aus planet/js/noise.js, plus 2D-Simplex, fbm2, ridged2, warp2), core/math 1.0.0
- test/fake-dom 1.0.0 (Browser-Attrappe für Node-Tests; THREE läuft in Tests echt aus node_modules)
- world/worldgen 1.0.0: Weltgenerator-Pipeline (Form, Höhe, Erosion, Hydrologie, Flüsse, Klima, Biome, Orte, Objekte), 13 Presets, Chunk-Modus, Abfragen, A*-Wegsuche, Worker-Übergabe
- games/weltlabor: Vorschauseite für den Weltgenerator
- Werkzeuge: tools/katalog.mjs (Katalog + Prüfung + Schichtregeln), tools/build.mjs (esbuild → dist/<spiel>.html), tests/smoke.mjs
