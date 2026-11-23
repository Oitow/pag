import test from 'node:test';
import assert from 'node:assert/strict';
import { flussBand } from './fluss-mesh.js';
import { createWeltRegionen } from './welt-regionen.js';

test('fluss-mesh: Band reicht unter die Böschung, lauf steigt, Schaum am Rand', () => {
  const p = [{ x: 0, z: 0, y: 5, b: 2 }, { x: 0, z: 10, y: 4.8, b: 2 }, { x: 0, z: 20, y: 4.6, b: 2.5 }];
  const { pos, ufer, lauf, idx } = flussBand(p, { rand: 0.8 });
  assert.equal(ufer.length, 15); assert.equal(idx.length, 2 * 4 * 6);
  assert.ok(Math.abs(Math.abs(pos[0]) - 2.8) < 1e-6, 'Rand = b + rand');
  assert.equal(ufer[0], 1); assert.equal(ufer[2], 0);
  assert.ok(lauf[5] > lauf[0] && lauf[10] > lauf[5]);
});

test('fluss-mesh: Erlbach-Band liegt am Rand nicht über dem Gelände in der Luft', () => {
  const k = createWeltRegionen({ seed: 1207 }), f = k.fluesse.find((q) => q.id === 'erlbach');
  const { pos } = flussBand(f.proben);
  let schwebt = 0;
  for (let v = 0; v < pos.length / 3; v += 5) if (pos[v * 3 + 1] - k.hoehe(pos[v * 3], pos[v * 3 + 2]) > 0.6) schwebt++;
  assert.ok(schwebt / (pos.length / 15) < 0.05, `schwebende Randpunkte: ${schwebt}`);
});
