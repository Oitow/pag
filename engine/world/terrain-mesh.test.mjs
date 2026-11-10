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

test('Objekte: Instanzen je Typ, Anzahl passt', () => {
  const s = createScatterMesh(adapter);
  assert.ok(s.anzahl > 0 && s.anzahl <= welt.objekte.anzahl);
  let summe = 0;
  s.gruppe.children.forEach(m => { assert.ok(m.isInstancedMesh); summe += m.count; });
  assert.equal(summe, s.anzahl);
  s.dispose();
});

test('aktualisiere: Teilstück nach Höhen-Änderung = komplett neu gebautes Gelände (Höhen + Normalen), Erd-Tönung', () => {
  const w = createWorld({ preset: 'insel', seed: 5, breite: 64, tiefe: 64, qualitaet: 'schnell' });
  const a = createWeltAdapter(w, { hoehenSkala: 40, meterProZelle: 2 });
  for (const schritt of [1, 2]) {
    const g = createTerrainMesh(a, { schritt });
    const farbeVorher = g.boden.geometry.attributes.color.array.slice();
    const ber = { x0: 20, y0: 30, x1: 27, y1: 35 };
    for (let y = ber.y0; y <= ber.y1; y++) for (let x = ber.x0; x <= ber.x1; x++) w.hoehe[y * 64 + x] += 0.02 * Math.sin(x * 1.3 + y);
    const n = g.aktualisiere(ber);
    assert.ok(n > 0 && n < 200);
    const neu = createTerrainMesh(a, { schritt });
    for (const name of ['position', 'normal']) {
      const x = g.boden.geometry.attributes[name].array, y = neu.boden.geometry.attributes[name].array;
      let max = 0;
      for (let k = 0; k < x.length; k++) max = Math.max(max, Math.abs(x[k] - y[k]));
      assert.ok(max < 1e-4, `${name} bei schritt ${schritt}: Abweichung ${max}`);
    }
    assert.deepEqual(g.boden.geometry.attributes.color.array, farbeVorher);   // ohne erde bleiben die Farben
    g.aktualisiere(ber, { erde: () => 1, erdFarbe: 0xff0000 });
    const col = g.boden.geometry.attributes.color.array, nx = g.boden.geometry.attributes.position.count / (schritt === 1 ? 64 : 32);
    const v = (Math.round(32 / schritt) * nx + Math.round(24 / schritt)) * 3;
    assert.ok(col[v] > 0.99 && col[v + 1] < 0.01 && col[v + 2] < 0.01);
    assert.deepEqual(col.slice(0, 30), farbeVorher.slice(0, 30));
    assert.equal(g.aktualisiere(null), 0);
    g.dispose(); neu.dispose();
  }
});
