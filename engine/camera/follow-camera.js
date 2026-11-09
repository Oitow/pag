/**
 * @modul    follow-camera
 * @zweck    Third-Person-Orbitkamera: weiches Folgen (vertikal träger), Kollision entlang des Sichtstrahls (Boden + Hindernisse, sanftes Zurückfahren), Auto-Ausrichtung, Sprint-FOV, Zoom, Schütteln, weiches Lock-On mit Zielwechsel, Erste-Person beim Reinzoomen, Presets (nah/weit/Schulter), Kamerafahrten
 * @api      createFollowCamera(opts) -> { kamera, yaw, pitch, distanz, erstePerson, figurAusblenden, preset, lockZiel, inFahrt, update(dt, ziel, info), drehen(dx, dy), zoomen(delta), schuetteln(staerke, dauer), blickYaw(), richtungAusStick(x, y), springeZu(ziel), lockOn(punkt|fn|null), setErstePerson(bool), setPreset(name|obj, {sofort}), fahrt({pos, blick, dauer, halten}) -> Promise, beendeFahrt(), dispose() } ; stickRichtung(x, y, yaw) -> {x, z} ; KAMERA_PRESETS
 * @beispiel
 *   import { createFollowCamera } from '../../engine/camera/follow-camera.js';
 *   const cam = createFollowCamera({ welt, erstePerson: true });   // welt: Adapter mit bodenHoehe (+ hindernisse)
 *   const e = eingabe.lesen(); cam.drehen(e.kameraX, e.kameraY); cam.zoomen(e.zoom);
 *   const r = cam.richtungAusStick(e.x, e.y);       // Kamera-relative Laufrichtung in Weltkoordinaten
 *   cam.update(dt, motor.pos, { tempo: motor.tempo, sprintet: motor.sprintet, yaw: motor.yaw, amBoden: motor.amBoden });
 *   cam.setPreset('schulter'); cam.fahrt({ pos: { x: 5, y: 8, z: 5 }, blick: turm, dauer: 1.5, halten: 2 });
 *   renderer.render(szene, cam.kamera);
 * @tags     kamera, third-person, first-person, orbit, folgen, zoom, figur, lock-on, schuetteln, kollision, kamerafahrt, preset
 * @version  1.1.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { clamp, damp, dampAngle, angleDiff, numOr, smoothstep } from '../core/math.js';

/**
 * Stick (x = rechts, y = vorwärts) → Weltrichtung {x, z} relativ zu einem Blick-Yaw.
 * Yaw-Schema wie Figuren: yaw 0 = Blick +Z, yaw = atan2(x, z); rechts vom Blick ist (−cos yaw, sin yaw).
 */
export function stickRichtung(x, y, yaw) {
  const s = Math.sin(yaw), c = Math.cos(yaw);
  return { x: y * s - x * c, z: y * c + x * s };
}

/** Kamera-Presets: distanz, pitch, hoehe (Blickpunkt über den Füßen), seitlich (Schulter-Versatz nach rechts), fov. */
export const KAMERA_PRESETS = {
  standard: { distanz: 6, pitch: 0.35, hoehe: 1.5, seitlich: 0, fov: 60 },
  nah: { distanz: 3.2, pitch: 0.22, hoehe: 1.45, seitlich: 0, fov: 60 },
  weit: { distanz: 11, pitch: 0.55, hoehe: 1.5, seitlich: 0, fov: 55 },
  schulter: { distanz: 2.4, pitch: 0.1, hoehe: 1.6, seitlich: 0.55, fov: 55 },
};

const endlich = v => (Number.isFinite(v) ? v : 0);
const ease = u => smoothstep(0, 1, u);
const punktVon = p => { const q = typeof p === 'function' ? p() : p; return q && Number.isFinite(+q.x) ? q : null; };

/**
 * opts: distanz, minDistanz, maxDistanz, hoehe, pitch, minPitch, maxPitch, folgenXZ, folgenY, autoAusrichten, fov, sprintFov,
 *   welt (Adapter: bodenHoehe, hindernisse), bodenHoehe(x,z), hindernisse(x,z,r) -> {x,z}|null, hindernis(von, nach) -> Abstand|null,
 *   kameraRadius = 0.25, hindernisHoehe = 4 (Hindernisse gelten so hoch über dem Boden), erstePerson = false (Reinzoomen am
 *   Minimum wechselt in Ego-Sicht), augenHoehe = 1.6 (oder info.augenHoehe), onModus('erste'|'dritte'), kamera
 */
export function createFollowCamera(opts = {}) {
  const o = {
    distanz: 6, minDistanz: 2, maxDistanz: 14, hoehe: 1.5, pitch: 0.35, minPitch: -0.35, maxPitch: 1.25,
    folgenXZ: 12, folgenY: 5, autoAusrichten: 1.0, fov: 60, sprintFov: 68, bodenHoehe: null, hindernis: null, hindernisse: null,
    kameraRadius: 0.25, hindernisHoehe: 4, erstePerson: false, augenHoehe: 1.6, onModus: null,
    ...opts,
  };
  if (o.welt) { o.bodenHoehe ??= o.welt.bodenHoehe; o.hindernisse ??= o.welt.hindernisse; }
  const aspekt = typeof innerWidth === 'number' && innerHeight > 0 ? innerWidth / innerHeight : 1;
  const kamera = o.kamera || new THREE.PerspectiveCamera(o.fov, aspekt, 0.1, 1000);
  kamera.fov = o.fov;

  let yaw = 0;                      // Blickrichtung der Kamera (horizontal)
  let pitch = clamp(o.pitch, o.minPitch, o.maxPitch);   // + = Kamera höher, schaut nach unten
  let distanz = clamp(o.distanz, o.minDistanz, o.maxDistanz);
  let zielDistanz = distanz, kollD = distanz, kollidiert = false;
  let hoehe = o.hoehe, zielHoehe = o.hoehe, seitlich = 0, zielSeitlich = 0, zielPitch = null, presetName = 'standard';
  let drehPause = 99;               // Sekunden seit der Spieler zuletzt gedreht hat
  let initialisiert = false;
  let fp = false, fpW = 0, fpDruck = 0, augen = o.augenHoehe;
  const z = new THREE.Vector3();    // geglätteter Blickpunkt (über den Füßen)
  const roh = new THREE.Vector3();  // ungeglättetes Ziel (Füße)
  const pivot = new THREE.Vector3(), blick = new THREE.Vector3(), tmp = new THREE.Vector3(), aug = new THREE.Vector3();
  let lock = null, lockInit = false, lockW = 0; const letzterLock = new THREE.Vector3();
  let wackel = 0, wackelDauer = 0, wackelT = 0;
  let fahrtZ = null;                // { pos, blick, dauer, halten, t, phase, fertig }

  /** Wie weit darf die Kamera vom Drehpunkt weg, ohne durch Boden/Hindernisse zu schauen? */
  function erlaubteDistanz(dx, dy, dz, d) {
    let erlaubt = d;
    if (o.hindernis) {
      const treffer = o.hindernis(pivot.clone(), tmp.set(pivot.x + dx * d, pivot.y + dy * d, pivot.z + dz * d).clone());
      if (treffer != null && Number.isFinite(treffer) && treffer < erlaubt) erlaubt = Math.max(0.4, treffer - 0.2);
    }
    const boden = o.bodenHoehe, hin = o.hindernisse;
    if (!boden && !hin) return erlaubt;
    const N = 10;
    for (let i = 1; i <= N; i++) {
      const t = (i / N) * erlaubt, x = pivot.x + dx * t, y = pivot.y + dy * t, zz = pivot.z + dz * t;
      const g = boden ? endlich(boden(x, zz)) : -Infinity;
      let block = y < g + 0.3;
      if (!block && hin && y < (boden ? g : pivot.y) + o.hindernisHoehe) {
        const h = hin(x, zz, o.kameraRadius);
        block = !!h && (Math.abs(h.x) + Math.abs(h.z) > 1e-4);
      }
      if (block) return Math.max(0.35, ((i - 1) / N) * erlaubt);
    }
    return erlaubt;
  }

  /** Normale Third-Person-Position + Blickpunkt (inkl. Kollision, Ego-Überblendung). */
  function platzieren(dt) {
    const cp = Math.cos(pitch), sp = Math.sin(pitch), sy = Math.sin(yaw), cy = Math.cos(yaw);
    pivot.set(z.x - cy * seitlich, z.y + (hoehe - o.hoehe), z.z + sy * seitlich);   // rechts = (−cos, sin)
    const dx = -sy * cp, dy = sp, dz = -cy * cp;
    const erlaubt = erlaubteDistanz(dx, dy, dz, distanz);
    // Kollision: sofort heran, danach weich zurück (kein Ruckeln an Baumstämmen)
    if (erlaubt < kollD || !kollidiert) kollD = erlaubt;
    else kollD = Math.min(erlaubt, damp(kollD, erlaubt, 3, dt));
    kollidiert = kollD < distanz - 1e-3;
    const d = Math.min(distanz, kollD);
    kamera.position.set(pivot.x + dx * d, pivot.y + dy * d, pivot.z + dz * d);
    if (o.bodenHoehe) {
      const g = endlich(o.bodenHoehe(kamera.position.x, kamera.position.z)) + 0.3;
      if (kamera.position.y < g) kamera.position.y = g;
    }
    blick.set(pivot.x, pivot.y + 0.15, pivot.z);
    if (seitlich) blick.addScaledVector(tmp.set(sy, 0, cy), 2);        // Schulter: etwas nach vorn schauen
    if (lockW > 0.01) {
      tmp.copy(letzterLock); tmp.y = Math.min(tmp.y, blick.y + 3);
      blick.lerp(tmp, 0.32 * lockW);
    }
    if (fpW > 0.001) {
      // Ego-Sicht: Augen leicht vor dem Kopf, Blick entlang yaw/pitch
      aug.set(roh.x + sy * 0.14, z.y - o.hoehe + augen, roh.z + cy * 0.14);
      const w = ease(fpW);
      kamera.position.lerp(aug, w);
      tmp.set(aug.x + sy * cp * 10, aug.y - sp * 10, aug.z + cy * cp * 10);
      blick.lerp(tmp, w);
    }
  }

  function fahrtAnwenden(dt) {
    const f = fahrtZ;
    f.t += dt;
    let w;
    if (f.phase === 'hin') { w = ease(f.t / f.dauer); if (f.t >= f.dauer) { f.phase = 'halten'; f.t = 0; } }
    else if (f.phase === 'halten') { w = 1; if (f.t >= f.halten) { f.phase = 'zurueck'; f.t = 0; } }
    else { w = 1 - ease(f.t / f.dauer); if (f.t >= f.dauer) { w = 0; fahrtZ = null; f.fertig(); } }
    const p = punktVon(f.pos), b = punktVon(f.blick);
    if (p) kamera.position.lerp(tmp.set(+p.x, numOr(p.y, 0), +p.z), w);
    if (b) blick.lerp(tmp.set(+b.x, numOr(b.y, 0), +b.z), w);
  }

  function setModus(an) {
    an = !!an;
    if (an === fp) return;
    fp = an; fpDruck = 0;
    if (!fp) { pitch = clamp(pitch, o.minPitch, o.maxPitch); zielDistanz = Math.max(zielDistanz, o.minDistanz); }
    o.onModus?.(fp ? 'erste' : 'dritte');
  }

  function update(dt, ziel, info) {
    info = info || {};
    dt = clamp(numOr(dt, 0), 0, 0.1);
    const tx = numOr(ziel?.x, z.x), tz = numOr(ziel?.z, z.z), ty = numOr(ziel?.y, z.y - o.hoehe) + o.hoehe;
    roh.set(tx, ty - o.hoehe, tz);
    const tempo = numOr(info.tempo, 0);
    augen = numOr(info.augenHoehe, o.augenHoehe);
    drehPause += dt;

    lockW = damp(lockW, lock ? 1 : 0, 6, dt);
    if (!lock && lockW < 0.01) lockInit = false;
    const lp = lock ? punktVon(lock) : null;
    if (lp) {
      // Weicher Zielwechsel: Lock-Punkt gleitet zum neuen Ziel; manuelles Drehen ist im Lock-On wirkungslos
      tmp.set(+lp.x, numOr(lp.y, 0), +lp.z);
      if (!lockInit) { letzterLock.copy(tmp); lockInit = true; } else letzterLock.lerp(tmp, 1 - Math.exp(-8 * dt));
      const dx = letzterLock.x - tx, dz = letzterLock.z - tz;
      if (dx * dx + dz * dz > 1e-6) yaw = dampAngle(yaw, Math.atan2(dx, dz), 7, dt);
      if (!fp) {
        const ab = Math.hypot(dx, dz);
        const pw = clamp(0.2 + (letzterLock.y - ty) * 0.04 + (ab < 4 ? (4 - ab) * 0.06 : 0), 0.12, 0.6);
        pitch = damp(pitch, pw, 4, dt);
      }
    } else if (!fp && o.autoAusrichten > 0 && drehPause > 1.5 && tempo > 1.5 && info.amBoden !== false && Number.isFinite(info.yaw)) {
      // Langsam hinter die Laufrichtung drehen; fast-rückwärts laufen wird nicht "gejagt"
      const d = angleDiff(yaw, info.yaw);
      if (Math.abs(d) < 2.4) yaw += d * (1 - Math.exp(-o.autoAusrichten * 0.6 * dt)) * Math.min(1, tempo / 5);
    }
    if (zielPitch != null && !lock && !fp) pitch = damp(pitch, zielPitch, 4, dt);

    distanz = damp(distanz, zielDistanz, 8, dt);
    hoehe = damp(hoehe, zielHoehe, 6, dt);
    seitlich = damp(seitlich, zielSeitlich, 6, dt);
    fpW = damp(fpW, fp ? 1 : 0, 9, dt);
    if (!initialisiert) { z.set(tx, ty, tz); initialisiert = true; }
    z.x = damp(z.x, tx, o.folgenXZ, dt);
    z.z = damp(z.z, tz, o.folgenXZ, dt);
    // Vertikal träge (Sprünge ruhig), beim Fallen unter das Ziel schneller nachziehen; Ego-Sicht folgt straffer
    z.y = damp(z.y, ty, fp ? 14 : ty < z.y - 1.2 ? o.folgenY * 2.5 : o.folgenY, dt);

    platzieren(dt);
    if (fahrtZ) fahrtAnwenden(dt);

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
    kamera.lookAt(blick);
    const zielFov = info.sprintet && tempo > 0.5 ? o.sprintFov : o.fov;
    kamera.fov = damp(kamera.fov, zielFov, 4, dt);
    kamera.updateProjectionMatrix();
  }

  return {
    kamera,
    get yaw() { return yaw; }, set yaw(v) { yaw = numOr(v, yaw); },
    get pitch() { return pitch; }, set pitch(v) { pitch = clamp(numOr(v, pitch), o.minPitch, o.maxPitch); zielPitch = null; },
    get distanz() { return distanz; },
    set distanz(v) { distanz = zielDistanz = kollD = clamp(numOr(v, distanz), o.minDistanz, o.maxDistanz); },
    /** true = Ego-Sicht (auch während der Überblendung). */
    get erstePerson() { return fp; },
    /** true, wenn die Kamera im Kopf/zu nah steckt → Spiel blendet die eigene Figur aus. */
    get figurAusblenden() { return fpW > 0.5 || (!fahrtZ && Math.min(distanz, kollD) < 0.7); },
    get preset() { return presetName; },
    get lockZiel() { return lock; },
    get inFahrt() { return !!fahrtZ; },
    update,
    /** dx > 0 = Blick nach rechts schwenken, dy > 0 = Kamera höher (schaut mehr nach unten). Radiant. */
    drehen(dx, dy) {
      dx = endlich(dx); dy = endlich(dy);
      if (dx === 0 && dy === 0) return;
      drehPause = 0; zielPitch = null;
      if (lock) return;
      yaw -= dx;
      pitch = fp ? clamp(pitch + dy, -1.3, 1.3) : clamp(pitch + dy, o.minPitch, o.maxPitch);
    },
    /** delta > 0 = näher (logarithmisch: Distanz *= e^−delta). Mit erstePerson: am Minimum weiter rein = Ego-Sicht. */
    zoomen(delta) {
      delta = endlich(delta);
      if (o.erstePerson && delta) {
        if (fp) { if (delta < 0) setModus(false); return; }
        if (delta > 0 && zielDistanz <= o.minDistanz + 1e-6) { fpDruck += delta; if (fpDruck > 0.3) setModus(true); return; }
        if (delta < 0) fpDruck = 0;
      }
      zielDistanz = clamp(zielDistanz * Math.exp(-delta), o.minDistanz, o.maxDistanz);
    },
    setErstePerson: setModus,
    /** Preset ('standard'|'nah'|'weit'|'schulter' oder eigenes Objekt) weich anfahren; {sofort: true} springt. */
    setPreset(p, { sofort = false } = {}) {
      const name = typeof p === 'string' ? p : 'eigen';
      const v = { ...KAMERA_PRESETS.standard, ...(typeof p === 'string' ? KAMERA_PRESETS[p] : p) };
      if (typeof p === 'string' && !KAMERA_PRESETS[p]) return false;
      presetName = name; setModus(false);
      zielDistanz = clamp(numOr(v.distanz, 6), o.minDistanz, o.maxDistanz);
      zielPitch = clamp(numOr(v.pitch, 0.35), o.minPitch, o.maxPitch);
      zielHoehe = numOr(v.hoehe, o.hoehe); zielSeitlich = numOr(v.seitlich, 0);
      if (Number.isFinite(v.fov)) o.fov = v.fov;
      if (sofort) { distanz = kollD = zielDistanz; pitch = zielPitch; hoehe = zielHoehe; seitlich = zielSeitlich; kamera.fov = o.fov; }
      return true;
    },
    schuetteln(staerke = 1, dauer = 0.35) {
      if (!(staerke > 0) || !(dauer > 0)) return;
      wackel = Math.max(wackel * (1 - wackelT / (wackelDauer || 1)), staerke); wackelDauer = dauer; wackelT = 0;
    },
    blickYaw: () => yaw,
    richtungAusStick: (x, y) => stickRichtung(endlich(x), endlich(y), yaw),
    springeZu(ziel) {
      z.set(numOr(ziel?.x, 0), numOr(ziel?.y, 0) + o.hoehe, numOr(ziel?.z, 0));
      roh.set(z.x, z.y - o.hoehe, z.z);
      initialisiert = true; distanz = kollD = zielDistanz; kollidiert = false; hoehe = zielHoehe; seitlich = zielSeitlich;
      fpW = fp ? 1 : 0;
      platzieren(0); kamera.lookAt(blick); kamera.updateProjectionMatrix();
    },
    /** punkt: {x,y,z} (wird jedes Bild neu gelesen), Funktion () => {x,y,z} oder null. Wechsel gleitet weich. */
    lockOn(punkt) { lock = punkt || null; },
    /** Kamerafahrt: hin (dauer s), halten (s, Infinity = bis beendeFahrt), zurück (dauer s). pos/blick: {x,y,z} oder Funktion. */
    fahrt({ pos = null, blick: b = null, dauer = 1.2, halten = 2 } = {}) {
      if (fahrtZ) fahrtZ.fertig();
      let fertig = () => {};
      const p = typeof Promise === 'function' ? new Promise(r => { fertig = r; }) : null;
      fahrtZ = { pos, blick: b, dauer: Math.max(0.05, numOr(dauer, 1.2)), halten: Math.max(0, +halten || 0), t: 0, phase: 'hin', fertig };
      return p;
    },
    beendeFahrt({ sofort = false } = {}) {
      const f = fahrtZ;
      if (!f) return;
      if (sofort) { fahrtZ = null; f.fertig(); return; }
      if (f.phase === 'zurueck') return;
      // aus der aktuellen Mischung zurück, ohne Sprung
      const w = f.phase === 'hin' ? ease(f.t / f.dauer) : 1;
      let u = 0.5; for (let i = 0; i < 20; i++) u += (ease(u) - (1 - w) > 0 ? -1 : 1) * 0.5 ** (i + 2);
      f.phase = 'zurueck'; f.t = u * f.dauer;
    },
    dispose() {
      lock = null; o.bodenHoehe = o.hindernis = o.hindernisse = null; o.onModus = null;
      if (fahrtZ) { const f = fahrtZ; fahrtZ = null; f.fertig(); }
    },
  };
}
