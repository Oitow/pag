import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPEN, erzeuge } from './totholz.js';
import { createRoehrenNetz } from './totholz-form.js';

const dreiecke = g => g.attributes.position.count / 3;

test('TYPEN laut Vertrag', () => {
  assert.deepEqual(TYPEN, ['baumstumpf', 'liegenderStamm', 'ast']);
  assert.throws(() => erzeuge('brett', 1));
});

test('Röhrennetz: Dreiecksanzahl, Jahresring-Marken, Normalen außen', () => {
  const n = createRoehrenNetz();
  n.roehre([[0, 0, 0], [0, 1, 0], [0, 2, 0]], [0.3, 0.3, 0.3], 6, { anfang: 'zu', ende: 'ringe', ringe: 3 });
  // Mantel 2·2·6 + Boden 6 + Scheibe (6 + 2·6·2)
  assert.equal(n.dreiecke.length / 3, 24 + 6 + 6 + 24);
  assert.equal(n.marken.length, n.dreiecke.length / 3);
  assert.ok(['ring0', 'ring1', 'ring2'].every(m => n.marken.includes(m)));
  const P = n.punkte, D = n.dreiecke;
  for (let i = 0; i < D.length; i += 3) {
    const a = D[i] * 3, b = D[i + 1] * 3, c = D[i + 2] * 3;
    const u = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], v = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
    const nn = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const m = [(P[a] + P[b] + P[c]) / 3, (P[a + 1] + P[b + 1] + P[c + 1]) / 3 - 1, (P[a + 2] + P[b + 2] + P[c + 2]) / 3];
    assert.ok(nn[0] * m[0] + nn[1] * m[1] + nn[2] * m[2] > -1e-9, `Dreieck ${i / 3} zeigt nach innen`);
  }
});

test('alle Typen: Attribute, Wind = 0, deterministisch', () => {
  for (const typ of TYPEN) {
    const a = erzeuge(typ, 5, { moos: 0.4 }).geometrie, b = erzeuge(typ, 5, { moos: 0.4 }).geometrie;
    for (const at of ['position', 'normal', 'color', 'wind']) assert.ok(a.attributes[at], `${typ}: ${at}`);
    assert.ok(a.attributes.wind.array.every(w => w === 0));
    assert.ok(a.attributes.position.array.every(Number.isFinite));
    assert.deepEqual(a.attributes.position.array, b.attributes.position.array);
    assert.deepEqual(a.attributes.color.array, b.attributes.color.array);
    assert.notDeepEqual(erzeuge(typ, 6).geometrie.attributes.position.array, a.attributes.position.array);
  }
});

test('Budget: detail 1 ≤ 300 Dreiecke, detail steigt', () => {
  for (const typ of TYPEN) for (let seed = 1; seed <= 10; seed++) {
    const d = [0, 1, 2].map(detail => dreiecke(erzeuge(typ, seed, { detail }).geometrie));
    assert.ok(d[1] <= 300, `${typ}: ${d[1]}`);
    assert.ok(d[0] < d[1] && d[1] <= d[2], `${typ}: ${d}`);
  }
});

test('Maße und Kollision plausibel', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const s = erzeuge('baumstumpf', seed), l = erzeuge('liegenderStamm', seed), a = erzeuge('ast', seed);
    for (const e of [s, l, a]) {
      e.geometrie.computeBoundingBox();
      assert.ok(e.geometrie.boundingBox.min.y >= -0.2 - 1e-6, `min.y ${e.geometrie.boundingBox.min.y}`);
      assert.ok(Math.abs(e.geometrie.boundingBox.max.y - e.hoehe) < 1e-4);
    }
    assert.ok(s.hoehe > 0.3 && s.hoehe < 1.1 && s.stammRadius > 0.2 && s.stammRadius < 0.5);
    assert.ok(l.hoehe > 0.25 && l.hoehe < 1.2 && l.radius > 1.1 && l.radius < 2.6 && l.stammRadius > 0.1);
    assert.ok(a.hoehe < 0.35 && a.radius > 0.4 && a.radius < 1.3);
    assert.equal(a.stammRadius, 0);
  }
});

test('Baumstumpf hat Jahresring-Scheibe (helle Holzfarben oben)', () => {
  const g = erzeuge('baumstumpf', 3).geometrie, p = g.attributes.position.array, n = g.attributes.normal.array, c = g.attributes.color.array;
  let holz = 0;
  for (let i = 0; i < p.length; i += 9) if (n[i + 1] > 0.9 && c[i] > c[i + 2] * 1.6 && c[i] > 0.25) holz++;
  assert.ok(holz >= 8, `holz ${holz}`);
});
