# Viniland Testlab – Modul-Vertrag

Ordner: `games/viniland/`. Kein Build-Schritt. ES-Module, Three.js r170 per Import-Map:

```html
<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js"}}</script>
```

Nur `three` importieren (keine `three/addons`). Gemeinsame Helfer:
- `js/psx.js` → `psxMat(opts)` für JEDES Material (PS1/PS2-Look: Vertex-Snapping, Dithering, Flat-Shading). Default = Vertex-Color-Material.
- `js/kit.js` → `MeshBuilder` (Primitive mit Vertex-Farbe zu einer Geometrie verschmelzen), `rng(seed)`, `makeNoise(seed)`, `clamp/lerp/damp`.

Einheiten: 1 = 1 Meter. Y nach oben. Modelle: Ursprung an den Füßen (Boden), Blickrichtung **+Z**.
Stil: cozy, mid-poly (PS1/PS2), warme gesättigte Farben, große Köpfe/Augen, freundlich. Flat-Shading, Vertex-Farben, keine Texturen.

Testen: `node tests/shot.mjs tests/<seite>.html /tmp/out.png [ms] [w] [h]` (Headless-Chrome mit lokalem Three.js).
Testseiten sollen Fehler sichtbar ins Bild schreiben (`window.onerror` → Overlay-Text).

---

## js/animals.js  (Agent „Tiere“)

```js
export const ANIMAL_TYPES = ['fox', ...];             // genau 10 ids
export const ANIMAL_INFO = { fox: { name:'Fuchs', size:'small'|'medium'|'large', walk: m/s, run: m/s,
                                   temper:'skittish'|'calm'|'curious', herd: bool }, ... };
export function createAnimal(type, seed?) => {
  type, object3D,          // THREE.Group, Füße bei y=0, schaut nach +Z
  radius, height,          // grobe Kollisionsmaße in m
  animate(dt, s),          // s = { speed: m/s horizontal, grounded: bool, turn: rad/s, action?: 'eat'|'sit'|null }
}
```
Animation prozedural im Modell (Beine/Kopf/Schwanz als Untergruppen schwingen, Gang abhängig von speed, Idle-Atmen, Ohren/Schwanz-Wackeln, Fressen = Kopf runter).
Keine KI/Bewegung im Modul – das macht `fauna.js` (Hauptagent).

## js/players.js  (Agent „Spieler“)

```js
export const PLAYER_LOOKS = [ { name, ... }, { name, ... } ];  // mind. 2 unterscheidbare Looks (P1, P2), gern 4
export function createPlayerModel(index) => {
  object3D,                // Group, Füße bei y=0, schaut nach +Z, Höhe ~1.75 m
  height: 1.75, radius: 0.35,
  animate(dt, s),          // s = { speed, maxSpeed, grounded, vy, turn, landImpact (0..1, einmalig >0 im Landeframe), sprint: bool }
  playAction(name),        // 'chop' (Axtschlag) | 'wave'. Gibt { duration, impactAt } in Sekunden zurück.
  actionActive: bool,      // getter
}
```
Prozedurale Animation: Idle-Atmen, Gehen/Laufen (Schrittfrequenz an speed gekoppelt, Arme gegengleich), Sprung (Anhocken/Strecken je nach vy), Fallen, Landen (Squash), Vorlehnen beim Beschleunigen, Seitlehnen bei turn. Axt in der Hand.

## js/world.js  (Agent „Welt“)

```js
export function createWorld(scene, { seed }) => {
  radius,                          // Insel-Radius ~ 220 m (großzügig, viel Platz)
  waterLevel: 0,
  heightAt(x, z),                  // nur Terrain
  groundAt(x, z, footY),           // höchste begehbare Fläche unter footY+0.45 (Terrain, liegende Stämme, Felsen-Tops)
  collide(pos, radius, height, vel?) // schiebt pos (Vector3, Fuß) horizontal aus Stämmen/Felsen/liegenden Logs; vel optional zum
                                   //  Anschieben von Logs (leichte Physik). Rückgabe: Anzahl Kontakte.
  hitTree(origin, dir, reach, dmg) // Axtschlag: trifft stehende Bäume ODER liegende Logs im Kegel vor origin.
                                   //  Rückgabe { hit:bool, kind:'tree'|'log'|null, felled:bool, point }
  spawnPoints: [Vector3, Vector3], // 2 Spielerstarts nebeneinander am Strand/Wiese
  randomLandPoint(r),              // r = rng(); Punkt auf Land (Höhe > 1.5), für Tierspawns
  update(dt, players),             // players = [{pos, vel}] (für Log-Anschieben/Partikel optional)
  stats(),                         // { trees, logs, wood }
  sun                              // DirectionalLight (Main kümmert sich um Shadow-Kamera-Follow)
}
```
Bäume: mehrere Arten (Kiefer, Laubbaum, Birke…), mid-poly. Treffer: Baum wackelt + Späne-Partikel. Gefällt: kippt mit Scharnier-Physik
(Drehmoment durch Schwerkraft) vom Schlagenden weg, schlägt auf, zerfällt in 2–4 Stamm-Segmente + Krone zerfällt (Blätter-Puff), Stumpf bleibt.
Segmente: leichte eigene Physik (kein Physik-Lib): rollen hangabwärts, rutschen, Reibung, kollidieren grob miteinander, kommen zur Ruhe,
lassen sich vom Spieler schieben. Log treffen → teilt sich, bis zu kurz → wird zu „Holz“ (wood++) mit Puff.
Außerdem: Terrain mit Vertex-Farben (Sand/Gras/Fels/Erde), sanfte Hügel + ein größerer Hügel/Fels, Wasser mit Wellen-Vertex-Shader,
Felsen, Büsche, Gras-Büschel (Instancing), Blumen. Fog + Himmel (Gradient-Kuppel). Performance: Splitscreen = 2× rendern.
