import test from 'node:test';
import assert from 'node:assert/strict';
import { createWachturm } from './wachturm.js';
import { pruefeAsset } from './gebaeude-pruefen.mjs';
pruefeAsset('wachturm', createWachturm, { budget: 900, anker: ['tuer', 'fackeln', 'wachen'] });
test('wachturm: 2 Fackeln, 1 Wache oben', () => {
  const t = createWachturm();
  assert.equal(t.anker.fackeln.length, 2);
  assert.equal(t.anker.wachen.length, 1);
  assert.ok(t.anker.wachen[0].y > 8);
});
