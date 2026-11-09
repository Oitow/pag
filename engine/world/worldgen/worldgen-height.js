/**
 * @modul    worldgen-height
 * @zweck    Höhenfeld aus fBm, Grat-Gebirgen, Domain-Warp, Klippen, Terrassen und optionalen Felsstufen im Gebirge (hoehe.gebirge.felsStufen: { stufen, staerke }); punktweise abtastbar (für Chunks) oder als ganzes Gitter
 * @api      createHeightSampler(opts) -> {sample(x,y)->number} ; stufeHoehe(welt, opts) -> void
 * @beispiel
 *   import { createHeightSampler } from '../../engine/world/worldgen/worldgen-height.js';
 *   const hs = createHeightSampler({ seed: 7, breite: 256, tiefe: 256, form: { typ: 'insel' }, hoehe: {} });
 *   const h = hs.sample(128, 128);   // normiert, Meeresspiegel = 0
 * @tags     welt, worldgen, hoehe, terrain, fbm, gebirge
 * @version  1.1.0
 * @status   entwurf
 * @three    nein
 */
import { createNoise2D, fbm2, ridged2 } from '../../core/noise.js';
import { hashSeed } from '../../core/rng.js';
import { smoothstep } from '../../core/math.js';
import { createShape } from './worldgen-shape.js';

/**
 * Erzeugt eine reine Funktion Höhe(x,y) in Zellkoordinaten.
 * Gleiche Optionen + gleiche Koordinaten → exakt gleicher Wert (Grundlage für nahtlose Chunks).
 */
export function createHeightSampler(opts) {
  const seed = opts.seed ?? 1;
  const H = opts.hoehe || {}, F = opts.form || {};
  const b = opts.breite ?? 256, t = opts.tiefe ?? 256;
  const form = createShape(F, seed);
  const mass = H.massstab || Math.max(b, t);
  const s = 1 / mass;
  const nW = createNoise2D(hashSeed(seed, 'warp'));
  const nC = createNoise2D(hashSeed(seed, 'kontinent'));
  const nH = createNoise2D(hashSeed(seed, 'huegel'));
  const nM = createNoise2D(hashSeed(seed, 'gebirgsmaske'));
  const nR = createNoise2D(hashSeed(seed, 'grat'));
  const nK = createNoise2D(hashSeed(seed, 'klippen'));
  const nG = createNoise2D(hashSeed(seed, 'grossform'));

  const qd = opts.qualitaet === 'schnell' ? -1 : opts.qualitaet === 'hoch' ? 1 : 0; // Oktaven je nach Qualität
  const okt = Math.max(1, (H.oktaven ?? 5) + qd), fK = H.frequenz ?? 3;
  const rauschG = H.rauschGewicht ?? 0.55, maskG = H.maskGewicht ?? 1, landAnteil = H.landAnteil ?? 0;
  const flach = H.flach ?? 0.35, meerTiefe = H.meerTiefe ?? 0.6;
  const ws = H.warp?.staerke ?? 0.08, wf = H.warp?.frequenz ?? 2.5;
  const huegel = H.huegel ?? 1, fH = H.huegelFrequenz ?? 8;
  const G = H.gebirge || {};
  const gMenge = G.menge ?? 0.5, gHoehe = G.hoehe ?? 0.9, gSchaerfe = G.schaerfe ?? 1.5;
  const fM = G.frequenz ?? 2.2, fR = G.gratFrequenz ?? 5, gOkt = Math.max(1, (G.oktaven ?? 5) + qd);
  const gSchwelle = 0.3 - gMenge * 0.7;
  const fsStufen = G.felsStufen?.stufen ?? 0, fsStaerke = fsStufen > 0 ? G.felsStufen?.staerke ?? 0.6 : 0;
  const klippen = H.klippen ?? 0.3;
  const tStufen = H.terrassen?.stufen ?? 0, tStaerke = H.terrassen?.staerke ?? 0;
  const kont = H.kontinente ?? 0, fG = H.kontinentFrequenz ?? 0.35;
  const randMeer = form.endlich && (F.randMeer ?? true);
  const randB = (F.randBreite ?? 0.08) * Math.min(b, t);
  const nach = form.nach, maske = form.maske;
  const ub = mass / b, vb = mass / t;

  function roh(x, y) {
    let px = x * s, py = y * s;
    if (ws > 0) {
      const qx = fbm2(nW, px * wf + 5.2, py * wf + 1.3, 3), qy = fbm2(nW, px * wf + 1.7, py * wf + 9.2, 3);
      px += qx * ws; py += qy * ws;
    }
    const u = form.endlich ? px * ub * 2 - 1 : 0, v = form.endlich ? py * vb * 2 - 1 : 0;
    let e = maske(u, v) * maskG + fbm2(nC, px * fK, py * fK, okt) * rauschG + landAnteil;
    if (kont > 0) e += kont * fbm2(nG, px * fG + 17, py * fG - 31, 3);
    let h;
    if (e < 0) h = e * meerTiefe;
    else {
      const land = smoothstep(0, 0.25, e);
      h = e * flach;
      if (huegel > 0) h += huegel * 0.1 * (fbm2(nH, px * fH, py * fH, 3) + 0.25) * land;
      if (gHoehe > 0) {
        const mm = smoothstep(gSchwelle - 0.2, gSchwelle + 0.2, fbm2(nM, px * fM + 200, py * fM - 120, 3));
        if (mm > 0) {
          const rg = ridged2(nR, px * fR, py * fR, gOkt);
          let g = gHoehe * mm * Math.pow(rg, gSchaerfe) * land * (0.5 + 0.5 * smoothstep(0.05, 0.5, e));
          if (fsStaerke > 0 && g > 0.02) {
            // Felsstufen: nur der Gebirgsanteil wird gestuft (Absätze/Mikroklippen), Stufenhöhe leicht verrauscht
            const st = g * fsStufen + fbm2(nK, px * 9 - 40, py * 9 + 13, 2) * 0.6, f = Math.floor(st);
            const gs = (f + smoothstep(0.25, 0.85, st - f)) / fsStufen - fbm2(nK, px * 9 - 40, py * 9 + 13, 2) * 0.6 / fsStufen;
            g += (gs - g) * fsStaerke * smoothstep(0.02, 0.12, g);
          }
          h += g;
        }
      }
      if (klippen > 0 && h < 0.2) {
        const cl = smoothstep(0.15, 0.4, fbm2(nK, px * 6 + 3, py * 6 - 8, 2)) * klippen;
        h += cl * 0.09 * smoothstep(0, 0.012, h) * (1 - smoothstep(0.1, 0.2, h));
      }
    }
    if (tStufen > 0 && tStaerke > 0 && h > 0) {
      const st = h * tStufen, f = Math.floor(st);
      h += ((f + smoothstep(0.3, 0.7, st - f)) / tStufen - h) * tStaerke;
    }
    h = nach(h, u, v, px, py);
    if (randMeer) {
      let d = x < y ? x : y;
      const rx = b - 1 - x, ry = t - 1 - y;
      if (rx < d) d = rx; if (ry < d) d = ry;
      if (d < randB) { const f = smoothstep(0, 1, d / randB); h = h * f - 0.45 * (1 - f); }
    }
    return h;
  }

  // Kachelbar: vier versetzte Abtastungen bilinear überblenden → Ränder passen nahtlos aneinander.
  if (opts.kachelbar) {
    return {
      sample(x, y) {
        const fx = x / b, fy = y / t;
        const a = roh(x, y), c = roh(x - b, y), d = roh(x, y - t), e = roh(x - b, y - t);
        const o = a + (c - a) * fx, w = d + (e - d) * fx;
        return o + (w - o) * fy;
      },
    };
  }
  return { sample: roh };
}

/** Pipeline-Stufe: füllt welt.hoehe (Float32Array breite×tiefe). */
export function stufeHoehe(welt, opts) {
  const hs = createHeightSampler(opts);
  const { breite: b, tiefe: t, hoehe: Hh } = welt;
  const sample = hs.sample;
  for (let y = 0; y < t; y++) {
    const o = y * b;
    for (let x = 0; x < b; x++) Hh[o + x] = sample(x, y);
  }
}
