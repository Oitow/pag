import test from 'node:test';
import assert from 'node:assert/strict';
import { createStationen } from './stationen.js';
import { createInteraktion } from './interaktion.js';
import { createRezepte } from './rezepte.js';
import { createInventar } from './inventar.js';
import { createRegister } from '../core/register.js';
import { createEreignisse } from '../core/ereignisse.js';

test('neu/hole/alle/anzahl und Fehler', () => {
  const st = createStationen();
  const s = st.neu('a', { art: 'werkbank', pos: { x: 0, z: 0 } });
  assert.equal(s.name, 'werkbank');
  assert.equal(st.hole('a'), s);
  assert.equal(st.anzahl, 1);
  assert.equal(st.alle().length, 1);
  assert.throws(() => st.neu('a', { art: 'x', pos: { x: 0, z: 0 } }), /existiert/);
  assert.throws(() => st.neu('b', { pos: { x: 0, z: 0 } }), /art/);
  assert.equal(st.entferne('a'), true);
  assert.equal(st.entferne('a'), false);
  assert.equal(st.anzahl, 0);
});

test('beiWem: Reichweite, Radius, doppelte Art, inaktiv, Höhe, Array wiederverwenden', () => {
  const st = createStationen({ reichweite: 2 });
  st.neu('w1', { art: 'werkbank', pos: { x: 0, z: 0 } });
  st.neu('w2', { art: 'werkbank', pos: { x: 1, z: 0 } });
  st.neu('f', { art: 'feuer', pos: { x: 10, z: 0 }, radius: 3 });
  assert.deepEqual(st.beiWem({ x: 1.5, z: 0 }), ['werkbank']);
  assert.deepEqual(st.beiWem({ x: 20, z: 0 }), []);
  assert.deepEqual(st.beiWem({ x: 15, z: 0 }), ['feuer']);          // 5 − 3 = 2 ≤ 2
  assert.deepEqual(st.beiWem({ x: 15.5, z: 0 }), []);
  st.setAktiv('w1', false); st.setAktiv('w2', false);
  assert.deepEqual(st.beiWem({ x: 0, z: 0 }), []);
  assert.equal(st.setAktiv('nix', true), false);
  st.neu('h', { art: 'amboss', pos: { x: 0, y: 5, z: 0 } });
  assert.deepEqual(st.beiWem({ x: 0, y: 0, z: 0 }), []);
  assert.deepEqual(st.beiWem({ x: 0, y: 4, z: 0 }), ['amboss']);
  assert.deepEqual(st.beiWem({ x: 0, z: 0 }), ['amboss']);           // ohne wer.y keine Höhenregel
  const puffer = ['x'];
  assert.equal(st.beiWem({ x: 0, z: 0 }, puffer), puffer);
  assert.deepEqual(puffer, ['amboss']);
});

test('naechste: mit und ohne art', () => {
  const st = createStationen({ reichweite: 5 });
  st.neu('a', { art: 'werkbank', pos: { x: 3, z: 0 } });
  st.neu('b', { art: 'feuer', pos: { x: 1, z: 0 } });
  assert.equal(st.naechste({ x: 0, z: 0 }).id, 'b');
  assert.equal(st.naechste({ x: 0, z: 0 }, 'werkbank').id, 'a');
  assert.equal(st.naechste({ x: 0, z: 0 }, 'amboss'), null);
  assert.equal(st.naechste({ x: 50, z: 0 }), null);
  st.setAktiv('b', false);
  assert.equal(st.naechste({ x: 0, z: 0 }).id, 'a');
});

test('benutze: Ereignis und onBenutzt', () => {
  const ereignisse = createEreignisse();
  const log = [], ev = [];
  ereignisse.an('station:benutzt', (d) => ev.push(d));
  const st = createStationen({ ereignisse, onBenutzt: (s, w) => log.push([s.id, w]) });
  st.neu('a', { art: 'werkbank', pos: { x: 0, z: 0 } });
  const wer = { x: 0, z: 0 };
  assert.equal(st.benutze('a', wer), true);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].station.id, 'a');
  assert.equal(ev[0].wer, wer);
  assert.deepEqual(log, [['a', wer]]);
  st.setAktiv('a', false);
  assert.equal(st.benutze('a', wer), false);
  assert.equal(st.benutze('nix', wer), false);
  assert.equal(ev.length, 1);
});

test('Interaktions-Ziel: gemeldet, deaktiviert, entfernt', () => {
  const interaktion = createInteraktion();
  const benutzt = [];
  const st = createStationen({ interaktion, onBenutzt: (s) => benutzt.push(s.id) });
  st.neu('a', { art: 'werkbank', name: 'Werkbank', pos: { x: 0, z: 0 } });
  const wer = { x: 0, z: 1 };
  interaktion.aktualisiere();
  const z = interaktion.beste(wer);
  assert.equal(z.id, 'station:a');
  assert.equal(z.text, 'Werkbank benutzen');
  interaktion.ausloesen(wer);
  assert.deepEqual(benutzt, ['a']);
  st.setAktiv('a', false);
  assert.equal(interaktion.beste(wer), null);
  st.setAktiv('a', true);
  assert.equal(interaktion.beste(wer)?.id, 'station:a');
  st.entferne('a');
  assert.equal(interaktion.hat('station:a'), false);
});

test('Zusammenspiel mit rezepte: nur an der Werkbank herstellbar', () => {
  const gegenstaende = createRegister({ art: 'gegenstand', standard: { stapel: 10 } });
  gegenstaende.definiereAlle({ holz: {}, brett: {} });
  const inv = createInventar({ plaetze: 4, register: gegenstaende });
  const rezepte = createRezepte({ gegenstaende });
  rezepte.definiere('brett', { zutaten: { holz: 2 }, station: 'werkbank' });
  inv.gib('holz', 2);
  const st = createStationen();
  st.neu('w', { art: 'werkbank', pos: { x: 0, z: 0 } });
  assert.equal(rezepte.pruefe('brett', inv, { stationen: st.beiWem({ x: 30, z: 0 }) }).grund, 'station');
  assert.equal(rezepte.pruefe('brett', inv, { stationen: st.beiWem({ x: 1, z: 0 }) }).ok, true);
  assert.deepEqual(rezepte.stelleHer('brett', inv, { stationen: st.beiWem({ x: 1, z: 0 }) }), { id: 'brett', anzahl: 1 });
});

test('zustand/lade über JSON', () => {
  const st = createStationen();
  st.neu('a', { art: 'feuer', pos: { x: 0, z: 0 } });
  st.neu('b', { art: 'feuer', pos: { x: 5, z: 0 } });
  st.setAktiv('a', false);
  const stand = JSON.parse(JSON.stringify(st.zustand()));
  assert.deepEqual(stand, { a: 0, b: 1 });
  const st2 = createStationen();
  st2.neu('a', { art: 'feuer', pos: { x: 0, z: 0 } });
  st2.neu('b', { art: 'feuer', pos: { x: 5, z: 0 } });
  st2.lade(stand);
  assert.equal(st2.hole('a').aktiv, false);
  assert.equal(st2.hole('b').aktiv, true);
});

test('dispose: leert und meldet Ziele ab', () => {
  const interaktion = createInteraktion();
  const st = createStationen({ interaktion });
  st.neu('a', { art: 'feuer', pos: { x: 0, z: 0 } });
  st.dispose();
  assert.equal(st.anzahl, 0);
  assert.equal(interaktion.hat('station:a'), false);
});
