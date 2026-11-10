import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHimmel } from './himmel.js';
import { himmelStand } from './himmel-stand.js';

test('hängt Kuppel, Sterne und Lichter in die Szene und legt Nebel an', () => {
  const szene = new THREE.Scene();
  const h = createHimmel({ szene, sterne: 50 });
  assert.equal(h.gruppe.parent, szene);
  assert.ok(szene.fog.isFog && szene.background.isColor);
  assert.ok(h.licht.isDirectionalLight && h.licht.castShadow && h.umgebung.isHemisphereLight);
  assert.equal(h.gruppe.children.filter(o => o.isPoints)[0].geometry.attributes.position.count, 50);
  h.dispose();
  assert.equal(h.gruppe.parent, null);
  assert.equal(szene.fog, null);
});

test('update: Licht folgt der Mitte, Tag/Nacht steuert Sterne, Stärke und Nebel', () => {
  const szene = new THREE.Scene(), kamera = new THREE.PerspectiveCamera();
  kamera.position.set(10, 5, -3);
  const h = createHimmel({ szene, nebel: { nah: 100, fern: 400 } });
  const mitte = new THREE.Vector3(50, 2, 70), sterne = h.gruppe.children.find(o => o.isPoints), kuppel = h.gruppe.children.find(o => o.isMesh);

  h.update(himmelStand({ stunde: 12 }), { kamera, mitte, zeit: 3 });
  assert.deepEqual(h.licht.target.position.toArray(), [50, 2, 70]);
  assert.ok(h.licht.position.y > 100 && h.licht.intensity > 1.5);
  assert.deepEqual(kuppel.position.toArray(), [10, 5, -3]);
  assert.equal(sterne.visible, false);
  assert.equal(szene.fog.far, 400);
  const tagBlau = szene.fog.color.b;

  h.update(himmelStand({ stunde: 0, tag: 15, wetter: { nebel: 1 } }), { kamera, mitte });
  assert.ok(h.licht.intensity < 0.7 && h.umgebung.intensity < 0.75);
  assert.ok(szene.fog.far < 120 && szene.fog.color.b < tagBlau);
  h.update(himmelStand({ stunde: 0, tag: 15 }), { kamera });
  assert.equal(sterne.visible, true);
  assert.ok(sterne.material.opacity > 0.9);
  h.dispose();
});

test('bestehender Nebel der Szene bleibt erhalten; ohne Szene nutzbar', () => {
  const szene = new THREE.Scene(), eigen = new THREE.Fog(0, 1, 2);
  szene.fog = eigen;
  const h = createHimmel({ szene, schatten: false, sterne: 0, wolken: false });
  assert.equal(h.licht.castShadow, false);
  h.dispose();
  assert.equal(szene.fog, eigen);
  const frei = createHimmel();
  frei.update(himmelStand({ stunde: 18 }));
  frei.dispose();
});
