import test from 'node:test';
import assert from 'node:assert/strict';
import { clamp, lerp, smoothstep, damp, angleDiff, numOr, remap } from './math.js';

test('math', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(lerp(0, 10, 0.5), 5);
  assert.equal(smoothstep(0, 1, 0.5), 0.5);
  assert.equal(remap(5, 0, 10, 100, 200), 150);
  assert.ok(Math.abs(damp(0, 1, 1e9, 1) - 1) < 1e-9);
  assert.ok(Math.abs(angleDiff(0.1, Math.PI * 2 - 0.1) + 0.2) < 1e-9);
  assert.equal(numOr('x', 3), 3);
});
