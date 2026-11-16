import test from 'node:test';
import assert from 'node:assert/strict';
import { createWand } from './grosszauber-wand.js';
import { rng } from '../core/rng.js';

const umg = () => ({ boden: () => 0, wasser: () => -Infinity, zufall: rng(5) });
const mach = (kraft = 1) => createWand({ von: { x: 0, y: 0, z: 0 }, punkt: { x: 0, y: 0, z: 8 }, yaw: 0, kraft, def: { schaden: 25, stoss: 10, umwerfen: true } }, umg());
const lauf = (w, sek, ziele = [], ev = []) => { for (let t = 0; t < sek; t += 0.05) w.update(0.05, ziele, (e) => ev.push(e)); return ev; };

test('Wand steigt, drückt Wesen heraus und trägt Ziele hoch', () => {
  const w = mach(), ziel = { id: 'a', x: 0.3, y: 0, z: 8, radius: 0.4, hoehe: 1.8 }, ev = [];
  lauf(w, 1.5, [ziel], ev);
  assert.equal(w.daten.phase, 'steht');
  const t = ev.find((e) => e.typ === 'treffer');
  assert.ok(t && t.treffer[0].stoss.y > 5 && t.treffer[0].umwerfen);
  const p = w.hindernis(0, 8.1, 0.4);
  assert.ok(p && Math.hypot(p.x, p.z) > 0.4);
  assert.equal(w.hindernis(0, 3, 0.4), null);
  assert.ok(w.boden(0, 8) > 3);
  assert.ok(ev.some((e) => e.typ === 'beben') && ev.some((e) => e.typ === 'klang' && e.name === 'grollen'));
});

test('Hohe Kraft ergibt geschlossenen Ring um den Zaubernden', () => {
  const w = mach(1.6); lauf(w, 1.5);
  assert.ok(w.daten.ring && w.daten.segmente.length > 20);
  for (let a = 0; a < 6.28; a += 0.4) assert.ok(w.hindernis(9 * Math.sin(a), 9 * Math.cos(a), 0.4), 'Lücke bei ' + a);
  assert.equal(w.hindernis(0, 0, 0.4), null);
});

test('Zerfall gibt den Weg frei und beendet die Wirkung', () => {
  const w = mach(1); lauf(w, 1.5);
  assert.ok(w.hindernis(0, 8.1, 0.4));
  let weiter = true; for (let t = 0; t < 30 && weiter; t += 0.05) weiter = w.update(0.05, [], () => {});
  assert.equal(weiter, false);
  assert.equal(w.hindernis(0, 8.1, 0.4), null);
  assert.equal(w.boden(0, 8), null);
});
