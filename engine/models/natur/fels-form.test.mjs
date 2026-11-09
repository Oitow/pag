import test from 'node:test';
import assert from 'node:assert/strict';
import { felsForm, icoNetz, saeulenNetz, normale } from './fels-form.js';

/** Anteil Dreiecke, deren Normale zur Mitte zeigt (umgeklappt). */
function umgeklappt(f, saeule = false) {
  const P = f.punkte, D = f.dreiecke;
  let my = 0; for (let i = 1; i < P.length; i += 3) my += P[i] / (P.length / 3);
  let schlecht = 0;
  for (let i = 0; i < D.length; i += 3) {
    const n = normale(P, D[i], D[i + 1], D[i + 2]);
    const m = [0, 1, 2].map(k => (P[D[i] * 3 + k] + P[D[i + 1] * 3 + k] + P[D[i + 2] * 3 + k]) / 3);
    if (saeule) { if (Math.abs(n[1]) < 0.5 && n[0] * m[0] + n[2] * m[2] < -0.02) schlecht++; }
    else if (n[0] * m[0] + n[1] * (m[1] - my) + n[2] * m[2] < -0.05) schlecht++;
  }
  return schlecht / (D.length / 3);
}

test('icoNetz: 20·f² Dreiecke, Punkte auf Einheitskugel, Normalen außen', () => {
  for (const f of [1, 2, 3]) {
    const n = icoNetz(f);
    assert.equal(n.dreiecke.length / 3, 20 * f * f);
    for (let i = 0; i < n.punkte.length; i += 3) assert.ok(Math.abs(Math.hypot(n.punkte[i], n.punkte[i + 1], n.punkte[i + 2]) - 1) < 1e-6);
  }
  assert.equal(umgeklappt(icoNetz(2)), 0);
});

test('saeulenNetz: 2·s·ringe Dreiecke, Umlaufsinn außen', () => {
  const n = saeulenNetz(6, [0, 0.3, 0.7, 1]);
  assert.equal(n.dreiecke.length / 3, 2 * 6 * 4);
  assert.equal(umgeklappt(n), 0);
});

test('felsForm ist deterministisch und seedabhängig', () => {
  const a = felsForm({ seed: 5, schnitte: 6, schichten: 3 }), b = felsForm({ seed: 5, schnitte: 6, schichten: 3 });
  assert.deepEqual(a.punkte, b.punkte);
  assert.deepEqual(a.dreiecke, b.dreiecke);
  assert.notDeepEqual(felsForm({ seed: 6 }).punkte, a.punkte);
});

test('felsForm: Boden flach geklemmt, Maße plausibel, keine NaN', () => {
  for (let seed = 1; seed < 20; seed++) {
    const f = felsForm({ seed, groesse: [1.2, 0.9, 1], boden: -0.1 });
    let ymin = Infinity;
    for (let i = 0; i < f.punkte.length; i++) assert.ok(Number.isFinite(f.punkte[i]));
    for (let i = 1; i < f.punkte.length; i += 3) ymin = Math.min(ymin, f.punkte[i]);
    assert.ok(ymin >= -0.1 - 1e-6);
    assert.ok(f.hoehe > 0.3 && f.hoehe < 1.2, `hoehe ${f.hoehe}`);
    assert.ok(f.radius > 0.3 && f.radius < 1.0, `radius ${f.radius}`);
  }
});

test('Bruchkanten erzeugen ebene Flächen (viele gleiche Normalen)', () => {
  const zaehle = f => {
    const D = f.dreiecke, set = new Set();
    for (let i = 0; i < D.length; i += 3) set.add(normale(f.punkte, D[i], D[i + 1], D[i + 2]).map(v => v.toFixed(2)).join());
    return set.size / (D.length / 3);
  };
  const glatt = felsForm({ seed: 3, schnitte: 0, frequenz: 3, erosion: 0 }), kantig = felsForm({ seed: 3, schnitte: 10, schnittTiefe: 0.5, frequenz: 3, erosion: 0 });
  assert.ok(zaehle(kantig) < zaehle(glatt) * 0.8);
});

test('kaum umgeklappte Dreiecke (ico und Säule mit Schichten)', () => {
  for (let seed = 1; seed < 15; seed++) {
    assert.ok(umgeklappt(felsForm({ seed, schnitte: 8, schnittTiefe: 0.45, kantig: 0.6, deckel: 0.2 })) < 0.03);
    assert.ok(umgeklappt(felsForm({ seed, form: 'saeule', segmente: 7, schichten: 5, groesse: [1.2, 3.4, 1.1], versenkt: 0.04 }), true) < 0.05);
  }
});
