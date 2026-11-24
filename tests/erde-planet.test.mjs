// Prüft den Planeten des Erde-Labors (labore/erde): Würfel-Kugel, Quadtree, Kachelbau, Kachel-Strom.
import test from 'node:test';
import assert from 'node:assert/strict';
import { wuerfelZuKugel, waehleKacheln, schluessel } from '../labore/erde/js/planet-baum.js';
import { baueKachel } from '../labore/erde/js/kachel-bau.js';
import { createPlanetHoehe } from '../labore/erde/js/planet-hoehe.js';
import { createKachelStrom } from '../labore/erde/js/kachel-strom.js';
import { berechneGeologie } from '../labore/erde/js/geologie.js';
import { createGeoGitter } from '../labore/erde/js/geo-gitter.js';

const R = 100_000;
const G = createGeoGitter(96);                       // kleineres Gitter: schneller Test
const geo = berechneGeologie({ seed: 5, radius: R, G });

test('Würfel-Kugel: Punkte liegen auf der Einheitskugel, Kanten benachbarter Seiten treffen sich', () => {
  for (let f = 0; f < 6; f++) for (const [u, v] of [[0, 0], [1, 1], [-1, 0.3], [0.5, -1]]) {
    const d = wuerfelZuKugel(f, u, v);
    assert.ok(Math.abs(Math.hypot(...d) - 1) < 1e-9);
  }
  // Seite +X bei u = -1 (a = -Z → z = +1) ist dieselbe Kante wie Seite +Z bei u = +1
  const a = wuerfelZuKugel(0, -1, 0.4), b = wuerfelZuKugel(4, 1, 0.4);
  assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-12);
});

test('Quadtree: nah am Boden feine Kacheln, im All wenige grobe, die Kugel ist lückenlos bedeckt', () => {
  const nah = waehleKacheln([0, 0, R + 2], { R, maxStufe: 13 });
  const fern = waehleKacheln([0, 0, R + 900_000], { R, maxStufe: 13 });
  assert.equal(Math.max(...nah.map((k) => k.L)), 13);
  assert.ok(fern.length <= 12 && nah.length > 100);
  // Fläche (in Seiten-Anteilen) summiert sich zu genau 6 Würfelseiten
  const flaeche = nah.reduce((s, k) => s + 1 / 4 ** k.L, 0);
  assert.ok(Math.abs(flaeche - 6) < 1e-9);
});

test('Kachelbau: Nachbarkacheln gleicher Stufe teilen ihre Randpunkte exakt (keine Risse)', () => {
  const planet = createPlanetHoehe({ seed: 5, radius: R, geo, G });
  const k1 = { f: 4, L: 6, ix: 20, iy: 30 }, k2 = { f: 4, L: 6, ix: 21, iy: 30 };
  const a = baueKachel({ ...k1, key: schluessel(k1) }, planet, 8), b = baueKachel({ ...k2, key: schluessel(k2) }, planet, 8);
  for (let j = 0; j <= 8; j++) {
    const ia = (j * 9 + 8) * 3, ib = (j * 9) * 3; // rechter Rand von a = linker Rand von b
    for (let c = 0; c < 3; c++) {
      const pa = a.pos[ia + c] + a.mitte[c], pb = b.pos[ib + c] + b.mitte[c];
      assert.ok(Math.abs(pa - pb) < 0.05, `Abweichung ${pa - pb}`);
    }
  }
});

test('Geologie: gleicher Seed → gleiche Welt; Land und Meer vorhanden; jeder Fluss läuft bergab bis ins Meer', () => {
  const geo2 = berechneGeologie({ seed: 5, radius: R, G });
  assert.deepEqual(geo2.hoehe, geo.hoehe);
  assert.ok(geo.stat.land > 0.15 && geo.stat.land < 0.85, `Land ${geo.stat.land}`);
  let geprueft = 0;
  for (let c = 0; c < G.n && geprueft < 200; c += 37) {
    if (geo.hoehe[c] < 0 || geo.flaeche[c] < geo.amin) continue;
    geprueft++;
    let x = c, schritte = 0;
    while (geo.hoehe[x] >= 0) {
      const d = geo.ab[x];
      assert.ok(d >= 0, 'Landzelle ohne Abfluss');
      assert.ok(geo.spiegel[d] <= geo.spiegel[x] + 1e-6, 'Wasser fließt bergauf');
      x = d;
      assert.ok(++schritte < G.n, 'Kreis im Flussnetz');
    }
  }
  assert.ok(geprueft > 20);
});

test('Feine Höhe: im Flussbett steht Wasser über dem Boden, daneben ist trockenes Ufer', () => {
  const planet = createPlanetHoehe({ seed: 5, radius: R, geo, G });
  let c = -1;
  for (let i = 0; i < G.n; i++) if (geo.hoehe[i] > 20 && geo.flaeche[i] > 40 && geo.spiegel[i] <= geo.hoehe[i] + 1) { c = i; break; }
  assert.ok(c >= 0);
  let nass = 0, trocken = 0;
  const d = [G.dir[c * 3], G.dir[c * 3 + 1], G.dir[c * 3 + 2]];
  for (let s = -600; s <= 600; s += 3) for (const ax of [0, 1, 2]) {
    const q = [...d]; q[ax] += s / R; const l = Math.hypot(...q);
    const p = planet.probe(q[0] / l, q[1] / l, q[2] / l, 1);
    if (p.fluss) { nass++; assert.ok(p.wasser > p.h); } else trocken++;
  }
  assert.ok(nass > 0 && trocken > 0, `nass ${nass}, trocken ${trocken}`);
});

test('Kachel-Strom: beim Teilen bleibt die alte Kachel, bis alle Kinder fertig sind – nie Loch, nie doppelt', () => {
  const offen = [];
  const sichtbar = new Set();
  const strom = createKachelStrom({
    bauen: (k) => offen.push(k), erzeuge: (d) => d.key,
    zeige: (o, an) => (an ? sichtbar.add(o) : sichtbar.delete(o)), entsorge: () => {}, parallel: 10,
  });
  const mk = (f, L, ix, iy) => ({ f, L, ix, iy, key: schluessel({ f, L, ix, iy }), dist: 0 });
  const eltern = mk(0, 1, 0, 0);
  strom.update([eltern]);
  strom.fertigGebaut(offen.shift().key, { key: eltern.key });
  strom.update([eltern]);
  assert.deepEqual([...sichtbar], [eltern.key]);
  const kinder = [mk(0, 2, 0, 0), mk(0, 2, 1, 0), mk(0, 2, 0, 1), mk(0, 2, 1, 1)];
  strom.update(kinder);
  for (let i = 0; i < 3; i++) { const k = offen.shift(); strom.fertigGebaut(k.key, { key: k.key }); strom.update(kinder); }
  assert.deepEqual([...sichtbar], [eltern.key]);           // 3 von 4 fertig: noch die alte
  const k = offen.shift(); strom.fertigGebaut(k.key, { key: k.key }); strom.update(kinder);
  assert.equal(sichtbar.size, 4);
  assert.ok([...sichtbar].every((s) => kinder.some((c) => c.key === s)));
});

test('Klima und Gestein: kalt an den Polen, warm am Äquator; alle Gesteinsarten kommen vor', async () => {
  const { tempAm } = await import('../labore/erde/js/klima.js');
  let pol = 0, aeq = 0, np = 0, na = 0;
  const arten = new Set();
  for (let c = 0; c < G.n; c++) {
    const y = Math.abs(G.dir[c * 3 + 1]);
    const t = tempAm(geo.temp0[c], geo.hoehe[c]);
    if (y > 0.95) { pol += t; np++; } else if (y < 0.1) { aeq += t; na++; }
    if (geo.hoehe[c] >= 0) arten.add(geo.gestein[c]);
    assert.ok(geo.feuchte[c] >= 0 && geo.feuchte[c] <= 1);
  }
  assert.ok(pol / np < -5 && aeq / na > 15, `Pol ${pol / np}, Äquator ${aeq / na}`);
  assert.equal(arten.size, 5);
});

test('Küste: unter Meereshöhe ist nie trockenes Land (keine Mulden neben dem Meer)', () => {
  const planet = createPlanetHoehe({ seed: 5, radius: R, geo, G });
  let geprueft = 0;
  for (let c = 0; c < G.n; c += 7) {
    if (Math.abs(geo.hoehe[c]) > 30) continue; // Küstensaum
    const p = planet.probe(G.dir[c * 3], G.dir[c * 3 + 1], G.dir[c * 3 + 2], 1);
    geprueft++;
    if (p.h < 0) assert.ok(p.wasser >= 0, `trocken bei ${p.h} m`);
  }
  assert.ok(geprueft > 50);
});

test('Natur-Streuung: gleicher Seed → gleiche Natur; Bäume stehen auf Land, Seerosen/Fische im Wasser', async () => {
  const { streuKacheln, streueKachel, streuStufe, STREU_ARTEN, STRIDE } = await import('../labore/erde/js/natur-streu.js');
  const planet = createPlanetHoehe({ seed: 5, radius: R, geo, G });
  let c = -1; // Landzelle mit Fluss in der Nähe
  for (let i = 0; i < G.n; i++) if (geo.hoehe[i] > 30 && geo.hoehe[i] < 600 && geo.flaeche[i] > 20) { c = i; break; }
  const d = [G.dir[c * 3], G.dir[c * 3 + 1], G.dir[c * 3 + 2]];
  const ks = streuKacheln(d.map((v) => v * (R + 100)), R, streuStufe(R), 200);
  assert.ok(ks.length > 10);
  const a = streueKachel(ks[0], planet), b = streueKachel(ks[0], planet);
  assert.deepEqual(a.daten, b.daten);
  let stueck = 0;
  for (const k of ks.slice(0, 12)) {
    const s = streueKachel(k, planet);
    for (let i = 0; i < s.anzahl; i++, stueck++) {
      const o = i * STRIDE, art = STREU_ARTEN[s.daten[o]];
      const x = s.mitte[0] + s.daten[o + 1], y = s.mitte[1] + s.daten[o + 2], z = s.mitte[2] + s.daten[o + 3];
      const l = Math.hypot(x, y, z), p = planet.probe(x / l, y / l, z / l, 2);
      if (['fichte', 'birke', 'eiche', 'buche', 'kiefer', 'tanne', 'tropenbaum', 'palme', 'akazie'].includes(art)) assert.ok(p.wasser < p.h + 0.05, 'Baum im Wasser');
      if (art === 'seerose' || art === 'forelle' || art === 'barsch') assert.ok(p.wasser > p.h && !p.meer, art + ' auf dem Trockenen');
    }
  }
  assert.ok(stueck > 0);
});
