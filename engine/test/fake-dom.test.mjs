import test from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './fake-dom.mjs';
import * as THREE from 'three';

test('fake-dom: Speicher, Frames, Elemente', () => {
  const dom = installFakeDom();
  localStorage.setItem('a', 1);
  assert.equal(localStorage.getItem('a'), '1');
  let n = 0; requestAnimationFrame(() => n++); dom.tick();
  assert.equal(n, 1);
  assert.equal(document.getElementById('x'), document.getElementById('x'));
});
test('echtes THREE läuft in Node (ohne Rendern)', () => {
  const g = new THREE.BoxGeometry(1, 1, 1);
  assert.ok(g.attributes.position.count > 0);
  assert.equal(THREE.REVISION, '170');
});
