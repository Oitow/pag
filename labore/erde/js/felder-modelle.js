// Low-Poly-Modelle für den Ackerbau: je Feldfrucht und Stufe EINE Pflanze (Büschel) als Geometrie (y = oben, Fuß bei 0, Meter),
// dazu die Anordnung im 2×2-m-Beet. Gebaut mit engine/render/mesh-builder (Vertexfarben), gecacht – nur dispose am Ende.
import { createMeshBuilder } from '../../../engine/render/mesh-builder.js';
import { rng } from '../../../engine/core/rng.js';

/** Pflanzen je Beet: reihen auf den Dämmen (x), je = Pflanzen je Reihe (z). Beet = 2 × 2 m, Dämme 0,5 m auseinander. */
export const ANORDNUNG = {
  weizen: { reihen: 4, je: 5 }, roggen: { reihen: 4, je: 5 }, reis: { reihen: 4, je: 5 }, hirse: { reihen: 4, je: 4 },
  kartoffel: { reihen: 4, je: 3 }, mais: { reihen: 3, je: 3, daemme: [-0.6, 0, 0.6] },
};
/** Lage (lokal im Beet, Meter) der Dämme. */
export const DAEMME = [-0.75, -0.25, 0.25, 0.75];

// Farben: gedämpft (ART-DIRECTION §2) – Grün oliv, Reif strohig
const GRUEN = 0x5f8f35, GRUEN_HELL = 0x7aa845, GRUEN_DUNKEL = 0x3f6a2a;

/** Ein Halm von (x,0,z) in Richtung (Neigung t, Azimut a), Länge h; liefert die Spitze. */
function halm(b, x, z, t, a, h, r, farbe) {
  const dx = Math.sin(t) * Math.cos(a), dy = Math.cos(t), dz = Math.sin(t) * Math.sin(a);
  b.cyl(r * 0.7, r, h, farbe, { x: x + dx * h / 2, y: dy * h / 2, z: z + dz * h / 2, rx: t * Math.sin(a), rz: -t * Math.cos(a) }, 3);
  return [x + dx * h, dy * h, z + dz * h, t, a];
}

/** Blatt: flache Zunge vom Punkt (x,y,z) nach außen (Azimut a), um rz aufgerichtet. */
function blatt(b, x, y, z, a, L, w, rz, farbe) {
  const dx = Math.cos(rz) * Math.cos(a), dy = Math.sin(rz), dz = Math.cos(rz) * Math.sin(a);
  b.box(L, 0.006, w, farbe, { x: x + dx * L / 2, y: y + dy * L / 2, z: z + dz * L / 2, ry: -a, rz });
}

/** Getreide-Büschel: n Halme, Kopf = 'aehre' | 'rispe' | 'kolben' | null. */
function getreide(b, r, { n, h, halmF, kopfF, kopf, kopfL = 0.1, kopfR = 0.014, neig = 0.14, blattF = null }) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.8, rad = 0.02 + r() * 0.06;
    const hh = h * (0.85 + r() * 0.25), t = neig * (0.5 + r());
    const [x, y, z] = halm(b, Math.cos(a) * rad, Math.sin(a) * rad, t, a, hh, 0.007, halmF);
    if (blattF && i % 2 === 0) blatt(b, Math.cos(a) * rad, hh * (0.25 + r() * 0.2), Math.sin(a) * rad, a + 0.6, h * 0.35, 0.018, 0.5, blattF);
    if (kopf === 'aehre') b.box(kopfR * 2, kopfL, kopfR * 1.4, kopfF, { x, y: y + kopfL * 0.45, z, rx: t * Math.sin(a), rz: -t * Math.cos(a), ry: a });
    else if (kopf === 'rispe') {          // Reis: nickende Rispe, hängt zur Seite
      b.cone(0.022, kopfL, kopfF, { x: x + Math.cos(a) * 0.04, y: y - kopfL * 0.25, z: z + Math.sin(a) * 0.04, rx: -1.9 * Math.sin(a), rz: 1.9 * Math.cos(a) }, 4);
    } else if (kopf === 'kolben') b.ico(kopfR, kopfF, { x, y: y + kopfL * 0.4, z, sy: kopfL / kopfR / 2 });
  }
}

/** Grashalm-Keimling: 3–4 kurze Blättchen. */
function keim(b, r, h, farbe, breit = 0.012, n = 3) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.6;
    blatt(b, 0, 0, 0, a, h, breit, 1.1 + r() * 0.3, farbe);
  }
}

function kartoffel(b, r, st) {
  if (st === 'keimling') { for (let i = 0; i < 4; i++) { const a = i * 1.6 + r(); b.ico(0.035, GRUEN_HELL, { x: Math.cos(a) * 0.04, y: 0.04, z: Math.sin(a) * 0.04, sy: 0.5 }); } return; }
  // Kraut: Stängel mit flachen Blattbüscheln; reif = welk, gelb-braun und umgesunken
  const reif = st === 'reif', h = reif ? 0.28 : 0.45, n = reif ? 9 : 7;
  for (let i = 0; i < n; i++) {
    const a = i * (Math.PI * 2 / n) + r() * 0.5, rad = 0.07 + r() * 0.12, y = h * (0.45 + r() * 0.55), kipp = reif ? 0.7 : 0.3;
    b.cyl(0.006, 0.008, y, reif ? 0x8a7a42 : GRUEN_DUNKEL, { x: Math.cos(a) * rad * 0.5, y: y / 2, z: Math.sin(a) * rad * 0.5, rz: -kipp * Math.cos(a), rx: kipp * Math.sin(a) }, 3);
    if (reif) blatt(b, Math.cos(a) * rad, y * 0.8, Math.sin(a) * rad, a, 0.16, 0.07, -0.2 + r() * 0.3, [0xa59a4c, 0x8f8a42, 0x7d6a38][i % 3]);
    else b.ico(0.08 + r() * 0.04, i % 2 ? GRUEN : GRUEN_DUNKEL, { x: Math.cos(a) * rad, y, z: Math.sin(a) * rad, sy: 0.6 });
  }
  if (!reif) for (let i = 0; i < 4; i++) { const a = i * 1.7 + r(); b.box(0.025, 0.02, 0.025, 0xeeeadf, { x: Math.cos(a) * 0.1, y: h + 0.02, z: Math.sin(a) * 0.1 }); }
  else for (let i = 0; i < 3; i++) { const a = i * 2.1 + r(); b.sphere(0.04, 0xb08a58, { x: Math.cos(a) * 0.16, y: 0.02, z: Math.sin(a) * 0.16, sx: 1.3 }, 6, 4); }
}

function mais(b, r, st) {
  if (st === 'keimling') { keim(b, r, 0.14, GRUEN_HELL, 0.03, 4); return; }
  const reif = st === 'reif', h = reif ? 2.1 : 1.15;
  const halmF = reif ? 0xa39a5a : GRUEN, blattF = reif ? 0xb2a860 : GRUEN;
  b.cyl(0.014, 0.022, h, halmF, { y: h / 2 }, 5);
  for (let i = 0; i < 7; i++) {
    const y = h * (0.12 + i * 0.1), a = i * 2.4 + r() * 0.4;
    blatt(b, 0, y, 0, a, (reif ? 0.6 : 0.5) * (1 - i * 0.06), 0.065, 0.35 + r() * 0.3, i % 2 ? blattF : (reif ? 0x9c934e : GRUEN_DUNKEL));
  }
  if (reif) {
    b.cyl(0.032, 0.026, 0.22, 0xe0bb48, { x: 0.05, y: h * 0.52, z: 0.02, rz: -0.35 }, 6);             // Kolben
    b.cone(0.035, 0.12, 0xc8b47c, { x: 0.075, y: h * 0.52 + 0.14, z: 0.02, rz: -0.35 }, 5);              // Lieschblätter
    for (let i = 0; i < 5; i++) { const a = i * 1.25; b.cone(0.008, 0.2, 0xd4bf86, { x: Math.cos(a) * 0.03, y: h + 0.08, z: Math.sin(a) * 0.03, rz: -0.4 * Math.cos(a), rx: 0.4 * Math.sin(a) }, 3); }
  }
}

/** Saat: ein paar helle Körner bzw. eine kleine Saatkartoffel auf dem Damm. */
function saat(b, r, f) {
  if (f === 'kartoffel') { b.sphere(0.035, 0xa88456, { y: 0.01, sx: 1.3 }, 5, 4); return; }
  for (let i = 0; i < 4; i++) b.box(0.018, 0.01, 0.012, f === 'mais' ? 0xd8b448 : 0xc9b07a, { x: (r() - 0.5) * 0.12, y: 0.005, z: (r() - 0.5) * 0.12, ry: r() * 3 });
}

const BAU = {
  weizen: (b, r, st) => st === 'keimling' ? keim(b, r, 0.1, GRUEN_HELL)
    : getreide(b, r, st === 'reif' ? { n: 9, h: 0.9, halmF: 0xc8a650, kopfF: 0xd2a644, kopf: 'aehre', kopfL: 0.09 }
      : { n: 8, h: 0.5, halmF: GRUEN, kopfF: GRUEN_HELL, kopf: 'aehre', kopfL: 0.06, blattF: GRUEN_DUNKEL }),
  roggen: (b, r, st) => st === 'keimling' ? keim(b, r, 0.11, 0x6a9a48)
    : getreide(b, r, st === 'reif' ? { n: 8, h: 1.3, halmF: 0xb4a36c, kopfF: 0x9f8f64, kopf: 'aehre', kopfL: 0.13, kopfR: 0.011, neig: 0.2 }
      : { n: 8, h: 0.7, halmF: 0x6a9448, kopfF: 0x86a860, kopf: 'aehre', kopfL: 0.08, kopfR: 0.01, blattF: GRUEN_DUNKEL }),
  reis: (b, r, st) => st === 'keimling' ? keim(b, r, 0.12, 0x78b04a, 0.01, 4)
    : getreide(b, r, st === 'reif' ? { n: 10, h: 0.8, halmF: 0xb8b060, kopfF: 0xd6be6a, kopf: 'rispe', kopfL: 0.16, neig: 0.22, blattF: 0xa8a85a }
      : { n: 10, h: 0.5, halmF: 0x6ea648, kopfF: 0x8ab45a, kopf: null, neig: 0.25, blattF: 0x5f9a3c }),
  hirse: (b, r, st) => st === 'keimling' ? keim(b, r, 0.1, GRUEN_HELL, 0.018)
    : getreide(b, r, st === 'reif' ? { n: 6, h: 1.1, halmF: 0xa89a58, kopfF: 0x9a5a30, kopf: 'kolben', kopfL: 0.16, kopfR: 0.04, neig: 0.1, blattF: 0xa49a56 }
      : { n: 6, h: 0.6, halmF: GRUEN, kopfF: GRUEN_HELL, kopf: null, neig: 0.1, blattF: GRUEN_DUNKEL }),
  kartoffel, mais,
};

const cache = new Map();
/** Geometrie einer Pflanze (frucht, stufe 'saat'|'keimling'|'wachsend'|'reif'), gecacht. */
export function pflanzenGeo(frucht, st) {
  const key = frucht + ':' + st;
  if (!cache.has(key)) {
    const b = createMeshBuilder({ seed: key.length * 131 + frucht.charCodeAt(0), jitter: 0.1 }), r = rng(key.length * 977 + st.charCodeAt(0));
    if (st === 'saat') saat(b, r, frucht); else BAU[frucht](b, r, st);
    cache.set(key, b.geometry());
  }
  return cache.get(key);
}

/** Pflanzenorte im Beet (lokal, Meter): [[x, z, Drehung, Größe]…], fest je Beet-Seed. */
export function pflanzOrte(frucht, seed) {
  const A = ANORDNUNG[frucht], r = rng(seed), out = [];
  const daemme = A.daemme || DAEMME.slice(0, A.reihen);
  for (const x of daemme) for (let j = 0; j < A.je; j++) {
    const z = -0.8 + (1.6 * (j + 0.5)) / A.je;
    out.push([x + (r() - 0.5) * 0.06, z + (r() - 0.5) * 0.08, r() * Math.PI * 2, 0.85 + r() * 0.3]);
  }
  return out;
}

export function disposeFelderModelle() { for (const g of cache.values()) g.dispose(); cache.clear(); }
