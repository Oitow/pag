import test from 'node:test';
import assert from 'node:assert/strict';
import { createRiesenbaum } from './riesenbaum.js';

test('riesenbaum: Rückgabe laut Vertrag', () => {
  const b = createRiesenbaum({ seed: 7, bogen: true });
  const g = b.geometrie;
  for (const n of ['position', 'normal', 'color']) assert.ok(g.attributes[n], n);
  assert.equal(g.index.count / 3, b.dreiecke);
  assert.ok(b.dreiecke <= 60000 && b.splats.anzahl <= 9000);
  for (const n of ['position', 'skala', 'drehung', 'farbe', 'deck', 'wind']) assert.ok(b.splats[n] instanceof Float32Array, n);
  assert.ok(b.kollision.stammRadius > 5.5 && b.kollision.stammRadius < 8);
  assert.equal(typeof b.kollision.hoehenkarte.hoeheBei, 'function');
  const m = b.masse;
  assert.equal(m.hoehe, 110); assert.ok(m.kronenAb > 55 && m.kronenRadius > 20 && m.grenzen.min.length === 3 && m.bogen.mitte.length === 3);
  assert.ok(g.boundingBox.max.y > 100 && g.boundingBox.min.y < 0);
  b.dispose();
});

test('riesenbaum: Optionen wirken (Höhe, Stammradius, detail)', () => {
  const klein = createRiesenbaum({ seed: 2, hoehe: 90, stammRadius: 4.5, detail: 0.6 }), gross = createRiesenbaum({ seed: 2 });
  assert.equal(klein.masse.hoehe, 90);
  assert.ok(klein.geometrie.boundingBox.max.y < 95 && klein.dreiecke < gross.dreiecke && klein.splats.anzahl < gross.splats.anzahl);
  klein.dispose(); gross.dispose();
});
