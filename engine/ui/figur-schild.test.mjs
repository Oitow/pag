import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installFakeDom } from '../test/fake-dom.mjs';
import { createFigurSchilder } from './figur-schild.js';

function aufbau() {
  installFakeDom({ breite: 400, hoehe: 800 });
  const kamera = new THREE.PerspectiveCamera(60, 0.5, 0.1, 500);
  kamera.position.set(0, 2, 6); kamera.lookAt(0, 1.5, 0);
  const schilder = createFigurSchilder();
  return { kamera, schilder };
}
const translate = s => s._dom.dom.style.transform.match(/translate\(([-\d.]+)px,([-\d.]+)px\)/).slice(1).map(Number);

test('Schild folgt dem Ziel (Object3D, Objekt, Funktion), mittig auf dem Bildschirm', () => {
  const { kamera, schilder } = aufbau();
  const kopf = new THREE.Object3D(); kopf.position.set(0, 1.8, 0);
  const s = schilder.neu(kopf, { name: 'Jupp' });
  schilder.update(kamera, 1 / 60);
  assert.equal(s.sichtbar, true);
  const [x, y] = translate(s);
  assert.ok(Math.abs(x - 200) < 1 && y > 100 && y < 400, `${x},${y}`);
  kopf.position.x = -1; schilder.update(kamera, 1 / 60);
  assert.ok(translate(s)[0] < 200, 'Ziel links (−X von hier aus gesehen? Kamera blickt −Z → links)');
  const s2 = schilder.neu({ x: 1, y: 1, z: 0 }, { name: 'B' });
  const s3 = schilder.neu(() => ({ x: 0, y: 1, z: -3 }), { name: 'C' });
  schilder.update(kamera, 0);
  assert.ok(s2.sichtbar && s3.sichtbar && translate(s2)[0] > 200);
  assert.equal(schilder.anzahl, 3);
  schilder.dispose();
});

test('hinter der Kamera / zu weit weg unsichtbar, nah größer', () => {
  const { kamera, schilder } = aufbau();
  const p = { x: 0, y: 1.5, z: 10 };
  const s = schilder.neu(p, { name: 'Weg' });
  schilder.update(kamera, 0);
  assert.equal(s.sichtbar, false, 'hinter der Kamera');
  p.z = -80; schilder.update(kamera, 0);
  assert.equal(s.sichtbar, false, 'zu weit');
  p.z = 3; schilder.update(kamera, 0);
  const nah = +s._dom.dom.style.transform.match(/scale\(([\d.]+)\)/)[1];
  p.z = -15; schilder.update(kamera, 0);
  const fern = +s._dom.dom.style.transform.match(/scale\(([\d.]+)\)/)[1];
  assert.ok(nah > fern, `${nah} > ${fern}`);
  assert.ok(+s._dom.nameEl.style.opacity > 0.5);
  s.zeige(false); schilder.update(kamera, 0);
  assert.equal(s.sichtbar, false);
  schilder.dispose();
});

test('Sprechblase läuft ab, Lebensbalken, ohne Name nur bei Blase sichtbar', () => {
  const { kamera, schilder } = aufbau();
  const s = schilder.neu({ x: 0, y: 1.5, z: 0 });
  schilder.update(kamera, 0);
  assert.equal(s.sichtbar, false, 'nichts zu zeigen');
  s.sage('Hallo!', { dauer: 1 });
  schilder.update(kamera, 0.1);
  assert.ok(s.spricht && s.sichtbar);
  assert.equal(s._dom.blase.textContent, 'Hallo!');
  assert.equal(s._dom.blase.style.display, '');
  for (let i = 0; i < 12; i++) schilder.update(kamera, 0.1);
  assert.equal(s.spricht, false); assert.equal(s.sichtbar, false);
  s.setLeben(0.25);
  schilder.update(kamera, 0);
  assert.equal(s.sichtbar, true);
  assert.equal(s._dom.fuell.style.width, '25.0%');
  s.setLeben(null);
  assert.equal(s._dom.balken.style.display, 'none');
  s.sage('x').schweige();
  assert.equal(s.spricht, false);
  s.entfernen(); s.entfernen();
  assert.equal(schilder.anzahl, 0);
  schilder.update(null); schilder.update(kamera, NaN);
  schilder.dispose(); schilder.dispose();
});
