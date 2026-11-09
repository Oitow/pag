import test from 'node:test';
import assert from 'node:assert/strict';
import { createLook, randomLook, koerperMasse, VORLAGEN, STILE, LOOK_STANDARD, farbeZahl, TEIL_NAMEN, AUSDRUECKE } from './character-look.js';

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
    for (const teil of Object.keys(STILE)) {
      assert.ok(STILE[teil].includes(l[teil].stil), `${n}.${teil}`);
      if (v[teil]?.stil) assert.equal(l[teil].stil, v[teil].stil, `${n}.${teil} (Tippfehler?)`);
    }
    assert.equal(l.ausdruck, v.ausdruck ?? 'neutral', n);
  }
  for (const n of ['ritter', 'magier', 'baeuerin', 'haendler', 'kind', 'alter', 'wache', 'pirat']) assert.ok(VORLAGEN[n], n);
});
test('randomLook ist deterministisch und gültig', () => {
  assert.deepEqual(randomLook(5), randomLook(5));
  assert.notDeepEqual(randomLook(5), randomLook(6));
  for (let s = 0; s < 200; s++) {
    const l = randomLook(s, { kind: s % 5 === 0 });
    assert.deepEqual(createLook(l), l);
    assert.ok(!['krone', 'helm', 'topfhelm', 'reif', 'zauberhut'].includes(l.kopfbedeckung.stil));
    if (s % 5 === 0) assert.ok(l.bart.stil === 'keiner' && l.koerper.groesse < 0.75);
  }
});
test('randomLook nutzt die neuen Optionen', () => {
  const gesehen = {};
  for (let s = 0; s < 600; s++) {
    const l = randomLook(s);
    for (const t of Object.keys(STILE)) (gesehen[t] ||= new Set()).add(l[t].stil);
    (gesehen.muskeln ||= new Set()).add(l.koerper.muskeln > 0);
  }
  for (const t of ['haar', 'bart', 'oberteil', 'hose', 'schuhe', 'umhang', 'brille', 'schal', 'schmuck'])
    assert.equal(gesehen[t].size, STILE[t].length, t + ': ' + [...gesehen[t]]);
  assert.ok(gesehen.kopfbedeckung.has('dreispitz') && gesehen.kopfbedeckung.has('turban'));
  assert.equal(gesehen.muskeln.size, 2);
  const erlaubt = randomLook(3, { stile: { kopfbedeckung: ['zauberhut'] } });
  assert.ok(['zauberhut', 'keine'].includes(erlaubt.kopfbedeckung.stil));
});
test('alte Spielstände (1.0) bleiben gültig; neue Felder haben Standards', () => {
  const alt = { name: 'Alt', koerper: { groesse: 1.1, breite: 1, kopf: 1, beine: 1, arme: 1, bauch: 0.2 }, haut: '#e0ac88', augen: '#2a2a3a',
    haar: { stil: 'zopf', farbe: '#4a3020' }, bart: { stil: 'keiner', farbe: null }, oberteil: { stil: 'kleid', farbe: '#4f7a5a', akzent: '#8a6a3e' },
    hose: { stil: 'rock', farbe: '#5a4a3a' }, schuhe: { stil: 'schuhe', farbe: '#4a3426' }, kopfbedeckung: { stil: 'krone', farbe: '#7a5a3a', akzent: '#3a2a1a' },
    umhang: { stil: 'lang', farbe: '#6a2a24' }, guertel: null, tasche: true, rucksack: false };
  const l = createLook(alt);
  for (const [k, v] of Object.entries(alt)) if (k !== 'koerper') assert.deepEqual(l[k], v, k);
  assert.equal(l.koerper.groesse, 1.1);
  assert.equal(l.koerper.schultern, 1);
  assert.equal(l.koerper.muskeln, 0);
  assert.equal(l.brille.stil, 'keine');
  assert.equal(l.schal.stil, 'kein');
  assert.equal(l.schmuck.stil, 'kein');
  assert.equal(l.ausdruck, 'neutral');
  assert.deepEqual(koerperMasse(alt), koerperMasse(l));
  assert.equal(createLook({ ausdruck: 'froh' }).ausdruck, 'froh');
  assert.equal(createLook({ ausdruck: 'x' }).ausdruck, AUSDRUECKE[0]);
  for (const t of Object.keys(STILE)) assert.ok(TEIL_NAMEN[t], t);
  assert.ok(koerperMasse({ koerper: { schultern: 1.3 } }).schulterX > koerperMasse({}).schulterX);
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
