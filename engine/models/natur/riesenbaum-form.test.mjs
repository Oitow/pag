import test from 'node:test';
import assert from 'node:assert/strict';
import { baueForm } from './riesenbaum-form.js';
import { baueRiesenbaumRoh } from './riesenbaum-netz.js';

test('riesenbaum-form: Maße in echter Größe, Krone erst ab 55 %', () => {
  const f = baueForm({ seed: 4 });
  assert.equal(f.masse.hoehe, 110); assert.equal(f.masse.stammRadius, 5.5);
  assert.ok(Math.abs(f.masse.kronenAb - 60.5) < 0.01);
  assert.ok(f.masse.kronenRadius > 25 && f.masse.kronenRadius < 60, `Kronenradius ${f.masse.kronenRadius}`);
  assert.ok(f.radius(0) > 6 && f.radius(0) < 7.5 && f.radius(100) < 2);
  assert.ok(f.sdf.abstand(0, 5, 0) < -4, 'Stamm ist massiv');
  assert.ok(f.sdf.abstand(60, 5, 60) > 20);
  for (const a of f.krone.aeste) if (a.ordnung < 3) assert.ok(a.punkte[0][1] >= f.masse.kronenAb - 3, 'kein Ast im kahlen Teil');
  const haupt = f.wurzeln.filter((w) => w.punkte.length === 9);
  assert.equal(haupt.length, 7);
  for (const w of haupt) {
    const weit = w.laenge - 5.5 * 0.5;                        // ab Stammoberfläche
    assert.ok(weit >= 15 - 1e-9 && weit <= 28 + 1e-9, `Wurzel läuft ${weit} m aus`);
    assert.ok(Math.max(...w.oben) > 5 && w.oben[w.oben.length - 1] < 0, 'Rücken hoch am Stamm, taucht am Ende ab');
  }
  assert.ok(f.masse.grenzen.max[1] >= 110 && f.masse.grenzen.min[0] < -20);
});

test('riesenbaum-form: deterministisch je Seed, verschieden zwischen Seeds', () => {
  const a = baueForm({ seed: 9 }), b = baueForm({ seed: 9 }), c = baueForm({ seed: 10 });
  assert.deepEqual(a.wurzeln, b.wurzeln); assert.deepEqual(a.krone, b.krone);
  assert.equal(a.sdf.abstand(8, 2, 3), b.sdf.abstand(8, 2, 3));
  assert.notDeepEqual(a.wurzeln[0].punkte, c.wurzeln[0].punkte);
});

test('riesenbaum-form: Wurzelbogen lässt ≥ 4.5 m Höhe und ≥ 5 m Weite frei', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const f = baueForm({ seed, bogen: true }), b = f.masse.bogen;
    assert.ok(b.lichteHoehe >= 4.5 && b.lichteWeite >= 5, `Seed ${seed}: ${b.lichteHoehe} × ${b.lichteWeite}`);
    assert.ok(Math.abs(Math.hypot(b.achse[0], b.achse[2]) - 1) < 1e-9 && Math.abs(b.achse[0] * b.quer[0] + b.achse[2] * b.quer[2]) < 1e-9);
    for (let l = -6; l <= 6; l += 1) for (let q = -1.5; q <= 1.5; q += 0.75) for (let y = 0.6; y <= 4.4; y += 0.6)      // 3 m breiter Pfad geht durch
      assert.ok(f.sdf.abstand(b.mitte[0] + b.achse[0] * l + b.quer[0] * q, y, b.mitte[2] + b.achse[2] * l + b.quer[2] * q) > 0, `Seed ${seed}: Pfad verstellt bei l=${l} q=${q} y=${y}`);
  }
  assert.equal(baueForm({ seed: 1 }).masse.bogen, undefined);
});

test('riesenbaum-netz: Budget (Dreiecke, Splats, Bauzeit), gültige Daten, deterministisch', () => {
  baueRiesenbaumRoh({ seed: 1 });                                // warmlaufen
  for (const o of [{ seed: 2 }, { seed: 3, bogen: true }]) {
    const t = performance.now(), r = baueRiesenbaumRoh(o), ms = performance.now() - t;
    assert.ok(r.dreiecke <= 60000 && r.dreiecke > 15000, `Dreiecke ${r.dreiecke}`);
    assert.ok(r.splats.anzahl <= 9000 && r.splats.anzahl > 5000, `Splats ${r.splats.anzahl}`);
    assert.ok(ms < 2500, `Bauzeit ${ms} ms`);                    // Ziel ~600 ms am PC; großzügig für langsame Testrechner
    const n = r.position.length / 3;
    assert.equal(r.normal.length, n * 3); assert.equal(r.farbe.length, n * 3);
    for (const i of r.index) assert.ok(i < n);
    for (const v of r.position) assert.ok(Number.isFinite(v));
    for (let i = 0; i < n * 3; i += 3) assert.ok(Math.abs(Math.hypot(r.normal[i], r.normal[i + 1], r.normal[i + 2]) - 1) < 1e-3);
    for (const v of r.farbe) assert.ok(v >= 0 && v < 0.5, 'Rinde bleibt dunkel und gedämpft');
    const s = r.splats;
    assert.equal(s.position.length >= s.anzahl * 3 && s.drehung.length >= s.anzahl * 4, true);
    let wind = 0, hoch = 0;
    for (let i = 0; i < s.anzahl; i++) { assert.ok(s.wind[i] >= 0 && s.wind[i] <= 1 && s.deck[i] > 0 && s.deck[i] <= 1); if (s.wind[i] >= 0.3) wind++; if (s.position[i * 3 + 1] > r.masse.kronenAb - 12) hoch++; }
    assert.ok(wind > 4000 && hoch > 4000, 'Laub oben und beweglich');
  }
  const a = baueRiesenbaumRoh({ seed: 5 }), b = baueRiesenbaumRoh({ seed: 5 });
  assert.deepEqual(a.position, b.position); assert.deepEqual(a.splats.position, b.splats.position);
});

test('riesenbaum-netz: Naht zwischen SDF-Fuß und Stamm ist dicht, unten offen unter dem Boden', () => {
  const r = baueRiesenbaumRoh({ seed: 6 }), f = r.form, a = [0, 0];
  let minY = Infinity;
  for (let i = 1; i < r.position.length; i += 3) minY = Math.min(minY, r.position[i]);
  assert.ok(minY < -0.3 && minY >= -1.01, `Unterkante ${minY}`);
  f.achse(f.naht, a);
  for (let i = 0; i < 16; i++) {                                 // Stammring an der Naht liegt auf der SDF-Oberfläche
    const w = (i / 16) * Math.PI * 2, rad = f.radius(f.naht);
    let rr = rad - f.stoer(a[0] + Math.cos(w) * rad, f.naht, a[1] + Math.sin(w) * rad);
    rr = rad - f.stoer(a[0] + Math.cos(w) * rr, f.naht, a[1] + Math.sin(w) * rr);
    assert.ok(Math.abs(f.sdf.abstand(a[0] + Math.cos(w) * rr, f.naht, a[1] + Math.sin(w) * rr)) < 0.15);
  }
});

test('riesenbaum-netz: Höhenkarte – Wurzeln begehbar, Stamm massiv, weit draußen nichts', () => {
  const r = baueRiesenbaumRoh({ seed: 3, bogen: true }), k = r.hoehenkarte, b = r.masse.bogen;
  assert.equal(k.hoeheBei(0, 0), 6);
  assert.ok(Number.isNaN(k.hoeheBei(200, 0)));
  assert.ok(Number.isNaN(k.hoeheBei(b.mitte[0], b.mitte[2])), 'unter dem Bogen ist der Boden frei');
  let begehbar = 0;
  for (const w of r.form.wurzeln) { const p = w.punkte[Math.floor(w.punkte.length / 2)], h = k.hoeheBei(p[0], p[2]); if (h > 0.2 && h < 6) begehbar++; }
  assert.ok(begehbar >= r.form.wurzeln.length * 0.7, `${begehbar}/${r.form.wurzeln.length} Wurzelrücken in der Karte`);
});
