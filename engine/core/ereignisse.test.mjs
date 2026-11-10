import test from 'node:test';
import assert from 'node:assert/strict';
import { createEreignisse } from './ereignisse.js';

test('an/sende: Reihenfolge, Priorität, Anzahl', () => {
  const e = createEreignisse();
  const log = [];
  e.an('x', () => log.push('a'));
  e.an('x', () => log.push('b'), { prio: 5 });
  e.an('x', () => log.push('c'));
  assert.equal(e.sende('x', 1), 3);
  assert.deepEqual(log, ['b', 'a', 'c']);
  assert.equal(e.sende('nix'), 0);
});
test('Abmelde-Funktion, aus und hoerer', () => {
  const e = createEreignisse();
  const f = () => {};
  const ab = e.an('x', f);
  e.an('x', () => {});
  assert.equal(e.hoerer('x'), 2);
  ab();
  assert.equal(e.hoerer('x'), 1);
  e.an('y', f); e.aus('y', f);
  assert.equal(e.hoerer('y'), 0);
});
test('einmal feuert nur einmal', () => {
  const e = createEreignisse();
  let n = 0;
  e.einmal('x', () => n++);
  e.an('x', () => n++, { einmal: true });
  e.sende('x'); e.sende('x');
  assert.equal(n, 2);
  assert.equal(e.hoerer('x'), 0);
});
test("'*' hört alles mit Namen", () => {
  const e = createEreignisse();
  const got = [];
  e.an('*', (d, n) => got.push([n, d]));
  e.sende('a', 1); e.sende('b', 2);
  assert.deepEqual(got, [['a', 1], ['b', 2]]);
});
test('Abmelden während des Sendens: abgemeldeter Hörer wird nicht mehr gerufen', () => {
  const e = createEreignisse();
  const log = [];
  let abB;
  e.an('x', () => { log.push('a'); abB(); });
  abB = e.an('x', () => log.push('b'));
  e.sende('x');
  assert.deepEqual(log, ['a']);
});
test('Anmelden während des Sendens gilt erst beim nächsten Mal', () => {
  const e = createEreignisse();
  let n = 0;
  e.an('x', () => e.an('x', () => n++), { einmal: true });
  e.sende('x');
  assert.equal(n, 0);
  e.sende('x');
  assert.equal(n, 1);
});
test('Fehler im Hörer: andere laufen, erster Fehler wird geworfen', () => {
  const e = createEreignisse();
  let n = 0;
  e.an('x', () => { throw new Error('eins'); });
  e.an('x', () => { throw new Error('zwei'); });
  e.an('x', () => n++);
  assert.throws(() => e.sende('x'), /eins/);
  assert.equal(n, 1);
});
test('Fehler-Callback statt Werfen', () => {
  const fehler = [];
  const e = createEreignisse({ fehler: (err, name) => fehler.push([err.message, name]) });
  e.an('x', () => { throw new Error('böse'); });
  e.an('x', () => {});
  assert.equal(e.sende('x'), 2);
  assert.deepEqual(fehler, [['böse', 'x']]);
});
test('spaeter/leeren: Einreih-Reihenfolge, Neues beim Leeren', () => {
  const e = createEreignisse();
  const log = [];
  e.an('a', () => { log.push('a'); e.spaeter('c'); });
  e.an('b', () => log.push('b'));
  e.an('c', () => log.push('c'));
  e.spaeter('a'); e.spaeter('b');
  assert.deepEqual(log, []);
  assert.equal(e.leeren(), 3);
  assert.deepEqual(log, ['a', 'b', 'c']);
  assert.equal(e.leeren(), 0);
});
test('leeren: Schutz gegen Endlosschleife', () => {
  const e = createEreignisse();
  e.an('x', () => e.spaeter('x'));
  e.spaeter('x');
  assert.equal(e.leeren(), 10000);
  e.dispose();
  assert.equal(e.leeren(), 0);
});
test('dispose entfernt alles', () => {
  const e = createEreignisse();
  let n = 0;
  e.an('x', () => n++);
  e.dispose();
  assert.equal(e.sende('x'), 0);
  assert.equal(n, 0);
});
