// Gemeinsame Prüfung für Kleinkram-Assets (nur in Tests benutzt, keine Engine-API).
import assert from 'node:assert/strict';

const box = (a) => {
  a.geometrie.computeBoundingBox();
  const bb = a.geometrie.boundingBox.clone();
  if (a.leucht) { a.leucht.computeBoundingBox(); bb.union(a.leucht.boundingBox); }
  return bb;
};
const nah = (ist, soll, tol, text) => assert.ok(Math.abs(ist - soll) <= Math.max(soll * tol, 0.06), `${text}: ist ${ist.toFixed(3)}, soll ${soll}`);

/** Prüft Vertrag: Attribute, Budget, Maße (±tol), Kollision innerhalb der Grundfläche, dispose. */
export function pruefeAsset(a, { budget, tol = 0.05, leucht = false, anker = [] } = {}) {
  for (const g of [a.geometrie, a.leucht].filter(Boolean))
    for (const n of ['position', 'normal', 'color']) assert.ok(g.attributes[n]?.count > 0, `${a.name}: ${n}`);
  assert.ok(a.dreiecke > 0 && a.dreiecke <= budget, `${a.name}: ${a.dreiecke} Dreiecke > ${budget}`);
  assert.equal(!!a.leucht, leucht, `${a.name}: leucht`);
  const bb = box(a), m = a.masse;
  nah(bb.max.x - bb.min.x, m.breite, tol, `${a.name} breite`);
  nah(bb.max.z - bb.min.z, m.tiefe, tol, `${a.name} tiefe`);
  nah(bb.max.y, m.hoehe, tol, `${a.name} hoehe`);
  assert.ok(bb.min.y >= -0.6, `${a.name}: min y ${bb.min.y}`);
  for (const k of a.kollision) {
    assert.ok(k.form === 'kasten' || k.form === 'kreis', 'Form');
    const ex = k.form === 'kasten' ? k.bx : k.radius, ez = k.form === 'kasten' ? k.bz : k.radius;
    assert.ok(Number.isFinite(k.x + k.z + k.hoehe + k.y0), 'endlich');
    assert.ok(Math.abs(k.x) + ex <= m.breite / 2 + 0.06 + m.breite * tol && Math.abs(k.z) + ez <= m.tiefe / 2 + 0.06 + m.tiefe * tol, `${a.name}: Körper außerhalb`);
  }
  for (const n of anker) assert.ok(a.anker[n], `${a.name}: Anker ${n}`);
  assert.doesNotThrow(() => a.dispose());
}

const gleich = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);
export function pruefeDeterminismus(fabrik, opts) {
  const a = fabrik({ seed: 4, ...opts }), b = fabrik({ seed: 4, ...opts }), c = fabrik({ seed: 5, ...opts });
  assert.ok(gleich(a.geometrie.attributes.position.array, b.geometrie.attributes.position.array), 'gleicher seed: Position');
  assert.ok(gleich(a.geometrie.attributes.color.array, b.geometrie.attributes.color.array), 'gleicher seed: Farbe');
  assert.ok(!gleich(a.geometrie.attributes.color.array, c.geometrie.attributes.color.array)
    || !gleich(a.geometrie.attributes.position.array, c.geometrie.attributes.position.array), 'anderer seed: andere Geometrie');
}
export function andereVariante(fabrik, v0, v1) {
  const a = fabrik({ seed: 1, variante: v0 }), b = fabrik({ seed: 1, variante: v1 });
  assert.ok(!gleich(a.geometrie.attributes.color.array, b.geometrie.attributes.color.array)
    || !gleich(a.geometrie.attributes.position.array, b.geometrie.attributes.position.array), 'andere variante');
}
