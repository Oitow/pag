import test from 'node:test';
import assert from 'node:assert/strict';
import { createDorfPlan, STANDARD_MASSE } from './dorf-plan.js';
import { createWeltRegionen } from './welt-regionen.js';

const MITTE = { x: 0, z: 600 };
const wegeFlach = () => {
  const a = [{ x: -12, z: 840 }, { x: 0, z: 600 }, { x: 60, z: 430 }], b = [{ x: 0, z: 600 }, { x: -160, z: 640 }];
  a.id = 'hauptweg'; a.breite = 3; b.id = 'moorweg'; b.breite = 2;
  return [a, b];
};
const flach = (seed) => createDorfPlan({ seed, mitte: MITTE, hoehe: () => 24, wasser: () => false, wege: wegeFlach(), masse: STANDARD_MASSE });
const PUNKTE = ['platz', 'brunnen', 'feuer', 'anschlagbrett', 'schrein', 'markt', 'taverne', 'schmiede', 'tempel', 'tor-sued', 'tor-nord', 'uebung',
  'npc-wirt', 'npc-schmied', 'npc-haendler', 'npc-priester', 'npc-wache', 'bruecke'];

test('flaches Setup: 3 Seeds, pruefe() leer, ≥ 9 Häuser, alle Punkte, Brücke bei x≈110', () => {
  for (const seed of [1, 2, 3]) {
    const p = flach(seed);
    assert.deepEqual(p.pruefe(), [], `seed ${seed}`);
    assert.ok(p.teile.filter((t) => t.typ === 'haus').length >= 9);
    for (const id of PUNKTE) assert.ok(p.punkte[id] && Number.isFinite(p.punkte[id].x), 'Punkt ' + id);
    assert.ok(Math.abs(p.punkte.bruecke.x - 110) < 1 && p.gassen.length === 2 && p.felder.length >= 2);
    assert.equal(p.teile.find((t) => t.typ === 'bruecke').y, 24);
  }
});

test('deterministisch je Seed, verschieden zwischen Seeds', () => {
  const j = (s) => JSON.stringify(flach(s).teile);
  assert.equal(j(7), j(7));
  assert.notEqual(j(7), j(8));
});

test('echte Karte (seed 1207): pruefe() leer, Häuser, Laternen, Gärten', () => {
  const karte = createWeltRegionen({ seed: 1207 }), o = karte.ort('siedlung');
  const p = createDorfPlan({ seed: 1207, mitte: { x: o.x, z: o.z }, hoehe: karte.hoehe, wasser: (x, z) => karte.wasserHoehe(x, z) !== null, wege: karte.wege });
  assert.deepEqual(p.pruefe(), []);
  const n = (typ) => p.teile.filter((t) => t.typ === typ).length;
  assert.ok(n('haus') >= 9 && n('laterne') >= 10 && n('zaun') > 20 && n('beet') > 0);
  assert.ok(p.sperren.length > 15 && p.lichter.some((l) => l.art === 'feuer'));
});

test('Wasser wird gemieden (Bach bei x 40..60 gemeint) und pruefe() erkennt Fehler', () => {
  const imBach = (x) => x > MITTE.x + 40 && x < MITTE.x + 60;
  const q = createDorfPlan({ seed: 4, mitte: MITTE, hoehe: () => 0, wasser: imBach, wege: wegeFlach() });
  assert.ok(q.teile.every((t) => t.kern || !imBach(t.x)), 'Teil im Bach');
  const p = createDorfPlan({ seed: 4, mitte: MITTE, hoehe: () => 0, wasser: () => false, wege: wegeFlach() });
  const h = p.teile.find((t) => t.typ === 'haus');
  h.x = 0; h.z = 700;   // mitten auf den Hauptweg
  assert.ok(p.pruefe().some((m) => m.includes(h.id)));
});
