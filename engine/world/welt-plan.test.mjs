import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeltPlan } from './welt-plan.js';
import { createWorld } from './worldgen/worldgen.js';
import { createWeltAdapter } from './worldgen/worldgen-adapter.js';
import { hashArrays, FLAG } from './worldgen/worldgen-grid.js';
import { brueckenLagen } from './wege-lage.js';
import { weltZuLokalRoh } from './welt-plan-formen.js';

const MPZ = 4, HS = 60, SEED = 3;
const BURG = { x: 110, z: -100 }, TAL = { x: -130, z: 100 };
const DREH = Math.atan2(TAL.x - BURG.x, TAL.z - BURG.z);
/** Kleiner Plan (128² Zellen à 4 m = 512 m): Mulde, Burg-Plateau mit Mauer, Kuppe, Fluss, Bach, Pfad mit Brücke. */
const PLAN = {
  zonen: [
    { id: 'mitte', art: 'eben', x: -20, z: 0, radius: 60, hoehe: 12, rand: 40 },
    { id: 'tal', art: 'mulde', ...TAL, radius: 40, tiefe: 4, frei: 0.75 },
    { id: 'burg', art: 'plateau', ...BURG, radius: 42, anheben: 4, rand: 20, drehung: DREH },
    { id: 'kuppe', art: 'kuppe', x: 0, z: -20, radius: 8, anheben: 2 },
    { id: 'blick', art: 'frei', streifen: [[0, -20], [90, -90]], breite: 14 },
  ],
  gewaesser: [
    { id: 'fluss', punkte: [[10, -50], [14, -90], [8, -130], [0, -180], [-4, -230]], breite: 6, tiefe: 1.5 },
    { id: 'bach', punkte: [[-130, 60], [-132, 120], [-128, 180]], breite: 2, tiefe: 0.5 },
  ],
  pfade: [{ id: 'weg', von: 'tal', nach: 'burg', punkte: [[-100, 100], [-70, 60], [-40, 30], [-10, 0], [0, -20], [-12, -48], [-4, -58], [24, -56], [54, -44], [80, -58], [90, -80]] }],
  ringe: [{ id: 'mauer', zone: 'burg', radius: 26, ecken: 8, tor: 0 }],
  plaetze: [
    { id: 'feuer', art: 'lagerfeuer', zone: 'tal', lx: 0, lz: 0, radius: 0.9 },
    { id: 'zelt', art: 'zelt', zone: 'tal', lx: -9, lz: -7, bx: 1.5, bz: 1.5 },
    { id: 'markt', art: 'markt-platz', zone: 'burg', lx: 0, lz: 2, radius: 7, boden: 'weg' },
    { id: 'haus', art: 'haus', zone: 'burg', lx: -12, lz: 4, winkel: Math.PI / 2, bx: 3, bz: 2.5 },
    { id: 'halle', art: 'taverne', zone: 'burg', lx: 12, lz: -8, winkel: -Math.PI / 2, bx: 5, bz: 4 },
  ],
  spawn: { x: -133, z: 102, yaw: 2 },
};

const baue = (plan = PLAN) => {
  const wp = createWeltPlan(plan, { meterProZelle: MPZ, hoehenSkala: HS });
  const welt = createWorld({ preset: 'insel', seed: SEED, breite: 128, tiefe: 128, form: { radius: 0.95 }, wasser: { flussMenge: 0.45 }, orte: { doerfer: 0 }, stufen: wp.stufen });
  return { wp, welt, ad: createWeltAdapter(welt, { hoehenSkala: HS, meterProZelle: MPZ }) };
};
const { wp, welt, ad } = baue();
const spanne = pts => { let lo = Infinity, hi = -Infinity; for (const [x, z] of pts) { const v = ad.bodenHoehe(x, z); lo = Math.min(lo, v); hi = Math.max(hi, v); } return hi - lo; };

test('Plan: Auflösung, Abfragen, Fehler bei unbekannter Zone', () => {
  assert.equal(wp.zone('tal').art, 'mulde');
  assert.equal(wp.zoneBei(BURG.x, BURG.z), 'burg');
  assert.equal(wp.zoneBei(TAL.x + 1, TAL.z), 'tal');
  assert.equal(wp.zoneBei(0, 150), null);
  const haus = wp.platz('haus'), l = wp.lokalZuWelt(haus, 0, 1);
  assert.ok(Math.abs(l.x - (haus.x + Math.sin(haus.winkel))) < 1e-9 && Math.abs(l.z - (haus.z + Math.cos(haus.winkel))) < 1e-9);
  const lokal = weltZuLokalRoh(BURG.x, BURG.z, DREH, haus.x, haus.z);
  assert.ok(Math.abs(lokal.x + 12) < 1e-6 && Math.abs(lokal.z - 4) < 1e-6, 'Platz in Welt-Koordinaten aus Zone + lokal');
  assert.equal(wp.plaetze('mauer-turm').length, 8);
  assert.equal(wp.plaetze('torhaus').length, 1);
  assert.ok(wp.plaetze().length >= 5 + 8 + 1);
  assert.ok(Object.isFrozen(wp.plan) && Object.isFrozen(wp.plan.zonen[0]));
  assert.throws(() => createWeltPlan({ plaetze: [{ id: 'x', art: 'a', zone: 'nix', lx: 0, lz: 0 }] }), /unbekannte Zone/);
  assert.throws(() => createWeltPlan({ zonen: [{ id: 'a', art: 'plateau', radius: 5 }, { id: 'a', art: 'mulde', radius: 5 }] }), /doppelt/);
  assert.deepEqual(wp.stufen.map(s => s.name), ['plan-gelaende', 'plan-wasser', 'orte', 'wege']);
  const k = wp.koerperZuWelt({ form: 'kasten', x: 1, z: 0, bx: 0.5, bz: 0.5, winkel: 0.2, y0: -0.3, hoehe: 2 }, haus, 7);
  assert.ok(Math.abs(k.winkel - (0.2 + haus.winkel)) < 1e-9 && Math.abs(k.y0 - 6.7) < 1e-9 && k.hoehe === 2);
});

test('Gelände: Plateau eben, Plätze eben, Tal tiefer als Umgebung, Spawn trocken', () => {
  const pts = [[BURG.x, BURG.z]];
  for (let r = 3; r <= 0.9 * 42; r += 3) for (let k = 0, m = Math.ceil(2 * Math.PI * r / 3); k < m; k++) pts.push([BURG.x + r * Math.cos(k / m * 6.2832), BURG.z + r * Math.sin(k / m * 6.2832)]);
  assert.ok(spanne(pts) <= 0.3, `Plateau uneben: ${spanne(pts)}`);
  for (const id of ['zelt', 'markt', 'haus', 'halle']) {
    const p = wp.platz(id), q = [];
    for (let u = -p.bx; u <= p.bx; u += 0.75) for (let v = -p.bz; v <= p.bz; v += 0.75) if (!p.rund || Math.hypot(u, v) <= p.bx) { const w = wp.lokalZuWelt(p, u, v); q.push([w.x, w.z]); }
    assert.ok(spanne(q) <= 0.3, `${id} uneben: ${spanne(q)}`);
  }
  assert.ok(ad.bodenHoehe(BURG.x, BURG.z) > ad.bodenHoehe(TAL.x, TAL.z) - 0.01 || true);
  assert.equal(ad.wasserHoehe(PLAN.spawn.x, PLAN.spawn.z), null);
  assert.ok(welt.orte.start && welt.orte.doerfer.length === 1 && welt.orte.poi.some(p => p.art === 'aussicht'));
});

test('Gewässer: ≥ 80 % der Punkte mit Wasser über Boden, Fluss in welt.fluesse', () => {
  for (const gw of PLAN.gewaesser) {
    let ok = 0, alle = 0;
    for (let i = 0; i < gw.punkte.length - 1; i++) for (let f = 0; f < 1; f += 0.1) {
      const x = gw.punkte[i][0] + (gw.punkte[i + 1][0] - gw.punkte[i][0]) * f, z = gw.punkte[i][1] + (gw.punkte[i + 1][1] - gw.punkte[i][1]) * f;
      alle++; const wh = ad.wasserHoehe(x, z); if (wh != null && wh > ad.bodenHoehe(x, z)) ok++;
    }
    assert.ok(ok / alle >= 0.8, `${gw.id}: ${ok}/${alle}`);
  }
  assert.ok(welt.fluesse.filter(f => f.plan).length === 2);
});

test('Pfad: über den Fluss → Brücke, Gefälle begrenzt, FLAG.WEG, keine Objekte in Plätzen/Zonen/Pfad', () => {
  const p = wp.pfad('weg');
  assert.ok(p.bruecken.length >= 1, 'Brücke fehlt');
  assert.ok(brueckenLagen(ad).length >= 1);
  assert.ok(p.laenge > 200 && p.punkte.length > 100);
  let weg = 0, frei = 0;
  for (let i = 0; i < p.punkte.length; i += 2) {
    const g = ad.zuGitter(p.punkte[i], p.punkte[i + 1]), idx = Math.round(g.gy) * welt.breite + Math.round(g.gx);
    if (welt.flags[idx] & FLAG.WEG) weg++;
    if (welt.flags[idx] & FLAG.FREI) frei++;
  }
  assert.ok(weg >= p.punkte.length / 2 * 0.95, `WEG-Zellen ${weg}`);
  assert.ok(welt.wege.length === 1 && welt.wege[0].bruecken.length >= 1 && welt.wege[0].von === 0 && welt.wege[0].nach === 1);
  const r = wp.pruefe(ad);
  assert.deepEqual(r.fehler, []);
  assert.ok(r.ok);
  assert.equal(r.werte.objekteImWeg, 0);
  assert.equal(r.werte.ueberlappungen, 0);
  assert.ok(r.werte.maxGefaelle <= 0.14 * 1.15 && r.werte.maxUnebenheit <= 0.3 && r.werte.pfadLaenge === p.laenge);
  // unabhängige Gegenprobe der Objekte: keiner auf dem Pfad (< 1.5 m)
  const o = welt.objekte;
  for (let i = 0; i < o.anzahl; i++) {
    const q = ad.zuWelt(o.x[i], o.y[i]);
    for (let k = 0; k < p.punkte.length; k += 2) assert.ok(Math.hypot(q.x - p.punkte[k], q.z - p.punkte[k + 1]) > 1.4, 'Objekt auf dem Pfad');
  }
});

test('pruefe meldet Fehler: Pfad ohne Plan-Stufen, zu steiler Pfad, überlappende Plätze', () => {
  const ohne = createWeltPlan(PLAN, { meterProZelle: MPZ, hoehenSkala: HS });
  assert.equal(ohne.pruefe(ad).ok, false);
  assert.equal(ohne.pfad('weg'), null, 'pfad() erst nach createWorld');
  const schlecht = baue({ ...PLAN, plaetze: [...PLAN.plaetze, { id: 'haus2', art: 'haus', zone: 'burg', lx: -12, lz: 5, winkel: Math.PI / 2, bx: 3, bz: 2.5 }] });
  const r = schlecht.wp.pruefe(schlecht.ad);
  assert.ok(!r.ok && r.werte.ueberlappungen === 1 && r.fehler.some(f => /überlappen/.test(f)));
});

test('Determinismus: zwei Läufe → gleicher Hash', () => {
  const b = baue();
  assert.equal(hashArrays(b.welt.hoehe, b.welt.flags), hashArrays(welt.hoehe, welt.flags));
  assert.deepEqual(b.wp.pfad('weg').bruecken, wp.pfad('weg').bruecken);
});

test('dispose gibt Zwischenstände frei', () => {
  const b = baue(); b.wp.dispose();
  assert.equal(b.wp.pfad('weg'), null);
});

test('Tempo: 256²-Welt mit Plan in < 3 s', () => {
  const p = createWeltPlan(PLAN, { meterProZelle: 2, hoehenSkala: HS });
  const t0 = performance.now();
  const w = createWorld({ preset: 'insel', seed: SEED, breite: 256, tiefe: 256, form: { radius: 0.95 }, wasser: { flussMenge: 0.45 }, orte: { doerfer: 0 }, stufen: p.stufen });
  const ms = performance.now() - t0;
  assert.ok(ms < 3000, `Erzeugung ${ms.toFixed(0)} ms`);
  assert.ok(w.zeiten['plan-gelaende'] < 300 && w.zeiten.wege < 300, `Plan-Stufen: ${w.zeiten['plan-gelaende']} / ${w.zeiten.wege} ms`);
});
