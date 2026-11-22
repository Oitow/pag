/**
 * @modul    welt-regionen
 * @zweck    Erlenwacht-Weltkarte als reine Logik: Regionen (Küste, Dämmerwald, Talkessel, Moor, Hochland, Gebirge), Orte, Wege und eine punktweise, seedbare Höhe (entlang der Wege geglättet), Wasser, Biome, Bodenfarben und Streu-Regeln
 * @api      createWeltRegionen({seed}) -> {hoehe(x,z),wasserHoehe(x,z,h?),region(x,z)->{id,name,biom},biom(x,z,h?),farbe(x,z,h,steil,aus),wegInfo(x,z)->{d,h},abstandZumWeg(x,z),regionen,orte,ort(id),wege,startPunkt,groesse,meerZ(x),moor} ; STREU {biom: {gross:[p,[[typ,w]…]], klein:[p,[[typ,w]…]]}} ; MOOR_WASSER
 * @beispiel
 *   import { createWeltRegionen } from '../../engine/world/welt-regionen.js';
 *   const k = createWeltRegionen({ seed: 7 });
 *   const y = k.hoehe(0, 600);                    // Talkessel der Siedlung
 *   const r = k.region(-1200, 400).id;            // 'moor'
 * @tags     welt, karte, regionen, orte, wege, hoehe, terrain, erlenwacht, mmo
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { createNoise2D, fbm2, ridged2 } from '../core/noise.js';
import { hashSeed } from '../core/rng.js';
import { smoothstep, clamp, lerp } from '../core/math.js';

export const MOOR_WASSER = 11.4;
const MOOR_BOX = { x0: -2600, x1: -650, z0: -450, z1: 1360 };
const GIPFEL = { x: 260, z: -1480, h: 352 };

const REGIONEN = [
  { id: 'kueste', name: 'Küste', mitte: { x: 0, z: 1750 }, radius: 600 },
  { id: 'daemmerwald', name: 'Dämmerwald', mitte: { x: 0, z: 1200 }, radius: 500 },
  { id: 'erlenwacht', name: 'Erlenwacht', mitte: { x: 0, z: 600 }, radius: 250 },
  { id: 'moor', name: 'Nebelmoor', mitte: { x: -1400, z: 450 }, radius: 700 },
  { id: 'hochland', name: 'Hochland', mitte: { x: 300, z: 150 }, radius: 700 },
  { id: 'gebirge', name: 'Grauzinnen', mitte: { x: 0, z: -1300 }, radius: 900 },
];
const ORTE = [
  { id: 'start', name: 'Strand', art: 'start', x: 15, z: 1858, radius: 12, blick: Math.PI },
  { id: 'tor', name: 'Waldtor', art: 'tor', x: 0, z: 1480, radius: 10, blick: Math.PI },
  { id: 'lichtung', name: 'Lichtung', art: 'lichtung', x: -20, z: 1180, radius: 28, blick: Math.PI },
  { id: 'siedlung', name: 'Erlenwacht', art: 'siedlung', x: 0, z: 600, radius: 120, blick: Math.PI },
  { id: 'lager-moor', name: 'Moorlager', art: 'gegnerlager', x: -1220, z: 500, radius: 30 },
  { id: 'lager-hochland', name: 'Hochlandlager', art: 'gegnerlager', x: 330, z: 60, radius: 30 },
  { id: 'ruine', name: 'Alte Wacht', art: 'ruine', x: 680, z: -240, radius: 25 },
  { id: 'gipfel', name: 'Grauzinne', art: 'aussicht', x: GIPFEL.x, z: GIPFEL.z, radius: 15, blick: 0 },
];
const weg = (id, name, breite, pts) => Object.assign(pts.map(([x, z]) => ({ x, z })), { id, name, breite });
const WEGE = [
  weg('hauptweg', 'Hauptweg', 3, [[15, 1858], [5, 1700], [0, 1480], [30, 1330], [-20, 1180], [10, 1010], [-12, 840], [0, 600],
    [60, 430], [180, 260], [300, 90]]),
  weg('moorweg', 'Moorpfad', 2, [[0, 600], [-160, 640], [-500, 560], [-880, 520], [-1190, 500]]),
  weg('bergpfad', 'Bergpfad', 2, [[300, 90], [520, -110], [680, -240], [560, -700], [400, -1100], [GIPFEL.x + 40, GIPFEL.z + 110]]),
];

/**
 * Streu-Regeln je Biom: gross = Bäume/Felsen (Raster 7 m), klein = Büsche/Boden (Raster 3.5 m, nur Nahbereich).
 * [Wahrscheinlichkeit je Rasterpunkt, [[typ, gewicht], …]]
 */
export const STREU = {
  strand: { gross: [0.015, [['felsbrocken', 1]]], klein: [0.05, [['grasbueschel', 1]]] },
  duene: { gross: [0.12, [['kiefer', 3], ['felsbrocken', 1]]], klein: [0.3, [['grasbueschel', 3], ['ginster', 1]]] },
  urwald: { gross: [0.55, [['buche', 4], ['eiche', 2], ['liegenderStamm', 0.6], ['baumstumpf', 0.4]]], klein: [0.55, [['wedelfarn', 3], ['busch_unterholz', 2], ['farn', 2]]] },
  laubwald: { gross: [0.4, [['buche', 2], ['eiche', 3], ['birke', 1], ['felsbrocken', 0.3]]], klein: [0.35, [['farn', 2], ['busch', 1], ['grasbueschel', 1]]] },
  wiese: { gross: [0.03, [['eiche', 2], ['birke', 1], ['findling', 1]]], klein: [0.3, [['grasbueschel', 4], ['busch', 0.4]]] },
  sumpf: { gross: [0.12, [['birke', 2], ['weide', 2], ['toterBaum', 1.5]]], klein: [0.45, [['schilf', 3], ['grasbueschel', 2]]] },
  heide: { gross: [0.07, [['findling', 2], ['felsbrocken', 2], ['kiefer', 1], ['birke', 0.6]]], klein: [0.35, [['ginster', 2], ['grasbueschel', 3], ['zwergstrauch', 1]]] },
  nadelwald: { gross: [0.4, [['fichte', 3], ['tanne', 2], ['felsbrocken', 0.5]]], klein: [0.2, [['zwergstrauch', 2], ['farn', 1]]] },
  fels: { gross: [0.09, [['fels', 2], ['felsbrocken', 2], ['felsplatte', 1]]], klein: [0.12, [['zwergstrauch', 1], ['grasbueschel', 1]]] },
};

// gedämpfte Bodenfarben (sRGB 0…1)
const hex = (h) => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];
const FARBE = {
  strand: hex(0xbfae84), duene: hex(0x9a9466), urwald: hex(0x3d4a2c), laubwald: hex(0x4e6034), wiese: hex(0x6b7f42), sumpf: hex(0x4f5536),
  heide: hex(0x7b7552), nadelwald: hex(0x45512f), fels: hex(0x77716a),
};
const FELS = hex(0x6f6960), FELS_HELL = hex(0x948e85), WEG = hex(0x8a7556), NASS = hex(0x8b7d5c), GRUND = hex(0x4a5a52), SCHLAMM = hex(0x4d4a34), SCHLAMM_TIEF = hex(0x33362a);

function strecke(px, pz, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
  const t = l2 ? clamp(((px - a.x) * dx + (pz - a.z) * dz) / l2, 0, 1) : 0;
  const qx = a.x + dx * t - px, qz = a.z + dz * t - pz;
  return [qx * qx + qz * qz, t];
}

export function createWeltRegionen({ seed = 1 } = {}) {
  const n1 = createNoise2D(hashSeed('erlenwacht-hoehe', seed)), n2 = createNoise2D(hashSeed('erlenwacht-detail', seed));
  const n3 = createNoise2D(hashSeed('erlenwacht-berg', seed)), n4 = createNoise2D(hashSeed('erlenwacht-moor', seed));
  const meerZ = (x) => 1900 + n1(x / 400, 3.7) * 45 + n2(x / 90, 9.1) * 10;

  /** Höhe ohne Wege-Glättung. */
  function roh(x, z) {
    const det = fbm2(n2, x / 140, z / 140, 3);
    const wald = 15 + det * 2.5 + n1(x / 600, z / 600) * 2;
    const hoch = 40 + fbm2(n1, x / 380, z / 380, 3) * 16 + det * 3;
    let h = lerp(hoch, wald, smoothstep(420, 900, z));
    if (z < -150) {
      const amp = smoothstep(-350, -1350, z) * 230;
      const berg = 46 + det * 4 + (1 - Math.abs(fbm2(n3, x / 1500, z / 1500, 3, 2, 0.35))) ** 2 * amp * 1.1 + fbm2(n3, x / 300 + 5, z / 300, 2) * amp * 0.08;
      h = lerp(berg, h, smoothstep(-700, -200, z));
      const dg = Math.hypot(x - GIPFEL.x, z - GIPFEL.z);   // Gipfel: steiler, zerfurchter Kegel
      if (dg < 700) h = Math.max(h, GIPFEL.h - (dg < 30 ? dg * dg / 60 : dg - 15) * (0.62 + det * 0.18) - ridged2(n3, x / 90, z / 90, 2) * Math.min(dg, 60) * 0.1);
    }
    // Steile Felswände (> 55°, zum Klettern): Stufen im Gebirge und ein Felsklotz an der Ruine
    if (z < -450) h += smoothstep(0.5, 0.58, n4(x / 160 + 3.3, z / 160 - 1.7)) * 16 * smoothstep(-450, -750, z);
    const dr = Math.hypot(x - 745, z + 270);
    if (dr < 60) h += (1 - smoothstep(36, 42, dr)) * (13 + det * 3);
    const ax = Math.abs(x);
    if (ax > 1700 && z < 1500) h += smoothstep(1700, 2300, ax) * smoothstep(1500, 1100, z) * (x < 0 ? 60 : 130) * (0.7 + 0.3 * det);
    // Moor im Westen: flach, Tümpel
    if (x < -620 && z > -500 && z < 1450) {
      const w = smoothstep(-620, -900, x) * smoothstep(-500, -300, z) * smoothstep(1450, 1300, z);
      const t = fbm2(n4, x / 55, z / 55, 2);
      const moor = 12.1 + det * 0.25 - smoothstep(0.18, 0.4, t) * 1.8;
      h = lerp(h, moor, w);
    }
    // Talkessel der Siedlung
    const db = Math.hypot(x, z - 600);
    if (db < 470) {
      const kessel = 24 + det * 0.4 + smoothstep(200, 320, db) * (12 + det * 4);
      h = lerp(kessel, h, smoothstep(320, 470, db));
    }
    // Küste: fällt ins Meer
    if (z > 1300) {
      const c = meerZ(x) - z;
      const kueste = c < 0 ? c * 0.07 - c * c * 0.0004 : 0.3 + c * 0.028 + smoothstep(60, 160, c) * det * 2;
      h = h < kueste ? h : lerp(h, kueste, smoothstep(520, 380, c));
    }
    return h;
  }

  // Wege: Abtastpunkte alle 5 m, Höhe längs geglättet (gleitendes Mittel ±45 m)
  const wegDaten = WEGE.map((pts) => {
    const proben = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], l = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(1, Math.ceil(l / 5));
      for (let k = 0; k < n; k++) proben.push(roh(lerp(a.x, b.x, k / n), lerp(a.z, b.z, k / n)));
      if (i === pts.length - 2) proben.push(roh(b.x, b.z));
    }
    const glatt = proben.map((_, i) => { let s = 0, c = 0; for (let j = Math.max(0, i - 9); j <= Math.min(proben.length - 1, i + 9); j++) { s += proben[j]; c++; } return Math.max(0.6, s / c); });
    const seg = []; let idx = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 5));
      seg.push({ a, b, i0: idx, n, x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z) });
      idx += n;
    }
    return { pts, glatt, seg, breite: pts.breite };
  });
  const info = { d: 1e9, h: 0, breite: 3 };
  /** Nächster Weg: Abstand d (m), geglättete Weghöhe h. */
  function wegInfo(x, z) {
    let best = Infinity, bh = 0, bb = 3;
    for (const w of wegDaten) for (const s of w.seg) {
      const bx = Math.max(s.x0 - x, 0, x - s.x1), bz = Math.max(s.z0 - z, 0, z - s.z1);
      if (bx * bx + bz * bz >= best) continue;
      const [d2, t] = strecke(x, z, s.a, s.b);
      if (d2 < best) {
        best = d2; bb = w.breite;
        const f = s.i0 + t * s.n, i = Math.min(w.glatt.length - 2, Math.floor(f));
        bh = lerp(w.glatt[i], w.glatt[i + 1], f - i);
      }
    }
    info.d = Math.sqrt(best); info.h = bh; info.breite = bb;
    return info;
  }
  function hoehe(x, z) {
    const h = roh(x, z), w = wegInfo(x, z);
    if (w.d > 18) return h;
    return lerp(w.h, h, smoothstep(w.breite, w.breite + 14, w.d));
  }
  const inMoorBox = (x, z) => x > MOOR_BOX.x0 && x < MOOR_BOX.x1 && z > MOOR_BOX.z0 && z < MOOR_BOX.z1;
  function wasserHoehe(x, z, h = hoehe(x, z)) {
    if (inMoorBox(x, z) && h < MOOR_WASSER) return MOOR_WASSER;
    return h < 0 ? 0 : null;
  }

  const R = Object.fromEntries(REGIONEN.map((r) => [r.id, r]));
  const aus = { id: '', name: '', biom: '' };
  function regionId(x, z) {
    const wx = x + n2(x / 120, z / 120) * 35, wz = z + n2(z / 120 + 7, x / 120) * 35;
    if (Math.hypot(wx, wz - 600) < 280) return 'erlenwacht';
    if (wz > 1500) return 'kueste';
    if (wx < -800 && wz > -350 && wz < 1450) return 'moor';
    if (wz > 900) return 'daemmerwald';
    if (wz > -400) return 'hochland';
    return 'gebirge';
  }
  function biom(x, z, h = hoehe(x, z)) {
    const id = regionId(x, z), d = n1(x / 260 + 11, z / 260);
    switch (id) {
      case 'kueste': return h < 3.2 ? 'strand' : 'duene';
      case 'daemmerwald': return Math.abs(x) < 500 + d * 80 ? 'urwald' : 'laubwald';
      case 'erlenwacht': return 'wiese';
      case 'moor': return 'sumpf';
      case 'hochland': return d > 0.35 ? 'laubwald' : d < -0.3 ? 'heide' : 'wiese';
      default: return h > 250 + d * 30 ? 'fels' : h > 120 + d * 40 ? 'heide' : 'nadelwald';
    }
  }
  function region(x, z) {
    const id = regionId(x, z);
    aus.id = id; aus.name = R[id].name; aus.biom = biom(x, z);
    return { ...aus };
  }
  /** Bodenfarbe (sRGB 0…1) nach Biom, Hang (steil = 1 − Normale.y), Höhe, Weg und Wasser → aus[0..2]. */
  function farbe(x, z, h, steil, aus3, o = 0) {
    const b = biom(x, z, h), f = FARBE[b], v = n2(x / 9, z / 9) * 0.06 + n1(x / 40, z / 40) * 0.05;
    let r = f[0], g = f[1], bl = f[2];
    const fels = smoothstep(0.28, 0.5, steil + v * 0.8), hell = smoothstep(200, 330, h);
    const fr = lerp(FELS[0], FELS_HELL[0], hell), fg = lerp(FELS[1], FELS_HELL[1], hell), fb = lerp(FELS[2], FELS_HELL[2], hell);
    r = lerp(r, fr, fels); g = lerp(g, fg, fels); bl = lerp(bl, fb, fels);
    const wh = wasserHoehe(x, z, h);
    if (wh !== null) { const t = smoothstep(0, wh > 0 ? 1 : 3, wh - h), A = wh > 0 ? SCHLAMM : NASS, B = wh > 0 ? SCHLAMM_TIEF : GRUND; r = lerp(A[0], B[0], t); g = lerp(A[1], B[1], t); bl = lerp(A[2], B[2], t); }
    else if (h < 1.2) { r = lerp(NASS[0], r, h / 1.2); g = lerp(NASS[1], g, h / 1.2); bl = lerp(NASS[2], bl, h / 1.2); }
    const w = wegInfo(x, z);
    if (w.d < w.breite + 1.5) { const t = 1 - smoothstep(w.breite * 0.5, w.breite + 1.5 + v * 8, w.d); r = lerp(r, WEG[0], t); g = lerp(g, WEG[1], t); bl = lerp(bl, WEG[2], t); }
    const k = 1 + v;
    aus3[o] = r * k; aus3[o + 1] = g * k; aus3[o + 2] = bl * k;
    return aus3;
  }

  return {
    hoehe, wasserHoehe, region, biom, farbe, wegInfo, meerZ, roh,
    abstandZumWeg: (x, z) => wegInfo(x, z).d,
    regionen: REGIONEN.map((r) => ({ ...r, mitte: { ...r.mitte } })),
    orte: ORTE.map((o) => ({ ...o })),
    ort(id) { return this.orte.find((o) => o.id === id) || null; },
    wege: WEGE, startPunkt: { x: ORTE[0].x, z: ORTE[0].z }, groesse: { x: 4096, z: 4096 }, moor: { ...MOOR_BOX, wasser: MOOR_WASSER },
  };
}
