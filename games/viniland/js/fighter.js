// Viniland – Spieler-Kampf (datengetrieben): Waffen aus weapons.js (leichte Combo, schwerer Angriff mit Aufladen, Waffenkunst),
// 2 Zauber-Slots aus spells.js, Attribute (setStats), Relikte/Item-Mods, Glutflakon, Ausweichrolle mit i-frames, Lock-On, Tod + Respawn.
// Benutzt Combat (combat.js), CharacterController (override/faceYaw/push) und das Spielermodell (playAction/setWeapon).
//
// API (siehe CONTRACT.md „Erweiterung 3“):
//   fighter.equipWeapon(itemOrId)        item = { weaponId, upgrade:0..5, rarity, mods?, dmgMul? } oder 'sword'
//   fighter.equipSpells([idA, idB])      fighter.spells → [idA, idB]; fighter.spellInfo(0|1) → { id, def, cd, cdMax, ready, mana }
//   fighter.setStats({ vit, end, str, dex, int, fai, level })  → maxHp/maxSta/maxMana neu
//   fighter.flask = { charges, max }; fighter.useFlask() → bool
//   fighter.relics = [relicDef, relicDef]  ({ mods:{…} } additiv, z. B. dmgMul:0.1 = +10 %)
//   fighter.onKill = actor => {}         fighter.onHitTaken = hit => {}   fighter.onAction = (kind, info) => {} ('light'|'heavy'|'art'|'cast'|'roll'|'flask')
//   Lesbar: hp/maxHp, sta/maxSta, mana/maxMana, state, weapon (Def), weaponItem, lock, chargeT, flask
import * as THREE from 'three';
import { clamp } from './kit.js';
import { WEAPONS, WEAPON_CLASSES, scalingMul, shapeOf, dirOf, buildWeaponMesh, RARITY_COLORS } from './weapons.js';
import { SPELLS } from './spells.js';
import { OPTIONS } from './options.js';

export const FIGHT = {
  maxHp: 100, maxSta: 100, maxMana: 100,             // Basiswerte bei allen Attributen = 10
  staRegen: 38, staDelay: 0.5, manaRegen: 4,
  atkCost: 11, rollCost: 20, sprintCost: 12,
  buffer: 0.3,                // Input-Buffer (s)
  rollSpeed: 9.5, rollIFrom: 0.02, rollITo: 0.37,
  chargeMax: 0.9, chargeBonus: 0.65,                 // schwerer Angriff: max. Ladezeit (s), +65 % Schaden voll geladen
  flaskHeal: 0.45, flaskTime: 0.6, flaskCharges: 3,   // Anteil maxHp, über 0.6 s
  respawn: 4, lockRange: 30, lockLose: 42, graceAfterHit: 0.5,
  // Kompatibilität (alte HUD-Version in main.js liest diese)
  spell1: { name: 'Glutkugel', mana: SPELLS.glutkugel.mana, cd: SPELLS.glutkugel.cd },
  spell2: { name: 'Frostring', mana: SPELLS.frostring.mana, cd: SPELLS.frostring.cd },
};

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3();
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const lerp = (a, b, t) => a + (b - a) * t;

export class Fighter {
  /** p = Spieler-Objekt aus main ({ i, model, ctrl, cam }), hooks = { rumble(i,s,ms), kick(i,a), spawn() → Vector3 } */
  constructor(p, combat, world, hooks = {}) {
    this.p = p; this.combat = combat; this.world = world; this.hooks = hooks;
    this.stats = { vit: 10, end: 10, str: 10, dex: 10, int: 10, fai: 10, level: 1 };
    this.maxHp = FIGHT.maxHp; this.maxSta = FIGHT.maxSta; this.maxMana = FIGHT.maxMana;
    this.hp = this.maxHp; this.sta = this.maxSta; this.mana = this.maxMana;
    this.staWait = 0; this.exhausted = false;
    this.state = 'free'; this.t = 0; this.dur = 0; this.impactAt = 0; this.impactDone = true;
    this.combo = 0; this.bufAtk = 0; this.bufRoll = 0; this.bufS1 = 0; this.bufS2 = 0; this.bufHeavy = 0; this.bufArt = 0; this.bufFlask = 0;
    this.cds = [0, 0]; this.grace = 0; this.flash = 0; this.deadT = 0; this.shieldT = 0; this.blinkT = 0;
    this.rollDir = new THREE.Vector3(0, 0, 1);
    this.lock = null; this.lockPoint = new THREE.Vector3();
    this.kills = 0;
    this.flask = { charges: FIGHT.flaskCharges, max: FIGHT.flaskCharges };
    this.relics = [];
    this.onKill = null; this.onHitTaken = null; this.onAction = null;
    this.effects = [];
    this.hits = []; this.move = null; this.chargeT = 0; this.healLeft = 0; this.healRate = 0;
    this._hitPt = new THREE.Vector3();
    const self = this;
    this.actor = combat.addActor({
      id: 'player' + p.i, team: 'player', name: 'Spieler ' + (p.i + 1), pos: p.ctrl.pos, radius: 0.38, height: 1.7,
      get hp() { return self.hp; }, set hp(v) { self.hp = v; },
      get maxHp() { return self.maxHp; }, set maxHp(v) { /* über setStats */ },
      alive: true,
      invuln: () => self.invulnerable(),
      onHit: hit => self.onHit(hit),
      heal: n => self.heal(n),
      object3D: p.model.object3D,
    });
    this.spells = ['glutkugel', 'frostring'];
    this.equipWeapon('fists');
  }

  // ================= Ausrüstung / Werte =================
  equipWeapon(item) {
    if (typeof item === 'string' || !item) item = { weaponId: item || 'fists', upgrade: 0, rarity: 'common' };
    const W = WEAPONS[item.weaponId] || WEAPONS.fists;
    this.weaponItem = item; this.weapon = W; this.cls = WEAPON_CLASSES[W.class] || WEAPON_CLASSES.medium;
    const col = typeof item.rarity === 'number' ? item.rarity : (item.rarity && item.rarity !== 'common' ? RARITY_COLORS[item.rarity] : null);
    const mesh = W.id === 'fists' ? buildWeaponMesh('fists') : buildWeaponMesh(W.id, col);
    this.p.model.setWeapon?.(mesh, W.grip);
    if (this.state === 'attack' || this.state === 'charge') { this.state = 'free'; this.p.model.cancelAction?.(); }
    this.combo = 0;
    this.recalc();
    return W;
  }
  equipSpells(ids) { this.spells = [ids?.[0] ?? null, ids?.[1] ?? null].map(id => (id && SPELLS[id] ? id : null)); this.cds = [0, 0]; }
  setStats(s = {}) { Object.assign(this.stats, s); this.recalc(); }
  /** Summe eines Mods aus Relikten + Waffen-Item (additiv) */
  mod(k) {
    let v = 0;
    for (const r of this.relics || []) if (r && r.mods && r.mods[k]) v += r.mods[k];
    const wm = this.weaponItem?.mods; if (wm && wm[k]) v += wm[k];
    return v;
  }
  recalc() {
    const S = this.stats, fH = this.maxHp > 0 ? this.hp / this.maxHp : 1;
    this.maxHp = Math.round((FIGHT.maxHp + (S.vit - 10) * 9) * (1 + this.mod('maxHpMul')));
    this.maxSta = Math.round((FIGHT.maxSta + (S.end - 10) * 4) * (1 + this.mod('maxStaMul')));
    this.maxMana = Math.round((FIGHT.maxMana + (S.int - 10) * 5 + (S.fai - 10) * 3) * (1 + this.mod('maxManaMul')));
    if (this.state !== 'dead') this.hp = Math.min(this.maxHp, Math.max(1, Math.round(fH * this.maxHp)));
    this.sta = Math.min(this.sta, this.maxSta); this.mana = Math.min(this.mana, this.maxMana);
  }
  /** Waffen-Schaden: Basis × Upgrade × Seltenheit × Skalierung × Relikt-/Zustands-Mods */
  weaponDmg(mult, scaleOverride) {
    const W = this.weapon, it = this.weaponItem || {};
    let sc = scalingMul(W.scaling, this.stats);
    if (scaleOverride) sc = Math.max(sc, scalingMul({ [scaleOverride]: 'B' }, this.stats));
    let m = 1 + this.mod('dmgMul');
    if (this.hp >= this.maxHp - 0.5) m += this.mod('dmgMulFullHp');
    if (this.hp < this.maxHp * 0.3) m += this.mod('dmgMulLowHp');
    return Math.max(1, Math.round(W.base.dmg * mult * (1 + 0.12 * (it.upgrade || 0)) * (it.dmgMul || 1) * sc * m));
  }
  spellPower(def) {
    let m = scalingMul(def.scaling, this.stats) * (1 + this.mod('spellDmgMul')) * (this.weapon.spellMul || 1);
    if (this.hp >= this.maxHp - 0.5) m *= 1 + this.mod('dmgMulFullHp') * 0.5;
    return m;
  }
  spellInfo(i) {
    const id = this.spells[i], def = id ? SPELLS[id] : null;
    return { id, def, cd: this.cds[i], cdMax: def?.cd || 1, ready: !!def && this.cds[i] <= 0 && this.mana >= def.mana, mana: def?.mana || 0 };
  }
  // alte Namen (HUD)
  get cd1() { return this.cds[0]; } set cd1(v) { this.cds[0] = v; }
  get cd2() { return this.cds[1]; } set cd2(v) { this.cds[1] = v; }

  heal(n) {
    if (this.state === 'dead' || n <= 0) return 0;
    const b = this.hp; this.hp = Math.min(this.maxHp, this.hp + n); return this.hp - b;
  }
  useFlask() {
    if (this.state === 'dead' || !this.flask || this.flask.charges <= 0) return false;
    const c = this.p.ctrl;
    if (!(this.state === 'free' || this.inRecovery()) || !c.grounded || c.swimming) return false;
    this.flask.charges--;
    this.bufFlask = 0;
    this.enter('drink', this.p.model.playAction('drink'));
    this.healPending = true;
    this.onAction?.('flask', { charges: this.flask.charges });
    return true;
  }

  invulnerable() {
    if (this.state === 'dead' || this.grace > 0 || this.shieldT > 0) return true;
    if (this.state === 'roll' && this.t >= FIGHT.rollIFrom && this.t <= FIGHT.rollITo) return true;
    if (this.state === 'attack' && this.move?.iframes) { const u = this.t / this.dur; return u >= this.move.iframes[0] && u <= this.move.iframes[1]; }
    return false;
  }
  get busy() { return this.state !== 'free'; }
  inRecovery() { return (this.state === 'attack' || this.state === 'cast') && this.t > this.recoverAt; }

  spendSta(c) { this.sta = Math.max(0, this.sta - c); this.staWait = FIGHT.staDelay + (this.sta <= 0 ? 0.4 : 0); }

  // ================= Treffer =================
  onHit(hit) {
    if (this.state === 'dead') return;
    // hp hat Combat bereits abgezogen → erlittener-Schaden-Mod nachträglich korrigieren
    const tk = this.mod('dmgTakenMul');
    if (tk) { const delta = hit.damage * tk; this.hp = clamp(this.hp - delta, 0, this.maxHp); }
    this.flash = 1;
    this.onHitTaken?.(hit);
    const c = this.p.ctrl;
    const armor = this.state === 'attack' && this.move?.armor;
    const kbm = armor ? 0.3 : 1;
    c.push.set(hit.dir.x * hit.knockback * kbm, 0, hit.dir.z * hit.knockback * kbm);
    if (!armor && hit.knockback > 7 && c.grounded) { c.vel.y = 3.2; c.grounded = false; }
    this.hooks.rumble?.(this.p.i, clamp(0.35 + hit.damage / 40, 0.3, 1), 140 + hit.damage * 4);
    this.hooks.kick?.(this.p.i, 0.5 + hit.damage / 30);
    if (this.hp <= 0) { this.die(); return; }
    this.grace = FIGHT.graceAfterHit;
    if (armor) return;
    if (hit.stagger >= 0.15 || hit.damage >= 6) {
      if (this.state === 'drink') { this.healLeft = 0; this.healPending = false; }   // Trinken unterbrochen
      this.enter('hurt', this.p.model.playAction('hurt'));
    }
  }

  die() {
    this.enter('dead', this.p.model.playAction('death'));
    this.actor.alive = false; this.deadT = 0; this.lock = null; this.healLeft = 0; this.shieldT = 0;
    this.hooks.rumble?.(this.p.i, 1, 400);
    this.combat.fx('blood', _v.copy(this.p.ctrl.pos).setY(this.p.ctrl.pos.y + 1), 14);
  }

  respawn(pos) {
    const c = this.p.ctrl, sp = pos || (this.hooks.spawn ? this.hooks.spawn() : c.pos);
    c.pos.copy(sp); c.pos.y = this.world.groundAt(c.pos.x, c.pos.z, 999); c.vel.set(0, 0, 0); c.push.set(0, 0, 0);
    c.grounded = true; c.swimming = false;
    this.hp = this.maxHp; this.sta = this.maxSta; this.mana = this.maxMana;
    this.actor.alive = true; this.grace = 2; this.state = 'free'; this.t = 0; this.move = null; this.hits = [];
    this.p.model.cancelAction?.();
    this.p.cam.inited = false;
    this.combat.fx('heal', _v.copy(c.pos).setY(c.pos.y + 1), 22);
  }

  enter(state, anim) {
    this.state = state; this.t = 0;
    this.dur = anim?.duration || 0.4; this.impactAt = anim?.impactAt || 0; this.impactDone = false;
    this.recoverAt = this.impactAt + 0.06;
  }

  // ================= Ziele =================
  candidates() { return this.combat.actors.filter(a => a.team !== 'player' && a.alive !== false && a.hp > 0); }
  center(a, out) { return out.set(a.pos.x, a.pos.y + a.height * 0.55, a.pos.z); }

  pickLock(camYaw) {
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
  switchLock(dir) {
    if (!this.lock) return;
    const c = this.p.ctrl;
    const base = Math.atan2(this.lock.pos.x - c.pos.x, this.lock.pos.z - c.pos.z);
    let best = null, ba = 1e9;
    for (const a of this.candidates()) {
      if (a === this.lock) continue;
      if (Math.hypot(a.pos.x - c.pos.x, a.pos.z - c.pos.z) > FIGHT.lockRange + a.radius) continue;
      const d = wrap(Math.atan2(a.pos.x - c.pos.x, a.pos.z - c.pos.z) - base) * -1;
      if (Math.sign(d) !== dir && Math.abs(d) > 0.05) continue;
      if (Math.abs(d) < ba) { ba = Math.abs(d); best = a; }
    }
    if (best) this.lock = best;
  }
  pickLockNear() {
    const c = this.p.ctrl; let best = null, bd = 18;
    for (const a of this.candidates()) { const d = Math.hypot(a.pos.x - c.pos.x, a.pos.z - c.pos.z); if (d < bd) { bd = d; best = a; } }
    return best;
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
  inputDir(intent, camYaw, out) {
    const sx = intent.moveX, sy = intent.moveY;
    if (Math.hypot(sx, sy) < 0.2) return null;
    const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
    return out.set(-sin * sy + cos * sx, 0, -cos * sy - sin * sx).normalize();
  }

  /** Hitbox-/Projektil-Optionen um Kill-Hook, Lebensraub, Relikt-Stagger ergänzen */
  hitOpts(o, extra = {}) {
    const self = this, prev = o.onConnect, ls = (extra.lifesteal || 0) + this.mod('lifesteal'), stg = this.mod('staggerMul');
    if (stg && o.stagger != null) o.stagger = Math.min(1, o.stagger * (1 + stg));
    o.onConnect = (a, hit) => {
      prev?.(a, hit);
      if (ls > 0) { const g = self.heal(hit.damage * ls); if (g >= 1) self.combat.damageNumber(_u.set(self.p.ctrl.pos.x, self.p.ctrl.pos.y + 1.8, self.p.ctrl.pos.z), '+' + Math.round(g), 0x8aff9a); }
      if (a.hp <= 0 && !a._killCredited) {
        a._killCredited = true; self.kills++;
        const hk = self.mod('hpOnKill'), mk = self.mod('manaOnKill');
        if (hk) self.heal(hk);
        if (mk) self.mana = Math.min(self.maxMana, self.mana + mk);
        self.onKill?.(a);
      }
    };
    return o;
  }

  // ================= Pro Frame (vor ctrl.update) =================
  /** Gibt Bewegungs-Multiplikator für den Controller zurück. Verändert intent (sprint/jump) nach Kampfzustand. */
  update(dt, intent, camYaw) {
    const c = this.p.ctrl, F = FIGHT, m = this.p.model, cls = this.cls, W = this.weapon;
    c.override = null; c.faceYaw = null; c.faceRate = 0; c.frozen = false;
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.grace = Math.max(0, this.grace - dt);
    this.shieldT = Math.max(0, this.shieldT - dt);
    this.cds[0] = Math.max(0, this.cds[0] - dt); this.cds[1] = Math.max(0, this.cds[1] - dt);
    this.mana = Math.min(this.maxMana, this.mana + F.manaRegen * (1 + this.mod('manaRegenMul')) * dt);
    this.t += dt;
    // Effekte (DoT-Felder, Wolken, Meteor …)
    for (let k = this.effects.length - 1; k >= 0; k--) {
      const e = this.effects[k]; let keep = false;
      try { keep = e.update(dt); } catch (err) { console.error(err); }
      if (!keep) { e.dispose?.(); this.effects.splice(k, 1); }
    }
    // Schattenschritt: Modell kurz unsichtbar
    if (this.blinkT > 0) { this.blinkT -= dt; m.object3D.visible = this.blinkT <= 0; }
    // Heilung über Zeit (Flakon)
    if (this.healLeft > 0 && this.state !== 'dead') {
      const h = Math.min(this.healLeft, this.healRate * dt); this.healLeft -= h; this.heal(h);
      if (Math.random() < dt * 20) this.combat.fx('heal', _v.set(c.pos.x, c.pos.y + 0.5 + Math.random(), c.pos.z), 1, { stars: true });
    }

    // Tod
    if (this.state === 'dead') {
      this.deadT += dt; c.frozen = true; intent.jumpPressed = false; intent.sprint = false;
      c.override = _w.set(0, 0, 0);
      if (this.deadT >= F.respawn && !this.hooks.noAutoRespawn) this.respawn();
      this.p.cam.lock = null;
      return 0;
    }

    // Buffer
    const water = c.swimming, B = F.buffer;
    if (intent.chopPressed) this.bufAtk = B;
    if (intent.rollPressed) this.bufRoll = B;
    if (intent.spell1Pressed) this.bufS1 = B;
    if (intent.spell2Pressed) this.bufS2 = B;
    if (intent.heavyPressed) this.bufHeavy = B;
    if (intent.artPressed) this.bufArt = B;
    if (intent.flaskPressed) this.bufFlask = B;
    for (const k of ['bufAtk', 'bufRoll', 'bufS1', 'bufS2', 'bufHeavy', 'bufArt', 'bufFlask']) this[k] = Math.max(0, this[k] - dt);

    // Lock-On (Umschalten oder Halten laut OPTIONS.lockToggle)
    const toggle = OPTIONS.lockToggle !== false;
    if (intent.lockPressed) this.lock = toggle ? (this.lock ? null : this.pickLock(camYaw)) : this.pickLock(camYaw);
    if (!toggle && !intent.lock && !intent.lockPressed) this.lock = null;
    if (this.lock && (this.lock.alive === false || this.lock.hp <= 0 ||
      Math.hypot(this.lock.pos.x - c.pos.x, this.lock.pos.z - c.pos.z) > F.lockLose)) this.lock = this.pickLockNear();
    if (this.lock && intent.switchTarget) this.switchLock(intent.switchTarget);
    if (this.lock) { this.center(this.lock, this.lockPoint); this.p.cam.lock = this.lockPoint; } else this.p.cam.lock = null;

    // Ausdauer
    if (this.staWait > 0) this.staWait -= dt;
    else this.sta = Math.min(this.maxSta, this.sta + F.staRegen * (1 + this.mod('staRegenMul')) * dt * (this.state === 'free' ? 1 : 0.5));
    if (this.sta <= 0.5) this.exhausted = true;
    if (this.exhausted && this.sta > 30) this.exhausted = false;
    if (this.exhausted || this.busy) intent.sprint = false;
    if (intent.sprint && c.speed > 1 && c.grounded && this.state === 'free') { this.sta = Math.max(0, this.sta - F.sprintCost * dt); this.staWait = 0.35; }

    const dir = this.inputDir(intent, camYaw, _v);
    const lockYaw = this.lock ? Math.atan2(this.lock.pos.x - c.pos.x, this.lock.pos.z - c.pos.z) : null;
    const canAct = c.grounded && !water;
    const recovery = this.inRecovery();
    const hurtOut = this.state === 'hurt' && this.t > 0.18;
    const drinkOut = this.state === 'drink' && this.t > this.impactAt + F.flaskTime;
    const ready = this.state === 'free' || recovery;

    // ---- Zustandswechsel ----
    // Rolle: aus free, Erholung, spätem Flinch, nach dem Trinken
    if (this.bufRoll > 0 && canAct && (ready || hurtOut || drinkOut || this.state === 'charge') && this.sta >= 6) {
      this.bufRoll = 0; this.bufAtk = 0; this.bufHeavy = 0;
      this.spendSta(F.rollCost * Math.max(0.2, 1 + this.mod('rollCostMul')));
      if (dir) this.rollDir.copy(dir); else c.forward(this.rollDir);
      c.yaw = Math.atan2(this.rollDir.x, this.rollDir.z);
      this.enter('roll', m.playAction('roll'));
      this.move = null; this.hits = [];
      this.combat.fx('dust', _w.copy(c.pos).setY(c.pos.y + 0.1), 6);
      this.hooks.rumble?.(this.p.i, 0.2, 50);
      this.onAction?.('roll');
    }
    // Glutflakon
    if (this.bufFlask > 0 && canAct && ready) this.useFlask();
    // Waffenkunst
    if (this.bufArt > 0 && canAct && ready && W.art) {
      const A = W.art, sc = Math.max(0.3, 1 + this.mod('artCostMul'));
      if (this.sta >= Math.min(A.sta * sc, 10) && this.mana >= (A.mana || 0)) {
        this.bufArt = 0; this.spendSta(A.sta * sc); this.mana -= A.mana || 0;
        this.startMove('art', A, dir);
      } else if (this.bufArt < B - dt * 1.5) { this.bufArt = 0; this.combat.fx('dust', m.handWorld('r', _w), 4); }
    }
    // Schwerer Angriff (halten = aufladen)
    if (this.bufHeavy > 0 && canAct && ready && this.sta > 0) {
      this.bufHeavy = 0;
      const H = W.heavy;
      if (H.charge && intent.heavy) {
        this.enter('charge', m.playAction('heavyCharge', { speed: cls.speed }));
        this.chargeT = 0; this.aim(dir);
      } else this.startMove('heavy', H, dir, 0);
    }
    // Leichter Angriff / Combo
    if (this.bufAtk > 0 && canAct && this.sta > 0) {
      let next = -1;
      if (this.state === 'free') next = 0;
      else if (this.state === 'attack' && this.move?.kind === 'light' && recovery) next = (this.combo + 1) % W.combo.length;
      else if (this.state === 'attack' && this.move?.kind !== 'light' && recovery) next = 0;
      if (next >= 0) { this.bufAtk = 0; this.combo = next; this.startMove('light', W.combo[next], dir); }
    }
    // Zauber
    if (canAct && ready) {
      for (let s = 0; s < 2; s++) {
        const bk = s ? 'bufS2' : 'bufS1';
        if (this[bk] <= 0) continue;
        const id = this.spells[s], def = id && SPELLS[id];
        if (def && this.cds[s] <= 0 && this.mana >= def.mana) {
          this[bk] = 0; this.mana -= def.mana; this.cds[s] = def.cd;
          this.castDef = def; this.castSlot = s;
          this.castTarget = this.softTarget(def.range || 22, 0.7);
          this.castYaw = this.castTarget ? Math.atan2(this.castTarget.pos.x - c.pos.x, this.castTarget.pos.z - c.pos.z)
            : (dir && !this.lock ? Math.atan2(dir.x, dir.z) : (lockYaw ?? c.yaw));
          this.castInputDir = dir ? dir.clone() : null;
          this.enter('cast', m.playAction(def.anim || 'cast1', { speed: def.speed || 1 }));
          this.onAction?.('cast', { id, slot: s });
          break;
        } else if (this[bk] < B - dt * 1.5) { this[bk] = 0; this.combat.fx('dust', m.handWorld('l', _w), 3); }
      }
    }

    // ---- Zustand ausführen ----
    let mul = 1;
    const st = this.state;
    if (st === 'roll') {
      const u = clamp(this.t / this.dur, 0, 1);
      const sp = F.rollSpeed * (u < 0.7 ? 1 - u * 0.35 : (1 - u) / 0.3 * 0.75);
      c.override = _w.set(this.rollDir.x * sp, 0, this.rollDir.z * sp);
      c.faceYaw = Math.atan2(this.rollDir.x, this.rollDir.z); c.faceRate = 30;
      intent.jumpPressed = false;
      if (this.t >= this.dur) { this.state = 'free'; this.combo = 0; }
    } else if (st === 'charge') {
      this.chargeT += dt;
      this.aimTrack(); c.faceYaw = this.atkYaw; c.faceRate = 14; mul = 0.2; intent.jumpPressed = false;
      if (Math.random() < dt * 25) this.combat.fx('spark', m.bladeWorld(_w), 1, { speed: 0.3, up: 0.6 });
      if (this.chargeT >= F.chargeMax * 0.98 && !this._chargeFull) { this._chargeFull = true; this.combat.fx('fire', m.bladeWorld(_w), 12); this.hooks.rumble?.(this.p.i, 0.4, 80); }
      if (!intent.heavy || this.chargeT >= F.chargeMax) {
        const ch = clamp(this.chargeT / F.chargeMax, 0, 1); this._chargeFull = false;
        this.startMove('heavy', W.heavy, null, ch);
      }
    } else if (st === 'attack') {
      this.runMove(dt, intent);
      mul = this.move?.def?.dash || this.move?.def?.leap ? 0 : 0.18;
      intent.jumpPressed = false;
      if (this.t >= this.dur) { this.state = 'free'; this.combo = 0; this.move = null; }
    } else if (st === 'cast') {
      c.faceYaw = this.castYaw; c.faceRate = 20; mul = 0.12; intent.jumpPressed = false;
      if (this.castTarget && this.castTarget.alive !== false) this.castYaw = Math.atan2(this.castTarget.pos.x - c.pos.x, this.castTarget.pos.z - c.pos.z);
      const def = this.castDef, fxk = def?.school === 'glaube' ? 'holy' : 'fire';
      if (!this.impactDone && this.t >= this.impactAt) { this.impactDone = true; this.castSpell(def); }
      if (this.t < this.impactAt) this.combat.fx(fxk, m.handWorld('l', _w), 1, { speed: 0.3, up: 0.4 });
      if (this.t >= this.dur) this.state = 'free';
    } else if (st === 'drink') {
      mul = 0.35; intent.jumpPressed = false; intent.sprint = false;
      if (this.healPending && this.t >= this.impactAt) {
        this.healPending = false;
        const amt = this.maxHp * F.flaskHeal * (1 + this.mod('flaskHealMul'));
        this.healLeft = amt; this.healRate = amt / F.flaskTime;
        this.combat.fx('heal', _v.set(c.pos.x, c.pos.y + 1.2, c.pos.z), 14, { stars: true });
        this.combat.fx('fire', m.handWorld('l', _w), 6, { speed: 0.4 });
      }
      if (this.t >= this.dur) this.state = 'free';
    } else if (st === 'hurt') {
      mul = 0.25; intent.jumpPressed = false;
      if (this.t >= this.dur) this.state = 'free';
    } else {
      if (lockYaw !== null && !(intent.sprint && c.speed > 5)) { c.faceYaw = lockYaw; c.faceRate = 12; }
    }
    return mul;
  }

  addEffect(e) { if (e && e.update) this.effects.push(e); }

  // ================= Bewegungsabläufe (Combo / Schwer / Kunst) =================
  aim(dir) {
    const c = this.p.ctrl;
    const tg = this.softTarget(6.5, 1.25);
    this.atkTarget = tg;
    this.atkYaw = tg ? Math.atan2(tg.pos.x - c.pos.x, tg.pos.z - c.pos.z) : dir ? Math.atan2(dir.x, dir.z) : c.yaw;
  }
  aimTrack() {
    const c = this.p.ctrl, tg = this.atkTarget;
    if (tg && tg.alive !== false && tg.hp > 0) this.atkYaw = Math.atan2(tg.pos.x - c.pos.x, tg.pos.z - c.pos.z);
  }
  /** kind 'light'|'heavy'|'art', def = Schlag- bzw. Kunst-Definition, charge 0..1 (nur schwer) */
  startMove(kind, def, dir, charge = 0) {
    const cls = this.cls, m = this.p.model, F = FIGHT;
    const speed = cls.speed * (def.speed || 1) * (1 + this.mod('atkSpeedMul'));
    if (kind !== 'art') this.spendSta(F.atkCost * cls.staMul * (def.sta || 1) * (kind === 'heavy' ? 1.25 : 1));
    if (dir !== null || kind !== 'heavy') this.aim(dir);
    const anim = m.playAction(def.anim, { speed });
    this.enter('attack', anim);
    this.move = { kind, def, charge, speed, dmgMul: kind === 'heavy' ? 1 + F.chargeBonus * charge : 1, treeDone: false, armor: !!def.armor || kind === 'heavy' && charge > 0.6, iframes: def.iframes };
    // Treffer-Zeitpunkte
    if (kind === 'art') this.hits = def.hits.map(h => ({ t: h.at * this.dur, spec: h, done: false }));
    else { const n = def.multi || 1; this.hits = []; for (let k = 0; k < n; k++) this.hits.push({ t: this.impactAt + k * 0.09 / speed, spec: def, done: false }); }
    const last = this.hits.reduce((a, h) => Math.max(a, h.t), 0);
    this.recoverAt = (kind === 'art' ? last + 0.1 : last + 0.06);
    this.onAction?.(kind, { weapon: this.weapon.id, combo: this.combo, charge });
    if (kind === 'art') { this.combat.fx(this.weapon.art?.hits?.[0]?.fx === 'dark' ? 'dark' : 'spark', m.bladeWorld(_w), 10); this.hooks.rumble?.(this.p.i, 0.35, 90); }
  }

  runMove(dt, intent) {
    const c = this.p.ctrl, mv = this.move; if (!mv) return;
    const def = mv.def, u = this.t / this.dur;
    this.aimTrack();
    c.faceYaw = this.atkYaw; c.faceRate = mv.kind === 'art' ? 10 : 22;
    // Lenken während Dash/Leap
    const steer = this.inputDir(intent, this.p.cam.yaw, _u);
    if (steer && !this.atkTarget && (def.dash || def.leap)) this.atkYaw = this.atkYaw + wrap(Math.atan2(steer.x, steer.z) - this.atkYaw) * Math.min(1, dt * 3);
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    const near = this.atkTarget ? Math.hypot(this.atkTarget.pos.x - c.pos.x, this.atkTarget.pos.z - c.pos.z) - this.atkTarget.radius : 9;
    // Dash / Sprung (Waffenkunst)
    const D = def.dash || def.leap;
    if (D && u >= D.from && u <= D.to) {
      const stop = def.dash && def.dash.speed > 6 ? 1 : clamp((near - 0.8) / 1.2, 0, 1);
      c.override = _w.set(fx * D.speed * stop, 0, fz * D.speed * stop);
      if (def.dash && Math.random() < dt * 30) this.combat.fx('dust', _v.set(c.pos.x, c.pos.y + 0.1, c.pos.z), 1);
    } else if (!D) {
      // Ausfallschritt kurz vor dem Treffer (weniger, wenn das Ziel schon nah ist)
      const first = this.hits[0]?.t ?? this.impactAt;
      if (this.t > first - 0.12 && this.t < first + 0.04 && near > 1.0 && def.lunge) {
        const ls = def.lunge * clamp((near - 0.9) / 1.5, 0, 1) * (mv.kind === 'heavy' ? 1 + mv.charge * 0.3 : 1);
        c.override = _w.set(fx * ls, 0, fz * ls);
      }
    }
    for (const h of this.hits) if (!h.done && this.t >= h.t) { h.done = true; this.fireHit(h.spec, mv); }
  }

  /** Eine Trefferphase auslösen: Hitbox (Form), Baumschlag, FX */
  fireHit(s, mv) {
    const c = this.p.ctrl, i = this.p.i, cls = this.cls, W = this.weapon, self = this;
    const shape = shapeOf(s), reach = s.reach || 1.8, kb = (s.kb ?? 3) * cls.kb;
    const dmg = this.weaponDmg((s.dmg ?? 1) * mv.dmgMul, s.scale);
    const stagger = Math.min(1, (s.stagger ?? 0.2) * (mv.kind === 'heavy' ? 1 + mv.charge * 0.4 : 1));
    const hs = cls.hitstop * (mv.kind === 'heavy' ? 1.4 : mv.kind === 'art' ? 1.2 : 1), shk = cls.shake * (mv.kind === 'light' ? 1 : 1.5);
    const fxk = s.fx || 'spark';
    const onC = () => { self.hooks.kick?.(i, shk * 1.5); self.hooks.rumble?.(i, clamp(0.3 + shk, 0.3, 1), 70 + shk * 120); };
    const base = { owner: this.actor, team: 'player', damage: dmg, knockback: kb, stagger, kind: 'melee', onHitFx: fxk, hitstop: hs, shake: shk, onConnect: onC };
    const pt = new THREE.Vector3(), t0 = this.t, yaw0 = c.yaw;
    const win = Math.max(0.06, 0.11 / (mv.speed || 1));
    const Y = 1.0;
    // Baumfällen (einmal pro Bewegung, nur Nahkampf-Formen)
    const tryTree = (r) => {
      if (mv.treeDone || shape === 'proj' || shape === 'wave' || !this.world.hitTree) return;
      mv.treeDone = true;
      const dmgT = (W.base.tree ?? 1) * (s.tree ?? 1) * (mv.kind === 'heavy' ? 1 + mv.charge : 1);
      if (dmgT <= 0) return;
      _v.copy(c.pos); _v.y += 1.0;
      const res = this.world.hitTree(_v, c.forward(_w), r, dmgT) || {};
      if (res.hit) { this.hooks.kick?.(i, res.felled ? 1.2 : 0.35); this.hooks.rumble?.(i, res.felled ? 0.9 : 0.35, res.felled ? 200 : 60); if (res.point) this.combat.fx('wood', res.point, 6); }
    };
    if (shape === 'arc') {
      const arc = s.arc ?? 1.8, d = dirOf(s) === 'R' ? 1 : -1, rr = reach * 0.6, rad = Math.max(0.55, reach * 0.48);
      this.combat.hitbox(this.hitOpts({ ...base, radius: rad, duration: win,
        at: () => { const k = clamp((self.t - t0) / win, 0, 1), a = c.yaw + d * (k - 0.5) * arc; return pt.set(c.pos.x + Math.sin(a) * rr, c.pos.y + Y, c.pos.z + Math.cos(a) * rr); } }, s));
      tryTree(reach + 0.4);
    } else if (shape === 'thrust') {
      const rad = s.radius || 0.5;
      this.combat.hitbox(this.hitOpts({ ...base, radius: rad, duration: win,
        at: () => { const k = clamp((self.t - t0) / win, 0, 1), r = lerp(0.4, reach - rad * 0.5, k); return pt.set(c.pos.x + Math.sin(c.yaw) * r, c.pos.y + Y, c.pos.z + Math.cos(c.yaw) * r); } }, s));
      tryTree(reach);
    } else if (shape === 'spin' || shape === 'ring') {
      const r = s.radius || reach;
      this.combat.hitbox(this.hitOpts({ ...base, radius: r, duration: 0.1, at: () => pt.set(c.pos.x, c.pos.y + 0.9, c.pos.z) }, s));
      this.combat.fx(fxk, _v.set(c.pos.x, c.pos.y + 1, c.pos.z), 14, { ring: true, speed: 1.6, up: 0.3 });
      if (shape === 'ring') this.combat.shockwave(c.pos, r, 0xfff2a8, 0.3);
      tryTree(r);
    } else if (shape === 'slam') {
      const r = s.radius || 2.2, f = Math.min(reach, 1.4);
      const p = _v.set(c.pos.x + Math.sin(yaw0) * f, c.pos.y, c.pos.z + Math.cos(yaw0) * f), ph = p.clone(); ph.y += 0.5;
      this.combat.hitbox(this.hitOpts({ ...base, kind: 'slam', radius: r, duration: 0.1, at: () => ph }, s));
      this.combat.shockwave(p, r + 0.3, 0xe0cca0, 0.35);
      this.combat.fx('dust', ph, 22, { ring: true, speed: 2, up: 1 });
      this.combat.fx(fxk, ph, 12, { ring: true, speed: 1.5, up: 2 });
      this.combat.shake(shk * 2, c.pos);
      tryTree(reach + 0.5);
    } else if (shape === 'wave') {
      // Schockwelle rollt nach vorn: eine Hitbox wandert über `length` m
      const len = s.length || 8, dur = s.dur || 0.5, r = s.radius || 1.4, ox = c.pos.x, oz = c.pos.z, oy = c.pos.y, fx = Math.sin(yaw0), fz = Math.cos(yaw0);
      let tt = 0, lastRing = -1;
      this.combat.hitbox(this.hitOpts({ ...base, kind: 'slam', radius: r, duration: dur, hitstop: hs * 0.6,
        at: () => { const k = clamp(tt / dur, 0, 1), dd = 1 + k * len, x = ox + fx * dd, z = oz + fz * dd; return pt.set(x, (this.world.heightAt ? this.world.heightAt(x, z) : oy) + 0.6, z); } }, s));
      this.addEffect({ update: dt => {
        tt += dt; const k = clamp(tt / dur, 0, 1), n = Math.floor(k * 6);
        if (n !== lastRing) { lastRing = n; const dd = 1 + k * len, q = _u.set(ox + fx * dd, 0, oz + fz * dd); q.y = this.world.heightAt ? this.world.heightAt(q.x, q.z) : oy;
          this.combat.shockwave(q, r, 0xd8b880, 0.25); this.combat.fx('dust', q.setY(q.y + 0.2), 8, { up: 2.5 }); }
        return tt < dur;
      } });
    } else if (shape === 'proj') {
      const from = this.p.model.bladeWorld(new THREE.Vector3()); from.y = Math.max(from.y, c.pos.y + 0.9);
      const tg = this.atkTarget && this.atkTarget.hp > 0 ? this.atkTarget : null, vel = new THREE.Vector3();
      if (tg) vel.set(tg.pos.x, tg.pos.y + tg.height * 0.5, tg.pos.z).sub(from).normalize().multiplyScalar(s.speed || 18);
      else vel.set(Math.sin(c.yaw), 0, Math.cos(c.yaw)).multiplyScalar(s.speed || 18);
      this.combat.projectile(this.hitOpts({ ...base, kind: 'spell', pos: from, vel, radius: s.radius || 0.4, life: s.life || 1.2, fx: fxk,
        homing: s.homing ? tg : null, explodeRadius: s.explode || 0 }, s));
      this.combat.fx(fxk, from, 12);
    } else if (shape === 'dash') {
      const dur = s.dur || 0.4, rad = s.radius || 0.9;
      this.combat.hitbox(this.hitOpts({ ...base, radius: rad, duration: dur,
        at: () => pt.set(c.pos.x + Math.sin(c.yaw) * s.reach, c.pos.y + Y, c.pos.z + Math.cos(c.yaw) * s.reach) }, s));
      this.combat.fx('spark', this.p.model.bladeWorld(_w), 8);
    }
    this.hooks.rumble?.(i, 0.12 + shk * 0.3, 40);
  }

  // ================= Zauber =================
  castSpell(def) {
    if (!def) return;
    const c = this.p.ctrl, self = this;
    const tg = this.castTarget && this.castTarget.alive !== false && this.castTarget.hp > 0 ? this.castTarget : null;
    const ctx = {
      f: this, combat: this.combat, world: this.world, c, actor: this.actor, team: 'player',
      yaw: c.yaw, dir: new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw)), inputDir: this.castInputDir, target: tg,
      origin: this.p.model.handWorld('l', new THREE.Vector3()), power: this.spellPower(def),
      hitOpts: o => self.hitOpts(o), addEffect: e => self.addEffect(e),
    };
    try { def.cast(ctx); } catch (e) { console.error('Zauber ' + def.id, e); }
    this.hooks.rumble?.(this.p.i, 0.3, 60);
    this.hooks.kick?.(this.p.i, 0.2);
  }
}
