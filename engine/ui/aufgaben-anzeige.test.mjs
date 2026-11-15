import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installFakeDom } from '../test/fake-dom.mjs';
import { createAufgabenAnzeige, randLage } from './aufgaben-anzeige.js';

const INFO = { aufgabe: { id: 'a', name: 'Erste Schritte' }, text: 'Sammle Kräuter', hinweis: 'Tippe E', wert: 3, ziel: 6, anteil: 0.5 };
const kamera = () => { const k = new THREE.PerspectiveCamera(60, 400 / 800, 0.1, 400); k.position.set(0, 0, 0); k.lookAt(0, 0, 1); k.updateMatrixWorld(true); return k; };

test('randLage: im Bild, rechts außen, hinter der Kamera', () => {
  const im = randLage({ x: 0.2, y: 0, z: 0.5 }, 400, 800, 28);
  assert.equal(im.imBild, true); assert.ok(Math.abs(im.x - 240) < 1e-9);
  const rechts = randLage({ x: 3, y: 0, z: 0.5 }, 400, 800, 28);
  assert.equal(rechts.imBild, false); assert.equal(rechts.x, 400 - 28); assert.ok(Math.abs(rechts.winkel) < 1e-9);
  const hinten = randLage({ x: 0.5, y: 0, z: 1.2 }, 400, 800, 28);   // gespiegelt: links
  assert.equal(hinten.imBild, false); assert.equal(hinten.x, 28); assert.ok(Math.abs(Math.abs(hinten.winkel) - Math.PI) < 1e-9);
  const genau = randLage({ x: 0, y: 0, z: 1.5 }, 400, 800, 28);      // genau hinten: unten
  assert.equal(genau.y, 800 - 28);
});

test('setze zeigt Titel/Text/Fortschritt, setze(null) blendet aus', () => {
  installFakeDom();
  const a = createAufgabenAnzeige();
  const karteEl = a.element.children[0];
  assert.match(karteEl.style.cssText, /display:none/);
  a.setze(INFO);
  assert.equal(karteEl.style.display, 'block');
  assert.equal(karteEl.children[0].textContent, 'Erste Schritte');
  assert.equal(karteEl.children[1].textContent, 'Sammle Kräuter');
  assert.equal(karteEl.children[3].children[0].textContent, '3 / 6');
  assert.equal(karteEl.children[3].children[1].children[0].style.width, '50%');
  a.setze(null);
  assert.equal(karteEl.style.display, 'none');
  a.dispose();
});

test('ziel: Marker mit Meterangabe im Bild, Pfeil außerhalb', () => {
  installFakeDom();
  const a = createAufgabenAnzeige();
  const [, marker, pfeil] = a.element.children;
  a.ziel({ x: 0, y: 0, z: 10 });
  a.update(kamera(), 0.016, { x: 0, z: 0 });
  assert.equal(marker.style.display, 'block'); assert.equal(marker.children[1].textContent, '10 m'); assert.equal(pfeil.style.display, 'none');
  a.ziel({ x: 50, y: 0, z: 5 });                                      // weit seitlich
  a.update(kamera(), 0.016, { x: 0, z: 0 });
  assert.equal(marker.style.display, 'none'); assert.equal(pfeil.style.display, 'block');
  a.ziel({ x: 0, y: 0, z: -10 });                                     // hinter der Kamera
  a.update(kamera(), 0.016, { x: 0, z: 0 });
  assert.equal(pfeil.style.display, 'block');
  a.ziel(null); a.update(kamera(), 0.016);
  assert.equal(pfeil.style.display, 'none'); assert.equal(marker.style.display, 'none');
});

test('blitz erscheint, verschwindet nach Dauer; groß = größere Schrift', () => {
  installFakeDom();
  const a = createAufgabenAnzeige();
  const banner = a.element.children[4];
  a.blitz('Geschafft!', { dauer: 1 });
  assert.equal(banner.textContent, 'Geschafft!'); assert.equal(banner.style.visibility, 'visible');
  const klein = banner.style.fontSize;
  a.update(null, 0.5); assert.equal(banner.style.visibility, 'visible');
  a.update(null, 0.6); assert.equal(banner.style.visibility, 'hidden');
  a.blitz('Willkommen in der Enklave', { gross: true, dauer: 5 });
  assert.notEqual(banner.style.fontSize, klein);
  a.zeige(false); assert.equal(a.sichtbar, false); assert.equal(a.element.style.display, 'none');
  a.zeige(true); assert.equal(a.sichtbar, true);
});

test('dispose entfernt das DOM', () => {
  installFakeDom();
  const a = createAufgabenAnzeige();
  assert.equal(a.element.parentNode, document.body);
  a.dispose();
  assert.equal(document.body.children.length, 0);
});
