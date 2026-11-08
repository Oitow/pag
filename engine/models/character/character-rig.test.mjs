import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRig, KNOCHEN, SOCKEL } from './character-rig.js';
import { koerperMasse, VORLAGEN } from './character-look.js';

test('Rig hat alle Knochen und Sockel, Kopf-Scheitel = Körperhöhe', () => {
  const m = koerperMasse({});
  const rig = createRig(m);
  for (const k of KNOCHEN) assert.ok(rig.knochen[k] instanceof THREE.Group, k);
  for (const s of Object.keys(SOCKEL)) assert.ok(rig.sockel[s], s);
  rig.root.updateMatrixWorld(true);
  const p = new THREE.Vector3();
  rig.sockel.kopf.getWorldPosition(p);
  assert.ok(Math.abs(p.y - m.hoehe) < 1e-6, `Scheitel ${p.y} ≠ ${m.hoehe}`);
  rig.knochen.fussL.getWorldPosition(p);
  assert.ok(Math.abs(p.y - m.fussHoehe + 0.02 * m.hoehe / 1.75) < 1e-6, 'Knöchel auf Fußhöhe');
  assert.ok(p.x > 0, 'links = +X');
});
test('Drehsinn: Hüfte negativ → Bein nach vorn; anpassen ändert Maße', () => {
  const rig = createRig(koerperMasse({}));
  rig.knochen.huefteL.rotation.x = -0.6;
  rig.root.updateMatrixWorld(true);
  const p = new THREE.Vector3();
  rig.knochen.fussL.getWorldPosition(p);
  assert.ok(p.z > 0.2);
  rig.ruhepose().anpassen(koerperMasse(VORLAGEN.kind));
  rig.root.updateMatrixWorld(true);
  rig.sockel.kopf.getWorldPosition(p);
  assert.ok(p.y < 1.3);
});
