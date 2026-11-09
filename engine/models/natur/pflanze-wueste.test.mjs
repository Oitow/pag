import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPEN, erzeuge } from './pflanze-wueste.js';

const tri = (e) => e.geometrie.attributes.position.count / 3;
const HOEHE = { kaktus: [2, 4.6], saeulenkaktus: [0.9, 2.6], agave: [0.2, 1.2] };

test('alle Typen × detail × Jahreszeit: gültige Geometrie, starr', () => {
  assert.deepEqual(TYPEN, ['kaktus', 'saeulenkaktus', 'agave']);
  for (const t of TYPEN) for (const detail of [0, 1, 2]) for (const jahreszeit of ['sommer', 'herbst', 'winter']) for (let seed = 1; seed <= 4; seed++) {
    const g = erzeuge(t, seed, { detail, jahreszeit }).geometrie, n = g.attributes.position.count;
    for (const a of ['position', 'normal', 'color', 'wind']) assert.equal(g.attributes[a].count, n);
    const p = g.attributes.position.array;
    for (let i = 0; i < p.length; i++) { assert.ok(Number.isFinite(p[i])); if (i % 3 === 1) assert.ok(p[i] >= -0.2); }
    for (const v of g.attributes.color.array) assert.ok(v >= 0 && v <= 1);
    assert.equal(Math.max(...g.attributes.wind.array), 0, `${t}: Kaktus schwingt nicht`);
  }
});

test('Budget: detail 1 ≤ 400, detail 0 < 1 < 2', () => {
  for (const t of TYPEN) {
    const summe = [0, 0, 0];
    for (let seed = 1; seed <= 40; seed++) for (const d of [0, 1, 2]) {
      const n = tri(erzeuge(t, seed, { detail: d }));
      summe[d] += n;
      if (d === 1) assert.ok(n <= 400, `${t} #${seed}: ${n}`);
    }
    assert.ok(summe[0] < summe[1] && summe[1] < summe[2], `${t}: ${summe}`);
  }
});

test('deterministisch, Maße und Kollision', () => {
  for (const t of TYPEN) {
    assert.deepEqual(erzeuge(t, 7).geometrie.attributes.position.array, erzeuge(t, 7).geometrie.attributes.position.array);
    assert.notDeepEqual(erzeuge(t, 7).geometrie.attributes.position.array, erzeuge(t, 8).geometrie.attributes.position.array);
    for (let seed = 1; seed <= 15; seed++) {
      const e = erzeuge(t, seed);
      assert.ok(e.hoehe >= HOEHE[t][0] && e.hoehe <= HOEHE[t][1], `${t}: hoehe ${e.hoehe}`);
      assert.ok(e.stammRadius > 0.05 && e.stammRadius < e.radius, `${t}: stammRadius ${e.stammRadius}/${e.radius}`);
    }
  }
});

test('Säule: Normalen zeigen nach außen (geschlossener Körper)', () => {
  const g = erzeuge('saeulenkaktus', 3, { bluete: false }).geometrie;
  const p = g.attributes.position.array, n = g.attributes.normal.array;
  let gut = 0;
  for (let i = 0; i < p.length; i += 9) {
    const mx = (p[i] + p[i + 3] + p[i + 6]) / 3, mz = (p[i + 2] + p[i + 5] + p[i + 8]) / 3;
    // Achse des Haupttriebs liegt bei x=z=0; Seitentriebe zählen über die Mehrheit
    if (mx * n[i] + mz * n[i + 2] > 0) gut++;
  }
  assert.ok(gut / (p.length / 9) > 0.7);
  assert.throws(() => erzeuge('eiche', 1));
});
