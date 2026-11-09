/**
 * @modul    pflanze-busch
 * @zweck    Prozedurale Low-Poly-Büsche: busch (Laubballen + Zweige), beerenbusch (rote/blaue Beeren), ginster (Ruten mit gelben Blüten), zwergstrauch (flach, heidekrautig)
 * @api      TYPEN ; erzeuge(typ, seed, { detail = 1, jahreszeit = 'sommer', beere: 'rot'|'blau', groesse = 1 }) -> { geometrie, hoehe, radius, stammRadius }
 * @beispiel
 *   import { erzeuge } from '../../engine/models/natur/pflanze-busch.js';
 *   const { geometrie } = erzeuge('beerenbusch', 42, { jahreszeit: 'herbst' });
 *   szene.add(new THREE.Mesh(geometrie, standardMaterial()));
 * @tags     natur, pflanze, busch, strauch, beeren, ginster, heide, lowpoly, wind
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { rng, hashSeed, range, int, pick, chance } from '../../core/rng.js';
import { createSammler, bogen3 } from './pflanze-basis.js';
import { bogen, farbe, mische, hell, laubFarben } from './pflanze-formen.js';

export const TYPEN = ['busch', 'beerenbusch', 'ginster', 'zwergstrauch'];

const HOLZ = farbe('#5a4130'), SCHNEE = farbe('#f2f5f8');
const SEG = [[5, 3], [7, 4], [9, 5]];   // Ballen-Auflösung je detail

/** Farbfunktion für Laub: unten dunkel (Fake-AO), oben hell, im Winter Schnee auf der Oberseite. */
function laubFarbe(r, pal, jahreszeit) {
  return (ny) => {
    const g = pick(r, pal.grund);
    if (jahreszeit === 'winter' && ny > 0.55) return SCHNEE;
    if (ny < 0) return mische(g, pal.dunkel, Math.min(1, -ny * 0.9 + 0.15));
    return ny > 0.6 ? mische(g, pal.hell, (ny - 0.6) * 1.2) : g;
  };
}

/** Laubballen rund um die Mitte verteilen; gibt die Ballen [{c, rad}] zurück. */
function laubBallen(s, r, { hoehe, breite, anzahl, seg, farbeFn, flach = 1, windFn, streu = [0.35, 0.62], groesse = 1 }) {
  const ballen = [];
  for (let i = 0; i < anzahl; i++) {
    const zentral = i === 0;
    const w = r() * Math.PI * 2, d = zentral ? 0 : breite * range(r, streu[0], streu[1]);
    const rb = (zentral ? 0.5 : range(r, 0.3, 0.42)) * hoehe * groesse;
    const rad = [rb * range(r, 1.0, 1.25), rb * flach * range(r, 0.8, 0.95), rb * range(r, 1.0, 1.25)];
    const cy = zentral ? hoehe - rad[1] : Math.max(rad[1] * 0.7, hoehe * range(r, 0.3, 0.55));
    const c = [Math.cos(w) * d, cy, Math.sin(w) * d];
    s.ballen(c, rad, seg[0], seg[1], farbeFn, windFn, 0.2);
    ballen.push({ c, rad });
  }
  return ballen;
}

/** Kurze Zweige vom Boden zu den Ballen. */
function zweige(s, ballen, dicke, anzahl) {
  for (let i = 0; i < Math.min(anzahl, ballen.length); i++) {
    const { c } = ballen[i];
    s.rohr([[c[0] * 0.15, -0.05, c[2] * 0.15], [c[0] * 0.8, c[1] * 0.75, c[2] * 0.8]], [dicke, dicke * 0.5], HOLZ, (t) => t * 0.15, { seiten: 3 });
  }
}

/** Kahle Ruten (Winter): vom Boden fächerförmig nach oben, mit kleiner Gabel. */
function kahleZweige(s, r, hoehe, breite, anzahl) {
  for (let i = 0; i < anzahl; i++) {
    const w = r() * Math.PI * 2, L = hoehe * range(r, 0.75, 1.05);
    const pkt = bogen3(bogen(L, range(r, 0.9, 1.35), range(r, -0.2, 0.3), 2), w);
    s.rohr(pkt, [hoehe * 0.025, hoehe * 0.015, 0], HOLZ, (t) => t * 0.5, { seiten: 3 });
    const m = pkt[1], w2 = w + range(r, -0.9, 0.9);
    s.rohr([m, [m[0] + Math.cos(w2) * L * 0.3, m[1] + L * 0.3, m[2] + Math.sin(w2) * L * 0.3]], [hoehe * 0.012, 0], HOLZ, () => 0.6, { seiten: 3 });
  }
}

/** Punkt auf der Oberfläche eines Ballens (eher seitlich/oben). */
function aufBallen(r, b, minY = -0.2) {
  const w = r() * Math.PI * 2, y = range(r, minY, 0.85), q = Math.sqrt(1 - y * y);
  return [b.c[0] + Math.cos(w) * q * b.rad[0] * 0.98, b.c[1] + y * b.rad[1] * 0.98, b.c[2] + Math.sin(w) * q * b.rad[2] * 0.98];
}

function busch(s, r, o, beeren) {
  const winter = o.jahreszeit === 'winter';
  const hoehe = range(r, 0.9, 1.6) * o.groesse, breite = hoehe * range(r, 0.8, 1.1);
  const pal = laubFarben(o.jahreszeit);
  const ton = mische([1, 1, 1], pick(r, [[1.08, 1.04, 0.8], [0.9, 1.02, 1.08], [1, 1, 1]]), r());
  pal.grund = pal.grund.map((g) => hell([g[0] * ton[0], g[1] * ton[1], g[2] * ton[2]], 1));
  const anzahl = winter ? 0 : [3, int(r, 5, 6), int(r, 8, 9)][o.detail];
  const windFn = (y) => Math.min(1, 0.1 + 0.5 * (y / hoehe));
  const ballen = laubBallen(s, r, {
    hoehe, breite, anzahl, seg: SEG[o.detail], groesse: winter ? 0.3 : 1,
    farbeFn: laubFarbe(r, pal, o.jahreszeit), windFn,
  });
  zweige(s, ballen, hoehe * 0.035, o.detail === 0 ? 2 : 4);
  if (winter) kahleZweige(s, r, hoehe, breite, [4, 13, 20][o.detail]);
  if (beeren) {
    const rot = o.beere ? o.beere === 'rot' : chance(r, 0.55);
    const bf = farbe(rot ? '#c8142c' : '#36397f'), bh = farbe(rot ? '#ff5a5a' : '#7c84d6');
    const n = [5, 12, 22][o.detail] + (o.jahreszeit === 'herbst' ? 4 : 0) - (winter ? 8 : 0);
    const br = hoehe * 0.06;
    for (let i = 0; i < n; i++) {
      const p = aufBallen(r, ballen[i % ballen.length]);
      s.ballen(p, [br, br, br], o.detail === 2 ? 5 : 4, 2, (ny) => (ny > 0.3 ? bh : bf), () => windFn(p[1]), 0.1);
    }
  }
  return { stammRadius: breite * 0.3 };
}

function ginster(s, r, o) {
  const hoehe = range(r, 1.0, 1.8) * o.groesse;
  const ruten = [7, 16, 24][o.detail], bluete = o.jahreszeit === 'sommer';
  const gruen = [farbe('#3f6b2a'), farbe('#4d7a2f'), farbe('#35602a')], gelb = [farbe('#f7d21c'), farbe('#ffe23a'), farbe('#eab50f')];
  const segs = o.detail === 0 ? 1 : 2;
  for (let i = 0; i < ruten; i++) {
    const w = r() * Math.PI * 2, L = hoehe * range(r, 0.7, 1.08);
    const pkt = bogen3(bogen(L, range(r, 1.05, 1.45), range(r, 0.25, 0.6), segs), w, [Math.cos(w) * 0.04, -0.05, Math.sin(w) * 0.04]);
    const g = pick(r, gruen);
    const radien = pkt.map((_, k) => (k === segs ? 0 : hoehe * 0.03 * (1 - k / (segs + 1))));
    s.rohr(pkt, radien, g, (t) => t * 0.9, { seiten: 3, farbeFn: (k) => hell(g, 0.75 + 0.2 * k) });
    if (!bluete && o.jahreszeit !== 'herbst') continue;
    const nb = [1, 2, 3][o.detail];
    for (let b = 0; b < nb; b++) {
      const t = 0.97 - b * 0.22 - r() * 0.1, k = t * segs, i0 = Math.min(segs - 1, Math.floor(k)), f = k - i0;
      const p = pkt[i0].map((v, j) => v + (pkt[i0 + 1][j] - v) * f);
      const gr = hoehe * (bluete ? 0.055 : 0.03) * range(r, 0.8, 1.2);
      const fb = bluete ? pick(r, gelb) : farbe('#3a2a1c');
      s.ballen(p, [gr, gr * 1.3, gr], 3, 2, (ny) => (ny > 0 ? hell(fb, 1.1) : fb), () => t * 0.9, 0.25);
    }
  }
  if (o.detail > 0) s.ballen([0, hoehe * 0.22, 0], [hoehe * 0.2, hoehe * 0.22, hoehe * 0.2], 6, 3, (ny) => hell(gruen[2], 0.7 + ny * 0.2), (y) => y / hoehe, 0.2);
  return { stammRadius: hoehe * 0.12 };
}

function zwergstrauch(s, r, o) {
  const hoehe = range(r, 0.25, 0.42) * o.groesse, breite = hoehe * range(r, 1.4, 1.9);
  const lila = o.jahreszeit === 'sommer' ? [farbe('#b06aaa'), farbe('#c17dbb'), farbe('#9a5596')]
    : o.jahreszeit === 'herbst' ? [farbe('#8a4a32'), farbe('#9c6a3a')] : [farbe('#6b5747'), farbe('#5c4e42')];
  const grund = [farbe('#5d6b38'), farbe('#6b6a3e'), farbe('#56603a')];
  // Flaches Polster, dicht besetzt mit kleinen Trieb-Kegeln (heidekrautige Textur)
  const seg = [[6, 2], [7, 3], [9, 4]][o.detail];
  const polster = { c: [0, 0, 0], rad: [breite * 0.62, hoehe * 0.45, breite * 0.58] };
  s.ballen(polster.c, polster.rad, seg[0], seg[1], (ny) => (ny < 0 ? hell(grund[2], 0.6) : pick(r, grund)), () => 0.05, 0.2);
  const winterWeiss = (oben) => o.jahreszeit === 'winter' && oben > 0.4 && chance(r, 0.7);
  const tuffs = [6, 22, 36][o.detail], tseg = o.detail === 2 ? [5, 3] : [4, 2];
  for (let i = 0; i < tuffs; i++) {
    const p = aufBallen(r, polster, -0.1), oben = (p[1] - polster.c[1]) / polster.rad[1], rb = hoehe * range(r, 0.22, 0.32);
    const lilaAnteil = 0.25 + oben * 0.6;
    s.ballen([p[0], p[1] + rb * 0.3, p[2]], [rb, rb * range(r, 0.8, 1.1), rb], tseg[0], tseg[1],
      (ny) => (ny > 0.3 && winterWeiss(oben) ? SCHNEE : ny < -0.3 ? hell(grund[0], 0.7) : chance(r, lilaAnteil) ? pick(r, lila) : pick(r, grund)),
      (y) => 0.05 + 0.3 * y / hoehe, 0.3);
  }
  for (let i = 0; i < [0, 14, 24][o.detail]; i++) {
    const p = aufBallen(r, polster, 0.3), L = hoehe * range(r, 0.35, 0.55);
    const top = [p[0] + range(r, -0.2, 0.2) * L, p[1] + L, p[2] + range(r, -0.2, 0.2) * L];
    s.rohr([p, top], [hoehe * 0.05, 0], pick(r, lila), (t) => 0.2 + 0.3 * t, { seiten: 3, drehung: r() * 3 });
  }
  return { stammRadius: 0 };
}

/** Busch erzeugen (Vertrag: docs/NATUR-ASSETS.md). */
export function erzeuge(typ, seed = 1, opts = {}) {
  if (!TYPEN.includes(typ)) throw new Error(`pflanze-busch: unbekannter Typ '${typ}'`);
  const o = { detail: 1, jahreszeit: 'sommer', groesse: 1, ...opts };
  o.detail = Math.max(0, Math.min(2, o.detail | 0));
  const r = rng(hashSeed('busch', typ, seed));
  const s = createSammler({ seed: hashSeed('busch-farbe', typ, seed) });
  const bau = { busch: () => busch(s, r, o, false), beerenbusch: () => busch(s, r, o, true), ginster: () => ginster(s, r, o), zwergstrauch: () => zwergstrauch(s, r, o) };
  return s.ergebnis(bau[typ]());
}
