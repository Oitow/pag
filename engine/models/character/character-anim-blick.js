/**
 * @modul    character-anim-blick
 * @zweck    Blick einer Figur (rein): Richtung oder Weltpunkt → verteilt auf Torso/Hals/Kopf mit Grenzen, Augen eilen voraus; Blinzeln per Seed; Werte für einen Mimik-Hook
 * @api      createBlick({seed,augenGrenze,kopfGrenze}) -> { zu(dirLokal|null), zuPunkt(welt|null), update(dt,{idleW,umsehYaw,umsehNick,zustand,augenHoehe}) , anwenden(pose,gewicht), yaw, nick, augenYaw, augenNick, lid, blinzeln(), dispose() }
 * @beispiel
 *   import { createBlick } from '../../engine/models/character/character-anim-blick.js';
 *   const blick = createBlick({ seed: 3 });
 *   blick.zuPunkt({ x: 4, y: 1.6, z: 2 });                         // Weltpunkt (braucht zustand.pos/yaw im update)
 *   blick.update(dt, { zustand: motor.zustand, augenHoehe: 1.6 }); blick.anwenden(pose);
 * @tags     figur, charakter, animation, blick, kopf, augen, blinzeln, mimik
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { clamp, damp, numOr } from '../../core/math.js';
import { rng, range, hashSeed } from '../../core/rng.js';

/** opts = { seed, kopfGrenze = 1.3 (rad Körper-Drehung gesamt), augenGrenze = 0.4, blinzeln = true }. */
export function createBlick(opts = {}) {
  const o = { kopfGrenze: 1.3, nickGrenze: 0.6, augenGrenze: 0.4, blinzeln: true, ...opts };
  const r = rng(o.seed ?? hashSeed('blick'));
  let richtung = null, punkt = null;
  const st = { yaw: 0, nick: 0, augenYaw: 0, augenNick: 0, lid: 0, blinzelUhr: range(r, 1.5, 5), blinzelT: -1, geblinzelt: false };

  function zielWinkel(z, augenHoehe) {
    let d = richtung;
    if (punkt && z?.pos) {
      const yaw = numOr(z.yaw, 0), c = Math.cos(yaw), s = Math.sin(yaw);
      const wx = numOr(punkt.x, 0) - numOr(z.pos.x, 0), wz = numOr(punkt.z, 0) - numOr(z.pos.z, 0);
      d = { x: wx * c - wz * s, y: numOr(punkt.y, 0) - numOr(z.pos.y, 0) - augenHoehe, z: wx * s + wz * c };
    }
    if (!d) return null;
    const h = Math.hypot(d.x, d.z);
    if (h < 1e-6 && Math.abs(d.y) < 1e-6) return null;
    return { yaw: Math.atan2(d.x, d.z), nick: -Math.atan2(d.y || 0, Math.max(h, 1e-6)) };
  }

  function update(dt, info = {}) {
    dt = clamp(numOr(dt, 0), 0, 0.1);
    const idleW = clamp(numOr(info.idleW, 0), 0, 1);
    const w = zielWinkel(info.zustand, numOr(info.augenHoehe, 1.6));
    let gy = numOr(info.umsehYaw, 0) * idleW, gn = numOr(info.umsehNick, 0) * idleW;
    if (w) {
      // Ziel weit hinten: nicht über die Schulter verdrehen, sondern zur näheren Seite bis zur Grenze
      gy = clamp(w.yaw, -o.kopfGrenze - o.augenGrenze, o.kopfGrenze + o.augenGrenze);
      gn = clamp(w.nick, -o.nickGrenze - 0.3, o.nickGrenze + 0.3);
    }
    const kopfY = clamp(gy, -o.kopfGrenze, o.kopfGrenze), kopfN = clamp(gn, -o.nickGrenze, o.nickGrenze);
    st.yaw = damp(st.yaw, kopfY, w ? 6 : 3, dt);
    st.nick = damp(st.nick, kopfN, w ? 6 : 3, dt);
    // Augen eilen voraus (schnell) und decken den Rest jenseits der Kopf-Grenze ab
    st.augenYaw = damp(st.augenYaw, clamp(gy - st.yaw, -o.augenGrenze, o.augenGrenze), 25, dt);
    st.augenNick = damp(st.augenNick, clamp(gn - st.nick, -o.augenGrenze * 0.75, o.augenGrenze * 0.75), 25, dt);
    // Blinzeln: zufällig (Seed) + bei großen Blicksprüngen
    st.geblinzelt = false;
    if (o.blinzeln) {
      st.blinzelUhr -= dt;
      if (st.blinzelUhr <= 0 || (w && Math.abs(gy - st.yaw) > 0.9 && st.blinzelT < 0 && r() < dt * 4)) blinzeln();
      if (st.blinzelT >= 0) {
        st.blinzelT += dt;
        const u = st.blinzelT / 0.16;
        st.lid = u < 0.4 ? u / 0.4 : Math.max(0, 1 - (u - 0.4) / 0.6);
        if (u >= 1) { st.blinzelT = -1; st.lid = 0; }
      }
    }
    return st;
  }

  function blinzeln() {
    st.blinzelT = 0; st.geblinzelt = true;
    st.blinzelUhr = r() < 0.15 ? range(r, 0.25, 0.4) : range(r, 2, 6);   // ab und zu doppelt
  }

  /** Dreht Torso/Hals/Kopf der Pose (additiv); gewicht 0…1 (z. B. bei Ganzkörper-Aktionen gedämpft). */
  function anwenden(pose, gewicht = 1) {
    const g = clamp(numOr(gewicht, 1), 0, 1);
    pose.torso.y += st.yaw * 0.12 * g; pose.hals.y += st.yaw * 0.38 * g; pose.kopf.y += st.yaw * 0.5 * g;
    pose.torso.x += st.nick * 0.05 * g; pose.hals.x += st.nick * 0.4 * g; pose.kopf.x += st.nick * 0.55 * g;
    return pose;
  }

  const api = {
    update, anwenden, blinzeln,
    zu(dir) { punkt = null; richtung = dir ? { x: numOr(dir.x, 0), y: numOr(dir.y, 0), z: numOr(dir.z, 1) } : null; },
    zuPunkt(p) { richtung = null; punkt = p ? { x: numOr(p.x, 0), y: numOr(p.y, 0), z: numOr(p.z, 0) } : null; },
    dispose() { richtung = null; punkt = null; },
  };
  for (const k of ['yaw', 'nick', 'augenYaw', 'augenNick', 'lid', 'geblinzelt']) Object.defineProperty(api, k, { get: () => st[k], enumerable: true });
  Object.defineProperty(api, 'hatZiel', { get: () => !!(richtung || punkt), enumerable: true });
  return api;
}
