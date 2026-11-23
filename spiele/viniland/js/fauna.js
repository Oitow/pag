// Einfache Tier-KI: Herden, Umherwandern, Fressen, Sitzen, Flucht vor Spielern (scheue Tiere), Neugier (neugierige Tiere).
import * as THREE from 'three';
import { createAnimal, ANIMAL_TYPES, ANIMAL_INFO } from './animals.js';
import { rng, clamp, damp } from './kit.js';

const _v = new THREE.Vector3();

export class Fauna {
  constructor(scene, world, seed = 7, perType = 2) {
    this.world = world;
    this.list = [];
    const r = rng(seed);
    for (const type of ANIMAL_TYPES) {
      const info = ANIMAL_INFO[type] || {};
      const groups = info.herd ? 2 : perType;
      for (let g = 0; g < groups; g++) {
        const center = world.randomLandPoint(r);
        const n = info.herd ? 3 + Math.floor(r() * 2) : 1;
        for (let k = 0; k < n; k++) {
          const a = createAnimal(type, Math.floor(r() * 1e9));
          const p = center.clone().add(_v.set((r() - 0.5) * 6, 0, (r() - 0.5) * 6));
          p.y = world.heightAt(p.x, p.z);
          a.object3D.position.copy(p);
          scene.add(a.object3D);
          this.list.push({
            a, info, type, pos: a.object3D.position, home: center.clone(),
            yaw: r() * Math.PI * 2, speed: 0, wantSpeed: 0, turn: 0,
            state: 'idle', timer: r() * 3, target: new THREE.Vector3(), action: null, r,
          });
        }
      }
    }
  }

  pick(e, state) {
    const r = e.r, info = e.info;
    e.state = state; e.action = null;
    if (state === 'wander') {
      const ang = r() * Math.PI * 2, dist = 4 + r() * 14;
      e.target.set(e.home.x + Math.cos(ang) * dist, 0, e.home.z + Math.sin(ang) * dist);
      e.wantSpeed = (info.walk || 1.2) * (0.7 + r() * 0.4);
      e.timer = 6 + r() * 6;
    } else if (state === 'idle') { e.wantSpeed = 0; e.timer = 1.5 + r() * 4; }
    else if (state === 'eat') { e.wantSpeed = 0; e.action = 'eat'; e.timer = 2 + r() * 4; }
    else if (state === 'sit') { e.wantSpeed = 0; e.action = 'sit'; e.timer = 4 + r() * 6; }
  }

  update(dt, players) {
    const w = this.world;
    for (const e of this.list) {
      const info = e.info;
      // nächster Spieler
      let near = null, nd = 1e9;
      for (const p of players) { const d = Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z); if (d < nd) { nd = d; near = p; } }
      const fleeR = info.temper === 'skittish' ? 9 : info.temper === 'calm' ? 3.5 : 0;
      const run = info.run || (info.walk || 1.2) * 2.5;

      e.timer -= dt;
      if (near && fleeR > 0 && nd < fleeR && (near.speed > 1.2 || nd < fleeR * 0.5)) {
        if (e.state !== 'flee') { e.state = 'flee'; e.action = null; e.timer = 2.5; }
        e.target.set(e.pos.x * 2 - near.pos.x, 0, e.pos.z * 2 - near.pos.z);
        e.wantSpeed = run;
      } else if (near && info.temper === 'curious' && nd < 14 && nd > 3 && e.state !== 'flee' && near.speed < 0.5) {
        e.state = 'curious'; e.action = null;
        e.target.set(near.pos.x, 0, near.pos.z);
        e.wantSpeed = (info.walk || 1.2) * 0.8;
        e.timer = 1;
      } else if (e.timer <= 0) {
        const roll = e.r();
        this.pick(e, roll < 0.45 ? 'wander' : roll < 0.7 ? 'eat' : roll < 0.85 ? 'sit' : 'idle');
      }
      if (e.state === 'curious' && nd <= 3) e.wantSpeed = 0;

      // Richtung
      if (e.wantSpeed > 0) {
        const dx = e.target.x - e.pos.x, dz = e.target.z - e.pos.z;
        if (Math.hypot(dx, dz) < 0.8 && e.state === 'wander') this.pick(e, 'idle');
        else {
          let want = Math.atan2(dx, dz);
          // Wasser meiden: vorausschauen
          const ax = e.pos.x + Math.sin(want) * 3, az = e.pos.z + Math.cos(want) * 3;
          if (w.heightAt(ax, az) < 0.6) { want += Math.PI * 0.6; e.target.set(e.home.x, 0, e.home.z); }
          let d = want - e.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
          const turnRate = clamp(d * 4, -4, 4);
          e.yaw += turnRate * dt;
          e.turn = damp(e.turn, turnRate, 8, dt);
        }
      } else e.turn = damp(e.turn, 0, 6, dt);
      e.speed = damp(e.speed, e.wantSpeed, e.wantSpeed > e.speed ? 4 : 6, dt);

      e.pos.x += Math.sin(e.yaw) * e.speed * dt;
      e.pos.z += Math.cos(e.yaw) * e.speed * dt;
      w.collide(e.pos, e.a.radius || 0.4, e.a.height || 0.8);
      const gy = w.groundAt(e.pos.x, e.pos.z, e.pos.y + 0.3);
      e.pos.y = damp(e.pos.y, gy, 20, dt);
      e.a.object3D.rotation.y = e.yaw;
      // Am Hang leicht anneigen
      e.a.animate(dt, { speed: e.speed, grounded: true, turn: e.turn, action: e.action });
    }
  }
}
