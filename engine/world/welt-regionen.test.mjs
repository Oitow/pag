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


test('Kartenrand: Ost/Süd fällt ins Meer, West/Nord steigt zur Kette', () => {
  assert.ok(k.hoehe(2150, 300) < 0 && k.wasserHoehe(2150, 300) === 0, 'Ost: Meer');
  assert.ok(k.hoehe(0, 2150) < 0, 'Süd: Meer');
  assert.ok(k.hoehe(-2100, 300) > k.hoehe(-1500, 300) + 100, 'West: Kette');
  assert.ok(k.hoehe(0, -2100) > k.hoehe(0, -1300) + 50, 'Nord: Kette');
});

test('Fluss: hat Wasser, fällt, Furt ist flach und flach überquerbar', () => {
  const p = k.fluss.proben;
  assert.ok(p.length > 100 && p[0].y > p[p.length - 1].y);
  for (let i = 1; i < p.length; i++) assert.ok(p[i].y <= p[i - 1].y + 1e-9, 'Wasserspiegel steigt nie');
  for (const q of p.filter((_, i) => i % 10 === 0)) assert.ok(k.wasserHoehe(q.x, q.z) !== null, 'Wasser in der Flussmitte');
  const f = k.ort('furt'), w = k.wasserHoehe(f.x, f.z);
  assert.ok(w !== null && w - k.hoehe(f.x, f.z) <= 0.5, 'Furt: höchstens 0.5 m tief');
  assert.ok(k.abstandZumWeg(f.x, f.z) < 3, 'Weg führt durch die Furt');
  for (let a = 0; a < 6.28; a += 0.5) assert.ok(Math.abs(k.hoehe(f.x + Math.cos(a) * 3, f.z + Math.sin(a) * 3) - k.hoehe(f.x, f.z)) < 1.2, 'flach');
});

test('Wolfsfels: flach, trocken, am Weg erreichbar', () => {
  const o = k.ort('wolfsfels'); assert.equal(o.art, 'boss'); assert.equal(o.stufe, 10); assert.equal(o.radius, 22);
  const h0 = k.hoehe(o.x, o.z);
  for (let a = 0; a < 6.28; a += 0.6) for (const r of [8, 20]) {
    const x = o.x + Math.cos(a) * r, z = o.z + Math.sin(a) * r;
    assert.ok(Math.abs(k.hoehe(x, z) - h0) < 1.5 && k.wasserHoehe(x, z) === null);
  }
  assert.ok(k.abstandZumWeg(o.x, o.z) < 3 && k.wege.find((w) => w.id === 'wolfsweg'));
});

test('alte Orte unverändert, Lager mit Stufe', () => {
  const alt = { start: [15, 1858], tor: [0, 1480], lichtung: [-20, 1180], siedlung: [0, 600], 'lager-moor': [-1220, 500], 'lager-hochland': [330, 60], ruine: [680, -240], gipfel: [260, -1480] };
  for (const [id, [x, z]] of Object.entries(alt)) assert.deepEqual([k.ort(id).x, k.ort(id).z], [x, z], id);
  assert.equal(k.ort('lager-moor').stufe, 6); assert.equal(k.ort('lager-hochland').stufe, 4);
  assert.ok(k.ort('aussicht-moor'));
});

test('Determinismus je Seed', () => {
  const a = createWeltRegionen({ seed: 5 }), b = createWeltRegionen({ seed: 5 }), c = createWeltRegionen({ seed: 6 });
  for (const [x, z] of [[100, -200], [-1300, 400], [195, -190], [900, 200]]) assert.equal(a.hoehe(x, z), b.hoehe(x, z));
  assert.notEqual(a.hoehe(100, -200), c.hoehe(100, -200));
});
