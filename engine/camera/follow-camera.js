/**
 * @modul    follow-camera
 * @zweck    Third-Person-Orbitkamera: weiches Folgen (vertikal träger), Boden-/Hindernis-Kollision, Auto-Ausrichtung hinter die Laufrichtung, Sprint-FOV, Zoom, Schütteln, Lock-On
 * @api      createFollowCamera(opts) -> { kamera, yaw, pitch, distanz, update(dt, ziel, info), drehen(dx, dy), zoomen(delta), schuetteln(staerke, dauer), blickYaw(), richtungAusStick(x, y), springeZu(ziel), lockOn(punkt|null), dispose() } ; stickRichtung(x, y, yaw) -> {x, z}
 * @beispiel
 *   import { createFollowCamera } from '../../engine/camera/follow-camera.js';
 *   const cam = createFollowCamera({ bodenHoehe: (x, z) => welt.hoehe(x, z) });
 *   const e = eingabe.lesen(); cam.drehen(e.kameraX, e.kameraY); cam.zoomen(e.zoom);
 *   const r = cam.richtungAusStick(e.x, e.y);       // Kamera-relative Laufrichtung in Weltkoordinaten
 *   cam.update(dt, motor.pos, { tempo: motor.tempo, sprintet: motor.sprintet, yaw: motor.yaw, amBoden: motor.amBoden });
 *   renderer.render(szene, cam.kamera);
 * @tags     kamera, third-person, orbit, folgen, zoom, figur, lock-on, schuetteln
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { clamp, damp, dampAngle, angleDiff, numOr } from '../core/math.js';

/**
 * Stick (x = rechts, y = vorwärts) → Weltrichtung {x, z} relativ zu einem Blick-Yaw.
 * Yaw-Schema wie Figuren: yaw 0 = Blick +Z, yaw = atan2(x, z); rechts vom Blick ist (−cos yaw, sin yaw).
 */
export function stickRichtung(x, y, yaw) {
  const s = Math.sin(yaw), c = Math.cos(yaw);
  return { x: y * s - x * c, z: y * c + x * s };
}

const endlich = v => (Number.isFinite(v) ? v : 0);

export function createFollowCamera(opts = {}) {
  const o = {
    distanz: 6, minDistanz: 2, maxDistanz: 14, hoehe: 1.5, pitch: 0.35, minPitch: -0.35, maxPitch: 1.25,
    folgenXZ: 12, folgenY: 5, autoAusrichten: 1.0, fov: 60, sprintFov: 68, bodenHoehe: null, hindernis: null,
    ...opts,
  };
  const aspekt = typeof innerWidth === 'number' && innerHeight > 0 ? innerWidth / innerHeight : 1;
  const kamera = o.kamera || new THREE.PerspectiveCamera(o.fov, aspekt, 0.1, 1000);
  kamera.fov = o.fov;

  let yaw = 0;                      // Blickrichtung der Kamera (horizontal)
  let pitch = clamp(o.pitch, o.minPitch, o.maxPitch);   // + = Kamera höher, schaut nach unten
  let distanz = clamp(o.distanz, o.minDistanz, o.maxDistanz);
  let zielDistanz = distanz;
  let drehPause = 99;               // Sekunden seit der Spieler zuletzt gedreht hat
  let initialisiert = false;
  const z = new THREE.Vector3();    // geglätteter Blickpunkt (über den Füßen)
  const blick = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let lock = null; const letzterLock = new THREE.Vector3(); let lockW = 0;
  let wackel = 0, wackelDauer = 0, wackelT = 0;

  /** Kamera hinter den Blickpunkt setzen, mit Boden-/Hindernis-Kollision. */
  function platzieren() {
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    let d = distanz;
    const setze = dd => kamera.position.set(z.x - Math.sin(yaw) * cp * dd, z.y + sp * dd, z.z - Math.cos(yaw) * cp * dd);
    setze(d);
    if (o.hindernis) {
      const treffer = o.hindernis(z.clone(), kamera.position.clone());
      if (treffer != null && Number.isFinite(treffer) && treffer < d) { d = Math.max(0.4, treffer - 0.2); setze(d); }
    }
    if (o.bodenHoehe) {
      // Lieber näher heranrücken als durch den Hügel schauen
      for (let i = 0; i < 6; i++) {
        if (kamera.position.y >= endlich(o.bodenHoehe(kamera.position.x, kamera.position.z)) + 0.3) break;
        d *= 0.78; setze(d);
      }
      const g = endlich(o.bodenHoehe(kamera.position.x, kamera.position.z)) + 0.3;
      if (kamera.position.y < g) kamera.position.y = g;
    }
  }

  function blickRichten() {
    blick.set(z.x, z.y + 0.15, z.z);
    if (lockW > 0.01) {
      tmp.copy(letzterLock); tmp.y = Math.min(tmp.y, blick.y + 3);
      blick.lerp(tmp, 0.32 * lockW);
    }
    kamera.lookAt(blick);
  }

  function update(dt, ziel, info = {}) {
    dt = clamp(numOr(dt, 0), 0, 0.1);
    const tx = numOr(ziel?.x, z.x), tz = numOr(ziel?.z, z.z), ty = numOr(ziel?.y, z.y - o.hoehe) + o.hoehe;
    const tempo = numOr(info.tempo, 0);
    drehPause += dt;

    lockW = damp(lockW, lock ? 1 : 0, 6, dt);
    if (lock) {
      // Blick von der Figur zum Ziel; manuelles Drehen ist im Lock-On wirkungslos
      letzterLock.set(numOr(lock.x, 0), numOr(lock.y, 0), numOr(lock.z, 0));
      const dx = letzterLock.x - tx, dz = letzterLock.z - tz;
      if (dx * dx + dz * dz > 1e-6) yaw = dampAngle(yaw, Math.atan2(dx, dz), 7, dt);
      const ab = Math.hypot(dx, dz);
      const pw = clamp(0.2 + (letzterLock.y - ty) * 0.04 + (ab < 4 ? (4 - ab) * 0.06 : 0), 0.12, 0.6);
      pitch = damp(pitch, pw, 4, dt);
    } else if (o.autoAusrichten > 0 && drehPause > 1.5 && tempo > 1.5 && info.amBoden !== false && Number.isFinite(info.yaw)) {
      // Langsam hinter die Laufrichtung drehen; fast-rückwärts laufen wird nicht "gejagt"
      const d = angleDiff(yaw, info.yaw);
      if (Math.abs(d) < 2.4) yaw += d * (1 - Math.exp(-o.autoAusrichten * 0.6 * dt)) * Math.min(1, tempo / 5);
    }

    distanz = damp(distanz, zielDistanz, 8, dt);
    if (!initialisiert) { z.set(tx, ty, tz); initialisiert = true; }
    z.x = damp(z.x, tx, o.folgenXZ, dt);
    z.z = damp(z.z, tz, o.folgenXZ, dt);
    // Vertikal träge (Sprünge ruhig), beim Fallen unter das Ziel schneller nachziehen
    z.y = damp(z.y, ty, ty < z.y - 1.2 ? o.folgenY * 2.5 : o.folgenY, dt);

    platzieren();

    if (wackel > 0) {
      wackelT += dt;
      const rest = 1 - wackelT / wackelDauer;
      if (rest <= 0) wackel = 0;
      else {
        const a = wackel * rest * rest, t = wackelT;
        kamera.position.x += (Math.sin(t * 61) + 0.5 * Math.sin(t * 23.7 + 2)) * a * 0.1;
        kamera.position.y += (Math.sin(t * 73 + 1) + 0.5 * Math.sin(t * 31.3)) * a * 0.14;
        kamera.position.z += Math.sin(t * 57 + 4) * a * 0.08;
      }
    }
    blickRichten();
    const zielFov = info.sprintet && tempo > 0.5 ? o.sprintFov : o.fov;
    kamera.fov = damp(kamera.fov, zielFov, 4, dt);
    kamera.updateProjectionMatrix();
  }

  return {
    kamera,
    get yaw() { return yaw; }, set yaw(v) { yaw = numOr(v, yaw); },
    get pitch() { return pitch; }, set pitch(v) { pitch = clamp(numOr(v, pitch), o.minPitch, o.maxPitch); },
    get distanz() { return distanz; },
    set distanz(v) { distanz = zielDistanz = clamp(numOr(v, distanz), o.minDistanz, o.maxDistanz); },
    update,
    /** dx > 0 = Blick nach rechts schwenken, dy > 0 = Kamera höher (schaut mehr nach unten). Radiant. */
    drehen(dx, dy) {
      dx = endlich(dx); dy = endlich(dy);
      if (dx === 0 && dy === 0) return;
      drehPause = 0;
      if (lock) return;
      yaw -= dx;
      pitch = clamp(pitch + dy, o.minPitch, o.maxPitch);
    },
    /** delta > 0 = näher (logarithmisch: Distanz *= e^−delta). */
    zoomen(delta) { zielDistanz = clamp(zielDistanz * Math.exp(-endlich(delta)), o.minDistanz, o.maxDistanz); },
    schuetteln(staerke = 1, dauer = 0.35) {
      if (!(staerke > 0) || !(dauer > 0)) return;
      wackel = Math.max(wackel * (1 - wackelT / (wackelDauer || 1)), staerke); wackelDauer = dauer; wackelT = 0;
    },
    blickYaw: () => yaw,
    richtungAusStick: (x, y) => stickRichtung(endlich(x), endlich(y), yaw),
    springeZu(ziel) {
      z.set(numOr(ziel?.x, 0), numOr(ziel?.y, 0) + o.hoehe, numOr(ziel?.z, 0));
      initialisiert = true; distanz = zielDistanz;
      platzieren(); blickRichten(); kamera.updateProjectionMatrix();
    },
    lockOn(punkt) { lock = punkt || null; },
    dispose() { lock = null; o.bodenHoehe = o.hindernis = null; },
  };
}
