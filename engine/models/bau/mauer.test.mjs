import test from 'node:test';
import assert from 'node:assert/strict';
import { createMauer, createMauerTurm, createTorhaus, createTorfluegel } from './mauer.js';
import { pruefeAsset } from './gebaeude-pruefen.mjs';
pruefeAsset('mauer', createMauer, { budget: 250 });
pruefeAsset('mauer sx 1.5', (o) => createMauer({ ...o, sx: 1.5 }), { budget: 300 });
pruefeAsset('mauerturm', createMauerTurm, { budget: 400, anker: ['fackeln'] });
pruefeAsset('torhaus', createTorhaus, { budget: 1200, anker: ['tuer', 'fluegel', 'wachen', 'fackeln'] });
pruefeAsset('torfluegel', createTorfluegel, { budget: 150 });
test('torhaus: Durchgang frei (kein Körper bei |x| < 2.3 unter y 4.2), 2 Flügel, 2 Wachen', () => {
  const t = createTorhaus();
  for (const k of t.kollision) {
    const ueberlappt = k.form === 'kasten' ? Math.abs(k.x) - k.bx < 2.3 : Math.abs(k.x) - k.radius < 2.3;
    if (ueberlappt) assert.ok(k.y0 >= 4.2 - 1e-9, `Körper blockiert den Durchgang: ${JSON.stringify(k)}`);
  }
  assert.equal(t.anker.fluegel.length, 2);
  assert.equal(t.anker.wachen.length, 2);
  assert.equal(t.anker.fackeln.length, 2);
});
test('mauer: sx streckt in x, genau ein Kollisions-Kasten', () => {
  const m = createMauer({ sx: 2 });
  assert.equal(m.masse.breite, 12);
  assert.equal(m.kollision.length, 1);
});
test('torfluegel: zentriert x ±1.2, y 0…4.1', () => {
  const f = createTorfluegel(); f.geometrie.computeBoundingBox();
  const b = f.geometrie.boundingBox;
  assert.ok(Math.abs(b.min.x + 1.2) < 0.01 && Math.abs(b.max.x - 1.2) < 0.01 && Math.abs(b.min.y) < 0.01 && Math.abs(b.max.y - 4.1) < 0.01);
});
