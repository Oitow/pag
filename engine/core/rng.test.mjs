import test from 'node:test';
import assert from 'node:assert/strict';
import { rng, hashSeed, hash2, pick, int, shuffle, weighted } from './rng.js';
import { mulberry32 as alt } from '../../games/planet/js/noise.js';

test('rng ist deterministisch und gleich wie planet/noise.js', () => {
  const a = rng(42), b = alt(42);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
});
test('rng liegt in [0,1)', () => {
  const r = rng(7);
  for (let i = 0; i < 10000; i++) { const v = r(); assert.ok(v >= 0 && v < 1); }
});
test('hashSeed / hash2 stabil', () => {
  assert.equal(hashSeed('a', 1), hashSeed('a', 1));
  assert.notEqual(hashSeed('a', 1), hashSeed('a', 2));
  assert.equal(hash2(3, 4, 5), hash2(3, 4, 5));
});
test('Helfer', () => {
  const r = rng(1);
  for (let i = 0; i < 500; i++) { const v = int(r, 2, 4); assert.ok(v >= 2 && v <= 4 && Number.isInteger(v)); }
  assert.ok(['x', 'y'].includes(pick(r, ['x', 'y'])));
  assert.deepEqual(shuffle(r, [1, 2, 3, 4]).sort(), [1, 2, 3, 4]);
  assert.equal(weighted(r, [['nur', 1], ['nie', 0]]), 'nur');
});
