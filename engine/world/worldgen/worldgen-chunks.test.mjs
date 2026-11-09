import test from 'node:test';
import assert from 'node:assert/strict';
import { createChunkGenerator } from './worldgen-chunks.js';
import { createHeightSampler } from './worldgen-height.js';
import { aufloesen } from './worldgen-presets.js';
import { hashArrays, FLAG } from './worldgen-grid.js';

test('Chunks: gemeinsame Kanten sind identisch, sampleHeight passt zum Chunk', () => {
  const gen = createChunkGenerator({ seed: 21, hoehenSkala: 40 });
  const G = 32, n = G + 1;
  const a = gen.generateChunk(-1, 2, G), r = gen.generateChunk(0, 2, G), u = gen.generateChunk(-1, 3, G);
  for (let k = 0; k < n; k++) {
    assert.equal(a.hoehe[k * n + G], r.hoehe[k * n], `rechte Kante Zeile ${k}`);
    assert.equal(a.biom[k * n + G], r.biom[k * n]);
    assert.equal(a.hoehe[G * n + k], u.hoehe[k], `untere Kante Spalte ${k}`);
    assert.equal(a.biom[G * n + k], u.biom[k]);
  }
  for (let k = 0; k < 20; k++) {
    const x = (k * 7) % n, y = (k * 13) % n;
    assert.equal(a.hoehe[y * n + x], Math.fround(gen.sampleHeight(a.x0 + x, a.y0 + y)));
  }
  for (const arr of [a.hoehe, a.temperatur, a.feuchte]) for (const v of arr) assert.ok(Number.isFinite(v));
});

test('Chunks: deterministisch und Objekte nahtlos (4 kleine = 1 großer Chunk)', () => {
  const g1 = createChunkGenerator({ seed: 4 }), g2 = createChunkGenerator({ seed: 4 });
  const c1 = g1.generateChunk(5, -3, 32), c2 = g2.generateChunk(5, -3, 32);
  assert.equal(hashArrays(c1.hoehe, c1.biom, c1.flags, c1.objekte.x), hashArrays(c2.hoehe, c2.biom, c2.flags, c2.objekte.x));

  const liste = o => Array.from({ length: o.anzahl }, (_, i) => `${o.arten[o.art[i]]}:${o.typen[o.typ[i]]}:${o.x[i].toFixed(4)}:${o.y[i].toFixed(4)}`);
  const gross = liste(g1.generateChunk(0, 0, 64).objekte).sort();
  const klein = [];
  for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) klein.push(...liste(g1.generateChunk(cx, cy, 32).objekte));
  klein.sort();
  assert.ok(gross.length > 10, 'zu wenige Objekte');
  assert.deepEqual(klein, gross);
});

test('kachelbar: linke und rechte Kante (sowie oben/unten) passen nahtlos', () => {
  const opts = aufloesen({ preset: 'unendlich', seed: 9, breite: 64, tiefe: 48, kachelbar: true });
  const hs = createHeightSampler(opts);
  for (let k = 0; k < 48; k++) assert.ok(Math.abs(hs.sample(0, k) - hs.sample(64, k)) < 1e-9);
  for (let k = 0; k < 64; k++) assert.ok(Math.abs(hs.sample(k, 0) - hs.sample(k, 48)) < 1e-9);
});

test('Chunk-Flussnetz: Kanten nahtlos (auch Wasser), reihenfolgeunabhängig, Flüsse und Seen vorhanden', () => {
  const G = 32, n = G + 1;
  const g1 = createChunkGenerator({ seed: 5, hoehenSkala: 30 });
  let fluss = 0, see = 0, seen = 0;
  for (let cy = -2; cy < 2; cy++) for (let cx = -2; cx < 2; cx++) {
    const a = g1.generateChunk(cx, cy, G), r = g1.generateChunk(cx + 1, cy, G), u = g1.generateChunk(cx, cy + 1, G);
    for (let k = 0; k < n; k++) {
      for (const f of ['hoehe', 'biom', 'flags', 'wasser']) {
        assert.equal(a[f][k * n + G], r[f][k * n], `${f}: rechte Kante (${cx},${cy}) Zeile ${k}`);
        assert.equal(a[f][G * n + k], u[f][k], `${f}: untere Kante (${cx},${cy}) Spalte ${k}`);
      }
    }
    for (let i = 0; i < n * n; i++) {
      if (a.flags[i] & FLAG.FLUSS) fluss++;
      if (a.flags[i] & FLAG.SEE) { see++; assert.ok(a.wasser[i] > a.hoehe[i], 'Seespiegel über Seeboden'); }
      if (a.flags[i] & FLAG.OZEAN) assert.equal(a.wasser[i], 0);
    }
    seen += a.seen.length;
  }
  assert.ok(fluss > 50, `zu wenig Flusszellen (${fluss})`);
  assert.ok(see > 20 && seen > 0, `zu wenig See (${see} Zellen, ${seen} Seen)`);
  // frischer Generator, andere Reihenfolge → gleiche Werte (Zwischenspeicher ändert nichts)
  const g2 = createChunkGenerator({ seed: 5, hoehenSkala: 30 });
  const spaet = g2.generateChunk(3, 3, G); g2.generateChunk(-1, -1, G);
  const c2 = g2.generateChunk(0, 0, G), c1 = g1.generateChunk(0, 0, G);
  assert.equal(hashArrays(c1.hoehe, c1.flags, c1.wasser), hashArrays(c2.hoehe, c2.flags, c2.wasser));
  assert.equal(hashArrays(spaet.hoehe), hashArrays(g1.generateChunk(3, 3, G).hoehe));
  // samplePunkt liefert ab 1.1 den Wasserspiegel in aus[8]
  const aus = new Float64Array(9);
  for (let k = 0; k < 30; k++) {
    const x = (k * 7) % n, y = (k * 11) % n;
    g1.samplePunkt(c1.x0 + x, c1.y0 + y, aus);
    assert.equal(aus[4], c1.flags[y * n + x]);
    assert.equal(Math.fround(aus[8] * 30), c1.wasser[y * n + x]);
  }
  g1.dispose(); g2.dispose();
});

test('Chunk-Flussmodus "rauschen" bleibt verfügbar (ohne Seen)', () => {
  const gen = createChunkGenerator({ seed: 5, chunk: { flussModus: 'rauschen' } });
  const c = gen.generateChunk(0, 0, 32);
  assert.equal(c.seen.length, 0);
  for (const f of c.flags) assert.ok(!(f & FLAG.SEE));
});
