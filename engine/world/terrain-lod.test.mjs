import test from 'node:test';
import assert from 'node:assert/strict';
import { kachelIndizes, vertexAnzahl, dreieckAnzahl, waehleLod, abstandZuRechteck, planeKacheln, abarbeiten, kachelSchluessel } from './terrain-lod.js';

// Vertex-Positionen wie fuelleKachel: Gitter (i, 0, j), Skirts eine Einheit tiefer
function positionen(seg) {
  const n = seg + 1, p = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) p.push([i, 0, j]);
  const kanten = [(q) => [q, 0], (q) => [q, seg], (q) => [0, q], (q) => [seg, q]];
  for (const k of kanten) for (let q = 0; q < n; q++) { const [i, j] = k(q); p.push([i, -1, j]); }
  return p;
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const kreuz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

test('Index-Puffer: Anzahl, Bereich, Boden nach oben, Skirts nach außen', () => {
  for (const seg of [4, 8, 16, 32]) {
    const idx = kachelIndizes(seg), p = positionen(seg), mitte = [seg / 2, 0, seg / 2];
    assert.equal(idx.length, dreieckAnzahl(seg) * 3);
    assert.equal(p.length, vertexAnzahl(seg));
    assert.ok(idx instanceof Uint16Array);
    let oben = 0, aussen = 0;
    for (let t = 0; t < idx.length; t += 3) {
      for (let k = 0; k < 3; k++) assert.ok(idx[t + k] < p.length);
      const a = p[idx[t]], b = p[idx[t + 1]], c = p[idx[t + 2]], n = kreuz(sub(b, a), sub(c, a));
      const flaeche = Math.hypot(...n);
      assert.ok(flaeche > 0, 'kein entartetes Dreieck');
      if (n[1] > 0) { oben++; continue; }
      // Skirt: Normale zeigt von der Kachelmitte weg
      const s = [(a[0] + b[0] + c[0]) / 3, 0, (a[2] + b[2] + c[2]) / 3], raus = sub(s, mitte);
      assert.ok(n[0] * raus[0] + n[2] * raus[2] > 0, `Skirt-Dreieck ${t / 3} zeigt nach innen`);
      aussen++;
    }
    assert.equal(oben, 2 * seg * seg);
    assert.equal(aussen, 8 * seg);
  }
});

test('LOD-Wahl mit Hysterese', () => {
  const st = [100, 200, 400];
  assert.deepEqual([0, 99, 100, 250, 1000].map(d => waehleLod(d, st)), [0, 0, 1, 2, 3]);
  // knapp über der Grenze: alte LOD bleibt, deutlich darüber: Wechsel
  assert.equal(waehleLod(105, st, 0), 0);
  assert.equal(waehleLod(115, st, 0), 1);
  assert.equal(waehleLod(95, st, 1), 1);
  assert.equal(waehleLod(85, st, 1), 0);
  assert.equal(waehleLod(1000, st, 0), 3);
});

test('Abstand zum Rechteck', () => {
  assert.equal(abstandZuRechteck(5, 5, 0, 0, 10, 10), 0);
  assert.equal(abstandZuRechteck(-3, 5, 0, 0, 10, 10), 3);
  assert.equal(abstandZuRechteck(13, 14, 0, 0, 10, 10), 5);
});

test('Planung: Kreis um die Kamera, Bereich, Reihenfolge, Entfernen', () => {
  const p = { kamX: 32, kamZ: 32, kachelMeter: 64, sichtweite: 300, stufen: [80, 160, 240], objektWeite: 80 };
  const a = planeKacheln(p);
  assert.ok(a.soll.size > 20);
  for (const s of a.soll.values()) assert.ok(s.abstand <= 300);
  assert.equal(a.soll.get(kachelSchluessel(0, 0)).lod, 0);
  assert.ok(a.soll.get(kachelSchluessel(0, 0)).objekte);
  assert.ok(!a.soll.get(kachelSchluessel(3, 0)).objekte);
  assert.equal(a.auftraege.length, a.soll.size);
  for (let i = 1; i < a.auftraege.length; i++) assert.ok(a.auftraege[i].prio >= a.auftraege[i - 1].prio);
  assert.equal(a.auftraege[0].kx, 0);
  // alles vorhanden → keine Aufträge; Kamera weit weg → alles entfernen
  const vorhanden = new Map([...a.soll].map(([k, s]) => [k, { lod: s.lod }]));
  assert.equal(planeKacheln({ ...p, vorhanden }).auftraege.length, 0);
  const weg = planeKacheln({ ...p, vorhanden, kamX: 5000 });
  assert.equal(weg.entfernen.length, vorhanden.size);
  // endlicher Bereich
  const b = planeKacheln({ ...p, bereich: { kx0: 0, ky0: 0, kx1: 1, ky1: 1 } });
  assert.equal(b.soll.size, 4);
  // unsichtbare Kacheln kommen später
  const c = planeKacheln({ ...p, sichtbar: (kx) => kx >= 0 });
  const ersteUnsichtbar = c.auftraege.findIndex(x => x.kx < 0);
  assert.ok(c.auftraege.slice(ersteUnsichtbar).some(x => x.kx < 0) && c.auftraege[0].kx >= 0);
});

test('Warteschlange: Budget, Mindestanzahl, teure Aufträge', () => {
  let t = 0;
  const uhr = () => t;
  const liste = Array.from({ length: 10 }, (_, i) => ({ i, teuer: i === 1 || i === 2 }));
  const fertig = [];
  const n = abarbeiten(liste, (a) => { fertig.push(a.i); t += 1; }, { budgetMs: 4, uhr });
  assert.equal(n, 4);
  assert.deepEqual(fertig, [0, 1, 3, 4]);           // 2 übersprungen (nur 1 teurer je Aufruf)
  assert.deepEqual(liste.map(a => a.i), [2, 5, 6, 7, 8, 9]);
  t = 0;
  assert.equal(abarbeiten(liste, () => { t += 100; }, { budgetMs: 4, uhr }), 1);   // mindestens einer
  assert.equal(abarbeiten([], () => {}, { uhr }), 0);
});
