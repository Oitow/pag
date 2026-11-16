import test from 'node:test';
import assert from 'node:assert/strict';
import { createEreignisse } from '../core/ereignisse.js';
import { createAufgaben, pruefeDaten } from './aufgaben.js';

const ort = { platz: { x: 10, z: 0 } };
const DATEN = [
  { id: 'a', name: 'Eins', danach: 'b', belohnung: { text: 'Ok' }, schritte: [
    { id: 'geh', art: 'gehe-zu', text: 'Geh', ort: { x: 10, z: 0 }, radius: 2, signal: 'los', signalEnde: 'da' },
    { id: 'sprich', art: 'sprich-mit', text: 'Sprich', ziel: 'bo' },
    { id: 'sammle', art: 'sammle', text: 'Sammle', ding: 'kraut', anzahl: 3 },
    { id: 'kampf', art: 'besiege', text: 'Kämpfe', ziel: 'ratte', anzahl: 2 },
    { id: 'zauber', art: 'benutze', text: 'Zaubere', was: 'zauber:*', anzahl: 2 },
    { id: 'warte', art: 'warte', text: 'Warte', ort: 'platz', radius: 3, dauer: 2 },
  ] },
  { id: 'b', name: 'Zwei', schritte: [{ id: 'x', art: 'benutze', text: 'Spring', was: 'sprung' }] },
];
const neu = (o = {}) => { const e = createEreignisse(); const log = []; for (const n of ['start', 'schritt', 'fortschritt', 'schritt-fertig', 'fertig', 'signal']) e.an('aufgabe:' + n, (d) => log.push(n + ':' + (d.schritt ?? d.aufgabe) + (d.name ? ':' + d.name : ''))); return { a: createAufgaben({ daten: DATEN, ereignisse: e, ortVon: (n) => ort[n] ?? null, ...o }), log }; };

test('pruefeDaten findet Fehler und akzeptiert gültige Daten', () => {
  assert.deepEqual(pruefeDaten(DATEN), []);
  assert.ok(pruefeDaten([{ id: 'x', name: 'n', schritte: [{ id: 's', art: 'quatsch', text: 't' }] }]).length);
  assert.ok(pruefeDaten([{ id: 'x', name: 'n', danach: 'nix', schritte: [{ id: 's', art: 'warte', text: 't' }] }]).length >= 2);
  assert.ok(pruefeDaten([{ id: 'x', name: 'n', schritte: [{ id: 's', art: 'gehe-zu', text: 't', ort: { x: 1, z: 1 }, f() {} }] }]).length);
});

test('gehe-zu: nur im Radius, Signale und Ereignisreihenfolge', () => {
  const { a, log } = neu();
  assert.equal(a.starte('a'), true);
  assert.equal(a.starte('a'), false);
  assert.deepEqual(log, ['start:a', 'schritt:geh', 'signal:geh:los']);
  assert.deepEqual(a.update(0.1, { x: 0, z: 0 }), []);
  const ev = a.update(0.1, { x: 9, z: 0 });
  assert.deepEqual(ev.map((e) => e.typ), ['aufgabe:schritt-fertig', 'aufgabe:signal', 'aufgabe:schritt']);
  assert.equal(a.aktuell().schritt.id, 'sprich');
  assert.equal(a.status('a'), 'aktiv');
});

test('sprich-mit, sammle (melde + zaehle), besiege, benutze mit Platzhalter, warte mit Ort', () => {
  let korb = 0;
  const { a } = neu({ zaehle: () => korb });
  a.starte('a'); a.update(0, { x: 10, z: 0 });
  assert.equal(a.melde('gesprochen', { mit: 'xx' }), 0);
  assert.equal(a.melde('gesprochen', { mit: 'bo' }), 1);
  assert.equal(a.melde('gesammelt', { id: 'kraut' }), 1);
  assert.equal(a.aktuell().wert, 1);
  korb = 3; a.update(0, null);
  assert.equal(a.aktuell().schritt.id, 'kampf');
  a.melde('besiegt', { art: 'wolf' }); assert.equal(a.aktuell().wert, 0);
  a.melde('besiegt', { art: 'ratte', anzahl: 2 });
  assert.equal(a.aktuell().schritt.id, 'zauber');
  a.melde('benutzt', { was: 'sprung' }); assert.equal(a.aktuell().wert, 0);
  a.melde('benutzt', { was: 'zauber:funke' }); a.melde('benutzt', { was: 'zauber:blitz' });
  assert.equal(a.aktuell().schritt.id, 'warte');
  a.update(5, { x: 0, z: 0 }); assert.equal(a.aktuell().wert, 0);       // außerhalb: keine Zeit
  a.update(1, { x: 10, z: 0 }); assert.equal(a.aktuell().anteil, 0.5);
  a.update(1.5, { x: 10, z: 0 });
  assert.equal(a.fertig('a'), true);
  assert.deepEqual(a.aktiv(), ['b']);                                  // danach startet Folgeaufgabe
});

test('Ende: fertig-Ereignis mit Belohnung, danach-Start', () => {
  const { a } = neu();
  const e = createEreignisse(); const got = []; e.an('aufgabe:fertig', (d) => got.push(d));
  const b = createAufgaben({ daten: DATEN, ereignisse: e });
  b.springe('a', 'warte'); b.update(3, null);
  assert.deepEqual(got[0], { aufgabe: 'a', belohnung: { text: 'Ok' } });
  assert.equal(b.status('b'), 'aktiv');
  assert.equal(a.status('a'), 'neu');
});

test('zustand -> laden mitten im Schritt ergibt gleiches aktuell()', () => {
  const { a } = neu();
  a.starte('a'); a.update(0, { x: 10, z: 0 }); a.melde('gesprochen', { mit: 'bo' }); a.melde('gesammelt', { id: 'kraut', anzahl: 2 });
  const z = JSON.parse(JSON.stringify(a.zustand()));
  assert.equal(z.v, 1);
  const { a: b } = neu();
  b.laden(z);
  assert.deepEqual(b.aktuell(), a.aktuell());
  assert.deepEqual(b.zustand(), z);
});

test('springe (Index und id), brichAb, onAenderung', () => {
  const { a } = neu();
  let n = 0; const ab = a.onAenderung(() => n++);
  a.springe('a', 2); assert.equal(a.aktuell().schritt.id, 'sammle');
  a.springe('a', 'kampf'); assert.equal(a.aktuell('a').index, 3);
  a.springe('a', 'gibtsnicht'); assert.equal(a.aktuell().index, 3);
  assert.ok(n >= 2);
  a.brichAb('a'); assert.equal(a.aktuell(), null); assert.equal(a.status('a'), 'neu');
  ab(); const vorher = n; a.starte('b'); assert.equal(n, vorher);
});

test('gleiche Eingaben -> gleiche Ereignisfolge, gehe-zu ohne auflösbaren Ort bleibt offen', () => {
  const lauf = () => { const { a, log } = neu(); a.starte('a'); a.update(0, { x: 10, z: 0 }); a.melde('gesprochen', { mit: 'bo' }); return log.join('|'); };
  assert.equal(lauf(), lauf());
  const e = createAufgaben({ daten: [{ id: 'q', name: 'q', schritte: [{ id: 's', art: 'gehe-zu', text: 't', ort: 'unbekannt' }] }] });
  e.starte('q'); e.update(1, { x: 0, z: 0 });
  assert.equal(e.aktiv().length, 1);
});
