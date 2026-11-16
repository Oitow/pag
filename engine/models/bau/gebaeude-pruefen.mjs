// Gemeinsame Abnahme-Prüfung für Gebäude-Assets (Testhelfer, kein Modul)
import test from 'node:test';
import assert from 'node:assert/strict';

const box = (g) => { g.computeBoundingBox(); return g.boundingBox; };
export function vereinigung(a) {
  const b = box(a.geometrie).clone(); if (a.leucht) b.union(box(a.leucht)); return b;
}
const gleich = (g1, g2) => { const p = g1.attributes.position.array, q = g2.attributes.position.array;
  return p.length === q.length && p.every((v, i) => v === q[i]); };

/** pruefeAsset(name, fabrik, varianten, { budget, opts, tol }) -> registriert node:test-Fälle */
export function pruefeAsset(name, fabrik, { varianten = [0], budget, opts = {}, anker = [], tol = 0.05 }) {
  for (const variante of varianten) test(`${name} v${variante}: Geometrie, Budget, Masse, Kollision, Anker`, () => {
    const a = fabrik({ seed: 1, variante, ...opts });
    for (const k of ['position', 'normal', 'color']) assert.ok(a.geometrie.attributes[k], `Attribut ${k}`);
    assert.ok(a.dreiecke > 0 && a.dreiecke <= budget, `Dreiecke ${a.dreiecke} > ${budget}`);
    const bb = vereinigung(a), m = a.masse;
    for (const [achse, mass] of [['x', m.breite], ['z', m.tiefe]]) {
      const ist = bb.max[achse] - bb.min[achse];
      assert.ok(Math.abs(ist - mass) <= mass * tol + 1e-6, `${achse}: ${ist.toFixed(2)} statt ${mass}`);
    }
    assert.ok(bb.min.y >= -0.6, `y min ${bb.min.y}`);
    assert.ok(Math.abs(bb.max.y - m.hoehe) <= m.hoehe * tol + 1e-6, `Höhe ${bb.max.y.toFixed(2)} statt ${m.hoehe}`);
    for (const k of a.kollision) {
      assert.ok(k.form === 'kasten' || k.form === 'kreis');
      const rx = k.form === 'kreis' ? k.radius : Math.hypot(k.bx, k.bz), rz = rx;
      assert.ok(Math.abs(k.x) + (k.winkel ? rx : (k.bx ?? k.radius)) <= m.breite / 2 + 0.05, `Körper ragt in x aus der Grundfläche: ${JSON.stringify(k)}`);
      assert.ok(Math.abs(k.z) + (k.winkel ? rz : (k.bz ?? k.radius)) <= m.tiefe / 2 + 0.55 + Math.abs(bb.min.z + bb.max.z) / 2, `Körper ragt in z aus der Grundfläche: ${JSON.stringify(k)}`);
      assert.ok(Number.isFinite(k.y0) && k.hoehe > 0);
    }
    for (const k of anker) assert.ok(a.anker[k] !== undefined, `Anker ${k} fehlt`);
    if (a.anker.tuer) assert.ok(a.anker.tuer.z > 0 && a.anker.tuer.winkel === 0, 'Tür an +z-Front');
    assert.doesNotThrow(() => a.dispose());
  });
  test(`${name}: gleicher Seed → gleiche Geometrie, andere Variante → andere`, () => {
    const a = fabrik({ seed: 4, variante: varianten[0], ...opts }), b = fabrik({ seed: 4, variante: varianten[0], ...opts });
    assert.ok(gleich(a.geometrie, b.geometrie) && gleich(a.geometrie, b.geometrie));
    assert.deepEqual([...a.geometrie.attributes.color.array], [...b.geometrie.attributes.color.array]);
    const c = fabrik({ seed: 5, variante: varianten[0], ...opts });
    assert.notDeepEqual([...a.geometrie.attributes.color.array], [...c.geometrie.attributes.color.array], 'anderer Seed → andere Farben');
    if (varianten.length > 1) { const v = fabrik({ seed: 4, variante: varianten[1], ...opts }); assert.ok(!gleich(a.geometrie, v.geometrie)); }
    [a, b, c].forEach((x) => x.dispose());
  });
}
