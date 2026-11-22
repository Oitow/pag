import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createModulKern } from './modul-kern.js';

test('modul-kern: Reihenfolge nach Abhängigkeit, Optionen, Takt, Zustand, Aufräumen rückwärts', async () => {
  const log = [];
  const kern = createModulKern({ optionen: { gegner: { anzahl: 3 } } });
  kern.registriere({ name: 'gegner', braucht: ['welt'], optional: ['zauber'], standard: { anzahl: 1, art: 'ratte' },
    start: (ctx) => { log.push('start gegner ' + ctx.braucht('welt').h + ' ' + ctx.optionen.anzahl + ctx.optionen.art); return { n: ctx.optionen.anzahl }; },
    update: (dt) => log.push('u gegner'), zustand: () => ({ n: 3 }), dispose: () => log.push('weg gegner') });
  kern.registriere({ name: 'welt', start: () => { log.push('start welt'); return { h: 7 }; }, fest: () => log.push('f welt'), dispose: () => log.push('weg welt') });
  await kern.starte();
  assert.deepEqual(kern.reihenfolge, ['welt', 'gegner']);
  kern.update(0.016); kern.fest(0.016);
  assert.deepEqual(kern.zustand(), { gegner: { n: 3 } });
  assert.equal(kern.api('gegner').n, 3);
  kern.dispose();
  assert.deepEqual(log, ['start welt', 'start gegner 7 3ratte', 'u gegner', 'f welt', 'weg gegner', 'weg welt']);
});

test('modul-kern: abgeschaltete oder fehlende Abhängigkeit überspringt Nutzer, Startfehler bricht nicht alles', async () => {
  const fehler = [];
  const kern = createModulKern({ aus: ['zauber'], fehler: (e, wo) => fehler.push(wo) });
  kern.registriere({ name: 'zauber', start: () => ({}) });
  kern.registriere({ name: 'leiste', braucht: ['zauber'], start: () => ({}) });
  kern.registriere({ name: 'kaputt', start: () => { throw new Error('x'); } });
  kern.registriere({ name: 'himmel', start: () => ({}) });
  await kern.starte();
  assert.deepEqual(kern.aktiv, ['himmel']);
  assert.equal(kern.uebersprungen.leiste, 'braucht „zauber“');
  assert.deepEqual(fehler, ['kaputt']);
  await assert.rejects(async () => { const k = createModulKern(); k.registriere({ name: 'a', braucht: ['b'] }); k.registriere({ name: 'b', braucht: ['a'] }); await k.starte(); }, /Kreis/);
});
