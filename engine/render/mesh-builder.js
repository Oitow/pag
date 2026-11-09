/**
 * @modul    mesh-builder
 * @zweck    Low-Poly-Modelle aus Primitiven (Box, Kugel, Zylinder …) mit Vertexfarben zu EINER Geometrie verschmelzen; Farbvariation pro Dreieck per Seed
 * @api      createMeshBuilder(opts) -> builder ; standardMaterial(opts) -> MeshStandardMaterial ; tMatrix(t) -> Matrix4
 * @beispiel
 *   import { createMeshBuilder } from '../../engine/render/mesh-builder.js';
 *   const b = createMeshBuilder({ seed: 7 });
 *   b.box(0.6, 0.4, 1.0, '#d9772b', { y: 0.5 }).sphere(0.25, 0xffffff, { y: 0.8, z: 0.5, sy: 0.8 }, 8, 6);
 *   szene.add(b.mesh());   // THREE.Mesh mit standardMaterial()
 * @tags     mesh, geometrie, lowpoly, vertexfarben, modell, primitive, merge
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { rng } from '../core/rng.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(),
  _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();

/** t = { x,y,z, rx,ry,rz (Radiant), s (gleichmäßig), sx,sy,sz } → neue Matrix4. (add() kennt zusätzlich t.jitter, t.innen) */
export function tMatrix(t = {}) {
  _p.set(t.x || 0, t.y || 0, t.z || 0);
  _e.set(t.rx || 0, t.ry || 0, t.rz || 0);
  _q.setFromEuler(_e);
  const s = t.s ?? 1;
  _s.set((t.sx ?? 1) * s, (t.sy ?? 1) * s, (t.sz ?? 1) * s);
  return new THREE.Matrix4().compose(_p, _q, _s);
}

const materialCache = new Map();
/**
 * Geteiltes Material (gecacht pro Optionen – nicht einzeln disposen): vertexColors, flatShading, roughness 0.85.
 * opts: beliebige MeshStandardMaterial-Parameter (z. B. { side: THREE.DoubleSide, emissive: 0x302010 }).
 */
export function standardMaterial(opts = {}) {
  const key = JSON.stringify(opts);
  let mat = materialCache.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, metalness: 0, ...opts });
    materialCache.set(key, mat);
  }
  return mat;
}

/**
 * Baukasten für eine Geometrie. opts: { seed = 1, jitter = 0.06 (Standard-Farbvariation 0…1) }
 * Farben: Zahl 0xrrggbb oder '#rrggbb'. t wie tMatrix plus t.jitter.
 */
export function createMeshBuilder({ seed = 1, jitter = 0.06 } = {}) {
  const r = rng(seed);
  const teile = [];   // { pos: Float32Array, col: Float32Array }
  let punkte = 0;

  const b = {
    /** Beliebige BufferGeometry hinzufügen (wird kopiert, Original bleibt unverändert). */
    add(geo, farbe, t = {}) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      g.applyMatrix4(tMatrix(t));
      // Gespiegelte Transformation (negative Determinante) → Dreiecke umdrehen, damit Vorderseiten außen bleiben
      const pos = g.attributes.position.array.slice();
      const n = pos.length / 3;
      // t.innen = true dreht zusätzlich um (Innenseite einer offenen Schale sichtbar machen)
      if (((t.sx ?? 1) * (t.sy ?? 1) * (t.sz ?? 1) * (t.s ?? 1) ** 3 < 0) !== !!t.innen) {
        for (let i = 0; i + 2 < n; i += 3) for (let k = 0; k < 3; k++) {
          const a = (i + 1) * 3 + k, c = (i + 2) * 3 + k, tmp = pos[a]; pos[a] = pos[c]; pos[c] = tmp;
        }
      }
      g.dispose();
      _c.set(farbe);
      const jit = t.jitter ?? jitter;
      const col = new Float32Array(n * 3);
      // Pro Dreieck leicht variierende Helligkeit → handgemachter Look (deterministisch)
      for (let i = 0; i < n; i += 3) {
        const k = 1 + (r() - 0.5) * jit * 2;
        for (let j = 0; j < 3 && i + j < n; j++) {
          col[(i + j) * 3] = Math.min(1, _c.r * k);
          col[(i + j) * 3 + 1] = Math.min(1, _c.g * k);
          col[(i + j) * 3 + 2] = Math.min(1, _c.b * k);
        }
      }
      teile.push({ pos, col });
      punkte += n;
      return b;
    },
    box(w, h, d, farbe, t) { return eigen(new THREE.BoxGeometry(w, h, d), farbe, t); },
    sphere(r, farbe, t, ws = 8, hs = 6) { return eigen(new THREE.SphereGeometry(r, ws, hs), farbe, t); },
    cyl(rOben, rUnten, h, farbe, t, seg = 8) { return eigen(new THREE.CylinderGeometry(rOben, rUnten, h, seg), farbe, t); },
    cone(r, h, farbe, t, seg = 8) { return eigen(new THREE.ConeGeometry(r, h, seg), farbe, t); },
    ico(r, farbe, t, detail = 0) { return eigen(new THREE.IcosahedronGeometry(r, detail), farbe, t); },
    capsule(r, len, farbe, t, cap = 3, seg = 8) { return eigen(new THREE.CapsuleGeometry(r, len, cap, seg), farbe, t); },

    /** Alle Teile → neue BufferGeometry (position, normal, color). */
    geometry() {
      const pos = new Float32Array(punkte * 3), col = new Float32Array(punkte * 3);
      let o = 0;
      for (const p of teile) { pos.set(p.pos, o); col.set(p.col, o); o += p.pos.length; }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      out.setAttribute('color', new THREE.BufferAttribute(col, 3));
      out.computeVertexNormals();
      out.computeBoundingSphere();
      return out;
    },
    /** THREE.Mesh aus geometry() mit material (Standard: standardMaterial()). */
    mesh(material = standardMaterial()) { return new THREE.Mesh(b.geometry(), material); },
    /** true, solange nichts hinzugefügt wurde. */
    get leer() { return punkte === 0; },
    /** Anzahl Dreiecke bisher. */
    get dreiecke() { return punkte / 3; },
  };
  function eigen(geo, farbe, t) { b.add(geo, farbe, t); geo.dispose(); return b; }
  return b;
}
