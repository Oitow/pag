/**
 * @modul    worldgen-path
 * @zweck    A*-Wegsuche auf dem Weltgitter (8 Richtungen) mit Kosten nach Hang, Wasser und Flüssen; wiederverwendbare typisierte Puffer
 * @api      createPathfinder(welt, opts) -> {finde(ax,ay,bx,by)->Float32Array|null, kosten(i)->number}
 * @beispiel
 *   import { createPathfinder } from '../../engine/world/worldgen/worldgen-path.js';
 *   const pf = createPathfinder(welt, { hangKosten: 12, wasser: Infinity });
 *   const weg = pf.finde(10, 10, 200, 180);   // [x0,y0,x1,y1,…] in Weltkoordinaten oder null
 * @tags     welt, worldgen, wegfindung, astar, pfad
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { createMinHeap, DX8, DY8, DL8, FLAG } from './worldgen-grid.js';

/**
 * opts: { hangKosten (8), wasser (Infinity = gesperrt, sonst Zusatzkosten Meer/See), fluss (Zusatzkosten, Standard 6),
 *         diagonal (true), maxKnoten (b*t), sperre(i) -> bool (optional) }
 */
export function createPathfinder(welt, opts = {}) {
  const { breite: b, tiefe: t, flags: FL, hang: S, zelle: z } = welt;
  const n = b * t;
  const hk = opts.hangKosten ?? 8, wk = opts.wasser ?? Infinity, fk = opts.fluss ?? 6;
  const richtungen = opts.diagonal === false ? 4 : 8;
  const maxK = opts.maxKnoten ?? n;
  const sperre = opts.sperre;
  const g = new Float32Array(n), von = new Int32Array(n), marke = new Uint32Array(n), zu = new Uint32Array(n);
  const heap = createMinHeap(1024);
  let gen = 0;

  /** Kosten, eine Zelle zu betreten (ohne Schrittlänge). */
  function kosten(i) {
    const f = FL[i];
    let c = 1 + hk * (S ? S[i] : 0);
    if (f & (FLAG.OZEAN | FLAG.SEE)) c += wk;
    else if (f & FLAG.FLUSS) c += fk;
    if (sperre && sperre(i)) return Infinity;
    return c;
  }

  function finde(ax, ay, bx, by) {
    const sx = Math.round(ax / z), sy = Math.round(ay / z), ex = Math.round(bx / z), ey = Math.round(by / z);
    if (sx < 0 || sy < 0 || ex < 0 || ey < 0 || sx >= b || sy >= t || ex >= b || ey >= t) return null;
    const start = sy * b + sx, ziel = ey * b + ex;
    if (!Number.isFinite(kosten(ziel))) return null;
    if (++gen === 0xffffffff) { gen = 1; marke.fill(0); zu.fill(0); }
    heap.clear();
    g[start] = 0; von[start] = -1; marke[start] = gen;
    heap.push(start, 0);
    let besucht = 0, gefunden = false;
    while (heap.size > 0) {
      const c = heap.pop();
      if (zu[c] === gen) continue;
      zu[c] = gen;
      if (c === ziel) { gefunden = true; break; }
      if (++besucht > maxK) break;
      const cx = c % b, cy = (c - cx) / b, gc = g[c];
      for (let d = 0; d < richtungen; d++) {
        const nx = cx + DX8[d], ny = cy + DY8[d];
        if (nx < 0 || ny < 0 || nx >= b || ny >= t) continue;
        const j = ny * b + nx;
        if (zu[j] === gen) continue;
        const k = kosten(j);
        if (k === Infinity) continue;
        const ng = gc + DL8[d] * k;
        if (marke[j] === gen && ng >= g[j]) continue;
        marke[j] = gen; g[j] = ng; von[j] = c;
        const hx = Math.abs(nx - ex), hy = Math.abs(ny - ey);
        heap.push(j, ng + (hx > hy ? hx + 0.4142 * hy : hy + 0.4142 * hx));
      }
    }
    if (!gefunden) return null;
    let m = 0;
    for (let c = ziel; c >= 0; c = von[c]) m++;
    const weg = new Float32Array(m * 2);
    let k = m - 1;
    for (let c = ziel; c >= 0; c = von[c], k--) { weg[2 * k] = (c % b) * z; weg[2 * k + 1] = ((c / b) | 0) * z; }
    return weg;
  }

  return { finde, kosten };
}
