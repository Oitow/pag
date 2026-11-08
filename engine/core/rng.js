/**
 * @modul    rng
 * @zweck    Deterministischer Zufall (mulberry32), Seeds aus Text, Gitter-Hash und Würfel-Helfer
 * @api      rng(seed) -> ()=>number ; hashSeed(...teile) -> int ; hash2(x,y,seed) -> [0,1) ; hash3(x,y,z,seed) -> [0,1) ; range(r,a,b) ; int(r,a,b) ; pick(r,arr) ; chance(r,p) ; shuffle(r,arr) ; weighted(r,[[wert,gewicht]])
 * @beispiel
 *   import { rng, hashSeed, pick } from '../../engine/core/rng.js';
 *   const r = rng(hashSeed('insel', 42));
 *   const baum = pick(r, ['eiche', 'tanne']);
 * @tags     zufall, seed, hash, welt
 * @version  1.0.0
 * @status   stabil
 * @three    nein
 */

/** Seedbarer PRNG → Funktion mit Werten in [0,1). */
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const mulberry32 = rng;

/** Text/Zahlen → 32-bit Seed (FNV-1a), z. B. hashSeed('fluss', seed, 3). */
export function hashSeed(...teile) {
  let h = 2166136261 >>> 0;
  const s = teile.join('|');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Stabiler Zufallswert pro Gitterzelle (2D) in [0,1). */
export function hash2(x, y, seed = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Stabiler Zufallswert pro Gitterzelle (3D) in [0,1). */
export function hash3(x, y, z, seed = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2147483647) + Math.imul(seed | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const range = (r, a, b) => a + (b - a) * r();
export const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));
export const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
export const chance = (r, p) => r() < p;

/** Mischt arr an Ort und Stelle (Fisher-Yates) und gibt es zurück. */
export function shuffle(r, arr) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  return arr;
}

/** Gewichtete Auswahl: weighted(r, [['eiche', 3], ['birke', 1]]). */
export function weighted(r, paare) {
  let summe = 0;
  for (const p of paare) summe += p[1];
  let x = r() * summe;
  for (const p of paare) { x -= p[1]; if (x < 0) return p[0]; }
  return paare[paare.length - 1][0];
}
