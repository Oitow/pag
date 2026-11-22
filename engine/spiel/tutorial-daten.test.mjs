import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUFGABEN_DATEN, NPC_DATEN, ORTS_OPTIONAL } from './tutorial-daten.js';
import { pruefeDaten } from '../gameplay/aufgaben.js';
import { createWeltRegionen } from '../world/welt-regionen.js';
const ORTE = createWeltRegionen({ seed: 1 }).orte;

test('Daten sind gültig und serialisierbar', () => {
  assert.deepEqual(pruefeDaten(AUFGABEN_DATEN), []);
  assert.deepEqual(JSON.parse(JSON.stringify(AUFGABEN_DATEN)), AUFGABEN_DATEN);
});

test('Kette ist lückenlos verkettet, Belohnungen vorhanden', () => {
  const ids = AUFGABEN_DATEN.map((a) => a.id);
  assert.deepEqual(ids, ['erwachen', 'zaehne', 'waldweg', 'hochland', 'moor', 'grauzahn']);
  AUFGABEN_DATEN.forEach((a, i) => { assert.equal(a.danach ?? null, ids[i + 1] ?? null); assert.ok(a.belohnung.xp > 0 && a.belohnung.gegenstaende.length); });
});

test('Orte existieren oder sind optional; Sprech-Ziele sind NPCs', () => {
  const orte = new Set(ORTE.map((o) => o.id));
  for (const a of AUFGABEN_DATEN) for (const s of a.schritte) {
    if (typeof s.ort === 'string') assert.ok(orte.has(s.ort) || ORTS_OPTIONAL.includes(s.ort), s.ort);
    if (s.art === 'sprich-mit') { assert.ok(NPC_DATEN[s.ziel], s.ziel); assert.ok(s.sagt.length >= 2 && s.sagt.length <= 4); assert.ok(orte.has(NPC_DATEN[s.ziel].ort)); }
  }
});
