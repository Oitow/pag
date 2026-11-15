import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../test/fake-dom.mjs';
import { createKampfLeiste } from './kampf-leiste.js';

const PLAETZE = [{ name: 'a', symbol: 'A', taste: '1' }, { name: 'b', symbol: 'B', taste: '2' }];
const neu = (o = {}) => { installFakeDom(); return createKampfLeiste({ plaetze: PLAETZE, ...o }); };
const reihe = (kl) => kl.element.children[2];

test('erzeugt Plätze mit Symbol und Taste, dispose räumt ab', () => {
  const kl = neu();
  assert.equal(kl.element.parentNode, document.body);
  assert.equal(reihe(kl).children.length, 2);
  assert.equal(reihe(kl).children[0].children[0].textContent, 'A');
  kl.setPlaetze([{ name: 'c', symbol: 'C', taste: '3' }]);
  assert.equal(reihe(kl).children.length, 1);
  kl.dispose();
  assert.equal(document.body.children.length, 0);
});

test('Klick ruft onNutze mit dem Namen', () => {
  const genutzt = [];
  const kl = neu({ onNutze: (n) => genutzt.push(n) });
  reihe(kl).children[1].click();
  assert.deepEqual(genutzt, ['b']);
});

test('Abklingzeit-Text, Überzug, Ladungen, GCD', () => {
  const kl = neu();
  const slot = reihe(kl).children[0];
  const [, , gcd, abkling, zeit, ladung] = slot.children;
  kl.update(0.1, { abkling: (n) => (n === 'a' ? 4.5 : 0), ladungen: () => 2, gcdAnteil: 0.5 });
  assert.equal(zeit.textContent, '4.5');
  assert.equal(zeit.style.display, 'flex');
  assert.equal(abkling.style.height, '100%');
  assert.equal(ladung.textContent, '2');
  assert.equal(gcd.style.height, '50%');
  kl.update(0.1, { abkling: () => 0 });
  assert.equal(zeit.style.display, 'none');
});

test('ausgegraut nach Grund, Wirkbalken und Ressourcen', () => {
  const kl = neu();
  const slot = reihe(kl).children[0];
  const leiste = {
    kann: () => ({ ok: false, grund: 'ressource' }),
    wirkt: { name: 'Feuerball', anteil: 0.25 },
    ressource: (n) => (n === 'mana' ? { wert: 50, max: 100 } : null),
  };
  kl.update(0.1, leiste);
  assert.match(slot.children[1].style.background, /40,90,200/);
  const wirk = kl.element.children[0];
  assert.equal(wirk.style.display, 'block');
  assert.equal(wirk.children[1].textContent, 'Feuerball');
  assert.equal(wirk.children[0].style.width, '25%');
  assert.equal(kl.element.children[1].children.length, 1);
  leiste.kann = () => ({ ok: false, grund: 'reichweite' });
  leiste.wirkt = { name: 'Kanal', anteil: 0.25, kanal: true };
  kl.update(0.1, leiste);
  assert.match(slot.children[1].style.background, /200,40,40/);
  assert.equal(wirk.children[0].style.width, '75%');
  kl.update(0.1, {});
  assert.equal(wirk.style.display, 'none');
});

test('blitz leuchtet auf und klingt ab; update ohne Leiste ist ok', () => {
  const kl = neu();
  const blitz = reihe(kl).children[0].children[7];
  kl.blitz('a');
  kl.update(0.05, null);
  assert.ok(Number(blitz.style.opacity) > 0);
  kl.update(1, null);
  assert.equal(Number(blitz.style.opacity), 0);
});
