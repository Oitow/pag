import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWeltDinge } from './welt-dinge.js';
import { createKoerperWelt } from './koerper.js';
import { createInteraktion } from './interaktion.js';
import { createInventar } from './inventar.js';
import { createRegister } from '../core/register.js';
import { createEreignisse } from '../core/ereignisse.js';

function aufbau(extra = {}) {
  const register = createRegister({ art: 'gegenstand', standard: { stapel: 10 } });
  register.definiereAlle({ holz: { name: 'Holz', radius: 0.2 }, apfel: { name: 'Apfel', stapel: 5 }, axt: { name: 'Axt', stapel: 1 } });
  const physik = createKoerperWelt({ welt: { bodenHoehe: () => 0 } });
  const interaktion = createInteraktion();
  const ereignisse = createEreignisse();
  const log = [];
  ereignisse.an('*', (d, name) => log.push(name));
  const dinge = createWeltDinge({ physik, interaktion, register, ereignisse, ...extra });
  const lauf = (s) => { for (let i = 0; i < s * 60; i++) { physik.update(1 / 60); dinge.update(1 / 60); } interaktion.aktualisiere(); };
  return { register, physik, interaktion, ereignisse, dinge, log, lauf };
}

test('werfen → liegt → über die Interaktion aufheben', () => {
  const { dinge, interaktion, lauf, log, physik } = aufbau();
  const d = dinge.wirf('holz', 3, { x: 0, y: 0, z: 0 }, 0);
  assert.equal(d.koerper.radius, 0.2);
  lauf(3);
  assert.ok(d.koerper.ruht && d.koerper.pos.z > 0.8, 'nach vorn geflogen: ' + d.koerper.pos.z);
  const wer = { x: d.koerper.pos.x, y: 0, z: d.koerper.pos.z - 1, yaw: 0, inventar: createInventar({ plaetze: 4 }) };
  const ziel = interaktion.beste(wer);
  assert.equal(ziel.text, 'Holz ×3');
  assert.equal(interaktion.ausloesen(wer), 3);
  assert.equal(wer.inventar.zaehle('holz'), 3);
  assert.equal(dinge.anzahl, 0); assert.equal(physik.anzahl, 0); assert.equal(interaktion.anzahl, 0);
  assert.deepEqual(log, ['ding:neu', 'ding:weg', 'ding:aufgehoben']);
});

test('volles Inventar: Rest bleibt liegen', () => {
  const { dinge, interaktion } = aufbau();
  const d = dinge.lege('apfel', 5, { x: 0, y: 0.2, z: 0 });
  const inv = createInventar({ plaetze: 1, stapel: 3 });
  assert.equal(dinge.nimm(d, inv), 3);
  assert.equal(d.anzahl, 2); assert.equal(dinge.anzahl, 1);
  assert.equal(interaktion.hole('ding:' + d.nr).text, 'Apfel ×2');
  assert.equal(dinge.nimm(d, inv), 0);
  assert.equal(dinge.nimm(d, null), 0);
});

test('gleiche Stapel legen sich zusammen, Stapelgrenze und daten bleiben getrennt', () => {
  const { dinge, lauf } = aufbau();
  dinge.lege('apfel', 2, { x: 0, y: 0.15, z: 0 }); dinge.lege('apfel', 2, { x: 0.2, y: 0.15, z: 0 });
  dinge.lege('apfel', 4, { x: 0.1, y: 0.15, z: 0.1 });               // 4 + 4 > 5 → bleibt
  dinge.lege('holz', 1, { x: 0, y: 0.2, z: 0.1 });
  dinge.lege('axt', 1, { x: 0, y: 0.15, z: 0 }, { daten: { haltbar: 7 } }); dinge.lege('axt', 1, { x: 0, y: 0.15, z: 0 }, { daten: { haltbar: 9 } });
  lauf(2);
  const zahl = dinge.alle().map(d => d.id + d.anzahl).sort();
  assert.deepEqual(zahl, ['apfel4', 'apfel4', 'axt1', 'axt1', 'holz1']);
});

test('Lebensdauer räumt auf, unbekannte ids und Unsinn werden abgelehnt', () => {
  const { dinge, lauf } = aufbau({ lebensdauer: 1.5 });
  assert.equal(dinge.lege('gibtsnicht', 1, { x: 0, y: 1, z: 0 }), null);
  assert.equal(dinge.lege('holz', 0, { x: 0, y: 1, z: 0 }), null);
  assert.equal(dinge.lege('holz', 1, null), null);
  dinge.lege('holz', 1, { x: 0, y: 1, z: 0 });
  lauf(1); assert.equal(dinge.anzahl, 1);
  lauf(1); assert.equal(dinge.anzahl, 0);
});

test('zustand/lade: Spielstand rund, kaputte Einträge übersprungen, onNeu/onWeg', () => {
  let neu = 0, weg = 0;
  const { dinge, lauf } = aufbau({ onNeu: () => neu++, onWeg: () => weg++ });
  dinge.lege('holz', 3, { x: 4, y: 0.2, z: -2 }); dinge.lege('axt', 1, { x: 9, y: 0.15, z: 9 }, { daten: { haltbar: 7 } });
  lauf(1);
  const stand = JSON.parse(JSON.stringify(dinge.zustand()));
  assert.deepEqual(stand, [['holz', 3, 4, 0.2, -2, 1], ['axt', 1, 9, 0.15, 9, 1, { haltbar: 7 }]]);
  assert.equal(dinge.lade([...stand, null, ['holz', 1, 'x', 0, 0], ['quatsch', 1, 0, 0, 0, 0]]), 2);
  assert.deepEqual(dinge.zustand(), stand);
  assert.equal(neu, 4); assert.equal(weg, 2);
  dinge.dispose(); assert.equal(dinge.anzahl, 0); assert.equal(weg, 4);
  assert.throws(() => createWeltDinge({}));
});

test('Würfe sind deterministisch', () => {
  const einmal = () => { const { dinge, lauf } = aufbau(); for (let i = 0; i < 5; i++) dinge.wirf('apfel', 1, { x: 0, y: 0, z: 0 }, i); lauf(3); return JSON.stringify(dinge.zustand()); };
  assert.equal(einmal(), einmal());
});
