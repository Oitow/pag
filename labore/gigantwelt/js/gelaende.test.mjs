import test from 'node:test';
import assert from 'node:assert/strict';
import { hoeheAt, biomAt, waldAt, findeStart, GLSL_GELAENDE_VOLL } from './gelaende.js';

const raster = (n, d, f) => { for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) f((i - n / 2) * d, (j - n / 2) * d); };

test('deterministisch und endlich', () => {
  assert.equal(hoeheAt(123.4, -567.8), hoeheAt(123.4, -567.8));
  raster(30, 1300, (x, z) => assert.ok(Number.isFinite(hoeheAt(x, z))));
});

test('Wertebereich in Metern', () => {
  let mn = 1e9, mx = -1e9;
  raster(60, 700, (x, z) => { const h = hoeheAt(x, z); mn = Math.min(mn, h); mx = Math.max(mx, h); });
  assert.ok(mn > -80 && mn < 0, `min ${mn}`);
  assert.ok(mx > 1200 && mx < 2600, `max ${mx}`);
});

test('Anteil Wasser und Gebirge plausibel', () => {
  let n = 0, w = 0, g = 0;
  raster(60, 700, (x, z) => { const h = hoeheAt(x, z); n++; if (h < 0) w++; if (h > 800) g++; });
  assert.ok(w / n > .04 && w / n < .35, `Wasser ${w / n}`);
  assert.ok(g / n > .02 && g / n < .25, `Gebirge ${g / n}`);
});

test('Biom-Gewichte summieren sich zu 1, Wald nie in Dünen/über 1400 m', () => {
  raster(25, 900, (x, z) => {
    const b = biomAt(x, z), s = b.wald + b.wiese + b.fels + b.sand + b.schnee;
    assert.ok(Math.abs(s - 1) < 1e-9 && Object.values(b).every(v => v > -1e-9), JSON.stringify(b));
    assert.equal(waldAt(x, z, 1500), 0);
  });
});

test('Start in Wiese nahe Wald nahe der Mitte; GLSL-Vertrag vorhanden', () => {
  const s = findeStart(4000);
  assert.ok(s && Math.hypot(s.x, s.z) < 4000, 'kein Start');
  assert.ok(biomAt(s.x, s.z).wiese > .6);
  assert.match(GLSL_GELAENDE_VOLL, /float terrH\(vec2 p,float sp\)/);
});
