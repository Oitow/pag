import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEntitaeten } from '../core/entitaeten.js';
import { createBefehle } from './befehle.js';
import { createGegnerLager } from './gegner-lager.js';

test('Wache → Jagd → Biss → Tod → Respawn', () => {
  const ents = createEntitaeten(), befehle = createBefehle({ entitaeten: ents });
  const lager = createGegnerLager({ id: 'l', x: 0, z: 0, ents, befehle, besatzung: { ratte: 5 }, respawn: 30 });
  const schritt = (n, o) => { for (let i = 0; i < n; i++) { lager.fest(1 / 60, o); befehle.update(1 / 60); } };
  schritt(2);
  assert.equal(ents.imUmkreis(0, 0, 20, { team: 'feind' }).length, 5);
  assert.equal(lager.modus, 'ruhe');
  const held = ents.neu({ art: 'spieler', team: 'spieler', pos: { x: 6, z: 0 }, leben: 500 });
  schritt(300);
  assert.equal(lager.modus, 'jagd');
  assert.ok(ents.hole(held).leben < 500, 'gebissen');
  ents.bewege(held, 200, 0, 0); schritt(60);
  assert.notEqual(lager.modus, 'jagd');                 // verloren → heim
  const opfer = [...lager.ids.keys()][0];
  ents.leben(opfer, -999);
  schritt(2);
  assert.equal(ents.hole(opfer), null);
  assert.equal(lager.lebend, 4);
  schritt(60 * 36, { aktiv: false });
  assert.equal(lager.lebend, 5);                         // Respawn nach ~30 s
  assert.notEqual([...lager.ids.keys()].at(-1), opfer);  // neue ID
});
