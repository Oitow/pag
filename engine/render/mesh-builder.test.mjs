import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMeshBuilder, standardMaterial, tMatrix } from './mesh-builder.js';

test('Primitive → eine Geometrie mit Farben, deterministisch per Seed', () => {
  const bau = (seed) => createMeshBuilder({ seed }).box(1, 1, 1, '#ff0000', { y: 0.5 }).sphere(0.3, 0x00ff00, { x: 2 }, 6, 4)
    .cyl(0.2, 0.3, 1, 0x0000ff).cone(0.2, 0.5, 0xffffff).ico(0.2, 0x808080).capsule(0.1, 0.3, 0x404040).geometry();
  const a = bau(3), b = bau(3), c = bau(4);
  assert.ok(a.attributes.position.count > 100 && a.attributes.normal && a.attributes.color);
  assert.deepEqual(Array.from(a.attributes.color.array), Array.from(b.attributes.color.array));
  assert.notDeepEqual(Array.from(a.attributes.color.array), Array.from(c.attributes.color.array));
  assert.deepEqual(Array.from(a.attributes.position.array), Array.from(c.attributes.position.array));
  a.computeBoundingBox();
  assert.ok(Math.abs(a.boundingBox.min.y + 0.5) < 1e-6 && a.boundingBox.max.y === 1 && a.boundingBox.max.x > 2.2);
});

test('Farbe ohne Jitter exakt; leer; dreiecke; mesh nutzt geteiltes Material', () => {
  const b = createMeshBuilder({ jitter: 0 });
  assert.equal(b.leer, true);
  b.box(1, 1, 1, '#ff0000');
  assert.equal(b.leer, false);
  assert.equal(b.dreiecke, 12);
  const g = b.geometry();
  const rot = new THREE.Color('#ff0000');
  assert.ok(Math.abs(g.attributes.color.array[0] - rot.r) < 1e-6 && g.attributes.color.array[1] === 0);
  const m = b.mesh();
  assert.ok(m instanceof THREE.Mesh && m.material === standardMaterial());
  assert.ok(m.material.vertexColors && m.material.flatShading);
  assert.notEqual(standardMaterial({ side: THREE.DoubleSide }), standardMaterial());
});

test('Spiegeln und innen drehen die Dreiecke um; Original-Geometrie bleibt', () => {
  const n = (t) => { const g = createMeshBuilder().box(1, 1, 1, 0xffffff, t).geometry(); return g.attributes.normal.array[0] * Math.sign(g.attributes.position.array[0]); };
  assert.ok(n({}) > 0, 'Normale zeigt nach außen');
  assert.ok(n({ sx: -1 }) > 0, 'gespiegelt weiterhin außen');
  assert.ok(n({ innen: true }) < 0, 'innen → nach innen');
  const geo = new THREE.BoxGeometry(1, 1, 1), vorher = geo.attributes.position.array.slice();
  createMeshBuilder().add(geo, 0xffffff, { x: 5 });
  assert.deepEqual(geo.attributes.position.array, vorher);
  const p = new THREE.Vector3(1, 0, 0).applyMatrix4(tMatrix({ x: 1, ry: Math.PI / 2, s: 2 }));
  assert.ok(Math.abs(p.x - 1) < 1e-6 && Math.abs(p.z + 2) < 1e-6);
});
