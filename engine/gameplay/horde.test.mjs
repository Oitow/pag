import test from 'node:test';
import assert from 'node:assert/strict';
import { createHorde, HORDEN_ARTEN } from './horde.js';
import { createZauberbuch } from './zauber.js';

const WELT = { bodenHoehe: () => 0 };
const lauf = (horde, ziel, s, dt = 1 / 60, fn) => {
  const alle = [];
  for (let t = 0; t < s; t += dt) { for (const e of horde.update(dt, ziel)) alle.push({ ...e }); fn?.(); }
  return alle;
};

test('Arten sind vollständig, Spawnen beachtet die Obergrenze', () => {
  for (const [n, a] of Object.entries(HORDEN_ARTEN)) assert.ok(a.leben > 0 && a.tempo > 0 && a.radius > 0 && a.masse > 0 && a.skala.length === 2 && a.modell, n);
  const horde = createHorde({ welt: WELT, max: 10 });
  assert.equal(horde.spawne('gibtsnicht', 0, 0), null);
  assert.equal(horde.spawneRing('ratte', 15, { x: 0, z: 0 }, { radius: 10 }), 10);
  assert.equal(horde.anzahl, 10);
  assert.equal(horde.wesen.length, 10);
  for (const w of horde.wesen) { const d = Math.hypot(w.x, w.z); assert.ok(d >= 10 && d <= 15, `Ring ${d}`); }
  horde.leeren();
  assert.equal(horde.anzahl, 0);
});

test('Horde läuft zum Ziel, überlappt kaum und beißt', () => {
  const horde = createHorde({ seed: 3, welt: WELT });
  horde.spawneRing('ratte', 40, { x: 0, z: 0 }, { radius: 12, breite: 3 });
  const ziel = { x: 0, y: 0, z: 0, radius: 0.35 };
  const es = lauf(horde, ziel, 6);
  const bisse = es.filter((e) => e.typ === 'biss');
  assert.ok(bisse.length > 5, `Bisse: ${bisse.length}`);
  assert.equal(bisse[0].schaden, HORDEN_ARTEN.ratte.schaden);
  let nah = 0, tief = 0, summe = 0, paare = 0;
  for (const a of horde.wesen) {
    const d = Math.hypot(a.x, a.z);
    assert.ok(d >= 0.35 + a.radius - 0.05, 'nicht im Ziel');
    if (d < 4) nah++;
    for (const b of horde.wesen) {
      if (a === b) continue;
      const t = a.radius + b.radius - Math.hypot(a.x - b.x, a.z - b.z);
      if (t > 0) { summe += t; paare++; tief = Math.max(tief, t); }
    }
    assert.ok(Number.isFinite(a.x + a.y + a.z + a.yaw + a.phase));
  }
  assert.ok(nah >= 30, `um das Ziel versammelt: ${nah}`);
  assert.ok(tief < 0.35 && summe / Math.max(1, paare) < 0.1, `Überlappung max ${tief}, Mittel ${summe / paare}`);   // weiche Kollision im Gedränge
  assert.equal(horde.ziele.length, 40);
});

test('Ziel in der Luft wird nicht gebissen, ohne Ziel streunt die Horde', () => {
  const horde = createHorde({ seed: 1, welt: WELT });
  horde.spawneRing('ratte', 10, { x: 0, z: 0 }, { radius: 2, breite: 1 });
  assert.equal(lauf(horde, { x: 0, y: 3, z: 0, radius: 0.35 }, 4).filter((e) => e.typ === 'biss').length, 0);
  const h2 = createHorde({ seed: 1, welt: WELT });
  const w = h2.spawne('ratte', 5, 5);
  lauf(h2, null, 3);
  assert.ok(Math.hypot(w.x - 5, w.z - 5) < 6 && w.zustand === 'lauf');
});

test('Schaden: Stoß schleudert weg, Tote fliegen, landen, verschwinden; Schwere bleiben stehen', () => {
  const horde = createHorde({ seed: 2, welt: WELT, leichenZeit: 2 });
  const a = horde.spawne('ratte', 0, 0), b = horde.spawne('ratte', 3, 0), k = horde.spawne('rattenkoenig', 10, 0);
  assert.deepEqual(horde.schade(a, 5, { stoss: { x: 8, y: 4, z: 0 } }), { tot: false, schaden: 5 });
  assert.equal(a.zustand, 'flug');
  assert.equal(a.blitz, 1);
  assert.deepEqual(horde.schade(b, 99, { stoss: { x: 0, y: 3, z: 6 } }), { tot: true, schaden: 99 });
  assert.equal(horde.anzahl, 2);
  assert.equal(horde.getoetet, 1);
  assert.equal(horde.schade(b, 5).schaden, 0);                    // Tote nehmen nichts mehr
  horde.schade(k, 20, { stoss: { x: 8, y: 4, z: 0 }, umwerfen: true });
  assert.notEqual(k.zustand, 'flug');
  let hoch = 0;
  lauf(horde, null, 1.5, 1 / 60, () => { hoch = Math.max(hoch, b.y); });
  assert.ok(hoch > 0.3, 'Toter fliegt hoch');
  assert.ok(a.x > 1.5, `a wurde weggeschleudert (${a.x})`);
  assert.equal(a.zustand, 'lauf');
  assert.equal(b.zustand, 'tot');
  assert.ok(b.z > 3.5 && b.y === 0);
  assert.ok(!horde.ziele.includes(b) && horde.ziele.includes(a));
  const es = lauf(horde, null, 2.5);
  assert.ok(es.some((e) => e.typ === 'weg' && e.wesen === b));
  assert.equal(horde.wesen.length, 2);
});

test('Verlangsamen bremst, Sog zieht, gleicher Seed = gleicher Verlauf', () => {
  const stand = (seed) => {
    const horde = createHorde({ seed, welt: WELT });
    horde.spawneRing('ratte', 12, { x: 0, z: 0 }, { radius: 10 });
    lauf(horde, { x: 0, y: 0, z: 0, radius: 0.35 }, 2);
    return horde.wesen.map((w) => [w.x, w.z, w.yaw]);
  };
  assert.deepEqual(stand(5), stand(5));
  assert.notDeepEqual(stand(5), stand(6));

  const horde = createHorde({ seed: 1, welt: WELT });
  const schnell = horde.spawne('ratte', 0, 30, { skala: 1 }), lahm = horde.spawne('ratte', 5, 30, { skala: 1 });
  schnell.tempoF = lahm.tempoF = 1; schnell.seite = lahm.seite = 0;
  horde.schade(lahm, 0, { verlangsamt: 5 });
  lauf(horde, { x: 2.5, y: 0, z: -30, radius: 0.35 }, 2);
  assert.ok(30 - schnell.z > (30 - lahm.z) * 1.8, `schnell ${schnell.z}, lahm ${lahm.z}`);
  const zieh = horde.spawne('ratte', 20, 0);
  for (let i = 0; i < 30; i++) { horde.schade(zieh, 0, { zug: { x: -8, z: 0 } }); horde.update(1 / 60, null); }
  assert.ok(zieh.x < 17.5, `Sog zieht (${zieh.x})`);
});

test('Zusammenspiel mit dem Zauberbuch: Feuerball räumt einen Haufen ab', () => {
  const horde = createHorde({ seed: 4, welt: WELT });
  for (let i = 0; i < 12; i++) horde.spawne('ratte', Math.cos(i) * 1.2, 9 + Math.sin(i) * 1.2);
  const buch = createZauberbuch({ freiesMana: true, welt: WELT });
  buch.wirke('feuerball', { vorlauf: 0, ziel: { von: { x: 0, y: 1.3, z: 0 }, yaw: 0, punkt: { x: 0, y: 0, z: 9 } } });
  let tote = 0;
  for (let t = 0; t < 2; t += 1 / 60) {
    horde.update(1 / 60, null);
    for (const e of buch.update(1 / 60, horde.ziele)) for (const tr of e.treffer) if (horde.schade(tr.ziel, tr.schaden, tr).tot) tote++;
  }
  assert.ok(tote >= 10, `Tote: ${tote}`);
  assert.equal(horde.getoetet, tote);
});
