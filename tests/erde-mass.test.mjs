// Prüft die Kugel-Mathe des Erde-Labors (labore/erde/js/mass.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { R_ERDE, horizont, absinken, oberflaeche, reglerZuHoehe, hoeheZuRegler } from '../labore/erde/js/mass.js';

test('Horizont: Mensch (1,8 m) sieht ca. 4,8 km weit', () => {
  assert.ok(Math.abs(horizont(1.8) - 4790) < 20);
});

test('Krümmung: auf 5 km sinkt der Boden ca. 2 m, auch für winzige Strecken stabil', () => {
  assert.ok(Math.abs(absinken(5000) - 1.962) < 0.01);
  assert.ok(Math.abs(absinken(1) - 1 / (2 * R_ERDE)) < 1e-12);
});

test('Oberfläche: jeder Punkt liegt genau R von der Erdmitte entfernt, Normale zeigt nach außen', () => {
  for (const [o, n] of [[0, 0], [1, 2], [50_000, -80_000], [3_000_000, 4_000_000]]) {
    const p = oberflaeche(o, n);
    const d = Math.hypot(p.x, p.y + R_ERDE, p.z);
    assert.ok(Math.abs(d - R_ERDE) < 1e-6, `Abstand ${d}`);
    assert.ok(Math.abs(p.nx * R_ERDE - p.x) < 1e-6 && Math.abs(p.ny * R_ERDE - (p.y + R_ERDE)) < 1e-6);
  }
});

test('Höhenregler: hin und zurück ergibt dieselbe Höhe', () => {
  for (const h of [1.5, 10, 408_000, 384_400_000]) assert.ok(Math.abs(reglerZuHoehe(hoeheZuRegler(h)) / h - 1) < 1e-9);
});
