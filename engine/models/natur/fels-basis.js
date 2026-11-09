/**
 * @modul    fels-basis
 * @zweck    Kleine Helfer für Felsen/Totholz: Dreiecke mit Flächenfarben sammeln → nicht-indizierte BufferGeometry (position, normal, color, wind=0), Farb-Mischen
 * @api      createSammler() -> { netz(punkte, dreiecke, farbFn), dreieck(a,b,c,rgb), anzahl(), geometrie(), dispose() } ; rgb(hex) ; mische(a,b,t) ; hell(c,f) ; glatt(a,b,x)
 * @beispiel
 *   import { createSammler, rgb } from '../../engine/models/natur/fels-basis.js';
 *   const s = createSammler();
 *   s.netz(punkte, dreiecke, (n, m) => rgb(0x888880));   // n = Flächennormale, m = Mittelpunkt
 *   const geo = s.geometrie();
 * @tags     natur, fels, geometrie, vertexfarben
 * @version  1.0.0
 * @status   neu
 * @three    ja
 */
import * as THREE from 'three';
import { normale } from './fels-form.js';

/** 0xrrggbb → [r,g,b] in 0..1 (sRGB). */
export const rgb = hex => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
/** Lineare Mischung zweier [r,g,b]. */
export const mische = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** Helligkeit skalieren. */
export const hell = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
/** smoothstep */
export const glatt = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Sammelt Dreiecke mit einer Farbe je Dreieck (Low-Poly-Facetten). */
export function createSammler() {
  let pos = [], col = [];
  const c = new THREE.Color();
  const s = {
    /** Einzelnes Dreieck (Punkte [x,y,z], Farbe [r,g,b] sRGB). */
    dreieck(a, b, d, farbe) {
      pos.push(...a, ...b, ...d);
      c.setRGB(Math.min(1, farbe[0]), Math.min(1, farbe[1]), Math.min(1, farbe[2]), THREE.SRGBColorSpace);
      for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
    },
    /** Indiziertes Netz übernehmen; farbFn(normale, mitte, dreieckNr) -> [r,g,b]. */
    netz(P, D, farbFn) {
      for (let i = 0; i < D.length; i += 3) {
        const a = D[i], b = D[i + 1], d = D[i + 2];
        const n = normale(P, a, b, d);
        const m = [(P[a * 3] + P[b * 3] + P[d * 3]) / 3, (P[a * 3 + 1] + P[b * 3 + 1] + P[d * 3 + 1]) / 3,
          (P[a * 3 + 2] + P[b * 3 + 2] + P[d * 3 + 2]) / 3];
        s.dreieck([P[a * 3], P[a * 3 + 1], P[a * 3 + 2]], [P[b * 3], P[b * 3 + 1], P[b * 3 + 2]],
          [P[d * 3], P[d * 3 + 1], P[d * 3 + 2]], farbFn(n, m, i / 3));
      }
    },
    anzahl: () => pos.length / 9,
    /** Fertige BufferGeometry: position, normal (flach), color, wind (0 = starr). */
    geometrie() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setAttribute('wind', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3), 1));
      g.computeVertexNormals();
      g.computeBoundingSphere();
      return g;
    },
    dispose() { pos = []; col = []; },
  };
  return s;
}
