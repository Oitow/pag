import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from './worldgen/worldgen.js';
import { createWeltAdapter } from './worldgen/worldgen-adapter.js';
import { createTerrainMesh } from './terrain-mesh.js';
import { createScatterMesh } from './scatter-mesh.js';

const welt = createWorld({ preset: 'insel', seed: 3, breite: 96, tiefe: 96, qualitaet: 'schnell' });
const adapter = createWeltAdapter(welt, { hoehenSkala: 40, meterProZelle: 2 });

test('Gelände: Vertices liegen auf der Bodenhöhe, Farben endlich', () => {
  const g = createTerrainMesh(adapter);
  const pos = g.boden.geometry.attributes.position.array;
  assert.equal(pos.length / 3, 96 * 96);
  for (const k of [0, 500, 4321, 96 * 96 - 1]) {
    const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
    assert.ok(Math.abs(adapter.bodenHoehe(x, z) - y) < 1e-3, `Vertex ${k}`);
  }
  for (const v of g.boden.geometry.attributes.color.array) assert.ok(Number.isFinite(v) && v >= 0);
  assert.ok(g.meer && g.gruppe.children.length >= 2);
  const halb = createTerrainMesh(adapter, { schritt: 2 });
  assert.equal(halb.boden.geometry.attributes.position.count, 48 * 48);
  g.dispose(); halb.dispose();
});

test('Gelände ohne Wasser (wasser: false): nur Boden und Meeresgrund', () => {
  const g = createTerrainMesh(adapter, { wasser: false });
  assert.equal(g.wasser, null); assert.equal(g.meer, null);
  assert.deepEqual(g.gruppe.children.map(o => o.name).sort(), ['boden', 'meeresgrund']);
  g.dispose();
});

test('Objekte: Instanzen je Typ, Anzahl passt', () => {
  const s = createScatterMesh(adapter);
  assert.ok(s.anzahl > 0 && s.anzahl <= welt.objekte.anzahl);
  let summe = 0;
  s.gruppe.children.forEach(m => { assert.ok(m.isInstancedMesh); summe += m.count; });
  assert.equal(summe, s.anzahl);
  s.dispose();
});
