import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeder, createSekundaer } from './character-sekundaer.js';
import { leerePose, BEINE } from './character-pose.js';

const DT = 1 / 60;

test('Feder: erreicht das Ziel, unterkritisch schwingt über, große dt stabil', () => {
  const f = createFeder({ steif: 100, daempf: 6 });
  let max = 0;
  for (let t = 0; t < 3; t += DT) max = Math.max(max, f.schritt(DT, 1));
  assert.ok(Math.abs(f.wert - 1) < 1e-3 && max > 1.05, `Endwert ${f.wert}, Überschwinger ${max}`);
  const g = createFeder({ steif: 400, daempf: 40 });
  for (let i = 0; i < 20; i++) g.schritt(0.25, 2);
  assert.ok(Math.abs(g.wert - 2) < 1e-3, 'Teilschritte halten große dt stabil');
  g.schritt(NaN, NaN); assert.ok(Number.isFinite(g.wert));
});

test('Gewichtsverlagerung: Bremsen kippt den Rumpf vor, schwingt zurück und klingt ab', () => {
  const s = createSekundaer();
  for (let t = 0; t < 0.3; t += DT) s.update(DT, { tempo: 3, beschl: -10 });
  assert.ok(s.werte.torsoX > 0.02 && s.werte.kopfX > 0, `torsoX ${s.werte.torsoX}`);
  let min = 0;
  for (let t = 0; t < 3; t += DT) { s.update(DT, { tempo: 0, beschl: 0 }); min = Math.min(min, s.werte.torsoX); }
  assert.ok(min < 0, 'schwingt über die Ruhe hinaus zurück');
  assert.ok(Math.abs(s.werte.torsoX) < 1e-3, 'klingt ab');
});

test('Umhang weht bei Tempo nach hinten, Kurve lenkt seitlich aus; anwenden lässt Beine in Ruhe', () => {
  const s = createSekundaer();
  for (let t = 0; t < 3; t += DT) s.update(DT, { tempo: 6, quer: 5 });
  assert.ok(s.werte.umhangX > 0.3 && s.werte.haarX > 0.1, 'Saum nach hinten');
  assert.ok(s.werte.umhangZ > 0 && s.werte.torsoZ < 0, 'Fliehkraft nach +X');
  const p = leerePose();
  s.stoss(3, 1, 0);
  s.update(DT, { tempo: 6, quer: 5 });
  s.anwenden(p);
  assert.ok(p.torso.x !== 0 && p.kopf.x !== 0);
  for (const k of [...BEINE, 'basisPos', 'basis']) assert.deepEqual(p[k], { x: 0, y: 0, z: 0 }, k);
  for (let t = 0; t < 5; t += DT) s.update(DT, { tempo: NaN, beschl: 1e9, vy: -1e9 });
  for (const v of Object.values(s.werte)) assert.ok(Number.isFinite(v) && Math.abs(v) <= 1.4);
  s.reset(); assert.equal(s.werte.umhangX, 0); s.dispose();
});
