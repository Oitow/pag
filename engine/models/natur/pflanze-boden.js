/**
 * @modul    pflanze-boden
 * @zweck    Prozedurale Low-Poly-Bodendecker: farn (gefiederte Wedel), grasbueschel (Halm-Fächer), blume (Sorten per Seed), pilz (Fliegenpilz/Steinpilz/Hexenring), schilf (Halme + Rohrkolben), seerose (liegt auf y≈0)
 * @api      TYPEN ; erzeuge(typ, seed, { detail = 1, jahreszeit = 'sommer', sorte (blume/pilz), farbe (Blüte), groesse = 1 }) -> { geometrie, hoehe, radius, stammRadius }
 * @beispiel
 *   import { erzeuge } from '../../engine/models/natur/pflanze-boden.js';
 *   const gras = erzeuge('grasbueschel', 9);
 *   const mohn = erzeuge('blume', 3, { sorte: 'mohn' });   // Sorten: BLUMEN_SORTEN in pflanze-formen.js
 * @tags     natur, pflanze, gras, farn, blume, pilz, schilf, seerose, bodendecker, lowpoly, wind
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { rng, hashSeed, range, pick, chance } from '../../core/rng.js';
import { createSammler, bogen3, seiteZu } from './pflanze-basis.js';
import { bogen, farbe, mische, hell } from './pflanze-formen.js';
import { baueBlume, bauePilz } from './pflanze-blume.js';

export const TYPEN = ['farn', 'grasbueschel', 'blume', 'pilz', 'schilf', 'seerose'];

const palette = (liste) => liste.map(farbe);
const GRAS = { sommer: palette(['#5e9a3a', '#6fae44', '#4d8a32', '#7fb04a']), herbst: palette(['#9fa14a', '#b8a456', '#8a9a40']), winter: palette(['#b7a477', '#a8936a', '#c4b488']) };
const FARN = { sommer: palette(['#3f7a2c', '#4e8a34', '#5a9638']), herbst: palette(['#b0662a', '#c08a3a', '#9a5a26']), winter: palette(['#6b4a2e', '#7a5634']) };
const SCHILF = { sommer: palette(['#6f8f3e', '#7d9a48', '#6a8a50']), herbst: palette(['#b9a25c', '#a8954e']), winter: palette(['#c9b98a', '#bcaa7a']) };
const jz = (tab, j) => tab[j] || tab.sommer;

/** Halm als zweiseitiges, spitz zulaufendes Band. */
function halm(s, basis, w, L, breite, steil, biegung, f, segs, windMax = 1) {
  const pkt = bogen3(bogen(L, steil, biegung, segs), w, basis);
  const br = pkt.map((_, i) => breite * (1 - i / segs));
  s.band(pkt, seiteZu(w), br, (i, t) => mische(hell(f, 0.7), hell(f, 1.15), t), (t) => windMax * Math.pow(t, 1.3));
}

function grasbueschel(s, r, o) {
  const pal = jz(GRAS, o.jahreszeit), n = [4, 7, 12][o.detail], segs = [2, 3, 4][o.detail];
  const H = range(r, 0.3, 0.55) * o.groesse, start = r() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const w = start + (i / n) * Math.PI * 2 + range(r, -0.4, 0.4), d = range(r, 0.01, 0.06);
    halm(s, [Math.cos(w) * d, -0.02, Math.sin(w) * d], w, H * range(r, 0.65, 1.1), H * range(r, 0.05, 0.07),
      range(r, 1.2, 1.5), range(r, 0.3, 1.1), pick(r, pal), segs);
  }
}

function farn(s, r, o) {
  const pal = jz(FARN, o.jahreszeit), n = [3, 6, 9][o.detail], k = [3, 4, 6][o.detail];
  const L0 = range(r, 0.5, 0.85) * o.groesse, start = r() * Math.PI * 2, welk = o.jahreszeit === 'winter' ? 0.5 : 0;
  for (let i = 0; i < n; i++) {
    const w = start + (i / n) * Math.PI * 2 + range(r, -0.25, 0.25), L = L0 * range(r, 0.8, 1.1);
    const pkt = bogen3(bogen(L, range(r, 1.3, 1.5) - welk, range(r, 1.4, 1.9), k), w);
    const q = seiteZu(w), f = pick(r, pal);
    // Fischgräten-Fiedern: schmal, nach vorn gerichtet, zur Spitze kleiner
    for (let j = 0; j < k; j++) {
      const t = (j + 0.5) / k, a = pkt[j], b = pkt[j + 1], m = a.map((v, x) => v * 0.45 + b[x] * 0.55);
      const vor = b.map((v, x) => v - a[x]);
      const fl = L * 0.36 * Math.sin(Math.PI * (0.2 + 0.7 * t)) * (1 - 0.3 * t);
      const fj = mische(hell(f, 0.8), hell(f, 1.2), t), wi = [t * 0.9, Math.min(1, (j + 1) / k), Math.min(1, t + 0.15)];
      for (const sg of [-1, 1]) {
        const sp = m.map((v, x) => v + q[x] * fl * sg + vor[x] * 0.6 - (x === 1 ? fl * 0.15 : 0));
        s.dreieckZwei(a, m, sp, fj, wi);
      }
      s.dreieckZwei(m, b, m.map((v, x) => v + vor[x] * 0.1 + q[x] * fl * 0.12), hell(f, 0.9), wi);
    }
  }
}

function schilf(s, r, o) {
  const pal = jz(SCHILF, o.jahreszeit), n = [4, 7, 12][o.detail], nk = [1, 3, 4][o.detail];
  const H = range(r, 1.4, 2.2) * o.groesse, start = r() * Math.PI * 2, segs = o.detail === 0 ? 2 : 3;
  for (let i = 0; i < n; i++) {
    const w = start + (i / n) * Math.PI * 2 + range(r, -0.4, 0.4), d = range(r, 0, 0.12);
    halm(s, [Math.cos(w) * d, -0.05, Math.sin(w) * d], w, H * range(r, 0.6, 1.0), H * 0.022, range(r, 1.35, 1.5), range(r, 0.2, 0.9), pick(r, pal), segs);
  }
  const kolben = farbe(o.jahreszeit === 'winter' ? '#6e5a44' : '#5b3b22');
  for (let i = 0; i < nk; i++) {
    const w = r() * Math.PI * 2, d = range(r, 0, 0.1), h = H * range(r, 0.85, 1.08);
    const st = bogen3(bogen(h, range(r, 1.48, 1.56), range(r, 0, 0.06), 2), w, [Math.cos(w) * d, -0.05, Math.sin(w) * d]);
    s.rohr(st, [H * 0.008, H * 0.006, H * 0.005], pick(r, pal), (t) => t * 0.8, { seiten: 3 });
    const top = st[2], kl = H * 0.12, kr = H * 0.016;
    const k0 = top.map((v, x) => v - (x === 1 ? kl * 1.15 : 0)), k1 = top.map((v, x) => v - (x === 1 ? kl * 0.15 : 0));
    s.rohr([k0, k0.map((v, x) => v + (x === 1 ? kl * 0.5 : 0)), k1, top], [kr * 0.8, kr, kr * 0.8, 0], kolben, () => 0.8,
      { seiten: o.detail === 2 ? 6 : 4, farbeFn: (j) => hell(kolben, 0.85 + 0.12 * j) });
  }
}

function seerose(s, r, o) {
  const winter = o.jahreszeit === 'winter';
  const n = [2, 3, 5][o.detail], seg = [5, 7, 10][o.detail];
  const gr = palette(winter ? ['#5a5a32', '#6b5a36'] : ['#3f7a32', '#4a8a3a', '#356f2e']);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r(), d = i === 0 ? 0.04 : range(r, 0.2, 0.38), R = range(r, 0.12, 0.22) * o.groesse;
    const c = [Math.cos(a) * d, 0.01 + i * 0.002, Math.sin(a) * d], kerbe = r() * Math.PI * 2, f = pick(r, gr);
    for (let j = 0; j < seg; j++) {
      const a0 = kerbe + 0.3 + (j / seg) * (Math.PI * 2 - 0.4), a1 = kerbe + 0.3 + ((j + 1) / seg) * (Math.PI * 2 - 0.4);
      const p0 = [c[0] + Math.cos(a0) * R, c[1], c[2] + Math.sin(a0) * R], p1 = [c[0] + Math.cos(a1) * R, c[1], c[2] + Math.sin(a1) * R];
      s.dreieckAussen(c, p0, p1, [c[0], -1, c[2]], hell(f, range(r, 0.9, 1.1)), [0, 0.15, 0.15]);
    }
  }
  if (winter || !chance(r, o.jahreszeit === 'herbst' ? 0.3 : 0.85)) return;
  const bf = o.farbe != null ? farbe(o.farbe) : farbe(pick(r, ['#f7f3f2', '#f6eef2', '#f2a6c4', '#e889b0']));
  const a = r() * Math.PI * 2, c = [Math.cos(a) * 0.1, 0.015, Math.sin(a) * 0.1], g = range(r, 0.08, 0.11) * o.groesse;
  const ringe = o.detail === 0 ? [[6, 1, 0.35]] : [[8, 1, 0.35], [6, 0.75, 0.85]];
  for (const [np, lf, steil] of ringe) {
    const off = r();
    for (let j = 0; j < np; j++) {
      const w = off + (j / np) * Math.PI * 2, ca = Math.cos(w), sa = Math.sin(w), q = [-sa, 0, ca], L = g * lf;
      const sp = [c[0] + ca * L * Math.cos(steil), c[1] + L * Math.sin(steil), c[2] + sa * L * Math.cos(steil)];
      const m = [c[0] + ca * L * 0.45, c[1] + L * 0.45 * Math.sin(steil), c[2] + sa * L * 0.45];
      const fp = mische(hell(bf, 0.85), bf, lf);
      s.dreieckZwei(c, m.map((v, x) => v + q[x] * L * 0.22), sp, fp, 0.2).dreieckZwei(c, sp, m.map((v, x) => v - q[x] * L * 0.22), fp, 0.2);
    }
  }
  s.rohr([c, [c[0], c[1] + g * 0.3, c[2]]], [g * 0.2, 0], farbe('#f2c21c'), () => 0.2, { seiten: 5 });
}

/** Bodendecker erzeugen (Vertrag: docs/NATUR-ASSETS.md). */
export function erzeuge(typ, seed = 1, opts = {}) {
  if (!TYPEN.includes(typ)) throw new Error(`pflanze-boden: unbekannter Typ '${typ}'`);
  const o = { detail: 1, jahreszeit: 'sommer', groesse: 1, ...opts };
  o.detail = Math.max(0, Math.min(2, o.detail | 0));
  const r = rng(hashSeed('boden', typ, seed));
  const s = createSammler({ seed: hashSeed('boden-farbe', typ, seed), jitter: 0.07 });
  const bau = {
    farn: () => farn(s, r, o), grasbueschel: () => grasbueschel(s, r, o), schilf: () => schilf(s, r, o), seerose: () => seerose(s, r, o),
    blume: () => baueBlume(s, r, o), pilz: () => bauePilz(s, r, o),
  };
  bau[typ]();
  return s.ergebnis({ stammRadius: 0 });
}
