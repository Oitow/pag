import test from 'node:test';
import assert from 'node:assert/strict';
import { createWetter, WETTER_ARTEN } from './wetter.js';

const KEYS = ['wolken', 'regen', 'schnee', 'nebel', 'wind', 'nass', 'blitz'];
function lauf(w, stunden, klima, dt = 0.1) {
  const log = [];
  for (let t = 0; t < stunden; t += dt) { w.update(dt, klima); log.push([w.art, w.wolken, w.regen, w.schnee, w.nebel]); }
  return log;
}

test('Wetterarten: alle Zielwerte in 0..1', () => {
  assert.equal(Object.keys(WETTER_ARTEN).length, 8);
  for (const z of Object.values(WETTER_ARTEN)) for (const v of Object.values(z)) assert.ok(v >= 0 && v <= 1);
});

test('deterministisch bei gleichem Seed', () => {
  const a = lauf(createWetter({ seed: 5 }), 100), b = lauf(createWetter({ seed: 5 }), 100);
  assert.deepEqual(a, b);
  const c = lauf(createWetter({ seed: 6 }), 100);
  assert.notDeepEqual(a, c);
});

test('weiche Übergänge, Werte in 0..1', () => {
  const w = createWetter({ seed: 3 });
  let vor = KEYS.map((k) => w[k]);
  for (let i = 0; i < 3000; i++) {
    w.update(0.05, { temperatur: 0.5, feuchte: 0.8 }); w.blitzUpdate(0.05);
    const jetzt = KEYS.map((k) => w[k]);
    jetzt.forEach((v, j) => {
      assert.ok(v >= 0 && v <= 1, KEYS[j]);
      if (KEYS[j] !== 'blitz' && KEYS[j] !== 'wind') assert.ok(Math.abs(v - vor[j]) < 0.2, KEYS[j]);
    });
    vor = jetzt;
  }
});

test('kalt: nie Regen/Gewitter, dafür Schnee', () => {
  const w = createWetter({ seed: 2 });
  const arten = new Set();
  w.on('wechsel', (a) => arten.add(a));
  lauf(w, 600, { temperatur: 0.1, feuchte: 0.9 });
  assert.ok(!arten.has('regen') && !arten.has('gewitter'));
  assert.ok(arten.has('schnee'));
});

test('trocken-heiß fast kein Niederschlag, feucht deutlich mehr', () => {
  const anteil = (klima) => {
    let n = 0, summe = 0;
    for (const s of [1, 2, 3]) { const l = lauf(createWetter({ seed: s }), 500, klima, 0.25); n += l.length; summe += l.filter((x) => x[2] > 0.05 || x[3] > 0.05).length; }
    return summe / n;
  };
  const trocken = anteil({ temperatur: 0.9, feuchte: 0.1 }), feucht = anteil({ temperatur: 0.5, feuchte: 0.9 });
  assert.ok(trocken < 0.05, 'trocken ' + trocken);
  assert.ok(feucht > trocken * 3 && feucht > 0.15, 'feucht ' + feucht);
});

test('setze: sofort und weich, Ereignis', () => {
  const w = createWetter();
  const ev = [];
  const ab = w.on('wechsel', (a, v) => ev.push([a, v]));
  w.setze('regen');
  assert.equal(w.regen, 0);
  w.setze('gewitter', true);
  assert.equal(w.regen, 1);
  assert.deepEqual(ev, [['regen', 'heiter'], ['gewitter', 'regen']]);
  ab(); w.setze('klar');
  assert.equal(ev.length, 2);
  w.dispose();
});

test('Gewitter: Blitz klingt ab, nass steigt und trocknet', () => {
  const w = createWetter({ seed: 4 });
  w.setze('gewitter', true);
  let max = 0;
  for (let i = 0; i < 600; i++) { w.blitzUpdate(0.1); max = Math.max(max, w.blitz); }
  assert.equal(max, 1);
  for (let i = 0; i < 20; i++) w.update(0.1);
  assert.ok(w.nass > 0.3);
  w.setze('klar', true);
  const n0 = w.nass; w.update(1);
  assert.ok(w.nass < n0);
  const w2 = createWetter(); w2.setze('klar', true);
  for (let i = 0; i < 100; i++) { w2.blitzUpdate(0.1); assert.equal(w2.blitz, 0); }
});

test('zustand/lade: gleicher weiterer Verlauf', () => {
  const k = { temperatur: 0.5, feuchte: 0.6 };
  const a = createWetter({ seed: 9 });
  lauf(a, 40, k);
  a.blitzUpdate(0.3);
  const z = JSON.parse(JSON.stringify(a.zustand()));
  const b = createWetter({ seed: 9 });
  b.lade(z);
  assert.deepEqual(lauf(a, 150, k), lauf(b, 150, k));
  assert.equal(a.wind, b.wind);
});
