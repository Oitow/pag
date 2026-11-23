// Gigant-Welt: dünne Hülle um atmosphaere.js (Himmel, Nebel) + Sonnenlicht, Schatten-Kamera, Pollen.
// createHimmel(K) -> { setZeit(stunde, azVersatz), setSonne(el, az), placeShadowCam(), follow(pos, dt), updatePollen(now, dt), pollen, sunDir }
// Setzt K.hemi, K.sun, K.SH. Nutzt K: scene, camera, $, Q, shadowsOn, pos.
import * as THREE from 'three';
import { createAtmosphaere } from './atmosphaere.js';

export function createHimmel(K) {
  const { scene, camera, $, pos } = K;
  const hemi = new THREE.HemisphereLight(0xbcd8ff, 0x46553a, 1.0);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 3.0);
  sun.castShadow = K.shadowsOn;
  const SH = 115;
  Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 1600 });
  sun.shadow.mapSize.set(K.Q.shadow || 1024, K.Q.shadow || 1024);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.4;
  sun.shadow.camera.layers.enable(1);
  scene.add(sun, sun.target);
  K.hemi = hemi; K.sun = sun; K.SH = SH;

  /* Himmel, Wolken, Tag/Nacht, Nebel: atmosphaere.js (setzt scene.fog selbst, vor dem ersten Kompilieren) */
  const atm = createAtmosphaere({ scene, renderer: K.renderer, sonne: sun, hemi });
  const sunDir = atm.sonnenRichtung;
  let azOff = 0;
  const hhmm = h => { const m = Math.round(((h % 24) + 24) % 24 * 60); return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  // Uhrzeit (0..24 h) + Sonnenrichtung-Versatz (Grad)
  function setZeit(h, az = azOff) {
    atm.setZeit(h); azOff = az;
    if (az) { const el = Math.asin(sunDir.y) * 180 / Math.PI, a = Math.atan2(sunDir.x, sunDir.z) * 180 / Math.PI + az; atm.setSonne(el, a); }
    $('sunV').textContent = hhmm(h);
  }

  function placeShadowCam() {
    const c = camera.position, d = sunDir;
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), d).normalize();
    const up = new THREE.Vector3().crossVectors(d, right).normalize();
    const tex = 2 * SH / sun.shadow.mapSize.x;
    const a = Math.round(c.dot(right) / tex) * tex, b = Math.round(c.dot(up) / tex) * tex, w = c.dot(d);
    const ctr = right.multiplyScalar(a).add(up.multiplyScalar(b)).add(d.clone().multiplyScalar(w));
    sun.target.position.copy(ctr); sun.position.copy(ctr).addScaledVector(d, 800);
  }

  /* ================= POLLEN ================= */
  const PN = 500, pp = new Float32Array(PN * 3), pv = new Float32Array(PN * 3);
  for (let i = 0; i < PN * 3; i++) { pp[i] = (Math.random() - .5) * 60; pv[i] = (Math.random() - .5) * .4; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const pcv = document.createElement('canvas'); pcv.width = pcv.height = 32;
  { const c = pcv.getContext('2d'), gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32); }
  const pollen = new THREE.Points(pg, new THREE.PointsMaterial({ size: .12, map: new THREE.CanvasTexture(pcv), color: 0xfff0c0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true }));
  pollen.frustumCulled = false; scene.add(pollen);

  function follow(p, dt = 0.016) { atm.update(dt, p); }
  function updatePollen(now, dt) {
    if (!pollen.visible) return;
    for (let i = 0; i < PN; i++) {
      const o = i * 3;
      for (let a = 0; a < 3; a++) {
        pp[o + a] += (pv[o + a] + Math.sin(now * .0004 + i + a) * .15) * dt;
        const c = [pos.x, pos.y, pos.z][a], hw = a === 1 ? 15 : 30;
        if (pp[o + a] < c - hw) pp[o + a] += 2 * hw; else if (pp[o + a] > c + hw) pp[o + a] -= 2 * hw;
      }
    }
    pg.attributes.position.needsUpdate = true;
  }
  return { setZeit, setSonne: atm.setSonne, placeShadowCam, follow, updatePollen, pollen, sunDir, atm };
}
