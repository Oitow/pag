import test from 'node:test';
import assert from 'node:assert/strict';
import { createIdleSchicht } from './character-anim-idle.js';
import { IDLE_VARIANTEN, CLIPS } from './character-clips.js';

const DT = 1 / 60;

test('Varianten starten erst nach Ruhe, wechseln sich ab, deterministisch per Seed', () => {
  const lauf = (seed) => {
    const s = createIdleSchicht({ seed, nach: [3, 5] }), folge = [];
    for (let t = 0; t < 60; t += DT) { s.update(DT, true); if (s.name && s.name !== folge[folge.length - 1]) folge.push(s.name); }
    return folge;
  };
  const a = lauf(7);
  assert.deepEqual(a, lauf(7));
  assert.ok(a.length >= 4, a.join());
  for (let i = 1; i < a.length; i++) assert.notEqual(a[i], a[i - 1]);
  for (const n of a) assert.ok(IDLE_VARIANTEN.includes(n) && CLIPS[n].idle);
  const s = createIdleSchicht({ seed: 1, nach: [3, 5] });
  for (let t = 0; t < 2.9; t += DT) assert.equal(s.update(DT, true), 0);
});

test('Bewegung bricht weich und schnell ab; Ruhezeit beginnt neu', () => {
  const s = createIdleSchicht({ seed: 2, nach: [1, 1] });
  let w = 0;
  for (let t = 0; t < 2; t += DT) w = s.update(DT, true);
  assert.ok(s.name && w > 0.5, `${s.name} ${w}`);
  const w1 = s.update(DT, false);
  assert.ok(w1 > 0 && w1 < w, 'kein Sprung');
  for (let t = 0; t < 0.3; t += DT) s.update(DT, false);
  assert.equal(s.name, null); assert.equal(s.ruheZeit, 0);
  assert.ok(s.starte('gaehnen') && !s.starte('gibtsNicht'));
  s.dispose();
});
