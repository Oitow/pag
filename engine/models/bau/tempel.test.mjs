import test from 'node:test';
import assert from 'node:assert/strict';
import { createTempel } from './tempel.js';
import { pruefeAsset, vereinigung } from './gebaeude-pruefen.mjs';
pruefeAsset('tempel', createTempel, { budget: 1500, anker: ['tuer', 'licht'] });
test('tempel: Kristall leuchtet und liegt über dem Turmdach', () => {
  const t = createTempel();
  t.leucht.computeBoundingBox();
  assert.ok(t.leucht.boundingBox.max.y > 13.5);
  assert.ok(vereinigung(t).max.y <= 14.7);
});
