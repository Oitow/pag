import test from 'node:test';
import assert from 'node:assert/strict';
import { createReaktion, richtungLokal } from './character-reaktion.js';
import { leerePose, GANZ } from './character-pose.js';

const DT = 1 / 60;
const endlich = (p) => GANZ.every((k) => ['x', 'y', 'z'].every((a) => Number.isFinite(p[k][a])));

test('Treffer von vorn kippt den Rumpf nach hinten, von links nach rechts; klingt ab', () => {
  const re = createReaktion({ seed: 1 });
  re.treffer({ x: 0, z: -1 }, 1);
  let min = 0;
  for (let t = 0; t < 0.2; t += DT) min = Math.min(min, re.update(DT).torso.x);
  assert.ok(min < -0.1, `torso.x ${min}`);
  for (let t = 0; t < 3; t += DT) re.update(DT);
  assert.ok(!re.aktiv && Math.abs(re.pose.torso.x) < 1e-3, 'abgeklungen');
  re.treffer({ x: -1, z: 0 }, 1);              // nach rechts (−X) gedrückt → Oberkörper kippt nach −X → torso.z > 0
  let max = 0;
  for (let t = 0; t < 0.2; t += DT) max = Math.max(max, re.update(DT).torso.z);
  assert.ok(max > 0.1 && re.aktiv);
  const p = leerePose(); re.anwenden(p, 1); assert.ok(p.torso.z > 0);
});

test('Stärke skaliert den Ausschlag; Unsinn bleibt endlich', () => {
  const peak = (s) => { const re = createReaktion({ seed: 2 }); re.treffer({ z: 1 }, s); let m = 0; for (let t = 0; t < 0.3; t += DT) m = Math.max(m, re.update(DT).torso.x); return m; };
  assert.ok(peak(1) > peak(0.3) * 1.5);
  const re = createReaktion();
  re.treffer(null, NaN); re.treffer({ x: NaN, z: Infinity }, 99);
  for (let t = 0; t < 1; t += DT) assert.ok(endlich(re.update(DT)));
});

test('Umfallen: kippt in Stoßrichtung bis flach, prallt, liegt; aufstehen blendet aus', () => {
  for (const [d, kanal, vz] of [[{ x: 0, z: 1 }, 'x', 1], [{ x: 0, z: -1 }, 'x', -1], [{ x: 1, z: 0 }, 'z', -1]]) {
    const re = createReaktion({ seed: 3 });
    re.umfallen(d, { staerke: 1 });
    assert.ok(re.faellt && !re.liegt);
    let t = 0;
    for (; t < 4 && !re.liegt; t += DT) { re.update(DT); assert.ok(endlich(re.fallPose())); }
    assert.ok(re.liegt && t < 2.5, `liegt nach ${t.toFixed(2)} s`);
    const p = re.fallPose();
    assert.ok(Math.abs(p.basis[kanal] - 1.5 * vz) < 0.05, `${kanal}=${p.basis[kanal]}`);
    assert.ok(re.fallGewicht > 0.99 && re.aufprall > 0);
    re.aufstehen(0.5);
    for (let i = 0; i < 60; i++) re.update(DT);
    assert.ok(!re.faellt && re.fallGewicht === 0);
  }
});

test('richtungLokal: Weltrichtung der Blickrichtung → +Z', () => {
  for (const yaw of [0, 1, -2.5]) {
    const l = richtungLokal({ x: Math.sin(yaw), z: Math.cos(yaw) }, yaw);
    assert.ok(Math.abs(l.x) < 1e-9 && Math.abs(l.z - 1) < 1e-9);
  }
  const re = createReaktion(); re.umfallen({ z: 1 }); re.reset(); assert.ok(!re.faellt); re.dispose();
});
