import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEntitaeten } from './entitaeten.js';
import { createEreignisse } from './ereignisse.js';

test('stabile IDs, Umkreis, Leben → treffer/tod', () => {
  const ev = createEreignisse(), log = [];
  for (const n of ['ent:neu', 'ent:treffer', 'ent:tod', 'ent:weg']) ev.an(n, () => log.push(n));
  const a = createEntitaeten({ ereignisse: ev }), b = createEntitaeten();
  const ids = [a.neu({ art: 'spieler', team: 'spieler' }), a.neu({ art: 'gegner', team: 'feind', pos: { x: 3, z: 0 }, leben: 10 })];
  assert.deepEqual(ids, ['s:1', 'g:2']);
  assert.deepEqual([b.neu({ art: 'spieler' }), b.neu({ art: 'gegner' })], ids);     // deterministisch
  assert.deepEqual(a.imUmkreis(0, 0, 5, { team: 'feind' }).map((e) => e.id), ['g:2']);
  assert.equal(a.leben('g:2', -15, { quelle: 's:1' }), 10);
  assert.equal(a.hole('g:2').lebt, false);
  assert.equal(a.imUmkreis(0, 0, 5, { team: 'feind' }).length, 0);
  a.entferne('g:2');
  assert.deepEqual(log, ['ent:neu', 'ent:neu', 'ent:treffer', 'ent:tod', 'ent:weg']);
});

test('aenderungenSeit + zustand/lade', () => {
  const a = createEntitaeten();
  const s = a.neu({ art: 'spieler' }), g = a.neu({ art: 'gegner', leben: 5 });
  const t0 = a.takt;
  assert.equal(a.bewege(s, 0.001, 0, 0), false);              // < 1 cm zählt nicht
  a.bewege(s, 4, 0, 2); a.entferne(g);
  const d = a.aenderungenSeit(t0);
  assert.deepEqual(d.geaendert.map((k) => k[0]), [s]);
  assert.deepEqual(d.weg, [g]);
  const b = createEntitaeten(); b.lade(JSON.parse(JSON.stringify(a.zustand())));
  assert.equal(b.hole(s).pos.x, 4);
  assert.equal(b.neu({ art: 'gegner' }), 'g:3');               // Zähler läuft weiter
});
