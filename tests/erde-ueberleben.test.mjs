// Prüft die Überlebens-Regeln des Erde-Labors (labore/erde/js/ueberleben-regeln.js): Zeitbasis, Kälte, Essen, Tod.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEBEN_MAX, neuerZustand, gefuehlteTemp, schritt, bestesEssen, iss, todVerlust,
} from '../labore/erde/js/ueberleben-regeln.js';

const lauf = (z, stunden, u, dh = 0.05) => { for (let t = 0; t < stunden; t += dh) schritt(z, dh, u); return z; };

test('Zeitbasis: bei angenehmer Temperatur Durst nach ~1 Spieltag leer, Hunger nach ~2', () => {
  const z = lauf(neuerZustand({ satt: 1, wasser: 1 }), 23, { tGefuehlt: 18 });
  assert.ok(z.wasser > 0 && z.wasser < 0.1, `Durst nach 23 h: ${z.wasser}`);
  assert.ok(Math.abs(z.satt - 0.52) < 0.03, `Hunger nach 23 h: ${z.satt}`);
  assert.equal(z.leben, LEBEN_MAX);
  lauf(z, 6, { tGefuehlt: 18 });
  assert.equal(z.wasser, 0);
  assert.ok(z.leben < LEBEN_MAX, 'verdursten kostet Leben');
});

test('Kälte: nackt bei −15 °C nach Spielminuten ausgekühlt und stirbt in Stunden, am Feuer nicht', () => {
  const draussen = gefuehlteTemp({ luft: -15, wind: 0.5 });
  const z = lauf(neuerZustand({ waerme: 1 }), 1.2, { tGefuehlt: draussen });
  assert.equal(z.waerme, 0);
  lauf(z, 3, { tGefuehlt: draussen });
  assert.equal(z.leben, 0);
  const amFeuer = gefuehlteTemp({ luft: -15, wind: 0.5, feuer: 25, kleidung: 8, dach: true });
  const w = lauf(neuerZustand({ waerme: 1 }), 4, { tGefuehlt: amFeuer });
  assert.equal(w.waerme, 1);
  assert.equal(w.leben, LEBEN_MAX);
});

test('Gefühlte Temperatur: Dach nimmt Regen und Wind, Nässe kühlt, Kleidung wärmt', () => {
  const nassImRegen = gefuehlteTemp({ luft: 10, wind: 1, regen: 1, nass: 1 });
  const unterDach = gefuehlteTemp({ luft: 10, wind: 1, regen: 1, dach: true });
  assert.ok(unterDach > nassImRegen + 15, `${unterDach} vs ${nassImRegen}`);
  assert.equal(gefuehlteTemp({ luft: 5, kleidung: 8 }), 13);
  // Nach dem Schwimmen eine Weile nass, dann trocken
  const z = neuerZustand();
  schritt(z, 0.1, { schwimmt: true });
  schritt(z, 0.5, {});
  assert.ok(z.nass > 0.5);
  schritt(z, 1.5, {});
  assert.equal(z.nass, 0);
});

test('Essen: bestes Essen passt zum Bedarf, rohes Fleisch kann übel werden, Unbekanntes geht nicht', () => {
  const tasche = { beeren: 5, gebratenesFleisch: 1, kokosnuss: 1 };
  const zaehle = (id) => tasche[id] || 0;
  assert.equal(bestesEssen(neuerZustand({ satt: 0.2, wasser: 0.9 }), zaehle), 'gebratenesFleisch');
  assert.equal(bestesEssen(neuerZustand({ satt: 0.97, wasser: 0.3 }), zaehle), 'kokosnuss');
  assert.equal(bestesEssen(neuerZustand({ satt: 1, wasser: 1 }), zaehle), null, 'satt und kein Durst → nichts');
  const z = neuerZustand({ satt: 0.5, leben: 80 });
  assert.equal(iss(z, 'fleisch', 0.99).ok, true);
  const r = iss(z, 'fleisch', 0.01);
  assert.equal(r.uebel, true);
  assert.ok(z.leben < 80);
  assert.equal(iss(z, 'steine').ok, false);
});

test('Tod: Hälfte jedes Stapels weg (aufgerundet), Werkzeuge bleiben', () => {
  const weg = todVerlust([{ id: 'axt', anzahl: 1 }, { id: 'holz', anzahl: 9 }, null, { id: 'holz', anzahl: 4 }, { id: 'beeren', anzahl: 1 }, { id: 'eisenhacke', anzahl: 1 }]);
  assert.deepEqual(weg, [{ id: 'holz', anzahl: 7 }, { id: 'beeren', anzahl: 1 }]);
});
