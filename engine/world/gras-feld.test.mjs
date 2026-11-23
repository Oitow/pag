import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeltRegionen } from './welt-regionen.js';
import { grasPunkte, createGrasFeld, PUNKT_STRIDE } from './gras-feld.js';

const karte = createWeltRegionen({ seed: 1207 });
const kachel = (x, z) => ({ x0: Math.floor(x / 16) * 16, z0: Math.floor(z / 16) * 16, groesse: 16 });
const alle = (p, f) => { for (let i = 0; i < p.n; i++) f(p.daten[i * PUNKT_STRIDE], p.daten[i * PUNKT_STRIDE + 2], p.daten[i * PUNKT_STRIDE + 1]); };

test('grasPunkte ist deterministisch und liegt in der Kachel', () => {
  const k = kachel(0, 560), a = grasPunkte(karte, k, { seed: 1207 }), b = grasPunkte(karte, k, { seed: 1207 });
  assert.ok(a.n > 0);
  assert.deepEqual(Array.from(a.daten), Array.from(b.daten));
  alle(a, (x, z) => assert.ok(x >= k.x0 && x < k.x0 + 16 && z >= k.z0 && z < k.z0 + 16));
});

test('kein Gras auf dem Weg (Siedlung (0,600) – (-12,840))', () => {
  let gesamt = 0;
  for (let z = 600; z < 840; z += 16) {
    const p = grasPunkte(karte, kachel(-6, z), { seed: 1207 }); gesamt += p.n;
    alle(p, (x, zz) => { const w = karte.wegInfo(x, zz); assert.ok(w.d > w.breite, `Gras auf Weg bei ${x.toFixed(1)},${zz.toFixed(1)}`); });
  }
  assert.ok(gesamt > 0);
});

test('kein Gras im Meer', () => {
  assert.equal(grasPunkte(karte, kachel(0, 2050), { seed: 1207 }).n, 0);
  assert.equal(grasPunkte(karte, kachel(300, 2060), { seed: 1207 }).n, 0);
});

test('Wiese ist dichter als Fels', () => {
  const zaehle = (bio) => {
    let n = 0, t = 0;
    for (let z = -1200; z < 1200 && t < 12; z += 37) for (let x = -300; x < 900 && t < 12; x += 53) {
      if (karte.biom(x + 8, z + 8) === bio) { n += grasPunkte(karte, kachel(x, z), { seed: 1207 }).n; t++; }
    }
    return t ? n / t : 0;
  };
  const wiese = zaehle('wiese'), fels = zaehle('fels');
  assert.ok(wiese > 500, `wiese ${wiese}`);
  assert.ok(wiese > fels * 5, `wiese ${wiese} fels ${fels}`);
});

test('Budget-Grenze bei niedrig (weite 28 → ≤ 15000), hoch ≤ 60000', () => {
  for (const [weite, grenze] of [[28, 15000], [45, 60000]]) {
    const g = createGrasFeld({ karte, seed: 1207, weite });
    for (let i = 0; i < 60; i++) g.update(0.016, { x: 0, z: 620 }, i * 0.016);
    assert.ok(g.anzahl > 1000 && g.anzahl <= grenze, `weite ${weite}: ${g.anzahl}`);
    assert.equal(g.mesh.count, g.anzahl);
    console.log(`weite ${weite}: ${g.anzahl} Büschel`);
    g.dispose();
  }
});
