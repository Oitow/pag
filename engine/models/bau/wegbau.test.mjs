import test from 'node:test';
import assert from 'node:assert/strict';
import { createWegweiser, createZaun, createSteinkreis } from './wegbau.js';
import { pruefeAsset, pruefeDeterminismus, andereVariante } from './bau-pruefung.mjs';

test('Wegweiser: je Schild ein Brett, anker.schild mit Texten', () => {
  const eins = createWegweiser({ schilder: [{ winkel: 1, text: 'Enklave' }] });
  const drei = createWegweiser({ schilder: [{ winkel: 1, text: 'Enklave' }, { winkel: -2, text: 'Tal' }, { winkel: 3, text: 'Aussicht' }, { winkel: 0, text: 'zu viel' }] });
  assert.equal(eins.anker.schild.length, 1);
  assert.equal(drei.anker.schild.length, 3, 'maximal 3 Schilder');
  assert.deepEqual(drei.anker.schild.map((s) => s.text), ['Enklave', 'Tal', 'Aussicht']);
  assert.ok(drei.dreiecke > eins.dreiecke + 40, 'mehr Bretter, mehr Dreiecke');
  // Brett zeigt in Richtung winkel: Brettmitte liegt bei (sin w, cos w) * 0.46
  const s = drei.anker.schild[0];
  assert.ok(Math.abs(s.x - Math.sin(1) * 0.46) < 1e-9 && Math.abs(s.z - Math.cos(1) * 0.46) < 1e-9);
  pruefeAsset(eins, { budget: 150, tol: 0.2, anker: ['schild'] });
  pruefeAsset(drei, { budget: 150, tol: 0.2, anker: ['schild'] });
  pruefeDeterminismus(createWegweiser);
});
test('Zaun: Länge genau 2 m, reihbar', () => {
  for (const v of [0, 1]) {
    const z = createZaun({ variante: v });
    z.geometrie.computeBoundingBox();
    const bb = z.geometrie.boundingBox;
    assert.ok(Math.abs(bb.min.x + 1) < 1e-6 && Math.abs(bb.max.x - 1) < 1e-6, `Zaun v${v}: x ${bb.min.x}…${bb.max.x}`);
    pruefeAsset(createZaun({ variante: v }), { budget: 120 });
  }
  andereVariante(createZaun, 0, 1);
});
test('Steinkreis: 7 Steine', () => {
  const k = createSteinkreis();
  assert.equal(k.kollision.length, 7);
  pruefeAsset(k, { budget: 300, tol: 0.1 });
  pruefeDeterminismus(createSteinkreis);
});
