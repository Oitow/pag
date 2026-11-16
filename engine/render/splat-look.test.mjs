import test from 'node:test';
import assert from 'node:assert/strict';
import { splatRaster, createSplatLook, SPLAT_STANDARD } from './splat-look.js';

test('splatRaster: kurze Seite bekommt die Dichte, Seitenverhältnis bleibt', () => {
  assert.deepEqual(splatRaster(400, 800, 100), { spalten: 100, zeilen: 200, anzahl: 20000 });
  assert.deepEqual(splatRaster(1600, 900, 90), { spalten: 160, zeilen: 90, anzahl: 14400 });
  assert.equal(splatRaster(10, 10, 2).spalten, 8);        // nie gröber als 8
});

test('createSplatLook: aus per Standard, setze schaltet an und ändert Werte', () => {
  const s = createSplatLook();
  assert.equal(s.an, false);
  s.setze({ an: true, dichte: 120 }).aufloesung(390, 844);
  assert.equal(s.an, true);
  assert.equal(s.werte.dichte, 120);
  assert.equal(SPLAT_STANDARD.an, false);
  s.dispose();
  assert.equal(s.an, false);
});
