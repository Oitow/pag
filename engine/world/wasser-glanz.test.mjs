import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWasserGlanz, patcheGlanzShader, GLANZ_STANDARD } from './wasser-glanz.js';

const shader = () => ({
  uniforms: {},
  vertexShader: 'void main() {\n#include <begin_vertex>\n#include <project_vertex>\n}',
  fragmentShader: 'void main() {\n#include <color_fragment>\n}',
});

test('patcheGlanzShader: baut Wellen genau einmal ein, Schaum nur mit ufer', () => {
  const u = createWasserGlanz([]).uniforms;
  const s = patcheGlanzShader(shader(), u);
  patcheGlanzShader(s, u);
  assert.equal(s.vertexShader.match(/varying vec3 vGlanzPos/g).length, 1);
  assert.equal(s.fragmentShader.match(/#include <color_fragment>/g).length, 1);
  assert.ok(!s.vertexShader.includes('#define GLANZ_UFER'));
  assert.equal(s.uniforms.uGlanzZeit, u.uGlanzZeit);
  const mitUfer = patcheGlanzShader(shader(), u, { ufer: true });
  assert.ok(mitUfer.vertexShader.startsWith('#define GLANZ_UFER'));
  assert.ok(mitUfer.fragmentShader.startsWith('#define GLANZ_UFER'));
});

test('createWasserGlanz: hängt sich vor fremde Hooks, Zeit läuft ab erstem update, dispose stellt zurück', () => {
  const m = new THREE.MeshStandardMaterial(), n = new THREE.MeshStandardMaterial();
  let fremd = 0;
  n.onBeforeCompile = () => { fremd++; };
  const altN = n.onBeforeCompile;
  m.userData.ufer = true;
  const g = createWasserGlanz([m, null, n]);
  const s = shader();
  m.onBeforeCompile(s, null);
  assert.ok(s.vertexShader.includes('#define GLANZ_UFER'));
  const t = shader();
  n.onBeforeCompile(t, null);
  assert.equal(fremd, 1);
  assert.ok(!t.vertexShader.includes('#define GLANZ_UFER'));
  assert.notEqual(m.customProgramCacheKey(), n.customProgramCacheKey());
  g.update(100); g.update(102.5);
  assert.equal(g.uniforms.uGlanzZeit.value, 2.5);
  g.setze({ staerke: 0.3, groesse: 2 });
  assert.equal(g.uniforms.uGlanz.value.x, 0.3);
  assert.equal(g.uniforms.uGlanz.value.w, 0.5);
  g.dispose();
  assert.equal(n.onBeforeCompile, altN);
  assert.ok(!Object.prototype.hasOwnProperty.call(m, 'onBeforeCompile'));
  assert.equal(GLANZ_STANDARD.tempo, 1);
});
