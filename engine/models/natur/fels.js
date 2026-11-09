/**
 * @modul    fels
 * @zweck    Prozedurale Low-Poly-Felsen (Vertrag NATUR-ASSETS): fels, felsbrocken, findling, geroell, felsplatte, felsnadel – mit Gesteinsfarben, Schichtung, Moos, Schnee
 * @api      TYPEN ; GESTEINE ; erzeuge(typ, seed, opts) -> { geometrie, hoehe, radius, stammRadius }  opts: { detail 0|1|2, gestein, moos 0..1, schnee 0..1, skala }
 * @beispiel
 *   import { erzeuge } from '../../engine/models/natur/fels.js';
 *   import { standardMaterial } from '../../engine/render/mesh-builder.js';
 *   const { geometrie } = erzeuge('felsbrocken', 42, { gestein: 'granit', moos: 0.4 });
 *   scene.add(new THREE.Mesh(geometrie, standardMaterial()));
 * @tags     natur, fels, stein, geroell, prozedural, lowpoly, vertexfarben
 * @version  1.0.0
 * @status   neu
 * @three    ja
 */
import { rng, hashSeed, hash3, range, int } from '../../core/rng.js';
import { createNoise3D } from '../../core/noise.js';
import { felsForm } from './fels-form.js';
import { createSammler, rgb, mische, hell, glatt } from './fels-basis.js';

export const TYPEN = ['fels', 'felsbrocken', 'findling', 'geroell', 'felsplatte', 'felsnadel'];

/** Farbpaletten (sRGB): grund = Facettenfarben, schicht = helle/dunkle Bänder (leer = keine). */
export const GESTEINE = {
  granit: { grund: [0x8d8b86, 0x7b7975, 0x9b968e, 0x857f79, 0x92918b], schicht: [], fleck: 0xa89a8c },
  sandstein: { grund: [0xc28956, 0xb47b4b, 0xcd9763, 0xbb8452], schicht: [0xdcae79, 0x9f6640], fleck: 0xd4a678 },
  kalk: { grund: [0xc8c3b2, 0xb9b3a1, 0xd4cfbf, 0xc1bba9], schicht: [0xdcd7c7, 0xa59f8c], fleck: 0xe0dccf },
  schiefer: { grund: [0x5d6268, 0x52575e, 0x666a70, 0x585c61], schicht: [0x71767c, 0x44484e], fleck: 0x7a7f84 },
  vulkan: { grund: [0x403b39, 0x35312f, 0x4a4542, 0x3a3533], schicht: [], fleck: 0x5c3b2f },
};
const STANDARD_GESTEIN = { fels: 'granit', felsbrocken: 'granit', findling: 'granit', geroell: 'kalk', felsplatte: 'schiefer', felsnadel: 'sandstein' };
const MOOS = [rgb(0x5d7a35), rgb(0x6c8a3c), rgb(0x52702f)], FLECHTE = rgb(0xa4a86c), SCHNEE = rgb(0xf1f4f7);

/** Formparameter je Typ (r = rng, d = detail). */
function formFuer(typ, r, d) {
  const ico = [1, 2, 3][d];
  switch (typ) {
    case 'felsbrocken': return { frequenz: ico, groesse: [range(r, 1.4, 2.2), range(r, 1.0, 1.6), range(r, 1.2, 2.0)],
      schnitte: int(r, 6, 8), schnittTiefe: 0.4, schnittOben: 0.45, rauheit: 0.1, grat: 0.18, erosion: 0.08, versenkt: 0.22, kantig: 0.6, deckel: 0.12,
      frequenzRauschen: 0.9 };
    case 'findling': return { frequenz: ico, groesse: [range(r, 2.0, 3.0), range(r, 1.3, 2.0), range(r, 1.7, 2.6)],
      schnitte: int(r, 4, 6), schnittTiefe: 0.25, schnittOben: 0.35, rauheit: 0.16, grat: 0.06, erosion: 0.6, versenkt: 0.3,
      frequenzRauschen: 0.8 };
    case 'felsplatte': return { frequenz: [1, 3, 4][d], deckel: 0.3, groesse: [range(r, 1.5, 2.4), range(r, 0.45, 0.7), range(r, 1.2, 1.9)],
      schnitte: int(r, 7, 9), schnittTiefe: 0.4, schnittOben: 0.05, rauheit: 0.12, grat: 0.1, erosion: 0.1, versenkt: 0.4, kantig: 0.8,
      schichten: 2, schichtTiefe: 0.25, neigung: 0.12 };
    case 'felsnadel': return { form: 'saeule', segmente: [5, 7, 9][d], ringe: 4,
      groesse: [range(r, 0.9, 1.4), range(r, 2.6, 4.2), range(r, 0.9, 1.3)], schnitte: int(r, 3, 5), schnittTiefe: 0.25,
      schnittOben: 0.6, rauheit: 0.18, grat: 0.12, erosion: 0.2, versenkt: 0.04, schichten: [2, int(r, 4, 5), int(r, 6, 8)][d], schichtTiefe: 0.3,
      verjuengung: range(r, 0.3, 0.5), neigung: 0.08 };
    default: return { frequenz: ico, groesse: [range(r, 0.8, 1.4), range(r, 0.6, 1.0), range(r, 0.7, 1.2)],
      schnitte: int(r, 6, 8), schnittTiefe: 0.38, schnittOben: 0.5, rauheit: 0.12, grat: 0.12, erosion: 0.2, versenkt: 0.25, kantig: 0.35,
      frequenzRauschen: 1 };
  }
}

/** Farbfunktion für eine Form. */
function faerber(gestein, seed, o, hoehe, form) {
  const pal = GESTEINE[gestein] ?? GESTEINE.granit;
  const grund = pal.grund.map(rgb), schicht = pal.schicht.map(rgb), fleck = rgb(pal.fleck);
  const r = rng(hashSeed('fels-farbe', seed));
  const n3 = createNoise3D(hashSeed('fels-flecken', seed));
  // Farbbänder: bei Säulen genau auf den geometrischen Schichten, sonst frei
  const saeule = form.form === 'saeule' && form.schichten > 0;
  const bandH = saeule ? form.groesse[1] / form.schichten : Math.max(0.12, hoehe / (form.schichten ? form.schichten * 1.5 : 4));
  const phase = saeule ? form.versenkt * form.groesse[1] + bandH * 0.03 : r() * bandH;
  return (n, m) => {
    // Facettenfarbe: gleiche Ebene (gerundete Normale) → gleiche Farbe, damit Bruchflächen als eine Facette lesen
    const fh = hash3(Math.round(n[0] * 6), Math.round(n[1] * 6), Math.round(n[2] * 6), seed);
    let c = grund[Math.floor(fh * grund.length)];
    const grob = n3(m[0] * 1.3, m[1] * 1.3, m[2] * 1.3);
    if (grob > 0.45) c = mische(c, fleck, 0.45);
    if (schicht.length) {
      const band = Math.floor((m[1] + phase) / bandH);
      c = mische(c, schicht[((band % 2) + 2) % 2], 0.7);
    }
    // Fake-AO: Unterseiten und Bodennähe dunkler, Oberseiten heller
    let f = 0.78 + 0.22 * (n[1] + 1) / 2 + (n[1] > 0.5 ? 0.06 : 0);
    f *= 0.72 + 0.28 * glatt(-0.1, Math.min(0.5, hoehe * 0.4), m[1]);
    f *= 0.92 + hash3(Math.round(n[2] * 6), Math.round(n[0] * 6), Math.round(n[1] * 6), seed + 7) * 0.16;
    c = hell(c, f);
    // Moos/Flechten auf nach oben zeigenden Flächen, fleckig
    if (o.moos > 0) {
      const fl = n3(m[0] * 2.2 + 40, m[1] * 2.2, m[2] * 2.2);
      const w = o.moos * glatt(0.25, 0.85, n[1]) + 0.35 * fl - 0.1;
      if (w > 0.5) c = hell(MOOS[Math.floor(r() * MOOS.length)], 0.9 + r() * 0.2);
      else if (w > 0.28) c = mische(c, FLECHTE, 0.45);
    }
    // Schnee auf flachen, hohen Flächen
    if (o.schnee > 0) {
      const w = o.schnee * 1.3 * glatt(0.1, 0.75, n[1]) * glatt(-0.2, 0.6, m[1] / Math.max(0.3, hoehe) + o.schnee * 0.5)
        + 0.15 * n3(m[0] * 3, 7, m[2] * 3);
      if (w > 0.55) c = hell(SCHNEE, 0.95 + r() * 0.05);
      else if (w > 0.4) c = mische(c, SCHNEE, 0.5);
    }
    return c;
  };
}

/** Erzeugt einen Felsen laut Natur-Asset-Vertrag. */
export function erzeuge(typ, seed, opts = {}) {
  if (!TYPEN.includes(typ)) throw new Error(`fels: unbekannter Typ '${typ}'`);
  const o = { detail: 1, moos: 0, schnee: 0, skala: 1, ...opts };
  o.detail = Math.max(0, Math.min(2, Math.round(o.detail)));
  const gestein = o.gestein ?? STANDARD_GESTEIN[typ];
  const r = rng(hashSeed('fels', typ, seed));
  const sammler = createSammler();
  let hoehe = 0, radius = 0;

  const teile = [];
  if (typ === 'geroell') {
    const anzahl = [int(r, 3, 5), int(r, 6, 9), int(r, 7, 10)][o.detail];
    const ring = [];
    for (let i = 0; i < anzahl; i++) {
      const gross = i === 0;
      const g = gross ? range(r, 0.4, 0.6) : range(r, 0.15, 0.38);
      let x = 0, z = 0;
      for (let v = 0; v < 12; v++) {   // einfache Abstoßung, damit sich Steine kaum durchdringen
        const a = range(r, 0, Math.PI * 2), d = gross ? range(r, 0, 0.1) : range(r, 0.2, 0.65);
        x = Math.cos(a) * d; z = Math.sin(a) * d;
        if (ring.every(q => Math.hypot(q[0] - x, q[1] - z) > (q[2] + g) * 0.42)) break;
      }
      ring.push([x, z, g]);
      teile.push({ x, z, form: { frequenz: o.detail === 2 || (o.detail === 1 && gross) ? 2 : 1,
        groesse: [g * range(r, 0.9, 1.3), g * range(r, 0.45, 0.75), g * range(r, 0.8, 1.1)], schnitte: int(r, 3, 5),
        schnittTiefe: 0.4, rauheit: 0.15, grat: 0.05, erosion: 0.3, versenkt: 0.3, boden: -0.05 } });
    }
  } else teile.push({ x: 0, z: 0, form: formFuer(typ, r, o.detail) });

  for (const [k, t] of teile.entries()) {
    const fseed = hashSeed('fels-teil', typ, seed, k);
    const f = felsForm({ seed: fseed, ...t.form });
    const P = f.punkte;
    for (let i = 0; i < P.length; i += 3) {
      P[i] = (P[i] + t.x) * o.skala; P[i + 1] *= o.skala; P[i + 2] = (P[i + 2] + t.z) * o.skala;
      hoehe = Math.max(hoehe, P[i + 1]); radius = Math.max(radius, Math.hypot(P[i], P[i + 2]));
    }
    sammler.netz(P, f.dreiecke, faerber(gestein, fseed, o, f.hoehe * o.skala, t.form));
  }
  const geometrie = sammler.geometrie();
  sammler.dispose();
  return { geometrie, hoehe, radius, stammRadius: typ === 'geroell' ? 0 : radius * 0.8 };
}
