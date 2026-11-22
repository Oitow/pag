// Viniland – Bosse 2 (Erweiterung 3): je 3 Bosse für Düsterwald (gothic) und Leuchtpilzhain (biolumineszent).
// Gleiche Basis wie bosses.js (Boss-Klasse: KI-Zustandsmaschine, Stagger, Tod/Auflösen, Varianten, Geometrie-Cache).
// Jede Def: Maße/Tempo, build(B) → Rig, animate(b, dt), emit(b, dt), *wake(b), attacks[] (Generatoren), enrage (Phase 2).
import * as THREE from 'three';
import { clamp, lerp, damp } from './kit.js';
import { Boss, MeshBuilder, grp, seg, addLeg, smooth } from './bosses.js';

const TAU = Math.PI * 2, PI = Math.PI, V3 = THREE.Vector3;
const UP = new V3(0, 1, 0);
const _v = new V3();

export const BOSS_TYPES2 = ['rabenritter', 'henker', 'glockenwaechter', 'myzelhirsch', 'pilzgolem', 'sporenkoenigin'];
export const BOSS_INFO2 = {
  rabenritter:     { name: 'Corvus', title: 'der Rabenritter', hp: 1100, color: 0x3a3c44, biome: 'duesterwald', key: false, loot: 'boss_rabenritter' },
  henker:          { name: 'Grimwald', title: 'der Henker vom Galgenhügel', hp: 1300, color: 0x5a4a38, biome: 'duesterwald', key: false, loot: 'boss_henker' },
  glockenwaechter: { name: 'Bastemor', title: 'der Glockenwächter', hp: 2200, color: 0x8a6a2a, biome: 'duesterwald', key: true, loot: 'boss_glockenwaechter' },
  myzelhirsch:     { name: 'Elarion', title: 'der Myzelhirsch', hp: 1200, color: 0x40ffd8, biome: 'pilzhain', key: false, loot: 'boss_myzelhirsch' },
  pilzgolem:       { name: 'Schwammfaust', title: 'der Pilzgolem', hp: 1400, color: 0x9aff3a, biome: 'pilzhain', key: false, loot: 'boss_pilzgolem' },
  sporenkoenigin:  { name: 'Myzelia', title: 'die Sporenkönigin', hp: 2400, color: 0xff4ad8, biome: 'pilzhain', key: true, loot: 'boss_sporenkoenigin' },
};

// ---------------------------------------------------------------- Helfer
/** Arm: Schulter-Gruppe (Euler YXZ: z = abspreizen, x = heben nach vorn (negativ), y = schwenken), Ellbogen, Hand. */
function arm(B, parent, x, y, z, o) {
  const { l1, l2, r, c1, c2 } = o;
  const sh = grp(parent, x, y, z); sh.rotation.order = 'YXZ';
  const a = new MeshBuilder(); a.sphere(r * 1.3, o.cs ?? c1, {}, 6, 4); a.cyl(r, r * 0.85, l1, c1, { y: -l1 / 2 }, 6);
  if (o.ex1) o.ex1(a); sh.add(a.mesh(B.mat));
  const el = grp(sh, 0, -l1, 0);
  const f = new MeshBuilder(); f.sphere(r * 0.9, c2, {}, 5, 4); f.cyl(r * 0.85, r * 0.7, l2, c2, { y: -l2 / 2 }, 6);
  if (o.ex2) o.ex2(f); el.add(f.mesh(B.mat));
  const hand = grp(el, 0, -l2, 0);
  return { sh, el, hand, side: Math.sign(x) || 1 };
}
/** Arm-Pose aus Tabelle mischen: tab[k] = [x, y, z, ellbogen], gewichtet mit Pose-Wert P[k]. */
function poseArm(A, P, bx, by, bz, be, tab, sleep, sk, dead, dkk) {
  let x = bx, y = by, z = bz, e = be;
  for (const k in tab) {
    const w = P[k]; if (!w) continue; const t = tab[k];
    x += (t[0] - bx) * w; y += (t[1] - by) * w; z += (t[2] - bz) * w; e += (t[3] - be) * w;
  }
  if (sleep && sk > 0) { x = lerp(x, sleep[0], sk); y = lerp(y, sleep[1], sk); z = lerp(z, sleep[2], sk); e = lerp(e, sleep[3], sk); }
  if (dead && dkk > 0) { x = lerp(x, dead[0], dkk); y = lerp(y, dead[1], dkk); z = lerp(z, dead[2], dkk); e = lerp(e, dead[3], dkk); }
  A.sh.rotation.set(x, y, z * A.side); A.el.rotation.x = e;
}
function legWalk(L, ph, amp, sit, crouch = 0, kneel = -1.45, kneelK = 1.9) {
  const o = L.side > 0 ? 0 : PI, s = Math.sin(ph + o), c = Math.cos(ph + o);
  L.hip.rotation.x = lerp(-s * 0.45 * amp - crouch * 0.7, kneel, sit);
  L.knee.rotation.x = lerp(Math.max(0, c) * 0.75 * amp + crouch * 1.3, kneelK, sit);
  L.hip.rotation.z = L.side * (0.04 + sit * 0.2);
}
/** Doppelseitige Dreiecke (Flügel-/Umhang-Membranen). tri = [[x,y,z],[x,y,z],[x,y,z]] */
function tris(list) {
  const a = [];
  for (const [p, q, r] of list) a.push(...p, ...q, ...r, ...p, ...r, ...q);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); return g;
}
function wave(b, pos, r, col, dur = 0.4) { if (b.combat.shockwave) b.combat.shockwave(pos, r * b.S, col, dur); }
const rnd = (a, b) => a + Math.random() * (b - a);
const stunK = b => (b.state === 'stun' ? 1 : 0);

// Pose-Tabellen (modulweit, keine Allokation pro Frame): [schulter x, y, z(außen), ellbogen]
const RABE_AR = { wind: [-1.45, -1.5, 0.3, -0.3], swing: [-1.4, 1.35, 0.1, -0.15], over: [-2.85, 0.1, 0.1, -0.5], chop: [-0.85, 0.15, 0.05, -0.1],
  draw: [-0.75, -0.6, 0.35, -1.5], thrust: [-1.55, 0.15, 0.05, 0], cape: [-0.4, -0.2, 0.6, -0.2] };
const RABE_AL = { cape: [-0.6, 0, 1.4, -0.3], over: [-2.4, -0.3, 0.2, -0.4], chop: [-0.9, -0.3, 0.1, -0.3], thrust: [-0.3, 0, 0.7, -0.3], draw: [-1.2, -0.4, 0.2, -1.0] };
const RABE_SR = [-0.55, 0, 0.05, -0.9], RABE_DR = [-0.25, 0, 0.5, -0.1], RABE_SL = [-0.5, -0.2, 0.05, -0.9], RABE_DL = [0.1, 0, 0.6, -0.2];
const HENK_AR = { raise: [-3.0, 0.25, 0.1, -0.45], chop: [-0.75, 0.2, 0.05, 0], side: [-1.25, -1.7, 0.3, -0.2], spin: [-1.4, 1.2, 0.1, 0], stuck: [-0.6, 0.15, 0.1, 0], roar: [-0.5, 0, 0.9, -0.6] };
const HENK_AL = { raise: [-2.9, -0.35, 0.05, -0.6], chop: [-0.85, -0.45, 0.05, -0.2], side: [-1.2, -1.2, 0.0, -0.8], spin: [-1.3, 0.9, 0.3, -0.4], stuck: [-0.7, -0.45, 0.0, -0.2],
  throw: [-2.6, 0.4, 0.5, -0.8], roar: [-0.5, 0, 0.9, -0.6] };
const HENK_S = [-0.7, 0, 0.1, -0.5], HENK_DR = [-0.2, 0, 0.6, -0.1], HENK_DL = [-0.1, 0, 0.6, -0.1];
const GOLEM_AL = { raiseL: [-1.2, 1.1, 0.9, -1.4], punchL: [-1.55, -0.5, 0.2, -0.05], both: [-3.0, 0, 0.3, -0.4], slam: [-0.9, 0, 0.2, -0.1], inhale: [-0.4, 0, 0.8, -0.5] };
const GOLEM_AR = { raiseR: [-1.2, -1.1, 0.9, -1.4], punchR: [-1.55, 0.5, 0.2, -0.05], both: [-3.0, 0, 0.3, -0.4], slam: [-0.9, 0, 0.2, -0.1], inhale: [-0.4, 0, 0.8, -0.5] };
const GOLEM_S = [-0.7, 0, 0.3, -0.6], GOLEM_D = [-0.1, 0, 0.7, -0.2];

// ================================================================ DÜSTERWALD 1) RABENRITTER – Corvus (Großschwert, Federumhang, Rabenschädel-Helm)
const RABE = {
  radius: 0.85, height: 3.3, walk: 2.6, run: 6.4, turn: 3.4, accel: 5, keep: [2.6, 4.0], circle: 0.75,
  wakeR: 22, leash: 60, gap: 0.8, stgMax: 4, stgDecay: 0.25, kbMul: 0.2, p2speed: 1.25, p2tempo: 1.2,
  tiltL: 0.5, tiltW: 0.4, tiltMul: 0.3, wakeRate: 1.5, deathDur: 1.8, deathFx: 'dark',
  glow: 0x9fb8ff, emberColor: 0x7a6ac0, emberSize: 0.12, emberRise: 0.5, emberN: 40,
  poseKeys: ['wind', 'swing', 'over', 'chop', 'draw', 'thrust', 'crouch', 'cape', 'air'],
  minionAttacks: ['cleave', 'thrust'],
  build(B) {
    const ST = 0x3a3c44, ST2 = 0x50525c, DK = 0x22232a, FE = 0x18161c, FE2 = 0x2a2530, BO = 0xcfc6b0, TB = 0x5a1820, GD = 0x8a7a40;
    const R = { legs: [], strips: [] };
    R.py = 1.55;
    for (const s of [1, -1]) R.legs.push(addLeg(B, B.mdl, { x: s * 0.27, y: R.py, z: 0, l1: 0.78, l2: 0.76, r: 0.13, c1: ST, c2: ST2, fc: DK, foot: 'block',
      extra2: b => b.cone(0.12, 0.25, ST2, { y: 0, z: 0.14, rx: PI / 2 }, 4) }));
    R.hips = grp(B.mdl, 0, R.py, 0);
    const hb = new MeshBuilder();
    hb.cyl(0.36, 0.42, 0.35, DK, { y: 0.05 }, 8);
    hb.box(0.5, 0.95, 0.06, TB, { y: -0.4, z: 0.3, rx: 0.05 }); hb.box(0.5, 0.06, 0.07, GD, { y: 0.06, z: 0.31 });
    hb.box(0.55, 1.0, 0.06, TB, { y: -0.4, z: -0.3, rx: -0.05 });
    R.hips.add(hb.mesh(B.mat));
    R.torso = grp(R.hips, 0, 0.15, 0);
    const t = new MeshBuilder();
    t.cyl(0.42, 0.34, 0.55, ST, { y: 0.3 }, 8);
    t.sphere(1, ST2, { y: 0.8, z: 0.05, sx: 0.6, sy: 0.5, sz: 0.42 }, 9, 6);
    t.box(0.18, 0.6, 0.1, GD, { y: 0.75, z: 0.42, rx: -0.1 }); // Brust-Zierleiste
    t.sphere(1, TB, { y: 0.35, z: 0.25, sx: 0.4, sy: 0.3, sz: 0.25 }, 7, 4);
    t.cyl(0.25, 0.32, 0.2, DK, { y: 1.18 }, 8); // Halsberge
    for (const s of [1, -1]) {
      t.sphere(1, ST2, { x: s * 0.6, y: 1.05, sx: 0.32, sy: 0.24, sz: 0.34 }, 7, 5);
      for (let k = 0; k < 3; k++) t.cone(0.06, 0.35 - k * 0.06, DK, { x: s * (0.55 + k * 0.1), y: 1.3 - k * 0.04, z: -0.12 + k * 0.12, rz: -s * 0.5 }, 4);
    }
    // Federkragen
    for (let i = 0; i < 9; i++) { const a = -1.3 + i * 0.32; t.cone(0.09, 0.5, i % 2 ? FE : FE2, { x: Math.sin(a) * 0.45, y: 1.35, z: Math.cos(a) * 0.3 - 0.12, rx: -0.5 + Math.cos(a) * 0.2, rz: -Math.sin(a) * 0.7 }, 4); }
    R.torso.add(t.mesh(B.mat));
    // Umhang aus Federstreifen
    R.cape = grp(R.torso, 0, 1.15, -0.32);
    for (let i = 0; i < 7; i++) {
      const u = (i - 3) / 3, g = grp(R.cape, u * 0.55, 0, -Math.abs(u) * 0.05); g.rotation.order = 'ZXY';
      const s = new MeshBuilder(); const L = 1.9 - Math.abs(u) * 0.35;
      s.box(0.24, L, 0.04, i % 2 ? FE : FE2, { y: -L / 2 });
      for (let k = 0; k < 3; k++) s.cone(0.09, 0.32, FE, { x: (k - 1) * 0.07, y: -L - 0.1, rx: PI }, 3);
      g.add(s.mesh(B.mat)); g.userData.u = u; R.strips.push(g);
    }
    // Kopf: Rabenschädel-Helm
    R.head = grp(R.torso, 0, 1.35, 0.04);
    const h = new MeshBuilder(), hg = new MeshBuilder();
    h.sphere(1, DK, { y: 0.18, sx: 0.25, sy: 0.28, sz: 0.28 }, 8, 6);
    h.sphere(1, BO, { y: 0.2, z: 0.12, sx: 0.2, sy: 0.2, sz: 0.2 }, 7, 5);
    h.cone(0.13, 0.75, BO, { y: 0.12, z: 0.55, rx: PI / 2 + 0.25, sx: 0.8 }, 6);           // Schnabel
    h.cone(0.08, 0.45, 0xb8ae98, { y: 0.0, z: 0.42, rx: PI / 2 + 0.45, sx: 0.8 }, 5);       // Unterschnabel
    for (let k = 0; k < 5; k++) h.cone(0.06, 0.6 - k * 0.05, k % 2 ? FE : FE2, { y: 0.42 + k * 0.02, z: -0.05 - k * 0.09, rx: -0.7 - k * 0.2 }, 4); // Kamm
    for (const s of [1, -1]) { h.sphere(0.06, 0x08060a, { x: s * 0.1, y: 0.26, z: 0.27, jitter: 0 }, 5, 4); hg.sphere(0.035, 0, { x: s * 0.1, y: 0.26, z: 0.31 }, 5, 3); }
    R.head.add(h.mesh(B.mat)); R.head.add(hg.mesh(B.glowMat));
    // Rechter Arm: Großschwert (Klinge verlängert den Arm, -Y)
    R.armR = arm(B, R.torso, -0.62, 1.02, 0, { l1: 0.62, l2: 0.6, r: 0.11, c1: ST2, c2: ST, cs: ST2 });
    const sw = new MeshBuilder();
    sw.sphere(0.13, DK, {}, 5, 4);
    sw.cyl(0.04, 0.04, 0.45, 0x3a2418, { y: -0.05 }, 5); sw.sphere(0.07, GD, { y: 0.2 }, 5, 3);
    sw.box(0.55, 0.07, 0.12, GD, { y: -0.3 }); sw.cone(0.06, 0.18, GD, { x: 0.3, y: -0.3, rz: PI / 2 }, 4); sw.cone(0.06, 0.18, GD, { x: -0.3, y: -0.3, rz: -PI / 2 }, 4);
    sw.box(0.16, 2.0, 0.035, 0x8a8e98, { y: -1.35 }); sw.box(0.05, 1.9, 0.045, 0x5a5e66, { y: -1.3 });
    sw.cone(0.08, 0.3, 0x8a8e98, { y: -2.5, rx: PI, sz: 0.25 }, 4);
    R.armR.hand.add(sw.mesh(B.mat));
    R.blade = grp(R.armR.hand, 0, -1.6, 0); R.tip = grp(R.armR.hand, 0, -2.4, 0);
    // Linker Arm: Krallenhand
    R.armL = arm(B, R.torso, 0.62, 1.02, 0, { l1: 0.62, l2: 0.58, r: 0.11, c1: ST2, c2: ST, cs: ST2,
      ex2: b => { for (let k = 0; k < 3; k++) seg(b, [(k - 1) * 0.06, -0.6, 0.02], [(k - 1) * 0.1, -0.85, 0.12], 0.03, 0.01, DK, 4); } });
    return R;
  },
  animate(b, dt) {
    const R = b.R, P = b.pc, sp = b.spd, sl = b.sleepK, dk = b.deadK, T = b.T, st = stunK(b);
    const mov = clamp(sp / 2.6, 0, 1); b.gph += dt * (2 + sp * 1.25);
    const ph = b.gph, amp = mov * (1 - sl) * (1 - dk) * (1 - P.air), sit = Math.max(sl * 0.9, dk);
    const breath = Math.sin(T * 1.8) * 0.02;
    R.hips.position.y = R.py + Math.abs(Math.sin(ph)) * 0.05 * amp - sit * 0.72 - P.crouch * 0.3 + breath - st * 0.12;
    for (const L of R.legs) {
      legWalk(L, ph, amp, sit, P.crouch);
      L.hip.rotation.x += -P.air * 0.9; L.knee.rotation.x += P.air * 1.3;
    }
    R.torso.rotation.x = 0.06 + P.crouch * 0.25 + P.chop * 0.45 - P.over * 0.2 + P.thrust * 0.25 + P.draw * 0.15 + sl * 0.35 + dk * 0.55 + st * 0.35 - b.flinch * 0.2;
    R.torso.rotation.y = P.wind * 0.55 - P.swing * 0.7 + P.draw * 0.5 - P.thrust * 0.2 + Math.sin(ph) * 0.07 * amp;
    R.torso.rotation.z = st * Math.sin(T * 3) * 0.08;
    R.head.rotation.x = -0.05 + sl * 0.4 - P.cape * 0.3 + st * 0.3;
    R.head.rotation.y = clamp(b.lookErr, -0.7, 0.7) * 0.6 * (1 - sl);
    const sw = Math.sin(ph) * 0.3 * amp;
    poseArm(R.armR, P, -0.55 + sw, 0, 0.15, -0.35, RABE_AR, RABE_SR, sl, RABE_DR, dk);
    poseArm(R.armL, P, -0.2 - sw, 0, 0.2, -0.4, RABE_AL, RABE_SL, sl, RABE_DL, dk);
    const cp = P.cape;
    for (const g of R.strips) {
      const u = g.userData.u;
      g.rotation.x = 0.12 + Math.sin(T * 2.6 + u * 3) * 0.06 + sp * 0.05 + cp * (1.2 - Math.abs(u) * 0.3) + P.air * 0.6 - sl * 0.08;
      g.rotation.z = u * (0.08 + cp * 1.1);
    }
    b.mdl.rotation.x = dk * 0.25; b.mdl.position.y = 0;
    b.glowMat.emissiveIntensity = (0.3 + 0.7 * (1 - sl)) * (1 - dk) * (b.phase === 2 ? 1.6 + Math.sin(T * 9) * 0.3 : 1);
  },
  emit(b, dt) {
    if (b.state === 'dead') return;
    if (Math.random() < dt * (b.sleepK > 0.5 ? 2 : 7) * (b.phase === 2 ? 2 : 1)) {
      b.worldOf(b.R.cape, rnd(-0.6, 0.6), -1.6, 0, _v);
      b.embers.emit(_v.x, _v.y, _v.z, rnd(-0.4, 0.4), 0.2, rnd(-0.4, 0.4), 1.6);
    }
  },
  *wake(b) {
    yield 0.9;
    b.pose({ cape: 1, over: 0.3 }, 3); b.fxAt('dark', b.R.cape, 16); b.combat.shake(0.2); yield 1.0;
    b.pose({ cape: 0, over: 0, wind: 0.3 }, 4); yield 0.4;
    b.pose({ wind: 0 }, 5); yield 0.2;
  },
  attacks: [
    { id: 'cleave', min: 0, max: 4.4, cd: 2.8, w: 3, ang: 0.8, *run(b, t) {
      const n = b.phase === 2 ? 3 : 2, at = b.boneAt(b.R.blade);
      for (let i = 0; i < n; i++) {
        const r = i % 2 === 0;
        b.track = 4.5; b.pose(r ? { wind: 1, swing: 0, crouch: 0.3 } : { swing: 1, wind: 0, crouch: 0.3 }, 8);
        if (i === 0) b.tele({ pos: b.pos.clone(), radius: 4.0, duration: 0.6, shape: 'cone', dir: b.fwd(new V3()), angle: 2.4 });
        yield i === 0 ? 0.6 : 0.45;
        b.track = 0.8; b.drive = 5; b.pose(r ? { wind: 0, swing: 1, crouch: 0 } : { swing: 0, wind: 1, crouch: 0 }, 22);
        b.hit({ radius: 1.05, duration: 0.22, damage: 16, knockback: 6, stagger: 0.4, at, onHitFx: 'spark' });
        yield 0.22; b.drive = 0; yield 0.25;
      }
      b.pose({ wind: 0, swing: 0 }, 5); b.recT = 0.9;
    } },
    { id: 'thrust', min: 3.5, max: 11, cd: 5, w: 2, ang: 0.5, *run(b, t) {
      b.track = 3.5; b.pose({ draw: 1, crouch: 0.6 }, 6);
      yield 0.4;
      b.track = 0;
      const L = clamp(b.distTo(t.pos) + 2, 6 * b.S, 11 * b.S) / b.S, dir = b.fwd(new V3());
      b.tele({ pos: b.pos.clone(), radius: 1.0, duration: 0.42, shape: 'line', dir, length: L + 2 });
      yield 0.42;
      const dur = 0.32; b.drive = L / dur; b.pose({ draw: 0, thrust: 1, crouch: 0.2 }, 26);
      b.hit({ radius: 1.0, duration: dur + 0.05, damage: 24, knockback: 8, stagger: 0.7, at: b.boneAt(b.R.tip), onHitFx: 'spark' });
      yield dur;
      b.drive = 0; b.pose({ thrust: 0.6, crouch: 0.5 }, 6); b.combat.fx('dust', b.fxPos(b.pos.x, b.pos.y + 0.2, b.pos.z), 10);
      yield 0.45;
      b.pose({ thrust: 0, crouch: 0 }, 4); b.recT = 1.3;                         // Stagger-Fenster
    } },
    { id: 'ravens', min: 6, max: 24, cd: 6.5, w: 2, ang: 0.9, *run(b, t) {
      b.track = 2; b.pose({ cape: 1, over: 0.35 }, 5); b.fxAt('dark', b.R.cape, 14);
      yield 0.75;
      const n = b.phase === 2 ? 7 : 5, f = b.fwd(new V3());
      for (let i = 0; i < n; i++) {
        const u = i - (n - 1) / 2, p = b.worldOf(b.R.cape, u * 0.4, -0.3, -0.3);
        const vel = new V3(f.z * u * 1.8, 3 + Math.random() * 2, -f.x * u * 1.8).addScaledVector(f, 5);
        b.proj({ pos: p, vel, radius: 0.3, damage: 9, life: 3.6, fx: 'dark', homing: t.actor, homingRate: 2.2, knockback: 3, stagger: 0.2 });
        yield 0.07;
      }
      b.pose({ cape: 0, over: 0 }, 4); yield 0.3; b.recT = 0.7;
    } },
    { id: 'wingdive', p2: true, min: 4, max: 20, cd: 9, w: 3, ang: 3.2, run: wingdive },
  ],
  enrage: b => wingdive(b),
};
function* wingdive(b) {
  b.pose({ cape: 1, crouch: 1 }, 6); b.track = 3;
  yield 0.55;
  let tt = 0;
  b.pose({ crouch: 0, air: 1, over: 1 }, 10);
  b.tickFn = dt => { tt += dt; b.leapY = Math.pow(Math.min(1, tt / 0.6), 0.7) * 6; };
  b.combat.fx('dark', b.fxPos(b.pos.x, b.pos.y + 0.5, b.pos.z), 20); b.combat.fx('dust', b.fxPos(b.pos.x, b.pos.y + 0.2, b.pos.z), 14);
  yield 0.35;
  const t = b.tgt, land = (t ? t.pos : b.ahead(5)).clone(); land.y = b.world.heightAt(land.x, land.z);
  b.tele({ pos: land.clone(), radius: 3.2, duration: 0.85, shape: 'circle', color: 0x8a5aff });
  yield 0.5;
  b.track = 0; b.yaw = b.angTo(land);
  const D = b.distTo(land), dur = 0.35, y0 = b.leapY; tt = 0; b.drive = D / dur / b.S;
  b.tickFn = dt => { tt += dt; b.leapY = y0 * (1 - clamp(tt / dur, 0, 1)); };
  b.pose({ over: 0, chop: 1, air: 0.3 }, 14);
  yield dur;
  b.tickFn = null; b.leapY = 0; b.drive = 0; b.pose({ chop: 1, crouch: 0.8, air: 0, cape: 0.5 }, 20);
  const c = b.pos.clone(); c.y += 0.6;
  b.hit({ radius: 3.2, duration: 0.15, damage: 28, knockback: 11, stagger: 0.8, at: () => c, kind: 'slam', onHitFx: 'dark' });
  b.combat.fx('dark', c, 30); b.combat.fx('dust', c, 20); b.combat.shake(0.8); wave(b, c, 3.4, 0x9a6aff);
  for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; b.embers.emit(c.x, c.y, c.z, Math.sin(a) * 6, 1.5, Math.cos(a) * 6, 1.0); }
  yield 0.7;
  b.pose({ chop: 0, crouch: 0, cape: 0 }, 3); b.recT = 1.5;
}

// ================================================================ DÜSTERWALD 2) HENKER – Grimwald (Kapuze, Riesenaxt, Ketten, Galgenkäfig)
const HENK = {
  radius: 1.15, height: 3.7, walk: 2.0, run: 4.6, turn: 2.0, accel: 3, keep: [2.8, 4.5], circle: 0.4,
  wakeR: 22, leash: 60, gap: 1.0, stgMax: 5, stgDecay: 0.3, kbMul: 0.08, p2speed: 1.2, p2tempo: 1.15,
  tiltL: 0.7, tiltW: 0.6, tiltMul: 0.4, wakeRate: 1.2, deathDur: 2.0, deathFx: 'dark',
  glow: 0xff2a10, emberColor: 0xff4a20, emberSize: 0.13, emberRise: 0.8, emberN: 40,
  poseKeys: ['raise', 'chop', 'side', 'spin', 'throw', 'hunch', 'stuck', 'roar'],
  minionAttacks: ['chop', 'sweep'],
  build(B) {
    const HO = 0x5a4a38, HO2 = 0x4a3c2c, SK = 0xb0a898, SK2 = 0x9a9284, STI = 0x3a2a22, AP = 0x3a2418, IR = 0x4a4a4e, RU = 0x6a3a22, RO = 0x8a7450, WD = 0x4a3426;
    const R = { legs: [] };
    R.py = 1.3;
    for (const s of [1, -1]) R.legs.push(addLeg(B, B.mdl, { x: s * 0.45, y: R.py, z: 0, l1: 0.68, l2: 0.64, r: 0.22, c1: AP, c2: SK2, fc: 0x2a1a12, foot: 'block' }));
    R.hips = grp(B.mdl, 0, R.py, 0);
    const hb = new MeshBuilder();
    hb.cyl(0.62, 0.66, 0.4, AP, { y: 0.05 }, 9);
    hb.box(1.0, 1.1, 0.08, AP, { y: -0.45, z: 0.6, rx: 0.08 });                      // Schürze
    hb.box(1.1, 0.12, 0.1, RU, { y: 0.15, z: 0.02, sx: 1.1 });
    hb.cyl(0.03, 0.03, 0.9, RO, { x: 0.45, y: -0.4, z: 0.45 }, 4); hb.add(new THREE.TorusGeometry(0.14, 0.03, 4, 8), RO, { x: 0.45, y: -0.95, z: 0.45 }); // Schlinge
    R.hips.add(hb.mesh(B.mat));
    R.torso = grp(R.hips, 0, 0.2, 0);
    const t = new MeshBuilder();
    t.sphere(1, SK, { y: 0.35, z: 0.15, sx: 0.78, sy: 0.6, sz: 0.68 }, 10, 7);           // Wanst
    t.sphere(1, SK2, { y: 0.95, z: 0.05, sx: 0.9, sy: 0.55, sz: 0.62 }, 10, 7);          // Brust
    for (let k = 0; k < 5; k++) t.box(0.04, 0.02, 0.2, STI, { x: -0.2 + k * 0.1, y: 0.4 + Math.sin(k) * 0.05, z: 0.82, ry: 0.2 });
    t.box(0.6, 0.025, 0.03, STI, { y: 0.42, z: 0.81, rz: 0.15 });
    t.box(0.12, 1.2, 0.08, RU, { x: 0.2, y: 0.75, z: 0.6, rz: 0.75, rx: -0.3 });         // Kreuzgurt
    for (const s of [1, -1]) t.sphere(1, SK2, { x: s * 0.85, y: 1.2, sx: 0.4, sy: 0.35, sz: 0.4 }, 8, 5);
    // Galgenkäfig auf dem Rücken
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; t.cyl(0.025, 0.025, 1.0, IR, { x: Math.sin(a) * 0.32, y: 1.3, z: -0.75 + Math.cos(a) * 0.32 }, 4); }
    t.cyl(0.36, 0.36, 0.06, IR, { y: 0.8, z: -0.75 }, 6); t.cone(0.38, 0.3, IR, { y: 1.95, z: -0.75 }, 6);
    t.sphere(0.17, 0xd8ccb0, { y: 1.05, z: -0.75, sy: 1.1 }, 6, 4); t.cyl(0.02, 0.02, 0.7, RO, { y: 2.35, z: -0.75 }, 3);
    R.torso.add(t.mesh(B.mat));
    // Kapuze
    R.head = grp(R.torso, 0, 1.4, 0.35);
    const h = new MeshBuilder(), hg = new MeshBuilder();
    h.sphere(1, HO, { y: 0.15, sx: 0.36, sy: 0.4, sz: 0.38 }, 8, 6);
    h.cone(0.3, 0.75, HO2, { y: 0.4, z: -0.35, rx: -1.9 }, 6);
    h.cyl(0.55, 0.62, 0.3, HO2, { y: -0.18, z: -0.1 }, 9);                              // Kragen
    for (let k = 0; k < 6; k++) h.box(0.025, 0.12, 0.02, STI, { x: -0.15 + k * 0.06, y: -0.02, z: 0.36 });
    for (const s of [1, -1]) { h.sphere(0.07, 0x0c0606, { x: s * 0.13, y: 0.2, z: 0.31, jitter: 0 }, 5, 4); hg.sphere(0.04, 0, { x: s * 0.13, y: 0.2, z: 0.35 }, 4, 3); }
    R.head.add(h.mesh(B.mat)); R.head.add(hg.mesh(B.glowMat));
    const chain = b => { for (let k = 0; k < 4; k++) b.add(new THREE.TorusGeometry(0.2, 0.035, 4, 8), IR, { y: -0.15 - k * 0.12, rx: PI / 2, rz: k * 0.5 }); };
    // Rechter Arm: Henkersaxt (Stiel verlängert den Arm)
    R.armR = arm(B, R.torso, -0.95, 1.15, 0.05, { l1: 0.75, l2: 0.7, r: 0.21, c1: SK, c2: SK2, cs: SK2, ex2: chain });
    const ax = new MeshBuilder();
    ax.sphere(0.2, SK2, {}, 6, 4);
    ax.cyl(0.05, 0.06, 2.5, WD, { y: -0.95 }, 5);
    ax.box(0.16, 0.9, 1.0, IR, { y: -2.0, z: 0.45 });
    ax.cyl(0.6, 0.6, 0.1, 0x8a8a92, { y: -2.0, z: 0.85, rz: PI / 2 }, 10);       // Schneide (Scheibe)
    ax.box(0.07, 0.95, 0.3, 0x2a2a2e, { y: -2.0, z: 0.1 }); ax.cone(0.08, 0.35, IR, { y: -2.05, z: -0.3, rx: -PI / 2 }, 4);
    R.armR.hand.add(ax.mesh(B.mat));
    R.axe = grp(R.armR.hand, 0, -2.0, 0.7);
    // Linker Arm: Kette mit Haken
    R.armL = arm(B, R.torso, 0.95, 1.15, 0.05, { l1: 0.75, l2: 0.7, r: 0.21, c1: SK, c2: SK2, cs: SK2, ex2: chain });
    const hk = new MeshBuilder(); hk.sphere(0.2, SK2, {}, 6, 4);
    for (let k = 0; k < 5; k++) hk.add(new THREE.TorusGeometry(0.08, 0.025, 4, 6), IR, { y: -0.15 - k * 0.13, ry: k * PI / 2 });
    hk.cone(0.06, 0.3, IR, { y: -0.85, z: 0.08, rx: -2.4 }, 4);
    R.armL.hand.add(hk.mesh(B.mat));
    R.hook = grp(R.armL.hand, 0, -0.8, 0.1);
    return R;
  },
  animate(b, dt) {
    const R = b.R, P = b.pc, sp = b.spd, sl = b.sleepK, dk = b.deadK, T = b.T, st = stunK(b);
    const mov = clamp(sp / 2, 0, 1); b.gph += dt * (1.6 + sp * 1.3);
    const ph = b.gph, amp = mov * (1 - sl) * (1 - dk), sit = Math.max(sl * 0.85, dk);
    R.hips.position.y = R.py + Math.abs(Math.sin(ph)) * 0.07 * amp - sit * 0.68 - P.chop * 0.15 - P.stuck * 0.2 + Math.sin(T * 1.5) * 0.025 - st * 0.15;
    for (const L of R.legs) legWalk(L, ph, amp, sit, P.chop * 0.4 + P.stuck * 0.5);
    R.torso.rotation.x = 0.3 + P.hunch * 0.3 - P.raise * 0.35 + P.chop * 0.55 + P.stuck * 0.35 - P.roar * 0.3 + sl * 0.3 + dk * 0.6 + st * 0.3 - b.flinch * 0.15;
    R.torso.rotation.y = P.side * 0.8 - P.spin * 0.6 + P.throw * -0.4 + Math.sin(ph) * 0.1 * amp;
    R.torso.rotation.z = Math.sin(ph) * 0.06 * amp + st * Math.sin(T * 2.5) * 0.1;
    R.head.rotation.x = -0.2 + sl * 0.5 - P.roar * 0.4 + st * 0.3;
    R.head.rotation.y = clamp(b.lookErr, -0.6, 0.6) * 0.6 * (1 - sl);
    const sw = Math.sin(ph) * 0.25 * amp;
    poseArm(R.armR, P, -0.8 + sw * 0.3, 0.1, 0.25, -1.4, HENK_AR, HENK_S, sl, HENK_DR, dk);
    poseArm(R.armL, P, -0.3 - sw, 0, 0.2, -0.4, HENK_AL, HENK_S, sl, HENK_DL, dk);
    b.glowMat.emissiveIntensity = (0.25 + 0.75 * (1 - sl)) * (1 - dk) * (b.phase === 2 ? 1.7 + Math.sin(T * 12) * 0.4 : 1) * (1 + P.roar);
  },
  emit(b, dt) {
    if (b.state === 'dead' || b.phase < 2) return;
    if (Math.random() < dt * 10) { b.worldOf(b.R.axe, rnd(-0.2, 0.2), rnd(-0.4, 0.4), 0.2, _v); b.embers.emit(_v.x, _v.y, _v.z, 0, 0.8, 0, 0.9); }
  },
  *wake(b) {
    yield 1.0;
    b.pose({ raise: 0.5, roar: 1 }, 3); b.combat.shake(0.35); yield 1.0;
    b.pose({ raise: 0, roar: 0, chop: 0.6 }, 10); yield 0.2;
    b.combat.fx('dust', b.ahead(2.2).setY(b.pos.y + 0.2), 14); b.combat.shake(0.4); yield 0.5;
    b.pose({ chop: 0 }, 4); yield 0.3;
  },
  attacks: [
    { id: 'chop', min: 0, max: 5.5, cd: 4, w: 3, ang: 0.7, run: chop },
    { id: 'sweep', min: 0, max: 4.8, cd: 6, w: 2, ang: 3.2, *run(b, t) {
      b.pose({ side: 1, hunch: 0.4 }, 5);
      b.tele({ pos: b.pos.clone(), radius: 4.6, duration: 0.8, shape: 'circle' });
      yield 0.8;
      const turns = b.phase === 2 ? 2 : 1, dur = 0.55 * turns; let tt = 0;
      b.pose({ side: 0, spin: 1, hunch: 0 }, 20); b.drive = turns > 1 ? 2.5 : 0;
      b.tickFn = dt => { tt += dt; if (tt < dur) b.yaw += dt * TAU / 0.55; };
      b.hit({ radius: 1.6, duration: dur, damage: 22, knockback: 10, stagger: 0.6, at: b.boneAt(b.R.axe), onHitFx: 'spark' });
      if (turns > 1) b.hit({ radius: 1.6, duration: dur, damage: 14, knockback: 8, stagger: 0.4, at: b.boneAt(b.R.armR.hand, 0, -1.2, 0) });
      yield dur;
      b.tickFn = null; b.drive = 0; b.pose({ spin: 0, stuck: 0.5 }, 6);
      yield 0.4;
      b.pose({ stuck: 0 }, 4); b.recT = 1.2;
    } },
    { id: 'hook', min: 5, max: 15, cd: 7, w: 2, ang: 0.5, *run(b, t) {
      b.track = 3; b.pose({ throw: 1, side: -0.3 }, 6);
      yield 0.35;
      b.track = 0;
      const dir = b.fwd(new V3());
      b.tele({ pos: b.pos.clone(), radius: 0.8, duration: 0.5, shape: 'line', dir, length: 15 });
      yield 0.5;
      b.pose({ throw: 0, chop: 0.4, side: 0 }, 20);
      const p = b.worldOf(b.R.hook);
      b.proj({ pos: p, vel: dir.clone().multiplyScalar(24).setY(0.5), radius: 0.4, damage: 10, life: 0.62, fx: 'dark', knockback: -9, stagger: 0.6 }); // zieht heran
      yield 0.6;
      b.pose({ chop: 0 }, 4); b.recT = 0.6; b.gap = 0;
    } },
    { id: 'frenzy', p2: true, min: 0, max: 8, cd: 10, w: 3, ang: 1.0, run: frenzy },
  ],
  enrage: b => frenzy(b),
};
function* chop(b, t, quick = 0) {
  b.track = 1.8; b.pose({ raise: 1, hunch: 0 }, quick ? 9 : 5);
  yield quick ? 0.15 : 0.25;
  b.track = 0;
  const dir = b.fwd(new V3());
  b.tele({ pos: b.pos.clone(), radius: 1.1, duration: quick ? 0.4 : 0.6, shape: 'line', dir, length: 5.5 });
  yield quick ? 0.4 : 0.6;
  b.pose({ raise: 0, chop: 1 }, 24); b.drive = quick ? 4 : 1.5;
  yield 0.1;
  b.drive = 0;
  const c = b.worldOf(b.R.axe); c.y = Math.max(c.y, b.world.heightAt(c.x, c.z) + 0.5);
  b.hit({ radius: 1.4, duration: 0.15, damage: quick ? 22 : 30, knockback: 9, stagger: 0.9, at: () => c, kind: 'slam', onHitFx: 'spark' });
  b.combat.fx('dust', c, 22); b.combat.shake(0.7); wave(b, c, 2.2, 0xffd0a0, 0.3);
  yield quick ? 0.25 : 0.4;
  if (!quick) { b.pose({ chop: 0.5, stuck: 1 }, 6); yield 0.6; b.pose({ stuck: 0, chop: 0 }, 3); b.recT = 1.6; } // Axt steckt fest
}
function* frenzy(b) {
  b.pose({ roar: 1, raise: 0.3 }, 5); b.combat.shake(0.4); b.fxAt('fire', b.R.head, 12, 0, 0.1, 0.4);
  yield 0.6;
  b.pose({ roar: 0 }, 6);
  for (let i = 0; i < 3; i++) { b.track = 5; yield 0.12; yield* chop(b, b.tgt, 1); }
  b.track = 0;
  const dir = b.fwd(new V3()), start = b.ahead(3);
  b.tele({ pos: start.clone(), radius: 1.3, duration: 0.5, shape: 'line', dir, length: 8, color: 0xff3010 });
  yield 0.5;
  for (let i = 0; i < 5; i++) {
    const p = start.clone().addScaledVector(dir, i * 1.6 * b.S); p.y = b.world.heightAt(p.x, p.z) + 0.5;
    b.hit({ radius: 1.4, duration: 0.15, damage: 14, knockback: 7, stagger: 0.5, at: () => p, kind: 'spell', onHitFx: 'fire' });
    b.combat.fx('fire', p, 8); b.combat.fx('dust', p, 6);
    yield 0.09;
  }
  b.pose({ stuck: 1, chop: 0.5 }, 6); yield 0.6;
  b.pose({ stuck: 0, chop: 0 }, 3); b.recT = 2.0;
}

// ================================================================ DÜSTERWALD 3) GLOCKENWÄCHTER – Bastemor (Siegelträger: Gargoyle mit Kathedralenglocke)
const GLOCKE = {
  radius: 2.0, height: 5.6, walk: 2.2, run: 4.0, turn: 1.4, accel: 2.2, keep: [3.6, 6.5], circle: 0.3,
  wakeR: 22, leash: 60, gap: 1.1, stgMax: 7, stgDecay: 0.3, kbMul: 0.02, p2speed: 1.15, p2tempo: 1.12,
  tiltL: 1.3, tiltW: 1.1, tiltMul: 0.5, wakeRate: 0.9, deathDur: 2.2, deathFx: 'dust',
  glow: 0xffd27a, emberColor: 0xffd890, emberSize: 0.16, emberRise: 0.9, emberN: 72,
  poseKeys: ['rear', 'slam', 'clawL', 'clawR', 'swipeL', 'swipeR', 'wings', 'crouch', 'roar', 'air'],
  minionAttacks: ['claw', 'leap'],
  build(B) {
    const S1 = 0x5a5e62, S2 = 0x4a4e50, S3 = 0x34383a, MO = 0x3e5a2e, BZ = 0x8a6a2a, BZ2 = 0x5a4418, HN = 0x2a2622, MEM = 0x2e2a30;
    const R = { legs: [], arms: [], wings: [] };
    R.py = 1.6;
    for (const s of [1, -1]) R.legs.push(addLeg(B, B.mdl, { x: s * 0.85, y: R.py, z: -0.4, l1: 0.9, l2: 0.85, r: 0.34, c1: S2, c2: S1, fc: S3, foot: 'block',
      extra2: b => { for (let k = 0; k < 3; k++) b.cone(0.07, 0.3, HN, { x: (k - 1) * 0.22, y: -0.9, z: 0.6, rx: PI / 2 + 0.4 }, 4); } }));
    R.body = grp(B.mdl, 0, R.py, -0.4);
    const off = grp(R.body, 0, -R.py, 0.4);
    const b = new MeshBuilder(), gl = new MeshBuilder();
    b.ico(1, S2, { y: 2.0, z: -0.3, sx: 1.0, sy: 0.8, sz: 0.85, jitter: 0.12 }, 1);
    b.ico(1, S1, { y: 3.1, z: 0.35, sx: 1.4, sy: 1.0, sz: 1.0, jitter: 0.12 }, 1);
    for (let k = 0; k < 4; k++) b.box(1.9 - k * 0.15, 0.1, 0.12, S3, { y: 2.55 + k * 0.28, z: 1.15 - k * 0.05, rx: 0.3 }); // Rippen
    b.sphere(1, MO, { x: 0.6, y: 3.95, z: 0.2, sx: 0.6, sy: 0.18, sz: 0.5 }, 7, 4); b.sphere(1, MO, { x: -0.7, y: 3.8, z: -0.2, sx: 0.5, sy: 0.16, sz: 0.6 }, 7, 4);
    // Kathedralen-Spitzen auf den Schultern / dem Rücken
    for (const [x, z, h] of [[1.1, -0.2, 1.4], [-1.1, -0.2, 1.4], [0.45, -0.7, 1.0], [-0.45, -0.7, 1.0], [0, -0.3, 1.8]]) {
      b.box(0.34, 0.7, 0.34, S3, { x, y: 3.9, z }); b.cone(0.28, h, S2, { x, y: 4.25 + h / 2, z }, 4);
      b.cone(0.05, 0.25, BZ, { x, y: 4.3 + h + 0.1, z }, 4);
      gl.box(0.06, 0.3, 0.36, 0, { x, y: 3.95, z, sx: 0.6 });                                    // Glühfenster
    }
    off.add(b.mesh(B.mat)); off.add(gl.mesh(B.glowMat));
    // Glocke am Ketten-Joch unter der Brust
    R.bell = grp(off, 0, 2.55, 1.35);
    const bl = new MeshBuilder(), bg = new MeshBuilder();
    for (const s of [1, -1]) seg(bl, [s * 0.5, 0.5, -0.1], [s * 0.35, -0.2, 0], 0.05, 0.05, S3, 4);
    bl.cyl(0.42, 0.55, 0.8, BZ, { y: -0.6 }, 10); bl.sphere(0.42, BZ, { y: -0.2, sy: 0.6 }, 10, 4);
    bl.cyl(0.78, 0.6, 0.35, BZ2, { y: -1.15 }, 10); bl.add(new THREE.TorusGeometry(0.76, 0.06, 4, 14), BZ, { y: -1.32, rx: PI / 2 });
    bl.box(0.9, 0.05, 0.05, BZ2, { y: -0.75, z: 0.5 }); bl.box(0.05, 0.4, 0.05, BZ2, { y: -0.7, z: 0.52 });   // Kreuz
    bg.cyl(0.55, 0.7, 0.1, 0, { y: -1.28 }, 10); bg.sphere(0.2, 0, { y: -1.35 }, 6, 4);
    R.bell.add(bl.mesh(B.mat)); R.bell.add(bg.mesh(B.glowMat));
    R.bellMouth = grp(R.bell, 0, -1.4, 0);
    // Kopf
    R.head = grp(off, 0, 3.6, 1.35);
    const h = new MeshBuilder(), hg = new MeshBuilder();
    h.ico(1, S1, { sx: 0.6, sy: 0.5, sz: 0.62, jitter: 0.1 }, 1);
    h.box(0.95, 0.18, 0.3, S3, { y: 0.22, z: 0.35, rx: 0.3 });
    h.cone(0.12, 0.28, S2, { y: -0.02, z: 0.62, rx: PI / 2 }, 4);                                         // Nase
    for (const s of [1, -1]) {
      const pts = []; for (let k = 0; k < 6; k++) pts.push([s * (0.35 + 0.2 * k), 0.3 + 0.28 * k - 0.05 * k * k, -0.1 - 0.16 * k + 0.03 * k * k]);
      for (let k = 0; k < 5; k++) seg(h, pts[k], pts[k + 1], 0.14 - k * 0.024, 0.12 - k * 0.024, HN, 5);
      h.cone(0.12, 0.45, S2, { x: s * 0.62, y: 0.05, z: -0.05, rz: -s * 1.2 }, 4);                         // Spitzohren
      hg.sphere(0.075, 0, { x: s * 0.23, y: 0.12, z: 0.55, sx: 1.4, sy: 0.6 }, 5, 3);
      h.cone(0.05, 0.22, 0xd8c8a8, { x: s * 0.2, y: -0.3, z: 0.5, rx: PI }, 4);
    }
    R.head.add(h.mesh(B.mat)); R.head.add(hg.mesh(B.glowMat));
    R.jaw = grp(R.head, 0, -0.25, 0.15);
    const jb = new MeshBuilder(); jb.box(0.75, 0.2, 0.55, S2, { y: -0.08, z: 0.22 });
    for (const s of [-1, -0.35, 0.35, 1]) jb.cone(0.04, 0.16, 0xd8c8a8, { x: s * 0.27, y: 0.08, z: 0.44 }, 4);
    R.jaw.add(jb.mesh(B.mat));
    // Lange Arme (knöchelgehend, Klauen)
    for (const s of [1, -1]) {
      const A = arm(B, off, s * 1.45, 3.3, 0.6, { l1: 1.5, l2: 1.45, r: 0.35, c1: S2, c2: S1, cs: S1,
        ex1: a => a.ico(0.5, S1, { y: -0.1, x: s * 0.15, jitter: 0.1 }, 0),
        ex2: f => { f.ico(0.5, S3, { y: -1.45, sy: 0.8, jitter: 0.1 }, 0); for (let k = 0; k < 4; k++) seg(f, [(k - 1.5) * 0.2, -1.6, 0.2], [(k - 1.5) * 0.3, -2.1, 0.55], 0.08, 0.02, HN, 4); } });
      A.claw = grp(A.hand, 0, -0.5, 0.4);
      R.arms.push(A);
    }
    // Fledermausflügel
    for (const s of [1, -1]) {
      const w = grp(off, s * 0.8, 3.75, -0.55); w.rotation.order = 'YZX';
      const wb = new MeshBuilder(), wm = new MeshBuilder();
      const sh = [0, 0, 0], el = [s * 1.5, 1.1, -0.3], tips = [[s * 3.4, 1.6, -0.6], [s * 3.6, 0.3, -0.7], [s * 3.0, -0.9, -0.6], [s * 1.9, -1.4, -0.4]];
      seg(wb, sh, el, 0.14, 0.1, S3, 5);
      for (const p of tips) seg(wb, el, p, 0.07, 0.025, S3, 4);
      const tl = [[sh, el, tips[3]]]; for (let k = 0; k < 3; k++) tl.push([el, tips[k], tips[k + 1]]);
      tl.push([sh, tips[3], [s * 0.4, -1.0, -0.1]]);
      wm.add(tris(tl), MEM, {});
      w.add(wb.mesh(B.mat)); w.add(wm.mesh(B.mat)); w.userData.s = s;
      R.wings.push(w);
    }
    return R;
  },
  animate(b, dt) {
    const R = b.R, P = b.pc, sp = b.spd, sl = b.sleepK, dk = b.deadK, T = b.T, st = stunK(b);
    const mov = clamp(sp / 2, 0, 1); b.gph += dt * (1.2 + sp * 1.3);
    const ph = b.gph, amp = mov * (1 - sl) * (1 - dk) * (1 - P.air), sit = Math.max(sl, dk);
    R.body.position.y = R.py + Math.abs(Math.sin(ph)) * 0.08 * amp - sit * 0.95 + Math.sin(T * 1.3) * 0.03 - P.slam * 0.45 - P.crouch * 0.5 + P.rear * 0.4 - st * 0.25;
    R.body.rotation.x = 0.38 - P.rear * 0.85 + P.slam * 0.4 + P.crouch * 0.15 + sl * 0.2 + st * 0.2 - P.roar * 0.2 + dk * 0.3 - b.flinch * 0.12;
    R.body.rotation.y = Math.sin(ph) * 0.05 * amp + P.swipeL * 0.25 - P.swipeR * 0.25 - P.clawL * 0.15 + P.clawR * 0.15;
    R.body.rotation.z = Math.sin(ph) * 0.06 * amp + st * Math.sin(T * 2) * 0.06;
    for (const L of R.legs) { legWalk(L, ph, amp, sit, P.crouch + P.slam * 0.3); L.hip.rotation.x += P.rear * 0.5 - P.air * 0.6; L.knee.rotation.x += P.air * 0.8; }
    for (const A of R.arms) {
      const s = A.side, swg = Math.sin(ph + (s > 0 ? 0 : PI)) * 0.35 * amp;
      const cl = s > 0 ? P.clawL : P.clawR, sw = s > 0 ? P.swipeL : P.swipeR;
      // Basis: auf die Knöchel gestützt
      let x = -0.35 + swg + P.crouch * 0.2, y = 0, z = 0.12, e = -0.35;
      x += (-2.4 - x) * cl; y += (s * 0.9 - y) * cl; z += (0.5 - z) * cl; e += (-1.2 - e) * cl;
      x += (-1.0 - x) * sw; y += (-s * 0.9 - y) * sw; z += (0.1 - z) * sw; e += (-0.2 - e) * sw;
      x += (-2.9 - x) * P.rear; y += (-s * 0.25 - y) * P.rear; z += (0.25 - z) * P.rear; e += (-0.6 - e) * P.rear;
      x += (-1.0 - x) * P.slam; e += (-0.3 - e) * P.slam;
      x += (-1.6 - x) * P.roar * 0.6; z += (1.0 - z) * P.roar * 0.6;
      x = lerp(x, -0.9, sit); e = lerp(e, -0.6, sit); z = lerp(z, 0.25, dk);
      A.sh.rotation.set(x, y, z * s); A.el.rotation.x = e;
    }
    const fl = P.wings * Math.sin(T * 9) * 0.35;
    for (const w of R.wings) {
      const s = w.userData.s;
      w.rotation.y = s * (0.9 - P.wings * 0.9 - sl * 0.2 + dk * 0.3);     // angelegt ↔ gespreizt
      w.rotation.z = s * (-0.35 + P.wings * 0.25 + fl + Math.sin(T * 1.1) * 0.03);
      w.rotation.x = 0.25 - P.wings * 0.25 - dk * 0.3;
    }
    R.head.rotation.x = -0.1 + sl * 0.45 - P.roar * 0.45 + P.slam * 0.2 + st * 0.35 + P.rear * 0.6;
    R.head.rotation.y = clamp(b.lookErr, -0.5, 0.5) * 0.7 * (1 - sl) + st * Math.sin(T * 3) * 0.2;
    R.jaw.rotation.x = 0.08 + P.roar * 0.75 + P.rear * 0.4 + dk * 0.4;
    R.bell.rotation.x = Math.sin(T * 1.7) * 0.06 + sp * 0.04 - P.rear * 1.0 + P.slam * 0.6;  // schwingt mit
    R.bell.rotation.z = Math.sin(T * 1.3 + 1) * 0.05;
    b.mdl.rotation.x = dk * 0.2;
    b.glowMat.emissiveIntensity = (0.15 + 0.85 * (1 - sl)) * (1 + P.rear * 0.9 + P.roar * 0.5) * (1 - dk * 0.85) * (0.9 + Math.sin(T * 5) * 0.1) * (b.phase === 2 ? 1.35 : 1);
  },
  emit(b, dt) {
    if (b.state === 'dead') return;
    if (Math.random() < dt * (b.sleepK > 0.5 ? 2 : 6) * (b.phase === 2 ? 2 : 1)) {
      b.worldOf(b.R.bellMouth, rnd(-0.5, 0.5), 0, rnd(-0.5, 0.5), _v);
      b.embers.emit(_v.x, _v.y, _v.z, rnd(-0.3, 0.3), 0.4, rnd(-0.3, 0.3), 1.4);
    }
  },
  *wake(b) {
    b.combat.shake(0.3); b.combat.fx('dust', b.fxPos(b.pos.x, b.pos.y + 0.6, b.pos.z), 24);
    yield 1.6;
    b.pose({ wings: 1, roar: 1, rear: 0.5 }, 3); b.combat.shake(0.6); b.fxAt('spark', b.R.bellMouth, 20);
    wave(b, b.pos.clone(), 6, 0xffd27a, 0.6);
    yield 1.2;
    b.pose({ wings: 0, roar: 0, rear: 0 }, 3); yield 0.5;
  },
  attacks: [
    { id: 'claw', min: 0, max: 6.5, cd: 3, w: 3, ang: 0.8, *run(b, t) {
      const n = b.phase === 2 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const L = i % 2 === 0, A = b.R.arms[L ? 0 : 1];
        b.track = 2.4; b.pose(L ? { clawL: 1, swipeL: 0 } : { clawR: 1, swipeR: 0 }, 7);
        if (i === 0) b.tele({ pos: b.pos.clone(), radius: 6.2, duration: 0.65, shape: 'cone', dir: b.fwd(new V3()), angle: 1.8 });
        yield i === 0 ? 0.65 : 0.5;
        b.track = 0.6; b.drive = 3; b.pose(L ? { clawL: 0, swipeL: 1 } : { clawR: 0, swipeR: 1 }, 20);
        b.hit({ radius: 1.7, duration: 0.24, damage: 20, knockback: 8, stagger: 0.5, at: b.boneAt(A.claw), onHitFx: 'spark' });
        yield 0.24; b.drive = 0;
        yield 0.3; b.pose(L ? { swipeL: 0 } : { swipeR: 0 }, 6);
      }
      b.recT = 1.0;
    } },
    { id: 'toll', min: 0, max: 8.5, cd: 7, w: 2, ang: 3.2, run: (b, t) => toll(b, 7.5) },
    { id: 'leap', min: 9, max: 26, cd: 6.5, w: 3, ang: 0.6, *run(b, t) {
      b.track = 2; b.pose({ crouch: 1, wings: 1 }, 5);
      yield 0.45;
      b.track = 0;
      const land = t.pos.clone(); land.y = b.world.heightAt(land.x, land.z);
      b.yaw = b.angTo(land);
      const dur = 0.85, D = b.distTo(land) - 1.0 * b.S;
      b.tele({ pos: land.clone(), radius: 4.0, duration: 0.55 + dur, shape: 'circle' });
      yield 0.55;
      let tt = 0; b.drive = Math.max(0, D) / dur / b.S; b.pose({ crouch: 0, air: 1 }, 12);
      b.tickFn = dt => { tt += dt; b.leapY = Math.sin(PI * clamp(tt / dur, 0, 1)) * 4.5; };
      b.combat.fx('dust', b.fxPos(b.pos.x, b.pos.y + 0.3, b.pos.z), 18);
      yield dur;
      b.tickFn = null; b.leapY = 0; b.drive = 0; b.pose({ air: 0, slam: 1, crouch: 0.6, wings: 0.3 }, 22);
      const c = b.pos.clone(); c.y += 0.7;
      b.hit({ radius: 4.0, duration: 0.15, damage: 26, knockback: 11, stagger: 0.7, at: () => c, kind: 'slam' });
      b.combat.fx('dust', c, 34); b.combat.shake(0.9); wave(b, c, 4.2, 0xd0c0a0);
      yield 0.6;
      b.pose({ slam: 0, crouch: 0, wings: 0 }, 3); b.recT = 1.3;
    } },
    { id: 'stonerain', p2: true, min: 0, max: 26, cd: 9, w: 3, ang: 3.2, *run(b, t) {
      b.pose({ wings: 1, rear: 0.45, roar: 1 }, 4); b.combat.shake(0.3);
      const pts = [];
      for (const p of b.alivePlayers([], 32)) pts.push(p.pos.clone());
      for (let i = 0; i < 6; i++) { const a = Math.random() * TAU, r = 3 + Math.random() * 6; pts.push(new V3(t.pos.x + Math.sin(a) * r, 0, t.pos.z + Math.cos(a) * r)); }
      for (const p of pts) { p.y = b.world.heightAt(p.x, p.z); b.tele({ pos: p, radius: 2.3, duration: 1.4, shape: 'circle', color: 0xffb060 }); }
      yield 0.8;
      for (const p of pts) {
        b.proj({ pos: new V3(p.x, p.y + 9, p.z), vel: new V3(0, -15, 0), radius: 0.6, damage: 18, life: 1.2, fx: 'fire', explodeRadius: 2.3, knockback: 7, stagger: 0.5,
          onExpire: q => b.combat.fx('dust', q, 14) });
      }
      yield 0.9;
      b.pose({ wings: 0, rear: 0, roar: 0 }, 3); b.recT = 0.9;
    } },
  ],
  enrage: b => toll(b, 9.5),
};
function* toll(b, R0) {
  b.pose({ rear: 1, wings: 0.6, roar: 0.4 }, 3.5); b.track = 1;
  b.tele({ pos: b.pos.clone(), radius: R0, duration: 1.0, shape: 'circle', color: 0xffb040 });
  yield 0.5;
  b.track = 0; yield 0.5;
  b.pose({ rear: 0, slam: 1, roar: 1, wings: 0.2 }, 22);
  yield 0.12;
  const c = b.worldOf(b.R.bellMouth); c.y = b.world.heightAt(c.x, c.z) + 0.8;
  const cc = b.pos.clone(); cc.y += 0.8;
  b.hit({ radius: R0, duration: 0.18, damage: 24, knockback: 13, stagger: 0.7, at: () => cc, kind: 'slam', onHitFx: 'spark' });
  b.combat.fx('spark', c, 30); b.combat.fx('dust', c, 30); b.combat.shake(1.0);
  wave(b, cc, R0, 0xffe0a0, 0.5); wave(b, cc, R0 * 0.6, 0xffffff, 0.3);
  for (let i = 0; i < 28; i++) { const a = i / 28 * TAU; b.embers.emit(c.x, c.y, c.z, Math.sin(a) * 9, 1, Math.cos(a) * 9, 0.8); }
  yield 0.8;
  b.pose({ slam: 0.5, roar: 0 }, 2); yield 0.3;
  b.recT = 1.8;                                                                       // Glocke steckt im Boden
}

// ================================================================ PILZHAIN 1) MYZELHIRSCH – Elarion (Hirsch mit Leuchtpilz-Geweih, Schädelgesicht)
const HIRSCH = {
  radius: 1.0, height: 3.8, walk: 3.0, run: 9.0, turn: 3.2, accel: 4, keep: [3, 6], circle: 0.9,
  wakeR: 22, leash: 60, gap: 0.9, stgMax: 4.5, stgDecay: 0.25, kbMul: 0.15, p2speed: 1.25, p2tempo: 1.2,
  tiltL: 0.9, tiltW: 0.4, tiltMul: 0.9, wakeRate: 1.5, deathDur: 1.7, deathFx: 'frost',
  glow: 0x40ffd8, emberColor: 0x40ffd8, emberSize: 0.12, emberRise: 0.35, emberN: 56,
  poseKeys: ['head', 'gore', 'rear', 'crouch', 'paw', 'bellow'],
  minionAttacks: ['gore', 'charge'],
  build(B) {
    const BD = 0x3a2a3a, BD2 = 0x4a3646, BE = 0x5a4a5a, BO = 0xd8d0c0, AN = 0x6a5a4a, MO = 0x2a4a3a, HF = 0x1a1418;
    const T1 = 0x40ffd8, T2 = 0x9aff5a, T3 = 0xff60e0;
    const R = { legs: [] };
    R.py = 1.75;
    R.body = grp(B.mdl, 0, R.py, -0.7);
    const off = grp(R.body, 0, -R.py, 0.7);
    const b = new MeshBuilder(), lm = new MeshBuilder();
    b.sphere(1, BD, { y: 1.85, z: 0, sx: 0.5, sy: 0.5, sz: 1.0 }, 10, 7);
    b.sphere(1, BD2, { y: 1.95, z: 0.6, sx: 0.55, sy: 0.6, sz: 0.55 }, 9, 6);
    b.sphere(1, BE, { y: 1.6, z: 0.1, sx: 0.38, sy: 0.25, sz: 0.7 }, 8, 5);
    for (let k = 0; k < 6; k++) b.box(0.08, 0.5 + (k % 2) * 0.2, 0.25, MO, { x: (k % 2 ? 0.42 : -0.42), y: 1.55, z: -0.6 + k * 0.25, rz: k % 2 ? 0.2 : -0.2 }); // Moosfetzen
    for (let k = 0; k < 6; k++) {                                         // Rückenpilze
      const z = -0.7 + k * 0.28, c = k % 2 ? T1 : T2;
      b.cyl(0.03, 0.04, 0.22, 0xe0e0d0, { y: 2.38, z }, 4); lm.sphere(0.12 - (k % 3) * 0.02, c, { y: 2.5, z, sy: 0.45 }, 6, 3);
    }
    off.add(b.mesh(B.mat)); off.add(lm.mesh(B.lumMat));
    R.neck = grp(off, 0, 2.15, 0.95); R.neck.rotation.x = -0.6;
    const n = new MeshBuilder(); n.cyl(0.2, 0.32, 0.9, BD2, { y: 0.35 }, 8); n.box(0.1, 0.6, 0.3, MO, { y: 0.3, z: 0.18 });
    R.neck.add(n.mesh(B.mat));
    R.head = grp(R.neck, 0, 0.8, 0.05); R.head.rotation.x = 0.6;
    const h = new MeshBuilder(), hl = new MeshBuilder();
    h.sphere(1, BO, { y: 0.05, sx: 0.22, sy: 0.22, sz: 0.26 }, 8, 6);
    h.box(0.24, 0.16, 0.55, BO, { y: -0.05, z: 0.35, rx: 0.15 }); h.box(0.18, 0.08, 0.4, 0xc0b8a8, { y: -0.17, z: 0.3, rx: 0.1 });
    for (const s of [1, -1]) {
      h.sphere(0.07, 0x08080a, { x: s * 0.12, y: 0.08, z: 0.18, jitter: 0 }, 5, 4); hl.sphere(0.045, T1, { x: s * 0.13, y: 0.08, z: 0.21 }, 5, 3);
      h.cone(0.07, 0.3, BD2, { x: s * 0.22, y: 0.12, z: -0.05, rz: -s * 1.2, sz: 0.4 }, 4);             // Ohren
      // Geweih: Hauptstange + Sprossen + Leuchtpilze
      const P0 = [s * 0.12, 0.2, -0.02], P1 = [s * 0.45, 0.75, -0.2], P2 = [s * 0.7, 1.35, -0.1], P3 = [s * 0.95, 1.9, -0.35];
      seg(h, P0, P1, 0.06, 0.05, AN, 5); seg(h, P1, P2, 0.05, 0.04, AN, 5); seg(h, P2, P3, 0.04, 0.025, AN, 4);
      for (const [a, c, col] of [[P1, [s * 0.4, 1.1, 0.35], T1], [P2, [s * 1.2, 1.55, 0.2], T2], [P2, [s * 0.45, 1.8, 0.1], T3], [P1, [s * 0.95, 0.85, 0.1], T1], [P3, [s * 1.35, 2.05, -0.1], T2]]) {
        seg(h, a, c, 0.035, 0.02, AN, 4); hl.sphere(0.12, col, { x: c[0], y: c[1] + 0.05, z: c[2], sy: 0.5 }, 6, 3);
      }
      hl.sphere(0.15, T3, { x: P3[0], y: P3[1] + 0.06, z: P3[2], sy: 0.5 }, 6, 3);
      for (let k = 0; k < 3; k++) h.box(0.03, 0.4, 0.03, MO, { x: s * (0.5 + k * 0.15), y: 0.9 + k * 0.3, z: -0.15 });  // Moosfäden
    }
    R.head.add(h.mesh(B.mat)); R.head.add(hl.mesh(B.lumMat));
    R.tip = grp(R.head, 0, 1.0, 0.3);
    R.snout = grp(R.head, 0, -0.05, 0.6);
    for (const s of [1, -1]) {
      R.legs.push(addLeg(B, off, { x: s * 0.3, y: 1.75, z: 0.7, l1: 0.85, l2: 0.85, r: 0.1, c1: BD2, c2: BD, fc: HF, front: true }));
      R.legs.push(addLeg(B, B.mdl, { x: s * 0.3, y: 1.75, z: -0.7, l1: 0.88, l2: 0.85, r: 0.12, c1: BD, c2: BD, fc: HF }));
    }
    R.tail = grp(off, 0, 1.95, -1.0);
    const tl = new MeshBuilder(); tl.cone(0.12, 0.35, BE, { y: 0.1, rx: -0.6 }, 5); R.tail.add(tl.mesh(B.mat));
    return R;
  },
  animate(b, dt) {
    const R = b.R, P = b.pc, sp = b.spd, sl = b.sleepK, dk = b.deadK, T = b.T, st = stunK(b);
    const mov = clamp(sp / 3, 0, 1), gal = clamp((sp - 5) / 4, 0, 1);
    b.gph += dt * (2.2 + sp * 0.95);
    const ph = b.gph, amp = (0.35 * mov + 0.3 * gal) * (1 - sl) * (1 - dk), lie = Math.max(sl, dk);
    R.body.position.y = R.py - lie * 0.95 + Math.abs(Math.sin(ph)) * 0.06 * amp - P.crouch * 0.25 + Math.sin(T * 2) * 0.012 - st * 0.1;
    R.body.rotation.x = -P.rear * 0.75 + P.head * 0.08 + Math.sin(ph * 2) * 0.04 * amp - b.flinch * 0.1;
    R.body.rotation.z = st * Math.sin(T * 3) * 0.06 + dk * 0.0;
    for (const L of R.legs) {
      const o = (L.front ? 0 : PI) + (L.side > 0 ? 0 : PI) * (1 - gal) + gal * (L.side > 0 ? 0 : 0.6);
      const s = Math.sin(ph + o), c = Math.cos(ph + o);
      let hip, knee;
      if (L.front) { hip = s * amp * 1.0 - P.rear * 0.9 + P.paw * (L.side > 0 ? Math.sin(T * 14) * 0.5 - 0.6 : 0); knee = Math.max(0, c) * amp * 1.4 + P.rear * 1.6; }
      else { hip = -s * amp * 0.9 + P.rear * 0.5 + P.crouch * 0.3; knee = Math.max(0, -c) * amp * 1.0 - P.crouch * 0.5; }
      L.hip.rotation.x = lerp(hip, L.front ? -1.4 : 1.3, lie); L.knee.rotation.x = lerp(knee, L.front ? 2.6 : -2.4, lie);
      L.hip.rotation.z = lie * 0.2 * L.side;
    }
    R.neck.rotation.x = -0.6 + P.head * 1.1 - P.gore * 0.6 + sl * 0.7 - P.bellow * 0.5 + st * 0.4 + dk * 0.9 + gal * 0.3;
    R.neck.rotation.y = clamp(b.lookErr, -0.6, 0.6) * (1 - sl) * 0.6 + st * Math.sin(T * 4) * 0.25;
    R.head.rotation.x = 0.6 - P.head * 0.4 + P.gore * 0.2 - sl * 0.2 - P.bellow * 0.3;
    R.tail.rotation.x = Math.sin(T * 6) * 0.2 * (1 - lie);
    b.mdl.rotation.z = dk * 1.3; b.mdl.position.y = dk * 0.3;
    const g = (0.4 + 0.6 * (1 - sl)) * (1 - dk * 0.7) * (0.85 + Math.sin(T * 3) * 0.15) * (b.phase === 2 ? 1.25 : 1);
    b.lumMat.color.setScalar(g);
    b.glowMat.emissiveIntensity = g;
  },
  emit(b, dt) {
    if (b.state === 'dead') return;
    if (Math.random() < dt * (b.sleepK > 0.5 ? 4 : 10) * (b.phase === 2 ? 1.6 : 1)) {
      b.worldOf(b.R.tip, rnd(-1.2, 1.2), rnd(-0.6, 0.8), rnd(-0.5, 0.3), _v);
      b.embers.emit(_v.x, _v.y, _v.z, rnd(-0.2, 0.2), 0.15, rnd(-0.2, 0.2), 2.2);
    }
    if (b.spd > 6 && Math.random() < dt * 20) b.embers.emit(b.pos.x + rnd(-0.5, 0.5), b.pos.y + 0.2, b.pos.z + rnd(-0.5, 0.5), 0, 0.6, 0, 1.4);
  },
  *wake(b) {
    b.pose({ head: 0.3 }, 2); yield 1.0;
    b.pose({ head: -0.2, bellow: 1 }, 4); b.combat.shake(0.25); b.fxAt('frost', b.R.tip, 14); yield 1.1;
    b.pose({ bellow: 0, head: 0, paw: 1 }, 5); yield 0.6;
    b.pose({ paw: 0 }, 5); yield 0.2;
  },
  attacks: [
    { id: 'gore', min: 0, max: 4.4, cd: 2.6, w: 3, ang: 0.8, *run(b, t) {
      const n = b.phase === 2 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        b.track = 4; b.pose({ head: 1, crouch: 0.6 }, 8);
        b.tele({ pos: b.pos.clone(), radius: 3.8, duration: 0.55, shape: 'cone', dir: b.fwd(new V3()), angle: 1.3 });
        yield 0.55;
        b.track = 0.8; b.drive = 7; b.pose({ head: 0, gore: 1, crouch: 0 }, 22);
        b.hit({ radius: 1.5, duration: 0.2, damage: 18, knockback: 9, stagger: 0.6, at: b.boneAt(b.R.tip, 0, -0.4, 0.2), onHitFx: 'frost' });
        yield 0.2; b.drive = 0; yield 0.3; b.pose({ gore: 0 }, 6);
      }
      b.recT = 0.8;
    } },
    { id: 'charge', min: 6, max: 22, cd: 6, w: 2, ang: 0.5, run: (b, t) => charge(b, t, 0.8) },
    { id: 'rear', min: 0, max: 5.5, cd: 6, w: 2, ang: 3.2, *run(b, t) {
      b.track = 2.5; b.pose({ rear: 1, bellow: 0.6 }, 5);
      yield 0.3;
      b.track = 0;
      const c = b.ahead(1.6); c.y = b.world.heightAt(c.x, c.z);
      b.tele({ pos: c.clone(), radius: 3.6, duration: 0.5, shape: 'circle' });
      yield 0.5;
      b.pose({ rear: 0, head: 0.6, bellow: 0 }, 24); yield 0.12;
      c.y += 0.6;
      b.hit({ radius: 3.6, duration: 0.15, damage: 20, knockback: 9, stagger: 0.6, at: () => c, kind: 'slam', onHitFx: 'frost' });
      b.combat.fx('frost', c, 20); b.combat.fx('dust', c, 16); b.combat.shake(0.55); wave(b, c, 3.6, 0x40ffd8);
      for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; b.embers.emit(c.x, c.y, c.z, Math.sin(a) * 4, 1.2, Math.cos(a) * 4, 1.6); }
      yield 0.5;
      b.pose({ head: 0 }, 4); b.recT = 1.0;
    } },
    { id: 'glowrush', p2: true, min: 4, max: 24, cd: 10, w: 3, ang: 3.2, run: glowrush },
  ],
  enrage: b => glowrush(b),
};
function* charge(b, t, wind) {
  b.track = 3; b.pose({ head: 0.9, paw: 1, crouch: 0.3 }, 6);
  for (let i = 0; i < 3; i++) { b.combat.fx('dust', b.fxPos(b.pos.x, b.pos.y + 0.1, b.pos.z), 4); yield wind / 3; }
  b.track = 0;
  const tg = t || b.tgt, L = clamp((tg ? b.distTo(tg.pos) : 10) + 4 * b.S, 9 * b.S, 22 * b.S) / b.S, dir = b.fwd(new V3());
  b.tele({ pos: b.pos.clone(), radius: 1.3, duration: 0.5, shape: 'line', dir, length: L + 1 });
  yield 0.5;
  const v = 16, dur = L / v; b.drive = v; b.pose({ paw: 0, head: 1, crouch: 0 }, 12);
  b.hit({ radius: 1.6, duration: dur, damage: 22, knockback: 12, stagger: 0.7, at: b.boneAt(b.R.tip, 0, -0.5, 0.3), onHitFx: 'frost' });
  let tt = 0; b.tickFn = dt => { tt += dt; if (Math.random() < dt * 30) b.embers.emit(b.pos.x, b.pos.y + 0.4, b.pos.z, rnd(-1, 1), 0.8, rnd(-1, 1), 1.6); };
  yield dur;
  b.tickFn = null; b.drive = 2; b.pose({ head: 0.3, crouch: 0.5 }, 6);               // ausrutschen
  b.combat.fx('dust', b.fxPos(b.pos.x, b.pos.y + 0.2, b.pos.z), 14);
  yield 0.3; b.drive = 0;
  b.pose({ head: 0, crouch: 0 }, 4); b.recT = 1.4;
}
function* glowrush(b) {
  b.pose({ bellow: 1, head: -0.3 }, 5); b.combat.shake(0.3); b.fxAt('frost', b.R.tip, 20);
  yield 0.6;
  b.pose({ bellow: 0 }, 6);
  for (let i = 0; i < 3; i++) { yield* charge(b, b.tgt, 0.5); b.track = 6; yield 0.3; }
  b.track = 0; b.recT = 2.0;
}

// ================================================================ PILZHAIN 2) PILZGOLEM – Schwammfaust (wuchtig, Pilzhut, Baumschwamm-Keule)
const GOLEM = {
  radius: 1.35, height: 3.8, walk: 2.2, run: 4.5, turn: 2.2, accel: 3, keep: [2.8, 4.6], circle: 0.5,
  wakeR: 22, leash: 60, gap: 1.0, stgMax: 5, stgDecay: 0.3, kbMul: 0.06, p2speed: 1.2, p2tempo: 1.15,
  tiltL: 0.8, tiltW: 0.7, tiltMul: 0.5, wakeRate: 1.1, deathDur: 2.0, deathFx: 'dark',
  glow: 0x9aff3a, emberColor: 0xb0ff40, emberSize: 0.14, emberRise: 0.4, emberN: 56,
  poseKeys: ['raiseL', 'raiseR', 'punchL', 'punchR', 'both', 'slam', 'inhale', 'spit', 'crouch'],
  minionAttacks: ['punch', 'spit'],
  build(B) {
    const BR = 0x6a5a3a, BR2 = 0x7a6a44, DK = 0x3a3020, CP = 0x8a3a2a, CP2 = 0xe8d8b8, MO = 0x4a6a2a;
    const G1 = 0x9aff3a, G2 = 0xd8ff4a, G3 = 0x3affb0;
    const R = { legs: [], arms: [] };
    R.py = 1.1;
    for (const s of [1, -1]) R.legs.push(addLeg(B, B.mdl, { x: s * 0.55, y: R.py, z: 0, l1: 0.55, l2: 0.55, r: 0.3, c1: BR, c2: BR2, fc: DK, foot: 'block' }));
    R.hips = grp(B.mdl, 0, R.py, 0);
    R.torso = grp(R.hips, 0, 0.1, 0);
    const t = new MeshBuilder(), tl = new MeshBuilder();
    t.ico(1, BR, { y: 0.9, sx: 1.05, sy: 0.95, sz: 0.85, jitter: 0.15 }, 1);
    t.ico(0.6, BR2, { x: 0.5, y: 1.4, z: -0.3, jitter: 0.12 }, 0); t.ico(0.55, BR2, { x: -0.55, y: 0.6, z: 0.3, jitter: 0.12 }, 0);
    t.sphere(1, MO, { y: 0.5, z: 0.6, sx: 0.6, sy: 0.4, sz: 0.3 }, 7, 4);                        // Moosbart
    // kleine Leuchtpilze über den Körper
    const spots = [[0.6, 1.5, 0.5], [-0.4, 1.7, 0.4], [0.8, 0.8, 0.3], [-0.85, 1.1, -0.1], [0.2, 1.9, -0.5], [-0.3, 0.4, -0.7], [0.7, 0.4, -0.5], [-0.6, 1.6, -0.5], [0.1, 1.2, 0.85]];
    spots.forEach(([x, y, z], i) => {
      const c = [G1, G2, G3][i % 3], s = 0.8 + (i % 3) * 0.25;
      t.cyl(0.03 * s, 0.04 * s, 0.2 * s, CP2, { x, y: y + 0.08 * s, z }, 4);
      tl.sphere(0.12 * s, c, { x, y: y + 0.2 * s, z, sy: 0.5 }, 6, 3);
    });
    R.torso.add(t.mesh(B.mat)); R.torso.add(tl.mesh(B.lumMat));
    // Kopf = breiter Hut, Lamellen leuchten, Augen darunter
    R.head = grp(R.torso, 0, 1.85, 0.25);
    const h = new MeshBuilder(), hl = new MeshBuilder(), hg = new MeshBuilder();
    h.sphere(1, CP, { y: 0.35, sx: 1.25, sy: 0.5, sz: 1.15 }, 12, 6);
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, r = 0.45 + (i % 3) * 0.25; h.sphere(0.1 + (i % 2) * 0.05, CP2, { x: Math.sin(a) * r, y: 0.72 - r * 0.25, z: Math.cos(a) * r, sy: 0.4 }, 5, 3); }
    hl.cone(1.2, 0.3, G1, { y: 0.12, rx: PI, sz: 0.92 }, 12);                                          // Lamellen
    h.sphere(1, BR2, { y: -0.1, z: 0.2, sx: 0.5, sy: 0.35, sz: 0.45 }, 7, 5);
    for (const s of [1, -1]) { h.sphere(0.09, 0x080a04, { x: s * 0.2, y: -0.06, z: 0.56, jitter: 0 }, 5, 4); hg.sphere(0.05, 0, { x: s * 0.2, y: -0.06, z: 0.62 }, 5, 3); }
    R.head.add(h.mesh(B.mat)); R.head.add(hl.mesh(B.lumMat)); R.head.add(hg.mesh(B.glowMat));
    R.mouth = grp(R.head, 0, -0.25, 0.6);
    // Linker Arm: Baumschwamm-Keule (riesig), rechter Arm: Wurzelfaust
    const club = f => {
      for (let k = 0; k < 4; k++) f.sphere(1, k % 2 ? CP : 0x9a6a3a, { y: -0.95 - k * 0.2, z: 0.1, sx: 0.55 - k * 0.04, sy: 0.14, sz: 0.5 - k * 0.03, rx: 0.2 }, 9, 4);
      f.ico(0.42, DK, { y: -1.25, jitter: 0.12 }, 0);
    };
    const fist = f => { f.ico(0.4, DK, { y: -1.0, jitter: 0.12 }, 0); for (let k = 0; k < 3; k++) seg(f, [(k - 1) * 0.15, -1.15, 0.15], [(k - 1) * 0.22, -1.5, 0.3], 0.07, 0.03, BR, 4); };
    for (const s of [1, -1]) {
      const A = arm(B, R.torso, s * 1.1, 1.35, 0.1, { l1: 0.9, l2: 0.85, r: 0.3, c1: BR2, c2: BR, cs: BR, ex2: s > 0 ? club : fist,
        ex1: a => a.ico(0.45, BR, { y: 0.05, x: s * 0.1, jitter: 0.12 }, 0) });
      A.fist = grp(A.hand, 0, -0.4, 0.1); R.arms.push(A);
      const al = new MeshBuilder(); al.sphere(0.1, s > 0 ? G3 : G2, { x: s * 0.2, y: -0.3, z: 0.25, sy: 0.5 }, 5, 3); al.sphere(0.08, G1, { x: -s * 0.1, y: -0.55, z: -0.25, sy: 0.5 }, 5, 3);
      A.sh.add(al.mesh(B.lumMat));
    }
    return R;
  },
  animate(b, dt) {
    const R = b.R, P = b.pc, sp = b.spd, sl = b.sleepK, dk = b.deadK, T = b.T, st = stunK(b);
    const mov = clamp(sp / 2.2, 0, 1); b.gph += dt * (1.5 + sp * 1.4);
    const ph = b.gph, amp = mov * (1 - sl) * (1 - dk), sit = Math.max(sl * 0.9, dk);
    R.hips.position.y = R.py + Math.abs(Math.sin(ph)) * 0.09 * amp - sit * 0.55 - P.crouch * 0.3 - P.slam * 0.3 + P.both * 0.15 + Math.sin(T * 1.4) * 0.03 - st * 0.15;
    for (const L of R.legs) legWalk(L, ph, amp, sit, P.crouch + P.slam * 0.4);
    R.torso.rotation.x = 0.12 + P.slam * 0.5 - P.both * 0.3 + P.crouch * 0.2 - P.inhale * 0.25 + P.spit * 0.3 + sl * 0.35 + dk * 0.5 + st * 0.3 - b.flinch * 0.15;
    R.torso.rotation.y = P.raiseL * 0.5 - P.punchL * 0.4 - P.raiseR * 0.5 + P.punchR * 0.4 + Math.sin(ph) * 0.1 * amp;
    R.torso.rotation.z = Math.sin(ph) * 0.08 * amp + st * Math.sin(T * 2.5) * 0.1;
    const inf = 1 + P.inhale * 0.18 - P.spit * 0.05;
    R.torso.scale.set(inf, 1 + P.inhale * 0.06, inf);
    R.head.rotation.x = -0.05 + sl * 0.35 - P.inhale * 0.3 + P.spit * 0.35 + st * 0.3;
    R.head.rotation.y = clamp(b.lookErr, -0.5, 0.5) * 0.5 * (1 - sl);
    R.head.rotation.z = st * Math.sin(T * 3) * 0.15;
    const sw = Math.sin(ph) * 0.3 * amp;
    for (const A of R.arms) { const L = A.side > 0; poseArm(A, P, -0.25 + (L ? sw : -sw), 0, 0.25, -0.35, L ? GOLEM_AL : GOLEM_AR, GOLEM_S, sl, GOLEM_D, dk); }
    b.mdl.position.y = -dk * 0.3;
    const g = (0.35 + 0.65 * (1 - sl)) * (1 - dk * 0.7) * (0.85 + Math.sin(T * 2.3) * 0.15) * (1 + P.inhale * 0.8) * (b.phase === 2 ? 1.25 : 1);
    b.lumMat.color.setScalar(g); b.glowMat.emissiveIntensity = g;
  },
  emit(b, dt) {
    if (b.state === 'dead') return;
    if (Math.random() < dt * (b.sleepK > 0.5 ? 3 : 8) * (b.phase === 2 ? 1.8 : 1)) {
      b.worldOf(b.R.head, rnd(-1, 1), 0.1, rnd(-1, 1), _v);
      b.embers.emit(_v.x, _v.y, _v.z, rnd(-0.2, 0.2), -0.05, rnd(-0.2, 0.2), 2.0);
    }
  },
  *wake(b) {
    b.combat.fx('dust', b.fxPos(b.pos.x, b.pos.y + 0.4, b.pos.z), 16); yield 1.2;
    b.pose({ inhale: 1, both: 0.4 }, 3); yield 0.9;
    b.pose({ inhale: 0, both: 0, spit: 1 }, 10); b.fxAt('dark', b.R.mouth, 18); b.combat.shake(0.3); yield 0.5;
    b.pose({ spit: 0 }, 4); yield 0.3;
  },
  attacks: [
    { id: 'punch', min: 0, max: 4.6, cd: 2.8, w: 3, ang: 0.8, *run(b, t) {
      const n = b.phase === 2 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const L = i % 2 === 0, A = b.R.arms[L ? 0 : 1];
        b.track = 3.5; b.pose(L ? { raiseL: 1, punchL: 0 } : { raiseR: 1, punchR: 0 }, 8);
        if (i === 0) b.tele({ pos: b.pos.clone(), radius: 4.2, duration: 0.55, shape: 'cone', dir: b.fwd(new V3()), angle: 1.5 });
        yield i === 0 ? 0.55 : 0.45;
        b.track = 0.8; b.drive = 5; b.pose(L ? { raiseL: 0, punchL: 1 } : { raiseR: 0, punchR: 1 }, 22);
        b.hit({ radius: 1.25, duration: 0.2, damage: L ? 19 : 15, knockback: 8, stagger: 0.5, at: b.boneAt(A.fist), onHitFx: 'spark' });
        yield 0.2; b.drive = 0; yield 0.25;
        b.pose(L ? { punchL: 0 } : { punchR: 0 }, 6);
      }
      b.recT = 0.9;
    } },
    { id: 'slam', min: 0, max: 5, cd: 6, w: 2, ang: 3.2, *run(b, t) {
      b.pose({ both: 1, crouch: 0.4 }, 4);
      b.tele({ pos: b.pos.clone(), radius: 4.8, duration: 0.9, shape: 'circle' });
      yield 0.45;
      let tt = 0; b.tickFn = dt => { tt += dt; b.leapY = Math.sin(PI * clamp(tt / 0.45, 0, 1)) * 0.9; };
      b.pose({ crouch: 0 }, 6);
      yield 0.45;
      b.tickFn = null; b.leapY = 0; b.pose({ both: 0, slam: 1 }, 24);
      yield 0.08;
      const c = b.pos.clone(); c.y += 0.6;
      b.hit({ radius: 4.8, duration: 0.15, damage: 24, knockback: 11, stagger: 0.7, at: () => c, kind: 'slam', onHitFx: 'dark' });
      b.combat.fx('dust', c, 30); b.combat.fx('dark', c, 16); b.combat.shake(0.8); wave(b, c, 4.8, 0x9aff3a);
      for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; b.embers.emit(c.x, c.y, c.z, Math.sin(a) * 5, 1.5, Math.cos(a) * 5, 1.6); }
      yield 0.6;
      b.pose({ slam: 0.6 }, 2); yield 0.4; b.pose({ slam: 0 }, 3);
      b.recT = 1.4;                                                                    // Fäuste im Boden
    } },
    { id: 'spit', min: 5, max: 20, cd: 4.5, w: 2, ang: 0.6, *run(b, t) {
      b.track = 2.5; b.pose({ inhale: 1 }, 4);
      yield 0.7;
      b.pose({ inhale: 0, spit: 1 }, 18);
      const n = b.phase === 2 ? 5 : 3, M = b.worldOf(b.R.mouth), T = 1.0, g = 14;
      for (let i = 0; i < n; i++) {
        const a = (i - (n - 1) / 2) * 0.5 + rnd(-0.1, 0.1), r = i === (n - 1) / 2 ? 0 : 2.2 * b.S;
        const land = new V3(t.pos.x + Math.sin(b.yaw + PI / 2 + a) * r * Math.sign(a || 1), 0, t.pos.z + Math.cos(b.yaw + PI / 2 + a) * r * Math.sign(a || 1));
        land.y = b.world.heightAt(land.x, land.z);
        b.tele({ pos: land.clone(), radius: 1.9, duration: T, shape: 'circle', color: 0x9aff3a });
        const vel = new V3((land.x - M.x) / T, (land.y - M.y + 0.5 * g * T * T) / T, (land.z - M.z) / T);
        b.proj({ pos: M.clone(), vel, radius: 0.35, damage: 13, life: T + 0.3, gravity: g, fx: 'dark', explodeRadius: 1.9, knockback: 4, stagger: 0.3,
          onExpire: q => b.combat.fx('dark', q, 10) });
      }
      b.fxAt('dark', b.R.mouth, 12);
      yield 0.5;
      b.pose({ spit: 0 }, 4); b.recT = 0.7;
    } },
    { id: 'fruiting', p2: true, min: 3, max: 18, cd: 8, w: 3, ang: 0.5, run: fruiting },
  ],
  enrage: b => fruiting(b),
};
function* fruiting(b) {
  b.pose({ both: 1, inhale: 0.5 }, 4); b.track = 1.6;
  yield 0.5;
  b.track = 0;
  const dir = b.fwd(new V3()), start = b.ahead(2.2);
  b.tele({ pos: start.clone(), radius: 1.5, duration: 0.55 + 0.1 * 10, shape: 'line', dir, length: 16, color: 0x9aff3a });
  yield 0.45;
  b.pose({ both: 0, slam: 1, inhale: 0 }, 22); yield 0.1;
  b.combat.shake(0.7);
  for (let i = 0; i < 10; i++) {
    const p = start.clone().addScaledVector(dir, i * 1.6 * b.S); p.y = b.world.heightAt(p.x, p.z) + 0.6;
    b.hit({ radius: 1.6, duration: 0.18, damage: 16, knockback: 8, stagger: 0.5, at: () => p, kind: 'spell', onHitFx: 'dark' });
    b.combat.fx('dark', p, 8); b.combat.fx('dust', p, 5);
    for (let k = 0; k < 4; k++) b.embers.emit(p.x + rnd(-0.6, 0.6), p.y, p.z + rnd(-0.6, 0.6), 0, 3 + Math.random() * 2, 0, 1.2);
    yield 0.1;
  }
  b.pose({ slam: 0.5 }, 3); yield 0.3;
  b.pose({ slam: 0 }, 3); b.recT = 1.4;
}

// ================================================================ PILZHAIN 3) SPORENKÖNIGIN – Myzelia (Siegelträgerin: Riesenpilz mit Königinnen-Torso)
const SPORE = {
  radius: 2.3, height: 5.6, walk: 1.6, run: 2.6, turn: 1.2, accel: 1.6, keep: [4, 8], circle: 0.5,
  wakeR: 22, leash: 60, gap: 1.0, stgMax: 7, stgDecay: 0.3, kbMul: 0.02, p2speed: 1.15, p2tempo: 1.12,
  tiltL: 1.4, tiltW: 1.4, tiltMul: 0.3, wakeRate: 0.8, deathDur: 2.4, deathFx: 'dark',
  glow: 0xff4ad8, emberColor: 0xff7af0, emberSize: 0.15, emberRise: 0.45, emberN: 96,
  poseKeys: ['lashL', 'swingL', 'lashR', 'swingR', 'raise', 'pulse', 'bloom', 'hunch'],
  minionAttacks: ['lash', 'spores'],
  build(B) {
    const ST = 0xd8d0e8, ST2 = 0xb8b0d0, CP = 0x5a2a7a, CP2 = 0x7a3a9a, RT = 0x3a2048, SK = 0xa8c8d8, HR = 0x2a1238;
    const M1 = 0xff4ad8, M2 = 0x3affe0, M3 = 0xb060ff;
    const R = { roots: [], tent: [] };
    R.core = grp(B.mdl, 0, 0, 0);
    const b = new MeshBuilder(), lm = new MeshBuilder();
    b.sphere(1, RT, { y: 0.15, sx: 1.9, sy: 0.45, sz: 1.9 }, 10, 5);                                  // Wurzelhügel
    b.cyl(0.85, 1.25, 3.8, ST, { y: 2.1 }, 10);                                                        // Stiel
    b.cyl(1.3, 1.1, 0.25, ST2, { y: 3.45 }, 10);                                                      // Ring/Manschette
    for (let k = 0; k < 7; k++) lm.sphere(0.1 + (k % 3) * 0.04, k % 2 ? M2 : M1, { x: Math.sin(k * 2.3) * 1.0, y: 0.7 + k * 0.32, z: Math.cos(k * 2.3) * 1.0, sy: 0.6 }, 5, 3);
    R.core.add(b.mesh(B.mat)); R.core.add(lm.mesh(B.lumMat));
    for (let i = 0; i < 8; i++) {                                                                       // Wurzelranken
      const a = i / 8 * TAU + 0.2, g = grp(R.core, Math.sin(a) * 1.2, 0.25, Math.cos(a) * 1.2); g.rotation.y = a;
      const rb = new MeshBuilder(); seg(rb, [0, 0, 0], [0, -0.1, 0.9], 0.2, 0.14, RT, 5); seg(rb, [0, -0.1, 0.9], [0, -0.25, 1.7], 0.14, 0.04, RT, 4);
      rb.sphere(0.07, i % 2 ? M1 : M2, { y: -0.05, z: 1.2 }, 4, 3);
      g.add(rb.mesh(B.mat)); R.roots.push(g);
    }
    // Königinnen-Torso vorn aus dem Stiel
    R.queen = grp(R.core, 0, 2.05, 0.9);
    const q = new MeshBuilder(), ql = new MeshBuilder(), qg = new MeshBuilder();
    q.cyl(0.32, 0.5, 0.9, SK, { y: 0.1, z: -0.05 }, 8);
    q.sphere(1, SK, { y: 0.6, sx: 0.42, sy: 0.32, sz: 0.3 }, 8, 6);
    for (let k = 0; k < 7; k++) q.box(0.12, 1.3 - k * 0.08, 0.05, HR, { x: (k - 3) * 0.1, y: 0.4, z: -0.25 - Math.abs(k - 3) * 0.02, rx: 0.15 });   // Haar
    R.queen.add(q.mesh(B.mat));
    R.head = grp(R.queen, 0, 1.0, 0.05);
    const h = new MeshBuilder(), hl = new MeshBuilder(), hg = new MeshBuilder();
    h.sphere(1, SK, { y: 0.1, sx: 0.22, sy: 0.27, sz: 0.24 }, 8, 6);
    h.sphere(1, HR, { y: 0.18, z: -0.06, sx: 0.25, sy: 0.27, sz: 0.25 }, 8, 6);
    for (const s of [1, -1]) { h.sphere(0.05, 0x08040c, { x: s * 0.08, y: 0.12, z: 0.2, jitter: 0 }, 5, 4); hg.sphere(0.03, 0, { x: s * 0.08, y: 0.12, z: 0.23 }, 4, 3); }
    for (let k = 0; k < 7; k++) {                                                                       // Pilzkrone
      const a = -1.2 + k * 0.4, x = Math.sin(a) * 0.22, z = Math.cos(a) * 0.12, hh = 0.25 + (k === 3 ? 0.2 : (3 - Math.abs(k - 3)) * 0.05);
      h.cyl(0.02, 0.03, hh, ST, { x, y: 0.35 + hh / 2, z }, 4); hl.sphere(0.07 + (k === 3 ? 0.04 : 0), k % 2 ? M2 : M1, { x, y: 0.35 + hh, z, sy: 0.5 }, 6, 3);
    }
    R.head.add(h.mesh(B.mat)); R.head.add(hl.mesh(B.lumMat)); R.head.add(hg.mesh(B.glowMat));
    R.arms = [];
    for (const s of [1, -1]) {
      const A = arm(B, R.queen, s * 0.45, 0.65, 0, { l1: 0.75, l2: 0.75, r: 0.07, c1: SK, c2: SK,
        ex2: f => { for (let k = 0; k < 4; k++) seg(f, [(k - 1.5) * 0.04, -0.72, 0], [(k - 1.5) * 0.08, -1.05, 0.08], 0.02, 0.008, HR, 3); } });
      R.arms.push(A);
    }
    // Großer Hut
    R.cap = grp(R.core, 0, 4.0, 0);
    const c = new MeshBuilder(), cl = new MeshBuilder();
    c.add(new THREE.SphereGeometry(1, 14, 6, 0, TAU, 0, PI / 2), CP, { sx: 3.2, sy: 1.4, sz: 3.2 });
    c.add(new THREE.SphereGeometry(1, 14, 3, 0, TAU, PI / 2 - 0.35, 0.35), CP2, { sx: 3.22, sy: 1.4, sz: 3.22 }); // dunklerer Rand
    for (let i = 0; i < 18; i++) {                                                                      // Leuchtflecken
      const a = i * 2.39996, r = 0.3 + (i % 6) * 0.45, y = 1.4 * Math.sqrt(Math.max(0, 1 - (r / 3.2) ** 2));
      cl.sphere(0.16 + (i % 3) * 0.06, [M1, M2, M3][i % 3], { x: Math.sin(a) * r, y: y + 0.02, z: Math.cos(a) * r, sy: 0.4 }, 6, 3);
    }
    cl.cone(3.1, 0.7, M1, { y: 0.05, rx: PI, sz: 1 }, 16);                                              // Lamellen-Unterseite
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; c.cone(0.12, 0.6, CP, { x: Math.sin(a) * 3.0, y: 0.0, z: Math.cos(a) * 3.0, rx: PI }, 4); } // Tropfranken
    R.cap.add(c.mesh(B.mat)); R.cap.add(cl.mesh(B.lumMat));
    // Peitschenranken (2): Kette aus 3 Gliedern je Seite
    for (const s of [1, -1]) {
      const base = grp(R.core, s * 1.05, 1.4, 0.4); base.rotation.order = 'YXZ';
      const chain = []; let parent = base;
      for (let k = 0; k < 3; k++) {
        const L = 1.3 - k * 0.2, g = k === 0 ? base : grp(parent, 0, 0, 1.3 - (k - 1) * 0.2);
        const tb = new MeshBuilder(); seg(tb, [0, 0, 0], [0, 0, L], 0.22 - k * 0.06, 0.16 - k * 0.05, RT, 5);
        tb.sphere(0.08, k % 2 ? M2 : M1, { y: 0.12, z: L * 0.5 }, 4, 3);
        if (k === 2) tb.cone(0.1, 0.4, M3, { z: L + 0.15, rx: PI / 2 }, 4);
        g.add(tb.mesh(B.mat)); chain.push(g); parent = g;
      }
      R.tent.push({ chain, side: s, tip: grp(chain[2], 0, 0, 1.0) });
    }
    return R;
  },
  animate(b, dt) {
    const R = b.R, P = b.pc, sp = b.spd, sl = b.sleepK, dk = b.deadK, T = b.T, st = stunK(b);
    const mov = clamp(sp / 1.5, 0, 1); b.gph += dt * (1 + sp * 1.2);
    const ph = b.gph;
    R.core.position.y = Math.sin(T * 1.1) * 0.05 - dk * 1.4 - sl * 0.3;
    R.core.rotation.x = Math.sin(ph) * 0.04 * mov + st * 0.1 + P.hunch * 0.1;
    R.core.rotation.z = st * Math.sin(T * 2) * 0.06 + dk * 0.25;
    R.roots.forEach((g, i) => { g.rotation.x = Math.sin(ph * 2 + i * 1.3) * 0.25 * mov + Math.sin(T * 1.5 + i) * 0.05 - P.bloom * 0.3 + sl * 0.1; });
    const capK = 1 + P.pulse * 0.12 + P.bloom * 0.25 + Math.sin(T * (b.phase === 2 ? 3 : 1.4)) * 0.02;
    R.cap.scale.set(capK, 1 + P.pulse * 0.08 - P.bloom * 0.15 - dk * 0.3, capK);
    R.cap.rotation.x = Math.sin(T * 0.7) * 0.03 + P.hunch * 0.15 + dk * 0.35 + st * 0.1;
    R.cap.rotation.z = Math.sin(T * 0.9) * 0.03 - dk * 0.2;
    R.queen.rotation.x = 0.1 + sl * 0.6 + P.hunch * 0.4 - P.raise * 0.35 + st * 0.4 + dk * 0.9 - b.flinch * 0.2;
    R.queen.rotation.y = clamp(b.lookErr, -0.7, 0.7) * 0.5 * (1 - sl) + P.lashL * 0.3 - P.lashR * 0.3;
    R.head.rotation.x = -0.1 + sl * 0.3 - P.raise * 0.4 + st * 0.3;
    for (const A of R.arms) {
      const s = A.side;
      let x = -0.4 + Math.sin(T * 1.3 + s) * 0.1, z = 0.35 + Math.sin(T * 1.7) * 0.05, e = -0.7;
      x += (-2.6 - x) * P.raise; z += (0.6 - z) * P.raise; e += (-0.4 - e) * P.raise;
      x += (-1.6 - x) * P.bloom; z += (1.3 - z) * P.bloom;
      const l = s > 0 ? P.lashL : P.lashR; x += (-1.8 - x) * l; z += (1.0 - z) * l;
      x = lerp(x, -0.1, Math.max(sl, dk) * 0.8); e = lerp(e, -0.2, dk);
      A.sh.rotation.set(x, 0, z * s); A.el.rotation.x = e;
    }
    for (const Tn of R.tent) {
      const s = Tn.side, l = s > 0 ? P.lashL : P.lashR, w = s > 0 ? P.swingL : P.swingR;
      // Ruhe: am Boden kringelnd; lash = nach hinten-außen gezogen + hoch; swing = vorn über die Gegenseite gefegt
      const base = Tn.chain[0];
      base.rotation.y = s * (0.6 + l * 1.4 - w * 2.3) + Math.sin(T * 1.2 + s) * 0.1;
      base.rotation.x = 0.4 - l * 0.6 - w * 0.1 + sl * 0.3 + dk * 0.5;
      for (let k = 1; k < 3; k++) {
        const c = Tn.chain[k];
        c.rotation.x = 0.25 + Math.sin(T * 2 + k + s) * 0.15 * (1 - w) - l * 0.3 + sl * 0.3;
        c.rotation.y = s * (Math.sin(T * 1.6 + k * 1.4) * 0.25 * (1 - w - l) - w * 0.35 + l * 0.3);
      }
    }
    const g = (0.35 + 0.65 * (1 - sl)) * (1 - dk * 0.75) * (0.85 + Math.sin(T * 2) * 0.15) * (1 + P.pulse * 0.7 + P.bloom * 1.0) * (b.phase === 2 ? 1.2 : 1);
    b.lumMat.color.setScalar(g); b.glowMat.emissiveIntensity = g * 1.3;
  },
  emit(b, dt) {
    if (b.state === 'dead') return;
    const rate = (b.sleepK > 0.5 ? 6 : 16) * (b.phase === 2 ? 1.8 : 1);
    if (Math.random() < dt * rate) {
      const a = Math.random() * TAU, r = 0.5 + Math.random() * 2.6;
      b.worldOf(b.R.cap, Math.sin(a) * r, 0, Math.cos(a) * r, _v);
      b.embers.emit(_v.x, _v.y, _v.z, rnd(-0.2, 0.2), -0.3, rnd(-0.2, 0.2), 2.6);
    }
  },
  *wake(b) {
    b.combat.fx('dark', b.fxPos(b.pos.x, b.pos.y + 1, b.pos.z), 20); yield 1.4;
    b.pose({ raise: 1, pulse: 1, hunch: 0 }, 2.5); b.combat.shake(0.35);
    for (let i = 0; i < 30; i++) { const a = i / 30 * TAU; b.worldOf(b.R.cap, Math.sin(a) * 3, 0, Math.cos(a) * 3, _v); b.embers.emit(_v.x, _v.y, _v.z, Math.sin(a) * 2, 0.5, Math.cos(a) * 2, 2); }
    yield 1.3;
    b.pose({ raise: 0, pulse: 0 }, 3); yield 0.4;
  },
  attacks: [
    { id: 'lash', min: 0, max: 8, cd: 3.2, w: 3, ang: 1.0, *run(b, t) {
      const both = b.phase === 2;
      for (let i = 0; i < (both ? 2 : 1); i++) {
        const L = i === 0 ? Math.random() < 0.5 : !b._lashL; b._lashL = L;
        const Tn = b.R.tent[L ? 0 : 1];
        b.track = 2; b.pose(L ? { lashL: 1, swingL: 0 } : { lashR: 1, swingR: 0 }, 6);
        b.tele({ pos: b.pos.clone(), radius: 7.0, duration: i ? 0.5 : 0.65, shape: 'cone', dir: b.fwd(new V3()), angle: 1.9, color: 0xff4ad8 });
        yield i ? 0.5 : 0.65;
        b.track = 0; b.pose(L ? { lashL: 0, swingL: 1 } : { lashR: 0, swingR: 1 }, 14);
        b.hit({ radius: 1.9, duration: 0.32, damage: 20, knockback: 10, stagger: 0.55, at: b.boneAt(Tn.chain[2], 0, 0, 0.3), onHitFx: 'dark' });
        yield 0.35;
        b.pose(L ? { swingL: 0 } : { swingR: 0 }, 4); yield 0.25;
      }
      b.recT = 1.0;
    } },
    { id: 'spores', min: 0, max: 24, cd: 6, w: 2, ang: 3.2, *run(b, t) {
      b.pose({ raise: 1, pulse: 0.6 }, 5);
      const pts = [];
      for (const p of b.alivePlayers([], 30 * b.S + 4)) pts.push(p.pos.clone());
      for (let i = 0; i < (b.phase === 2 ? 4 : 2); i++) { const a = Math.random() * TAU, r = 2.5 * b.S + Math.random() * 4 * b.S; pts.push(new V3(t.pos.x + Math.sin(a) * r, 0, t.pos.z + Math.cos(a) * r)); }
      for (const p of pts) { p.y = b.world.heightAt(p.x, p.z); b.tele({ pos: p, radius: 2.6, duration: 1.5, shape: 'circle', color: 0xd04aff }); }
      yield 0.5;
      for (const p of pts) for (let k = 0; k < 4; k++) b.embers.emit(p.x + rnd(-1.5, 1.5) * b.S, p.y + 2.5 * b.S, p.z + rnd(-1.5, 1.5) * b.S, 0, -1.2, 0, 1.2);
      yield 1.0;
      b.pose({ raise: 0, pulse: 1 }, 14);
      for (const p of pts) {
        const c = p.clone(); c.y += 0.6;
        b.hit({ radius: 2.6, duration: 0.25, damage: 15, knockback: 5, stagger: 0.4, at: () => c, kind: 'spell', onHitFx: 'dark' });
        b.combat.fx('dark', c, 16);
        for (let k = 0; k < 6; k++) b.embers.emit(c.x + rnd(-1.5, 1.5) * b.S, c.y, c.z + rnd(-1.5, 1.5) * b.S, 0, 2 + Math.random() * 2, 0, 1.1);
      }
      yield 0.5;
      b.pose({ pulse: 0 }, 4); b.recT = 0.7;
    } },
    { id: 'seeds', min: 7, max: 28, cd: 5, w: 2, ang: 0.8, *run(b, t) {
      b.track = 1.5; b.pose({ pulse: 1, hunch: 0.4 }, 4);
      yield 0.7;
      b.track = 0; b.pose({ pulse: 0, hunch: 0 }, 16);
      const n = b.phase === 2 ? 5 : 3, T = 1.1, g = 14;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, r = i === 0 ? 0 : 1.5 + Math.random() * 3.5;
        const land = new V3(t.pos.x + Math.sin(a) * r, 0, t.pos.z + Math.cos(a) * r); land.y = b.world.heightAt(land.x, land.z);
        const S0 = b.worldOf(b.R.cap, rnd(-1.5, 1.5), 1.2, rnd(-1.5, 1.5));
        b.tele({ pos: land.clone(), radius: 2.2, duration: T, shape: 'circle', color: 0x3affe0 });
        const vel = new V3((land.x - S0.x) / T, (land.y - S0.y + 0.5 * g * T * T) / T, (land.z - S0.z) / T);
        b.proj({ pos: S0, vel, radius: 0.45, damage: 16, life: T + 0.3, gravity: g, fx: 'frost', explodeRadius: 2.2, knockback: 6, stagger: 0.45,
          onExpire: q => b.combat.fx('frost', q, 12) });
      }
      yield 0.6; b.recT = 0.6;
    } },
    { id: 'bloom', p2: true, min: 0, max: 26, cd: 10, w: 3, ang: 3.2, run: bloom },
  ],
  enrage: b => bloom(b),
};
function* bloom(b) {
  b.pose({ hunch: 0.6, pulse: 1, raise: 0.4 }, 3);
  const c = b.pos.clone(); c.y += 0.8;
  b.tele({ pos: b.pos.clone(), radius: 9, duration: 1.3, shape: 'circle', color: 0xff4ad8 });
  yield 1.3;
  b.pose({ hunch: 0, pulse: 0, bloom: 1, raise: 1 }, 18);
  b.hit({ radius: 9, duration: 0.2, damage: 26, knockback: 13, stagger: 0.7, at: () => c, kind: 'spell', onHitFx: 'dark' });
  b.combat.fx('dark', c, 40); b.combat.shake(0.9); wave(b, c, 9, 0xff7af0, 0.55);
  for (let i = 0; i < 40; i++) { const a = i / 40 * TAU; b.embers.emit(c.x, c.y + 2, c.z, Math.sin(a) * 8, 2, Math.cos(a) * 8, 1.3); }
  yield 0.5;
  const t = b.tgt;
  for (let i = 0; i < 4; i++) {
    const p = b.worldOf(b.R.cap, Math.sin(i / 4 * TAU) * 2.5, 1, Math.cos(i / 4 * TAU) * 2.5);
    const vel = new V3(p.x - b.pos.x, 2, p.z - b.pos.z).normalize().multiplyScalar(5);
    b.proj({ pos: p, vel, radius: 0.4, damage: 12, life: 5, fx: 'dark', homing: t ? t.actor : null, homingRate: 2.5, knockback: 4, stagger: 0.3 });
  }
  yield 0.6;
  b.pose({ bloom: 0, raise: 0 }, 3); b.recT = 1.6;
}

const DEFS2 = { rabenritter: RABE, henker: HENK, glockenwaechter: GLOCKE, myzelhirsch: HIRSCH, pilzgolem: GOLEM, sporenkoenigin: SPORE };

/** createBoss2(type, { scene, world, combat, home, yaw, variant }) – gleiche Signatur/Rückgabe wie createBoss. */
export function createBoss2(type, { scene, world, combat, home, yaw, variant } = {}) {
  const def = DEFS2[type];
  if (!def) throw new Error('Unbekannter Boss: ' + type);
  return new Boss(type, def, { scene, world, combat, home, yaw, variant, info: BOSS_INFO2[type] });
}
