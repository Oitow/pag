import test from 'node:test';
import assert from 'node:assert/strict';
import { TYPEN, erzeuge } from './baum.js';

const dreiecke = (g) => g.attributes.position.count / 3;

test('baum: TYPEN deckt den Vertrag ab', () => {
  for (const t of ['eiche', 'buche', 'birke', 'ahorn', 'weide', 'tanne', 'fichte', 'kiefer', 'pinie', 'tropenbaum', 'palme', 'akazie', 'olive', 'toterBaum'])
    assert.ok(TYPEN.includes(t), t);
  assert.throws(() => erzeuge('gibtsnicht', 1));
});

test('baum: Attribute, Dreiecksbudget je detail, Maße', () => {
  for (const t of TYPEN) {
    const n = [];
    for (const detail of [0, 1, 2]) {
      const e = erzeuge(t, 9, { detail });
      const g = e.geometrie;
      for (const a of ['position', 'normal', 'color']) assert.ok(g.attributes[a], `${t} ${a}`);
      assert.equal(g.attributes.wind.itemSize, 1);
      assert.equal(g.attributes.wind.count, g.attributes.position.count);
      assert.ok(!g.index);
      n.push(dreiecke(g));
      for (const v of g.attributes.color.array) assert.ok(v >= 0 && v <= 1);
      for (const v of g.attributes.position.array) assert.ok(Number.isFinite(v));
      assert.ok(e.hoehe > 2 && e.hoehe < 25, `${t} hoehe ${e.hoehe}`);
      assert.ok(e.radius > 0.5 && e.radius < 14, `${t} radius ${e.radius}`);
      assert.ok(e.stammRadius > 0.05 && e.stammRadius < 1, `${t} stammRadius`);
      assert.ok(g.boundingBox.min.y >= -0.3 && g.boundingBox.min.y < 0.1, `${t} Fuß ${g.boundingBox.min.y}`);
    }
    assert.ok(n[0] <= 500, `${t} d0: ${n[0]}`);
    assert.ok(n[1] <= 1500, `${t} d1: ${n[1]}`);
    assert.ok(n[2] <= 7000, `${t} d2: ${n[2]}`);
    assert.ok(n[0] <= n[1] && n[1] <= n[2], `${t} ${n}`);
  }
});

test('baum: deterministisch, Seed ändert Form', () => {
  for (const t of TYPEN) {
    const a = erzeuge(t, 4).geometrie.attributes.position.array;
    const b = erzeuge(t, 4).geometrie.attributes.position.array;
    assert.deepEqual(a, b, t);
    const c = erzeuge(t, 5).geometrie.attributes.position.array;
    assert.notDeepEqual(a, c, t);
  }
});

test('baum: Wind unten starr, oben beweglich', () => {
  for (const t of TYPEN) {
    const e = erzeuge(t, 2), g = e.geometrie, p = g.attributes.position.array, w = g.attributes.wind.array;
    let unten = 0, oben = 0;
    for (let i = 0; i < w.length; i++) {
      // Stammfuß: bodennah und nahe der Achse
      if (p[i * 3 + 1] < 0.5 && Math.hypot(p[i * 3], p[i * 3 + 2]) < e.stammRadius * 2.5) unten = Math.max(unten, w[i]);
      oben = Math.max(oben, w[i]);
    }
    assert.ok(unten < 0.05, `${t} unten ${unten}`);
    assert.ok(oben > 0.4, `${t} oben ${oben}`);
  }
});

test('baum: Jahreszeiten und Alter', () => {
  const s = erzeuge('ahorn', 3), h = erzeuge('ahorn', 3, { jahreszeit: 'herbst' }), w = erzeuge('ahorn', 3, { jahreszeit: 'winter' });
  const mittel = (g) => { const c = g.attributes.color.array; let r = 0, gr = 0; for (let i = 0; i < c.length; i += 3) { r += c[i]; gr += c[i + 1]; } return [r, gr]; };
  const [rs, gs] = mittel(s.geometrie), [rh, gh] = mittel(h.geometrie);
  assert.ok(rh / gh > rs / gs * 1.5, 'Herbst röter');
  assert.ok(w.radius > 1);   // kahl, aber Äste da
  const tanneW = erzeuge('tanne', 3, { jahreszeit: 'winter' }), tanneS = erzeuge('tanne', 3);
  assert.equal(dreiecke(tanneW.geometrie), dreiecke(tanneS.geometrie));   // immergrün, nur Schnee
  assert.ok(erzeuge('eiche', 3, { alter: 0.2 }).hoehe < erzeuge('eiche', 3, { alter: 1 }).hoehe * 0.7);
});
