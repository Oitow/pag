import test from 'node:test';
import assert from 'node:assert/strict';
import { PFAD_PUNKTE, PFAD_ENDE, WELT, ORTE, MARKEN, HELDEN, RIESEN_VARIANTEN, BOGEN_VARIANTE, LICHTUNG, STAMM,
  pfadX, pfadSteigung, pfadAbstand, nebenPfad, stammRadiusVon, stammAbstand, riesenListe } from '../games/daemmerwald/js/plan-daten.js';

test('Pfad: Stützpunkte wachsen in z, Verlauf ist stetig und ohne Knicke', () => {
  for (let i = 1; i < PFAD_PUNKTE.length; i++) assert.ok(PFAD_PUNKTE[i][0] > PFAD_PUNKTE[i - 1][0]);
  let alt = pfadX(0), altS = pfadSteigung(0);
  for (let z = 0.5; z <= PFAD_ENDE; z += 0.5) {
    const x = pfadX(z), s = pfadSteigung(z);
    assert.ok(Number.isFinite(x));
    assert.ok(Math.abs(x - alt) < 0.45, `Sprung bei z=${z}`);
    assert.ok(Math.abs(s - altS) < 0.06, `Knick bei z=${z}`);
    assert.ok(Math.abs(s) < 0.7, `zu steile Kurve bei z=${z}`);
    assert.ok(x > WELT.xMin + 40 && x < WELT.xMax - 40);
    alt = x; altS = s;
  }
  for (const [z, x] of PFAD_PUNKTE.slice(1, -1)) assert.ok(Math.abs(pfadX(z) - x) < 1e-9, 'Spline geht durch die Stützpunkte');
});

test('Orte liegen auf dem Pfad, in Reihenfolge, nahe ihrer Wegmarke', () => {
  assert.deepEqual(ORTE.map((o) => o.id), ['ufer', 'tor', 'bogen', 'stamm', 'lichtung']);
  let z = -1;
  for (const o of ORTE) {
    assert.ok(pfadAbstand(o.x, o.z) < 0.01, o.id + ' auf dem Pfad');
    assert.ok(o.z > z); z = o.z;
    assert.ok(o.name.length > 3 && o.name.length <= 24);
    assert.ok(MARKEN[o.id] - o.z >= -6 && MARKEN[o.id] - o.z <= 30, o.id + ' steht kurz vor seiner Sehenswürdigkeit');
  }
  assert.ok(Math.hypot(pfadX(MARKEN.lichtung) - LICHTUNG.x, MARKEN.lichtung - LICHTUNG.z) < LICHTUNG.radius);
  assert.ok(Math.abs(pfadX(STAMM.z) - STAMM.x) < 1e-9, 'der Pfad führt durch die Kerbe des gestürzten Riesen');
});

test('nebenPfad und pfadAbstand passen zusammen', () => {
  for (const z of [10, 70, 140, 222, 330]) for (const s of [-12, -3, 4, 15]) {
    const p = nebenPfad(z, s);
    assert.ok(Math.abs(pfadAbstand(p.x, p.z) - Math.abs(s)) < 0.6, `z=${z} s=${s}`);
  }
});

test('Riesen: Maße laut Bauplan, genug Bäume, Abstände', () => {
  for (const v of RIESEN_VARIANTEN) {
    assert.ok(v.hoehe >= 90 && v.hoehe <= 140);
    assert.ok(v.stammRadius * 2 >= 9 && v.stammRadius * 2 <= 14);
    assert.ok(v.wurzelWeite >= 15 && v.wurzelWeite <= 28);
  }
  assert.equal(RIESEN_VARIANTEN.filter((v) => v.bogen).length, 1);
  const liste = riesenListe();
  assert.ok(liste.length >= 35 && liste.length <= 50, 'Anzahl ' + liste.length);
  assert.equal(liste.filter((b) => b.variante === BOGEN_VARIANTE).length, 1, 'genau ein Bogen-Baum');
  assert.ok(liste.filter((b) => b.held).length === HELDEN.length);
  for (const b of liste) {
    assert.ok(b.skala >= 0.85 && b.skala <= 1.2);
    const radius = stammRadiusVon(b), d = pfadAbstand(b.x, b.z);
    // Engstellen gibt es bewusst keine am Stamm: auch Tor und Bogen lassen Stammradius + 2.5 m frei (eng wird es nur durch Wurzeln)
    assert.ok(d >= radius + 2.5, `Riese bei ${b.x.toFixed(0)}/${b.z.toFixed(0)} steht im Pfad (${d.toFixed(1)} m, Radius ${radius.toFixed(1)})`);
    assert.ok(b.z > 20, 'kein Riese im Wasser oder auf dem Strand');
    assert.ok(Math.hypot(b.x - LICHTUNG.x, b.z - LICHTUNG.z) > LICHTUNG.radius + radius, 'Lichtung bleibt frei');
    const sa = stammAbstand(b.x, b.z);
    assert.ok(sa.aussen > 0 || Math.abs(sa.quer) > STAMM.radius + radius, 'kein Riese im gestürzten Stamm');
  }
  for (let i = 0; i < liste.length; i++) for (let j = i + 1; j < liste.length; j++) {
    const a = liste[i], b = liste[j], d = Math.hypot(a.x - b.x, a.z - b.z);
    assert.ok(d > stammRadiusVon(a) + stammRadiusVon(b) + 4, `Riesen ${i} und ${j} stehen ineinander (${d.toFixed(1)} m)`);
  }
});

test('Tor der Alten: je ein Riese links und rechts des Pfads', () => {
  const tor = HELDEN.filter((b) => Math.abs(b.z - MARKEN.tor) < 6);
  assert.equal(tor.length, 2);
  const seiten = tor.map((b) => Math.sign(b.x - pfadX(b.z)));
  assert.notEqual(seiten[0], seiten[1]);
  for (const b of tor) assert.ok(pfadAbstand(b.x, b.z) < stammRadiusVon(b) + 7, 'Tor-Riesen stehen dicht am Pfad');
});

test('Determinismus: gleiche Liste bei gleichem Seed, andere bei anderem', () => {
  assert.deepEqual(riesenListe(), riesenListe());
  assert.deepEqual(riesenListe({ seed: 5 }), riesenListe({ seed: 5 }));
  assert.notDeepEqual(riesenListe({ seed: 5 }), riesenListe({ seed: 6 }));
});
