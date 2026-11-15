import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrainingspuppe, createZielscheibe, createZelt, createAmboss } from './uebung.js';
import { pruefeAsset, pruefeDeterminismus, andereVariante } from './bau-pruefung.mjs';

test('Trainingspuppe und Zielscheibe: Zylinder-Kollision', () => {
  for (const [f, budget] of [[createTrainingspuppe, 250], [createZielscheibe, 150]]) {
    const a = f();
    assert.equal(a.kollision.length, 1);
    assert.equal(a.kollision[0].form, 'kreis');
    pruefeAsset(a, { budget, anker: ['ziel'] });
    pruefeDeterminismus(f);
  }
});
test('Zelt: Eingang +z, Varianten', () => {
  for (let v = 0; v < 3; v++) {
    const z = createZelt({ variante: v });
    assert.ok(z.anker.tuer.z > 0);
    pruefeAsset(z, { budget: 200, tol: 0.06, anker: ['tuer'] });
  }
  andereVariante(createZelt, 0, 1);
  pruefeDeterminismus(createZelt);
});
test('Amboss: Station', () => {
  const a = createAmboss();
  assert.equal(a.anker.station.art, 'amboss');
  pruefeAsset(a, { budget: 100, tol: 0.06 });
  pruefeDeterminismus(createAmboss);
});
