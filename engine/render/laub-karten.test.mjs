import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLaubKarten } from './laub-karten.js';

const karten = { anzahl: 2, mitte: new Float32Array([0, 60, 0, 10, 70, 5]), normale: new Float32Array([0, 1, 0, 1, 0, 0]),
  farbe: new Float32Array([0.02, 0.04, 0.02, 0.03, 0.05, 0.02]), daten: new Float32Array([4, 0.5, 0.1, 3, 1, 0.7]) };

test('laub-karten: ein instanziertes Mesh, Licht setzbar, dispose', () => {
  const l = createLaubKarten({ karten });
  assert.ok(l.mesh.isMesh && l.mesh.geometry.isInstancedBufferGeometry);
  assert.equal(l.mesh.geometry.instanceCount, 2);
  assert.equal(l.anzahl, 2);
  for (const n of ['iMitte', 'iNormale', 'iFarbe', 'iDaten']) assert.ok(l.mesh.geometry.attributes[n], n);
  assert.ok(l.mesh.geometry.boundingSphere.containsPoint(new THREE.Vector3(10, 70, 5)));
  l.setzeLicht({ sonne: new THREE.Vector3(0, 2, 0), farbe: new THREE.Color(1, 0, 0), umgebung: new THREE.Color(0, 1, 0) });
  const u = l.material.uniforms;
  assert.ok(Math.abs(u.uSonne.value.y - 1) < 1e-6 && u.uSonnenFarbe.value.r === 1 && u.uUmgebung.value.g === 1);
  l.update(3); assert.equal(u.uZeit.value, 3);
  assert.ok(l.material.fog && u.fogColor && u.fogDensity, 'Szenen-Nebel');
  assert.ok(l.deckMaterial.defines.NUR_DECKUNG !== undefined && l.deckMaterial.uniforms.uZeit === u.uZeit, 'Deckungs-Material teilt Wind');
  l.dispose();
});
