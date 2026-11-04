// Viniland – Spieler-Kampf: HP/Ausdauer/Mana, 3er-Axt-Combo mit Input-Buffer, Ausweichrolle mit i-frames,
// 2 Zauber (Glutkugel, Frostring), Lock-On, Treffer-Reaktion, Tod + Respawn.
// Benutzt Combat (combat.js), CharacterController (override/faceYaw/push) und das Spielermodell (playAction).
import * as THREE from 'three';
import { clamp } from './kit.js';

export const FIGHT = {
  maxHp: 100, maxSta: 100, maxMana: 100,
  staRegen: 38, staDelay: 0.5, manaRegen: 5,
  atkCost: 10, rollCost: 20, sprintCost: 12,
  buffer: 0.3,                // Input-Buffer (s)
  rollSpeed: 9.5, rollIFrom: 0.02, rollITo: 0.37,
  spell1: { name: 'Glutkugel', mana: 16, cd: 0.9, dmg: 16, speed: 21 },
  spell2: { name: 'Frostring', mana: 30, cd: 5, dmg: 20, radius: 4.2 },
  combo: [
    { anim: 'attack1', dmg: 10, kb: 2.5, stagger: 0.15, lunge: 3.2, tree: 1 },
    { anim: 'attack2', dmg: 11, kb: 2.5, stagger: 0.2, lunge: 3.2, tree: 1 },
    { anim: 'attack3', dmg: 22, kb: 6, stagger: 0.65, lunge: 4.5, tree: 2 },
  ],
  respawn: 4, lockRange: 30, lockLose: 42, graceAfterHit: 0.5,
};

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export class Fighter {
  /** p = Spieler-Objekt aus main ({ i, model, ctrl, cam }), hooks = { rumble(i,s,ms), kick(i,a), spawn() → Vector3 } */
  constructor(p, combat, world, hooks = {}) {
    this.p = p; this.combat = combat; this.world = world; this.hooks = hooks;
    this.hp = FIGHT.maxHp; this.sta = FIGHT.maxSta; this.mana = FIGHT.maxMana;
    this.staWait = 0; this.exhausted = false;
    this.state = 'free'; this.t = 0; this.dur = 0; this.impactAt = 0; this.impactDone = true;
    this.combo = 0; this.bufAtk = 0; this.bufRoll = 0; this.bufS1 = 0; this.bufS2 = 0;
    this.cd1 = 0; this.cd2 = 0; this.grace = 0; this.flash = 0; this.deadT = 0;
    this.rollDir = new THREE.Vector3(0, 0, 1);
    this.lock = null; this.lockPoint = new THREE.Vector3();
    this.kills = 0;
    this._hitPt = new THREE.Vector3();
    const self = this;
    this.actor = combat.addActor({
      id: 'player' + p.i, team: 'player', name: 'Spieler ' + (p.i + 1), pos: p.ctrl.pos, radius: 0.38, height: 1.7,
      get hp() { return self.hp; }, set hp(v) { self.hp = v; },
      maxHp: FIGHT.maxHp, alive: true,
      invuln: () => self.invulnerable(),
      onHit: hit => self.onHit(hit),
      object3D: p.model.object3D,
    });
  }

  invulnerable() {
    if (this.state === 'dead' || this.grace > 0) return true;
    return this.state === 'roll' && this.t >= FIGHT.rollIFrom && this.t <= FIGHT.rollITo;
  }

  get busy() { return this.state !== 'free'; }

  spendSta(c) { this.sta = Math.max(0, this.sta - c); this.staWait = FIGHT.staDelay + (this.sta <= 0 ? 0.4 : 0); }

  // ---------- Treffer ----------
  onHit(hit) {
    if (this.state === 'dead') return;
    // hp hat Combat bereits abgezogen
    this.flash = 1;
    const c = this.p.ctrl;
    c.push.set(hit.dir.x * hit.knockback, 0, hit.dir.z * hit.knockback);
    if (hit.knockback > 7 && c.grounded) { c.vel.y = 3.2; c.grounded = false; }
    this.hooks.rumble?.(this.p.i, clamp(0.35 + hit.damage / 40, 0.3, 1), 140 + hit.damage * 4);
    this.hooks.kick?.(this.p.i, 0.5 + hit.damage / 30);
    if (this.hp <= 0) { this.die(); return; }
    this.grace = FIGHT.graceAfterHit;
    if (hit.stagger >= 0.15 || hit.damage >= 6) this.enter('hurt', this.p.model.playAction('hurt'));
  }

  die() {
    this.enter('dead', this.p.model.playAction('death'));
    this.actor.alive = false; this.deadT = 0; this.lock = null;
    this.hooks.rumble?.(this.p.i, 1, 400);
    this.combat.fx('blood', _v.copy(this.p.ctrl.pos).setY(this.p.ctrl.pos.y + 1), 14);
  }

  respawn() {
    const c = this.p.ctrl, sp = this.hooks.spawn ? this.hooks.spawn() : c.pos;
    c.pos.copy(sp); c.pos.y = this.world.groundAt(c.pos.x, c.pos.z, 999); c.vel.set(0, 0, 0); c.push.set(0, 0, 0);
    c.grounded = true; c.swimming = false;
    this.hp = FIGHT.maxHp; this.sta = FIGHT.maxSta; this.mana = FIGHT.maxMana;
    this.actor.alive = true; this.grace = 2; this.state = 'free'; this.t = 0;
    this.p.model.cancelAction?.();
    this.p.cam.inited = false;
    this.combat.fx('heal', _v.copy(c.pos).setY(c.pos.y + 1), 22);
  }

  enter(state, anim) {
    this.state = state; this.t = 0;
    this.dur = anim?.duration || 0.4; this.impactAt = anim?.impactAt || 0; this.impactDone = false;
  }

  // ---------- Ziele ----------
  candidates() { return this.combat.actors.filter(a => a.team !== 'player' && a.alive !== false && a.hp > 0); }
  center(a, out) { return out.set(a.pos.x, a.pos.y + a.height * 0.55, a.pos.z); }

  pickLock(camYaw) {
    // bestes Ziel: nah und möglichst in Kamerablickrichtung
    const c = this.p.ctrl, fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
    let best = null, bs = 1e9;
    for (const a of this.candidates()) {
      const dx = a.pos.x - c.pos.x, dz = a.pos.z - c.pos.z, d = Math.hypot(dx, dz);
      if (d > FIGHT.lockRange + a.radius) continue;
      const dot = (dx * fx + dz * fz) / (d || 1);
      const s = d * (1.6 - dot);
      if (s < bs) { bs = s; best = a; }
    }
    return best;
  }
  switchLock(dir, camYaw) {
    if (!this.lock) return;
    const c = this.p.ctrl;
    const base = Math.atan2(this.lock.pos.x - c.pos.x, this.lock.pos.z - c.pos.z);
    let best = null, ba = 1e9;
    for (const a of this.candidates()) {
      if (a === this.lock) continue;
      if (Math.hypot(a.pos.x - c.pos.x, a.pos.z - c.pos.z) > FIGHT.lockRange + a.radius) continue;
      // Winkel relativ zum aktuellen Ziel; rechts = negativer Yaw-Unterschied (Kamera schaut entlang -sin/-cos)
      const d = wrap(Math.atan2(a.pos.x - c.pos.x, a.pos.z - c.pos.z) - base) * -1;
      if (Math.sign(d) !== dir && Math.abs(d) > 0.05) continue;
      if (Math.abs(d) < ba) { ba = Math.abs(d); best = a; }
    }
    if (best) this.lock = best;
  }

  /** Soft-Lock: nächster Gegner nah vor dem Spieler (für Angriffe/Zauber ohne Lock-On) */
  softTarget(range, cone) {
    if (this.lock) return this.lock;
    const c = this.p.ctrl, fy = c.yaw;
    let best = null, bd = 1e9;
    for (const a of this.candidates()) {
      const dx = a.pos.x - c.pos.x, dz = a.pos.z - c.pos.z, d = Math.hypot(dx, dz) - a.radius;
      if (d > range) continue;
      const ang = Math.abs(wrap(Math.atan2(dx, dz) - fy));
      if (ang > cone && d > 1.2) continue;
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  /** Wunschrichtung (Welt) aus Stick + Kamera, oder null */
  inputDir(intent, camYaw, out) {
    const sx = intent.moveX, sy = intent.moveY;
    if (Math.hypot(sx, sy) < 0.2) return null;
    const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
    return out.set(-sin * sy + cos * sx, 0, -cos * sy - sin * sx).normalize();
  }

  // ---------- Pro Frame (vor ctrl.update) ----------
  /** Gibt Bewegungs-Multiplikator für den Controller zurück. Verändert intent (sprint/jump) nach Kampfzustand. */
  update(dt, intent, camYaw) {
    const c = this.p.ctrl, F = FIGHT, m = this.p.model;
    c.override = null; c.faceYaw = null; c.faceRate = 0; c.frozen = false;
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.grace = Math.max(0, this.grace - dt);
    this.cd1 = Math.max(0, this.cd1 - dt); this.cd2 = Math.max(0, this.cd2 - dt);
    this.mana = Math.min(F.maxMana, this.mana + F.manaRegen * dt);
    this.t += dt;

    // Tod
    if (this.state === 'dead') {
      this.deadT += dt; c.frozen = true; intent.jumpPressed = false; intent.sprint = false;
      c.override = _w.set(0, 0, 0);
      if (this.deadT >= F.respawn) this.respawn();
      this.p.cam.lock = null;
      return 0;
    }

    // Buffer
    const water = c.swimming;
    if (intent.chopPressed) this.bufAtk = F.buffer;
    if (intent.rollPressed) this.bufRoll = F.buffer;
    if (intent.spell1Pressed) this.bufS1 = F.buffer;
    if (intent.spell2Pressed) this.bufS2 = F.buffer;
    this.bufAtk = Math.max(0, this.bufAtk - dt); this.bufRoll = Math.max(0, this.bufRoll - dt);
    this.bufS1 = Math.max(0, this.bufS1 - dt); this.bufS2 = Math.max(0, this.bufS2 - dt);

    // Lock-On
    if (intent.lockPressed) this.lock = this.lock ? null : this.pickLock(camYaw);
    if (this.lock && (this.lock.alive === false || this.lock.hp <= 0 ||
      Math.hypot(this.lock.pos.x - c.pos.x, this.lock.pos.z - c.pos.z) > F.lockLose)) this.lock = this.pickLockNear();
    if (this.lock && intent.switchTarget) this.switchLock(intent.switchTarget, camYaw);
    if (this.lock) { this.center(this.lock, this.lockPoint); this.p.cam.lock = this.lockPoint; } else this.p.cam.lock = null;

    // Ausdauer
    if (this.staWait > 0) this.staWait -= dt;
    else this.sta = Math.min(F.maxSta, this.sta + F.staRegen * dt * (this.state === 'free' ? 1 : 0.5));
    if (this.sta <= 0.5) this.exhausted = true;
    if (this.exhausted && this.sta > 30) this.exhausted = false;
    if (this.exhausted || this.busy) intent.sprint = false;
    if (intent.sprint && c.speed > 1 && c.grounded && this.state === 'free') { this.sta = Math.max(0, this.sta - F.sprintCost * dt); this.staWait = 0.35; }

    const dir = this.inputDir(intent, camYaw, _v);
    const lockYaw = this.lock ? Math.atan2(this.lock.pos.x - c.pos.x, this.lock.pos.z - c.pos.z) : null;
    const canAct = c.grounded && !water;

    // ---- Zustandswechsel ----
    const recovery = (this.state === 'attack' || this.state === 'cast') && this.t > this.impactAt + 0.06;
    const hurtOut = this.state === 'hurt' && this.t > 0.18;
    // Rolle: aus free, Angriffs-/Zauber-Erholung und spätem Flinch
    if (this.bufRoll > 0 && canAct && (this.state === 'free' || recovery || hurtOut) && this.sta >= 6) {
      this.bufRoll = 0; this.bufAtk = 0;
      this.spendSta(F.rollCost);
      if (dir) this.rollDir.copy(dir); else c.forward(this.rollDir);
      c.yaw = Math.atan2(this.rollDir.x, this.rollDir.z);
      this.enter('roll', m.playAction('roll'));
      this.combat.fx('dust', _w.copy(c.pos).setY(c.pos.y + 0.1), 6);
      this.hooks.rumble?.(this.p.i, 0.2, 50);
    }
    // Angriff / Combo
    if (this.bufAtk > 0 && canAct && this.sta > 0) {
      let next = -1;
      if (this.state === 'free') next = 0;
      else if (this.state === 'attack' && recovery && this.combo < 2) next = this.combo + 1;
      if (next >= 0) {
        this.bufAtk = 0; this.combo = next;
        const A = F.combo[next];
        this.spendSta(F.atkCost * (next === 2 ? 1.5 : 1));
        // Soft-Lock-Assist: zum nächsten Gegner vor dem Spieler ausrichten
        const tg = this.softTarget(6.5, 1.25);
        let yaw = tg ? Math.atan2(tg.pos.x - c.pos.x, tg.pos.z - c.pos.z) : dir ? Math.atan2(dir.x, dir.z) : c.yaw;
        this.atkYaw = yaw; this.atkTarget = tg;
        this.enter('attack', m.playAction(A.anim));
      }
    }
    // Zauber
    if (canAct && (this.state === 'free' || recovery)) {
      if (this.bufS1 > 0 && this.cd1 <= 0 && this.mana >= F.spell1.mana) {
        this.bufS1 = 0; this.mana -= F.spell1.mana; this.cd1 = F.spell1.cd;
        const tg = this.softTarget(26, 0.6);
        this.castTarget = tg;
        this.castYaw = tg ? Math.atan2(tg.pos.x - c.pos.x, tg.pos.z - c.pos.z) : (dir && !this.lock ? Math.atan2(dir.x, dir.z) : camYaw + Math.PI);
        this.spell = 1; this.enter('cast', m.playAction('cast1'));
      } else if (this.bufS2 > 0 && this.cd2 <= 0 && this.mana >= F.spell2.mana) {
        this.bufS2 = 0; this.mana -= F.spell2.mana; this.cd2 = F.spell2.cd;
        this.castYaw = lockYaw ?? c.yaw; this.castTarget = null;
        this.spell = 2; this.enter('cast', m.playAction('cast2'));
      } else if ((this.bufS1 > 0 && (this.cd1 > 0.25 || this.mana < F.spell1.mana)) || (this.bufS2 > 0 && (this.cd2 > 0.25 || this.mana < F.spell2.mana))) {
        // nicht genug Mana / Cooldown: kurzes Zischen statt Wirkung
        if (this.bufS1 > 0 && this.bufS1 < F.buffer - dt * 1.5) { this.bufS1 = 0; this.combat.fx('dust', this.p.model.handWorld('l', _w), 3); }
        if (this.bufS2 > 0 && this.bufS2 < F.buffer - dt * 1.5) { this.bufS2 = 0; this.combat.fx('dust', this.p.model.handWorld('l', _w), 3); }
      }
    }

    // ---- Zustand ausführen ----
    let mul = 1;
    if (this.state === 'roll') {
      const u = clamp(this.t / this.dur, 0, 1);
      const sp = F.rollSpeed * (u < 0.7 ? 1 - u * 0.35 : (1 - u) / 0.3 * 0.75);
      c.override = _w.set(this.rollDir.x * sp, 0, this.rollDir.z * sp);
      c.faceYaw = Math.atan2(this.rollDir.x, this.rollDir.z); c.faceRate = 30;
      intent.jumpPressed = false;
      if (this.t >= this.dur) { this.state = 'free'; this.combo = 0; }
    } else if (this.state === 'attack') {
      const A = F.combo[this.combo];
      if (this.atkTarget && this.atkTarget.alive !== false) this.atkYaw = Math.atan2(this.atkTarget.pos.x - c.pos.x, this.atkTarget.pos.z - c.pos.z);
      c.faceYaw = this.atkYaw; c.faceRate = 22;
      // Ausfallschritt kurz vor dem Treffer (weniger, wenn das Ziel schon nah ist)
      const near = this.atkTarget ? Math.hypot(this.atkTarget.pos.x - c.pos.x, this.atkTarget.pos.z - c.pos.z) - this.atkTarget.radius : 9;
      if (this.t > this.impactAt - 0.12 && this.t < this.impactAt + 0.04 && near > 1.0) {
        const ls = A.lunge * clamp((near - 0.9) / 1.5, 0, 1);
        c.override = _w.set(Math.sin(c.yaw) * ls, 0, Math.cos(c.yaw) * ls);
      }
      mul = 0.18;
      intent.jumpPressed = false;
      if (!this.impactDone && this.t >= this.impactAt) { this.impactDone = true; this.attackImpact(A); }
      if (this.t >= this.dur) { this.state = 'free'; this.combo = 0; }
    } else if (this.state === 'cast') {
      c.faceYaw = this.castYaw; c.faceRate = 20; mul = 0.12; intent.jumpPressed = false;
      if (this.castTarget && this.castTarget.alive !== false) this.castYaw = Math.atan2(this.castTarget.pos.x - c.pos.x, this.castTarget.pos.z - c.pos.z);
      if (!this.impactDone && this.t >= this.impactAt) { this.impactDone = true; this.spell === 1 ? this.castFire() : this.castFrost(); }
      if (this.t < this.impactAt) this.combat.fx(this.spell === 1 ? 'fire' : 'frost', this.p.model.handWorld(this.spell === 1 ? 'l' : 'r', _w), 1, { speed: 0.3, up: 0.4 });
      if (this.t >= this.dur) this.state = 'free';
    } else if (this.state === 'hurt') {
      mul = 0.25; intent.jumpPressed = false;
      if (this.t >= this.dur) this.state = 'free';
    } else {
      // frei: im Lock-On zum Ziel blicken (Strafen), außer beim Sprinten
      if (lockYaw !== null && !(intent.sprint && c.speed > 5)) { c.faceYaw = lockYaw; c.faceRate = 12; }
    }
    return mul;
  }

  pickLockNear() {
    const c = this.p.ctrl; let best = null, bd = 18;
    for (const a of this.candidates()) { const d = Math.hypot(a.pos.x - c.pos.x, a.pos.z - c.pos.z); if (d < bd) { bd = d; best = a; } }
    return best;
  }

  // ---------- Treffer-Momente ----------
  attackImpact(A) {
    const c = this.p.ctrl, i = this.p.i;
    // Bäume / Stämme
    _v.copy(c.pos); _v.y += 1.0;
    const fwd = c.forward(_w);
    const res = this.world.hitTree(_v, fwd, 2.6, A.tree) || {};
    if (res.hit) { this.hooks.kick?.(i, res.felled ? 1.2 : 0.35); this.hooks.rumble?.(i, res.felled ? 0.9 : 0.35, res.felled ? 200 : 60); }
    // Gegner: kurzer Bogen vor dem Spieler
    const self = this, pt = this._hitPt;
    this.combat.hitbox({
      owner: this.actor, team: 'player', radius: this.combo === 2 ? 1.15 : 0.95, duration: 0.12,
      damage: A.dmg, knockback: A.kb, stagger: A.stagger, kind: 'melee', onHitFx: 'spark',
      at: () => pt.set(c.pos.x + Math.sin(c.yaw) * 1.15, c.pos.y + 1.0, c.pos.z + Math.cos(c.yaw) * 1.15),
      onConnect: () => { self.hooks.kick?.(i, self.combo === 2 ? 0.7 : 0.3); self.hooks.rumble?.(i, self.combo === 2 ? 0.8 : 0.45, 90); },
    });
  }

  castFire() {
    const c = this.p.ctrl, S = FIGHT.spell1;
    const from = this.p.model.handWorld('l', new THREE.Vector3());
    from.x += Math.sin(c.yaw) * 0.35; from.z += Math.cos(c.yaw) * 0.35;
    const tg = this.castTarget && this.castTarget.alive !== false ? this.castTarget : null;
    const vel = new THREE.Vector3();
    if (tg) this.center(tg, vel).sub(from).normalize().multiplyScalar(S.speed);
    else vel.set(Math.sin(c.yaw), 0.04, Math.cos(c.yaw)).normalize().multiplyScalar(S.speed);
    this.combat.projectile({ owner: this.actor, team: 'player', pos: from, vel, radius: 0.32, damage: S.dmg, life: 2.4,
      fx: 'fire', homing: tg, explodeRadius: 1.8, knockback: 3, stagger: 0.3 });
    this.combat.fx('fire', from, 10);
    this.hooks.rumble?.(this.p.i, 0.3, 60);
  }

  castFrost() {
    const c = this.p.ctrl, S = FIGHT.spell2, pt = this._hitPt;
    pt.set(c.pos.x, c.pos.y + 0.8, c.pos.z);
    this.combat.hitbox({ owner: this.actor, team: 'player', radius: S.radius, duration: 0.15, damage: S.dmg, knockback: 10,
      stagger: 0.85, kind: 'spell', onHitFx: 'frost', at: () => pt });
    this.combat.shockwave(c.pos, S.radius + 0.4, 0x9fe8ff, 0.4);
    _v.copy(c.pos); _v.y += 0.3;
    this.combat.fx('frost', _v, 46, { ring: true, speed: 2.4, up: 1.2 });
    this.combat.fx('frost', _v, 12, { stars: true, speed: 1.2 });
    this.hooks.kick?.(this.p.i, 0.8); this.hooks.rumble?.(this.p.i, 0.7, 160);
    this.combat.shake(0.4, c.pos);
  }
}
