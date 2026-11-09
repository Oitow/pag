/**
 * @modul    baum-skelett
 * @zweck    Ast-Skelett eines Baums aus Art-Parametern + Seed: rekursive Verzweigung mit Tropismus, Krümmung, Verjüngung, Laub-Knoten und Nadel-Etagen (reine Logik)
 * @api      baueSkelett(art, seed, opts) -> { aeste[{punkte,radien,wind,ordnung,laenge}], laub[{pos,richtung,groesse,wind,ordnung}], etagen[{pos,radius,hoehe}], spitze, stammRadius, maxOrdnung, groesse } ; maxOrdnung(art, detail, opts) -> int
 * @beispiel
 *   import { art } from '../../engine/models/natur/baum-arten.js';
 *   import { baueSkelett } from '../../engine/models/natur/baum-skelett.js';
 *   const sk = baueSkelett(art('eiche'), 42, { detail: 1, alter: 1 });
 *   sk.aeste.length; sk.laub.length;
 * @tags     natur, baum, skelett, verzweigung, prozedural, l-system
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { rng, hashSeed } from '../../core/rng.js';

const GRAD = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const add = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

/** Richtung d um winkel kippen, Kipp-Seite über azimut (Radiant) um d herum. */
function kippe(d, winkel, azimut) {
  const u = norm(cross(d, Math.abs(d[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0])), v = cross(d, u);
  const s = [u[0] * Math.cos(azimut) + v[0] * Math.sin(azimut), u[1] * Math.cos(azimut) + v[1] * Math.sin(azimut), u[2] * Math.cos(azimut) + v[2] * Math.sin(azimut)];
  return norm(add([d[0] * Math.cos(winkel), d[1] * Math.cos(winkel), d[2] * Math.cos(winkel)], s, Math.sin(winkel)));
}

const PROFILE = {
  kugel: (t) => 0.35 + 0.75 * Math.sin(Math.PI * (0.15 + 0.8 * t)),
  kegel: (t) => 1.1 - 0.85 * t,
  schirm: (t) => 0.6 + 0.5 * t,
  gleich: () => 1,
};

/** Höchste Astordnung für detail (0/1/2), alter und Winter (kahl → eine Ordnung mehr). */
export function maxOrdnung(art, detail = 1, opts = {}) {
  if (!art.ordnungen) return 0;
  let m = art.ordnungen - (2 - clamp(detail | 0, 0, 2));
  if ((opts.alter ?? 1) < 0.35) m -= 1;
  if (opts.kahl && detail > 0) m += 1;
  return clamp(m, 1, art.ordnungen + 1);
}

/**
 * Skelett bauen. opts: { detail = 1, alter = 1 (0..1: Größe/Ordnungen), kahl = false (Winter: feinere Zweige) }
 * Ursprung am Fußpunkt, y nach oben, Meter.
 */
export function baueSkelett(art, seed = 1, opts = {}) {
  const detail = clamp(opts.detail ?? 1, 0, 2), alter = clamp(opts.alter ?? 1, 0, 1);
  // Eigene Zufallsquelle je Ast (über seinen Pfad) → Grundgerüst bleibt über alle Detailstufen gleich
  let r = rng(hashSeed('baum-skelett', seed));
  const rr = (a, b) => a + (b - a) * r();
  const groesse = (0.3 + 0.7 * alter) * rr(1 - (art.groesseVar ?? 0.1), 1 + (art.groesseVar ?? 0.1));
  const dicke = groesse * (0.75 + 0.25 * alter);
  const maxOrd = maxOrdnung(art, detail, opts);
  const st = art.stamm;
  const aeste = [], laub = [], etagen = [];
  const segFaktor = [0.6, 1, 1.4][detail];
  const astZahl = [1, 1, 1.15][detail];
  const laubSkala = Math.pow(1.35, Math.max(0, art.ordnungen - 1) - Math.min(maxOrd, art.ordnungen));
  const lb = art.laub || {};

  function wachse(start, dir, laenge, radius, ordnung, wind0, bogenDir, id) {
    const rSeg = rng(hashSeed('ast-form', seed, id)), rKind = rng(hashSeed('ast-kind', seed, id));
    r = rSeg;
    const nSeg = Math.max(ordnung === 0 ? 2 : 1, Math.round((ordnung === 0 ? st.segmente : Math.max(2, 4 - ordnung)) * segFaktor));
    const trop = ordnung === 0 ? 0 : (art.tropismus[ordnung - 1] ?? 0);
    const krumm = ordnung === 0 ? st.krumm : (art.krumm[ordnung - 1] ?? 0.2);
    const spitzeR = ordnung === 0 ? st.spitze : 0.35;
    const punkte = [start], radien = [radius], wind = [wind0];
    let p = start, d = dir;
    for (let i = 1; i <= nSeg; i++) {
      const t = i / nSeg;
      d = norm([d[0] + (r() - 0.5) * krumm, d[1] + (r() - 0.5) * krumm * 0.5 + trop, d[2] + (r() - 0.5) * krumm]);
      if (bogenDir) d = norm(add(d, bogenDir, st.bogen));
      p = add(p, d, laenge / nSeg);
      punkte.push(p);
      radien.push(radius * (1 - (1 - spitzeR) * t));
      wind.push(ordnung === 0 ? 0.12 * t * t : clamp(wind0 + (ordnung === 1 ? 0.35 : 0.3) * t, 0, 1));
    }
    const ast = { punkte, radien, wind, ordnung, laenge };
    aeste.push(ast);

    // Kinder
    let kinder = 0;
    if (ordnung < maxOrd) {
      const n = Math.max(1, Math.round((art.aeste[ordnung] ?? 0) * (ordnung > 0 ? astZahl : 1)));
      r = rKind;
      const t0 = art.astStart[ordnung] ?? 0.4;
      let az = r() * Math.PI * 2;
      for (let j = 0; j < n; j++) {
        const tRel = clamp((j + 0.3 + r() * 0.4) / n, 0, 1);
        const t = t0 + (1 - t0) * tRel * 0.97;
        const f = t * nSeg, i0 = Math.min(Math.floor(f), nSeg - 1), u = f - i0;
        const pos = add(punkte[i0], [punkte[i0 + 1][0] - punkte[i0][0], punkte[i0 + 1][1] - punkte[i0][1], punkte[i0 + 1][2] - punkte[i0][2]], u);
        const rad = radien[i0] + (radien[i0 + 1] - radien[i0]) * u;
        const w = wind[i0] + (wind[i0 + 1] - wind[i0]) * u;
        az += ordnung === 0 ? 2.4 + (r() - 0.5) * 0.6 : Math.PI * (0.75 + r() * 0.5);
        const wink = (art.winkel[ordnung] ?? 40) * GRAD * rr(0.8, 1.2);
        const cd = kippe(d, wink, az);
        let l = laenge * (art.laenge[ordnung] ?? 0.5) * rr(0.8, 1.15);
        if (ordnung === 0) l = (art.stamm.laenge * groesse) * (art.laenge[0] ?? 0.5) * (PROFILE[art.profil] || PROFILE.gleich)(tRel) * rr(0.85, 1.1);
        if (art.abbruch && r() < art.abbruch) l *= rr(0.3, 0.6);
        wachse(pos, cd, l, Math.max(0.03, rad * (art.radiusFaktor ?? 0.55)), ordnung + 1, w, null, `${id}.${j}`);
        r = rKind;
        kinder++;
      }
    }
    // Laub-Knoten
    const ende = punkte[nSeg], wEnde = wind[nSeg];
    if (lb.form && lb.form !== 'keins' && lb.form !== 'kegel' && lb.form !== 'wedel') {
      const g = (lb.groesse ?? 1) * groesse * laubSkala;
      if (ordnung > 0 && (kinder === 0 || ordnung >= maxOrd)) {
        const s = ordnung === maxOrd ? 1 : 1.25;
        laub.push({ pos: ende, richtung: d, groesse: g * s * rr(0.8, 1.15), wind: clamp(wEnde + 0.2, 0, 1), ordnung });
        if (lb.entlang && nSeg > 1) {
          const m = punkte[Math.floor(nSeg / 2)];
          laub.push({ pos: m, richtung: d, groesse: g * 0.75 * rr(0.8, 1.1), wind: clamp(wEnde, 0, 1), ordnung });
        }
      } else if (ordnung === 0 && kinder > 0 && art.profil !== 'gleich') {
        laub.push({ pos: ende, richtung: d, groesse: (lb.groesse ?? 1) * groesse * 1.2, wind: 0.5, ordnung: 0 });
      }
    }
    return ast;
  }

  const rBasis = r;
  const stammL = st.laenge * groesse, stammR = st.radius * dicke;
  const nStamm = st.stamme ?? 1;
  let spitze = [0, stammL, 0];
  const bogenAz = r() * Math.PI * 2;
  for (let k = 0; k < nStamm; k++) {
    const az = bogenAz + (k / nStamm) * Math.PI * 2;
    const neig = (st.neigung ?? 0) * rr(0.5, 1.3) + (nStamm > 1 ? 0.25 : 0);
    const dir = norm([Math.cos(az) * Math.sin(neig), Math.cos(neig), Math.sin(az) * Math.sin(neig)]);
    const off = nStamm > 1 ? stammR * 0.5 : 0;
    const bogen = st.bogen ? [Math.cos(az), 0, Math.sin(az)] : null;
    const lk = stammL * (nStamm > 1 ? rr(0.85, 1.05) : 1);
    const a = wachse([Math.cos(az) * off, -0.2 + stammR * 1.2 * Math.sin(neig), Math.sin(az) * off], dir, lk, stammR / Math.sqrt(nStamm) * 1.1, 0, 0, bogen, `s${k}`);
    r = rBasis;
    if (k === 0) spitze = a.punkte[a.punkte.length - 1];
  }

  // Nadelbaum-Etagen
  if (art.etagen) {
    const e = art.etagen, n = e.anzahl[detail];
    const y0 = stammL * e.ansatz, H = stammL, R = H * e.radius;
    const schritt = (H - y0) / n;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const y = y0 + schritt * i * rr(0.95, 1.05);
      const radius = R * Math.pow(1 - t, e.form ?? 1) * rr(0.9, 1.08) + 0.25 * groesse;
      const hoehe = Math.min(H - y + 0.4, schritt * 2.3);
      const tf = clamp(y / H, 0, 1);
      const pos = [spitze[0] * tf + (r() - 0.5) * 0.1, y, spitze[2] * tf + (r() - 0.5) * 0.1];
      etagen.push({ pos, radius, hoehe, wind: clamp(0.15 + 0.5 * tf, 0, 1) });
    }
  }
  if (lb.form === 'wedel') laub.push({ pos: spitze, richtung: [0, 1, 0], groesse: (lb.groesse ?? 3) * groesse, wind: 0.5, ordnung: 0 });

  return { aeste, laub, etagen, spitze, stammRadius: stammR, maxOrdnung: maxOrd, groesse };
}
