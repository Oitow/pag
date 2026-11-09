import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpielzeit, JAHRESZEITEN } from './zeit.js';

const nah = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('zeit: Grundwerte und uhrText', () => {
  const u = createSpielzeit();
  assert.equal(u.stunde, 8);
  assert.equal(u.tag, 1);
  assert.equal(u.jahr, 1);
  assert.equal(u.jahreszeitName, JAHRESZEITEN[0]);
  assert.equal(u.istNacht, false);
  u.update(2.5); // 30 s/h -> 5 Minuten
  assert.equal(u.uhrText(), '08:05');
  u.setze({ stunde: 21 });
  assert.equal(u.istNacht, true);
});

test('zeit: Ereignisreihenfolge bei grossem dt', () => {
  const u = createSpielzeit({ stunde: 22, sekundenProStunde: 1, tageProJahreszeit: 1 });
  const log = [];
  u.on('stunde', (s) => log.push('s' + s));
  u.on('tag', (t) => log.push('t' + t));
  u.on('jahreszeit', (j) => log.push('j' + j));
  const h = u.update(4); // 4 Stunden: 22 -> 02 am Folgetag
  nah(h, 4);
  assert.deepEqual(log, ['s23', 't2', 'j1', 's0', 's1', 's2']);
  assert.equal(u.tag, 2);
  nah(u.stunde, 2);
});

test('zeit: mehrere Tage, Jahreswechsel, jahresAnteil', () => {
  const u = createSpielzeit({ stunde: 0, tageProJahreszeit: 2, sekundenProStunde: 1 });
  const tage = [], jz = [];
  u.on('tag', (t) => tage.push(t));
  u.on('jahreszeit', (j) => jz.push(j));
  u.vor(24 * 8); // genau ein Jahr (8 Tage)
  assert.deepEqual(tage, [2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(jz, [1, 2, 3, 0]);
  assert.equal(u.tag, 9);
  assert.equal(u.jahr, 2);
  nah(u.jahresAnteil, 0);
  u.setze({ tag: 1, stunde: 12 });
  nah(u.jahresAnteil, 0.5 / 8);
  u.setze({ tag: 7 });
  assert.equal(u.jahreszeitName, 'Winter');
});

test('zeit: Pause, tempo, setze ohne Ereignisse, Abmelden', () => {
  const u = createSpielzeit({ stunde: 10, sekundenProStunde: 10 });
  let n = 0;
  const ab = u.on('stunde', () => n++);
  u.pause = true;
  assert.equal(u.update(100), 0);
  assert.equal(u.stunde, 10);
  u.pause = false;
  u.tempo = 2;
  nah(u.update(5), 1);
  assert.equal(u.stunde, 11);
  assert.equal(n, 1);
  u.setze({ stunde: 3, tag: 4 });
  assert.equal(n, 1);
  ab();
  u.vor(2);
  assert.equal(n, 1);
  assert.throws(() => u.on('quatsch', () => {}));
});

test('zeit: zustand/lade Rundreise und dispose', () => {
  const a = createSpielzeit({ stunde: 5, tag: 12, tempo: 3 });
  a.pause = true;
  const z = JSON.parse(JSON.stringify(a.zustand()));
  const b = createSpielzeit();
  b.lade(z);
  assert.equal(b.stunde, 5);
  assert.equal(b.tag, 12);
  assert.equal(b.tempo, 3);
  assert.equal(b.pause, true);
  let n = 0;
  b.on('tag', () => n++);
  b.dispose();
  b.pause = false;
  b.vor(48);
  assert.equal(n, 0);
});
