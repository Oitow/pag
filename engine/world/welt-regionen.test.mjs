import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeltRegionen } from './welt-regionen.js';
import { streuKachel } from './welt-streu.js';

const k = createWeltRegionen({ seed: 1207 });

test('welt-regionen: Karte wie im Vertrag', () => {
  for (const id of ['start', 'tor', 'lichtung', 'siedlung', 'lager-moor', 'lager-hochland', 'ruine', 'gipfel']) assert.ok(k.ort(id), id);
  const r = (id) => k.region(k.ort(id).x, k.ort(id).z).id;
  assert.equal(r('start'), 'kueste'); assert.equal(r('lichtung'), 'daemmerwald'); assert.equal(r('siedlung'), 'erlenwacht');
  assert.equal(r('lager-moor'), 'moor'); assert.equal(r('gipfel'), 'gebirge');
  assert.equal(k.wasserHoehe(0, 2050), 0, 'Meer im Süden');
  assert.equal(k.wasserHoehe(0, 600), null);
  const g = k.hoehe(k.ort('gipfel').x, k.ort('gipfel').z);
  assert.ok(g > 300 && g < 400, 'Gipfel ~350 m');
  assert.equal(k.hoehe(123.4, -55.5), createWeltRegionen({ seed: 1207 }).hoehe(123.4, -55.5), 'deterministisch');
  // Weg: quer flach, Abstand stimmt
  const w = k.wege[0];
  assert.ok(k.abstandZumWeg(w[3].x, w[3].z) < 0.01);
  assert.ok(Math.abs(k.hoehe(w[4].x + 1.5, w[4].z) - k.hoehe(w[4].x - 1.5, w[4].z)) < 0.3);
});

test('welt-streu: deterministisch, nicht auf dem Weg, gesperrt bleibt leer', () => {
  const kachel = { x0: -64, z0: 1152, groesse: 64, cx: -1, cz: 18 };
  const a = streuKachel(k, kachel, { art: 'gross', seed: 3 }), b = streuKachel(k, kachel, { art: 'gross', seed: 3 });
  assert.ok(a.length > 5); assert.deepEqual(a, b);
  assert.ok(a.every((o) => k.abstandZumWeg(o.x, o.z) > 3));
  assert.equal(streuKachel(k, kachel, { art: 'gross', seed: 3, frei: () => false }).length, 0);
});
