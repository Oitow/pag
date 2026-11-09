# 🧰 Engine-Katalog

> Automatisch erzeugt von `node tools/katalog.mjs` – nicht von Hand bearbeiten.
> Erst diese Liste lesen, dann gezielt den Eintrag (`grep -n -A12 "### <modul>" engine/KATALOG.md`).

## Übersicht

| Modul | Pfad | Zweck | Status |
|---|---|---|---|
| follow-camera | `engine/camera/follow-camera.js` | Third-Person-Orbitkamera: weiches Folgen (vertikal träger), Kollision entlang des Sichtstrahls (Boden + Hindernisse, sanftes Zurückfahren), Auto-Ausrichtung, Sprint-FOV, Zoom, Schütteln, weiches Lock-On mit Zielwechsel, Erste-Person beim Reinzoomen, Presets (nah/weit/Schulter), Kamerafahrten | entwurf |
| ziel-wahl | `engine/camera/ziel-wahl.js` | Lock-On-Ziel auswählen: bestes Ziel vor der Figur (Winkel + Abstand) oder nächstes Ziel links/rechts vom aktuellen (Ziel wechseln) | entwurf |
| math | `engine/core/math.js` | Kleine Mathe-Helfer: clamp, lerp, smoothstep, framerate-unabhängiges Dämpfen, Winkel | stabil |
| noise | `engine/core/noise.js` | Seedbares Simplex-Rauschen 2D/3D plus fBm, Grat-Rauschen und Domain-Warp für Terrain, Biome und Texturen | stabil |
| rng | `engine/core/rng.js` | Deterministischer Zufall (mulberry32), Seeds aus Text, Gitter-Hash und Würfel-Helfer | stabil |
| character-brain | `engine/gameplay/character-brain.js` | NPC-Verhaltensplaner (Zustandsautomat) über Steering + Sinne: idle, wandern, patrouille, arbeiten, folgen, fliehen, angreifen, suchen, plaudern; Tagesablauf nach Stunde; liefert Absicht + Aktions-Clip | entwurf |
| character-gruppe | `engine/gameplay/character-gruppe.js` | Schwarm-/Herdenverhalten für NPCs (Boids in x/z): Separation, Kohäsion, Ausrichtung – liefert eine Zusatzkraft für die Absicht | entwurf |
| character-motor-tuning | `engine/gameplay/character-motor-tuning.js` | Standard-Tuning des Figuren-Motors (Tempo, Sprung, Rolle/Dash, Gleiten, Tauchen, Kantenschutz) – reine Daten | entwurf |
| character-motor | `engine/gameplay/character-motor.js` | Kinematischer Figuren-Controller ohne THREE: Beschleunigung, Coyote-Time, Jump-Buffer, variable Sprunghöhe, Doppelsprung, Rolle/Dash, Gleiten, Tauchen, Kantenschutz, Stufen, Hang-Rutschen, Hindernisse, Schwimmen, Stöße | entwurf |
| character-sinne | `engine/gameplay/character-sinne.js` | NPC-Wahrnehmung ohne THREE: Sichtkegel (Winkel, Reichweite, Rundum-Nahbereich), Hören (Radius × Lautstärke), Sichtlinie über welt.bodenHoehe, Gedächtnis mit Verdacht und Vergessen | entwurf |
| character-steering-extra | `engine/gameplay/character-steering-extra.js` | Reine Steering-Rechnungen: Patrouillen-Fortschritt (Schleife/Pingpong/einmal), Umkreisen, Abstand halten, Versteckpunkt hinter Deckung | entwurf |
| character-steering | `engine/gameplay/character-steering.js` | NPC-Bewegungs-Gehirn: liefert dieselbe Absicht wie die Eingabe – Ziel/Ankommen, Wandern, Folgen, Fliehen, Pfad, Patrouille, Umkreisen, Abstand halten, Verstecken, Schwarm, Ausweichen, Steckenbleiben auflösen | entwurf |
| character | `engine/gameplay/character.js` | Fertige Spielfigur in einem Objekt: Modell (Look) + Animator + Bewegungs-Motor, für Spieler und NPCs gleich | entwurf |
| move-input | `engine/input/move-input.js` | Bewegungs-Eingabe für Figuren: Tastatur (WASD/Pfeile), Maus-Ziehen/Mausrad, Touch-Stick + Knöpfe, Gamepad → Stick, Kamera-Delta, Aktionen (Flanke/gehalten) | entwurf |
| touch-stick | `engine/input/touch-stick.js` | Touch-Steuerung fürs Handy: dynamischer virtueller Joystick (linke Hälfte), Kamera-Wischen + Pinch-Zoom (rechte Hälfte), runde Aktionsknöpfe unten rechts | entwurf |
| character-anim-blick | `engine/models/character/character-anim-blick.js` | Blick einer Figur (rein): Richtung oder Weltpunkt → verteilt auf Torso/Hals/Kopf mit Grenzen, Augen eilen voraus; Blinzeln per Seed; Werte für einen Mimik-Hook | entwurf |
| character-anim-hang | `engine/models/character/character-anim-hang.js` | Hang-Anpassung (rein): Steigung im Figur-Raum aus Motor-Zustand/Normale/bodenHoehe messen und Fußziele, Hüfthöhe, Fußneigung und Rumpf-Vorlage daran anpassen | entwurf |
| character-anim-idle | `engine/models/character/character-anim-idle.js` | Idle-Variationen (rein): nach längerer Ruhe deterministisch (Seed) eine Idle-Variante (strecken, gähnen, umschauen, kratzen …) als eigene Schicht einblenden, bei Bewegung sofort weich abbrechen | entwurf |
| character-anim-zustand | `engine/models/character/character-anim-zustand.js` | Posen für Sonder-Zustände des Motors (rein): Rolle (rollAnteil), Luft-Dash, Salto beim Doppelsprung, Gleiten, Arme rudern an der Kante, Betäubt-Taumeln | entwurf |
| character-animator | `engine/models/character/character-animator.js` | Prozedurale Figuren-Animation aus dem Motor-Zustand: idle/gehen/laufen/sprinten ohne Fußrutschen, Luft, Landung, Schwimmen, Ducken, Rutschen, Kurvenlage, Atmen, Hang, Idle-Varianten, sekundäre Bewegung, Treffer/Umfallen, Aktions-Clips mit Masken, Blick + Mimik-Hook | entwurf |
| character-ausruestung | `engine/models/character/character-ausruestung.js` | Low-Poly-Gegenstände für Figuren-Sockel (Schwert, Dolch, Axt, Hammer, Hacke, Schaufel, Speer, Stab, Zauberstab, Schild, Bogen, Fackel, Laterne, Korb, Becher, Buch): je ein Mesh + optional Leucht-Mesh, passend ausgerichtet für model.befestigen(sockel, obj) | entwurf |
| character-clips-mehr | `engine/models/character/character-clips-mehr.js` | Weitere Aktions-Clips als reine Keyframe-Daten (Emotes, Kampf, Arbeit, Ruhe, Idle-Varianten); wird von character-clips registriert | entwurf |
| character-clips | `engine/models/character/character-clips.js` | Aktions-Clips einer Figur als Keyframe-Daten (winken, schlagen, hacken, werfen, aufheben, tod, rolle, sitzen, tanzen … + character-clips-mehr) und ihr Abtaster | entwurf |
| character-gang | `engine/models/character/character-gang.js` | Fortbewegungs-Posen einer Figur (rein): Fußziele aus Gangphase (gehen/laufen/sprinten ohne Fußrutschen), Bein-IK, Rumpf/Arme, Luft- und Schwimm-Pose | entwurf |
| character-look | `engine/models/character/character-look.js` | Aussehen einer Figur als reine Daten: Körperbau, Haut, Haar, Bart, Kleidung, Kopfbedeckung, Accessoires (Brille, Schal, Schmuck), Grund-Mimik; Vorlagen, Zufalls-Looks per Seed, abgeleitete Körpermaße | entwurf |
| character-model | `engine/models/character/character-model.js` | Look → fertige Figur: Rig (Gelenk-Gruppen) + Low-Poly-Meshes je Knochen; Look live wechseln, Gegenstände an Sockeln befestigen | entwurf |
| character-parts-basis | `engine/models/character/character-parts-basis.js` | Gemeinsame Helfer der Figuren-Bau-Funktionen: Farben mischen/abdunkeln, Kugel- und Zylinder-Ausschnitte in einen mesh-builder | entwurf |
| character-parts-becken | `engine/models/character/character-parts-becken.js` | Bau-Funktion für das Figuren-Becken (Knochen becken): Hüfte, Gürtel, Gürteltasche, Kittelsaum, Rock, Mantelschöße, Schürze, Lederstreifen | entwurf |
| character-parts-gesicht | `engine/models/character/character-parts-gesicht.js` | Bewegliches Figuren-Gesicht im Knochen kopf: Iris/Pupillen (Blick), Lider (Blinzeln, Öffnung), Brauen + Mund je Gesichtsausdruck – nur 3 kleine Meshes | entwurf |
| character-parts-haar | `engine/models/character/character-parts-haar.js` | Bau-Funktionen für Frisuren und Bärte im Knochen kopf (Kopfkugel um y = R, Gesicht nach +Z); beachtet Kopfbedeckungen | entwurf |
| character-parts-hut | `engine/models/character/character-parts-hut.js` | Bau-Funktion für Kopfbedeckungen im Knochen kopf (eigenes Mesh): Kapuze, Hüte, Helme, Kronen, Tücher, Turban | entwurf |
| character-parts-kopf | `engine/models/character/character-parts-kopf.js` | Bau-Funktion für den Figuren-Kopf: Kopfform, Ohren, Nase, festes Gesicht (oder nur Augäpfel, wenn das bewegliche Gesicht aktiv ist), Frisur, Bart, Brille, Ohrringe; bündelt Kopfbedeckungen | entwurf |
| character-parts-ruecken | `engine/models/character/character-parts-ruecken.js` | Bau-Funktionen für Rücken-Teile einer Figur: Umhang (kurz, lang, Kragen-Cape) am Sockel umhang, Rucksack am Sockel ruecken | entwurf |
| character-parts-torso | `engine/models/character/character-parts-torso.js` | Bau-Funktion für den Figuren-Oberkörper (Knochen torso) je Oberteil-Stil: Kittel, Hemd, Robe, Rüstung, Weste, Kleid, Mantel, Schürze, Kettenhemd, Lederrüstung | entwurf |
| character-parts-zubehoer | `engine/models/character/character-parts-zubehoer.js` | Bau-Funktionen für Accessoires: Schal/Halstuch/Pelzkragen und Halsschmuck (Knochen torso), Brille/Augenklappe/Monokel und Ohrringe (Knochen kopf) | entwurf |
| character-parts | `engine/models/character/character-parts.js` | Bau-Funktionen für Figuren-Körperteile je Knochen aus Look + Körpermaßen: Kontext, Hals, Arme, Hände, Beine, Füße; bündelt Torso, Becken, Umhang, Rucksack, Zubehör | entwurf |
| character-pose | `engine/models/character/character-pose.js` | Posen einer Figur als reine Daten: leere Pose, kopieren, mischen, addieren, maskieren (Ober-/Unterkörper, Arme) und aufs Rig anwenden | entwurf |
| character-reaktion | `engine/models/character/character-reaktion.js` | Prozedurale Treffer-Reaktion (rein): Stoß aus Richtung + Stärke als abklingende additive Pose; Umfallen als Ragdoll-Ersatz ohne Physik-Engine (Kippen, Aufprall, schlaffe Glieder) | entwurf |
| character-rig | `engine/models/character/character-rig.js` | Prozedurales Skelett einer Menschen-Figur aus Gruppen (keine Skinning-Knochen): feste Gelenknamen, Ruhepose, Sockel für Hut/Waffe/Rucksack | entwurf |
| character-sekundaer | `engine/models/character/character-sekundaer.js` | Sekundäre Bewegung (rein): Feder-Dämpfer für Kopf-Nachschwingen, Gewichtsverlagerung beim Anhalten/Anfahren, Umhang- und Haar-Winkel – additiv auf eine Pose | entwurf |
| mesh-builder | `engine/render/mesh-builder.js` | Low-Poly-Modelle aus Primitiven (Box, Kugel, Zylinder …) mit Vertexfarben zu EINER Geometrie verschmelzen; Farbvariation pro Dreieck per Seed | entwurf |
| fake-dom | `engine/test/fake-dom.mjs` | Minimale Browser-Attrappe für Node-Tests: document, window, localStorage, requestAnimationFrame | stabil |
| figur-schild | `engine/ui/figur-schild.js` | Namensschild + Sprechblase + Lebensbalken über Figuren (DOM-Overlay): folgt dem Kopf, skaliert und blendet nach Abstand aus, verschwindet hinter der Kamera | entwurf |
| scatter-mesh | `engine/world/scatter-mesh.js` | Zeichnet die Objekte einer erzeugten Welt (welt.objekte: Bäume, Büsche, Felsen, Kakteen, Schilf, Blumen) als InstancedMesh je Typ mit einfachen Low-Poly-Formen; eigene Formen je Typ überschreibbar | entwurf |
| terrain-mesh | `engine/world/terrain-mesh.js` | Baut aus einer erzeugten Welt (worldgen) und ihrem Welt-Adapter ein Three-Gelände: Boden mit Biomfarben, Hangfels und Farbrauschen, Seen/Flüsse auf ihrem Wasserspiegel und ein Meer bis zum Horizont | entwurf |
| worldgen-adapter | `engine/world/worldgen/worldgen-adapter.js` | Welt-Adapter für Figuren, Kamera und Spiele: macht aus einer erzeugten Welt (normierte Höhe, Gitter) eine Welt in Metern mit bodenHoehe, wasserHoehe und hindernisse (Baumstämme, Felsen) – passt zum Vertrag in docs/FIGUREN-SYSTEM.md | entwurf |
| worldgen-biomes | `engine/world/worldgen/worldgen-biomes.js` | Biome nach Whittaker (Temperatur × Feuchte, als schnelle Nachschlagetabelle) plus Prioritätsregeln (Wasser, Schnee, Fels, Strand, Sumpf); Biomliste per Spiel erweiterbar | entwurf |
| worldgen-chunks | `engine/world/worldgen/worldgen-chunks.js` | Unendlicher/gestreamter Modus: Höhe, Klima, Biome, Rauschflüsse und Objekte punktweise und pro Chunk – nahtlos über Chunkgrenzen (ohne globale Erosion/Hydrologie) | entwurf |
| worldgen-climate | `engine/world/worldgen/worldgen-climate.js` | Klima für den Weltgenerator: Temperatur nach Höhe/Breitengrad, Feuchte aus Wassernähe, Rauschen und Regenschatten (Windrichtung) | entwurf |
| worldgen-erosion | `engine/world/worldgen/worldgen-erosion.js` | Schnelle hydraulische Tropfen-Erosion (mit Pinsel-Abtrag) und thermische Erosion auf einem Float32-Höhenfeld; Qualitätsstufen schnell/normal/hoch | entwurf |
| worldgen-grid | `engine/world/worldgen/worldgen-grid.js` | Gitter-Helfer für den Weltgenerator: typisierter Min-Heap, Chamfer-Abstand, Regionen-Markierung, bilineares Abtasten, Array-Hash | entwurf |
| worldgen-height | `engine/world/worldgen/worldgen-height.js` | Höhenfeld aus fBm, Grat-Gebirgen, Domain-Warp, Klippen und Terrassen; punktweise abtastbar (für Chunks) oder als ganzes Gitter | entwurf |
| worldgen-hydrology | `engine/world/worldgen/worldgen-hydrology.js` | Wasserhaushalt: Ozean vom Rand fluten, Senken per Priority-Flood füllen, Seen erkennen, Abflussrichtung (D8) und Abflussmenge berechnen | entwurf |
| worldgen-path | `engine/world/worldgen/worldgen-path.js` | A*-Wegsuche auf dem Weltgitter (8 Richtungen) mit Kosten nach Hang, Wasser und Flüssen; wiederverwendbare typisierte Puffer | entwurf |
| worldgen-presets | `engine/world/worldgen/worldgen-presets.js` | Standardoptionen und benannte Voreinstellungen (insel, archipel, kontinent, gebirge, wueste, tundra, sumpfland, vulkaninsel, canyon, flachland, kueste, hochebene, unendlich) plus tiefes Zusammenführen von Optionen | entwurf |
| worldgen-query | `engine/world/worldgen/worldgen-query.js` | Abfragen auf einer erzeugten Welt (Weltkoordinaten): Höhe bilinear, Hang, Normale, Biom, Wasser; hängt Methoden auch an Welt-Daten aus einem Worker an | entwurf |
| worldgen-rivers | `engine/world/worldgen/worldgen-rivers.js` | Flüsse aus der Abflussmenge: Flusszellen mit Breite, Flussbett eingraben, Ufer abflachen, geglättete Flusslinien (Quelle → Meer/See) erzeugen | entwurf |
| worldgen-scatter | `engine/world/worldgen/worldgen-scatter.js` | Blue-Noise-Verteilung von Objekten (Bäume, Büsche, Felsen, Kakteen, Schilf, Blumen …) mit Dichte pro Biom, Lichtungen und Hangregeln; reihenfolgeunabhängig und dadurch nahtlos über Chunks | entwurf |
| worldgen-shape | `engine/world/worldgen/worldgen-shape.js` | Landform-Masken für den Weltgenerator (Insel, Archipel, Kontinent, Küste, Vulkan, Canyon, Plateau, unendlich) plus formspezifische Nachbearbeitung der Höhe | entwurf |
| worldgen-sites | `engine/world/worldgen/worldgen-sites.js` | Orte finden: Startplatz (flach, nah an Wasser und Wald, eingeebnet), Dorfplätze mit Mindestabstand und Sehenswürdigkeiten (Gipfel, Quellen, Mündungen, Seen) | entwurf |
| worldgen | `engine/world/worldgen/worldgen.js` | Weltgenerator-Einstieg: createWorld(optionen) führt die Stufen-Pipeline (Höhe → Erosion → Hydrologie → Flüsse → Klima → Biome → Orte → Objekte) per Preset aus; Spiele können Stufen einfügen/ersetzen; Ergebnis in typisierten Arrays | entwurf |

## Tags

| Tag | Module |
|---|---|
| abfluss | worldgen-hydrology, worldgen-rivers |
| abfrage | worldgen-query |
| abstand | worldgen-grid |
| accessoire | character-parts-zubehoer |
| accessoires | character-look |
| adapter | worldgen-adapter |
| aktion | character-animator, character-clips |
| amulett | character-parts-zubehoer |
| angriff | character-clips |
| animation | character, character-anim-blick, character-anim-hang, character-anim-idle, character-anim-zustand, character-animator, character-clips-mehr, character-clips, character-gang, character-pose, character-reaktion, character-rig, character-sekundaer |
| arbeit | character-clips-mehr |
| astar | worldgen-path |
| attrappe | fake-dom |
| augen | character-anim-blick, character-parts-gesicht |
| augenklappe | character-parts-zubehoer |
| ausdruck | character-parts-gesicht |
| ausrüstung | character-ausruestung, character-model |
| aussehen | character-look |
| auswahl | ziel-wahl |
| avatar | character, character-look, character-model |
| axt | character-ausruestung |
| baeume | scatter-mesh, worldgen-scatter |
| bart | character-parts-haar, character-parts-kopf |
| betaeubt | character-anim-zustand |
| bewegung | character-motor-tuning, character-motor, character-steering, character |
| biome | terrain-mesh, worldgen-biomes, worldgen-query |
| blick | character-anim-blick, character-parts-gesicht |
| blinzeln | character-anim-blick, character-parts-gesicht |
| blue-noise | worldgen-scatter |
| boden | worldgen-adapter |
| bogen | character-ausruestung |
| boids | character-gruppe |
| brille | character-parts-kopf, character-parts-zubehoer |
| cape | character-parts-ruecken |
| charakter | character, character-anim-blick, character-anim-hang, character-anim-idle, character-anim-zustand, character-animator, character-ausruestung, character-clips-mehr, character-clips, character-gang, character-look, character-model, character-parts-basis, character-parts-becken, character-parts-gesicht, character-parts-haar, character-parts-hut, character-parts-kopf, character-parts-ruecken, character-parts-torso, character-parts-zubehoer, character-parts, character-pose, character-reaktion, character-rig, character-sekundaer |
| chunks | worldgen-chunks |
| clip | character-animator, character-clips-mehr, character-clips |
| controller | character-motor, character |
| dash | character-motor, character-anim-zustand |
| dialog | figur-schild |
| dom | fake-dom |
| dorf | worldgen-sites |
| dreispitz | character-parts-hut |
| editor | character-look, character-model |
| eingabe | move-input, touch-stick |
| emote | character-clips-mehr, character-clips |
| emotion | character-parts-gesicht |
| erosion | worldgen-erosion |
| fackel | character-ausruestung |
| farbe | character-parts-basis |
| fbm | worldgen-height |
| feder | character-sekundaer |
| felsen | scatter-mesh |
| feuchte | worldgen-climate |
| figur | follow-camera, character-motor-tuning, character-motor, character, move-input, character-anim-blick, character-anim-hang, character-anim-idle, character-anim-zustand, character-animator, character-ausruestung, character-clips-mehr, character-clips, character-gang, character-look, character-model, character-parts-basis, character-parts-becken, character-parts-gesicht, character-parts-haar, character-parts-hut, character-parts-kopf, character-parts-ruecken, character-parts-torso, character-parts-zubehoer, character-parts, character-pose, character-reaktion, character-rig, character-sekundaer, figur-schild, worldgen-adapter |
| first-person | follow-camera |
| fluss | worldgen-rivers |
| folgen | follow-camera |
| form | worldgen-shape |
| frisur | character-parts-haar, character-parts-kopf |
| fuesse | character-anim-hang, character-gang |
| gamepad | move-input |
| gameplay | character-brain, character-gruppe, character-motor-tuning, character-motor, character-sinne, character-steering-extra, character-steering |
| gang | character-animator, character-gang |
| gebirge | worldgen-height |
| gedaechtnis | character-sinne |
| gelaende | character-anim-hang, terrain-mesh |
| gelenke | character-rig |
| generator | worldgen |
| geometrie | mesh-builder |
| gesicht | character-model, character-parts-gesicht, character-parts-kopf |
| gewicht | character-sekundaer |
| gitter | worldgen-grid |
| gleiten | character-motor, character-anim-zustand |
| gürtel | character-parts-becken |
| haar | character-parts-haar, character-parts-kopf, character-sekundaer |
| handy | touch-stick |
| hang | character-anim-hang |
| hash | rng |
| heap | worldgen-grid |
| helm | character-parts-hut, character-parts-kopf |
| herde | character-gruppe |
| hilfen | character-parts-basis |
| hoehe | worldgen-height, worldgen-query |
| hoeren | character-sinne |
| hp | figur-schild |
| hud | figur-schild |
| hut | character-parts-hut, character-parts-kopf |
| hydraulik | worldgen-erosion |
| idle | character-anim-idle, character-clips-mehr |
| ik | character-anim-hang, character-gang |
| insel | worldgen-presets, worldgen-shape, worldgen |
| instanzen | scatter-mesh |
| interpolation | math |
| joystick | move-input, touch-stick |
| kamera | follow-camera, ziel-wahl, math |
| kamerafahrt | follow-camera |
| kampf | ziel-wahl, character-steering-extra, character-steering, character-clips-mehr, character-reaktion |
| kante | character-anim-zustand |
| kapuze | character-parts-hut |
| karte | worldgen |
| kette | character-parts-zubehoer |
| keyframe | character-clips-mehr, character-clips |
| ki | character-brain, character-gruppe, character-sinne, character-steering-extra, character-steering |
| kleidung | character-parts-becken, character-parts-torso, character-parts |
| klima | worldgen-biomes, worldgen-climate |
| knoepfe | touch-stick |
| kollision | follow-camera, worldgen-adapter |
| kopf | character-anim-blick, character-parts-haar, character-parts-hut, character-parts-kopf |
| korb | character-ausruestung |
| krone | character-parts-hut, character-parts-kopf |
| körper | character-parts |
| laterne | character-ausruestung |
| laufen | character-animator, character-gang |
| lebensbalken | figur-schild |
| lock-on | follow-camera, ziel-wahl |
| locken | character-parts-haar |
| look | character-look |
| lowpoly | character-parts, mesh-builder |
| mantel | character-parts-becken, character-parts-torso |
| maske | character-pose, worldgen-shape |
| mathe | math |
| maus | move-input |
| meer | terrain-mesh |
| merge | mesh-builder |
| mesh | character-model, character-parts-basis, character-parts, mesh-builder, scatter-mesh, terrain-mesh |
| mimik | character-anim-blick, character-look, character-model, character-parts-gesicht |
| mischen | character-pose |
| modell | character-model, mesh-builder |
| monokel | character-parts-zubehoer |
| motor | character-anim-zustand |
| nachschwingen | character-sekundaer |
| namensschild | figur-schild |
| node | fake-dom |
| noise | noise |
| normale | worldgen-query |
| npc | character-brain, character-gruppe, character-sinne, character-steering-extra, character-steering, character, character-anim-idle, character-animator, character-look, character-model, figur-schild |
| oberteil | character-parts-torso |
| objekte | scatter-mesh, worldgen-scatter |
| ohrringe | character-parts-zubehoer |
| optionen | worldgen-presets |
| orbit | follow-camera |
| orte | worldgen-sites |
| overlay | figur-schild |
| patrouille | character-steering-extra, character-steering |
| pfad | character-steering, worldgen-path |
| physik | character-motor |
| pinch | touch-stick |
| poi | worldgen-sites |
| poisson | worldgen-scatter |
| pose | character-pose |
| preset | follow-camera |
| presets | worldgen-presets |
| primitive | mesh-builder |
| priority-flood | worldgen-hydrology |
| prozedural | noise, worldgen |
| ragdoll | character-reaktion |
| rauschen | noise |
| reaktion | character-reaktion |
| regen | worldgen-climate |
| rig | character-pose, character-rig |
| rock | character-parts-becken |
| rolle | character-motor, character-anim-zustand |
| rucksack | character-parts-ruecken, character-parts |
| ruhe | character-anim-idle |
| rüstung | character-parts-torso |
| salto | character-anim-zustand |
| schal | character-parts-zubehoer |
| schild | character-ausruestung |
| schleichen | character-sinne |
| schmuck | character-parts-zubehoer |
| schuetteln | follow-camera |
| schuhe | character-parts |
| schwarm | character-gruppe, character-steering |
| schwert | character-ausruestung |
| schwimmen | character-motor, character-animator, character-gang |
| schürze | character-parts-becken, character-parts-torso |
| seed | rng |
| seen | worldgen-hydrology |
| sekundaer | character-sekundaer |
| sicht | character-sinne |
| skelett | character-rig |
| sockel | character-ausruestung, character-rig |
| speichern | character-look |
| spieler | character, character-animator, character-look, character-model |
| sprechblase | figur-schild |
| springen | character-animator |
| sprung | character-motor |
| start | worldgen-sites |
| steering | character-gruppe, character-steering-extra, character-steering |
| steuerung | move-input |
| streaming | worldgen-chunks |
| tagesablauf | character-brain |
| tasche | character-parts-becken |
| tastatur | move-input |
| temperatur | worldgen-climate |
| terrain | noise, terrain-mesh, worldgen-chunks, worldgen-erosion, worldgen-height, worldgen-shape, worldgen |
| test | fake-dom |
| third-person | follow-camera |
| tod | character-reaktion |
| touch | move-input, touch-stick |
| treffer | character-reaktion |
| tuning | character-motor-tuning |
| turban | character-parts-hut |
| ui | figur-schild |
| umfallen | character-reaktion |
| umhang | character-parts-ruecken, character-parts, character-sekundaer |
| unendlich | worldgen-chunks |
| variation | character-anim-idle |
| vegetation | scatter-mesh |
| verhalten | character-brain |
| verstecken | character-steering-extra |
| verteilung | worldgen-scatter |
| vertexfarben | mesh-builder |
| waffe | character-ausruestung |
| wahrnehmung | character-sinne |
| wandern | character-steering |
| wasser | terrain-mesh, worldgen-adapter, worldgen-hydrology, worldgen-rivers |
| wegfindung | worldgen-path |
| welt | noise, rng, scatter-mesh, terrain-mesh, worldgen-adapter, worldgen-biomes, worldgen-chunks, worldgen-climate, worldgen-erosion, worldgen-grid, worldgen-height, worldgen-hydrology, worldgen-path, worldgen-presets, worldgen-query, worldgen-rivers, worldgen-scatter, worldgen-shape, worldgen-sites, worldgen |
| werkzeug | character-ausruestung |
| whittaker | worldgen-biomes |
| worldgen | worldgen-adapter, worldgen-biomes, worldgen-chunks, worldgen-climate, worldgen-erosion, worldgen-grid, worldgen-height, worldgen-hydrology, worldgen-path, worldgen-presets, worldgen-query, worldgen-rivers, worldgen-scatter, worldgen-shape, worldgen-sites, worldgen |
| zauberhut | character-parts-hut |
| ziel | ziel-wahl |
| zielen | ziel-wahl |
| zoom | follow-camera, touch-stick |
| zopf | character-parts-haar |
| zufall | rng |
| zustandsautomat | character-brain |

## Module

### follow-camera · `engine/camera/follow-camera.js` · v1.1.0 · entwurf
Third-Person-Orbitkamera: weiches Folgen (vertikal träger), Kollision entlang des Sichtstrahls (Boden + Hindernisse, sanftes Zurückfahren), Auto-Ausrichtung, Sprint-FOV, Zoom, Schütteln, weiches Lock-On mit Zielwechsel, Erste-Person beim Reinzoomen, Presets (nah/weit/Schulter), Kamerafahrten

- `createFollowCamera(opts) -> { kamera, yaw, pitch, distanz, erstePerson, figurAusblenden, preset, lockZiel, inFahrt, update(dt, ziel, info), drehen(dx, dy), zoomen(delta), schuetteln(staerke, dauer), blickYaw(), richtungAusStick(x, y), springeZu(ziel), lockOn(punkt|fn|null), setErstePerson(bool), setPreset(name|obj, {sofort}), fahrt({pos, blick, dauer, halten}) -> Promise, beendeFahrt(), dispose() }`
- `stickRichtung(x, y, yaw) -> {x, z}`
- `KAMERA_PRESETS`

```js
import { createFollowCamera } from '../../engine/camera/follow-camera.js';
const cam = createFollowCamera({ welt, erstePerson: true });   // welt: Adapter mit bodenHoehe (+ hindernisse)
const e = eingabe.lesen(); cam.drehen(e.kameraX, e.kameraY); cam.zoomen(e.zoom);
const r = cam.richtungAusStick(e.x, e.y);       // Kamera-relative Laufrichtung in Weltkoordinaten
cam.update(dt, motor.pos, { tempo: motor.tempo, sprintet: motor.sprintet, yaw: motor.yaw, amBoden: motor.amBoden });
cam.setPreset('schulter'); cam.fahrt({ pos: { x: 5, y: 8, z: 5 }, blick: turm, dauer: 1.5, halten: 2 });
renderer.render(szene, cam.kamera);
```

Genutzt von: figuren-labor, testwelt · Tags: kamera, third-person, first-person, orbit, folgen, zoom, figur, lock-on, schuetteln, kollision, kamerafahrt, preset · THREE: ja

### ziel-wahl · `engine/camera/ziel-wahl.js` · v1.0.0 · entwurf
Lock-On-Ziel auswählen: bestes Ziel vor der Figur (Winkel + Abstand) oder nächstes Ziel links/rechts vom aktuellen (Ziel wechseln)

- `waehleZiel(kandidaten, { von, blickYaw, aktuell, richtung, maxDistanz, maxWinkel, gewichtWinkel }) -> kandidat | null`
- `zielPos(k) -> {x, y, z} | null`

```js
import { waehleZiel } from '../../engine/camera/ziel-wahl.js';
let ziel = waehleZiel(npcs, { von: held.zustand.pos, blickYaw: cam.yaw });            // bestes Ziel vorn
ziel = waehleZiel(npcs, { von: held.zustand.pos, blickYaw: cam.yaw, aktuell: ziel, richtung: 1 }); // nächstes rechts
cam.lockOn(ziel ? () => zielPos(ziel) : null);
```

Genutzt von: figuren-labor, testwelt · Tags: kamera, lock-on, ziel, zielen, auswahl, kampf · THREE: nein

### math · `engine/core/math.js` · v1.0.0 · stabil
Kleine Mathe-Helfer: clamp, lerp, smoothstep, framerate-unabhängiges Dämpfen, Winkel

- `clamp(v,a,b)`
- `lerp(a,b,t)`
- `invLerp(a,b,v)`
- `remap(v,a,b,c,d)`
- `smoothstep(a,b,x)`
- `damp(a,b,lambda,dt)`
- `angleDiff(a,b)`
- `dampAngle(a,b,lambda,dt)`
- `numOr(v,ersatz)`

```js
import { damp, clamp } from '../../engine/core/math.js';
kamera.x = damp(kamera.x, ziel.x, 6, dt);
zoom = clamp(zoom, 5, 80);
```

Genutzt von: figuren-labor · Tags: mathe, interpolation, kamera · THREE: nein

### noise · `engine/core/noise.js` · v1.0.0 · stabil
Seedbares Simplex-Rauschen 2D/3D plus fBm, Grat-Rauschen und Domain-Warp für Terrain, Biome und Texturen

- `createNoise2D(seed) -> (x,y)=>[-1,1]`
- `createNoise3D(seed) -> (x,y,z)=>[-1,1]`
- `fbm2(n2,x,y,okt,lac,gain)`
- `fbm(n3,x,y,z,okt,lac,gain)`
- `ridged2(n2,x,y,okt) -> [0,1]`
- `ridged(n3,x,y,z,okt) -> [0,1]`
- `warp2(n2,x,y,staerke,frequenz) -> [x,y]`

```js
import { createNoise2D, fbm2 } from '../../engine/core/noise.js';
const n = createNoise2D(42);
const hoehe = fbm2(n, x * 0.01, y * 0.01, 5);
```

Genutzt von: figuren-labor · Tags: rauschen, noise, terrain, welt, prozedural · THREE: nein

### rng · `engine/core/rng.js` · v1.0.0 · stabil
Deterministischer Zufall (mulberry32), Seeds aus Text, Gitter-Hash und Würfel-Helfer

- `rng(seed) -> ()=>number`
- `hashSeed(...teile) -> int`
- `hash2(x,y,seed) -> [0,1)`
- `hash3(x,y,z,seed) -> [0,1)`
- `range(r,a,b)`
- `int(r,a,b)`
- `pick(r,arr)`
- `chance(r,p)`
- `shuffle(r,arr)`
- `weighted(r,[[wert,gewicht]])`

```js
import { rng, hashSeed, pick } from '../../engine/core/rng.js';
const r = rng(hashSeed('insel', 42));
const baum = pick(r, ['eiche', 'tanne']);
```

Genutzt von: figuren-labor, testwelt · Tags: zufall, seed, hash, welt · THREE: nein

### character-brain · `engine/gameplay/character-brain.js` · v1.0.0 · entwurf
NPC-Verhaltensplaner (Zustandsautomat) über Steering + Sinne: idle, wandern, patrouille, arbeiten, folgen, fliehen, angreifen, suchen, plaudern; Tagesablauf nach Stunde; liefert Absicht + Aktions-Clip

- `createBrain({seed,welt,heimat,steering,sinne,grund,plan,reaktion,verhalten,feinde}) -> {zustand,aktion,aktionNeu,pos,absicht,steering,sinne,setze(name,daten),zurueck(),plaudereMit(anderes,dauer?),update(dt,motorZustand,{ziele,nachbarn,stunde,npcs})->{absicht,aktion,aktionNeu,zustand},dispose()}`
- `BRAIN_VERHALTEN`
- `planEintrag(plan,stunde)`

```js
import { createBrain } from '../../engine/gameplay/character-brain.js';
const hirn = createBrain({ seed: 3, welt, heimat: { x: 0, z: 0 },
plan: [{ von: 8, bis: 17, zustand: 'arbeiten', ort: { x: 4, z: 2 }, clip: 'hacken' }, { von: 17, bis: 8, zustand: 'wandern', radius: 5 }],
reaktion: { feind: 'fliehen' } });
const r = hirn.update(dt, motor.zustand, { ziele: [{ id: 'wolf', x, z, feind: true }], stunde: 9.5 });
motor.update(dt, r.absicht); if (r.aktionNeu && r.aktion) animator.spiele(r.aktion);
```

Genutzt von: – · Tags: npc, ki, verhalten, zustandsautomat, tagesablauf, gameplay · THREE: nein
Zustände + Daten für setze()/plan/grund: idle {} · wandern {radius, heimat} · patrouille {punkte, art, warten} ·
arbeiten {ort:{x,z}, clip, blickYaw} · folgen {ziel: id | ()=>{x,z}, abstand} · fliehen {ziel} · angreifen {ziel} ·
suchen {x, z} · plaudern {partner: ()=>{x,z}, dauer}.
reaktion: { feind: 'fliehen'|'angreifen'|'ignorieren', geraeusch: 'suchen'|'ignorieren' }. Feind = Ziel mit feind:true oder id in feinde.

### character-gruppe · `engine/gameplay/character-gruppe.js` · v1.0.0 · entwurf
Schwarm-/Herdenverhalten für NPCs (Boids in x/z): Separation, Kohäsion, Ausrichtung – liefert eine Zusatzkraft für die Absicht

- `createGruppe({sichtRadius,trennRadius,separation,kohaesion,ausrichtung,maxKraft}) -> {kraft(selbst,nachbarn,out?)->{x,z},setGewichte(teil),gewichte,dispose()}`
- `schwarmKraft(selbst,nachbarn,opts,out?) -> {x,z}`
- `GRUPPE_STANDARD`

```js
import { createGruppe } from '../../engine/gameplay/character-gruppe.js';
const herde = createGruppe({ kohaesion: 1 });
const k = herde.kraft({ x, z, vx, vz }, nachbarn); // nachbarn: [{ x, z, vx?, vz?, radius? }]
absicht.x += k.x; absicht.z += k.z;
```

Genutzt von: – · Tags: npc, ki, schwarm, herde, boids, steering, gameplay · THREE: nein

### character-motor-tuning · `engine/gameplay/character-motor-tuning.js` · v1.1.0 · entwurf
Standard-Tuning des Figuren-Motors (Tempo, Sprung, Rolle/Dash, Gleiten, Tauchen, Kantenschutz) – reine Daten

- `MOTOR_TUNING`

```js
import { MOTOR_TUNING } from '../../engine/gameplay/character-motor-tuning.js';
const motor = createMotor({ welt, tuning: { ...MOTOR_TUNING, doppelSprung: 1 } });
```

Genutzt von: – · Tags: figur, bewegung, tuning, gameplay · THREE: nein

### character-motor · `engine/gameplay/character-motor.js` · v1.1.0 · entwurf
Kinematischer Figuren-Controller ohne THREE: Beschleunigung, Coyote-Time, Jump-Buffer, variable Sprunghöhe, Doppelsprung, Rolle/Dash, Gleiten, Tauchen, Kantenschutz, Stufen, Hang-Rutschen, Hindernisse, Schwimmen, Stöße

- `createMotor({welt,pos,yaw,radius,hoehe,tuning,kantenSchutz}) -> {zustand,tuning,radius,hoehe,update(dt,absicht),teleport(pos,yaw?),stoss(x,y,z,{betaeubung}?),setTuning(teil),springeJetzt(),rolleJetzt(richtung?),dispose()}`
- `MOTOR_TUNING`

```js
import { createMotor } from '../../engine/gameplay/character-motor.js';
const motor = createMotor({ welt: { bodenHoehe: (x, z) => 0 }, pos: { x: 0, y: 0, z: 0 }, tuning: { doppelSprung: 1 } });
motor.update(dt, { x: 0, z: 1, sprint: false, springen: false, ducken: false, rollen: false, gleiten: false });
figur.position.set(motor.zustand.pos.x, motor.zustand.pos.y, motor.zustand.pos.z);
```

Genutzt von: – · Tags: figur, bewegung, physik, controller, sprung, schwimmen, rolle, dash, gleiten, gameplay · THREE: nein
Absicht (alle Felder optional): { x, z, sprint, springen (gehalten), ducken, blickYaw,
rollen (gehalten; Flanke = Ausweichrolle am Boden / Dash in der Luft), gleiten (gehalten, langsames Fallen),
tauchen (gehalten, im Wasser abtauchen), schleichen (= ducken), kantenSchutz (wie Tuning, nur diesen Frame) }
Zusätzliche Zustandsfelder (1.1.0): rollt, dash, rollAnteil (0…1 Fortschritt), abklingzeit (s bis Rolle/Dash wieder geht),
gleitet, doppelSprung (true im Frame des Luftsprungs), sprungZahl (Sprünge seit Bodenkontakt), taucht, tauchTiefe (m),
schleicht, anKante (Kantenschutz hat gebremst), betaeubt (Rest-s nach Stoß), getroffen (true im ersten Frame nach stoss()).

### character-sinne · `engine/gameplay/character-sinne.js` · v1.0.0 · entwurf
NPC-Wahrnehmung ohne THREE: Sichtkegel (Winkel, Reichweite, Rundum-Nahbereich), Hören (Radius × Lautstärke), Sichtlinie über welt.bodenHoehe, Gedächtnis mit Verdacht und Vergessen

- `createSinne({welt,sichtWeite,sichtWinkelGrad,nahRadius,hoerRadius,augenHoehe,zielHoehe,vergessenNach,entdeckZeit,sichtlinie}) -> {update(dt,selbst,ziele)->{gesehen,gehoert},siehtPunkt(selbst,p,faktor?),hoertPunkt(pos,quelle,laut?),sichtFrei(von,nach),geraeusch(x,z,laut?,id?),erinnerung(id),bekannte(),naechste(filter?),vergiss(id?),einstellungen,dispose()}`
- `imSichtkegel(pos,yaw,p,weite,winkelRad,nahRadius) -> bool`

```js
import { createSinne } from '../../engine/gameplay/character-sinne.js';
const sinne = createSinne({ welt, sichtWeite: 12, sichtWinkelGrad: 110, entdeckZeit: 0.8 });
sinne.update(dt, motor.zustand, [{ id: 'spieler', x, y, z, laut: spielerRennt ? 1 : 0, versteckt: duckt ? 0.5 : 0 }]);
const e = sinne.erinnerung('spieler'); if (e?.entdeckt) hirn.gehZu(e.x, e.z);
```

Genutzt von: – · Tags: npc, ki, wahrnehmung, sicht, hoeren, gedaechtnis, schleichen, gameplay · THREE: nein
selbst = Motor-Zustand ({ pos: {x,y,z}, yaw }) oder { x, y, z, yaw }.
Ziel = { id, x, y?, z, laut? (0…1, × hoerRadius), versteckt? (0…1, verkürzt die Sichtweite bis zur Hälfte), feind? … (wird durchgereicht) }.
Erinnerung = { id, x, y, z, alter (s seit letzter Wahrnehmung), art ('gesehen'|'gehoert'), sichtbar, verdacht (0…1), entdeckt, ziel }.

### character-steering-extra · `engine/gameplay/character-steering-extra.js` · v1.0.0 · entwurf
Reine Steering-Rechnungen: Patrouillen-Fortschritt (Schleife/Pingpong/einmal), Umkreisen, Abstand halten, Versteckpunkt hinter Deckung

- `patrouilleWeiter(anzahl,index,richtung,art) -> {index,richtung,fertig}`
- `umkreisRichtung(pos,mitte,radius,drehsinn,out?) -> {x,z,dist}`
- `abstandRichtung(pos,ziel,min,max,out?) -> {x,z,dist,stark}`
- `versteckPunkt(pos,bedrohung,verstecke,abstand,out?) -> {x,z}|null`
- `yawZu(von,nach) -> yaw`

```js
import { umkreisRichtung } from '../../engine/gameplay/character-steering-extra.js';
const r = umkreisRichtung(npc.pos, spieler.pos, 3, 1);
absicht.x = r.x * 0.6; absicht.z = r.z * 0.6;
```

Genutzt von: – · Tags: npc, ki, steering, patrouille, kampf, verstecken, gameplay · THREE: nein

### character-steering · `engine/gameplay/character-steering.js` · v1.1.0 · entwurf
NPC-Bewegungs-Gehirn: liefert dieselbe Absicht wie die Eingabe – Ziel/Ankommen, Wandern, Folgen, Fliehen, Pfad, Patrouille, Umkreisen, Abstand halten, Verstecken, Schwarm, Ausweichen, Steckenbleiben auflösen

- `createSteering({seed,ankunftsRadius,bremsRadius,wanderRadius,heimat,tempo,radius,gruppe}) -> {modus,ziel,angekommen,steckt,wartet,punktIndex,setModus(name,daten),gehZu(x,z,{rennen}),folge(getPos,abstand),fliehe(getPos,sicherAbstand),wandere(heimat,radius),folgePfad(punkte,{schleife}),patrouille(punkte,{art,warten,rennen}),umkreise(getPos,radius,{drehsinn,wechsel}),halteAbstand(getPos,min,max),verstecke(getPos,verstecke,{abstand}),schwarm(heimat,radius),setGruppe(gruppe),stehe(),update(dt,zustand,nachbarn?)->absicht,dispose()}`
- `richtungZu(von,nach,out?) -> {x,z,dist}`
- `ankunftsStaerke(dist,bremsRadius) -> 0…1`

```js
import { createSteering } from '../../engine/gameplay/character-steering.js';
const hirn = createSteering({ seed: 7, heimat: { x: 0, z: 0 } });
hirn.patrouille([{ x: 0, z: 0, warten: 2 }, { x: 8, z: 0 }], { art: 'pingpong' });
motor.update(dt, hirn.update(dt, motor.zustand, nachbarn)); // nachbarn: [{x,z,radius?,vx?,vz?}]
```

Genutzt von: figuren-labor · Tags: npc, ki, steering, bewegung, wandern, pfad, patrouille, kampf, schwarm, gameplay · THREE: nein
Absicht: { x, z, sprint, springen (Puls beim Steckenbleiben), ducken, blickYaw (beim Umkreisen/Abstand/Wartepunkt) }.
Steckenbleiben eskaliert: seitlich ausweichen → andere Seite + Hüpfer → Wanderziel/Wegpunkt überspringen bzw. `steckt = true`.

### character · `engine/gameplay/character.js` · v1.1.0 · entwurf
Fertige Spielfigur in einem Objekt: Modell (Look) + Animator + Bewegungs-Motor, für Spieler und NPCs gleich

- `createCharacter(opts) -> { root, model, animator, motor, zustand, look, name, schild, brain, update(dt,absicht?,brainKontext?), setBrain(brain|opts|null), spiele(name,opts), stoppe(name?), aktion(name,opts), sage(text,{dauer,geste,ausdruck}), setName(t), setLeben(anteil|null), ausruesten(sockel,obj), ablegen(sockel|obj), ausruestung, setAusdruck(name|null,opts), treffer(richtung,staerke,opts), umfallen(richtung,opts), aufstehen(dauer), blickZu(punkt|figur|fn|null), setSichtbar(bool), abstandZu(punkt|figur), setLook(teil), teleport(pos,yaw?), stoss(x,y,z,opts?), dispose() }`

```js
import { createCharacter } from '../../engine/gameplay/character.js';
const held = createCharacter({ look: VORLAGEN.wanderer, welt, pos: { x: 0, y: 0, z: 0 } });
szene.add(held.root);
held.update(dt, absicht);   // absicht aus move-input (zuAbsicht) oder character-steering; Zusatz-Flags (rollen …) gehen durch
// Mit Namensschild/Sprechblase (engine/ui/figur-schild.js):
const bauer = createCharacter({ look, welt, name: 'Jupp', schilder });
bauer.sage('Moin!', { geste: 'winken' }); bauer.blickZu(held); bauer.ausruesten('handR', mistgabel);
```

Genutzt von: figuren-labor, testwelt · Tags: figur, charakter, spieler, npc, bewegung, animation, controller, avatar · THREE: nein

### move-input · `engine/input/move-input.js` · v1.1.0 · entwurf
Bewegungs-Eingabe für Figuren: Tastatur (WASD/Pfeile), Maus-Ziehen/Mausrad, Touch-Stick + Knöpfe, Gamepad → Stick, Kamera-Delta, Aktionen (Flanke/gehalten)

- `createMoveInput(opts) -> { lesen(dt?) -> { x, y, sprint, springen, ducken, <aktion>: bool …, kameraX, kameraY, zoom, aktiv }, gedrueckt(name), gehalten(name), aktionen, belegung, setBelegung(teil), lerneTaste(name) -> Promise<code|null>, setAktiv(bool), zeigeTouch(bool), zeigeKnopf(name, bool), dispose() }`
- `stickZuWelt(x, y, kameraYaw) -> {x, z}`
- `zuAbsicht(e, kameraYaw, out?) -> Absicht`
- `tastenText(code)`
- `STANDARD_AKTIONEN`
- `ERWEITERTE_AKTIONEN`
- `STANDARD_BELEGUNG`

```js
import { createMoveInput, stickZuWelt } from '../../engine/input/move-input.js';
const ein = createMoveInput({ element: renderer.domElement, aktionen: [{ name: 'angriff', tasten: ['KeyF'], knopf: '⚔', padKnopf: 2 }] });
const e = ein.lesen();                       // einmal pro Frame
kamera.drehen(e.kameraX, e.kameraY); kamera.zoomen(e.zoom);
const r = stickZuWelt(e.x, e.y, kamera.blickYaw());
motor.update(dt, { x: r.x, z: r.z, sprint: e.sprint, springen: e.springen, ducken: e.ducken });
if (ein.gedrueckt('angriff')) figur.schlagen();
// Neue Aktionen per Name (rollen, gleiten, tauchen, aktion1, aktion2, interagieren, ziel) + eigene Tastenbelegung (z. B. aus dem Spielstand):
const ein2 = createMoveInput({ aktionen: ['rollen', 'interagieren'], belegung: { tasten: { vor: ['KeyZ'] } }, vibration: true });
figur.update(dt, zuAbsicht(ein2.lesen(), kamera.blickYaw()));   // alle Aktions-Flags (rollen …) gehen mit zum Motor
```

Genutzt von: figuren-labor, testwelt · Tags: eingabe, tastatur, maus, touch, gamepad, joystick, figur, steuerung · THREE: nein

### touch-stick · `engine/input/touch-stick.js` · v1.1.0 · entwurf
Touch-Steuerung fürs Handy: dynamischer virtueller Joystick (linke Hälfte), Kamera-Wischen + Pinch-Zoom (rechte Hälfte), runde Aktionsknöpfe unten rechts

- `createTouchStick(opts) -> { stick {x, y, an}, sprint, nimmKamera() -> {dx, dy, zoom}, benutzt, stickRadius, zeigen(bool), knopfZeigen(name, bool), reset(), dispose() }`
- `istTouchGeraet() -> bool`
- `autoStickRadius(breite, hoehe) -> px`

```js
import { createTouchStick } from '../../engine/input/touch-stick.js';
const t = createTouchStick({ element: canvas, knoepfe: [{ name: 'springen', knopf: '⤒' }],
beiKnopf: (name, unten) => console.log(name, unten), beiErstemTouch: () => t.zeigen(true) });
const { dx, dy, zoom } = t.nimmKamera();   // Pixel bzw. ln(Abstandsverhältnis) seit dem letzten Aufruf
```

Genutzt von: – · Tags: eingabe, touch, joystick, handy, knoepfe, pinch, zoom · THREE: nein

### character-anim-blick · `engine/models/character/character-anim-blick.js` · v1.0.0 · entwurf
Blick einer Figur (rein): Richtung oder Weltpunkt → verteilt auf Torso/Hals/Kopf mit Grenzen, Augen eilen voraus; Blinzeln per Seed; Werte für einen Mimik-Hook

- `createBlick({seed,augenGrenze,kopfGrenze}) -> { zu(dirLokal|null), zuPunkt(welt|null), update(dt,{idleW,umsehYaw,umsehNick,zustand,augenHoehe}) , anwenden(pose,gewicht), yaw, nick, augenYaw, augenNick, lid, blinzeln(), dispose() }`

```js
import { createBlick } from '../../engine/models/character/character-anim-blick.js';
const blick = createBlick({ seed: 3 });
blick.zuPunkt({ x: 4, y: 1.6, z: 2 });                         // Weltpunkt (braucht zustand.pos/yaw im update)
blick.update(dt, { zustand: motor.zustand, augenHoehe: 1.6 }); blick.anwenden(pose);
```

Genutzt von: – · Tags: figur, charakter, animation, blick, kopf, augen, blinzeln, mimik · THREE: nein

### character-anim-hang · `engine/models/character/character-anim-hang.js` · v1.0.0 · entwurf
Hang-Anpassung (rein): Steigung im Figur-Raum aus Motor-Zustand/Normale/bodenHoehe messen und Fußziele, Hüfthöhe, Fußneigung und Rumpf-Vorlage daran anpassen

- `hangMessen(zustand,bodenHoehe?,out?) -> {vor,seit}`
- `hangAnpassen(masse,ziele,vor,seit,gewicht) -> {lehne}`

```js
import { hangMessen, hangAnpassen } from '../../engine/models/character/character-anim-hang.js';
const h = hangMessen(motor.zustand, welt.bodenHoehe);       // Steigung vorwärts/seitwärts (dh/ds)
fussZiele(masse, g, ziele); const { lehne } = hangAnpassen(masse, ziele, h.vor, h.seit, 1);
```

Genutzt von: – · Tags: figur, charakter, animation, hang, gelaende, ik, fuesse · THREE: nein

### character-anim-idle · `engine/models/character/character-anim-idle.js` · v1.0.0 · entwurf
Idle-Variationen (rein): nach längerer Ruhe deterministisch (Seed) eine Idle-Variante (strecken, gähnen, umschauen, kratzen …) als eigene Schicht einblenden, bei Bewegung sofort weich abbrechen

- `idleLeben(st,r,dt) (Gewicht wechseln + Umsehen, st: gewicht/gewichtZiel/gewichtUhr/umsehUhr/umsehYaw/umsehNick/idleW)`
- `createIdleSchicht({seed,nach:[min,max],varianten}) -> { update(dt,ruhig) -> gewicht, pose, clip, name, ruheZeit, starte(name), abbrechen(), dispose() }`

```js
import { createIdleSchicht } from '../../engine/models/character/character-anim-idle.js';
const idle = createIdleSchicht({ seed: 5, nach: [8, 16] });
const w = idle.update(dt, stehtStill);
if (w > 0) mischePose(pose, idle.pose, w, pose, clipMaske(idle.clip));
```

Genutzt von: – · Tags: figur, charakter, animation, idle, ruhe, variation, npc · THREE: nein

### character-anim-zustand · `engine/models/character/character-anim-zustand.js` · v1.0.0 · entwurf
Posen für Sonder-Zustände des Motors (rein): Rolle (rollAnteil), Luft-Dash, Salto beim Doppelsprung, Gleiten, Arme rudern an der Kante, Betäubt-Taumeln

- `createZustandsSchicht() -> { update(dt,zustand,skal), anwenden(pose) -> pose, ausdruck, rolleW, saltoW, dispose() }`

```js
import { createZustandsSchicht } from '../../engine/models/character/character-anim-zustand.js';
const zs = createZustandsSchicht();
zs.update(dt, motor.zustand, masse.hueftHoehe / 0.89); zs.anwenden(pose);   // nach allen anderen Schichten
```

Genutzt von: – · Tags: figur, charakter, animation, rolle, dash, salto, gleiten, kante, betaeubt, motor · THREE: nein

### character-animator · `engine/models/character/character-animator.js` · v1.1.0 · entwurf
Prozedurale Figuren-Animation aus dem Motor-Zustand: idle/gehen/laufen/sprinten ohne Fußrutschen, Luft, Landung, Schwimmen, Ducken, Rutschen, Kurvenlage, Atmen, Hang, Idle-Varianten, sekundäre Bewegung, Treffer/Umfallen, Aktions-Clips mit Masken, Blick + Mimik-Hook

- `createAnimator(model,opts) -> { update(dt,zustand) -> pose, spiele(name,{tempo,mischung,schleife}) -> {dauer,trefferBei}, stoppe(name?), aktion, aktionGewicht, blickZu(dirLokal|null), blickZuPunkt(welt|null), treffer(richtung,staerke,{welt}), umfallen(richtung,{staerke,welt}), aufstehen(dauer), ausdruck, mimik, idleVariante, faellt, liegt, sekundaer, hang, gewicht, griff, pose, phase, dispose() }`
- `createCharacterAnimator = createAnimator`

```js
import { createAnimator } from '../../engine/models/character/character-animator.js';
const anim = createAnimator({ rig, masse }, { seed: 7, onSchritt: (fuss, st) => schrittGeraeusch(st) });
anim.update(dt, motor.zustand);                  // NPC: anim.update(dt, { tempo: 1.4 })
const { trefferBei } = anim.spiele('schlagen');  // Schaden nach trefferBei Sekunden
anim.treffer({ x: 0, z: -1 }, 0.7);              // Stoß von vorn (Figur-Raum), klingt von selbst ab
anim.blickZuPunkt(spieler.zustand.pos);           // Kopf + Augen folgen (braucht zustand.pos/yaw)
```

Genutzt von: – · Tags: figur, charakter, animation, gang, laufen, schwimmen, springen, aktion, clip, npc, spieler · THREE: nein

### character-ausruestung · `engine/models/character/character-ausruestung.js` · v1.0.0 · entwurf
Low-Poly-Gegenstände für Figuren-Sockel (Schwert, Dolch, Axt, Hammer, Hacke, Schaufel, Speer, Stab, Zauberstab, Schild, Bogen, Fackel, Laterne, Korb, Becher, Buch): je ein Mesh + optional Leucht-Mesh, passend ausgerichtet für model.befestigen(sockel, obj)

- `AUSRUESTUNG`
- `ausruestungsNamen`
- `createAusruestung(name, opts) -> THREE.Group (+ dispose())`
- `baueAusruestung(b, name, farben, glut?) -> b`
- `ausruestungAusrichten(obj, sockel) -> obj`

```js
import { createAusruestung } from '../../engine/models/character/character-ausruestung.js';
const schwert = createAusruestung('schwert', { seed: 3 });
figur.befestigen('handR', schwert);
figur.befestigen('handL', createAusruestung('schild', { sockel: 'handL', farbe: '#2a4a8a' }));
const fackel = createAusruestung('fackel'); licht.position.copy(fackel.userData.lichtPunkt); fackel.add(licht);
```

Genutzt von: figuren-labor · Tags: figur, charakter, ausrüstung, waffe, werkzeug, schwert, axt, schild, bogen, fackel, laterne, korb, sockel · THREE: ja
Gegenstand-Raum: Griffpunkt im Ursprung, Längsachse +Y, „vorn“ (Schneide, Schildfläche, Bogenbauch) +Z.
Ausrichtung je Sockel (Hand-Raum: Arm hängt nach −Y, Daumen +Z):
halt 'vorn' (Waffen, Werkzeug): +Y → +Z der Hand (Arm hängt: zeigt nach vorn; Arm vorgestreckt: zeigt nach oben)
halt 'schraeg' (Fackel): schräg nach vorn-oben · 'aufrecht' (Stab, Speer): senkrecht, vor die Faust versetzt
halt 'seite' (Schild): Fläche nach außen (handL → +X, handR → −X) · 'haengend' (Laterne, Korb, Becher): hängt nach −Y
ruecken/umhang: schräg über den Rücken (Griff oben) · guertel: an der linken Hüfte, Spitze nach unten · kopf: unverändert

### character-clips-mehr · `engine/models/character/character-clips-mehr.js` · v1.0.0 · entwurf
Weitere Aktions-Clips als reine Keyframe-Daten (Emotes, Kampf, Arbeit, Ruhe, Idle-Varianten); wird von character-clips registriert

- `MEHR_CLIPS`
- `IDLE_VARIANTEN`

```js
import { CLIPS } from '../../engine/models/character/character-clips.js';   // registriert MEHR_CLIPS automatisch
anim.spiele('verbeugen'); anim.spiele('fegen', { schleife: true }); anim.spiele('tragen');  // Dauer-Aktion bis stoppe()
```

Genutzt von: – · Tags: figur, charakter, animation, clip, keyframe, emote, kampf, arbeit, idle · THREE: nein

### character-clips · `engine/models/character/character-clips.js` · v1.1.0 · entwurf
Aktions-Clips einer Figur als Keyframe-Daten (winken, schlagen, hacken, werfen, aufheben, tod, rolle, sitzen, tanzen … + character-clips-mehr) und ihr Abtaster

- `CLIPS`
- `CLIP_NAMEN`
- `IDLE_VARIANTEN`
- `clipPose(name,t,out) -> pose`
- `clipZeit(clip,t,schleife?) -> t`
- `registriereClip(name,def) -> clip`
- `clipMaske(clip) -> kanalliste`

```js
import { CLIPS, clipPose, registriereClip } from '../../engine/models/character/character-clips.js';
const p = clipPose('schlagen', CLIPS.schlagen.trefferBei);   // Pose im Treffer-Moment
registriereClip('verbeugen', { dauer: 1.2, maske: 'ganz', fuesseFest: true,
keys: [{ t: 0, pose: {} }, { t: 0.5, pose: { torso: [1.0, 0, 0] } }, { t: 1.2, pose: {} }] });
```

Genutzt von: figuren-labor · Tags: figur, charakter, animation, clip, keyframe, aktion, angriff, emote · THREE: nein

### character-gang · `engine/models/character/character-gang.js` · v1.1.0 · entwurf
Fortbewegungs-Posen einer Figur (rein): Fußziele aus Gangphase (gehen/laufen/sprinten ohne Fußrutschen), Bein-IK, Rumpf/Arme, Luft- und Schwimm-Pose

- `schrittWeite(masse,tempo,opts) -> m`
- `stuetzAnteil(laufW,sprintW) -> 0…1`
- `fussZiele(masse,g,ziele) -> ziele`
- `loeseBein(masse,pose,seite,ziel{x,y,z,neig,roll?})`
- `naechsteRuhePhase(phase,laufW,sprintW) -> phase`
- `loeseBeine(masse,pose,ziele) -> pose`
- `gangPose(masse,g,ziele,out) -> pose`
- `luftPose(steigen,out) -> pose`
- `schwimmPose(masse,phase,zug,eintauchen,out) -> pose`

```js
import { fussZiele, gangPose } from '../../engine/models/character/character-gang.js';
const g = { phase, tempo: 1.8, laufW: 0, sprintW: 0, idleW: 0, duckW: 0, rutschW: 0 };
gangPose(masse, g, fussZiele(masse, g, ziele), pose);   // meist über character-animator benutzt
```

Genutzt von: – · Tags: figur, charakter, animation, gang, laufen, ik, fuesse, schwimmen · THREE: nein

### character-look · `engine/models/character/character-look.js` · v1.1.0 · entwurf
Aussehen einer Figur als reine Daten: Körperbau, Haut, Haar, Bart, Kleidung, Kopfbedeckung, Accessoires (Brille, Schal, Schmuck), Grund-Mimik; Vorlagen, Zufalls-Looks per Seed, abgeleitete Körpermaße

- `LOOK_STANDARD`
- `STILE`
- `TEIL_NAMEN`
- `AUSDRUECKE`
- `VORLAGEN`
- `createLook(teil) -> look`
- `randomLook(seed,opts) -> look`
- `koerperMasse(look) -> masse`
- `farbeZahl(farbe) -> int`

```js
import { createLook, randomLook, koerperMasse, VORLAGEN } from '../../engine/models/character/character-look.js';
const held = createLook({ ...VORLAGEN.wanderer, haar: { farbe: '#c8a040' }, brille: { stil: 'rund' } });
const npc = randomLook(hashSeed('dorf', 7));   // gleicher Seed → gleicher Look
```

Genutzt von: figuren-labor, testwelt · Tags: figur, charakter, aussehen, look, spieler, npc, avatar, editor, speichern, accessoires, mimik · THREE: nein
1.1: neue Stile (Haar, Bart, Oberteil, Hose, Schuhe, Kopfbedeckung, Umhang), neue Teile brille/schal/schmuck,
   Körper schultern/muskeln, Feld ausdruck (Grund-Mimik), neue Vorlagen. Alte Spielstände bleiben gültig
   (fehlende Felder → Standard; erste Einträge in STILE und Körper-Standards unverändert).

### character-model · `engine/models/character/character-model.js` · v1.1.0 · entwurf
Look → fertige Figur: Rig (Gelenk-Gruppen) + Low-Poly-Meshes je Knochen; Look live wechseln, Gegenstände an Sockeln befestigen

- `createCharacterModel({ look, seed, material, schatten, mimik }) -> { root, rig, look, masse, meshes, gesicht, ausdruck, setLook(teilOderLook), befestigen(sockel,obj), loesen(sockelOderObj), setSichtbar(bool), setAusdruck(name), setLider(zu), blinzeln(dauer), setBlick(x,y), setAugen(yaw,nick,lid), updateGesicht(dt), dispose() }`

```js
import { createCharacterModel } from '../../engine/models/character/character-model.js';
const figur = createCharacterModel({ look: VORLAGEN.ritter, seed: 4 });
szene.add(figur.root);
figur.befestigen('handR', schwert);
figur.setLook({ kopfbedeckung: { stil: 'krone' } });   // Rig-Gruppen & Befestigtes bleiben erhalten
```

Genutzt von: – · Tags: figur, charakter, modell, mesh, spieler, npc, avatar, editor, ausrüstung, mimik, gesicht · THREE: ja
Gesicht/Mimik (1.1, additiv; mit opts.mimik = false festes Gesicht wie 1.0, ohne die Funktionen zu brechen – sie tun dann nichts):
setAusdruck(name)  name aus AUSDRUECKE (character-look), z. B. 'neutral' 'froh' 'freundlich' 'freude' 'wuetend' 'traurig'
                   'ueberrascht' 'erschrocken' 'schlafend' 'muede' 'gaehnen' 'schmerz' 'benommen' 'bewusstlos' 'tot' 'stolz'
                   'entschlossen' 'konzentriert' 'skeptisch' 'nachdenklich'; Unbekanntes → 'neutral'
                   (Start: look.ausdruck; bleibt bei setLook erhalten, außer der Teil-Look setzt ausdruck)
ausdruck           aktueller Ausdruck (nur lesen)
setLider(zu)       0 = Lider wie Ausdruck … 1 = geschlossen (müde, zwinkern; additiv zum Blinzeln)
blinzeln(dauer)    einmal blinzeln (Standard 0,16 s; schaltet das automatische Blinzeln ab – der Aufrufer steuert dann)
setBlick(x, y)     Pupillen −1…1 (x + = zur linken Seite der Figur/+X, y + = hoch)
setAugen(yaw, nick, lid)  für den Animator: Blick in rad (±0,5 Anschlag; yaw + = +X, nick + = nach unten), lid 0…1 = Lidschluss
updateGesicht(dt)  pro Frame aufrufen (nötig, damit Blinzeln abläuft): Blinzel-Animation + automatisches Blinzeln alle 2–6 s (seed-deterministisch)
gesicht            das Objekt aus createGesicht (oder null), z. B. gesicht.autoBlinzeln = false

### character-parts-basis · `engine/models/character/character-parts-basis.js` · v1.0.0 · entwurf
Gemeinsame Helfer der Figuren-Bau-Funktionen: Farben mischen/abdunkeln, Kugel- und Zylinder-Ausschnitte in einen mesh-builder

- `farbeMisch(a,b,t) -> int`
- `dunkler(c,t) -> int`
- `heller(c,t) -> int`
- `GOLD`
- `LEDER`
- `schale(b,r,farbe,t,opts)`
- `mantelFlaeche(b,rO,rU,h,farbe,t,opts)`

```js
import { farbeMisch, schale } from '../../engine/models/character/character-parts-basis.js';
schale(b, 0.2, 0x804020, { y: 0.2 }, { thL: Math.PI / 2 });   // Halbkugel-Kappe
```

Genutzt von: – · Tags: figur, charakter, farbe, mesh, hilfen · THREE: ja

### character-parts-becken · `engine/models/character/character-parts-becken.js` · v1.0.0 · entwurf
Bau-Funktion für das Figuren-Becken (Knochen becken): Hüfte, Gürtel, Gürteltasche, Kittelsaum, Rock, Mantelschöße, Schürze, Lederstreifen

- `baueBecken(b,ctx) -> b`

```js
import { baueBecken } from '../../engine/models/character/character-parts-becken.js';
rig.knochen.becken.add(baueBecken(createMeshBuilder({ seed }), teilKontext(look, masse)).mesh());
```

Genutzt von: – · Tags: figur, charakter, kleidung, rock, gürtel, tasche, mantel, schürze · THREE: ja

### character-parts-gesicht · `engine/models/character/character-parts-gesicht.js` · v1.0.0 · entwurf
Bewegliches Figuren-Gesicht im Knochen kopf: Iris/Pupillen (Blick), Lider (Blinzeln, Öffnung), Brauen + Mund je Gesichtsausdruck – nur 3 kleine Meshes

- `AUSDRUCK_DATEN`
- `createGesicht(ctx, { seed, material, schatten }) -> { gruppe, meshes, ausdruck, autoBlinzeln, setAusdruck(name), setLider(zu), blinzeln(dauer), setBlick(x,y), setAugen(yaw,nick,lid), update(dt), dispose() }`

```js
import { createGesicht } from '../../engine/models/character/character-parts-gesicht.js';
const g = createGesicht(teilKontext(look, masse, { mimik: true }), { seed: 3 });
rig.knochen.kopf.add(g.gruppe);
g.setAusdruck('froh'); g.setBlick(0.5, 0);   // pro Frame: g.update(dt) → automatisches Blinzeln
```

Genutzt von: – · Tags: figur, charakter, gesicht, mimik, augen, blinzeln, ausdruck, emotion, blick · THREE: ja
Normalerweise über character-model benutzt (model.setAusdruck usw.). Der Kopf selbst muss mit ctx.mimik = true gebaut
sein (nur Augäpfel), sonst liegen festes und bewegliches Gesicht übereinander.
Lider: zu = 0 offen … 1 geschlossen. Effektive Öffnung = Ausdruck.offen · (1 − max(setLider, Blinzeln)).

### character-parts-haar · `engine/models/character/character-parts-haar.js` · v1.0.0 · entwurf
Bau-Funktionen für Frisuren und Bärte im Knochen kopf (Kopfkugel um y = R, Gesicht nach +Z); beachtet Kopfbedeckungen

- `baueFrisur(b,ctx) -> b`
- `baueBart(b,ctx) -> b`

```js
import { baueFrisur, baueBart } from '../../engine/models/character/character-parts-haar.js';
baueBart(baueFrisur(b, ctx), ctx);
```

Genutzt von: – · Tags: figur, charakter, kopf, haar, frisur, bart, locken, zopf · THREE: ja

### character-parts-hut · `engine/models/character/character-parts-hut.js` · v1.0.0 · entwurf
Bau-Funktion für Kopfbedeckungen im Knochen kopf (eigenes Mesh): Kapuze, Hüte, Helme, Kronen, Tücher, Turban

- `baueKopfbedeckung(b,ctx) -> b`
- `deckendeKopfbedeckung(stil) -> bool`

```js
import { baueKopfbedeckung } from '../../engine/models/character/character-parts-hut.js';
rig.knochen.kopf.add(baueKopfbedeckung(createMeshBuilder({ seed }), ctx).mesh());
```

Genutzt von: – · Tags: figur, charakter, kopf, hut, helm, krone, kapuze, zauberhut, dreispitz, turban · THREE: ja

### character-parts-kopf · `engine/models/character/character-parts-kopf.js` · v1.1.0 · entwurf
Bau-Funktion für den Figuren-Kopf: Kopfform, Ohren, Nase, festes Gesicht (oder nur Augäpfel, wenn das bewegliche Gesicht aktiv ist), Frisur, Bart, Brille, Ohrringe; bündelt Kopfbedeckungen

- `baueKopf(b,ctx) -> b`
- `baueKopfbedeckung(b,ctx) -> b`
- `deckendeKopfbedeckung(stil) -> bool`
- `AUGE -> { x, y, z, r, sz } (Augen-Lage in Einheiten von R)`

```js
import { baueKopf, baueKopfbedeckung } from '../../engine/models/character/character-parts-kopf.js';
const ctx = teilKontext(look, masse);
rig.knochen.kopf.add(baueKopf(createMeshBuilder({ seed }), ctx).mesh());
```

Genutzt von: – · Tags: figur, charakter, kopf, gesicht, haar, frisur, bart, hut, helm, krone, brille · THREE: ja
1.1: Frisuren/Bärte → character-parts-haar, Kopfbedeckungen → character-parts-hut (hier weiter exportiert);
   Brille + Ohrringe; ctx.mimik = true → nur Augäpfel (Iris, Lider, Brauen, Mund baut character-parts-gesicht).

### character-parts-ruecken · `engine/models/character/character-parts-ruecken.js` · v1.0.0 · entwurf
Bau-Funktionen für Rücken-Teile einer Figur: Umhang (kurz, lang, Kragen-Cape) am Sockel umhang, Rucksack am Sockel ruecken

- `baueUmhang(b,ctx) -> b`
- `baueRucksack(b,ctx) -> b`

```js
import { baueUmhang } from '../../engine/models/character/character-parts-ruecken.js';
rig.sockel.umhang.add(baueUmhang(createMeshBuilder({ seed }), teilKontext(look, masse)).mesh());
```

Genutzt von: – · Tags: figur, charakter, umhang, cape, rucksack · THREE: ja

### character-parts-torso · `engine/models/character/character-parts-torso.js` · v1.0.0 · entwurf
Bau-Funktion für den Figuren-Oberkörper (Knochen torso) je Oberteil-Stil: Kittel, Hemd, Robe, Rüstung, Weste, Kleid, Mantel, Schürze, Kettenhemd, Lederrüstung

- `baueTorso(b,ctx) -> b`

```js
import { baueTorso } from '../../engine/models/character/character-parts-torso.js';
rig.knochen.torso.add(baueTorso(createMeshBuilder({ seed }), teilKontext(look, masse)).mesh());
```

Genutzt von: – · Tags: figur, charakter, kleidung, oberteil, rüstung, mantel, schürze · THREE: ja

### character-parts-zubehoer · `engine/models/character/character-parts-zubehoer.js` · v1.0.0 · entwurf
Bau-Funktionen für Accessoires: Schal/Halstuch/Pelzkragen und Halsschmuck (Knochen torso), Brille/Augenklappe/Monokel und Ohrringe (Knochen kopf)

- `baueZubehoer(b,ctx) -> b`
- `baueBrille(b,ctx) -> b`
- `baueOhrringe(b,ctx) -> b`
- `hatZubehoer(ctx) -> bool`

```js
import { baueZubehoer, hatZubehoer } from '../../engine/models/character/character-parts-zubehoer.js';
if (hatZubehoer(ctx)) rig.knochen.torso.add(baueZubehoer(createMeshBuilder({ seed }), ctx).mesh());
```

Genutzt von: – · Tags: figur, charakter, accessoire, schal, schmuck, kette, amulett, brille, augenklappe, monokel, ohrringe · THREE: ja

### character-parts · `engine/models/character/character-parts.js` · v1.1.0 · entwurf
Bau-Funktionen für Figuren-Körperteile je Knochen aus Look + Körpermaßen: Kontext, Hals, Arme, Hände, Beine, Füße; bündelt Torso, Becken, Umhang, Rucksack, Zubehör

- `teilKontext(look,masse,opts?) -> ctx`
- `baueTorso(b,ctx)`
- `baueHals(b,ctx)`
- `baueBecken(b,ctx)`
- `baueOberarm(b,ctx)`
- `baueUnterarm(b,ctx)`
- `baueHand(b,ctx)`
- `baueOberschenkel(b,ctx)`
- `baueUnterschenkel(b,ctx)`
- `baueFuss(b,ctx)`
- `baueUmhang(b,ctx)`
- `baueRucksack(b,ctx)`
- `baueZubehoer(b,ctx)`
- `farbeMisch(a,b,t) -> int`

```js
import { teilKontext, baueTorso } from '../../engine/models/character/character-parts.js';
const b = createMeshBuilder({ seed: 3 }), ctx = teilKontext(look, koerperMasse(look));
rig.knochen.torso.add(baueTorso(b, ctx).mesh());
```

Genutzt von: – · Tags: figur, charakter, kleidung, mesh, lowpoly, körper, umhang, rucksack, schuhe · THREE: ja
1.1: neue Stile (Mantel, Schürze, Kettenhemd, Lederrüstung, Pluderhose, Sandalen, Schnabelschuhe, Kragen-Umhang),
   Körper schultern/muskeln, Zubehör (Schal, Halsschmuck), ctx.mimik (Kopf ohne festes Gesicht für character-parts-gesicht).
   Torso/Becken/Umhang/Rucksack liegen jetzt in eigenen Dateien und werden hier weiter exportiert.

### character-pose · `engine/models/character/character-pose.js` · v1.1.0 · entwurf
Posen einer Figur als reine Daten: leere Pose, kopieren, mischen, addieren, maskieren (Ober-/Unterkörper, Arme) und aufs Rig anwenden

- `POSE_KNOCHEN`
- `GANZ`
- `OBERKOERPER`
- `UNTERKOERPER`
- `BEINE`
- `ARM_L`
- `ARM_R`
- `ARME`
- `KOPF`
- `RUMPF`
- `MASKEN`
- `maskeVon(name|liste) -> liste`
- `teilMaske(name) -> bool`
- `leerePose() -> pose`
- `kopierePose(a,out) -> out`
- `mischePose(a,b,t,out,maske) -> out`
- `addierePose(a,b,gewicht,out) -> out`
- `maskiere(pose,maske) -> pose`
- `skalierePose(pose,f,out) -> out`
- `wendeAn(rig,pose) -> rig`

```js
import { leerePose, mischePose, wendeAn, OBERKOERPER } from '../../engine/models/character/character-pose.js';
const p = leerePose();
mischePose(gangPose, schlagPose, 0.8, p, OBERKOERPER);   // nur Oberkörper überblenden
wendeAn(rig, p);
```

Genutzt von: – · Tags: figur, charakter, pose, animation, mischen, maske, rig · THREE: nein

### character-reaktion · `engine/models/character/character-reaktion.js` · v1.0.0 · entwurf
Prozedurale Treffer-Reaktion (rein): Stoß aus Richtung + Stärke als abklingende additive Pose; Umfallen als Ragdoll-Ersatz ohne Physik-Engine (Kippen, Aufprall, schlaffe Glieder)

- `createReaktion({seed,staerke}) -> { treffer(richtung,staerke), umfallen(richtung,{staerke}), aufstehen(dauer), update(dt) -> pose(additiv), anwenden(pose,gewicht), fallPose(out,skal) -> pose, pose, faellt, liegt, fallGewicht, aktiv, reset(), dispose() }`
- `richtungLokal(welt,yaw) -> {x,z}`

```js
import { createReaktion } from '../../engine/models/character/character-reaktion.js';
const re = createReaktion({ seed: 4 });
re.treffer({ x: 0, z: -1 }, 0.8);         // Stoß von vorn: Figur wird nach hinten (−Z) gedrückt
addierePose(pose, re.update(dt), 1, pose);
re.umfallen({ x: 0, z: -1 });              // nach hinten umkippen; mischePose(pose, re.fallPose(), re.fallGewicht, pose)
```

Genutzt von: – · Tags: figur, charakter, animation, treffer, reaktion, tod, ragdoll, umfallen, kampf · THREE: nein

### character-rig · `engine/models/character/character-rig.js` · v1.0.0 · entwurf
Prozedurales Skelett einer Menschen-Figur aus Gruppen (keine Skinning-Knochen): feste Gelenknamen, Ruhepose, Sockel für Hut/Waffe/Rucksack

- `KNOCHEN`
- `SOCKEL`
- `createRig(masse) -> { root, knochen, sockel, masse, anpassen(masse), ruhepose(), dispose() }`

```js
import { createRig } from '../../engine/models/character/character-rig.js';
const rig = createRig(koerperMasse(look));
rig.knochen.schulterR.rotation.x = -0.8;   // rechten Arm nach vorn heben
rig.sockel.handR.add(schwert);
```

Genutzt von: – · Tags: figur, charakter, skelett, rig, gelenke, animation, sockel · THREE: ja

### character-sekundaer · `engine/models/character/character-sekundaer.js` · v1.0.0 · entwurf
Sekundäre Bewegung (rein): Feder-Dämpfer für Kopf-Nachschwingen, Gewichtsverlagerung beim Anhalten/Anfahren, Umhang- und Haar-Winkel – additiv auf eine Pose

- `createFeder({steif,daempf,wert}) -> { wert, v, schritt(dt,ziel,kraft), stoss(dv), setze(w) }`
- `createSekundaer(opts) -> { update(dt,info) -> werte, anwenden(pose,gewicht) -> pose, werte, stoss(vor,seit,hoch), reset(), dispose() }`

```js
import { createSekundaer } from '../../engine/models/character/character-sekundaer.js';
const sek = createSekundaer({ staerke: 1 });
sek.update(dt, { tempo, beschl, quer: tempo * drehRate, vy, amBoden });
sek.anwenden(pose);                         // Torso/Hals/Kopf schwingen nach (Beine bleiben unberührt)
umhang.rotation.x = sek.werte.umhangX;      // Umhang/Haar-Teile selbst drehen
```

Genutzt von: – · Tags: figur, charakter, animation, feder, sekundaer, nachschwingen, umhang, haar, gewicht · THREE: nein

### mesh-builder · `engine/render/mesh-builder.js` · v1.1.0 · entwurf
Low-Poly-Modelle aus Primitiven (Box, Kugel, Zylinder …) mit Vertexfarben zu EINER Geometrie verschmelzen; Farbvariation pro Dreieck per Seed

- `createMeshBuilder(opts) -> builder (box, sphere, cyl, cone, ico, capsule, torus, lathe, add, geometry, mesh)`
- `standardMaterial(opts) -> MeshStandardMaterial`
- `tMatrix(t) -> Matrix4`

```js
import { createMeshBuilder } from '../../engine/render/mesh-builder.js';
const b = createMeshBuilder({ seed: 7 });
b.box(0.6, 0.4, 1.0, '#d9772b', { y: 0.5 }).sphere(0.25, 0xffffff, { y: 0.8, z: 0.5, sy: 0.8 }, 8, 6);
szene.add(b.mesh());   // THREE.Mesh mit standardMaterial()
```

Genutzt von: – · Tags: mesh, geometrie, lowpoly, vertexfarben, modell, primitive, merge · THREE: ja

### fake-dom · `engine/test/fake-dom.mjs` · v1.0.0 · stabil
Minimale Browser-Attrappe für Node-Tests: document, window, localStorage, requestAnimationFrame

- `installFakeDom(opts) -> { els, rafs, storage, tick(dt) }`
- `fakeElement() -> Element-Attrappe`

```js
import { installFakeDom } from '../test/fake-dom.mjs';
const dom = installFakeDom({ breite: 400, hoehe: 800 });
dom.tick(16); // führt alle angefragten Animation-Frames aus
```

Genutzt von: – · Tags: test, dom, node, attrappe · THREE: nein

### figur-schild · `engine/ui/figur-schild.js` · v1.0.0 · entwurf
Namensschild + Sprechblase + Lebensbalken über Figuren (DOM-Overlay): folgt dem Kopf, skaliert und blendet nach Abstand aus, verschwindet hinter der Kamera

- `createFigurSchilder(opts) -> { neu(ziel, {name, leben, farbe, versatz, nameAb}) -> schild, update(kamera, dt), anzahl, dispose() } — jedes Schild: { setName(t), sage(text, {dauer}) , schweige(), setLeben(anteil|null), setFarbe(css), zeige(bool), ziel, spricht, sichtbar, entfernen() }`

```js
import { createFigurSchilder } from '../../engine/ui/figur-schild.js';
const schilder = createFigurSchilder();
const s = schilder.neu(npc.model.rig.sockel.kopf, { name: 'Bauer Jupp', leben: 0.8 });   // Object3D, {x,y,z} oder Funktion
s.sage('Schönes Wetter heute!');
schilder.update(kamera, dt);   // jedes Bild nach der Kamera, vor/nach dem Rendern
```

Genutzt von: figuren-labor, testwelt · Tags: ui, namensschild, sprechblase, dialog, lebensbalken, hp, figur, npc, overlay, hud · THREE: ja

### scatter-mesh · `engine/world/scatter-mesh.js` · v1.0.0 · entwurf
Zeichnet die Objekte einer erzeugten Welt (welt.objekte: Bäume, Büsche, Felsen, Kakteen, Schilf, Blumen) als InstancedMesh je Typ mit einfachen Low-Poly-Formen; eigene Formen je Typ überschreibbar

- `createScatterMesh(adapter, opts) -> {gruppe,anzahl,typen,dispose}`
- `FORMEN`
- `baueForm(teile) -> BufferGeometry`

```js
import { createScatterMesh } from '../../engine/world/scatter-mesh.js';
const pflanzen = createScatterMesh(adapter, { schatten: true });
szene.add(pflanzen.gruppe);
```

Genutzt von: testwelt · Tags: welt, objekte, baeume, felsen, instanzen, vegetation, mesh · THREE: ja

### terrain-mesh · `engine/world/terrain-mesh.js` · v1.0.0 · entwurf
Baut aus einer erzeugten Welt (worldgen) und ihrem Welt-Adapter ein Three-Gelände: Boden mit Biomfarben, Hangfels und Farbrauschen, Seen/Flüsse auf ihrem Wasserspiegel und ein Meer bis zum Horizont

- `createTerrainMesh(adapter, opts) -> {gruppe,boden,wasser,meer,dispose}`
- `biomFarben(welt) -> Float32Array`

```js
import { createTerrainMesh } from '../../engine/world/terrain-mesh.js';
const gelaende = createTerrainMesh(adapter, { schritt: 1, schatten: true });
szene.add(gelaende.gruppe);
```

Genutzt von: testwelt · Tags: welt, terrain, gelaende, wasser, meer, mesh, biome · THREE: ja

### worldgen-adapter · `engine/world/worldgen/worldgen-adapter.js` · v1.0.0 · entwurf
Welt-Adapter für Figuren, Kamera und Spiele: macht aus einer erzeugten Welt (normierte Höhe, Gitter) eine Welt in Metern mit bodenHoehe, wasserHoehe und hindernisse (Baumstämme, Felsen) – passt zum Vertrag in docs/FIGUREN-SYSTEM.md

- `createWeltAdapter(welt, opts) -> {bodenHoehe,wasserHoehe,hindernisse,normale,biomBei,zuGitter,zuWelt,startPunkt,groesse,hoehenSkala,meterProZelle,dispose}`
- `HINDERNIS_RADIEN`

```js
import { createWeltAdapter } from '../../engine/world/worldgen/worldgen-adapter.js';
const adapter = createWeltAdapter(createWorld({ preset: 'insel', seed: 42 }), { hoehenSkala: 60, meterProZelle: 2 });
const s = adapter.startPunkt(); const y = adapter.bodenHoehe(s.x, s.z);
```

Genutzt von: testwelt · Tags: welt, worldgen, adapter, boden, wasser, kollision, figur · THREE: nein

### worldgen-biomes · `engine/world/worldgen/worldgen-biomes.js` · v1.0.0 · entwurf
Biome nach Whittaker (Temperatur × Feuchte, als schnelle Nachschlagetabelle) plus Prioritätsregeln (Wasser, Schnee, Fels, Strand, Sumpf); Biomliste per Spiel erweiterbar

- `STANDARD_BIOME`
- `erstelleBiomTabelle(biomOpts) -> {liste,idVon(key)}`
- `klassifiziere(tab,h,hang,temp,feuchte,wasserDist,meerDist,flags) -> id`
- `berechneHang(H,b,t,aus?) -> Float32Array`
- `stufeBiome(welt, opts) -> void`
- `biomId(welt,key) -> id`

```js
import { erstelleBiomTabelle } from '../../engine/world/worldgen/worldgen-biomes.js';
const tab = erstelleBiomTabelle({ extra: [{ key: 'pilzhain', name: 'Pilzhain', farbe: 0x8a5cc0, temp: [0.4, 0.6], feuchte: [0.8, 1] }] });
const id = tab.idVon('pilzhain');
```

Genutzt von: – · Tags: welt, worldgen, biome, klima, whittaker · THREE: nein

### worldgen-chunks · `engine/world/worldgen/worldgen-chunks.js` · v1.0.0 · entwurf
Unendlicher/gestreamter Modus: Höhe, Klima, Biome, Rauschflüsse und Objekte punktweise und pro Chunk – nahtlos über Chunkgrenzen (ohne globale Erosion/Hydrologie)

- `createChunkGenerator(optionen) -> {opts, sampleHeight(x,y)->number, samplePunkt(x,y,aus)->bool, generateChunk(cx,cy,groesse)->chunk, biome}`

```js
import { createChunkGenerator } from '../../engine/world/worldgen/worldgen-chunks.js';
const gen = createChunkGenerator({ preset: 'unendlich', seed: 5 });
const c = gen.generateChunk(3, -2, 64);   // c.hoehe hat (64+1)² Werte, Randzeilen identisch mit den Nachbarn
```

Genutzt von: – · Tags: welt, worldgen, chunks, unendlich, streaming, terrain · THREE: nein

### worldgen-climate · `engine/world/worldgen/worldgen-climate.js` · v1.0.0 · entwurf
Klima für den Weltgenerator: Temperatur nach Höhe/Breitengrad, Feuchte aus Wassernähe, Rauschen und Regenschatten (Windrichtung)

- `regenSchatten(H,ozean,b,t,windGrad,staerke) -> Float32Array`
- `boxBlur(arr,b,t,r,iter) -> arr`
- `stufeKlima(welt, opts) -> void`

```js
import { stufeKlima } from '../../engine/world/worldgen/worldgen-climate.js';
stufeKlima(welt, { seed: 1, klima: { wind: 270, regenschatten: 1 } });
const warm = welt.temperatur[i] > 0.7, nass = welt.feuchte[i] > 0.6;
```

Genutzt von: – · Tags: welt, worldgen, klima, temperatur, feuchte, regen · THREE: nein

### worldgen-erosion · `engine/world/worldgen/worldgen-erosion.js` · v1.0.0 · entwurf
Schnelle hydraulische Tropfen-Erosion (mit Pinsel-Abtrag) und thermische Erosion auf einem Float32-Höhenfeld; Qualitätsstufen schnell/normal/hoch

- `erodiereHydraulisch(H,b,t,p) -> void`
- `erodiereThermisch(H,b,t,iterationen,talus,rate) -> void`
- `stufeErosion(welt, opts) -> void`
- `QUALITAET`

```js
import { erodiereHydraulisch } from '../../engine/world/worldgen/worldgen-erosion.js';
erodiereHydraulisch(hoehe, 256, 256, { tropfen: 40000, seed: 3 });
```

Genutzt von: – · Tags: welt, worldgen, erosion, terrain, hydraulik · THREE: nein

### worldgen-grid · `engine/world/worldgen/worldgen-grid.js` · v1.0.0 · entwurf
Gitter-Helfer für den Weltgenerator: typisierter Min-Heap, Chamfer-Abstand, Regionen-Markierung, bilineares Abtasten, Array-Hash

- `createMinHeap(kapazitaet) -> {push(i,prio),pop()->i,size,clear()}`
- `chamferDistanz(maske,b,t,aus?) -> Float32Array`
- `markiereRegionen(maske,b,t,aus?) -> anzahl`
- `bilinear(arr,b,t,x,y) -> number`
- `hashArrays(...arrays) -> string`
- `DX8`
- `DY8`
- `DL8`
- `FLAG`
- `WASSER`

```js
import { chamferDistanz, hashArrays } from '../../engine/world/worldgen/worldgen-grid.js';
const dist = chamferDistanz(wasserMaske, 256, 256);   // Abstand (Zellen) zum nächsten Wasser
console.log(hashArrays(welt.hoehe, welt.biom));      // Schnappschuss-Hash für Tests
```

Genutzt von: – · Tags: welt, worldgen, gitter, heap, abstand · THREE: nein

### worldgen-height · `engine/world/worldgen/worldgen-height.js` · v1.0.0 · entwurf
Höhenfeld aus fBm, Grat-Gebirgen, Domain-Warp, Klippen und Terrassen; punktweise abtastbar (für Chunks) oder als ganzes Gitter

- `createHeightSampler(opts) -> {sample(x,y)->number}`
- `stufeHoehe(welt, opts) -> void`

```js
import { createHeightSampler } from '../../engine/world/worldgen/worldgen-height.js';
const hs = createHeightSampler({ seed: 7, breite: 256, tiefe: 256, form: { typ: 'insel' }, hoehe: {} });
const h = hs.sample(128, 128);   // normiert, Meeresspiegel = 0
```

Genutzt von: – · Tags: welt, worldgen, hoehe, terrain, fbm, gebirge · THREE: nein

### worldgen-hydrology · `engine/world/worldgen/worldgen-hydrology.js` · v1.0.0 · entwurf
Wasserhaushalt: Ozean vom Rand fluten, Senken per Priority-Flood füllen, Seen erkennen, Abflussrichtung (D8) und Abflussmenge berechnen

- `fuelleSenken(H,b,t,saat,eps?) -> {F,reihenfolge}`
- `abflussRichtung(F,b,t,istSaat) -> Int32Array`
- `abflussMenge(ziel,reihenfolge,regen?) -> Float32Array`
- `stufeHydrologie(welt, opts) -> void`

```js
import { stufeHydrologie } from '../../engine/world/worldgen/worldgen-hydrology.js';
stufeHydrologie(welt, opts);   // setzt welt.flags (OZEAN/SEE/KUESTE), welt.wasserstand, welt.ziel, welt.abfluss, welt.seen
```

Genutzt von: – · Tags: welt, worldgen, wasser, seen, abfluss, priority-flood · THREE: nein

### worldgen-path · `engine/world/worldgen/worldgen-path.js` · v1.0.0 · entwurf
A*-Wegsuche auf dem Weltgitter (8 Richtungen) mit Kosten nach Hang, Wasser und Flüssen; wiederverwendbare typisierte Puffer

- `createPathfinder(welt, opts) -> {finde(ax,ay,bx,by)->Float32Array|null, kosten(i)->number}`

```js
import { createPathfinder } from '../../engine/world/worldgen/worldgen-path.js';
const pf = createPathfinder(welt, { hangKosten: 12, wasser: Infinity });
const weg = pf.finde(10, 10, 200, 180);   // [x0,y0,x1,y1,…] in Weltkoordinaten oder null
```

Genutzt von: – · Tags: welt, worldgen, wegfindung, astar, pfad · THREE: nein

### worldgen-presets · `engine/world/worldgen/worldgen-presets.js` · v1.0.0 · entwurf
Standardoptionen und benannte Voreinstellungen (insel, archipel, kontinent, gebirge, wueste, tundra, sumpfland, vulkaninsel, canyon, flachland, kueste, hochebene, unendlich) plus tiefes Zusammenführen von Optionen

- `STANDARD_OPTIONEN`
- `PRESETS`
- `mischeOptionen(...quellen) -> opts`
- `aufloesen(optionen) -> opts`

```js
import { aufloesen } from '../../engine/world/worldgen/worldgen-presets.js';
const opts = aufloesen({ preset: 'vulkaninsel', seed: 9, klima: { feuchte: 0.8 } });
```

Genutzt von: – · Tags: welt, worldgen, presets, optionen, insel · THREE: nein

### worldgen-query · `engine/world/worldgen/worldgen-query.js` · v1.0.0 · entwurf
Abfragen auf einer erzeugten Welt (Weltkoordinaten): Höhe bilinear, Hang, Normale, Biom, Wasser; hängt Methoden auch an Welt-Daten aus einem Worker an

- `heightAt(welt,x,y) -> number`
- `slopeAt(welt,x,y) -> number`
- `normalAt(welt,x,y,aus?) -> [nx,ny,nz]`
- `biomeAt(welt,x,y) -> id`
- `isWater(welt,x,y) -> bool`
- `waterDepthAt(welt,x,y) -> number`
- `mitAbfragen(welt) -> welt`

```js
import { mitAbfragen } from '../../engine/world/worldgen/worldgen-query.js';
const welt = mitAbfragen(datenAusWorker);
const y = welt.heightAt(10.5, 20.25), n = welt.normalAt(10.5, 20.25);
```

Genutzt von: – · Tags: welt, worldgen, abfrage, hoehe, normale, biome · THREE: nein

### worldgen-rivers · `engine/world/worldgen/worldgen-rivers.js` · v1.0.0 · entwurf
Flüsse aus der Abflussmenge: Flusszellen mit Breite, Flussbett eingraben, Ufer abflachen, geglättete Flusslinien (Quelle → Meer/See) erzeugen

- `stufeFluesse(welt, opts) -> void`
- `flussLinien(welt, schwelle, glaetten?) -> [{punkte,breite,muendung}]`
- `chaikin(punkte, breite, iterationen) -> {punkte,breite}`

```js
import { stufeFluesse } from '../../engine/world/worldgen/worldgen-rivers.js';
stufeFluesse(welt, { wasser: { flussMenge: 0.6, flussTiefe: 0.02 } });
for (const f of welt.fluesse) console.log(f.muendung, f.punkte.length / 2);
```

Genutzt von: – · Tags: welt, worldgen, fluss, wasser, abfluss · THREE: nein

### worldgen-scatter · `engine/world/worldgen/worldgen-scatter.js` · v1.0.0 · entwurf
Blue-Noise-Verteilung von Objekten (Bäume, Büsche, Felsen, Kakteen, Schilf, Blumen …) mit Dichte pro Biom, Lichtungen und Hangregeln; reihenfolgeunabhängig und dadurch nahtlos über Chunks

- `STANDARD_OBJEKTE`
- `verteile(quelle, arten, opts, bereich) -> objekte`
- `weltQuelle(welt) -> quelle`
- `stufeObjekte(welt, opts) -> void`

```js
import { stufeObjekte } from '../../engine/world/worldgen/worldgen-scatter.js';
stufeObjekte(welt, opts);
const o = welt.objekte;   // { anzahl, x, y, art, typ, skala, drehung, arten:[…], typen:[…] }
for (let i = 0; i < o.anzahl; i++) if (o.arten[o.art[i]] === 'baum') pflanze(o.typen[o.typ[i]], o.x[i], o.y[i]);
```

Genutzt von: – · Tags: welt, worldgen, objekte, baeume, verteilung, poisson, blue-noise · THREE: nein

### worldgen-shape · `engine/world/worldgen/worldgen-shape.js` · v1.0.0 · entwurf
Landform-Masken für den Weltgenerator (Insel, Archipel, Kontinent, Küste, Vulkan, Canyon, Plateau, unendlich) plus formspezifische Nachbearbeitung der Höhe

- `createShape(form, seed) -> {typ, endlich, maske(u,v)->number, nach(h,u,v,wx,wy)->number}`
- `FORMEN`

```js
import { createShape } from '../../engine/world/worldgen/worldgen-shape.js';
const f = createShape({ typ: 'insel', kuestenRauschen: 0.5 }, 42);
const landNeigung = f.maske(0, 0);   // u,v in [-1,1]; >0 = Land-Tendenz
```

Genutzt von: – · Tags: welt, worldgen, insel, form, maske, terrain · THREE: nein

### worldgen-sites · `engine/world/worldgen/worldgen-sites.js` · v1.0.0 · entwurf
Orte finden: Startplatz (flach, nah an Wasser und Wald, eingeebnet), Dorfplätze mit Mindestabstand und Sehenswürdigkeiten (Gipfel, Quellen, Mündungen, Seen)

- `bewerteOrt(welt, x, y, gewichte) -> number`
- `ebneEin(welt, x, y, radius) -> void`
- `stufeOrte(welt, opts) -> void`

```js
import { stufeOrte } from '../../engine/world/worldgen/worldgen-sites.js';
stufeOrte(welt, { orte: { start: true, doerfer: 3 } });
const { start, doerfer, poi } = welt.orte;   // Weltkoordinaten
```

Genutzt von: – · Tags: welt, worldgen, orte, start, dorf, poi · THREE: nein

### worldgen · `engine/world/worldgen/worldgen.js` · v1.0.0 · entwurf
Weltgenerator-Einstieg: createWorld(optionen) führt die Stufen-Pipeline (Höhe → Erosion → Hydrologie → Flüsse → Klima → Biome → Orte → Objekte) per Preset aus; Spiele können Stufen einfügen/ersetzen; Ergebnis in typisierten Arrays

- `createWorld(optionen) -> welt`
- `STANDARD_STUFEN`
- `transferierbar(welt) -> {daten, puffer}`
- `createChunkGenerator(optionen) -> {sampleHeight,generateChunk}`
- `PRESETS`
- `aufloesen(optionen)`
- `mitAbfragen(welt)`
- `createPathfinder(welt,opts)`
- `biomId(welt,key)`
- `FLAG`
- `hashArrays(...arrays)`

```js
import { createWorld } from '../../engine/world/worldgen/worldgen.js';
const welt = createWorld({ preset: 'insel', seed: 42, breite: 256, tiefe: 256, qualitaet: 'normal' });
const h = welt.heightAt(100.5, 80.2), wasser = welt.isWater(100, 80), start = welt.orte.start;
```

Genutzt von: testwelt, weltlabor · Tags: welt, worldgen, insel, terrain, generator, prozedural, karte · THREE: nein
