import test from 'node:test';
import assert from 'node:assert/strict';
import { planeRiesenwald, wegAbstand, wegPunkt, wegLaenge } from './riesenwald-plan.js';

// Weg nach Norden (−z) mit Knick, Gebiet = Band z ∈ [−700, −100]
const WEG = [{ x: 0, z: -80 }, { x: 10, z: -300 }, { x: -20, z: -520 }, { x: 0, z: -720 }];
const VAR = [{ radius: 4.2, weite: 16 }, { radius: 5.6, weite: 21 }, { radius: 3.2, weite: 12 }, { radius: 6, weite: 23 }];
const imGebiet = (x, z) => z < -100 && z > -700 && Math.abs(x) < 300;
const opts = { wege: [WEG], imGebiet, varianten: VAR, seed: 5, tor: { x: 2, z: -120 }, lichtung: { x: -10, z: -600, radius: 25 } };

test('Weg-Helfer: Länge, Punkt, Abstand', () => {
  assert.ok(Math.abs(wegLaenge([{ x: 0, z: 0 }, { x: 3, z: 4 }]) - 5) < 1e-9);
  const p = wegPunkt([{ x: 0, z: 0 }, { x: 0, z: -10 }], 4);
  assert.deepEqual([p.x, p.z, p.rx, p.rz], [0, -4, 0, -1]);
  assert.ok(Math.abs(wegAbstand([WEG], -30, -80).d - 30) < 1e-9);
});

test('deterministisch, Weg bleibt frei, alles im Gebiet, Abstände gehalten', () => {
  const a = planeRiesenwald(opts), b = planeRiesenwald(opts);
  assert.deepEqual(a, b);
  assert.ok(a.riesen.length > 40, 'genug Riesen: ' + a.riesen.length);
  for (const r of a.riesen) {
    assert.ok(imGebiet(r.x, r.z));
    assert.ok(wegAbstand([WEG], r.x, r.z).d > 1.5 + r.radius + 1, 'Stamm auf dem Weg');
    assert.ok(Math.hypot(r.x + 10, r.z + 600) > 25 + r.radius, 'Stamm auf der Lichtung');
  }
  for (let i = 0; i < a.riesen.length; i++) for (let j = i + 1; j < a.riesen.length; j++) {
    const p = a.riesen[i], q = a.riesen[j];
    assert.ok(Math.hypot(p.x - q.x, p.z - q.z) > p.radius + q.radius + 8, 'Stämme verwachsen');
  }
  // beide Wegseiten besetzt
  assert.ok(a.riesen.some((r) => r.seite > 0) && a.riesen.some((r) => r.seite < 0));
});

test('Tor: je ein Riese links und rechts, nah am Weg', () => {
  const { tor } = planeRiesenwald(opts);
  assert.ok(tor && tor.links && tor.rechts);
  for (const r of [tor.links, tor.rechts]) {
    const d = wegAbstand([WEG], r.x, r.z).d - r.radius;
    assert.ok(d > 1.5 && d < 6, 'Stammrand ' + d.toFixed(1) + ' m vom Weg');
  }
  assert.ok(Math.sign(tor.links.x - tor.x) !== Math.sign(tor.rechts.x - tor.x));
  // ohne Tor / ohne Wege: kein Absturz
  assert.equal(planeRiesenwald({ ...opts, tor: null }).tor, null);
  assert.equal(planeRiesenwald({ ...opts, wege: [] }).riesen.length >= 0, true);
});
