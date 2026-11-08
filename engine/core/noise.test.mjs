import test from 'node:test';
import assert from 'node:assert/strict';
import { createNoise2D, createNoise3D, fbm, fbm2, ridged, ridged2, warp2 } from './noise.js';
import * as alt from '../../games/planet/js/noise.js';

test('3D-Noise gleich wie planet/noise.js', () => {
  const a = createNoise3D(5), b = alt.createNoise3D(5);
  for (let i = 0; i < 200; i++) {
    const x = i * 0.37, y = i * 0.11, z = -i * 0.23;
    assert.equal(a(x, y, z), b(x, y, z));
    assert.equal(fbm(a, x, y, z), alt.fbm(b, x, y, z));
    assert.equal(ridged(a, x, y, z), alt.ridged(b, x, y, z));
  }
});
test('2D-Noise: Bereich, Seed-Abhängigkeit, Stetigkeit', () => {
  const n = createNoise2D(1), m = createNoise2D(2);
  let min = 9, max = -9, diff = 0;
  for (let i = 0; i < 20000; i++) {
    const x = (i % 200) * 0.173, y = Math.floor(i / 200) * 0.191, v = n(x, y);
    min = Math.min(min, v); max = Math.max(max, v); diff += Math.abs(v - m(x, y));
    assert.ok(Math.abs(n(x + 1e-4, y) - v) < 0.01);
  }
  assert.ok(min >= -1.05 && max <= 1.05 && min < -0.6 && max > 0.6, `Bereich ${min}..${max}`);
  assert.ok(diff > 1000);
});
test('fbm2, ridged2, warp2', () => {
  const n = createNoise2D(3);
  for (let i = 0; i < 1000; i++) {
    const x = i * 0.07, y = i * 0.05;
    assert.ok(Math.abs(fbm2(n, x, y)) <= 1.05);
    const r = ridged2(n, x, y); assert.ok(r >= 0 && r <= 1);
    const [wx, wy] = warp2(n, x, y, 2); assert.ok(Number.isFinite(wx + wy));
  }
});
