/**
 * @modul    pflanze-wueste
 * @zweck    Prozedurale Low-Poly-Wüstenpflanzen: kaktus (Kandelaber mit Armen), saeulenkaktus (gerippte Säule, evtl. Blüte), agave (Rosette spitzer, gekielter Blätter)
 * @api      TYPEN ; erzeuge(typ, seed, { detail = 1, jahreszeit = 'sommer', bluete (true/false, sonst Zufall), groesse = 1 }) -> { geometrie, hoehe, radius, stammRadius }
 * @beispiel
 *   import { erzeuge } from '../../engine/models/natur/pflanze-wueste.js';
 *   const { geometrie, stammRadius } = erzeuge('kaktus', 12, { detail: 1 });
 * @tags     natur, pflanze, wueste, kaktus, agave, sukkulente, lowpoly
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { rng, hashSeed, range, int, pick, chance } from '../../core/rng.js';
import { createSammler, bogen3, seiteZu } from './pflanze-basis.js';
import { bogen, farbe, mische, hell, rosette, kaktusArme } from './pflanze-formen.js';

export const TYPEN = ['kaktus', 'saeulenkaktus', 'agave'];

/** Rippen-Profil: abwechselnd außen (1) und innen (tiefe). */
const rippen = (anzahl, tiefe) => Array.from({ length: anzahl * 2 }, (_, k) => (k % 2 ? tiefe : 1));
const gruenRippe = (f) => (i, k) => hell(f, (k % 2 ? 0.88 : 1.04) * (0.9 + 0.05 * i));

/** Kleine Blüte (Blütenblätter-Kranz) auf einem Triebende. */
function bluete(s, r, top, g, f) {
  const n = 5, off = r();
  for (let j = 0; j < n; j++) {
    const w = off + (j / n) * Math.PI * 2, ca = Math.cos(w), sa = Math.sin(w), q = [-sa, 0, ca];
    const sp = [top[0] + ca * g, top[1] + g * 0.7, top[2] + sa * g], m = [top[0] + ca * g * 0.5, top[1] + g * 0.3, top[2] + sa * g * 0.5];
    s.dreieckZwei(top, m.map((v, x) => v + q[x] * g * 0.3), sp, hell(f, range(r, 0.9, 1.05)), 0)
      .dreieckZwei(top, sp, m.map((v, x) => v - q[x] * g * 0.3), f, 0);
  }
  s.rohr([top, [top[0], top[1] + g * 0.4, top[2]]], [g * 0.25, 0], farbe('#f2d23a'), () => 0, { seiten: 4 });
}

function kaktus(s, r, o) {
  const H = range(r, 2.2, 4.2) * o.groesse, R = H * range(r, 0.065, 0.08);
  const nr = [3, 4, 7][o.detail], prof = rippen(nr, 0.8), seiten = nr * 2;
  const gr = farbe(pick(r, ['#4f7d3a', '#5a843f', '#4a7444']));
  const kappe = (oben, rr) => [[oben[0], oben[1] - rr * 0.55, oben[2]], [oben[0], oben[1] - rr * 0.12, oben[2]], oben];
  const stamm = [[0, -0.1, 0], [0, H * 0.5, 0], ...kappe([0, H, 0], R)];
  s.rohr(stamm, [R * 1.05, R, R * 0.92, R * 0.62, 0], gr, () => 0, { seiten, profil: prof, farbeFn: gruenRippe(gr) });
  const arme = kaktusArme(r, H, o.detail === 0 ? int(r, 1, 2) : int(r, 2, 3));
  const blueht = o.jahreszeit === 'sommer' && (o.bluete ?? chance(r, 0.35));
  for (const a of arme) {
    const Ra = R * range(r, 0.62, 0.75), y0 = a.ansatz * H, cw = Math.cos(a.winkel), sw = Math.sin(a.winkel);
    const P = (h, y) => [cw * h, y0 + y, sw * h];
    const oben = P(R * 0.4 + a.aus, a.hoch);
    const weg = o.detail === 0
      ? [P(R * 0.3, -Ra * 0.3), P(R * 0.4 + a.aus, Ra * 0.6), ...kappe(oben, Ra)]
      : [P(R * 0.3, -Ra * 0.3), P(R + a.aus * 0.45, 0), P(R * 0.4 + a.aus, Ra * 1.1), ...(o.detail === 2 ? [P(R * 0.4 + a.aus, a.hoch * 0.6)] : []), ...kappe(oben, Ra)];
    const rad = weg.map((_, i) => (i === weg.length - 1 ? 0 : i === weg.length - 2 ? Ra * 0.62 : i === weg.length - 3 ? Ra * 0.92 : Ra));
    s.rohr(weg, rad, gr, () => 0, { seiten, profil: prof, farbeFn: gruenRippe(gr) });
    if (blueht && o.detail > 0) bluete(s, r, oben, Ra * 0.7, farbe('#f6f1e6'));
  }
  if (blueht) bluete(s, r, [0, H, 0], R * 0.7, farbe('#f6f1e6'));
  return { stammRadius: R * 0.95 };
}

function saeulenkaktus(s, r, o) {
  const H = range(r, 1.0, 2.4) * o.groesse, R = H * range(r, 0.09, 0.13);
  const nr = [4, 7, 10][o.detail], seiten = nr * 2, prof = rippen(nr, 0.72);
  const gr = farbe(pick(r, ['#5d8a48', '#6a9150', '#4f7f4a']));
  const saeule = (b, h, rr) => {
    const p = (y) => [b[0], b[1] + y, b[2]];
    s.rohr([p(-0.1), p(h * 0.5), p(h - rr * 0.5), p(h - rr * 0.1), p(h)], [rr, rr * 1.02, rr * 0.9, rr * 0.55, 0], gr, () => 0,
      { seiten, profil: prof, farbeFn: gruenRippe(gr), drehung: r() });
    return p(h);
  };
  const top = saeule([0, 0, 0], H, R);
  const triebe = o.detail === 0 ? 0 : int(r, 0, 2);
  for (let i = 0; i < triebe; i++) {
    const w = r() * Math.PI * 2, d = R * range(r, 1.6, 2.1);
    saeule([Math.cos(w) * d, 0, Math.sin(w) * d], H * range(r, 0.3, 0.55), R * range(r, 0.6, 0.8));
  }
  if (o.jahreszeit === 'sommer' && (o.bluete ?? chance(r, 0.5))) bluete(s, r, top, R * 0.75, farbe(pick(r, ['#e85a9c', '#f2c230', '#f07a3a'])));
  return { stammRadius: R * 0.95 };
}

function agave(s, r, o) {
  const L0 = range(r, 0.6, 1.0) * o.groesse, n = [8, 16, 22][o.detail], segs = [1, 2, 3][o.detail];
  const gr = farbe(pick(r, ['#7fa996', '#8db39c', '#7aa488'])), rand = farbe('#cdbf6a'), bunt = chance(r, 0.35);
  const spitze = farbe('#5a3c24');
  for (const b of rosette(r, n, { steil: 1.3, flach: 0.45, kurz: 0.5 })) {
    const L = L0 * b.laenge, br = L * 0.17, tief = br * 0.4;
    const pkt = bogen3(bogen(L, b.neigung, range(r, 0.05, 0.3), segs), b.winkel, [Math.cos(b.winkel) * L0 * 0.04, -0.04, Math.sin(b.winkel) * L0 * 0.04]);
    const q = seiteZu(b.winkel);
    // Querschnitt je Punkt: links, oben-mitte (Rinne), rechts, unten-mitte (Kiel)
    const qs = pkt.map((p, i) => {
      const t = i / segs, w = i === segs ? 0 : br * Math.sin(Math.PI * (0.35 + 0.5 * t)) * (i === 0 ? 0.7 : 1);
      const dn = (i < segs ? tief : 0) * (1 - t * 0.5);
      return [p.map((v, x) => v - q[x] * w), [p[0], p[1] - dn * 0.3, p[2]], p.map((v, x) => v + q[x] * w), [p[0], p[1] - dn, p[2]]];
    });
    for (let i = 0; i < segs; i++) {
      const A = qs[i], B = qs[i + 1], innen = [(A[1][0] + A[3][0]) / 2, (A[1][1] + A[3][1]) / 2, (A[1][2] + A[3][2]) / 2];
      const t = i / segs, ob = mische(gr, hell(gr, 1.15), t), un = hell(gr, 0.88);
      const fo = i === segs - 1 ? mische(ob, spitze, 0.35) : ob, fr = bunt ? mische(ob, rand, 0.6) : fo;
      const strip = (a, b, c, d, f) => {
        if (i === segs - 1) { s.dreieckAussen(a, b, c, innen, f, 0); return; }
        s.dreieckAussen(a, b, c, innen, f, 0); s.dreieckAussen(a, c, d, innen, f, 0);
      };
      strip(A[0], A[1], B[1], B[0], fr); strip(A[1], A[2], B[2], B[1], fo);
      strip(A[0], A[3], B[3], B[0], un); strip(A[3], A[2], B[2], B[3], un);
    }
  }
  return { stammRadius: L0 * 0.25 };
}

/** Wüstenpflanze erzeugen (Vertrag: docs/NATUR-ASSETS.md). Kakteen sind starr (wind = 0). */
export function erzeuge(typ, seed = 1, opts = {}) {
  if (!TYPEN.includes(typ)) throw new Error(`pflanze-wueste: unbekannter Typ '${typ}'`);
  const o = { detail: 1, jahreszeit: 'sommer', groesse: 1, ...opts };
  o.detail = Math.max(0, Math.min(2, o.detail | 0));
  const r = rng(hashSeed('wueste', typ, seed));
  const s = createSammler({ seed: hashSeed('wueste-farbe', typ, seed), jitter: 0.05 });
  const bau = { kaktus: () => kaktus(s, r, o), saeulenkaktus: () => saeulenkaktus(s, r, o), agave: () => agave(s, r, o) };
  return s.ergebnis(bau[typ]());
}
