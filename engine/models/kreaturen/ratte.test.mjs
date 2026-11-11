import test from 'node:test';
import assert from 'node:assert/strict';
import { createRatte } from './ratte.js';

const dreiecke = (g) => g.attributes.position.count / 3;
const box = (g) => { g.computeBoundingBox(); return g.boundingBox; };

test('zwei Bilder mit position/normal/color', () => {
  const r = createRatte({ seed: 1 });
  assert.equal(r.frames.length, 2);
  for (const g of r.frames) {
    assert.ok(g.attributes.position && g.attributes.normal && g.attributes.color);
    assert.equal(g.attributes.color.count, g.attributes.position.count);
  }
  r.dispose();
});

test('Bounding-Box: Füße auf 0, Nase vorn, Schwanz nach hinten', () => {
  const r = createRatte({ seed: 1 });
  for (const g of r.frames) {
    const bb = box(g);
    assert.ok(Math.abs(bb.min.y) <= 0.02, 'min.y ' + bb.min.y);
    assert.ok(Math.abs(bb.max.z - r.laenge / 2) <= r.laenge / 2 * 0.2, 'Nase ' + bb.max.z);
    assert.ok(bb.min.z < -r.laenge * 0.8 / 2 - 0.05 && bb.min.z < -0.35 * r.laenge, 'Schwanz ' + bb.min.z);
  }
  assert.ok(r.hoehe > 0 && r.breite > 0 && r.laenge === 0.5);
});

test('höchstens 260 Dreiecke je Bild', () => {
  for (const g of createRatte({ seed: 3 }).frames) assert.ok(dreiecke(g) <= 260, String(dreiecke(g)));
});

test('deterministisch per Seed; Bild 0 ≠ Bild 1', () => {
  const a = createRatte({ seed: 5 }), b = createRatte({ seed: 5 });
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(Array.from(a.frames[i].attributes.position.array), Array.from(b.frames[i].attributes.position.array));
    assert.deepEqual(Array.from(a.frames[i].attributes.color.array), Array.from(b.frames[i].attributes.color.array));
  }
  assert.notDeepEqual(Array.from(a.frames[0].attributes.position.array), Array.from(a.frames[1].attributes.position.array));
  const c = createRatte({ seed: 6 });
  assert.notDeepEqual(Array.from(a.frames[0].attributes.color.array), Array.from(c.frames[0].attributes.color.array));
});

test('laenge skaliert das ganze Tier', () => {
  const k = box(createRatte({ laenge: 0.5 }).frames[0]), g = box(createRatte({ laenge: 1 }).frames[0]);
  assert.ok(Math.abs(g.max.z / k.max.z - 2) < 1e-4);
  assert.ok(Math.abs(g.max.y / k.max.y - 2) < 0.05);
});

test('dispose wirft nicht', () => {
  assert.doesNotThrow(() => createRatte().dispose());
});
