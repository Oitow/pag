import test from 'node:test';
import assert from 'node:assert/strict';
import { baueSkelett, maxOrdnung } from './baum-skelett.js';
import { ARTEN, ART_NAMEN, art } from './baum-arten.js';

const ALLE = ['eiche', 'buche', 'birke', 'ahorn', 'weide', 'tanne', 'fichte', 'kiefer', 'pinie', 'tropenbaum', 'palme', 'akazie', 'olive', 'toterBaum'];

test('baum-arten: alle Vertrags-Typen vorhanden, unbekannter Typ wirft', () => {
  for (const t of ALLE) assert.ok(ARTEN[t], t);
  assert.deepEqual([...ART_NAMEN].sort(), [...ALLE].sort());
  assert.throws(() => art('gibtsnicht'));
});

test('baum-skelett: deterministisch je Seed, verschieden bei anderem Seed', () => {
  for (const t of ALLE) {
    const a = JSON.stringify(baueSkelett(art(t), 11, { detail: 1 }));
    assert.equal(a, JSON.stringify(baueSkelett(art(t), 11, { detail: 1 })), t);
    assert.notEqual(a, JSON.stringify(baueSkelett(art(t), 12, { detail: 1 })), t);
  }
});

test('baum-skelett: Ordnungen steigen mit detail, Winter feiner, alter kleiner', () => {
  const eiche = art('eiche');
  assert.ok(maxOrdnung(eiche, 0) < maxOrdnung(eiche, 1) && maxOrdnung(eiche, 1) < maxOrdnung(eiche, 2));
  assert.equal(maxOrdnung(eiche, 1, { kahl: true }), maxOrdnung(eiche, 1) + 1);
  const ord = (sk) => Math.max(...sk.aeste.map((a) => a.ordnung));
  assert.equal(ord(baueSkelett(eiche, 3, { detail: 2 })), maxOrdnung(eiche, 2));
  const jung = baueSkelett(eiche, 3, { alter: 0.1 }), alt = baueSkelett(eiche, 3, { alter: 1 });
  assert.ok(jung.spitze[1] < alt.spitze[1] * 0.6);
  assert.ok(jung.aeste.length < alt.aeste.length);
});

test('baum-skelett: Budget, Formen und Maße plausibel für alle Typen', () => {
  for (const t of ALLE) for (const detail of [0, 1, 2]) {
    const a = art(t), sk = baueSkelett(a, 5, { detail });
    const segs = sk.aeste.reduce((s, x) => s + x.punkte.length - 1, 0);
    assert.ok(segs <= [60, 150, 400][detail], `${t} d${detail}: ${segs} Segmente`);
    assert.ok(sk.spitze[1] > 1.5 && sk.spitze[1] < 25, `${t} Höhe ${sk.spitze[1]}`);
    for (const ast of sk.aeste) {
      assert.equal(ast.punkte.length, ast.radien.length);
      assert.ok(ast.wind.every((w) => w >= 0 && w <= 1));
      assert.ok(ast.radien.every((r) => r > 0));
    }
    // Wind: Stammfuß starr
    assert.equal(sk.aeste[0].wind[0], 0);
    if (a.form === 'kegel') assert.ok(sk.etagen.length >= 3, t);
    if (a.form === 'laub') assert.ok(sk.laub.length >= 2, `${t} Laub`);
    if (a.form === 'kahl') assert.equal(sk.laub.length, 0);
    if (a.form === 'palme') assert.equal(sk.laub.length, 1);
    assert.ok(sk.laub.every((l) => l.groesse > 0 && l.wind > 0));
  }
});

test('baum-skelett: Weide hängt, Kiefer kahler Stamm unten', () => {
  const w = baueSkelett(art('weide'), 2, { detail: 2 });
  const haengend = w.aeste.filter((a) => a.ordnung === 2 && a.punkte.at(-1)[1] < a.punkte[0][1]);
  assert.ok(haengend.length > 0);
  const k = baueSkelett(art('kiefer'), 2, { detail: 1 });
  const ersterAst = Math.min(...k.aeste.filter((a) => a.ordnung === 1).map((a) => a.punkte[0][1]));
  assert.ok(ersterAst > k.spitze[1] * 0.55);
});
