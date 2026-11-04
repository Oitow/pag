// Viniland – Spielerfiguren: nordisch-cozy Siedler im Mid-Poly-PS1/PS2-Stil mit prozeduralem Rig.
// Vertrag: siehe CONTRACT.md (js/players.js). Ursprung an den Füßen, Blick +Z, Höhe ~1.75 m.
import * as THREE from 'three';
import { MeshBuilder, clamp, lerp, damp } from './kit.js';
import { psxMat } from './psx.js';

export const PLAYER_LOOKS = [
  { name: 'Bjørn', skin: 0xf0b58a, hair: 0x8a4b22, beard: 'full', braids: false, hat: 'beanie', hatCol: 0xd6452f, hatTrim: 0xf2e2c4,
    tunic: 0x4f8a3c, trim: 0xe8c15a, cloak: 0x7a5132, fur: 0xd9c3a0, pants: 0x5a4636, boots: 0x4a2f1e, belt: 0x3a2618, bag: 0x9a6a3a, width: 1.1 },
  { name: 'Sigrun', skin: 0xf6c9a4, hair: 0xf1d27a, beard: null, braids: true, hat: 'hood', hatCol: 0x2f6fb5, hatTrim: 0xf4efe6,
    tunic: 0xe6dcc4, trim: 0x2f6fb5, cloak: 0x2f6fb5, fur: 0xf4efe6, pants: 0x3b4a6b, boots: 0x6b4128, belt: 0x5a3a22, bag: 0xc08a50, width: 0.94 },
  { name: 'Ulf', skin: 0xe8a882, hair: 0xe2e0d8, beard: 'long', braids: false, hat: 'flaps', hatCol: 0x9a6e3a, hatTrim: 0xe8d8b8,
    tunic: 0xd9a232, trim: 0x8a3a2a, cloak: 0x5d6b3a, fur: 0xa88a64, pants: 0x4a4038, boots: 0x3a2a1e, belt: 0x2e2018, bag: 0x7a5a3a, width: 1.14 },
  { name: 'Freya', skin: 0xf2c09a, hair: 0xc2482a, beard: null, braids: true, hat: 'band', hatCol: 0x58a85a, hatTrim: 0xf0d060,
    tunic: 0x8a3f72, trim: 0xf0d060, cloak: 0x3f6b4a, fur: 0xcfb48e, pants: 0x4a3a52, boots: 0x5a3622, belt: 0x3a2618, bag: 0xb07840, width: 0.95 },
  { name: 'Toke', skin: 0xdba07a, hair: 0x5a3a22, beard: null, braids: false, hat: 'beanie', hatCol: 0xe8a032, hatTrim: 0x7a4a9a,
    tunic: 0xb5552f, trim: 0xf2e2c4, cloak: 0x8a8f96, fur: 0xe8e0d0, pants: 0x3e4a3a, boots: 0x4a2f1e, belt: 0x2e2018, bag: 0x8a6a4a, width: 1.0 },
];

// ---- Maße ----
const HIP = 0.9, THIGH = 0.41, SHIN = 0.41, LEG = THIGH + SHIN;
const NECK_Y = 0.5, SH_Y = 0.43, SH_X = 0.2, UPPER = 0.27, FORE = 0.24;

const hemi = (r, ws = 10, hs = 4) => new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, Math.PI / 2);
const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---- Geometrie pro Knochen ----
function buildPelvis(L) {
  const b = new MeshBuilder(), w = L.width;
  b.cyl(0.165 * w, 0.205 * w, 0.24, L.tunic, { y: -0.04, sz: 0.8 }, 9);          // Tunika-Saum
  b.cyl(0.21 * w, 0.215 * w, 0.035, L.trim, { y: -0.155, sz: 0.8 }, 9);           // Borte
  b.cyl(0.17 * w, 0.17 * w, 0.06, L.belt, { y: 0.06, sz: 0.8 }, 9);               // Gürtel
  b.box(0.06, 0.05, 0.02, L.trim, { y: 0.06, z: 0.138 * w });                     // Schnalle
  b.box(0.12, 0.13, 0.07, L.bag, { x: 0.15 * w, y: -0.01, z: 0.07, ry: 0.5 });     // Gürteltasche
  b.box(0.13, 0.04, 0.08, L.belt, { x: 0.15 * w, y: 0.055, z: 0.07, ry: 0.5 });
  b.box(0.04, 0.16, 0.035, L.belt, { x: -0.16 * w, y: -0.06, z: -0.04, rz: 0.15 }); // Axt-Schlaufe
  return b.mesh();
}
function buildTorso(L) {
  const b = new MeshBuilder(), w = L.width;
  b.cyl(0.18 * w, 0.165 * w, 0.44, L.tunic, { y: 0.24, sz: 0.74 }, 9);
  b.sphere(0.16 * w, L.tunic, { y: 0.12, z: 0.02, sz: 0.72 }, 8, 6);            // gemütlicher Bauch
  b.box(0.05, 0.36, 0.02, L.trim, { y: 0.24, z: 0.125 * w, rx: -0.05 });         // Knopfleiste/Borte
  for (let i = 0; i < 3; i++) b.sphere(0.014, L.belt, { y: 0.12 + i * 0.1, z: 0.14 * w }, 5, 3);
  b.add(new THREE.TorusGeometry(0.15 * w, 0.065, 5, 10), L.fur, { y: 0.45, rx: Math.PI / 2, sz: 0.8, sx: 1 }); // Fellkragen
  b.cyl(0.06, 0.07, 0.1, L.skin, { y: 0.5 }, 7);                                // Hals
  b.sphere(0.085, L.fur, { x: SH_X * w + 0.01, y: SH_Y + 0.02, sy: 0.7 }, 6, 4);  // Schulterfell
  b.sphere(0.085, L.fur, { x: -SH_X * w - 0.01, y: SH_Y + 0.02, sy: 0.7 }, 6, 4);
  return b.mesh();
}
function buildCape(L) {
  const b = new MeshBuilder(), w = L.width;
  b.add(new THREE.CylinderGeometry(0.2 * w, 0.27 * w, 0.66, 9, 1, true, Math.PI * 0.6, Math.PI * 0.8), L.cloak, { y: -0.31, z: 0.08, sz: 0.7 });
  b.box(0.4 * w, 0.045, 0.06, L.fur, { y: -0.63, z: -0.12 });                    // Fellsaum
  return b.mesh(psxMat({ side: THREE.DoubleSide }));
}
function buildHead(L) {
  const b = new MeshBuilder();
  const R = 0.165;
  b.sphere(R, L.skin, { y: 0.16, sy: 1.04 }, 10, 8);
  // Haare hinten/seitlich
  b.sphere(R * 1.04, L.hair, { y: 0.18, z: -0.035, sz: 0.95 }, 9, 6);
  // Gesicht: große freundliche Augen
  for (const s of [-1, 1]) {
    b.sphere(0.034, 0x2a1a14, { x: s * 0.062, y: 0.165, z: 0.142, sz: 0.45, sy: 1.15 }, 6, 5);
    b.sphere(0.011, 0xffffff, { x: s * 0.062 + 0.01, y: 0.18, z: 0.158 }, 4, 3);
    b.box(0.055, 0.016, 0.02, L.hair, { x: s * 0.065, y: 0.218, z: 0.145, rz: -s * 0.12 });  // Brauen
    b.sphere(0.03, 0xf08a7a, { x: s * 0.1, y: 0.115, z: 0.12, sz: 0.4 }, 5, 3);               // Bäckchen
  }
  b.sphere(0.032, L.skin, { y: 0.125, z: 0.165, sy: 0.9 }, 6, 4);                // Nase
  if (L.beard === 'full') {
    b.sphere(0.13, L.hair, { y: 0.045, z: 0.07, sy: 1.0, sz: 0.75 }, 8, 6);
    b.box(0.13, 0.03, 0.04, L.hair, { y: 0.1, z: 0.155 });                         // Schnurrbart
  } else if (L.beard === 'long') {
    b.cone(0.12, 0.3, L.hair, { y: -0.02, z: 0.08, rx: Math.PI, sz: 0.7 }, 8);
    b.sphere(0.12, L.hair, { y: 0.07, z: 0.075, sz: 0.7 }, 8, 5);
    b.box(0.15, 0.03, 0.04, L.hair, { y: 0.1, z: 0.155, rz: 0 });
  } else {
    b.box(0.05, 0.014, 0.01, 0x8a3a30, { y: 0.075, z: 0.158 });                    // Lächeln
  }
  if (L.braids) for (const s of [-1, 1]) {
    b.capsule(0.035, 0.24, L.hair, { x: s * 0.14, y: -0.02, z: -0.03, rz: s * 0.08 }, 2, 6);
    b.cyl(0.04, 0.04, 0.03, L.hatTrim, { x: s * 0.15, y: -0.13, z: -0.03 }, 6);
    b.sphere(0.04, L.hair, { x: s * 0.152, y: -0.17, z: -0.03 }, 5, 4);
  }
  // Kopfbedeckung
  if (L.hat === 'beanie') {
    b.add(hemi(R * 1.07), L.hatCol, { y: 0.2, sy: 1.05 });
    b.cyl(R * 1.1, R * 1.1, 0.06, L.hatTrim, { y: 0.215 }, 10);
    b.cyl(R * 1.05, R * 1.06, 0.025, L.hatCol, { y: 0.26 }, 10, 1);
    b.sphere(0.055, L.hatTrim, { y: 0.39 }, 6, 5);                                // Bommel
  } else if (L.hat === 'hood') {
    b.add(hemi(R * 1.2), L.hatCol, { y: 0.17, z: -0.01 });
    b.add(hemi(R * 1.2), L.hatCol, { y: 0.17, z: -0.01, rx: -Math.PI / 2 });
    b.add(new THREE.TorusGeometry(R * 1.12, 0.03, 4, 12), L.hatTrim, { y: 0.17, z: 0.03, sy: 1.08 });
    b.cone(0.07, 0.22, L.hatCol, { y: 0.24, z: -0.24, rx: -2.0 }, 6);              // Zipfel
  } else if (L.hat === 'flaps') {
    b.add(hemi(R * 1.08), L.hatCol, { y: 0.19, sy: 0.95 });
    b.cyl(R * 1.1, R * 1.1, 0.05, L.hatTrim, { y: 0.2 }, 10);
    for (const s of [-1, 1]) b.box(0.05, 0.13, 0.1, L.hatTrim, { x: s * 0.165, y: 0.12, rz: s * 0.1 });
    b.cone(0.03, 0.06, L.hatTrim, { y: 0.375 }, 5);
  } else if (L.hat === 'band') {
    b.add(hemi(R * 1.06), L.hair, { y: 0.17 });
    b.cyl(R * 1.07, R * 1.07, 0.04, L.hatCol, { y: 0.24 }, 10);
    b.sphere(0.03, L.hatTrim, { x: 0.1, y: 0.25, z: 0.12 }, 5, 4);                // Blümchen
    b.sphere(0.022, 0xffffff, { x: 0.12, y: 0.26, z: 0.115 }, 4, 3);
  }
  return b.mesh();
}
function buildUpper(L) {
  const b = new MeshBuilder();
  b.cyl(0.062, 0.055, UPPER, L.tunic, { y: -UPPER / 2 }, 7);
  b.sphere(0.064, L.tunic, { y: -0.01 }, 7, 5);
  return b.mesh();
}
function buildFore(L) {
  const b = new MeshBuilder();
  b.sphere(0.055, L.tunic, {}, 6, 4);
  b.cyl(0.052, 0.045, FORE - 0.02, L.tunic, { y: -FORE / 2 }, 7);
  b.cyl(0.058, 0.058, 0.05, L.fur, { y: -FORE + 0.03 }, 7);                     // Fellstulpe
  return b.mesh();
}
function buildHand(L) {
  const b = new MeshBuilder();
  b.sphere(0.052, L.skin, { y: -0.04, sx: 0.85, sz: 1.05 }, 6, 5);
  b.sphere(0.022, L.skin, { y: -0.03, z: 0.04, x: 0.0 }, 4, 3);                 // Daumen
  return b.mesh();
}
function buildAxe(L) {
  // Lokal: Griff entlang +Y (Griffpunkt bei 0), Schneide zeigt nach +Z.
  const b = new MeshBuilder();
  b.cyl(0.017, 0.021, 0.66, 0x8a5a32, { y: 0.22 }, 6);
  b.cyl(0.024, 0.024, 0.1, L.belt, { y: -0.02 }, 6);                             // Lederwicklung
  b.sphere(0.026, 0x6a4022, { y: -0.11 }, 5, 3);                                 // Knauf
  b.box(0.04, 0.09, 0.08, 0x6c6f78, { y: 0.5, z: 0.02 });                        // Haus
  b.box(0.026, 0.1, 0.1, 0x8d929c, { y: 0.49, z: 0.1 });                         // Blatt
  b.box(0.018, 0.15, 0.035, 0xd8dde4, { y: 0.48, z: 0.16, jitter: 0.02 });       // Schneide (hell)
  b.box(0.036, 0.05, 0.04, 0x55585f, { y: 0.5, z: -0.045 });                     // Nacken
  return b.mesh();
}
function buildThigh(L) {
  const b = new MeshBuilder(), w = L.width;
  b.cyl(0.088 * w, 0.072, THIGH, L.pants, { y: -THIGH / 2 }, 7);
  b.sphere(0.075, L.pants, { y: -THIGH }, 6, 4);
  return b.mesh();
}
function buildShin(L) {
  const b = new MeshBuilder();
  b.cyl(0.066, 0.055, SHIN, L.pants, { y: -SHIN / 2 }, 7);
  b.cyl(0.07, 0.064, 0.24, L.boots, { y: -SHIN + 0.12 }, 7);                     // Stiefelschaft
  b.cyl(0.085, 0.08, 0.06, L.fur, { y: -SHIN + 0.24 }, 7);                       // Fellstulpe
  for (let i = 0; i < 2; i++) b.cyl(0.069, 0.069, 0.015, L.belt, { y: -SHIN + 0.07 + i * 0.07 }, 7); // Wickelband
  return b.mesh();
}
function buildFoot(L) {
  const b = new MeshBuilder();
  b.box(0.11, 0.075, 0.21, L.boots, { y: -0.025, z: 0.04 });
  b.sphere(0.058, L.boots, { y: -0.03, z: 0.14, sy: 0.65, sx: 0.95 }, 6, 4);    // runde Kappe
  b.box(0.115, 0.02, 0.22, 0x2a1c12, { y: -0.055, z: 0.04 });                   // Sohle
  return b.mesh();
}

// ---- Aktionen ----
// Keyframes für den Oberkörper (Zeit in s). wr/wy = Axt-Kippung im Handgelenk (Euler YXZ), tx/ty = Torso, crouch = Hocke.
// fast = Index des Segments, das mit ease-in beschleunigt (der eigentliche Schlag).
const REST = { rsx: -0.4, rsz: -0.1, rel: -0.4, wr: 1.42, wy: 0, lsx: -0.3, lsz: 0.2, lel: -0.4, tx: 0, ty: 0, crouch: 0 };
const K = (t, o) => ({ ...REST, ...o, t });
const PI = Math.PI;
const ACTIONS = {
  chop: { duration: 0.55, impactAt: 0.28, fast: 1, keys: [
    K(0.0, { rsx: -0.6, rsz: -0.15, rel: -0.5, wr: 1.7, lsx: -0.5, lsz: 0.2, lel: -0.6 }),
    K(0.19, { rsx: -2.75, rsz: -0.25, rel: -1.25, wr: 2.1, lsx: -2.3, lsz: 0.35, lel: -1.2, tx: -0.2, ty: -0.38, crouch: 0.02 }),
    K(0.28, { rsx: -1.05, rsz: -0.05, rel: -0.12, wr: 3.0, lsx: -1.1, lsz: 0.45, lel: -0.35, tx: 0.32, ty: 0.18, crouch: 0.09 }),
    K(0.36, { rsx: -0.85, rsz: -0.05, rel: -0.18, wr: 2.95, lsx: -0.9, lsz: 0.4, lel: -0.4, tx: 0.36, ty: 0.22, crouch: 0.08 }),
    K(0.55, { rsx: -0.4, rsz: -0.1, rel: -0.4, wr: 1.8, lsx: -0.3, lsz: 0.2, lel: -0.4, tx: 0.1, ty: 0.05 }),
  ] },
  // Vorhand: waagerechter Schwung rechts -> links
  attack1: { duration: 0.5, impactAt: 0.2, fast: 1, keys: [
    K(0.0, {}),
    K(0.12, { rsx: -1.25, rsz: -1.55, rel: -0.7, wr: PI, wy: -PI / 2, lsx: -0.9, lsz: 0.55, lel: -1.2, ty: -0.65, tx: 0.05, crouch: 0.04 }),
    K(0.2, { rsx: -1.5, rsz: 0.25, rel: -0.08, wr: PI, wy: -PI / 2, lsx: -0.3, lsz: 0.9, lel: -0.5, ty: 0.4, tx: 0.18, crouch: 0.07 }),
    K(0.3, { rsx: -1.3, rsz: 0.85, rel: -0.3, wr: PI, wy: -PI / 2, lsx: -0.2, lsz: 0.8, lel: -0.5, ty: 0.62, tx: 0.15, crouch: 0.06 }),
    K(0.5, { rsx: -0.6, rsz: 0.1, rel: -0.5, wr: 1.6, lsx: -0.3, lsz: 0.3, ty: 0.15, tx: 0.05 }),
  ] },
  // Rückhand: links -> rechts, leicht aufsteigend
  attack2: { duration: 0.5, impactAt: 0.2, fast: 1, keys: [
    K(0.0, { rsx: -0.9, rsz: 0.6, rel: -0.6, wr: PI, wy: -PI / 2, ty: 0.4, tx: 0.1 }),
    K(0.11, { rsx: -1.2, rsz: 1.05, rel: -1.35, wr: PI, wy: PI / 2, lsx: -0.6, lsz: 0.2, lel: -1.1, ty: 0.7, tx: 0.08, crouch: 0.05 }),
    K(0.2, { rsx: -1.75, rsz: -0.75, rel: -0.05, wr: PI, wy: PI / 2, lsx: -0.4, lsz: 0.7, lel: -0.4, ty: -0.45, tx: 0.12, crouch: 0.07 }),
    K(0.3, { rsx: -1.9, rsz: -1.35, rel: -0.2, wr: PI, wy: PI / 2, lsx: -0.3, lsz: 0.75, lel: -0.5, ty: -0.62, tx: 0.08, crouch: 0.05 }),
    K(0.5, { rsx: -0.6, rsz: -0.4, rel: -0.5, wr: 1.6, ty: -0.12 }),
  ] },
  // Finisher: großer Überkopf-Hieb mit beiden Händen
  attack3: { duration: 0.75, impactAt: 0.36, fast: 1, keys: [
    K(0.0, { rsx: -0.7, rsz: -0.3, rel: -0.6, wr: 1.8, ty: -0.3 }),
    K(0.24, { rsx: -3.0, rsz: -0.2, rel: -1.35, wr: 2.2, lsx: -2.7, lsz: 0.3, lel: -1.3, tx: -0.32, ty: -0.25, crouch: 0.0 }),
    K(0.36, { rsx: -0.8, rsz: -0.05, rel: -0.05, wr: 3.1, lsx: -0.95, lsz: 0.4, lel: -0.25, tx: 0.55, ty: 0.12, crouch: 0.17 }),
    K(0.5, { rsx: -0.7, rsz: -0.05, rel: -0.1, wr: 3.05, lsx: -0.85, lsz: 0.4, lel: -0.3, tx: 0.5, ty: 0.14, crouch: 0.15 }),
    K(0.75, { rsx: -0.45, rsz: -0.1, rel: -0.4, wr: 1.7, tx: 0.08 }),
  ] },
  // Fernzauber: linke Hand zieht zurück und stößt nach vorne
  cast1: { duration: 0.48, impactAt: 0.2, fast: 1, keys: [
    K(0.0, {}),
    K(0.13, { lsx: 0.35, lsz: 0.5, lel: -1.6, ty: -0.55, tx: -0.08, rsx: -0.2, rsz: -0.4 }),
    K(0.2, { lsx: -1.6, lsz: -0.12, lel: -0.02, ty: 0.38, tx: 0.16, rsx: -0.1, rsz: -0.5, crouch: 0.05 }),
    K(0.32, { lsx: -1.55, lsz: -0.1, lel: -0.05, ty: 0.35, tx: 0.12, rsx: -0.1, rsz: -0.5, crouch: 0.04 }),
    K(0.48, {}),
  ] },
  // Nahbereichs-AoE: Arme hoch, dann Stoß nach unten/außen
  cast2: { duration: 0.72, impactAt: 0.34, fast: 1, keys: [
    K(0.0, {}),
    K(0.24, { lsx: -2.85, lsz: 0.35, lel: -0.3, rsx: -2.85, rsz: -0.35, rel: -0.3, wr: 1.2, tx: -0.22, crouch: -0.02 }),
    K(0.34, { lsx: -0.55, lsz: 1.25, lel: -0.05, rsx: -0.55, rsz: -1.25, rel: -0.05, wr: 1.6, tx: 0.42, crouch: 0.22 }),
    K(0.5, { lsx: -0.5, lsz: 1.2, lel: -0.1, rsx: -0.5, rsz: -1.2, rel: -0.1, wr: 1.6, tx: 0.38, crouch: 0.2 }),
    K(0.72, {}),
  ] },
  // Getroffen: Rumpf schnappt zurück, Arme fliegen hoch
  hurt: { duration: 0.42, impactAt: 0, fast: -1, keys: [
    K(0.0, {}),
    K(0.07, { tx: -0.5, ty: 0.25, lsx: -1.0, lsz: 0.9, lel: -1.0, rsx: -1.0, rsz: -0.9, rel: -1.0, crouch: 0.06 }),
    K(0.2, { tx: -0.2, ty: 0.1, lsx: -0.5, lsz: 0.5, lel: -0.7, rsx: -0.6, rsz: -0.5, crouch: 0.04 }),
    K(0.42, {}),
  ] },
  wave: { duration: 1.6, impactAt: 0.5 },
  roll: { duration: 0.55, impactAt: 0 },
  death: { duration: 1.1, impactAt: 0.75 },
};

function sampleKeys(keys, t, fast) {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i], b = keys[i + 1];
  let u = clamp((t - a.t) / (b.t - a.t), 0, 1);
  u = i === fast ? u * u * u : u * u * (3 - 2 * u);   // Schlag beschleunigt (ease-in), Rest weich
  const o = {};
  for (const k in a) if (k !== 't') o[k] = lerp(a[k], b[k], u);
  return o;
}

// ---- Modell ----
export function createPlayerModel(index = 0) {
  const n = PLAYER_LOOKS.length;
  const L = PLAYER_LOOKS[((index % n) + n) % n];
  const w = L.width;

  const root = new THREE.Group(); root.name = 'player_' + L.name;
  const ROLL_Y = 0.55;
  const rollG = grp(root, 0, ROLL_Y, 0);         // Pivot für Ausweichrolle (Körpermitte)
  const body = grp(rollG, 0, -ROLL_Y, 0);        // Squash + Seitlehnen (Pivot an den Füßen)
  const hips = grp(body, 0, HIP, 0); hips.add(buildPelvis(L));
  const torso = grp(hips, 0, 0.05, 0); torso.add(buildTorso(L));
  const cape = grp(torso, 0, 0.47, -0.1); cape.add(buildCape(L));
  const neck = grp(torso, 0, NECK_Y, 0.005);
  const head = grp(neck); head.add(buildHead(L));

  const arm = {};
  for (const [key, s] of [['l', 1], ['r', -1]]) {
    const sh = grp(torso, s * SH_X * w, SH_Y, 0); sh.add(buildUpper(L));
    const el = grp(sh, 0, -UPPER, 0); el.add(buildFore(L));
    const hand = grp(el, 0, -FORE, 0); hand.add(buildHand(L));
    arm[key] = { sh, el, hand };
  }
  const axe = grp(arm.r.hand, 0, -0.045, 0.0); axe.add(buildAxe(L)); axe.rotation.order = 'YXZ';
  const blade = grp(axe, 0, 0.49, 0.16);        // Schneide (für Hitbox/FX)

  const leg = {};
  for (const [key, s] of [['l', 1], ['r', -1]]) {
    const th = grp(hips, s * 0.1 * w, -0.02, 0); th.add(buildThigh(L));
    const kn = grp(th, 0, -THIGH, 0); kn.add(buildShin(L));
    const ft = grp(kn, 0, -SHIN, 0); ft.add(buildFoot(L));
    leg[key] = { th, kn, ft };
  }

  // ---- Zustand ----
  const st = {
    t: Math.random() * 10, phase: 0, spd: 0, runF: 0, sprintW: 0, lean: 0, turnLean: 0,
    air: 0, rise: 0, land: 0, landV: 0, cape: 0.1, capeV: 0, lastSpeed: 0, accel: 0,
    headY: 0,
  };
  let action = null, actionT = 0;
  // Pose-Überblendung zwischen Aktionen (Combo-Ketten ohne Springen)
  const POSE_KEYS = ['lsx', 'lsz', 'lel', 'rsx', 'rsz', 'rel', 'wr', 'wy', 'tx', 'ty', 'crouch'];
  const last = {}, from = {}; for (const k of POSE_KEYS) last[k] = from[k] = 0;
  let fadeT = 0; const FADE = 0.12;

  /** 'chop'|'wave'|'attack1'|'attack2'|'attack3'|'roll'|'cast1'|'cast2'|'hurt'|'death' → { duration, impactAt } */
  function playAction(name) {
    const A = ACTIONS[name];
    if (!A) return { duration: 0, impactAt: 0 };
    if (action && action !== 'death') { for (const k of POSE_KEYS) from[k] = last[k]; fadeT = FADE; } else fadeT = 0;
    action = name; actionT = 0;
    return { duration: A.duration, impactAt: A.impactAt };
  }
  function cancelAction() { action = null; actionT = 0; fadeT = 0; }

  // Bein-Pose: Hüfte senkt sich um d -> symmetrischer Knick (Fuß bleibt unter der Hüfte, flach)
  const crouchAngle = d => Math.acos(clamp(1 - d / LEG, -1, 1));

  function animate(dt, s = {}) {
    dt = Math.min(dt || 0, 0.1);
    st.t += dt;
    const speed = Math.max(0, s.speed || 0);
    const maxSpeed = Math.max(0.1, s.maxSpeed || 6);
    const grounded = s.grounded !== false;
    const vy = s.vy || 0, turn = s.turn || 0;

    // --- geglättete Eingangsgrößen ---
    st.accel = damp(st.accel, (speed - st.lastSpeed) / Math.max(dt, 1e-4), 6, dt);
    st.lastSpeed = speed;
    st.spd = damp(st.spd, grounded ? speed : st.spd, 10, dt);
    st.runF = damp(st.runF, smooth(2.2, 4.6, speed), 6, dt);
    st.sprintW = damp(st.sprintW, s.sprint && speed > 1 ? 1 : 0, 5, dt);
    st.lean = damp(st.lean, clamp(speed / maxSpeed, 0, 1.2) + clamp(st.accel * 0.04, -0.3, 0.4), 6, dt);
    st.turnLean = damp(st.turnLean, clamp(turn, -4, 4) * clamp(speed / 3, 0.15, 1.3), 5, dt);
    st.air = damp(st.air, grounded ? 0 : 1, grounded ? 18 : 9, dt);
    st.rise = damp(st.rise, clamp(vy / 4, -1, 1), 7, dt);

    // Landungs-Feder (unterkritisch gedämpft -> kurzes Nachfedern)
    if (s.landImpact > 0) { st.land = Math.max(st.land, clamp(s.landImpact, 0, 1)); st.landV = Math.min(st.landV, 0); }
    st.landV += (-190 * st.land - 17 * st.landV) * dt;
    st.land += st.landV * dt;
    if (Math.abs(st.land) < 1e-4 && Math.abs(st.landV) < 1e-3) st.land = st.landV = 0;

    // --- Schrittphase proportional zur Strecke (kein Fußgleiten) ---
    const cycleLen = clamp(1.05 + 0.32 * speed, 1.1, 3.2);   // m pro Doppelschritt
    if (grounded) st.phase += (speed * dt / cycleLen) * Math.PI * 2;
    else st.phase += dt * 2.0 * (1 - st.air);                // in der Luft einfrieren
    const P = st.phase, sP = Math.sin(P);
    const moveW = smooth(0.05, 0.9, st.spd) * (1 - st.air);
    const runF = st.runF, spr = st.sprintW;

    // --- Pose-Ziel aufbauen ---
    const breath = Math.sin(st.t * 2.1), sway = Math.sin(st.t * 0.63);
    const idleW = 1 - moveW;

    // Hüftbewegung
    const A = lerp(0.36, 0.62, runF) + 0.12 * spr;         // Oberschenkel-Amplitude
    const walkBob = -LEG * (1 - Math.cos(A * sP)) * 0.9;
    const runBob = 0.055 * Math.abs(sP) - 0.06 - 0.03 * spr;
    let crouch = idleW * (0.012 + 0.006 * breath) * (1 - st.air);
    crouch += st.land * 0.32;
    crouch += moveW * runF * 0.03;
    let hipY = moveW * lerp(walkBob, runBob, runF);
    let hipX = idleW * sway * 0.012 + moveW * Math.cos(P) * lerp(0.025, 0.012, runF);

    // Beine
    const base = crouchAngle(Math.max(0, crouch));
    const legs = {};
    for (const [key, off] of [['l', 0], ['r', Math.PI]]) {
      const p = P + off, sp = Math.sin(p), cp = Math.cos(p);
      const swingPhase = Math.max(0, cp);                  // Bein schwingt nach vorne
      let th = -sp * A * moveW;
      let kn = (Math.pow(swingPhase, 1.4) * lerp(0.75, 1.75, runF) + Math.max(0, -cp) * lerp(0.05, 0.35, runF) * (sp < 0.3 ? 1 : 0.4)) * moveW;
      kn += spr * moveW * swingPhase * 0.3;
      let ft = (-(th + kn) * Math.max(0, -cp) + swingPhase * 0.35 * (sp < 0 ? 1 : -0.5)) * moveW;
      // Luft: steigend anhocken, fallend strecken (Landung vorbereiten)
      const tuck = smooth(-0.1, 0.8, st.rise), reach = smooth(0.1, -0.9, st.rise);
      const airTh = -0.95 * tuck - 0.3 * reach + (key === 'l' ? -0.18 : 0.12) * tuck;
      const airKn = 1.55 * tuck + 0.18 * reach + (key === 'l' ? 0.2 : -0.1) * tuck;
      const airFt = -0.25 * tuck + 0.25 * reach;
      th = lerp(th, airTh, st.air); kn = lerp(kn, airKn, st.air); ft = lerp(ft, airFt, st.air);
      legs[key] = { th: th - base, kn: kn + 2 * base, ft: ft - base, z: (key === 'l' ? 1 : -1) * idleW * 0.03 };
    }

    // Oberkörper
    const lean = st.lean;
    let torsoX = lean * (0.1 + 0.12 * runF) + spr * 0.14 + breath * 0.015 * idleW + st.land * 0.45 + st.air * (-0.08 * st.rise + 0.05);
    let torsoY = moveW * sP * lerp(0.2, 0.32, runF);
    let torsoZ = idleW * sway * -0.02;
    let hipsY = -moveW * sP * lerp(0.1, 0.16, runF);
    let hipsZ = moveW * Math.cos(P) * 0.04 * (1 - runF);
    let bodyX = lean * 0.06 + spr * 0.06;
    let bodyZ = -st.turnLean * lerp(0.05, 0.08, runF);

    // Arme (gegengleich)
    const armA = lerp(0.35, 0.9, runF) + 0.25 * spr;
    const elB = lerp(-0.22, -1.45, runF) - 0.1 * spr;
    const tuck = smooth(-0.1, 0.8, st.rise), reach = smooth(0.1, -0.9, st.rise);
    const arms = {
      l: { sx: sP * armA * moveW + idleW * (0.05 + breath * 0.02), sz: 0.1 + idleW * breath * 0.015, el: elB * moveW - 0.18 * idleW + Math.max(0, -sP) * -0.25 * moveW, wr: 0 },
      r: { sx: -sP * armA * moveW + idleW * (-0.05 - breath * 0.02), sz: -0.1 - idleW * breath * 0.015, el: elB * moveW - 0.3 * idleW + Math.max(0, sP) * -0.25 * moveW, wr: Math.PI / 2 - 0.15 },
    };
    for (const k of ['l', 'r']) {
      const sg = k === 'l' ? 1 : -1, a = arms[k];
      const airSx = -1.3 * tuck - 0.25 * reach, airSz = sg * (0.35 * tuck + 1.05 * reach), airEl = -0.7 * tuck - 0.2 * reach;
      a.sx = lerp(a.sx, airSx, st.air); a.sz = lerp(a.sz, airSz, st.air); a.el = lerp(a.el, airEl, st.air);
      a.sx = lerp(a.sx, -0.35, st.land); a.sz += sg * st.land * 0.5;      // Landung: Arme fangen ab
    }

    // --- Aktions-Layer (nur Oberkörper, überlagert Locomotion; Rolle/Tod = ganzer Körper) ---
    let neckJerk = 0, deathX = 0;
    let actW = 0, rollA = 0, tuckW = 0, deathW = 0, deathLift = 0;
    if (action) actionT += dt;
    const AC = action ? ACTIONS[action] : null;
    if (AC && AC.keys) {
      const k = sampleKeys(AC.keys, Math.min(actionT, AC.duration), AC.fast);
      actW = smooth(0, 0.07, actionT) * (1 - smooth(AC.duration - 0.16, AC.duration, actionT));
      if (fadeT > 0) actW = 1;                               // beim Kettenwechsel voll im Aktions-Layer bleiben
      const legW = 1 - moveW;
      arms.r.sx = lerp(arms.r.sx, k.rsx, actW); arms.r.sz = lerp(arms.r.sz, k.rsz, actW);
      arms.r.el = lerp(arms.r.el, k.rel, actW); arms.r.wr = lerp(arms.r.wr, k.wr, actW); arms.r.wy = lerp(0, k.wy, actW);
      arms.l.sx = lerp(arms.l.sx, k.lsx, actW); arms.l.sz = lerp(arms.l.sz, k.lsz, actW); arms.l.el = lerp(arms.l.el, k.lel, actW);
      torsoX += k.tx * actW; torsoY = lerp(torsoY, k.ty, actW * 0.85);
      crouch += k.crouch * actW * legW;
      hipY -= k.crouch * actW * 0.6 * legW;
      if (action === 'hurt') neckJerk = 0.5 * actW;
      if (actionT >= AC.duration) action = null;
    } else if (action === 'wave') {
      actW = smooth(0, 0.25, actionT) * (1 - smooth(AC.duration - 0.3, AC.duration, actionT));
      const wv = Math.sin(actionT * 13);
      arms.l.sx = lerp(arms.l.sx, -0.35, actW); arms.l.sz = lerp(arms.l.sz, 2.55 + wv * 0.12, actW);
      arms.l.el = lerp(arms.l.el, -0.45 + wv * 0.35, actW);
      arms.l.wv = wv * 0.4 * actW;
      torsoZ += -0.06 * actW; torsoY += 0.1 * actW;
      if (actionT >= AC.duration) action = null;
    } else if (action === 'roll') {
      // Hechtrolle: kurzer Abdruck nach vorne, dann 360° über die Schulter, Beine/Arme eng angezogen
      const D = AC.duration, u = clamp(actionT / D, 0, 1);
      const ru = smooth(0.06, 0.82, u);
      rollA = ru * Math.PI * 2;
      tuckW = smooth(0.0, 0.22, u) * (1 - smooth(0.78, 1.0, u));
      torsoX += 0.75 * tuckW + 0.25 * (1 - smooth(0, 0.15, u)) * smooth(0, 0.05, u);
      crouch += 0.3 * tuckW;
      for (const k of ['l', 'r']) {
        const sg = k === 'l' ? 1 : -1, a = arms[k];
        a.sx = lerp(a.sx, -1.25, tuckW); a.sz = lerp(a.sz, sg * 0.35, tuckW); a.el = lerp(a.el, -1.75, tuckW);
      }
      if (actionT >= D) action = null;
    } else if (action === 'death') {
      const u = actionT;
      deathW = smooth(0, 0.12, u);
      const fall = smooth(0.12, 0.62, u), bounce = Math.sin(clamp((u - 0.62) / 0.3, 0, 1) * Math.PI) * 0.08;
      deathX = -1.47 * fall + bounce;
      deathLift = 0.14 * fall;
      torsoX = lerp(torsoX, -0.25 + 0.35 * (1 - fall), deathW);
      for (const k of ['l', 'r']) {
        const sg = k === 'l' ? 1 : -1, a = arms[k];
        a.sx = lerp(a.sx, lerp(-1.2, -0.25, fall), deathW); a.sz = lerp(a.sz, sg * lerp(0.6, 1.35, fall), deathW); a.el = lerp(a.el, -0.25, deathW);
      }
      neckJerk = -0.35 * fall;
    }
    // Überblendung von der vorigen Aktionspose
    if (fadeT > 0) {
      fadeT = Math.max(0, fadeT - dt);
      const f = smooth(0, 1, fadeT / FADE);
      arms.l.sx = lerp(arms.l.sx, from.lsx, f); arms.l.sz = lerp(arms.l.sz, from.lsz, f); arms.l.el = lerp(arms.l.el, from.lel, f);
      arms.r.sx = lerp(arms.r.sx, from.rsx, f); arms.r.sz = lerp(arms.r.sz, from.rsz, f); arms.r.el = lerp(arms.r.el, from.rel, f);
      arms.r.wr = lerp(arms.r.wr, from.wr, f); arms.r.wy = lerp(arms.r.wy || 0, from.wy, f);
      torsoX = lerp(torsoX, from.tx, f); torsoY = lerp(torsoY, from.ty, f);
    }
    last.lsx = arms.l.sx; last.lsz = arms.l.sz; last.lel = arms.l.el; last.rsx = arms.r.sx; last.rsz = arms.r.sz; last.rel = arms.r.el;
    last.wr = arms.r.wr; last.wy = arms.r.wy || 0; last.tx = torsoX; last.ty = torsoY;
    // Rolle/Tod: Beine anziehen bzw. ausstrecken
    if (tuckW > 0 || deathW > 0) for (const k of ['l', 'r']) {
      const g = legs[k], sg = k === 'l' ? 1 : -1;
      if (tuckW > 0) { g.th = lerp(g.th, -1.75, tuckW); g.kn = lerp(g.kn, 2.35, tuckW); g.ft = lerp(g.ft, -0.2, tuckW); }
      if (deathW > 0) { g.th = lerp(g.th, -0.12, deathW); g.kn = lerp(g.kn, 0.15, deathW); g.ft = lerp(g.ft, 0.5, deathW); g.z = lerp(g.z, sg * 0.12, deathW); }
    }

    // --- Anwenden ---
    rollG.rotation.set(rollA, 0, 0);
    rollG.position.y = ROLL_Y + Math.sin(rollA / 2) * 0.12;
    body.rotation.set(bodyX * (1 - deathW) + deathX, 0, bodyZ * (1 - deathW));
    body.position.y = -ROLL_Y + deathLift;
    const sq = st.land;
    body.scale.set(1 + sq * 0.07, 1 - sq * 0.1 + st.air * Math.max(0, st.rise) * 0.04, 1 + sq * 0.07);
    const dropFromCrouch = LEG * (1 - Math.cos(base));
    hips.position.set(hipX, HIP + hipY - dropFromCrouch, 0);
    hips.rotation.set(0, hipsY, hipsZ);
    torso.rotation.set(torsoX, torsoY, torsoZ);
    torso.scale.set(1 + breath * 0.012 * idleW, 1 + breath * 0.008 * idleW, 1 + breath * 0.02 * idleW);
    // Kopf stabilisiert Blick (wirkt dem Torso entgegen)
    neck.rotation.set(neckJerk - torsoX * 0.6 - bodyX * 0.8 + idleW * Math.sin(st.t * 0.4) * 0.04 + st.air * 0.1 * st.rise,
      -(torsoY + hipsY) * 0.7 + idleW * Math.sin(st.t * 0.31) * 0.12, -bodyZ * 0.5 - torsoZ * 0.8 + (action === 'wave' ? 0.12 * actW : 0));

    for (const k of ['l', 'r']) {
      const a = arms[k], r = arm[k];
      r.sh.rotation.set(a.sx, 0, a.sz);
      r.el.rotation.set(a.el, 0, a.wv || 0);
      r.hand.rotation.set(0, 0, 0);
      const g = legs[k], lg = leg[k];
      lg.th.rotation.set(g.th, 0, g.z);
      lg.kn.rotation.set(g.kn, 0, 0);
      lg.ft.rotation.set(g.ft, 0, -g.z);
    }
    axe.rotation.set(arms.r.wr, arms.r.wy || 0, 0);

    // Umhang: gedämpfte Feder, flattert mit Tempo / weht im Fall nach oben
    const capeTarget = 0.08 + st.spd * 0.09 + torsoX * -0.6 + st.air * (-st.rise * 0.6) + moveW * Math.sin(P * 2) * 0.05 * (0.5 + runF);
    st.capeV += (60 * (clamp(capeTarget, -0.1, 1.3) - st.cape) - 7 * st.capeV) * dt;
    st.cape += st.capeV * dt;
    cape.rotation.set(Math.max(-torsoX + 0.02, st.cape), 0, -bodyZ * 0.5);
  }

  return {
    object3D: root,
    height: 1.75,
    radius: 0.35,
    look: L,
    animate,
    playAction,
    cancelAction,
    get actionActive() { return action !== null; },
    get action() { return action; },
    /** Weltposition der Hand ('l'|'r') bzw. der Axtschneide */
    handWorld(side = 'l', out = new THREE.Vector3()) { root.updateMatrixWorld(); return arm[side].hand.getWorldPosition(out); },
    bladeWorld(out = new THREE.Vector3()) { root.updateMatrixWorld(); return blade.getWorldPosition(out); },
  };
}
