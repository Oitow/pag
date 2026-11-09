import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createNiederschlag } from './niederschlag.js';

test('Objekt: Points mit Attributen und Einstellungen', () => {
  const ns = createNiederschlag({ anzahl: 500, seed: 2 });
  const o = ns.objekt;
  assert.ok(o.isPoints);
  assert.equal(o.geometry.getAttribute('position').count, 500);
  assert.equal(o.geometry.getAttribute('aZufall').count, 500);
  assert.equal(o.geometry.getAttribute('aArt').count, 500);
  assert.equal(o.frustumCulled, false);
  assert.equal(o.material.depthWrite, false);
  assert.equal(o.material.transparent, true);
  assert.equal(o.material.fog, false);
  assert.equal(o.visible, false);
  ns.dispose();
});

test('update: Uniforms und Sichtbarkeit', () => {
  const ns = createNiederschlag();
  const u = ns.objekt.material.uniforms;
  ns.update(0.5, { mitte: new THREE.Vector3(1, 2, 3), regen: 0.4, wind: 0.5, windRichtung: 0, hoehePx: 600 });
  assert.equal(ns.objekt.visible, true);
  assert.equal(u.uRegen.value, 0.4);
  assert.equal(u.uZeit.value, 0.5);
  assert.equal(u.uSkala.value, 600);
  assert.deepEqual(u.uMitte.value.toArray(), [1, 2, 3]);
  assert.ok(Math.abs(u.uWind.value.x - 4) < 1e-9);
  ns.update(0.1, { schnee: 0.2 });
  assert.equal(ns.objekt.visible, true);
  ns.update(0.1, { regen: 0, schnee: 0 });
  assert.equal(ns.objekt.visible, false);
  ns.update(0.1, { regen: 5 });
  assert.equal(u.uRegen.value, 1);
  ns.dispose();
});

test('update: Kamera als Mitte', () => {
  const ns = createNiederschlag();
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(5, 6, 7); cam.updateMatrixWorld(true);
  ns.update(0.1, { kamera: cam, regen: 1 });
  assert.deepEqual(ns.objekt.material.uniforms.uMitte.value.toArray(), [5, 6, 7]);
  ns.dispose();
});

test('deterministisch per Seed, Partikel im Quader', () => {
  const a = createNiederschlag({ seed: 7, anzahl: 100, radius: 10, hoehe: 5 });
  const b = createNiederschlag({ seed: 7, anzahl: 100, radius: 10, hoehe: 5 });
  const c = createNiederschlag({ seed: 8, anzahl: 100, radius: 10, hoehe: 5 });
  const arr = (n) => Array.from(n.objekt.geometry.getAttribute('position').array);
  assert.deepEqual(arr(a), arr(b));
  assert.notDeepEqual(arr(a), arr(c));
  assert.ok(arr(a).every((v, i) => (i % 3 === 1 ? v >= 0 && v <= 5 : Math.abs(v) <= 10)));
  [a, b, c].forEach((n) => n.dispose());
});

test('dispose gibt Geometrie und Material frei', () => {
  const ns = createNiederschlag();
  let g = 0, m = 0;
  ns.objekt.geometry.addEventListener('dispose', () => g++);
  ns.objekt.material.addEventListener('dispose', () => m++);
  ns.dispose();
  assert.equal(g, 1); assert.equal(m, 1);
});
