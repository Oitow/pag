import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGrosszauber } from './grosszauber.js';

// Test-Art: eine 2 m hohe Wand bei x=0 (|z|<5), 3 s lang; trifft am Anfang alles in 2 m
function createTestwand(o) {
  let t = 0, getroffen = false;
  return {
    daten: { x: o.punkt.x },
    update(dt, ziele, melde) {
      t += dt;
      if (!getroffen) { getroffen = true; melde({ typ: 'treffer', treffer: ziele.filter(z => Math.abs(z.x - o.punkt.x) < 2).map(z => ({ id: z.id, ziel: z, schaden: 10 * o.kraft })) }); melde({ typ: 'beben', staerke: 1 }); }
      return t < 3;
    },
    hindernis(x, z, r) { const d = x - o.punkt.x; return Math.abs(d) < 0.5 + r && Math.abs(z) < 5 ? { x: Math.sign(d || 1) * (0.5 + r - Math.abs(d)), z: 0 } : null; },
    boden(x, z) { return Math.abs(x - o.punkt.x) < 0.5 && Math.abs(z) < 5 ? 2 : null; },
    wasser(x) { return x > 10 ? 1 : null; },
  };
}

test('wirke → start, treffer, beben, ende', () => {
  const g = createGrosszauber({ arten: { wand: createTestwand } });
  assert.equal(g.wirke('unbekannt', {}), null);
  const id = g.wirke('wand', { punkt: { x: 0, z: 0 }, kraft: 1.5 });
  let e = g.update(0.1, [{ id: 'a', x: 1, z: 0 }, { id: 'b', x: 5, z: 0 }]);
  assert.deepEqual(e.map(x => x.typ), ['start', 'treffer', 'beben']);
  assert.equal(e[1].treffer.length, 1); assert.equal(e[1].treffer[0].schaden, 15); assert.equal(e[1].id, id);
  e = g.update(3, []);
  assert.equal(e.at(-1).typ, 'ende'); assert.equal(g.aktive.length, 0);
});

test('Adapter: Wand ist Hindernis, oben drauf nur von oben, Wasser', () => {
  const g = createGrosszauber({ arten: { wand: createTestwand } });
  const a = g.adapter({ bodenHoehe: () => 0, hindernisse: () => null });
  assert.equal(a.hindernisse(0.3, 0, 0.4), null);
  g.wirke('wand', { punkt: { x: 0, z: 0 } });
  const h = a.hindernisse(0.3, 0, 0.4);
  assert.ok(h.x > 0);
  assert.equal(a.bodenHoehe(0, 0), 2);          // ohne Fuß-Höhe: Podest
  assert.equal(a.bodenHoehe(0, 0, 0), 0);       // Füße unten: zu hoch → kein Boden
  assert.equal(a.bodenHoehe(0, 0, 1.8), 2);     // Füße fast oben: Boden
  assert.equal(a.wasserHoehe(12, 0), 1);
  assert.equal(a.wasserHoehe(0, 0), -Infinity);
  g.leeren();
  assert.equal(a.hindernisse(0.3, 0, 0.4), null);
});

test('max: älteste Wirkung weicht', () => {
  const g = createGrosszauber({ arten: { wand: createTestwand }, max: 2 });
  g.wirke('wand', {}); g.wirke('wand', {}); g.wirke('wand', {});
  assert.equal(g.aktive.length, 2);
  assert.equal(g.zustand().length, 2);
});
