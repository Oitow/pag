import test from 'node:test';
import assert from 'node:assert/strict';
import { createReh } from './reh.js';

const box = (g) => { g.computeBoundingBox(); return g.boundingBox; };

test('zwei Bilder mit position/normal/color, höchstens 500 Dreiecke', () => {
  const t = createReh({ seed: 1 });
  assert.equal(t.frames.length, 2);
  for (const g of t.frames) {
    assert.ok(g.attributes.position && g.attributes.normal && g.attributes.color);
    assert.equal(g.attributes.color.count, g.attributes.position.count);
    assert.ok(g.attributes.position.count / 3 <= 500, String(g.attributes.position.count / 3));
  }
  t.dispose();
});

test('Maße in Metern: Füße auf 0, Nase vorn (+Z), Höhe passt zum Menschen (1.8 m)', () => {
  const t = createReh({ seed: 2 });
  for (const g of t.frames) {
    const bb = box(g);
    assert.ok(Math.abs(bb.min.y) <= 0.02, 'min.y ' + bb.min.y);
    assert.ok(bb.max.z > 0.3 * t.laenge && bb.max.z < 0.65 * t.laenge, 'Nase ' + bb.max.z);
    assert.ok(bb.min.z < -0.3 * t.laenge, 'hinten ' + bb.min.z);
    assert.ok(bb.max.y > 0.75 * 0.7 && bb.max.y < 1.8 * 0.8, 'Höhe ' + bb.max.y);
  }
});

test('deterministisch per Seed; Bild 0 ≠ Bild 1; laenge skaliert', () => {
  const a = createReh({ seed: 5 }), b = createReh({ seed: 5 });
  assert.deepEqual(Array.from(a.frames[1].attributes.position.array), Array.from(b.frames[1].attributes.position.array));
  assert.deepEqual(Array.from(a.frames[1].attributes.color.array), Array.from(b.frames[1].attributes.color.array));
  assert.notDeepEqual(Array.from(a.frames[0].attributes.position.array), Array.from(a.frames[1].attributes.position.array));
  const k = box(createReh({ seed: 5, laenge: 1.15 }).frames[0]), g = box(createReh({ seed: 5, laenge: 1.15 * 2 }).frames[0]);
  assert.ok(Math.abs(g.max.z / k.max.z - 2) < 1e-4);
});
