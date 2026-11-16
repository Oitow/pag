import test from 'node:test';
import assert from 'node:assert/strict';
import { createRiss } from './grosszauber-riss.js';
import { rng } from '../core/rng.js';

const mk = (seed = 1, kraft = 1) => createRiss({ von: { x: 0, y: 0, z: 0 }, punkt: { x: 0, y: 0, z: 20 }, yaw: 0, kraft, def: { schaden: 40, stoss: 14, reichweite: 30 } }, { boden: () => 0, wasser: () => -Infinity, zufall: rng(seed) });
function lauf(r, ziele = [], s = 20) {
  const ev = [];
  for (let t = 0; t < s; t += 0.05) { if (r.update(0.05, ziele, e => ev.push(e)) === false) break; }
  return ev;
}

test('Riss läuft in Blickrichtung, Länge ~30 m, 1–3 Äste', () => {
  const r = mk(); const h = r.daten.risse[0].pkt, e = h[h.length - 1];
  assert.ok(e.z > 22 && e.z < 33 && Math.abs(e.x) < 8, `Ende ${e.x},${e.z}`);
  assert.ok(r.daten.risse.length >= 2 && r.daten.risse.length <= 4);
  assert.ok(Math.hypot(mk(1, 1.6).daten.risse[0].pkt.at(-1).z) <= 48);
});

test('Graben nur im Riss, Rand aufgeworfen, schließt sich', () => {
  const r = mk(); lauf(r, [], 5);
  const p = r.daten.risse[0].pkt[8];
  assert.ok(r.boden(p.x, p.z) <= -1 && r.boden(p.x, p.z) >= -2.6);
  assert.equal(r.boden(30, 0), null);
  const rand = r.boden(p.x + 1.7, p.z);   // Rand liegt je nach Richtung nahe 1.5–2.5 m
  assert.ok(rand === null || rand <= 0.41);
  lauf(r, [], 20);
  assert.equal(r.boden(p.x, p.z), null);
});

test('Ziel an der Spitze wird hochgeworfen, später brennt es', () => {
  const r = mk(); const p = r.daten.risse[0].pkt[6];
  const ev = lauf(r, [{ id: 7, x: p.x + 1, z: p.z, radius: 0.4, hoehe: 1.7 }]);
  const th = ev.filter(e => e.typ === 'treffer').flatMap(e => e.treffer);
  assert.ok(th[0].umwerfen && th[0].stoss.y > 5);
  assert.equal(th.filter(t => t.zustand === 'brennen').length > 0, true);
});

test('Ereignisse, Ausbrüche, Ende', () => {
  const r = mk(); const ev = lauf(r);
  const typen = new Set(ev.map(e => e.typ));
  for (const t of ['beben', 'klang', 'funken', 'ring']) assert.ok(typen.has(t), t);
  assert.ok(ev.some(e => e.typ === 'klang' && e.name === 'zisch'));
  assert.equal(r.update(0.05, [], () => {}), false);
});

test('deterministisch', () => {
  assert.deepEqual(mk(5).daten.risse, mk(5).daten.risse);
});
