// Viniland – Spielerfiguren: „Gestrandete“ (zerrissene Kleidung, barfuß, gritty) im Mid-Poly-PS1/PS2-Stil mit prozeduralem Rig.
// Vertrag: siehe CONTRACT.md (js/players.js). Ursprung an den Füßen, Blick +Z, Höhe ~1.75 m. Waffe austauschbar: model.setWeapon(mesh, grip).
import * as THREE from 'three';
import { MeshBuilder, clamp, lerp, damp } from './kit.js';
import { psxMat } from './psx.js';

// „Gestrandete“: angespült, zerrissene Kleidung, barfuß mit Lumpen-Wickeln, dunkle/gritty Farben. P1 = Rost-Bandana + Petrol, P2 = Blond + Ocker/Blau-Schal.
export const PLAYER_LOOKS = [
  { name: 'Kael', skin: 0xc08a68, hair: 0x241a14, beard: 'stubble', braids: false, hat: 'bandana', hatCol: 0x8e2a1e, hatTrim: 0x5a1a12,
    tunic: 0x35514f, trim: 0x8a7a5a, cloak: null, fur: 0x8a7c66, pants: 0x4a3e32, boots: 0x7a6a52, belt: 0x6a5a3e, bag: 0x5a4a32, width: 1.08, sleeve: 'torn' },
  { name: 'Mira', skin: 0xd8a888, hair: 0xd6c08a, beard: null, braids: true, hat: 'none', hatCol: 0x3a4f78, hatTrim: 0x2a3a5a,
    tunic: 0x8a6a2c, trim: 0x3a4f78, cloak: 0x3a4f78, fur: 0x9a8a70, pants: 0x3a3430, boots: 0x8a7a60, belt: 0x4a3a26, bag: 0x6a5232, width: 0.94, sleeve: 'full' },
  { name: 'Brann', skin: 0xa8765a, hair: 0x8a8478, beard: 'full', braids: false, hat: 'hood', hatCol: 0x4a463e, hatTrim: 0x34302a,
    tunic: 0x5a4a3a, trim: 0x7a2a22, cloak: 0x3e3a32, fur: 0x7a6e5a, pants: 0x2e2e2a, boots: 0x6a5c48, belt: 0x3a2c1e, bag: 0x5a4630, width: 1.14, sleeve: 'torn' },
  { name: 'Ysolde', skin: 0xe0b498, hair: 0x6a2a1e, beard: null, braids: true, hat: 'band', hatCol: 0x5a6a3a, hatTrim: 0x9a8a5a,
    tunic: 0x4a3a52, trim: 0x9a8a5a, cloak: null, fur: 0x8a7a66, pants: 0x3a3a3e, boots: 0x7a6a58, belt: 0x3a2618, bag: 0x5a4632, width: 0.95, sleeve: 'full' },
];

// ---- Maße ----
const HIP = 0.9, THIGH = 0.41, SHIN = 0.41, LEG = THIGH + SHIN;
const NECK_Y = 0.5, SH_Y = 0.43, SH_X = 0.2, UPPER = 0.27, FORE = 0.24;

const hemi = (r, ws = 10, hs = 4) => new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, Math.PI / 2);
const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---- Geometrie pro Knochen ----
// Zerrissener Saum: Dreiecks-Zacken rundherum
function tornHem(b, r, y, col, n = 9, len = 0.07, sz = 0.8) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2, l = len * (0.5 + ((i * 7) % 5) / 5);
    b.cone(0.045, l, col, { x: Math.sin(a) * r, y: y - l / 2, z: Math.cos(a) * r * sz, rx: Math.PI, ry: a }, 3);
  }
}
function buildPelvis(L) {
  const b = new MeshBuilder(), w = L.width;
  b.cyl(0.165 * w, 0.2 * w, 0.22, L.tunic, { y: -0.03, sz: 0.8 }, 9);             // Hemd-Saum
  tornHem(b, 0.19 * w, -0.14, L.tunic, 10, 0.09);
  b.cyl(0.17 * w, 0.17 * w, 0.05, L.belt, { y: 0.06, sz: 0.8 }, 9);               // Strick-Gürtel
  b.box(0.04, 0.12, 0.02, L.belt, { x: 0.06, y: -0.01, z: 0.135 * w, rz: 0.2 });  // Knotenende
  b.box(0.11, 0.12, 0.06, L.bag, { x: 0.15 * w, y: -0.01, z: 0.06, ry: 0.5, jitter: 0.15 }); // Lumpenbeutel
  return b.mesh();
}
function buildTorso(L) {
  const b = new MeshBuilder(), w = L.width;
  b.cyl(0.18 * w, 0.16 * w, 0.44, L.tunic, { y: 0.24, sz: 0.72, jitter: 0.12 }, 9);
  b.sphere(0.14 * w, L.tunic, { y: 0.14, z: 0.01, sz: 0.7, jitter: 0.12 }, 8, 6);
  // Risse/Flicken im Hemd (Haut blitzt durch)
  b.box(0.07, 0.1, 0.02, L.skin, { x: -0.06 * w, y: 0.3, z: 0.125 * w, rz: 0.5 });
  b.box(0.05, 0.08, 0.02, L.trim, { x: 0.08 * w, y: 0.16, z: 0.12 * w, rz: -0.3, jitter: 0.2 });
  b.box(0.05, 0.14, 0.02, L.skin, { x: 0.02, y: 0.42, z: 0.11 * w, rx: -0.3 });   // offener Kragen
  b.cyl(0.06, 0.07, 0.1, L.skin, { y: 0.5 }, 7);                                 // Hals
  b.add(new THREE.TorusGeometry(0.13 * w, 0.035, 4, 9), L.trim, { y: 0.46, rx: Math.PI / 2, sz: 0.8 }); // Schal/Lappen
  b.box(0.05, 0.16, 0.025, L.trim, { x: 0.07, y: 0.38, z: 0.12 * w, rz: -0.25 });  // Schalende
  for (const s of [-1, 1]) b.sphere(0.075, L.tunic, { x: s * (SH_X * w + 0.005), y: SH_Y + 0.01, sy: 0.75 }, 6, 4);
  return b.mesh();
}
function buildCape(L) {
  // zerfetzter Segeltuch-Umhang
  const b = new MeshBuilder(), w = L.width;
  b.add(new THREE.CylinderGeometry(0.2 * w, 0.26 * w, 0.5, 9, 1, true, Math.PI * 0.6, Math.PI * 0.8), L.cloak, { y: -0.24, z: 0.08, sz: 0.7, jitter: 0.15 });
  for (let i = 0; i < 5; i++) { const x = (i - 2) * 0.085 * w, l = 0.08 + ((i * 3) % 4) * 0.035; b.cone(0.045, l, L.cloak, { x, y: -0.49 - l / 2, z: -0.13, rx: Math.PI }, 3); }
  return b.mesh(psxMat({ side: THREE.DoubleSide }));
}
function buildHead(L) {
  const b = new MeshBuilder();
  const R = 0.155;
  b.sphere(R, L.skin, { y: 0.16, sy: 1.08, jitter: 0.1 }, 10, 8);
  b.sphere(R * 1.03, L.hair, { y: 0.19, z: -0.04, sz: 0.92, jitter: 0.15 }, 9, 6);      // zerzaustes Haar
  for (let i = 0; i < 5; i++) b.cone(0.04, 0.1, L.hair, { x: (i - 2) * 0.05, y: 0.29, z: 0.06 - Math.abs(i - 2) * 0.03, rx: 0.9, rz: (i - 2) * 0.3 }, 3); // Strähnen
  // Gesicht: schmale, müde Augen, tiefe Brauen, Schmutz
  for (const s of [-1, 1]) {
    b.box(0.045, 0.02, 0.02, 0x1a120e, { x: s * 0.058, y: 0.168, z: 0.14 });
    b.box(0.012, 0.012, 0.01, 0xd8d0c0, { x: s * 0.052, y: 0.17, z: 0.152 });
    b.box(0.06, 0.02, 0.025, L.hair, { x: s * 0.06, y: 0.2, z: 0.142, rz: s * 0.18 });
    b.box(0.04, 0.03, 0.01, 0x5a4a3a, { x: s * 0.085, y: 0.11, z: 0.13, jitter: 0.3 });    // Dreck/Schatten
  }
  b.box(0.032, 0.06, 0.04, L.skin, { y: 0.13, z: 0.158 });                         // Nase
  b.box(0.05, 0.012, 0.01, 0x5a2a22, { y: 0.075, z: 0.15 });                       // Mund, schmal
  b.box(0.03, 0.05, 0.01, 0x8a3a2a, { x: 0.07, y: 0.215, z: 0.135, rz: 0.6 });      // Narbe/Kratzer
  if (L.beard === 'full') {
    b.sphere(0.12, L.hair, { y: 0.05, z: 0.065, sy: 0.95, sz: 0.72, jitter: 0.15 }, 8, 6);
    b.box(0.12, 0.03, 0.04, L.hair, { y: 0.1, z: 0.15 });
  } else if (L.beard === 'stubble') {
    b.sphere(0.135, 0x3a2e26, { y: 0.085, z: 0.04, sy: 0.7, sz: 0.85, jitter: 0.2 }, 8, 5);
  }
  if (L.braids) for (const s of [-1, 1]) {
    b.capsule(0.032, 0.22, L.hair, { x: s * 0.13, y: -0.02, z: -0.04, rz: s * 0.1 }, 2, 6);
    b.cyl(0.036, 0.036, 0.03, L.belt, { x: s * 0.14, y: -0.13, z: -0.04 }, 6);
  }
  if (L.hat === 'bandana') {
    b.add(hemi(R * 1.06), L.hatCol, { y: 0.2, sy: 0.85, jitter: 0.12 });
    b.cyl(R * 1.08, R * 1.08, 0.05, L.hatTrim, { y: 0.22 }, 10);
    b.box(0.05, 0.16, 0.02, L.hatCol, { x: -0.04, y: 0.14, z: -0.17, rx: 0.3, rz: 0.2 });   // Zipfel hinten
    b.box(0.045, 0.13, 0.02, L.hatCol, { x: 0.04, y: 0.15, z: -0.17, rx: 0.4, rz: -0.3 });
  } else if (L.hat === 'hood') {
    b.add(hemi(R * 1.22), L.hatCol, { y: 0.16, z: -0.02, jitter: 0.12 });
    b.add(hemi(R * 1.22), L.hatCol, { y: 0.16, z: -0.02, rx: -Math.PI / 2 });
    tornHem(b, R * 1.1, 0.0, L.hatCol, 7, 0.08, 1);
  } else if (L.hat === 'band') {
    b.cyl(R * 1.06, R * 1.06, 0.035, L.hatCol, { y: 0.23 }, 10);
    b.box(0.03, 0.12, 0.015, L.hatCol, { x: 0.05, y: 0.17, z: -0.16, rx: 0.3 });
  }
  return b.mesh();
}
function buildUpper(L, side) {
  const b = new MeshBuilder();
  const torn = L.sleeve === 'torn' && side === 'r';
  b.cyl(0.058, 0.052, UPPER, torn ? L.skin : L.tunic, { y: -UPPER / 2 }, 7);
  b.sphere(0.062, L.tunic, { y: -0.01 }, 7, 5);
  if (torn) tornHem(b, 0.06, -0.02, L.tunic, 6, 0.06, 1);
  return b.mesh();
}
function buildFore(L, side) {
  const b = new MeshBuilder();
  const bare = L.sleeve === 'torn' || side === 'r';
  b.sphere(0.052, bare ? L.skin : L.tunic, {}, 6, 4);
  b.cyl(0.05, 0.043, FORE - 0.02, bare ? L.skin : L.tunic, { y: -FORE / 2 }, 7);
  for (let i = 0; i < 2; i++) b.cyl(0.051, 0.049, 0.03, L.fur, { y: -FORE + 0.04 + i * 0.045, rz: i * 0.15, jitter: 0.2 }, 7); // Lumpen-Wickel
  return b.mesh();
}
function buildHand(L) {
  const b = new MeshBuilder();
  b.sphere(0.05, L.skin, { y: -0.04, sx: 0.85, sz: 1.05 }, 6, 5);
  b.sphere(0.021, L.skin, { y: -0.03, z: 0.04 }, 4, 3);
  b.cyl(0.046, 0.046, 0.025, L.fur, { y: -0.02 }, 6);                              // Handwickel
  return b.mesh();
}
function buildFlask() {
  const b = new MeshBuilder();
  b.sphere(0.05, 0xff7a20, { y: 0.0, sy: 1.1 }, 6, 5);
  b.cyl(0.018, 0.022, 0.06, 0x8a7a62, { y: 0.07 }, 5);
  b.cyl(0.02, 0.02, 0.02, 0x4a3220, { y: 0.105 }, 5);
  return b.mesh(psxMat({ vertexColors: true, emissive: 0x803010 }));
}
function buildThigh(L) {
  const b = new MeshBuilder(), w = L.width;
  b.cyl(0.085 * w, 0.07, THIGH, L.pants, { y: -THIGH / 2, jitter: 0.12 }, 7);
  b.sphere(0.072, L.pants, { y: -THIGH }, 6, 4);
  b.box(0.06, 0.07, 0.02, L.skin, { x: 0.02, y: -THIGH * 0.55, z: 0.075, rz: 0.5 });   // Riss am Knie
  return b.mesh();
}
function buildShin(L) {
  const b = new MeshBuilder();
  b.cyl(0.064, 0.06, SHIN * 0.45, L.pants, { y: -SHIN * 0.22 }, 7);                    // hochgekrempelt / abgerissen
  tornHem(b, 0.063, -SHIN * 0.44, L.pants, 6, 0.06, 1);
  b.cyl(0.055, 0.045, SHIN * 0.6, L.skin, { y: -SHIN * 0.68 }, 7);                     // nackte Wade
  for (let i = 0; i < 3; i++) b.cyl(0.05, 0.048, 0.025, L.boots, { y: -SHIN + 0.04 + i * 0.04, rz: (i - 1) * 0.12, jitter: 0.2 }, 7); // Wickel
  return b.mesh();
}
function buildFoot(L) {
  const b = new MeshBuilder();
  b.box(0.09, 0.06, 0.19, L.skin, { y: -0.03, z: 0.045 });                              // barfuß
  b.sphere(0.048, L.skin, { y: -0.035, z: 0.13, sy: 0.6, sx: 1.0 }, 6, 4);
  b.box(0.095, 0.035, 0.1, L.boots, { y: -0.02, z: 0.0, jitter: 0.2 });                // Lumpen um den Spann
  b.box(0.092, 0.012, 0.2, 0x3a2e26, { y: -0.058, z: 0.045 });                         // schmutzige Sohle
  return b.mesh();
}

// ---- Aktionen ----
// Keyframes für den Oberkörper (Zeit in s bei Tempo 1). r*/l* = Schulter (sx vor/zurück, sz seitlich), el = Ellbogen, wr/wy = Waffe im
// Handgelenk (Euler YXZ), lwr/lwy = Zweitwaffe links, tx/ty = Torso (vor / Drehung), crouch = Hocke, by = Körper-Drehung (Wirbel),
// ly = Anheben (Sprung). wp/lwp = absolute Waffen-Neigung (wird in wr umgerechnet: -PI/2 = waagerecht nach vorn).
// fast = Index des Segments, das mit ease-in beschleunigt (der eigentliche Schlag). twoOK = linke Hand folgt bei Zweihand-Griff.
const REST = { rsx: -0.4, rsz: -0.1, rel: -0.4, wr: 1.42, wy: 0, lsx: -0.3, lsz: 0.2, lel: -0.4, lwr: 1.42, lwy: 0, tx: 0, ty: 0, crouch: 0, by: 0, ly: 0 };
const PI = Math.PI;
const K = (t, o) => {
  const k = { ...REST, ...o, t };
  if (o.wp != null) { k.wr = o.wp - PI - k.rsx - k.rel; delete k.wp; }
  if (o.lwp != null) { k.lwr = o.lwp - PI - k.lsx - k.lel; delete k.lwp; }
  return k;
};
const GUARD = { rsx: -0.85, rsz: -0.15, rel: -2.1, lsx: -0.9, lsz: 0.2, lel: -2.1 };   // Fäuste-Deckung
const SLASH_R = { duration: 0.5, impactAt: 0.2, fast: 1, twoOK: true, keys: [
  K(0.0, {}),
  K(0.12, { rsx: -1.25, rsz: -1.55, rel: -0.7, wr: PI, wy: -PI / 2, lsx: -0.9, lsz: 0.55, lel: -1.2, lwr: PI, lwy: PI / 2, ty: -0.65, tx: 0.05, crouch: 0.04 }),
  K(0.2, { rsx: -1.5, rsz: 0.25, rel: -0.08, wr: PI, wy: -PI / 2, lsx: -0.3, lsz: 0.9, lel: -0.5, lwr: PI, lwy: PI / 2, ty: 0.4, tx: 0.18, crouch: 0.07 }),
  K(0.3, { rsx: -1.3, rsz: 0.85, rel: -0.3, wr: PI, wy: -PI / 2, lsx: -0.2, lsz: 0.8, lel: -0.5, lwr: PI, lwy: PI / 2, ty: 0.62, tx: 0.15, crouch: 0.06 }),
  K(0.5, { rsx: -0.6, rsz: 0.1, rel: -0.5, wr: 1.6, lsx: -0.3, lsz: 0.3, ty: 0.15, tx: 0.05 }),
] };
const SLASH_L = { duration: 0.5, impactAt: 0.2, fast: 1, twoOK: true, keys: [
  K(0.0, { rsx: -0.9, rsz: 0.6, rel: -0.6, wr: PI, wy: -PI / 2, ty: 0.4, tx: 0.1 }),
  K(0.11, { rsx: -1.2, rsz: 1.05, rel: -1.35, wr: PI, wy: PI / 2, lsx: -1.2, lsz: -0.4, lel: -1.3, lwr: PI, lwy: -PI / 2, ty: 0.7, tx: 0.08, crouch: 0.05 }),
  K(0.2, { rsx: -1.75, rsz: -0.75, rel: -0.05, wr: PI, wy: PI / 2, lsx: -1.5, lsz: 1.1, lel: -0.1, lwr: PI, lwy: -PI / 2, ty: -0.45, tx: 0.12, crouch: 0.07 }),
  K(0.3, { rsx: -1.9, rsz: -1.35, rel: -0.2, wr: PI, wy: PI / 2, lsx: -1.2, lsz: 1.2, lel: -0.3, lwr: PI, lwy: -PI / 2, ty: -0.62, tx: 0.08, crouch: 0.05 }),
  K(0.5, { rsx: -0.6, rsz: -0.4, rel: -0.5, wr: 1.6, ty: -0.12 }),
] };
const OVERHEAD = { duration: 0.75, impactAt: 0.36, fast: 1, keys: [
  K(0.0, { rsx: -0.7, rsz: -0.3, rel: -0.6, wr: 1.8, ty: -0.3 }),
  K(0.24, { rsx: -3.0, rsz: -0.2, rel: -1.35, wr: 2.2, lsx: -2.7, lsz: 0.3, lel: -1.3, lwr: 2.2, tx: -0.32, ty: -0.25 }),
  K(0.36, { rsx: -0.8, rsz: -0.05, rel: -0.05, wr: 3.1, lsx: -0.95, lsz: 0.4, lel: -0.25, lwr: 3.1, tx: 0.55, ty: 0.12, crouch: 0.17 }),
  K(0.5, { rsx: -0.7, rsz: -0.05, rel: -0.1, wr: 3.05, lsx: -0.85, lsz: 0.4, lel: -0.3, tx: 0.5, ty: 0.14, crouch: 0.15 }),
  K(0.75, { rsx: -0.45, rsz: -0.1, rel: -0.4, wr: 1.7, tx: 0.08 }),
] };
const THRUST = { duration: 0.5, impactAt: 0.2, fast: 1, twoOK: true, keys: [
  K(0.0, {}),
  K(0.12, { rsx: -1.1, rsz: -0.25, rel: -1.55, wp: -PI / 2, lsx: -1.0, lsz: 0.3, lel: -1.2, lwp: -PI / 2, ty: -0.5, tx: -0.06 }),
  K(0.2, { rsx: -1.55, rsz: 0.05, rel: -0.05, wp: -PI / 2, lsx: -0.5, lsz: 0.6, lel: -0.4, lwp: -1.2, ty: 0.38, tx: 0.24, crouch: 0.08 }),
  K(0.3, { rsx: -1.5, rsz: 0.05, rel: -0.08, wp: -PI / 2, lsx: -0.5, lsz: 0.6, lel: -0.4, ty: 0.35, tx: 0.22, crouch: 0.07 }),
  K(0.5, {}),
] };
const SPIN_ARMS = { rsx: -1.45, rsz: -1.25, rel: -0.15, wr: PI, wy: -PI / 2, lsx: -1.3, lsz: 1.1, lel: -0.2, lwr: PI, lwy: PI / 2, tx: 0.12, crouch: 0.1 };
const SLAM = { duration: 0.8, impactAt: 0.4, fast: 1, keys: [
  K(0.0, {}),
  K(0.28, { rsx: -3.0, rsz: -0.15, rel: -1.0, wr: 2.0, lsx: -2.9, lsz: 0.3, lel: -1.0, tx: -0.38, crouch: -0.02 }),
  K(0.4, { rsx: -0.5, rsz: -0.05, rel: -0.05, wr: 3.1, lsx: -0.6, lsz: 0.4, lel: -0.1, tx: 0.8, crouch: 0.3 }),
  K(0.6, { rsx: -0.5, rsz: -0.05, rel: -0.1, wr: 3.05, lsx: -0.6, lsz: 0.4, lel: -0.15, tx: 0.75, crouch: 0.28 }),
  K(0.8, {}),
] };
const RISING = { duration: 0.62, impactAt: 0.26, fast: 1, twoOK: true, keys: [
  K(0.0, {}),
  K(0.16, { rsx: -0.3, rsz: -0.95, rel: -0.35, wr: PI, wy: -PI / 2, ty: -0.65, crouch: 0.12, lsx: -0.6, lsz: 0.5, lel: -1.0 }),
  K(0.26, { rsx: -2.45, rsz: 0.55, rel: -0.15, wr: PI, wy: -PI / 2, ty: 0.45, tx: -0.14, crouch: 0.0, lsx: -0.4, lsz: 0.8, lel: -0.5 }),
  K(0.38, { rsx: -2.5, rsz: 0.6, rel: -0.2, wr: PI, wy: -PI / 2, ty: 0.5, tx: -0.12, lsx: -0.4, lsz: 0.8, lel: -0.5 }),
  K(0.62, {}),
] };
const SWEEP = { duration: 0.62, impactAt: 0.26, fast: 1, twoOK: true, keys: [
  K(0.0, {}),
  K(0.15, { rsx: -0.9, rsz: -1.6, rel: -0.5, wr: PI, wy: -PI / 2, ty: -0.95, tx: 0.1, crouch: 0.12, lsx: -0.8, lsz: 0.5, lel: -1.1 }),
  K(0.26, { rsx: -1.05, rsz: 0.4, rel: -0.08, wr: PI, wy: -PI / 2, ty: 0.55, tx: 0.25, crouch: 0.16, lsx: -0.3, lsz: 0.9, lel: -0.5 }),
  K(0.38, { rsx: -1.0, rsz: 1.0, rel: -0.2, wr: PI, wy: -PI / 2, ty: 0.85, tx: 0.2, crouch: 0.14, lsx: -0.2, lsz: 0.9, lel: -0.5 }),
  K(0.62, {}),
] };
const punch = (side, t0, t1, t2, extra = {}) => side === 'l'
  ? [K(t0, { ...GUARD, ty: 0.2, ...extra }), K(t1, { ...GUARD, lsx: -1.6, lsz: -0.05, lel: -0.05, ty: -0.45, tx: 0.12, crouch: 0.03, ...extra }), K(t2, { ...GUARD, lsx: -1.45, lsz: 0, lel: -0.2, ty: -0.4, tx: 0.1, ...extra })]
  : [K(t0, { ...GUARD, ty: -0.25, ...extra }), K(t1, { ...GUARD, rsx: -1.6, rsz: 0.05, rel: -0.05, ty: 0.5, tx: 0.14, crouch: 0.04, ...extra }), K(t2, { ...GUARD, rsx: -1.45, rsz: 0, rel: -0.2, ty: 0.45, tx: 0.12, ...extra })];
const FLURRY_KEYS = [K(0, {})];
for (let i = 0; i < 6; i++) { const t = 0.06 + i * 0.1; FLURRY_KEYS.push(...punch(i % 2 ? 'r' : 'l', t, t + 0.06, t + 0.085, i === 5 ? { crouch: 0.1 } : {})); }
FLURRY_KEYS.push(K(1.0, {}));

const ACTIONS = {
  chop: { duration: 0.55, impactAt: 0.28, fast: 1, keys: [
    K(0.0, { rsx: -0.6, rsz: -0.15, rel: -0.5, wr: 1.7, lsx: -0.5, lsz: 0.2, lel: -0.6 }),
    K(0.19, { rsx: -2.75, rsz: -0.25, rel: -1.25, wr: 2.1, lsx: -2.3, lsz: 0.35, lel: -1.2, tx: -0.2, ty: -0.38, crouch: 0.02 }),
    K(0.28, { rsx: -1.05, rsz: -0.05, rel: -0.12, wr: 3.0, lsx: -1.1, lsz: 0.45, lel: -0.35, tx: 0.32, ty: 0.18, crouch: 0.09 }),
    K(0.36, { rsx: -0.85, rsz: -0.05, rel: -0.18, wr: 2.95, lsx: -0.9, lsz: 0.4, lel: -0.4, tx: 0.36, ty: 0.22, crouch: 0.08 }),
    K(0.55, { rsx: -0.4, rsz: -0.1, rel: -0.4, wr: 1.8, lsx: -0.3, lsz: 0.2, lel: -0.4, tx: 0.1, ty: 0.05 }),
  ] },
  slashR: SLASH_R, slashL: SLASH_L, overhead: OVERHEAD, thrust: THRUST, slam: SLAM, rising: RISING, sweep: SWEEP,
  attack1: SLASH_R, attack2: SLASH_L, attack3: OVERHEAD,          // alte Namen
  spin: { duration: 0.7, impactAt: 0.34, fast: -1, keys: [
    K(0.0, {}), K(0.14, { ...SPIN_ARMS, ty: -0.6, by: 0 }), K(0.5, { ...SPIN_ARMS, ty: 0.3, by: PI * 2 }), K(0.7, { by: PI * 2 }),
  ] },
  // Fäuste
  jab: { duration: 0.36, impactAt: 0.12, fast: 1, keys: [K(0, {}), ...punch('l', 0.07, 0.12, 0.2), K(0.36, GUARD)] },
  cross: { duration: 0.38, impactAt: 0.13, fast: 1, keys: [K(0, GUARD), ...punch('r', 0.07, 0.13, 0.21), K(0.38, GUARD)] },
  hook: { duration: 0.44, impactAt: 0.17, fast: 1, keys: [
    K(0, GUARD), K(0.1, { ...GUARD, lsx: -1.2, lsz: 0.8, lel: -1.5, ty: 0.4 }),
    K(0.17, { ...GUARD, lsx: -1.45, lsz: -0.35, lel: -1.45, ty: -0.75, tx: 0.1, crouch: 0.05 }), K(0.26, { ...GUARD, lsx: -1.4, lsz: -0.45, lel: -1.5, ty: -0.8, tx: 0.08 }), K(0.44, GUARD)] },
  uppercut: { duration: 0.55, impactAt: 0.22, fast: 1, keys: [
    K(0, GUARD), K(0.13, { ...GUARD, rsx: -0.3, rsz: -0.15, rel: -1.8, ty: -0.35, crouch: 0.14 }),
    K(0.22, { ...GUARD, rsx: -2.45, rsz: 0.1, rel: -1.25, ty: 0.4, tx: -0.16, crouch: -0.03 }), K(0.32, { ...GUARD, rsx: -2.5, rsz: 0.1, rel: -1.2, ty: 0.4, tx: -0.14 }), K(0.55, {})] },
  haymaker: { duration: 0.72, impactAt: 0.34, fast: 1, keys: [
    K(0, GUARD), K(0.22, { ...GUARD, rsx: -0.6, rsz: -1.25, rel: -1.2, ty: -0.95, crouch: 0.08 }),
    K(0.34, { ...GUARD, rsx: -1.5, rsz: 0.6, rel: -0.3, ty: 0.75, tx: 0.25, crouch: 0.12 }), K(0.48, { ...GUARD, rsx: -1.3, rsz: 0.9, rel: -0.4, ty: 0.85, tx: 0.2 }), K(0.72, {})] },
  // Doppeldolche
  double: { duration: 0.46, impactAt: 0.16, fast: 1, keys: [
    K(0, {}), K(0.1, { rsx: -1.3, rsz: 0.9, rel: -1.2, wr: PI, wy: PI / 2, lsx: -1.3, lsz: -0.9, lel: -1.2, lwr: PI, lwy: -PI / 2, tx: 0.05 }),
    K(0.16, { rsx: -1.4, rsz: -1.1, rel: -0.15, wr: PI, wy: PI / 2, lsx: -1.4, lsz: 1.1, lel: -0.15, lwr: PI, lwy: -PI / 2, tx: 0.18, crouch: 0.06 }),
    K(0.27, { rsx: -1.3, rsz: -1.2, rel: -0.2, wr: PI, wy: PI / 2, lsx: -1.3, lsz: 1.2, lel: -0.2, lwr: PI, lwy: -PI / 2, tx: 0.15 }), K(0.46, {})] },
  doubleX: { duration: 0.56, impactAt: 0.24, fast: 1, keys: [
    K(0, {}), K(0.16, { rsx: -2.8, rsz: -0.5, rel: -0.6, wr: 2.2, lsx: -2.8, lsz: 0.5, lel: -0.6, lwr: 2.2, tx: -0.25 }),
    K(0.24, { rsx: -0.9, rsz: 0.5, rel: -0.1, wr: 3.0, lsx: -0.9, lsz: -0.5, lel: -0.1, lwr: 3.0, tx: 0.4, crouch: 0.12 }),
    K(0.36, { rsx: -0.8, rsz: 0.55, rel: -0.15, wr: 3.0, lsx: -0.8, lsz: -0.55, lel: -0.15, lwr: 3.0, tx: 0.38, crouch: 0.1 }), K(0.56, {})] },
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
  castHeal: { duration: 0.7, impactAt: 0.32, fast: -1, keys: [
    K(0, {}), K(0.25, { lsx: -2.6, lsz: 0.75, lel: -0.2, rsx: -2.6, rsz: -0.75, rel: -0.2, wr: 1.3, tx: -0.15 }),
    K(0.32, { lsx: -2.75, lsz: 0.85, lel: -0.15, rsx: -2.75, rsz: -0.85, rel: -0.15, wr: 1.3, tx: -0.22 }),
    K(0.5, { lsx: -2.7, lsz: 0.8, lel: -0.2, rsx: -2.7, rsz: -0.8, rel: -0.2, wr: 1.3, tx: -0.2 }), K(0.7, {})] },
  castUp: { duration: 0.6, impactAt: 0.3, fast: 1, keys: [
    K(0, {}), K(0.22, { lsx: -3.0, lsz: 0.2, lel: -0.3, tx: -0.2, ty: -0.25, rsx: -0.3, rsz: -0.4 }),
    K(0.3, { lsx: -1.7, lsz: 0.0, lel: -0.05, tx: 0.25, ty: -0.35, crouch: 0.06, rsx: -0.2, rsz: -0.4 }),
    K(0.45, { lsx: -1.65, lsz: 0.0, lel: -0.08, tx: 0.22, ty: -0.3, rsx: -0.2, rsz: -0.4 }), K(0.6, {})] },
  drink: { duration: 1.15, impactAt: 0.35, fast: -1, keys: [
    K(0, {}), K(0.25, { lsx: -1.9, lsz: -0.35, lel: -2.35, tx: -0.05 }), K(0.35, { lsx: -2.15, lsz: -0.4, lel: -2.45, tx: -0.2 }),
    K(0.85, { lsx: -2.15, lsz: -0.4, lel: -2.45, tx: -0.2 }), K(1.15, {})] },
  heavyCharge: { duration: 99, impactAt: 0, fast: -1, hold: true, keys: [
    K(0, {}), K(0.3, { rsx: -2.6, rsz: -0.45, rel: -1.25, wr: 2.2, lsx: -1.1, lsz: 0.45, lel: -1.3, ty: -0.55, tx: -0.22, crouch: 0.08 }),
    K(99, { rsx: -2.7, rsz: -0.45, rel: -1.3, wr: 2.2, lsx: -1.1, lsz: 0.45, lel: -1.3, ty: -0.6, tx: -0.25, crouch: 0.1 })] },
  // Waffenkünste
  art_flurry: { duration: 1.0, impactAt: 0.12, fast: -1, keys: FLURRY_KEYS },
  art_leap: { duration: 1.0, impactAt: 0.56, fast: 3, keys: [
    K(0, {}), K(0.12, { rsx: -1.0, rel: -1.0, lsx: -1.0, lel: -1.0, crouch: 0.22, tx: 0.2 }),
    K(0.32, { rsx: -3.0, rsz: -0.2, rel: -1.3, wr: 2.1, lsx: -2.9, lsz: 0.3, lel: -1.3, tx: -0.35, ly: 0.95 }),
    K(0.48, { rsx: -3.05, rsz: -0.2, rel: -1.2, wr: 2.2, lsx: -2.9, lsz: 0.3, lel: -1.2, tx: -0.2, ly: 0.6 }),
    K(0.56, { rsx: -0.5, rel: -0.05, wr: 3.1, lsx: -0.6, lsz: 0.4, lel: -0.1, tx: 0.8, crouch: 0.32, ly: 0 }),
    K(0.78, { rsx: -0.5, rel: -0.1, wr: 3.05, lsx: -0.6, lsz: 0.4, lel: -0.15, tx: 0.75, crouch: 0.28 }), K(1.0, {})] },
  art_spin: { duration: 1.15, impactAt: 0.4, fast: -1, keys: [
    K(0, {}), K(0.16, { ...SPIN_ARMS, ty: -0.7, by: 0, crouch: 0.15 }), K(0.55, { ...SPIN_ARMS, ty: 0.2, by: PI * 2 }),
    K(0.92, { ...SPIN_ARMS, ty: 0.3, by: PI * 4, crouch: 0.16 }), K(1.15, { by: PI * 4 })] },
  art_dash: { duration: 0.9, impactAt: 0.2, fast: -1, twoOK: true, keys: [
    K(0, {}), K(0.16, { rsx: -1.1, rsz: -0.25, rel: -1.55, wp: -PI / 2, ty: -0.6, tx: 0.1, crouch: 0.2, lsx: -1.0, lsz: 0.3, lel: -1.2 }),
    K(0.22, { rsx: -1.55, rsz: 0.05, rel: -0.05, wp: -PI / 2, ty: 0.35, tx: 0.42, crouch: 0.18, lsx: -0.5, lsz: 0.6, lel: -0.4 }),
    K(0.62, { rsx: -1.55, rsz: 0.05, rel: -0.05, wp: -PI / 2, ty: 0.35, tx: 0.42, crouch: 0.18, lsx: -0.5, lsz: 0.6, lel: -0.4 }), K(0.9, {})] },
  art_reap: { duration: 1.0, impactAt: 0.45, fast: 2, twoOK: true, keys: [
    K(0, {}), K(0.2, { rsx: -1.1, rsz: -1.3, rel: -0.8, wr: PI, wy: -PI / 2, ty: -0.6, crouch: 0.05, lsx: -0.8, lsz: 0.4, lel: -1.0 }),
    K(0.36, { rsx: -1.3, rsz: -1.7, rel: -0.6, wr: PI, wy: -PI / 2, ty: -1.15, crouch: 0.08, lsx: -0.9, lsz: 0.5, lel: -1.1 }),
    K(0.45, { rsx: -1.4, rsz: 1.0, rel: -0.2, wr: PI, wy: -PI / 2, ty: 1.0, tx: 0.2, crouch: 0.16, lsx: -0.3, lsz: 0.9, lel: -0.5 }),
    K(0.65, { rsx: -1.3, rsz: 1.1, rel: -0.25, wr: PI, wy: -PI / 2, ty: 1.05, tx: 0.18, crouch: 0.14, lsx: -0.3, lsz: 0.9, lel: -0.5 }), K(1.0, {})] },
  art_slam: { alias: 'slam', speed: 0.8 },
  art_crescent: { alias: 'rising', speed: 0.8 },
  art_burst: { alias: 'thrust', speed: 0.75 },
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
export const ACTION_NAMES = Object.keys(ACTIONS);

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
  const cape = grp(torso, 0, 0.47, -0.1); if (L.cloak != null) cape.add(buildCape(L));
  const neck = grp(torso, 0, NECK_Y, 0.005);
  const head = grp(neck); head.add(buildHead(L));

  const arm = {};
  for (const [key, s] of [['l', 1], ['r', -1]]) {
    const sh = grp(torso, s * SH_X * w, SH_Y, 0); sh.add(buildUpper(L, key));
    const el = grp(sh, 0, -UPPER, 0); el.add(buildFore(L, key));
    const hand = grp(el, 0, -FORE, 0); hand.add(buildHand(L));
    arm[key] = { sh, el, hand };
  }
  // Waffen-Halter (Griff am Ursprung, Klinge +Y); Standard = Fäuste (leer)
  const weaponR = grp(arm.r.hand, 0, -0.045, 0.0); weaponR.rotation.order = 'YXZ';
  const weaponL = grp(arm.l.hand, 0, -0.045, 0.0); weaponL.rotation.order = 'YXZ';
  const blade = grp(weaponR, 0, 0.05, 0);       // Spitze (für Hitbox/FX), wird von setWeapon versetzt
  const flask = buildFlask(); flask.position.set(0, -0.07, 0.03); flask.visible = false; arm.l.hand.add(flask);
  let grip = 'fists', curWeapon = null, curOff = null;
  /** Waffe in die Hand: mesh = Object3D aus buildWeaponMesh (userData.tip, userData.offhand) oder null (Fäuste) */
  function setWeapon(mesh, gripType) {
    if (curWeapon) weaponR.remove(curWeapon);
    if (curOff) weaponL.remove(curOff);
    curWeapon = mesh || null; curOff = mesh?.userData?.offhand || null;
    if (curWeapon) weaponR.add(curWeapon);
    if (curOff) weaponL.add(curOff);
    const tip = mesh?.userData?.tip;
    blade.position.set(0, tip ? tip.y * 0.85 : 0.05, tip ? tip.z || 0 : 0);
    grip = gripType || (mesh ? (curOff ? 'dual' : 'one') : 'fists');
  }

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
  let action = null, actionT = 0, actDef = null, actSpeed = 1;
  // Pose-Überblendung zwischen Aktionen (Combo-Ketten ohne Springen)
  const POSE_KEYS = ['lsx', 'lsz', 'lel', 'rsx', 'rsz', 'rel', 'wr', 'wy', 'lwr', 'lwy', 'tx', 'ty', 'crouch', 'by', 'ly'];
  const last = {}, from = {}; for (const k of POSE_KEYS) last[k] = from[k] = 0;
  let fadeT = 0; const FADE = 0.12;

  /** name: siehe ACTION_NAMES (slashR, thrust, spin, slam, jab, …, drink, heavyCharge, art_*, roll, hurt, death, wave, chop).
   *  opts = { speed } → { duration, impactAt } in Sekunden (bereits durch speed geteilt). Unbekannte art_* fallen auf 'slam' zurück. */
  function playAction(name, opts = {}) {
    let A = ACTIONS[name], sp = opts.speed || 1;
    if (!A && name && name.startsWith('art_')) A = ACTIONS.slam;
    if (!A) return { duration: 0, impactAt: 0 };
    if (A.alias) { sp *= A.speed || 1; A = ACTIONS[A.alias]; }
    if (action && action !== 'death') { for (const k of POSE_KEYS) from[k] = last[k]; fadeT = FADE; } else fadeT = 0;
    action = name; actionT = 0; actDef = A; actSpeed = sp;
    return { duration: A.duration / sp, impactAt: A.impactAt / sp };
  }
  function cancelAction() { action = null; actDef = null; actionT = 0; fadeT = 0; }

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
      l: { sx: sP * armA * moveW + idleW * (0.05 + breath * 0.02), sz: 0.1 + idleW * breath * 0.015, el: elB * moveW - 0.18 * idleW + Math.max(0, -sP) * -0.25 * moveW, wr: 1.42, wy: 0 },
      r: { sx: -sP * armA * moveW + idleW * (-0.05 - breath * 0.02), sz: -0.1 - idleW * breath * 0.015, el: elB * moveW - 0.3 * idleW + Math.max(0, sP) * -0.25 * moveW, wr: grip === 'two' ? 2.3 : Math.PI / 2 - 0.15, wy: 0 },
    };
    for (const k of ['l', 'r']) {
      const sg = k === 'l' ? 1 : -1, a = arms[k];
      const airSx = -1.3 * tuck - 0.25 * reach, airSz = sg * (0.35 * tuck + 1.05 * reach), airEl = -0.7 * tuck - 0.2 * reach;
      a.sx = lerp(a.sx, airSx, st.air); a.sz = lerp(a.sz, airSz, st.air); a.el = lerp(a.el, airEl, st.air);
      a.sx = lerp(a.sx, -0.35, st.land); a.sz += sg * st.land * 0.5;      // Landung: Arme fangen ab
    }

    // --- Aktions-Layer (nur Oberkörper, überlagert Locomotion; Rolle/Tod = ganzer Körper) ---
    let neckJerk = 0, deathX = 0;
    let actW = 0, rollA = 0, tuckW = 0, deathW = 0, deathLift = 0, bodyYaw = 0, lift = 0;
    if (action) actionT += dt * actSpeed;
    const AC = action ? actDef : null;
    if (AC && AC.keys) {
      const k = sampleKeys(AC.keys, Math.min(actionT, AC.duration), AC.fast);
      actW = smooth(0, 0.07, actionT) * (AC.hold ? 1 : 1 - smooth(AC.duration - 0.16, AC.duration, actionT));
      if (fadeT > 0) actW = 1;                               // beim Kettenwechsel voll im Aktions-Layer bleiben
      // Zweihand-Griff: linke Hand greift den Schaft hinter der rechten
      if (grip === 'two' && AC.twoOK) { k.lsx = k.rsx + 0.1; k.lsz = k.rsz - 0.6; k.lel = k.rel - 0.35; }
      if (action === 'heavyCharge') { const j = Math.sin(st.t * 47) * 0.025 * smooth(0.3, 0.9, actionT); k.rsx += j; k.tx += j; }
      const legW = 1 - moveW;
      arms.r.sx = lerp(arms.r.sx, k.rsx, actW); arms.r.sz = lerp(arms.r.sz, k.rsz, actW);
      arms.r.el = lerp(arms.r.el, k.rel, actW); arms.r.wr = lerp(arms.r.wr, k.wr, actW); arms.r.wy = lerp(0, k.wy, actW);
      arms.l.sx = lerp(arms.l.sx, k.lsx, actW); arms.l.sz = lerp(arms.l.sz, k.lsz, actW); arms.l.el = lerp(arms.l.el, k.lel, actW);
      arms.l.wr = lerp(arms.l.wr, k.lwr, actW); arms.l.wy = lerp(0, k.lwy, actW);
      torsoX += k.tx * actW; torsoY = lerp(torsoY, k.ty, actW * 0.85);
      crouch += k.crouch * actW * legW;
      hipY -= k.crouch * actW * 0.6 * legW;
      bodyYaw = (k.by % (Math.PI * 2)) * actW; lift = Math.max(0, k.ly) * actW;
      if (lift > 0) { crouch = Math.max(0, crouch - lift * 0.2); }
      if (action === 'hurt') neckJerk = 0.5 * actW;
      if (action === 'drink') neckJerk = -0.45 * smooth(0.2, 0.35, actionT) * (1 - smooth(0.8, 1.0, actionT));
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
      arms.l.wr = lerp(arms.l.wr, from.lwr, f); arms.l.wy = lerp(arms.l.wy || 0, from.lwy, f);
      torsoX = lerp(torsoX, from.tx, f); torsoY = lerp(torsoY, from.ty, f);
      bodyYaw = lerp(bodyYaw, from.by, f); lift = lerp(lift, from.ly, f);
    }
    last.lsx = arms.l.sx; last.lsz = arms.l.sz; last.lel = arms.l.el; last.rsx = arms.r.sx; last.rsz = arms.r.sz; last.rel = arms.r.el;
    last.wr = arms.r.wr; last.wy = arms.r.wy || 0; last.lwr = arms.l.wr; last.lwy = arms.l.wy || 0; last.tx = torsoX; last.ty = torsoY;
    last.by = bodyYaw; last.ly = lift;
    // Rolle/Tod: Beine anziehen bzw. ausstrecken
    if (tuckW > 0 || deathW > 0) for (const k of ['l', 'r']) {
      const g = legs[k], sg = k === 'l' ? 1 : -1;
      if (tuckW > 0) { g.th = lerp(g.th, -1.75, tuckW); g.kn = lerp(g.kn, 2.35, tuckW); g.ft = lerp(g.ft, -0.2, tuckW); }
      if (deathW > 0) { g.th = lerp(g.th, -0.12, deathW); g.kn = lerp(g.kn, 0.15, deathW); g.ft = lerp(g.ft, 0.5, deathW); g.z = lerp(g.z, sg * 0.12, deathW); }
    }

    // --- Anwenden ---
    rollG.rotation.set(rollA, 0, 0);
    rollG.position.y = ROLL_Y + Math.sin(rollA / 2) * 0.12;
    body.rotation.set(bodyX * (1 - deathW) + deathX, bodyYaw, bodyZ * (1 - deathW));
    body.position.y = -ROLL_Y + deathLift + lift;
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
    weaponR.rotation.set(arms.r.wr, arms.r.wy || 0, 0);
    weaponL.rotation.set(arms.l.wr ?? 1.42, arms.l.wy || 0, 0);
    flask.visible = action === 'drink' && actionT > 0.08 && actionT < 1.0;

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
    setWeapon,
    get grip() { return grip; },
    get weapon() { return curWeapon; },
    /** Weltposition der Hand ('l'|'r') bzw. der Waffenspitze */
    handWorld(side = 'l', out = new THREE.Vector3()) { root.updateMatrixWorld(); return arm[side].hand.getWorldPosition(out); },
    bladeWorld(out = new THREE.Vector3()) { root.updateMatrixWorld(); return blade.getWorldPosition(out); },
  };
}
