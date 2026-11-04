// Third-Person-Kamera pro Spieler: Orbit (Yaw/Pitch), weiches Folgen (vertikal träger -> Sprünge wirken ruhig),
// Terrain-Kollision, Auto-Ausrichtung hinter die Figur, Sprint-FOV, Lande-Shake.
import * as THREE from 'three';
import { clamp, damp } from './kit.js';

export const CAM_TUNING = {
  distance: 6.5, minDist: 2.5, maxDist: 14,
  height: 1.55,
  followXZ: 14, followY: 6,
  autoAlign: 1.2,     // 0 = aus. Dreht Kamera langsam hinter die Laufrichtung
  fov: 62, sprintFov: 70,
  shake: 1,
};

export class FollowCamera {
  constructor(aspect) {
    this.cam = new THREE.PerspectiveCamera(CAM_TUNING.fov, aspect, 0.1, 1100);
    this.yaw = Math.PI;        // Kamera hinter Figur, die nach +Z schaut
    this.pitch = 0.32;
    this.dist = CAM_TUNING.distance;
    this.target = new THREE.Vector3();
    this.shakeT = 0; this.shakeAmp = 0;
    this.lookIdle = 0;
    this.inited = false;
  }

  kick(amount) { this.shakeAmp = Math.max(this.shakeAmp, amount * CAM_TUNING.shake); this.shakeT = 0; }

  update(dt, ctrl, intent, world) {
    const C = CAM_TUNING;
    this.yaw -= intent.lookX * dt;
    this.pitch = clamp(this.pitch + intent.lookY * dt, -0.35, 1.25);
    this.dist = clamp(this.dist + intent.zoom, C.minDist, C.maxDist);
    const looking = Math.abs(intent.lookX) + Math.abs(intent.lookY) > 0.01;
    this.lookIdle = looking ? 0 : this.lookIdle + dt;

    // Auto-Ausrichtung nur bei Bewegung und wenn der Spieler die Kamera eine Weile nicht anfasst
    if (C.autoAlign > 0 && this.lookIdle > 1.2 && ctrl.speed > 1.5 && ctrl.grounded) {
      const behind = ctrl.yaw + Math.PI;
      let d = behind - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      // seitliches Laufen nicht "jagen": nur wenn nicht fast rückwärts
      if (Math.abs(d) < 2.4) this.yaw += d * (1 - Math.exp(-C.autoAlign * 0.35 * dt)) * Math.min(1, ctrl.speed / 5);
    }

    const tx = ctrl.pos.x, tz = ctrl.pos.z, ty = ctrl.pos.y + C.height;
    if (!this.inited) { this.target.set(tx, ty, tz); this.inited = true; }
    this.target.x = damp(this.target.x, tx, C.followXZ, dt);
    this.target.z = damp(this.target.z, tz, C.followXZ, dt);
    // Vertikal: beim Springen träge, beim Fallen unter das Ziel schneller nachziehen
    const fy = ty < this.target.y - 1.2 ? C.followY * 2.5 : C.followY;
    this.target.y = damp(this.target.y, ty, fy, dt);

    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    let d = this.dist;
    const cam = this.cam;
    const place = dd => cam.position.set(
      this.target.x + Math.sin(this.yaw) * cp * dd,
      this.target.y + sp * dd + 0.4,
      this.target.z + Math.cos(this.yaw) * cp * dd);
    place(d);
    // Terrain-Kollision: Kamera näher heranziehen statt durch den Hügel zu schauen
    for (let i = 0; i < 6; i++) {
      const g = world.heightAt(cam.position.x, cam.position.z) + 0.5;
      if (cam.position.y >= g) break;
      d *= 0.78; place(d);
    }
    const g = world.heightAt(cam.position.x, cam.position.z) + 0.4;
    if (cam.position.y < g) cam.position.y = g;
    if (cam.position.y < (world.waterLevel ?? 0) + 0.3) cam.position.y = (world.waterLevel ?? 0) + 0.3;

    // Shake
    if (this.shakeAmp > 0.001) {
      this.shakeT += dt;
      const a = this.shakeAmp * Math.exp(-this.shakeT * 9);
      cam.position.x += Math.sin(this.shakeT * 61) * a * 0.12;
      cam.position.y += Math.sin(this.shakeT * 73 + 1) * a * 0.18;
      if (a < 0.002) this.shakeAmp = 0;
    }
    cam.lookAt(this.target.x, this.target.y + 0.15, this.target.z);
    const fov = ctrl.sprint && ctrl.speed > 6 ? C.sprintFov : C.fov;
    cam.fov = damp(cam.fov, fov, 4, dt);
    cam.updateProjectionMatrix();
  }
}
