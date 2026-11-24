// Grobes Gitter über die ganze Kugel für die Geologie (reine Logik, ohne THREE).
// Würfel-Kugel mit gleichen Winkeln (equal-angle): Richtung ↔ Zelle geht in beide Richtungen einfach.
// Zelle = f·N² + j·N + i. Jede Zelle kennt ihre 8 Nachbarn, auch über Würfelkanten hinweg.
import { SEITEN } from './planet-baum.js';

// Nachbar-Versätze: 0–3 gerade (O, W, N, S), 4–7 schräg
export const VERSATZ = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
const VERSATZ_NR = (di, dj) => VERSATZ.findIndex(([a, b]) => a === di && b === dj);

const Q = Math.PI / 4;

/** Seite + (U,V ∈ [-1,1]) → Richtung (Einheitsvektor). Auch etwas außerhalb gültig. */
export function seiteZuRichtung(f, U, V, out = [0, 0, 0]) {
  const s = SEITEN[f], u = Math.tan(U * Q), v = Math.tan(V * Q);
  const x = s.n[0] + u * s.a[0] + v * s.b[0], y = s.n[1] + u * s.a[1] + v * s.b[1], z = s.n[2] + u * s.a[2] + v * s.b[2];
  const l = Math.hypot(x, y, z);
  out[0] = x / l; out[1] = y / l; out[2] = z / l;
  return out;
}

/** Richtung → { f, U, V }. */
export function richtungZuSeite(x, y, z, out = { f: 0, U: 0, V: 0 }) {
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  let f;
  if (ax >= ay && ax >= az) f = x > 0 ? 0 : 1;
  else if (ay >= az) f = y > 0 ? 2 : 3;
  else f = z > 0 ? 4 : 5;
  const s = SEITEN[f];
  const t = 1 / (x * s.n[0] + y * s.n[1] + z * s.n[2]);
  out.f = f;
  out.U = Math.atan((x * s.a[0] + y * s.a[1] + z * s.a[2]) * t) / Q;
  out.V = Math.atan((x * s.b[0] + y * s.b[1] + z * s.b[2]) * t) / Q;
  return out;
}

export function createGeoGitter(N) {
  const n = 6 * N * N;
  const dir = new Float32Array(n * 3);
  const nb = new Int32Array(n * 8);
  const tmp = [0, 0, 0], sd = { f: 0, U: 0, V: 0 };
  const zelleVon = (x, y, z) => {
    richtungZuSeite(x, y, z, sd);
    const i = Math.min(N - 1, Math.max(0, Math.floor(((sd.U + 1) / 2) * N)));
    const j = Math.min(N - 1, Math.max(0, Math.floor(((sd.V + 1) / 2) * N)));
    return sd.f * N * N + j * N + i;
  };
  for (let f = 0; f < 6; f++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const c = f * N * N + j * N + i;
    seiteZuRichtung(f, -1 + ((i + 0.5) * 2) / N, -1 + ((j + 0.5) * 2) / N, tmp);
    dir[c * 3] = tmp[0]; dir[c * 3 + 1] = tmp[1]; dir[c * 3 + 2] = tmp[2];
  }
  for (let f = 0; f < 6; f++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const c = f * N * N + j * N + i;
    for (let k = 0; k < 8; k++) {
      const ii = i + VERSATZ[k][0], jj = j + VERSATZ[k][1];
      if (ii >= 0 && ii < N && jj >= 0 && jj < N) { nb[c * 8 + k] = f * N * N + jj * N + ii; continue; }
      seiteZuRichtung(f, -1 + ((ii + 0.5) * 2) / N, -1 + ((jj + 0.5) * 2) / N, tmp);
      const z = zelleVon(tmp[0], tmp[1], tmp[2]);
      nb[c * 8 + k] = z === c ? -1 : z; // an Würfelecken kann der Schrägnachbar fehlen
    }
  }

  // Zelle (f, i, j) – auch eine Zelle außerhalb der Seite, über die Nachbartabelle
  function zelle(f, i, j) {
    const ci = i < 0 ? 0 : i >= N ? N - 1 : i, cj = j < 0 ? 0 : j >= N ? N - 1 : j;
    const c = f * N * N + cj * N + ci;
    if (ci === i && cj === j) return c;
    const k = VERSATZ_NR(i - ci, j - cj);
    const z = nb[c * 8 + k];
    return z < 0 ? c : z;
  }

  /** Bilineare Gewichte für Richtung (x,y,z): schreibt 4 Zellen + Gewichte nach out. */
  function gewichte(x, y, z, out) {
    richtungZuSeite(x, y, z, sd);
    const gx = ((sd.U + 1) / 2) * N - 0.5, gy = ((sd.V + 1) / 2) * N - 0.5;
    const i0 = Math.floor(gx), j0 = Math.floor(gy), fx = gx - i0, fy = gy - j0;
    out.z[0] = zelle(sd.f, i0, j0); out.z[1] = zelle(sd.f, i0 + 1, j0);
    out.z[2] = zelle(sd.f, i0, j0 + 1); out.z[3] = zelle(sd.f, i0 + 1, j0 + 1);
    out.w[0] = (1 - fx) * (1 - fy); out.w[1] = fx * (1 - fy); out.w[2] = (1 - fx) * fy; out.w[3] = fx * fy;
    out.naechste = out.z[(fx > 0.5 ? 1 : 0) + (fy > 0.5 ? 2 : 0)];
    return out;
  }
  const neueGewichte = () => ({ z: new Int32Array(4), w: new Float64Array(4), naechste: 0 });
  const lese = (arr, g) => arr[g.z[0]] * g.w[0] + arr[g.z[1]] * g.w[1] + arr[g.z[2]] * g.w[2] + arr[g.z[3]] * g.w[3];

  return { N, n, dir, nb, zelleVon, gewichte, neueGewichte, lese };
}
