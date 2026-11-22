import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMotor } from './character-motor.js';
import { createKlettern } from './klettern.js';
import { createAusdauer } from './ausdauer.js';

// Steilwand: ab x > 2 steigt das Gelände mit 70° an
const welt = { bodenHoehe: (x) => (x > 2 ? (x - 2) * Math.tan(70 * Math.PI / 180) : 0) };

test('klettern: hoch an der Steilwand, leer = abrutschen', () => {
  const motor = createMotor({ welt, pos: { x: 1.5, y: 0, z: 0 } });
  const ausdauer = createAusdauer({ max: 30 });
  const k = createKlettern({ welt, motor, ausdauer });
  const ab = { x: 1, z: 0 };
  let maxY = 0, kletterte = false;
  for (let i = 0; i < 600; i++) {
    k.update(1 / 60, ab); motor.update(1 / 60, ab); ausdauer.update(1 / 60);
    kletterte ||= k.klettert; maxY = Math.max(maxY, motor.zustand.pos.y);
  }
  assert.ok(kletterte, 'klettert');
  assert.ok(maxY > 3, `kam hoch: ${maxY.toFixed(2)}`);
  assert.ok(!k.klettert && motor.zustand.pos.y < maxY - 0.5, 'abgerutscht');
});
