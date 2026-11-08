import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, PRESETS, hashArrays, FLAG, createPathfinder, biomId, transferierbar, mitAbfragen } from './worldgen.js';

const KLEIN = { breite: 96, tiefe: 96 };
const weltHash = w => hashArrays(w.hoehe, w.wasserstand, w.flags, w.biom, w.temperatur, w.feuchte, w.objekte.x, w.objekte.y, w.objekte.typ);

test('gleicher Seed → identische Welt, anderer Seed → andere Welt', () => {
  const a = createWorld({ seed: 11, ...KLEIN }), b = createWorld({ seed: 11, ...KLEIN }), c = createWorld({ seed: 12, ...KLEIN });
  assert.equal(weltHash(a), weltHash(b));
  assert.notEqual(weltHash(a), weltHash(c));
  assert.deepEqual(a.orte, b.orte);
});

test('jedes Preset erzeugt eine gültige Welt (kein NaN, gültige Biome, Wasser konsistent)', () => {
  for (const preset of Object.keys(PRESETS)) {
    const w = createWorld({ preset, seed: 3, ...KLEIN });
    const n = w.breite * w.tiefe;
    for (const k of ['hoehe', 'wasserstand', 'temperatur', 'feuchte', 'hang', 'wasserDistanz', 'meerDistanz', 'flussBreite', 'abfluss']) {
      const arr = w[k];
      assert.equal(arr.length, n, `${preset}.${k} Länge`);
      for (let i = 0; i < n; i++) assert.ok(Number.isFinite(arr[i]), `${preset}.${k}[${i}] = ${arr[i]}`);
    }
    let land = 0;
    for (let i = 0; i < n; i++) {
      assert.ok(w.biom[i] < w.biome.length, `${preset}: Biom-Id ${w.biom[i]} ungültig`);
      if (w.flags[i] & (FLAG.SEE | FLAG.FLUSS)) assert.ok(w.wasserstand[i] >= w.hoehe[i] - 1e-6, `${preset}: Wasserstand unter Boden`);
      if (!(w.flags[i] & 7)) land++;
    }
    assert.ok(land > n * 0.1, `${preset}: zu wenig Land (${land})`);
    for (const t of ['x', 'y', 'skala', 'drehung']) for (const v of w.objekte[t]) assert.ok(Number.isFinite(v));
    assert.ok(w.objekte.anzahl > 0, `${preset}: keine Objekte`);
  }
});

test('Flüsse fließen ins Meer oder in einen See (Insel)', () => {
  const w = createWorld({ preset: 'insel', seed: 5, breite: 160, tiefe: 160 });
  const { breite: b, tiefe: t, ziel, flags } = w;
  assert.ok(w.fluesse.length > 0, 'keine Flüsse');
  for (let i = 0; i < b * t; i++) {
    if (!(flags[i] & FLAG.FLUSS) || w.abfluss[i] < w.flussSchwelle) continue;
    let j = i, schritte = 0;
    while (ziel[j] >= 0 && !(flags[j] & (FLAG.OZEAN | FLAG.SEE))) { j = ziel[j]; assert.ok(++schritte < b * t, 'Kreislauf im Abfluss'); }
    assert.ok(flags[j] & (FLAG.OZEAN | FLAG.SEE), `Fluss bei ${i} endet nicht in Meer/See`);
  }
  for (const f of w.fluesse) {
    assert.ok(['meer', 'see', 'fluss'].includes(f.muendung), `Mündung ${f.muendung}`);
    assert.equal(f.punkte.length / 2, f.breite.length);
  }
});

test('Abfragen: Höhe, Normale, Wasser, Biom', () => {
  const w = createWorld({ seed: 8, ...KLEIN, zelle: 2 });
  assert.equal(w.heightAt(10 * 2, 20 * 2), w.hoehe[20 * w.breite + 10]);
  const nrm = w.normalAt(50, 60);
  assert.ok(Math.abs(Math.hypot(nrm[0], nrm[1], nrm[2]) - 1) < 1e-6 && nrm[1] > 0);
  assert.equal(w.isWater(0, 0), true, 'Inselrand ist Meer');
  assert.ok(w.biomeAt(0, 0) === biomId(w, 'tiefsee') || w.biomeAt(0, 0) === biomId(w, 'meer'));
  assert.ok(w.slopeAt(80, 80) >= 0);
});

test('Wegsuche meidet Wasser', () => {
  const w = createWorld({ seed: 4, breite: 128, tiefe: 128 });
  const pf = createPathfinder(w, { hangKosten: 10 });
  const s = w.orte.start;
  assert.ok(s, 'Startplatz fehlt');
  let ziel = null;
  for (let i = w.breite * w.tiefe - 1; i >= 0 && !ziel; i -= 7) if (!(w.flags[i] & 7) && w.hoehe[i] > 0.05) ziel = [i % w.breite, (i / w.breite) | 0];
  const weg = pf.finde(s.x, s.y, ziel[0], ziel[1]);
  if (weg) for (let k = 0; k < weg.length; k += 2) assert.equal(w.isWater(weg[k], weg[k + 1]) && !(w.flags[weg[k + 1] * w.breite + weg[k]] & FLAG.FLUSS), false);
  assert.equal(pf.finde(s.x, s.y, 0, 0), null, 'Ziel im Meer muss null liefern');
});

test('Spiele können Stufen und Biome ergänzen', () => {
  let gesehen = 0;
  const w = createWorld({
    seed: 2, ...KLEIN,
    biome: { extra: [{ key: 'kristallfeld', name: 'Kristallfeld', farbe: 0x88ccff, regel: { prio: 90, hoehe: [0.3, 99] } }] },
    stufen: [{ name: 'zaehlen', nach: 'biome', run(welt) { gesehen = welt.biom.length; } }],
    ohne: ['objekte'],
  });
  assert.equal(gesehen, 96 * 96);
  assert.equal(biomId(w, 'kristallfeld'), 19);
  assert.equal(w.objekte, null);
  assert.ok('zaehlen' in w.zeiten && !('objekte' in w.zeiten));
});

test('transferierbar → mitAbfragen (Worker-Weg)', () => {
  const w = createWorld({ seed: 6, ...KLEIN });
  const { daten, puffer } = transferierbar(w);
  assert.ok(puffer.length > 5 && puffer.every(p => p instanceof ArrayBuffer));
  const kopie = mitAbfragen(structuredClone(daten));
  assert.equal(kopie.heightAt(30.5, 40.25), w.heightAt(30.5, 40.25));
});

test('Leistung: 256² Insel mit Erosion + Flüssen in vertretbarer Zeit', () => {
  createWorld({ seed: 1, breite: 128, tiefe: 128 }); // aufwärmen
  const w = createWorld({ seed: 1, breite: 256, tiefe: 256 });
  assert.ok(w.zeiten.gesamt < 2000, `zu langsam: ${w.zeiten.gesamt} ms`);
});

// Schnappschuss: ändert sich nur bei absichtlichen Generator-Änderungen → dann Hash hier bewusst aktualisieren.
test('Schnappschuss 64² Insel (Seed 2024)', () => {
  const w = createWorld({ seed: 2024, breite: 64, tiefe: 64 });
  assert.equal(hashArrays(w.hoehe, w.flags, w.biom), 'c4f1dc6b');
});
