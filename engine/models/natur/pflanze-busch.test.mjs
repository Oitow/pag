import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPEN, erzeuge } from './pflanze-busch.js';

const tri = (e) => e.geometrie.attributes.position.count / 3;
function pruefeGeometrie(e, name) {
  const g = e.geometrie, n = g.attributes.position.count;
  for (const a of ['position', 'normal', 'color', 'wind']) assert.equal(g.attributes[a].count, n, `${name}: ${a}`);
  for (const v of g.attributes.position.array) assert.ok(Number.isFinite(v), `${name}: NaN`);
  for (const v of g.attributes.color.array) assert.ok(v >= 0 && v <= 1, `${name}: Farbe`);
  for (const v of g.attributes.wind.array) assert.ok(v >= 0 && v <= 1, `${name}: Wind`);
  let minY = Infinity;
  for (let i = 1; i < g.attributes.position.array.length; i += 3) minY = Math.min(minY, g.attributes.position.array[i]);
  assert.ok(minY >= -0.2 - 1e-6, `${name}: zu tief (${minY})`);
}

test('alle Typen × detail × Jahreszeit: gültige Geometrie', () => {
  assert.deepEqual(TYPEN, ['busch', 'beerenbusch', 'ginster', 'zwergstrauch']);
  for (const t of TYPEN) for (const detail of [0, 1, 2]) for (const jahreszeit of ['sommer', 'herbst', 'winter']) {
    for (let seed = 1; seed <= 4; seed++) pruefeGeometrie(erzeuge(t, seed, { detail, jahreszeit }), `${t}/${detail}/${jahreszeit}/${seed}`);
  }
});

test('Budget: detail 1 ≤ 400 Dreiecke, detail 0 < 1 < 2', () => {
  for (const t of TYPEN) {
    const summe = [0, 0, 0];
    for (let seed = 1; seed <= 30; seed++) for (const d of [0, 1, 2]) {
      const n = tri(erzeuge(t, seed, { detail: d }));
      summe[d] += n;
      if (d === 1) assert.ok(n <= 400, `${t} #${seed}: ${n}`);
    }
    assert.ok(summe[0] < summe[1] && summe[1] < summe[2], `${t}: ${summe}`);
  }
});

test('deterministisch, Seeds unterscheiden sich', () => {
  for (const t of TYPEN) {
    const a = erzeuge(t, 5), b = erzeuge(t, 5), c = erzeuge(t, 6);
    assert.deepEqual(a.geometrie.attributes.position.array, b.geometrie.attributes.position.array);
    assert.deepEqual(a.geometrie.attributes.color.array, b.geometrie.attributes.color.array);
    assert.notDeepEqual(a.geometrie.attributes.position.array, c.geometrie.attributes.position.array);
  }
});

test('Maße realistisch, Wind unten schwach und oben stärker', () => {
  const H = { busch: [0.8, 1.8], beerenbusch: [0.8, 1.8], ginster: [0.8, 2], zwergstrauch: [0.15, 0.6] };
  for (const t of TYPEN) for (let seed = 1; seed <= 10; seed++) {
    const e = erzeuge(t, seed);
    assert.ok(e.hoehe >= H[t][0] && e.hoehe <= H[t][1], `${t}: hoehe ${e.hoehe}`);
    assert.ok(e.radius > 0.2 && e.radius < 2 && e.stammRadius >= 0 && e.stammRadius < e.radius);
    const p = e.geometrie.attributes.position.array, w = e.geometrie.attributes.wind.array;
    let unten = 0, oben = 0;
    for (let i = 0; i < w.length; i++) {
      if (p[i * 3 + 1] < e.hoehe * 0.1) unten = Math.max(unten, w[i]);
      if (p[i * 3 + 1] > e.hoehe * 0.8) oben = Math.max(oben, w[i]);
    }
    assert.ok(unten < 0.3 && oben > unten, `${t}: wind ${unten}/${oben}`);
  }
});

test('Jahreszeit ändert die Farben, Beerenfarbe wählbar, unbekannter Typ wirft', () => {
  const s = erzeuge('busch', 3, { jahreszeit: 'sommer' }).geometrie.attributes.color.array;
  const h = erzeuge('busch', 3, { jahreszeit: 'herbst' }).geometrie.attributes.color.array;
  const mittel = (c, k) => c.reduce((a, v, i) => a + (i % 3 === k ? v : 0), 0) / (c.length / 3);
  assert.ok(mittel(h, 0) > mittel(s, 0) * 1.5, 'Herbst röter');
  const rot = erzeuge('beerenbusch', 3, { beere: 'rot' }).geometrie.attributes.color.array;
  const blau = erzeuge('beerenbusch', 3, { beere: 'blau' }).geometrie.attributes.color.array;
  assert.ok(mittel(rot, 0) > mittel(blau, 0) && mittel(blau, 2) > mittel(rot, 2));
  assert.throws(() => erzeuge('palme', 1));
});
