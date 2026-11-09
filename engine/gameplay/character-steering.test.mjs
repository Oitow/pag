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

// ---------- 1.1.0 ----------
import { patrouilleWeiter, umkreisRichtung, abstandRichtung, versteckPunkt } from './character-steering-extra.js';

test('Helfer 1.1: Patrouille-Fortschritt, Umkreisen, Abstand, Versteck', () => {
  assert.deepEqual(patrouilleWeiter(3, 2, 1, 'schleife'), { index: 0, richtung: 1, fertig: false });
  assert.deepEqual(patrouilleWeiter(3, 2, 1, 'pingpong'), { index: 1, richtung: -1, fertig: false });
  assert.deepEqual(patrouilleWeiter(3, 0, -1, 'pingpong'), { index: 1, richtung: 1, fertig: false });
  assert.equal(patrouilleWeiter(3, 2, 1, 'einmal').fertig, true);
  const u = umkreisRichtung({ x: 3, z: 0 }, { x: 0, z: 0 }, 3, 1);
  assert.ok(Math.abs(u.x) < 1e-9 && Math.abs(u.z - 1) < 1e-9, 'auf dem Kreis rein tangential');
  assert.ok(umkreisRichtung({ x: 1, z: 0 }, { x: 0, z: 0 }, 3, 1).x > 0, 'zu nah → nach außen');
  assert.equal(abstandRichtung({ x: 0, z: 0 }, { x: 4, z: 0 }, 3, 6).stark, 0);
  assert.ok(abstandRichtung({ x: 0, z: 0 }, { x: 1, z: 0 }, 3, 6).x < 0);
  const v = versteckPunkt({ x: 0, z: 0 }, { x: 0, z: -10 }, [{ x: 2, z: 0, radius: 1 }, { x: 0, z: -8 }], 1);
  assert.ok(v.z > 0 && v.x > 2, `hinter dem Stein ${v.x},${v.z}`);
  assert.equal(versteckPunkt({ x: 0, z: 0 }, { x: 1, z: 1 }, [], 1), null);
});

test('Patrouille: Pingpong mit Warten und Blick am Wegpunkt', () => {
  const a = npc(0, 0, { seed: 4 });
  a.hirn.patrouille([{ x: 0, z: 0 }, { x: 5, z: 0, warten: 1, blickYaw: Math.PI }, { x: 5, z: 5 }], { art: 'pingpong' });
  const besucht = [];
  let wartete = false, blick = false;
  sim([a], 20, () => {
    if (besucht[besucht.length - 1] !== a.hirn.punktIndex) besucht.push(a.hirn.punktIndex);
    if (a.hirn.wartet) { wartete = true; if (Math.abs(Math.abs(a.motor.zustand.yaw) - Math.PI) < 0.2) blick = true; }
  });
  assert.deepEqual(besucht.slice(0, 5), [1, 2, 1, 0, 1]); // Start steht schon auf Punkt 0
  assert.ok(wartete && blick);
  assert.equal(a.hirn.angekommen, false);
});

test('Umkreisen hält den Radius und blickt zum Ziel; Abstand halten', () => {
  const ziel = { x: 0, z: 0 };
  const a = npc(6, 0, { seed: 2, tempo: 0.6 });
  a.hirn.umkreise(() => ziel, 3, { drehsinn: -1 });
  let winkel = 0, vorher = Math.atan2(6, 0);
  sim([a], 4); vorher = Math.atan2(a.motor.zustand.pos.x, a.motor.zustand.pos.z);
  sim([a], 4, () => {
    const w = Math.atan2(a.motor.zustand.pos.x, a.motor.zustand.pos.z);
    let d = w - vorher; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; winkel += d; vorher = w;
    assert.ok(Math.abs(abst(a.motor.zustand.pos, ziel) - 3) < 0.8);
  });
  assert.ok(Math.abs(winkel) > 1.5, `kreist ${winkel}`);
  const blick = Math.atan2(-a.motor.zustand.pos.x, -a.motor.zustand.pos.z);
  assert.ok(Math.abs(Math.atan2(Math.sin(blick - a.motor.zustand.yaw), Math.cos(blick - a.motor.zustand.yaw))) < 0.3);
  const b = npc(1, 0, { seed: 3 });
  b.hirn.halteAbstand(() => ziel, 4, 6);
  sim([b], 4);
  const d = abst(b.motor.zustand.pos, ziel);
  assert.ok(d >= 3.8 && d <= 6.2 && b.hirn.angekommen, `abstand ${d}`);
});

test('Verstecken: hinter Deckung, geduckt; ohne Deckung fliehen', () => {
  const jaeger = { x: 0, z: -10 };
  const a = npc(0, 0, { seed: 5 });
  a.hirn.verstecke(() => jaeger, [{ x: 3, z: 0, radius: 1 }]);
  sim([a], 4);
  assert.ok(a.hirn.angekommen && a.motor.zustand.duckt);
  assert.ok(a.motor.zustand.pos.z > 0.5, 'hinter dem Stein (von der Bedrohung abgewandt)');
  const b = npc(0, 0, { seed: 5 });
  b.hirn.verstecke(() => jaeger, []);
  sim([b], 1);
  assert.ok(b.motor.zustand.pos.z > 2);
});

test('Schwarm: Gruppe bleibt zusammen ohne zu kollidieren', () => {
  const herde = [];
  for (let i = 0; i < 6; i++) { const n = npc((i % 3) * 3, Math.floor(i / 3) * 3, { seed: 10 + i, gruppe: { kohaesion: 1 } }); n.hirn.schwarm({ x: 3, z: 3 }, 10); herde.push(n); }
  let minAbstand = Infinity;
  const sim2 = (sek) => { for (let i = 0; i < Math.round(sek / DT); i++) for (const n of herde) {
    const andere = herde.filter((o) => o !== n).map((o) => ({ x: o.motor.zustand.pos.x, z: o.motor.zustand.pos.z, vx: o.motor.zustand.vel.x, vz: o.motor.zustand.vel.z, radius: 0.3 }));
    n.motor.update(DT, n.hirn.update(DT, n.motor.zustand, andere));
  } };
  sim2(2);
  for (let k = 0; k < 8; k++) {
    sim2(1);
    for (const a of herde) for (const b of herde) if (a !== b) minAbstand = Math.min(minAbstand, abst(a.motor.zustand.pos, b.motor.zustand.pos));
  }
  const mx = herde.reduce((s, n) => s + n.motor.zustand.pos.x, 0) / 6, mz = herde.reduce((s, n) => s + n.motor.zustand.pos.z, 0) / 6;
  const streuung = Math.max(...herde.map((n) => abst(n.motor.zustand.pos, { x: mx, z: mz })));
  assert.ok(minAbstand > 0.35, `min ${minAbstand}`);
  assert.ok(streuung < 8, `streuung ${streuung}`);
});

test('Steckenbleiben eskaliert: Hüpfer, dann steckt = true; Patrouille überspringt Punkt', () => {
  const mauer = { bodenHoehe: (x, z) => (z > 2 && z < 3 ? 5 : 0) }; // unüberwindbare Mauer quer
  const a = npc(0, 0, { seed: 1, welt: mauer });
  a.hirn.gehZu(0, 10);
  let hopp = false;
  for (let i = 0; i < 60 * 12; i++) { const ab = a.hirn.update(DT, a.motor.zustand, []); hopp ||= ab.springen; a.motor.update(DT, ab); }
  assert.ok(hopp, 'Hüpfer versucht');
  assert.equal(a.hirn.steckt, true);
  const b = npc(0, 0, { seed: 1, welt: mauer });
  b.hirn.patrouille([{ x: 0, z: 10 }, { x: 5, z: 0 }], { art: 'einmal' });
  sim([b], 12);
  assert.equal(b.hirn.punktIndex, 1);
  assert.equal(b.hirn.angekommen, true);
});
