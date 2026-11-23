/**
 * @modul    figur-form
 * @zweck    SDF-Baukasten für organische Figuren: weich verschmelzende Körper (Kapsel, Ellipsoid, Rundbox, Ring) mit Farbe und Knochen-Gewichten je Körper – Grundlage für den einteiligen, gehäuteten Figurenkörper
 * @api      createFigurForm({ glatt }) -> { kapsel(a,b,ra,rb,o), kugel(m,r,o), ellipsoid(m,radien,o), rundbox(m,halb,rund,o), ring(m,R,r,o), abstand(x,y,z), normale(x,y,z,out,eps), grenzen(), eingrenzen(min,max,rand), einfluss(x,y,z,{farbSchaerfe,knochenWeich}) -> {farbe:[r,g,b], knochen:{name:w}, rauh, haut}, anzahl, spiel }
 * @beispiel
 *   import { createFigurForm } from '../../engine/models/character/figur-form.js';
 *   import { sdfNetz } from '../../engine/core/sdf-netz.js';
 *   const f = createFigurForm({ glatt: 0.03 });
 *   f.kapsel([0.2, 1.4, 0], [0.45, 1.1, 0], 0.05, 0.04, { knochen: 'schulterL', farbe: 0x4f7a5a });
 *   f.ellipsoid([0, 1.2, 0], [0.16, 0.25, 0.1], { knochen: 'torso', farbe: 0x4f7a5a, dreh: [0.1, 0, 0] });
 *   const netz = sdfNetz(f, { zelle: 0.012 });               // f erfüllt den Vertrag von sdf-netz
 *   const e = f.einfluss(0.3, 1.3, 0);                        // e.farbe, e.knochen → Skinning
 * @tags     sdf, figur, charakter, organisch, skinning, form, körper, kleidung
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Optionen o je Körper (alle optional):
 *   knochen  'torso' | { torso: 0.7, becken: 0.3 } | (x,y,z) => ({ name: w })   – wem die Haut hier folgt (Skinning)
 *   farbe    0xrrggbb (Vertexfarbe, wenn dieser Körper die Oberfläche bildet)
 *   glatt    Breite der Verschmelzung mit allem VORHER Hinzugefügten in m (Standard: opts.glatt). Klein = Naht/Kante, groß = weich
 *   abzug    true = weich abziehen statt vereinigen (Falten, Augenhöhlen, Mundspalt). farbe wird an der Höhlung genutzt
 *   dreh     [rx, ry, rz] Euler XYZ in rad (Ellipsoid, Rundbox, Ring)
 *   tief     Kapsel: Querschnitt in Blickrichtung (+Z) gestaucht (0.7 = flach von vorn nach hinten)
 *   rauh     Amplitude in m für Rauschen auf diesem Körper (Kettenhemd, Fell, Stoff-Knitter), rauhSkala = Frequenz (1/m, Std. 60)
 *   haut     true = Haut (Material/Shader kann das nutzen: Attribut „haut“ 0…1)
 * Reihenfolge zählt: jeder Körper wird mit dem bisherigen Ergebnis weich vereinigt (bzw. abgezogen).
 * Einheiten: Meter, Figur in Bindungs-Pose (A-Pose), Füße bei y = 0, Blick nach +Z, links = +X.
 */
import { createNoise3D } from '../../core/noise.js';
import { weichMin } from '../../core/sdf.js';

const KAPSEL = 0, ELLIPSOID = 1, RUNDBOX = 2, RING = 3;

function drehMatrix(d) {                       // Welt → lokal (Transponierte von Rx·Ry·Rz)
  if (!d) return null;
  const [a, b, c] = d, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c);
  const m = [cb * cc, -cb * sc, sb, ca * sc + sa * sb * cc, ca * cc - sa * sb * sc, -sa * cb, sa * sc - ca * sb * cc, sa * cc + ca * sb * sc, ca * cb];
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
}

/** Formen-Sammlung mit dem Vertrag von core/sdf-netz (abstand, normale, grenzen, eingrenzen, spiel). */
export function createFigurForm({ glatt = 0.025, seed = 1 } = {}) {
  const K = [];                                // Körper: { typ, k, abzug, …Geometrie, min, max, o }
  let aktiv = null, kMax = 0, spiel = 0;
  const rausch = createNoise3D(seed);
  let dBuf = new Float64Array(64);

  function plus(typ, geo, o = {}, min, max) {
    const k = Math.max(1e-4, o.glatt ?? glatt);
    const r = o.rauh || 0;
    const kn = o.knochen ?? 'torso';
    const knochen = typeof kn === 'function' ? kn : typeof kn === 'string' ? { [kn]: 1 } : { ...kn };
    const f = o.farbe ?? 0xc0a080;
    K.push({ typ, k, abzug: !!o.abzug, ...geo, rot: drehMatrix(o.dreh), rauh: r, rs: o.rauhSkala || 60, knochen,
      farbe: [((f >> 16) & 255) / 255, ((f >> 8) & 255) / 255, (f & 255) / 255], haut: o.haut ? 1 : 0,
      min: min.map((v) => v - r), max: max.map((v) => v + r) });
    if (k > kMax) kMax = k;
    spiel = Math.max(spiel, r);
    aktiv = null;
    return api;
  }

  function lokal(c, x, y, z, out) {
    const px = x - c.m[0], py = y - c.m[1], pz = z - c.m[2], R = c.rot;
    if (!R) { out[0] = px; out[1] = py; out[2] = pz; return out; }
    out[0] = R[0] * px + R[1] * py + R[2] * pz; out[1] = R[3] * px + R[4] * py + R[5] * pz; out[2] = R[6] * px + R[7] * py + R[8] * pz;
    return out;
  }
  const q = [0, 0, 0];
  function einzel(c, x, y, z) {
    let d;
    if (c.typ === KAPSEL) {
      const pax = x - c.a[0], pay = y - c.a[1], paz = z - c.a[2];
      let t = (pax * c.u[0] + pay * c.u[1] + paz * c.u[2]) / c.len;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      let dx = pax - c.u[0] * c.len * t, dy = pay - c.u[1] * c.len * t, dz = paz - c.u[2] * c.len * t;
      if (c.tief !== 1) {                      // Anteil entlang der Vorn-Achse stauchen
        const v = dx * c.v[0] + dy * c.v[1] + dz * c.v[2], s = (1 / c.tief - 1) * v;
        dx += c.v[0] * s; dy += c.v[1] * s; dz += c.v[2] * s;
      }
      d = (Math.sqrt(dx * dx + dy * dy + dz * dz) - (c.ra + (c.rb - c.ra) * t)) * (c.tief < 1 ? (1 + c.tief) / 2 : 1);
    } else if (c.typ === ELLIPSOID) {
      lokal(c, x, y, z, q);
      const a0 = q[0] / c.r[0], a1 = q[1] / c.r[1], a2 = q[2] / c.r[2], b0 = a0 / c.r[0], b1 = a1 / c.r[1], b2 = a2 / c.r[2];
      const k0 = Math.sqrt(a0 * a0 + a1 * a1 + a2 * a2), k1 = Math.sqrt(b0 * b0 + b1 * b1 + b2 * b2);
      d = k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(c.r[0], c.r[1], c.r[2]);
    } else if (c.typ === RUNDBOX) {
      lokal(c, x, y, z, q);
      const ax = Math.abs(q[0]) - c.h[0] + c.rund, ay = Math.abs(q[1]) - c.h[1] + c.rund, az = Math.abs(q[2]) - c.h[2] + c.rund;
      const ex = ax > 0 ? ax : 0, ey = ay > 0 ? ay : 0, ez = az > 0 ? az : 0;
      d = Math.sqrt(ex * ex + ey * ey + ez * ez) + Math.min(Math.max(ax, ay, az), 0) - c.rund;
    } else {
      lokal(c, x, y, z, q);
      const rr = Math.sqrt(q[0] * q[0] + q[2] * q[2]) - c.R;
      d = Math.sqrt(rr * rr + q[1] * q[1]) - c.r;
    }
    if (c.rauh) d += c.rauh * rausch(x * c.rs, y * c.rs, z * c.rs);
    return d;
  }

  const ausserhalb = (c, x, y, z, e) => x < c.min[0] - e || x > c.max[0] + e || y < c.min[1] - e || y > c.max[1] + e || z < c.min[2] - e || z > c.max[2] + e;

  function abstand(x, y, z) {
    let acc = 1e9;
    const n = aktiv ? aktiv.n : K.length;
    for (let i = 0; i < n; i++) {
      const c = K[aktiv ? aktiv.l[i] : i];
      if (!c.abzug && acc < 1e8 && ausserhalb(c, x, y, z, 2 * c.k + Math.max(0, acc))) continue;   // kann nichts beitragen
      const d = einzel(c, x, y, z);
      acc = c.abzug ? -weichMin(-acc, d, c.k) : weichMin(acc, d, c.k);
    }
    return acc;
  }

  const api = {
    /** Verjüngte Kapsel a → b (Radien ra → rb). o.tief staucht den Querschnitt in Blickrichtung. */
    kapsel(a, b, ra, rb = ra, o = {}) {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], len = Math.hypot(ux, uy, uz) || 1e-6;
      const u = [ux / len, uy / len, uz / len];
      let v = [-u[2] * u[0], -u[2] * u[1], 1 - u[2] * u[2]];   // +Z senkrecht zur Achse
      const lv = Math.hypot(...v);
      v = lv < 1e-3 ? [0, 1, 0] : v.map((t) => t / lv);
      const r = Math.max(ra, rb) * Math.max(1, o.tief ?? 1);
      return plus(KAPSEL, { a: [...a], u, len, ra, rb, tief: o.tief ?? 1, v },
        o, [Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.min(a[2], b[2]) - r], [Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, Math.max(a[2], b[2]) + r]);
    },
    kugel(m, r, o) { return api.kapsel(m, m, r, r, o); },
    /** Ellipsoid mit Halbachsen radien = [rx, ry, rz], optional gedreht (o.dreh). */
    ellipsoid(m, radien, o = {}) {
      const r = Math.max(...radien);
      return plus(ELLIPSOID, { m: [...m], r: [...radien] }, o, m.map((v) => v - r), m.map((v) => v + r));
    },
    /** Quader mit halben Kantenlängen halb = [hx, hy, hz] und Kantenrundung rund (m), optional gedreht. */
    rundbox(m, halb, rund = 0.005, o = {}) {
      const r = Math.hypot(...halb);
      return plus(RUNDBOX, { m: [...m], h: [...halb], rund: Math.min(rund, ...halb) }, o, m.map((v) => v - r), m.map((v) => v + r));
    },
    /** Ring (Torus) in der lokalen XZ-Ebene: Mittelradius R, Dicke r (Gürtel, Kragen, Armreif). */
    ring(m, R, r, o = {}) {
      const e = R + r;
      return plus(RING, { m: [...m], R, r }, o, m.map((v) => v - e), m.map((v) => v + e));
    },
    abstand,
    /** Normale per Tetraeder-Differenz (4 statt 6 Auswertungen). */
    normale(x, y, z, out = [0, 0, 0], eps = 0.002) {
      const a = abstand(x + eps, y - eps, z - eps), b = abstand(x - eps, y - eps, z + eps), c = abstand(x - eps, y + eps, z - eps), d = abstand(x + eps, y + eps, z + eps);
      const nx = a - b - c + d, ny = -a - b + c + d, nz = -a + b - c + d;
      const l = Math.hypot(nx, ny, nz) || 1;
      out[0] = nx / l; out[1] = ny / l; out[2] = nz / l;
      return out;
    },
    grenzen() {
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
      for (const c of K) if (!c.abzug) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], c.min[a]); max[a] = Math.max(max[a], c.max[a]); }
      const rand = 0.5 * kMax + spiel + 0.02;
      return K.length ? { min: min.map((v) => v - rand), max: max.map((v) => v + rand) } : { min: [0, 0, 0], max: [0, 0, 0] };
    },
    /** Nur Körper auswerten, die den Quader (plus Rand) beeinflussen können; null hebt auf. → Anzahl (Abzüge zählen nicht). */
    eingrenzen(min, max, rand = 0) {
      if (!min) { aktiv = null; return K.length; }
      const l = (aktiv?.l?.length >= K.length) ? aktiv.l : new Int32Array(K.length);
      let n = 0, voll = 0;
      for (let i = 0; i < K.length; i++) {
        const c = K[i], e = 2 * c.k + rand + spiel;
        if (c.min[0] - e > max[0] || c.max[0] + e < min[0] || c.min[1] - e > max[1] || c.max[1] + e < min[1] || c.min[2] - e > max[2] || c.max[2] + e < min[2]) continue;
        l[n++] = i; if (!c.abzug) voll++;
      }
      aktiv = { l, n };
      return voll;
    },
    /**
     * Wer bildet die Oberfläche bei (x,y,z)? Gewichte = exp(−(d − dmin)/Schärfe).
     * farbSchaerfe (m, Std. 0.003) = wie hart Farbgrenzen sind; knochenWeich (m, Std. 0.03) = wie weich Gelenke überblenden.
     * → { farbe: [r,g,b] 0…1, knochen: { name: w } (Summe 1), haut: 0…1 }. Respektiert eingrenzen (vorher um den Punkt eingrenzen = schnell).
     */
    einfluss(x, y, z, { farbSchaerfe = 0.003, knochenWeich = 0.03 } = {}) {
      const nA = aktiv ? aktiv.n : K.length;
      if (dBuf.length < K.length) dBuf = new Float64Array(K.length);
      const d = dBuf;
      let dmin = Infinity;
      for (let j = 0; j < nA; j++) {
        const i = aktiv ? aktiv.l[j] : j, c = K[i];
        if (ausserhalb(c, x, y, z, 0.08)) { d[i] = Infinity; continue; }
        let v = einzel(c, x, y, z);
        if (c.abzug) v = Math.abs(v) + 0.002;   // Höhlungs-Farbe nur direkt an der Höhlung
        d[i] = v;
        if (!c.abzug && v < dmin) dmin = v;
      }
      const farbe = [0, 0, 0], kn = {};
      let sf = 0, sk = 0, haut = 0;
      for (let j = 0; j < nA; j++) {
        const i = aktiv ? aktiv.l[j] : j;
        if (d[i] === Infinity) continue;
        const c = K[i], rel = Math.max(0, d[i] - dmin);
        const wf = Math.exp(-rel / farbSchaerfe);
        if (wf > 1e-4) { farbe[0] += c.farbe[0] * wf; farbe[1] += c.farbe[1] * wf; farbe[2] += c.farbe[2] * wf; haut += c.haut * wf; sf += wf; }
        if (c.abzug) continue;
        const wk = Math.exp(-rel / knochenWeich);
        if (wk < 1e-4) continue;
        const m = typeof c.knochen === 'function' ? c.knochen(x, y, z) : c.knochen;
        for (const n in m) { kn[n] = (kn[n] || 0) + m[n] * wk; sk += m[n] * wk; }
      }
      if (sf > 0) { farbe[0] /= sf; farbe[1] /= sf; farbe[2] /= sf; haut /= sf; }
      if (sk > 0) for (const n in kn) kn[n] /= sk;
      return { farbe, knochen: kn, haut };
    },
    get anzahl() { return K.length; },
    get spiel() { return spiel; },
  };
  return api;
}
