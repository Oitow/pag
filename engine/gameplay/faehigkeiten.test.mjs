import test from 'node:test';
import assert from 'node:assert/strict';
import { createLeiste, FAEHIGKEITEN, FAEHIGKEITEN_NAMEN } from './faehigkeiten.js';

const feind = { id: 'g', feind: true }, freund = { id: 'f', feind: false };
const typen = (es) => es.map((e) => e.typ);

test('Daten: 12 Fähigkeiten', () => {
  assert.equal(FAEHIGKEITEN_NAMEN.length, 12);
  assert.equal(FAEHIGKEITEN.feuerball.wirkung.zauber, 'feuerball');
});

test('GCD sperrt und gibt frei', () => {
  const l = createLeiste();
  assert.deepEqual(l.nutze('hieb', { ziel: feind, abstand: 2 }), { ok: true, grund: null });
  assert.equal(l.nutze('frostnova').grund, 'gcd');
  assert.equal(l.gcdAnteil, 1);
  l.update(1.3);
  assert.equal(l.gcdAnteil, 0);
  assert.equal(l.nutze('frostnova').ok, true);
});

test('gcd:false ignoriert die GCD', () => {
  const l = createLeiste();
  l.nutze('hieb', { ziel: feind, abstand: 2 });
  assert.equal(l.nutze('blinzeln').ok, true);
  assert.equal(l.nutze('spott', { ziel: feind, abstand: 5 }).ok, true);
});

test('Ressource fehlt, Wut per gib', () => {
  const l = createLeiste();
  assert.equal(l.ressource('wut').wert, 0);
  assert.equal(l.nutze('wirbelwind').grund, 'ressource');
  l.gib('wut', 40);
  assert.equal(l.nutze('wirbelwind').ok, true);
  assert.equal(l.ressource('wut').wert, 10);
  l.update(1);
  assert.ok(l.ressource('wut').wert < 10);   // Wut verfällt
  assert.ok(l.ressource('mana').wert <= 100);
});

test('Mana regeneriert', () => {
  const l = createLeiste();
  l.nutze('frostnova');
  assert.equal(l.ressource('mana').wert, 78);
  l.update(2);
  assert.equal(l.ressource('mana').wert, 88);
});

test('Wirkzeit führt zu fertig', () => {
  const l = createLeiste();
  assert.equal(l.nutze('feuerball', { ziel: feind, abstand: 10 }).ok, true);
  assert.equal(l.nutze('heilung').grund, 'wirkt');
  assert.deepEqual(typen(l.update(0.6)), ['wirkStart']);
  assert.ok(Math.abs(l.wirkt.anteil - 0.5) < 0.01);
  const es = l.update(0.7);
  assert.deepEqual(typen(es), ['fertig']);
  assert.equal(es[0].def.wirkung.typ, 'zauber');
  assert.equal(l.wirkt, null);
});

test('Bewegung bricht ab und erstattet Kosten', () => {
  const l = createLeiste();
  l.nutze('feuerball', { ziel: feind, abstand: 10 });
  const es = l.update(0.3, { bewegt: true });
  assert.deepEqual(typen(es), ['wirkStart', 'unterbrochen']);
  assert.equal(es[1].grund, 'bewegt');
  assert.equal(l.ressource('mana').wert, 100);
});

test('Kanal: Takte, Bewegung erlaubt', () => {
  const l = createLeiste();
  l.gib('wut', 100);
  l.nutze('wirbelwind');
  let es = l.update(1, { bewegt: true });
  assert.deepEqual(typen(es), ['wirkStart', 'kanalTakt', 'kanalTakt']);
  es = l.update(1.01, { bewegt: true });
  assert.deepEqual(typen(es), ['kanalTakt', 'kanalTakt', 'fertig']);
  assert.equal(l.wirkt, null);
});

test('Ladungen laden einzeln nach', () => {
  const l = createLeiste();
  const z = { ziel: feind, abstand: 5 };
  assert.equal(l.ladungen('ansturm'), 2);
  l.nutze('ansturm', z); l.update(1.3);
  assert.equal(l.ladungen('ansturm'), 1);
  l.nutze('ansturm', z); l.update(1.3);
  assert.equal(l.ladungen('ansturm'), 0);
  assert.equal(l.nutze('ansturm', z).grund, 'abklingzeit');
  assert.ok(l.abkling('ansturm') > 0);
  l.update(8);
  assert.equal(l.ladungen('ansturm'), 1);
  l.update(10);
  assert.equal(l.ladungen('ansturm'), 2);
});

test('Reichweite und Ziel', () => {
  const l = createLeiste();
  assert.equal(l.nutze('hieb').grund, 'ziel');
  assert.equal(l.nutze('hieb', { ziel: feind, abstand: 9 }).grund, 'reichweite');
  assert.equal(l.nutze('hieb', { ziel: freund, abstand: 1 }).grund, 'ziel');
  assert.equal(l.nutze('erneuerung', { ziel: feind, abstand: 1 }).grund, 'ziel');
  assert.equal(l.nutze('erneuerung', { ziel: freund, abstand: 40 }).grund, 'reichweite');
  assert.equal(l.nutze('erneuerung', { ziel: freund, abstand: 5 }).ok, true);
});

test('Sperren: gesperrt', () => {
  const l = createLeiste();
  l.update(0.1, { sperren: { kannZaubern: false } });
  assert.equal(l.nutze('frostnova').grund, 'gesperrt');
  assert.equal(l.nutze('hieb', { ziel: feind, abstand: 1 }).ok, true);
  l.update(2, { sperren: { kannHandeln: false } });
  assert.equal(l.kann('hieb', { ziel: feind, abstand: 1 }).grund, 'gesperrt');
});

test('Sperre unterbricht laufende Wirkzeit', () => {
  const l = createLeiste();
  l.nutze('feuerball', { ziel: feind, abstand: 5 });
  const es = l.update(0.2, { sperren: { kannZaubern: false } });
  assert.equal(es.at(-1).grund, 'gesperrt');
});

test('Pushback: +0.2 s, höchstens 2x', () => {
  const l = createLeiste();
  l.nutze('feuerball', { ziel: feind, abstand: 5 });   // 1.2 s
  for (let i = 0; i < 3; i++) l.update(0.01, { getroffen: true });
  const es = l.update(1.2 - 0.03, {});
  assert.ok(!typen(es).includes('fertig'));
  assert.ok(typen(l.update(0.4)).includes('fertig'));   // 1.6 s gesamt
});

test('unterbrich() manuell', () => {
  const l = createLeiste();
  l.nutze('heilung', { ziel: freund, abstand: 3 });
  assert.equal(l.unterbrich(), true);
  assert.equal(l.unterbrich(), false);
  assert.ok(typen(l.update(0.1)).includes('unterbrochen'));
});

test('zustand()/laden() Rundlauf', () => {
  const a = createLeiste();
  a.gib('wut', 50);
  a.nutze('feuerball', { ziel: feind, abstand: 5 });
  a.update(0.5);
  const z = JSON.parse(JSON.stringify(a.zustand()));
  const b = createLeiste();
  b.laden(z);
  assert.deepEqual(b.zustand(), a.zustand());
  assert.equal(b.wirkt.name, 'feuerball');
  assert.ok(typen(b.update(0.8)).includes('fertig'));
});
