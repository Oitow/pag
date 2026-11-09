import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlick } from './character-anim-blick.js';
import { leerePose } from './character-pose.js';

const DT = 1 / 60;

test('Richtung: Kopf dreht bis zur Grenze, Augen decken den Rest und eilen voraus', () => {
  const b = createBlick({ seed: 1, blinzeln: false });
  b.zu({ x: 1, y: 0, z: 0 });
  b.update(DT * 3, {});
  assert.ok(b.augenYaw > 0.1 && b.augenYaw > 0.6 * b.yaw, 'Augen eilen voraus');
  for (let t = 0; t < 2; t += DT) b.update(DT, {});
  assert.ok(Math.abs(b.yaw - 1.3) < 0.01 && b.augenYaw > 0.2, `yaw ${b.yaw} augen ${b.augenYaw}`);
  const p = b.anwenden(leerePose());
  assert.ok(p.kopf.y > 0.5 && p.hals.y > 0 && p.torso.y > 0);
  b.zu({ x: 0, y: -1, z: 1 });
  for (let t = 0; t < 2; t += DT) b.update(DT, {});
  assert.ok(b.nick > 0.5 && Math.abs(b.yaw) < 0.01, 'nach unten = nicken (+)');
});

test('Weltpunkt nutzt pos/yaw; ohne Ziel folgt das Umsehen (idleW)', () => {
  const b = createBlick({ seed: 2, blinzeln: false });
  b.zuPunkt({ x: 5, y: 1.6, z: 0 });
  const z = { pos: { x: 0, y: 0, z: 0 }, yaw: Math.PI / 2 };   // blickt nach +X → Punkt liegt vorn
  for (let t = 0; t < 2; t += DT) b.update(DT, { zustand: z, augenHoehe: 1.6 });
  assert.ok(Math.abs(b.yaw) < 0.01 && Math.abs(b.nick) < 0.01 && b.hatZiel);
  b.zuPunkt(null);
  for (let t = 0; t < 3; t += DT) b.update(DT, { idleW: 1, umsehYaw: -0.5 });
  assert.ok(Math.abs(b.yaw + 0.5) < 0.02 && !b.hatZiel);
});

test('Blinzeln: deterministisch per Seed, Lid 0…1', () => {
  const lauf = (seed) => { const b = createBlick({ seed }); const zeiten = []; let maxLid = 0;
    for (let i = 0; i < 1200; i++) { b.update(DT, {}); if (b.geblinzelt) zeiten.push(i); maxLid = Math.max(maxLid, b.lid); }
    return { zeiten, maxLid }; };
  const a = lauf(5), c = lauf(5);
  assert.deepEqual(a.zeiten, c.zeiten);
  assert.ok(a.zeiten.length >= 2 && a.maxLid > 0.8 && a.maxLid <= 1);
  createBlick().dispose();
});
