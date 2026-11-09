/**
 * @modul    scatter-mesh
 * @zweck    Zeichnet die Objekte einer erzeugten Welt (welt.objekte: Bäume, Büsche, Felsen, Kakteen, Schilf, Blumen) als InstancedMesh je Typ mit einfachen Low-Poly-Formen; eigene Formen je Typ überschreibbar
 * @api      createScatterMesh(adapter, opts) -> {gruppe,anzahl,typen,dispose} ; FORMEN ; BLUMEN_FARBEN ; baueForm(teile) -> BufferGeometry ; formName(formen,typ,art) -> string
 * @beispiel
 *   import { createScatterMesh } from '../../engine/world/scatter-mesh.js';
 *   const pflanzen = createScatterMesh(adapter, { schatten: true });
 *   szene.add(pflanzen.gruppe);
 * @tags     welt, objekte, baeume, felsen, instanzen, vegetation, mesh
 * @version  1.1.0
 * @status   entwurf
 * @three    ja
 */

import * as THREE from 'three';

// Teile: [form, farbe, sx, sy, sz, y, x?, z?] – form: 'zyl' | 'kegel' | 'kugel' | 'fels' | 'box'. Maße in Metern bei skala 1.
const STAMM = 0x6b4a2f, DUNKEL = 0x2f5a2a, LAUB = 0x4f8a3a, HELL = 0x7fae4a;
export const FORMEN = {
  eiche: [['zyl', STAMM, 0.32, 2.4, 0.32, 1.2], ['kugel', LAUB, 2.4, 2.0, 2.4, 3.4], ['kugel', 0x5d9a42, 1.5, 1.3, 1.5, 4.3, 0.5, 0.3]],
  buche: [['zyl', 0x7a6650, 0.28, 2.8, 0.28, 1.4], ['kugel', 0x5f9440, 2.0, 2.4, 2.0, 3.9]],
  birke: [['zyl', 0xe8e4da, 0.18, 3.2, 0.18, 1.6], ['kugel', HELL, 1.3, 1.9, 1.3, 3.9]],
  kiefer: [['zyl', STAMM, 0.24, 3.4, 0.24, 1.7], ['kugel', DUNKEL, 1.6, 1.1, 1.6, 4.1]],
  tanne: [['zyl', STAMM, 0.26, 1.2, 0.26, 0.6], ['kegel', DUNKEL, 2.2, 2.8, 2.2, 2.4], ['kegel', 0x356a30, 1.6, 2.2, 1.6, 4.0]],
  weide: [['zyl', STAMM, 0.34, 2.0, 0.34, 1.0], ['kugel', 0x7ea34c, 2.8, 2.6, 2.8, 2.9]],
  toterBaum: [['zyl', 0x5a4a3c, 0.22, 3.0, 0.22, 1.5], ['zyl', 0x5a4a3c, 0.1, 1.2, 0.1, 2.4, 0.4]],
  busch: [['kugel', 0x4c7f34, 1.2, 0.9, 1.2, 0.4]],
  ginster: [['kugel', 0xb8a63a, 1.0, 0.8, 1.0, 0.35]],
  zwergstrauch: [['kugel', 0x6a6a3a, 0.8, 0.45, 0.8, 0.2]],
  fels: [['fels', 0x8a8478, 1.3, 0.9, 1.1, 0.25]],
  felsbrocken: [['fels', 0x7b766c, 2.2, 1.6, 1.9, 0.5]],
  kaktus: [['zyl', 0x4f8a4a, 0.4, 2.2, 0.4, 1.1], ['zyl', 0x4f8a4a, 0.25, 0.9, 0.25, 1.4, 0.4]],
  schilf: [['kegel', 0x8fa65a, 0.5, 1.4, 0.5, 0.7]],
  blume: [['zyl', 0x4f8a3a, 0.04, 0.35, 0.04, 0.17], ['kugel', 0xffffff, 0.18, 0.12, 0.18, 0.36]],
};
const ERSATZ = { baum: 'eiche', busch: 'busch', fels: 'fels', kaktus: 'kaktus', schilf: 'schilf', blume: 'blume' };
export const BLUMEN_FARBEN = [0xe2c94a, 0xd96aa0, 0xf0f0f0, 0x8f7ad8, 0xe0703a];
const BLUMEN = BLUMEN_FARBEN;

/** Name der Form für ein Objekt: eigener Typ, sonst Ersatz nach Art (baum → eiche …), sonst busch. */
export const formName = (formen, typ, art) => (formen[typ] ? typ : ERSATZ[art] || 'busch');

function grundForm(form) {
  switch (form) {
    case 'zyl': return new THREE.CylinderGeometry(0.4, 0.5, 1, 6);
    case 'kegel': return new THREE.ConeGeometry(0.5, 1, 7);
    case 'kugel': return new THREE.IcosahedronGeometry(0.5, 1);
    case 'fels': return new THREE.DodecahedronGeometry(0.5, 0);
    default: return new THREE.BoxGeometry(1, 1, 1);
  }
}

/** Fügt Teile zu einer Geometrie mit Vertexfarben zusammen (nicht indiziert). */
export function baueForm(teile) {
  const pos = [], nor = [], col = [], c = new THREE.Color();
  for (const [form, farbe, sx, sy, sz, y, x = 0, z = 0] of teile) {
    const g0 = grundForm(form), g = g0.index ? g0.toNonIndexed() : g0;
    if (g !== g0) g0.dispose();
    g.scale(sx, sy, sz).translate(x, y, z);
    g.computeVertexNormals();
    c.setHex(farbe);
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i += 3) {
      pos.push(p[i], p[i + 1], p[i + 2]); nor.push(n[i], n[i + 1], n[i + 2]);
      // leichte Schattierung nach Höhe im Teil → weniger flach
      const t = 0.85 + 0.15 * Math.min(1, Math.max(0, (p[i + 1] - y + sy / 2) / (sy || 1)));
      col.push(c.r * t, c.g * t, c.b * t);
    }
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

/** opts: formen (eigene Teile je Typ), schatten, groesse (Gesamtfaktor), nurArten (Liste), unterWasser (false = weglassen). */
export function createScatterMesh(adapter, opts = {}) {
  const welt = adapter.welt, o = welt.objekte;
  const formen = { ...FORMEN, ...opts.formen };
  const faktor = (opts.groesse ?? 1) * Math.sqrt(adapter.meterProZelle);
  const gruppe = new THREE.Group(); gruppe.name = 'objekte';
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true });
  const proTyp = new Map();
  if (o) for (let i = 0; i < o.anzahl; i++) {
    const typ = o.typen[o.typ[i]], art = o.arten[o.art[i]];
    if (opts.nurArten && !opts.nurArten.includes(art)) continue;
    const name = formName(formen, typ, art);
    let l = proTyp.get(name); if (!l) proTyp.set(name, l = []); l.push(i);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), achse = new THREE.Vector3(0, 1, 0);
  const farbe = new THREE.Color();
  let anzahl = 0;
  for (const [name, liste] of proTyp) {
    const geo = baueForm(formen[name]);
    const im = new THREE.InstancedMesh(geo, mat, liste.length);
    im.name = name;
    let k = 0;
    for (const i of liste) {
      const w = adapter.zuWelt(o.x[i], o.y[i]);
      const y = adapter.bodenHoehe(w.x, w.z);
      if (opts.unterWasser === false && adapter.wasserHoehe(w.x, w.z) > y + 0.3) continue;
      const sk = (o.skala[i] || 1) * faktor;
      p.set(w.x, y - 0.05 * sk, w.z); s.set(sk, sk, sk); q.setFromAxisAngle(achse, o.drehung ? o.drehung[i] : 0);
      im.setMatrixAt(k, m4.compose(p, q, s));
      if (name === 'blume') im.setColorAt(k, farbe.setHex(BLUMEN[i % BLUMEN.length]).multiplyScalar(1.2));
      k++;
    }
    im.count = k;
    im.castShadow = opts.schatten !== false && name !== 'blume' && name !== 'schilf';
    im.receiveShadow = opts.schatten !== false;
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    gruppe.add(im);
    anzahl += k;
  }
  return {
    gruppe, anzahl, typen: [...proTyp.keys()],
    dispose() {
      gruppe.traverse(x => { if (x.isMesh) x.geometry.dispose(); });
      mat.dispose();
      gruppe.removeFromParent();
    },
  };
}
