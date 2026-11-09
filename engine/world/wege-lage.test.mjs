import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from './worldgen/worldgen.js';
import { createWeltAdapter } from './worldgen/worldgen-adapter.js';
import { brueckenLagen, deckHoehe, mitBruecken } from './wege-lage.js';

// Welt mit Brücken suchen (deterministisch: erster passender Seed)
let adapter = null;
for (let seed = 1; seed < 40 && !adapter; seed++) {
  const w = createWorld({ preset: 'kontinent', seed, breite: 128, tiefe: 128, qualitaet: 'schnell', wasser: { flussMenge: 1.2 }, wege: { aktiv: true } });
  if (w.wege.some(x => x.bruecken.length)) adapter = createWeltAdapter(w, { hoehenSkala: 40, meterProZelle: 2 });
}

test('Brücken: Lage über dem Wasser, Enden auf Uferhöhe', () => {
  assert.ok(adapter, 'keine Testwelt mit Brücke gefunden');
  const lagen = brueckenLagen(adapter);
  assert.ok(lagen.length > 0);
  for (const l of lagen) {
    assert.ok(l.laenge > 2 && l.breite > 0 && Math.abs(Math.hypot(l.rx, l.rz) - 1) < 1e-6);
    const h = l.laenge / 2;
    assert.ok(l.y1 >= adapter.bodenHoehe(l.x - l.rx * h, l.z - l.rz * h), 'Ende 1 unter dem Boden');
    assert.ok(l.y2 >= adapter.bodenHoehe(l.x + l.rx * h, l.z + l.rz * h), 'Ende 2 unter dem Boden');
    const mitte = deckHoehe(l, l.x, l.z);
    assert.ok(Math.abs(mitte - (l.y1 + l.y2) / 2) < 1e-6);
    for (let s = -h; s <= h; s += 0.5) {
      const wh = adapter.wasserHoehe(l.x + l.rx * s, l.z + l.rz * s);
      if (wh != null) assert.ok(deckHoehe(l, l.x + l.rx * s, l.z + l.rz * s) > wh, 'Deck unter Wasser');
    }
    assert.equal(deckHoehe(l, l.x + l.rz * l.breite, l.z - l.rx * l.breite), null, 'neben der Brücke');
    assert.equal(deckHoehe(l, l.x + l.rx * l.laenge, l.z + l.rz * l.laenge), null, 'hinter der Brücke');
  }
});

test('Brücken: Adapter trägt Figuren über den Fluss', () => {
  const lagen = brueckenLagen(adapter), b = mitBruecken(adapter, lagen), l = lagen[0];
  assert.ok(b.bodenHoehe(l.x, l.z) >= adapter.bodenHoehe(l.x, l.z));
  assert.equal(b.wasserHoehe(l.x, l.z), null);
  assert.equal(b.bodenHoehe(l.x + l.rz * 30, l.z - l.rx * 30), adapter.bodenHoehe(l.x + l.rz * 30, l.z - l.rx * 30));
  assert.equal(b.meterProZelle, adapter.meterProZelle);
  assert.equal(mitBruecken(adapter, []), adapter);
});
