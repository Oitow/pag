# 🧰 Engine-Katalog

> Automatisch erzeugt von `node tools/katalog.mjs` – nicht von Hand bearbeiten.
> Erst diese Liste lesen, dann gezielt den Eintrag (`grep -n -A12 "### <modul>" engine/KATALOG.md`).

## Übersicht

| Modul | Pfad | Zweck | Status |
|---|---|---|---|
| follow-camera | `engine/camera/follow-camera.js` | Third-Person-Orbitkamera: weiches Folgen (vertikal träger), Boden-/Hindernis-Kollision, Auto-Ausrichtung hinter die Laufrichtung, Sprint-FOV, Zoom, Schütteln, Lock-On | entwurf |
| math | `engine/core/math.js` | Kleine Mathe-Helfer: clamp, lerp, smoothstep, framerate-unabhängiges Dämpfen, Winkel | stabil |
| noise | `engine/core/noise.js` | Seedbares Simplex-Rauschen 2D/3D plus fBm, Grat-Rauschen und Domain-Warp für Terrain, Biome und Texturen | stabil |
| rng | `engine/core/rng.js` | Deterministischer Zufall (mulberry32), Seeds aus Text, Gitter-Hash und Würfel-Helfer | stabil |
| character-motor | `engine/gameplay/character-motor.js` | Kinematischer Figuren-Controller ohne THREE: Beschleunigung, Coyote-Time, Jump-Buffer, variable Sprunghöhe, Stufen, Ground-Snap, Hang-Rutschen, Hindernisse, Schwimmen | entwurf |
| character-steering | `engine/gameplay/character-steering.js` | NPC-Bewegungs-Gehirn: liefert dieselbe Absicht wie die Eingabe – Ziel/Ankommen, Wandern, Folgen, Fliehen, Pfad, Ausweichen, Steckenbleiben erkennen | entwurf |
| character | `engine/gameplay/character.js` | Fertige Spielfigur in einem Objekt: Modell (Look) + Animator + Bewegungs-Motor, für Spieler und NPCs gleich | entwurf |
| move-input | `engine/input/move-input.js` | Bewegungs-Eingabe für Figuren: Tastatur (WASD/Pfeile), Maus-Ziehen/Mausrad, Touch-Stick + Knöpfe, Gamepad → Stick, Kamera-Delta, Aktionen (Flanke/gehalten) | entwurf |
| touch-stick | `engine/input/touch-stick.js` | Touch-Steuerung fürs Handy: dynamischer virtueller Joystick (linke Hälfte), Kamera-Wischen + Pinch-Zoom (rechte Hälfte), runde Aktionsknöpfe unten rechts | entwurf |
| character-animator | `engine/models/character/character-animator.js` | Prozedurale Figuren-Animation aus dem Motor-Zustand: idle/gehen/laufen/sprinten ohne Fußrutschen, Luft, Landung, Schwimmen, Ducken, Rutschen, Kurvenlage, Atmen, Aktions-Clips mit Masken, Blick | entwurf |
| character-clips | `engine/models/character/character-clips.js` | Aktions-Clips einer Figur als Keyframe-Daten (winken, schlagen, hacken, werfen, aufheben, tod, rolle, sitzen, tanzen …) und ihr Abtaster | entwurf |
| character-gang | `engine/models/character/character-gang.js` | Fortbewegungs-Posen einer Figur (rein): Fußziele aus Gangphase (gehen/laufen/sprinten ohne Fußrutschen), Bein-IK, Rumpf/Arme, Luft- und Schwimm-Pose | entwurf |
| character-look | `engine/models/character/character-look.js` | Aussehen einer Figur als reine Daten: Körperbau, Haut, Haar, Kleidung, Kopfbedeckung; Vorlagen, Zufalls-Looks per Seed, abgeleitete Körpermaße | entwurf |
| character-model | `engine/models/character/character-model.js` | Look → fertige Figur: Rig (Gelenk-Gruppen) + Low-Poly-Meshes je Knochen; Look live wechseln, Gegenstände an Sockeln befestigen | entwurf |
| character-parts-kopf | `engine/models/character/character-parts-kopf.js` | Bau-Funktionen für den Figuren-Kopf: Gesicht (Augen, Nase, Ohren, Mund), Frisuren, Bärte und Kopfbedeckungen | entwurf |
| character-parts | `engine/models/character/character-parts.js` | Reine Bau-Funktionen für Figuren-Körperteile je Knochen (Torso, Becken/Rock, Arme, Beine, Füße, Umhang, Rucksack) aus Look + Körpermaßen | entwurf |
| character-pose | `engine/models/character/character-pose.js` | Posen einer Figur als reine Daten: leere Pose, kopieren, mischen, addieren, maskieren (Ober-/Unterkörper, Arme) und aufs Rig anwenden | entwurf |
| character-rig | `engine/models/character/character-rig.js` | Prozedurales Skelett einer Menschen-Figur aus Gruppen (keine Skinning-Knochen): feste Gelenknamen, Ruhepose, Sockel für Hut/Waffe/Rucksack | entwurf |
| mesh-builder | `engine/render/mesh-builder.js` | Low-Poly-Modelle aus Primitiven (Box, Kugel, Zylinder …) mit Vertexfarben zu EINER Geometrie verschmelzen; Farbvariation pro Dreieck per Seed | entwurf |
| fake-dom | `engine/test/fake-dom.mjs` | Minimale Browser-Attrappe für Node-Tests: document, window, localStorage, requestAnimationFrame | stabil |
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
| adapter | worldgen-adapter |
| aktion | character-animator, character-clips |
| angriff | character-clips |
| animation | character, character-animator, character-clips, character-gang, character-pose, character-rig |
| astar | worldgen-path |
| attrappe | fake-dom |
| ausrüstung | character-model |
| aussehen | character-look |
| avatar | character, character-look, character-model |
| baeume | scatter-mesh, worldgen-scatter |
| bart | character-parts-kopf |
| bewegung | character-motor, character-steering, character |
| biome | terrain-mesh, worldgen-biomes, worldgen-query |
| blue-noise | worldgen-scatter |
| boden | worldgen-adapter |
| charakter | character, character-animator, character-clips, character-gang, character-look, character-model, character-parts-kopf, character-parts, character-pose, character-rig |
| chunks | worldgen-chunks |
| clip | character-animator, character-clips |
| controller | character-motor, character |
| dom | fake-dom |
| dorf | worldgen-sites |
| editor | character-look, character-model |
| eingabe | move-input, touch-stick |
| emote | character-clips |
| erosion | worldgen-erosion |
| fbm | worldgen-height |
| felsen | scatter-mesh |
| feuchte | worldgen-climate |
| figur | follow-camera, character-motor, character, move-input, character-animator, character-clips, character-gang, character-look, character-model, character-parts-kopf, character-parts, character-pose, character-rig, worldgen-adapter |
| fluss | worldgen-rivers |
| folgen | follow-camera |
| form | worldgen-shape |
| frisur | character-parts-kopf |
| fuesse | character-gang |
| gamepad | move-input |
| gameplay | character-motor, character-steering |
| gang | character-animator, character-gang |
| gebirge | worldgen-height |
| gelaende | terrain-mesh |
| gelenke | character-rig |
| generator | worldgen |
| geometrie | mesh-builder |
| gesicht | character-parts-kopf |
| gitter | worldgen-grid |
| haar | character-parts-kopf |
| handy | touch-stick |
| hash | rng |
| heap | worldgen-grid |
| helm | character-parts-kopf |
| hoehe | worldgen-height, worldgen-query |
| hut | character-parts-kopf |
| hydraulik | worldgen-erosion |
| ik | character-gang |
| insel | worldgen-presets, worldgen-shape, worldgen |
| instanzen | scatter-mesh |
| interpolation | math |
| joystick | move-input, touch-stick |
| kamera | follow-camera, math |
| karte | worldgen |
| keyframe | character-clips |
| ki | character-steering |
| kleidung | character-parts |
| klima | worldgen-biomes, worldgen-climate |
| knoepfe | touch-stick |
| kollision | worldgen-adapter |
| kopf | character-parts-kopf |
| krone | character-parts-kopf |
| körper | character-parts |
| laufen | character-animator, character-gang |
| lock-on | follow-camera |
| look | character-look |
| lowpoly | character-parts, mesh-builder |
| maske | character-pose, worldgen-shape |
| mathe | math |
| maus | move-input |
| meer | terrain-mesh |
| merge | mesh-builder |
| mesh | character-model, character-parts, mesh-builder, scatter-mesh, terrain-mesh |
| mischen | character-pose |
| modell | character-model, mesh-builder |
| node | fake-dom |
| noise | noise |
| normale | worldgen-query |
| npc | character-steering, character, character-animator, character-look, character-model |
| objekte | scatter-mesh, worldgen-scatter |
| optionen | worldgen-presets |
| orbit | follow-camera |
| orte | worldgen-sites |
| pfad | character-steering, worldgen-path |
| physik | character-motor |
| pinch | touch-stick |
| poi | worldgen-sites |
| poisson | worldgen-scatter |
| pose | character-pose |
| presets | worldgen-presets |
| primitive | mesh-builder |
| priority-flood | worldgen-hydrology |
| prozedural | noise, worldgen |
| rauschen | noise |
| regen | worldgen-climate |
| rig | character-pose, character-rig |
| rucksack | character-parts |
| schuetteln | follow-camera |
| schwimmen | character-motor, character-animator, character-gang |
| seed | rng |
| seen | worldgen-hydrology |
| skelett | character-rig |
| sockel | character-rig |
| speichern | character-look |
| spieler | character, character-animator, character-look, character-model |
| springen | character-animator |
| sprung | character-motor |
| start | worldgen-sites |
| steering | character-steering |
| steuerung | move-input |
| streaming | worldgen-chunks |
| tastatur | move-input |
| temperatur | worldgen-climate |
| terrain | noise, terrain-mesh, worldgen-chunks, worldgen-erosion, worldgen-height, worldgen-shape, worldgen |
| test | fake-dom |
| third-person | follow-camera |
| touch | move-input, touch-stick |
| umhang | character-parts |
| unendlich | worldgen-chunks |
| vegetation | scatter-mesh |
| verteilung | worldgen-scatter |
| vertexfarben | mesh-builder |
| wandern | character-steering |
| wasser | terrain-mesh, worldgen-adapter, worldgen-hydrology, worldgen-rivers |
| wegfindung | worldgen-path |
| welt | noise, rng, scatter-mesh, terrain-mesh, worldgen-adapter, worldgen-biomes, worldgen-chunks, worldgen-climate, worldgen-erosion, worldgen-grid, worldgen-height, worldgen-hydrology, worldgen-path, worldgen-presets, worldgen-query, worldgen-rivers, worldgen-scatter, worldgen-shape, worldgen-sites, worldgen |
| whittaker | worldgen-biomes |
| worldgen | worldgen-adapter, worldgen-biomes, worldgen-chunks, worldgen-climate, worldgen-erosion, worldgen-grid, worldgen-height, worldgen-hydrology, worldgen-path, worldgen-presets, worldgen-query, worldgen-rivers, worldgen-scatter, worldgen-shape, worldgen-sites, worldgen |
| zoom | follow-camera, touch-stick |
| zufall | rng |

## Module

### follow-camera · `engine/camera/follow-camera.js` · v1.0.0 · entwurf
Third-Person-Orbitkamera: weiches Folgen (vertikal träger), Boden-/Hindernis-Kollision, Auto-Ausrichtung hinter die Laufrichtung, Sprint-FOV, Zoom, Schütteln, Lock-On

- `createFollowCamera(opts) -> { kamera, yaw, pitch, distanz, update(dt, ziel, info), drehen(dx, dy), zoomen(delta), schuetteln(staerke, dauer), blickYaw(), richtungAusStick(x, y), springeZu(ziel), lockOn(punkt|null), dispose() }`
- `stickRichtung(x, y, yaw) -> {x, z}`

```js
import { createFollowCamera } from '../../engine/camera/follow-camera.js';
const cam = createFollowCamera({ bodenHoehe: (x, z) => welt.hoehe(x, z) });
const e = eingabe.lesen(); cam.drehen(e.kameraX, e.kameraY); cam.zoomen(e.zoom);
const r = cam.richtungAusStick(e.x, e.y);       // Kamera-relative Laufrichtung in Weltkoordinaten
cam.update(dt, motor.pos, { tempo: motor.tempo, sprintet: motor.sprintet, yaw: motor.yaw, amBoden: motor.amBoden });
renderer.render(szene, cam.kamera);
```

Genutzt von: figuren-labor · Tags: kamera, third-person, orbit, folgen, zoom, figur, lock-on, schuetteln · THREE: ja

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

Genutzt von: figuren-labor, testwelt · Tags: mathe, interpolation, kamera · THREE: nein

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

Genutzt von: figuren-labor · Tags: zufall, seed, hash, welt · THREE: nein

### character-motor · `engine/gameplay/character-motor.js` · v1.0.0 · entwurf
Kinematischer Figuren-Controller ohne THREE: Beschleunigung, Coyote-Time, Jump-Buffer, variable Sprunghöhe, Stufen, Ground-Snap, Hang-Rutschen, Hindernisse, Schwimmen

- `createMotor({welt,pos,yaw,radius,hoehe,tuning}) -> {zustand,tuning,radius,hoehe,update(dt,absicht),teleport(pos,yaw?),stoss(x,y,z),setTuning(teil),springeJetzt(),dispose()}`
- `MOTOR_TUNING`

```js
import { createMotor } from '../../engine/gameplay/character-motor.js';
const motor = createMotor({ welt: { bodenHoehe: (x, z) => 0 }, pos: { x: 0, y: 0, z: 0 } });
motor.update(dt, { x: 0, z: 1, sprint: false, springen: false, ducken: false });
figur.position.set(motor.zustand.pos.x, motor.zustand.pos.y, motor.zustand.pos.z);
```

Genutzt von: – · Tags: figur, bewegung, physik, controller, sprung, schwimmen, gameplay · THREE: nein

### character-steering · `engine/gameplay/character-steering.js` · v1.0.0 · entwurf
NPC-Bewegungs-Gehirn: liefert dieselbe Absicht wie die Eingabe – Ziel/Ankommen, Wandern, Folgen, Fliehen, Pfad, Ausweichen, Steckenbleiben erkennen

- `createSteering({seed,ankunftsRadius,bremsRadius,wanderRadius,heimat,tempo,radius}) -> {modus,ziel,angekommen,setModus(name,daten),gehZu(x,z,{rennen}),folge(getPos,abstand),fliehe(getPos,sicherAbstand),wandere(heimat,radius),folgePfad(punkte,{schleife}),stehe(),update(dt,zustand,nachbarn?)->absicht,dispose()}`
- `richtungZu(von,nach,out?) -> {x,z,dist}`
- `ankunftsStaerke(dist,bremsRadius) -> 0…1`

```js
import { createSteering } from '../../engine/gameplay/character-steering.js';
const hirn = createSteering({ seed: 7, heimat: { x: 0, z: 0 } });
hirn.wandere({ x: 0, z: 0 }, 6);
motor.update(dt, hirn.update(dt, motor.zustand, nachbarn));
```

Genutzt von: figuren-labor · Tags: npc, ki, steering, bewegung, wandern, pfad, gameplay · THREE: nein

### character · `engine/gameplay/character.js` · v1.0.0 · entwurf
Fertige Spielfigur in einem Objekt: Modell (Look) + Animator + Bewegungs-Motor, für Spieler und NPCs gleich

- `createCharacter(opts) -> { root, model, animator, motor, zustand, look, update(dt,absicht), spiele(name,opts), stoppe(name?), setLook(teil), teleport(pos,yaw?), stoss(x,y,z), dispose() }`

```js
import { createCharacter } from '../../engine/gameplay/character.js';
const held = createCharacter({ look: VORLAGEN.wanderer, welt, pos: { x: 0, y: 0, z: 0 } });
szene.add(held.root);
held.update(dt, absicht);   // absicht aus move-input (stickZuWelt) oder character-steering
```

Genutzt von: figuren-labor · Tags: figur, charakter, spieler, npc, bewegung, animation, controller, avatar · THREE: nein

### move-input · `engine/input/move-input.js` · v1.0.0 · entwurf
Bewegungs-Eingabe für Figuren: Tastatur (WASD/Pfeile), Maus-Ziehen/Mausrad, Touch-Stick + Knöpfe, Gamepad → Stick, Kamera-Delta, Aktionen (Flanke/gehalten)

- `createMoveInput(opts) -> { lesen(dt?) -> { x, y, sprint, springen, ducken, kameraX, kameraY, zoom, aktiv }, gedrueckt(name), gehalten(name), setAktiv(bool), zeigeTouch(bool), dispose() }`
- `stickZuWelt(x, y, kameraYaw) -> {x, z}`
- `STANDARD_AKTIONEN`

```js
import { createMoveInput, stickZuWelt } from '../../engine/input/move-input.js';
const ein = createMoveInput({ element: renderer.domElement, aktionen: [{ name: 'angriff', tasten: ['KeyF'], knopf: '⚔', padKnopf: 2 }] });
const e = ein.lesen();                       // einmal pro Frame
kamera.drehen(e.kameraX, e.kameraY); kamera.zoomen(e.zoom);
const r = stickZuWelt(e.x, e.y, kamera.blickYaw());
motor.update(dt, { x: r.x, z: r.z, sprint: e.sprint, springen: e.springen, ducken: e.ducken });
if (ein.gedrueckt('angriff')) figur.schlagen();
```

Genutzt von: figuren-labor · Tags: eingabe, tastatur, maus, touch, gamepad, joystick, figur, steuerung · THREE: nein

### touch-stick · `engine/input/touch-stick.js` · v1.0.0 · entwurf
Touch-Steuerung fürs Handy: dynamischer virtueller Joystick (linke Hälfte), Kamera-Wischen + Pinch-Zoom (rechte Hälfte), runde Aktionsknöpfe unten rechts

- `createTouchStick(opts) -> { stick {x, y, an}, sprint, nimmKamera() -> {dx, dy, zoom}, benutzt, zeigen(bool), reset(), dispose() }`
- `istTouchGeraet() -> bool`

```js
import { createTouchStick } from '../../engine/input/touch-stick.js';
const t = createTouchStick({ element: canvas, knoepfe: [{ name: 'springen', knopf: '⤒' }],
beiKnopf: (name, unten) => console.log(name, unten), beiErstemTouch: () => t.zeigen(true) });
const { dx, dy, zoom } = t.nimmKamera();   // Pixel bzw. ln(Abstandsverhältnis) seit dem letzten Aufruf
```

Genutzt von: – · Tags: eingabe, touch, joystick, handy, knoepfe, pinch, zoom · THREE: nein

### character-animator · `engine/models/character/character-animator.js` · v1.0.0 · entwurf
Prozedurale Figuren-Animation aus dem Motor-Zustand: idle/gehen/laufen/sprinten ohne Fußrutschen, Luft, Landung, Schwimmen, Ducken, Rutschen, Kurvenlage, Atmen, Aktions-Clips mit Masken, Blick

- `createAnimator(model,opts) -> { update(dt,zustand) -> pose, spiele(name,{tempo,mischung}) -> {dauer,trefferBei}, stoppe(name?), aktion, aktionGewicht, blickZu(dirLokal|null), gewicht, griff, pose, phase, dispose() }`

```js
import { createAnimator } from '../../engine/models/character/character-animator.js';
const anim = createAnimator({ rig, masse }, { seed: 7, onSchritt: (fuss, st) => schrittGeraeusch(st) });
anim.update(dt, motor.zustand);                  // NPC: anim.update(dt, { tempo: 1.4 })
const { trefferBei } = anim.spiele('schlagen');  // Schaden nach trefferBei Sekunden
```

Genutzt von: – · Tags: figur, charakter, animation, gang, laufen, schwimmen, springen, aktion, clip, npc, spieler · THREE: nein

### character-clips · `engine/models/character/character-clips.js` · v1.0.0 · entwurf
Aktions-Clips einer Figur als Keyframe-Daten (winken, schlagen, hacken, werfen, aufheben, tod, rolle, sitzen, tanzen …) und ihr Abtaster

- `CLIPS`
- `CLIP_NAMEN`
- `clipPose(name,t,out) -> pose`
- `clipZeit(clip,t) -> t`
- `registriereClip(name,def) -> clip`

```js
import { CLIPS, clipPose, registriereClip } from '../../engine/models/character/character-clips.js';
const p = clipPose('schlagen', CLIPS.schlagen.trefferBei);   // Pose im Treffer-Moment
registriereClip('verbeugen', { dauer: 1.2, maske: 'ganz', fuesseFest: true,
keys: [{ t: 0, pose: {} }, { t: 0.5, pose: { torso: [1.0, 0, 0] } }, { t: 1.2, pose: {} }] });
```

Genutzt von: figuren-labor · Tags: figur, charakter, animation, clip, keyframe, aktion, angriff, emote · THREE: nein

### character-gang · `engine/models/character/character-gang.js` · v1.0.0 · entwurf
Fortbewegungs-Posen einer Figur (rein): Fußziele aus Gangphase (gehen/laufen/sprinten ohne Fußrutschen), Bein-IK, Rumpf/Arme, Luft- und Schwimm-Pose

- `schrittWeite(masse,tempo,opts) -> m`
- `stuetzAnteil(laufW,sprintW) -> 0…1`
- `fussZiele(masse,g,ziele) -> ziele`
- `loeseBein(masse,pose,seite,ziel)`
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

### character-look · `engine/models/character/character-look.js` · v1.0.0 · entwurf
Aussehen einer Figur als reine Daten: Körperbau, Haut, Haar, Kleidung, Kopfbedeckung; Vorlagen, Zufalls-Looks per Seed, abgeleitete Körpermaße

- `LOOK_STANDARD`
- `STILE`
- `VORLAGEN`
- `createLook(teil) -> look`
- `randomLook(seed,opts) -> look`
- `koerperMasse(look) -> masse`
- `farbeZahl(farbe) -> int`

```js
import { createLook, randomLook, koerperMasse, VORLAGEN } from '../../engine/models/character/character-look.js';
const held = createLook({ ...VORLAGEN.wanderer, haar: { farbe: '#c8a040' } });
const npc = randomLook(hashSeed('dorf', 7));   // gleicher Seed → gleicher Look
```

Genutzt von: figuren-labor · Tags: figur, charakter, aussehen, look, spieler, npc, avatar, editor, speichern · THREE: nein

### character-model · `engine/models/character/character-model.js` · v1.0.0 · entwurf
Look → fertige Figur: Rig (Gelenk-Gruppen) + Low-Poly-Meshes je Knochen; Look live wechseln, Gegenstände an Sockeln befestigen

- `createCharacterModel({ look, seed, material, schatten }) -> { root, rig, look, masse, meshes, setLook(teilOderLook), befestigen(sockel,obj), loesen(sockelOderObj), setSichtbar(bool), dispose() }`

```js
import { createCharacterModel } from '../../engine/models/character/character-model.js';
const figur = createCharacterModel({ look: VORLAGEN.ritter, seed: 4 });
szene.add(figur.root);
figur.befestigen('handR', schwert);
figur.setLook({ kopfbedeckung: { stil: 'krone' } });   // Rig-Gruppen & Befestigtes bleiben erhalten
```

Genutzt von: – · Tags: figur, charakter, modell, mesh, spieler, npc, avatar, editor, ausrüstung · THREE: ja

### character-parts-kopf · `engine/models/character/character-parts-kopf.js` · v1.0.0 · entwurf
Bau-Funktionen für den Figuren-Kopf: Gesicht (Augen, Nase, Ohren, Mund), Frisuren, Bärte und Kopfbedeckungen

- `baueKopf(b,ctx)`
- `baueKopfbedeckung(b,ctx)`
- `deckendeKopfbedeckung(stil) -> bool`

```js
import { baueKopf, baueKopfbedeckung } from '../../engine/models/character/character-parts-kopf.js';
const ctx = teilKontext(look, masse);
rig.knochen.kopf.add(baueKopf(createMeshBuilder({ seed }), ctx).mesh());
```

Genutzt von: – · Tags: figur, charakter, kopf, gesicht, haar, frisur, bart, hut, helm, krone · THREE: ja

### character-parts · `engine/models/character/character-parts.js` · v1.0.0 · entwurf
Reine Bau-Funktionen für Figuren-Körperteile je Knochen (Torso, Becken/Rock, Arme, Beine, Füße, Umhang, Rucksack) aus Look + Körpermaßen

- `teilKontext(look,masse) -> ctx`
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
- `farbeMisch(a,b,t) -> int`

```js
import { teilKontext, baueTorso } from '../../engine/models/character/character-parts.js';
const b = createMeshBuilder({ seed: 3 }), ctx = teilKontext(look, koerperMasse(look));
rig.knochen.torso.add(baueTorso(b, ctx).mesh());
```

Genutzt von: – · Tags: figur, charakter, kleidung, mesh, lowpoly, körper, umhang, rucksack · THREE: ja

### character-pose · `engine/models/character/character-pose.js` · v1.0.0 · entwurf
Posen einer Figur als reine Daten: leere Pose, kopieren, mischen, addieren, maskieren (Ober-/Unterkörper, Arme) und aufs Rig anwenden

- `POSE_KNOCHEN`
- `GANZ`
- `OBERKOERPER`
- `UNTERKOERPER`
- `BEINE`
- `ARM_L`
- `ARM_R`
- `KOPF`
- `leerePose() -> pose`
- `kopierePose(a,out) -> out`
- `mischePose(a,b,t,out,maske) -> out`
- `addierePose(a,b,gewicht,out) -> out`
- `maskiere(pose,maske) -> pose`
- `wendeAn(rig,pose) -> rig`

```js
import { leerePose, mischePose, wendeAn, OBERKOERPER } from '../../engine/models/character/character-pose.js';
const p = leerePose();
mischePose(gangPose, schlagPose, 0.8, p, OBERKOERPER);   // nur Oberkörper überblenden
wendeAn(rig, p);
```

Genutzt von: – · Tags: figur, charakter, pose, animation, mischen, maske, rig · THREE: nein

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

### mesh-builder · `engine/render/mesh-builder.js` · v1.0.0 · entwurf
Low-Poly-Modelle aus Primitiven (Box, Kugel, Zylinder …) mit Vertexfarben zu EINER Geometrie verschmelzen; Farbvariation pro Dreieck per Seed

- `createMeshBuilder(opts) -> builder`
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
