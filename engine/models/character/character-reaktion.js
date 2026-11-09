/**
 * @modul    character-reaktion
 * @zweck    Prozedurale Treffer-Reaktion (rein): Stoß aus Richtung + Stärke als abklingende additive Pose; Umfallen als Ragdoll-Ersatz ohne Physik-Engine (Kippen, Aufprall, schlaffe Glieder)
 * @api      createReaktion({seed,staerke}) -> { treffer(richtung,staerke), umfallen(richtung,{staerke}), aufstehen(dauer), update(dt) -> pose(additiv), anwenden(pose,gewicht), fallPose(out,skal) -> pose, pose, faellt, liegt, fallGewicht, aktiv, reset(), dispose() } ; richtungLokal(welt,yaw) -> {x,z}
 * @beispiel
 *   import { createReaktion } from '../../engine/models/character/character-reaktion.js';
 *   const re = createReaktion({ seed: 4 });
 *   re.treffer({ x: 0, z: -1 }, 0.8);         // Stoß von vorn: Figur wird nach hinten (−Z) gedrückt
 *   addierePose(pose, re.update(dt), 1, pose);
 *   re.umfallen({ x: 0, z: -1 });              // nach hinten umkippen; mischePose(pose, re.fallPose(), re.fallGewicht, pose)
 * @tags     figur, charakter, animation, treffer, reaktion, tod, ragdoll, umfallen, kampf
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { clamp, lerp, smoothstep, numOr } from '../../core/math.js';
import { rng, range, hashSeed } from '../../core/rng.js';
import { leerePose } from './character-pose.js';
import { createFeder } from './character-sekundaer.js';

const LIEGT = 1.5;               // rad: Körper flach auf dem Boden (Drehpunkt an den Füßen)

/** Weltrichtung {x,z} → Figur-Raum (Figur mit yaw; +Z = vorn, +X = links). */
export function richtungLokal(w, yaw = 0) {
  const c = Math.cos(yaw), s = Math.sin(yaw), x = numOr(w?.x, 0), z = numOr(w?.z, 0);
  return { x: x * c - z * s, z: x * s + z * c };
}
function norm(r) {
  const x = numOr(r?.x, 0), z = numOr(r?.z, 0), l = Math.hypot(x, z);
  return l > 1e-6 ? { x: x / l, z: z / l } : { x: 0, z: -1 };
}

/** opts = { seed, staerke = 1 (Ausschlag der Treffer) }. richtung = Stoßrichtung im Figur-Raum (wohin der Körper gedrückt wird). */
export function createReaktion(opts = {}) {
  const o = { staerke: 1, ...opts };
  const r = rng(o.seed ?? hashSeed('reaktion'));
  const F = {
    vor: createFeder({ steif: 120, daempf: 11 }), seit: createFeder({ steif: 120, daempf: 11 }),
    kopfV: createFeder({ steif: 160, daempf: 10 }), kopfS: createFeder({ steif: 160, daempf: 10 }),
    dreh: createFeder({ steif: 100, daempf: 10 }), stauch: createFeder({ steif: 140, daempf: 14 }),
    arme: createFeder({ steif: 90, daempf: 9 }),
  };
  const add = leerePose();
  const fall = { aktiv: false, t: 0, th: 0, om: 0, dx: 0, dz: -1, w: 0, wZiel: 0, wTempo: 6, liegt: false, aufprall: 0,
    armL: createFeder({ steif: 30, daempf: 6 }), armR: createFeder({ steif: 30, daempf: 6 }), hals: createFeder({ steif: 60, daempf: 6 }),
    var: { lz: 1, rz: 1, lx: 0, rx: 0, knie: 0, twist: 0, kopf: 0 } };
  const fp = leerePose();

  function treffer(richtung, staerke = 1) {
    const d = norm(richtung), s = clamp(numOr(staerke, 1), 0, 3) * o.staerke;
    F.vor.stoss(d.z * 9 * s); F.seit.stoss(-d.x * 9 * s);
    F.kopfV.stoss(d.z * 14 * s); F.kopfS.stoss(-d.x * 14 * s);
    F.dreh.stoss(range(r, -4, 4) * s); F.stauch.stoss(2.5 * s); F.arme.stoss(10 * s);
  }

  function umfallen(richtung, { staerke = 1 } = {}) {
    const d = norm(richtung), s = clamp(numOr(staerke, 1), 0.2, 3);
    Object.assign(fall, { aktiv: true, t: 0, th: 0.04, om: 0.6 + 0.8 * s, dx: d.x, dz: d.z, wZiel: 1, wTempo: 10, liegt: false, aufprall: 0 });
    fall.var = { lz: range(r, 0.6, 1.4), rz: range(r, 0.6, 1.4), lx: range(r, -0.6, 0.3), rx: range(r, -0.6, 0.3),
      knie: range(r, 0.1, 0.6), twist: range(r, -0.3, 0.3), kopf: range(r, -0.5, 0.5) };
    fall.armL.setze(0); fall.armR.setze(0); fall.hals.setze(0);
    treffer(d, 0.6 * s);
  }

  function aufstehen(dauer = 0.8) {
    if (!fall.aktiv) return;
    fall.wZiel = 0; fall.wTempo = 4 / Math.max(0.1, numOr(dauer, 0.8));
  }

  function updateFall(dt) {
    if (!fall.aktiv) return;
    fall.t += dt;
    fall.w += clamp(fall.wZiel - fall.w, -fall.wTempo * dt, fall.wTempo * dt);
    if (fall.wZiel === 0 && fall.w <= 0) { fall.aktiv = false; fall.liegt = false; fall.th = 0; return; }
    if (!fall.liegt) {
      fall.om += 11 * Math.sin(fall.th) * dt;                   // umgekehrtes Pendel (g/L ≈ 11)
      fall.th += fall.om * dt;
      if (fall.th >= LIEGT) {
        fall.th = LIEGT;
        fall.aufprall = Math.max(fall.aufprall, clamp(fall.om / 6, 0, 1));
        if (fall.om > 1.2) { fall.om = -fall.om * 0.25; fall.armL.stoss(-6); fall.armR.stoss(-6); fall.hals.stoss(8); }
        else { fall.om = 0; fall.liegt = true; }
      }
      fall.th = Math.max(0, fall.th);
    }
    const u = fall.th / LIEGT;
    fall.armL.schritt(dt, u); fall.armR.schritt(dt, u * 0.9); fall.hals.schritt(dt, u);
  }

  /** Ganzkörper-Pose des Falls (absolut). skal = Hüfthöhe/0.89 für basisPos. */
  function fallPose(out = fp, skal = 1) {
    for (const k of Object.keys(out)) { out[k].x = 0; out[k].y = 0; out[k].z = 0; }
    const th = fall.th, u = clamp(th / LIEGT, 0, 1), v = fall.var;
    const knick = Math.sin(Math.PI * Math.min(1, u * 1.2)) * (0.5 + v.knie);   // Knie geben beim Kippen nach
    const vor = fall.dz >= 0 ? 1 : -1;                                          // nach vorn oder hinten
    out.basis.x = th * fall.dz; out.basis.z = -th * fall.dx; out.basis.y = v.twist * u;
    out.basisPos.y = (-0.22 * knick + 0.13 * smoothstep(0.7, 1, u)) * skal;
    out.basisPos.z = -0.05 * vor * u * skal;
    out.huefteL.x = -0.6 * knick * (vor > 0 ? 1 : 0.6); out.huefteR.x = -0.5 * knick;
    out.knieL.x = 1.1 * knick + 0.15 * u; out.knieR.x = 0.9 * knick + v.knie * 0.5 * u;
    out.fussL.x = 0.45 * u; out.fussR.x = 0.4 * u;
    out.torso.x = 0.15 * vor * knick - 0.05 * u; out.torso.z = 0.1 * v.twist;
    const a = fall.armL.wert, b = fall.armR.wert;                                // Arme: erst abfangen, dann schlaff
    const fang = vor > 0 ? -1.4 : -0.6;
    out.schulterL.x = lerp(fang * (1 - u) * 1.2, v.lx, clamp(a, -0.5, 1.5)); out.schulterL.z = 0.3 + v.lz * clamp(a, -0.3, 1.4);
    out.schulterR.x = lerp(fang * (1 - u) * 1.2, v.rx, clamp(b, -0.5, 1.5)); out.schulterR.z = -0.3 - v.rz * clamp(b, -0.3, 1.4);
    out.ellbogenL.x = -0.3 - 0.5 * (1 - u); out.ellbogenR.x = -0.4 - 0.4 * (1 - u);
    const h = fall.hals.wert;
    out.hals.x = (vor > 0 ? -0.35 : 0.3) * clamp(h, -0.5, 1.5); out.kopf.y = v.kopf * u; out.kopf.x = 0.1 * u;
    return out;
  }

  function update(dt) {
    dt = clamp(numOr(dt, 0), 0, 0.1);
    for (const f of Object.values(F)) f.schritt(dt, 0);
    updateFall(dt);
    for (const k of Object.keys(add)) { add[k].x = 0; add[k].y = 0; add[k].z = 0; }
    const vor = clamp(F.vor.wert, -0.8, 0.8), seit = clamp(F.seit.wert, -0.6, 0.6), st = clamp(F.stauch.wert, -0.3, 0.4);
    const kv = clamp(F.kopfV.wert, -0.8, 0.8), ks = clamp(F.kopfS.wert, -0.6, 0.6), ar = clamp(F.arme.wert, -0.5, 1);
    add.torso.x = vor; add.torso.z = seit; add.torso.y = clamp(F.dreh.wert, -0.5, 0.5);
    add.becken.x = vor * 0.2;
    add.hals.x = kv * 0.5 - vor * 0.3; add.kopf.x = kv * 0.5; add.hals.z = ks * 0.5 - seit * 0.3; add.kopf.z = ks * 0.4;
    add.schulterL.z = ar * 0.6 + Math.max(0, -seit) * 0.5; add.schulterR.z = -ar * 0.6 - Math.max(0, seit) * 0.5;
    add.schulterL.x = -vor * 0.8 * Math.sign(vor) * ar; add.schulterR.x = add.schulterL.x;
    add.ellbogenL.x = -ar * 0.5; add.ellbogenR.x = -ar * 0.5;
    add.basisPos.y = -Math.max(0, st) * 0.12;
    return add;
  }

  const api = {
    treffer, umfallen, aufstehen, update, fallPose,
    /** Additive Treffer-Schicht auf pose (an Ort und Stelle). */
    anwenden(pose, gewicht = 1) {
      const w = clamp(numOr(gewicht, 1), 0, 1);
      for (const k of Object.keys(add)) {
        const p = pose[k];
        if (!p) continue;
        p.x += add[k].x * w; p.y += add[k].y * w; p.z += add[k].z * w;
      }
      return pose;
    },
    reset() {
      for (const f of Object.values(F)) f.setze(0);
      fall.aktiv = false; fall.liegt = false; fall.w = 0; fall.wZiel = 0; fall.th = 0; fall.om = 0;
    },
    dispose() { api.reset(); },
  };
  Object.defineProperties(api, {
    pose: { get: () => add, enumerable: true },
    faellt: { get: () => fall.aktiv, enumerable: true },
    liegt: { get: () => fall.aktiv && fall.liegt, enumerable: true },
    fallGewicht: { get: () => (fall.aktiv ? smoothstep(0, 1, fall.w) : 0), enumerable: true },
    aufprall: { get: () => fall.aufprall, enumerable: true },
    /** true, solange Treffer-Federn noch merklich schwingen. */
    aktiv: { get: () => Object.values(F).some((f) => Math.abs(f.wert) > 1e-3 || Math.abs(f.v) > 1e-2), enumerable: true },
  });
  return api;
}
