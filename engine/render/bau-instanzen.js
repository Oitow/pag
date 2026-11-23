/**
 * @modul    bau-instanzen
 * @zweck    Bau-Teile (Häuser, Laternen, Brunnen …) als InstancedMesh je typ#variante, ein gemeinsames Leucht-Mesh, Kollisions-Körper und Anker in Weltlage
 * @api      createBauInstanzen({teile,fabriken,kollision?,material?,schatten?}) -> {gruppe,lichter,anker,koerperIds,assets,dreiecke,setzeNacht(n),dispose()} ; dreheLokal(w,lx,lz)->{x,z}
 * @beispiel
 *   import { createBauInstanzen } from '../../engine/render/bau-instanzen.js';
 *   const bau = createBauInstanzen({ teile: [{ id: 'h1', typ: 'haus', variante: 0, x: 10, z: 4, winkel: 0.5, y: 2 }],
 *     fabriken: { haus: ({ seed, variante }) => createHaus({ seed, variante }) }, kollision });
 *   szene.add(bau.gruppe); bau.setzeNacht(1 - himmel.stand().tag);
 * @tags     bau, instanzen, instancedmesh, kollision, anker, leucht, dorf
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 *
 * Teil: { id, typ, variante = 0, x, z, winkel (Drehung um Y; lokal +z zeigt nach (sin w, cos w)), y = 0 }.
 * Welt = (x + lx·cos w + lz·sin w, z − lx·sin w + lz·cos w). Kasten-bx/bz der Assets sind HALBE Maße (wie in world/kollision).
 * Anker-Eintrag: { teilId, typ, art (Anker-Name, bei station deren art), x, y, z, winkel, daten (Original-Anker) }.
 */
import * as THREE from 'three';
import { standardMaterial } from './mesh-builder.js';

/** Lokalen Punkt (lx, lz) um Y drehen: Welt-Offset. */
export function dreheLokal(w, lx, lz) {
  const c = Math.cos(w), s = Math.sin(w);
  return { x: lx * c + lz * s, z: -lx * s + lz * c };
}

const ANKER_ARTEN = ['tuer', 'station', 'interaktion', 'sitz', 'schild', 'kamin'];
const num = (v, d = 0) => (Number.isFinite(v) ? v : d);

function verschmelze(teile) {
  let n = 0;
  const gs = teile.map(({ geo, matrix }) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrix); n += g.attributes.position.count; return g;
  });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3).fill(1);
  let o = 0;
  for (const g of gs) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count; g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

export function createBauInstanzen({ teile = [], fabriken = {}, kollision = null, material = null, schatten = true } = {}) {
  const gruppe = new THREE.Group(); gruppe.name = 'bau-instanzen';
  const mat = material || standardMaterial();
  const matLeucht = new THREE.MeshBasicMaterial({ vertexColors: true });
  const dummy = new THREE.Object3D();
  const lichter = [], anker = [], koerperIds = [], assets = [], leucht = [], meshes = [];
  let dreiecke = 0;

  // gruppieren nach typ#variante (Reihenfolge der ersten Nennung)
  const gruppen = new Map();
  for (const t of teile) {
    const variante = t.variante ?? 0, key = `${t.typ}#${variante}`;
    if (!gruppen.has(key)) gruppen.set(key, { typ: t.typ, variante, items: [] });
    gruppen.get(key).items.push(t);
  }

  for (const [key, g] of gruppen) {
    const fabrik = fabriken[g.typ];
    if (typeof fabrik !== 'function') throw new Error(`createBauInstanzen: keine Fabrik für Typ "${g.typ}"`);
    const a = fabrik({ seed: 1, variante: g.variante });
    assets.push(a); dreiecke += a.dreiecke || 0;
    const m = new THREE.InstancedMesh(a.geometrie, mat, g.items.length);
    m.name = key; m.receiveShadow = true; m.castShadow = !!schatten && num(a.masse?.hoehe) > 1.5;
    g.items.forEach((t, i) => {
      const w = num(t.winkel), y = num(t.y), x = num(t.x), z = num(t.z);
      dummy.position.set(x, y, z); dummy.rotation.set(0, w, 0); dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      if (a.leucht) leucht.push({ geo: a.leucht, matrix: dummy.matrix.clone() });
      const welt = (lx, lz) => { const q = dreheLokal(w, lx, lz); return { x: x + q.x, z: z + q.z }; };

      if (kollision) {
        for (const k of a.kollision || []) {
          const p = welt(num(k.x), num(k.z));
          koerperIds.push(kollision.fuege({ ...k, x: p.x, z: p.z, winkel: num(k.winkel) + w, y0: num(k.y0) + y, daten: { teilId: t.id, typ: t.typ } }));
        }
      }
      for (const l of a.anker?.licht || []) {
        const p = welt(l.x, l.z);
        lichter.push({ x: p.x, y: y + num(l.y), z: p.z, farbe: l.farbe, staerke: num(l.staerke, 1), art: t.typ });
      }
      for (const f of a.anker?.fackeln || []) {
        const p = welt(f.x, f.z);
        lichter.push({ x: p.x, y: y + num(f.y), z: p.z, farbe: '#ffc65a', staerke: 0.6, art: 'fackel' });
      }
      for (const art of ANKER_ARTEN) {
        const roh = a.anker?.[art]; if (!roh) continue;
        for (const e of Array.isArray(roh) ? roh : [roh]) {
          if (!e || !Number.isFinite(e.x ?? 0)) continue;
          const p = welt(num(e.x), num(e.z));
          anker.push({ teilId: t.id, typ: t.typ, art: (art === 'station' && e.art) || art, x: p.x, y: y + num(e.y), z: p.z, winkel: num(e.winkel) + w, daten: e });
        }
      }
    });
    m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
    gruppe.add(m); meshes.push(m);
  }

  let leuchtMesh = null;
  if (leucht.length) {
    leuchtMesh = new THREE.Mesh(verschmelze(leucht), matLeucht); leuchtMesh.name = 'leucht';
    gruppe.add(leuchtMesh); dreiecke += 0;
  }
  const ergebnis = {
    gruppe, lichter, anker, koerperIds, assets, dreiecke, leuchtMesh,
    /** nacht 0..1: Leuchtglas dunkel am Tag, hell nachts. */
    setzeNacht(n) { matLeucht.color.setScalar(0.3 + 0.7 * Math.min(1, Math.max(0, num(n)))); },
    dispose() {
      if (kollision) for (const id of koerperIds) kollision.entferne(id);
      koerperIds.length = 0;
      for (const m of meshes) m.dispose();
      leuchtMesh?.geometry.dispose(); matLeucht.dispose();
      for (const a of assets) a.dispose();
      gruppe.removeFromParent();
    },
  };
  ergebnis.setzeNacht(0);
  return ergebnis;
}
