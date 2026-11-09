import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from './worldgen/worldgen.js';
import { createWeltAdapter } from './worldgen/worldgen-adapter.js';
import { createWaterMesh } from './water-mesh.js';

const welt = createWorld({ preset: 'insel', seed: 3, breite: 96, tiefe: 96, qualitaet: 'schnell' });
const adapter = createWeltAdapter(welt, { hoehenSkala: 40, meterProZelle: 2 });

test('Wasser: Netz mit Attributen, Spiegel passt zum Adapter, Ring bis zum Horizont', () => {
  const w = createWaterMesh({ adapter });
  const g = w.mesh.geometry, pos = g.attributes.position.array;
  for (const n of ['aTiefe', 'aUfer', 'aWelle', 'aStroem']) assert.ok(g.attributes[n], n);
  assert.equal(g.attributes.aStroem.itemSize, 2);
  assert.ok(g.index.count > 0 && g.index.count % 3 === 0);
  let weit = 0;
  for (let k = 0; k < pos.length / 3; k++) {
    const x = pos[k * 3], y = pos[k * 3 + 1], z = pos[k * 3 + 2];
    assert.ok(Number.isFinite(x + y + z));
    if (Math.abs(x) > adapter.groesse.x) { weit++; continue; }
    const h = adapter.wasserHoehe(x, z);
    if (h !== null && g.attributes.aTiefe.array[k] > 0.5) assert.ok(Math.abs(h + 0.04 - y) < 0.5, `Vertex ${k}`);
  }
  assert.ok(weit > 0, 'Meeresring vorhanden');
  for (const v of g.attributes.aTiefe.array) assert.ok(v >= 0);
  w.dispose();
});

test('Wasser: update, setSonne, setHimmel, ohne Meer', () => {
  const w = createWaterMesh({ adapter, meer: false, schritt: 2 });
  w.update(0.5); w.update(0.25);
  assert.ok(Math.abs(w.uniforms.uZeit.value - 0.75) < 1e-9);
  w.setSonne({ x: 0, y: 1, z: 0 }, 0xff8800);
  assert.ok(Math.abs(w.uniforms.uSonneRichtung.value.y - 1) < 1e-9);
  w.setHimmel(0x112233);
  assert.ok(w.uniforms.uHimmel.value.getHex() === 0x112233);
  const pos = w.mesh.geometry.attributes.position.array;
  for (let k = 0; k < pos.length; k += 3) assert.ok(Math.abs(pos[k]) <= adapter.groesse.x);
  assert.equal(w.gitter.nx, 48);
  w.dispose();
  assert.throws(() => createWaterMesh({}));
});
