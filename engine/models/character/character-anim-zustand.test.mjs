import test from 'node:test';
import assert from 'node:assert/strict';
import { createZustandsSchicht } from './character-anim-zustand.js';
import { leerePose, GANZ } from './character-pose.js';

const DT = 1 / 60;
const endlich = (p) => GANZ.every((k) => ['x', 'y', 'z'].every((a) => Number.isFinite(p[k][a]) && Math.abs(p[k][a]) < 7));

test('Rolle folgt rollAnteil, Salto dreht einmal um die Körpermitte, Landung bricht ab', () => {
  const zs = createZustandsSchicht();
  for (let i = 0; i <= 30; i++) { zs.update(DT, { rollt: true, rollAnteil: i / 30 }); assert.ok(endlich(zs.anwenden(leerePose()))); }
  assert.ok(zs.rolleW > 0.9 && zs.uebersteuert > 0.9);
  for (let t = 0; t < 1; t += DT) zs.update(DT, {});
  assert.ok(zs.rolleW < 0.01);
  zs.update(DT, { amBoden: false, doppelSprung: true });
  let maxB = 0;
  for (let t = 0; t < 0.45; t += DT) { zs.update(DT, { amBoden: false }); const p = zs.anwenden(leerePose()); maxB = Math.max(maxB, Math.abs(p.basis.x)); assert.ok(endlich(p)); }
  assert.ok(maxB > 2.5 && zs.saltoW === 1);
  zs.update(DT, { amBoden: true });
  assert.equal(zs.saltoW, 0);
});

test('Gleiten breitet die Arme, Kante rudert, betäubt taumelt (mit Ausdruck)', () => {
  const zs = createZustandsSchicht();
  for (let t = 0; t < 1; t += DT) zs.update(DT, { amBoden: false, gleitet: true });
  assert.ok(zs.anwenden(leerePose()).schulterL.z > 1.2);
  zs.update(DT, { anKante: true });
  assert.equal(zs.ausdruck, 'erschrocken');
  assert.ok(zs.anwenden(leerePose()).torso.x < 0);
  for (let t = 0; t < 2; t += DT) zs.update(DT, { betaeubt: 1 });
  assert.equal(zs.ausdruck, 'benommen');
  assert.ok(zs.anwenden(leerePose()).hals.x > 0.2);
  zs.dispose(); assert.equal(zs.uebersteuert, 0);
});
