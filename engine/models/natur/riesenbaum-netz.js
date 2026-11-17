/**
 * @modul    riesenbaum-netz
 * @zweck    Baut aus der Riesenbaum-Form die rohen Daten (rein, ohne THREE): SDF-Netz für Wurzeln und Stammfuß, verjüngter Stamm, Ast-Röhren, Rindenfarben, Splats, Höhenkarte
 * @api      baueRiesenbaumRoh(opts) -> { form, position, normal, farbe, index, dreiecke, splats ‹daten›, hoehenkarte, masse, teile { wurzel, stamm, aeste } } ; rindenFarbe(form) -> (x,y,z,nx,ny,nz,out) -> out ; WETTER [x,y,z]
 * @beispiel
 *   import { baueRiesenbaumRoh } from '../../engine/models/natur/riesenbaum-netz.js';
 *   const roh = baueRiesenbaumRoh({ seed: 7, bogen: true });
 *   roh.dreiecke;                       // ≤ 60 000
 *   roh.hoehenkarte.hoeheBei(9, 2);     // Höhe des Wurzelrückens dort (NaN = blanker Boden)
 * @tags     natur, baum, riesenbaum, sdf, netz, rinde, moos, splats, hoehenkarte, daemmerwald
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { hashSeed } from '../../core/rng.js';
import { createNoise3D } from '../../core/noise.js';
import { sdfNetz, sdfHoehenkarte } from '../../core/sdf-netz.js';
import { createSplatDaten, saatAufNetz } from '../../render/gauss-saat.js';
import { baueForm } from './riesenbaum-form.js';
import { laubSplats, bartSplats, farbeLin, mische } from './riesenbaum-krone.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const stufe = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Wetterseite (lokal): dort wächst das Moos am Stamm hoch. */
export const WETTER = [-0.8, 0, 0.6];
const FURCHE = farbeLin('#1b1a19'), RUECKEN = farbeLin('#716c66'), WARM = farbeLin('#55493f'), HAUCH = farbeLin('#33402b');
const MOOS = [farbeLin('#111d0d'), farbeLin('#1b2c12'), farbeLin('#33431a'), farbeLin('#566226')];
const FLECHTE = [farbeLin('#5f685a'), farbeLin('#8a8f78')];

/** Rindenfarbe: kühles, dunkles Graubraun; Furchen dunkler, Rücken heller, unten feucht-dunkel mit grünlichem Hauch. */
export function rindenFarbe(form) {
  const n3 = createNoise3D(hashSeed('riesenbaum-farbe', form.opts.seed));
  return (x, y, z, nx, ny, nz, out = [0, 0, 0]) => {
    const fu = form.furche(x, y, z), korn = n3(x * 2.3, y * 0.6, z * 2.3), gross = n3(x * 0.09, y * 0.05 + 9, z * 0.09);
    let c = mische(FURCHE, RUECKEN, clamp(0.5 + 0.3 * korn + 0.25 * gross - 0.95 * fu, 0, 1));
    c = mische(c, WARM, clamp(0.1 + 0.25 * n3(x * 0.3 + 4, y * 0.12, z * 0.3), 0, 0.35));
    const wetter = clamp(nx * WETTER[0] + nz * WETTER[2], 0, 1);
    const gruen = (1 - stufe(0.3, 8, y)) * (0.3 + 0.45 * Math.max(0, ny)) + wetter * 0.3 * (1 - stufe(6, 30, y)) + 0.12 * gross;
    c = mische(c, HAUCH, clamp(gruen, 0, 0.7));
    const hell = (0.58 + 0.42 * stufe(-0.5, 9, y)) * (0.92 + 0.12 * Math.max(0, ny));
    out[0] = c[0] * hell; out[1] = c[1] * hell; out[2] = c[2] * hell;
    return out;
  };
}

/** Verjüngter Stamm über der Naht: gleicher Querschnitt wie das SDF (Achse, Radius, Rinden-Störung), Furchen blenden nach oben aus. */
function stammNetz(form, pos, nrm, idx) {
  const { naht, achse, radius, stoer, opts } = form, H = opts.hoehe, kAb = form.masse.kronenAb, R = opts.stammRadius;
  const spalten = Math.max(10, Math.round(104 * Math.sqrt(opts.detail))), ys = [naht - 1.5, naht];
  for (let y = naht + 3; y < H * 0.965; y += y < kAb ? 3 : 4.5) ys.push(y);
  ys.push(H * 0.97);
  const basis = pos.length / 3, a = [0, 0];
  for (let j = 0; j < ys.length; j++) {
    const y = ys[j], rad = radius(y) * (j === 0 ? 0.985 : 1), ein = (1 - 0.6 * stufe(naht + 12, kAb, y)) * Math.min(1, rad / (R * 0.55));
    achse(y, a);
    for (let i = 0; i < spalten; i++) {
      const w = (i / spalten) * Math.PI * 2, cx = Math.cos(w), cz = Math.sin(w);
      let rr = rad - stoer(a[0] + cx * rad, y, a[1] + cz * rad) * ein;
      rr = rad - stoer(a[0] + cx * rr, y, a[1] + cz * rr) * ein;
      pos.push(a[0] + cx * rr, y, a[1] + cz * rr); nrm.push(0, 0, 0);
    }
  }
  const v = (j, i) => basis + j * spalten + ((i + spalten) % spalten), P = (k, c) => pos[k * 3 + c];
  for (let j = 0; j < ys.length; j++) for (let i = 0; i < spalten; i++) {           // Normalen aus den Nachbarn
    const l = v(j, i - 1), r = v(j, i + 1), u = v(Math.max(0, j - 1), i), o = v(Math.min(ys.length - 1, j + 1), i);
    const tx = P(r, 0) - P(l, 0), ty = P(r, 1) - P(l, 1), tz = P(r, 2) - P(l, 2), hx = P(o, 0) - P(u, 0), hy = P(o, 1) - P(u, 1), hz = P(o, 2) - P(u, 2);
    const nx = hy * tz - hz * ty, ny = hz * tx - hx * tz, nz = hx * ty - hy * tx, len = Math.hypot(nx, ny, nz) || 1, k = v(j, i) * 3;
    nrm[k] = nx / len; nrm[k + 1] = ny / len; nrm[k + 2] = nz / len;
    if (j + 1 < ys.length) idx.push(v(j, i), v(j + 1, i), v(j + 1, i + 1), v(j, i), v(j + 1, i + 1), v(j, i + 1));
  }
  const spitze = pos.length / 3; achse(H * 0.985, a);
  pos.push(a[0], H * 0.985, a[1]); nrm.push(0, 1, 0);
  for (let i = 0; i < spalten; i++) idx.push(v(ys.length - 1, i), spitze, v(ys.length - 1, i + 1));
}

/** Ast-Röhren aus dem Skelett (Punkte [x,y,z,radius]); leicht knorrig durch die Rinden-Störung. */
function astNetz(form, pos, nrm, idx) {
  for (const ast of form.krone.aeste) {
    const p = ast.punkte, seiten = ast.ordnung === 1 ? 10 : 7, basis = pos.length / 3;
    for (let i = 0; i < p.length; i++) {
      const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2]; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      let ux = -tz, uy = 0, uz = tx; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;       // quer = t × oben
      const vx = ty * uz - tz * uy, vy = tz * ux - tx * uz, vz = tx * uy - ty * ux;
      for (let s = 0; s < seiten; s++) {
        const w = (s / seiten) * Math.PI * 2, c = Math.cos(w), si = Math.sin(w), nx = ux * c + vx * si, ny = uy * c + vy * si, nz = uz * c + vz * si;
        const rad = p[i][3], rr = rad - form.stoer(p[i][0] + nx * rad, p[i][1] + ny * rad, p[i][2] + nz * rad) * Math.min(1, rad / 2.5) * 0.7;
        pos.push(p[i][0] + nx * rr, p[i][1] + ny * rr, p[i][2] + nz * rr); nrm.push(nx, ny, nz);
        if (i + 1 < p.length) { const k = basis + i * seiten, s1 = (s + 1) % seiten; idx.push(k + s, k + s1, k + seiten + s1, k + s, k + seiten + s1, k + seiten + s); }
      }
    }
    const e = p[p.length - 1], spitze = pos.length / 3, k = basis + (p.length - 1) * seiten;
    pos.push(e[0], e[1], e[2]); nrm.push(0, 1, 0);
    for (let s = 0; s < seiten; s++) idx.push(k + s, k + (s + 1) % seiten, spitze);
  }
}

/** Moospolster (Wurzelrücken, Wetterseite) und helle Flechten-Tupfer auf das Netz säen. */
function moosSplats(ziel, form, netz, moos, flechten) {
  const seed = form.opts.seed, n3 = createNoise3D(hashSeed('riesenbaum-moos', seed));
  let frei = moos;
  saatAufNetz(ziel, netz, { anzahl: moos * 7, seed: hashSeed('moos', seed), groesse: [0.14, 0.42], flach: 0.3, abheben: 0.05, deck: 0.9, wind: 0,
    farbe: (x, y, z, nx, ny, nz, zufall) => {
      if (frei <= 0 || y < -0.1) return null;
      const fleck = n3(x * 0.22, y * 0.14, z * 0.22), wetter = stufe(0.15, 0.75, nx * WETTER[0] + nz * WETTER[2]) * (1 - stufe(10, 28, y));
      const m = (stufe(0.5, 0.95, ny) * (1 - 0.5 * stufe(8, 20, y)) + 0.6 * wetter) * (0.55 + 0.45 * stufe(-0.3, 0.3, fleck)) + 0.3 * fleck - 0.2;
      if (zufall > m) return null;
      frei--;
      const ton = clamp(0.45 + 0.5 * n3(x * 0.6 + 5, y * 0.6, z * 0.6) + 0.3 * (zufall / Math.max(m, 0.05)) - 0.25, 0, 0.999) * 3, ti = Math.floor(ton);
      const hell = 0.6 + 0.45 * Math.max(0, ny);
      return mische(MOOS[ti], MOOS[ti + 1], ton - ti).map((v) => v * hell);
    } });
  frei = flechten;
  saatAufNetz(ziel, netz, { anzahl: flechten * 9, seed: hashSeed('flechte', seed), groesse: [0.06, 0.2], flach: 0.25, abheben: 0.04, deck: 0.75, wind: 0,
    farbe: (x, y, z, nx, ny, nz, zufall) => {
      if (frei <= 0 || y < 1.5 || y > 62 || ny > 0.75) return null;
      if (n3(x * 0.5 + 11, y * 0.35, z * 0.5) < 0.15 + zufall * 0.5) return null;
      frei--;
      return mische(FLECHTE[0], FLECHTE[1], zufall).map((v) => v * (0.7 + 0.3 * zufall));
    } });
}

/** Alles Rohe für einen Riesenbaum (ohne THREE). Deterministisch für die Optionen. */
export function baueRiesenbaumRoh(optionen = {}) {
  const form = baueForm(optionen), o = form.opts, d = clamp(o.detail, 0.2, 2), g = form.sdf.grenzen(), zelle = 0.45 / d;
  const fuss = sdfNetz(form.sdf, { zelle, grenzen: { min: [g.min[0], -1, g.min[2]], max: [g.max[0], form.naht + zelle, g.max[2]] } });
  const pos = Array.from(fuss.position), nrm = Array.from(fuss.normal), idx = Array.from(fuss.index);
  const teile = { wurzel: idx.length / 3, stamm: 0, aeste: 0 };
  stammNetz(form, pos, nrm, idx); teile.stamm = idx.length / 3 - teile.wurzel;
  astNetz(form, pos, nrm, idx); teile.aeste = idx.length / 3 - teile.wurzel - teile.stamm;

  const position = new Float32Array(pos), normal = new Float32Array(nrm), farbe = new Float32Array(pos.length), f = rindenFarbe(form), c = [0, 0, 0];
  for (let i = 0; i < pos.length; i += 3) { f(pos[i], pos[i + 1], pos[i + 2], nrm[i], nrm[i + 1], nrm[i + 2], c); farbe[i] = c[0]; farbe[i + 1] = c[1]; farbe[i + 2] = c[2]; }
  const index = pos.length / 3 > 65535 ? new Uint32Array(idx) : new Uint16Array(idx);

  const ziel = createSplatDaten(8192), menge = Math.min(1, d);
  moosSplats(ziel, form, { position, normal, index: index.subarray(0, (teile.wurzel + teile.stamm) * 3) }, Math.round(2300 * menge), Math.round(550 * menge));
  bartSplats(ziel, form.krone, { seed: o.seed, anzahl: Math.round(520 * menge) });
  laubSplats(ziel, form.krone, { seed: o.seed, anzahl: Math.round(5400 * menge), H: o.hoehe, kronenAb: form.masse.kronenAb });
  const hoehenkarte = sdfHoehenkarte(form.sdf, { zelle: 0.6, maxHoehe: 6, grenzen: { min: [g.min[0], 0, g.min[2]], max: [g.max[0], 6, g.max[2]] } });
  return { form, position, normal, farbe, index, dreiecke: index.length / 3, splats: ziel.fertig(), hoehenkarte, masse: form.masse, teile };
}
