/**
 * @modul    math
 * @zweck    Kleine Mathe-Helfer: clamp, lerp, smoothstep, framerate-unabhängiges Dämpfen, Winkel
 * @api      clamp(v,a,b) ; lerp(a,b,t) ; invLerp(a,b,v) ; remap(v,a,b,c,d) ; smoothstep(a,b,x) ; damp(a,b,lambda,dt) ; angleDiff(a,b) ; dampAngle(a,b,lambda,dt) ; numOr(v,ersatz)
 * @beispiel
 *   import { damp, clamp } from '../../engine/core/math.js';
 *   kamera.x = damp(kamera.x, ziel.x, 6, dt);
 *   zoom = clamp(zoom, 5, 80);
 * @tags     mathe, interpolation, kamera
 * @version  1.0.0
 * @status   stabil
 * @three    nein
 */

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const remap = (v, a, b, c, d) => lerp(c, d, invLerp(a, b, v));

export function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Dämpft a Richtung b, unabhängig von der Bildrate (lambda ≈ Geschwindigkeit). */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

/** Kürzeste Winkeldifferenz b−a in (−π, π]. */
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
export const dampAngle = (a, b, lambda, dt) => a + angleDiff(a, b) * (1 - Math.exp(-lambda * dt));

/** Zahl oder Ersatzwert (für Spielstände mit kaputten Werten). */
export function numOr(v, ersatz) { v = +v; return Number.isFinite(v) ? v : ersatz; }
