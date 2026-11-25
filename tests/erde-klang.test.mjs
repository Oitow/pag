import test from 'node:test';
import assert from 'node:assert/strict';
import { klangPegel } from '../labore/erde/js/klang-regeln.js';

const basis = { wind: 0.1, regen: 0, hoehe: 2, tempo: 0, meer: 0, stunde: 12, warm: true, wald: 1, amBoden: true, schwimmt: false, gehen: true };

test('Klang: Vögel nur am Tag und leiser bei Regen, Grillen nur nachts in warmen Gegenden', () => {
  const tag = klangPegel(basis), regen = klangPegel({ ...basis, regen: 0.8 }), nacht = klangPegel({ ...basis, stunde: 23 });
  assert.ok(tag.voegel > 0 && regen.voegel < tag.voegel * 0.5);
  assert.equal(nacht.voegel, 0); assert.ok(nacht.grillen > 0); assert.equal(tag.grillen, 0);
  assert.equal(klangPegel({ ...basis, stunde: 23, warm: false }).grillen, 0);
});

test('Klang: Wind wächst mit Höhe und Fluggeschwindigkeit; Meer nur bei Wasser', () => {
  const unten = klangPegel(basis), oben = klangPegel({ ...basis, hoehe: 300, gehen: false, tempo: 30 });
  assert.ok(oben.wind > unten.wind + 0.4);
  assert.equal(unten.meer, 0); assert.ok(klangPegel({ ...basis, meer: 1, wind: 0.5 }).meer > 0.3);
});

test('Klang: Schritte nur beim Gehen, Platschen nur beim Schwimmen', () => {
  assert.equal(klangPegel(basis).schritt, 0);
  const geht = klangPegel({ ...basis, tempo: 4 }), schwimmt = klangPegel({ ...basis, tempo: 1.5, schwimmt: true });
  assert.equal(geht.schritt, 1); assert.equal(schwimmt.schritt, 0); assert.equal(schwimmt.platsch, 1);
});
