# Engine-Changelog

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
