import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSturm } from './grosszauber-sturm.js';
import { rng } from '../core/rng.js';

const mach = (kraft = 1) => createSturm({ von: { x: 0, y: 0, z: 0 }, punkt: { x: 0, y: 0, z: 10 }, yaw: 0, kraft, def: { schaden: 12, stoss: 8 } }, { boden: () => 0, wasser: () => -Infinity, zufall: rng(5) });
function lauf(s, sek, ziele, ev = []) { for (let t = 0; t < sek; t += 0.05) { if (s.update(0.05, ziele, e => ev.push(e)) === false) return false; } return true; }

test('Phasen, Zug in Blickrichtung, Ende', () => {
  const s = mach(), ev = [];
  lauf(s, 0.5, [], ev); assert.equal(s.daten.phase, 'formen');
  lauf(s, 6, [], ev); assert.equal(s.daten.phase, 'ziehen');
  assert.ok(s.daten.pos.z > 12, 'zieht in +z');
  assert.ok(s.daten.hoehe > 27);
  assert.equal(lauf(s, 20, [], ev), false);
  assert.ok(ev.some(e => e.typ === 'beben') && ev.some(e => e.typ === 'klang' && e.name === 'heulen'));
});

test('Kern hebt hoch, Sog zieht, Ferne bleibt, Blitz trifft', () => {
  const s = mach(), ev = [];
  const kern = { id: 1, x: 0.5, y: 0, z: 10.5, radius: 0.4, hoehe: 1.7 }, sog = { id: 2, x: 0, y: 0, z: 22, radius: 0.4, hoehe: 1.7 }, fern = { id: 3, x: 80, y: 0, z: 0, radius: 0.4, hoehe: 1.7 };
  lauf(s, 4, [kern, sog, fern], ev);
  const t = ev.filter(e => e.typ === 'treffer').flatMap(e => e.treffer);
  assert.ok(t.some(x => x.id === 1 && x.stoss.y > 5 && x.umwerfen));
  assert.ok(t.some(x => x.id === 2 && x.zug && x.schaden === 0));
  assert.ok(!t.some(x => x.id === 3));
  const b = ev.find(e => e.typ === 'blitz');
  assert.ok(b && b.punkte.length >= 3 && b.punkte[0].y > 20);
  assert.ok(ev.some(e => e.typ === 'funken') && ev.some(e => e.typ === 'ring'));
});

test('kraft macht größer und länger', () => {
  const a = mach(1), b = mach(1.5);
  lauf(a, 3, []); lauf(b, 3, []);
  assert.ok(b.daten.hoehe > a.daten.hoehe && b.daten.dauer > a.daten.dauer);
});
