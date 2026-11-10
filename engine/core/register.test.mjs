import test from 'node:test';
import assert from 'node:assert/strict';
import { createRegister } from './register.js';

test('definiere: Standard, id, nummer, eingefroren', () => {
  const r = createRegister({ art: 'gegenstand', standard: { stapel: 10, farbe: 'grau' } });
  const e = r.definiere('stein', { farbe: 'rot' });
  assert.deepEqual({ ...e }, { stapel: 10, farbe: 'rot', id: 'stein', nummer: 0 });
  assert.ok(Object.isFrozen(e));
  assert.equal(r.definiere('holz', {}).nummer, 1);
});
test('doppelte id und ungültige id werfen', () => {
  const r = createRegister({ art: 'rezept' });
  r.definiere('a', {});
  assert.throws(() => r.definiere('a', {}), /rezept.*a/);
  assert.throws(() => r.definiere('', {}), /rezept/);
  assert.throws(() => r.definiere(5, {}), /rezept/);
});
test('ersetzen behält die Nummer', () => {
  const r = createRegister();
  r.definiere('a', { x: 1 }); r.definiere('b', {});
  const neu = r.definiere('a', { x: 2 }, { ersetzen: true });
  assert.equal(neu.nummer, 0);
  assert.equal(r.hole('a').x, 2);
  assert.equal(r.anzahl, 2);
});
test('definiereAlle, hole, brauche, hat', () => {
  const r = createRegister({ art: 'gegenstand' });
  r.definiereAlle({ a: { n: 1 }, b: { n: 2 } });
  assert.equal(r.hole('b').n, 2);
  assert.equal(r.hole('zz'), undefined);
  assert.equal(r.brauche('a').id, 'a');
  assert.throws(() => r.brauche('zz'), /gegenstand.*zz/);
  assert.ok(r.hat('a')); assert.ok(!r.hat('zz'));
});
test('nummer / idVon', () => {
  const r = createRegister();
  r.definiereAlle({ a: {}, b: {}, c: {} });
  assert.equal(r.nummer('c'), 2);
  assert.equal(r.nummer('x'), -1);
  assert.equal(r.idVon(1), 'b');
  assert.equal(r.idVon(9), undefined);
  assert.equal(r.idVon(-1), undefined);
});
test('alle, filter, mitTag, anzahl', () => {
  const r = createRegister();
  r.definiereAlle({ a: { tags: ['x', 'y'], w: 1 }, b: { w: 5 }, c: { tags: ['y'], w: 9 } });
  assert.deepEqual(r.alle().map((e) => e.id), ['a', 'b', 'c']);
  assert.deepEqual(r.filter((e) => e.w > 2).map((e) => e.id), ['b', 'c']);
  assert.deepEqual(r.mitTag('y').map((e) => e.id), ['a', 'c']);
  assert.deepEqual(r.mitTag('q'), []);
  assert.equal(r.anzahl, 3);
});
test('dispose leert', () => {
  const r = createRegister();
  r.definiere('a', {});
  r.dispose();
  assert.equal(r.anzahl, 0);
  assert.ok(!r.hat('a'));
});
