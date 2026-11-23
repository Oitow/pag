import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { waehleLichter, createLichtPool } from './licht-pool.js';

const L = (x, z, art = 'laterne') => ({ x, y: 2, z, farbe: '#ffe3a0', staerke: 1, art });

test('waehleLichter nimmt die nächsten n', () => {
  const ls = [L(30, 0), L(5, 0), L(10, 0), L(2, 0), L(100, 0)];
  const w = waehleLichter(ls, { x: 0, z: 0 }, 3);
  assert.deepEqual(w.map((l) => l.x), [2, 5, 10]);
  assert.equal(waehleLichter(ls, { x: 0, z: 0 }, 5, 12).length, 3);
});

test('waehleLichter bevorzugt Lagerfeuer', () => {
  const ls = [L(5, 0), L(8, 0), L(15, 0, 'lagerfeuer')];
  assert.equal(waehleLichter(ls, { x: 0, z: 0 }, 1)[0].art, 'lagerfeuer');
  assert.equal(waehleLichter([L(5, 0), L(60, 0, 'lagerfeuer')], { x: 0, z: 0 }, 1)[0].x, 5);
});

test('Pool: Laterne tags aus, nachts an; Feuer flackert deterministisch', () => {
  const lauf = () => {
    const szene = new THREE.Scene();
    const pool = createLichtPool({ szene, lichter: [L(1, 0), L(2, 0, 'lagerfeuer')], anzahl: 2 });
    const werte = [];
    for (let i = 0; i < 20; i++) pool.update(0.1, { x: 0, z: 0 }, 0);
    const lichter = szene.children.filter((c) => c.isPointLight);
    const tag = lichter.map((l) => l.intensity);
    for (let i = 0; i < 40; i++) { pool.update(0.1, { x: 0, z: 0 }, 1); werte.push(lichter.map((l) => l.intensity).join()); }
    pool.dispose();
    assert.equal(szene.children.length, 0);
    return { tag, werte };
  };
  const a = lauf(), b = lauf();
  assert.deepEqual(a, b);
  assert.ok(a.tag.filter((v) => v < 0.01).length === 1 && a.tag.filter((v) => v > 5).length === 1);
});
