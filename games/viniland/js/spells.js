// Viniland – Zauber (datengetrieben, je eigene Logik in cast(ctx)). 2 Slots aktiv (fighter.equipSpells).
// Def: { name, desc, icon (Emoji), school:'verstand'|'glaube', mana, cd (s), anim ('cast1'|'cast2'|'castHeal'|'castUp'), speed,
//        scaling:{ int|fai: 'A'..'E' }, base:{ dmg|heal }, range (Ziel-Suche m), cast(ctx) }
// ctx (vom Fighter): { f, combat, world, c (Controller), actor, team, yaw, dir (Vector3 vorwärts), inputDir|null, target|null,
//   origin (Vector3 Hand), power (Multiplikator aus Attribut + Relikten + Katalysator), hitOpts(o) (+Kill-Hook), addEffect(e) }
// Effekt-Objekte: { update(dt) -> true solange aktiv, dispose?() } – laufen im Fighter weiter (DoT, Wolken, Meteor-Verzögerung …).
import * as THREE from 'three';
import { psxMat } from './psx.js';

const V = () => new THREE.Vector3();
const groundPt = (ctx, dist) => {
  const p = ctx.target ? ctx.target.pos.clone() : ctx.c.pos.clone().addScaledVector(ctx.dir, dist);
  p.y = ctx.world.heightAt ? ctx.world.heightAt(p.x, p.z) : p.y;
  return p;
};
/** Wiederholender Boden-Schaden (DoT) an allen Gegnern im Kreis um getPos() */
function areaTicker(ctx, { getPos, radius, dur, every, dmg, fx, kb = 0, stagger = 0, onTick }) {
  let t = 0, acc = every * 0.5;
  const team = ctx.team;
  return {
    update(dt) {
      t += dt; acc += dt;
      const p = getPos(t);
      if (onTick) onTick(p, dt, t);
      if (acc >= every) {
        acc -= every;
        for (const a of ctx.combat.actors) {
          if (a.team === team || a.alive === false || !(a.hp > 0)) continue;
          if (Math.hypot(a.pos.x - p.x, a.pos.z - p.z) <= radius + a.radius && Math.abs(a.pos.y - p.y) < 3)
            ctx.combat.applyHit(a, ctx.hitOpts({ owner: ctx.actor, team, damage: Math.max(1, Math.round(dmg)), knockback: kb, stagger, kind: 'spell', onHitFx: fx, hitstop: 0, shake: 0.05 }), V().set(a.pos.x, a.pos.y + 1, a.pos.z));
        }
      }
      return t < dur;
    },
  };
}
/** Heilt einen Actor (nutzt actor.heal falls vorhanden) */
export function healActor(combat, a, n) {
  if (!a || a.alive === false || n <= 0) return 0;
  const before = a.hp;
  if (a.heal) a.heal(n); else a.hp = Math.min(a.maxHp ?? a.hp + n, a.hp + n);
  const got = a.hp - before;
  if (got >= 1) combat.damageNumber(V().set(a.pos.x, a.pos.y + (a.height || 1.7) * 0.9, a.pos.z), '+' + Math.round(got), 0x8aff9a);
  return got;
}

export const SPELLS = {
  glutkugel: {
    name: 'Glutkugel', icon: '🔥', school: 'verstand', desc: 'Eine suchende Glutkugel, die beim Aufprall explodiert.',
    mana: 14, cd: 0.9, anim: 'cast1', scaling: { int: 'B' }, base: { dmg: 16 }, range: 26,
    cast(ctx) {
      const from = ctx.origin.clone().addScaledVector(ctx.dir, 0.35), tg = ctx.target, vel = V();
      if (tg) vel.set(tg.pos.x, tg.pos.y + tg.height * 0.55, tg.pos.z).sub(from).normalize().multiplyScalar(21);
      else vel.copy(ctx.dir).setY(0.04).normalize().multiplyScalar(21);
      ctx.combat.projectile(ctx.hitOpts({ owner: ctx.actor, team: ctx.team, pos: from, vel, radius: 0.32, damage: Math.round(this.base.dmg * ctx.power),
        life: 2.4, fx: 'fire', homing: tg, explodeRadius: 1.8, knockback: 3, stagger: 0.3 }));
      ctx.combat.fx('fire', from, 10);
    },
  },
  frostring: {
    name: 'Frostring', icon: '❄️', school: 'verstand', desc: 'Ein Ring aus Eis bricht um dich hervor und stößt alles weg.',
    mana: 28, cd: 5, anim: 'cast2', scaling: { int: 'B' }, base: { dmg: 20 }, radius: 4.2,
    cast(ctx) {
      const c = ctx.c, pt = V().set(c.pos.x, c.pos.y + 0.8, c.pos.z), r = this.radius;
      ctx.combat.hitbox(ctx.hitOpts({ owner: ctx.actor, team: ctx.team, radius: r, duration: 0.15, damage: Math.round(this.base.dmg * ctx.power),
        knockback: 10, stagger: 0.85, kind: 'spell', onHitFx: 'frost', at: () => pt }));
      ctx.combat.shockwave(c.pos, r + 0.4, 0x9fe8ff, 0.4);
      const p = V().set(c.pos.x, c.pos.y + 0.3, c.pos.z);
      ctx.combat.fx('frost', p, 46, { ring: true, speed: 2.4, up: 1.2 });
      ctx.combat.fx('frost', p, 12, { stars: true, speed: 1.2 });
      ctx.combat.shake(0.4, c.pos);
    },
  },
  heilung: {
    name: 'Heilung', icon: '💚', school: 'glaube', desc: 'Sofortige Heilung und Nachheilen über 3 s – auch für nahe Gefährten (7 m).',
    mana: 30, cd: 6, anim: 'castHeal', scaling: { fai: 'A' }, base: { heal: 34 }, radius: 7,
    cast(ctx) {
      const c = ctx.c, amount = this.base.heal * ctx.power;
      const allies = ctx.combat.actors.filter(a => a.team === ctx.team && a.alive !== false && Math.hypot(a.pos.x - c.pos.x, a.pos.z - c.pos.z) <= this.radius);
      if (!allies.includes(ctx.actor)) allies.push(ctx.actor);
      for (const a of allies) { healActor(ctx.combat, a, amount * 0.55); ctx.combat.fx('heal', V().set(a.pos.x, a.pos.y + 1, a.pos.z), 16, { stars: true }); }
      ctx.combat.shockwave(c.pos, this.radius, 0x8aff9a, 0.5);
      ctx.combat.fx('holy', V().set(c.pos.x, c.pos.y + 0.2, c.pos.z), 30, { ring: true, speed: 2.5, up: 2 });
      let t = 0, acc = 0;
      ctx.addEffect({ update(dt) {
        t += dt; acc += dt;
        if (acc >= 0.5) { acc -= 0.5; for (const a of allies) { healActor(ctx.combat, a, amount * 0.45 / 6); ctx.combat.fx('heal', V().set(a.pos.x, a.pos.y + 0.6, a.pos.z), 3, { stars: true }); } }
        return t < 3;
      } });
    },
  },
  blitzspeer: {
    name: 'Blitzspeer', icon: '⚡', school: 'glaube', desc: 'Ein schneller Speer aus Blitz. Hoher Haltungsschaden.',
    mana: 20, cd: 1.6, anim: 'castUp', speed: 1.15, scaling: { fai: 'B' }, base: { dmg: 22 }, range: 30,
    cast(ctx) {
      const from = ctx.origin.clone(); from.y += 0.25;
      const tg = ctx.target, vel = V();
      if (tg) vel.set(tg.pos.x, tg.pos.y + tg.height * 0.55, tg.pos.z).sub(from).normalize().multiplyScalar(36);
      else vel.copy(ctx.dir).normalize().multiplyScalar(36);
      ctx.combat.projectile(ctx.hitOpts({ owner: ctx.actor, team: ctx.team, pos: from, vel, radius: 0.28, damage: Math.round(this.base.dmg * ctx.power),
        life: 1.2, fx: 'shock', homing: tg, homingRate: 1.5, knockback: 5, stagger: 0.75 }));
      ctx.combat.fx('shock', from, 18, { speed: 1.4 });
      ctx.combat.shake(0.2, ctx.c.pos);
    },
  },
  schattenschritt: {
    name: 'Schattenschritt', icon: '🌑', school: 'verstand', desc: 'Teleport bis 7 m in Laufrichtung, kurz unverwundbar. Hinterlässt einen Schattenstoß.',
    mana: 16, cd: 2.4, anim: 'cast1', speed: 1.6, scaling: { int: 'C' }, base: { dmg: 9 }, dist: 7,
    cast(ctx) {
      const c = ctx.c, w = ctx.world, dir = (ctx.inputDir || ctx.dir).clone().setY(0).normalize();
      const start = c.pos.clone(), p = c.pos.clone(), tmp = V();
      // in Schritten vorwärts, stoppt an Hindernissen / zu steilem Gelände
      for (let s = 0.35; s <= this.dist; s += 0.35) {
        tmp.copy(start).addScaledVector(dir, s);
        const gy = w.groundAt ? w.groundAt(tmp.x, tmp.z, p.y + 1.5) : (w.heightAt ? w.heightAt(tmp.x, tmp.z) : p.y);
        if (gy - p.y > 1.4) break;
        tmp.y = gy;
        const before = tmp.clone();
        if (w.collide) w.collide(tmp, c.radius, c.height);
        if (before.distanceTo(tmp) > 0.2) break;
        p.copy(tmp);
      }
      ctx.combat.fx('dark', V().copy(start).setY(start.y + 1), 26);
      ctx.combat.shockwave(start, 1.9, 0x8a3ad8, 0.3);
      const at = V().set(start.x, start.y + 0.9, start.z);
      ctx.combat.hitbox(ctx.hitOpts({ owner: ctx.actor, team: ctx.team, radius: 1.9, duration: 0.1, damage: Math.round(this.base.dmg * ctx.power), knockback: 4, stagger: 0.35, kind: 'spell', onHitFx: 'dark', at: () => at }));
      c.pos.copy(p); c.vel.set(0, 0, 0); c.push.set(0, 0, 0);
      ctx.f.grace = Math.max(ctx.f.grace, 0.35);
      ctx.f.blinkT = 0.12;
      ctx.combat.fx('dark', V().copy(p).setY(p.y + 1), 20);
    },
  },
  dornenfeld: {
    name: 'Dornenfeld', icon: '🌿', school: 'glaube', desc: 'Dornen brechen am Ziel aus dem Boden – 5 s Schaden über Zeit.',
    mana: 24, cd: 7, anim: 'cast2', speed: 1.2, scaling: { fai: 'B' }, base: { dmg: 5 }, range: 18, radius: 3.2,
    cast(ctx) {
      const p = groundPt(ctx, 5), r = this.radius, dmg = this.base.dmg * ctx.power;
      ctx.combat.telegraph({ pos: p, radius: r, duration: 5, color: 0x4a9a3a, shape: 'circle' });
      ctx.combat.fx('wood', V().copy(p).setY(p.y + 0.3), 18, { ring: true, speed: 1.5 });
      ctx.addEffect(areaTicker(ctx, { getPos: () => p, radius: r, dur: 5, every: 0.5, dmg, fx: 'spore', stagger: 0.05,
        onTick: (q, dt) => { if (Math.random() < dt * 14) { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * r; ctx.combat.fx('spore', V().set(q.x + Math.cos(a) * d, q.y + 0.2, q.z + Math.sin(a) * d), 2, { up: 2.5, speed: 0.4 }); } } }));
    },
  },
  sporenwolke: {
    name: 'Sporenwolke', icon: '🍄', school: 'verstand', desc: 'Eine giftige Wolke treibt langsam nach vorn und zehrt an allem darin.',
    mana: 22, cd: 6, anim: 'cast1', scaling: { int: 'C' }, base: { dmg: 4 }, radius: 2.4,
    cast(ctx) {
      const c = ctx.c, dir = ctx.dir.clone(), start = c.pos.clone().addScaledVector(dir, 1.5), r = this.radius, p = V();
      const w = ctx.world;
      ctx.addEffect(areaTicker(ctx, { radius: r, dur: 4.5, every: 0.4, dmg: this.base.dmg * ctx.power, fx: 'spore',
        getPos: t => { p.copy(start).addScaledVector(dir, Math.min(t, 3.5) * 2.4); p.y = (w.heightAt ? w.heightAt(p.x, p.z) : start.y) + 0.9; return p; },
        onTick: (q, dt) => { if (Math.random() < dt * 30) ctx.combat.fx('spore', V().set(q.x + (Math.random() - 0.5) * r * 1.6, q.y + (Math.random() - 0.3), q.z + (Math.random() - 0.5) * r * 1.6), 2, { speed: 0.5, up: 0.3, size: 2 }); } }));
    },
  },
  lichtschild: {
    name: 'Lichtschild', icon: '🛡️', school: 'glaube', desc: 'Eine Kuppel aus Licht blockt 1.5 s lang jeden Treffer.',
    mana: 18, cd: 8, anim: 'castHeal', speed: 1.7, scaling: { fai: 'C' }, dur: 1.5,
    cast(ctx) {
      const f = ctx.f, c = ctx.c, dur = this.dur * Math.min(1.5, 0.85 + ctx.power * 0.15);
      f.shieldT = dur;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 1), psxMat({ vertexColors: false, color: 0xffe08a, emissive: 0x806020, transparent: true, opacity: 0.32, depthWrite: false, noCache: true }));
      ctx.combat.root.add(m);
      ctx.combat.fx('holy', V().set(c.pos.x, c.pos.y + 1, c.pos.z), 24, { stars: true });
      ctx.addEffect({
        update() { m.position.set(c.pos.x, c.pos.y + 0.95, c.pos.z); m.rotation.y += 0.05; const k = Math.max(0, f.shieldT); m.scale.setScalar(0.9 + 0.1 * Math.sin(k * 20)); m.material.opacity = 0.18 + 0.22 * Math.min(1, k * 3); return f.shieldT > 0; },
        dispose() { ctx.combat.root.remove(m); m.geometry.dispose(); m.material.dispose(); },
      });
    },
  },
  meteor: {
    name: 'Meteor', icon: '☄️', school: 'verstand', desc: 'Ruft einen brennenden Felsen herab. Langsam, aber verheerend.',
    mana: 45, cd: 12, anim: 'castUp', speed: 0.75, scaling: { int: 'A' }, base: { dmg: 52 }, range: 24, radius: 3.6,
    cast(ctx) {
      const p = groundPt(ctx, 9), r = this.radius, dmg = Math.round(this.base.dmg * ctx.power);
      ctx.combat.telegraph({ pos: p, radius: r, duration: 1.25, color: 0xff6a20, shape: 'circle' });
      let t = 0, launched = false;
      ctx.addEffect({ update(dt) {
        t += dt;
        if (!launched && t >= 0.9) {
          launched = true;
          const from = V().set(p.x - ctx.dir.x * 5, p.y + 17, p.z - ctx.dir.z * 5);
          const vel = V().copy(p).sub(from).divideScalar(0.35);
          ctx.combat.projectile(ctx.hitOpts({ owner: ctx.actor, team: ctx.team, pos: from, vel, radius: 0.9, damage: dmg, life: 0.6, fx: 'fire',
            explodeRadius: r, knockback: 12, stagger: 1, onExpire: q => { ctx.combat.shake(1.1, q); ctx.combat.fx('fire', q, 40, { ring: true, speed: 2.2, up: 2.5 }); ctx.combat.fx('dust', q, 20, { ring: true, speed: 2 }); } }));
        }
        return t < 1.4;
      } });
    },
  },
  seelenpfeile: {
    name: 'Seelenpfeile', icon: '👻', school: 'verstand', desc: 'Fünf suchende Seelenpfeile in schneller Folge.',
    mana: 24, cd: 3.5, anim: 'cast1', speed: 0.9, scaling: { int: 'B' }, base: { dmg: 7 }, range: 28,
    cast(ctx) {
      const tg = ctx.target, dmg = Math.round(this.base.dmg * ctx.power), f = ctx.f;
      let t = 0, n = 0;
      ctx.addEffect({ update(dt) {
        t += dt;
        while (n < 5 && t >= n * 0.09) {
          const side = (n - 2) * 0.32, yaw = ctx.c.yaw + side;
          const from = f.p.model.handWorld('l', V()); from.y += 0.15;
          const vel = V().set(Math.sin(yaw), 0.35 + Math.abs(side) * 0.3, Math.cos(yaw)).normalize().multiplyScalar(15);
          ctx.combat.projectile(ctx.hitOpts({ owner: ctx.actor, team: ctx.team, pos: from, vel, radius: 0.2, damage: dmg, life: 2.2, fx: 'soul',
            homing: tg && tg.hp > 0 ? tg : ctx.combat.nearestEnemy(ctx.c.pos, ctx.team, 28), homingRate: 4.5, knockback: 1.5, stagger: 0.12 }));
          ctx.combat.fx('soul', from, 5);
          n++;
        }
        return n < 5;
      } });
    },
  },
};
for (const id in SPELLS) SPELLS[id].id = id;
export const SPELL_IDS = Object.keys(SPELLS);
