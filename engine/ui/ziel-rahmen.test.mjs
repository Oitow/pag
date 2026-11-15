import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../test/fake-dom.mjs';
import { createZielRahmen } from './ziel-rahmen.js';

const neu = (o) => { installFakeDom(); return createZielRahmen(o); };
const D = { name: 'Wolf', stufe: 3, leben: 40, lebenMax: 60, feindlich: true };

test('zeigt und versteckt, dispose entfernt', () => {
  const z = neu({ ecke: 'oben-mitte', breite: 200 });
  assert.equal(z.element.parentNode, document.body);
  assert.equal(z.element.style.display, 'none');
  z.zeige(D);
  assert.equal(z.element.style.display, 'flex');
  assert.equal(z.element.children[0].children[0].textContent, 'Wolf (3)');
  assert.equal(z.element.children[0].children[0].style.color, '#ff6b5e');
  z.zeige(null);
  assert.equal(z.element.style.display, 'none');
  z.dispose();
  assert.equal(document.body.children.length, 0);
});

test('Lebenszahl, Schild und Schaden-Rest rutscht nach', () => {
  const z = neu();
  z.zeige({ ...D, leben: 60, schild: 6 });
  const [rest, leben, schild, zahl] = z.element.children[1].children;
  assert.equal(zahl.textContent, '60 / 60 (+6)');
  z.zeige({ ...D, leben: 30 });
  assert.equal(leben.style.width, '50.0%');
  assert.equal(rest.style.width, '100.0%');
  z.update(0.5);
  assert.equal(rest.style.width, '75.0%');
  z.update(5);
  assert.equal(rest.style.width, '50.0%');
  z.zeige({ ...D, leben: 30, schild: 6 });
  assert.equal(schild.style.width, '10.0%');
});

test('Haltung, Kampfmarke und Taumeln', () => {
  const z = neu();
  z.zeige({ ...D, haltung: 5, haltungMax: 10, imKampf: true, taumelt: true });
  const haltungBahn = z.element.children[2];
  assert.equal(haltungBahn.style.display, 'block');
  assert.equal(haltungBahn.children[0].style.width, '50.0%');
  assert.equal(z.element.children[0].children[1].textContent, '⚔');
  z.update(0.01);
  assert.equal(haltungBahn.children[0].style.opacity, '0.3');
  z.update(0.2);
  assert.equal(haltungBahn.children[0].style.opacity, '1');
});

test('Zustände werden gerendert (Rand, Restzeit, Stapel)', () => {
  const z = neu();
  z.zeige({ ...D, zustaende: [
    { name: 'Gift', symbol: '☠', rest: 3.2, dauer: 6, stapel: 2, nuetzlich: false },
    { name: 'Segen', symbol: '✨', rest: 10, dauer: 10, stapel: 1, nuetzlich: true },
  ] });
  const box = z.element.children[4];
  assert.equal(box.children.length, 2);
  assert.match(box.children[0].style.cssText, /#d8453a/);
  assert.match(box.children[1].style.cssText, /#5fc24f/);
  assert.equal(box.children[0].children[0].textContent, '4');
  assert.equal(box.children[0].children[1].textContent, '2');
  z.zeige({ ...D, zustaende: [] });
  assert.equal(box.children.length, 0);
});
