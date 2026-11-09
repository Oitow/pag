import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPEN, erzeuge } from './pflanze-boden.js';
import { BLUMEN_SORTEN, PILZ_SORTEN } from './pflanze-formen.js';

const tri = (e) => e.geometrie.attributes.position.count / 3;
const BUDGET = { grasbueschel: 80, blume: 80, farn: 160, seerose: 120, pilz: 200, schilf: 200 };
const HOEHE = { grasbueschel: [0.15, 0.65], blume: [0.05, 1.3], farn: [0.15, 0.9], seerose: [0, 0.15], pilz: [0.03, 0.3], schilf: [1, 2.4] };

function pruefe(e, name) {
  const g = e.geometrie, n = g.attributes.position.count;
  assert.ok(n > 0 && n % 3 === 0, name);
  for (const a of ['position', 'normal', 'color', 'wind']) assert.equal(g.attributes[a].count, n, `${name}: ${a}`);
  const p = g.attributes.position.array;
  for (let i = 0; i < p.length; i++) { assert.ok(Number.isFinite(p[i]), `${name}: NaN`); if (i % 3 === 1) assert.ok(p[i] >= -0.2, `${name}: zu tief`); }
  for (const v of g.attributes.color.array) assert.ok(v >= 0 && v <= 1, `${name}: Farbe`);
  for (const v of g.attributes.wind.array) assert.ok(v >= 0 && v <= 1, `${name}: Wind`);
  assert.equal(e.stammRadius, 0, `${name}: begehbar`);
}

test('alle Typen × detail × Jahreszeit: gültige Geometrie', () => {
  assert.deepEqual(TYPEN, ['farn', 'grasbueschel', 'blume', 'pilz', 'schilf', 'seerose']);
  for (const t of TYPEN) for (const detail of [0, 1, 2]) for (const jahreszeit of ['sommer', 'herbst', 'winter'])
    for (let seed = 1; seed <= 5; seed++) pruefe(erzeuge(t, seed, { detail, jahreszeit }), `${t}/${detail}/${jahreszeit}/${seed}`);
});

test('Budget bei detail 1, detail 0 ≤ 1 ≤ 2', () => {
  for (const t of TYPEN) {
    const summe = [0, 0, 0];
    for (let seed = 1; seed <= 40; seed++) for (const d of [0, 1, 2]) {
      const n = tri(erzeuge(t, seed, { detail: d }));
      summe[d] += n;
      if (d === 1) assert.ok(n <= BUDGET[t], `${t} #${seed}: ${n} > ${BUDGET[t]}`);
    }
    assert.ok(summe[0] < summe[1] && summe[1] < summe[2], `${t}: ${summe}`);
  }
});

test('deterministisch, Seeds unterscheiden sich', () => {
  for (const t of TYPEN) {
    const a = erzeuge(t, 11), b = erzeuge(t, 11), c = erzeuge(t, 12);
    assert.deepEqual(a.geometrie.attributes.position.array, b.geometrie.attributes.position.array);
    assert.deepEqual(a.geometrie.attributes.color.array, b.geometrie.attributes.color.array);
    assert.notDeepEqual(a.geometrie.attributes.position.array, c.geometrie.attributes.position.array);
  }
});

test('Maße je Typ, Seerose liegt flach auf y≈0', () => {
  for (const t of TYPEN) for (let seed = 1; seed <= 15; seed++) {
    const e = erzeuge(t, seed);
    assert.ok(e.hoehe >= HOEHE[t][0] && e.hoehe <= HOEHE[t][1], `${t} #${seed}: hoehe ${e.hoehe}`);
    assert.ok(e.radius > 0.02 && e.radius < 1.2, `${t}: radius ${e.radius}`);
  }
  for (let seed = 1; seed <= 15; seed++) {
    const p = erzeuge('seerose', seed).geometrie.attributes.position.array;
    for (let i = 1; i < p.length; i += 3) assert.ok(p[i] > 0 && p[i] < 0.15);
  }
});

test('Wind: Gras/Schilf/Farn unten ~0, Spitzen stark; Pilz starr', () => {
  for (const t of ['grasbueschel', 'schilf', 'farn']) for (let seed = 1; seed <= 5; seed++) {
    const e = erzeuge(t, seed), p = e.geometrie.attributes.position.array, w = e.geometrie.attributes.wind.array;
    let unten = 0, oben = 0;
    for (let i = 0; i < w.length; i++) {
      if (p[i * 3 + 1] < e.hoehe * 0.05) unten = Math.max(unten, w[i]);
      oben = Math.max(oben, w[i]);
    }
    assert.ok(unten < 0.2 && oben > 0.75, `${t}: ${unten}/${oben}`);
  }
  for (let seed = 1; seed <= 5; seed++) assert.equal(Math.max(...erzeuge('pilz', seed).geometrie.attributes.wind.array), 0);
});

test('Blumensorten, opts.farbe überschreibt die Blüte, Pilzsorten', () => {
  for (const sorte of Object.keys(BLUMEN_SORTEN)) for (const detail of [0, 1, 2]) {
    const e = erzeuge('blume', 4, { sorte, detail });
    assert.ok(tri(e) > 5 && (detail !== 1 || tri(e) <= 80), `${sorte}/${detail}: ${tri(e)}`);
  }
  const rot = erzeuge('blume', 4, { sorte: 'margerite', farbe: '#ff0000' }).geometrie.attributes.color.array;
  const weiss = erzeuge('blume', 4, { sorte: 'margerite' }).geometrie.attributes.color.array;
  let blau = [0, 0];
  for (let i = 2; i < rot.length; i += 3) { blau[0] += rot[i]; blau[1] += weiss[i]; }
  assert.ok(blau[0] < blau[1] * 0.8, 'rote Blüte hat weniger Blau als weiße');
  for (const sorte of Object.keys(PILZ_SORTEN)) pruefe(erzeuge('pilz', 2, { sorte }), sorte);
  assert.ok(erzeuge('pilz', 2, { sorte: 'kreis' }).radius > 0.25, 'Hexenring ist breit');
  assert.throws(() => erzeuge('busch', 1));
});
