// Prüft den Planeten des Erde-Labors (labore/erde): Würfel-Kugel, Quadtree, Kachelbau, Kachel-Strom.
import test from 'node:test';
import assert from 'node:assert/strict';
import { wuerfelZuKugel, waehleKacheln, schluessel } from '../labore/erde/js/planet-baum.js';
import { baueKachel } from '../labore/erde/js/kachel-bau.js';
import { createPlanetHoehe } from '../labore/erde/js/planet-hoehe.js';
import { createKachelStrom } from '../labore/erde/js/kachel-strom.js';

const R = 100_000;

test('Würfel-Kugel: Punkte liegen auf der Einheitskugel, Kanten benachbarter Seiten treffen sich', () => {
  for (let f = 0; f < 6; f++) for (const [u, v] of [[0, 0], [1, 1], [-1, 0.3], [0.5, -1]]) {
    const d = wuerfelZuKugel(f, u, v);
    assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-9);
  }
  // Seite +X bei u = -1 (a = -Z → z = +1) ist dieselbe Kante wie Seite +Z bei u = +1
  const a = wuerfelZuKugel(0, -1, 0.4), b = wuerfelZuKugel(4, 1, 0.4);
  assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-12);
});

test('Quadtree: nah am Boden feine Kacheln, im All wenige grobe, die Kugel ist lückenlos bedeckt', () => {
  const nah = waehleKacheln([0, 0, R + 2], { R, maxStufe: 13 });
  const fern = waehleKacheln([0, 0, R + 900_000], { R, maxStufe: 13 });
  assert.equal(Math.max(...nah.map((k) => k.L)), 13);
  assert.ok(fern.length <= 12 && nah.length > 100);
  // Fläche (in Seiten-Anteilen) summiert sich zu genau 6 Würfelseiten
  const flaeche = nah.reduce((s, k) => s + 1 / 4 ** k.L, 0);
  assert.ok(Math.abs(flaeche - 6) < 1e-9);
});

test('Kachelbau: Nachbarkacheln gleicher Stufe teilen ihre Randpunkte exakt (keine Risse)', () => {
  const planet = createPlanetHoehe({ seed: 3, radius: R });
  const k1 = { f: 4, L: 6, ix: 20, iy: 30 }, k2 = { f: 4, L: 6, ix: 21, iy: 30 };
  const a = baueKachel({ ...k1, key: schluessel(k1) }, planet, 8), b = baueKachel({ ...k2, key: schluessel(k2) }, planet, 8);
  for (let j = 0; j <= 8; j++) {
    const ia = (j * 9 + 8) * 3, ib = (j * 9) * 3; // rechter Rand von a = linker Rand von b
    for (let c = 0; c < 3; c++) {
      const pa = a.pos[ia + c] + a.mitte[c], pb = b.pos[ib + c] + b.mitte[c];
      assert.ok(Math.abs(pa - pb) < 0.05, `Abweichung ${pa - pb}`);
    }
  }
});

test('Höhe: gleicher Seed → gleiche Welt, anderer Seed → andere Welt', () => {
  const a = createPlanetHoehe({ seed: 5, radius: R }), b = createPlanetHoehe({ seed: 5, radius: R }), c = createPlanetHoehe({ seed: 6, radius: R });
  const d = [0.3, 0.5, Math.sqrt(1 - 0.34)];
  assert.equal(a.hoehe(...d), b.hoehe(...d));
  assert.notEqual(a.hoehe(...d), c.hoehe(...d));
});

test('Kachel-Strom: beim Teilen bleibt die alte Kachel, bis alle Kinder fertig sind – nie Loch, nie doppelt', () => {
  const offen = [];
  const sichtbar = new Set();
  const strom = createKachelStrom({
    bauen: (k) => offen.push(k), erzeuge: (d) => d.key,
    zeige: (o, an) => (an ? sichtbar.add(o) : sichtbar.delete(o)), entsorge: () => {}, parallel: 10,
  });
  const mk = (f, L, ix, iy) => ({ f, L, ix, iy, key: schluessel({ f, L, ix, iy }), dist: 0 });
  const eltern = mk(0, 1, 0, 0);
  strom.update([eltern]);
  strom.fertigGebaut(offen.shift().key, { key: eltern.key });
  strom.update([eltern]);
  assert.deepEqual([...sichtbar], [eltern.key]);
  const kinder = [mk(0, 2, 0, 0), mk(0, 2, 1, 0), mk(0, 2, 0, 1), mk(0, 2, 1, 1)];
  strom.update(kinder);
  for (let i = 0; i < 3; i++) { const k = offen.shift(); strom.fertigGebaut(k.key, { key: k.key }); strom.update(kinder); }
  assert.deepEqual([...sichtbar], [eltern.key]);           // 3 von 4 fertig: noch die alte
  const k = offen.shift(); strom.fertigGebaut(k.key, { key: k.key }); strom.update(kinder);
  assert.equal(sichtbar.size, 4);
  assert.ok([...sichtbar].every((s) => kinder.some((c) => c.key === s)));
});
