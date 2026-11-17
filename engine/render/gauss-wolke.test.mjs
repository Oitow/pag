import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createGaussWolke } from './gauss-wolke.js';
import { createSplatDaten } from './gauss-saat.js';

const nah = (a, b, e = 1e-5) => Math.abs(a - b) < e;
/** n Splats auf der x-Achse (x = 0..n−1), Scheibe mit Normale +z. */
function reihe(n) {
  const d = createSplatDaten();
  for (let i = 0; i < n; i++) d.plus(i, 0, 0, 0.2, 0.3, 0.05, 0, 0, 0, 1, 0.1, 0.5, 0.9, 0.8, i % 2);
  return d.fertig();
}
const roh = w => w.mesh.material.uniforms.tDaten.value.image.data;       // 16 Floats je Splat: Mitte+Wind | Skala+Deck | Drehung | Farbe

test('createGaussWolke: Mesh ist für Splats eingestellt', () => {
  const w = createGaussWolke({ max: 100 });
  const m = w.mesh.material;
  assert.equal(w.mesh.frustumCulled, false);
  assert.ok(w.mesh.renderOrder >= 100);
  assert.ok(m.transparent && m.depthTest && !m.depthWrite);
  assert.equal(m.blending, THREE.CustomBlending);
  assert.equal(m.blendSrc, THREE.OneFactor);
  assert.equal(m.blendDst, THREE.OneMinusSrcAlphaFactor);
  assert.equal(w.anzahl, 0);
  assert.equal(w.max, 100);
  assert.equal(w.mesh.geometry.instanceCount, 0);
  w.dispose();
});

test('fuege: übernimmt Daten unverändert, zählt, leere setzt zurück', () => {
  const w = createGaussWolke({ max: 100 });
  assert.equal(w.fuege(reihe(10)), 10);
  assert.equal(w.fuege(reihe(5)), 5);
  assert.equal(w.anzahl, 15);
  const d = roh(w), o = 3 * 16;
  assert.deepEqual([...d.subarray(o, o + 4)], [3, 0, 0, 1]);
  assert.ok(nah(d[o + 4], 0.2) && nah(d[o + 5], 0.3) && nah(d[o + 6], 0.05) && nah(d[o + 7], 0.8));
  assert.deepEqual([...d.subarray(o + 8, o + 12)], [0, 0, 0, 1]);
  assert.ok(nah(d[o + 12], 0.1) && nah(d[o + 13], 0.5) && nah(d[o + 14], 0.9));
  assert.equal(d[10 * 16], 0);                                           // zweiter Block beginnt wieder bei x = 0
  assert.equal(w.fuege({ anzahl: 0 }), 0);
  w.leere();
  assert.equal(w.anzahl, 0);
  assert.equal(w.fuege(reihe(4)), 4);
  w.dispose();
});

test('fuege: max begrenzt still, Rückgabe = tatsächlich hinzugefügt', () => {
  const w = createGaussWolke({ max: 12 });
  assert.equal(w.fuege(reihe(10)), 10);
  assert.equal(w.fuege(reihe(10)), 2);
  assert.equal(w.fuege(reihe(10)), 0);
  assert.equal(w.anzahl, 12);
  w.dispose();
});

test('fuege: anteil dünnt gleichmäßig und deterministisch aus', () => {
  const w = createGaussWolke({ max: 5000 });
  assert.equal(w.fuege(reihe(1000), { anteil: 0.5 }), 500);
  assert.equal(w.fuege(reihe(1000), { anteil: 0.25 }), 250);
  assert.equal(w.fuege(reihe(1000), { anteil: 0 }), 0);
  assert.equal(w.fuege(reihe(1000), { anteil: 1 }), 1000);
  assert.equal(w.fuege(reihe(7), { anteil: 0.1 }), 0);
  const d = roh(w);
  let groessteLuecke = 0;
  for (let i = 1; i < 500; i++) groessteLuecke = Math.max(groessteLuecke, d[i * 16] - d[(i - 1) * 16]);
  assert.equal(groessteLuecke, 2);                                       // jeder zweite, keine Klumpen
  assert.ok(d[499 * 16] >= 998);                                         // reicht bis ans Ende
  const w2 = createGaussWolke({ max: 5000 });
  w2.fuege(reihe(1000), { anteil: 0.5 });
  assert.deepEqual(roh(w2).subarray(0, 500 * 16), d.subarray(0, 500 * 16));
  w.dispose(); w2.dispose();
});

test('fuege: matrix verschiebt, dreht (auch die Drehung) und skaliert gleichmäßig', () => {
  const w = createGaussWolke({ max: 10 });
  const m = new THREE.Matrix4().compose(new THREE.Vector3(10, 20, 30), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), new THREE.Vector3(2, 2, 2));
  w.fuege(reihe(3), { matrix: m });
  const d = roh(w), o = 2 * 16;                                          // lokal (2,0,0) → ·2 → um y gedreht (0,0,−4) → verschoben
  assert.ok(nah(d[o], 10) && nah(d[o + 1], 20) && nah(d[o + 2], 26), `Mitte ${[...d.subarray(o, o + 3)]}`);
  assert.ok(nah(d[o + 4], 0.4) && nah(d[o + 5], 0.6) && nah(d[o + 6], 0.1));
  const q = new THREE.Quaternion(d[o + 8], d[o + 9], d[o + 10], d[o + 11]);
  assert.ok(nah(q.length(), 1));
  const z = new THREE.Vector3(0, 0, 1).applyQuaternion(q);               // Scheiben-Normale +z zeigt nach der Drehung nach +x
  assert.ok(nah(z.x, 1) && nah(z.y, 0) && nah(z.z, 0));
  assert.ok(nah(d[o + 7], 0.8) && d[o + 3] === 0);                       // Deckkraft/Wind unberührt
  w.dispose();
});

test('update: sortiert hinten→vorn, zählt Instanzen, sortiert ohne Drehung nicht neu; setze schreibt Uniformen', () => {
  const w = createGaussWolke({ max: 50, sortiereAlle: 1 });
  const kamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  kamera.position.set(-10, 0, 0);
  kamera.lookAt(0, 0, 0);                                                // Blick +x: Splat 4 ist am fernsten
  w.update(kamera, 0, 800, 600);
  assert.equal(w.mesh.geometry.instanceCount, 0);
  w.fuege(reihe(5));
  w.update(kamera, 1.5, 800, 600);
  const nr = w.mesh.geometry.getAttribute('nr');
  assert.equal(w.mesh.geometry.instanceCount, 5);
  assert.deepEqual([...nr.array.subarray(0, 5)], [4, 3, 2, 1, 0]);
  const version = nr.version;
  kamera.position.set(-12, 0.5, 0);                                      // nur verschoben → Reihenfolge bleibt, kein Upload
  w.update(kamera, 1.6, 800, 600);
  assert.equal(nr.version, version);
  kamera.position.set(10, 0, 0);
  kamera.lookAt(0, 0, 0);                                                // umgedreht
  w.update(kamera, 1.7, 800, 600);
  assert.deepEqual([...nr.array.subarray(0, 5)], [0, 1, 2, 3, 4]);
  const u = w.mesh.material.uniforms;
  assert.equal(u.uZeit.value, 1.7);
  assert.deepEqual(u.uBild.value.toArray(), [800, 600]);
  w.setze({ nebelFarbe: new THREE.Color(0.1, 0.2, 0.3), nebelDichte: 0.004, licht: [1.2, 1, 0.8], wind: 0.3 });
  assert.ok(nah(u.uNebelFarbe.value.g, 0.2) && u.uNebelDichte.value === 0.004 && u.uWind.value === 0.3);
  assert.deepEqual(u.uLicht.value.toArray(), [1.2, 1, 0.8]);
  w.setze({ wind: 0 });
  assert.equal(u.uNebelDichte.value, 0.004);
  w.leere();
  w.update(kamera, 2, 800, 600);
  assert.equal(w.mesh.geometry.instanceCount, 0);
  w.dispose();
});
