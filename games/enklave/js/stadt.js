// Enklave – Stadt, Tal-Platz und Wegrand: gleiche Assets werden zu EINEM InstancedMesh zusammengefasst (+ eine gemeinsame leucht-Geometrie),
// Kollisions-Körper laufen in world/kollision, das Tor hat zwei Flügel über gameplay/tueren, der Amboss ist eine Station (gameplay/stationen).
// Echte Lichter: nur 3 PointLights, die sich die nächsten Laternen/Feuer/Fenster greifen (nachts hell, tags aus).
import * as THREE from 'three';
import { standardMaterial } from '../../../engine/render/mesh-builder.js';
import { createTorfluegel } from '../../../engine/models/bau/mauer.js';
import { createTueren } from '../../../engine/gameplay/tueren.js';
import { createStationen } from '../../../engine/gameplay/stationen.js';
import { stadtPlatzierungen } from './stadt-daten.js';

const dreh = (w, lx, lz) => ({ x: lx * Math.cos(w) + lz * Math.sin(w), z: -lx * Math.sin(w) + lz * Math.cos(w) });

/** Mehrere Geometrien (mit Matrix) zu einer verschmelzen (position/normal/color). */
function verschmelze(teile) {
  let n = 0;
  for (const t of teile) n += t.geo.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const { geo, matrix } of teile) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrix);
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.color) col.set(g.attributes.color.array, o * 3); else col.fill(1, o * 3, (o + c) * 3);
    o += c; g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/** opts: { szene, w (Ergebnis von baueWelt), interaktion, ereignisse } → { tueren, stationen, assets, update(dt, spieler, nacht), oeffneTor(wer), dispose() } */
export function baueStadt({ szene, w, interaktion, ereignisse }) {
  const { plan, adapter, kollision } = w;
  const gruppe = new THREE.Group(); gruppe.name = 'stadt';
  szene.add(gruppe);
  const MAT = standardMaterial(), MAT_LEUCHT = new THREE.MeshBasicMaterial({ vertexColors: true });
  const gruppen = new Map(), lichter = [], leucht = [], dummy = new THREE.Object3D(), assets = [];
  for (const p of stadtPlatzierungen(plan)) {
    if (!gruppen.has(p.key)) gruppen.set(p.key, { fabrik: p.fabrik, schatten: p.schatten, art: p.art, items: [] });
    gruppen.get(p.key).items.push(p);
  }
  let anker = {};
  for (const [key, g] of gruppen) {
    const a = g.asset = g.fabrik(); assets.push(a);
    const m = new THREE.InstancedMesh(a.geometrie, MAT, g.items.length);
    m.castShadow = g.schatten; m.receiveShadow = true; m.name = key;
    g.items.forEach((p, i) => {
      let y = adapter.bodenHoehe(p.x, p.z);
      if (p.art === 'stamm') y = Math.max(adapter.bodenHoehe(p.x - 3, p.z), adapter.bodenHoehe(p.x + 3, p.z)) - 0.15;   // liegt auf den Ufern
      dummy.position.set(p.x, y, p.z); dummy.rotation.set(0, p.winkel, 0); dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      if (a.leucht) leucht.push({ geo: a.leucht, matrix: dummy.matrix.clone() });
      for (const k of a.kollision) kollision.fuege(plan.koerperZuWelt(k, p, y));
      for (const l of a.anker.licht || []) { const q = dreh(p.winkel, l.x, l.z); lichter.push({ x: p.x + q.x, y: y + l.y, z: p.z + q.z, farbe: l.farbe, staerke: l.staerke, art: p.art }); }
      if (a.anker.station) anker[key] = { ...a.anker.station, ...(() => { const q = dreh(p.winkel, a.anker.station.x, a.anker.station.z); return { wx: p.x + q.x, wz: p.z + q.z }; })() };
    });
    m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere();
    gruppe.add(m);
  }
  let leuchtMesh = null;
  if (leucht.length) { leuchtMesh = new THREE.Mesh(verschmelze(leucht), MAT_LEUCHT); leuchtMesh.name = 'leucht'; gruppe.add(leuchtMesh); }

  // ---- Tor: zwei Flügel (zentriertes Torfluegel-Asset, Pivot an der Angel) ----
  const tueren = createTueren({ welt: kollision, dauer: 2.2 });
  const th = plan.platz('mauer-torhaus'), thY = adapter.bodenHoehe(th.x, th.z);
  const fl = createTorfluegel({ seed: 1 }); assets.push(fl);
  const fluegel = [];
  for (const [i, f] of (gruppen.get('torhaus').asset.anker.fluegel).entries()) {
    const q = plan.lokalZuWelt(th, f.x, f.z);
    const t = tueren.neu('tor-' + i, { x: q.x, z: q.z, y: thY, winkel: th.winkel, breite: f.breite, dicke: 0.25, hoehe: f.hoehe, angel: f.angel, name: 'Tor' });
    const mesh = new THREE.Mesh(fl.geometrie, MAT); mesh.castShadow = true;
    const pivot = new THREE.Group(); mesh.position.x = (f.angel === 'links' ? 1 : -1) * f.breite / 2; pivot.add(mesh); gruppe.add(pivot);
    fluegel.push({ t, pivot });
  }
  const stelleFluegel = () => { for (const { t, pivot } of fluegel) { const p = t.angelPos; pivot.position.set(p.x, t.y, p.z); pivot.rotation.y = t.winkel + t.drehung; } };
  stelleFluegel();

  // ---- Amboss-Station ----
  const stationen = createStationen({ interaktion, ereignisse });
  const sa = anker.schmiede;
  if (sa) stationen.neu('amboss', { art: 'amboss', pos: { x: sa.wx, z: sa.wz }, radius: 0.8, reichweite: 2.2, name: 'Amboss', text: 'Amboss ansehen' });

  // ---- 3 echte Lichter: nächste Laternen/Feuer/Fenster; nachts hell ----
  const pl = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffc060, 0, 14, 1.6); szene.add(l); return l; });
  let lichtUhr = 0;
  function lichtWaehlen(p) {
    const nah = lichter.map((l) => ({ l, d: (l.x - p.x) ** 2 + (l.z - p.z) ** 2 - (l.art === 'lagerfeuer' ? 400 : 0) })).sort((a, b) => a.d - b.d).slice(0, 3);
    pl.forEach((q, i) => { const e = nah[i]?.l; q.userData.ziel = e || null; if (e) { q.position.set(e.x, e.y, e.z); q.color.set(e.farbe); } });
  }
  return {
    tueren, stationen, assets, lichter, instanzen: gruppe,
    oeffneTor(wer) { for (const { t } of fluegel) tueren.oeffne(t.id, wer); },
    torOffen: () => fluegel.every(({ t }) => t.offen),
    update(dt, spieler, nacht = 0) {
      tueren.update(dt); stelleFluegel();
      if ((lichtUhr -= dt) <= 0) { lichtUhr = 0.4; lichtWaehlen(spieler); }
      for (const q of pl) { const e = q.userData.ziel; q.intensity += (((e ? Math.min(36, e.staerke * 14) : 0) * (e?.art === 'lagerfeuer' ? 1 : 0.4 + 0.6 * nacht)) - q.intensity) * Math.min(1, dt * 3); }
    },
    dispose() {
      for (const q of pl) { szene.remove(q); q.dispose?.(); }
      stationen.dispose(); tueren.dispose?.();
      gruppe.traverse((o) => { if (o.isInstancedMesh) o.dispose(); if (o.name === 'leucht') o.geometry.dispose(); });
      for (const a of assets) a.dispose();
      MAT_LEUCHT.dispose(); szene.remove(gruppe);
    },
  };
}
