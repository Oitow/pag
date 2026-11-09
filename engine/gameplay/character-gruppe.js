/**
 * @modul    character-gruppe
 * @zweck    Schwarm-/Herdenverhalten für NPCs (Boids in x/z): Separation, Kohäsion, Ausrichtung – liefert eine Zusatzkraft für die Absicht
 * @api      createGruppe({sichtRadius,trennRadius,separation,kohaesion,ausrichtung,maxKraft}) -> {kraft(selbst,nachbarn,out?)->{x,z},setGewichte(teil),gewichte,dispose()} ; schwarmKraft(selbst,nachbarn,opts,out?) -> {x,z} ; GRUPPE_STANDARD
 * @beispiel
 *   import { createGruppe } from '../../engine/gameplay/character-gruppe.js';
 *   const herde = createGruppe({ kohaesion: 1 });
 *   const k = herde.kraft({ x, z, vx, vz }, nachbarn); // nachbarn: [{ x, z, vx?, vz?, radius? }]
 *   absicht.x += k.x; absicht.z += k.z;
 * @tags     npc, ki, schwarm, herde, boids, steering, gameplay
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { numOr } from '../core/math.js';

export const GRUPPE_STANDARD = {
  sichtRadius: 5,    // m, Nachbarn darin zählen für Kohäsion/Ausrichtung
  trennRadius: 1.2,  // m (+ Radien), darin wird weggedrückt
  separation: 1.5,   // Gewicht
  kohaesion: 0.5,    // Gewicht, zur Gruppenmitte
  ausrichtung: 0.7,  // Gewicht, gleiche Laufrichtung wie die Nachbarn
  maxKraft: 1,       // Länge der Ergebniskraft höchstens
};

/** Reine Funktion: Boids-Kraft für `selbst` ({x,z,vx?,vz?,radius?}) aus `nachbarn`. */
export function schwarmKraft(selbst, nachbarn, opts = GRUPPE_STANDARD, out = { x: 0, z: 0 }) {
  out.x = 0; out.z = 0;
  if (!selbst || !nachbarn || !nachbarn.length) return out;
  const o = opts, rs = numOr(selbst.radius, 0.3);
  let sx = 0, sz = 0, mx = 0, mz = 0, ax = 0, az = 0, anzahl = 0, anzahlA = 0;
  for (let i = 0; i < nachbarn.length; i++) {
    const nb = nachbarn[i];
    const nx = numOr(nb?.x, NaN), nz = numOr(nb?.z, NaN);
    if (!Number.isFinite(nx + nz)) continue;
    const dx = selbst.x - nx, dz = selbst.z - nz, d = Math.hypot(dx, dz);
    if (d < 1e-6 || d > o.sichtRadius) continue; // man selbst / zu weit
    anzahl++; mx += nx; mz += nz;
    const trenn = o.trennRadius + rs + numOr(nb.radius, 0.3);
    if (d < trenn) { const k = (trenn - d) / trenn; sx += dx / d * k; sz += dz / d * k; }
    const vx = numOr(nb.vx, 0), vz = numOr(nb.vz, 0), vl = Math.hypot(vx, vz);
    if (vl > 0.05) { ax += vx / vl; az += vz / vl; anzahlA++; }
  }
  if (!anzahl) return out;
  out.x += sx * o.separation; out.z += sz * o.separation;
  mx = mx / anzahl - selbst.x; mz = mz / anzahl - selbst.z;
  const ml = Math.hypot(mx, mz);
  if (ml > 1e-6) { const k = Math.min(1, ml / o.sichtRadius); out.x += mx / ml * k * o.kohaesion; out.z += mz / ml * k * o.kohaesion; }
  if (anzahlA) {
    ax /= anzahlA; az /= anzahlA;
    const vx = numOr(selbst.vx, 0), vz = numOr(selbst.vz, 0), vl = Math.hypot(vx, vz);
    // Ausrichtung = Differenz zur eigenen Richtung (steht man, wird voll mitgezogen)
    const ex = vl > 0.05 ? vx / vl : 0, ez = vl > 0.05 ? vz / vl : 0;
    out.x += (ax - ex) * 0.5 * o.ausrichtung; out.z += (az - ez) * 0.5 * o.ausrichtung;
  }
  const l = Math.hypot(out.x, out.z);
  if (l > o.maxKraft) { out.x *= o.maxKraft / l; out.z *= o.maxKraft / l; }
  return out;
}

export function createGruppe(opts = {}) {
  const g = Object.assign({}, GRUPPE_STANDARD);
  for (const k of Object.keys(GRUPPE_STANDARD)) if (opts[k] !== undefined) g[k] = Math.max(0, numOr(opts[k], g[k]));
  const scratch = { x: 0, z: 0 };
  return {
    gewichte: g,
    kraft(selbst, nachbarn, out = scratch) { return schwarmKraft(selbst, nachbarn, g, out); },
    setGewichte(teil = {}) { for (const k of Object.keys(GRUPPE_STANDARD)) if (teil[k] !== undefined) g[k] = Math.max(0, numOr(teil[k], g[k])); },
    dispose() {},
  };
}
