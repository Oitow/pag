/**
 * @modul    baum
 * @zweck    Prozedurale Low-Poly-Bäume (14 Arten) als EINE Geometrie mit Vertexfarben + Wind-Attribut; Jahreszeit, Alter, Detailstufe
 * @api      TYPEN [typ…] ; erzeuge(typ, seed, opts) -> { geometrie, hoehe, radius, stammRadius } ; opts: { detail 0|1|2, jahreszeit 'sommer'|'herbst'|'winter', alter 0..1 }
 * @beispiel
 *   import { erzeuge } from '../../engine/models/natur/baum.js';
 *   import { standardMaterial } from '../../engine/render/mesh-builder.js';
 *   const { geometrie, hoehe } = erzeuge('birke', 7, { detail: 1, jahreszeit: 'herbst' });
 *   szene.add(new THREE.Mesh(geometrie, standardMaterial()));
 * @tags     natur, baum, wald, vegetation, lowpoly, prozedural, wind, jahreszeit
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { rng, hashSeed } from '../../core/rng.js';
import { ARTEN, art as artVon } from './baum-arten.js';
import { baueSkelett } from './baum-skelett.js';
import { createTeile, farbe, mische, abdunkeln, variiere, roehre, blob, kegel, wedel } from './natur-basis.js';

export const TYPEN = Object.keys(ARTEN);

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const HELL = farbe('#e8f0a0');

/** Baum bauen. Ursprung am Fußpunkt, y oben, Meter. Deterministisch für typ + seed + opts. */
export function erzeuge(typ, seed = 1, opts = {}) {
  const a = artVon(typ);
  const detail = clamp(opts.detail ?? 1, 0, 2) | 0, alter = clamp(opts.alter ?? 1, 0, 1);
  const zeit = opts.jahreszeit || 'sommer';
  const kahl = a.form === 'kahl' || (zeit === 'winter' && a.laubwerfend);
  const sk = baueSkelett(a, seed, { detail, alter, kahl: zeit === 'winter' && a.laubwerfend });
  const r = rng(hashSeed('baum', typ, seed, detail, zeit));
  const rr = (x, y) => x + (y - x) * r();

  // Fake-AO: Kroneninneres und Bodennähe dunkler, Unterseiten dunkler
  let km = [0, sk.spitze[1] * 0.7, 0], kr = 1;
  if (sk.laub.length) {
    km = [0, 0, 0];
    for (const l of sk.laub) { km[0] += l.pos[0]; km[1] += l.pos[1]; km[2] += l.pos[2]; }
    km = km.map((v) => v / sk.laub.length);
    for (const l of sk.laub) kr = Math.max(kr, Math.hypot(l.pos[0] - km[0], (l.pos[1] - km[1]) * 1.3, l.pos[2] - km[2]) + l.groesse);
  }
  const ao = (x, y, z, ny) => {
    const innen = clamp(Math.hypot(x - km[0], (y - km[1]) * 1.3, z - km[2]) / kr, 0, 1);
    return (0.8 + 0.2 * ny) * (0.62 + 0.38 * innen) * (0.7 + 0.3 * clamp((y + 0.2) / 1.5, 0, 1)) * 1.12;
  };
  const t = createTeile({ seed: hashSeed('baum-teile', typ, seed), jitter: 0.07, ao, schnee: zeit === 'winter' ? 0.9 : 0 });

  // ---- Rinde / Äste ----
  const rinde = farbe(a.rinde.farbe), oben = a.rinde.oben ? farbe(a.rinde.oben) : null;
  const fleck = a.rinde.flecken ? farbe(a.rinde.flecken.farbe) : null, ringe = a.rinde.ringe ? farbe(a.rinde.ringe) : null;
  const seiten = [[5, 6, 8], [3, 4, 5], [3, 3, 4], [3, 3, 3], [3, 3, 3]];
  for (const ast of sk.aeste) {
    const yMax = sk.spitze[1] || 1;
    const fFn = (i, j) => {
      let f = rinde;
      if (oben) f = mische(rinde, oben, clamp(ast.punkte[i][1] / yMax, 0, 1) ** 1.5);
      if (ringe && i % 2) f = ringe;
      if (fleck && r() < a.rinde.flecken.anteil * (ast.ordnung === 0 ? 1 : 0.5)) f = fleck;
      if (ast.ordnung > 0 && !fleck) f = abdunkeln(f, 0.92);
      return variiere(f, r, 0.05);
    };
    roehre(t, ast.punkte, ast.radien, {
      seiten: seiten[ast.ordnung][detail], farbeFn: fFn, wind: ast.wind, r,
      knorrig: ast.ordnung === 0 ? a.stamm.knorrig ?? 0 : 0, spitze: ast.ordnung > 0 || a.form === 'kahl',
    });
  }
  // Wurzelanläufe (Brettwurzeln beim Tropenbaum, sonst kleine Stammfüße)
  const nFuss = a.stamm.brett ?? (detail > 0 && a.form !== 'palme' ? 3 : 0);
  for (let k = 0; k < nFuss; k++) {
    const az = (k / nFuss) * Math.PI * 2 + r(), c = Math.cos(az), s = Math.sin(az);
    const R = sk.stammRadius, aus = a.stamm.brett ? R * 4 : R * 2.2, h = a.stamm.brett ? R * 5 : R * 1.6, d = R * (a.stamm.brett ? 0.25 : 0.5);
    const top = [c * R * 0.6, h, s * R * 0.6], aussen = [c * aus, -0.15, s * aus];
    const l = [c * R * 0.5 - s * d, -0.15, s * R * 0.5 + c * d], rr2 = [c * R * 0.5 + s * d, -0.15, s * R * 0.5 - c * d];
    const f = abdunkeln(rinde, 0.85);
    t.dreieck(l, aussen, top, f, 0); t.dreieck(aussen, rr2, top, f, 0);
  }

  // ---- Laub ----
  const lb = a.laub, liste = zeit === 'herbst' && lb.herbst?.length ? lb.herbst : lb.farben;
  const laubFarbe = () => variiere(farbe(liste[Math.floor(r() * liste.length)]), r, 0.06);
  if (!kahl && lb.form === 'kegel') {
    for (const e of sk.etagen) {
      const f = laubFarbe();
      kegel(t, e.pos, e.radius, e.hoehe, {
        seiten: detail === 0 ? 6 : a.etagen.seiten, farbe: mische(f, HELL, 0.04 + 0.1 * (e.pos[1] / sk.spitze[1])),
        unterFarbe: abdunkeln(f, 0.5), haengen: a.etagen.haengen * e.radius * 0.5, r, windUnten: e.wind, windOben: e.wind + 0.15,
      });
    }
  } else if (!kahl && lb.form === 'wedel') {
    const top = sk.laub[0], n = lb.wedel[detail], f = farbe(lb.farben[0]), fs = farbe(lb.spitze || lb.farben[0]);
    for (let i = 0; i < n; i++) {
      const az = (i / n) * Math.PI * 2 + rr(-0.25, 0.25), hoch = i % 2 ? rr(0.25, 0.6) : rr(-0.15, 0.2);
      const dir = [Math.cos(az) * Math.cos(hoch), Math.sin(hoch), Math.sin(az) * Math.cos(hoch)];
      wedel(t, top.pos, dir, top.groesse * rr(0.8, 1.1), {
        segmente: detail === 0 ? 2 : detail === 1 ? 4 : 6, breite: top.groesse * 0.2, haengen: rr(0.45, 0.75), falte: 0.35,
        farbe: variiere(mische(f, farbe(lb.farben[i % lb.farben.length]), 0.5), r, 0.06), spitzenFarbe: fs, windBasis: 0.45,
      });
    }
    blob(t, [top.pos[0], top.pos[1] - 0.1, top.pos[2]], sk.stammRadius * 1.6, { farbe: abdunkeln(rinde, 0.8), wind: 0.3, r });
    if (detail > 0) for (let i = 0; i < 3; i++) {
      const az = r() * Math.PI * 2, d = sk.stammRadius * 1.3;
      blob(t, [top.pos[0] + Math.cos(az) * d, top.pos[1] - 0.35, top.pos[2] + Math.sin(az) * d], 0.17, { farbe: farbe('#5a4a22'), wind: 0.35, r });
    }
  } else if (!kahl && lb.form !== 'keins') {
    const [sx, sy, sz] = lb.streckung || [1, 1, 1];
    const flach = lb.form === 'flach';
    for (const l of sk.laub) {
      const f = laubFarbe();
      const fFn = (ny) => (ny > 0 ? mische(f, HELL, ny * 0.16) : abdunkeln(f, 1 + ny * 0.3));
      const mitte = lb.senken ? [l.pos[0], l.pos[1] - l.groesse * lb.senken, l.pos[2]] : l.pos;
      blob(t, mitte, l.groesse, {
        stufe: detail === 2 ? 1 : 0, sx: sx * rr(0.9, 1.1), sy: sy * rr(0.9, 1.1), sz: sz * rr(0.9, 1.1),
        verformung: flach ? 0.18 : 0.26, unten: flach ? 0.4 : 0.15, farbeFn: fFn, wind: l.wind, r,
      });
      if (lb.form === 'haengend') {
        const n = Math.max(1, Math.round((lb.faeden ?? 4) * [0.5, 1, 1.5][detail]));
        for (let i = 0; i < n; i++) {
          const az = r() * Math.PI * 2, d = l.groesse * rr(0.3, 0.85);
          const p0 = [mitte[0] + Math.cos(az) * d, mitte[1] - l.groesse * 0.1, mitte[2] + Math.sin(az) * d];
          const lang = Math.min(lb.fadenLaenge * sk.groesse * rr(0.6, 1.15), p0[1] - 0.6);
          if (lang < 0.5) continue;
          const p1 = [p0[0] + Math.cos(az) * 0.25, p0[1] - lang * 0.5, p0[2] + Math.sin(az) * 0.25];
          const p2 = [p1[0] + Math.cos(az) * 0.1, p0[1] - lang, p1[2] + Math.sin(az) * 0.1];
          const ff = variiere(mische(f, HELL, 0.08), r, 0.06);
          roehre(t, detail === 0 ? [p0, p2] : [p0, p1, p2], detail === 0 ? [0.4, 0.06] : [0.42, 0.26, 0.05], {
            seiten: 3, farbe: ff, wind: detail === 0 ? [l.wind, 1] : [l.wind, 0.85, 1], spitze: false, r,
          });
        }
      }
    }
  }

  const geometrie = t.geometrie();
  t.dispose();
  const p = geometrie.attributes.position.array;
  let rad = 0;
  for (let i = 0; i < p.length; i += 3) rad = Math.max(rad, Math.hypot(p[i], p[i + 2]));
  return { geometrie, hoehe: geometrie.boundingBox.max.y, radius: rad, stammRadius: sk.stammRadius };
}
