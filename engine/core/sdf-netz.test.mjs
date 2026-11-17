import test from 'node:test';
import assert from 'node:assert/strict';
import { createSdf } from './sdf.js';
import { sdfNetz, sdfHoehenkarte } from './sdf-netz.js';

test('sdfNetz: Kugel – Eckpunkte auf der Oberfläche, Normalen nach außen, geschlossen', () => {
  const s = createSdf(); s.kugel([1, 2, 3], 3);
  const n = sdfNetz(s, { zelle: 0.4 });
  assert.ok(n.dreiecke > 500 && n.index.length === n.dreiecke * 3);
  const p = n.position, nr = n.normal;
  for (let i = 0; i < p.length; i += 3) {
    const dx = p[i] - 1, dy = p[i + 1] - 2, dz = p[i + 2] - 3, r = Math.hypot(dx, dy, dz);
    assert.ok(Math.abs(r - 3) < 0.15, `Radius ${r}`);
    assert.ok((dx * nr[i] + dy * nr[i + 1] + dz * nr[i + 2]) / r > 0.95);
  }
  // geschlossen: jede Kante genau zweimal; Dreiecke zeigen nach außen
  const kanten = new Map();
  for (let t = 0; t < n.index.length; t += 3) {
    const [a, b, c] = [n.index[t], n.index[t + 1], n.index[t + 2]];
    for (const [u, v] of [[a, b], [b, c], [c, a]]) { const k = Math.min(u, v) + '_' + Math.max(u, v); kanten.set(k, (kanten.get(k) || 0) + 1); }
    const ux = p[b * 3] - p[a * 3], uy = p[b * 3 + 1] - p[a * 3 + 1], uz = p[b * 3 + 2] - p[a * 3 + 2];
    const vx = p[c * 3] - p[a * 3], vy = p[c * 3 + 1] - p[a * 3 + 1], vz = p[c * 3 + 2] - p[a * 3 + 2];
    const f = (uy * vz - uz * vy) * (p[a * 3] - 1) + (uz * vx - ux * vz) * (p[a * 3 + 1] - 2) + (ux * vy - uy * vx) * (p[a * 3 + 2] - 3);
    assert.ok(f >= -1e-6, 'Dreieck zeigt nach innen');
  }
  for (const anz of kanten.values()) assert.equal(anz, 2);
});

test('sdfNetz: grobe Vorauswahl verliert nichts (gleich wie Block = 1) und maxZellen vergröbert', () => {
  const s = createSdf({ glatt: 0.7 });
  s.kapsel([0, -1, 0], [0, 8, 0], 2, 1.5).kette([[1, 2, 0], [5, 0.5, 2], [9, -0.5, 1]], [1, 0.6, 0.3]).kette([[-1, 3, 0], [-6, 0.4, -2]], [0.8, 0.4], { streckY: 2 });
  s.stoerung((x, y, z) => 0.08 * Math.sin(x * 3) * Math.sin(z * 3 + y), 0.08);
  const a = sdfNetz(s, { zelle: 0.35 }), b = sdfNetz(s, { zelle: 0.35, block: 1 });
  assert.equal(a.dreiecke, b.dreiecke);
  assert.equal(a.position.length, b.position.length);
  const grob = sdfNetz(s, { zelle: 0.1, maxZellen: 20000 });
  assert.ok(grob.zelle > 0.1 && grob.dreiecke > 50);
});

test('sdfNetz: offener Rand, wenn die Grenzen den Körper abschneiden', () => {
  const s = createSdf(); s.kapsel([0, -5, 0], [0, 5, 0], 2);
  const n = sdfNetz(s, { zelle: 0.5, grenzen: { min: [-3, 0, -3], max: [3, 3, 3] } });
  let minY = Infinity, maxY = -Infinity;
  for (let i = 1; i < n.position.length; i += 3) { minY = Math.min(minY, n.position[i]); maxY = Math.max(maxY, n.position[i]); }
  assert.ok(minY >= 0 && maxY <= 3 && n.dreiecke > 50);
});

test('sdfHoehenkarte: Hügel begehbar, Stamm massiv, unter dem Bogen frei', () => {
  const s = createSdf({ glatt: 0.3 });
  s.kugel([0, -1, 0], 3);                                  // Hügel, Gipfel bei 2 m
  s.kapsel([10, -1, 0], [10, 20, 0], 2);                    // Stamm
  s.kette([[20, 0, -8], [20, 7, -3], [20, 7, 3], [20, 0, 8]], 1);   // Bogen, Unterkante 6 m
  const k = sdfHoehenkarte(s, { zelle: 0.5, maxHoehe: 6 });
  assert.ok(Math.abs(k.hoeheBei(0, 0) - 2) < 0.1, `Gipfel ${k.hoeheBei(0, 0)}`);
  assert.ok(k.hoeheBei(1.5, 0) > 1 && k.hoeheBei(1.5, 0) < 2);
  assert.equal(k.hoeheBei(10, 0), 6);
  assert.ok(Number.isNaN(k.hoeheBei(20, 0)), 'unter dem Bogen frei');
  assert.ok(Number.isNaN(k.hoeheBei(5.5, 6)), 'blanker Boden');
  assert.ok(Number.isNaN(k.hoeheBei(999, 0)));
  assert.equal(k.hoehe.length, k.breite * k.tiefe);
});
