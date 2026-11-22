/**
 * @modul    riesenwald-teile
 * @zweck    Bauteile des Riesenwald-Moduls: Fern-Silhouette eines Riesen (eine Drehform mit Kronen-Wulst, ~150 Dreiecke), Astbogen zwischen zwei Tor-Riesen (gebogene, verjüngte Röhre mit Moos oben) und eine Loch-Maske für Kronen-Schatten
 * @api      fernRiese({ hoehe, stammRadius, kronenAb, kronenRadius, segmente = 9 }) -> BufferGeometry ; astBogen({ a {x,y,z,r}, b {x,y,z,r}, scheitel = 26, dicke = 1.8, seed }) -> { geometrie, punkte [[x,y,z]…] } ; lochMaske({ seed, groesse = 64, dicht = 0.42 }) -> DataTexture
 * @beispiel
 *   import { fernRiese, astBogen, lochMaske } from '../../engine/spiel/riesenwald-teile.js';
 *   const geo = fernRiese({ hoehe: 80, stammRadius: 5, kronenAb: 44, kronenRadius: 32 });
 *   const bogen = astBogen({ a: { x: -9, y: 0, z: 0, r: 6 }, b: { x: 9, y: 0, z: 0, r: 5 } });
 * @tags     spiel, riesenwald, impostor, lod, ast, bogen, schatten, maske
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { rng, hashSeed } from '../core/rng.js';

const RINDE = [0.105, 0.09, 0.075], KRONE = [0.05, 0.075, 0.05], MOOS = [0.07, 0.1, 0.04];

/** Ferne Riesen: Stamm mit Wurzelanlauf, darüber ein dunkler Kronen-Wulst – nur Silhouette im Dunst. Baumfuß = Ursprung. */
export function fernRiese({ hoehe: H, stammRadius: R, kronenAb, kronenRadius: K, segmente = 9 }) {
  const p = [[R * 2.0, -0.6], [R * 1.3, 2], [R * 1.02, 8], [R * 0.82, kronenAb * 0.92], [K * 0.5, kronenAb + 4], [K * 0.78, kronenAb + (H - kronenAb) * 0.4],
    [K * 0.62, kronenAb + (H - kronenAb) * 0.75], [K * 0.25, H * 0.97], [0.01, H]];
  const geo = new THREE.LatheGeometry(p.map(([x, y]) => new THREE.Vector2(x, y)), segmente);
  const pos = geo.attributes.position, farbe = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.smoothstep(pos.getY(i), kronenAb - 2, kronenAb + 6), c = [0, 1, 2].map((k) => RINDE[k] + (KRONE[k] - RINDE[k]) * t);
    farbe.set(c, i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(farbe, 3));
  return geo;
}

/**
 * Astbogen über dem Weg: wächst aus Stamm a (Welt, r = Stammradius), steigt bis `scheitel` m über dem tieferen Fuß und taucht in Stamm b.
 * Röhre mit Knoten (dicker an den Stämmen), Rindenfarbe, Moos auf der Oberseite. → { geometrie, punkte (Mittellinie, für Laub-Büschel) }
 */
export function astBogen({ a, b, scheitel = 26, dicke = 1.8, seed = 1, ringe = 48, seiten = 10 }) {
  const r = rng(hashSeed('astbogen', seed));
  const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l, y0 = Math.min(a.y, b.y);
  const stuetz = [
    [a.x + ux * a.r * 0.4, y0 + scheitel * 0.62, a.z + uz * a.r * 0.4],
    [a.x + ux * (a.r + 3), y0 + scheitel * 0.84, a.z + uz * (a.r + 3)],
    [(a.x + b.x) / 2 + (r() - 0.5) * 2, y0 + scheitel, (a.z + b.z) / 2 + (r() - 0.5) * 2],
    [b.x - ux * (b.r + 3), y0 + scheitel * 0.9, b.z - uz * (b.r + 3)],
    [b.x - ux * b.r * 0.4, y0 + scheitel * 0.74, b.z - uz * b.r * 0.4],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const kurve = new THREE.CatmullRomCurve3(stuetz, false, 'centripetal');
  const rahmen = kurve.computeFrenetFrames(ringe, false);
  const pos = [], nor = [], col = [], idx = [], punkte = [];
  const knoten = Array.from({ length: 5 }, () => [r(), 0.06 + 0.05 * r()]);
  for (let i = 0; i <= ringe; i++) {
    const t = i / ringe, m = kurve.getPointAt(t), N = rahmen.normals[i], B = rahmen.binormals[i];
    punkte.push([m.x, m.y, m.z]);
    let rad = dicke * (0.62 + 0.55 * (Math.abs(t - 0.5) * 2) ** 2);
    for (const [k, w] of knoten) rad *= 1 + 0.25 * Math.exp(-((t - k) ** 2) / (w * w * 0.2));
    for (let j = 0; j <= seiten; j++) {
      const w = (j / seiten) * Math.PI * 2, c = Math.cos(w), s = Math.sin(w);
      const rr = rad * (1 + 0.08 * Math.sin(w * 3 + t * 17));
      const nx = N.x * c + B.x * s, ny = N.y * c + B.y * s, nz = N.z * c + B.z * s;
      pos.push(m.x + nx * rr, m.y + ny * rr, m.z + nz * rr); nor.push(nx, ny, nz);
      const moos = THREE.MathUtils.smoothstep(ny, 0.25, 0.75), hell = 0.85 + 0.3 * ((i * 7 + j * 13) % 5) / 5;
      col.push(...[0, 1, 2].map((k) => (RINDE[k] + (MOOS[k] - RINDE[k]) * moos) * hell));
    }
  }
  for (let i = 0; i < ringe; i++) for (let j = 0; j < seiten; j++) {
    const a0 = i * (seiten + 1) + j, a1 = a0 + seiten + 1;
    idx.push(a0, a1, a0 + 1, a0 + 1, a1, a1 + 1);
  }
  const geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometrie.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geometrie.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geometrie.setIndex(idx);
  geometrie.computeBoundingSphere();
  return { geometrie, punkte };
}

/** Wertrauschen als Alpha-Maske (Kanal g, wie three alphaMap liest): Lücken im Kronendach für Sonnentupfer im Schatten. dicht = Anteil der Löcher. */
export function lochMaske({ seed = 1, groesse = 64, dicht = 0.42 } = {}) {
  const r = rng(hashSeed('lochmaske', seed)), n = 8, gitter = Array.from({ length: n * n }, () => r());
  const g = (i, j) => gitter[((j % n + n) % n) * n + ((i % n + n) % n)];
  const daten = new Uint8Array(groesse * groesse * 4);
  for (let y = 0; y < groesse; y++) for (let x = 0; x < groesse; x++) {
    let v = 0;
    for (const [f, w] of [[1, 0.6], [2, 0.3], [4, 0.1]]) {
      const u = (x / groesse) * n * f, w2 = (y / groesse) * n * f, i = Math.floor(u), j = Math.floor(w2), fu = u - i, fv = w2 - j;
      const su = fu * fu * (3 - 2 * fu), sv = fv * fv * (3 - 2 * fv);
      v += w * ((g(i, j) * (1 - su) + g(i + 1, j) * su) * (1 - sv) + (g(i, j + 1) * (1 - su) + g(i + 1, j + 1) * su) * sv);
    }
    const a = v > dicht ? 255 : 0;
    daten.set([a, a, a, 255], (y * groesse + x) * 4);
  }
  const tex = new THREE.DataTexture(daten, groesse, groesse, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
