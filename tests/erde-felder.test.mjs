// Prüft die Ackerbau-Regeln des Erde-Labors (labore/erde/js/felder-regeln.js): Wachstumsdauer, Wasser, Frost, Boden, Ernte.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FRUECHTE, neuesBeet, schrittBeet, stufe, bodenPruefen, ernteMenge, startFrucht, besteSaat, saatVon,
} from '../labore/erde/js/felder-regeln.js';
import { PFLANZEN } from '../labore/erde/js/wachstum.js';

/** Stunden bis reif (oder Infinity nach maxH). */
function bisReif(b, u = {}, maxH = 24 * 30, dh = 0.25) {
  for (let t = 0; t < maxH; t += dh) if (schrittBeet(b, dh, { tJetzt: 15, ...u }) === 'reif') return t + dh;
  return Infinity;
}
const besaet = (f, T, F, fb = 1) => ({ ...neuesBeet(T, F, fb), f });

test('Wachstum: Weizen am besten Ort reif nach ~3 Spieltagen, schlechter Ort/Sand langsamer, falsches Klima nie', () => {
  const gut = bisReif(besaet('weizen', 11, 0.55)) / 24;
  assert.ok(gut >= 2.8 && gut <= 3.6, `Weizen ideal: ${gut} Tage`);
  const mager = bisReif(besaet('weizen', 18, 0.3, 0.15)) / 24;
  assert.ok(mager > gut * 2, `schlechter Ort + Sand: ${mager} Tage`);
  assert.equal(bisReif(besaet('reis', -2, 0.5)), Infinity, 'Reis in der Tundra wächst nicht');
  for (const f of Object.keys(FRUECHTE)) assert.ok(PFLANZEN[f]?.feld, `${f} fehlt in wachstum.js PFLANZEN`);
  assert.deepEqual([0, 0.2, 0.5, 1].map(stufe), ['saat', 'keimling', 'wachsend', 'reif']);
});

test('Wasser: Regen gießt, ohne Regen trocknet der Boden in trockener Gegend aus und das Wachstum bremst', () => {
  const trocken = besaet('hirse', 25, 0.15), nass = besaet('hirse', 25, 0.15);
  const tTrocken = bisReif(trocken, { tJetzt: 28 }), tNass = bisReif(nass, { tJetzt: 28, regen: 0.6 });
  assert.ok(trocken.w < 0.2, `trocken: Wasser ${trocken.w}`);
  assert.ok(tNass < tTrocken * 0.8, `Regen ${tNass} h vs. trocken ${tTrocken} h`);
});

test('Frost: eine Nacht bei −6 °C tötet Kartoffeln, Roggen übersteht sie; Saat im Boden leidet nicht', () => {
  const nacht = (b) => { let ev = null; for (let t = 0; t < 10; t += 0.25) ev = schrittBeet(b, 0.25, { tJetzt: -6 }) || ev; return ev; };
  const kartoffel = { ...besaet('kartoffel', 10, 0.6), p: 0.5 }, roggen = { ...besaet('roggen', 10, 0.6), p: 0.5 };
  const saat = besaet('kartoffel', 10, 0.6);
  assert.equal(nacht(kartoffel), 'erfroren');
  assert.equal(nacht(roggen), null);
  assert.ok(roggen.g > 0.3, `Roggen Gesundheit ${roggen.g}`);
  nacht(saat);
  assert.equal(saat.g, 1);
  assert.deepEqual(ernteMenge({ ...kartoffel, p: 1 }), [], 'Erfrorenes gibt nichts');
});

test('Boden: Erde/Lehm gehen, Sand nur schlecht, Fels/Kies/Wasser/ohne Schaufel nicht', () => {
  assert.equal(bodenPruefen({ stoff: 'humus' }).ok, true);
  assert.equal(bodenPruefen({ stoff: 'lehm' }).ok, true);
  const sand = bodenPruefen({ stoff: 'sand' });
  assert.ok(sand.ok && sand.fb < 0.3 && sand.warnung);
  for (const z of [{ stoff: 'granit' }, { stoff: 'kies' }, { stoff: 'schnee' }, { stoff: 'humus', wasser: true },
    { stoff: 'humus', schaufel: false }, { stoff: 'humus', steil: 1 }]) assert.equal(bodenPruefen(z).ok, false, JSON.stringify(z));
});

test('Ernte und Saat: reifes Beet gibt Frucht + 2–3 Saat, Startsaat passt zum Klima, gesät wird die passende Saat', () => {
  const b = { ...besaet('mais', 20, 0.6), p: 1 };
  const [[f, n], [s, k]] = ernteMenge(b, 0.9);
  assert.equal(f, 'mais'); assert.equal(n, FRUECHTE.mais.ertrag);
  assert.equal(s, 'saat_mais'); assert.ok(k >= 2 && k <= 3);
  assert.equal(ernteMenge({ ...b, p: 0.9 }).length, 0, 'unreif gibt nichts');
  assert.equal(startFrucht(2, 0.6), 'roggen');
  assert.ok(['reis', 'hirse', 'mais'].includes(startFrucht(26, 0.85)));
  const tasche = { [saatVon('reis')]: 3, [saatVon('roggen')]: 9 };
  assert.equal(besteSaat(3, 0.6, (id) => tasche[id] || 0), 'roggen');
  assert.equal(besteSaat(25, 0.9, (id) => tasche[id] || 0), 'reis');
  assert.equal(besteSaat(10, 0.5, () => 0), null);
});
