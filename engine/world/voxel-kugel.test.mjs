import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVoxelKugel } from './voxel-kugel.js';

const R = 100_000;
// Hügel-Höhe aus der Richtung (glatt, deterministisch); Stoff: Humus oben, Fels darunter
const vk = createVoxelKugel({
  radius: R,
  saeule: (x, y, z) => ({ h: 20 + 3 * Math.sin(x * 4000) * Math.cos(z * 3000) }),
  stoff: (s, tiefe) => (tiefe < 0.8 ? 1 : 2),
});
const oben = (h, dx = 0, dz = 0) => { const d = [dx / R, 1, dz / R], l = Math.hypot(...d); return d.map((v) => (v / l) * (R + h)); };
const H = (p) => { const l = Math.hypot(...p); return vk.zelleVon(...p) && 20 + 3 * Math.sin((p[0] / l) * 4000) * Math.cos((p[2] / l) * 3000); };

test('Gitter: Welt → Zelle → Welt ist genau (mm)', () => {
  const p = oben(17.3, 123.4, -56.7);
  const c = vk.zelleVon(...p), q = vk.punkt(c.f, c.i, c.j, c.k);
  assert.ok(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 1e-3);
});

test('Oberfläche liegt auf der Höhenfunktion, Normalen zeigen nach oben, Dreiecke nach außen gewickelt', () => {
  const key = vk.chunkVon(...oben(20));
  const D = vk.erzeuge(key), N = vk.netz(D);
  assert.ok(N.index.length > 300);
  let schlecht = 0;
  for (let v = 0; v < N.pos.length / 3; v++) {
    const w = [N.ursprung[0] + N.pos[v * 3], N.ursprung[1] + N.pos[v * 3 + 1], N.ursprung[2] + N.pos[v * 3 + 2]];
    if (Math.abs(Math.hypot(...w) - R - H(w)) > 0.12) schlecht++;
    const l = Math.hypot(...w), auf = (N.nor[v * 3] * w[0] + N.nor[v * 3 + 1] * w[1] + N.nor[v * 3 + 2] * w[2]) / l;
    if (auf < 0.7) schlecht++;
  }
  assert.equal(schlecht, 0);
  // Dreiecksnormale ≈ Ecknormale
  let falsch = 0;
  for (let t = 0; t < N.index.length; t += 3) {
    const [a, b, c] = [N.index[t], N.index[t + 1], N.index[t + 2]].map((i) => [N.pos[i * 3], N.pos[i * 3 + 1], N.pos[i * 3 + 2]]);
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const i = N.index[t];
    if (n[0] * N.nor[i * 3] + n[1] * N.nor[i * 3 + 1] + n[2] * N.nor[i * 3 + 2] < 0) falsch++;
  }
  assert.equal(falsch, 0);
  assert.ok([...N.stoff].every((s) => s === 1), 'Oberfläche = Oberboden');
});

test('Graben: Kugel-Loch ist Luft, Wand darunter ist Fels, Dichte an Chunk-Grenzen gleich', () => {
  const m = oben(H(oben(0)) - 2.5);   // 2,5 m unter der Oberfläche → Tunnelstück
  const op = { typ: 'weg', x: m[0], y: m[1], z: m[2], r: 1.5 };
  const keys = vk.chunksFuerOp(op);
  assert.ok(keys.includes(vk.chunkVon(...m)));
  const D = vk.erzeuge(vk.chunkVon(...m), [op]);
  assert.ok(vk.dichteAn(D, ...m) < -1);
  const unter = oben(H(oben(0)) - 4.6);
  assert.ok(vk.dichteAn(D, ...unter) > 0);
  assert.equal(vk.stoffAn(D, ...unter), 2);
  const N = vk.netz(D);
  assert.ok(N.stoff.includes(2), 'Tunnelwand zeigt Fels');
  // Nachbar-Chunk sieht an derselben Stelle dieselbe Dichte (nahtlos)
  for (const k of keys) {
    const D2 = vk.erzeuge(k, [op]), w = vk.dichteAn(D2, ...m);
    if (!Number.isNaN(w)) assert.ok(Math.abs(w - vk.dichteAn(D, ...m)) < 1e-4);
  }
});

test('Füllen macht Luft fest mit eigenem Stoff', () => {
  const m = oben(H(oben(0)) + 1);
  const D = vk.erzeuge(vk.chunkVon(...m), [{ typ: 'fest', x: m[0], y: m[1], z: m[2], r: 1, stoff: 7 }]);
  assert.ok(vk.dichteAn(D, ...m) > 0.5);
  assert.equal(vk.stoffAn(D, ...m), 7);
});

test('Alle 6 Würfelseiten: Dreiecke zeigen nach außen (Wicklung passt zur Normale)', () => {
  const flach = createVoxelKugel({ radius: R, saeule: () => ({ h: 10 }), stoff: () => 1 });
  for (const d of [[1, 0.1, 0.2], [-1, 0.2, 0.1], [0.1, 1, 0.2], [0.2, -1, 0.1], [0.1, 0.2, 1], [0.2, 0.1, -1]]) {
    const l = Math.hypot(...d), p = d.map((v) => (v / l) * (R + 10));
    const N = flach.netz(flach.erzeuge(flach.chunkVon(...p)));
    let aussen = 0, innen = 0;
    for (let t = 0; t < N.index.length; t += 3) {
      const [a, b, c] = [N.index[t], N.index[t + 1], N.index[t + 2]].map((i) => [N.pos[i * 3], N.pos[i * 3 + 1], N.pos[i * 3 + 2]]);
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      if (n[0] * d[0] + n[1] * d[1] + n[2] * d[2] > 0) aussen++; else innen++;
    }
    assert.ok(aussen > 100 && innen === 0, `Seite ${d}: ${aussen} außen, ${innen} innen`);
  }
});
