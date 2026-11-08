/**
 * @modul    worldgen-grid
 * @zweck    Gitter-Helfer für den Weltgenerator: typisierter Min-Heap, Chamfer-Abstand, Regionen-Markierung, bilineares Abtasten, Array-Hash
 * @api      createMinHeap(kapazitaet) -> {push(i,prio),pop()->i,size,clear()} ; chamferDistanz(maske,b,t,aus?) -> Float32Array ; markiereRegionen(maske,b,t,aus?) -> anzahl ; bilinear(arr,b,t,x,y) -> number ; hashArrays(...arrays) -> string ; DX8 ; DY8 ; DL8
 * @beispiel
 *   import { chamferDistanz, hashArrays } from '../../engine/world/worldgen/worldgen-grid.js';
 *   const dist = chamferDistanz(wasserMaske, 256, 256);   // Abstand (Zellen) zum nächsten Wasser
 *   console.log(hashArrays(welt.hoehe, welt.biom));      // Schnappschuss-Hash für Tests
 * @tags     welt, worldgen, gitter, heap, abstand
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

/** 8er-Nachbarschaft: Versatz x/y und Schrittlänge. Index 0–3 = gerade, 4–7 = diagonal. */
export const DX8 = Int8Array.from([1, -1, 0, 0, 1, 1, -1, -1]);
export const DY8 = Int8Array.from([0, 0, 1, -1, 1, -1, 1, -1]);
export const DL8 = Float32Array.from([1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2]);

/** Binärer Min-Heap mit typisierten Arrays (Index + Priorität), wächst bei Bedarf. */
class MinHeap {
  constructor(kap) { this.idx = new Int32Array(kap); this.pri = new Float64Array(kap); this.size = 0; }
  clear() { this.size = 0; }
  push(i, p) {
    if (this.size >= this.idx.length) {
      const ni = new Int32Array(this.idx.length * 2); ni.set(this.idx); this.idx = ni;
      const np = new Float64Array(this.pri.length * 2); np.set(this.pri); this.pri = np;
    }
    const I = this.idx, P = this.pri;
    let k = this.size++;
    while (k > 0) {
      const e = (k - 1) >> 1;
      if (P[e] <= p) break;
      I[k] = I[e]; P[k] = P[e]; k = e;
    }
    I[k] = i; P[k] = p;
  }
  /** Entfernt das Element mit der kleinsten Priorität; Priorität danach in .letztePrio. */
  pop() {
    const I = this.idx, P = this.pri;
    const top = I[0]; this.letztePrio = P[0];
    const n = --this.size;
    if (n > 0) {
      const li = I[n], lp = P[n];
      let k = 0;
      for (;;) {
        let c = 2 * k + 1;
        if (c >= n) break;
        if (c + 1 < n && P[c + 1] < P[c]) c++;
        if (P[c] >= lp) break;
        I[k] = I[c]; P[k] = P[c]; k = c;
      }
      I[k] = li; P[k] = lp;
    }
    return top;
  }
}

/** Neuer Min-Heap (Kapazität wächst automatisch). */
export function createMinHeap(kapazitaet = 1024) { return new MinHeap(Math.max(16, kapazitaet | 0)); }

/**
 * Abstand jeder Zelle zur nächsten Zelle mit maske[i] != 0 (Chamfer 3-4, ≈ euklidisch, in Zellen).
 * Zwei Durchläufe, O(n), ohne Warteschlange.
 */
export function chamferDistanz(maske, b, t, aus) {
  const n = b * t, D = aus || new Float32Array(n);
  const INF = 1e9;
  for (let i = 0; i < n; i++) D[i] = maske[i] ? 0 : INF;
  const A = 1, C = 1.4142;
  for (let y = 0; y < t; y++) {
    for (let x = 0; x < b; x++) {
      const i = y * b + x;
      let d = D[i];
      if (d === 0) continue;
      if (x > 0 && D[i - 1] + A < d) d = D[i - 1] + A;
      if (y > 0) {
        const o = i - b;
        if (D[o] + A < d) d = D[o] + A;
        if (x > 0 && D[o - 1] + C < d) d = D[o - 1] + C;
        if (x < b - 1 && D[o + 1] + C < d) d = D[o + 1] + C;
      }
      D[i] = d;
    }
  }
  for (let y = t - 1; y >= 0; y--) {
    for (let x = b - 1; x >= 0; x--) {
      const i = y * b + x;
      let d = D[i];
      if (d === 0) continue;
      if (x < b - 1 && D[i + 1] + A < d) d = D[i + 1] + A;
      if (y < t - 1) {
        const u = i + b;
        if (D[u] + A < d) d = D[u] + A;
        if (x > 0 && D[u - 1] + C < d) d = D[u - 1] + C;
        if (x < b - 1 && D[u + 1] + C < d) d = D[u + 1] + C;
      }
      D[i] = d;
    }
  }
  return D;
}

/**
 * Markiert 4-zusammenhängende Regionen mit maske[i] != 0. aus[i] = Regionsnummer (1..n), 0 = außerhalb.
 * Gibt die Anzahl der Regionen zurück.
 */
export function markiereRegionen(maske, b, t, aus) {
  const n = b * t, L = aus || new Int32Array(n);
  L.fill(0);
  const q = new Int32Array(n);
  let anzahl = 0;
  for (let s = 0; s < n; s++) {
    if (!maske[s] || L[s]) continue;
    const id = ++anzahl;
    let qh = 0, qt = 0;
    q[qt++] = s; L[s] = id;
    while (qh < qt) {
      const i = q[qh++], x = i % b;
      if (x > 0 && maske[i - 1] && !L[i - 1]) { L[i - 1] = id; q[qt++] = i - 1; }
      if (x < b - 1 && maske[i + 1] && !L[i + 1]) { L[i + 1] = id; q[qt++] = i + 1; }
      if (i >= b && maske[i - b] && !L[i - b]) { L[i - b] = id; q[qt++] = i - b; }
      if (i + b < n && maske[i + b] && !L[i + b]) { L[i + b] = id; q[qt++] = i + b; }
    }
  }
  return anzahl;
}

/** Bilinear abtasten (Gitterkoordinaten, am Rand geklemmt). */
export function bilinear(arr, b, t, x, y) {
  if (!(x > 0)) x = 0; if (!(y > 0)) y = 0;
  if (x > b - 1.0001) x = b - 1.0001; if (y > t - 1.0001) y = t - 1.0001;
  const ix = x | 0, iy = y | 0, fx = x - ix, fy = y - iy, i = iy * b + ix;
  const a = arr[i], c = arr[i + 1], d = arr[i + b], e = arr[i + b + 1];
  return a + (c - a) * fx + (d - a) * fy + (a - c - d + e) * fx * fy;
}

/** FNV-1a über die Bytes beliebiger typisierter Arrays → 8-stelliger Hex-Hash (für Schnappschuss-Tests). */
export function hashArrays(...arrays) {
  let h = 2166136261 >>> 0;
  for (const a of arrays) {
    if (!a) continue;
    const u8 = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    for (let i = 0; i < u8.length; i++) { h ^= u8[i]; h = Math.imul(h, 16777619); }
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
