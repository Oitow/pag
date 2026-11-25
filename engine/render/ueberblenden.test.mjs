// Tests: Anteil glatt und begrenzt; Instanzwerte kodieren ein/aus so, dass beide Stufen sich ergänzen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ueberAnteil, ueberWert, ueberZone, ueberZoneWert } from './ueberblenden.js';

const sichtbar = (wert, r) => wert < 0 ? false : wert === 0 || (wert <= 1 ? r < wert : r >= wert - 1);

test('Anteil: 0 innen, 1 außen, ½ an der Grenze, monoton', () => {
  assert.equal(ueberAnteil(70, 90, 10), 0);
  assert.equal(ueberAnteil(110, 90, 10), 1);
  assert.ok(Math.abs(ueberAnteil(90, 90, 10) - 0.5) < 1e-9);
  assert.ok(ueberAnteil(85, 90, 10) < ueberAnteil(95, 90, 10));
});

test('ein + aus ergänzen sich: jedes Rasterfeld genau einmal sichtbar', () => {
  for (const f of [0.1, 0.37, 0.5, 0.82]) for (let k = 0; k < 16; k++) {
    const r = (k + 0.5) / 16;
    assert.equal(sichtbar(ueberWert(f, 'ein'), r) + sichtbar(ueberWert(f, 'aus'), r), 1, `f ${f} r ${r}`);
  }
});

test('außerhalb der Zone: ganz sichtbar (0)', () => {
  assert.equal(ueberWert(1, 'ein'), 0);
  assert.equal(ueberWert(0, 'aus'), 0);
});

test('GPU-Zone: ein + aus ergänzen sich bei jedem Abstand, außen nur eine Stufe', () => {
  const ein = ueberZone(50, 6, 'ein'), aus = ueberZone(50, 6, 'aus');
  for (const d of [30, 44.5, 47, 50, 53.3, 55.9, 70]) for (let k = 0; k < 16; k++) {
    const r = (k + 0.5) / 16;
    assert.equal(sichtbar(ueberZoneWert(d, ein), r) + sichtbar(ueberZoneWert(d, aus), r), 1, `d ${d} r ${r}`);
  }
  assert.equal(ueberZoneWert(80, ueberZone(50, 6, 'x')), 0);
});
