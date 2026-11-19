import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createKronenLichtkarte, brauchtNeu, probeKarte, waehleLuecken } from './kronen-lichtkarte.js';

test('kronen-lichtkarte: brauchtNeu nach Bodenversatz und Weg', () => {
  const a = { richtung: [0.5, 0.34, -0.78], mitte: [0, 0, 0] };
  assert.equal(brauchtNeu(null, a), true);
  assert.equal(brauchtNeu(a, { ...a }), false);
  // tiefe Sonne: kleiner Winkel → großer Bodenversatz
  const b = { richtung: [0.5, 0.33, -0.78], mitte: [0, 0, 0] };
  assert.equal(brauchtNeu(a, b, { hoehe: 80, verschiebung: 1.2 }), true);
  assert.equal(brauchtNeu(a, b, { hoehe: 8, verschiebung: 1.2 }), false);
  assert.equal(brauchtNeu(a, { ...a, mitte: [30, 0, 0] }, { weg: 28 }), true);
  assert.equal(brauchtNeu(a, { ...a, mitte: [10, 0, 0] }, { weg: 28 }), false);
});

test('kronen-lichtkarte: probeKarte mittelt das Fenster, außerhalb null', () => {
  const g = 4, d = new Uint8Array(g * g * 4);
  d[(1 * g + 1) * 4] = 255;                                       // ein Pixel mit Wert 1 bei (1,1)
  assert.equal(probeKarte(d, g, 0.3, 0.3, 0), 1);
  assert.equal(probeKarte(d, g, 0.8, 0.8, 0), 0);
  assert.ok(Math.abs(probeKarte(d, g, 0.3, 0.3, 1) - 1 / 9) < 1e-9);
  assert.equal(probeKarte(d, g, 1.2, 0.5), null);
  assert.equal(probeKarte(null, g, 0.5, 0.5), null);
});

test('kronen-lichtkarte: waehleLuecken – hell zuerst, Abstand, Schwelle, max', () => {
  const p = [{ x: 0, z: 0, licht: 0.9 }, { x: 2, z: 0, licht: 0.95 }, { x: 20, z: 0, licht: 0.6 }, { x: 40, z: 0, licht: 0.3 }, { x: 60, z: 0, licht: 0.8 }];
  const l = waehleLuecken(p, { max: 3, abstand: 8, schwelle: 0.5 });
  assert.deepEqual(l.map((q) => q.x), [2, 60, 20]);
  assert.equal(waehleLuecken(p, { max: 1 }).length, 1);
});

test('kronen-lichtkarte: Verdecker teilen Instanzen, Material-Hook, dispose', () => {
  const lk = createKronenLichtkarte({ renderer: null, groesse: 64, weite: 100 });
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial(), 3);
  const s = lk.fuege(im);
  assert.equal(s.instanceMatrix, im.instanceMatrix); assert.equal(s.count, 3);
  assert.ok(lk.textur.isTexture && lk.uniforms.uLkMatrix.value.isMatrix4);
  assert.equal(lk.lichtBei(0, 0, 0), 1 - 0.7, 'ohne Readback: aussen');
  const m = lk.mitLichtkarte(new THREE.MeshStandardMaterial());
  const shader = { uniforms: {}, vertexShader: 'void main() {\n#include <project_vertex>\n}', fragmentShader: 'void main() {\n#include <lights_fragment_begin>\n}' };
  m.onBeforeCompile(shader, null);
  assert.ok(shader.uniforms.uLkKarte && shader.uniforms.uLkStaerke);
  assert.match(shader.fragmentShader, /directLight\.color \*= lkWert/);
  assert.match(shader.vertexShader, /vLkW = /);
  assert.match(m.customProgramCacheKey(), /^lichtkarte\|/);
  const st = lk.mitLichtkarte(new THREE.MeshStandardMaterial(), { nurLaub: true }), sh2 = { ...shader, uniforms: {}, fragmentShader: 'void main() {\n#include <lights_fragment_begin>\n}' };
  st.onBeforeCompile(sh2, null);
  assert.match(sh2.fragmentShader, /lkLicht\(vLkW, 1\.0\)/); assert.match(st.customProgramCacheKey(), /^lichtkarteL/);
  const deck = new THREE.ShaderMaterial(); lk.fuege(new THREE.Mesh(new THREE.BoxGeometry()), { material: deck });
  assert.equal(deck.blendDst, THREE.SrcColorFactor); assert.equal(deck.depthTest, false);
  assert.match(lk.GLSL, /float lkLicht\(vec3 w, float nurLaub\)/);
  lk.dispose();
});

test('kronen-lichtkarte: update rendert selten, stellt den Renderer wieder her', () => {
  const log = [];
  const renderer = { info: { autoReset: true, render: { calls: 0 } }, shadowMap: { autoUpdate: true, needsUpdate: false },
    getRenderTarget: () => null, getClearAlpha: () => 1, getClearColor: (c) => c.set(0x123456), setRenderTarget: (t) => log.push(t ? 'ziel' : 'bild'),
    setClearColor: () => {}, clear: () => {}, render: () => { renderer.info.render.calls += 2; log.push('render'); }, readRenderTargetPixels: (t, x, y, w, h, d) => d.fill(255) };
  const lk = createKronenLichtkarte({ renderer, groesse: 8, weite: 100, minBilder: 5 });
  const r = new THREE.Vector3(0.5, 0.34, -0.78).normalize(), m = new THREE.Vector3();
  assert.equal(lk.update(r, m), true);
  assert.equal(lk.zahlen.calls, 2); assert.equal(renderer.info.autoReset, true); assert.equal(renderer.shadowMap.autoUpdate, true);
  assert.deepEqual(log.slice(-2), ['render', 'bild']);
  assert.equal(lk.update(r, m), false, 'nichts geändert');
  const r2 = new THREE.Vector3(0.5, 0.3, -0.78).normalize();
  assert.equal(lk.update(r2, m), false, 'Deckel: zu früh');
  for (let i = 0; i < 2; i++) assert.equal(lk.update(r2, m), false);
  assert.equal(lk.update(r2, m), true); assert.equal(lk.zahlen.neu, 2);
  assert.equal(lk.lichtBei(0, 0, 0), 1, 'Readback: frei');
  assert.equal(lk.update(r2, m, true), true, 'zwingen');
  lk.dispose();
});
