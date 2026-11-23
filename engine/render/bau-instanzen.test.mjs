import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBauInstanzen } from './bau-instanzen.js';
import { createKollisionsWelt } from '../world/kollision.js';
import { createHaus } from '../models/bau/haus.js';
import { createLaterne } from '../models/bau/licht.js';

const adapter = { bodenHoehe: () => 0, wasserHoehe: () => null, hindernisse: () => null };
const fabriken = { haus: ({ seed, variante }) => createHaus({ seed, variante }), laterne: ({ seed }) => createLaterne({ seed }) };
const teile = [
  { id: 'a', typ: 'haus', variante: 0, x: 20, z: 10, winkel: Math.PI / 2, y: 1 },
  { id: 'b', typ: 'haus', variante: 0, x: -5, z: 3, winkel: 0, y: 0 },
  { id: 'c', typ: 'laterne', variante: 0, x: 0, z: 0, winkel: 0, y: 0 },
];

test('eine Instanzgruppe je typ#variante, Lichter und Anker in Welt', () => {
  const bau = createBauInstanzen({ teile, fabriken });
  const ms = bau.gruppe.children.filter((c) => c.isInstancedMesh);
  assert.equal(ms.length, 2);
  assert.equal(ms.find((m) => m.name === 'haus#0').count, 2);
  assert.equal(bau.assets.length, 2);
  assert.ok(bau.lichter.some((l) => l.x === 0 && l.z === 0));
  const tuer = bau.anker.find((a) => a.teilId === 'a' && a.art === 'tuer');
  const d = bau.assets[0].anker.tuer;   // winkel π/2: lokal +z zeigt nach +x
  assert.ok(Math.abs(tuer.x - (20 + d.z)) < 1e-9 && Math.abs(tuer.z - 10) < 1e-9);
  bau.dispose();
});

test('Kollisionskörper an gedrehter Weltposition, dispose entfernt sie', () => {
  const kollision = createKollisionsWelt({ welt: adapter });
  const bau = createBauInstanzen({ teile, fabriken, kollision });
  assert.ok(bau.koerperIds.length > 0 && kollision.anzahl === bau.koerperIds.length);
  const k = bau.assets[0].kollision.find((q) => q.form === 'kasten');
  const w = Math.PI / 2, lx = k.x, lz = k.z;
  const ex = 20 + lx * Math.cos(w) + lz * Math.sin(w), ez = 10 - lx * Math.sin(w) + lz * Math.cos(w);
  const c = kollision.hole(bau.koerperIds[0]);
  const e = c;
  assert.ok(Math.abs(e.x - ex) < 1e-9 && Math.abs(e.z - ez) < 1e-9, `${e.x},${e.z} vs ${ex},${ez}`);
  assert.ok(Math.abs(e.y0 - (k.y0 + 1)) < 1e-9);
  bau.dispose();
  assert.equal(kollision.anzahl, 0);
});
