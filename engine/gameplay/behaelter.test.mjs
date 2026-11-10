import test from 'node:test';
import assert from 'node:assert/strict';
import { createBehaelter } from './behaelter.js';
import { createInventar } from './inventar.js';
import { createInteraktion } from './interaktion.js';
import { createRegister } from '../core/register.js';
import { createEreignisse } from '../core/ereignisse.js';

function aufbau() {
  const register = createRegister({ art: 'gegenstand', standard: { stapel: 10 } });
  register.definiereAlle({ holz: {}, gold: {}, schluessel: { stapel: 1 }, axt: { stapel: 1 } });
  const ereignisse = createEreignisse();
  const log = [];
  for (const n of ['behaelter:offen', 'behaelter:zu', 'behaelter:verschlossen']) ereignisse.an(n, (d) => log.push([n, d.wer.name]));
  const kisten = createBehaelter({ register, ereignisse, reichweite: 2 });
  const spieler = { name: 'a', x: 0, z: 0, inventar: createInventar({ plaetze: 4, register }) };
  return { register, ereignisse, log, kisten, spieler };
}

test('neu: Inhalt, Defaults, doppelte id wirft', () => {
  const { kisten } = aufbau();
  const b = kisten.neu('t1', { pos: { x: 1, z: 1 }, inhalt: [{ id: 'gold', anzahl: 5 }] });
  assert.equal(b.name, 'Truhe'); assert.equal(b.verschlossen, false);
  assert.equal(b.inventar.plaetze.length, 12);
  assert.equal(b.inventar.zaehle('gold'), 5);
  assert.equal(kisten.hole('t1'), b); assert.equal(kisten.anzahl, 1); assert.equal(kisten.alle().length, 1);
  assert.throws(() => kisten.neu('t1', {}), /bereits/);
});

test('oeffne/schliesse mit Ereignissen, unbekannt, besetzt', () => {
  const { kisten, spieler, log } = aufbau();
  const andere = { name: 'b', x: 0, z: 0, inventar: createInventar({ plaetze: 1 }) };
  kisten.neu('t1', { pos: { x: 1, z: 0 } });
  kisten.neu('t2', { pos: { x: 0, z: 1 } });
  assert.deepEqual(kisten.oeffne('x', spieler), { ok: false, grund: 'unbekannt' });
  assert.deepEqual(kisten.oeffne('t1', spieler), { ok: true, grund: null });
  assert.equal(kisten.offen(spieler), kisten.hole('t1'));
  assert.equal(kisten.oeffne('t1', andere).grund, 'besetzt');
  assert.equal(kisten.oeffne('t2', spieler).ok, true);   // schließt t1
  assert.equal(kisten.hole('t1').offenFuer, null);
  assert.equal(kisten.schliesse(spieler), true);
  assert.equal(kisten.schliesse(spieler), false);
  assert.equal(kisten.offen(spieler), null);
  assert.deepEqual(log.map((l) => l[0]), ['behaelter:offen', 'behaelter:zu', 'behaelter:offen', 'behaelter:zu']);
});

test('verschlossen: ohne Schlüssel zu, mit Schlüssel dauerhaft offen, Schlüssel bleibt', () => {
  const { kisten, spieler, log } = aufbau();
  const b = kisten.neu('t1', { pos: { x: 1, z: 0 }, schluessel: 'schluessel' });
  assert.equal(b.verschlossen, true);
  assert.equal(kisten.oeffne('t1', spieler).grund, 'verschlossen');
  assert.deepEqual(log, [['behaelter:verschlossen', 'a']]);
  spieler.inventar.gib('schluessel', 1);
  assert.equal(kisten.oeffne('t1', spieler).ok, true);
  assert.equal(b.verschlossen, false);
  assert.equal(spieler.inventar.zaehle('schluessel'), 1);
  kisten.schliesse(spieler);
  spieler.inventar.leere();
  assert.equal(kisten.oeffne('t1', spieler).ok, true);   // bleibt aufgeschlossen
});

test('Entfernung: oeffne -> weit, pruefe schließt automatisch', () => {
  const { kisten, spieler, log } = aufbau();
  kisten.neu('t1', { pos: { x: 1, z: 0 }, radius: 0.5 });
  spieler.x = 10;
  assert.equal(kisten.oeffne('t1', spieler).grund, 'weit');
  spieler.x = 0;
  kisten.oeffne('t1', spieler);
  assert.equal(kisten.pruefe(spieler), kisten.hole('t1'));
  spieler.x = -1.4;                                        // 2.4 <= 2.5
  assert.ok(kisten.pruefe(spieler));
  spieler.x = -2;                                          // 3 > 2.5
  assert.equal(kisten.pruefe(spieler), null);
  assert.equal(kisten.offen(spieler), null);
  assert.equal(log.at(-1)[0], 'behaelter:zu');
  const ohnePos = { name: 'c', inventar: createInventar({ plaetze: 1 }) };
  assert.equal(kisten.oeffne('t1', ohnePos).ok, true);
});

test('lege/nimm/nimmAlles', () => {
  const { kisten, spieler } = aufbau();
  const b = kisten.neu('t1', { pos: { x: 1, z: 0 }, plaetze: 2, inhalt: [{ id: 'gold', anzahl: 4 }] });
  assert.equal(kisten.lege(spieler, 0), 0);                // nichts offen
  assert.equal(kisten.nimm(spieler, 0), 0);
  kisten.oeffne('t1', spieler);
  spieler.inventar.gib('holz', 6);
  assert.equal(kisten.lege(spieler, 0, 2), 2);
  assert.equal(b.inventar.zaehle('holz'), 2); assert.equal(spieler.inventar.zaehle('holz'), 4);
  assert.equal(kisten.nimm(spieler, 0, 1), 1);
  assert.equal(spieler.inventar.zaehle('gold'), 1);
  assert.equal(kisten.nimmAlles(spieler), 5);
  assert.equal(b.inventar.frei(), 2);
  assert.equal(spieler.inventar.zaehle('gold'), 4); assert.equal(spieler.inventar.zaehle('holz'), 6);
});

test('nimmAlles: nur was passt', () => {
  const { kisten, spieler } = aufbau();
  const b = kisten.neu('t1', { pos: { x: 0, z: 0 }, inhalt: [{ id: 'axt', anzahl: 1 }, { id: 'axt', anzahl: 1 }, { id: 'axt', anzahl: 1 }] });
  spieler.inventar.gib('holz', 20);                        // 2 Plätze belegt, 2 frei
  kisten.oeffne('t1', spieler);
  assert.equal(kisten.nimmAlles(spieler), 2);
  assert.equal(b.inventar.zaehle('axt'), 1);
});

test('Interaktion: Ziel wird gemeldet, löst oeffne aus, entferne meldet ab', () => {
  const register = createRegister({ art: 'gegenstand', standard: { stapel: 10 } });
  register.definiere('gold', {});
  const ia = createInteraktion({ reichweite: 2 });
  const kisten = createBehaelter({ register, interaktion: ia });
  const spieler = { x: 0, z: 0, inventar: createInventar({ plaetze: 1, register }) };
  kisten.neu('t1', { pos: { x: 1, z: 0 }, name: 'Fass', inhalt: [{ id: 'gold', anzahl: 3 }] });
  assert.ok(ia.hat('behaelter:t1'));
  assert.equal(ia.hole('behaelter:t1').text, 'Fass öffnen');
  ia.aktualisiere();
  const z = ia.beste(spieler);
  assert.equal(z.art, 'behaelter');
  ia.ausloesen(spieler, z);
  assert.equal(kisten.offen(spieler).id, 't1');
  const inhalt = kisten.entferne('t1');
  assert.deepEqual(inhalt, [{ id: 'gold', anzahl: 3 }]);
  assert.equal(ia.hat('behaelter:t1'), false);
  assert.equal(kisten.offen(spieler), null);
  assert.equal(kisten.anzahl, 0);
  assert.deepEqual(kisten.entferne('t1'), []);
});

test('zustand/lade: Rundreise über JSON, Schloss, unbekannte ids', () => {
  const { kisten, spieler } = aufbau();
  kisten.neu('t1', { pos: { x: 1, z: 0 }, schluessel: 'schluessel', inhalt: [{ id: 'axt', anzahl: 1, daten: { haltbarkeit: 3 } }, { id: 'gold', anzahl: 7 }] });
  kisten.neu('t2', { pos: { x: 5, z: 0 } });
  const stand = JSON.parse(JSON.stringify(kisten.zustand()));
  assert.equal(stand.t1.zu, true);

  const k2 = createBehaelter({ register: aufbau().register });
  k2.neu('t1', { pos: { x: 1, z: 0 }, schluessel: 'schluessel' });
  k2.neu('t3', { pos: { x: 9, z: 0 }, inhalt: [{ id: 'gold', anzahl: 1 }] });
  k2.lade({ ...stand, unbekannt: { inv: { plaetze: [] }, zu: false } });
  assert.equal(k2.hole('t1').inventar.zaehle('gold'), 7);
  assert.deepEqual(k2.hole('t1').inventar.plaetze[0].daten, { haltbarkeit: 3 });
  assert.equal(k2.hole('t1').verschlossen, true);
  assert.equal(k2.hole('t3').inventar.zaehle('gold'), 1);  // fehlende bleiben
  assert.equal(k2.anzahl, 2);

  const offenStand = JSON.parse(JSON.stringify({ t1: { inv: stand.t1.inv, zu: false } }));
  k2.lade(offenStand);
  assert.equal(k2.hole('t1').verschlossen, false);
  const wer = { x: 0, z: 0, inventar: spieler.inventar };
  k2.oeffne('t1', wer);
  k2.lade(stand);                                          // offen bleibt offen
  assert.equal(k2.offen(wer).id, 't1');
});

test('dispose: schließt, meldet ab, leert', () => {
  const ia = createInteraktion();
  const kisten = createBehaelter({ interaktion: ia });
  const wer = { x: 0, z: 0, inventar: createInventar({ plaetze: 1 }) };
  kisten.neu('t1', { pos: { x: 0, z: 0 } });
  kisten.oeffne('t1', wer);
  kisten.dispose();
  assert.equal(kisten.anzahl, 0);
  assert.equal(ia.hat('behaelter:t1'), false);
  assert.equal(kisten.offen(wer), null);
});
