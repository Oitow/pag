import test from 'node:test';
import assert from 'node:assert/strict';
import { createZauberEffekte } from './zauber-effekte.js';

test('Effekte entstehen, laufen ab und räumen sich auf', () => {
  const fx = createZauberEffekte({ maxPartikel: 200, seed: 2 });
  const p = { x: 1, y: 0, z: 2 };
  fx.funken(p, { anzahl: 20 });
  fx.kugel(7, p, { farbe: 0xff0000 });
  fx.ring(p, { radius: 3 });
  fx.blitz([p, { x: 4, y: 1, z: 2 }, { x: 6, y: 1, z: 5 }]);
  fx.stacheln(p);
  fx.sturz(p, { dauer: 0.5 });
  fx.aura('s', () => p, { dauer: 1 });
  fx.update(0.05, { hoehePx: 800 });
  assert.ok(fx.aktiv > 20);
  assert.ok(fx.gruppe.children.length >= 7);
  assert.equal(fx.gruppe.children[0].material.uniforms.uSkala.value, 800);
  fx.entferneKugel(7);
  for (let i = 0; i < 80; i++) fx.update(0.05);
  assert.equal(fx.aktiv, 0);
  assert.equal(fx.gruppe.children.length, 1);      // nur noch das Partikel-Objekt
  fx.dispose();
});
