import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MODUL_REGISTER, namenFuerStufe, mitAbhaengigkeiten, waehle, pruefeRegister } from './module-register.js';

// braucht-Listen direkt aus den Modul-Dateien lesen (ohne THREE zu laden)
const BRAUCHT = {};
for (const f of fs.readdirSync(new URL('.', import.meta.url)).filter((f) => /^modul-.*\.js$/.test(f))) {
  const src = fs.readFileSync(new URL(f, import.meta.url), 'utf8');
  const m = src.match(/name:\s*'([\w-]+)',\s*braucht:\s*\[([^\]]*)\]/);
  if (m) BRAUCHT[m[1]] = [...m[2].matchAll(/'([\w-]+)'/g)].map((x) => x[1]);
}
const brauchtVon = (n) => BRAUCHT[n];

test('Register passt zu den Modul-Dateien: jedes Modul eingetragen, keins steht über seinen Abhängigkeiten', () => {
  assert.deepEqual(pruefeRegister(brauchtVon), []);
  assert.deepEqual(Object.keys(BRAUCHT).sort(), MODUL_REGISTER.map((e) => e.name).sort(), 'jede modul-*.js ist im Register');
});

test('Stufen: Spiel ⊆ Testfeld ⊆ Labor', () => {
  const s = namenFuerStufe('spiel'), t = namenFuerStufe('testfeld'), l = namenFuerStufe('labor');
  assert.ok(s.every((n) => t.includes(n)) && t.every((n) => l.includes(n)));
  assert.equal(l.length, MODUL_REGISTER.length);
  assert.throws(() => namenFuerStufe('fertig'), /unbekannte Stufe/);
});

test('Einzelnes Modul bringt nur seine Pflicht-Abhängigkeiten mit', () => {
  assert.deepEqual(mitAbhaengigkeiten(['kampf'], brauchtVon).sort(), ['entitaeten', 'kampf', 'spieler', 'welt']);
  assert.deepEqual(waehle({ nur: 'himmel', brauchtVon }), ['himmel']);
  assert.throws(() => mitAbhaengigkeiten(['gibtsnicht'], brauchtVon), /unbekanntes Modul/);
});

test('Prüfung findet Fehler: Modul im Spiel, dessen Abhängigkeit nur im Labor ist', () => {
  const reg = [{ name: 'a', titel: 'A', stufe: 'spiel' }, { name: 'b', titel: 'B', stufe: 'labor' }];
  const f = pruefeRegister((n) => ({ a: ['b'], b: [] })[n], reg);
  assert.equal(f.length, 1);
  assert.match(f[0], /a \(spiel\) braucht „b“/);
});
