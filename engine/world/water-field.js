/**
 * @modul    water-field
 * @zweck    Reine Rechenlogik fürs Wasser (ohne THREE): Wasserart je Zelle, Strömungsfeld der Flüsse in Abflussrichtung, Uferabstand und ein Vertex-Gitter mit Spiegel, Tiefe, Uferabstand, Strömung und Wellenstärke in Metern – Grundlage für water-mesh
 * @api      wasserArt(welt) -> Uint8Array ; stroemungsFeld(welt, opts) -> {x,y} ; uferAbstand(welt) -> Float32Array ; wasserGitter(welt, opts) -> {nx,nz,schritt,spiegel,tiefe,ufer,stroemX,stroemZ,welle,quads,anzahlQuads} ; ART
 * @beispiel
 *   import { wasserGitter } from '../../engine/world/water-field.js';
 *   const g = wasserGitter(welt, { schritt: 1, hoehenSkala: 60, meterProZelle: 2 });
 *   g.tiefe[k];  g.stroemX[k];  // Meter bzw. m/s am Vertex k = j * g.nx + i
 * @tags     welt, wasser, fluss, see, meer, stroemung, tiefe, ufer
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

import { FLAG, chamferDistanz } from './worldgen/worldgen-grid.js';

/** Wasserarten je Zelle. */
export const ART = Object.freeze({ LAND: 0, MEER: 1, SEE: 2, FLUSS: 3 });

/** Wasserart je Zelle (Meer vor See vor Fluss). */
export function wasserArt(welt) {
  const n = welt.breite * welt.tiefe, a = new Uint8Array(n), F = welt.flags;
  for (let i = 0; i < n; i++) {
    const f = F[i];
    a[i] = f & FLAG.OZEAN ? ART.MEER : f & FLAG.SEE ? ART.SEE : f & FLAG.FLUSS ? ART.FLUSS : ART.LAND;
  }
  return a;
}

/**
 * Strömung der Flüsse je Zelle in m/s (x → Gitter-x/Welt-x, y → Gitter-y/Welt-z).
 * Richtung = D8-Abfluss (welt.ziel), mehrfach über Flusszellen geglättet; Tempo wächst mit der Flussbreite.
 * opts: tempo (m/s, 1.2), glaetten (Durchläufe, 2). Meer und Seen strömen nicht.
 */
export function stroemungsFeld(welt, opts = {}) {
  const b = welt.breite, t = welt.tiefe, n = b * t;
  const art = opts.art || wasserArt(welt), ziel = welt.ziel, FB = welt.flussBreite;
  const tempo = opts.tempo ?? 1.2, runden = opts.glaetten ?? 2;
  let x = new Float32Array(n), y = new Float32Array(n);
  if (!ziel) return { x, y };
  for (let i = 0; i < n; i++) {
    if (art[i] !== ART.FLUSS) continue;
    const j = ziel[i];
    if (j < 0) continue;
    const dx = (j % b) - (i % b), dy = Math.floor(j / b) - Math.floor(i / b), l = Math.hypot(dx, dy) || 1;
    x[i] = dx / l; y[i] = dy / l;
  }
  // Glätten nur über Flusszellen – sonst knickt die Strömung an jeder D8-Stufe
  for (let r = 0; r < runden; r++) {
    const nxA = new Float32Array(n), nyA = new Float32Array(n);
    for (let gy = 0; gy < t; gy++) for (let gx = 0; gx < b; gx++) {
      const i = gy * b + gx;
      if (art[i] !== ART.FLUSS) continue;
      let sx = 0, sy = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const ax = gx + ox, ay = gy + oy;
        if (ax < 0 || ay < 0 || ax >= b || ay >= t) continue;
        const k = ay * b + ax;
        if (art[k] !== ART.FLUSS) continue;
        const g = ox === 0 && oy === 0 ? 2 : 1;
        sx += x[k] * g; sy += y[k] * g;
      }
      nxA[i] = sx; nyA[i] = sy;
    }
    x = nxA; y = nyA;
  }
  for (let i = 0; i < n; i++) {
    const l = Math.hypot(x[i], y[i]);
    if (l < 1e-6) { x[i] = y[i] = 0; continue; }
    const v = tempo * (0.6 + 0.4 * Math.min(1, (FB ? FB[i] : 1) / 3));
    x[i] = x[i] / l * v; y[i] = y[i] / l * v;
  }
  return { x, y };
}

/** Abstand (Zellen) jeder Zelle zur nächsten Landzelle. Land = 0. */
export function uferAbstand(welt, art = wasserArt(welt)) {
  const n = art.length, land = new Uint8Array(n);
  for (let i = 0; i < n; i++) land[i] = art[i] === ART.LAND ? 1 : 0;
  return chamferDistanz(land, welt.breite, welt.tiefe);
}

/**
 * Vertex-Gitter fürs Wassernetz (gleiche Anordnung wie terrain-mesh: nx × nz Vertices im Abstand `schritt`).
 * Werte in Metern: spiegel (Wasserhöhe), tiefe (Spiegel − Boden, ≥ 0), ufer (Abstand zum Land), stroemX/stroemZ (m/s),
 * welle (0…1, Meer 1, See seeWelle, Fluss flussWelle). quads[q] = 1, wenn das Quad (i,j) Wasser berührt.
 * Ufer-Vertices (selbst Land) bekommen den mittleren Spiegel der Wasser-Nachbarn und Tiefe 0.
 * opts: schritt, hoehenSkala, meterProZelle, tempo, glaetten, seeWelle, flussWelle.
 */
export function wasserGitter(welt, opts = {}) {
  const B = welt.breite, T = welt.tiefe, H = welt.hoehe, WS = welt.wasserstand;
  const s = Math.max(1, opts.schritt | 0 || 1), hs = opts.hoehenSkala ?? 40, m = (opts.meterProZelle ?? 1) * (welt.zelle ?? 1);
  const welleJe = [0, 1, opts.seeWelle ?? 0.35, opts.flussWelle ?? 0.12];
  const art = wasserArt(welt), str = stroemungsFeld(welt, { ...opts, art }), dist = uferAbstand(welt, art);
  const nx = Math.floor((B - 1) / s) + 1, nz = Math.floor((T - 1) / s) + 1, nv = nx * nz;
  const spiegel = new Float32Array(nv), tiefe = new Float32Array(nv), ufer = new Float32Array(nv);
  const stroemX = new Float32Array(nv), stroemZ = new Float32Array(nv), welle = new Float32Array(nv);
  const nass = new Uint8Array(nv);
  const spiegelVon = (i) => (art[i] === ART.MEER ? 0 : WS[i]);

  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const gx = Math.min(B - 1, i * s), gy = Math.min(T - 1, j * s), c = gy * B + gx, k = j * nx + i;
    if (art[c] !== ART.LAND) {
      nass[k] = 1;
      spiegel[k] = spiegelVon(c) * hs;
      tiefe[k] = Math.max(0, spiegelVon(c) - H[c]) * hs;
      ufer[k] = dist[c] * m;
      stroemX[k] = str.x[c]; stroemZ[k] = str.y[c];
      welle[k] = welleJe[art[c]];
      continue;
    }
    // Ufer-Vertex: Mittel der Wasser-Nachbarn
    let sum = 0, sx = 0, sz = 0, sw = 0, z = 0;
    for (let dy = -s; dy <= s; dy += s) for (let dx = -s; dx <= s; dx += s) {
      const x = gx + dx, y = gy + dy;
      if (x < 0 || y < 0 || x >= B || y >= T) continue;
      const q = y * B + x;
      if (art[q] === ART.LAND) continue;
      sum += spiegelVon(q); sx += str.x[q]; sz += str.y[q]; sw += welleJe[art[q]]; z++;
    }
    if (!z) { spiegel[k] = H[c] * hs; continue; }
    spiegel[k] = sum / z * hs;
    stroemX[k] = sx / z * 0.5; stroemZ[k] = sz / z * 0.5;   // am Ufer langsamer
    welle[k] = sw / z;
  }

  const quads = new Uint8Array((nx - 1) * (nz - 1));
  let anzahlQuads = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i;
    if (nass[a] | nass[a + 1] | nass[a + nx] | nass[a + nx + 1]) { quads[j * (nx - 1) + i] = 1; anzahlQuads++; }
  }
  return { nx, nz, schritt: s, spiegel, tiefe, ufer, stroemX, stroemZ, welle, quads, anzahlQuads };
}
