import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from './worldgen.js';
import { createWeltAdapter } from './worldgen-adapter.js';
import { FLAG } from './worldgen-grid.js';

const welt = createWorld({ preset: 'insel', seed: 7, breite: 128, tiefe: 128, qualitaet: 'schnell' });

test('Adapter: Bodenhöhe in Metern, zentriert, passt zur Gitterhöhe', () => {
  const a = createWeltAdapter(welt, { hoehenSkala: 50, meterProZelle: 2 });
  assert.deepEqual(a.groesse, { x: 256, z: 256 });
  const { gx, gy } = a.zuGitter(0, 0);
  assert.equal(gx, 64); assert.equal(gy, 64);
  const s = 40 * 128 + 70;
  const p = a.zuWelt(70, 40);
  assert.ok(Math.abs(a.bodenHoehe(p.x, p.z) - welt.hoehe[s] * 50) < 1e-4);
  const n = a.normale(p.x, p.z);
  assert.ok(Math.abs(Math.hypot(n.x, n.y, n.z) - 1) < 1e-6 && n.y > 0);
});

test('Adapter: Wasser – Meer auf 0, Land null, außerhalb Meer', () => {
  const a = createWeltAdapter(welt, { hoehenSkala: 40 });
  let meer = -1, land = -1;
  for (let i = 0; i < welt.flags.length && (meer < 0 || land < 0); i++) {
    if (welt.flags[i] & FLAG.OZEAN) meer = i; else if (!(welt.flags[i] & (FLAG.SEE | FLAG.FLUSS))) land = i;
  }
  const w = (i) => a.zuWelt((i % 128) + 0.5, Math.floor(i / 128) + 0.5);
  assert.equal(a.wasserHoehe(w(meer).x, w(meer).z), 0);
  assert.equal(a.wasserHoehe(w(land).x, w(land).z), null);
  assert.equal(a.wasserHoehe(1e5, 0), 0);
});

test('Adapter: Hindernisse schieben aus Baumstämmen heraus', () => {
  const a = createWeltAdapter(welt);
  assert.ok(a.anzahlHindernisse > 0);
  const o = welt.objekte;
  const i = [...o.art.keys()].find(k => o.arten[o.art[k]] === 'baum');
  const p = a.zuWelt(o.x[i], o.y[i]);
  const s = a.hindernisse(p.x + 0.05, p.z, 0.3);
  assert.ok(s && s.x > 0, 'Schub nach außen');
  assert.equal(a.hindernisse(1e4, 1e4, 0.3), null);
  const st = a.startPunkt();
  assert.ok(Number.isFinite(st.y) && st.y > 0, 'Start liegt an Land');
  a.dispose();
});
