import test from 'node:test';
import assert from 'node:assert/strict';
import { rng } from '../../core/rng.js';
import { bogen, rosette, blumenSorte, BLUMEN_SORTEN, PILZ_SORTEN, kaktusArme, farbe, mische, hell, laubFarben, JAHRESZEITEN } from './pflanze-formen.js';

test('bogen: Länge stimmt, Biegung senkt die Spitze', () => {
  const gerade = bogen(1, Math.PI / 2, 0, 4);
  assert.equal(gerade.length, 5);
  assert.ok(Math.abs(gerade[4][1] - 1) < 1e-9 && Math.abs(gerade[4][0]) < 1e-9);
  const krumm = bogen(1, 1.2, 1.5, 6);
  let L = 0;
  for (let i = 1; i < krumm.length; i++) L += Math.hypot(krumm[i][0] - krumm[i - 1][0], krumm[i][1] - krumm[i - 1][1]);
  assert.ok(Math.abs(L - 1) < 1e-9);
  assert.ok(krumm[6][1] < 0.9 && krumm[6][0] > 0.3);
});

test('rosette: innen steiler und kürzer, deterministisch', () => {
  const a = rosette(rng(3), 12), b = rosette(rng(3), 12);
  assert.deepEqual(a, b);
  assert.ok(a[11].neigung > a[0].neigung && a[11].laenge < a[0].laenge);
});

test('Blumen- und Pilzsorten vollständig', () => {
  for (const n of Object.keys(BLUMEN_SORTEN)) {
    const s = blumenSorte(rng(1), n);
    assert.equal(s.name, n);
    assert.ok(['stern', 'schale', 'glocke', 'pompon', 'aehre'].includes(s.form));
    assert.ok(s.hoehe[0] < s.hoehe[1] && s.groesse > 0 && s.farben.length);
  }
  const namen = new Set();
  for (let i = 0; i < 200; i++) namen.add(blumenSorte(rng(i)).name);
  assert.equal(namen.size, Object.keys(BLUMEN_SORTEN).length, 'Zufall erreicht alle Sorten');
  for (const p of Object.values(PILZ_SORTEN)) assert.ok(p.hutR[0] > p.stielR);
});

test('kaktusArme: innerhalb der Stammhöhe', () => {
  for (let s = 0; s < 50; s++) for (const a of kaktusArme(rng(s), 3, 3)) {
    assert.ok(a.ansatz >= 0.3 && a.ansatz <= 0.6 && a.aus > 0 && a.hoch > 0);
    assert.ok(a.ansatz * 3 + a.hoch <= 3 * 0.92 + 1e-9);
  }
});

test('Farbhelfer und Jahreszeiten', () => {
  assert.deepEqual(farbe('#ff0000'), [1, 0, 0]);
  assert.deepEqual(farbe(0x00ff00), [0, 1, 0]);
  assert.deepEqual(mische([0, 0, 0], [1, 1, 1], 0.5), [0.5, 0.5, 0.5]);
  assert.deepEqual(hell([0.8, 0.5, 0.2], 2), [1, 1, 0.4]);
  for (const j of JAHRESZEITEN) assert.ok(laubFarben(j).grund.length >= 3);
  assert.deepEqual(laubFarben('quatsch'), laubFarben('sommer'));
});
