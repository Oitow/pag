// Kinematischer Charakter-Controller: Beschleunigung, Coyote-Time, Jump-Buffer, variable Sprunghöhe,
// Step-Up, Ground-Snap, Hang-Rutschen, Schwimmen. Alle Werte live tunebar über TUNING.
import * as THREE from 'three';
import { clamp, damp } from './kit.js';

export const TUNING = {
  walkSpeed: 4.6,
  runSpeed: 8.2,
  accelGround: 42,
  decelGround: 34,
  accelAir: 11,
  turnRate: 13,        // wie schnell die Figur sich in Laufrichtung dreht
  gravity: 26,
  jumpHeight: 1.45,
  lowJumpMul: 2.4,     // Schwerkraft-Faktor, wenn Sprungtaste früh losgelassen (variable Höhe)
  fallMul: 1.55,       // schwereres Fallen = knackigeres Gefühl
  maxFall: 42,
  coyoteTime: 0.13,
  jumpBuffer: 0.15,
  stepHeight: 0.5,
  slopeLimitDeg: 44,
  slideAccel: 14,
  airControl: 1.0,
  chopMoveMul: 0.45,
  swimSpeed: 2.8,
};

const _wish = new THREE.Vector3(), _n = new THREE.Vector3();

export class CharacterController {
  constructor(world, spawn, radius = 0.35, height = 1.75) {
    this.world = world;
    this.pos = spawn.clone();
    this.pos.y = world.groundAt(this.pos.x, this.pos.z, 999);
    this.vel = new THREE.Vector3();
    this.radius = radius; this.height = height;
    this.yaw = 0;              // Blickrichtung der Figur (+Z = 0)
    this.turn = 0;             // rad/s, für Animation
    this.grounded = true;
    this.swimming = false;
    this.coyote = 0; this.buffer = 0;
    this.jumping = false;
    this.landImpact = 0;
    this.sprint = false;
    this.airTime = 0;
    this.lastGroundY = this.pos.y;
  }

  groundNormal(x, z, out) {
    const e = 0.6, w = this.world;
    const hL = w.heightAt(x - e, z), hR = w.heightAt(x + e, z), hD = w.heightAt(x, z - e), hU = w.heightAt(x, z + e);
    return out.set(hL - hR, 2 * e, hD - hU).normalize();
  }

  /** intent: { moveX, moveY, sprint, jump, jumpPressed }, camYaw: Kamera-Yaw, mul: Speed-Multiplikator (z. B. beim Hacken) */
  update(dt, intent, camYaw, mul = 1) {
    const T = TUNING, w = this.world;
    this.landImpact = 0;

    // Wunschrichtung relativ zur Kamera
    const sx = intent.moveX, sy = intent.moveY;
    const mag = Math.min(1, Math.hypot(sx, sy));
    const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
    // Kamera schaut entlang (-sin, -cos) -> vorwärts
    _wish.set(-sin * sy + cos * sx, 0, -cos * sy - sin * sx);
    if (_wish.lengthSq() > 1e-6) _wish.normalize();
    this.sprint = intent.sprint && mag > 0.3;
    let maxSpeed = (this.sprint ? T.runSpeed : T.walkSpeed) * mul;
    if (this.swimming) maxSpeed = T.swimSpeed * (this.sprint ? 1.4 : 1);

    // Hangbremse bergauf
    const gN = this.groundNormal(this.pos.x, this.pos.z, _n);
    const slopeDeg = Math.acos(clamp(gN.y, -1, 1)) * 57.3;
    if (this.grounded && mag > 0) {
      const uphill = -(gN.x * _wish.x + gN.z * _wish.z); // >0 = bergauf
      if (uphill > 0) maxSpeed *= 1 - clamp(uphill * 1.1, 0, 0.45);
    }

    const target = _wish.multiplyScalar(maxSpeed * mag);
    const onGround = this.grounded || this.swimming;
    const accel = onGround ? (mag > 0.01 ? T.accelGround : T.decelGround) : T.accelAir * T.airControl;
    // Beschleunigung als Vektor-Annäherung (kein Schwimmen/Eis-Gefühl)
    const dx = target.x - this.vel.x, dz = target.z - this.vel.z;
    const dl = Math.hypot(dx, dz), step = accel * dt;
    if (dl <= step || dl < 1e-6) { this.vel.x = target.x; this.vel.z = target.z; }
    else { this.vel.x += dx / dl * step; this.vel.z += dz / dl * step; }

    // Zu steiler Hang: rutschen
    if (this.grounded && slopeDeg > T.slopeLimitDeg) {
      this.vel.x += gN.x * T.slideAccel * dt;
      this.vel.z += gN.z * T.slideAccel * dt;
    }

    // Drehung zur Laufrichtung
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const prevYaw = this.yaw;
    if (hs > 0.25 && mag > 0.05) {
      const want = Math.atan2(this.vel.x, this.vel.z);
      let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * (1 - Math.exp(-T.turnRate * dt));
    }
    let dy = this.yaw - prevYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.turn = damp(this.turn, dt > 0 ? dy / dt : 0, 10, dt);

    // Sprung: Buffer + Coyote
    this.buffer = intent.jumpPressed ? T.jumpBuffer : Math.max(0, this.buffer - dt);
    this.coyote = this.grounded ? T.coyoteTime : Math.max(0, this.coyote - dt);
    if (this.buffer > 0 && this.coyote > 0 && !this.swimming) {
      this.vel.y = Math.sqrt(2 * T.gravity * T.jumpHeight);
      this.grounded = false; this.jumping = true;
      this.buffer = 0; this.coyote = 0;
      this.justJumped = true;
    } else this.justJumped = false;
    if (this.swimming && intent.jumpPressed) { this.vel.y = 4.5; this.swimming = false; this.grounded = false; }

    // Schwerkraft
    if (!this.grounded && !this.swimming) {
      let g = T.gravity;
      if (this.vel.y < 0) g *= T.fallMul;
      else if (!intent.jump) g *= T.lowJumpMul;
      this.vel.y = Math.max(-T.maxFall, this.vel.y - g * dt);
      this.airTime += dt;
    }

    // Integration horizontal + Kollision
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    w.collide(this.pos, this.radius, this.height, this.vel);
    // Inselrand: unsichtbare weiche Grenze weit draußen im Wasser
    const rr = Math.hypot(this.pos.x, this.pos.z), lim = w.radius + 60;
    if (rr > lim) { this.pos.x *= lim / rr; this.pos.z *= lim / rr; }

    // Vertikal
    const ground = w.groundAt(this.pos.x, this.pos.z, this.pos.y);
    const water = w.waterLevel ?? 0;
    const swimY = water - 1.25;
    if (this.grounded) {
      const drop = this.pos.y - ground;
      if (ground > this.pos.y && ground - this.pos.y <= T.stepHeight) this.pos.y = ground;        // Step-Up
      else if (drop >= 0 && drop < T.stepHeight + hs * dt * 1.2) this.pos.y = ground;              // Ground-Snap bergab
      else if (drop >= T.stepHeight) { this.grounded = false; this.vel.y = 0; this.airTime = 0; } // Kante -> fallen
      this.vel.y = 0;
    } else if (!this.swimming) {
      this.pos.y += this.vel.y * dt;
      if (this.pos.y <= ground && this.vel.y <= 0) {
        this.landImpact = clamp(-this.vel.y / 20, 0, 1);
        this.pos.y = ground; this.vel.y = 0;
        this.grounded = true; this.jumping = false; this.airTime = 0;
      }
    }
    // Schwimmen wenn Wasser tief genug
    if (ground < swimY - 0.05 && this.pos.y <= swimY + 0.05) {
      if (!this.swimming) this.landImpact = clamp(-this.vel.y / 30, 0, 0.5);
      this.swimming = true; this.grounded = false; this.jumping = false;
      this.pos.y = damp(this.pos.y, swimY + Math.sin(performance.now() / 600) * 0.05, 8, dt);
      this.vel.y = 0;
    } else if (this.swimming) {
      this.swimming = false;
      this.grounded = ground >= this.pos.y - 0.3;
      if (this.grounded) this.pos.y = Math.max(this.pos.y, ground);
    }
    this.maxSpeed = maxSpeed;
    this.speed = Math.hypot(this.vel.x, this.vel.z);
  }

  forward(out = new THREE.Vector3()) { return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
}
