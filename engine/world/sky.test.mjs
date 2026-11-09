import test from 'node:test';
import assert from 'node:assert/strict';
import { createSky } from './sky.js';
import { tageszeitZustand } from './daynight.js';

test('Himmel: Kuppel, Zustand übernehmen, folgt der Kamera', () => {
  const h = createSky({ radius: 500 });
  assert.ok(h.mesh.isMesh && h.mesh.material.isShaderMaterial && h.mesh.material.depthWrite === false);
  h.setzeZustand(tageszeitZustand(0));
  assert.equal(h.uniforms.uSterne.value, 1);
  assert.ok(h.uniforms.uMond.value.y > 0.8);
  h.setzeZustand(tageszeitZustand(12));
  assert.equal(h.uniforms.uSterne.value, 0);
  assert.ok(h.uniforms.uSonne.value.y > 0.8);
  h.update(0.5, { position: { x: 3, y: 4, z: 5 } });
  assert.deepEqual(h.mesh.position.toArray(), [3, 4, 5]);
  assert.equal(h.uniforms.uZeit.value, 0.5);
  h.dispose();
});
