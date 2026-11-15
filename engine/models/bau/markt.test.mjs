import test from 'node:test';
import assert from 'node:assert/strict';
import { createMarktstand, createBrunnen, createBank } from './markt.js';
import { pruefeAsset, pruefeDeterminismus, andereVariante } from './bau-pruefung.mjs';

test('Marktstand: 4 Varianten', () => {
  for (let v = 0; v < 4; v++) pruefeAsset(createMarktstand({ variante: v }), { budget: 350, anker: ['station'] });
  andereVariante(createMarktstand, 0, 1);
  pruefeDeterminismus(createMarktstand);
});
test('Brunnen', () => {
  pruefeAsset(createBrunnen(), { budget: 400, anker: ['station'] });
  pruefeDeterminismus(createBrunnen);
});
test('Bank: sitz-Anker', () => {
  const b = createBank();
  assert.equal(b.anker.sitz.length, 2);
  pruefeAsset(b, { budget: 80, anker: ['sitz'] });
});
