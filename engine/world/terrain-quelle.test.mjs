import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from './worldgen/worldgen.js';
import { createWeltAdapter } from './worldgen/worldgen-adapter.js';
import { createChunkGenerator } from './worldgen/worldgen-chunks.js';
import { createChunkAdapter } from './chunk-adapter.js';
import { quelleAusAdapter, fuelleKachel } from './terrain-quelle.js';
import { vertexAnzahl } from './terrain-lod.js';

const welt = createWorld({ preset: 'insel', seed: 3, breite: 96, tiefe: 96, qualitaet: 'schnell' });
const wa = createWeltAdapter(welt, { hoehenSkala: 40, meterProZelle: 2 });
const farben = new Float32Array(welt.biome.length * 3).fill(0.5);
const puffer = (seg) => { const n = vertexAnzahl(seg) * 3; return { pos: new Float32Array(n), nor: new Float32Array(n), col: new Float32Array(n) }; };

test('Endliche Welt: Bereich, Vertices auf Bodenhöhe in jeder LOD, Rand begrenzt', () => {
  const q = quelleAusAdapter(wa, { kachel: 16 });
  assert.deepEqual(q.bereich, { kx0: 0, ky0: 0, kx1: 5, ky1: 5 });
  for (const lod of [0, 1, 2, 3]) {
    const seg = 16 >> lod, z = puffer(seg), r = fuelleKachel(q, 2, 1, lod, z, { farben });
    const n = seg + 1;
    for (let v = 0; v < n * n; v++) {
      const x = z.pos[v * 3], y = z.pos[v * 3 + 1], zz = z.pos[v * 3 + 2];
      assert.ok(Math.abs(wa.bodenHoehe(x, zz) - y) < 1e-3, `LOD ${lod} Vertex ${v}`);
      assert.ok(z.nor[v * 3 + 1] > 0);
    }
    assert.ok(r.minY <= r.maxY);
    for (const c of z.col) assert.ok(Number.isFinite(c) && c >= 0);
    // Skirts liegen unter ihren Kantenvertices
    assert.ok(z.pos[(n * n) * 3 + 1] < z.pos[1]);
  }
  // Randkachel: nichts über die Karte hinaus
  const z = puffer(16); fuelleKachel(q, 5, 5, 0, z, { farben });
  const max = wa.zuWelt(95, 95);
  for (let v = 0; v < 17 * 17; v++) assert.ok(z.pos[v * 3] <= max.x + 1e-6 && z.pos[v * 3 + 2] <= max.z + 1e-6);
});

test('Endliche Welt: Objekte je Kachel ergeben zusammen alle Objekte', () => {
  const q = quelleAusAdapter(wa, { kachel: 16 });
  let summe = 0;
  for (let ky = 0; ky <= 5; ky++) for (let kx = 0; kx <= 5; kx++) {
    const { o, idx } = q.objekte(kx, ky), rc = q.kachelRechteck(kx, ky);
    for (const i of idx) { const p = wa.zuWelt(o.x[i], o.y[i]); assert.ok(p.x >= rc.x0 - 1e-6 && p.z >= rc.z0 - 1e-6); }
    summe += idx.length;
  }
  assert.equal(summe, welt.objekte.anzahl);
  assert.equal(q.teuer(0, 0, 0), false);
});

test('Unendlich: Kanten benachbarter Kacheln gleich, grobe LOD punktweise, volle LOD teuer', () => {
  const gen = createChunkGenerator({ preset: 'unendlich', seed: 9 });
  const ca = createChunkAdapter(gen, { hoehenSkala: 60, meterProZelle: 2, kachel: 16 });
  const q = quelleAusAdapter(ca);
  assert.equal(q.bereich, null);
  assert.ok(q.teuer(0, 0, 0) && !q.teuer(0, 0, 2));
  const a = puffer(16), b = puffer(16);
  fuelleKachel(q, 0, 0, 0, a, {}); fuelleKachel(q, 1, 0, 0, b, {});
  assert.ok(!q.teuer(0, 0, 0), 'Chunk jetzt im Cache');
  for (let j = 0; j <= 16; j++) {
    const ra = (j * 17 + 16) * 3, rb = (j * 17) * 3;
    assert.ok(Math.abs(a.pos[ra] - b.pos[rb]) < 1e-4 && Math.abs(a.pos[ra + 1] - b.pos[rb + 1]) < 1e-3, `Kante ${j}`);
    assert.ok(Math.abs(a.nor[ra + 1] - b.nor[rb + 1]) < 1e-3, `Normale ${j}`);
  }
  const g = puffer(4); fuelleKachel(q, 5, -3, 2, g, {});   // ohne Chunk
  assert.ok(!ca.hatChunk(5, -3));
  for (let v = 0; v < 25; v++) {
    const x = g.pos[v * 3], y = g.pos[v * 3 + 1], z = g.pos[v * 3 + 2];
    assert.ok(Math.abs(ca.bodenHoehe(x, z) - y) < 1e-3);
  }
  assert.ok(q.objekte(0, 0).o.anzahl >= 0);
});
