import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProgression, xpFuer, TALENTBAUM } from './progression.js';
import { wuerfle, beschreibe } from './beute.js';

test('XP: Stufenaufstieg, Talentpunkte ab Stufe 2, Obergrenze', () => {
  const p = createProgression({ klasse: 'krieger' });
  assert.equal(p.punkte, 0);
  const e = p.gibXp(xpFuer(1) + xpFuer(2) + 5);
  assert.deepEqual(e.aufstiege, [2, 3]);
  assert.equal(p.xp, 5); assert.equal(p.punkte, 2);
  p.gibXp(1e9); assert.equal(p.stufe, 15); assert.equal(p.punkte, 14);
  assert.ok(p.werte().leben > createProgression({ klasse: 'krieger' }).werte().leben);
});

test('Talente: Voraussetzung Zweig-Punkte, Maximum, Punkte', () => {
  for (const k of Object.keys(TALENTBAUM)) assert.ok(TALENTBAUM[k].length === 3 && TALENTBAUM[k].every((z) => z.talente.length === 4));
  const p = createProgression({ klasse: 'krieger', stufe: 4 });
  assert.equal(p.lerne('kr_klinge').ok, false);
  assert.equal(p.lerne('kr_schlag').ok, true); assert.equal(p.lerne('kr_schlag').ok, true);
  assert.equal(p.lerne('kr_klinge').ok, true);
  assert.equal(p.lerne('kr_schlag').grund, 'keine Punkte');
  assert.equal(p.punkte, 0);
  assert.ok(p.werte({ schaden: 10 }).schaden >= createProgression({ klasse: 'krieger' }).werte().schaden + 14);
});

test('Beute: deterministisch per Seed, Werte skalieren mit Stufe', () => {
  const a = wuerfle('kiste', { seed: 7, stufe: 3 }), b = wuerfle('kiste', { seed: 7, stufe: 3 });
  assert.deepEqual(a, b);
  const d1 = wuerfle('boss', { seed: 5, stufe: 2 }).find((x) => x.daten), d9 = wuerfle('boss', { seed: 5, stufe: 12 }).find((x) => x.daten);
  assert.equal(d1.id, d9.id);
  const s = (d) => Object.values(d.daten.werte).reduce((n, v) => n + Math.abs(v), 0);
  assert.ok(s(d9) > s(d1));
  assert.match(beschreibe(d9.id, d9.daten).name, /Wolfsfels-/);
});

test('Boss: garantiert episch oder besser', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const teile = wuerfle('boss', { seed, stufe: 8 }).filter((x) => x.daten);
    assert.ok(teile.length >= 1 && teile.every((x) => ['episch', 'legendaer'].includes(x.daten.seltenheit)));
  }
});

test('zustand/lade: Rundreise', () => {
  const p = createProgression({ klasse: 'magier', name: 'Mia', stufe: 5, xp: 40 });
  p.lerne('ma_glut'); p.lerne('ma_glut');
  const q = createProgression({ klasse: 'magier' }); q.lade(JSON.parse(JSON.stringify(p.zustand())));
  assert.deepEqual(q.zustand().talente, { ma_glut: 2 });
  assert.equal(q.stufe, 5); assert.equal(q.xp, 40); assert.equal(q.punkte, 2);
});
