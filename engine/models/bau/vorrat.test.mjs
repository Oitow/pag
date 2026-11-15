import test from 'node:test';
import { createFass, createKiste, createBanner } from './vorrat.js';
import { pruefeAsset, pruefeDeterminismus, andereVariante } from './bau-pruefung.mjs';

test('Fass', () => { pruefeDeterminismus(createFass); pruefeAsset(createFass(), { budget: 120 }); });
test('Kiste: Würfel und flach', () => {
  pruefeAsset(createKiste({ variante: 0 }), { budget: 60 });
  pruefeAsset(createKiste({ variante: 1 }), { budget: 60 });
  andereVariante(createKiste, 0, 1);
  pruefeDeterminismus(createKiste);
});
test('Banner: 4 Farben', () => {
  for (let v = 0; v < 4; v++) pruefeAsset(createBanner({ variante: v }), { budget: 100 });
  andereVariante(createBanner, 0, 2);
  pruefeDeterminismus(createBanner);
});
