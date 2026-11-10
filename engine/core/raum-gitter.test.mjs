import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRaumGitter } from './raum-gitter.js';

test('setzen, finden, verschieben, entfernen', () => {
  const g = createRaumGitter({ zelle: 4 });
  g.setze('a', 1, 1, 0, { art: 'x' });
  g.setze('b', 30, 30);
  assert.equal(g.anzahl, 2);
  assert.deepEqual(g.sammle(0, 0, 3).map(e => e.id), ['a']);
  g.setze('a', 29, 30);                       // verschieben, daten bleiben
  assert.equal(g.hole('a').daten.art, 'x');
  assert.equal(g.sammle(0, 0, 3).length, 0);
  assert.deepEqual(g.sammle(30, 30, 2).map(e => e.id).sort(), ['a', 'b']);
  assert.equal(g.entferne('a'), true);
  assert.equal(g.entferne('a'), false);
  assert.equal(g.hat('a'), false);
  assert.equal(g.anzahl, 1);
});

test('Eintrags-Radius zählt mit, Abstand geht zum Rand', () => {
  const g = createRaumGitter({ zelle: 2 });
  g.setze('gross', 10, 0, 3);
  let abstand = null;
  assert.equal(g.imUmkreis(5, 0, 2.5, (e, d) => { abstand = d; }), 1);   // Mitte 5 m weg, Rand 2 m
  assert.ok(Math.abs(abstand - 2) < 1e-9);
  assert.equal(g.imUmkreis(5, 0, 1.5), 0);
  assert.equal(g.imUmkreis(10.5, 0, 0.1, (e, d) => { abstand = d; }), 1);
  assert.equal(abstand, 0);                    // innen → 0, nie negativ
});

test('naechster mit Filter, negative Koordinaten, Fachgrenzen', () => {
  const g = createRaumGitter({ zelle: 4 });
  g.setze(1, -3.9, -0.1); g.setze(2, -4.1, 0.1); g.setze(3, 8, 8);
  assert.equal(g.naechster(-4.2, 0, 5).id, 2);
  assert.equal(g.naechster(-4.2, 0, 5, (e) => e.id !== 2).id, 1);
  assert.equal(g.naechster(-4.2, 0, 0.05), null);
  assert.equal(g.naechster(100, 100, 5), null);
});

test('Abbruch mit true, alle(), leeren(), kaputte Werte', () => {
  const g = createRaumGitter();
  for (let i = 0; i < 10; i++) g.setze(i, i * 0.1, 0);
  let n = 0;
  g.imUmkreis(0, 0, 5, () => { n++; return n === 3; });
  assert.equal(n, 3);
  let alle = 0; g.alle(() => alle++);
  assert.equal(alle, 10);
  assert.equal(g.setze('nan', NaN, 0), null);
  assert.equal(g.anzahl, 10);
  g.leeren();
  assert.equal(g.anzahl, 0);
  assert.equal(g.imUmkreis(0, 0, 100), 0);
  assert.throws(() => createRaumGitter({ zelle: 0 }));
});

test('viele Einträge: gleiche Treffer wie die rohe Suche', () => {
  const g = createRaumGitter({ zelle: 3 });
  const p = [];
  let s = 7;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 500; i++) { const e = { x: r() * 200 - 100, z: r() * 200 - 100, rad: r() * 2 }; p.push(e); g.setze(i, e.x, e.z, e.rad); }
  for (let k = 0; k < 20; k++) {
    const x = r() * 200 - 100, z = r() * 200 - 100, rad = r() * 15;
    const roh = p.filter(e => Math.hypot(e.x - x, e.z - z) <= rad + e.rad).length;
    assert.equal(g.imUmkreis(x, z, rad), roh);
  }
});
