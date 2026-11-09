import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWorld } from './worldgen/worldgen.js';
import { createWeltAdapter } from './worldgen/worldgen-adapter.js';
import { createChunkGenerator } from './worldgen/worldgen-chunks.js';
import { createChunkAdapter } from './chunk-adapter.js';
import { createTerrainChunks } from './terrain-chunks.js';

function kamera(x, y, z, zu = [x + 1, y - 0.5, z]) {
  const k = new THREE.PerspectiveCamera(60, 1, 0.1, 3000);
  k.position.set(x, y, z); k.lookAt(...zu); k.updateMatrixWorld();
  return k;
}

test('Endliche Welt: Kacheln mit LOD, Culling, Objekte nur nah, dispose', () => {
  const welt = createWorld({ preset: 'insel', seed: 3, breite: 128, tiefe: 128, qualitaet: 'schnell' });
  const adapter = createWeltAdapter(welt, { hoehenSkala: 40, meterProZelle: 2 });
  const g = createTerrainChunks({ adapter, kachel: 16, sichtweite: 400 });
  const k = kamera(0, 30, 0);
  g.vorladen(k);
  const d = g.debug();
  assert.equal(d.kacheln, 64, 'ganze 128er-Karte in 16er-Kacheln');
  assert.equal(d.warteschlange, 0);
  assert.ok(d.sichtbar > 0 && d.sichtbar < d.kacheln, 'Frustum blendet Kacheln hinter der Kamera aus');
  assert.ok(d.lod[0] > 0 && d.lod.slice(1).some(n => n > 0), 'mehrere LOD-Stufen');
  assert.ok(d.dreiecke > 0 && d.drawCalls >= d.sichtbar);
  assert.ok(d.objekte > 0 && d.objekte < welt.objekte.anzahl, 'Objekte nur in nahen Kacheln');
  const kachel = g.gruppe.children.find(c => c.isMesh);
  assert.ok(kachel.geometry.index && kachel.geometry.boundingSphere.radius > 0);
  g.dispose();
  assert.equal(g.gruppe.children.length, 0);
});

test('Unendlich: Streaming mit Budget, Kamera wandert, alte Kacheln verschwinden', () => {
  const gen = createChunkGenerator({ preset: 'unendlich', seed: 5 });
  const adapter = createChunkAdapter(gen, { hoehenSkala: 60, meterProZelle: 2, kachel: 32 });
  const g = createTerrainChunks({ adapter, sichtweite: 500, budgetMs: 2 });
  const k = kamera(0, 80, 0);
  g.update(k);
  const erst = g.debug();
  assert.ok(erst.kacheln > 0 && erst.warteschlange > 0, 'nicht alles in einem Frame');
  g.vorladen(k, 20000);
  const voll = g.debug();
  assert.equal(voll.warteschlange, 0);
  assert.ok(voll.lod[3] > 0 && voll.objekte > 0);
  k.position.set(3000, 80, 0); k.updateMatrixWorld();
  g.vorladen(k, 20000);
  const weg = g.debug();
  assert.ok(Math.abs(weg.kacheln - voll.kacheln) < voll.kacheln * 0.3, 'Kachelzahl bleibt etwa gleich');
  for (const c of g.gruppe.children) if (c.isMesh) assert.ok(c.geometry.boundingBox.min.x > 2000);
  g.dispose(); adapter.dispose();
});
