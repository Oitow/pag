/**
 * @modul    astbaum
 * @zweck    Baum mit sichtbaren Ästen, feinen Zweigen und echten Blättern (Blatt-Büschel statt Kugel-Kronen) als EINE Geometrie mit weichen Normalen, Vertexfarben + Wind
 * @api      ASTBAUM_ARTEN [typ…] ; kannAstbaum(typ) -> bool ; baueAstbaum(typ, seed, { detail 0|1|2, jahreszeit, dichte, blattGroesse }) -> { geometrie, hoehe, radius, stammRadius, kroneMitte, kroneRadius } ; baueAstbaumFern(typ, seed, { jahreszeit }) -> geometrie (~45 Dreiecke: Stamm + bis zu 5 Laub-Klumpen an den Hauptästen, für große Entfernung)
 * @beispiel
 *   import { baueAstbaum } from '../../engine/models/natur/astbaum.js';
 *   const { geometrie } = baueAstbaum('eiche', 7, { detail: 2 });   // nah: Zweige + ~500 Blatt-Büschel
 *   // Material: weich (kein flatShading), side: DoubleSide, Normalen NICHT umdrehen (Krone wird von außen beleuchtet)
 * @tags     natur, baum, aeste, zweige, blaetter, laub, nadeln, lod, wind, prozedural
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { rng, hashSeed } from '../../core/rng.js';
import { ARTEN, art as artVon } from './baum-arten.js';
import { baueSkelett } from './baum-skelett.js';
import { createTeile, farbe, mische, abdunkeln, variiere, roehre } from './natur-basis.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
const HELL = farbe('#dfe9a0');
const NADEL = new Set(['kiefer', 'pinie']);

/** Arten mit Ästen + Laub (keine Etagen-Nadelbäume, keine Palmen, nicht kahl). */
export const ASTBAUM_ARTEN = Object.freeze(Object.keys(ARTEN).filter((k) => {
  const a = ARTEN[k];
  return a.form === 'laub' && !['kegel', 'wedel', 'keins'].includes(a.laub?.form);
}));
export const kannAstbaum = (typ) => ASTBAUM_ARTEN.includes(typ);

/** Normalen nach Lage glätten (gleiche Ecke → gleiche Normale): Rinde wirkt rund statt facettiert. */
function glaetteNormalen(g) {
  const p = g.attributes.position.array, n = g.attributes.normal.array, summe = new Map(), schl = new Array(p.length / 3);
  for (let i = 0; i < p.length; i += 3) {
    const k = `${Math.round(p[i] * 500)},${Math.round(p[i + 1] * 500)},${Math.round(p[i + 2] * 500)}`;
    schl[i / 3] = k;
    const s = summe.get(k) || [0, 0, 0];
    s[0] += n[i]; s[1] += n[i + 1]; s[2] += n[i + 2]; summe.set(k, s);
  }
  for (let i = 0; i < p.length; i += 3) { const s = norm(summe.get(schl[i / 3])); n[i] = s[0]; n[i + 1] = s[1]; n[i + 2] = s[2]; }
}

/**
 * Baum bauen. Ursprung am Fußpunkt, +Y oben, Meter (Skelett-Maße, Aufrufer skaliert). Deterministisch für typ + seed + opts.
 * detail 2 = nah (feine Zweige, viele kleine Büschel), 1 = mittel (Äste, weniger größere Büschel), 0 = grob.
 */
export function baueAstbaum(typ, seed = 1, opts = {}) {
  const a = artVon(typ);
  const detail = clamp(opts.detail ?? 2, 0, 2) | 0, zeit = opts.jahreszeit || 'sommer';
  const dichte = opts.dichte ?? 1, kahl = zeit === 'winter' && a.laubwerfend, nadel = NADEL.has(typ);
  const sk = baueSkelett(a, seed, { detail, alter: 1, kahl });
  const r = rng(hashSeed('astbaum', typ, seed, detail, zeit));
  const rr = (x, y) => x + (y - x) * r();
  const kugel = () => { for (;;) { const v = [rr(-1, 1), rr(-1, 1), rr(-1, 1)]; if (dot(v, v) <= 1) return v; } };
  const lb = a.laub, [sx, sy, sz] = lb.streckung || [1, 1, 1];

  // Kronen-Mitte und -Radius (für Außen-Normalen und Schatten im Inneren)
  let km = [0, sk.spitze[1] * 0.7, 0], kr = 1;
  if (sk.laub.length) {
    km = [0, 0, 0];
    for (const l of sk.laub) { km[0] += l.pos[0]; km[1] += l.pos[1]; km[2] += l.pos[2]; }
    km = km.map((v) => v / sk.laub.length);
    for (const l of sk.laub) kr = Math.max(kr, Math.hypot((l.pos[0] - km[0]) / sx, (l.pos[1] - km[1]) / sy, (l.pos[2] - km[2]) / sz) + l.groesse);
  }
  const aussen = (p) => norm([(p[0] - km[0]) / (sx * sx), (p[1] - km[1]) / (sy * sy) + 0.25, (p[2] - km[2]) / (sz * sz)]);
  const innen = (p) => clamp(Math.hypot((p[0] - km[0]) / sx, (p[1] - km[1]) / sy, (p[2] - km[2]) / sz) / kr, 0, 1);

  // ---- Rinde: Stamm, Äste, Zweige ----
  const ao = (x, y, z, ny) => (0.78 + 0.22 * ny) * (0.55 + 0.45 * innen([x, y, z])) * (0.72 + 0.28 * clamp(y / 1.5, 0, 1)) * 1.1;
  const t = createTeile({ seed: hashSeed('astbaum-rinde', typ, seed), jitter: 0.05, ao, schnee: zeit === 'winter' ? 0.8 : 0 });
  const rinde = farbe(a.rinde.farbe), oben = a.rinde.oben ? farbe(a.rinde.oben) : null;
  const fleck = a.rinde.flecken ? farbe(a.rinde.flecken.farbe) : null;
  const seiten = [[5, 6, 7], [4, 4, 5], [3, 3, 3], [3, 3, 3], [3, 3, 3]];
  const yMax = sk.spitze[1] || 1;
  for (const ast of sk.aeste) {
    const fFn = (i) => {
      let f = oben ? mische(rinde, oben, clamp(ast.punkte[i][1] / yMax, 0, 1) ** 1.5) : rinde;
      if (fleck && r() < a.rinde.flecken.anteil * (ast.ordnung === 0 ? 1 : 0.5)) f = fleck;
      return variiere(ast.ordnung > 0 ? abdunkeln(f, 0.9) : f, r, 0.05);
    };
    roehre(t, ast.punkte, ast.radien, {
      seiten: seiten[Math.min(ast.ordnung, 4)][detail], farbeFn: fFn, wind: ast.wind, r,
      knorrig: ast.ordnung === 0 ? a.stamm.knorrig ?? 0 : 0, spitze: ast.ordnung > 0,
    });
  }
  // Stammfüße: der Stamm wächst aus dem Boden statt zu stecken
  if (detail > 0) for (let k = 0, n = 4; k < n; k++) {
    const az = (k / n) * Math.PI * 2 + r() * 0.8, c = Math.cos(az), s = Math.sin(az), R = sk.stammRadius;
    roehre(t, [[c * R * 0.4, R * 1.8, s * R * 0.4], [c * R * 1.2, R * 0.35, s * R * 1.2], [c * R * 2.4, -0.12, s * R * 2.4]],
      [R * 0.45, R * 0.35, R * 0.08], { seiten: 4, farbe: abdunkeln(rinde, 0.82), wind: 0, r, spitze: true });
  }

  // ---- Laub: feine Zweige + Blatt-Büschel an den Laub-Knoten ----
  const P = [], N = [], C = [], W = [];
  const liste = zeit === 'herbst' && lb.herbst?.length ? lb.herbst : lb.farben;
  const bg = (opts.blattGroesse ?? 1) * (nadel ? 0.34 : 0.31) * [1.75, 1.35, 1][detail];
  const ecke = (p, nf, f, w) => {
    const o = aussen(p), n = norm(add(o, nf, 0.45));
    const tief = innen(p), licht = clamp(n[1] * 0.5 + 0.5, 0, 1);
    let ff = abdunkeln(f, (0.42 + 0.58 * tief ** 0.9) * (0.8 + 0.3 * licht));
    ff = mische(ff, HELL, clamp(n[1], 0, 1) * 0.1 * tief);
    P.push(p[0], p[1], p[2]); N.push(n[0], n[1], n[2]); C.push(ff[0], ff[1], ff[2]); W.push(w);
  };
  /** Ein Blatt: Grund b, Richtung d, Fläche zeigt nach nf. Leicht gefaltet entlang der Mittelrippe. */
  const blatt = (b, d, nf, L, f, w) => {
    const s = norm(cross(d, nf)), breit = L * (nadel ? 0.09 : lb.form === 'haengend' ? 0.16 : 0.34), mitte = add(b, d, L * 0.42);
    const tip = add(add(b, d, L), nf, -L * 0.08);
    const li = add(add(mitte, s, breit), nf, breit * 0.3), re = add(add(mitte, s, -breit), nf, breit * 0.3);
    const ft = mische(f, HELL, 0.06);
    if (nadel) { ecke(li, nf, f, w); ecke(re, nf, f, w); ecke(tip, nf, ft, w + 0.1); return; }   // Nadel: ein Dreieck
    ecke(b, nf, f, w); ecke(re, nf, f, w + 0.05); ecke(tip, nf, ft, w + 0.1);
    ecke(b, nf, f, w); ecke(tip, nf, ft, w + 0.1); ecke(li, nf, f, w + 0.05);
  };
  /** Büschel: 2–3 Blätter (Nadel: 5 Nadelbündel) fächern aus einem Punkt nach außen. */
  const bueschel = (p, o, L, w) => {
    const f = variiere(farbe(liste[Math.floor(r() * liste.length)]), r, 0.07);
    const u = norm(cross(o, Math.abs(o[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])), v = cross(o, u);
    const n = nadel ? 7 : 2 + (r() < 0.5 ? 1 : 0), streu = nadel ? 1.3 : 0.8;
    for (let i = 0; i < n; i++) {
      const az = (i / n) * Math.PI * 2 + rr(-0.4, 0.4), sp = rr(0.35, 1) * streu;
      let d = norm(add(add(o, u, Math.cos(az) * sp), v, Math.sin(az) * sp));
      if (lb.form === 'haengend') d = norm(add(d, [0, -1.4, 0]));
      d = norm(add(d, [0, nadel ? 0.15 : -0.18, 0]));                    // Blätter hängen etwas, Nadeln streben nach oben
      const nf = norm(add(cross(d, cross([0, 1, 0], d)), o, 0.6));     // Fläche eher nach oben/außen
      blatt(p, d, nf, L * rr(0.75, 1.2) * (nadel ? 0.5 : 1), f, w);
    }
  };
  if (!kahl) {
    const proKnoten = Math.round((nadel ? 10 : 10) * dichte * [0.3, 0.45, 1][detail] * (lb.form === 'haengend' ? 0.35 : 1));
    for (const l of sk.laub) {
      const g = l.groesse, w = Math.min(1, l.wind + 0.12), basis = norm(add(aussen(l.pos), l.richtung, 0.6));
      // feine Zweige (nur nah): von hier aus nach außen, daran die Büschel
      const zweige = [];
      const nz = detail === 2 ? 2 : detail === 1 ? 2 : 0;
      for (let k = 0; k < nz; k++) {
        const d = norm(add(add(basis, kugel(), 0.75), [0, lb.form === 'haengend' ? -0.6 : 0.12, 0]));
        const len = g * rr(0.7, 1.15) * (lb.form === 'flach' ? 1.2 : 1);
        const e = add(l.pos, [d[0] * len * sx, d[1] * len * sy, d[2] * len * sz]);
        const m = add(add(l.pos, e), [0, -len * 0.08 - (lb.form === 'haengend' ? len * 0.3 : 0), 0], 1).map((x) => x * 0.5);
        zweige.push([l.pos, m, e]);
        if (detail === 2) roehre(t, [l.pos, m], [Math.max(0.012, sk.stammRadius * 0.05), 0.008],
          { seiten: 3, farbe: abdunkeln(rinde, 0.78), wind: [l.wind, w], r, spitze: true });
      }
      if (lb.form === 'haengend') {   // Hängefäden: dünne Ruten, Blätter daran nach unten
        const nf = Math.max(2, Math.round((lb.faeden ?? 4) * [0.3, 0.4, 0.55][detail]));
        for (let k = 0; k < nf; k++) {
          const az = r() * Math.PI * 2, dd = g * rr(0.2, 0.9);
          const p0 = [l.pos[0] + Math.cos(az) * dd, l.pos[1] - g * 0.1, l.pos[2] + Math.sin(az) * dd];
          const lang = Math.min((lb.fadenLaenge ?? 0.5) * sk.groesse * rr(0.6, 1.1), p0[1] - 0.5);
          if (lang < 0.4) continue;
          const p2 = [p0[0] + Math.cos(az) * 0.3, p0[1] - lang, p0[2] + Math.sin(az) * 0.3];
          if (detail === 2) roehre(t, [p0, p2], [0.012, 0.004], { seiten: 3, farbe: abdunkeln(rinde, 0.85), wind: [w, 1], r, spitze: true });
          const schritte = Math.round(lang / (g * bg * 2.2));
          for (let j = 0; j < schritte; j++) {
            const q = add(p0, sub(p2, p0), (j + rr(0.2, 0.8)) / schritte);
            bueschel(q, norm([Math.cos(az), -0.3, Math.sin(az)]), g * bg * 2.4, Math.min(1, w + 0.25 * j / schritte));
          }
        }
      }
      for (let i = 0; i < proKnoten; i++) {
        let p;
        if (zweige.length && r() < 0.7) {   // entlang eines Zweigs (äußere Hälfte)
          const z = zweige[i % zweige.length], s = rr(0.35, 1), q = s < 0.5 ? 0 : 1, tt = s < 0.5 ? s * 2 : (s - 0.5) * 2;
          p = add(z[q], sub(z[q + 1], z[q]), tt);
          p = add(p, kugel(), g * 0.18);
        } else {                            // als Hülle um den Knoten (dichter außen)
          const k = norm(kugel()), rad = g * Math.sqrt(rr(0.25, 1)) * 0.9;
          p = add(l.pos, [k[0] * rad * sx, k[1] * rad * sy, k[2] * rad * sz]);
        }
        bueschel(p, norm(add(aussen(p), kugel(), 0.5)), g * bg * 2.2, w);
      }
    }
    // Laub entlang der äußeren Äste: füllt die Krone, Äste bleiben dazwischen sichtbar
    const gMittel = sk.laub.reduce((m, l) => m + l.groesse, 0) / Math.max(1, sk.laub.length);
    const minOrd = Math.max(1, sk.maxOrdnung - 1);
    for (const ast of sk.aeste) {
      if (ast.ordnung < minOrd || ast.punkte.length < 2) continue;
      const n = Math.round(ast.laenge / Math.max(0.2, gMittel) * (nadel ? 2 : 3) * dichte * [0.25, 0.4, 1][detail]);
      for (let i = 0; i < n; i++) {
        const s = rr(0.35, 1) * (ast.punkte.length - 1), k = Math.min(ast.punkte.length - 2, Math.floor(s));
        const q = add(ast.punkte[k], sub(ast.punkte[k + 1], ast.punkte[k]), s - k);
        const p = add(q, kugel(), gMittel * 0.35);
        const w = Math.min(1, (ast.wind[k] ?? 0.5) + 0.15);
        bueschel(p, norm(add(aussen(p), kugel(), 0.6)), gMittel * bg * 2, w);
      }
    }
  }

  // ---- zusammensetzen ----
  const rindeGeo = t.geometrie(); t.dispose();
  glaetteNormalen(rindeGeo);
  let geometrie = rindeGeo;
  if (P.length) {
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    lg.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    lg.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    lg.setAttribute('wind', new THREE.Float32BufferAttribute(W, 1));
    geometrie = verbinde(rindeGeo, lg);
  }
  geometrie.computeBoundingBox(); geometrie.computeBoundingSphere();
  const p = geometrie.attributes.position.array;
  let rad = 0;
  for (let i = 0; i < p.length; i += 3) rad = Math.max(rad, Math.hypot(p[i], p[i + 2]));
  return { geometrie, hoehe: geometrie.boundingBox.max.y, radius: rad, stammRadius: sk.stammRadius, kroneMitte: km, kroneRadius: kr };
}

/** Zwei nicht indizierte Geometrien mit position/normal/color/wind aneinanderhängen. */
function verbinde(a, b) {
  const g = new THREE.BufferGeometry();
  for (const [name, n] of [['position', 3], ['normal', 3], ['color', 3], ['wind', 1]]) {
    const x = a.attributes[name].array, y = b.attributes[name].array, z = new Float32Array(x.length + y.length);
    z.set(x); z.set(y, x.length);
    g.setAttribute(name, new THREE.BufferAttribute(z, n));
  }
  a.dispose(); b.dispose();
  return g;
}

/** Fern-Form (~45 Dreiecke): Stamm + je Hauptast-Knoten ein unregelmäßiger Laub-Klumpen → Silhouette wie der nahe Baum, keine Kugel. */
export function baueAstbaumFern(typ, seed = 1, opts = {}) {
  const a = artVon(typ), zeit = opts.jahreszeit || 'sommer';
  const sk = baueSkelett(a, seed, { detail: 0, alter: 1, kahl: zeit === 'winter' && a.laubwerfend });
  const r = rng(hashSeed('astbaum-fern', typ, seed));
  const lb = a.laub, [sx, sy, sz] = lb.streckung || [1, 1, 1];
  const liste = zeit === 'herbst' && lb.herbst?.length ? lb.herbst : lb.farben;
  const t = createTeile({ seed: hashSeed('astbaum-fern-t', typ, seed), jitter: 0.12 });
  const rinde = farbe(a.rinde.farbe);
  const st = sk.aeste[0];
  roehre(t, [st.punkte[0], st.punkte[st.punkte.length - 1]], [st.radien[0], st.radien[st.radien.length - 1]], { seiten: 3, farbe: rinde, wind: [0, 0.3], r, spitze: true });
  const geos = [t.geometrie()]; t.dispose();
  const hoch = lb.form === 'haengend' ? 1.9 : 1;
  // höchstens 5 Klumpen (Oktaeder, verbeult) → ~45 Dreiecke; die größten Knoten zuerst
  const knoten = [...sk.laub].sort((x, y) => y.groesse - x.groesse).slice(0, 5), mehr = Math.sqrt(sk.laub.length / Math.max(1, knoten.length));
  for (const l of knoten) {
    const g = new THREE.OctahedronGeometry(mehr, 0);   // schon nicht indiziert
    const pp = g.attributes.position, f = farbe(liste[Math.floor(r() * liste.length)]);
    const col = new Float32Array(pp.count * 3), wnd = new Float32Array(pp.count).fill(Math.min(1, l.wind + 0.1));
    for (let i = 0; i < pp.count; i++) {
      const y = pp.getY(i), k = 0.85 + r() * 0.3;                 // Ecken einzeln verbeulen
      pp.setXYZ(i, pp.getX(i) * k * l.groesse * sx * 1.25 + l.pos[0], (y * k * sy * hoch * 0.72 - (hoch - 1) * 0.6) * l.groesse * 1.2 + l.pos[1], pp.getZ(i) * k * l.groesse * sz * 1.25 + l.pos[2]);
      const c = abdunkeln(f, (0.5 + 0.35 * (y / mehr * 0.5 + 0.5)) * (0.85 + 0.3 * r()));   // dunkler wie die nahe Krone (Eigenschatten)
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    }
    g.deleteAttribute('uv'); g.computeVertexNormals();
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('wind', new THREE.BufferAttribute(wnd, 1));
    geos.push(g);
  }
  let geo = geos[0];
  for (let i = 1; i < geos.length; i++) geo = verbinde(geo, geos[i]);
  geo.computeBoundingBox();
  return geo;
}
