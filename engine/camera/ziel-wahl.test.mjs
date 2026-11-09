import test from 'node:test';
import assert from 'node:assert/strict';
import { waehleZiel, zielPos } from './ziel-wahl.js';

// Blick +Z (yaw 0): rechts = −X
const A = { name: 'vorn', x: 0, z: 5 };
const R = { name: 'rechts', pos: { x: -4, z: 4 } };
const L = { name: 'links', zustand: { pos: { x: 4, y: 1, z: 4 } } };
const H = { name: 'hinten', x: 0, z: -5 };
const W = { name: 'weit', x: 0, z: 50 };
const alle = [A, R, L, H, W];

test('zielPos: verschiedene Formen', () => {
  assert.deepEqual(zielPos(L), { x: 4, y: 1, z: 4 });
  assert.deepEqual(zielPos(() => ({ x: 1, z: 2 })), { x: 1, y: 0, z: 2 });
  assert.equal(zielPos({ x: NaN, z: 0 }), null);
  assert.equal(zielPos(null), null);
});

test('bestes Ziel vorn, Reichweite, Blickwinkel', () => {
  assert.equal(waehleZiel(alle, { von: { x: 0, z: 0 }, blickYaw: 0 }), A);
  assert.equal(waehleZiel(alle, { von: { x: 0, z: 0 }, blickYaw: Math.PI }), H);
  assert.equal(waehleZiel([W], { von: { x: 0, z: 0 } }), null);
  assert.equal(waehleZiel([], {}), null);
});

test('Ziel wechseln rechts/links, im Kreis', () => {
  const von = { x: 0, z: 0 };
  assert.equal(waehleZiel(alle, { von, aktuell: A, richtung: 1 }), R);
  assert.equal(waehleZiel(alle, { von, aktuell: A, richtung: -1 }), L);
  assert.equal(waehleZiel(alle, { von, aktuell: R, richtung: 1 }), H);   // weiter rechts herum
  assert.equal(waehleZiel(alle, { von, aktuell: H, richtung: 1 }), L);   // im Kreis
  assert.equal(waehleZiel([A], { von, aktuell: A, richtung: 1 }), A);    // nur eines → bleibt
});
