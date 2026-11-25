// Tests für astbaum: Determinismus, Artenauswahl, Dreiecks-Budget je Stufe, saubere Attribute.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baueAstbaum, baueAstbaumFern, kannAstbaum, ASTBAUM_ARTEN } from './astbaum.js';

test('gleicher Seed → gleiche Geometrie, anderer Seed → andere', () => {
  const a = baueAstbaum('eiche', 5, { detail: 2 }).geometrie.attributes.position.array;
  const b = baueAstbaum('eiche', 5, { detail: 2 }).geometrie.attributes.position.array;
  const c = baueAstbaum('eiche', 6, { detail: 2 }).geometrie.attributes.position.array;
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});

test('nur Arten mit Ästen + Laub (keine Etagen-Nadelbäume, Palmen, toten Bäume)', () => {
  for (const t of ['eiche', 'buche', 'weide', 'kiefer']) assert.ok(kannAstbaum(t), t);
  for (const t of ['tanne', 'palme', 'toterBaum']) assert.ok(!kannAstbaum(t), t);
});

test('Dreiecks-Budget: nah < 12k, mittel < 2.6k, fern < 80 (Handy)', () => {
  for (const t of ASTBAUM_ARTEN) {
    const n = (d) => baueAstbaum(t, 31, { detail: d }).geometrie.attributes.position.count / 3;
    assert.ok(n(2) < 12000, `${t} nah ${n(2)}`);
    assert.ok(n(1) < 2600, `${t} mittel ${n(1)}`);
    assert.ok(baueAstbaumFern(t, 31).attributes.position.count / 3 < 80, `${t} fern`);
  }
});

test('Attribute vollständig, gleich lang, ohne NaN; Ursprung am Fuß', () => {
  for (const g of [baueAstbaum('weide', 3, { detail: 2 }).geometrie, baueAstbaumFern('kiefer', 3)]) {
    const n = g.attributes.position.count;
    for (const k of ['position', 'normal', 'color', 'wind']) {
      assert.equal(g.attributes[k].count, n, k);
      assert.ok(g.attributes[k].array.every(Number.isFinite), k);
    }
    g.computeBoundingBox();
    assert.ok(g.boundingBox.min.y > -0.5 && g.boundingBox.max.y > 2);
  }
});

test('Winter: laubwerfende Bäume kahl (deutlich weniger Dreiecke)', () => {
  const s = baueAstbaum('buche', 9, { detail: 2 }).geometrie.attributes.position.count;
  const w = baueAstbaum('buche', 9, { detail: 2, jahreszeit: 'winter' }).geometrie.attributes.position.count;
  assert.ok(w < s * 0.6);
});
