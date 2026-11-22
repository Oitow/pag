// Viniland – Loot: Drop-Tabellen, Welt-Pickups (glühender Gegenstand + Lichtsäule in Seltenheitsfarbe), Glutreste,
// Glut-Partikel (fliegen zum Spieler). Aufheben per interact oder OPTIONS.autoPickup.
import * as THREE from 'three';
import { psxMat } from './psx.js';
import { MeshBuilder } from './kit.js';
import { RARITIES, RARITY_ORDER, RELICS, BOSS_REWARDS, makeItem, weaponIds, spellIds, itemName } from './items.js';

// Seltenheits-Gewichte [common, rare, epic, legendary]
const W_MOB = [72, 23, 4.5, 0.5], W_ELITE = [35, 42, 19, 4], W_BOSS = [0, 15, 55, 30];

/**
 * Tabelle: { glut:[min,max]?, rolls:[{ chance, pick:'weapon'|'relic'|'scroll'|'any'|'<itemId>', rarity?:weights, count? }],
 *            guaranteed?:[spec] }
 * Glut normalerweise aus ENEMY_TYPES[id].glut / Boss-HP; Tabelle-glut ist nur Fallback.
 */
export const LOOT_TABLES = {
  mob_common: { glut: [25, 45], rolls: [
    { chance: 0.07, pick: 'any', rarity: W_MOB },
    { chance: 0.06, pick: 'forgeStone' },
    { chance: 0.004, pick: 'flaskShard' },
    { chance: 0.02, pick: 'glutkern' },
  ] },
  mob_elite: { glut: [90, 160], rolls: [
    { chance: 0.35, pick: 'any', rarity: W_ELITE },
    { chance: 0.25, pick: 'forgeStone' },
    { chance: 0.04, pick: 'flaskShard' },
    { chance: 0.10, pick: 'glutkern' },
  ] },
  boss_generic: { glut: [800, 1200], rolls: [
    { chance: 1, pick: 'forgeStone', count: 2 },
    { chance: 0.6, pick: 'any', rarity: W_BOSS },
    { chance: 0.5, pick: 'flaskShard' },
  ] },
};
export const DROP_INFO = 'mob_common: 7 % Item, 6 % Schmiedestein, 0,4 % Flakon-Splitter · mob_elite: 35 % Item, 25 % Stein, 4 % Splitter · Boss: Boss-Waffe + Boss-Relikt (+ Rolle) garantiert, 2 Steine, 60 % Extra-Item, 50 % Splitter, Siegel (Siegelträger)';

function weighted(w, r) {
  const s = w.reduce((a, b) => a + b, 0); let x = r() * s;
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) return RARITY_ORDER[i]; }
  return RARITY_ORDER[0];
}
function pickOne(arr, r) { return arr[Math.floor(r() * arr.length)]; }
function rollSpec(roll, r) {
  const p = roll.pick;
  const kind = p === 'any' ? weighted([55, 30, 15], r) : p;   // (Hilfsgewichte: 0=weapon,1=relic,2=scroll → via index)
  const k = p === 'any' ? ['weapon', 'relic', 'scroll'][RARITY_ORDER.indexOf(kind)] : kind;
  const rarity = roll.rarity ? weighted(roll.rarity, r) : undefined;
  if (k === 'weapon') return { weapon: pickOne(weaponIds(), r), rarity };
  if (k === 'relic') {
    const pool = Object.keys(RELICS).filter(id => !['weisse_maehne', 'laternenglas', 'kohlherz'].includes(id));
    const want = rarity || 'common';
    const best = pool.filter(id => RELICS[id].rarity === want);
    return { relic: pickOne(best.length ? best : pool, r) };
  }
  if (k === 'scroll') { const ids = spellIds(); return ids.length ? { scroll: pickOne(ids, r) } : { consumable: 'forgeStone' }; }
  return { consumable: k, count: roll.count || 1 };
}

/** Würfelt eine Tabelle. ctx = { bossType?, bossInfo?, key?, biome?, r? }. Rückgabe: { items:[inst], glut } */
export function rollLoot(tableId, ctx = {}) {
  const r = ctx.r || Math.random;
  let T = LOOT_TABLES[tableId];
  const items = [];
  if (!T && tableId?.startsWith('boss_')) T = LOOT_TABLES.boss_generic;
  if (!T) T = LOOT_TABLES.mob_common;
  // Boss: garantierte Belohnung
  if (ctx.bossType || tableId?.startsWith('boss_')) {
    const type = ctx.bossType || tableId.slice(5);
    const rew = BOSS_REWARDS[type]?.() || { weapon: pickOne(weaponIds(), r), relic: pickOne(Object.keys(RELICS), r), scroll: r() < 0.5 ? pickOne(spellIds(), r) : null };
    if (rew.weapon) items.push(makeItem({ weapon: rew.weapon, rarity: ctx.key ? 'legendary' : 'epic' }, r));
    if (rew.relic && RELICS[rew.relic]) items.push(makeItem({ relic: rew.relic }, r));
    if (rew.scroll && spellIds().includes(rew.scroll)) items.push(makeItem({ scroll: rew.scroll }, r));
    if (ctx.key && ctx.biome) items.push(makeItem({ sigil: ctx.biome }, r));
  }
  for (const g of T.guaranteed || []) items.push(makeItem(g, r));
  for (const roll of T.rolls) if (r() < roll.chance) items.push(makeItem(rollSpec(roll, r), r));
  const glut = T.glut ? Math.round(T.glut[0] + r() * (T.glut[1] - T.glut[0])) : 0;
  return { items, glut };
}

// ---------- Welt-Pickups ----------
const PILLAR_VS = /* glsl */`varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const PILLAR_FS = /* glsl */`uniform vec3 uColor; uniform float uA; uniform float uT; varying float vY;
  void main(){ float a = (1.0 - vY) * (1.0 - vY) * uA * (0.75 + 0.25 * sin(uT * 3.0 + vY * 9.0));
    gl_FragColor = vec4(uColor * a, 1.0); }`;

function pickupMesh(inst) {
  const R = RARITIES[inst.rarity] || RARITIES.common, c = R.color, b = new MeshBuilder();
  const dark = 0x2a2018, metal = 0x9aa0a8;
  if (inst.kind === 'weapon') {
    b.box(0.08, 0.75, 0.04, metal, { y: 0.45 }); b.box(0.32, 0.06, 0.08, c, { y: 0.1 }); b.box(0.06, 0.22, 0.06, dark, { y: -0.06 });
  } else if (inst.kind === 'scroll') {
    b.cyl(0.09, 0.09, 0.42, 0xe8dcb8, { rz: Math.PI / 2, y: 0.12 }); b.cyl(0.11, 0.11, 0.06, c, { rz: Math.PI / 2, x: 0.22, y: 0.12 }); b.cyl(0.11, 0.11, 0.06, c, { rz: Math.PI / 2, x: -0.22, y: 0.12 });
  } else if (inst.kind === 'relic') {
    b.ico(0.17, c, { y: 0.18 }); b.cyl(0.2, 0.2, 0.03, 0xd8b060, { y: 0.18, rx: Math.PI / 2 }, 8);
  } else if (inst.kind === 'sigil') {
    b.cyl(0.24, 0.24, 0.06, 0xffc040, { y: 0.24, rx: Math.PI / 2 }, 8); b.cone(0.1, 0.22, 0x8a1a14, { y: 0.24, z: 0.04, rx: Math.PI / 2 }, 4);
  } else if (inst.kind === 'glutrest') {
    b.ico(0.22, 0xff7a20, { y: 0.15 }); b.ico(0.12, 0xffe080, { y: 0.32, x: 0.1 });
  } else {
    b.ico(0.13, c, { y: 0.14 }); b.box(0.12, 0.12, 0.12, 0xd8c8a0, { y: 0.02 });
  }
  return b.mesh(psxMat({ emissive: new THREE.Color(c).multiplyScalar(0.55) }));
}

export class LootWorld {
  constructor(scene, world) {
    this.scene = scene; this.world = world;
    this.drops = [];   // { inst, pos, group, mesh, pillar, t, owner?, glut? }
    this.pillarGeo = new THREE.CylinderGeometry(0.1, 0.22, 7, 6, 1, true);
    this.pillarGeo.translate(0, 3.5, 0);
    this.glut = new GlutParticles(scene);
    this.t = 0;
  }
  /** Gegenstand in die Welt legen (mit kleinem Sprung aus pos heraus) */
  drop(inst, pos, { scatter = 1.2, owner = -1, glut = 0 } = {}) {
    const g = new THREE.Group();
    const a = Math.random() * Math.PI * 2, d = scatter * (0.3 + Math.random() * 0.7);
    const p = new THREE.Vector3(pos.x + Math.cos(a) * d, 0, pos.z + Math.sin(a) * d);
    p.y = this.world.groundAt ? this.world.groundAt(p.x, p.z, (pos.y || 0) + 3) : this.world.heightAt(p.x, p.z);
    if (this.world.waterLevel !== undefined && p.y < this.world.waterLevel + 0.05) p.y = Math.max(p.y, this.world.waterLevel + 0.05);
    const mesh = pickupMesh(inst); g.add(mesh);
    const col = inst.kind === 'glutrest' ? 0xff8a30 : (RARITIES[inst.rarity] || RARITIES.common).color;
    const mat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(col) }, uA: { value: inst.kind === 'glutrest' ? 0.9 : (RARITIES[inst.rarity]?.glow ?? 0.6) }, uT: { value: 0 } },
      vertexShader: PILLAR_VS, fragmentShader: PILLAR_FS, side: THREE.DoubleSide, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending });
    const pillar = new THREE.Mesh(this.pillarGeo, mat);
    pillar.scale.y = inst.kind === 'glutrest' ? 0.5 : 0.6 + RARITY_ORDER.indexOf(inst.rarity) * 0.25;
    g.add(pillar);
    g.position.copy(p);
    this.scene.add(g);
    const e = { inst, pos: p, group: g, mesh, pillar, t: Math.random() * 5, owner, glut, y0: p.y, pop: 0.6, from: pos.clone() };
    this.drops.push(e);
    return e;
  }
  remove(e) {
    const k = this.drops.indexOf(e); if (k >= 0) this.drops.splice(k, 1);
    this.scene.remove(e.group); e.mesh.geometry.dispose(); e.pillar.material.dispose();
  }
  /** nächster aufhebbarer Drop für Spieler i (Glutrest nur vom Besitzer) */
  nearest(pos, i, range = 1.9) {
    let best = null, bd = range;
    for (const e of this.drops) {
      if (e.owner >= 0 && e.owner !== i) continue;
      const d = Math.hypot(e.pos.x - pos.x, e.pos.z - pos.z);
      if (d < bd && Math.abs(e.pos.y - pos.y) < 2.5) { bd = d; best = e; }
    }
    return best;
  }
  label(e) { return e.inst.kind === 'glutrest' ? `Glutrest (${e.glut})` : itemName(e.inst); }
  update(dt, players) {
    this.t += dt;
    for (const e of this.drops) {
      e.t += dt;
      // kurzer Auswurf-Bogen, dann schweben + drehen
      if (e.pop > 0) {
        e.pop = Math.max(0, e.pop - dt); const u = 1 - e.pop / 0.6;
        e.group.position.set(e.from.x + (e.pos.x - e.from.x) * u, e.y0 + (e.from.y + 0.8 - e.y0) * (1 - u) + Math.sin(u * Math.PI) * 1.4, e.from.z + (e.pos.z - e.from.z) * u);
      } else e.group.position.set(e.pos.x, e.y0, e.pos.z);
      e.mesh.position.y = 0.35 + Math.sin(e.t * 2.2) * 0.08;
      e.mesh.rotation.y = e.t * 1.3;
      e.pillar.material.uniforms.uT.value = e.t;
    }
    this.glut.update(dt, players);
  }
  clear(filter = () => true) { for (const e of [...this.drops]) if (filter(e)) this.remove(e); }
}

// ---------- Glut-Partikel: platzen aus dem Gegner und fliegen zum Spieler ----------
const MAXG = 160;
export class GlutParticles {
  constructor(scene) {
    const b = new MeshBuilder(); b.ico(0.07, 0xffa030, {});
    this.mesh = new THREE.InstancedMesh(b.geometry(), psxMat({ emissive: new THREE.Color(0xff7a10) }), MAXG);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
    scene.add(this.mesh);
    this.ps = [];
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3();
  }
  /** n Partikel von pos zu target (Objekt mit .pos (Vector3)); onArrive pro Partikel optional */
  burst(pos, target, n = 10, onArrive) {
    for (let k = 0; k < n && this.ps.length < MAXG; k++) {
      this.ps.push({ p: new THREE.Vector3(pos.x, pos.y + 1, pos.z), v: new THREE.Vector3((Math.random() - 0.5) * 6, 3 + Math.random() * 4, (Math.random() - 0.5) * 6),
        target, t: 0, delay: 0.25 + Math.random() * 0.35, onArrive, s: 0.7 + Math.random() * 0.8 });
    }
  }
  update(dt) {
    const out = [];
    let n = 0;
    for (const q of this.ps) {
      q.t += dt;
      const tp = this._p.copy(q.target.pos); tp.y += 1.1;
      if (q.t < q.delay) { q.v.y -= 9 * dt; q.v.multiplyScalar(1 - 2 * dt); }
      else {
        const d = tp.clone().sub(q.p), L = d.length();
        if (L < 0.5 || q.t > 4) { q.onArrive?.(); continue; }
        const sp = 8 + (q.t - q.delay) * 22;
        q.v.lerp(d.multiplyScalar(sp / L), 1 - Math.exp(-7 * dt));
      }
      q.p.addScaledVector(q.v, dt);
      out.push(q);
      this._s.setScalar(q.s * (0.8 + 0.3 * Math.sin(q.t * 20)));
      this._m.compose(q.p, this._q, this._s);
      this.mesh.setMatrixAt(n++, this._m);
    }
    this.ps = out;
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
