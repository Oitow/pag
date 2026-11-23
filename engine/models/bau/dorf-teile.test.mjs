import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from './dorf-teile.js';
import { pruefeAsset, pruefeDeterminismus, andereVariante } from './bau-pruefung.mjs';

test('Kleinteile: Budget, Maße, Anker, Determinismus', () => {
  const liste = [['createHolzstapel', 600, []], ['createKarren', 600, []], ['createAnschlagbrett', 600, ['interaktion']],
    ['createHeuhaufen', 600, []], ['createPalisade', 600, []], ['createSteg', 600, ['enden']]];
  for (const [f, budget, anker] of liste) { pruefeAsset(D[f](), { budget, anker }); pruefeDeterminismus(D[f]); }
  pruefeAsset(D.createSchrein(), { budget: 600, leucht: true, anker: ['licht', 'interaktion'] });
  pruefeDeterminismus(D.createSchrein);
});
test('Beet: drei Varianten, keine Kollision', () => {
  for (let v = 0; v < 3; v++) { const a = D.createBeet({ variante: v }); assert.equal(a.kollision.length, 0); pruefeAsset(a, { budget: 600 }); }
  andereVariante(D.createBeet, 0, 2);
  andereVariante(D.createPalisade, 0, 1);
});
test('Brücke: Budget, Maße, Bogen + Gelände', () => {
  const a = D.createBruecke({ seed: 2, laenge: 10, breite: 3 });
  const geh = a.kollision.filter((k) => k.begehbar), rest = a.kollision.filter((k) => !k.begehbar);
  assert.ok(geh.length >= 10 && rest.length >= 2);
  pruefeAsset(a, { budget: 1200, anker: ['enden'] });
  pruefeDeterminismus(D.createBruecke);
});
test('Brücke: Stufen steigen je ≤ 0.2 m bis Mitte +0.6 m', () => {
  const geh = D.createBruecke({ seed: 1 }).kollision.filter((k) => k.begehbar).sort((p, q) => p.z - q.z);
  const top = geh.map((k) => k.y0 + k.hoehe);
  for (let i = 1; i < top.length; i++) assert.ok(Math.abs(top[i] - top[i - 1]) <= 0.2, `Stufe ${i}`);
  assert.ok(Math.max(...top) >= 0.55 && Math.max(...top) <= 0.61 && top[0] < 0.1);
  assert.ok(geh.every((k) => k.bx >= 1.4), 'breit genug');
});
