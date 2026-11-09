import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from './worldgen/worldgen.js';
import { gelaendeFarben, srgbZuLinear, GELAENDE_FARBEN } from './terrain-farben.js';

test('Geländefarben: endlich, 0…1, deterministisch, weich gemischt', () => {
  const welt = createWorld({ preset: 'insel', seed: 3, breite: 64, tiefe: 64, qualitaet: 'schnell' });
  const a = gelaendeFarben(welt, { hoehenSkala: 40, meterProZelle: 2 });
  const b = gelaendeFarben(welt, { hoehenSkala: 40, meterProZelle: 2 });
  assert.equal(a.length, 64 * 64 * 3);
  for (let i = 0; i < a.length; i++) { assert.ok(Number.isFinite(a[i]) && a[i] >= 0 && a[i] <= 1); assert.equal(a[i], b[i]); }
  const roh = gelaendeFarben(welt, { details: false, weich: 0 }), weich = gelaendeFarben(welt, { details: false });
  let sprungRoh = 0, sprungWeich = 0;
  for (let i = 3; i < roh.length - 3; i += 3) { sprungRoh += Math.abs(roh[i] - roh[i - 3]); sprungWeich += Math.abs(weich[i] - weich[i - 3]); }
  assert.ok(sprungWeich < sprungRoh, 'Mischen glättet Biomgrenzen');
  assert.ok(Math.abs(srgbZuLinear(1) - 1) < 1e-9 && srgbZuLinear(0) === 0);
  assert.ok(GELAENDE_FARBEN.wiese && GELAENDE_FARBEN.fels);
});

test('Geländefarben: Schnee in kalter Welt, abschaltbar', () => {
  const welt = createWorld({ preset: 'tundra', seed: 2, breite: 64, tiefe: 64, qualitaet: 'schnell' });
  const hell = f => { let n = 0; for (let i = 0; i < f.length; i += 3) if (f[i] > 0.7 && f[i + 2] > 0.7) n++; return n; };
  const mit = hell(gelaendeFarben(welt, { hoehenSkala: 40 })), ohne = hell(gelaendeFarben(welt, { hoehenSkala: 40, schnee: false }));
  assert.ok(mit > 50 && mit > ohne * 2, `Schnee fehlt (${mit} / ${ohne})`);
});

test('Geländefarben: Wege färben den Boden, ohne Wege bleibt alles gleich', () => {
  const o = { preset: 'kontinent', seed: 11, breite: 96, tiefe: 96, qualitaet: 'schnell' };
  const welt = createWorld({ ...o, wege: { aktiv: true } });
  const mit = gelaendeFarben(welt, { hoehenSkala: 40, meterProZelle: 2 }), ohne = gelaendeFarben(welt, { hoehenSkala: 40, meterProZelle: 2, wege: false });
  let anders = 0, wegZellen = 0;
  for (let i = 0; i < welt.flags.length; i++) {
    const d = Math.abs(mit[i * 3] - ohne[i * 3]) + Math.abs(mit[i * 3 + 1] - ohne[i * 3 + 1]) + Math.abs(mit[i * 3 + 2] - ohne[i * 3 + 2]);
    if (welt.flags[i] & 128 && !(welt.flags[i] & 7)) { wegZellen++; if (d > 0.01) anders++; }
  }
  assert.ok(wegZellen > 10 && anders > wegZellen * 0.6, `nur ${anders} von ${wegZellen} Wegzellen gefärbt`);
});
