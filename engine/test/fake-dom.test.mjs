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

test('fake-dom 1.1: Kinder, Eltern, Entfernen und Ereignisse', () => {
  installFakeDom();
  const a = document.createElement('div'), b = document.createElement('button'), c = document.createElement('span');
  a.append(b, c);
  assert.equal(a.children.length, 2);
  assert.equal(b.parentNode, a);
  assert.ok(a.contains(c));
  b.remove();
  assert.deepEqual(a.children, [c]);
  assert.equal(b.parentNode, null);
  a.insertBefore(b, c);
  assert.deepEqual(a.children, [b, c]);
  let n = 0;
  const f = (e) => { n++; e.preventDefault(); e.stopPropagation(); assert.equal(e.target, b); };
  b.addEventListener('pointerdown', f);
  b.dispatch('pointerdown');
  b.removeEventListener('pointerdown', f);
  b.dispatch('pointerdown');
  assert.equal(n, 1);
  a.replaceChildren();
  assert.equal(a.children.length, 0);
  assert.equal(c.parentNode, null);
});
