// Prüft die Tier-Regeln des Erde-Labors (labore/erde/js/tiere-regeln.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { rng } from '../engine/core/rng.js';
import { BIOM } from '../labore/erde/js/klima.js';
import { ZELLE, AKTIV, zellenUm, zellPunkt, wildWahl, entscheide, strahlTreffer, waffe, schlag, wiederDa, hudZeile } from '../labore/erde/js/tiere-regeln.js';

const R = 100_000;

test('Zellen: deterministisch, jeder Ort im Umkreis gehört zu genau einer gefundenen Zelle', () => {
  const r = rng(3);
  for (let k = 0; k < 40; k++) {
    // zufälliger Punkt auf der Kugel + ein Ort 0…AKTIV m daneben
    const d = [r() - 0.5, r() - 0.5, r() - 0.5], l = Math.hypot(...d);
    const p = { x: d[0] / l * R, y: d[1] / l * R, z: d[2] / l * R };
    const zellen = new Set(zellenUm(p, AKTIV).map((z) => z.join(',')));
    const q = [p.x + (r() - 0.5) * AKTIV, p.y + (r() - 0.5) * AKTIV, p.z + (r() - 0.5) * AKTIV], lq = Math.hypot(...q);
    const qq = q.map((v) => v / lq * R);
    if (Math.hypot(qq[0] - p.x, qq[1] - p.y, qq[2] - p.z) > AKTIV) continue;
    assert.ok(zellen.has(qq.map((v) => Math.floor(v / ZELLE)).join(',')));
  }
  // Rudelplatz: gleich bei gleichem Seed, liegt in seiner Zelle, anderer Seed → anderer Platz
  let gefunden = 0;
  for (let ix = 1560; ix < 1564; ix++) for (let iy = -2; iy < 2; iy++) for (let iz = -2; iz < 2; iz++) {
    const a = zellPunkt(ix, iy, iz, R, 7), b = zellPunkt(ix, iy, iz, R, 7);
    assert.deepEqual(a?.dir, b?.dir);
    if (!a) continue;
    gefunden++;
    assert.deepEqual(a.dir.map((v) => Math.floor(v * R / ZELLE)), [ix, iy, iz]);
    assert.notDeepEqual(zellPunkt(ix, iy, iz, R, 8)?.dir, a.dir);
  }
  assert.ok(gefunden > 3, 'zu wenige Rudelplätze: ' + gefunden);
});

test('Wild je Biom: Wald hat alle vier Arten, Wiese nur Hase/Reh, Wüste wenig, Wasser nichts', () => {
  const zaehle = (biom, wasser = false) => {
    const r = rng(11), n = {};
    for (let i = 0; i < 2000; i++) { const w = wildWahl(biom, r, wasser); if (w) n[w.art] = (n[w.art] || 0) + w.anzahl; }
    return n;
  };
  const wald = zaehle(BIOM.MISCHWALD);
  for (const a of ['reh', 'hase', 'keiler', 'wolf']) assert.ok(wald[a] > 50, a);
  const wiese = zaehle(BIOM.GRASLAND);
  assert.deepEqual(Object.keys(wiese).sort(), ['hase', 'reh']);
  assert.deepEqual(Object.keys(zaehle(BIOM.TUNDRA)).sort(), ['hase', 'wolf']);
  const wueste = Object.values(zaehle(BIOM.WUESTE)).reduce((s, v) => s + v, 0);
  assert.ok(wueste < Object.values(wald).reduce((s, v) => s + v, 0) / 6);
  assert.deepEqual(zaehle(BIOM.LAUBWALD, true), {});
});

test('Verhalten: Reh/Hase fliehen ab ihrem Abstand, Keiler greift nah an, Wolf tags scheu und nachts im Angriff', () => {
  assert.equal(entscheide('reh', { abstand: 20 }), 'fliehen');
  assert.equal(entscheide('reh', { abstand: 30 }), 'ruhe');
  assert.equal(entscheide('reh', { abstand: 40, modus: 'fliehen' }), 'fliehen');   // läuft weiter, bis weit genug weg
  assert.equal(entscheide('hase', { abstand: 10 }), 'fliehen');
  assert.equal(entscheide('hase', { abstand: 15 }), 'ruhe');
  assert.equal(entscheide('keiler', { abstand: 6 }), 'angriff');
  assert.equal(entscheide('keiler', { abstand: 12 }), 'ruhe');
  assert.equal(entscheide('keiler', { abstand: 6, leben: 0.2 }), 'fliehen');
  assert.equal(entscheide('wolf', { abstand: 20, nacht: false }), 'fliehen');
  assert.equal(entscheide('wolf', { abstand: 40, nacht: true }), 'angriff');
  assert.equal(entscheide('wolf', { abstand: 40, nacht: false, gereizt: true }), 'angriff');
});

test('Jagd: Blickstrahl trifft nur in Reichweite, Speer reicht weiter als Axt', () => {
  const o = { x: 0, y: 0, z: 0 }, d = { x: 0, y: 0, z: 1 };
  const reh = [{ x: 0.2, y: 0, z: 3.2, r: 0.4 }];
  const axt = waffe((id) => id === 'axt'), speer = waffe((id) => id === 'speer' || id === 'axt');
  assert.equal(strahlTreffer(o, d, reh, axt.reichweite)?.i, 0);
  assert.equal(strahlTreffer(o, d, [{ x: 0, y: 0, z: 4.2, r: 0.4 }], axt.reichweite), null);
  assert.equal(strahlTreffer(o, d, [{ x: 0, y: 0, z: 4.2, r: 0.4 }], speer.reichweite)?.i, 0);
  assert.equal(strahlTreffer(o, d, [{ x: 1, y: 0, z: 2, r: 0.4 }], 4), null);           // daneben
  assert.equal(strahlTreffer(o, d, [{ x: 0, y: 0, z: -2, r: 0.4 }], 4), null);          // hinter mir
  assert.equal(strahlTreffer(o, d, [{ x: 0, y: 0, z: 3, r: 0.3 }, { x: 0, y: 0, z: 1.5, r: 0.3 }], 4).i, 1); // nächstes zuerst
  assert.ok(speer.schaden > axt.schaden && axt.schaden > waffe(() => false).schaden);
});

test('Beute, Wiederkehr und HUD', () => {
  const h = schlag('hase', 1, 1);
  assert.ok(h.tot);
  assert.deepEqual(h.beute.map(([id]) => id).sort(), ['fell', 'fleisch']);
  const k = schlag('keiler', 6, 2);
  assert.ok(!k.tot && k.leben === 4 && k.beute.length === 0);
  const rehBeute = schlag('reh', 1, 3).beute;
  assert.ok(rehBeute.find(([id]) => id === 'fleisch')[1] > h.beute.find(([id]) => id === 'fleisch')[1]);
  assert.ok(!wiederDa(100, 105) && wiederDa(100, 112.5) && wiederDa(undefined, 0));
  assert.equal(hudZeile({ reh: 3, keiler: 1 }), 'Tiere: 3 Rehe, 1 Keiler in der Nähe');
  assert.equal(hudZeile({}), '');
});
