import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../test/fake-dom.mjs';
import { createHud } from './hud.js';

const neuesHud = (o) => { installFakeDom(); return createHud(o); };

test('Wurzel hängt am eltern und verschwindet bei dispose', () => {
  const hud = neuesHud();
  assert.equal(hud.element.parentNode, document.body);
  assert.equal(hud.element.style.pointerEvents, undefined); // Stile stehen in cssText
  assert.match(hud.element.style.cssText, /pointer-events:none/);
  hud.melde('x');
  hud.dispose();
  assert.equal(hud.element.parentNode, null);
  assert.equal(document.body.children.length, 0);
});

test('hinweis: Text, Sichtbarkeit, Fortschritt', () => {
  const hud = neuesHud();
  const spalte = hud.element.children[0];
  const box = spalte.children[1];
  assert.match(box.style.cssText, /visibility:hidden/);
  hud.hinweis('E – Aufheben');
  assert.equal(box.style.visibility, 'visible');
  assert.equal(box.children[0].textContent, 'E – Aufheben');
  assert.match(box.children[1].style.cssText, /display:none/);
  hud.hinweis('E – Aufheben', 0.5);
  assert.equal(box.children[1].style.display, 'block');
  assert.equal(box.children[1].children[0].style.width, '50%');
  hud.hinweis('');
  assert.equal(box.style.visibility, 'hidden');
  hud.hinweis(null);
  assert.equal(box.style.visibility, 'hidden');
});

test('hinweis fasst das DOM bei gleichem Aufruf nicht an', () => {
  const hud = neuesHud();
  const box = hud.element.children[0].children[1];
  const textEl = box.children[0];
  let schreibt = 0;
  let wert = textEl.textContent;
  Object.defineProperty(textEl, 'textContent', { get: () => wert, set: (v) => { schreibt++; wert = v; } });
  hud.hinweis('Hallo', 0.301);
  hud.hinweis('Hallo', 0.304);
  hud.hinweis('Hallo', 0.3);
  assert.equal(schreibt, 1);
  const fuell = box.children[1].children[0];
  assert.equal(fuell.style.width, '30%');
  fuell.style.width = 'GEMERKT';
  hud.hinweis('Hallo', 0.3);
  assert.equal(fuell.style.width, 'GEMERKT');
});

test('melde + update: läuft ab und blendet aus', () => {
  const hud = neuesHud();
  const m = hud.melde('Hallo', { dauer: 1, art: 'gut' });
  assert.equal(hud.meldungen, 1);
  assert.equal(m.text, 'Hallo');
  assert.equal(m.element.parentNode, hud.element.children[0].children[0]);
  hud.update(0.5);
  assert.equal(hud.meldungen, 1);
  assert.ok(Math.abs(m.rest - 0.5) < 1e-9);
  hud.update(0.3); // rest 0.2 -> Ausblenden
  assert.ok(Number(m.element.style.opacity) < 1);
  hud.update(0.3);
  assert.equal(hud.meldungen, 0);
  assert.equal(m.element.parentNode, null);
});

test('maxMeldungen: älteste verschwindet sofort', () => {
  const hud = neuesHud({ maxMeldungen: 2 });
  const a = hud.melde('a'); hud.melde('b'); hud.melde('c');
  assert.equal(hud.meldungen, 2);
  assert.equal(a.element.parentNode, null);
});

test('schluessel zählt zusammen und setzt die Zeit zurück', () => {
  const hud = neuesHud();
  const a = hud.melde('+{n} Holz', { schluessel: 'holz', anzahl: 3, dauer: 2 });
  assert.equal(a.text, '+3 Holz');
  hud.update(1.5);
  const b = hud.melde('+{n} Holz', { schluessel: 'holz', anzahl: 2, dauer: 2 });
  assert.equal(hud.meldungen, 1);
  assert.equal(b, a);
  assert.equal(b.anzahl, 5);
  assert.equal(b.text, '+5 Holz');
  assert.equal(b.element.textContent, '+5 Holz');
  assert.equal(b.rest, 2);
  hud.melde('+{n} Stein', { schluessel: 'stein', anzahl: 1 });
  assert.equal(hud.meldungen, 2);
});

test('balken anlegen, ändern, entfernen', () => {
  const hud = neuesHud();
  hud.balken('leben', { wert: 0.8, zeichen: '❤', text: '80', farbe: '#e0683c' });
  const links = hud.bereich('obenLinks');
  assert.equal(links.children.length, 1);
  const [zeile] = links.children;
  const [zeichen, bahn, txt] = zeile.children;
  assert.equal(zeichen.textContent, '❤');
  assert.equal(bahn.children[0].style.width, '80%');
  assert.equal(bahn.children[0].style.background, '#e0683c');
  assert.equal(txt.textContent, '80');
  hud.balken('leben', { wert: 0.25 });
  assert.equal(links.children.length, 1);
  assert.equal(bahn.children[0].style.width, '25%');
  hud.balken('ausdauer', { wert: 1 });
  assert.equal(links.children.length, 2);
  hud.balken('leben', null);
  assert.equal(links.children.length, 1);
  assert.equal(zeile.parentNode, null);
});

test('bereich liefert dasselbe Element', () => {
  const hud = neuesHud();
  for (const n of ['leiste', 'ueberLeiste', 'obenLinks', 'obenRechts', 'mitte']) {
    assert.equal(hud.bereich(n), hud.bereich(n));
  }
  const spalte = hud.element.children[0];
  assert.equal(spalte.children[2], hud.bereich('ueberLeiste'));
  assert.equal(spalte.children[3], hud.bereich('leiste'));
  assert.equal(hud.bereich('obenRechts').parentNode, hud.element);
});

test('zeige(false) blendet das ganze HUD aus', () => {
  const hud = neuesHud();
  assert.equal(hud.sichtbar, true);
  hud.zeige(false);
  assert.equal(hud.sichtbar, false);
  assert.equal(hud.element.style.display, 'none');
  hud.zeige();
  assert.equal(hud.sichtbar, true);
  assert.equal(hud.element.style.display, '');
});
