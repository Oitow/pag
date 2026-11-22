import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChatLogik } from './chat.js';

test('Ring-Puffer behält nur die letzten max Zeilen', () => {
  const c = createChatLogik({ max: 5 });
  for (let i = 0; i < 12; i++) c.zeile('system', 'z' + i);
  assert.equal(c.anzahl, 5);
  assert.deepEqual(c.zeilen('alle').map((z) => z.text), ['z7', 'z8', 'z9', 'z10', 'z11']);
});

test('Filter und unbekannter Kanal', () => {
  const c = createChatLogik();
  c.zeile('kampf', 'a'); c.zeile('beute', 'b'); c.zeile('kampf', 'c'); c.zeile('quatsch', 'd');
  assert.equal(c.zeilen('kampf').length, 2);
  assert.equal(c.zeilen('system')[0].text, 'd');
  c.setzeFilter('beute'); assert.deepEqual(c.zeilen().map((z) => z.text), ['b']);
  c.setzeFilter('nix'); assert.equal(c.filter, 'alle');
  assert.deepEqual(c.zeilen('alle', 2).map((z) => z.text), ['c', 'd']);
});

test('Befehle: Argumente, Rückgabetext, unbekannt, Fehler', () => {
  const c = createChatLogik();
  let got = null;
  c.befehl('ort', (a) => { got = a; return 'Ort ' + a[0]; });
  c.befehl('kaputt', () => { throw new Error('boom'); });
  assert.equal(c.eingabe('/ORT  tor  x'), true);
  assert.deepEqual(got, ['tor', 'x']);
  assert.equal(c.zeilen('system').at(-1).text, 'Ort tor');
  assert.equal(c.eingabe('/gibtsnicht'), false);
  c.eingabe('/kaputt'); assert.match(c.zeilen('system').at(-1).text, /boom/);
});

test('Normaler Text geht in „sagen“, /hilfe listet Befehle', () => {
  const c = createChatLogik({ name: 'Goi' });
  c.befehl('tanz', () => '');
  assert.equal(c.eingabe('  '), false);
  c.eingabe('Hallo'); const z = c.zeilen('sagen')[0];
  assert.equal(z.von, 'Goi'); assert.equal(z.text, 'Hallo');
  c.eingabe('/hilfe'); assert.match(c.zeilen('system').at(-1).text, /\/hilfe.*\/tanz/);
});

test('onAenderung meldet jede Zeile und lässt sich abmelden', () => {
  const c = createChatLogik(); let n = 0;
  const ab = c.onAenderung(() => n++);
  c.zeile('welt', 'x'); c.setzeFilter('welt'); ab(); c.zeile('welt', 'y');
  assert.equal(n, 2);
});
