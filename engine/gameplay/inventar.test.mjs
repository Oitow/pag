import test from 'node:test';
import assert from 'node:assert/strict';
import { createInventar } from './inventar.js';
import { createRegister } from '../core/register.js';
import { createEreignisse } from '../core/ereignisse.js';

test('gib: Stapel auffüllen, dann freie Plätze, Überlauf als Rest', () => {
  const inv = createInventar({ plaetze: 3, stapel: 10 });
  assert.equal(inv.gib('holz', 5), 0);
  assert.equal(inv.gib('holz', 8), 0);
  assert.deepEqual(inv.plaetze.map((p) => p && p.anzahl), [10, 3, null]);
  assert.equal(inv.gib('holz', 30), 13); // 7 + 10 passen
  assert.equal(inv.frei(), 0);
  assert.equal(inv.zaehle('holz'), 30);
});
test('ungültige Eingaben ändern nichts', () => {
  const inv = createInventar({ plaetze: 2 });
  let n = 0;
  inv.onAenderung(() => n++);
  assert.equal(inv.gib('a', 0), 0);
  assert.equal(inv.gib('a', -3), -3);
  assert.ok(Number.isNaN(inv.gib('a', NaN)));
  assert.equal(inv.nimm('a', 0), 0);
  assert.equal(inv.nimmVon(5), null);
  assert.equal(inv.nimmVon(0), null);
  assert.equal(inv.verschiebe(0, 9), false);
  assert.equal(inv.teile(7, 1), -1);
  assert.equal(inv.passt('a', NaN), false);
  assert.equal(inv.hat('a', 0), false);
  assert.equal(n, 0);
  assert.equal(inv.frei(), 2);
});
test('passt ändert nichts', () => {
  const inv = createInventar({ plaetze: 1, stapel: 5 });
  assert.ok(inv.passt('a', 5));
  assert.ok(!inv.passt('a', 6));
  assert.equal(inv.frei(), 1);
});
test('nimm: von hinten nach vorn, zu wenig vorhanden', () => {
  const inv = createInventar({ plaetze: 3, stapel: 5 });
  inv.gib('a', 12);
  assert.equal(inv.nimm('a', 4), 4);
  assert.deepEqual(inv.plaetze.map((p) => p && p.anzahl), [5, 3, null]);
  assert.equal(inv.nimm('a', 100), 8);
  assert.equal(inv.frei(), 3);
  assert.equal(inv.nimm('a', 1), 0);
});
test('nimmVon', () => {
  const inv = createInventar({ plaetze: 2, stapel: 9 });
  inv.gib('a', 5);
  assert.deepEqual(inv.nimmVon(0, 2), { id: 'a', anzahl: 2 });
  assert.deepEqual(inv.nimmVon(0), { id: 'a', anzahl: 3 });
  assert.equal(inv.plaetze[0], null);
  inv.gib('schwert', 1, { haltbar: 7 });
  assert.deepEqual(inv.nimmVon(0), { id: 'schwert', anzahl: 1, daten: { haltbar: 7 } });
});
test('hat / zaehle / frei', () => {
  const inv = createInventar({ plaetze: 4, stapel: 3 });
  inv.gib('a', 5);
  assert.ok(inv.hat('a', 5)); assert.ok(!inv.hat('a', 6)); assert.ok(inv.hat('a'));
  assert.equal(inv.zaehle('b'), 0);
  assert.equal(inv.frei(), 2);
});
test('Gewichtsgrenze', () => {
  const reg = createRegister({ art: 'gegenstand' });
  reg.definiereAlle({ stein: { gewicht: 2, stapel: 50 }, feder: {} });
  const inv = createInventar({ plaetze: 5, register: reg, maxGewicht: 10 });
  assert.equal(inv.gib('stein', 8), 3); // 5 Stück = 10
  assert.equal(inv.gewicht, 10);
  assert.ok(!inv.passt('stein', 1));
  assert.equal(inv.gib('feder', 40), 0); // Gewicht 0
  inv.nimm('stein', 1);
  assert.equal(inv.gewicht, 8);
  assert.ok(inv.passt('stein', 1));
});
test('Register: Stapelgröße je Gegenstand, unbekannte id wirft', () => {
  const reg = createRegister();
  reg.definiere('pfeil', { stapel: 3 });
  const inv = createInventar({ plaetze: 2, register: reg, stapel: 99 });
  assert.equal(inv.gib('pfeil', 7), 1);
  assert.throws(() => inv.gib('unbekannt', 1), /unbekannt/);
  assert.equal(inv.passt('unbekannt'), false);
});
test('Gegenstände mit daten stapeln nie', () => {
  const inv = createInventar({ plaetze: 3 });
  const d = { haltbar: 5 };
  assert.equal(inv.gib('axt', 2, d), 0);
  assert.deepEqual(inv.plaetze.map((p) => p && p.anzahl), [1, 1, null]);
  d.haltbar = 99;
  assert.equal(inv.plaetze[0].daten.haltbar, 5);
  assert.equal(inv.gib('axt', 3, { haltbar: 1 }), 2);
  assert.equal(inv.gib('axt', 1), 1);
});
test('verschiebe: zusammenlegen mit Rest, tauschen', () => {
  const inv = createInventar({ plaetze: 4, stapel: 10 });
  inv.gib('a', 8); inv.gib('b', 4); // [a8, b4]
  assert.ok(inv.verschiebe(0, 3)); // leerer Zielplatz: tauschen
  assert.equal(inv.plaetze[3].anzahl, 8);
  assert.equal(inv.plaetze[0], null);
  inv.gib('a', 5); // füllt Platz 3 auf 10, Rest 3 auf Platz 0
  assert.deepEqual(inv.plaetze.map((p) => p && p.anzahl), [3, 4, null, 10]);
  assert.equal(inv.verschiebe(0, 3), false); // Ziel voll
  inv.nimmVon(3, 5); // a:5
  assert.ok(inv.verschiebe(0, 3)); // 5+3 = 8
  assert.equal(inv.plaetze[3].anzahl, 8);
  assert.equal(inv.plaetze[0], null);
  assert.ok(inv.verschiebe(1, 3)); // b mit a tauschen
  assert.equal(inv.plaetze[3].id, 'b');
  assert.equal(inv.plaetze[1].id, 'a');
  assert.equal(inv.verschiebe(3, 3), false);
  assert.equal(inv.verschiebe(0, 2), false); // beide leer
});
test('teile', () => {
  const inv = createInventar({ plaetze: 2, stapel: 10 });
  inv.gib('a', 6);
  assert.equal(inv.teile(0, 2), 1);
  assert.deepEqual(inv.plaetze.map((p) => p.anzahl), [4, 2]);
  assert.equal(inv.teile(0, 1), -1); // voll
  inv.nimmVon(1);
  assert.equal(inv.teile(0, 4), -1); // nicht weniger als alles
  assert.equal(inv.teile(0, 0), -1);
  assert.equal(inv.teile(1, 1), -1);
});
test('leere', () => {
  const inv = createInventar({ plaetze: 2 });
  let n = 0;
  inv.onAenderung(() => n++);
  inv.leere();
  assert.equal(n, 0);
  inv.gib('a', 1); inv.leere();
  assert.equal(inv.frei(), 2);
  assert.equal(n, 2);
});
test('zustand/lade Rundlauf (reines JSON)', () => {
  const a = createInventar({ plaetze: 4, stapel: 10 });
  a.gib('holz', 12); a.gib('axt', 1, { haltbar: 3 });
  const z = JSON.parse(JSON.stringify(a.zustand()));
  const b = createInventar({ plaetze: 4, stapel: 10 });
  b.lade(z);
  assert.deepEqual(b.zustand(), a.zustand());
  assert.deepEqual(z.plaetze[3], null);
});
test('lade mit Müll', () => {
  const reg = createRegister();
  reg.definiere('a', { stapel: 5 });
  const inv = createInventar({ plaetze: 3, register: reg });
  inv.gib('a', 1);
  inv.lade({ plaetze: [['a', 99], ['fremd', 3], ['a', -2], 'quatsch', ['a', 1]] });
  assert.deepEqual(inv.zustand(), { plaetze: [['a', 5], null, null] });
  inv.lade(null);
  assert.equal(inv.frei(), 3);
  inv.lade({ plaetze: [['a', NaN], [7, 1], ['a', '4']] });
  assert.deepEqual(inv.zustand(), { plaetze: [null, null, ['a', 4]] });
});
test('onAenderung einmal je Aufruf, Abmelden, Ereignis-Bus', () => {
  const bus = createEreignisse();
  const got = [];
  bus.an('inventar:geaendert', (d) => got.push(d.inventar));
  const inv = createInventar({ plaetze: 3, stapel: 2, ereignisse: bus, name: 'rucksack' });
  let n = 0;
  const ab = inv.onAenderung((i) => { n++; assert.equal(i, inv); });
  inv.gib('a', 5); // mehrere Plätze, eine Meldung
  assert.equal(n, 1);
  assert.deepEqual(got, ['rucksack']);
  ab();
  inv.nimm('a', 1);
  assert.equal(n, 1);
  assert.equal(got.length, 2);
});
test('dispose', () => {
  const inv = createInventar({ plaetze: 2 });
  let n = 0;
  inv.onAenderung(() => n++);
  inv.dispose();
  inv.gib('a', 1);
  assert.equal(n, 0);
});

test('setzeDaten: nur Einzelstücke, null entfernt, meldet Änderung', () => {
  const inv = createInventar({ plaetze: 3 });
  inv.gib('holz', 2); inv.gib('axt', 1);
  let n = 0; inv.onAenderung(() => n++);
  assert.equal(inv.setzeDaten(0, { x: 1 }), false);
  assert.equal(inv.setzeDaten(2, { x: 1 }), false);
  assert.equal(inv.setzeDaten(1, 'nein'), false);
  assert.equal(inv.setzeDaten(1, { haltbarkeit: 4 }), true);
  assert.deepEqual(inv.zustand().plaetze[1], ['axt', 1, { haltbarkeit: 4 }]);
  assert.equal(inv.setzeDaten(1, null), true);
  assert.deepEqual(inv.zustand().plaetze[1], ['axt', 1]);
  assert.equal(n, 2);
});

test('uebertrage: ganzer Stapel, Teilmenge, Ziel voll, daten, leerer Platz', async () => {
  const { uebertrage } = await import('./inventar.js');
  const a = createInventar({ plaetze: 3, stapel: 10 });
  const b = createInventar({ plaetze: 1, stapel: 10 });
  a.gib('holz', 7);
  assert.equal(uebertrage(a, 0, b, 3), 3);
  assert.equal(a.zaehle('holz'), 4); assert.equal(b.zaehle('holz'), 3);
  assert.equal(uebertrage(a, 0, b), 4);
  assert.equal(a.zaehle('holz'), 0); assert.equal(b.zaehle('holz'), 7);
  a.gib('holz', 8);
  assert.equal(uebertrage(a, 0, b), 3);            // Ziel voll bis 10
  assert.equal(a.zaehle('holz'), 5); assert.equal(b.zaehle('holz'), 10);
  assert.equal(uebertrage(a, 0, b), 0);            // nichts passt mehr
  assert.equal(a.zaehle('holz'), 5);
  assert.equal(uebertrage(a, 2, b), 0);            // leerer Platz
  assert.equal(uebertrage(a, 99, b), 0);           // ungültig
  const c = createInventar({ plaetze: 2 });
  a.leere(); a.gib('axt', 1, { haltbarkeit: 4 });
  assert.equal(uebertrage(a, 0, c), 1);
  assert.deepEqual(c.plaetze[0].daten, { haltbarkeit: 4 });
  assert.equal(a.frei(), 3);
});
