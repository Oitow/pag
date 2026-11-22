// Einfacher Test-Stub mit derselben API wie js/combat.js (CONTRACT „Kampf (Erweiterung 2)“). Nur für Testseiten.
import * as THREE from 'three';

const FXC = { spark: 0xfff0a0, fire: 0xff6a20, frost: 0xa0e0ff, dark: 0x9040ff, dust: 0xc8b090, blood: 0xffffff };
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export class Combat {
  constructor(scene, world) {
    this.scene = scene; this.world = world; this.actors = []; this.hbs = []; this.projs = []; this.tgs = []; this.hs = 0; this.shakeAmt = 0;
    this.log = [];
    const N = 600; this.N = N; this.pi = 0;
    this.pp = new Float32Array(N * 3).fill(-999); this.pv = new Float32Array(N * 3); this.pl = new Float32Array(N); this.pc = new Float32Array(N * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pp, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.pc, 3));
    this.pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.2, vertexColors: true })); this.pts.frustumCulled = false; scene.add(this.pts);
    this.sphG = new THREE.SphereGeometry(1, 10, 6);
  }
  addActor(a) { this.actors.push(a); }
  removeActor(a) { const i = this.actors.indexOf(a); if (i >= 0) this.actors.splice(i, 1); }
  hitbox(o) {
    const m = new THREE.Mesh(this.sphG, new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.25, depthWrite: false }));
    m.scale.setScalar(o.radius); this.scene.add(m);
    this.hbs.push({ knockback: 4, stagger: 0, ...o, t: 0, hit: new Set(), m });
  }
  projectile(o) {
    const m = new THREE.Mesh(this.sphG, new THREE.MeshBasicMaterial({ color: FXC[o.fx] || 0xffffff }));
    m.scale.setScalar(o.radius); this.scene.add(m);
    this.projs.push({ gravity: 0, knockback: 4, stagger: 0.2, ...o, pos: o.pos.clone(), vel: o.vel.clone(), t: 0, m });
  }
  telegraph(o) {
    const shape = o.shape || 'circle', r = o.radius;
    let g;
    if (shape === 'line') { g = new THREE.PlaneGeometry(r * 2, o.length); g.translate(0, o.length / 2, 0); }
    else if (shape === 'cone') g = new THREE.CircleGeometry(r, 20, PI2 / 4 - o.angle / 2, o.angle);
    else g = new THREE.RingGeometry(r * 0.85, r, 32);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: o.color ?? 0xff3020, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2;
    const grp = new THREE.Group(); grp.add(m);
    grp.position.copy(o.pos); grp.position.y = this.world.heightAt(o.pos.x, o.pos.z) + 0.08;
    if (o.dir) grp.rotation.y = Math.atan2(o.dir.x, o.dir.z);
    if (shape !== 'circle') m.rotation.z = Math.PI; // Plane +Y → +Z
    let fill = null;
    if (shape === 'circle') { fill = new THREE.Mesh(new THREE.CircleGeometry(r, 24), m.material.clone()); fill.material.opacity = 0.3; fill.rotation.x = -Math.PI / 2; grp.add(fill); }
    this.scene.add(grp); this.tgs.push({ ...o, t: 0, grp, m, fill });
  }
  hitstop(s) { this.hs = Math.max(this.hs, s); }
  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }
  fx(kind, pos, n = 10) {
    const c = new THREE.Color(FXC[kind] || 0xffffff);
    for (let k = 0; k < n; k++) {
      const i = this.pi = (this.pi + 1) % this.N;
      this.pp[i * 3] = pos.x; this.pp[i * 3 + 1] = pos.y; this.pp[i * 3 + 2] = pos.z;
      this.pv[i * 3] = (Math.random() - 0.5) * 6; this.pv[i * 3 + 1] = Math.random() * 5; this.pv[i * 3 + 2] = (Math.random() - 0.5) * 6;
      this.pl[i] = 0.6 + Math.random() * 0.5; this.pc[i * 3] = c.r; this.pc[i * 3 + 1] = c.g; this.pc[i * 3 + 2] = c.b;
    }
  }
  damageNumber() {}
  nearestEnemy(from, team, maxD = 1e9) {
    let best = null, bd = maxD;
    for (const a of this.actors) if (a.team !== team && a.alive) { const d = a.pos.distanceTo(from); if (d < bd) { bd = d; best = a; } }
    return best;
  }
  _test(p, r, a) { // Kugel gegen Kapsel
    _a.copy(a.pos); _a.y = Math.min(Math.max(p.y, a.pos.y), a.pos.y + a.height);
    return _a.distanceTo(p) < r + a.radius;
  }
  _apply(a, o, from, src) {
    a.hp -= o.damage;
    _b.set(a.pos.x - from.x, 0, a.pos.z - from.z); if (_b.lengthSq() < 1e-6) _b.set(0, 0, 1); _b.normalize();
    this.log.push(`${src.owner?.name || src.owner?.id} → ${a.name || a.id}: ${o.damage}`);
    a.onHit && a.onHit({ damage: o.damage, dir: _b.clone(), knockback: o.knockback, stagger: o.stagger, kind: o.kind || 'spell', source: o.owner });
    this.fx(o.onHitFx || o.fx || 'spark', a.pos.clone().setY(a.pos.y + a.height * 0.6), 8);
  }
  update(dt) {
    if (this.hs > 0) { this.hs -= dt; return { timeScale: 0 }; }
    for (let i = this.hbs.length - 1; i >= 0; i--) {
      const h = this.hbs[i]; h.t += dt; const p = h.at(); h.m.position.copy(p);
      for (const a of this.actors) if (a.team !== h.team && a.alive && !h.hit.has(a) && !(a.invuln && a.invuln()) && this._test(p, h.radius, a)) { h.hit.add(a); this._apply(a, h, p, h); }
      if (h.t >= h.duration) { this.scene.remove(h.m); this.hbs.splice(i, 1); }
    }
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const q = this.projs[i]; q.t += dt;
      if (q.homing && q.homing.alive) { _a.copy(q.homing.pos).setY(q.homing.pos.y + 1).sub(q.pos).normalize().multiplyScalar(q.vel.length()); q.vel.lerp(_a, Math.min(1, dt * 2)); }
      q.vel.y -= q.gravity * dt; q.pos.addScaledVector(q.vel, dt); q.m.position.copy(q.pos);
      let dead = q.t > q.life || q.pos.y < this.world.heightAt(q.pos.x, q.pos.z);
      for (const a of this.actors) if (!dead && a.team !== q.team && a.alive && !(a.invuln && a.invuln()) && this._test(q.pos, q.radius, a)) { this._apply(a, q, q.pos, q); dead = true; }
      if (dead) {
        if (q.explodeRadius) for (const a of this.actors) if (a.team !== q.team && a.alive && this._test(q.pos, q.explodeRadius, a)) this._apply(a, { ...q, damage: q.damage * 0.6 }, q.pos, q);
        this.fx(q.fx, q.pos, 14); q.onExpire && q.onExpire(q.pos.clone());
        this.scene.remove(q.m); this.projs.splice(i, 1);
      }
    }
    for (let i = this.tgs.length - 1; i >= 0; i--) {
      const g = this.tgs[i]; g.t += dt; const k = g.t / g.duration;
      g.m.material.opacity = 0.35 + 0.35 * Math.abs(Math.sin(g.t * 14));
      if (g.fill) g.fill.scale.setScalar(Math.max(0.01, k));
      if (k >= 1) { this.scene.remove(g.grp); this.tgs.splice(i, 1); }
    }
    for (let i = 0; i < this.N; i++) {
      if (this.pl[i] <= 0) continue; this.pl[i] -= dt;
      if (this.pl[i] <= 0) { this.pp[i * 3 + 1] = -999; continue; }
      this.pv[i * 3 + 1] -= 9 * dt;
      for (let j = 0; j < 3; j++) this.pp[i * 3 + j] += this.pv[i * 3 + j] * dt;
    }
    this.pts.geometry.attributes.position.needsUpdate = true; this.pts.geometry.attributes.color.needsUpdate = true;
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2);
    return { timeScale: 1 };
  }
}
const PI2 = Math.PI * 2;
