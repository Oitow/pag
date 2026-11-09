/**
 * @modul    totholz
 * @zweck    Prozedurales Low-Poly-Totholz (Vertrag NATUR-ASSETS): baumstumpf (Jahresringe, Wurzelansätze), liegenderStamm (Aststummel), ast
 * @api      TYPEN ; erzeuge(typ, seed, opts) -> { geometrie, hoehe, radius, stammRadius }  opts: { detail 0|1|2, moos 0..1, schnee 0..1, skala }
 * @beispiel
 *   import { erzeuge } from '../../engine/models/natur/totholz.js';
 *   const { geometrie } = erzeuge('liegenderStamm', 5, { moos: 0.5 });
 *   scene.add(new THREE.Mesh(geometrie, standardMaterial()));
 * @tags     natur, totholz, baumstumpf, stamm, ast, prozedural, lowpoly, vertexfarben
 * @version  1.0.0
 * @status   neu
 * @three    ja
 */
import { rng, hashSeed, range, int } from '../../core/rng.js';
import { createNoise3D } from '../../core/noise.js';
import { createRoehrenNetz } from './totholz-form.js';
import { createSammler, rgb, mische, hell, glatt } from './fels-basis.js';

export const TYPEN = ['baumstumpf', 'liegenderStamm', 'ast'];

const RINDE = [0x5a4838, 0x4e3f31, 0x63503d, 0x55473a].map(rgb);
const ALTHOLZ = rgb(0x8a7d6c);
const RINGE = [0x7e5c3a, 0xc29a66, 0xa47b4c, 0xd3b07c].map(rgb);   // innen → außen (Kern dunkel, Splint hell)
const MOOS = [rgb(0x5d7a35), rgb(0x6c8a3c), rgb(0x52702f)], SCHNEE = rgb(0xf1f4f7);

function baumstumpf(netz, r, d) {
  const R = range(r, 0.22, 0.38), h = range(r, 0.35, 0.75), seg = [6, 9, 12][d];
  const wurzeln = int(r, 3, 5), phase = range(r, 0, 6.3);
  const neig = [range(r, -0.12, 0.12), range(r, -0.12, 0.12)];
  const ys = d === 0 ? [-0.12, 0.08, h] : [-0.12, 0.04, 0.16, h * 0.6, h];
  const pfad = ys.map((y, k) => [y * neig[0] * (k === ys.length - 1 ? 1 : 0.5), y, y * neig[1] * (k === ys.length - 1 ? 1 : 0.5)]);
  const radien = ys.map(y => R * (1 + 0.5 * Math.exp(-Math.max(0, y) / 0.12)) * (y < 0 ? 1.15 : 1));
  netz.roehre(pfad, radien, seg, {
    anfang: 'zu', ende: 'ringe', ringe: d === 0 ? 2 : 4, dreh: phase,
    form: (k, s, a) => {
      const lappen = Math.pow(Math.max(0, Math.cos(a * wurzeln / 1 - phase)), 2);
      return (1 + (ys[k] < 0.2 ? 0.35 * lappen * (1 - ys[k] / 0.2) : 0)) * (0.93 + 0.14 * Math.abs(Math.sin(k * 5.1 + s * 2.3 + phase)));
    },
  });
  // Wurzelansätze: kurze, schräg in den Boden laufende Röhren
  if (d > 0) for (let i = 0; i < wurzeln; i++) {
    const a = phase / wurzeln + i / wurzeln * Math.PI * 2 + range(r, -0.2, 0.2);
    const l = range(r, 0.25, 0.5) + R, ca = Math.cos(a), sa = Math.sin(a);
    netz.roehre([[ca * R * 0.8, 0.12, sa * R * 0.8], [ca * l * 0.7, 0.03, sa * l * 0.7], [ca * l, -0.12, sa * l]],
      [R * 0.45, R * 0.3, R * 0.12], d === 2 ? 5 : 4, { anfang: 'offen', ende: 'zu', dreh: range(r, 0, 3) });
  }
  return { stammRadius: R * 1.1 };
}

function liegenderStamm(netz, r, d) {
  const L = range(r, 2.4, 4.4), R = range(r, 0.17, 0.3), seg = [5, 7, 9][d], n = [3, 5, 7][d];
  const bieg = range(r, -0.25, 0.25), dreh = range(r, 0, Math.PI);
  const cd = Math.cos(dreh), sd = Math.sin(dreh);
  const rot = (x, y, z) => [x * cd - z * sd, y, x * sd + z * cd];
  const pfad = [], radien = [];
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1), x = (t - 0.5) * L, rad = R * (1 - 0.3 * t);
    pfad.push(rot(x, rad * 0.82 + Math.sin(t * Math.PI) * 0.03, Math.sin(t * Math.PI) * bieg));
    radien.push(rad);
  }
  netz.roehre(pfad, radien, seg, {
    anfang: 'ringe', ende: 'zu', zacken: R * 1.2, ringe: d === 0 ? 2 : 3, dreh: range(r, 0, 3),
    form: (k, s) => 0.9 + 0.2 * Math.abs(Math.sin(k * 3.7 + s * 1.9 + dreh)),
  });
  // Aststummel: kurz, schräg nach außen/oben und etwas in Stammrichtung
  const stummel = d === 0 ? 1 : int(r, 2, 4);
  for (let i = 0; i < stummel; i++) {
    const t = range(r, 0.2, 0.85), x = (t - 0.5) * L, rad = R * (1 - 0.3 * t);
    const seite = r() < 0.5 ? 1 : -1, hoch = range(r, 0.2, 0.9);
    const dir = [range(r, 0.3, 0.7), hoch, seite * (1 - hoch * 0.5)];
    const dl = Math.hypot(...dir), l = range(r, 0.18, 0.4);
    const zm = Math.sin(t * Math.PI) * bieg, ym = rad * 0.82;
    const b = [x, ym + dir[1] / dl * rad * 0.6, zm + dir[2] / dl * rad * 0.6];
    const e = [x + dir[0] / dl * l, b[1] + dir[1] / dl * l, b[2] + dir[2] / dl * l];
    netz.roehre([rot(...b), rot(...e)], [rad * 0.32, rad * 0.2], d === 2 ? 5 : 4, { anfang: 'offen', ende: 'ringe', ringe: 1 });
  }
  return { stammRadius: R };
}

function ast(netz, r, d) {
  const L = range(r, 1.0, 2.0), R = range(r, 0.035, 0.06), seg = [3, 4, 5][d], n = [3, 4, 6][d];
  const dreh = range(r, 0, Math.PI * 2), krumm = range(r, 2, 5), amp = range(r, 0.08, 0.18);
  const pfad = [], radien = [];
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1), x = (t - 0.5) * L, z = Math.sin(t * krumm) * amp;
    pfad.push([x * Math.cos(dreh) - z * Math.sin(dreh), R * (1 - 0.6 * t) * 0.9 + t * 0.04, x * Math.sin(dreh) + z * Math.cos(dreh)]);
    radien.push(R * (1 - 0.6 * t));
  }
  netz.roehre(pfad, radien, seg, { anfang: 'ringe', ringe: 1, ende: 'spitze', spitze: 0.08 });
  const zweige = d === 0 ? 1 : int(r, 1, 3);
  for (let i = 0; i < zweige; i++) {
    const k = int(r, 1, n - 2), b = pfad[k], l = range(r, 0.25, 0.6);
    const a = dreh + (r() < 0.5 ? 1 : -1) * range(r, 0.5, 1.1);
    const e = [b[0] + Math.cos(a) * l, b[1] + range(r, 0, 0.12), b[2] + Math.sin(a) * l];
    const m = [(b[0] + e[0]) / 2 + range(r, -0.05, 0.05), (b[1] + e[1]) / 2, (b[2] + e[2]) / 2 + range(r, -0.05, 0.05)];
    netz.roehre([b, m, e], [radien[k] * 0.7, radien[k] * 0.5, radien[k] * 0.3], 3, { anfang: 'offen', ende: 'spitze', spitze: 0.05 });
  }
  return { stammRadius: 0 };
}

const BAUER = { baumstumpf, liegenderStamm, ast };

/** Erzeugt Totholz laut Natur-Asset-Vertrag. */
export function erzeuge(typ, seed, opts = {}) {
  if (!BAUER[typ]) throw new Error(`totholz: unbekannter Typ '${typ}'`);
  const o = { detail: 1, moos: 0, schnee: 0, skala: 1, ...opts };
  o.detail = Math.max(0, Math.min(2, Math.round(o.detail)));
  const r = rng(hashSeed('totholz', typ, seed));
  const netz = createRoehrenNetz();
  const mass = BAUER[typ](netz, r, o.detail);
  const P = Float32Array.from(netz.punkte, v => v * o.skala);
  const fr = rng(hashSeed('totholz-farbe', typ, seed));
  const n3 = createNoise3D(hashSeed('totholz-moos', seed));
  const alt = fr() * 0.5;   // wie verwittert (grau) die Rinde ist
  const sammler = createSammler();
  sammler.netz(P, netz.dreiecke, (n, m, i) => {
    const marke = netz.marken[i];
    let c;
    if (marke.startsWith('ring')) {
      const j = +marke.slice(4);
      c = hell(RINGE[Math.min(RINGE.length - 1, j)], 0.92 + fr() * 0.12);
    } else {
      c = mische(RINDE[Math.floor(fr() * RINDE.length)], ALTHOLZ, alt + (marke === 'spitze' ? 0.4 : 0));
      c = hell(c, (0.7 + 0.3 * (n[1] + 1) / 2) * (0.9 + fr() * 0.18) * (0.8 + 0.2 * glatt(-0.1, 0.25, m[1])));
    }
    if (o.moos > 0) {
      const w = o.moos * glatt(0.1, 0.8, n[1]) + 0.3 * n3(m[0] * 3, m[1] * 3, m[2] * 3) - 0.05;
      if (w > 0.45) c = hell(MOOS[Math.floor(fr() * MOOS.length)], 0.9 + fr() * 0.2);
    }
    if (o.schnee > 0 && o.schnee * glatt(0.3, 0.8, n[1]) + 0.15 * n3(m[0] * 4, 3, m[2] * 4) > 0.4) c = hell(SCHNEE, 0.96);
    return c;
  });
  const geometrie = sammler.geometrie();
  sammler.dispose();
  let hoehe = 0, radius = 0;
  for (let i = 0; i < P.length; i += 3) { hoehe = Math.max(hoehe, P[i + 1]); radius = Math.max(radius, Math.hypot(P[i], P[i + 2])); }
  return { geometrie, hoehe, radius, stammRadius: mass.stammRadius * o.skala };
}
