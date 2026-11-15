import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWelle } from './grosszauber-welle.js';
import { rng } from '../core/rng.js';

const umg = () => ({ boden: () => 0, wasser: () => -Infinity, zufall: rng(5) });
const bau = (kraft = 1.4) => createWelle({ von: { x: 0, y: 0, z: 0 }, yaw: 0, kraft, def: { schaden: 30 } }, umg());

test('Welle rollt in Blickrichtung, bricht, läuft aus und endet', () => {
  const w = bau(), ev = [], melde = (e) => ev.push(e);
  const phasen = new Set(); let n = 0;
  while (w.update(0.05, [], melde) && n++ < 1000) phasen.add(w.daten.phase);
  assert.ok(n < 1000);
  for (const p of ['aufbau', 'rollen', 'brechen', 'flut']) assert.ok(phasen.has(p), p);
  assert.ok(ev.some((e) => e.typ === 'beben') && ev.some((e) => e.typ === 'klang' && e.name === 'rauschen'));
  assert.ok(w.daten.mitte.z > 40, 'Front ist ~45 m+ gelaufen');
  assert.ok(w.daten.breite <= 40 && w.daten.hoehe >= 0);
});

test('Ziele werden mitgerissen (zug, Schaden einmal) und am Ende hochgeworfen', () => {
  const w = bau(), ev = [], melde = (e) => ev.push(e);
  const ziele = [0, 1, 2].map((i) => ({ id: 'z' + i, x: i * 2 - 2, y: 0, z: 25, radius: 0.5, hoehe: 1.8 }));
  for (let i = 0; i < 400; i++) { if (!w.update(0.05, ziele, melde)) break; for (const z of ziele) if (w.zustand().phase === 'rollen') z.z += 0.0; }
  const tr = ev.filter((e) => e.typ === 'treffer').flatMap((e) => e.treffer);
  const z0 = tr.filter((t) => t.id === 'z0');
  assert.equal(z0.filter((t) => t.schaden === 30 * 1.4 && !t.zug === false).length, 1, 'erster Schaden genau einmal');
  assert.ok(z0.some((t) => t.zug && t.zug.z > 0), 'Zug in Laufrichtung');
  assert.ok(z0.some((t) => t.umwerfen && t.stoss.y > 0), 'am Ende hochgeworfen');
  assert.ok(ev.some((e) => e.typ === 'stopp') && ev.some((e) => e.typ === 'meldung' && /×3/.test(e.text)));
});

test('wasser: nur hinter der Front, nach dem Ende nichts', () => {
  const w = bau(), melde = () => {};
  for (let i = 0; i < 40; i++) w.update(0.05, [], melde);
  assert.equal(w.wasser(0, 100), null);
  while (w.zustand().phase !== 'brechen') w.update(0.05, [], melde);
  assert.ok(w.wasser(0, 20) > 0);
  assert.equal(w.wasser(60, 20), null);
  while (w.update(0.05, [], melde));
  assert.equal(w.wasser(0, 20), null);
});
