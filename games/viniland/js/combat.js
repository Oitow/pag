// Viniland – Kampf-Kern: Actors (Kapsel-Hurtboxen), Kugel-Hitboxen, Projektile, Boden-Telegraphs,
// Hitstop, Partikel-FX-Pool (PSX-Würfelchen/Sterne), schwebende Schadenszahlen, Debug-Ansicht.
// Vertrag: CONTRACT.md → „Kampf (Erweiterung 2)“.
//
// Schaden: Combat zieht hit.damage von actor.hp ab (min. 0) und ruft DANACH actor.onHit(hit) auf
// (onHit sieht also schon die neue hp und zieht selbst nichts ab). alive setzt Combat nie – das macht der Besitzer.
import * as THREE from 'three';
import { patchPSX } from './psx.js';
import { clamp } from './kit.js';

const MAX_P = 640, MAX_STAR = 256, MAX_NUM = 28, MAX_PROJ = 32, MAX_DBG = 24;
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(),
  _e = new THREE.Euler(), _s = new THREE.Vector3(), _c = new THREE.Color(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

const FX_COLORS = {
  spark: [0xfff2a8, 0xffc23a, 0xffffff],
  fire: [0xff7a1a, 0xffc23a, 0xe0301a, 0xfff0a0],
  frost: [0x9fe8ff, 0xffffff, 0x5ab4ff, 0xd8f6ff],
  dark: [0x8a3ad8, 0x3a1a5a, 0xd08aff, 0x1a0a2a],
  dust: [0xc8a878, 0x9a7a52, 0xe0cca0],
  blood: [0xffffff, 0xfff6c0, 0xffe0f0],
  heal: [0x8aff9a, 0xffffff, 0xd0ffb0],
  wood: [0xc89a5a, 0x8a5a32, 0xe8c890],
};
// [Geschwindigkeit, Schwerkraft, Lebensdauer, Größe, Luftwiderstand]
const FX_PHYS = {
  spark: [6, 14, 0.4, 0.07, 2], fire: [2.6, -3.5, 0.7, 0.13, 2.5], frost: [4, 6, 0.75, 0.1, 2.2],
  dark: [2.4, -2, 0.85, 0.12, 2], dust: [2.2, 3, 0.8, 0.14, 3.5], blood: [4.5, 9, 0.6, 0.11, 1.8],
  heal: [1.5, -2.5, 0.9, 0.09, 1.5], wood: [4, 14, 0.8, 0.09, 1.5],
};

// ---------- Telegraph-Shader (auf das Gelände drapiert) ----------
const TELE_VERT = `
attribute float aD; varying float vD;
uniform float uSnap;
void main(){ vD = aD; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0);
  if (uSnap > 0.0) { p.xyz /= p.w; p.xy = floor(p.xy * uSnap + 0.5) / uSnap; p.xyz *= p.w; }
  gl_Position = p; }`;
const TELE_FRAG = `
varying float vD; uniform float uFill; uniform float uTime; uniform vec3 uColor; uniform float uAlpha; uniform float uMode;
void main(){
  float a;
  if (uMode > 0.5) { // Schockwelle: heller Ring an der Front
    float d = abs(vD - uFill); a = smoothstep(0.16, 0.0, d) * 0.85;
  } else {
    float blink = 0.5 + 0.5 * sin(uTime * (10.0 + 16.0 * uFill));
    float rim = smoothstep(0.86, 0.97, vD);
    float inside = step(vD, uFill);
    float front = smoothstep(0.07, 0.0, abs(vD - uFill));
    a = 0.12 + 0.1 * blink + inside * 0.32 + rim * (0.45 + 0.3 * blink) + front * 0.4;
  }
  gl_FragColor = vec4(uColor * (1.0 + 0.25 * step(0.5, uMode)), a * uAlpha);
}`;

function capsuleDist(a, p) {
  const y0 = a.pos.y + a.radius, y1 = a.pos.y + Math.max(a.radius, a.height - a.radius);
  const cy = clamp(p.y, y0, y1);
  const dx = p.x - a.pos.x, dy = p.y - cy, dz = p.z - a.pos.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export class Combat {
  constructor(scene, world) {
    this.scene = scene; this.world = world;
    this.actors = [];
    this.hitboxes = [];
    this.projectiles = [];
    this.telegraphs = [];
    this.stopT = 0;
    this.time = 0;
    this.shakes = [];           // { amount, x, z } – Main verteilt auf die Kameras
    this._debug = false;
    this.root = new THREE.Group(); this.root.name = 'combat'; scene.add(this.root);
    this._initParticles();
    this._initNumbers();
    this._initProjectiles();
    this._initDebug();
  }

  // ---------------- Actors ----------------
  addActor(a) {
    if (!a.pos) a.pos = new THREE.Vector3();
    if (a.alive === undefined) a.alive = true;
    if (a.maxHp === undefined) a.maxHp = a.hp ?? 1;
    a.radius = a.radius ?? 0.4; a.height = a.height ?? 1.7;
    if (!this.actors.includes(a)) this.actors.push(a);
    if (this._debug) this._dbgActor(a);
    return a;
  }
  removeActor(a) {
    const i = this.actors.indexOf(a); if (i >= 0) this.actors.splice(i, 1);
    if (a._dbg) { this.root.remove(a._dbg); a._dbg.geometry.dispose(); a._dbg = null; }
    for (const h of this.hitboxes) if (h.owner === a) h.t = h.duration;
  }
  _canHit(a, team) { return a.team !== team && a.alive !== false && a.hp > 0; }

  nearestEnemy(fromPos, team, maxDist = 30) {
    let best = null, bd = maxDist;
    for (const a of this.actors) {
      if (!this._canHit(a, team)) continue;
      const d = Math.hypot(a.pos.x - fromPos.x, a.pos.z - fromPos.z) - a.radius;
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  /** Wendet einen Treffer an (auch von außen nutzbar). src = Weltpunkt des Treffers. */
  applyHit(a, o, src) {
    const invuln = a.invuln && a.invuln();
    if (invuln) { this.fx('dust', _v.set(a.pos.x, a.pos.y + 0.3, a.pos.z), 4); return false; }
    const ox = o.owner?.pos ? o.owner.pos.x : src.x, oz = o.owner?.pos ? o.owner.pos.z : src.z;
    let dx = a.pos.x - ox, dz = a.pos.z - oz, d = Math.hypot(dx, dz);
    if (d < 1e-3) { dx = a.pos.x - src.x; dz = a.pos.z - src.z; d = Math.hypot(dx, dz); }
    if (d < 1e-3) { dx = 0; dz = 1; d = 1; }
    const hit = { damage: o.damage ?? 10, dir: new THREE.Vector3(dx / d, 0, dz / d), knockback: o.knockback ?? 4,
      stagger: o.stagger ?? 0, kind: o.kind || 'melee', source: o.owner || null, point: src.clone() };
    a.hp = Math.max(0, a.hp - hit.damage);
    if (a.onHit) a.onHit(hit);
    // Feedback
    const top = _v2.set(a.pos.x, a.pos.y + a.height * 0.85, a.pos.z);
    const toPlayer = a.team === 'player';
    const big = hit.stagger >= 0.55 || hit.damage >= 20;
    this.damageNumber(top, Math.round(hit.damage), toPlayer ? 0xff6050 : big ? 0xffb030 : 0xfff4d0);
    const fxk = o.onHitFx || o.fx || 'spark';
    _v.copy(src); this.fx(fxk, _v, big ? 16 : 9); this.fx('blood', _v, big ? 7 : 4);
    if (o.kind === 'melee' || o.kind === 'slam') this.hitstop(toPlayer ? 0.07 : big ? 0.1 : 0.055);
    this.shake(toPlayer ? 0.6 : big ? 0.55 : 0.2, a.pos);
    if (o.onConnect) o.onConnect(a, hit);
    return true;
  }

  // ---------------- Hitboxen ----------------
  hitbox(o) {
    const h = { owner: o.owner || null, team: o.team || o.owner?.team || 'enemy', radius: o.radius ?? 0.6, duration: o.duration ?? 0.1,
      damage: o.damage ?? 10, knockback: o.knockback ?? 4, stagger: o.stagger ?? 0, at: o.at || (() => o.pos), kind: o.kind || 'melee',
      onHitFx: o.onHitFx, onConnect: o.onConnect, t: 0, hitSet: new Set() };
    this.hitboxes.push(h);
    return h;
  }

  // ---------------- Projektile ----------------
  projectile(o) {
    let slot = this._proj.find(s => !s.active);
    if (!slot) return null;
    slot.active = true;
    slot.o = { owner: o.owner || null, team: o.team || o.owner?.team || 'enemy', damage: o.damage ?? 12, kind: 'spell',
      knockback: o.knockback ?? 3, stagger: o.stagger ?? 0.2, onHitFx: o.fx || 'fire', onConnect: o.onConnect };
    slot.pos.copy(o.pos); slot.vel.copy(o.vel);
    slot.radius = o.radius ?? 0.3; slot.life = o.life ?? 3; slot.gravity = o.gravity ?? 0;
    slot.fx = o.fx || 'fire'; slot.homing = o.homing || null; slot.homingRate = o.homingRate ?? 3.5;
    slot.onExpire = o.onExpire || null; slot.explodeRadius = o.explodeRadius || 0; slot.trailT = 0;
    const m = slot.mesh; m.visible = true; m.scale.setScalar(slot.radius * 1.35);
    m.material.color.setHex(FX_COLORS[slot.fx]?.[0] ?? 0xffffff);
    slot.core.material.color.setHex(FX_COLORS[slot.fx]?.[1] ?? 0xffffff);
    m.position.copy(slot.pos);
    this.projectiles.push(slot);
    return slot;
  }
  _initProjectiles() {
    this._proj = [];
    const geo = new THREE.IcosahedronGeometry(1, 0), core = new THREE.OctahedronGeometry(0.62, 0);
    for (let i = 0; i < MAX_PROJ; i++) {
      const m = new THREE.Mesh(geo, patchPSX(new THREE.MeshBasicMaterial({ color: 0xffffff })));
      const c = new THREE.Mesh(core, patchPSX(new THREE.MeshBasicMaterial({ color: 0xffffff })));
      m.add(c); m.visible = false; m.frustumCulled = false; this.root.add(m);
      this._proj.push({ active: false, mesh: m, core: c, pos: new THREE.Vector3(), vel: new THREE.Vector3() });
    }
  }
  _endProjectile(s, hitActor) {
    s.active = false; s.mesh.visible = false;
    const i = this.projectiles.indexOf(s); if (i >= 0) this.projectiles.splice(i, 1);
    this.fx(s.fx, s.pos, s.explodeRadius ? 26 : 12);
    if (s.explodeRadius > 0) {
      this.shockwave(s.pos, s.explodeRadius, FX_COLORS[s.fx]?.[0] ?? 0xffffff, 0.3);
      this.fx('dust', s.pos, 6);
      for (const a of this.actors) {
        if (!this._canHit(a, s.o.team)) continue;
        if (capsuleDist(a, s.pos) <= s.explodeRadius + a.radius) this.applyHit(a, a === hitActor ? s.o : { ...s.o, damage: Math.round(s.o.damage * 0.7) }, s.pos);
      }
      this.shake(0.35, s.pos);
    } else if (hitActor) this.applyHit(hitActor, s.o, s.pos);
    if (s.onExpire) s.onExpire(s.pos.clone());
  }

  // ---------------- Telegraphs ----------------
  telegraph(o) {
    const shape = o.shape || 'circle', radius = o.radius ?? 3, w = this.world;
    const pos = o.pos.clone ? o.pos.clone() : new THREE.Vector3(o.pos.x, o.pos.y || 0, o.pos.z);
    let dx = 0, dz = 1;
    if (o.dir) { const l = Math.hypot(o.dir.x, o.dir.z) || 1; dx = o.dir.x / l; dz = o.dir.z / l; }
    const verts = [], ds = [], idx = [];
    const push = (x, z, d) => { verts.push(x, (w.heightAt ? w.heightAt(x, z) : pos.y) + 0.12, z); ds.push(d); };
    if (shape === 'line') {
      const len = o.length ?? 8, hw = radius, NL = 12;
      const px = dz, pz = -dx;
      for (let i = 0; i <= NL; i++) for (let j = 0; j <= 2; j++) {
        const u = i / NL, s = (j - 1) * hw;
        push(pos.x + dx * len * u + px * s, pos.z + dz * len * u + pz * s, u);
      }
      for (let i = 0; i < NL; i++) for (let j = 0; j < 2; j++) {
        const a = i * 3 + j, b = a + 3;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    } else {
      const ang = shape === 'cone' ? (o.angle ?? 1.0) : Math.PI * 2, SEG = shape === 'cone' ? 14 : 28, RING = 6;
      const base = Math.atan2(dx, dz);
      push(pos.x, pos.z, 0);
      for (let r = 1; r <= RING; r++) for (let s = 0; s <= SEG; s++) {
        const a = base - ang / 2 + ang * s / SEG, k = r / RING;
        push(pos.x + Math.sin(a) * radius * k, pos.z + Math.cos(a) * radius * k, k);
      }
      const row = SEG + 1;
      for (let s = 0; s < SEG; s++) idx.push(0, 1 + s, 2 + s);
      for (let r = 1; r < RING; r++) for (let s = 0; s < SEG; s++) {
        const a = 1 + (r - 1) * row + s, b = a + row;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('aD', new THREE.Float32BufferAttribute(ds, 1));
    g.setIndex(idx);
    const col = new THREE.Color(o.color ?? 0xff3020);
    const mat = new THREE.ShaderMaterial({
      vertexShader: TELE_VERT, fragmentShader: TELE_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      uniforms: { uFill: { value: 0 }, uTime: { value: 0 }, uColor: { value: col }, uAlpha: { value: 1 }, uMode: { value: o.mode === 'wave' ? 1 : 0 },
        uSnap: { value: 0 } },
    });
    const mesh = new THREE.Mesh(g, mat); mesh.renderOrder = 3; mesh.frustumCulled = false;
    this.root.add(mesh);
    const t = { mesh, mat, t: 0, duration: Math.max(0.05, o.duration ?? 1), wave: o.mode === 'wave' };
    this.telegraphs.push(t);
    return t;
  }
  /** Schneller sich ausbreitender Ring (Explosionen, Frostring, Boss-Stampfer). */
  shockwave(pos, radius, color = 0xffffff, duration = 0.35) {
    return this.telegraph({ pos, radius, duration, color, shape: 'circle', mode: 'wave' });
  }

  hitstop(sec) { this.stopT = Math.max(this.stopT, Math.min(0.2, sec)); }
  shake(amount, pos) { if (this.shakes.length < 16) this.shakes.push({ amount, x: pos ? pos.x : NaN, z: pos ? pos.z : NaN }); }

  // ---------------- Partikel ----------------
  _initParticles() {
    const mk = (geo, n) => {
      const mat = patchPSX(new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const m = new THREE.InstancedMesh(geo, mat, n);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < n; i++) { m.setMatrixAt(i, ZERO); m.setColorAt(i, _c.set(0xffffff)); }
      m.frustumCulled = false; m.renderOrder = 2;
      this.root.add(m);
      return { mesh: m, n, pos: new Float32Array(n * 3), vel: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n),
        size: new Float32Array(n), grav: new Float32Array(n), drag: new Float32Array(n), spin: new Float32Array(n), next: 0, live: 0 };
    };
    this._cubes = mk(new THREE.BoxGeometry(1, 1, 1), MAX_P);
    // 4-zackiger Stern (zwei gekreuzte, flache Rauten)
    const star = new THREE.OctahedronGeometry(1, 0); star.scale(1, 1, 0.25);
    this._stars = mk(star, MAX_STAR);
  }
  /** Partikel-Burst. opts: { speed, up, ring (horizontal radial), size } */
  fx(kind, pos, n = 10, opts = {}) {
    const P = FX_PHYS[kind] || FX_PHYS.spark, cols = FX_COLORS[kind] || FX_COLORS.spark;
    const pool = kind === 'blood' || kind === 'heal' || opts.stars ? this._stars : this._cubes;
    const spd = (opts.speed ?? 1) * P[0];
    for (let k = 0; k < n; k++) {
      const i = pool.next; pool.next = (pool.next + 1) % pool.n;
      let vx, vy, vz;
      if (opts.ring) {
        const a = Math.random() * Math.PI * 2, s = spd * (0.8 + Math.random() * 0.5);
        vx = Math.cos(a) * s; vz = Math.sin(a) * s; vy = (Math.random() * 0.6 + 0.2) * (opts.up ?? 1.5);
      } else {
        vx = Math.random() * 2 - 1; vy = Math.random() * 2 - 1; vz = Math.random() * 2 - 1;
        const l = Math.hypot(vx, vy, vz) || 1, s = spd * (0.35 + Math.random() * 0.75) / l;
        vx *= s; vy = vy * s + (opts.up ?? 1.2) * (0.5 + Math.random()); vz *= s;
      }
      pool.pos[i * 3] = pos.x + (Math.random() - 0.5) * 0.2; pool.pos[i * 3 + 1] = pos.y + (Math.random() - 0.5) * 0.2; pool.pos[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.2;
      pool.vel[i * 3] = vx; pool.vel[i * 3 + 1] = vy; pool.vel[i * 3 + 2] = vz;
      const life = P[2] * (0.6 + Math.random() * 0.7);
      pool.life[i] = life; pool.max[i] = life;
      pool.size[i] = (opts.size ?? 1) * P[3] * (0.6 + Math.random() * 0.8);
      pool.grav[i] = P[1]; pool.drag[i] = P[4]; pool.spin[i] = (Math.random() - 0.5) * 14;
      pool.mesh.setColorAt(i, _c.setHex(cols[(Math.random() * cols.length) | 0]));
    }
    pool.mesh.instanceColor.needsUpdate = true;
  }
  _updatePool(pool, dt) {
    const m = pool.mesh, w = this.world;
    let any = false;
    for (let i = 0; i < pool.n; i++) {
      if (pool.life[i] <= 0) continue;
      pool.life[i] -= dt;
      if (pool.life[i] <= 0) { m.setMatrixAt(i, ZERO); any = true; continue; }
      const d = Math.exp(-pool.drag[i] * dt), j = i * 3;
      pool.vel[j] *= d; pool.vel[j + 2] *= d; pool.vel[j + 1] = pool.vel[j + 1] * d - pool.grav[i] * dt;
      pool.pos[j] += pool.vel[j] * dt; pool.pos[j + 1] += pool.vel[j + 1] * dt; pool.pos[j + 2] += pool.vel[j + 2] * dt;
      if (pool.grav[i] > 0 && w.heightAt) {
        const g = w.heightAt(pool.pos[j], pool.pos[j + 2]) + 0.04;
        if (pool.pos[j + 1] < g) { pool.pos[j + 1] = g; pool.vel[j + 1] *= -0.3; pool.vel[j] *= 0.5; pool.vel[j + 2] *= 0.5; }
      }
      const u = pool.life[i] / pool.max[i], s = pool.size[i] * Math.min(1, u * 2.5);
      const a = (pool.max[i] - pool.life[i]) * pool.spin[i];
      _q.setFromEuler(_e.set(a, a * 0.7, 0));
      _m.compose(_v.set(pool.pos[j], pool.pos[j + 1], pool.pos[j + 2]), _q, _s.set(s, s, s));
      m.setMatrixAt(i, _m); any = true;
    }
    if (any) m.instanceMatrix.needsUpdate = true;
  }

  // ---------------- Schadenszahlen ----------------
  _initNumbers() {
    this._nums = [];
    for (let i = 0; i < MAX_NUM; i++) {
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
      const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      sp.visible = false; sp.renderOrder = 10; this.root.add(sp);
      this._nums.push({ sp, cv, ctx: cv.getContext('2d'), tex, t: 0, life: 0, vx: 0, vz: 0 });
    }
    this._numNext = 0;
  }
  damageNumber(pos, value, color = 0xffffff) {
    const n = this._nums[this._numNext]; this._numNext = (this._numNext + 1) % MAX_NUM;
    const c = n.ctx; c.clearRect(0, 0, 128, 64);
    c.font = 'bold 40px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = 7; c.strokeStyle = '#1a0e08'; c.strokeText(String(value), 64, 34);
    c.fillStyle = '#' + _c.setHex(color).getHexString(); c.fillText(String(value), 64, 34);
    n.tex.needsUpdate = true;
    n.sp.position.set(pos.x + (Math.random() - 0.5) * 0.5, pos.y + 0.2, pos.z + (Math.random() - 0.5) * 0.5);
    n.vx = (Math.random() - 0.5) * 0.8; n.vz = (Math.random() - 0.5) * 0.8;
    n.t = 0; n.life = 1.0; n.sp.visible = true; n.sp.material.opacity = 1;
    n.big = value >= 20 ? 1.35 : 1;
  }
  _updateNumbers(dt) {
    for (const n of this._nums) {
      if (!n.sp.visible) continue;
      n.t += dt;
      if (n.t >= n.life) { n.sp.visible = false; continue; }
      const u = n.t / n.life;
      n.sp.position.y += (2.2 * (1 - u)) * dt; n.sp.position.x += n.vx * dt; n.sp.position.z += n.vz * dt;
      const pop = (u < 0.12 ? 0.6 + u / 0.12 * 0.7 : 1.3 - Math.min(0.3, (u - 0.12) * 1.5)) * n.big;
      n.sp.scale.set(0.9 * pop, 0.45 * pop, 1);
      n.sp.material.opacity = u > 0.65 ? 1 - (u - 0.65) / 0.35 : 1;
    }
  }

  // ---------------- Debug ----------------
  get debug() { return this._debug; }
  set debug(v) {
    this._debug = !!v;
    for (const a of this.actors) { if (v) this._dbgActor(a); else if (a._dbg) a._dbg.visible = false; }
    if (!v) for (const s of this._dbgSph) s.visible = false;
  }
  _initDebug() {
    this._dbgMat = new THREE.MeshBasicMaterial({ color: 0xff3030, wireframe: true, depthTest: false, transparent: true, opacity: 0.8 });
    this._dbgMatA = new THREE.MeshBasicMaterial({ color: 0x40ff60, wireframe: true, depthTest: false, transparent: true, opacity: 0.5 });
    this._dbgMatI = new THREE.MeshBasicMaterial({ color: 0x60a0ff, wireframe: true, depthTest: false, transparent: true, opacity: 0.6 });
    const sg = new THREE.SphereGeometry(1, 10, 6);
    this._dbgSph = [];
    for (let i = 0; i < MAX_DBG; i++) { const m = new THREE.Mesh(sg, this._dbgMat); m.visible = false; m.renderOrder = 20; this.root.add(m); this._dbgSph.push(m); }
  }
  _dbgActor(a) {
    if (!a._dbg) {
      const len = Math.max(0.01, a.height - 2 * a.radius);
      const g = new THREE.CapsuleGeometry(a.radius, len, 3, 10); g.translate(0, a.height / 2, 0);
      a._dbg = new THREE.Mesh(g, this._dbgMatA); a._dbg.renderOrder = 20; this.root.add(a._dbg);
    }
    a._dbg.visible = true;
  }
  _updateDebug() {
    if (!this._debug) return;
    for (const a of this.actors) {
      if (!a._dbg) this._dbgActor(a);
      a._dbg.position.copy(a.pos);
      a._dbg.material = a.invuln && a.invuln() ? this._dbgMatI : this._dbgMatA;
      a._dbg.visible = a.alive !== false;
    }
    let k = 0;
    for (const h of this.hitboxes) { if (k >= MAX_DBG) break; const p = h.at(); if (!p) continue; const s = this._dbgSph[k++]; s.position.copy(p); s.scale.setScalar(h.radius); s.visible = true; }
    for (const p of this.projectiles) { if (k >= MAX_DBG) break; const s = this._dbgSph[k++]; s.position.copy(p.pos); s.scale.setScalar(p.radius); s.visible = true; }
    for (; k < MAX_DBG; k++) this._dbgSph[k].visible = false;
  }

  // ---------------- Update ----------------
  update(dt) {
    const real = dt;
    this.time += real;
    if (this.stopT > 0) { this.stopT -= real; dt = 0; }
    const timeScale = this.stopT > 0 ? 0 : 1;

    // Hitboxen
    for (let i = this.hitboxes.length - 1; i >= 0; i--) {
      const h = this.hitboxes[i];
      const p = h.t < h.duration ? h.at() : null;
      if (p) for (const a of this.actors) {
        if (!this._canHit(a, h.team) || h.hitSet.has(a)) continue;
        if (capsuleDist(a, p) <= h.radius + a.radius) { h.hitSet.add(a); this.applyHit(a, h, p); }
      }
      h.t += dt;
      if (h.t >= h.duration) this.hitboxes.splice(i, 1);
    }
    // Projektile
    const w = this.world;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const s = this.projectiles[i];
      if (dt <= 0) continue;
      s.life -= dt;
      if (s.homing && s.homing.alive !== false && s.homing.hp > 0) {
        const tg = s.homing, spd = s.vel.length();
        _v.set(tg.pos.x - s.pos.x, tg.pos.y + tg.height * 0.5 - s.pos.y, tg.pos.z - s.pos.z).normalize().multiplyScalar(spd);
        s.vel.lerp(_v, 1 - Math.exp(-s.homingRate * dt)).setLength(spd);
      }
      s.vel.y -= s.gravity * dt;
      s.pos.addScaledVector(s.vel, dt);
      s.mesh.position.copy(s.pos); s.mesh.rotation.x += dt * 9; s.mesh.rotation.y += dt * 7;
      s.trailT -= dt;
      if (s.trailT <= 0) { s.trailT = 0.03; this.fx(s.fx, s.pos, 2, { speed: 0.3, up: 0.3 }); }
      let hitA = null;
      for (const a of this.actors) {
        if (!this._canHit(a, s.o.team)) continue;
        if (capsuleDist(a, s.pos) <= s.radius + a.radius) {
          if (a.invuln && a.invuln()) continue;
          hitA = a; break;
        }
      }
      const ground = w.heightAt ? w.heightAt(s.pos.x, s.pos.z) : -1e9;
      if (hitA || s.life <= 0 || s.pos.y < ground + 0.05 || s.pos.y < (w.waterLevel ?? -1e9)) this._endProjectile(s, hitA);
    }
    // Telegraphs
    for (let i = this.telegraphs.length - 1; i >= 0; i--) {
      const t = this.telegraphs[i];
      t.t += t.wave ? real : dt;
      const u = clamp(t.t / t.duration, 0, 1);
      t.mat.uniforms.uFill.value = t.wave ? 0.15 + u * 0.85 : u;
      t.mat.uniforms.uTime.value = this.time;
      const fade = t.wave ? 1 - u * u : (t.t > t.duration ? 1 - (t.t - t.duration) / 0.15 : 1);
      t.mat.uniforms.uAlpha.value = clamp(fade, 0, 1);
      if (t.wave ? t.t >= t.duration : t.t >= t.duration + 0.15) {
        this.root.remove(t.mesh); t.mesh.geometry.dispose(); t.mat.dispose(); this.telegraphs.splice(i, 1);
      }
    }
    // FX laufen auch während Hitstop weiter (wirkt lebendiger)
    this._updatePool(this._cubes, real);
    this._updatePool(this._stars, real);
    this._updateNumbers(real);
    this._updateDebug();
    return { timeScale };
  }
}
