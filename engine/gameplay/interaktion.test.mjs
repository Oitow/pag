import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInteraktion } from './interaktion.js';

const wer0 = (extra = {}) => ({ x: 0, z: 0, ...extra });

test('nächstes Ziel gewinnt, prio schlägt Abstand', () => {
  const ia = createInteraktion();
  ia.melde('fern', { pos: { x: 0, z: 2 } });
  ia.melde('nah', { pos: { x: 0, z: 1 } });
  assert.equal(ia.beste(wer0()).id, 'nah');
  ia.melde('wichtig', { pos: { x: 0, z: 2 }, prio: 5 });
  assert.equal(ia.beste(wer0()).id, 'wichtig');
  assert.deepEqual(ia.inReichweite(wer0()).map(z => z.id), ['wichtig', 'nah', 'fern']);
  assert.equal(ia.anzahl, 3);
  assert.equal(ia.beste(wer0(), { filter: z => z.id === 'fern' }).id, 'fern');
  assert.equal(ia.beste({ x: 50, z: 50 }), null);
});

test('Blickrichtung: hinter dem Rücken ignoriert, sehr nah zählt immer', () => {
  const ia = createInteraktion();
  ia.melde('hinten', { pos: { x: 0, z: -2 } });
  assert.equal(ia.beste(wer0({ yaw: 0 })), null);                    // Blick +z, Ziel bei −z
  assert.equal(ia.beste(wer0({ yaw: Math.PI })).id, 'hinten');
  assert.equal(ia.beste(wer0()).id, 'hinten');                       // ohne yaw egal
  ia.melde('dicht', { pos: { x: 0, z: -1 }, radius: 0.4 });          // Rand 0.6 ≤ nahImmer
  assert.equal(ia.beste(wer0({ yaw: 0 })).id, 'dicht');
});

test('Radius großer Ziele zählt: Baumstamm', () => {
  const ia = createInteraktion();
  ia.melde('baum', { pos: { x: 3, z: 0 }, radius: 1 });
  assert.equal(ia.beste(wer0()).id, 'baum');                         // Rand 2 m ≤ 2.5
  assert.equal(ia.beste({ x: -1, z: 0 }), null);                     // Rand 3 m
  ia.entferne('baum');
  ia.melde('klein', { pos: { x: 3, z: 0 }, radius: 0.1, reichweite: 3 });
  assert.equal(ia.beste(wer0()).id, 'klein');                        // Rand 2.9, eigene Reichweite 3
  assert.equal(ia.beste(wer0(), { reichweite: 1 }), null);
});

test('Höhen-Toleranz', () => {
  const ia = createInteraktion({ hoehenToleranz: 2 });
  ia.melde('oben', { pos: { x: 1, y: 10, z: 0 } });
  assert.equal(ia.beste(wer0({ y: 0 })), null);
  assert.equal(ia.beste(wer0({ y: 9 })).id, 'oben');
  assert.equal(ia.beste(wer0()).id, 'oben');                         // wer ohne y
  ia.melde('egal', { pos: { x: 1, z: 0 } });                         // Ziel ohne y
  assert.equal(ia.beste(wer0({ y: 0 })).id, 'egal');
});

test('aktiv als Funktion', () => {
  const ia = createInteraktion();
  let offen = false;
  ia.melde('tuer', { pos: { x: 1, z: 0 }, aktiv: (wer, ziel) => !offen && ziel.id === 'tuer' });
  assert.equal(ia.beste(wer0()).id, 'tuer');
  offen = true;
  assert.equal(ia.beste(wer0()), null);
  assert.equal(ia.ausloesen(wer0(), ia.hole('tuer')), false);
  ia.melde('aus', { pos: { x: 1, z: 0 }, aktiv: false });
  assert.equal(ia.beste(wer0()), null);
});

test('Funktions-pos und aktualisiere(), bewege()', () => {
  const ia = createInteraktion();
  const npc = { x: 30, z: 30 };
  ia.melde('npc', { pos: () => ({ x: npc.x, z: npc.z }) });
  assert.equal(ia.beste(wer0()), null);
  npc.x = 1; npc.z = 0;
  assert.equal(ia.beste(wer0()), null);                              // noch nicht nachgeführt
  ia.aktualisiere();
  assert.equal(ia.beste(wer0()).id, 'npc');
  ia.melde('stein', { pos: { x: 40, z: 40 } });
  ia.bewege('stein', 0, 1);
  assert.equal(ia.hole('stein').z, 1);
  assert.equal(ia.beste(wer0(), { filter: z => z.id === 'stein' }).id, 'stein');
});

test('Aktion entfernt eigenes Ziel, Ereignis wird gesendet', () => {
  const gesendet = [];
  const ia = createInteraktion({ ereignisse: { sende(name, daten) { gesendet.push([name, daten]); } } });
  ia.melde('pilz', { pos: { x: 1, z: 0 }, aktion: (wer, ziel) => { ia.entferne(ziel.id); return 'ok'; } });
  const wer = wer0();
  assert.equal(ia.ausloesen(wer), 'ok');
  assert.equal(ia.hat('pilz'), false);
  assert.equal(ia.beste(wer), null);
  assert.equal(gesendet.length, 1);
  assert.equal(gesendet[0][0], 'interaktion');
  assert.equal(gesendet[0][1].ziel.id, 'pilz');
  assert.equal(gesendet[0][1].wer, wer);
  assert.equal(gesendet[0][1].ergebnis, 'ok');
  assert.equal(ia.ausloesen(wer), false);                            // kein Ziel mehr
  ia.melde('stumm', { pos: { x: 1, z: 0 }, aktion: () => {} });
  assert.equal(ia.ausloesen(wer), true);                             // undefined → true
});

test('halte() mit dauer: Fortschritt, Abbruch, genau einmal', () => {
  const ia = createInteraktion();
  let n = 0;
  ia.melde('baum', { pos: { x: 1, z: 0 }, dauer: 2, aktion: () => { n++; } });
  const wer = wer0();
  let r = ia.halte(wer, 0.5, true);
  assert.equal(r.anteil, 0.25);
  assert.equal(r.ziel.id, 'baum');
  assert.equal(r.fertig, false);
  const objekt = r;
  r = ia.halte(wer, 0.5, true);
  assert.equal(r.anteil, 0.5);
  r = ia.halte(wer, 0.1, false);                                     // losgelassen → zurück
  assert.equal(r.anteil, 0);
  r = ia.halte(wer, 1, true);
  assert.equal(r.anteil, 0.5);
  r = ia.halte(wer, 1, true);
  assert.equal(r.anteil, 1);
  assert.equal(r.fertig, true);
  assert.equal(n, 1);
  assert.equal(r, objekt);                                           // Objekt wiederverwendet
  r = ia.halte(wer, 1, true);                                        // weiter gedrückt → nichts mehr
  assert.equal(r.fertig, false);
  assert.equal(r.anteil, 0);
  ia.halte(wer, 1, false);
  r = ia.halte(wer, 3, true);                                        // nach Loslassen wieder möglich
  assert.equal(r.fertig, true);
  assert.equal(n, 2);
});

test('halte(): Zielwechsel setzt zurück, mehrere Figuren getrennt', () => {
  const ia = createInteraktion();
  ia.melde('a', { pos: { x: 1, z: 0 }, dauer: 2 });
  ia.melde('b', { pos: { x: 20, z: 0 }, dauer: 2 });
  const w1 = wer0(), w2 = { x: 20, z: 1 };
  assert.equal(ia.halte(w1, 1, true).anteil, 0.5);
  assert.equal(ia.halte(w2, 0.5, true).anteil, 0.25);
  assert.equal(ia.halte(w1, 0.5, true).anteil, 0.75);
  w1.x = 20; w1.z = 0;                                               // jetzt Ziel b
  assert.equal(ia.halte(w1, 0.5, true).anteil, 0.25);
});

test('halte() ohne dauer: löst auf der Flanke aus', () => {
  const ia = createInteraktion();
  let n = 0;
  ia.melde('kiste', { pos: { x: 1, z: 0 }, aktion: () => { n++; } });
  const wer = wer0();
  assert.equal(ia.halte(wer, 0.016, false).fertig, false);
  assert.equal(ia.halte(wer, 0.016, true).fertig, true);
  assert.equal(n, 1);
  assert.equal(ia.halte(wer, 0.016, true).fertig, false);            // gehalten: nichts
  assert.equal(n, 1);
  ia.halte(wer, 0.016, false);
  assert.equal(ia.halte(wer, 0.016, true).fertig, true);
  assert.equal(n, 2);
});

test('dispose leert alles', () => {
  const ia = createInteraktion();
  ia.melde('a', { pos: { x: 1, z: 0 } });
  ia.dispose();
  assert.equal(ia.anzahl, 0);
});
