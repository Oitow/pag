import test from 'node:test';
import assert from 'node:assert/strict';
import { createChunkStrom, createKachelRing } from './chunk-strom.js';

test('chunk-strom: nah fein, fern grob, lückenlos und mit Budget', () => {
  const gebaut = [];
  const s = createChunkStrom({ wurzel: 512, blatt: 64, teilung: 0.6, sicht: 700, budget: 3, baue: (k) => { gebaut.push(k.key); return k; } });
  const l = s.waehle(10, 10);
  const nah = l.find((k) => k.x0 <= 10 && k.x0 + k.groesse > 10 && k.z0 <= 10 && k.z0 + k.groesse > 10);
  assert.equal(nah.groesse, 64);
  assert.ok(l.some((k) => k.groesse >= 256), 'fern gibt es grobe Kacheln');
  // Fläche ohne Überlappung: Summe der Kachelflächen = Fläche der Vereinigung (Stichprobe)
  for (const [x, z] of [[300, -200], [-500, 400], [0, 0]]) assert.equal(l.filter((k) => x >= k.x0 && x < k.x0 + k.groesse && z >= k.z0 && z < k.z0 + k.groesse).length, 1);
  assert.equal(s.update(10, 10).gebaut, 3);
  s.update(10, 10, Infinity);
  assert.ok(s.fertig);
  // Stufenwechsel: alte Kacheln bleiben, bis die neuen darüber fertig sind (keine Löcher)
  s.update(300, 10, 1);
  assert.ok(!s.fertig);
  const gedeckt = (x, z) => [...s.geladen.values()].some(({ k }) => x >= k.x0 && x < k.x0 + k.groesse && z >= k.z0 && z < k.z0 + k.groesse);
  for (let x = -200; x <= 500; x += 37) for (let z = -300; z <= 300; z += 41) assert.ok(gedeckt(x, z), `Loch bei ${x},${z}`);
  s.update(300, 10, Infinity);
  assert.ok(s.fertig && s.anzahl === s.waehle(300, 10).length);
});

test('kachel-ring: lädt nächste zuerst und entlädt hinter dem Rand', () => {
  const da = new Set();
  const r = createKachelRing({ groesse: 64, radius: 100, budget: 1, lade: (k) => da.add(k.key), entlade: (k) => da.delete(k.key) });
  r.update(32, 32); assert.deepEqual([...da], ['0:0']);
  r.update(32, 32, Infinity); const n = da.size; assert.ok(n > 4);
  r.update(5000, 5000, Infinity); assert.ok(!da.has('0:0'));
  assert.ok(da.size > 4);
});
