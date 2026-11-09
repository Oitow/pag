import test from 'node:test';
import assert from 'node:assert/strict';
import { createMinHeap, chamferDistanz, markiereRegionen, bilinear } from './worldgen-grid.js';
import { fuelleSenken, abflussRichtung, abflussMenge } from './worldgen-hydrology.js';
import { erodiereHydraulisch, erodiereThermisch } from './worldgen-erosion.js';
import { erstelleBiomTabelle, klassifiziere, STANDARD_BIOME } from './worldgen-biomes.js';
import { createShape, FORMEN } from './worldgen-shape.js';
import { mischeOptionen } from './worldgen-presets.js';

test('Min-Heap sortiert und wächst', () => {
  const h = createMinHeap(4), werte = [5, 1, 9, 3, 3, 7, 0, 12, 4];
  werte.forEach((p, i) => h.push(i, p));
  const aus = [];
  while (h.size) { h.pop(); aus.push(h.letztePrio); }
  assert.deepEqual(aus, [...werte].sort((a, b) => a - b));
});

test('Chamfer-Abstand und Regionen', () => {
  const b = 9, t = 5, m = new Uint8Array(b * t);
  m[2 * b + 0] = 1;
  const d = chamferDistanz(m, b, t);
  assert.equal(d[2 * b + 0], 0);
  assert.equal(d[2 * b + 4], 4);
  assert.ok(Math.abs(d[0 * b + 2] - (1.4142 * 2)) < 1e-4);
  const r = new Uint8Array(b * t); r[0] = r[1] = 1; r[8] = 1;
  assert.equal(markiereRegionen(r, b, t), 2);
  assert.equal(bilinear(Float32Array.from([0, 1, 2, 3]), 2, 2, 0.5, 0.5), 1.5);
});

test('Priority-Flood füllt eine Senke und Abfluss erreicht den Rand', () => {
  const b = 7, t = 7, H = new Float32Array(b * t).fill(1);
  H[3 * b + 3] = 0.2; // Mulde in der Mitte
  for (let x = 0; x < b; x++) { H[x] = 0.5; }
  const saat = new Uint8Array(b * t);
  for (let x = 0; x < b; x++) { saat[x] = saat[(t - 1) * b + x] = 1; }
  for (let y = 0; y < t; y++) { saat[y * b] = saat[y * b + b - 1] = 1; }
  const { F, reihenfolge } = fuelleSenken(H, b, t, saat);
  assert.ok(F[3 * b + 3] >= 1, 'Mulde nicht gefüllt');
  const ziel = abflussRichtung(F, b, t, saat);
  const A = abflussMenge(ziel, reihenfolge);
  let summeRand = 0;
  for (let i = 0; i < b * t; i++) if (saat[i]) summeRand += A[i];
  assert.equal(summeRand, b * t, 'gesamtes Wasser muss am Rand ankommen');
});

test('Erosion bleibt endlich und verändert das Gelände', () => {
  const b = 64, t = 64, H = new Float32Array(b * t);
  for (let y = 0; y < t; y++) for (let x = 0; x < b; x++) H[y * b + x] = Math.sin(x * 0.2) * 0.2 + y * 0.01;
  const vorher = H.slice();
  erodiereHydraulisch(H, b, t, { tropfen: 2000, seed: 1 });
  erodiereThermisch(H, b, t, 2, 0.01);
  let diff = 0;
  for (let i = 0; i < H.length; i++) { assert.ok(Number.isFinite(H[i])); diff += Math.abs(H[i] - vorher[i]); }
  assert.ok(diff > 0.01);
});

test('Biomtabelle: Regeln vor Whittaker, Erweiterung bekommt neue Id', () => {
  const tab = erstelleBiomTabelle({ extra: [{ key: 'pilzhain', name: 'Pilzhain', farbe: 0x8040c0, temp: [0.45, 0.55], feuchte: [0.9, 1] }] });
  assert.equal(tab.idVon('pilzhain'), STANDARD_BIOME.length);
  assert.equal(klassifiziere(tab, 0.1, 0.01, 0.5, 0.97, 50, 50, 0), tab.idVon('pilzhain'));
  assert.equal(klassifiziere(tab, 0.1, 0.01, 0.02, 0.5, 50, 50, 0), tab.idVon('schnee'));
  assert.equal(klassifiziere(tab, 0.1, 0.5, 0.5, 0.5, 50, 50, 0), tab.idVon('fels'));
  assert.equal(klassifiziere(tab, 0.1, 0.01, 0.9, 0.05, 50, 50, 0), tab.idVon('wueste'));
  assert.equal(klassifiziere(tab, -0.5, 0, 0.5, 0.5, 0, 0, 1), tab.idVon('tiefsee'));
});

test('Formen liefern endliche Masken; Optionen werden tief gemischt', () => {
  for (const typ of FORMEN) {
    const f = createShape({ typ }, 3);
    for (let k = 0; k < 50; k++) {
      const u = Math.sin(k) * 1.2, v = Math.cos(k * 1.7) * 1.2;
      assert.ok(Number.isFinite(f.maske(u, v)) && Number.isFinite(f.nach(0.3, u, v, u, v)), typ);
    }
  }
  const o = mischeOptionen({ a: { b: 1, c: [1] } }, { a: { c: [2], d: 3 } });
  assert.deepEqual(o, { a: { b: 1, c: [2], d: 3 } });
});

test('Höhe: Felsstufen (optional) stufen nur das Gebirge, ohne Option unverändert', async () => {
  const { createHeightSampler } = await import('./worldgen-height.js');
  const basis = { seed: 3, breite: 128, tiefe: 128, form: { typ: 'insel' }, hoehe: { gebirge: { menge: 0.9, hoehe: 1.2 } } };
  const a = createHeightSampler(basis), b = createHeightSampler({ ...basis, hoehe: { gebirge: { menge: 0.9, hoehe: 1.2, felsStufen: { stufen: 12, staerke: 0.7 } } } });
  let anders = 0, max = 0;
  for (let y = 0; y < 128; y += 3) for (let x = 0; x < 128; x += 3) {
    const ha = a.sample(x, y), hb = b.sample(x, y);
    assert.ok(Number.isFinite(hb));
    if (ha !== hb) anders++;
    max = Math.max(max, Math.abs(ha - hb));
  }
  assert.ok(anders > 20, 'Felsstufen wirken nicht');
  assert.ok(max < 0.1, `Felsstufen zu stark (${max})`);
});
