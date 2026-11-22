import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElementReaktionen, normElement } from './element-reaktionen.js';

test('nass + blitz = Schock mit Fläche, nass wird verbraucht', () => {
  const er = createElementReaktionen();
  assert.deepEqual(er.treffer('a', 'wasser', { menge: 10 }).neu, ['nass']);
  const r = er.treffer('a', 'blitz', { menge: 20 });
  assert.equal(r.reaktion.name, 'schock');
  assert.equal(r.menge, 30);
  assert.equal(r.folgen[0].art, 'flaeche');
  assert.equal(er.hat('a', 'nass'), false);
});

test('Boden-Fleck: Pfütze + Frost am Ziel = eingefroren (Betäubung), Flecken laufen ab', () => {
  const er = createElementReaktionen();
  er.boden('wasser', 5, 5, 3);
  assert.equal(er.bodenBei(6, 5)[0].zustand, 'nass');
  const r = er.treffer('b', 'eis', { x: 6, z: 5, menge: 10 });   // 'eis' = frost
  assert.equal(r.reaktion.name, 'einfrieren');
  assert.ok(r.amBoden && er.betaeubt('b') > 0 && er.tempo('b') === 0);
  for (let i = 0; i < 20; i++) er.update(1);
  assert.equal(er.flecken.length, 0);
  assert.equal(normElement('natur'), 'erde');
});

test('brennend: Takte, Wind = Feuersturm, Wasser = Dampf; deterministisch über zustand/lade', () => {
  const er = createElementReaktionen();
  er.treffer('c', 'feuer');
  assert.equal(er.update(1.01).length, 1);
  const k = createElementReaktionen(); k.lade(er.zustand());
  assert.equal(er.treffer('c', 'wind', { menge: 10 }).reaktion.name, 'feuersturm');
  assert.equal(k.treffer('c', 'wasser').reaktion.name, 'dampf');
  assert.equal(k.hat('c', 'brennend'), false);
});
