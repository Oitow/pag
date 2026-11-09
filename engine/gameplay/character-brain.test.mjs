import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrain, planEintrag } from './character-brain.js';
import { createMotor } from './character-motor.js';

const DT = 1 / 20;
const flach = { bodenHoehe: () => 0 };
const npc = (x, z, opts = {}) => ({ motor: createMotor({ welt: flach, pos: { x, z } }), hirn: createBrain({ welt: flach, ...opts }) });
function sim(npcs, sek, ctx = () => ({}), cb) {
  for (let i = 0; i < Math.round(sek / DT); i++) {
    for (const n of npcs) {
      const r = n.hirn.update(DT, n.motor.zustand, { npcs: npcs.map((o) => o.hirn), ...ctx(n, i) });
      n.motor.update(DT, r.absicht);
      cb?.(n, r, i);
    }
  }
}
const abst = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

test('planEintrag: Stunden, über Mitternacht', () => {
  const plan = [{ von: 8, bis: 17, zustand: 'arbeiten' }, { von: 22, bis: 6, zustand: 'idle' }];
  assert.equal(planEintrag(plan, 9).zustand, 'arbeiten');
  assert.equal(planEintrag(plan, 23).zustand, 'idle');
  assert.equal(planEintrag(plan, 2).zustand, 'idle');
  assert.equal(planEintrag(plan, 19), null);
  assert.equal(planEintrag(plan, undefined), null);
});

test('Tagesablauf: arbeiten am Ort mit Clip, abends wandern', () => {
  const a = npc(0, 0, { seed: 2, plan: [{ von: 8, bis: 17, zustand: 'arbeiten', ort: { x: 5, z: 0 }, clip: 'hacken', blickYaw: 0 }], grund: { zustand: 'wandern', radius: 4 } });
  let stunde = 9, neu = 0;
  sim([a], 6, () => ({ stunde }), (n, r) => { if (r.aktionNeu) neu++; });
  assert.equal(a.hirn.zustand, 'arbeiten');
  assert.equal(a.hirn.aktion, 'hacken');
  assert.equal(neu, 1, 'Clip einmal gestartet');
  assert.ok(abst(a.motor.zustand.pos, { x: 5, z: 0 }) < 0.6);
  assert.ok(Math.abs(a.motor.zustand.yaw) < 0.2, 'blickt wie geplant');
  stunde = 18;
  sim([a], 0.2, () => ({ stunde }));
  assert.equal(a.hirn.zustand, 'wandern');
  assert.equal(a.hirn.aktion, null);
});

test('Feind gesehen → fliehen, danach zurück zur Basis', () => {
  const a = npc(0, 0, { seed: 1, reaktion: { feind: 'fliehen' }, verhalten: { fluchtAbstand: 8 } });
  const wolf = { id: 'wolf', x: 0, z: 4, feind: true };
  let sichtbar = true;
  sim([a], 0.2, () => ({ ziele: sichtbar ? [wolf] : [] }));
  assert.equal(a.hirn.zustand, 'fliehen');
  sim([a], 3, () => ({ ziele: sichtbar ? [wolf] : [] }));
  assert.ok(abst(a.motor.zustand.pos, wolf) > 6);
  sichtbar = false;
  sim([a], 3, () => ({ ziele: [] }));
  assert.equal(a.hirn.zustand, 'idle');
});

test('Angreifen: verfolgt, schlägt mit Pause, sucht bei Sichtverlust', () => {
  const a = npc(0, 0, { seed: 5, reaktion: { feind: 'angreifen' }, feinde: ['held'], verhalten: { angriffsPause: 1, suchZeit: 1 } });
  const held = { id: 'held', x: 0, z: 6 };
  let schlaege = 0;
  sim([a], 5, () => ({ ziele: [held] }), (n, r) => { if (r.aktionNeu && r.aktion === 'schlagen') schlaege++; });
  assert.equal(a.hirn.zustand, 'angreifen');
  assert.ok(schlaege >= 3 && schlaege <= 6, `schlaege ${schlaege}`);
  assert.ok(abst(a.motor.zustand.pos, held) < 3.5);
  held.x = 30; // hinter dem Rücken, außer Sicht
  sim([a], 0.2, () => ({ ziele: [{ ...held, x: 0, z: -20 }] }));
  assert.equal(a.hirn.zustand, 'suchen');
  sim([a], 4, () => ({ ziele: [] }));
  assert.equal(a.hirn.zustand, 'idle');
});

test('Geräusch → suchen am Ort; Plaudern: beide gehen hin und winken', () => {
  const w = npc(0, 0, { seed: 3, reaktion: { geraeusch: 'suchen' } });
  w.hirn.sinne.geraeusch(3, -3, 1, 'knack');
  sim([w], 0.1);
  assert.equal(w.hirn.zustand, 'suchen');
  sim([w], 4);
  assert.ok(abst(w.motor.zustand.pos, { x: 3, z: -3 }) < 0.7);

  const a = npc(0, 0, { seed: 7 }), b = npc(6, 0, { seed: 8 });
  a.hirn.plaudereMit(b.hirn, 2);
  assert.equal(b.hirn.zustand, 'plaudern');
  const clips = new Set();
  sim([a, b], 4, () => ({}), (n, r) => { if (r.aktionNeu) clips.add(r.aktion); });
  assert.ok(abst(a.motor.zustand.pos, b.motor.zustand.pos) < 2.2);
  assert.deepEqual([...clips], ['winken']);
  sim([a, b], 1.5);
  assert.equal(a.hirn.zustand, 'idle');
  assert.equal(b.hirn.zustand, 'idle');
});

test('setze/zurueck, Patrouille, spontanes Plaudern, Determinismus', () => {
  const a = npc(0, 0, { seed: 9 });
  a.hirn.setze('patrouille', { punkte: [{ x: 3, z: 0 }, { x: 3, z: 3 }], art: 'pingpong' });
  sim([a], 3, () => ({ stunde: 10 }));
  assert.equal(a.hirn.zustand, 'patrouille');
  a.hirn.zurueck();
  sim([a], 0.1);
  assert.equal(a.hirn.zustand, 'idle');
  const lauf = () => {
    const n = [npc(0, 0, { seed: 1, grund: 'wandern', verhalten: { plauderChance: 0.5, wanderRadius: 3 } }), npc(2, 0, { seed: 2, grund: 'wandern', verhalten: { wanderRadius: 3 } })];
    const log = [];
    sim(n, 10, () => ({}), (x, r) => log.push(r.zustand + (r.aktion || '')));
    return log;
  };
  const l1 = lauf(), l2 = lauf();
  assert.deepEqual(l1, l2, 'gleicher Seed → gleicher Ablauf');
  assert.ok(l1.includes('plaudernwinken'), 'spontan geplaudert');
  a.hirn.dispose();
});
