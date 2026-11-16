import test from 'node:test';
import assert from 'node:assert/strict';
import { createFigurLod, lookZuLod, baueLodGeometrie, LOD_DREIECKE } from './character-lod.js';
import { VORLAGEN, randomLook } from './character-look.js';

test('Form: 150–360 Dreiecke (alle Schalter; aktiv ~250), gültige Zahlen, Füße bei 0', () => {
  assert.ok(LOD_DREIECKE >= 150 && LOD_DREIECKE <= 360, 'Dreiecke ' + LOD_DREIECKE);
  const g = baueLodGeometrie();
  assert.ok(g.pos.every(Number.isFinite));
  assert.equal(g.slot.length * 3, g.pos.length);
  assert.equal(Math.min(...g.pos.filter((_, i) => i % 3 === 1)), 0);
});

test('lookZuLod: Farben, Schalter, Maße aus dem Look', () => {
  const m = lookZuLod(VORLAGEN.magier);
  assert.equal(m.farben.length, 7); assert.equal(m.flags.length, 6);
  assert.equal(m.flags[4], 1, 'Robe'); assert.equal(m.flags[0] + m.flags[1], 1, 'ein Hut'); assert.equal(m.flags[1], 1, 'Zauberhut = Krempe');
  assert.equal(lookZuLod(VORLAGEN.schmied).flags[2], 0, 'Glatze/Bandana: kein Haar');
  assert.equal(lookZuLod(VORLAGEN.baeuerin).flags[5], 1, 'Rock');
  assert.ok(lookZuLod(VORLAGEN.kind).hoehe < lookZuLod(VORLAGEN.ritter).hoehe);
  assert.deepEqual(lookZuLod(VORLAGEN.ritter), lookZuLod(VORLAGEN.ritter));
  for (let i = 0; i < 30; i++) { const d = lookZuLod(randomLook(i)); assert.ok(d.farben.every((c) => c >= 0 && c <= 0xffffff) && d.hoehe > 0.5); }
});

test('createFigurLod: setze/entferne/sichtbar, Grenze max, ein Objekt', () => {
  const lod = createFigurLod({ max: 3 });
  const pos = { x: 1, y: 2, z: 3 };
  lod.setze('a', { look: VORLAGEN.wache, pos, yaw: 1, tempo: 1 });
  lod.setze('b', { look: VORLAGEN.kind, pos });
  lod.setze('c', { look: VORLAGEN.punk, pos });
  lod.setze('d', { look: VORLAGEN.pirat, pos });   // über max: ignoriert
  lod.update(0.016, 1);
  assert.equal(lod.anzahl, 3);
  lod.setze('b', { pos, sichtbar: false }); lod.update(0.016, 1.1);
  assert.equal(lod.anzahl, 2);
  lod.entferne('a'); lod.update(0.016, 1.2);
  assert.equal(lod.anzahl, 1);
  const m = lod.objekt.instanceMatrix.array; assert.ok(Array.from(m.slice(0, 16)).every(Number.isFinite));
  assert.ok(lod.objekt.isInstancedMesh);
  lod.dispose();
});
