import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlussNetz } from './worldgen-chunkfluss.js';
import { createHeightSampler } from './worldgen-height.js';
import { aufloesen } from './worldgen-presets.js';

const roh = createHeightSampler(aufloesen({ preset: 'unendlich', seed: 5 })).sample;

test('Flussnetz: Abfluss führt bergab ins Meer oder in eine Senke, Prägen senkt nur ab', () => {
  const netz = createFlussNetz({ seed: 5, roh, massstab: 256 });
  netz.seenIn(-200, -200, 200, 200); // füllt Zufluss/Breite der Knoten
  let fluesse = 0, insMeer = 0;
  for (let j = -12; j < 12; j++) for (let i = -12; i < 12; i++) {
    const k = netz.knoten(i, j);
    if (!(k.b > 0)) continue;
    fluesse++;
    // stromab folgen (begrenzt): Höhe sinkt bis zur ersten Senke; Überläufe steigen höchstens um 'ueberlauf'
    let m = k;
    for (let schritt = 0; schritt < 200; schritt++) {
      if (m.ab === undefined) netz.seenIn(m.x - 0.5, m.y - 0.5, m.x + 0.5, m.y + 0.5);
      const ab = m.ab;
      if (!ab) break;
      assert.ok(ab.h < m.h + 0.03 + 1e-9, 'Abfluss steigt zu stark');
      m = ab;
      if (m.h < 0) { insMeer++; break; }
    }
  }
  assert.ok(fluesse > 20, `zu wenig Flussknoten (${fluesse})`);
  assert.ok(insMeer > 5, `kaum Flüsse erreichen das Meer (${insMeer})`);
  for (let k = 0; k < 400; k++) {
    const x = (k * 37) % 300 - 150, y = (k * 53) % 300 - 150, h = roh(x, y);
    const p = netz.praege(x, y, h);
    assert.ok(p <= h + 1e-12, 'Prägen hebt nie an');
    assert.ok(Number.isFinite(p));
  }
  netz.dispose();
});

test('Flussnetz: rein von Seed und Position abhängig', () => {
  const a = createFlussNetz({ seed: 7, roh, massstab: 256 }), b = createFlussNetz({ seed: 7, roh, massstab: 256 });
  b.praege(500, 500, roh(500, 500));
  for (let k = 0; k < 200; k++) {
    const x = k * 3.7 - 300, y = k * 2.3 - 200;
    const pa = a.praege(x, y, roh(x, y)), fa = a.fluss, sa = a.see;
    const pb = b.praege(x, y, roh(x, y));
    assert.equal(pa, pb); assert.equal(fa, b.fluss); assert.ok(Object.is(sa, b.see));
  }
});
