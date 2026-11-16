import test from 'node:test';
import assert from 'node:assert/strict';
import { ringPlaetze, profil, kurve, lokalZuWeltRoh, weltZuLokalRoh, naechstePunkte, inBox, boxenSchneiden, abstandStrecke } from './welt-plan-formen.js';

const ZONE = { x: 150, z: -137, drehung: -0.847 };
const RING = { id: 'mauer', radius: 36, ecken: 8, tor: 0, segment: 6, turm: 4.5, torBreite: 9 };

test('lokalZuWeltRoh: lokal (0,1) → Mitte + (sin w, cos w); Umkehrung stimmt', () => {
  for (const w of [0, 0.7, -2.1, 3]) {
    const p = lokalZuWeltRoh(10, 20, w, 0, 1);
    assert.ok(Math.abs(p.x - (10 + Math.sin(w))) < 1e-9 && Math.abs(p.z - (20 + Math.cos(w))) < 1e-9);
    const q = weltZuLokalRoh(10, 20, w, ...Object.values(lokalZuWeltRoh(10, 20, w, 3.5, -2)));
    assert.ok(Math.abs(q.x - 3.5) < 1e-9 && Math.abs(q.z + 2) < 1e-9);
  }
});

test('ringPlaetze: 8 Türme, Torhaus an lokal +z, Segmente füllen jede Seite lückenlos', () => {
  const plaetze = ringPlaetze(RING, ZONE);
  const tuerme = plaetze.filter(p => p.art === 'mauer-turm'), tor = plaetze.filter(p => p.art === 'torhaus'), segs = plaetze.filter(p => p.art === 'mauer');
  assert.equal(tuerme.length, 8);
  assert.equal(tor.length, 1);
  const l = weltZuLokalRoh(ZONE.x, ZONE.z, ZONE.drehung, tor[0].x, tor[0].z);
  assert.ok(Math.abs(l.x) < 1e-6 && Math.abs(l.z - 36 * Math.cos(Math.PI / 8)) < 1e-6, `Torhaus lokal ${l.x}, ${l.z}`);
  const seite = 2 * 36 * Math.sin(Math.PI / 8);
  // je Seite: Segmentbreiten + Turm-Hälften (+ Torbreite) = Seitenlänge
  const proSeite = new Map();
  for (const s of segs) { const k = s.id.split('-')[2]; proSeite.set(k, (proSeite.get(k) || 0) + 2 * s.bx); }
  assert.equal(proSeite.size, 8);
  for (const [k, summe] of proSeite) assert.ok(Math.abs(summe + 4.5 + (k === '0' ? 9 : 0) - seite) < 0.2, `Seite ${k}: ${summe}`);
  for (const s of segs) assert.ok(s.bx * 2 >= 3 && s.bx * 2 <= 9, 'Segmentbreite plausibel');
});

test('ringPlaetze: Fronten zeigen nach außen, Segmente liegen auf dem Umkreis', () => {
  for (const tor of [0, 3]) {
    const plaetze = ringPlaetze({ ...RING, tor }, ZONE);
    for (const p of plaetze) {
      const dx = p.x - ZONE.x, dz = p.z - ZONE.z, d = Math.hypot(dx, dz);
      assert.ok(d <= 36.01 && d > 30, `${p.id} Abstand ${d}`);
      assert.ok((Math.sin(p.winkel) * dx + Math.cos(p.winkel) * dz) / d > 0.9, `${p.id} Front nach außen`);
    }
    const t = plaetze.find(p => p.art === 'torhaus'), l = weltZuLokalRoh(ZONE.x, ZONE.z, ZONE.drehung, t.x, t.z);
    assert.ok(Math.abs(l.x) < 1e-6 && l.z > 0, 'Torhaus bleibt an lokal +z (tor wählt nur, welche Seite)');
  }
});

test('profil: Gefälle ≤ max, feste Punkte bleiben, erreichbares bleibt unverändert', () => {
  const h = [0, 9, 0, 9, 0, 9, 0], g = 0.14, ds = 10;
  const p = profil(h, ds, g);
  assert.equal(p[0], 0); assert.equal(p[6], 0);
  for (let i = 1; i < p.length; i++) assert.ok(Math.abs(p[i] - p[i - 1]) <= g * ds + 1e-5, `Sprung ${i}`);
  const f = profil([5, 20, 5, 20, 5], [10, 10, 10, 10], 0.2, [0, 2, 4]);
  assert.deepEqual([f[0], f[2], f[4]], [5, 5, 5]);
  for (let i = 1; i < f.length; i++) assert.ok(Math.abs(f[i] - f[i - 1]) <= 0.2 * 10 + 1e-5);
  const glatt = [0, 1, 2, 3, 4];
  assert.deepEqual([...profil(glatt, 10, 0.14)], glatt);
  // Stützpunkt in der Mitte wird gehalten, Rampe zu beiden Seiten
  const m = profil([0, 0, 0, 0, 0, 0, 0], 10, 0.1, [0, 3, 6].map(i => i)); assert.deepEqual([...m], [0, 0, 0, 0, 0, 0, 0]);
  const rampe = profil([0, 0, 5, 0, 0], 10, 0.1, [0, 2, 4]); assert.equal(rampe[2], 5);
});

test('kurve: gleichmäßig abgetastet, Enden exakt, läuft durch die Stützpunkte, länger als die Sehne', () => {
  const pts = [[0, 0], [40, 30], [80, -20], [120, 20]];
  const k = kurve(pts, 2.5), n = k.punkte.length / 2;
  assert.deepEqual([k.punkte[0], k.punkte[1]], [0, 0]);
  assert.ok(Math.abs(k.punkte[2 * n - 2] - 120) < 1e-9 && Math.abs(k.punkte[2 * n - 1] - 20) < 1e-9);
  let summe = 0;
  for (let i = 1; i < n; i++) { const d = Math.hypot(k.punkte[2 * i] - k.punkte[2 * i - 2], k.punkte[2 * i + 1] - k.punkte[2 * i - 1]); summe += d; assert.ok(d <= 2.5 + 1e-6 && d > 1.5, `Schritt ${d}`); }
  assert.ok(summe <= k.laenge + 1e-6 && summe > 120);
  for (const [x, z] of pts) { let m = Infinity; for (let i = 0; i < n; i++) m = Math.min(m, Math.hypot(k.punkte[2 * i] - x, k.punkte[2 * i + 1] - z)); assert.ok(m < 1.3, `Stützpunkt ${x},${z}: ${m}`); }
  assert.equal(kurve([[0, 0], [10, 0]], 2).laenge, 10);
});

test('Geometrie-Helfer: abstandStrecke, naechstePunkte, inBox, boxenSchneiden', () => {
  const a = abstandStrecke(5, 3, 0, 0, 10, 0); assert.ok(Math.abs(a.d - 3) < 1e-9 && Math.abs(a.u - 0.5) < 1e-9);
  const nz = naechstePunkte(Float64Array.from([2, 5, 8, 5]), 1.5, 12, 12);
  assert.equal(nz.d[5 * 12 + 5], 0); assert.ok(Math.abs(nz.s[5 * 12 + 5] - 0.5) < 1e-6); assert.equal(nz.d[0], Infinity); assert.ok(nz.liste.includes(5 * 12 + 5));
  const box = { x: 0, z: 0, winkel: Math.PI / 2, bx: 3, bz: 1 };
  assert.ok(inBox(0, 2.5, box) && !inBox(2.5, 0, box) && inBox(2.5, 0, box, 1.6) === true);
  assert.ok(inBox(1, 1, { x: 0, z: 0, winkel: 0, bx: 2, bz: 2, rund: true }) && !inBox(1.9, 1.9, { x: 0, z: 0, winkel: 0, bx: 2, bz: 2, rund: true }));
  const b1 = { x: 0, z: 0, winkel: 0, bx: 2, bz: 1 };
  assert.ok(boxenSchneiden(b1, { x: 3, z: 0, winkel: 0, bx: 2, bz: 1 }, 0.05));
  assert.ok(!boxenSchneiden(b1, { x: 4, z: 0, winkel: 0, bx: 2, bz: 1 }, 0.05));
  assert.ok(!boxenSchneiden(b1, { x: 0, z: 0, winkel: Math.PI / 2, bx: 0.5, bz: 0.5 }, 0.05) === false);
  assert.ok(!boxenSchneiden(b1, { x: 0, z: 2.5, winkel: 0.3, bx: 1, bz: 1 }, 0.05));
});
