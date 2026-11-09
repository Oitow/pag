import test from 'node:test';
import assert from 'node:assert/strict';
import { createTeile, farbe, mische, abdunkeln, variiere, roehre, blob, kegel, wedel } from './natur-basis.js';
import { rng } from '../../core/rng.js';

test('natur-basis: Farben', () => {
  const w = farbe('#ffffff');
  assert.deepEqual(w.map((v) => Math.round(v * 100) / 100), [1, 1, 1]);
  assert.deepEqual(mische([0, 0, 0], [1, 1, 1], 0.25), [0.25, 0.25, 0.25]);
  assert.deepEqual(abdunkeln([1, 0.5, 0], 0.5), [0.5, 0.25, 0]);
  const r = rng(1), v = variiere([0.5, 0.5, 0.5], r, 0.1);
  assert.ok(v.every((x) => x > 0.4 && x < 0.6));
});

test('natur-basis: Helfer → Geometrie mit position/normal/color/wind, Dreieckszahlen', () => {
  const t = createTeile({ seed: 3 });
  roehre(t, [[0, 0, 0], [0, 1, 0], [0.2, 2, 0]], [0.2, 0.15, 0.1], { seiten: 5, farbe: [0.4, 0.3, 0.2], wind: [0, 0.1, 0.3] });
  assert.equal(t.anzahl, 2 * 5 * 2 + 5);
  blob(t, [0, 2.5, 0], 1, { farbe: [0.2, 0.5, 0.2], wind: 0.7 });
  assert.equal(t.anzahl, 25 + 20);
  kegel(t, [0, 3, 0], 1, 2, { seiten: 6 });
  assert.equal(t.anzahl, 45 + 12);
  wedel(t, [0, 3, 0], [1, 0.2, 0], 2, { segmente: 3 });
  assert.equal(t.anzahl, 57 + 24);
  const g = t.geometrie();
  for (const a of ['position', 'normal', 'color', 'wind']) assert.ok(g.attributes[a], a);
  assert.equal(g.attributes.wind.count, g.attributes.position.count);
  assert.ok(g.attributes.wind.array.every((w) => w >= 0 && w <= 1));
  assert.ok(g.attributes.color.array.every((c) => c >= 0 && c <= 1));
  t.dispose();
});

test('natur-basis: deterministisch, Blob ohne Risse, Schnee hellt Oberseiten auf', () => {
  const bau = (schnee) => { const t = createTeile({ seed: 9, schnee }); blob(t, [0, 0, 0], 1, { farbe: [0.1, 0.3, 0.1] }); return t.geometrie(); };
  const a = bau(0), b = bau(0);
  assert.deepEqual(a.attributes.position.array, b.attributes.position.array);
  // Jede Ecke kommt an mehreren Flächen vor → Positionen eindeutig bei 12 Ecken
  const ecken = new Set();
  const p = a.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) ecken.add(`${p[i].toFixed(4)},${p[i + 1].toFixed(4)},${p[i + 2].toFixed(4)}`);
  assert.equal(ecken.size, 12);
  const summe = (g) => g.attributes.color.array.reduce((s, v) => s + v, 0);
  assert.ok(summe(bau(1)) > summe(a) * 1.3);
});
