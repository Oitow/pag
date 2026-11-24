// Prüft die Spielregeln des Erde-Labors (labore/erde): Eingriffe (Graben), Boden, Wachstum, Klima-Zeit, Ernte.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEingriffe } from '../labore/erde/js/eingriffe.js';
import { schichten, stoffInTiefe, grabung } from '../labore/erde/js/boden.js';
import { eignung, waehleBaum } from '../labore/erde/js/wachstum.js';
import { tempJetzt, sonnenRichtung, uhrFuer, BIOM } from '../labore/erde/js/klima.js';
import { ernte } from '../labore/erde/js/ernte.js';

const R = 100_000;

test('Eingriffe: Grube ist in der Mitte am tiefsten, wirkt nur im Radius, Spielstand kommt gleich zurück', () => {
  const e = createEingriffe({ radius: R });
  const d = [0.6, 0.8, 0];
  e.setze(d, 2, -0.5); e.setze(d, 2, -0.5);
  assert.ok(Math.abs(e.delta(...d) + 1) < 1e-9);
  assert.ok(e.delta(0.6, 0.8, 1 / R) > -1 && e.delta(0.6, 0.8, 1 / R) < 0);
  assert.equal(e.delta(0.6, 0.8, 2.5 / R), 0);
  e.entferne('0/11/5/7#12');
  const f = createEingriffe({ radius: R, zustand: JSON.parse(JSON.stringify(e.zustand())) });
  assert.equal(f.delta(...d), e.delta(...d));
  assert.ok(f.istWeg('0/11/5/7', 12) && !f.istWeg('0/11/5/7', 13));
});

test('Boden: Schichten enden im Gestein; Wüste = Sand; Granit braucht die Eisen-Spitzhacke; Funde sind fest je Ort', () => {
  const p = { h: 300, wasser: -Infinity, meer: 0, ufer: 0, temp: 10, feuchte: 0.6, gestein: 2 };
  const s = schichten(p, BIOM.MISCHWALD, 0);
  assert.equal(s[0].stoff, 'humus');
  assert.equal(s[s.length - 1].stoff, 'granit');
  assert.equal(stoffInTiefe(s, 50), 'granit');
  assert.equal(schichten({ ...p, temp: 22, feuchte: 0.05 }, BIOM.WUESTE)[0].stoff, 'sand');
  assert.equal(grabung('granit', [1, 2, 3], 5, 2).ok, false);
  assert.equal(grabung('humus', [1, 2, 3], 0, 0).ok, true);
  const a = grabung('schiefer', [10, 20, 30], 4, 3, 7), b = grabung('schiefer', [10, 20, 30], 4, 3, 7);
  assert.deepEqual(a, b);
});

test('Wachstum: Palmen nur warm, Fichten nicht in den Tropen, Wüste ohne Bäume', () => {
  assert.equal(eignung('palme', 0, 0.8), 0);
  assert.ok(eignung('palme', 25, 0.8) > 0.9);
  assert.equal(eignung('fichte', 26, 0.8), 0);
  assert.equal(waehleBaum(24, 0.05, 0.5), null);
  for (let i = 0; i < 20; i++) assert.ok(['fichte', 'tanne', 'kiefer', 'birke'].includes(waehleBaum(1, 0.7, i / 20)));
});

test('Zeit: Mittags steht die Sonne über dem Ort, mittags ist es wärmer als nachts, Nordsommer = Südwinter', () => {
  const d = [0, 0, 1]; // Äquator
  const s = sonnenRichtung(uhrFuer(12, d), 0.0);
  assert.ok(s[0] * d[0] + s[1] * d[1] + s[2] * d[2] > 0.99);
  const n = sonnenRichtung(uhrFuer(0, d), 0.0);
  assert.ok(n[0] * d[0] + n[1] * d[1] + n[2] * d[2] < -0.99);
  assert.ok(tempJetzt(10, d, uhrFuer(15, d), 0.3) > tempJetzt(10, d, uhrFuer(4, d), 0.3));
  const nord = [0, 0.7, 0.71], sued = [0, -0.7, 0.71];
  assert.ok(tempJetzt(5, nord, 12, 0.31) > tempJetzt(5, sued, 12, 0.31));
});

test('Ernte: Bäume brauchen die Axt, große Bäume geben mehr Holz, Felsen die Spitzhacke', () => {
  assert.equal(ernte('eiche', 1, { axt: false, hacke: 0 }).ok, false);
  const klein = ernte('eiche', 0.8, { axt: true, hacke: 0 }), gross = ernte('eiche', 1.2, { axt: true, hacke: 0 });
  assert.ok(klein.ok && gross.gibt[0][1] > klein.gibt[0][1]);
  assert.equal(ernte('granitblock', 1, { axt: true, hacke: 1 }).ok, false);
  assert.ok(ernte('beerenbusch', 1, { axt: false, hacke: 0 }).gibt.some(([id]) => id === 'beeren'));
});
