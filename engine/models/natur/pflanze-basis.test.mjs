import test from 'node:test';
import assert from 'node:assert/strict';
import { createSammler } from './pflanze-basis.js';

const G = [0.3, 0.6, 0.2];
/** Mittlere Ausrichtung: Normalen zeigen vom Mittelpunkt weg. */
function aussenAnteil(geo, c) {
  const p = geo.attributes.position.array, n = geo.attributes.normal.array;
  let gut = 0;
  for (let i = 0; i < p.length; i += 9) {
    const m = [0, 1, 2].map((k) => (p[i + k] + p[i + 3 + k] + p[i + 6 + k]) / 3 - c[k]);
    if (m[0] * n[i] + m[1] * n[i + 1] + m[2] * n[i + 2] > 0) gut++;
  }
  return gut / (p.length / 9);
}

test('ballen und rohr: geschlossen, Normalen nach außen, Attribute vollständig', () => {
  const s = createSammler({ seed: 2 });
  s.ballen([0, 1, 0], [0.5, 0.4, 0.5], 7, 4, () => G, (y) => y);
  assert.equal(s.dreiecke, 7 * 2 + 7 * 2 * 2);
  const g = s.geometrie();
  assert.equal(aussenAnteil(g, [0, 1, 0]), 1);
  for (const a of ['position', 'normal', 'color', 'wind']) assert.ok(g.attributes[a], a);
  assert.equal(g.attributes.wind.itemSize, 1);
  const s2 = createSammler({ seed: 2 });
  s2.rohr([[0, 0, 0], [0, 1, 0], [0.5, 1.5, 0], [0.5, 2, 0]], [0.2, 0.2, 0.15, 0], G, () => 0, { seiten: 6, profil: [1, 0.8] });
  assert.equal(s2.dreiecke, 6 * 2 * 2 + 6);
  const m = s2.masse();
  assert.ok(Math.abs(m.hoehe - 2) < 1e-6);
});

test('dreieckZwei und band: beide Seiten, Spitze als Dreieck', () => {
  const s = createSammler({ seed: 1 });
  s.dreieckZwei([0, 0, 0], [1, 0, 0], [0, 0, 1], G);
  const n = s.geometrie().attributes.normal.array;
  assert.ok(n[1] * n[10] < 0, 'Normalen entgegengesetzt');
  const b = createSammler({ seed: 1 });
  b.band([[0, 0, 0], [0, 0.5, 0], [0, 1, 0]], [1, 0, 0], [0.05, 0.03, 0], () => G, (t) => t);
  assert.equal(b.dreiecke, (2 + 1) * 2);
  const w = b.geometrie().attributes.wind.array;
  assert.equal(Math.min(...w), 0); assert.equal(Math.max(...w), 1);
});

test('Ergebnis nach Vertrag, deterministisch', () => {
  const bau = () => { const s = createSammler({ seed: 9 }); s.ballen([0, 0.5, 0], [0.5, 0.5, 0.5], 6, 3, () => G); return s.ergebnis({ stammRadius: 0.1 }); };
  const a = bau(), b = bau();
  assert.deepEqual(a.geometrie.attributes.position.array, b.geometrie.attributes.position.array);
  assert.deepEqual(a.geometrie.attributes.color.array, b.geometrie.attributes.color.array);
  assert.ok(a.hoehe > 0.8 && a.radius > 0.4 && a.stammRadius === 0.1);
});
