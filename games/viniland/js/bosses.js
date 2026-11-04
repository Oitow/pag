// Viniland – Bosse (siehe CONTRACT.md „Kampf (Erweiterung 2)“).
// 3 Bosse, mid-poly mit Vertex-Farben, prozedurale Animation + KI-Zustandsmaschine:
//   sleep → script('wake') → chase (jagen/umkreisen) → script('attack': Ausholen + Telegraph → Treffer) → recover → chase …
//   stun (Stagger-Leiste voll, 2 s), return (alle weg → zurück nach home, Heilung), dead (Kollaps + Auflösen).
// Angriffe sind Generatoren: `yield sek` wartet, dazwischen setzen sie Pose-Ziele, Antrieb und rufen combat.* auf.
import * as THREE from 'three';
import { psxMat } from './psx.js';
import { MeshBuilder, clamp, lerp, damp } from './kit.js';

const TAU = Math.PI * 2, PI = Math.PI, V3 = THREE.Vector3;
const UP = new V3(0, 1, 0);
const _v = new V3(), _w = new V3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

export const BOSS_TYPES = ['dogo', 'morra', 'kohlherz'];
export const BOSS_INFO = {
  dogo:     { name: 'Blanco', title: 'der Weiße Wächter', hp: 900, color: 0xf4efe8 },
  morra:    { name: 'Morra', title: 'die Glutlaterne', hp: 750, color: 0xff7a2a },
  kohlherz: { name: 'Kohlherz', title: 'der Grollende Koloss', hp: 1600, color: 0xff4a10 },
};

const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > PI) d -= TAU; if (d < -PI) d += TAU; return d; };
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
function grp(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }
/** Zylinder von p1 nach p2 (Arrays [x,y,z]) in einen MeshBuilder. */
function seg(b, p1, p2, r1, r2, color, n = 6) {
  _v.set(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]); const L = _v.length(); _v.normalize();
  _q.setFromUnitVectors(UP, _v); _e.setFromQuaternion(_q);
  b.cyl(r2, r1, L, color, { x: (p1[0] + p2[0]) / 2, y: (p1[1] + p2[1]) / 2, z: (p1[2] + p2[2]) / 2, rx: _e.x, ry: _e.y, rz: _e.z }, n);
}
function addLeg(B, parent, o) {
  const { x, y, z, l1, l2, r, c1, c2, fc } = o;
  const hip = grp(parent, x, y, z);
  const b1 = new MeshBuilder();
  b1.sphere(r * 1.3, c1, { y: -r * 0.2 }, 6, 4);
  b1.cyl(r * 1.2, r * 0.9, l1, c1, { y: -l1 / 2 }, 7);
  if (o.extra1) o.extra1(b1);
  hip.add(b1.mesh(B.mat));
  const knee = grp(hip, 0, -l1, 0);
  const b2 = new MeshBuilder();
  b2.sphere(r * 0.95, c2, {}, 6, 4);
  b2.cyl(r * 0.9, r * 0.75, l2, c2, { y: -l2 / 2 }, 7);
  if (o.foot === 'block') b2.box(r * 2.2, r * 0.8, r * 2.8, fc, { y: -l2 + r * 0.3, z: r * 0.5 });
  else b2.sphere(r * 1.3, fc, { y: -l2 + r * 0.5, z: r * 0.45, sy: 0.6, sz: 1.35 }, 6, 4);
  if (o.extra2) o.extra2(b2);
  knee.add(b2.mesh(B.mat));
  return { hip, knee, l1, l2, side: Math.sign(x) || 1, front: !!o.front };
}

// ---------------------------------------------------------------- Partikel (eigene, Weltraum, vorallokiert)
class Embers {
  constructor(scene, n, color, size) {
    this.n = n; this.i = 0; this.scene = scene;
    this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.c = new Float32Array(n * 3);
    this.l = new Float32Array(n); this.l0 = new Float32Array(n).fill(1);
    for (let i = 0; i < n; i++) this.p[i * 3 + 1] = -999;
    this.base = new THREE.Color(color);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.c, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    this.points.frustumCulled = false; scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, life) {
    const i = this.i; this.i = (i + 1) % this.n;
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz; this.l[i] = this.l0[i] = life;
  }
  update(dt, rise) {
    const { p, v, c, l, l0, base } = this;
    for (let i = 0; i < this.n; i++) {
      if (l[i] <= 0) continue;
      l[i] -= dt;
      const k = l[i] <= 0 ? 0 : l[i] / l0[i], j = i * 3;
      if (l[i] <= 0) p[j + 1] = -999;
      else { v[j + 1] += rise * dt; p[j] += v[j] * dt; p[j + 1] += v[j + 1] * dt; p[j + 2] += v[j + 2] * dt; }
      const f = Math.min(1, k * 2.2) * (0.6 + 0.4 * Math.sin(i * 7.3 + k * 20));
      c[j] = base.r * f; c[j + 1] = base.g * f; c[j + 2] = base.b * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- Boss-Basis
let UID = 0;
class Boss {
  constructor(type, def, o) {
    this.type = type; this.def = def; this.scene = o.scene; this.world = o.world; this.combat = o.combat;
    this.info = BOSS_INFO[type];
    this.home = (o.home || new V3()).clone();
    this.pos = this.home.clone(); this.pos.y = this.world.heightAt(this.pos.x, this.pos.z);
    this.yaw = o.yaw ?? def.yaw0 ?? 0;
    this.object3D = new THREE.Group(); this.object3D.name = 'boss_' + type;
    this.tilt = grp(this.object3D); this.mdl = grp(this.tilt);
    this.mat = psxMat({ noCache: true });
    this.glowMat = psxMat({ noCache: true, vertexColors: false, color: 0x000000, emissive: def.glow });
    this.pc = {}; this.pt = {}; this.pr = {};
    for (const k of def.poseKeys) { this.pc[k] = 0; this.pt[k] = 0; this.pr[k] = 8; }
    this.R = def.build(this);
    // Zustände
    this.state = 'sleep'; this.awake = false; this.phase = 1; this.T = Math.random() * 10;
    this.gen = null; this.scriptKind = ''; this.wait = 0; this.tickFn = null;
    this.track = 0; this.trackOff = 0; this.drive = 0; this.driveSide = 0; this.recT = 0; this.gap = 1;
    this.tgt = null; this.retarget = 0; this.switchT = 8; this.circleDir = 1; this.circleT = 3;
    this.sleepK = 1; this.deadK = 0; this.deadT = 0; this.flash = 0; this.flashRed = 0; this.flinch = 0;
    this.stg = 0; this.stunT = 0; this.dissolve = 0; this.provoked = false; this.gone = false; this.leapY = 0;
    this.spd = 0; this.gph = 0; this.lookErr = 0; this.pitch = 0; this.roll = 0;
    this.vel = new V3(); this.kb = new V3(); this._fwd = new V3(); this._side = new V3(); this._dir = new V3();
    this._fx = Array.from({ length: 16 }, () => new V3()); this._fxi = 0; this._cand = [];
    this.cds = {}; for (const a of def.attacks) this.cds[a.id] = Math.random() * a.cd * 0.5;
    this.players = [];
    this.embers = new Embers(this.scene, def.emberN || 48, def.emberColor, def.emberSize || 0.14);
    const self = this;
    this.actor = {
      id: `boss_${type}_${++UID}`, team: 'enemy', pos: this.pos, radius: def.radius, height: def.height,
      hp: this.info.hp, maxHp: this.info.hp, alive: true, isBoss: true, name: `${this.info.name}, ${this.info.title}`,
      object3D: this.object3D, stagger: 0,
      invuln: () => self.state === 'dead',
      onHit: h => self.onHit(h),
    };
    this.combat.addActor(this.actor);
    this.scene.add(this.object3D);
    this.place();
  }

  // ---- Helfer für Angriffs-Skripte
  fxPos(x, y, z) { const v = this._fx[this._fxi = (this._fxi + 1) & 15]; return v.set(x, y, z); }
  fxAt(kind, obj, n, x = 0, y = 0, z = 0) { const v = this._fx[this._fxi = (this._fxi + 1) & 15]; v.set(x, y, z); obj.localToWorld(v); this.combat.fx(kind, v, n); }
  /** at()-Funktion für Hitboxen: Weltposition eines lokalen Punkts an einem Knochen. */
  boneAt(obj, x = 0, y = 0, z = 0) { const v = new V3(); return () => { v.set(x, y, z); return obj.localToWorld(v); }; }
  worldOf(obj, x = 0, y = 0, z = 0, out = new V3()) { out.set(x, y, z); return obj.localToWorld(out); }
  fwd(out = this._fwd) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  ahead(d, out = new V3()) { this.fwd(_w); return out.copy(this.pos).addScaledVector(_w, d); }
  pose(o, rate = 8) { for (const k in o) { this.pt[k] = o[k]; this.pr[k] = rate; } }
  poseReset(rate = 6) { for (const k in this.pt) { this.pt[k] = 0; this.pr[k] = rate; } }
  angTo(p) { return Math.atan2(p.x - this.pos.x, p.z - this.pos.z); }
  distTo(p) { const dx = p.x - this.pos.x, dz = p.z - this.pos.z; return Math.sqrt(dx * dx + dz * dz); }
  hit(o) { return this.combat.hitbox({ owner: this.actor, team: 'enemy', knockback: 4, stagger: 0.3, kind: 'melee', ...o }); }
  tele(o) { return this.combat.telegraph(o); }
  alivePlayers(out, maxD = 1e9) {
    out.length = 0;
    for (const p of this.players) if (p && p.alive !== false && (!p.actor || p.actor.alive !== false) && this.distTo(p.pos) < maxD) out.push(p);
    return out;
  }
  validGround(x, z) { return this.world.heightAt(x, z) > (this.world.waterLevel ?? 0) + 0.35; }

  // ---- Zustands-Übergänge
  runScript(gen, kind) {
    this.endScript(); this.gen = gen; this.scriptKind = kind; this.state = 'script'; this.wait = 0; this.recT = 0.5;
  }
  endScript() {
    this.gen = null; this.tickFn = null; this.track = 0; this.trackOff = 0; this.drive = 0; this.driveSide = 0; this.leapY = 0;
    this.poseReset(); if (this.def.onAbort) this.def.onAbort(this);
  }
  stun() {
    this.endScript(); this.state = 'stun'; this.stunT = 2.0; this.stg = 0;
    if (this.R.head) this.fxAt('spark', this.R.head, 14, 0, 0.4, 0);
  }
  die() {
    if (this.state === 'dead') return;
    this.endScript(); this.state = 'dead'; this.deadT = 0; this.awake = false; this.combat.shake(0.6);
    this.flash = 1; this.flashRed = 1;
  }
  onHit(h) {
    if (this.state === 'dead' || this.gone) return;
    this.flash = 1; this.flashRed = 0;
    if (this.state === 'sleep') this.provoked = true;
    const st = h.stagger ?? 0.2;
    if (st >= 0.6 || (h.damage || 0) >= 35) this.flinch = 1;
    if (h.dir) this.kb.addScaledVector(h.dir, (h.knockback || 0) * this.def.kbMul);
    if (this.state !== 'stun' && !(this.state === 'script' && this.scriptKind !== 'attack')) {
      this.stg += st + 0.12;
      if (this.stg >= this.def.stgMax) this.stun();
    }
    if (this.actor.hp <= 0) this.die();
  }

  pickTarget(dt) {
    const c = this.alivePlayers(this._cand, this.def.leash);
    if (!c.length) return (this.tgt = null);
    this.retarget -= dt; this.switchT -= dt;
    const valid = this.tgt && c.includes(this.tgt);
    if (!valid || this.retarget <= 0) {
      this.retarget = 0.5;
      let best = null, bd = 1e9;
      for (const p of c) { const d = this.distTo(p.pos); if (d < bd) { bd = d; best = p; } }
      if (!valid || this.distTo(this.tgt.pos) > bd * 1.6 + 2) this.tgt = best;
    }
    if (this.switchT <= 0) {
      this.switchT = 7 + Math.random() * 6;
      if (c.length > 1 && Math.random() < 0.45) { const o = c.filter(p => p !== this.tgt); this.tgt = o[(Math.random() * o.length) | 0]; }
    }
    return this.tgt;
  }

  chooseAttack(dist, angErr) {
    const c = this._cand; c.length = 0; let W = 0;
    for (const a of this.def.attacks) {
      if (a.p2 && this.phase < 2) continue;
      if (this.cds[a.id] > 0 || dist < a.min || dist > a.max || Math.abs(angErr) > (a.ang ?? 1.0)) continue;
      c.push(a); W += a.w;
    }
    let r = Math.random() * W;
    for (const a of c) { r -= a.w; if (r <= 0) return a; }
    return null;
  }

  // ---- Bewegung
  turnTo(ang, rate, dt) { const d = angDiff(this.yaw, ang); this.yaw += clamp(d, -rate * dt, rate * dt); }
  moveBy(dx, dz) {
    const nx = this.pos.x + dx, nz = this.pos.z + dz;
    const L = Math.hypot(dx, dz) || 1, pr = this.def.radius * 0.6;   // etwas vorausschauen (Körper nicht ins Wasser)
    const h = this.world.heightAt(nx + dx / L * pr, nz + dz / L * pr), wl = this.world.waterLevel ?? 0;
    if (h < wl + 0.35 && h < this.world.heightAt(this.pos.x, this.pos.z)) return false; // nicht ins Wasser
    this.pos.x = nx; this.pos.z = nz;
    if (this.world.collide) this.world.collide(this.pos, this.def.radius * 0.8, this.def.height);
    return true;
  }
  place() {
    const W = this.world, d = this.def;
    this.pos.y = W.heightAt(this.pos.x, this.pos.z);
    this.object3D.position.set(this.pos.x, this.pos.y + this.leapY, this.pos.z);
    this.object3D.rotation.y = this.yaw;
  }

  // ---- Haupt-Update
  update(dt, players) {
    if (this.gone) return;
    this.players = players || this.players; this.T += dt;
    const a = this.actor, d = this.def;
    if (this.state !== 'dead' && a.hp <= 0) this.die();
    for (const k in this.cds) this.cds[k] -= dt;
    this.gap -= dt; this.flinch = Math.max(0, this.flinch - dt * 4);
    this.flash = Math.max(0, this.flash - dt * 7);
    this.stg = Math.max(0, this.stg - dt * d.stgDecay); a.stagger = this.stg / d.stgMax;
    const boost = this.phase === 2 ? d.p2speed : 1;
    let tvx = 0, tvz = 0, direct = false;
    const tg = this.tgt;
    if (tg) this.lookErr = damp(this.lookErr, angDiff(this.yaw, this.angTo(tg.pos)), 6, dt);
    else this.lookErr = damp(this.lookErr, 0, 3, dt);

    switch (this.state) {
      case 'sleep': {
        this.awake = false;
        if (this.provoked || this.alivePlayers(this._cand, 1e9).some(p => p.pos.distanceTo(this.home) < d.wakeR)) {
          this.provoked = false; this.runScript(d.wake(this), 'wake');
        }
        break;
      }
      case 'script': {
        if (this.scriptKind !== 'wake') this.pickTarget(dt);
        if (this.track > 0 && this.tgt) this.turnTo(this.angTo(this.tgt.pos) + this.trackOff, this.track * boost, dt);
        if (this.tickFn) this.tickFn(dt);
        this.wait -= dt;
        while (this.gen && this.wait <= 0) {
          const r = this.gen.next();
          if (r.done) {
            const kind = this.scriptKind, rec = this.recT; this.endScript();
            if (kind === 'wake') { this.awake = true; this.state = 'chase'; this.gap = 0.5; }
            else { this.state = 'recover'; this.recT = rec; }
            break;
          }
          this.wait += (r.value || 0) / (this.phase === 2 ? d.p2tempo : 1);
        }
        this.fwd(); this._side.set(this._fwd.z, 0, -this._fwd.x);
        tvx = this._fwd.x * this.drive + this._side.x * this.driveSide;
        tvz = this._fwd.z * this.drive + this._side.z * this.driveSide; direct = true;
        break;
      }
      case 'recover': {
        this.recT -= dt; this.pickTarget(dt);
        if (this.tgt) this.turnTo(this.angTo(this.tgt.pos), d.turn * 0.25, dt);
        if (this.recT <= 0) { this.state = 'chase'; this.gap = d.gap * (0.5 + Math.random()) / boost; }
        break;
      }
      case 'stun': {
        this.stunT -= dt;
        if (Math.floor(this.stunT * 2.5) !== Math.floor((this.stunT + dt) * 2.5) && this.R.head) this.fxAt('spark', this.R.head, 3, 0, 0.5, 0);
        if (this.stunT <= 0) { this.state = 'chase'; this.gap = 0.4; }
        break;
      }
      case 'chase': {
        this.awake = true;
        if (this.phase === 1 && a.hp <= a.maxHp * 0.5) {
          this.phase = 2; this.flashRed = 1; this.flash = 1;
          if (d.enrage) { this.runScript(d.enrage(this), 'enrage'); break; }
        }
        const t = this.pickTarget(dt);
        if (!t || this.distTo(this.home) > d.leash) { this.state = 'return'; this.tgt = null; break; }
        const dist = this.distTo(t.pos), ang = this.angTo(t.pos), err = angDiff(this.yaw, ang);
        if (this.gap <= 0) {
          const atk = this.chooseAttack(dist, err);
          if (atk) { this.cds[atk.id] = atk.cd * (this.phase === 2 ? 0.72 : 1); this.tgt = t; this.runScript(atk.run(this, t), 'attack'); break; }
        }
        this.turnTo(ang, d.turn * boost, dt);
        this.circleT -= dt; if (this.circleT <= 0) { this.circleT = 2 + Math.random() * 3; this.circleDir = -this.circleDir; }
        const [k0, k1] = d.keep;
        this.fwd();
        if (dist > k1) {
          const s = (dist > k1 + 5 ? d.run : d.walk) * boost * Math.max(0, Math.cos(err));
          tvx = this._fwd.x * s; tvz = this._fwd.z * s;
        } else if (dist < k0) {
          tvx = -this._fwd.x * d.walk * 0.8; tvz = -this._fwd.z * d.walk * 0.8;
        } else {
          const s = d.walk * d.circle * this.circleDir;
          tvx = this._fwd.z * s; tvz = -this._fwd.x * s;
        }
        if (d.chaseTick) d.chaseTick(this, dt, t, dist);
        break;
      }
      case 'return': {
        this.awake = true;
        const near = this.alivePlayers(this._cand, 1e9).some(p => p.pos.distanceTo(this.home) < d.wakeR * 0.8);
        if (near) { this.state = 'chase'; break; }
        const dist = this.distTo(this.home);
        if (dist < 1.5) {
          this.state = 'sleep'; this.awake = false; this.phase = 1; a.hp = a.maxHp; this.stg = 0;
          for (const k in this.cds) this.cds[k] = 0;
          break;
        }
        this.turnTo(this.angTo(this.home), d.turn, dt); this.fwd();
        tvx = this._fwd.x * d.walk; tvz = this._fwd.z * d.walk;
        break;
      }
      case 'dead': {
        this.deadT += dt;
        const t = this.deadT, T1 = d.deathDur || 1.6;
        if (t > T1) {
          const k = clamp((t - T1) / 1.3, 0, 1);
          this.dissolve = k;
          if (Math.floor(t * 10) !== Math.floor((t - dt) * 10)) {
            const r = d.radius * 1.2, an = Math.random() * TAU;
            this.combat.fx(d.deathFx, this.fxPos(this.pos.x + Math.sin(an) * r * Math.random(), this.pos.y + Math.random() * d.height * (1 - k * 0.8), this.pos.z + Math.cos(an) * r * Math.random()), 6);
            for (let i = 0; i < 6; i++) this.embers.emit(this.pos.x + (Math.random() - 0.5) * r * 2, this.pos.y + Math.random() * d.height * (1 - k), this.pos.z + (Math.random() - 0.5) * r * 2,
              (Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2, 1.2);
          }
          if (k >= 1) {
            this.object3D.visible = false; a.alive = false; this.gone = true; this.awake = false;
            this.combat.fx(d.deathFx, this.fxPos(this.pos.x, this.pos.y + d.height * 0.4, this.pos.z), 40);
            this.combat.fx('spark', this.fxPos(this.pos.x, this.pos.y + d.height * 0.4, this.pos.z), 24);
            this.combat.shake(0.5);
            this.embers.points.visible = false;
            return;
          }
        }
        break;
      }
    }

    // Integration
    if (direct) { this.vel.x = tvx; this.vel.z = tvz; }
    else { this.vel.x = damp(this.vel.x, tvx, d.accel, dt); this.vel.z = damp(this.vel.z, tvz, d.accel, dt); }
    const kx = this.kb.x, kz = this.kb.z; this.kb.multiplyScalar(Math.exp(-6 * dt));
    if (this.state !== 'dead') this.moveBy((this.vel.x + kx) * dt, (this.vel.z + kz) * dt);
    this.spd = damp(this.spd, Math.hypot(this.vel.x, this.vel.z), 10, dt);

    // Anneigen am Hang
    const W = this.world, s = Math.sin(this.yaw), c = Math.cos(this.yaw), L = d.tiltL, Wd = d.tiltW, px = this.pos.x, pz = this.pos.z;
    const hf = W.heightAt(px + s * L, pz + c * L), hb = W.heightAt(px - s * L, pz - c * L);
    const hl = W.heightAt(px + c * Wd, pz - s * Wd), hr = W.heightAt(px - c * Wd, pz + s * Wd);
    this.pitch = damp(this.pitch, -Math.atan2(hf - hb, 2 * L) * d.tiltMul, 6, dt);
    this.roll = damp(this.roll, Math.atan2(hl - hr, 2 * Wd) * d.tiltMul, 6, dt);
    this.tilt.rotation.set(this.pitch, 0, this.roll);

    // Pose + Animation
    for (const k in this.pc) this.pc[k] = damp(this.pc[k], this.pt[k], this.pr[k], dt);
    this.sleepK = damp(this.sleepK, this.state === 'sleep' ? 1 : 0, this.state === 'sleep' ? 1.5 : d.wakeRate, dt);
    this.deadK = this.state === 'dead' ? smooth(this.deadT / (d.deathDur || 1.6)) : 0;
    d.animate(this, dt);
    if (this.state === 'dead' && this.dissolve > 0) { const k = this.dissolve; this.mdl.scale.set(1 - k * 0.85, 1 - k * 0.95, 1 - k * 0.85); }

    // Treffer-Aufblitzen (weiß → bei Phase/Tod rot)
    const f = this.flash;
    this.mat.emissive.setRGB(f * 0.9, f * (this.flashRed ? 0.15 : 0.85), f * (this.flashRed ? 0.1 : 0.8));

    this.place();
    this.object3D.updateMatrixWorld(true);
    d.emit(this, dt);
    this.embers.update(dt, d.emberRise ?? 1.2);
  }

  dispose() {
    this.combat.removeActor(this.actor);
    this.scene.remove(this.object3D); this.scene.remove(this.embers.points);
    this.object3D.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.embers.points.geometry.dispose(); this.embers.points.material.dispose();
    this.mat.dispose(); this.glowMat.dispose(); this.gone = true;
  }
}

// ================================================================ 1) DOGO – Blanco, der Weiße Wächter
const DOGO = {
  radius: 1.1, height: 2.3, walk: 3.6, run: 8.5, turn: 4.2, accel: 5, keep: [2.4, 4.2], circle: 0.8,
  wakeR: 22, leash: 60, gap: 0.9, stgMax: 4, stgDecay: 0.25, kbMul: 0.15, p2speed: 1.3, p2tempo: 1.2,
  tiltL: 1.0, tiltW: 0.45, tiltMul: 1, wakeRate: 1.6, deathDur: 1.5, deathFx: 'spark',
  glow: 0xff2a10, emberColor: 0xfff4e0, emberSize: 0.1, emberRise: 0.4, emberN: 32,
  poseKeys: ['head', 'jaw', 'crouch', 'rear', 'lean', 'stretch'],
  build(B) {
    const Wt = 0xf4efe8, Wd = 0xe4ddd2, PK = 0xe49aa0, NO = 0xd9848c, DK = 0x433636, BL = 0x161010;
    const LE = 0x6a3a22, FE = 0x8a8e96;
    const R = { legs: [], ears: [] };
    R.py = 1.38;
    R.body = grp(B.mdl, 0, R.py, -0.75);
    const off = grp(R.body, 0, -R.py, 0.75); // Autorenraum = Modellkoordinaten
    const b = new MeshBuilder();
    b.sphere(1, Wt, { y: 1.44, z: 0, sx: 0.5, sy: 0.52, sz: 0.95 }, 10, 7);
    b.sphere(1, Wt, { y: 1.4, z: 0.62, sx: 0.56, sy: 0.62, sz: 0.55 }, 10, 7);
    b.sphere(1, Wd, { y: 1.12, z: 0.1, sx: 0.36, sy: 0.24, sz: 0.62 }, 8, 5);
    b.sphere(1, Wt, { y: 1.46, z: -0.72, sx: 0.48, sy: 0.5, sz: 0.52 }, 9, 6);
    for (const s of [1, -1]) {
      b.sphere(0.32, Wt, { x: s * 0.33, y: 1.52, z: 0.72, sy: 1.15 }, 7, 5);
      b.sphere(0.34, Wt, { x: s * 0.29, y: 1.36, z: -0.8, sy: 1.25 }, 7, 5);
      b.sphere(0.2, Wd, { x: s * 0.42, y: 1.32, z: 0.3, sz: 1.8 }, 6, 4); // Rippen-Muskel
    }
    b.sphere(0.18, PK, { y: 1.08, z: -0.55, sx: 1.2, sy: 0.5 }, 6, 4);
    off.add(b.mesh(B.mat));
    // Hals + Halsband
    R.neckRest = -0.75;
    R.neck = grp(off, 0, 1.68, 0.98); R.neck.rotation.x = R.neckRest;
    const n = new MeshBuilder();
    n.cyl(0.29, 0.4, 0.75, Wt, { z: 0.3, rx: PI / 2 }, 9);
    n.add(new THREE.TorusGeometry(0.36, 0.07, 5, 14), LE, { z: 0.2 });
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; n.sphere(0.035, FE, { x: Math.cos(a) * 0.42, y: Math.sin(a) * 0.42, z: 0.2 }, 4, 3); }
    n.add(new THREE.TorusGeometry(0.11, 0.028, 4, 10), FE, { y: -0.5, z: 0.2, ry: PI / 2 });
    R.neck.add(n.mesh(B.mat));
    // Kopf
    R.head = grp(R.neck, 0, 0, 0.62); R.head.rotation.x = -R.neckRest;
    const h = new MeshBuilder();
    h.sphere(1, Wt, { y: 0.06, sx: 0.33, sy: 0.29, sz: 0.34 }, 9, 7);
    h.sphere(1, Wt, { y: 0.14, z: 0.14, sx: 0.28, sy: 0.12, sz: 0.2 }, 7, 4);
    for (const s of [1, -1]) h.sphere(0.17, Wt, { x: s * 0.2, y: -0.04, z: 0.1 }, 6, 4);
    h.sphere(1, Wt, { y: -0.03, z: 0.34, sx: 0.21, sy: 0.16, sz: 0.25 }, 8, 5);
    for (const s of [1, -1]) h.sphere(0.12, Wd, { x: s * 0.11, y: -0.1, z: 0.36, sy: 0.8 }, 6, 4);
    h.sphere(0.075, NO, { y: 0.06, z: 0.56, sy: 0.75, sx: 1.2 }, 6, 4);
    for (const s of [1, -1]) h.sphere(0.02, BL, { x: s * 0.03, y: 0.05, z: 0.62 }, 4, 3);
    h.sphere(1, DK, { x: 0.165, y: 0.13, z: 0.2, sx: 0.12, sy: 0.1, sz: 0.08, jitter: 0 }, 7, 5); // Augenfleck
    for (const s of [1, -1]) {
      h.sphere(0.052, BL, { x: s * 0.17, y: 0.13, z: 0.25, jitter: 0 }, 6, 4);
      h.sphere(0.016, 0xffffff, { x: s * 0.175, y: 0.15, z: 0.295, jitter: 0 }, 4, 3);
      h.cone(0.022, 0.12, 0xfffaf0, { x: s * 0.1, y: -0.17, z: 0.47, rx: PI }, 5); // Fangzahn oben
    }
    R.head.add(h.mesh(B.mat));
    const eg = new MeshBuilder();
    for (const s of [1, -1]) eg.sphere(0.03, 0, { x: s * 0.18, y: 0.13, z: 0.27 }, 5, 3);
    R.head.add(eg.mesh(B.glowMat));
    for (const s of [1, -1]) {
      const e = grp(R.head, s * 0.2, 0.26, -0.06); e.rotation.z = -s * 0.35;
      const eb = new MeshBuilder();
      eb.cone(0.1, 0.24, Wt, { y: 0.1, sz: 0.5 }, 6); eb.cone(0.065, 0.17, PK, { y: 0.08, z: 0.03, sz: 0.4 }, 6);
      e.add(eb.mesh(B.mat)); R.ears.push(e);
    }
    R.jaw = grp(R.head, 0, -0.13, 0.1);
    const j = new MeshBuilder();
    j.box(0.3, 0.08, 0.42, Wt, { z: 0.22 }); j.sphere(0.1, Wt, { y: -0.03, z: 0.38, sx: 1.3, sy: 0.6 }, 6, 4);
    j.box(0.16, 0.03, 0.3, PK, { y: 0.045, z: 0.22 });
    for (const s of [1, -1]) j.cone(0.02, 0.1, 0xfffaf0, { x: s * 0.09, y: 0.08, z: 0.39 }, 5);
    R.jaw.add(j.mesh(B.mat));
    // Schwanz
    R.tail = grp(off, 0, 1.6, -1.18);
    const t = new MeshBuilder(); t.cyl(0.05, 0.11, 0.85, Wt, { y: -0.42 }, 6); R.tail.add(t.mesh(B.mat));
    // Beine
    for (const s of [1, -1]) {
      R.legs.push(addLeg(B, off, { x: s * 0.33, y: 1.4, z: 0.72, l1: 0.68, l2: 0.68, r: 0.14, c1: Wt, c2: Wt, fc: Wt, front: true }));
      R.legs.push(addLeg(B, off, { x: s * 0.3, y: 1.4, z: -0.78, l1: 0.72, l2: 0.68, r: 0.15, c1: Wt, c2: Wt, fc: Wt }));
    }
    return R;
  },
  animate(b, dt) {
    const R = b.R, P = b.pc, sp = b.spd, sl = b.sleepK, dk = b.deadK, T = b.T;
    const mov = clamp(sp / 3, 0, 1), gal = clamp((sp - 4.5) / 4, 0, 1);
    b.gph += dt * (2.0 + sp * 1.05);
    const ph = b.gph, amp = (0.32 * mov + 0.3 * gal) * (1 - sl) * (1 - dk);
    const drop = clamp(P.crouch * 0.42 + Math.abs(Math.sin(ph)) * 0.05 * amp - P.stretch * 0.05, -0.08, 0.6);
    const breath = Math.sin(T * (b.state === 'recover' ? 7 : 2.2)) * (b.state === 'recover' ? 0.025 : 0.012);
    const stun = b.state === 'stun' ? 1 : 0;
    R.body.position.y = R.py - drop - sl * 0.8 - dk * 0.55 + breath - stun * 0.12;
    R.body.rotation.x = -P.rear * 0.6 + Math.sin(ph * 2 + 0.6) * 0.06 * amp + P.stretch * 0.12 - b.flinch * 0.12;
    R.body.rotation.z = Math.sin(ph) * 0.03 * amp + stun * Math.sin(T * 3) * 0.06;
    const sideOff = lerp(PI, 0.7, gal);
    for (const L of R.legs) {
      const o = (L.front ? 0 : PI) + (L.side > 0 ? 0 : sideOff);
      const s = Math.sin(ph + o), c = Math.cos(ph + o);
      const a = Math.acos(clamp(1 - Math.max(0, drop) / (L.l1 + L.l2), 0, 1));
      let hip, knee, sh, sk, dh, dkn;
      if (L.front) {
        hip = s * amp * 1.1 + a - P.rear * 0.9 * 0 - P.stretch * 0.6; knee = -2 * a + Math.max(0, c) * amp * 1.5 + P.stretch * 0.2;
        sh = -1.45; sk = 0.1; dh = -0.5; dkn = 0.1;
      } else {
        hip = -0.12 - s * amp * 1.0 - a + P.rear * 0.6 + P.stretch * 0.7; knee = 0.28 + 2 * a + Math.max(0, -c) * amp * 1.1 - P.rear * 0.4;
        sh = -1.3; sk = 2.5; dh = 0.5; dkn = 0.15;
      }
      L.hip.rotation.x = lerp(lerp(hip, sh, sl), dh, dk);
      L.knee.rotation.x = lerp(lerp(knee, sk, sl), dkn, dk);
      L.hip.rotation.z = (sl * 0.15 + dk * 0.25) * L.side;
    }
    R.neck.rotation.x = R.neckRest + P.head * 0.75 + sl * 0.95 + mov * 0.2 + gal * 0.15 - b.flinch * 0.4 + stun * 0.5 + dk * 0.6;
    R.neck.rotation.y = clamp(b.lookErr, -0.6, 0.6) * (1 - sl) * 0.7 + stun * Math.sin(T * 4) * 0.3;
    R.head.rotation.x = -R.neckRest - sl * 0.3 - P.head * 0.2;
    R.jaw.rotation.x = 0.04 + P.jaw * 0.75 + (b.state === 'recover' ? 0.3 + Math.sin(T * 9) * 0.08 : 0) + gal * 0.15 + dk * 0.3;
    R.tail.rotation.x = 0.55 - mov * 0.25 + sl * 0.6 + P.crouch * 0.3;
    R.tail.rotation.z = Math.sin(T * (sl > 0.5 ? 1.2 : 7)) * (0.25 - 0.15 * sl) * (1 - dk);
    for (const e of R.ears) e.rotation.x = -P.jaw * 0.45 - gal * 0.35 + sl * 0.3;
    b.mdl.rotation.z = P.lean * 0.4 + dk * 1.35;
    b.mdl.position.y = dk * 0.35;
    b.glowMat.emissiveIntensity = b.phase === 2 ? (1.4 + Math.sin(T * 11) * 0.3) * (1 - dk) : 0;
  },
  emit(b, dt) { // Phase 2: Atemdampf/Funken am Maul
    if (b.phase === 2 && b.state !== 'dead' && Math.random() < dt * 14) {
      b.worldOf(b.R.head, 0, -0.05, 0.6, _v);
      b.embers.emit(_v.x, _v.y, _v.z, (Math.random() - 0.5) * 0.6, 0.3, (Math.random() - 0.5) * 0.6, 0.8);
    }
  },
  *wake(b) {
    b.pose({ head: 0.3 }, 2); yield 1.1;
    b.pose({ stretch: 1, head: 0.4 }, 4); b.combat.fx('dust', b.fxPos(b.pos.x, b.pos.y + 0.2, b.pos.z), 10); yield 0.7;
    b.pose({ stretch: 0, head: -0.55, jaw: 1 }, 6); b.combat.shake(0.25); yield 0.8;
    b.pose({ head: 0, jaw: 0 }, 6); yield 0.3;
  },
  attacks: [
    { id: 'bite', min: 0, max: 4.0, cd: 2.6, w: 3, ang: 0.8, *run(b, t) {
      const n = b.phase === 2 ? 3 : 2, jaw = b.boneAt(b.R.head, 0, -0.08, 0.55);
      for (let i = 0; i < n; i++) {
        b.track = 5; b.drive = -0.6; b.pose({ head: -0.45, jaw: 1, crouch: 0.3 }, 9);
        yield i === 0 ? 0.55 : 0.42;                         // Ausholen
        b.track = 1.2; b.drive = 8; b.pose({ head: 0.55, jaw: 0, crouch: -0.15 }, 24);
        b.hit({ radius: 0.9, duration: 0.18, damage: 12, knockback: 5, stagger: 0.35, at: jaw, kind: 'melee', onHitFx: 'spark' });
        yield 0.18;
        b.drive = 0; b.pose({ head: 0.1, jaw: 0.2, crouch: 0 }, 8);
        yield 0.28;
      }
      b.recT = 0.75;
    } },
    { id: 'pounce', min: 5, max: 14, cd: 6, w: 2, ang: 0.6, *run(b, t) {
      b.track = 4; b.pose({ crouch: 1, head: 0.25 }, 5);
      yield 0.35;
      b.track = 0;                                           // Richtung festlegen → faires Ausweichen
      const L = clamp(b.distTo(t.pos) + 1.5, 6, 13), dir = b.fwd(new V3());
      b.tele({ pos: b.pos.clone(), radius: 1.3, duration: 0.6, shape: 'line', dir, length: L + 1 });
      yield 0.6;
      const dur = 0.55; let tt = 0;
      b.pose({ crouch: -0.6, stretch: 1, head: 0.3, jaw: 1 }, 18);
      b.drive = L / dur;
      b.tickFn = dt => { tt += dt; b.leapY = Math.sin(PI * clamp(tt / dur, 0, 1)) * 2.0; };
      b.hit({ radius: 1.5, duration: dur, damage: 22, knockback: 9, stagger: 0.7, at: b.boneAt(b.R.neck, 0, 0, 0.3), kind: 'melee' });
      yield dur;
      b.tickFn = null; b.leapY = 0; b.drive = 0; b.pose({ crouch: 0.7, stretch: 0, jaw: 0.3 }, 20);
      const lp = b.ahead(1.2); lp.y += 0.5;
      b.hit({ radius: 2.3, duration: 0.12, damage: 8, knockback: 6, stagger: 0.3, at: () => lp, kind: 'slam' });
      b.combat.fx('dust', b.fxPos(lp.x, lp.y, lp.z), 20); b.combat.shake(0.4);
      yield 0.3;
      b.pose({ crouch: 0.2 }, 3);
      b.recT = 1.4;                                          // Stagger-Fenster
    } },
    { id: 'ram', min: 0, max: 5.5, cd: 5, w: 2, ang: 3.2, *run(b, t) {
      const s = Math.random() < 0.5 ? 1 : -1;
      b.trackOff = -s * PI / 2; b.track = 6; b.pose({ lean: -s * 0.6, crouch: 0.35 }, 7);
      yield 0.6;
      b.track = 0;
      const dir = new V3(Math.cos(b.yaw) * s, 0, -Math.sin(b.yaw) * s);
      b.tele({ pos: b.pos.clone(), radius: 1.2, duration: 0.01 + 0.15, shape: 'line', dir, length: 4.5 });
      yield 0.15;
      b.driveSide = 12 * s; b.pose({ lean: s * 0.8, crouch: 0 }, 22);
      b.hit({ radius: 1.35, duration: 0.3, damage: 16, knockback: 11, stagger: 0.5, at: b.boneAt(b.R.body, s * 0.6, 0.05, 0.85), kind: 'melee' });
      yield 0.3;
      b.driveSide = 0; b.pose({ lean: 0 }, 6); b.combat.fx('dust', b.fxPos(b.pos.x, b.pos.y + 0.3, b.pos.z), 10);
      yield 0.2;
      b.recT = 0.8;
    } },
    { id: 'howl', p2: true, min: 0, max: 9, cd: 9, w: 2, ang: 3.2, run: howl },
  ],
  enrage: b => howl(b),
};
function* howl(b) {
  b.pose({ rear: 0.8, head: -1.3, jaw: 0.4, crouch: 0.2 }, 5);
  const c = b.pos.clone(); c.y += 1;
  b.tele({ pos: b.pos.clone(), radius: 7.5, duration: 0.95, shape: 'circle' });
  yield 0.95;
  b.pose({ jaw: 1.2 }, 20);
  b.hit({ radius: 7.5, duration: 0.2, damage: 15, knockback: 13, stagger: 0.6, at: () => c, kind: 'slam', onHitFx: 'frost' });
  b.combat.fx('frost', b.fxPos(c.x, c.y, c.z), 40); b.combat.fx('dust', b.fxPos(c.x, c.y - 0.8, c.z), 30); b.combat.shake(0.7);
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; b.embers.emit(c.x + Math.sin(a), c.y, c.z + Math.cos(a), Math.sin(a) * 9, 0.5, Math.cos(a) * 9, 0.7); }
  yield 0.9;
  b.pose({ rear: 0, head: 0, jaw: 0 }, 5);
  yield 0.3;
  b.recT = 1.0;
}

// ================================================================ 2) MORRA – die Glutlaterne (schwebende Hexe, Fernkampf + Boden-AoE)
const MORRA = {
  radius: 0.9, height: 3.6, walk: 3.2, run: 4.6, turn: 3.0, accel: 3, keep: [7, 13], circle: 0.9,
  wakeR: 22, leash: 60, gap: 0.8, stgMax: 3.2, stgDecay: 0.2, kbMul: 0.35, p2speed: 1.2, p2tempo: 1.15,
  tiltL: 0.8, tiltW: 0.8, tiltMul: 0.25, wakeRate: 1.2, deathDur: 1.8, deathFx: 'dark',
  glow: 0xff7a2a, emberColor: 0xff8a30, emberSize: 0.16, emberRise: 1.6, emberN: 64,
  poseKeys: ['staff', 'slam', 'claw', 'swipe', 'hunch', 'vanish', 'cast', 'orbs'],
  build(B) {
    const RB = 0x2b2233, RB2 = 0x3a2b3c, RB3 = 0x1e1824, BO = 0xd9ccb0, HO = 0x3a2c28, WD = 0x4a3426, IR = 0x5a5250;
    const R = { strips: [], orbs: [] };
    R.float = grp(B.mdl, 0, 0.6, 0);
    const b = new MeshBuilder();
    b.cone(0.95, 2.4, RB, { y: 1.2 }, 9);
    b.cone(0.75, 1.8, RB3, { y: 0.85, z: -0.05 }, 8);
    b.sphere(1, RB2, { y: 2.2, z: 0.08, sx: 0.62, sy: 0.4, sz: 0.5 }, 8, 6);
    b.sphere(1, RB, { y: 2.32, z: -0.18, sx: 0.5, sy: 0.42, sz: 0.45 }, 8, 6);
    for (let i = 0; i < 9; i++) { const a = -1.2 + i * 0.3; b.sphere(0.055, BO, { x: Math.sin(a) * 0.5, y: 2.05 - Math.cos(a * 1.2) * 0.08, z: 0.28 + Math.cos(a) * 0.22 }, 5, 3); }
    b.box(0.5, 0.08, 0.06, 0x5a2a20, { y: 1.55, z: 0.5, rx: -0.35 });
    R.float.add(b.mesh(B.mat));
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU, g = grp(R.float, Math.sin(a) * 0.82, 0.5, Math.cos(a) * 0.82); g.rotation.y = a;
      const s = new MeshBuilder(); s.box(0.26, 0.8 + (i % 3) * 0.15, 0.05, i % 2 ? RB : RB2, { y: -0.35, rx: 0.25 }); s.cone(0.1, 0.25, RB3, { y: -0.85 - (i % 3) * 0.08, rx: PI }, 4);
      g.add(s.mesh(B.mat)); R.strips.push(g);
    }
    // Kopf: Kapuze + Ziegen-Schädelmaske + Hörner
    R.head = grp(R.float, 0, 2.42, 0.4); R.head.rotation.x = 0.2;
    const h = new MeshBuilder();
    h.sphere(1, RB3, { y: 0.14, z: -0.1, sx: 0.37, sy: 0.43, sz: 0.4 }, 8, 6);
    h.cone(0.22, 0.5, RB3, { y: 0.32, z: -0.42, rx: -2.0 }, 6);
    h.sphere(1, BO, { y: 0.04, z: 0.17, sx: 0.21, sy: 0.26, sz: 0.16 }, 7, 5);
    h.sphere(1, BO, { y: -0.13, z: 0.27, sx: 0.12, sy: 0.12, sz: 0.15 }, 6, 4);
    for (const s of [1, -1]) {
      h.sphere(0.065, 0x0e0808, { x: s * 0.09, y: 0.09, z: 0.29, jitter: 0 }, 5, 4);
      const pts = []; for (let k = 0; k < 6; k++) pts.push([s * (0.16 + 0.11 * k - 0.004 * k * k), 0.26 + 0.17 * k - 0.035 * k * k, 0.02 - 0.09 * k]);
      for (let k = 0; k < 5; k++) seg(h, pts[k], pts[k + 1], 0.075 - k * 0.012, 0.065 - k * 0.012, k > 3 ? 0x1a1010 : HO, 6);
      h.cone(0.018, 0.12, BO, { x: s * 0.05, y: -0.2, z: 0.33, rx: PI }, 4);
    }
    R.head.add(h.mesh(B.mat));
    const eg = new MeshBuilder(); for (const s of [1, -1]) eg.sphere(0.04, 0, { x: s * 0.09, y: 0.09, z: 0.33, sx: 1.3 }, 5, 3);
    R.head.add(eg.mesh(B.glowMat));
    R.halo = grp(R.head, 0, 0.55, -0.1);
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU, g = new MeshBuilder(); g.ico(0.07, 0, { x: Math.sin(a) * 0.45, z: Math.cos(a) * 0.45, sy: 2.2 }); R.halo.add(g.mesh(B.glowMat)); }
    // Seelenlichter (Phase 2, nur sichtbar beim Beschwören)
    R.orbG = grp(R.float, 0, 2.6, 0);
    for (let i = 0; i < 4; i++) { const g = new MeshBuilder(); g.ico(0.22, 0, {}, 1); const m = g.mesh(B.glowMat); m.position.set(Math.sin(i / 4 * TAU) * 1.4, 0, Math.cos(i / 4 * TAU) * 1.4); R.orbG.add(m); R.orbs.push(m); }
    R.orbG.visible = false;
    // Linker Arm: Stab mit Laterne
    R.armL = grp(R.float, 0.55, 2.2, 0.2);
    const al = new MeshBuilder(); al.cyl(0.13, 0.2, 0.8, RB2, { y: -0.4 }, 6); R.armL.add(al.mesh(B.mat));
    R.foreL = grp(R.armL, 0, -0.8, 0);
    const fl = new MeshBuilder(); fl.cyl(0.1, 0.2, 0.7, RB, { y: -0.3 }, 6); fl.sphere(0.1, BO, { y: -0.72 }, 5, 4); R.foreL.add(fl.mesh(B.mat));
    R.staff = grp(R.foreL, 0, -0.72, 0.05);
    const st = new MeshBuilder();
    st.cyl(0.04, 0.055, 2.9, WD, { y: 0.35 }, 5);
    st.cyl(0.0, 0.04, 0.3, WD, { y: 1.95, x: 0.12, rz: -0.6 }, 4);
    st.cone(0.06, 0.25, IR, { y: -1.2, rx: PI }, 5);
    R.lantern = grp(R.staff, 0, 1.55, 0.18);
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + 0.78; st.box(0.03, 0.42, 0.03, IR, { x: Math.sin(a) * 0.14, y: 1.55 - 0.12, z: 0.18 + Math.cos(a) * 0.14 }); }
    st.cone(0.2, 0.18, IR, { y: 1.75, z: 0.18 }, 4); st.cyl(0.18, 0.15, 0.05, IR, { y: 1.22, z: 0.18 }, 6);
    st.cyl(0.015, 0.015, 0.25, IR, { y: 1.86, z: 0.09, rx: 0.6 }, 3);
    R.staff.add(st.mesh(B.mat));
    const lg = new MeshBuilder(); lg.ico(0.12, 0, { y: -0.12 }, 1); R.lantern.add(lg.mesh(B.glowMat));
    // Rechter Arm: lange Knochenklaue
    R.armR = grp(R.float, -0.55, 2.2, 0.2);
    const ar = new MeshBuilder(); ar.cyl(0.13, 0.2, 0.8, RB2, { y: -0.4 }, 6); R.armR.add(ar.mesh(B.mat));
    R.foreR = grp(R.armR, 0, -0.8, 0);
    const fr = new MeshBuilder(); fr.cyl(0.07, 0.17, 0.5, RB, { y: -0.2 }, 6); fr.cyl(0.05, 0.06, 0.5, 0x3a2e2a, { y: -0.6 }, 5);
    fr.sphere(0.11, 0x3a2e2a, { y: -0.9, sz: 0.6 }, 5, 4);
    for (let k = 0; k < 4; k++) { const x = (k - 1.5) * 0.06; seg(fr, [x, -0.95, 0], [x * 1.8, -1.32, 0.12], 0.03, 0.01, k % 2 ? BO : 0xe8dcc0, 4); }
    R.foreR.add(fr.mesh(B.mat));
    R.claw = grp(R.foreR, 0, -1.1, 0.05);
    return R;
  },
  animate(b, dt) {
    const R = b.R, P = b.pc, sp = b.spd, sl = b.sleepK, dk = b.deadK, T = b.T;
    const stun = b.state === 'stun' ? 1 : 0;
    R.float.position.y = lerp(0.6 + Math.sin(T * 1.6) * 0.12, -0.05, Math.max(sl, dk * 0.8)) - P.slam * 0.25 + P.cast * 0.15 - stun * 0.25;
    R.float.rotation.x = clamp(sp * 0.07, 0, 0.35) + P.hunch * 0.3 + sl * 0.35 + P.slam * 0.25 + dk * 0.7 + stun * 0.2;
    R.float.rotation.z = Math.sin(T * 0.9) * 0.04 + stun * Math.sin(T * 3) * 0.12;
    R.strips.forEach((g, i) => { g.rotation.x = Math.sin(T * 3 + i * 1.7) * 0.18 + 0.1 + sp * 0.06 * Math.cos(g.rotation.y) - sl * 0.15; });
    R.head.rotation.x = 0.2 + sl * 0.5 - P.cast * 0.3 + P.hunch * 0.2 + dk * 0.4;
    R.head.rotation.y = clamp(b.lookErr, -0.7, 0.7) * 0.6 * (1 - sl);
    R.halo.rotation.y += dt * (1 + P.cast * 4); R.halo.position.y = 0.55 + Math.sin(T * 2) * 0.05;
    // Stab-Arm: staff=1 hoch erhoben, slam=1 Stab in den Boden
    R.armL.rotation.x = -0.45 - P.staff * 1.9 - P.slam * 0.9 + sl * 0.3 + dk * 0.5;
    R.armL.rotation.z = 0.4 + P.staff * 0.15;
    R.foreL.rotation.x = -0.6 + P.staff * 0.4 + P.slam * 0.5;
    R.staff.rotation.x = -(R.armL.rotation.x + R.foreL.rotation.x) - P.slam * 0.35 + dk * 1.2;
    R.staff.rotation.z = -R.armL.rotation.z;
    // Klauen-Arm: claw=1 ausgeholt, swipe=1 durchgezogen
    R.armR.rotation.x = -0.3 - P.claw * 1.5 - P.swipe * 1.2 + sl * 0.3 + Math.sin(T * 1.3) * 0.08;
    R.armR.rotation.y = P.claw * 0.9 - P.swipe * 1.4;
    R.armR.rotation.z = -0.2 - P.claw * 0.6 + P.swipe * 0.2;
    R.foreR.rotation.x = -0.4 - P.claw * 0.6 + P.swipe * 0.3 + Math.sin(T * 2.1) * 0.1;
    const v = P.vanish; b.mdl.scale.set(1 - v * 0.95, 1 + v * 0.5, 1 - v * 0.95);
    b.glowMat.emissiveIntensity = (0.2 + 0.8 * (1 - sl)) * (1 + P.cast * 1.6) * (1 - dk) * (0.85 + Math.sin(T * 13) * 0.15);
    R.orbG.visible = P.orbs > 0.02; R.orbG.rotation.y += dt * 3.5;
    for (let i = 0; i < 4; i++) R.orbs[i].scale.setScalar(Math.max(0.01, P.orbs));
  },
  emit(b, dt) {
    if (b.state === 'dead') return;
    const rate = (b.sleepK > 0.5 ? 3 : 18) * (b.phase === 2 ? 1.6 : 1);
    if (Math.random() < dt * rate) {
      b.worldOf(b.R.lantern, 0, -0.1, 0, _v);
      b.embers.emit(_v.x, _v.y, _v.z, (Math.random() - 0.5) * 0.5, 0.6 + Math.random(), (Math.random() - 0.5) * 0.5, 1.4);
    }
    if (b.sleepK < 0.5 && Math.random() < dt * 10) {
      const a = Math.random() * TAU; b.worldOf(b.R.float, Math.sin(a) * 0.8, 0.1, Math.cos(a) * 0.8, _v);
      b.embers.emit(_v.x, _v.y, _v.z, Math.sin(a) * 0.3, 0.2, Math.cos(a) * 0.3, 1.0);
    }
  },
  onAbort(b) { b.R.orbG.visible = false; b.pc.orbs = 0; b.pc.vanish = 0; },
  *wake(b) {
    yield 0.8;
    b.pose({ cast: 1, staff: 0.6 }, 4); b.fxAt('fire', b.R.lantern, 16); yield 1.0;
    b.pose({ cast: 0, staff: 0 }, 4); yield 0.4;
  },
  attacks: [
    { id: 'fan', min: 3, max: 24, cd: 2.8, w: 3, ang: 0.6, *run(b, t) {
      b.track = 3; b.pose({ staff: 1, cast: 1 }, 7);
      yield 0.65;
      const volleys = b.phase === 2 ? 2 : 1, n = b.phase === 2 ? 5 : 3;
      for (let v = 0; v < volleys; v++) {
        const L = b.worldOf(b.R.lantern, 0, -0.1, 0);
        const dir = new V3(t.pos.x - L.x, t.pos.y + 1 - L.y, t.pos.z - L.z).normalize();
        for (let i = 0; i < n; i++) {
          const vel = dir.clone().applyAxisAngle(UP, (i - (n - 1) / 2) * 0.2).multiplyScalar(12);
          b.combat.projectile({ owner: b.actor, team: 'enemy', pos: L.clone(), vel, radius: 0.32, damage: 10, life: 2.6, fx: 'fire', knockback: 4, stagger: 0.25 });
        }
        b.combat.fx('fire', L, 12); b.pose({ staff: 0.6 }, 20);
        yield 0.2; b.pose({ staff: 1 }, 10); yield 0.35;
      }
      b.pose({ staff: 0, cast: 0 }, 6); b.recT = 0.5;
    } },
    { id: 'ash', min: 2, max: 26, cd: 6, w: 2, ang: 1.2, *run(b, t) {
      b.track = 2; b.pose({ staff: 1, cast: 1, hunch: 0.3 }, 5);
      const pts = [];
      for (const p of b.alivePlayers([], 32)) pts.push(p.pos.clone());
      for (let i = 0; i < (b.phase === 2 ? 4 : 2); i++) { const a = Math.random() * TAU, r = 2.5 + Math.random() * 3.5; pts.push(new V3(t.pos.x + Math.sin(a) * r, t.pos.y, t.pos.z + Math.cos(a) * r)); }
      for (const p of pts) { p.y = b.world.heightAt(p.x, p.z); b.tele({ pos: p, radius: 2.4, duration: 1.3, shape: 'circle', color: 0xff5a10 }); }
      yield 0.7;
      b.pose({ staff: 0, slam: 1 }, 14); b.fxAt('fire', b.R.lantern, 10);
      yield 0.6;
      for (const p of pts) {
        const c = p.clone(); c.y += 0.6;
        b.hit({ radius: 2.4, duration: 0.25, damage: 14, knockback: 6, stagger: 0.4, at: () => c, kind: 'spell', onHitFx: 'fire' });
        b.combat.fx('fire', c, 18);
        for (let i = 0; i < 6; i++) b.embers.emit(c.x + (Math.random() - 0.5) * 3, c.y, c.z + (Math.random() - 0.5) * 3, 0, 3 + Math.random() * 2, 0, 0.9);
      }
      b.combat.shake(0.3);
      yield 0.5;
      b.pose({ slam: 0, cast: 0, hunch: 0 }, 4); b.recT = 0.7;
    } },
    { id: 'blink', min: 0, max: 6.5, cd: 5, w: 4, ang: 3.2, *run(b, t) {
      b.pose({ vanish: 1, hunch: 0.5 }, 9); b.fxAt('dark', b.R.float, 20, 0, 1.4, 0);
      yield 0.4;
      // hinter das Ziel (von Morra aus gesehen) teleportieren
      const dx = t.pos.x - b.pos.x, dz = t.pos.z - b.pos.z, L = Math.hypot(dx, dz) || 1;
      let nx = t.pos.x + dx / L * 2.8, nz = t.pos.z + dz / L * 2.8;
      if (!b.validGround(nx, nz)) { nx = t.pos.x - dz / L * 2.8; nz = t.pos.z + dx / L * 2.8; }
      if (b.validGround(nx, nz)) { b.pos.x = nx; b.pos.z = nz; b.pos.y = b.world.heightAt(nx, nz); }
      b.yaw = b.angTo(t.pos);
      b.combat.fx('dark', b.fxPos(b.pos.x, b.pos.y + 1.4, b.pos.z), 20);
      b.pose({ vanish: 0, claw: 1, hunch: 0 }, 12); b.track = 2.5;
      b.tele({ pos: b.pos.clone(), radius: 3.4, duration: 0.6, shape: 'cone', dir: b.fwd(new V3()), angle: 1.8 });
      yield 0.6;
      b.track = 0; b.pose({ claw: 0, swipe: 1 }, 26); b.drive = 3;
      b.hit({ radius: 1.3, duration: 0.2, damage: 15, knockback: 7, stagger: 0.4, at: b.boneAt(b.R.claw), kind: 'melee', onHitFx: 'dark' });
      b.hit({ radius: 1.6, duration: 0.15, damage: 15, knockback: 7, stagger: 0.4, at: b.boneAt(b.R.float, 0, 1.4, 1.5), kind: 'melee', onHitFx: 'dark' });
      yield 0.2; b.drive = 0;
      yield 0.35;
      b.pose({ swipe: 0 }, 5); b.recT = 1.0;                // Bestrafungsfenster
    } },
    { id: 'souls', p2: true, min: 0, max: 26, cd: 9, w: 3, ang: 3.2, run: souls },
  ],
  enrage: b => souls(b),
};
function* souls(b, t0) {
  b.pose({ staff: 1, claw: 1, cast: 1, orbs: 1 }, 3); b.track = 1.5;
  b.fxAt('dark', b.R.float, 24, 0, 2.6, 0);
  yield 1.1;
  const t = t0 || b.tgt;
  for (let i = 0; i < 4; i++) {
    const p = b.R.orbs[i].getWorldPosition(new V3());
    const vel = new V3(p.x - b.pos.x, 1.5, p.z - b.pos.z).normalize().multiplyScalar(5);
    b.combat.projectile({ owner: b.actor, team: 'enemy', pos: p, vel, radius: 0.38, damage: 12, life: 5, fx: 'dark', homing: t ? t.actor : null, knockback: 5, stagger: 0.35 });
  }
  b.pose({ orbs: 0, claw: 0, staff: 0 }, 30);
  yield 0.5;
  b.pose({ cast: 0 }, 4); b.recT = 0.6;
}

// ================================================================ 3) KOHLHERZ – der Grollende Koloss (riesig, langsam, Slams, Felswurf)
const KOHL = {
  radius: 1.9, height: 5.2, walk: 2.1, run: 3.0, turn: 1.15, accel: 2, keep: [3.5, 6.5], circle: 0.25,
  wakeR: 22, leash: 60, gap: 1.2, stgMax: 6, stgDecay: 0.3, kbMul: 0.03, p2speed: 1.15, p2tempo: 1.1,
  tiltL: 1.4, tiltW: 1.2, tiltMul: 0.6, wakeRate: 0.9, deathDur: 2.0, deathFx: 'fire',
  glow: 0xff5a14, emberColor: 0xff6a20, emberSize: 0.18, emberRise: 1.0, emberN: 72,
  poseKeys: ['raise', 'slam', 'stomp', 'grab', 'lift', 'roar'],
  build(B) {
    const ST = 0x4a423c, ST2 = 0x5a544c, CH = 0x2e2622, CH2 = 0x3e3632, MO = 0x4f6b2c, MO2 = 0x5e7a34, BR = 0x2a201a;
    const R = { legs: [], arms: [], vents: [] };
    R.py = 1.95;
    R.body = grp(B.mdl, 0, R.py, 0);
    const off = grp(R.body, 0, -R.py, 0);
    const b = new MeshBuilder(), gl = new MeshBuilder();
    b.ico(1, ST, { y: 2.05, sx: 1.0, sy: 0.75, sz: 0.8, jitter: 0.12 }, 1);
    b.sphere(1, CH, { y: 2.75, z: 0.3, sx: 1.2, sy: 0.9, sz: 0.9 }, 9, 6);
    b.ico(1, CH2, { y: 3.55, z: 0.55, sx: 1.55, sy: 1.05, sz: 1.05, jitter: 0.12 }, 1);
    for (const s of [1, -1]) b.ico(0.78, ST2, { x: s * 1.45, y: 3.95, z: 0.5, ry: s, jitter: 0.15 }, 0);
    [[0.6, 4.15, -0.3, 0.6], [-0.6, 4.1, -0.25, 0.58], [0, 4.35, 0.1, 0.62], [0, 3.6, -0.6, 0.7], [0.9, 3.0, -0.5, 0.5], [-0.9, 3.0, -0.45, 0.5]]
      .forEach(([x, y, z, r], i) => b.ico(r, i % 2 ? ST2 : ST, { x, y, z, rx: i, ry: i * 2, jitter: 0.15 }, 0));
    b.sphere(1, MO, { x: 1.4, y: 4.6, z: 0.5, sx: 0.6, sy: 0.2, sz: 0.6 }, 7, 4);
    b.sphere(1, MO2, { y: 4.72, z: 0.05, sx: 0.75, sy: 0.18, sz: 0.65 }, 7, 4);
    b.sphere(1, MO, { x: -1.3, y: 4.55, z: 0.6, sx: 0.5, sy: 0.18, sz: 0.5 }, 7, 4);
    for (const [x, z, s] of [[1.25, 0.75, 1], [1.55, 0.35, 0.7], [-0.25, -0.2, 0.8]]) {
      b.cyl(0.05 * s, 0.06 * s, 0.25 * s, 0xe8dcc0, { x, y: 4.72 + 0.1 * s, z }, 5);
      b.sphere(0.17 * s, 0xb5452c, { x, y: 4.85 + 0.16 * s, z, sy: 0.5 }, 7, 4);
    }
    // Brust-Käfig um das Glutherz
    for (const s of [1, -1]) { b.box(0.16, 1.0, 0.18, CH2, { x: s * 0.33, y: 3.45, z: 1.55, rz: s * 0.25 }); b.box(0.14, 0.8, 0.16, CH2, { x: s * 0.62, y: 3.4, z: 1.45, rz: s * 0.45 }); }
    b.box(0.9, 0.16, 0.18, CH2, { y: 3.98, z: 1.5 });
    // Glutrisse
    [[0.75, 3.2, 1.5, 0.5], [-0.8, 3.1, 1.45, -0.6], [0.3, 2.6, 1.15, 0.2], [-0.35, 2.45, 1.12, -0.3], [1.2, 3.6, 1.0, 0.9]]
      .forEach(([x, y, z, r]) => gl.box(0.07, 0.75, 0.06, 0, { x, y, z, rz: r }));
    off.add(b.mesh(B.mat)); off.add(gl.mesh(B.glowMat));
    R.heart = grp(off, 0, 3.45, 1.45);
    const hb = new MeshBuilder(); hb.ico(0.36, 0, {}, 1); R.heart.add(hb.mesh(B.glowMat));
    // Rücken-Schlote
    for (const [x, y, z] of [[0.55, 4.3, -0.75], [-0.55, 4.2, -0.8], [0, 3.6, -1.15]]) {
      const v = grp(off, x, y, z); v.rotation.x = -0.6;
      const vb = new MeshBuilder(); vb.cyl(0.14, 0.26, 0.6, BR, { y: 0.3 }, 6); v.add(vb.mesh(B.mat));
      const vg = new MeshBuilder(); vg.cyl(0.11, 0.11, 0.06, 0, { y: 0.6 }, 6); v.add(vg.mesh(B.glowMat));
      R.vents.push(v);
    }
    // Kopf
    R.head = grp(off, 0, 3.95, 1.35);
    const h = new MeshBuilder(), hg = new MeshBuilder();
    h.ico(1, ST, { sx: 0.62, sy: 0.5, sz: 0.6, jitter: 0.12 }, 1);
    h.box(1.05, 0.22, 0.4, CH, { y: 0.2, z: 0.36, rx: 0.2 });
    for (const s of [1, -1]) {
      seg(h, [s * 0.35, 0.3, -0.05], [s * 0.75, 0.95, -0.2], 0.09, 0.07, BR);
      seg(h, [s * 0.75, 0.95, -0.2], [s * 0.95, 1.5, -0.45], 0.07, 0.04, BR);
      seg(h, [s * 0.68, 0.85, -0.18], [s * 1.15, 1.05, 0.05], 0.05, 0.03, BR);
      seg(h, [s * 0.85, 1.25, -0.35], [s * 0.55, 1.55, -0.3], 0.04, 0.025, BR);
      hg.sphere(0.05, 0, { x: s * 0.95, y: 1.52, z: -0.45 }, 4, 3); hg.sphere(0.04, 0, { x: s * 1.15, y: 1.05, z: 0.05 }, 4, 3);
      hg.sphere(0.075, 0, { x: s * 0.24, y: 0.07, z: 0.55, sx: 1.4, sy: 0.7 }, 5, 3);
      h.cone(0.05, 0.16, 0xd8c8a8, { x: s * 0.18, y: -0.2, z: 0.55, rx: PI }, 4);
    }
    hg.sphere(0.2, 0, { y: -0.18, z: 0.38, sx: 1.3 }, 6, 4);
    R.head.add(h.mesh(B.mat)); R.head.add(hg.mesh(B.glowMat));
    R.jaw = grp(R.head, 0, -0.22, 0.2);
    const jb = new MeshBuilder(); jb.box(0.8, 0.24, 0.55, ST2, { y: -0.08, z: 0.2 });
    for (const s of [-1, -0.35, 0.35, 1]) jb.cone(0.04, 0.14, 0xd8c8a8, { x: s * 0.28, y: 0.08, z: 0.42 }, 4);
    R.jaw.add(jb.mesh(B.mat));
    // Arme (knöchelgehend)
    for (const s of [1, -1]) {
      const sh = grp(off, s * 1.6, 3.85, 0.55);
      const ua = new MeshBuilder(); ua.cyl(0.5, 0.42, 1.5, CH2, { y: -0.7 }, 7); ua.ico(0.42, ST, { y: -1.45, jitter: 0.12 }, 0);
      ua.ico(0.5, ST2, { y: -0.2, x: s * 0.2, jitter: 0.12 }, 0);
      sh.add(ua.mesh(B.mat));
      const ug = new MeshBuilder(); ug.box(0.06, 0.7, 0.06, 0, { y: -0.75, x: s * 0.45, z: 0.1, rz: 0.3 }); sh.add(ug.mesh(B.glowMat));
      const fa = grp(sh, 0, -1.5, 0);
      const fb = new MeshBuilder(); fb.cyl(0.46, 0.55, 1.35, CH, { y: -0.65 }, 7);
      fb.ico(0.72, ST2, { y: -1.55, sy: 0.9, jitter: 0.12 }, 1);
      for (let k = 0; k < 3; k++) fb.ico(0.22, ST, { x: (k - 1) * 0.35, y: -1.85, z: 0.45, jitter: 0.12 }, 0);
      fb.sphere(1, MO, { y: -0.4, z: -0.4, sx: 0.4, sy: 0.15, sz: 0.3, rx: -1.2 }, 6, 3);
      fa.add(fb.mesh(B.mat));
      const fg = new MeshBuilder(); fg.box(0.06, 0.6, 0.06, 0, { y: -0.6, x: -s * 0.45, z: 0.2, rz: -0.4 }); fa.add(fg.mesh(B.glowMat));
      const fist = grp(fa, 0, -1.6, 0);
      sh.rotation.z = s * 0.15;
      R.arms.push({ sh, fa, fist, side: s });
    }
    R.boulder = new MeshBuilder().ico(0.85, 0x6a625a, { jitter: 0.2 }, 0).mesh(B.mat);
    R.boulder.position.set(0, -0.6, 0.6); R.boulder.visible = false; R.arms[1].fist.add(R.boulder);
    // Beine
    for (const s of [1, -1]) R.legs.push(addLeg(B, off, { x: s * 0.85, y: 1.95, z: -0.1, l1: 1.0, l2: 0.95, r: 0.42, c1: CH2, c2: ST, fc: ST2, foot: 'block' }));
    return R;
  },
  animate(b, dt) {
    const R = b.R, P = b.pc, sp = b.spd, sl = b.sleepK, dk = b.deadK, T = b.T;
    const mov = clamp(sp / 1.8, 0, 1), stun = b.state === 'stun' ? 1 : 0;
    b.gph += dt * (1.2 + sp * 1.4);
    const ph = b.gph, amp = mov * (1 - sl) * (1 - dk);
    const breath = Math.sin(T * 1.4) * 0.03;
    R.body.position.y = R.py + Math.abs(Math.sin(ph)) * 0.08 * amp - sl * 1.15 - dk * 0.9 + breath - P.slam * 0.35 - stun * 0.25 + P.stomp * 0.15;
    R.body.rotation.x = 0.22 + P.slam * 0.45 - P.raise * 0.28 + P.grab * 0.4 - P.lift * 0.2 + sl * 0.3 + stun * 0.25 - P.roar * 0.15 - b.flinch * 0.15;
    R.body.rotation.z = Math.sin(ph) * 0.07 * amp - P.stomp * 0.14 + stun * Math.sin(T * 2) * 0.06;
    R.body.rotation.y = Math.sin(ph) * 0.05 * amp - P.lift * 0.3;
    for (const A of R.arms) {
      const s = A.side, sw = Math.sin(ph + (s > 0 ? 0 : PI)) * 0.35 * amp;
      let x = -0.3 + sw - P.raise * 2.55 - P.slam * 0.75 + sl * 0.5 + stun * 0.2 - P.roar * 0.4;
      let z = s * (0.15 + P.raise * 0.1 + P.roar * 0.5 - sl * 0.12), fx = -0.25 - Math.max(0, sw) * 0.4 - P.raise * 0.3 - sl * 0.9;
      if (s < 0) { x += -P.grab * 0.9 - P.lift * 2.7; fx += -P.lift * 0.6 + P.grab * 0.3; }
      A.sh.rotation.x = lerp(x, -0.9, dk); A.sh.rotation.z = z; A.fa.rotation.x = fx;
    }
    for (const L of R.legs) {
      const s = Math.sin(ph + (L.side > 0 ? 0 : PI)), c = Math.cos(ph + (L.side > 0 ? 0 : PI));
      const st = L.side > 0 ? P.stomp : 0;
      const sit = Math.max(sl, dk);
      L.hip.rotation.x = lerp(-s * 0.4 * amp - st * 1.0, -1.45, sit);
      L.knee.rotation.x = lerp(Math.max(0, c) * 0.6 * amp + st * 1.3, 1.9, sit);
      L.hip.rotation.z = L.side * (0.06 + sit * 0.35);
    }
    R.head.rotation.x = -0.15 + sl * 0.45 + P.slam * 0.2 - P.roar * 0.4 + stun * 0.35;
    R.head.rotation.y = clamp(b.lookErr, -0.5, 0.5) * 0.7 * (1 - sl) + stun * Math.sin(T * 3) * 0.2;
    R.jaw.rotation.x = 0.06 + P.roar * 0.7 + P.raise * 0.25 + dk * 0.4;
    R.heart.scale.setScalar(1 + Math.sin(T * (b.phase === 2 ? 7 : 4)) * 0.08 + P.raise * 0.25);
    R.boulder.visible = b.pc.lift > 0.05 && b.pt.lift > 0;
    b.mdl.rotation.x = dk * 0.35;
    b.glowMat.emissiveIntensity = (0.12 + 0.88 * (1 - sl)) * (1 + P.raise * 0.6 + P.roar * 0.8) * (1 - dk * 0.8) * (0.88 + Math.sin(T * 7) * 0.12) * (b.phase === 2 ? 1.25 : 1);
  },
  emit(b, dt) {
    if (b.state === 'dead') return;
    const rate = (b.sleepK > 0.5 ? 2 : 9) * (b.phase === 2 ? 1.8 : 1);
    for (const v of b.R.vents) if (Math.random() < dt * rate) {
      b.worldOf(v, 0, 0.65, 0, _v);
      b.embers.emit(_v.x, _v.y, _v.z, (Math.random() - 0.5) * 0.8, 1.2 + Math.random() * 1.5, (Math.random() - 0.5) * 0.8 - 0.3, 1.6);
    }
  },
  chaseTick(b, dt, t, dist) { // Phase 2: Schlote spucken langsame Glutlinge (zielsuchend)
    if (b.phase < 2) return;
    b.ventT = (b.ventT ?? 4) - dt;
    if (b.ventT > 0) return;
    b.ventT = 6.5;
    for (let i = 0; i < 2; i++) {
      const p = b.worldOf(b.R.vents[i], 0, 0.7, 0);
      b.combat.projectile({ owner: b.actor, team: 'enemy', pos: p, vel: new V3((i - 0.5) * 4, 6, 0), radius: 0.35, damage: 9, life: 4.5, fx: 'fire',
        homing: t.actor, knockback: 3, stagger: 0.2 });
      b.combat.fx('fire', p, 8);
    }
  },
  onAbort(b) { b.R.boulder.visible = false; },
  *wake(b) {
    b.combat.shake(0.3); b.combat.fx('dust', b.fxPos(b.pos.x, b.pos.y + 0.5, b.pos.z), 24);
    yield 1.8;
    b.pose({ roar: 1, raise: 0.35 }, 4); b.combat.shake(0.5); b.fxAt('fire', b.R.head, 16, 0, -0.1, 0.5);
    yield 1.1;
    b.pose({ roar: 0, raise: 0 }, 4); yield 0.4;
  },
  attacks: [
    { id: 'smash', min: 0, max: 6.8, cd: 4, w: 3, ang: 0.7, *run(b, t) {
      b.track = 1.6; b.pose({ raise: 1 }, 4);
      yield 0.25;
      b.track = 0;
      const c = b.ahead(3.8); c.y = b.world.heightAt(c.x, c.z);
      b.tele({ pos: c.clone(), radius: 3.0, duration: 0.85, shape: 'circle' });
      yield 0.75;
      b.pose({ raise: 0, slam: 1 }, 22);
      yield 0.12;
      const hc = c.clone(); hc.y += 0.8;
      b.hit({ radius: 3.0, duration: 0.15, damage: 26, knockback: 10, stagger: 0.8, at: () => hc, kind: 'slam', onHitFx: 'spark' });
      b.combat.fx('dust', hc, 30); b.combat.fx('fire', hc, 10); b.combat.shake(0.8);
      yield 0.6;
      b.pose({ slam: 0.6 }, 2);
      b.recT = 1.6;                                           // Fäuste stecken fest → Herz frei
    } },
    { id: 'stomp', min: 0, max: 5, cd: 6, w: 2, ang: 3.2, *run(b, t) {
      b.pose({ stomp: 1, raise: 0.3 }, 3.5);
      b.tele({ pos: b.pos.clone(), radius: 5.5, duration: 0.9, shape: 'circle' });
      yield 0.9;
      b.pose({ stomp: 0, raise: 0, slam: 0.4 }, 25);
      yield 0.1;
      const c = b.pos.clone(); c.y += 0.6;
      b.hit({ radius: 5.5, duration: 0.15, damage: 18, knockback: 12, stagger: 0.6, at: () => c, kind: 'slam' });
      b.combat.fx('dust', c, 36); b.combat.shake(0.7);
      for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; b.embers.emit(c.x + Math.sin(a) * 2, c.y - 0.4, c.z + Math.cos(a) * 2, Math.sin(a) * 7, 1, Math.cos(a) * 7, 0.6); }
      yield 0.5;
      b.pose({ slam: 0 }, 3); b.recT = 1.0;
    } },
    { id: 'boulder', min: 8, max: 30, cd: 5, w: 3, ang: 0.5, *run(b, t) {
      b.track = 1.2; b.pose({ grab: 1 }, 5);
      yield 0.5;
      b.combat.fx('dust', b.ahead(1.5).setY(b.pos.y + 0.3), 16);
      b.pose({ grab: 0, lift: 1 }, 4);
      const land = t.pos.clone(), T = 1.15, g = 16;
      land.y = b.world.heightAt(land.x, land.z);
      b.tele({ pos: land.clone(), radius: 2.6, duration: 0.55 + T, shape: 'circle' });
      yield 0.55;
      b.track = 0;
      const H = b.R.boulder.getWorldPosition(new V3());
      const vel = new V3((land.x - H.x) / T, (land.y + 0.4 - H.y + 0.5 * g * T * T) / T, (land.z - H.z) / T);
      b.pose({ lift: 0 }, 18); b.pt.lift = 0; b.R.boulder.visible = false;
      b.combat.projectile({ owner: b.actor, team: 'enemy', pos: H, vel, radius: 0.85, damage: 20, life: T + 0.4, gravity: g, fx: 'fire',
        explodeRadius: 2.6, knockback: 9, stagger: 0.6, onExpire: p => { b.combat.fx('dust', p, 24); b.combat.shake(0.4); } });
      yield 0.5;
      b.recT = 0.8;
    } },
    { id: 'rift', p2: true, min: 3, max: 18, cd: 8, w: 3, ang: 0.5, run: rift },
  ],
  enrage: b => rift(b),
};
function* rift(b) {
  b.pose({ roar: 1, raise: 1 }, 4); b.track = 1.4;
  b.combat.shake(0.3);
  yield 0.4;
  b.track = 0;
  const dir = b.fwd(new V3()), start = b.ahead(2.5);
  b.tele({ pos: start.clone(), radius: 1.5, duration: 0.6 + 0.12 * 12, shape: 'line', dir, length: 18, color: 0xff4010 });
  yield 0.5;
  b.pose({ raise: 0, slam: 1, roar: 0.5 }, 22);
  yield 0.12;
  b.combat.shake(0.9);
  for (let i = 0; i < 12; i++) {
    const p = start.clone().addScaledVector(dir, i * 1.5); p.y = b.world.heightAt(p.x, p.z) + 0.6;
    b.hit({ radius: 1.7, duration: 0.18, damage: 16, knockback: 8, stagger: 0.5, at: () => p, kind: 'spell', onHitFx: 'fire' });
    b.combat.fx('fire', p, 10);
    for (let k = 0; k < 3; k++) b.embers.emit(p.x + (Math.random() - 0.5), p.y, p.z + (Math.random() - 0.5), 0, 4 + Math.random() * 3, 0, 0.8);
    yield 0.12;
  }
  b.pose({ slam: 0.5, roar: 0 }, 3);
  yield 0.3;
  b.recT = 1.3;
}

const DEFS = { dogo: DOGO, morra: MORRA, kohlherz: KOHL };

export function createBoss(type, { scene, world, combat, home, yaw } = {}) {
  const def = DEFS[type];
  if (!def) throw new Error('Unbekannter Boss: ' + type);
  return new Boss(type, def, { scene, world, combat, home, yaw });
}
