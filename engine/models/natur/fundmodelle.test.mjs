import test from 'node:test';
import assert from 'node:assert/strict';
import { baueFundmodell } from './fundmodelle.js';

const ARTEN = ['erzbrocken', 'ammonit', 'quarzdruse'];

test('jede Fundart liefert ganze Dreiecke mit passenden Farben', () => {
  for (const art of ARTEN) {
    const { positions, colors } = baueFundmodell(art, 5);
    assert.ok(positions.length > 0 && positions.length % 9 === 0, art);
    assert.equal(colors.length, positions.length, art);
    assert.ok(positions.every(Number.isFinite) && colors.every((c) => c >= 0 && c <= 1), art);
  }
});

test('gleicher Seed → gleiches Modell, anderer Seed → anderes', () => {
  assert.deepEqual(baueFundmodell('quarzdruse', 9), baueFundmodell('quarzdruse', 9));
  assert.notDeepEqual(baueFundmodell('erzbrocken', 1).positions, baueFundmodell('erzbrocken', 2).positions);
});

test('Fundstücke bleiben handlich klein (unter 1,5 m)', () => {
  for (const art of ARTEN) {
    const p = baueFundmodell(art, 3).positions;
    for (let i = 0; i < p.length; i++) assert.ok(Math.abs(p[i]) < 1.5, `${art} Koordinate ${p[i]}`);
  }
});

test('unbekannte Art wirft', () => assert.throws(() => baueFundmodell('gold'), RangeError));
