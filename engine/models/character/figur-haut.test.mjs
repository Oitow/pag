import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterModel } from './character-model.js';
import { VORLAGEN } from './character-look.js';

test('organischer Körper: ein SkinnedMesh, Gewichte normiert, Füße am Boden, Rig unverändert', () => {
  const m = createCharacterModel({ look: VORLAGEN.wanderer, koerper: 'organisch', zelle: 0.02 });
  const haut = m.meshes.find((x) => x.isSkinnedMesh);
  assert.ok(haut && m.haut.dreiecke > 1000);
  const g = haut.geometry, w = g.attributes.skinWeight, p = g.attributes.position;
  let minY = Infinity;
  for (let i = 0; i < w.count; i++) {
    assert.ok(Math.abs(w.getX(i) + w.getY(i) + w.getZ(i) + w.getW(i) - 1) < 1e-4);
    minY = Math.min(minY, p.getY(i));
  }
  assert.ok(minY > -0.03 && minY < 0.05, `Sohle bei ${minY}`);
  assert.equal(m.rig.knochen.schulterL.rotation.z, 0, 'Bindungs-Pose wurde zurückgesetzt');
  assert.ok(!m.meshes.some((x) => x.name === 'torso'), 'keine Block-Teile im Netz-Bereich');
  m.setKoerper('bloecke');
  assert.ok(m.meshes.some((x) => x.name === 'torso') && !m.meshes.some((x) => x.isSkinnedMesh));
  m.dispose();
});
