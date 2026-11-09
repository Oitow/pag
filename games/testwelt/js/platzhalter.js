// Testwelt – Platzhalter-Figur, solange das Engine-Figurensystem (docs/FIGUREN-SYSTEM.md) noch nicht im Repo ist.
// Kapsel + einfache Steuerung (Tastatur, Touch-Stick, Maus/Finger-Kamera). Nutzt denselben Welt-Adapter
// (bodenHoehe, wasserHoehe, hindernisse) wie später der echte Motor. Wird gelöscht, sobald das Figurensystem da ist.
import * as THREE from 'three';
import { clamp, damp, dampAngle } from '../../../engine/core/math.js';
import { createSteuerung } from './steuerung.js';

export function createPlatzhalter({ szene, kamera, adapter, element, start }) {
  const figur = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xe0703a, roughness: 0.7 });
  const koerper = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.1, 4, 10), mat);
  koerper.position.y = 0.85; koerper.castShadow = true;
  const nase = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.25), new THREE.MeshStandardMaterial({ color: 0x222831 }));
  nase.position.set(0, 1.45, 0.3);
  figur.add(koerper, nase);
  szene.add(figur);

  const st = createSteuerung(element);
  const pos = { x: start.x, y: start.y, z: start.z }, vel = { x: 0, y: 0, z: 0 };
  let yaw = 0, amBoden = true, imWasser = false;
  const cam = { yaw: 0, pitch: 0.35, dist: 7 };
  const ziel = new THREE.Vector3();

  function update(dt) {
    const e = st.lesen();
    cam.yaw -= e.dreheX * 0.006; cam.pitch = clamp(cam.pitch + e.dreheY * 0.005, -0.2, 1.3);
    cam.dist = clamp(cam.dist * e.zoom, 2.5, 30);
    // Stick ist kamera-relativ → Weltrichtung (Figur-yaw 0 = +Z, links = +X)
    const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
    const wx = e.y * s - e.x * c, wz = e.y * c + e.x * s;
    const anteil = Math.min(1, Math.hypot(wx, wz));
    const tempo = (imWasser ? 2.4 : e.sprint ? 8 : 5) * anteil;
    const l = Math.hypot(wx, wz) || 1;
    vel.x = damp(vel.x, wx / l * tempo, amBoden || imWasser ? 12 : 3, dt);
    vel.z = damp(vel.z, wz / l * tempo, amBoden || imWasser ? 12 : 3, dt);
    if (anteil > 0.05) yaw = dampAngle(yaw, Math.atan2(wx, wz), 12, dt);

    pos.x += vel.x * dt; pos.z += vel.z * dt;
    const schub = adapter.hindernisse(pos.x, pos.z, 0.3);
    if (schub) { pos.x += schub.x; pos.z += schub.z; }

    const boden = adapter.bodenHoehe(pos.x, pos.z), wasser = adapter.wasserHoehe(pos.x, pos.z);
    imWasser = wasser !== null && wasser - boden > 1.2 && pos.y < wasser - 0.9;
    if (imWasser) {
      vel.y = damp(vel.y, (wasser - 1.1 - pos.y) * 4, 6, dt);
      if (e.springen && pos.y > wasser - 1.3) vel.y = 4;
    } else {
      vel.y -= 25 * dt;
      if (amBoden && e.springenNeu) { vel.y = 8; amBoden = false; }
    }
    pos.y += vel.y * dt;
    if (pos.y <= boden) { pos.y = boden; if (vel.y < 0) vel.y = 0; amBoden = true; }
    else if (pos.y > boden + 0.25 && !imWasser) amBoden = false;
    else if (vel.y <= 0) { pos.y = boden; amBoden = true; } // Hang hinab am Boden kleben

    figur.position.set(pos.x, pos.y, pos.z);
    figur.rotation.y = yaw;

    // Kamera: Orbit um die Figur, bleibt über dem Boden
    ziel.set(pos.x, pos.y + 1.5, pos.z);
    const cp = Math.cos(cam.pitch);
    let kx = ziel.x - Math.sin(cam.yaw) * cp * cam.dist, kz = ziel.z - Math.cos(cam.yaw) * cp * cam.dist;
    let ky = ziel.y + Math.sin(cam.pitch) * cam.dist;
    ky = Math.max(ky, adapter.bodenHoehe(kx, kz) + 0.4, (adapter.wasserHoehe(kx, kz) ?? -1e9) + 0.3);
    kamera.position.set(damp(kamera.position.x, kx, 14, dt), damp(kamera.position.y, ky, 14, dt), damp(kamera.position.z, kz, 14, dt));
    kamera.lookAt(ziel);
  }

  return {
    art: 'Platzhalter (Figurensystem folgt)',
    position: pos,
    get tempo() { return Math.hypot(vel.x, vel.z); },
    update,
    teleport(x, z) {
      pos.x = x; pos.z = z; pos.y = adapter.bodenHoehe(x, z) + 0.5; vel.x = vel.y = vel.z = 0;
      kamera.position.set(x, pos.y + 5, z - 7);
    },
    setAdapter(a) { adapter = a; },
    dispose() {
      st.dispose(); figur.removeFromParent();
      figur.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    },
  };
}
