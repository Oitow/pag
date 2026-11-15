import test from 'node:test';
import assert from 'node:assert/strict';
import { createQualitaet, QUALITAETS_STUFEN } from './qualitaet.js';

const lauf = (q, dt, sek) => { let w = null; for (let t = 0; t < sek; t += dt) { const s = q.update(dt); if (s) w = s; } return w; };

test('startet bei Stufe 0 und bleibt bei guter Bildzeit', () => {
  const q = createQualitaet();
  assert.equal(q.nr, 0);
  assert.equal(lauf(q, 0.017, 10), null);
  assert.equal(q.stufe.pixel, QUALITAETS_STUFEN[0].pixel);
});
test('schlechte Bildzeit senkt nach ~1.5 s, nicht früher', () => {
  const q = createQualitaet();
  assert.equal(lauf(q, 0.05, 1.0), null);
  assert.ok(lauf(q, 0.05, 1.0));
  assert.equal(q.nr, 1);
});
test('fällt stufenweise bis zur letzten und nicht weiter', () => {
  const q = createQualitaet();
  lauf(q, 0.08, 30);
  assert.equal(q.nr, QUALITAETS_STUFEN.length - 1);
  assert.equal(q.stufe.schatten, 0);
});
test('Verbesserung erst nach ~4 s guter Bildzeit', () => {
  const q = createQualitaet({ start: 2 });
  assert.equal(lauf(q, 0.012, 3.5), null);
  assert.ok(lauf(q, 0.012, 1.5));
  assert.equal(q.nr, 1);
});
test('Hin-und-her wird gebremst (nach Rücknahme längere Wartezeit)', () => {
  const q = createQualitaet({ start: 1 });
  lauf(q, 0.012, 4.5);                 // besser → 0
  assert.equal(q.nr, 0);
  lauf(q, 0.05, 2);                    // sofort wieder schlechter → 1
  assert.equal(q.nr, 1);
  assert.equal(lauf(q, 0.012, 5), null);   // jetzt > 4 s nötig
  assert.equal(q.nr, 1);
});
test('fest/setze schalten die Automatik aus; Pausen zählen nicht', () => {
  const q = createQualitaet();
  q.fest(true);
  assert.equal(lauf(q, 0.1, 10), null);
  assert.equal(q.setze(3).nr, 3);
  assert.equal(q.setze(3), null);
  q.fest(false);
  assert.equal(q.update(2), null);
});
test('fps ist geglättet, dispose stoppt', () => {
  const q = createQualitaet();
  lauf(q, 0.02, 3);
  assert.ok(Math.abs(q.fps - 50) < 2);
  q.dispose();
  assert.equal(lauf(q, 0.1, 5), null);
});
