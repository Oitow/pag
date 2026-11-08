import test from 'node:test';
import assert from 'node:assert/strict';
import { createSteering, richtungZu, ankunftsStaerke } from './character-steering.js';
import { createMotor } from './character-motor.js';

const DT = 1 / 60;
const flach = { bodenHoehe: () => 0 };
const npc = (x, z, opts = {}) => ({ motor: createMotor({ welt: opts.welt || flach, pos: { x, z } }), hirn: createSteering(opts) });
function sim(npcs, sek, cb) {
  for (let i = 0; i < Math.round(sek / DT); i++) {
    for (const n of npcs) {
      const andere = npcs.filter((o) => o !== n).map((o) => ({ x: o.motor.zustand.pos.x, z: o.motor.zustand.pos.z, radius: 0.3 }));
      n.motor.update(DT, n.hirn.update(DT, n.motor.zustand, andere));
    }
    cb?.(i);
  }
}
const abst = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

test('Helfer', () => {
  const r = richtungZu({ x: 0, z: 0 }, { x: 3, z: 4 });
  assert.deepEqual(r, { x: 0.6, z: 0.8, dist: 5 });
  assert.equal(ankunftsStaerke(4, 2), 1);
  assert.equal(ankunftsStaerke(1, 2), 0.5);
  assert.equal(ankunftsStaerke(0, 2), 0);
});

test('Ziel erreichen und anhalten', () => {
  const a = npc(0, 0);
  a.hirn.gehZu(6, 3);
  assert.equal(a.hirn.modus, 'ziel');
  sim([a], 8);
  assert.ok(a.hirn.angekommen);
  assert.ok(abst(a.motor.zustand.pos, { x: 6, z: 3 }) < 0.5);
  assert.ok(a.motor.zustand.tempo < 0.05);
  const b = npc(0, 0); b.hirn.gehZu(20, 0, { rennen: true });
  let sprint = false; sim([b], 6, () => { if (b.motor.zustand.sprintet) sprint = true; });
  assert.ok(sprint && b.hirn.angekommen);
});

test('Wandern bleibt im Radius, macht Pausen, deterministisch', () => {
  const spur = (seed) => {
    const a = npc(0, 0, { seed });
    a.hirn.wandere({ x: 0, z: 0 }, 5);
    let maxR = 0, steht = 0; const pkt = [];
    sim([a], 40, (i) => { const p = a.motor.zustand.pos; maxR = Math.max(maxR, Math.hypot(p.x, p.z)); if (a.motor.zustand.tempo < 0.01) steht++; if (i % 60 === 0) pkt.push(p.x.toFixed(4)); });
    return { maxR, steht, pkt };
  };
  const s1 = spur(3), s2 = spur(3), s3 = spur(4);
  assert.ok(s1.maxR < 5.6, `maxR ${s1.maxR}`);
  assert.ok(s1.steht > 60, 'Pausen');
  assert.deepEqual(s1.pkt, s2.pkt);
  assert.notDeepEqual(s1.pkt, s3.pkt);
});

test('zwei NPCs mit Nachbarn überlappen kaum (Gegenverkehr)', () => {
  const a = npc(0, 0, { seed: 1 }), b = npc(10, 0.05, { seed: 2 });
  a.hirn.gehZu(10, 0); b.hirn.gehZu(0, 0);
  let min = Infinity;
  sim([a, b], 12, () => { min = Math.min(min, abst(a.motor.zustand.pos, b.motor.zustand.pos)); });
  assert.ok(min > 0.45, `min ${min}`);
  assert.ok(abst(a.motor.zustand.pos, { x: 10, z: 0 }) < 0.8 && abst(b.motor.zustand.pos, { x: 0, z: 0 }) < 0.8);
});

test('Folgen hält Abstand, Fliehen entfernt sich', () => {
  const fuehrer = npc(0, 0); fuehrer.hirn.gehZu(15, 0);
  const f = npc(-3, 2); f.hirn.folge(() => fuehrer.motor.zustand.pos, 2);
  let min = Infinity;
  sim([fuehrer, f], 12, () => { min = Math.min(min, abst(f.motor.zustand.pos, fuehrer.motor.zustand.pos)); });
  const d = abst(f.motor.zustand.pos, fuehrer.motor.zustand.pos);
  assert.ok(d > 1.6 && d < 2.8, `d ${d}`);
  assert.ok(min > 1.3, `min ${min}`);
  assert.ok(f.hirn.angekommen);
  const jaeger = { x: 0, z: 0 };
  const h = npc(1, 0); h.hirn.fliehe(() => jaeger, 6);
  sim([h], 4);
  assert.ok(abst(h.motor.zustand.pos, jaeger) >= 6 && h.hirn.angekommen);
});

test('Pfad wird abgelaufen (auch als Schleife)', () => {
  const pfad = [{ x: 4, z: 0 }, { x: 4, z: 4 }, { x: 0, z: 4 }];
  const a = npc(0, 0); a.hirn.folgePfad(pfad);
  const besucht = new Set();
  sim([a], 10, () => pfad.forEach((p, i) => { if (abst(a.motor.zustand.pos, p) < 0.9) besucht.add(i); }));
  assert.equal(besucht.size, 3);
  assert.ok(a.hirn.angekommen && abst(a.motor.zustand.pos, pfad[2]) < 0.5);
  const b = npc(0, 0); b.hirn.folgePfad(pfad, { schleife: true });
  let zurueck = 0, weg = false;
  sim([b], 14, () => { const d = abst(b.motor.zustand.pos, pfad[0]); if (d > 2) weg = true; if (weg && d < 0.9) { zurueck++; weg = false; } });
  assert.ok(zurueck >= 2 && !b.hirn.angekommen);
});

test('Steckenbleiben: weicht seitlich aus und kommt an der Wand vorbei', () => {
  // Wand quer im Weg (x 3…3.5, z −2…2), Ziel dahinter
  const welt = { bodenHoehe: (x, z) => (x > 3 && x < 3.5 && Math.abs(z) < 2 ? 2 : 0) };
  const a = npc(0, 0.1, { welt, seed: 5 });
  a.hirn.gehZu(7, 0);
  sim([a], 20);
  assert.ok(a.hirn.angekommen, JSON.stringify(a.motor.zustand.pos));
});

test('robust: NaN, leere Eingaben, setModus, dispose', () => {
  const h = createSteering({ seed: 1 });
  const z = { pos: { x: 0, y: 0, z: 0 } };
  for (const [name, d] of [['ziel', { x: NaN, z: 2 }], ['wandern', {}], ['pfad', { punkte: [] }], ['folgen', { getPos: () => null }], ['fliehen', {}], ['quatsch']]) {
    h.setModus(name, d);
    const ab = h.update(NaN, z, [{ x: 0, z: 0 }, { x: NaN, z: 1 }]);
    assert.ok(Number.isFinite(ab.x) && Number.isFinite(ab.z), name);
  }
  h.stehe(); assert.equal(h.modus, 'stehen');
  assert.deepEqual([h.update(0.1, z).x, h.update(0.1, z).z], [0, 0]);
  h.dispose();
});
