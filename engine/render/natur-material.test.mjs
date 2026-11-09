import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createNaturMaterial, patcheShader } from './natur-material.js';

const shader = (lib = 'standard') => ({ uniforms: {}, vertexShader: THREE.ShaderLib[lib].vertexShader, fragmentShader: THREE.ShaderLib[lib].fragmentShader });

test('Material: Standard-Eigenschaften', () => {
  const m = createNaturMaterial();
  assert.ok(m.isMeshStandardMaterial);
  assert.equal(m.vertexColors, true);
  assert.equal(m.flatShading, true);
  assert.ok(m.roughness >= 0.85);
  assert.ok(m.tiefenMaterial.isMeshDepthMaterial);
  assert.deepEqual(m.defaultAttributeValues.wind, [0]);
  m.dispose();
});

test('onBeforeCompile baut Wind ein (Standard + Tiefe), Uniforms geteilt', () => {
  const m = createNaturMaterial({ wind: true });
  for (const [mat, lib] of [[m, 'standard'], [m.tiefenMaterial, 'depth']]) {
    const s = shader(lib);
    mat.onBeforeCompile(s);
    assert.match(s.vertexShader, /#define NATUR_WIND/);
    assert.match(s.vertexShader, /attribute float wind;/);
    assert.match(s.vertexShader, /instanceMatrix/);
    assert.ok(s.vertexShader.indexOf('#include <begin_vertex>') < s.vertexShader.indexOf('nwBoe'));
    assert.equal(s.uniforms.nwZeit, m.uniforms.nwZeit);
  }
  assert.equal(m.customProgramCacheKey(), m.tiefenMaterial.customProgramCacheKey());
});

test('update setzt Zeit, Stärke, Richtung (normiert)', () => {
  const m = createNaturMaterial();
  m.update(3.5, { staerke: 2, richtung: [0, 4] });
  assert.equal(m.uniforms.nwZeit.value, 3.5);
  assert.equal(m.uniforms.nwStaerke.value, 2);
  assert.deepEqual([m.uniforms.nwRicht.value.x, m.uniforms.nwRicht.value.y], [0, 1]);
  m.update(4);
  assert.equal(m.uniforms.nwStaerke.value, 2);
});

test('wind:false → kein Patch; weite → Ausblend-Code', () => {
  const ohne = createNaturMaterial({ wind: false });
  assert.ok(!String(ohne.customProgramCacheKey()).startsWith('natur'), 'kein eigener Hook');
  const s = patcheShader(shader(), {}, { wind: false, weite: 80 });
  assert.doesNotMatch(s.vertexShader, /#define NATUR_WIND/);
  assert.match(s.vertexShader, /#define NATUR_WEITE/);
  const mitWeite = createNaturMaterial({ weite: 80 });
  assert.notEqual(mitWeite.customProgramCacheKey(), createNaturMaterial().customProgramCacheKey());
});
