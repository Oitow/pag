import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeltRegionen } from './welt-regionen.js';

const k = createWeltRegionen({ seed: 1207 });

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
