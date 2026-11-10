import test from 'node:test';
import assert from 'node:assert/strict';
import { createHand } from './hand.js';
import { createInventar } from './inventar.js';
import { createRegister } from '../core/register.js';
import { createEreignisse } from '../core/ereignisse.js';

function aufbau() {
  const register = createRegister({ art: 'gegenstand', standard: { stapel: 10 } });
  register.definiereAlle({ holz: {}, axt: { stapel: 1, haltbarkeit: 3, tags: ['werkzeug', 'axt'], modell: 'axt' } });
  const ereignisse = createEreignisse();
  const inventar = createInventar({ plaetze: 4, register });
  const hand = createHand({ inventar, register, ereignisse });
  return { register, ereignisse, inventar, hand };
}

test('waehle, gegenstand, eintrag, hatTag', () => {
  const { inventar, hand } = aufbau();
  assert.equal(hand.platz, -1); assert.equal(hand.gegenstand(), null); assert.equal(hand.eintrag(), null);
  inventar.gib('holz', 3); inventar.gib('axt', 1, { haltbarkeit: 3 });
  assert.equal(hand.waehle(1), true);
  assert.equal(hand.eintrag().modell, 'axt');
  assert.ok(hand.hatTag('axt')); assert.ok(!hand.hatTag('hacke'));
  assert.equal(hand.waehle(9), false); assert.equal(hand.platz, 1);
  assert.equal(hand.waehle(-1), true); assert.equal(hand.gegenstand(), null);
});
test('onWechsel feuert nur bei anderer id – auch wenn das Inventar sich ändert', () => {
  const { inventar, hand } = aufbau();
  const log = [];
  hand.onWechsel((e) => log.push(e?.id ?? null));
  hand.waehle(0);                    // leer → kein Wechsel
  inventar.gib('holz', 2);           // Platz 0 wird belegt
  inventar.gib('holz', 2);           // gleiche id → nichts
  inventar.nimm('holz', 4);          // Platz leer
  assert.deepEqual(log, ['holz', null]);
});
test('weiter springt über leere Plätze, rundherum', () => {
  const { inventar, hand } = aufbau();
  assert.equal(hand.weiter(), -1);
  inventar.gib('holz', 1); inventar.gib('axt', 1, { haltbarkeit: 3 }); inventar.verschiebe(1, 3);
  assert.equal(hand.weiter(), 0); assert.equal(hand.weiter(), 3); assert.equal(hand.weiter(), 0); assert.equal(hand.weiter(-1), 3);
});
test('nutzeAb: Haltbarkeit sinkt, Werkzeug zerbricht, Ereignis', () => {
  const { inventar, hand, ereignisse } = aufbau();
  const kaputt = [];
  ereignisse.an('werkzeug:kaputt', (e) => kaputt.push(e.id));
  inventar.gib('holz', 1); inventar.gib('axt', 1);       // Axt ohne Daten = volle Haltbarkeit
  hand.waehle(0); assert.equal(hand.nutzeAb(), null); assert.equal(hand.haltbarkeit(), null);
  hand.waehle(1); assert.equal(hand.haltbarkeit(), 1);
  assert.deepEqual(hand.nutzeAb(), { rest: 2, kaputt: false });
  assert.deepEqual(inventar.zustand().plaetze[1], ['axt', 1, { haltbarkeit: 2 }]);
  assert.ok(Math.abs(hand.haltbarkeit() - 2 / 3) < 1e-9);
  assert.deepEqual(hand.nutzeAb(2), { rest: 0, kaputt: true });
  assert.equal(hand.gegenstand(), null); assert.equal(hand.platz, 1);
  assert.deepEqual(kaputt, ['axt']);
});
test('zustand/lade und dispose', () => {
  const { inventar, hand } = aufbau();
  inventar.gib('holz', 1); hand.waehle(0);
  const s = JSON.parse(JSON.stringify(hand.zustand()));
  hand.waehle(-1); hand.lade(s); assert.equal(hand.platz, 0);
  hand.lade({ platz: 99 }); assert.equal(hand.platz, -1);
  let n = 0; hand.onWechsel(() => n++); hand.dispose(); inventar.leere(); hand.waehle(0);
  assert.equal(n, 0);
});
