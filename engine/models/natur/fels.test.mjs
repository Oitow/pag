import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPEN, GESTEINE, erzeuge } from './fels.js';

const dreiecke = g => g.attributes.position.count / 3;

test('TYPEN laut Vertrag', () => {
  assert.deepEqual(TYPEN, ['fels', 'felsbrocken', 'findling', 'geroell', 'felsplatte', 'felsnadel']);
  assert.throws(() => erzeuge('kartoffel', 1));
});

test('alle Typen: Attribute position/normal/color/wind, Wind = 0, keine NaN', () => {
  for (const typ of TYPEN) {
    const { geometrie } = erzeuge(typ, 7);
    for (const a of ['position', 'normal', 'color', 'wind']) assert.ok(geometrie.attributes[a], `${typ}: ${a}`);
    assert.equal(geometrie.index, null);
    assert.equal(geometrie.attributes.wind.itemSize, 1);
    assert.ok(geometrie.attributes.wind.array.every(w => w === 0));
    assert.ok(geometrie.attributes.position.array.every(Number.isFinite), typ);
    assert.ok(geometrie.attributes.color.array.every(c => c >= 0 && c <= 1), typ);
  }
});

test('deterministisch: gleicher Seed → gleiche Geometrie, anderer Seed → andere', () => {
  for (const typ of TYPEN) {
    const a = erzeuge(typ, 11, { moos: 0.5 }).geometrie, b = erzeuge(typ, 11, { moos: 0.5 }).geometrie;
    assert.deepEqual(a.attributes.position.array, b.attributes.position.array);
    assert.deepEqual(a.attributes.color.array, b.attributes.color.array);
    assert.notDeepEqual(erzeuge(typ, 12).geometrie.attributes.position.array, a.attributes.position.array);
  }
});

test('Budget: detail 1 ≤ 300 Dreiecke, detail 0 < detail 1 ≤ detail 2', () => {
  for (const typ of TYPEN) for (let seed = 1; seed <= 10; seed++) {
    const d0 = dreiecke(erzeuge(typ, seed, { detail: 0 }).geometrie);
    const d1 = dreiecke(erzeuge(typ, seed).geometrie);
    const d2 = dreiecke(erzeuge(typ, seed, { detail: 2 }).geometrie);
    assert.ok(d1 <= 300, `${typ} detail1: ${d1}`);
    assert.ok(d0 < d1 && d1 <= d2, `${typ}: ${d0}/${d1}/${d2}`);
    assert.ok(d0 <= 100, `${typ} detail0: ${d0}`);
  }
});

test('Maße: Fußpunkt am Ursprung, leicht im Boden, plausible Höhen', () => {
  const grenzen = { fels: [0.3, 1.3], felsbrocken: [0.6, 2.2], findling: [0.7, 2.2], geroell: [0.05, 0.5], felsplatte: [0.15, 0.7], felsnadel: [2, 5] };
  for (const typ of TYPEN) for (let seed = 1; seed <= 10; seed++) {
    const e = erzeuge(typ, seed);
    e.geometrie.computeBoundingBox();
    const bb = e.geometrie.boundingBox;
    assert.ok(bb.min.y >= -0.2 - 1e-6 && bb.min.y < 0, `${typ} min.y ${bb.min.y}`);
    assert.ok(Math.abs(bb.max.y - e.hoehe) < 1e-4);
    assert.ok(e.hoehe >= grenzen[typ][0] && e.hoehe <= grenzen[typ][1], `${typ} hoehe ${e.hoehe}`);
    assert.ok(e.radius > 0.1 && e.radius < 2.5, `${typ} radius ${e.radius}`);
    assert.ok(e.stammRadius >= 0 && e.stammRadius <= e.radius);
    assert.ok(Math.abs((bb.min.x + bb.max.x) / 2) < e.radius && Math.abs((bb.min.z + bb.max.z) / 2) < e.radius);
  }
  assert.equal(erzeuge('geroell', 1).stammRadius, 0);
});

test('skala skaliert Maße', () => {
  const a = erzeuge('fels', 3), b = erzeuge('fels', 3, { skala: 2 });
  assert.ok(Math.abs(b.hoehe - 2 * a.hoehe) < 1e-4 && Math.abs(b.radius - 2 * a.radius) < 1e-4);
});

test('Gestein, Moos und Schnee ändern Farben, nicht die Form', () => {
  const basis = erzeuge('felsbrocken', 4).geometrie;
  for (const g of Object.keys(GESTEINE)) {
    const e = erzeuge('felsbrocken', 4, { gestein: g }).geometrie;
    assert.deepEqual(e.attributes.position.array, basis.attributes.position.array);
  }
  const mittel = g => { const c = g.attributes.color.array; let r = 0, gr = 0, b = 0;
    for (let i = 0; i < c.length; i += 3) { r += c[i]; gr += c[i + 1]; b += c[i + 2]; } const n = c.length / 3; return [r / n, gr / n, b / n]; };
  const m0 = mittel(basis), mm = mittel(erzeuge('felsbrocken', 4, { moos: 1 }).geometrie), ms = mittel(erzeuge('felsbrocken', 4, { schnee: 1 }).geometrie);
  assert.ok(mm[1] - mm[2] > m0[1] - m0[2] + 0.02, 'Moos macht grüner');
  assert.ok(ms[0] + ms[1] + ms[2] > m0[0] + m0[1] + m0[2] + 0.1, 'Schnee macht heller');
  const vulkan = mittel(erzeuge('fels', 4, { gestein: 'vulkan' }).geometrie), kalk = mittel(erzeuge('fels', 4, { gestein: 'kalk' }).geometrie);
  assert.ok(vulkan[0] < kalk[0]);
});

test('Normalen außen (Großteil zeigt vom Schwerpunkt weg)', () => {
  for (const typ of ['fels', 'felsbrocken', 'findling', 'felsplatte']) {
    const g = erzeuge(typ, 9).geometrie, p = g.attributes.position.array, n = g.attributes.normal.array;
    let cy = 0; for (let i = 1; i < p.length; i += 3) cy += p[i] / (p.length / 3);
    let aussen = 0;
    for (let i = 0; i < p.length; i += 9) {
      const mx = (p[i] + p[i + 3] + p[i + 6]) / 3, my = (p[i + 1] + p[i + 4] + p[i + 7]) / 3 - cy, mz = (p[i + 2] + p[i + 5] + p[i + 8]) / 3;
      if (n[i] * mx + n[i + 1] * my + n[i + 2] * mz > 0) aussen++;
    }
    assert.ok(aussen / (p.length / 9) > 0.97, `${typ}: ${aussen}`);
  }
});
