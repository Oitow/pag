import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installFakeDom } from '../test/fake-dom.mjs';
import { createTrefferZahlen } from './treffer-zahlen.js';

function aufbau(opts) {
  installFakeDom({ breite: 400, hoehe: 800 });
  const kamera = new THREE.PerspectiveCamera(60, 0.5, 0.1, 500);
  kamera.position.set(0, 2, 6); kamera.lookAt(0, 1.5, 0);
  return { kamera, zahlen: createTrefferZahlen(opts), body: document.body };
}

test('zeige erhöht anzahl, nach dauer weg und unsichtbar', () => {
  const { kamera, zahlen, body } = aufbau({ max: 4 });
  zahlen.zeige({ x: 0, y: 1.5, z: 0 }, '−30', { dauer: 0.5 });
  assert.equal(zahlen.anzahl, 1);
  zahlen.update(kamera, 0.1);
  const el = body.children.find(e => e.textContent === '−30');
  assert.equal(el.style.display, '');
  assert.match(el.style.transform, /translate3d/);
  zahlen.update(kamera, 0.5);
  assert.equal(zahlen.anzahl, 0);
  assert.equal(el.style.display, 'none');
  zahlen.dispose();
});

test('Pool voll: Elementzahl bleibt max, älteste wird ersetzt', () => {
  const { kamera, zahlen, body } = aufbau({ max: 3 });
  for (let i = 0; i < 5; i++) zahlen.zeige({ x: 0, y: 1.5, z: 0 }, 'Z' + i);
  assert.equal(body.children.length, 3);
  assert.equal(zahlen.anzahl, 3);
  const texte = body.children.map(e => e.textContent).sort();
  assert.deepEqual(texte, ['Z2', 'Z3', 'Z4']);
  zahlen.update(kamera, 0.1);
  zahlen.dispose();
});

test('hinter der Kamera unsichtbar', () => {
  const { kamera, zahlen, body } = aufbau({ max: 2 });
  zahlen.zeige({ x: 0, y: 1.5, z: 20 }, 'X', { streuung: 0 });
  zahlen.update(kamera, 0.1);
  assert.equal(body.children[0].style.display, 'none');
  assert.equal(zahlen.anzahl, 1);
  zahlen.dispose();
});

test('dispose entfernt die Elemente', () => {
  const { zahlen, body } = aufbau({ max: 5 });
  assert.equal(body.children.length, 5);
  zahlen.dispose();
  assert.equal(body.children.length, 0);
});
