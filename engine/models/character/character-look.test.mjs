import test from 'node:test';
import assert from 'node:assert/strict';
import { createLook, randomLook, koerperMasse, VORLAGEN, STILE, LOOK_STANDARD, farbeZahl } from './character-look.js';

test('createLook ergänzt Fehlendes und verwirft Ungültiges', () => {
  const l = createLook({ haar: { stil: 'quatsch', farbe: 'rot' }, koerper: { groesse: 99 }, oberteil: { farbe: 0xff0000 } });
  assert.equal(l.haar.stil, STILE.haar[0]);
  assert.equal(l.haar.farbe, LOOK_STANDARD.haar.farbe);
  assert.equal(l.koerper.groesse, 1.4);
  assert.equal(l.oberteil.farbe, '#ff0000');
  assert.equal(l.bart.farbe, null);
  assert.deepEqual(createLook(JSON.parse(JSON.stringify(l))), l, 'JSON-Rundreise');
  assert.deepEqual(createLook(null), createLook({}));
});
test('alle Vorlagen sind gültig', () => {
  for (const [n, v] of Object.entries(VORLAGEN)) {
    const l = createLook(v);
    for (const teil of Object.keys(STILE)) assert.ok(STILE[teil].includes(l[teil].stil), `${n}.${teil}`);
  }
});
test('randomLook ist deterministisch und gültig', () => {
  assert.deepEqual(randomLook(5), randomLook(5));
  assert.notDeepEqual(randomLook(5), randomLook(6));
  for (let s = 0; s < 200; s++) {
    const l = randomLook(s, { kind: s % 5 === 0 });
    assert.deepEqual(createLook(l), l);
    assert.ok(!['krone', 'helm'].includes(l.kopfbedeckung.stil));
  }
});
test('koerperMasse: Standard ≈ 1,75 m, skaliert mit Größe', () => {
  const m = koerperMasse(LOOK_STANDARD);
  assert.ok(Math.abs(m.hoehe - 1.75) < 0.02, String(m.hoehe));
  assert.ok(m.hueftHoehe > 0.8 && m.hueftHoehe < 1);
  const k = koerperMasse(VORLAGEN.kind);
  assert.ok(k.hoehe < 1.3 && k.kopfRadius / k.hoehe > m.kopfRadius / m.hoehe);
  assert.equal(farbeZahl('#ff8000'), 0xff8000);
  assert.equal(farbeZahl('x'), null);
});
