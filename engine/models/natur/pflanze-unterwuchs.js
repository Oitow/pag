/**
 * @modul    pflanze-unterwuchs
 * @zweck    Prozeduraler Urwald-Unterwuchs: wedelfarn (gekrümmte Wedel-Karten mit gesägter Silhouette), busch_unterholz (Laubklumpen mit Blatt-Rand), moospolster (flache Kuppeln), wurzelschoessling (Wurzelknie mit Jungtrieb), laubstreu (flacher Laubfleck)
 * @api      TYPEN ; erzeuge(typ, seed, { detail = 1, jahreszeit = 'sommer', groesse = 1 }) -> { geometrie, hoehe, radius, stammRadius } ; wedelBreite(t) -> 0..1
 * @beispiel
 *   import { erzeuge } from '../../engine/models/natur/pflanze-unterwuchs.js';
 *   const farn = erzeuge('wedelfarn', 3, { detail: 1 });   // ~0,6–1,1 m hoch, Wind in den Wedelspitzen
 *   szene.add(new THREE.InstancedMesh(farn.geometrie, createNaturMaterial({ wind: true }), 500));
 * @tags     natur, pflanze, farn, busch, moos, wurzel, laub, unterholz, urwald, bodendecker, lowpoly, wind
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { rng, hashSeed, range, pick } from '../../core/rng.js';
import { createSammler, bogen3, seiteZu } from './pflanze-basis.js';
import { bogen, farbe, mische, hell } from './pflanze-formen.js';

export const TYPEN = ['wedelfarn', 'busch_unterholz', 'moospolster', 'wurzelschoessling', 'laubstreu'];

const pal = (l) => l.map(farbe);
// Gedämpfte Urwald-Töne (Art-Direction §2): Laub dunkel-olive/blaugrün, Moos als einziger sattere Grünton
const FARN = { sommer: pal(['#3d6a34', '#46753a', '#355f3a', '#4f7a36']), herbst: pal(['#8a6a2e', '#9c7a34', '#6e6a30']), winter: pal(['#6a5236', '#5e4a32']) };
const BUSCH = { sommer: pal(['#2f5634', '#36603a', '#2b4f3c', '#3d6636']), herbst: pal(['#6e5a2a', '#7c4f26', '#5a5a2c']), winter: pal(['#4a4238', '#544a3c']) };
const MOOS = { sommer: pal(['#4f6f2a', '#5b7c2e', '#476628']), herbst: pal(['#5a6a2a', '#66702e']), winter: pal(['#4e5a34', '#56603a']) };
const LAUB = pal(['#5a4630', '#6b5232', '#4e3e2c', '#76603a', '#5c5a34']);
const RINDE = pal(['#4e443a', '#584c40', '#463d35']);
const jz = (t, j) => t[j] || t.sommer;

/** Breitenprofil eines Farnwedels (t = 0 Ansatz … 1 Spitze): kurzer Stiel, Bauch bei ~40 %, spitz zulaufend. */
export function wedelBreite(t) {
  if (t <= 0.06 || t >= 1) return 0;
  const u = (t - 0.06) / 0.94;
  return Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(u, 0.75))), 0.85) * (1 - 0.3 * u);
}

/** Kuppel (Halbkugel, nur Oberseite) aus Ringen – günstiger als ein ganzer Ballen. */
function kuppel(s, r, c, rad, segU, ringe, farbeFn, windFn = () => 0, unruhe = 0.2) {
  const off = r() * Math.PI * 2, gitter = [];
  for (let j = 0; j < ringe; j++) {
    const phi = (Math.PI / 2) * (1 - j / ringe), zeile = [];
    for (let i = 0; i < segU; i++) {
      const th = off + ((i + (j % 2) * 0.5) / segU) * Math.PI * 2, k = 1 + (r() - 0.5) * 2 * unruhe;
      zeile.push([c[0] + Math.cos(phi) * Math.cos(th) * rad[0] * k, c[1] + Math.sin(phi) * rad[1] * (j ? k : 0) - (j ? 0 : 0.03), c[2] + Math.cos(phi) * Math.sin(th) * rad[2] * k]);
    }
    gitter.push(zeile);
  }
  const spitze = [c[0], c[1] + rad[1] * (1 + (r() - 0.5) * unruhe), c[2]], innen = [c[0], c[1] - rad[1], c[2]];
  const tri = (a, b, d) => {
    const ny = Math.max(0, Math.min(1, ((a[1] + b[1] + d[1]) / 3 - c[1]) / rad[1]));
    s.dreieckAussen(a, b, d, innen, farbeFn(ny), [windFn(a[1]), windFn(b[1]), windFn(d[1])]);
  };
  for (let j = 0; j < ringe; j++) {
    const A = gitter[j], B = gitter[j + 1];
    for (let i = 0; i < segU; i++) {
      const i2 = (i + 1) % segU;
      if (!B) tri(A[i], A[i2], spitze);
      else if (j % 2 === 0) { tri(A[i], A[i2], B[i]); tri(A[i2], B[i2], B[i]); } else { tri(A[i], A[i2], B[i2]); tri(A[i], B[i2], B[i]); }
    }
  }
}

/** Ein Wedel: Spindel als Bogen, je Segment eine Fieder links/rechts → Sägezahn-Silhouette; Fiedern hängen nach außen (gewölbte Karte). */
function wedel(s, r, basis, w, L, steil, biegung, k, f, welk) {
  const pkt = bogen3(bogen(L, steil - welk, biegung, k), w, basis), q = seiteZu(w + range(r, -0.15, 0.15)), W = L * range(r, 0.2, 0.26);
  const unten = mische(hell(f, 0.55), [0.16, 0.15, 0.1], 0.25);
  for (let j = 0; j < k; j++) {
    const t0 = j / k, t1 = (j + 1) / k, tm = (j + 0.6) / k, a = pkt[j], b = pkt[j + 1];
    const br = W * wedelBreite(tm);
    if (br < 1e-3) continue;
    const vor = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const fj = mische(hell(f, 0.72), hell(f, 1.22), Math.min(1, tm * 1.1)), wi = [Math.pow(t0, 1.2), Math.pow(t1, 1.2), Math.min(1, Math.pow(tm, 1.1) + 0.12)];
    for (const sg of [-1, 1]) {
      const spitze = [m[0] + q[0] * br * sg + vor[0] * 0.3, Math.max(-0.12, m[1] - br * 0.22 + vor[1] * 0.3), m[2] + q[2] * br * sg + vor[2] * 0.3];
      s.dreieckZwei(a, b, spitze, hell(fj, 0.94 + r() * 0.12), wi, unten);
    }
  }
}

function wedelfarn(s, r, o) {
  const p = jz(FARN, o.jahreszeit), n = [5, 7, 10][o.detail], k = [4, 6, 9][o.detail], welk = o.jahreszeit === 'winter' ? 0.45 : 0;
  const L0 = range(r, 0.8, 1.25) * o.groesse, start = r() * Math.PI * 2;
  for (let i = 0; i < n; i++) {
    const innen = i >= n - 2, w = start + (i / n) * Math.PI * 2 + range(r, -0.3, 0.3);
    const d = range(r, 0.02, 0.07), basis = [Math.cos(w) * d, -0.03, Math.sin(w) * d];
    wedel(s, r, basis, w, L0 * (innen ? range(r, 0.55, 0.75) : range(r, 0.8, 1.1)), innen ? range(r, 1.35, 1.5) : range(r, 1.15, 1.4),
      range(r, 0.9, 1.4), k, pick(r, p), welk);
  }
}

function buschUnterholz(s, r, o) {
  const p = jz(BUSCH, o.jahreszeit), g = o.groesse, n = [3, 4, 6][o.detail], seg = [[5, 3], [5, 3], [7, 4]][o.detail];
  const klumpen = [];
  for (let i = 0; i < n; i++) {
    const w = r() * Math.PI * 2, d = i ? range(r, 0.35, 0.65) * g : 0, R = range(r, 0.38, 0.6) * g * (i ? 0.75 : 1);
    const rad = [R, R * range(r, 0.7, 0.9), R * range(r, 0.8, 1)], c = [Math.cos(w) * d, rad[1] * range(r, 0.95, 1.05), Math.sin(w) * d];
    const f = pick(r, p);
    s.ballen(c, rad, seg[0], seg[1], (ny) => mische(hell(f, 0.45), hell(f, 1.12), (ny + 1) / 2), (y) => Math.min(0.6, Math.max(0, 0.12 + y * 0.35)), 0.24);
    klumpen.push({ c, rad, f });
  }
  // Blatt-Rand: Karten, die aus der Oberfläche ragen und die Kugel-Silhouette aufbrechen
  const nRand = [12, 30, 48][o.detail];
  for (let i = 0; i < nRand; i++) {
    const { c, rad, f } = klumpen[i % klumpen.length], th = r() * Math.PI * 2, el = range(r, -0.15, 1.1);
    const dir = [Math.cos(el) * Math.cos(th), Math.sin(el), Math.cos(el) * Math.sin(th)];
    const fuss = [c[0] + dir[0] * rad[0] * 0.92, c[1] + dir[1] * rad[1] * 0.92, c[2] + dir[2] * rad[2] * 0.92];
    const lg = range(r, 0.28, 0.48) * g, br = lg * 0.4, quer = seiteZu(th);
    const spitze = [fuss[0] + dir[0] * lg, fuss[1] + dir[1] * lg - lg * 0.15, fuss[2] + dir[2] * lg];
    const fc = hell(f, 0.85 + 0.35 * Math.max(0, dir[1])), wf = Math.min(1, 0.25 + fuss[1] * 0.4);
    s.dreieckZwei([fuss[0] - quer[0] * br, fuss[1], fuss[2] - quer[2] * br], [fuss[0] + quer[0] * br, fuss[1], fuss[2] + quer[2] * br], spitze, fc, [wf, wf, Math.min(1, wf + 0.4)]);
  }
}

function moospolster(s, r, o) {
  const p = jz(MOOS, o.jahreszeit), g = o.groesse, f = pick(r, p), seg = [[6, 2], [8, 3], [11, 4]][o.detail];
  const R = range(r, 0.4, 0.75) * g, H = range(r, 0.09, 0.18) * g;
  const ton = (k) => (ny) => mische(hell(f, 0.55 * k), hell(f, 1.15 * k), ny);
  kuppel(s, r, [0, -0.02, 0], [R, H, R * range(r, 0.65, 1)], seg[0], seg[1], ton(1), () => 0, 0.22);
  const n = [1, 2, 4][o.detail];
  for (let i = 0; i < n; i++) {
    const w = r() * Math.PI * 2, d = R * range(r, 0.55, 1.0), rr = R * range(r, 0.3, 0.5);
    kuppel(s, r, [Math.cos(w) * d, -0.02, Math.sin(w) * d], [rr, H * range(r, 0.6, 1.1), rr], Math.max(5, seg[0] - 2), Math.max(2, seg[1] - 1), ton(range(r, 0.85, 1.1)), () => 0, 0.25);
  }
}

function wurzelschoessling(s, r, o) {
  const g = o.groesse, rinde = pick(r, RINDE), moos = pick(r, jz(MOOS, o.jahreszeit)), seiten = [4, 5, 6][o.detail], k = [4, 6, 8][o.detail];
  // Wurzelknie: tritt aus dem Boden, wölbt sich und taucht wieder ein; Oberseite bemoost
  const w = r() * Math.PI * 2, L = range(r, 0.7, 1.3) * g, H = range(r, 0.18, 0.38) * g, R0 = range(r, 0.06, 0.1) * g;
  const mitte = [], radien = [];
  for (let i = 0; i <= k; i++) {
    const t = i / k, h = (t - 0.35) * L;
    mitte.push([Math.cos(w) * h, -0.06 + Math.sin(Math.PI * t) * H, Math.sin(w) * h]);
    radien.push(R0 * (1.25 - 0.55 * t));
  }
  s.rohr(mitte, radien, rinde, () => 0, { seiten, farbeFn: (i, kk) => (kk === 0 || kk === seiten - 1 || r() < 0.2 ? hell(moos, 0.85) : hell(rinde, 0.85 + r() * 0.3)) });
  // Jungtrieb am Scheitel: dünner Stamm mit zwei, drei Blattpaaren
  const top = mitte[Math.round(k * 0.45)], hT = range(r, 0.35, 0.8) * g, laub = pick(r, jz(FARN, o.jahreszeit));
  const neig = [range(r, -0.12, 0.12), hT, range(r, -0.12, 0.12)], st = [top, [top[0] + neig[0] * 0.5, top[1] + hT * 0.5, top[2] + neig[2] * 0.5], [top[0] + neig[0], top[1] + hT, top[2] + neig[2]]];
  s.rohr(st, [0.018 * g, 0.012 * g, 0], hell(rinde, 1.2), (t) => t * 0.7, { seiten: 3 });
  const paare = [2, 3, 4][o.detail];
  for (let j = 0; j < paare; j++) {
    const t = 0.45 + 0.55 * (j / Math.max(1, paare - 1)), y = top[1] + hT * t, wa = w + j * 1.7, bl = range(r, 0.1, 0.16) * g;
    for (const sg of [-1, 1]) {
      const d = [Math.cos(wa) * sg, 0, Math.sin(wa) * sg], q = seiteZu(wa), basis = [top[0] + neig[0] * t, y, top[2] + neig[2] * t];
      const sp = [basis[0] + d[0] * bl, y - bl * 0.2, basis[2] + d[2] * bl], mm = [basis[0] + d[0] * bl * 0.5, y + 0.01, basis[2] + d[2] * bl * 0.5];
      const wv = Math.min(1, 0.4 + t * 0.6);
      s.dreieckZwei(basis, [mm[0] + q[0] * bl * 0.3, mm[1], mm[2] + q[2] * bl * 0.3], sp, hell(laub, 1.05), [wv * 0.6, wv, 1]);
      s.dreieckZwei(basis, sp, [mm[0] - q[0] * bl * 0.3, mm[1], mm[2] - q[2] * bl * 0.3], hell(laub, 0.9), [wv * 0.6, 1, wv]);
    }
  }
}

function laubstreu(s, r, o) {
  const g = o.groesse, R = range(r, 0.5, 0.9) * g, n = [6, 14, 24][o.detail], ecken = [6, 8, 10][o.detail], unter = [0, -1, 0];
  // dunkler, unregelmäßiger Grund-Fleck (liegt flach, Rand leicht unter dem Boden)
  const rand = [];
  for (let i = 0; i < ecken; i++) { const w = (i / ecken) * Math.PI * 2, k = range(r, 0.7, 1.1); rand.push([Math.cos(w) * R * k, -0.015, Math.sin(w) * R * k]); }
  const mitte = [0, 0.012, 0], grund = hell(pick(r, LAUB), 0.7);
  for (let i = 0; i < ecken; i++) s.dreieckAussen(rand[i], rand[(i + 1) % ecken], mitte, unter, hell(grund, 0.9 + r() * 0.2), 0);
  // einzelne Blätter (Rauten) obendrauf
  for (let i = 0; i < n; i++) {
    const w = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 0.95, c = [Math.cos(w) * d, 0.018 + r() * 0.012, Math.sin(w) * d];
    const a = r() * Math.PI * 2, l = range(r, 0.07, 0.13) * g, b = l * 0.45, f = hell(pick(r, LAUB), range(r, 0.85, 1.25));
    const v = [Math.cos(a) * l, 0, Math.sin(a) * l], q = [-Math.sin(a) * b, 0, Math.cos(a) * b];
    const p0 = [c[0] - v[0], c[1], c[2] - v[2]], p1 = [c[0] + q[0], c[1] + 0.008, c[2] + q[2]], p2 = [c[0] + v[0], c[1], c[2] + v[2]], p3 = [c[0] - q[0], c[1] + 0.008, c[2] - q[2]];
    s.dreieckAussen(p0, p1, p2, [c[0], c[1] - 1, c[2]], f, 0);
    s.dreieckAussen(p0, p2, p3, [c[0], c[1] - 1, c[2]], hell(f, 0.9), 0);
  }
}

/** Unterwuchs erzeugen (Vertrag: docs/plaene/NATUR-ASSETS.md). */
export function erzeuge(typ, seed = 1, opts = {}) {
  if (!TYPEN.includes(typ)) throw new Error(`pflanze-unterwuchs: unbekannter Typ '${typ}'`);
  const o = { detail: 1, jahreszeit: 'sommer', groesse: 1, ...opts };
  o.detail = Math.max(0, Math.min(2, o.detail | 0));
  const r = rng(hashSeed('unterwuchs', typ, seed));
  const s = createSammler({ seed: hashSeed('unterwuchs-farbe', typ, seed), jitter: 0.08 });
  ({ wedelfarn, busch_unterholz: buschUnterholz, moospolster, wurzelschoessling, laubstreu })[typ](s, r, o);
  return s.ergebnis({ stammRadius: typ === 'busch_unterholz' ? 0.2 * o.groesse : 0 });
}
