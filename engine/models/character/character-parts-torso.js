/**
 * @modul    character-parts-torso
 * @zweck    Bau-Funktion für den Figuren-Oberkörper (Knochen torso) je Oberteil-Stil: Kittel, Hemd, Robe, Rüstung, Weste, Kleid, Mantel, Schürze, Kettenhemd, Lederrüstung
 * @api      baueTorso(b,ctx) -> b
 * @beispiel
 *   import { baueTorso } from '../../engine/models/character/character-parts-torso.js';
 *   rig.knochen.torso.add(baueTorso(createMeshBuilder({ seed }), teilKontext(look, masse)).mesh());
 * @tags     figur, charakter, kleidung, oberteil, rüstung, mantel, schürze
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { dunkler, heller, GOLD } from './character-parts-basis.js';

/** Torso: von 0 (Taille) bis torsoLaenge (Halsansatz). */
export function baueTorso(b, K) {
  const { m, g, w, f, taille: rw, brust: rc, tiefe: sz } = K, L = m.torsoLaenge, st = K.stil.ober;
  const zv = (y) => (y < 0.55 * L ? rw + (rc - rw) * y / (0.55 * L) : rc * 0.97) * sz;
  const weste = st === 'weste', basis = weste ? f.haut : f.ober;
  const jit = st === 'kettenhemd' ? 0.3 : undefined;                       // Kettenhemd: unruhige „Ringe“
  const rumpf = (fak, farbe, offen) => {               // offen = Winkel der Front-Öffnung (Weste)
    const t = offen ? { thetaStart: offen / 2, thetaLength: 2 * Math.PI - offen } : null;
    const zyl = (r1, r2, h, y) => {
      const geo = new THREE.CylinderGeometry(r1 * fak, r2 * fak, h, 10, 1, !!t, t?.thetaStart, t?.thetaLength);
      b.add(geo, farbe, { y, sz, jitter: jit }); geo.dispose();
    };
    zyl(rc, rw, L * 0.55, L * 0.275);
    zyl(rc * 0.96, rc, L * 0.31, L * 0.705);
  };
  rumpf(1, basis);
  b.sphere(rc, f.ober, { y: L * 0.86, sx: (m.schulterX + K.armR * 0.3) / rc, sy: 0.55, sz, jitter: jit }, 10, 6);   // Schulterpartie
  b.sphere(rc * 0.55, ['kittel', 'kleid', 'weste', 'schuerze'].includes(st) ? f.haut : f.ober, { y: L * 0.97, sy: 0.6, sz: 0.85 }, 9, 5);  // Nacken
  if (m.bauch > 0) {
    const t = { y: L * 0.3, z: m.bauch * 0.03 * g, sz: sz + m.bauch * 0.3 };
    b.sphere(rw * 1.1, basis, t, 10, 7);
    if (weste) { const geo = new THREE.SphereGeometry(rw * 1.16, 10, 7, Math.PI / 2 + 0.45, 2 * Math.PI - 0.9); b.add(geo, f.ober, t); geo.dispose(); }
    if (st === 'schuerze') b.sphere(rw * 1.13, f.akzent, { ...t, sx: 0.7, sy: 0.9, z: t.z + 0.008 * g }, 8, 6);
  }
  if (st !== 'ruestung') for (const s of [-1, 1]) b.sphere(K.armR * 1.2, K.aermel[0], { x: s * m.schulterX, y: m.schulterY, sy: 0.9 }, 7, 5);
  const zt = zv(L * 0.9);
  if (st === 'kittel') {
    b.torus(rc * 0.5, 0.016 * g, f.akzent, { y: L * 0.98, rx: Math.PI / 2 + 0.2, sy: 0.8 }, 4, 12);
    for (let i = 0; i < 3; i++) b.box(0.035 * g, 0.008 * g, 0.01 * g, f.akzent, { y: L * (0.74 + i * 0.05), z: zv(L * 0.75) + 0.003 });
  } else if (st === 'hemd' || st === 'schuerze') {
    for (const s of [-1, 1]) b.box(0.06 * g, 0.04 * g, 0.012 * g, heller(f.ober, 0.25), { x: s * 0.03 * g, y: L * 0.98, z: zt + 0.01 * g, rz: s * 0.7, rx: -0.4 });
    if (st === 'hemd') {
      for (let i = 0; i < 4; i++) b.sphere(0.008 * g, f.akzent, { y: L * (0.3 + i * 0.17), z: zv(L * (0.3 + i * 0.17)) + 0.002 }, 4, 3);
      b.box(0.05 * g, 0.05 * g, 0.01 * g, dunkler(f.ober, 0.12), { x: 0.06 * g * w, y: L * 0.66, z: zv(L * 0.66) - 0.002 });
    } else {                                                                                               // Schürzenlatz + Träger + Schleife
      b.box(0.15 * g * w, L * 0.5, 0.012 * g, f.akzent, { y: L * 0.55, z: zv(L * 0.55) + 0.006 * g, rx: -0.06 });
      for (const s of [-1, 1]) {
        b.box(0.022 * g, L * 0.2, 0.008 * g, f.akzent, { x: s * 0.07 * g * w, y: L * 0.9, z: zv(L * 0.9) + 0.004 });
        b.box(0.022 * g, 0.012 * g, rc * 2 * sz, f.akzent, { x: s * 0.07 * g * w, y: L * 1.0 });
      }
      b.cyl(rw * 1.03, rw * 1.03, 0.025 * g, f.akzent, { y: L * 0.06, sz: sz * 1.03 }, 10);
      for (const s of [-1, 1]) b.sphere(0.03 * g, f.akzent, { x: s * 0.03 * g, y: L * 0.07, z: -rw * sz - 0.01 * g, sx: 1.4, sz: 0.5 }, 5, 4);
    }
  } else if (st === 'robe') {
    b.box(0.06 * g, L * 0.95, 0.012 * g, f.akzent, { y: L * 0.47, z: zv(L * 0.5) + 0.004 });
    b.torus(rc * 0.55, 0.025 * g, f.akzent, { y: L * 1.0, rx: Math.PI / 2 + 0.15, sy: 0.75 }, 5, 12);
  } else if (st === 'ruestung') {
    b.sphere(rc * 0.9, heller(f.ober, 0.12), { y: L * 0.62, z: 0.02 * g, sy: 1.05, sz: sz * 0.9 }, 9, 6);  // Brustplatte
    for (let i = 0; i < 3; i++) b.cyl(rw + 0.012 * g + i * 0.008 * g, rw + 0.008 * g + i * 0.008 * g, 0.05 * g, dunkler(f.ober, 0.08 * i), { y: L * (0.08 + i * 0.1), sz }, 10);
    b.box(0.12 * g * w, L * 0.7, 0.012 * g, f.akzent, { y: L * 0.4, z: zv(L * 0.45) + 0.035 * g });             // Wappenrock
    b.sphere(0.028 * g, GOLD, { y: L * 0.58, z: zv(L * 0.55) + 0.045 * g, sz: 0.4 }, 6, 4);
    for (const s of [-1, 1]) {                                                                            // Schulterplatten
      b.sphere(K.armR * 1.65, f.ober, { x: s * m.schulterX, y: m.schulterY + 0.01 * g, sy: 0.75 }, 8, 5);
      b.sphere(K.armR * 1.5, dunkler(f.ober, 0.12), { x: s * m.schulterX * 1.05, y: m.schulterY - 0.025 * g, sy: 0.6 }, 8, 4);
    }
  } else if (weste) {
    rumpf(1.05, f.ober, 0.75);
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const y = L * (0.18 + i * 0.17), r = (y < 0.55 * L ? rw + (rc - rw) * y / (0.55 * L) : rc * 0.97) * 1.05;
      b.sphere(0.009 * g, f.akzent, { x: s * Math.sin(0.4) * r, y, z: Math.cos(0.4) * r * sz }, 4, 3);
    }
  } else if (st === 'kleid') {
    b.box(0.12 * g * w, 0.05 * g, 0.012 * g, f.haut, { y: L * 0.95, z: zt + 0.004 });                       // eckiger Ausschnitt
    b.box(0.14 * g * w, 0.018 * g, 0.014 * g, f.akzent, { y: L * 0.91, z: zt + 0.004 });
    for (let i = 0; i < 3; i++) b.box(0.05 * g, 0.008 * g, 0.012 * g, f.akzent, { y: L * (0.25 + i * 0.15), z: zv(L * (0.25 + i * 0.15)) + 0.003, rz: i % 2 ? 0.6 : -0.6 });
  } else if (st === 'mantel') {
    b.box(0.012 * g, L * 0.95, 0.01 * g, dunkler(f.ober, 0.35), { y: L * 0.47, z: zv(L * 0.5) + 0.002 });  // Knopfleiste
    for (const s of [-1, 1]) {
      b.box(0.05 * g, L * 0.32, 0.012 * g, f.akzent, { x: s * 0.045 * g, y: L * 0.82, z: zt + 0.006 * g, rz: s * 0.35, rx: -0.15 });  // Revers
      for (let i = 0; i < 3; i++) b.sphere(0.01 * g, GOLD, { x: s * 0.035 * g, y: L * (0.25 + i * 0.16), z: zv(L * (0.25 + i * 0.16)) + 0.004 }, 4, 3);
    }
    b.torus(rc * 0.56, 0.03 * g, f.akzent, { y: L * 1.0, rx: Math.PI / 2 + 0.25, sy: 0.75 }, 5, 12);            // Stehkragen
  } else if (st === 'kettenhemd') {
    b.torus(rc * 0.55, 0.025 * g, dunkler(f.ober, 0.2), { y: L * 0.99, rx: Math.PI / 2 + 0.15, sy: 0.75, jitter: 0.3 }, 5, 12);
    for (const s of [-1, 1]) b.box(0.16 * g * w, L * 0.82, 0.012 * g, f.akzent, { y: L * 0.45, z: s * (zv(L * 0.45) + 0.008 * g), rx: s * 0.04 });  // Wappenrock
    b.sphere(0.03 * g, heller(f.akzent, 0.35), { y: L * 0.6, z: zv(L * 0.6) + 0.016 * g, sz: 0.3 }, 6, 4);
  } else if (st === 'lederruestung') {
    b.sphere(rc * 0.88, dunkler(f.ober, 0.1), { y: L * 0.6, z: 0.012 * g, sy: 1.0, sz: sz * 0.92, jitter: 0.12 }, 9, 6);  // Brustschutz
    const lang = Math.hypot(0.24 * g * w, L * 0.75);
    b.box(0.03 * g, lang, 0.012 * g, f.akzent, { y: L * 0.52, z: zv(L * 0.5) + 0.02 * g, rz: Math.atan2(0.24 * g * w, L * 0.75) });  // Schrägriemen
    b.box(0.03 * g, lang, 0.012 * g, f.akzent, { y: L * 0.52, z: -zv(L * 0.5) - 0.012 * g, rz: -Math.atan2(0.24 * g * w, L * 0.75) });
    b.sphere(0.014 * g, GOLD, { y: L * 0.52, z: zv(L * 0.5) + 0.03 * g }, 4, 3);
    for (let i = 0; i < 4; i++) b.box(0.08 * g * w, 0.006 * g, 0.01 * g, dunkler(f.ober, 0.3), { y: L * (0.12 + i * 0.08), z: zv(L * (0.12 + i * 0.08)) + 0.003 });
  }
  return b;
}
