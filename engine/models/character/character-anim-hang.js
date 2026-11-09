/**
 * @modul    character-anim-hang
 * @zweck    Hang-Anpassung (rein): Steigung im Figur-Raum aus Motor-Zustand/Normale/bodenHoehe messen und Fußziele, Hüfthöhe, Fußneigung und Rumpf-Vorlage daran anpassen
 * @api      hangMessen(zustand,bodenHoehe?,out?) -> {vor,seit} ; hangAnpassen(masse,ziele,vor,seit,gewicht) -> {lehne}
 * @beispiel
 *   import { hangMessen, hangAnpassen } from '../../engine/models/character/character-anim-hang.js';
 *   const h = hangMessen(motor.zustand, welt.bodenHoehe);       // Steigung vorwärts/seitwärts (dh/ds)
 *   fussZiele(masse, g, ziele); const { lehne } = hangAnpassen(masse, ziele, h.vor, h.seit, 1);
 * @tags     figur, charakter, animation, hang, gelaende, ik, fuesse
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { clamp, numOr } from '../../core/math.js';

const MAX = 1.2;   // |Steigung| höchstens ≈ 50°

/**
 * Steigung im Figur-Raum: vor = dh/dz (vorn = +Z, + = bergauf), seit = dh/dx (+X = links). Quellen (in dieser Reihenfolge):
 *   zustand.hangVor/hangSeite (Zahlen) · zustand.bodenNormal {x,y,z} (Welt) + zustand.yaw · bodenHoehe(x,z) um zustand.pos.
 */
export function hangMessen(z = {}, bodenHoehe = null, out = { vor: 0, seit: 0 }) {
  out.vor = 0; out.seit = 0;
  if (Number.isFinite(z.hangVor) || Number.isFinite(z.hangSeite)) {
    out.vor = numOr(z.hangVor, 0); out.seit = numOr(z.hangSeite, 0);
  } else {
    const yaw = numOr(z.yaw, 0), fx = Math.sin(yaw), fz = Math.cos(yaw), lx = Math.cos(yaw), lz = -Math.sin(yaw);
    const n = z.bodenNormal;
    if (n && Number.isFinite(n.y) && n.y > 0.2) {
      out.vor = -(n.x * fx + n.z * fz) / n.y;
      out.seit = -(n.x * lx + n.z * lz) / n.y;
    } else if (typeof bodenHoehe === 'function' && z.pos) {
      const px = numOr(z.pos.x, 0), pz = numOr(z.pos.z, 0), d = 0.3;
      const h = (x, zz) => numOr(bodenHoehe(x, zz), 0);
      out.vor = (h(px + fx * d, pz + fz * d) - h(px - fx * d, pz - fz * d)) / (2 * d);
      out.seit = (h(px + lx * d, pz + lz * d) - h(px - lx * d, pz - lz * d)) / (2 * d);
    }
  }
  out.vor = clamp(numOr(out.vor, 0), -MAX, MAX);
  out.seit = clamp(numOr(out.seit, 0), -MAX, MAX);
  return out;
}

/**
 * Passt ziele (aus character-gang fussZiele) an den Hang an: jeder Fuß folgt der Bodenebene durch den Ursprung,
 * Fuß kippt mit (neig/roll), die Hüfte sinkt um den tiefsten Fuß. → { lehne } = empfohlene Rumpf-Vorlage (rad, bergauf +).
 */
export function hangAnpassen(m, z, vor = 0, seit = 0, gewicht = 1) {
  const w = clamp(numOr(gewicht, 0), 0, 1);
  if (w <= 1e-4 || (!vor && !seit)) {
    if (z.L) z.L.roll = 0;
    if (z.R) z.R.roll = 0;
    return { lehne: 0 };
  }
  let tief = 0;
  for (const s of ['L', 'R']) {
    const f = z[s];
    if (!f) continue;
    const off = (f.z * vor + f.x * seit) * w;
    f.y += off;
    f.neig = (f.neig || 0) + Math.atan(vor) * w * (f.stand ? 1 : 0.5);
    f.roll = Math.atan(seit) * w * (f.stand ? 1 : 0.5);
    if (off < tief) tief = off;
  }
  z.basisY = (z.basisY || 0) + tief - 0.03 * Math.min(1, Math.abs(vor) + Math.abs(seit)) * w * (m.hoehe / 1.75);
  return { lehne: clamp(Math.atan(vor) * 0.35 * w, -0.25, 0.3) };
}
