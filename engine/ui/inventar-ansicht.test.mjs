import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from '../test/fake-dom.mjs';
import { createInventar } from '../gameplay/inventar.js';
import { createRegister } from '../core/register.js';
import { createInventarAnsicht } from './inventar-ansicht.js';

function aufbau(opts = {}, plaetze = 10) {
  installFakeDom();
  const register = createRegister({ art: 'gegenstand' });
  register.definiereAlle({
    holz: { name: 'Holz', zeichen: '🪵' },
    axt: { name: 'Axt', zeichen: '🪓', haltbarkeit: 100 },
    stein: { name: 'Stein' },
  });
  const inventar = createInventar({ plaetze, register, stapel: 99 });
  if (opts.eltern) opts = { ...opts, eltern: document.body };
  const ansicht = createInventarAnsicht({ inventar, register, ...opts });
  return { inventar, register, ansicht };
}
const texte = (el) => el.children.map((k) => k.textContent);
const striche = (feld) => feld.children.filter((k) => /background/.test(k.style.cssText) && k.style.cssText.includes('height:3px'));

test('Anzahl Felder = bis − von, Titel und Eltern', () => {
  const { ansicht } = aufbau({ von: 2, bis: 7, titel: 'Truhe', eltern: true });
  assert.equal(ansicht.felder.length, 5);
  assert.ok(texte(ansicht.element).includes('Truhe'));
  assert.equal(ansicht.element.parentNode, document.body);
  assert.match(ansicht.element.style.cssText, /repeat\(5,var\(--b\)\)/);
});

test('Zeichen, Anzahl, Standardzeichen und Aktualisierung', () => {
  const { ansicht, inventar } = aufbau({});
  assert.deepEqual(texte(ansicht.felder[0]), []);
  inventar.gib('holz', 5);
  assert.deepEqual(texte(ansicht.felder[0]), ['🪵', '5']);
  assert.equal(ansicht.felder[0].title, 'Holz');
  inventar.gib('stein', 1);
  assert.deepEqual(texte(ansicht.felder[1]), ['St']);
  inventar.nimm('holz', 5);
  assert.deepEqual(texte(ansicht.felder[0]), []);
});

test('Haltbarkeits-Strich nur bei Gegenständen mit haltbarkeit', () => {
  const { ansicht, inventar } = aufbau({});
  inventar.gib('holz', 1);
  inventar.gib('axt', 1, { haltbarkeit: 50 });
  inventar.gib('axt', 1, { haltbarkeit: 20 });
  assert.equal(striche(ansicht.felder[0]).length, 0);
  const gut = striche(ansicht.felder[1])[0];
  assert.match(gut.style.cssText, /width:40%/);
  assert.match(gut.style.cssText, /#7bd66a/);
  const schlecht = striche(ansicht.felder[2])[0];
  assert.match(schlecht.style.cssText, /width:16%/);
  assert.match(schlecht.style.cssText, /#e0683c/);
});

test('gewählter Platz: Akzent-Rand, Wechsel nach zeichne()', () => {
  let g = 1;
  const { ansicht } = aufbau({ gewaehlt: () => g });
  assert.equal(ansicht.felder[1].style.borderColor, '#ffd45a');
  assert.notEqual(ansicht.felder[0].style.borderColor, '#ffd45a');
  g = 0;
  ansicht.zeichne();
  assert.equal(ansicht.felder[0].style.borderColor, '#ffd45a');
  assert.notEqual(ansicht.felder[1].style.borderColor, '#ffd45a');
});

test('onTipp: richtiger Platz-Index (von > 0), stopPropagation/preventDefault', () => {
  const rufe = [];
  const { ansicht, inventar } = aufbau({ von: 3, bis: 6, onTipp: (p, inh) => rufe.push([p, inh?.id]) });
  inventar.gib('holz', 1); // Platz 0, außerhalb
  inventar.gib('stein', 1);
  let stop = 0, prev = 0;
  ansicht.felder[1].dispatch('pointerdown', { stopPropagation: () => stop++, preventDefault: () => prev++ });
  assert.deepEqual(rufe, [[4, undefined]]);
  assert.equal(stop, 1);
  assert.equal(prev, 1);
});

test('onLang über update(dt) vs. kurzer Tipp', () => {
  const tipp = [], lang = [];
  const { ansicht, inventar } = aufbau({ onTipp: (p) => tipp.push(p), onLang: (p, i) => lang.push([p, i?.id]), langMs: 450 });
  inventar.gib('holz', 1);
  ansicht.felder[0].dispatch('pointerdown');
  assert.deepEqual(tipp, []);
  ansicht.update(0.2);
  ansicht.felder[0].dispatch('pointerup');
  assert.deepEqual(tipp, [0]);
  assert.deepEqual(lang, []);
  ansicht.felder[0].dispatch('pointerdown');
  ansicht.update(0.3); ansicht.update(0.3); ansicht.update(0.3);
  assert.deepEqual(lang, [[0, 'holz']]);
  ansicht.felder[0].dispatch('pointerup');
  assert.deepEqual(tipp, [0]); // kein zusätzlicher Tipp nach langem Druck
});

test('unveränderte Plätze werden nicht neu gebaut', () => {
  const { ansicht, inventar } = aufbau({});
  inventar.gib('holz', 1);
  inventar.gib('stein', 1);
  const k0 = ansicht.felder[0].children[0];
  const k1 = ansicht.felder[1].children[0];
  inventar.gib('stein', 1);
  assert.equal(ansicht.felder[0].children[0], k0);
  assert.notEqual(ansicht.felder[1].children[0], k1);
});

test('dispose meldet ab und entfernt das Element', () => {
  const { ansicht, inventar } = aufbau({ eltern: true });
  ansicht.dispose();
  assert.equal(ansicht.element.parentNode, null);
  assert.doesNotThrow(() => inventar.gib('holz', 3));
  assert.deepEqual(texte(ansicht.felder[0]), []);
});
