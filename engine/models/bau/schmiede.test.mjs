import test from 'node:test';
import assert from 'node:assert/strict';
import { createSchmiede } from './schmiede.js';
import { pruefeAsset } from './gebaeude-pruefen.mjs';
pruefeAsset('schmiede', createSchmiede, { budget: 1400, anker: ['tuer', 'station', 'licht'] });
test('schmiede: Station ist ein Amboss, Esse leuchtet', () => {
  const s = createSchmiede();
  assert.equal(s.anker.station.art, 'amboss');
  assert.ok(s.leucht.attributes.position.count > 0);
});
