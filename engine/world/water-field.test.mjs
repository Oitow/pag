import test from 'node:test';
import assert from 'node:assert/strict';
import { FLAG } from './worldgen/worldgen-grid.js';
import { createWorld } from './worldgen/worldgen.js';
import { ART, wasserArt, stroemungsFeld, uferAbstand, wasserGitter } from './water-field.js';

// Kleine Handwelt 8×6: Meer links (x = 0), Fluss in Zeile 3 fließt nach −x ins Meer, Rest Land
function handWelt() {
  const b = 8, t = 6, n = b * t;
  const w = { breite: b, tiefe: t, zelle: 1, hoehe: new Float32Array(n).fill(0.2), wasserstand: new Float32Array(n),
    flags: new Uint8Array(n), ziel: new Int32Array(n).fill(-1), flussBreite: new Float32Array(n) };
  for (let y = 0; y < t; y++) { const i = y * b; w.flags[i] = FLAG.OZEAN; w.hoehe[i] = -0.3; }
  for (let x = 1; x < b; x++) {
    const i = 3 * b + x;
    w.flags[i] = FLAG.FLUSS; w.hoehe[i] = 0.1 + x * 0.01; w.wasserstand[i] = 0.12 + x * 0.01; w.ziel[i] = i - 1; w.flussBreite[i] = 1;
  }
  return w;
}

test('Wasserart und Uferabstand', () => {
  const w = handWelt(), a = wasserArt(w);
  assert.equal(a[0], ART.MEER); assert.equal(a[3 * 8 + 4], ART.FLUSS); assert.equal(a[9], ART.LAND);
  const d = uferAbstand(w, a);
  assert.equal(d[9], 0);
  assert.ok(d[0] >= 1 && d[3 * 8 + 4] >= 1);
});

test('Strömung zeigt in Abflussrichtung, Meer steht still', () => {
  const w = handWelt(), s = stroemungsFeld(w, { tempo: 2 });
  for (let x = 1; x < 8; x++) {
    const i = 3 * 8 + x;
    assert.ok(s.x[i] < 0, `Zelle ${x} fließt nach −x`);
    assert.ok(Math.abs(s.y[i]) < 1e-6);
    assert.ok(Math.hypot(s.x[i], s.y[i]) <= 2 + 1e-6);
  }
  assert.equal(s.x[0], 0); assert.equal(s.y[0], 0);
});

test('Gitter: Tiefe ≥ 0, Meter, Ufer-Vertices mit Spiegel der Nachbarn', () => {
  const w = handWelt(), g = wasserGitter(w, { hoehenSkala: 10, meterProZelle: 2 });
  assert.equal(g.nx, 8); assert.equal(g.nz, 6);
  assert.ok(Math.abs(g.tiefe[0] - 3) < 1e-5, 'Meer: 0 − (−0.3) = 0.3 × 10 m');
  assert.equal(g.spiegel[0], 0);
  assert.equal(g.welle[0], 1);
  const fluss = 3 * 8 + 4;
  assert.ok(Math.abs(g.spiegel[fluss] - 1.6) < 1e-5);
  assert.ok(g.stroemX[fluss] < 0);
  assert.ok(g.welle[fluss] < 0.5);
  // Land direkt am Fluss bekommt Spiegelmittel, Tiefe 0
  const land = 2 * 8 + 4;
  assert.equal(g.tiefe[land], 0);
  assert.ok(g.spiegel[land] > 1 && g.spiegel[land] < 2);
  for (const v of g.tiefe) assert.ok(v >= 0 && Number.isFinite(v));
  assert.ok(g.anzahlQuads > 0 && g.anzahlQuads <= 7 * 5);
});

test('Erzeugte Insel: Meer tief, Flüsse strömen meist bergab', () => {
  const w = createWorld({ preset: 'insel', seed: 3, breite: 96, tiefe: 96, qualitaet: 'schnell' });
  const g = wasserGitter(w, { hoehenSkala: 40, meterProZelle: 2, schritt: 2 });
  assert.equal(g.nx, 48);
  assert.ok(g.tiefe[0] > 1, 'Kartenecke liegt im tiefen Meer');
  assert.ok(g.ufer[0] > 4);
  const s = stroemungsFeld(w), b = w.breite;
  let gut = 0, alle = 0;
  for (let i = 0; i < b * w.tiefe; i++) {
    const j = w.ziel[i];
    if (!s.x[i] && !s.y[i] || j < 0) continue;
    alle++;
    if (s.x[i] * ((j % b) - (i % b)) + s.y[i] * (Math.floor(j / b) - Math.floor(i / b)) > 0) gut++;
  }
  assert.ok(alle > 0 && gut / alle > 0.8, `${gut}/${alle}`);
});
