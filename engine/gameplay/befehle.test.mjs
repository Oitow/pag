import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEntitaeten } from '../core/entitaeten.js';
import { createBefehle } from './befehle.js';

function welt() {
  const ents = createEntitaeten();
  ents.neu({ art: 'spieler', team: 'spieler', leben: 100, daten: { werte: { krit: 0.5 } } });
  ents.neu({ art: 'gegner', team: 'feind', pos: { x: 5, z: 0 }, leben: 300, daten: { werte: { ruestung: 50 } } });
  return { ents, b: createBefehle({ entitaeten: ents, seed: 3 }) };
}

test('Warteschlange, Prüfer (Reichweite, Abklingzeit, tot), Rüstung', () => {
  const { ents, b } = welt();
  b.sende({ von: 's:1', art: 'schaden', daten: { ziel: 'g:2', menge: 30, krit: false } });
  assert.equal(ents.hole('g:2').leben, 300);                     // erst beim Takt
  const [e] = b.update(1 / 20);
  assert.equal(e.ok, true); assert.equal(e.menge, 20);            // 30 * (1 - 50/150)
  assert.equal(b.fuehre({ von: 's:1', art: 'schaden', daten: { ziel: 'g:2', menge: 5, reichweite: 2 } }).grund, 'zu weit');
  const k = { von: 's:1', art: 'schaden', daten: { ziel: 'g:2', menge: 5, abklingzeit: 1, faehigkeit: 'blitz' } };
  assert.equal(b.fuehre(k).ok, true);
  assert.equal(b.fuehre(k).grund, 'abklingzeit');
  for (let i = 0; i < 21; i++) b.update(0.05);
  assert.equal(b.fuehre(k).ok, true);
  assert.equal(b.fuehre({ von: 's:1', art: 'bewegen', daten: { x: 500, z: 0 } }).grund, 'zu weit');
  const ia = { von: 's:1', art: 'interagieren', daten: { ziel: 'g:2' } };
  assert.equal(b.fuehre(ia).grund, 'zu weit');
  assert.equal(b.fuehre({ von: 's:1', art: 'bewegen', daten: { x: 3, z: 0 } }).ok, true);
  assert.equal(b.fuehre(ia).ok, true);
});

test('Nachspielen: gleiche Befehle → gleiches Ergebnis', () => {
  const a = welt();
  for (let i = 0; i < 12; i++) { a.b.sende({ von: 's:1', art: 'schaden', daten: { ziel: 'g:2', menge: 9 } }); a.b.update(1 / 20); }
  a.b.fuehre({ von: 'g:2', art: 'heilen', daten: { ziel: 'g:2', menge: 7 } });
  const c = welt();
  c.b.nachspielen(a.b.protokoll);
  assert.deepEqual(c.ents.zustand(), a.ents.zustand());
});
