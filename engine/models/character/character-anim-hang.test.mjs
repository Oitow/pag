import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createRig } from './character-rig.js';
import { koerperMasse } from './character-look.js';
import { leerePose, wendeAn } from './character-pose.js';
import { fussZiele, gangPose } from './character-gang.js';
import { hangMessen, hangAnpassen } from './character-anim-hang.js';

const nah = (a, b, e = 1e-6) => Math.abs(a - b) < e;

test('hangMessen: direkte Werte, Normale und bodenHoehe ergeben dieselbe Steigung (auch gedreht)', () => {
  assert.deepEqual(hangMessen({ hangVor: 0.3, hangSeite: -0.1 }), { vor: 0.3, seit: -0.1 });
  const boden = (x, z) => 0.2 * x + 0.5 * z;                  // Welt: steigt nach +Z und +X
  for (const yaw of [0, Math.PI / 2, 2]) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw);
    const erw = { vor: 0.2 * fx + 0.5 * fz, seit: 0.2 * lx + 0.5 * lz };
    const a = hangMessen({ pos: { x: 3, y: 0, z: 1 }, yaw }, boden);
    const l = Math.hypot(0.2, 0.5, 1);
    const b = hangMessen({ yaw, bodenNormal: { x: -0.2 / l, y: 1 / l, z: -0.5 / l } });
    assert.ok(nah(a.vor, erw.vor) && nah(a.seit, erw.seit), `bodenHoehe yaw ${yaw}`);
    assert.ok(nah(b.vor, erw.vor) && nah(b.seit, erw.seit), `Normale yaw ${yaw}`);
  }
  assert.deepEqual(hangMessen({}), { vor: 0, seit: 0 });
  assert.equal(hangMessen({ hangVor: 9 }).vor, 1.2, 'begrenzt');
});

test('hangAnpassen: Füße stehen auf der schrägen Ebene, Hüfte sinkt, Rumpf lehnt bergauf', () => {
  const m = koerperMasse({}), rig = createRig(m), p = new THREE.Vector3();
  const g = { phase: 0, tempo: 0, idleW: 1 };
  for (const [vor, seit] of [[0.4, 0], [-0.4, 0.3], [0, -0.5]]) {
    const z = fussZiele(m, g, {});
    const y0 = z.basisY;
    const { lehne } = hangAnpassen(m, z, vor, seit, 1);
    assert.ok(z.basisY <= y0 + 1e-9, 'Hüfte nicht höher');
    assert.ok(Math.sign(lehne) === Math.sign(vor) || vor === 0);
    const pose = gangPose(m, g, z, leerePose());
    wendeAn(rig, pose); rig.root.updateMatrixWorld(true);
    for (const f of ['fussL', 'fussR']) {
      rig.knochen[f].getWorldPosition(p);
      const ueber = p.y - (p.z * vor + p.x * seit);
      assert.ok(Math.abs(ueber - (m.fussHoehe - 0.02)) < 0.03, `${f} ${ueber.toFixed(3)} über dem Hang (${vor},${seit})`);
    }
  }
  const z = fussZiele(m, g, {});
  hangAnpassen(m, z, 0.5, 0.5, 0);
  assert.equal(z.L.roll, 0);
});
