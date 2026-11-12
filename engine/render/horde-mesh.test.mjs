import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHordeMesh } from './horde-mesh.js';

const wesen = (o) => ({ def: { modell: 'ratte' }, x: 0, y: 0, z: 0, yaw: 0, skala: 1, phase: 0, hub: 0, dreh: 0, zustand: 'lauf', blitz: 0, verfall: 0, ton: 1, hoehe: 0.3, t: 0, ...o });

test('Instanzen je Lauf-Bild, Obergrenze, Liegen und Aufblitzen', () => {
  const bilder = [new THREE.BoxGeometry(1, 1, 1), new THREE.BoxGeometry(1, 1, 1)];
  const hm = createHordeMesh({ modelle: { ratte: bilder }, max: 3 });
  const [a, b] = hm.gruppe.children;
  hm.update([wesen({ phase: 0.2 }), wesen({ phase: 0.7, x: 2 }), wesen({ phase: 1.3 }), wesen({ def: { modell: 'unbekannt' } })]);
  assert.equal(a.count, 2);
  assert.equal(b.count, 1);
  hm.update(Array.from({ length: 6 }, () => wesen({ phase: 0.1 })));
  assert.equal(a.count, 3);
  assert.equal(b.count, 0);
  hm.update([wesen({ zustand: 'tot', tot: true, blitz: 1 })]);
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), c = new THREE.Color();
  a.getMatrixAt(0, m); m.decompose(p, q, s);
  assert.ok(Math.abs(new THREE.Euler().setFromQuaternion(q, 'YXZ').z - Math.PI / 2) < 1e-6, 'liegt auf der Seite');
  a.getColorAt(0, c);
  assert.ok(c.r > 2, 'blitzt hell');
  hm.sichtbar = false;
  assert.equal(hm.gruppe.visible, false);
  hm.dispose();
  assert.equal(hm.gruppe.children.length, 0);
});
