/**
 * @modul    ueberblenden
 * @zweck    Weiches Überblenden zwischen Detailstufen (LOD) per Bildschirm-Raster: zwei Stufen zeichnen sich mit Gegen-Vergleich auf dasselbe 4×4-Raster → keine Lücke, kein Doppel, kein Ploppen; je Instanz ein Wert `ueber`
 * @api      UEBER_VERT_KOPF, UEBER_VERT (in main: vUeber = ueber), UEBER_FRAG_KOPF, UEBER_FRAG (discard) ; ueberWert(f, rolle) -> Zahl (rolle 'ein' | 'aus') ; ueberAnteil(ab, grenze, breite) -> f 0…1
 * @beispiel
 *   import { UEBER_VERT_KOPF, UEBER_VERT, UEBER_FRAG_KOPF, UEBER_FRAG, ueberWert, ueberAnteil } from '../../engine/render/ueberblenden.js';
 *   const f = ueberAnteil(abstand, 90, 12);           // 0 = innen (nahe Stufe), 1 = außen (ferne Stufe)
 *   nah.setAttribute… ueberWert(f, 'aus'); fern … ueberWert(f, 'ein');   // 0 = ganz sichtbar
 * @tags     render, lod, ueberblenden, dither, crossfade, instanzen, shader
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
// Wert je Instanz: 0 = ganz sichtbar, (0,1] = einblenden mit Anteil f, (1,2) = ausblenden (f = ueber − 1).
export const UEBER_VERT_KOPF = 'attribute float ueber;\nvarying float vUeber;\n';
export const UEBER_VERT = 'vUeber = ueber;\n';
export const UEBER_FRAG_KOPF = `varying float vUeber;
float ueberRaster() { vec2 p = floor(mod(gl_FragCoord.xy, 4.0));
  float b = mod(p.x, 2.0) * 8.0 + mod(p.y, 2.0) * 4.0 + floor(p.x / 2.0) * 2.0 + floor(p.y / 2.0);
  b = mod(b * 7.0, 16.0);
  return (b + 0.5) / 16.0; }
`;
export const UEBER_FRAG = 'if (vUeber > 0.0) { float uR = ueberRaster(); if (vUeber <= 1.0 ? uR >= vUeber : uR < vUeber - 1.0) discard; }\n';

const glatt = (x) => x * x * (3 - 2 * x);
/** Anteil der äußeren Stufe an der Grenze (Breite = halbe Übergangszone, m). */
export function ueberAnteil(ab, grenze, breite) {
  const t = (ab - (grenze - breite)) / (2 * breite);
  return t <= 0 ? 0 : t >= 1 ? 1 : glatt(t);
}
/** Instanzwert: rolle 'ein' (äußere Stufe, sichtbar mit Anteil f) oder 'aus' (innere Stufe, sichtbar mit 1 − f). */
export function ueberWert(f, rolle) {
  if (rolle === 'ein') return f >= 0.999 ? 0 : Math.max(f, 0.001);
  return f <= 0.001 ? 0 : 1 + Math.min(f, 0.999);
}
