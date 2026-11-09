import test from 'node:test';
import assert from 'node:assert/strict';
import { planeNetz } from './worldgen-wege.js';
import { createWorld, FLAG, hashArrays } from './worldgen.js';

const BASIS = { preset: 'kontinent', seed: 11, breite: 160, tiefe: 160, qualitaet: 'schnell' };
const zelle = (w, x, y) => Math.round(y / w.zelle) * w.breite + Math.round(x / w.zelle);

test('planeNetz: Spannbaum verbindet alle Knoten, Schleifen nur bei großem Umweg', () => {
  const k = [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 4, y: 0 }];
  const baum = planeNetz(k, 0);
  assert.equal(baum.length, k.length - 1);
  const gruppe = k.map((_, i) => i), finde = i => (gruppe[i] === i ? i : (gruppe[i] = finde(gruppe[i])));
  for (const [a, b] of baum) gruppe[finde(a)] = finde(b);
  assert.equal(new Set(k.map((_, i) => finde(i))).size, 1, 'Baum nicht zusammenhängend');
  const linie = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }];
  assert.equal(planeNetz(linie, 3).length, 2, 'auf einer Linie gibt es keine lohnende Abkürzung');
  const ring = Array.from({ length: 6 }, (_, i) => ({ x: Math.cos(i * Math.PI / 3) * 10, y: Math.sin(i * Math.PI / 3) * 10 }));
  assert.equal(planeNetz(ring, 0).length, 5);
  assert.equal(planeNetz(ring, 1).length, 6, 'Ring wird geschlossen');
  assert.deepEqual(planeNetz([{ x: 1, y: 1 }], 2), []);
});

test('Wege: standardmäßig aus – Welt bleibt unverändert', () => {
  const ohne = createWorld(BASIS), aus = createWorld({ ...BASIS, wege: { aktiv: false } });
  assert.deepEqual(ohne.wege, []);
  assert.equal(hashArrays(ohne.flags, ohne.hoehe, ohne.objekte.x), hashArrays(aus.flags, aus.hoehe, aus.objekte.x));
  for (let i = 0; i < ohne.flags.length; i++) assert.ok(!(ohne.flags[i] & FLAG.WEG));
});

const welt = createWorld({ ...BASIS, wege: { aktiv: true } });

test('Wege: verbinden Start und Dörfer, laufen nie durch Meer oder See', () => {
  assert.ok(welt.orte.doerfer.length >= 2, 'Testwelt braucht Dörfer');
  assert.ok(welt.wege.length >= 1, 'keine Wege');
  const K = welt.wegKnoten;
  assert.equal(K.length, 1 + welt.orte.doerfer.length);
  for (const w of welt.wege) {
    const p = w.punkte, n = p.length / 2;
    assert.ok(n >= 2 && w.laenge > 0);
    assert.ok(Math.hypot(p[0] - K[w.von].x, p[1] - K[w.von].y) <= welt.zelle * 1.01, 'Weg beginnt nicht am Knoten');
    assert.ok(Math.hypot(p[2 * n - 2] - K[w.nach].x, p[2 * n - 1] - K[w.nach].y) <= welt.zelle * 1.01, 'Weg endet nicht am Knoten');
  }
  let wegZellen = 0;
  for (let i = 0; i < welt.flags.length; i++) {
    const f = welt.flags[i];
    if (!(f & FLAG.WEG)) continue;
    wegZellen++;
    assert.ok(!(f & (FLAG.OZEAN | FLAG.SEE)), 'Weg im Meer oder See');
  }
  assert.ok(wegZellen > 20);
});

test('Wege: keine Objekte auf Wegzellen, Brücken liegen auf Flusszellen', () => {
  const o = welt.objekte;
  for (let i = 0; i < o.anzahl; i++) {
    const f = welt.flags[zelle(welt, o.x[i], o.y[i])];
    assert.ok(!(f & FLAG.WEG) || f & FLAG.FLUSS, `Objekt ${o.arten[o.art[i]]} steht auf dem Weg`);
  }
  for (const w of welt.wege) for (const br of w.bruecken) {
    assert.ok(welt.flags[zelle(welt, br.x, br.y)] & FLAG.FLUSS, 'Brücke nicht über einem Fluss');
    assert.ok(br.laenge >= welt.zelle);
  }
});

test('Wege: deterministisch, Rabatt bündelt Strecken, POI lassen sich anbinden', () => {
  const nochmal = createWorld({ ...BASIS, wege: { aktiv: true } });
  assert.equal(hashArrays(welt.flags, ...welt.wege.map(w => w.punkte)), hashArrays(nochmal.flags, ...nochmal.wege.map(w => w.punkte)));
  const zaehle = w => { let n = 0; for (const f of w.flags) if (f & FLAG.WEG) n++; return n; };
  const einzeln = createWorld({ ...BASIS, wege: { aktiv: true, rabatt: 1 } });
  assert.ok(zaehle(welt) <= zaehle(einzeln), 'mit Rabatt sollten nicht mehr Wegzellen entstehen');
  const mitGipfel = createWorld({ ...BASIS, wege: { aktiv: true, poi: ['gipfel'] } });
  const gipfel = mitGipfel.orte.poi.filter(p => p.art === 'gipfel').length;
  assert.equal(mitGipfel.wegKnoten.length, welt.wegKnoten.length + gipfel);
});
