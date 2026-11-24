// Bauen-Regeln (labore/erde/js/bauen-regeln.js): Einrasten, Statik, Abriss, begehbare Flächen
import test from 'node:test';
import assert from 'node:assert/strict';
import { einrasten, pruefe, statik, abriss, oberflaeche, dachUeber, huelle, WAND_H, DACH_HUB, TEILE } from '../labore/erde/js/bauen-regeln.js';

const flach = () => 0;
let n = 0;
const teil = (art, x, y, z, rot = 0) => ({ id: 't' + n++, art, x, y, z, rot });

test('Einrasten: Fundament schließt bündig an, Wand steht auf dessen Kante, Blick hoch = Stockwerk höher', () => {
  const hang = (x) => x * 0.1;   // leichter Hang
  const f = einrasten('fundament', 0.4, -0.3, 0, [], { boden: hang });
  assert.deepEqual([f.x, f.z], [0, 0]);
  assert.ok(f.y > 0.1 && f.y < 0.3, 'Oberkante knapp über dem höchsten Eckpunkt');
  const F = { ...f, id: 'F' };
  const f2 = einrasten('fundament', 2.3, 0.2, 0, [F], { boden: hang, wunschY: 1 });
  assert.deepEqual([f2.x, f2.z, f2.y], [2, 0, f.y], 'gleiche Ebene wie der Nachbar');
  const w = einrasten('wand', 0.2, -0.8, 0, [F], { boden: hang, wunschY: 1 });
  assert.deepEqual([w.x, w.z, w.y], [0, -1, f.y]);
  const W = { ...w, id: 'W' };
  const w2 = einrasten('wand', 0.2, -0.8, 0, [F, W], { boden: hang, wunschY: f.y + WAND_H + 0.5 });
  assert.equal(w2.y, f.y + WAND_H, 'zweite Wand auf die erste');
  const quer = einrasten('wand', -0.9, 0.3, 1, [F], { boden: hang });
  assert.deepEqual([quer.x, quer.z], [-1, 0], 'gedrehte Wand auf der Querkante');
});

test('Prüfen: doppelt belegt und schwebend wird abgelehnt, Wand auf Fundament ist ok', () => {
  const F = teil('fundament', 0, 0.12, 0), W = teil('wand', 0, 0.12, -1);
  assert.equal(pruefe({ art: 'wand', x: 0, y: 0.12, z: -1, rot: 0 }, [F, W], flach).ok, false);
  assert.equal(pruefe({ art: 'wand', x: 0, y: 0.12, z: 1, rot: 0 }, [F, W], flach).ok, true);
  assert.equal(pruefe({ art: 'boden', x: 6, y: 3, z: 6, rot: 0 }, [F, W], flach).grund, 'kein Halt');
  assert.equal(pruefe({ art: 'fundament', x: 0, y: 3, z: 6, rot: 0 }, [], flach).ok, false, 'Fundament reicht nicht bis zum Boden');
});

test('Statik: ohne Fundament höchstens 3 Teile hoch, mit Fundament höher', () => {
  const ohne = [0, 1, 2, 3].map((k) => teil('wand', 10, k * WAND_H, -1));
  const s = statik(ohne, flach);
  assert.deepEqual(ohne.map((t) => s.get(t.id).ok), [true, true, true, false]);
  // Gelände 1 m unter der Fundament-Oberkante → die unterste Wand berührt das Gelände nicht, trägt nur übers Fundament
  const tief = () => -1, F = teil('fundament', 0, 0.5, 0);
  const mit = [F, ...[0, 1, 2, 3].map((k) => teil('wand', 0, 0.5 + k * WAND_H, -1))];
  const s2 = statik(mit, tief);
  assert.ok(mit.every((t) => s2.get(t.id).ok), 'mit Fundament stehen 4 Wände übereinander');
});

test('Abriss: was keinen Halt mehr hat, fällt mit; zurück gibt es die Hälfte', () => {
  const a = teil('wand', 0, 0, -1), b = teil('wand', 0, WAND_H, -1), c = teil('dach', 0, 2 * WAND_H, 0);
  const r = abriss([a, b, c], a.id, flach);
  assert.deepEqual(r.weg.sort(), [a.id, b.id, c.id].sort());
  assert.equal(r.zurueck.holz, 2 + 2 + 1);
  assert.equal(r.zurueck.fasern, 1);
  assert.equal(r.rest.length, 0);
});

test('Begehbar: Treppe als Rampe, Boden oben, Dach über Kopf', () => {
  const T = teil('treppe', 0, 0, 0, 0), B = teil('boden', 0, WAND_H, 2), D = teil('dach', 0, WAND_H, 0, 2);
  assert.ok(Math.abs(oberflaeche([T, B], 0, 0, 5) - WAND_H / 2) < 1e-9, 'Treppenmitte = halbe Höhe');
  assert.equal(oberflaeche([T, B], 0, 2, 5), WAND_H);
  assert.equal(oberflaeche([T, B], 0, 2, 1), null, 'zu hoch zum Draufsteigen');
  const h = dachUeber([D], 0, -0.9);   // rot 2: Schräge steigt nach −z
  assert.ok(h > WAND_H + DACH_HUB * 0.9, 'gedrehtes Dach ist bei −z hoch');
  assert.deepEqual(huelle(T).map((v) => +v.toFixed(2)), [-1, 1, 0, WAND_H, -1, 1]);
});

test('Schmiede-Teile: Ofen und Amboss sind Stationen, auf der verstärkten Tür steht eine Wand wie auf der Türwand', () => {
  assert.ok(TEILE.schmelzofen.station && TEILE.amboss.station && !TEILE.eisentuer.station);
  const T = teil('eisentuer', 20, 0, -1);
  assert.equal(einrasten('wand', 20.2, -0.8, 0, [T], { wunschY: WAND_H + 0.3 }).y, WAND_H, 'Wand oben auf der Tür');
  const r = abriss([T], T.id, flach);
  assert.deepEqual(r.zurueck, { holz: 2, naegel: 3, eisenbarren: 0 });
  assert.equal(pruefe({ art: 'amboss', x: 20.3, y: 0, z: -0.6, rot: 0 }, [teil('schmelzofen', 20, 0, 0)], flach).ok, false, 'Amboss im Ofen');
});
