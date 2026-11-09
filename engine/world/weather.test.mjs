import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeather, nebelFuerWetter, WETTER } from './weather.js';

test('Nebel je Wetterstärke', () => {
  assert.deepEqual(nebelFuerWetter(100, 500, 0), { nah: 100, fern: 500 });
  const s = nebelFuerWetter(100, 500, 1);
  assert.ok(s.fern < 200 && s.nah < s.fern);
});

test('Regen: Tropfen um die Kamera, Übergang, Nebel zurücksetzen', () => {
  const nebel = { near: 120, far: 520 };
  const w = createWeather({ anzahl: 200, nebel, seed: 3 });
  w.update(0.1, { position: { x: 0, y: 0, z: 0 } });
  assert.equal(w.gruppe.children[0].visible, false);
  w.setWetter('sturm', true);
  w.update(0.1, { position: { x: 50, y: 10, z: -20 } });
  assert.equal(w.staerke, WETTER.sturm);
  assert.ok(nebel.far < 200 && w.bewoelkung === 1);
  const p = w.gruppe.children[0].geometry.attributes.position.array;
  for (let i = 0; i < p.length; i += 3) { assert.ok(Math.abs(p[i] - 50) <= 21 && Math.abs(p[i + 2] + 20) <= 21); }
  w.setWetter('klar');
  for (let i = 0; i < 100; i++) w.update(0.1);
  assert.equal(w.staerke, 0);
  w.dispose();
  assert.equal(nebel.far, 520);
});
