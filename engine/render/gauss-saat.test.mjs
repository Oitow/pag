import test from 'node:test';
import assert from 'node:assert/strict';
import { createSplatDaten, quatAusNormale, saatAufNetz } from './gauss-saat.js';

const nah = (a, b, e = 1e-5) => Math.abs(a - b) < e;
/** Vektor mit Quaternion drehen. */
function drehe(q, v) {
  const [x, y, z, w] = q, [vx, vy, vz] = v;
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + y * tz - z * ty, vy + w * ty + z * tx - x * tz, vz + w * tz + x * ty - y * tx];
}
// Quadrat 2×2 in der xz-Ebene (Normale +y) aus zwei Dreiecken
const quadrat = { position: new Float32Array([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1]), normal: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), index: new Uint16Array([0, 2, 1, 0, 3, 2]) };

test('createSplatDaten: plus wächst über den Startplatz, fertig liefert passende Längen', () => {
  const d = createSplatDaten(16);
  for (let i = 0; i < 100; i++) d.plus(i, 2, 3, 0.1, 0.2, 0.3, 0, 0, 0, 1, 0.5, 0.6, 0.7, 0.8, i === 99 ? 1 : undefined);
  assert.equal(d.anzahl, 100);
  const f = d.fertig();
  assert.equal(f.anzahl, 100);
  assert.deepEqual([f.position.length, f.skala.length, f.drehung.length, f.farbe.length, f.deck.length, f.wind.length], [300, 300, 400, 300, 100, 100]);
  assert.equal(f.position[99 * 3], 99);
  assert.ok(nah(f.skala[99 * 3 + 2], 0.3) && nah(f.farbe[99 * 3 + 1], 0.6) && nah(f.deck[50], 0.8));
  assert.equal(f.drehung[99 * 4 + 3], 1);
  assert.equal(f.wind[0], 0);
  assert.equal(f.wind[99], 1);
});

test('quatAusNormale: lokale z-Achse landet auf der Normalen, Einheitslänge, auch bei −z', () => {
  for (const n of [[0, 1, 0], [1, 0, 0], [0, 0, 1], [0, 0, -1], [0.3, -0.5, 0.81], [-2, 1, -3]]) {
    const q = quatAusNormale(n[0], n[1], n[2], 1.1);
    assert.ok(nah(Math.hypot(...q), 1));
    const l = Math.hypot(...n), z = drehe(q, [0, 0, 1]);
    assert.ok(nah(z[0], n[0] / l) && nah(z[1], n[1] / l) && nah(z[2], n[2] / l), `Normale ${n}`);
  }
  const out = [9, 9, 9, 9];
  assert.equal(quatAusNormale(0, 0, 1, 0, out), out);
  assert.deepEqual(out, [0, 0, 0, 1]);
  const a = drehe(quatAusNormale(0, 0, 1, Math.PI / 2), [1, 0, 0]);     // dreh wirkt um die Normale
  assert.ok(nah(a[0], 0) && nah(a[1], 1));
});

test('saatAufNetz: deterministisch, auf der Fläche, abgehoben, flach entlang der Normalen', () => {
  const a = createSplatDaten(), b = createSplatDaten();
  const opt = { anzahl: 500, seed: 11, groesse: [0.1, 0.3], flach: 0.2, abheben: 0.05, deck: 0.7, wind: 0.4 };
  assert.equal(saatAufNetz(a, quadrat, opt), 500);
  saatAufNetz(b, quadrat, opt);
  const fa = a.fertig(), fb = b.fertig();
  assert.deepEqual(fa.position, fb.position);
  let links = 0;
  for (let i = 0; i < 500; i++) {
    const x = fa.position[i * 3], y = fa.position[i * 3 + 1], z = fa.position[i * 3 + 2];
    assert.ok(Math.abs(x) <= 1 && Math.abs(z) <= 1 && nah(y, 0.05));
    if (x < 0) links++;
    const sx = fa.skala[i * 3], sy = fa.skala[i * 3 + 1], sz = fa.skala[i * 3 + 2];
    assert.ok(sx >= 0.1 - 1e-6 && sx <= 0.3 + 1e-6 && sy <= sx + 1e-6 && nah(sz, sx * 0.2));
    const zAchse = drehe([...fa.drehung.subarray(i * 4, i * 4 + 4)], [0, 0, 1]);
    assert.ok(nah(zAchse[1], 1, 1e-4));
    assert.ok(nah(fa.deck[i], 0.7) && nah(fa.wind[i], 0.4));
  }
  assert.ok(links > 200 && links < 300, `gleichmäßig verteilt (${links})`);
  const c = createSplatDaten();
  saatAufNetz(c, quadrat, { ...opt, seed: 12 });
  assert.notDeepEqual(c.fertig().position, fa.position);
});

test('saatAufNetz: farbe = null lässt Stellen aus, Farbe wird übernommen; ohne Index/Normalen', () => {
  const d = createSplatDaten();
  const n = saatAufNetz(d, quadrat, { anzahl: 400, seed: 3, farbe: (x, y, z, nx, ny, nz, zufall) => (x > 0 ? [0.1, zufall, ny] : null) });
  assert.ok(n > 150 && n < 250);
  assert.equal(d.anzahl, n);
  const f = d.fertig();
  for (let i = 0; i < n; i++) { assert.ok(f.position[i * 3] > 0); assert.ok(nah(f.farbe[i * 3], 0.1)); assert.equal(f.farbe[i * 3 + 2], 1); }
  const roh = { position: new Float32Array([0, 0, 0, 0, 0, 2, 2, 0, 0]) };              // ein Dreieck, Normale +y aus der Fläche
  const e = createSplatDaten();
  assert.equal(saatAufNetz(e, roh, { anzahl: 50, seed: 1, abheben: 0.1 }), 50);
  const g = e.fertig();
  for (let i = 0; i < 50; i++) assert.ok(nah(g.position[i * 3 + 1], 0.1) && g.position[i * 3] + g.position[i * 3 + 2] <= 2 + 1e-5);
  assert.equal(saatAufNetz(e, { position: new Float32Array(0) }, { anzahl: 5 }), 0);
});
