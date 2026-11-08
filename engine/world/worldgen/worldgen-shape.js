/**
 * @modul    worldgen-shape
 * @zweck    Landform-Masken für den Weltgenerator (Insel, Archipel, Kontinent, Küste, Vulkan, Canyon, Plateau, unendlich) plus formspezifische Nachbearbeitung der Höhe
 * @api      createShape(form, seed) -> {typ, endlich, maske(u,v)->number, nach(h,u,v,wx,wy)->number} ; FORMEN
 * @beispiel
 *   import { createShape } from '../../engine/world/worldgen/worldgen-shape.js';
 *   const f = createShape({ typ: 'insel', kuestenRauschen: 0.5 }, 42);
 *   const landNeigung = f.maske(0, 0);   // u,v in [-1,1]; >0 = Land-Tendenz
 * @tags     welt, worldgen, insel, form, maske, terrain
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { createNoise2D, fbm2 } from '../../core/noise.js';
import { rng, hashSeed } from '../../core/rng.js';
import { smoothstep } from '../../core/math.js';

/** Bekannte Formtypen. 'unendlich' = keine Maske (für Chunks / kachelbare Welten). */
export const FORMEN = ['insel', 'archipel', 'kontinent', 'kueste', 'vulkan', 'canyon', 'plateau', 'unendlich'];

const TAU = Math.PI * 2;

/**
 * Erzeugt Maske + Nachbearbeitung für einen Formtyp.
 * form: { typ, radius, kuestenRauschen, anzahl (Archipel), richtung (Küste, Grad), kraterTiefe, canyonBreite, stufen }
 */
export function createShape(form = {}, seed = 1) {
  const typ = form.typ || 'insel';
  const n = createNoise2D(hashSeed(seed, 'form'));
  const kr = form.kuestenRauschen ?? 0.5;
  const radius = form.radius ?? 0.78;

  // Inselradius schwankt mit dem Winkel → Buchten und Halbinseln (nahtlos über den Kreis abgetastet).
  // Vorberechnet als Tabelle über den Winkel → pro Zelle nur atan2 + lineare Interpolation statt 5 Rauschaufrufen.
  const RL = 1024, rTab = new Float32Array(RL + 1);
  for (let k = 0; k <= RL; k++) {
    const th = (k / RL) * TAU - Math.PI, c = Math.cos(th), s = Math.sin(th);
    rTab[k] = radius * (1 + kr * (0.55 * fbm2(n, c * 1.3 + 40, s * 1.3 - 20, 3) + 0.25 * fbm2(n, c * 3.5 + 9, s * 3.5, 2)));
  }
  function radiusBei(u, v) {
    const f = ((Math.atan2(v, u) + Math.PI) / TAU) * RL, k = f | 0, a = f - k;
    return k >= RL ? rTab[RL] : rTab[k] + (rTab[k + 1] - rTab[k]) * a;
  }

  let maske, nach = keineNach;
  switch (typ) {
    case 'insel': case 'vulkan': {
      maske = (u, v) => 1 - Math.sqrt(u * u + v * v) / radiusBei(u, v);
      if (typ === 'vulkan') nach = vulkanNach(form);
      break;
    }
    case 'archipel': {
      const r = rng(hashSeed(seed, 'archipel'));
      const anz = form.anzahl ?? 7;
      const cx = new Float32Array(anz), cy = new Float32Array(anz), cr = new Float32Array(anz);
      for (let k = 0; k < anz; k++) {
        const a = r() * TAU, d = Math.sqrt(r()) * 0.62;
        cx[k] = Math.cos(a) * d; cy[k] = Math.sin(a) * d; cr[k] = (0.13 + r() * 0.17) * (form.inselGroesse ?? 1);
      }
      maske = (u, v) => {
        let m = -1;
        for (let k = 0; k < anz; k++) {
          const dx = u - cx[k], dy = v - cy[k];
          const w = 1 - Math.sqrt(dx * dx + dy * dy) / cr[k];
          if (w > m) m = w;
        }
        // flache Bänke zwischen den Inseln
        const bank = 0.25 * fbm2(n, u * 3 + 7, v * 3 - 3, 3) - 0.15;
        return (m > bank ? m : bank) * 1.6 - 0.1 * Math.sqrt(u * u + v * v);
      };
      break;
    }
    case 'kontinent': {
      maske = (u, v) => {
        const d = Math.sqrt(u * u + v * v) / (radiusBei(u, v) * 1.25);
        return 0.9 - d * d * d * 1.2;
      };
      break;
    }
    case 'kueste': {
      const a = ((form.richtung ?? 0) * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
      maske = (u, v) => {
        const p = u * ca + v * sa, q = -u * sa + v * ca;
        const welle = kr * 0.35 * fbm2(n, q * 2.2 + 13, 5.5, 3);
        return (-(p - welle) - (form.verschiebung ?? 0)) * 1.3;
      };
      break;
    }
    case 'canyon': {
      maske = () => 0.6;
      nach = canyonNach(form, seed);
      break;
    }
    case 'plateau': {
      maske = (u, v) => 0.75 - 0.45 * (u * u + v * v);
      nach = plateauNach(form);
      break;
    }
    default: // 'unendlich' / unbekannt: Land nur aus Rauschen
      maske = () => 0;
  }
  return { typ, endlich: typ !== 'unendlich', maske, nach };
}

function keineNach(h) { return h; }

/** Vulkan: Kegel mit Krater in der Mitte, Lavarinnen über das Höhenrauschen. */
function vulkanNach(form) {
  const kegel = form.kegelHoehe ?? 0.9, krater = form.kraterTiefe ?? 0.35, kr = form.kraterRadius ?? 0.09;
  return (h, u, v) => {
    const d = Math.sqrt(u * u + v * v);
    if (h <= 0) return h;
    const k = kegel * Math.max(0, 1 - d / 0.55);
    let z = h + k * k * 1.4;
    if (d < kr * 1.6) z -= krater * (1 - smoothstep(kr * 0.6, kr * 1.6, d));
    return z;
  };
}

/** Canyon: stufige Hochebene (Mesas); optional (canyonTiefe > 0) zusätzlich Rausch-Schluchten mit geneigtem Boden. */
function canyonNach(form, seed) {
  const n = createNoise2D(hashSeed(seed, 'canyon'));
  const breite = form.canyonBreite ?? 0.07, tiefe = form.canyonTiefe ?? 0.55, stufen = form.stufen ?? 4;
  const ga = (((form.gefaelle ?? hashSeed(seed, 'gefaelle') % 360)) * Math.PI) / 180, gx = Math.cos(ga), gy = Math.sin(ga);
  return (h, u, v, wx, wy) => {
    // Stufige Hochebene (Mesas)
    const s = h * stufen, f = Math.floor(s), t = s - f;
    let z = (f + smoothstep(0.35, 0.65, t)) / stufen;
    z = z * 0.6 + h * 0.4 + 0.15;
    if (tiefe <= 0) return z; // nur Tafelland – Schluchten gräbt dann die Flussstufe (wasser.tal)
    // Schluchtsystem: Nulllinien eines verwirbelten Rauschens
    const c = Math.abs(fbm2(n, u * 1.4 + 0.3 * fbm2(n, u * 4, v * 4, 2), v * 1.4, 3));
    const k = 1 - smoothstep(breite * 0.35, breite, c);
    const k2 = 1 - smoothstep(breite, breite * 2.2, c);
    // Schluchtboden auf absoluter, leicht geneigter Höhe → Wasser fließt ab statt Becken zu bilden
    const boden = 0.02 + tiefe * 0.25 * (0.5 + 0.5 * (u * gx + v * gy));
    const z2 = z - 0.12 * k2;
    return z2 + (Math.min(z2, boden) - z2) * k;
  };
}

/** Plateau: abgeflachte Tafelberge mit steilen Kanten. */
function plateauNach(form) {
  const stufen = form.stufen ?? 3, harte = form.kantenHaerte ?? 0.8;
  return (h) => {
    if (h <= 0.05) return h;
    const s = h * stufen, f = Math.floor(s), t = s - f;
    const terr = (f + smoothstep(0.5 - 0.45 * harte, 0.5 + 0.05, t)) / stufen;
    return h * (1 - harte) + terr * harte;
  };
}
