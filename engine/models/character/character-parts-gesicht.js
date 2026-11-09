/**
 * @modul    character-parts-gesicht
 * @zweck    Bewegliches Figuren-Gesicht im Knochen kopf: Iris/Pupillen (Blick), Lider (Blinzeln, Öffnung), Brauen + Mund je Gesichtsausdruck – nur 3 kleine Meshes
 * @api      AUSDRUCK_DATEN ; createGesicht(ctx, { seed, material, schatten }) -> { gruppe, meshes, ausdruck, setAusdruck(name), setLider(zu), blinzeln(dauer), setBlick(x,y), update(dt), dispose() }
 * @beispiel
 *   import { createGesicht } from '../../engine/models/character/character-parts-gesicht.js';
 *   const g = createGesicht(teilKontext(look, masse, { mimik: true }), { seed: 3 });
 *   rig.knochen.kopf.add(g.gruppe);
 *   g.setAusdruck('froh'); g.setBlick(0.5, 0);   // pro Frame: g.update(dt) → automatisches Blinzeln
 * @tags     figur, charakter, gesicht, mimik, augen, blinzeln, ausdruck, emotion, blick
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 *
 * Normalerweise über character-model benutzt (model.setAusdruck usw.). Der Kopf selbst muss mit ctx.mimik = true gebaut
 * sein (nur Augäpfel), sonst liegen festes und bewegliches Gesicht übereinander.
 * Lider: zu = 0 offen … 1 geschlossen. Effektive Öffnung = Ausdruck.offen · (1 − max(setLider, Blinzeln)).
 */
import * as THREE from 'three';
import { rng, range, hashSeed } from '../../core/rng.js';
import { clamp, lerp } from '../../core/math.js';
import { createMeshBuilder, standardMaterial } from '../../render/mesh-builder.js';
import { AUSDRUECKE } from './character-look.js';
import { AUGE } from './character-parts-kopf.js';
import { farbeMisch, dunkler } from './character-parts-basis.js';

const PI = Math.PI;

/** Je Ausdruck: Lid-Öffnung (1 = normal), Brauen [Höhe ×R, Neigung (+ = innen tief/böse)], Mundform. */
export const AUSDRUCK_DATEN = Object.freeze({
  neutral: { offen: 1, braue: [0, 0.15], mund: 'gerade' },
  froh: { offen: 0.8, braue: [0.04, 0.05], mund: 'laecheln' },
  wuetend: { offen: 0.72, braue: [-0.07, 0.55], mund: 'grimmig' },
  traurig: { offen: 0.72, braue: [0.03, -0.4], mund: 'traurig' },
  ueberrascht: { offen: 1.2, braue: [0.14, 0.05], mund: 'o' },
  schlafend: { offen: 0, braue: [-0.03, 0.1], mund: 'klein' },
});

const LID_ZU = PI / 2, LID_AUF = -0.7;      // Drehung der Lid-Kappe um X: π/2 = Kappe vor dem Auge

/** Brauen + Mund eines Ausdrucks in Kopf-Koordinaten (wie baueKopf). */
function baueMimik(b, K, name) {
  const { R, f } = K, d = AUSDRUCK_DATEN[name], braue = dunkler(f.haar, 0.1);
  const mund = farbeMisch(f.haut, 0x5a1a1a, 0.6), innen = 0x3a1010;
  for (const s of [-1, 1]) b.box(R * 0.3, R * 0.07, R * 0.08, braue, { x: s * R * 0.36, y: R * (1.27 + d.braue[0]), z: R * 0.88, rz: s * d.braue[1] });
  const z = R * 0.9, bog = 1.5;
  if (d.mund === 'gerade') b.box(R * 0.24, R * 0.045, R * 0.05, mund, { y: R * 0.52, z });
  else if (d.mund === 'klein') b.box(R * 0.13, R * 0.035, R * 0.05, mund, { y: R * 0.52, z });
  else if (d.mund === 'laecheln') {
    b.torus(R * 0.15, R * 0.028, mund, { y: R * 0.64, z: z - R * 0.02, rz: -PI / 2 - bog / 2, sz: 0.6 }, 3, 8, bog);
    b.sphere(R * 0.09, innen, { y: R * 0.52, z: z - R * 0.025, sy: 0.35, sz: 0.4, jitter: 0 }, 6, 3);
  } else if (d.mund === 'traurig') b.torus(R * 0.15, R * 0.026, mund, { y: R * 0.38, z: z - R * 0.02, rz: PI / 2 - bog / 2, sz: 0.6 }, 3, 8, bog);
  else if (d.mund === 'grimmig') {
    b.box(R * 0.18, R * 0.035, R * 0.05, mund, { y: R * 0.52, z });
    for (const s of [-1, 1]) b.box(R * 0.07, R * 0.03, R * 0.05, mund, { x: s * R * 0.12, y: R * 0.505, z: z - R * 0.005, rz: s * 0.5 });
  } else if (d.mund === 'o') {
    b.torus(R * 0.06, R * 0.022, mund, { y: R * 0.5, z, sx: 0.85 }, 3, 10);
    b.sphere(R * 0.06, innen, { y: R * 0.5, z: z - R * 0.015, sx: 0.85, sz: 0.3, jitter: 0 }, 6, 4);
  }
  return b;
}

/**
 * ctx = teilKontext(look, masse, { mimik: true }). opts: { seed = 1, material = standardMaterial(), schatten = true (nur receiveShadow) }
 * Startausdruck = ctx.L.ausdruck.
 */
export function createGesicht(K, { seed = 1, material = null, schatten = true } = {}) {
  const mat = material || standardMaterial(), R = K.R, re = R * AUGE.r, f = K.f;
  const gruppe = new THREE.Group();
  gruppe.name = 'gesicht';
  const pivot = new THREE.Group();                               // Augenmitte, Tiefe gestaucht wie der Augapfel
  pivot.position.set(0, R * AUGE.y, R * AUGE.z);
  pivot.scale.set(1, 1, AUGE.sz);
  gruppe.add(pivot);
  const neu = (b, name, eltern) => {
    const m = b.mesh(mat);
    m.name = name; m.castShadow = false; m.receiveShadow = schatten; m.userData.gesicht = true;
    eltern.add(m);
    return m;
  };
  const pb = createMeshBuilder({ seed: hashSeed(seed, 'pupillen') }), lb = createMeshBuilder({ seed: hashSeed(seed, 'lider') });
  const lid = farbeMisch(f.haut, 0x000000, 0.08), wimper = dunkler(f.haar, 0.35);
  for (const s of [-1, 1]) {
    const x = s * R * AUGE.x;
    pb.sphere(re * 0.62, f.augen, { x, z: re * 0.8, sz: 0.45, jitter: 0 }, 7, 4);                          // Iris
    pb.sphere(re * 0.3, 0x0a0a0e, { x, z: re * 0.98, sz: 0.4, jitter: 0 }, 5, 3);                          // Pupille
    pb.sphere(re * 0.14, 0xffffff, { x: x - re * 0.22, y: re * 0.22, z: re * 1.05, jitter: 0 }, 4, 2);       // Glanz
    const geo = new THREE.SphereGeometry(re * 1.25, 8, 3, 0, 2 * PI, 0, PI / 2);                          // Lid-Kappe (obere Halbkugel)
    lb.add(geo, lid, { x, jitter: 0.03 }); geo.dispose();
    lb.torus(re * 1.25, re * 0.1, wimper, { x, rx: PI / 2, jitter: 0 }, 3, 6, PI);                          // Lidkante vorn
  }
  const pupillen = neu(pb, 'pupillen', pivot), lider = neu(lb, 'lider', pivot);
  const cache = new Map();
  const mimikGeo = (name) => {
    if (!cache.has(name)) cache.set(name, baueMimik(createMeshBuilder({ seed: hashSeed(seed, 'mimik', name) }), K, name).geometry());
    return cache.get(name);
  };
  const mimik = new THREE.Mesh(mimikGeo('neutral'), mat);
  mimik.name = 'mimik'; mimik.castShadow = false; mimik.receiveShadow = schatten; mimik.userData.gesicht = true;
  gruppe.add(mimik);

  const r = rng(hashSeed(seed, 'blinzeln'));
  let zuExtra = 0, blink = -1, blinkDauer = 0.16, naechstes = range(r, 1, 4);
  const g = { gruppe, meshes: [pupillen, lider, mimik], ausdruck: 'neutral', autoBlinzeln: true };
  const lidStellen = () => {
    const amt = blink >= 0 ? Math.sin(PI * clamp(blink / blinkDauer, 0, 1)) : 0;
    const offen = AUSDRUCK_DATEN[g.ausdruck].offen * (1 - Math.max(zuExtra, amt));
    lider.rotation.x = lerp(LID_ZU, LID_AUF, offen);
  };
  /** Ausdruck setzen (Name aus AUSDRUECKE; Unbekanntes → neutral). */
  g.setAusdruck = (name) => {
    g.ausdruck = AUSDRUECKE.includes(name) ? name : 'neutral';
    mimik.geometry = mimikGeo(g.ausdruck);
    lidStellen();
    return g;
  };
  /** Lider zusätzlich schließen: 0 = wie Ausdruck … 1 = zu (müde, zwinkern). */
  g.setLider = (zu) => { zuExtra = clamp(+zu || 0, 0, 1); lidStellen(); return g; };
  /** Einmal blinzeln (Dauer in s); läuft über update(dt). */
  g.blinzeln = (dauer = 0.16) => { blink = 0; blinkDauer = Math.max(0.04, dauer); lidStellen(); return g; };
  /** Blickrichtung der Pupillen: x −1…1 (+ = zur linken Seite der Figur, +X), y −1…1 (+ = hoch). */
  g.setBlick = (x = 0, y = 0) => {
    pupillen.position.set(clamp(+x || 0, -1, 1) * re * 0.24, clamp(+y || 0, -1, 1) * re * 0.18, 0);
    return g;
  };
  /** Pro Frame: Blinzeln weiterlaufen lassen, automatisch alle 2–6 s blinzeln (außer schlafend / autoBlinzeln = false). */
  g.update = (dt = 0) => {
    if (blink >= 0) { blink += dt; if (blink >= blinkDauer) blink = -1; lidStellen(); }
    if (g.autoBlinzeln && g.ausdruck !== 'schlafend' && (naechstes -= dt) <= 0) { naechstes = range(r, 2, 6); g.blinzeln(); }
    return g;
  };
  g.dispose = () => {
    gruppe.removeFromParent();
    pupillen.geometry.dispose(); lider.geometry.dispose();
    for (const geo of cache.values()) geo.dispose();
    cache.clear();
  };
  return g.setAusdruck(K.L.ausdruck);
}
