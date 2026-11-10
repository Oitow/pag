# 🧍 Figuren-System (Engine) – Vertrag

Alles rund um Spielfiguren und NPCs: **Aussehen → Skelett → Modell → Animation → Bewegung → Eingabe → Kamera → Steuerung (KI)**.
Jedes Teil ist ein eigenes Engine-Modul (Modulvertrag aus `CLAUDE.md`), austauschbar und einzeln testbar.

```
input/move-input ──► Absicht ─┐                 ┌─► camera/follow-camera
gameplay/character-steering ──┤                 │
                              ▼                 │
                 gameplay/character-motor ──► Zustand ──► models/character/character-animator ──► Pose ──► Rig
                 (Physik, rein, ohne THREE)     │                (prozedural + Clips)                    ▲
                              ▲                 └──────────────────────────────────────────────┐       │
              Welt-Adapter (bodenHoehe …)                                                       │  models/character/character-model
                                                                                                │  (Meshes aus Look, render/mesh-builder)
                         gameplay/character  = Klebstoff: Modell + Animator + Motor in einem Objekt ┘
```

## Einheiten & Achsen
Meter, Sekunden, Radiant. Y nach oben. Figur-Ursprung **an den Füßen**, Blick nach **+Z**. `yaw` = Drehung um Y,
`yaw = 0` blickt nach +Z, `yaw = atan2(x, z)` für eine Richtung (x, z). Links der Figur = +X.

## Module & Besitzer

| Modul | Schicht | Datei | Inhalt |
|---|---|---|---|
| character-look | models | `engine/models/character/character-look.js` | **fertig** – Look-Daten, Vorlagen, `randomLook`, `koerperMasse` |
| character-rig | models | `engine/models/character/character-rig.js` | **fertig** – Gelenk-Gruppen, Sockel |
| mesh-builder | render | `engine/render/mesh-builder.js` | Primitive mit Vertexfarben → eine Geometrie |
| character-parts | models | `engine/models/character/character-parts.js` | Mesh-Teile je Knochen/Stil (Haar, Hüte, Kleidung …) |
| character-model | models | `engine/models/character/character-model.js` | Look → fertige Figur (Rig + Meshes), `setLook`, `befestigen` |
| character-pose | models | `engine/models/character/character-pose.js` | Posen als Daten: leeren, mischen, addieren, aufs Rig anwenden |
| character-clips | models | `engine/models/character/character-clips.js` | Aktions-Clips (Keyframes): winken, schlagen, hacken, werfen … |
| character-animator | models | `engine/models/character/character-animator.js` | Fortbewegung (Gang aus Tempo), Luft, Schwimmen, Ducken, Aktionen, Blick |
| character-motor | gameplay | `engine/gameplay/character-motor.js` | Kinematischer Controller (rein, ohne THREE) |
| character-steering | gameplay | `engine/gameplay/character-steering.js` | NPC-Absicht: Ziel, Ankommen, Wandern, Folgen, Fliehen, Pfad, Ausweichen |
| move-input | input | `engine/input/move-input.js` | Tastatur + Touch-Stick/Knöpfe + Gamepad → Absicht |
| follow-camera | camera | `engine/camera/follow-camera.js` | Third-Person-Orbit, weiches Folgen, Boden-Kollision, Pinch/Zoom |
| character | gameplay | `engine/gameplay/character.js` | Klebstoff für Spiele: `createCharacter(...)` |
| character-ausruestung | models | `engine/models/character/character-ausruestung.js` | Gegenstände für Sockel: Schwert, Axt, Schild, Fackel, Laterne … |
| character-parts-* | models | `engine/models/character/character-parts-{basis,torso,becken,ruecken,haar,hut,zubehoer,gesicht}.js` | Aufgeteilte Bau-Funktionen; `-gesicht` = bewegliche Mimik |
| character-clips-mehr | models | `engine/models/character/character-clips-mehr.js` | Weitere Clips (nur Daten, von character-clips registriert) |
| character-anim-* | models | `engine/models/character/character-anim-{blick,hang,idle,zustand}.js` | Animator-Schichten: Blick, Hang-Füße, Idle-Varianten, Motor-Sonderzustände |
| character-sekundaer | models | `engine/models/character/character-sekundaer.js` | Nachschwingen (Feder-Dämpfer): Kopf, Gewicht, Umhang, Haar |
| character-reaktion | models | `engine/models/character/character-reaktion.js` | Treffer aus Richtung, Umfallen, Aufstehen (ohne Physik-Engine) |
| character-motor-tuning | gameplay | `engine/gameplay/character-motor-tuning.js` | `MOTOR_TUNING` (Standardwerte des Motors) |
| character-steering-extra | gameplay | `engine/gameplay/character-steering-extra.js` | Helfer: Patrouille, Umkreisen, Abstand, Verstecken |
| character-gruppe | gameplay | `engine/gameplay/character-gruppe.js` | Schwarm: Separation, Kohäsion, Ausrichtung |
| character-sinne | gameplay | `engine/gameplay/character-sinne.js` | NPC-Wahrnehmung: Sichtkegel, Hören, Sichtlinie, Gedächtnis |
| character-brain | gameplay | `engine/gameplay/character-brain.js` | NPC-Zustandsautomat (idle, wandern, patrouille, arbeiten, folgen, fliehen, angreifen, suchen, plaudern) + Tagesplan |
| ziel-wahl | camera | `engine/camera/ziel-wahl.js` | Lock-On-Ziel wählen (vorn / nächstes links/rechts) |
| figur-schild | ui | `engine/ui/figur-schild.js` | Namensschild, Sprechblase, Lebensbalken über Figuren (DOM) |

Demo/Testspiel: `games/figuren-labor/` (Editor + Herumlaufen + NPCs).

## Gemeinsame Datentypen

### Look (character-look)
Siehe Modulkopf. `createLook(teil)` normalisiert alles (auch Spielstände). Farben sind `'#rrggbb'`; `farbeZahl()` → `0xrrggbb`.

### Masse (`koerperMasse(look)`)
`{ hoehe, radius, fussHoehe, fussLaenge, unterschenkel, oberschenkel, hueftHoehe, beckenBreite, torsoAbstand, torsoLaenge,
schulterX, schulterY, oberarm, unterarm, hand, halsLaenge, kopfRadius, breite, bauch, schrittLaenge, augenHoehe }`

### Rig (character-rig)
`{ root, knochen, sockel, masse, anpassen(masse), ruhepose(), dispose() }`
Knochen: `basis, becken, torso, hals, kopf, schulterL, ellbogenL, handL, schulterR, ellbogenR, handR, huefteL, knieL, fussL, huefteR, knieR, fussR`.
Sockel: `handR, handL, kopf (Scheitel), ruecken, guertel, umhang`.
Drehsinn (rotation.x): Hüfte − = Bein vor · Knie + = beugen · Schulter − = Arm vor · Ellbogen − = beugen ·
Torso/Hals/Kopf + = nach vorn neigen · Fuß − = Zehen hoch · `schulterL.rotation.z +` / `schulterR.rotation.z −` = Arm abspreizen.
Mesh-Lage: Kopf-Kugel zentriert bei `y = kopfRadius` im Knochen `kopf`; Gliedmaßen-Meshes hängen von ihrem Gelenk nach −Y;
Fuß-Mesh vom Knöchel bis zum Boden und nach +Z (der Knöchel liegt 0,02·hoehe/1,75 unter `fussHoehe`, weil die Hüftgelenke so tief sitzen).

### Pose (character-pose)
Reines Objekt: `{ <knochen>: { x, y, z } (Rotation), basisPos: { x, y, z } (Versatz der basis) }`. Fehlende Knochen = 0.

### Absicht (Eingabe → Motor)
`{ x, z, sprint, springen, ducken, blickYaw? }` – `x, z` = gewünschte Laufrichtung in **Weltkoordinaten**, Länge 0…1
(Analogstick halb gedrückt = langsam). `springen` = Taste **gehalten** (Motor erkennt Flanken selbst → Jump-Buffer, variable Höhe).
`blickYaw` (optional, Zahl) = Figur schaut dorthin statt in Laufrichtung (Lock-On, Zielen, Seitwärtsgehen).
Seit 1.1 optional (gehalten, Flanken erkennt der Motor): `rollen` (Rolle am Boden / Dash in der Luft), `gleiten`, `tauchen`,
`schleichen` (wie ducken), `kantenSchutz` (nur dieser Frame). `move-input.zuAbsicht` reicht alle Bool-Aktionen durch.

### Welt-Adapter (für Motor & Kamera)
```js
{
  bodenHoehe(x, z) -> number,                  // Pflicht
  wasserHoehe?(x, z) -> number | null,         // Wasseroberfläche oder null
  hindernisse?(x, z, radius) -> { x, z } | null // Ausschiebe-Vektor (z. B. Baumstämme, Wände)
}
```
Seit Motor 1.2 gibt der Motor Hinweise mit, die ein Adapter ignorieren darf: `bodenHoehe(x, z, fussY)` und
`hindernisse(x, z, radius, { y, hoehe, ausser })`. `engine/world/kollision.js` (`createKollisionsWelt({ welt: adapter })`) nutzt sie:
begehbare Kisten/Plattformen, Hindernisse mit Höhe (drüberspringen), bewegliche und entfernbare Körper, `strahl(...)`.
Figuren (`createCharacter`) melden sich dort selbst als weicher Zylinder an und schieben sich aneinander vorbei.

### Motor-Zustand (Motor → Animator, Kamera, Spiel)
```js
{ pos: {x,y,z}, vel: {x,y,z}, yaw, drehRate, tempo /*horizontal m/s*/, tempoAnteil /*0…1 von laufTempo*/,
  amBoden, imWasser, duckt, sprintet, rutscht, sprung /*true im Frame des Absprungs*/, landung /*Aufprall-Tempo im Lande-Frame, sonst 0*/,
  luftZeit, eintauchen /*0…1*/ }
```
Seit 1.1 zusätzlich: `rollt, dash, rollAnteil /*0…1*/, abklingzeit, gleitet, doppelSprung /*nur im Frame*/, sprungZahl, taucht, tauchTiefe,
schleicht, anKante, betaeubt, getroffen /*nur im ersten Frame nach stoss*/`. Der Animator stellt sie dar (Rolle, Salto, Gleiten …).

### Mimik (Modell ↔ Animator)
Modell: `setAusdruck(name|null)` (null = Grundmimik `look.ausdruck`), `setAugen(yaw, nick, lid)`, `setLider(zu)`, `blinzeln()`,
`updateGesicht(dt)`. Namen: `AUSDRUECKE` aus character-look. Der Animator leitet den Ausdruck aus Clip/Treffer/Zustand ab
(`animator.ausdruck` setzen = erzwingen) und ruft das Modell per Duck-Typing; `character.setAusdruck(name, { dauer })` macht beides.

### NPC mit Brain
```js
const npc = createCharacter({ look, welt, name: 'Jupp', schilder,
  brain: { heimat, grund: { zustand: 'wandern', radius: 10 }, plan: [{ von: 8, bis: 12, zustand: 'arbeiten', ort, clip: 'hacken' }] } });
npc.update(dt, null, { nachbarn, npcs: brains, stunde, ziele });   // absicht = null → Brain entscheidet, Clips laufen von selbst
```

## Regeln für alle Modul-Autoren
- Modulkopf (`@modul … @three`), Test `x.test.mjs` daneben (`node --test`), ≤ ~300 Zeilen pro Datei, Fabrik `createX(opts)` + `dispose()`.
- **Nicht** `npm run katalog` / `npm test` laufen lassen (macht die Integration am Ende) – nur `node --test <eigene Tests>`.
- Keine Dateien anderer Besitzer ändern. Fehlt etwas: im Abschlussbericht melden.
- Zufall nur über `engine/core/rng.js`; Hilfen aus `engine/core/math.js` nutzen (clamp, lerp, damp, dampAngle, angleDiff …).
- Deutsch in Kommentaren/Namen der öffentlichen API.
