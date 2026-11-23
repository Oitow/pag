// Läuft mit: node --test labore/gigantwelt/js/baeume.test.mjs (braucht auflösbares 'three')
import test from 'node:test';
import assert from 'node:assert/strict';
import { BAUM_ARTEN, BUDGET, baumGeometrie } from './baeume.js';
import { PFLANZEN_ARTEN, pflanzenGeometrie } from './bodenpflanzen.js';

test('Budgets, Attribute und Höhe 1 je Art/LOD', () => {
  for (const a of Object.keys(BAUM_ARTEN)) for (let l = 0; l < 3; l++) {
    const g = baumGeometrie(a, l);
    assert.deepEqual(Object.keys(g.attributes).sort(), ['color', 'normal', 'position']);
    assert.ok(g.index.count / 3 <= BUDGET[l], `${a} L${l}`);
    g.computeBoundingBox(); assert.ok(g.boundingBox.max.y > .85 && g.boundingBox.max.y < 1.1 && g.boundingBox.min.y > -.05);
  }
});
test('Deterministisch: gleiche Art ergibt gleiche Punkte', async () => {
  const m = await import('./baeume.js?neu');
  assert.deepEqual(Array.from(m.baumGeometrie('eiche', 0).attributes.position.array), Array.from(baumGeometrie('eiche', 0).attributes.position.array));
});
test('Pflanzen: <= 150 Dreiecke, Attribute vollständig', () => {
  for (const a of Object.keys(PFLANZEN_ARTEN)) {
    const g = pflanzenGeometrie(a);
    assert.ok(g.index.count / 3 <= 150); assert.ok(g.attributes.color && g.attributes.normal);
  }
});
