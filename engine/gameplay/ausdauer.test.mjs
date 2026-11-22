import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAusdauer } from './ausdauer.js';

test('ausdauer: Sprint leert, Erschöpft sperrt bis 30 %, Erholung erst nach Verzögerung', () => {
  const a = createAusdauer({ max: 100, erholung: 20, verzoegerung: 1, erschoepftBis: 0.3 });
  for (let i = 0; i < 200 && a.verbrauche('sprint', 0.1); i++);
  assert.equal(a.wert, 0);
  assert.ok(a.erschoepft && !a.kann('sprint') && a.kann('springen'));
  a.update(0.5); assert.equal(a.wert, 0);              // Verzögerung läuft noch
  a.update(1.0); assert.ok(a.wert > 0 && a.erschoepft); // 0,5 s Erholung
  a.update(1.5); assert.ok(!a.erschoepft && a.kann('sprint'));
  assert.ok(a.zahle('rollen') && a.wert < 31);
});
