import test from 'node:test';
import assert from 'node:assert/strict';
import { baueForm } from './riesenbaum-form.js';
import { laubKarten, duenneKarten, sammleKarten } from './laub-klumpen.js';

const form = baueForm({ seed: 11, hoehe: 112 });
const karten = laubKarten(form.krone, { seed: 11, H: 112, kronenAb: form.masse.kronenAb });

test('laub-klumpen: Karten laut Vertrag, in der Krone, deterministisch', () => {
  assert.ok(karten.anzahl > 600 && karten.anzahl < 4000, 'anzahl ' + karten.anzahl);
  for (const n of ['mitte', 'normale', 'farbe', 'daten']) assert.ok(karten[n] instanceof Float32Array && karten[n].length >= karten.anzahl * 3, n);
  for (let i = 0; i < karten.anzahl; i++) {
    assert.ok(karten.mitte[i * 3 + 1] > form.masse.kronenAb - 12, 'Karte unter der Krone');
    const g = karten.daten[i * 3], t = karten.daten[i * 3 + 1];
    assert.ok(g > 1 && g < 9 && t >= 0 && t <= 1);
    assert.ok(Math.abs(Math.hypot(karten.normale[i * 3], karten.normale[i * 3 + 1], karten.normale[i * 3 + 2]) - 1) < 1e-4);
  }
  const b = laubKarten(form.krone, { seed: 11, H: 112, kronenAb: form.masse.kronenAb });
  assert.deepEqual(Array.from(b.mitte.subarray(0, 30)), Array.from(karten.mitte.subarray(0, 30)));
  assert.ok(laubKarten(form.krone, { seed: 11, dichte: 0.5 }).anzahl < karten.anzahl * 0.6);
});

test('laub-klumpen: ausdünnen vergrößert, sammeln transformiert in Welt', () => {
  const d = duenneKarten(karten, 0.3, 4);
  assert.ok(d.anzahl > karten.anzahl * 0.2 && d.anzahl < karten.anzahl * 0.4);
  const mittel = (k) => { let s = 0; for (let i = 0; i < k.anzahl; i++) s += k.daten[i * 3]; return s / k.anzahl; };
  assert.ok(mittel(d) > mittel(karten) * 1.3);
  // Skala 2, verschoben um (100, 5, -20), 90° um y
  const m = [0, 0, -2, 0, 0, 2, 0, 0, 2, 0, 0, 0, 100, 5, -20, 1];
  const w = sammleKarten([{ karten, matrix: m }, { karten, matrix: m, anteil: 0.5, seed: 2 }]);
  assert.ok(w.anzahl > karten.anzahl && w.anzahl < karten.anzahl * 1.7);
  const x = karten.mitte[0], y = karten.mitte[1], z = karten.mitte[2];
  assert.ok(Math.abs(w.mitte[0] - (2 * z + 100)) < 1e-3 && Math.abs(w.mitte[1] - (2 * y + 5)) < 1e-3 && Math.abs(w.mitte[2] - (-2 * x - 20)) < 1e-3);
  assert.ok(Math.abs(w.daten[0] - 2 * karten.daten[0]) < 1e-4);
  assert.ok(Math.abs(Math.hypot(w.normale[0], w.normale[1], w.normale[2]) - 1) < 1e-4);
});
