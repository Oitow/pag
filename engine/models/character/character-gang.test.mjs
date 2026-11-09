import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRig } from './character-rig.js';
import { koerperMasse, VORLAGEN } from './character-look.js';
import { leerePose, wendeAn, GANZ } from './character-pose.js';
import { schrittWeite, stuetzAnteil, fussZiele, loeseBein, gangPose, luftPose, schwimmPose } from './character-gang.js';

const p = new THREE.Vector3();

test('schrittWeite: beim Gehtempo = masse.schrittLaenge, wächst mit Tempo', () => {
  const m = koerperMasse({});
  assert.ok(Math.abs(schrittWeite(m, 1.8) - m.schrittLaenge) < 1e-9);
  assert.ok(schrittWeite(m, 5.5) > schrittWeite(m, 1.8) && schrittWeite(m, 8) > schrittWeite(m, 5.5));
  assert.ok(stuetzAnteil(0) > 0.5 && stuetzAnteil(1) < 0.5);
});

test('Bein-IK: Knöchel landet auf dem Ziel (auch mit gekipptem Becken)', () => {
  for (const look of [{}, VORLAGEN.kind, VORLAGEN.ritter]) {
    const m = koerperMasse(look), rig = createRig(m), pose = leerePose();
    pose.basisPos.y = -0.12; pose.becken.x = 0.3; pose.becken.z = 0.05;
    const ziel = { x: m.beckenBreite + 0.03, y: m.fussHoehe + 0.05, z: 0.25, neig: 0 };
    loeseBein(m, pose, 'L', ziel);
    const zr = { x: -m.beckenBreite, y: m.fussHoehe, z: -0.2, neig: 0.2 };
    loeseBein(m, pose, 'R', zr);
    wendeAn(rig, pose);
    rig.root.updateMatrixWorld(true);
    rig.knochen.fussL.getWorldPosition(p);
    assert.ok(p.distanceTo(new THREE.Vector3(ziel.x, ziel.y, ziel.z)) < 0.03, `L ${p.toArray()}`);
    rig.knochen.fussR.getWorldPosition(p);
    assert.ok(p.distanceTo(new THREE.Vector3(zr.x, zr.y, zr.z)) < 0.03, `R ${p.toArray()}`);
    assert.ok(pose.knieL.x > 0, 'Knie beugt nach hinten (+)');
    // Fuß flach: Zehen-Richtung waagerecht (L), R Zehen hoch
    const zehe = new THREE.Vector3(0, 0, 1).transformDirection(rig.knochen.fussL.matrixWorld);
    assert.ok(Math.abs(zehe.y) < 0.12, `Fuß L flach ${zehe.y}`);
    const zr2 = new THREE.Vector3(0, 0, 1).transformDirection(rig.knochen.fussR.matrixWorld);
    assert.ok(zr2.y > 0.1, 'neig + = Zehen hoch');
  }
});

test('Gang-, Luft- und Schwimmposen sind endlich', () => {
  const m = koerperMasse({}), z = {};
  for (let ph = 0; ph < 2; ph += 0.05) {
    for (const [laufW, duckW, rutschW, idleW] of [[0, 0, 0, 0], [1, 0, 0, 0], [0.5, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]) {
      const g = { phase: ph, tempo: 1 + laufW * 5, laufW, sprintW: 0, idleW, duckW, rutschW, zeit: ph };
      const pose = gangPose(m, g, fussZiele(m, g, z));
      for (const k of GANZ) assert.ok(Number.isFinite(pose[k].x + pose[k].y + pose[k].z), k);
    }
    const l = luftPose(Math.sin(ph * 3)), s = schwimmPose(m, ph, ph / 2, 0.7);
    for (const k of GANZ) assert.ok(Number.isFinite(l[k].x + s[k].x + s[k].y + s[k].z), k);
  }
});
