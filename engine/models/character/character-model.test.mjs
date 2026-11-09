import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCharacterModel } from './character-model.js';
import { VORLAGEN, randomLook, STILE } from './character-look.js';

const dreiecke = (m) => m.meshes.reduce((n, x) => n + x.geometry.attributes.position.count / 3, 0);
function hashGeo(m) {
  let h = 2166136261 >>> 0;
  for (const x of m.meshes) for (const v of x.geometry.attributes.position.array) { h ^= Math.round(v * 1e5); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function pruefen(look, name) {
  const m = createCharacterModel({ look });
  m.root.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(m.root), h = m.masse.hoehe;
  const t = dreiecke(m);
  assert.ok(t <= 4000, `${name}: ${t} Dreiecke`);
  assert.ok(Math.abs(bb.min.y) < 0.02 * h + 0.01, `${name}: Füße auf dem Boden (${bb.min.y})`);
  const hut = m.look.kopfbedeckung.stil !== 'keine';
  assert.ok(bb.max.y > h * 0.85 && bb.max.y < h * (hut ? 1.5 : 1.15), `${name}: Höhe ${bb.max.y} ≠ ${h}`);
  for (const x of m.meshes) assert.ok(x.geometry.attributes.position.count > 0 && Number.isFinite(x.geometry.boundingSphere.radius), name + x.name);
  m.dispose();
  return t;
}

test('alle Vorlagen und 50 Zufalls-Looks bauen (Dreiecke, Höhe)', () => {
  for (const [n, v] of Object.entries(VORLAGEN)) pruefen(v, n);
  for (let i = 0; i < 50; i++) pruefen(randomLook(1000 + i, { kind: i % 7 === 0 }), 'zufall' + i);
});

test('jeder Stil baut (alle Werte aus STILE)', () => {
  for (const [teil, liste] of Object.entries(STILE)) for (const stil of liste) pruefen({ [teil]: { stil }, guertel: null, tasche: true, rucksack: true }, `${teil}:${stil}`);
});

test('gleiche Seeds → gleiche Geometrie, anderer Seed → andere Farben', () => {
  const a = createCharacterModel({ look: VORLAGEN.ritter, seed: 5 }), b = createCharacterModel({ look: VORLAGEN.ritter, seed: 5 });
  assert.equal(hashGeo(a), hashGeo(b));
  const farbe = (m) => Array.from(m.meshes[1].geometry.attributes.color.array.slice(0, 30)).join();
  assert.equal(farbe(a), farbe(b));
  assert.notEqual(farbe(a), farbe(createCharacterModel({ look: VORLAGEN.ritter, seed: 6 })));
});

test('setLook behält Rig-Gruppen und Befestigtes, passt Maße an', () => {
  const m = createCharacterModel({ look: VORLAGEN.wanderer });
  const kopf = m.rig.knochen.kopf, hand = m.rig.knochen.handR, root = m.root;
  const schwert = new THREE.Group(), hut = new THREE.Group();
  m.befestigen('handR', schwert);
  m.befestigen('kopf', hut);
  const alt = m.meshes.map((x) => x.geometry);
  m.setLook({ ...VORLAGEN.kind });
  assert.equal(m.rig.knochen.kopf, kopf);
  assert.equal(m.rig.knochen.handR, hand);
  assert.equal(m.root, root);
  assert.equal(schwert.parent, m.rig.sockel.handR);
  assert.equal(hut.parent, m.rig.sockel.kopf);
  assert.ok(m.masse.hoehe < 1.3 && m.look.oberteil.stil === 'hemd');
  assert.ok(m.meshes.every((x) => !alt.includes(x.geometry)));
  m.setLook({ kopfbedeckung: { stil: 'krone' } });
  assert.equal(m.look.haar.stil, 'wuschel', 'Teil-Look wird gemischt');
  assert.ok(m.meshes.some((x) => x.name === 'kopfbedeckung'));
  assert.deepEqual(m.loesen('handR'), [schwert]);
  assert.equal(schwert.parent, null);
  assert.deepEqual(m.loesen(hut), [hut]);
  assert.throws(() => m.befestigen('nase', schwert));
});

test('setSichtbar, Schatten-Option und dispose gibt Geometrien frei', () => {
  const m = createCharacterModel({ look: VORLAGEN.koenigin, schatten: false });
  assert.ok(m.meshes.every((x) => !x.castShadow && !x.receiveShadow));
  assert.ok(m.meshes.some((x) => x.name === 'umhang') && m.meshes.some((x) => x.name === 'kopf'));
  m.setSichtbar(false);
  assert.equal(m.root.visible, false);
  const szene = new THREE.Scene();
  szene.add(m.root);
  let frei = 0;
  for (const x of m.meshes) x.geometry.addEventListener('dispose', () => frei++);
  const n = m.meshes.length;
  m.dispose();
  assert.equal(frei, n);
  assert.equal(m.root.parent, null);
  assert.equal(m.meshes.length, 0);
});
