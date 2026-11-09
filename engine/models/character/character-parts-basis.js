/**
 * @modul    character-parts-basis
 * @zweck    Gemeinsame Helfer der Figuren-Bau-Funktionen: Farben mischen/abdunkeln, Kugel- und Zylinder-Ausschnitte in einen mesh-builder
 * @api      farbeMisch(a,b,t) -> int ; dunkler(c,t) -> int ; heller(c,t) -> int ; GOLD ; LEDER ; schale(b,r,farbe,t,opts) ; mantelFlaeche(b,rO,rU,h,farbe,t,opts)
 * @beispiel
 *   import { farbeMisch, schale } from '../../engine/models/character/character-parts-basis.js';
 *   schale(b, 0.2, 0x804020, { y: 0.2 }, { thL: Math.PI / 2 });   // Halbkugel-Kappe
 * @tags     figur, charakter, farbe, mesh, hilfen
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';

/** Farben (Zahlen) mischen: t = 0 → a, 1 → b. */
export function farbeMisch(a, b, t) {
  const k = (s) => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (k(16) << 16) | (k(8) << 8) | k(0);
}
export const dunkler = (c, t) => farbeMisch(c, 0, t);
export const heller = (c, t) => farbeMisch(c, 0xffffff, t);
export const GOLD = 0xd8b048, LEDER = 0x5a4030;

/** Kugel-Ausschnitt (theta von oben gemessen, phi = π/2 ist vorn +Z). */
export function schale(b, r, farbe, t, { phi0 = 0, phiL = 2 * Math.PI, th0 = 0, thL = Math.PI, ws = 12, hs = 7 } = {}) {
  const geo = new THREE.SphereGeometry(r, ws, hs, phi0, phiL, th0, thL);
  b.add(geo, farbe, t);
  geo.dispose();
  return b;
}

/**
 * Offener Zylinder-/Kegelmantel (theta 0 = vorn +Z). opts: { th0 = 0, thL = 2π, seg = 12, doppelt = false (Innenseite dunkler mitbauen) }.
 * Für Röcke, Mäntel, Umhänge, Kragen.
 */
export function mantelFlaeche(b, rO, rU, h, farbe, t = {}, { th0 = 0, thL = 2 * Math.PI, seg = 12, doppelt = false } = {}) {
  const geo = new THREE.CylinderGeometry(rO, rU, h, seg, 1, true, th0, thL);
  b.add(geo, farbe, t);
  if (doppelt) b.add(geo, dunkler(farbe, 0.3), { ...t, innen: true });
  geo.dispose();
  return b;
}
