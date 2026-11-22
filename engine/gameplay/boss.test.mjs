import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEntitaeten } from '../core/entitaeten.js';
import { createBefehle } from './befehle.js';
import { createBoss } from './boss.js';

function aufbau(leben = 1000) {
  const ents = createEntitaeten(), befehle = createBefehle({ entitaeten: ents });
  const entId = ents.neu({ art: 'gegner', team: 'feind', pos: { x: 0, y: 0, z: 0 }, radius: 0.8, leben });
  const w = { entId, x: 0, y: 0, z: 0, yaw: 0, skala: 2.2, phase: 0, hub: 0, ton: 1, zustand: 'lauf', t: 0, leben, lebenMax: leben, tot: false };
  const spieler = ents.neu({ art: 'spieler', team: 'spieler', pos: { x: 12, y: 0, z: 0 }, radius: 0.35, leben: 1000 });
  const log = { sende: [], ruf: [] };
  const boss = createBoss({ wesen: w, ents, befehle, x: 0, z: 0, schaden: 20, sende: (n, d) => log.sende.push([n, d]), ruf: (...a) => log.ruf.push(a) });
  const schritt = (s, ziel) => { for (let i = 0; i < s * 60; i++) { boss.fest(1 / 60, ziel === undefined ? ents.hole(spieler) : ziel); befehle.update(1 / 60); } };
  return { ents, w, spieler, boss, log, schritt, entId };
}

test('Sprung-Schlag: Warn-Ring 1.2 s vor dem Einschlag, dann Schaden im Radius', () => {
  const { ents, spieler, log, schritt } = aufbau();
  schritt(1.2);
  const warn = log.sende.find(([n]) => n === 'gegner:warnung');
  assert.ok(warn && warn[1].dauer === 1.2 && warn[1].radius > 3, 'Warnung gesendet');
  assert.equal(ents.hole(spieler).leben, 1000, 'noch kein Schaden während der Warnung');
  schritt(2);
  assert.ok(ents.hole(spieler).leben < 1000, 'Treffer nach dem Sprung');
});

test('Prankenhieb ist ein Kegel: nur wer vorn steht, wird getroffen', () => {
  const v = aufbau();
  v.ents.bewege(v.spieler, 2.5, 0, 0); v.schritt(2);
  assert.ok(v.ents.hole(v.spieler).leben < 1000, 'Ziel vor dem Boss getroffen');
  const h = aufbau();
  h.ents.bewege(h.spieler, 2.5, 0, 0); h.schritt(1.0);          // Boss holt aus (Blick nach +x)
  assert.equal(h.boss.modus, 'hiebWarn');
  h.ents.bewege(h.spieler, -2.5, 0, 0); h.schritt(1.0);
  assert.equal(h.ents.hole(h.spieler).leben, 1000, 'hinter dem Boss kein Treffer');
});

test('Phasen: unter 60 % ruft das Heulen 4 Wölfe (einmal), unter 30 % rasend', () => {
  const { ents, entId, log, schritt, boss, w } = aufbau();
  schritt(0.1);
  ents.leben(entId, -450);                             // 55 %
  schritt(3);
  assert.equal(boss.phase, 1);
  assert.deepEqual(log.ruf.map((r) => [r[0], r[1]]), [['wolf', 4]]);
  ents.leben(entId, -300);                             // 25 %
  schritt(0.5);
  assert.equal(boss.phase, 2);
  assert.ok(w.ton > 1);
  assert.equal(log.ruf.length, 1, 'Heulen nur einmal');
  assert.deepEqual(log.sende.filter(([n]) => n === 'gegner:boss').map(([, d]) => d.phase), [0, 1, 2]);
});

test('Leine: flieht der Spieler, setzt der Boss zurück und heilt', () => {
  const { ents, entId, spieler, w, log, schritt, boss } = aufbau();
  schritt(0.1);
  ents.leben(entId, -300);
  w.x = 20;
  ents.bewege(spieler, 300, 0, 0);
  schritt(1);
  assert.equal(boss.modus, 'zurueck');
  assert.ok(log.sende.some(([n, d]) => n === 'gegner:boss' && d.phase === -1));
  schritt(8, null);
  assert.equal(boss.modus, 'ruhe');
  assert.equal(ents.hole(entId).leben, 1000);
});
