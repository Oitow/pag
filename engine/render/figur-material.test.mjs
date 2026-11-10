import test from 'node:test';
import assert from 'node:assert/strict';
import { figurMaterial, FIGUR_MATERIAL_STANDARD } from './figur-material.js';

test('figurMaterial: geteilt je Optionen, Shader bekommt Randlicht', () => {
  const a = figurMaterial(), b = figurMaterial(), c = figurMaterial({ rand: 1 });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(a.vertexColors, true);
  assert.equal(a.userData.figur.uRand.value, FIGUR_MATERIAL_STANDARD.rand);
  const shader = { uniforms: {}, fragmentShader: '#include <common>\n#include <color_fragment>\n#include <opaque_fragment>' };
  a.onBeforeCompile(shader);
  assert.ok(shader.uniforms.uRandFarbe.value.isColor);
  assert.match(shader.fragmentShader, /uRandSchaerfe/);
  assert.equal(shader.fragmentShader.match(/#include <opaque_fragment>/g).length, 1);
});
