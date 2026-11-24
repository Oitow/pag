// Prüft die Flugphysik des Gleiters im Erde-Labor (labore/erde/js/gleiter-physik.js): Gleitzahl, Sinken, Abriss, Thermik, Landung.
import test from 'node:test';
import assert from 'node:assert/strict';
import { neuerFlug, schritt, messe, aufwind, landeSchaden, fallSchaden } from '../labore/erde/js/gleiter-physik.js';

const R = 100_000, KURS = [0, 0, -1];
// Start 300 m über dem Nordpol einer 100-km-Kugel (oben = +y), waagerecht nach −z
const fliege = (s, e = {}, f = neuerFlug([0, R + 300, 0], [0, 0, -10])) => {
  for (let t = 0; t < s; t += 0.05) schritt(f, 0.05, { R, kurs: KURS, ...e });
  return f;
};

test('ruhiger Flug: Gleitzahl 8–10, Sinken ~1,2 m/s, ~37 km/h – auf der 100-km-Kugel', () => {
  const f = fliege(60);
  const m = messe(f);
  assert.ok(m.steig < -0.9 && m.steig > -1.5, `Sinken ${m.steig}`);
  assert.ok(m.grund / -m.steig > 8 && m.grund / -m.steig < 10, `Gleitzahl ${m.grund / -m.steig}`);
  assert.ok(m.grund * 3.6 > 30 && m.grund * 3.6 < 45, `Tempo ${m.grund * 3.6} km/h`);
  assert.ok(!f.abriss);
  // nach 600 m Flug ist „oben“ gekippt – Fahrt bleibt waagerecht zur Kugel
  assert.ok(Math.abs(Math.hypot(...f.p) - R - 300 + 60 * 1.2) < 25, 'Höhe über der Kugel passt zum Sinken');
});

test('Stick vor = schneller und sinkt mehr, zurück = langsamer', () => {
  const schnell = messe(fliege(40, { vor: 1 })), langsam = messe(fliege(40, { vor: -1 })), trimm = messe(fliege(40));
  assert.ok(schnell.grund > trimm.grund * 1.4 && schnell.steig < trimm.steig - 1, `schnell ${JSON.stringify(schnell)}`);
  assert.ok(langsam.grund < trimm.grund * 0.8 && langsam.steig > -1.4, `langsam ${JSON.stringify(langsam)}`);
});

test('Strömungsabriss: zu langsam sackt durch und fängt sich wieder', () => {
  const f = neuerFlug([0, R + 300, 0], [0, -1, -3]);
  fliege(0.6, {}, f);
  assert.ok(f.abriss, 'Abriss bei 3 m/s');
  assert.ok(messe(f).steig < -4, `sackt durch: ${messe(f).steig}`);
  fliege(4, {}, f);
  assert.ok(!f.abriss, 'nach 4 s liegt die Strömung wieder an');
});

test('Thermik hebt: Aufwind 3 m/s → steigt; Krater stark, Lee fällt, Nacht ohne Thermik', () => {
  assert.ok(messe(fliege(40, { auf: 3 })).steig > 1.5);
  const hang = { sonneHoch: 0.8, hangSonne: 0.9, steil: 0.4, dunkel: 0.7, agl: 300, muster: 1 };
  assert.ok(aufwind(hang) > 2, `sonniger Hang ${aufwind(hang)}`);
  assert.equal(aufwind({ ...hang, sonneHoch: 0.1 }), 0);
  assert.ok(aufwind({ agl: 300, vulkan: 1, lava: 1 }) > 4, 'Krater');
  assert.ok(aufwind({ agl: 50, hangwind: -2 }) < -1, 'Lee');
});

test('Landung: weich ohne Schaden, hart oder zu schnell tut weh; Anbremsen bremst vor dem Aufsetzen', () => {
  assert.equal(landeSchaden(1.5, 10), 0);
  assert.ok(landeSchaden(12, 10) > 0 && landeSchaden(3, 25) > 0);
  assert.ok(landeSchaden(12, 10, true) < landeSchaden(12, 10), 'Wasser federt');
  assert.equal(fallSchaden(-10), 0);
  assert.ok(fallSchaden(-20) > 30);
  const f = fliege(40), vorher = messe(f);
  fliege(1.5, { vor: -1 }, f);
  const nachher = messe(f);
  assert.ok(nachher.grund < vorher.grund * 0.97 && nachher.steig > vorher.steig + 0.8, `Abfangen ${JSON.stringify({ vorher, nachher })}`);
});
