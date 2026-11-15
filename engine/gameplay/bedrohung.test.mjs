import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBedrohung } from './bedrohung.js';

test('ziel: leer → null, höchster Wert', () => {
  const b = createBedrohung();
  assert.equal(b.ziel('ork'), null);
  b.add('ork', 'tank', 100); b.add('ork', 'magier', 50);
  assert.equal(b.ziel('ork'), 'tank');
  assert.deepEqual(b.liste('ork'), [{ id: 'tank', wert: 100 }, { id: 'magier', wert: 50 }]);
});

test('Wechsel erst bei > 110 % des aktuellen Ziels', () => {
  const b = createBedrohung();
  b.add('ork', 'tank', 100); b.ziel('ork');
  b.add('ork', 'magier', 105); assert.equal(b.ziel('ork'), 'tank');
  b.add('ork', 'magier', 5); assert.equal(b.ziel('ork'), 'tank'); // 110 ist nicht > 110
  b.add('ork', 'magier', 1); assert.equal(b.ziel('ork'), 'magier');
});

test('Spott: sofort oben, festgenagelt bis Ablauf', () => {
  const b = createBedrohung();
  b.add('ork', 'tank', 100); assert.equal(b.ziel('ork'), 'tank'); b.add('ork', 'magier', 105);
  b.spott('ork', 'tank', 3);
  assert.equal(b.ziel('ork'), 'tank');
  b.add('ork', 'magier', 10000); assert.equal(b.ziel('ork'), 'tank');
  b.update(3.1); assert.equal(b.ziel('ork'), 'magier');
});

test('Spott setzt Tank über den Spitzenreiter', () => {
  const b = createBedrohung();
  b.add('ork', 'magier', 200); b.ziel('ork');
  b.spott('ork', 'tank', 1); b.update(1.5);
  assert.equal(b.ziel('ork'), 'tank');
});

test('Heilung: halbe Bedrohung auf alle Gegner', () => {
  const b = createBedrohung();
  b.heilung('heiler', 100, ['a', 'b']);
  assert.equal(b.liste('a')[0].wert, 50); assert.equal(b.liste('b')[0].wert, 50);
});

test('entferne als Quelle und Gegner, leere', () => {
  const b = createBedrohung();
  b.add('a', 'x', 5); b.add('a', 'y', 3); b.add('b', 'x', 5);
  b.ziel('a'); b.entferne('x');
  assert.equal(b.ziel('a'), 'y'); assert.deepEqual(b.liste('b'), []);
  b.entferne('a'); assert.equal(b.ziel('a'), null);
  b.add('c', 'y', 1); b.leere('c'); assert.equal(b.ziel('c'), null);
});

test('Verfall', () => {
  const b = createBedrohung({ verfall: 0.5 });
  b.add('a', 'x', 100); b.update(1);
  assert.equal(b.liste('a')[0].wert, 50);
});

test('zustand()/laden() Rundreise', () => {
  const b = createBedrohung();
  b.add('ork', 'tank', 100); b.add('ork', 'magier', 120); b.ziel('ork'); b.spott('ork', 'magier', 2);
  const c = createBedrohung(); c.laden(JSON.parse(JSON.stringify(b.zustand())));
  assert.deepEqual(c.liste('ork'), b.liste('ork')); assert.equal(c.ziel('ork'), 'magier');
  c.update(3); assert.equal(c.ziel('ork'), 'magier');
  c.dispose(); assert.equal(c.ziel('ork'), null);
});
