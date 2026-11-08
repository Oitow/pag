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
Torso/Hals/Kopf + = nach vorn neigen · Fuß + = Zehen hoch · `schulterL.rotation.z +` / `schulterR.rotation.z −` = Arm abspreizen.
Mesh-Lage: Kopf-Kugel zentriert bei `y = kopfRadius` im Knochen `kopf`; Gliedmaßen-Meshes hängen von ihrem Gelenk nach −Y;
Fuß-Mesh vom Knöchel bis zum Boden (`−fussHoehe`) und nach +Z.

### Pose (character-pose)
Reines Objekt: `{ <knochen>: { x, y, z } (Rotation), basisPos: { x, y, z } (Versatz der basis) }`. Fehlende Knochen = 0.

### Absicht (Eingabe → Motor)
`{ x, z, sprint, springen, ducken, blickYaw? }` – `x, z` = gewünschte Laufrichtung in **Weltkoordinaten**, Länge 0…1
(Analogstick halb gedrückt = langsam). `springen` = Taste **gehalten** (Motor erkennt Flanken selbst → Jump-Buffer, variable Höhe).
`blickYaw` (optional, Zahl) = Figur schaut dorthin statt in Laufrichtung (Lock-On, Zielen, Seitwärtsgehen).

### Welt-Adapter (für Motor & Kamera)
```js
{
  bodenHoehe(x, z) -> number,                  // Pflicht
  wasserHoehe?(x, z) -> number | null,         // Wasseroberfläche oder null
  hindernisse?(x, z, radius) -> { x, z } | null // Ausschiebe-Vektor (z. B. Baumstämme, Wände)
}
```

### Motor-Zustand (Motor → Animator, Kamera, Spiel)
```js
{ pos: {x,y,z}, vel: {x,y,z}, yaw, drehRate, tempo /*horizontal m/s*/, tempoAnteil /*0…1 von laufTempo*/,
  amBoden, imWasser, duckt, sprintet, rutscht, sprung /*true im Frame des Absprungs*/, landung /*Aufprall-Tempo im Lande-Frame, sonst 0*/,
  luftZeit, eintauchen /*0…1*/ }
```

## Regeln für alle Modul-Autoren
- Modulkopf (`@modul … @three`), Test `x.test.mjs` daneben (`node --test`), ≤ ~300 Zeilen pro Datei, Fabrik `createX(opts)` + `dispose()`.
- **Nicht** `npm run katalog` / `npm test` laufen lassen (macht die Integration am Ende) – nur `node --test <eigene Tests>`.
- Keine Dateien anderer Besitzer ändern. Fehlt etwas: im Abschlussbericht melden.
- Zufall nur über `engine/core/rng.js`; Hilfen aus `engine/core/math.js` nutzen (clamp, lerp, damp, dampAngle, angleDiff …).
- Deutsch in Kommentaren/Namen der öffentlichen API.
