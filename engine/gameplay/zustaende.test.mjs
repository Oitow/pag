import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createZustaende } from './zustaende.js';

test('gib: unbekannt → null, Stapel bis maxStapel, Dauer auffrischen', () => {
  const z = createZustaende();
  assert.equal(z.gib('gibtsnicht'), null);
  z.gib('gift', { quelle: 'a' }); z.update(3);
  z.gib('gift', { quelle: 'a' });
  assert.equal(z.stapel('gift'), 2);
  assert.equal(z.liste()[0].rest, 8);
  for (let i = 0; i < 10; i++) z.gib('gift');
  assert.equal(z.stapel('gift'), 5);
  z.gib('brennen'); z.gib('brennen'); assert.equal(z.stapel('brennen'), 1);
});

test('DoT-Takt: Menge = menge × stärke × stapel, Ende nach Dauer', () => {
  const z = createZustaende();
  z.gib('gift', { quelle: 'spinne', staerke: 2 }); z.gib('gift');
  const ev = z.update(1);
  assert.equal(ev.length, 1);
  assert.deepEqual(ev[0], { typ: 'takt', name: 'gift', art: 'natur', menge: 8, quelle: 'spinne', heilt: false });
  const viele = z.update(3).filter((e) => e.typ === 'takt');
  assert.equal(viele.length, 3);
  const rest = z.update(4);
  assert.equal(rest.filter((e) => e.typ === 'takt').length, 4);
  assert.deepEqual(rest.at(-1), { typ: 'ende', name: 'gift' });
  assert.equal(z.hat('gift'), false);
});

test('Takt zählt nicht über die Dauer hinaus', () => {
  const z = createZustaende();
  z.gib('brennen', { dauer: 2 });
  const ev = z.update(10);
  assert.equal(ev.filter((e) => e.typ === 'takt').length, 2);
  assert.equal(ev.at(-1).typ, 'ende');
});

test('HoT meldet heilt', () => {
  const z = createZustaende(); z.gib('regeneration');
  assert.equal(z.update(1)[0].heilt, true);
});

test('Faktoren: Tempo/Schaden/Rüstung multiplizieren bzw. addieren', () => {
  const z = createZustaende();
  assert.deepEqual(z.faktoren(), { tempo: 1, schadenFaktor: 1, ruestung: 0, kannHandeln: true, kannLaufen: true, kannZaubern: true, unverwundbar: false });
  z.gib('verlangsamt'); z.gib('eile'); z.gib('wut'); z.gib('schutz');
  const f = z.faktoren();
  assert.ok(Math.abs(f.tempo - 0.78) < 1e-9); assert.equal(f.schadenFaktor, 1.25); assert.equal(f.ruestung, 50);
});

test('Sperren: betäubt, schweigen, eingefroren, unverwundbar', () => {
  const z = createZustaende();
  z.gib('schweigen'); assert.equal(z.faktoren().kannZaubern, false); assert.equal(z.faktoren().kannHandeln, true);
  z.gib('betaeubt'); assert.equal(z.faktoren().kannHandeln, false);
  z.nimm('betaeubt'); z.gib('eingefroren');
  assert.equal(z.faktoren().kannLaufen, false);
  z.gib('unverwundbar'); assert.equal(z.faktoren().unverwundbar, true);
});

test('eingefroren bricht bei Schaden, anderes bleibt', () => {
  const z = createZustaende();
  z.gib('eingefroren'); z.gib('wut');
  assert.deepEqual(z.beiSchaden(), [{ typ: 'ende', name: 'eingefroren', grund: 'schaden' }]);
  assert.equal(z.hat('eingefroren'), false); assert.equal(z.hat('wut'), true);
});

test('reinige schädlich / nützlich', () => {
  const z = createZustaende();
  z.gib('gift'); z.gib('wut'); z.gib('schutz');
  assert.deepEqual(z.reinige('schaedlich'), ['gift']);
  assert.equal(z.hat('wut'), true);
  assert.equal(z.reinige('nuetzlich').length, 2);
  assert.deepEqual(z.liste(), []);
});

test('zustand()/laden() Rundreise', () => {
  const z = createZustaende();
  z.gib('blutung', { quelle: 'x' }); z.gib('blutung'); z.update(0.5);
  const s = JSON.parse(JSON.stringify(z.zustand()));
  const y = createZustaende(); y.laden(s);
  assert.equal(y.stapel('blutung'), 2);
  assert.deepEqual(y.update(0.5), z.update(0.5));
  y.dispose(); assert.equal(y.liste().length, 0);
});

test('eigene defs', () => {
  const z = createZustaende({ defs: { x: { name: 'X', symbol: '?', nuetzlich: true, dauer: 1 } } });
  assert.ok(z.gib('x')); assert.equal(z.gib('gift'), null);
});
