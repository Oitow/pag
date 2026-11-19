import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPEN, erzeuge, wedelBreite } from './pflanze-unterwuchs.js';

const tri = (e) => e.geometrie.attributes.position.count / 3;

test('alle Typen × detail × Jahreszeit: gültige Geometrie, nicht zu tief', () => {
  assert.deepEqual(TYPEN, ['wedelfarn', 'busch_unterholz', 'moospolster', 'wurzelschoessling', 'laubstreu']);
  for (const t of TYPEN) for (const detail of [0, 1, 2]) for (const jahreszeit of ['sommer', 'herbst', 'winter']) for (let seed = 1; seed <= 3; seed++) {
    const e = erzeuge(t, seed, { detail, jahreszeit }), g = e.geometrie, n = g.attributes.position.count, name = `${t}/${detail}/${jahreszeit}/${seed}`;
    for (const a of ['position', 'normal', 'color', 'wind']) assert.equal(g.attributes[a].count, n, `${name}: ${a}`);
    for (const v of g.attributes.position.array) assert.ok(Number.isFinite(v), `${name}: NaN`);
    for (const v of g.attributes.color.array) assert.ok(v >= 0 && v <= 1, `${name}: Farbe`);
    for (const v of g.attributes.wind.array) assert.ok(v >= 0 && v <= 1, `${name}: Wind`);
    let minY = Infinity; for (let i = 1; i < g.attributes.position.array.length; i += 3) minY = Math.min(minY, g.attributes.position.array[i]);
    assert.ok(minY >= -0.2 - 1e-6, `${name}: zu tief (${minY})`);
  }
});

test('echte Maße (m) und Budget: detail 1 ≤ 300 Dreiecke, detail 0 < 1 < 2', () => {
  const H = { wedelfarn: [0.35, 1.3], busch_unterholz: [0.5, 1.9], moospolster: [0.05, 0.3], wurzelschoessling: [0.4, 1.4], laubstreu: [0.01, 0.06] };
  for (const t of TYPEN) {
    const summe = [0, 0, 0];
    for (let seed = 1; seed <= 20; seed++) for (const d of [0, 1, 2]) {
      const e = erzeuge(t, seed, { detail: d }); summe[d] += tri(e);
      if (d === 1) {
        assert.ok(tri(e) <= 300, `${t} #${seed}: ${tri(e)}`);
        assert.ok(e.hoehe >= H[t][0] && e.hoehe <= H[t][1], `${t} #${seed}: Höhe ${e.hoehe}`);
      }
    }
    assert.ok(summe[0] < summe[1] && summe[1] < summe[2], `${t}: ${summe}`);
  }
});

test('deterministisch, Seeds unterscheiden sich, Wedelprofil spitz', () => {
  for (const t of TYPEN) {
    const a = erzeuge(t, 5), b = erzeuge(t, 5), c = erzeuge(t, 6);
    assert.deepEqual(a.geometrie.attributes.position.array, b.geometrie.attributes.position.array);
    assert.notDeepEqual(a.geometrie.attributes.position.array, c.geometrie.attributes.position.array);
  }
  assert.equal(wedelBreite(0), 0); assert.equal(wedelBreite(1), 0);
  assert.ok(wedelBreite(0.4) > 0.8 && wedelBreite(0.9) < wedelBreite(0.4));
  assert.throws(() => erzeuge('palme', 1));
});
