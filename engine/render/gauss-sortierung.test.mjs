import test from 'node:test';
import assert from 'node:assert/strict';
import { createTiefenSortierer } from './gauss-sortierung.js';
import { rng } from '../core/rng.js';

test('sortiere: hinten→vorn entlang des Blicks', () => {
  const s = createTiefenSortierer(8);
  const pos = new Float32Array([0, 0, -1, 0, 0, -9, 0, 0, -4, 0, 0, -2]);
  assert.deepEqual([...s.sortiere(pos, 4, [0, 0, -1], [0, 0, 0])], [1, 2, 3, 0]);
  assert.deepEqual([...s.sortiere(pos, 4, [0, 0, 1], [0, 0, 0])], [0, 3, 2, 1]);      // Blick umgedreht
});

test('sortiere: Ergebnis ist eine Permutation, Tiefe fällt monoton (bis auf 16-Bit-Raster)', () => {
  const n = 20000, r = rng(5), pos = new Float32Array(n * 3);
  for (let i = 0; i < pos.length; i++) pos[i] = (r() - 0.5) * 400;
  const blick = [0.36, -0.48, 0.8], auge = [12, 30, -7];
  const s = createTiefenSortierer(n);
  const reihen = s.sortiere(pos, n, blick, auge);
  assert.equal(reihen.length, n);
  const gesehen = new Uint8Array(n);
  const t = i => (pos[i * 3] - auge[0]) * blick[0] + (pos[i * 3 + 1] - auge[1]) * blick[1] + (pos[i * 3 + 2] - auge[2]) * blick[2];
  const raster = 800 / 65535 * 1.01;
  for (let k = 0; k < n; k++) {
    gesehen[reihen[k]]++;
    if (k) assert.ok(t(reihen[k]) <= t(reihen[k - 1]) + raster, `Stelle ${k}`);
  }
  assert.ok(gesehen.every(v => v === 1));
});

test('sortiere: Augpunkt verschiebt nur – Reihenfolge bleibt gleich', () => {
  const pos = new Float32Array([1, 2, 3, -4, 0, 9, 7, 7, -7, 0, 0, 0, 3, -8, 2]);
  const s = createTiefenSortierer(5);
  const a = [...s.sortiere(pos, 5, [0.6, 0, 0.8], [0, 0, 0])];
  const b = [...s.sortiere(pos, 5, [0.6, 0, 0.8], [50, -20, 31])];
  assert.deepEqual(a, b);
});

test('sortiere: Randfälle – leer, gleiche Tiefe (stabil), Teilmenge, über max', () => {
  const s = createTiefenSortierer(4);
  assert.equal(s.sortiere(new Float32Array(0), 0, [0, 0, 1], [0, 0, 0]).length, 0);
  const gleich = new Float32Array([1, 0, 5, 2, 0, 5, 3, 0, 5]);
  assert.deepEqual([...s.sortiere(gleich, 3, [0, 0, 1], [0, 0, 0])], [0, 1, 2]);
  const sechs = new Float32Array([0, 0, 1, 0, 0, 2, 0, 0, 3, 0, 0, 4, 0, 0, 5, 0, 0, 6]);
  assert.deepEqual([...s.sortiere(sechs, 2, [0, 0, 1])], [1, 0]);                       // nur die ersten zwei
  assert.deepEqual([...s.sortiere(sechs, 6, [0, 0, 1])], [3, 2, 1, 0]);                 // max = 4 begrenzt
  assert.equal(s.max, 4);
});

test('sortiere: 120 k bleiben schnell und derselbe Puffer wird wiederverwendet', () => {
  const n = 120000, r = rng(1), pos = new Float32Array(n * 3);
  for (let i = 0; i < pos.length; i++) pos[i] = r() * 300;
  const s = createTiefenSortierer(n);
  const a = s.sortiere(pos, n, [0, 0, 1], [0, 0, 0]);
  const t0 = performance.now();
  let b = a;
  for (let i = 0; i < 10; i++) b = s.sortiere(pos, n, [Math.sin(i), 0, Math.cos(i)], [0, 0, 0]);
  const ms = (performance.now() - t0) / 10;
  assert.equal(a, b);
  assert.ok(ms < 40, `zu langsam: ${ms.toFixed(1)} ms`);
});
