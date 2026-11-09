import test from 'node:test';
import assert from 'node:assert/strict';
import { createChunkGenerator } from './worldgen/worldgen-chunks.js';
import { createChunkAdapter } from './chunk-adapter.js';

const gen = createChunkGenerator({ preset: 'unendlich', seed: 5 });
const ad = createChunkAdapter(gen, { hoehenSkala: 60, meterProZelle: 2, kachel: 16, cache: 4 });

test('Chunk-Adapter: Höhen in Metern, Cache und punktweise identisch', () => {
  const h0 = ad.bodenHoehe(10, 14);                       // ohne Chunk → punktweise
  assert.ok(Math.abs(h0 - gen.sampleHeight(5, 7) * 60) < 1e-6);
  ad.chunk(0, 0);
  assert.ok(ad.hatChunk(0, 0) && !ad.hatChunk(1, 0));
  assert.ok(Math.abs(ad.bodenHoehe(10, 14) - h0) < 1e-3, 'Cache liefert dieselbe Höhe');
  // bilinear zwischen Ecken
  const m = ad.bodenHoehe(11, 14), a = gen.sampleHeight(5, 7) * 60, b = gen.sampleHeight(6, 7) * 60;
  assert.ok(Math.abs(m - (a + b) / 2) < 1e-3);
  for (let i = 1; i <= 5; i++) ad.chunk(i, 0);
  assert.ok(!ad.hatChunk(0, 0), 'ältester Chunk fliegt raus');
  const n = ad.normale(3, 3);
  assert.ok(Math.abs(Math.hypot(n.x, n.y, n.z) - 1) < 1e-9 && n.y > 0);
  assert.ok(ad.biomBei(0, 0)?.name);
  assert.equal(ad.zuWelt(3, 4).x, 6);
  assert.equal(ad.zuGitter(6, 8).gy, 4);
});

test('Chunk-Adapter: Wasser, Start auf Land, Hindernisse aus erzeugten Chunks', () => {
  const s = ad.startPunkt();
  assert.ok(s.y > 0 && ad.wasserHoehe(s.x, s.z) === null);
  // Hindernis finden: erster Baum eines Chunks
  const c = ad.chunk(2, 2), o = c.objekte;
  const i = [...Array(o.anzahl).keys()].find(k => o.arten[o.art[k]] === 'baum');
  if (i !== undefined) {
    const p = ad.zuWelt(o.x[i], o.y[i]);
    assert.ok(ad.hindernisse(p.x + 0.05, p.z, 0.3), 'Baum schiebt');
  }
  assert.equal(ad.hindernisse(1e5, 1e5, 0.3), null);
  ad.dispose();
  assert.ok(!ad.hatChunk(2, 2));
});
