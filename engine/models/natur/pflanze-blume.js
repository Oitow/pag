/**
 * @modul    pflanze-blume
 * @zweck    Bauteile für Bodendecker: Blume (Stängel + Blüte je Sorte: Stern, Schale, Glocke, Pompon, Ähre) und Pilze (Fliegenpilz, Steinpilz, Hexenring) in einen Pflanzen-Sammler
 * @api      baueBlume(s, r, { detail, jahreszeit, sorte, farbe }) ; baueEinenPilz(s, r, pos, sorte, skala, detail) ; bauePilz(s, r, { detail, sorte })
 * @beispiel
 *   import { createSammler } from '../../engine/models/natur/pflanze-basis.js';
 *   import { baueBlume } from '../../engine/models/natur/pflanze-blume.js';
 *   const s = createSammler({ seed: 4 }); baueBlume(s, rng(4), { detail: 1, sorte: 'mohn' });
 * @tags     natur, pflanze, blume, pilz, bodendecker, lowpoly
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { range, int, pick, chance, weighted } from '../../core/rng.js';
import { bogen3, seiteZu } from './pflanze-basis.js';
import { bogen, farbe, mische, hell, blumenSorte, PILZ_SORTEN } from './pflanze-formen.js';

const BRAUN = farbe('#7a5a34'), WELK = farbe('#6e5536');

/** Blatt als zweiseitiges Band entlang eines Bogens (Spitze am Ende). */
function blatt(s, basis, w, L, breite, steil, biegung, f, segs, windMax) {
  const pkt = bogen3(bogen(L, steil, biegung, segs), w, basis);
  const br = pkt.map((_, i) => (i === segs ? 0 : breite * Math.sin(Math.PI * (0.25 + 0.75 * i / segs))));
  s.band(pkt, seiteZu(w), br, (i, t) => mische(hell(f, 0.8), f, t + 0.3), (t) => t * windMax);
}

/** Blume: Stängel, Grundblätter, Blüte nach Sorte. */
export function baueBlume(s, r, { detail = 1, jahreszeit = 'sommer', sorte, farbe: fOpt } = {}) {
  const so = blumenSorte(r, sorte);
  const winter = jahreszeit === 'winter';
  let bf = fOpt != null ? farbe(fOpt) : farbe(pick(r, so.farben));
  if (jahreszeit === 'herbst') bf = mische(bf, BRAUN, 0.3);
  const gruen = winter ? WELK : farbe(pick(r, ['#4c8a34', '#5a9a3a', '#477f30']));
  const H = range(r, so.hoehe[0], so.hoehe[1]), g = so.groesse * range(r, 0.85, 1.15);
  const glocke = so.form === 'glocke';
  // Stängel (Glocke: oben übergebogen)
  const segs = detail === 0 ? 1 : 2;
  const w = r() * Math.PI * 2;
  const stiel = bogen3(bogen(H, glocke ? 1.45 : range(r, 1.4, 1.57), glocke ? 1.2 : range(r, 0, 0.25), segs), w);
  s.rohr(stiel, stiel.map(() => Math.max(0.003, g * 0.06)), gruen, (t) => t * 0.8, { seiten: 3 });
  const top = stiel[segs];
  // Grundblätter
  const nb = so.form === 'aehre' ? 0 : [0, 2, 3][detail] + (so.form === 'pompon' && detail ? 2 : 0);
  for (let i = 0; i < nb; i++) {
    const flachLiegend = so.form === 'pompon';
    blatt(s, [0, 0, 0], w + (i / nb) * Math.PI * 2 + range(r, -0.3, 0.3), H * (flachLiegend ? 0.6 : 0.35) * range(r, 0.8, 1.1), g * 0.35,
      flachLiegend ? 0.35 : 1.1, flachLiegend ? 0.3 : 0.7, gruen, 2, 0.5);
  }
  if (winter) {   // verblüht: kleiner dunkler Samenstand
    s.ballen(top, [g * 0.25, g * 0.3, g * 0.25], 4, 2, () => farbe('#4a3a28'), () => 0.8, 0.2);
    return;
  }
  const mitte = farbe(so.mitte), wTop = 0.85;
  if (so.form === 'stern') {
    const n = detail === 0 ? 5 : Math.min(so.blaetter, detail === 1 ? 8 : 12);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), q = [-sa, 0, ca];
      const spitze = [top[0] + ca * g, top[1] + g * 0.12, top[2] + sa * g];
      const m = [top[0] + ca * g * 0.45, top[1] + g * 0.06, top[2] + sa * g * 0.45];
      const br = g * (so.name === 'kornblume' ? 0.18 : 0.13);
      const L = m.map((v, k) => v - q[k] * br), R = m.map((v, k) => v + q[k] * br);
      const fp = hell(bf, range(r, 0.92, 1.05));
      if (detail === 0) { s.dreieckZwei(top, R, spitze, fp, wTop); continue; }
      s.dreieckZwei(top, R, spitze, fp, wTop).dreieckZwei(top, spitze, L, fp, wTop);
    }
    s.rohr([[top[0], top[1] + g * 0.02, top[2]], [top[0], top[1] + g * 0.2, top[2]]], [g * 0.28, 0], mitte, () => wTop, { seiten: detail === 0 ? 3 : 5 });
  } else if (so.form === 'schale') {
    const n = so.blaetter, reihen = detail === 0 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.3, b0 = a - 0.75, b1 = a + 0.75;
      const ring = (rad, y, ww) => [top[0] + Math.cos(ww) * rad, top[1] + y, top[2] + Math.sin(ww) * rad];
      const fp = hell(bf, range(r, 0.9, 1.05));
      let u0 = ring(g * 0.15, 0, b0), u1 = ring(g * 0.15, 0, b1);
      for (let k = 1; k <= reihen; k++) {
        const rad = g * (0.15 + 0.85 * k / reihen), y = g * 0.9 * Math.pow(k / reihen, 0.8);
        const o0 = ring(rad, y, b0 - 0.1 * k), o1 = ring(rad, y, b1 + 0.1 * k);
        const fk = hell(fp, 0.8 + 0.2 * k / reihen), ob = [-Math.cos(a), 0.5, -Math.sin(a)];
        s.dreieckZwei(u0, u1, o1, fk, wTop, hell(fp, 0.7), ob).dreieckZwei(u0, o1, o0, fk, wTop, hell(fp, 0.7), ob);
        u0 = o0; u1 = o1;
      }
    }
    s.ballen([top[0], top[1] + g * 0.25, top[2]], [g * 0.22, g * 0.22, g * 0.22], 4, 2, (ny) => (ny > 0.2 ? farbe('#5a6b3a') : mitte), () => wTop, 0.1);
  } else if (so.form === 'glocke') {
    const n = [1, 2, 3][detail];
    for (let i = 0; i < n; i++) {
      const p = i === 0 ? top : stiel[segs - 1].map((v, k) => v + (top[k] - v) * (0.4 + 0.25 * i) + (k === 1 ? -0.01 : 0));
      const L = g * 1.5, ach = [p, [p[0], p[1] - L * 0.55, p[2]], [p[0], p[1] - L, p[2]]];
      s.rohr(ach, [g * 0.12, g * 0.45, g * 0.75], bf, () => wTop, { seiten: detail === 0 ? 4 : 5, farbeFn: (k) => hell(bf, 0.85 + 0.15 * k) });
      s.rohr([[p[0], p[1] - L * 0.98, p[2]], [p[0], p[1] - L * 0.45, p[2]]], [g * 0.68, 0], hell(bf, 0.55), () => wTop, { seiten: detail === 0 ? 4 : 5 });
    }
  } else if (so.form === 'pompon') {
    const puste = jahreszeit === 'herbst' || chance(r, 0.25);
    const rad = puste ? [g * 1.1, g * 1.1, g * 1.1] : [g, g * 0.5, g];
    const c = [top[0], top[1] + rad[1] * 0.6, top[2]];
    const fb = puste ? farbe('#f4f4ee') : bf;
    s.ballen(c, rad, [5, 7, 9][detail], [2, 3, 4][detail], (ny) => (ny < -0.4 && !puste ? farbe('#4f7a2a') : hell(fb, 0.85 + 0.2 * Math.max(0, ny))), () => wTop, puste ? 0.08 : 0.15);
  } else {   // aehre (Lupine): Kegel aus Blütenringen + gefingerte Blätter
    const n = [3, 6, 8][detail], L = H * 0.4;
    const ach = Array.from({ length: n + 1 }, (_, i) => [top[0], top[1] - L * 0.15 + L * i / n, top[2]]);
    const rad = ach.map((_, i) => (i === n ? 0 : g * (1 - 0.7 * i / n) * (i % 2 ? 0.75 : 1)));
    s.rohr(ach, rad, bf, () => wTop, { seiten: 4, farbeFn: (i) => hell(bf, (i % 2 ? 1.1 : 0.85) + 0.1 * i / n), drehung: r() });
    const nb2 = [0, 2, 3][detail];
    for (let i = 0; i < nb2; i++) {
      const p = stiel[0].map((v, k) => v + (top[k] - v) * (0.15 + 0.15 * i)), ww = r() * Math.PI * 2;
      for (let k = 0; k < 5; k++) {
        const a = ww + (k - 2) * 0.5, L2 = H * 0.18;
        const sp = [p[0] + Math.cos(a) * L2, p[1] + L2 * 0.15, p[2] + Math.sin(a) * L2], q = seiteZu(a);
        const m = [p[0] + Math.cos(a) * L2 * 0.5, p[1] + L2 * 0.12, p[2] + Math.sin(a) * L2 * 0.5];
        s.dreieckZwei(p, m.map((v, j) => v + q[j] * L2 * 0.12), sp, gruen, 0.5);
      }
    }
  }
}

/** Ein Pilz an pos: Stiel + Hut (+ Punkte beim Fliegenpilz). */
export function baueEinenPilz(s, r, pos, so, skala, detail) {
  const H = range(r, so.hoehe[0], so.hoehe[1]) * skala, R = range(r, so.hutR[0], so.hutR[1]) * skala, sr = so.stielR * skala * range(r, 0.9, 1.2);
  const hutH = R * so.flach, y0 = H - hutH;
  const bauchig = so === PILZ_SORTEN.steinpilz ? 1.7 : 1;
  const st = detail === 0 ? [[0, -0.02, 0], [0, y0, 0]] : [[0, -0.02, 0], [0, y0 * 0.4, 0], [0, y0, 0]];
  const neig = range(r, -0.08, 0.08);
  const P = (p) => [pos[0] + p[0] + neig * p[1], pos[1] + p[1], pos[2] + p[2]];
  s.rohr(st.map(P), detail === 0 ? [sr * bauchig, sr] : [sr * bauchig, sr * (bauchig + 1) / 2, sr], farbe(so.stiel), () => 0,
    { seiten: detail === 0 ? 3 : 5, farbeFn: (i) => hell(farbe(so.stiel), 0.82 + 0.12 * i) });
  const seiten = [5, 7, 9][detail], hut = farbe(so.hut);
  const ach = detail === 0
    ? [[0, y0, 0], [0, y0 + hutH * 0.3, 0], [0, H, 0]]
    : [[0, y0, 0], [0, y0 + hutH * 0.25, 0], [0, y0 + hutH * 0.7, 0], [0, H, 0]];
  const rad = detail === 0 ? [sr, R, 0] : [sr, R, R * 0.78, 0];
  s.rohr(ach.map(P), rad, hut, () => 0, { seiten, farbeFn: (i) => (i === 0 ? farbe(so.unten) : hell(hut, 0.85 + 0.15 * i)) });
  if (so.punkte && detail > 0) {
    const pc = P([0, y0, 0]);
    for (let i = 0; i < 5 + detail * 2; i++) {
      const a = r() * Math.PI * 2, t = range(r, 0.15, 0.8);
      const y = y0 + hutH * (0.25 + 0.75 * t), rr = R * (1 - t * t) * 1.02 + 0.002;
      const p = P([Math.cos(a) * rr, y, Math.sin(a) * rr]), d = R * 0.13;
      const q = seiteZu(a);
      s.dreieckAussen([p[0] + q[0] * d, p[1], p[2] + q[2] * d], [p[0] - q[0] * d, p[1], p[2] - q[2] * d], [p[0], p[1] + d * 1.2, p[2]], pc, farbe(so.punkte), 0);
    }
  }
}

/** Pilz-Gruppe: sorte 'fliegenpilz' | 'steinpilz' | 'kreis' (sonst per Zufall). */
export function bauePilz(s, r, { detail = 1, sorte } = {}) {
  const name = PILZ_SORTEN[sorte] ? sorte : weighted(r, [['fliegenpilz', 4], ['steinpilz', 3.5], ['kreis', 2.5]]);
  const so = PILZ_SORTEN[name];
  if (name === 'kreis') {
    const n = [3, 8, 11][detail], R = range(r, 0.35, 0.6);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + range(r, -0.2, 0.2), rr = R * range(r, 0.9, 1.1);
      baueEinenPilz(s, r, [Math.cos(a) * rr, 0, Math.sin(a) * rr], so, range(r, 0.8, 1.3), 0);
    }
    return;
  }
  baueEinenPilz(s, r, [0, 0, 0], so, 1, detail);
  const extra = detail === 0 ? 0 : int(r, 0, detail);
  for (let i = 0; i < extra; i++) {
    const a = r() * Math.PI * 2, d = range(r, 0.1, 0.18);
    baueEinenPilz(s, r, [Math.cos(a) * d, 0, Math.sin(a) * d], so, range(r, 0.45, 0.7), detail - 1);
  }
}
