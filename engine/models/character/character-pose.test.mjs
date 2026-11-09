import test from 'node:test';
import assert from 'node:assert/strict';
import { createRig, KNOCHEN } from './character-rig.js';
import { koerperMasse } from './character-look.js';
import {
  POSE_KNOCHEN, GANZ, OBERKOERPER, UNTERKOERPER, BEINE, ARM_R, leerePose, kopierePose, mischePose, addierePose, maskiere, wendeAn,
} from './character-pose.js';

test('leerePose: alle Knochen des Rigs + basisPos, alles 0', () => {
  assert.deepEqual([...POSE_KNOCHEN].sort(), [...KNOCHEN].sort());
  const p = leerePose();
  for (const k of GANZ) assert.deepEqual(p[k], { x: 0, y: 0, z: 0 }, k);
});

test('kopieren, mischen, addieren (fehlende Kanäle = 0)', () => {
  const a = { torso: { x: 1, y: 0, z: 0 }, basisPos: { x: 0, y: -0.2, z: 0 } };
  const b = { torso: { x: 3, y: 2, z: 0 }, knieL: { x: 1, y: 0, z: 0 } };
  const k = kopierePose(a);
  assert.equal(k.torso.x, 1); assert.equal(k.knieL.x, 0); assert.equal(k.basisPos.y, -0.2);
  const m = mischePose(a, b, 0.5);
  assert.equal(m.torso.x, 2); assert.equal(m.torso.y, 1); assert.equal(m.knieL.x, 0.5); assert.ok(Math.abs(m.basisPos.y + 0.1) < 1e-12);
  const s = addierePose(a, b, 0.5);
  assert.equal(s.torso.x, 2.5); assert.equal(s.knieL.x, 0.5);
  const nan = mischePose({ torso: { x: NaN } }, b, 0.5);
  assert.equal(nan.torso.x, 1.5, 'NaN wird als 0 behandelt');
});

test('Maske: mischen nur im Oberkörper, maskiere nullt den Rest', () => {
  const a = leerePose(); a.knieL.x = 0.7; a.torso.x = 0.1;
  const b = leerePose(); b.knieL.x = 2; b.torso.x = 1; b.schulterR.x = -1;
  const out = mischePose(a, b, 1, leerePose(), OBERKOERPER);
  assert.equal(out.torso.x, 1); assert.equal(out.schulterR.x, -1); assert.equal(out.knieL.x, 0.7);
  // out === a (an Ort und Stelle)
  mischePose(a, b, 0.5, a, ARM_R);
  assert.equal(a.schulterR.x, -0.5); assert.equal(a.knieL.x, 0.7);
  maskiere(b, UNTERKOERPER);
  assert.equal(b.torso.x, 0); assert.equal(b.knieL.x, 2);
  for (const k of BEINE) assert.ok(UNTERKOERPER.includes(k));
  for (const k of OBERKOERPER) assert.ok(!UNTERKOERPER.includes(k));
});

test('wendeAn setzt Rotationen und basis-Position am Rig', () => {
  const rig = createRig(koerperMasse({}));
  const p = leerePose(); p.schulterR.x = -0.8; p.knieL.x = 0.5; p.basisPos.y = -0.1;
  wendeAn(rig, p);
  assert.equal(rig.knochen.schulterR.rotation.x, -0.8);
  assert.equal(rig.knochen.knieL.rotation.x, 0.5);
  assert.equal(rig.knochen.basis.position.y, -0.1);
  wendeAn(rig, {});                                   // Teil-Pose → Ruhe
  assert.equal(rig.knochen.schulterR.rotation.x, 0);
});
