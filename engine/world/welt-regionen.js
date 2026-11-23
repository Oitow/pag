/**
 * @modul    welt-regionen
 * @zweck    Erlenwacht-Weltkarte als reine Logik: Regionen (Küste, Dämmerwald, Talkessel, Moor, Hochland, Gebirge), Orte, Wege und eine punktweise, seedbare Höhe (entlang der Wege geglättet), Wasser, Biome, Bodenfarben und Streu-Regeln; v1.1: weicher Kartenrand (Meer Süd/Ost, Gebirgskette Nord/West), Fluss Gebirge→Hochland→Moor mit Furt, Hügelwellen, Felsnadeln, Moor-Tümpel, Wolfsfels-Terrasse; v1.2: mehrere Flüsse (fluesse), Erlbach Hochland→Ostrand Erlenwacht→Klamm→Dämmerwald→Strand
 * @api      createWeltRegionen({seed}) -> {hoehe(x,z),wasserHoehe(x,z,h?),region(x,z)->{id,name,biom},biom(x,z,h?),farbe(x,z,h,steil,aus),wegInfo(x,z)->{d,h},abstandZumWeg(x,z),regionen,orte,ort(id),wege,startPunkt,groesse,meerZ(x),moor,fluss:{proben:[{x,z,y,b}],furt:{x,z}},flussInfo(x,z)->{d,y,b,id},fluesse:[{id,name,proben}]} ; STREU {biom: {gross:[p,[[typ,w]…]], klein:[p,[[typ,w]…]]}} ; MOOR_WASSER
 * @beispiel
 *   import { createWeltRegionen } from '../../engine/world/welt-regionen.js';
 *   const k = createWeltRegionen({ seed: 7 });
 *   const y = k.hoehe(0, 600);                    // Talkessel der Siedlung
 *   const r = k.region(-1200, 400).id;            // 'moor'
 * @tags     welt, karte, regionen, orte, wege, hoehe, terrain, erlenwacht, mmo
 * @version  1.2.0
 * @status   entwurf
 * @three    nein
 */
import { createNoise2D, fbm2, ridged2, warp2 } from '../core/noise.js';
import { hashSeed, hash2 } from '../core/rng.js';
import { smoothstep, clamp, lerp } from '../core/math.js';

export const MOOR_WASSER = 11.4;
const MOOR_BOX = { x0: -2600, x1: -650, z0: -450, z1: 1360 };
const GIPFEL = { x: 260, z: -1480, h: 352 };
const WOLFSFELS = { x: -150, z: -520, r: 22 };      // flache Felsterrasse im Übergang Hochland/Gebirge
const AUSSICHT_MOOR = { x: -1640, z: 180 };          // Bult am Fuß der Westkette
const FURT = { x: 195, z: -190 };                    // Hauptweg quert den Fluss
// Fluss: Gebirge (NO) → Hochland → Furt → Westen → Nebelmoor (Kontrollpunkte, als glatte Kurve gezogen)
// Erlbach: Quelle im Hochland → Ostrand Erlenwacht → Klamm durch den Höhenrücken → Dämmerwald → Mündung neben dem Startstrand
const ERLBACH_PUNKTE = [[262, 372], [205, 455], [150, 545], [124, 630], [150, 700], [205, 750], [262, 800], [296, 875], [292, 975], [250, 1110],
  [196, 1290], [152, 1470], [104, 1650], [68, 1820], [56, 1990]];
const FLUSS_PUNKTE = [[250, -1150], [300, -900], [345, -690], [330, -480], [275, -310], [FURT.x + 70, FURT.z - 46], [FURT.x, FURT.z], [FURT.x - 70, FURT.z + 46],
  [40, -30], [-140, 40], [-340, 140], [-520, 260], [-700, 370], [-840, 440]];

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
  { id: 'lager-moor', name: 'Moorlager', art: 'gegnerlager', x: -1220, z: 500, radius: 30, stufe: 6 },
  { id: 'lager-hochland', name: 'Hochlandlager', art: 'gegnerlager', x: 330, z: 60, radius: 30, stufe: 4 },
  { id: 'ruine', name: 'Alte Wacht', art: 'ruine', x: 680, z: -240, radius: 25 },
  { id: 'gipfel', name: 'Grauzinne', art: 'aussicht', x: GIPFEL.x, z: GIPFEL.z, radius: 15, blick: 0 },
  { id: 'furt', name: 'Furt', art: 'furt', x: FURT.x, z: FURT.z, radius: 14, blick: Math.PI * 0.8 },
  { id: 'wolfsfels', name: 'Wolfsfels', art: 'boss', x: WOLFSFELS.x, z: WOLFSFELS.z, radius: WOLFSFELS.r, blick: Math.PI, stufe: 10 },
  { id: 'aussicht-moor', name: 'Moorblick', art: 'aussicht', x: AUSSICHT_MOOR.x, z: AUSSICHT_MOOR.z, radius: 12, blick: Math.PI / 2 },
];
const weg = (id, name, breite, pts) => Object.assign(pts.map(([x, z]) => ({ x, z })), { id, name, breite });
const WEGE = [
  weg('hauptweg', 'Hauptweg', 3, [[15, 1858], [5, 1700], [0, 1480], [30, 1330], [-20, 1180], [10, 1010], [-12, 840], [0, 600],
    [60, 430], [180, 260], [300, 90]]),
  weg('moorweg', 'Moorpfad', 2, [[0, 600], [-160, 640], [-500, 560], [-880, 520], [-1190, 500]]),
  weg('bergpfad', 'Bergpfad', 2, [[300, 90], [520, -110], [680, -240], [560, -700], [400, -1100], [GIPFEL.x + 40, GIPFEL.z + 110]]),
  weg('wolfsweg', 'Wolfspfad', 2, [[300, 90], [250, -80], [FURT.x, FURT.z], [120, -300], [20, -400], [-100, -480], [WOLFSFELS.x, WOLFSFELS.z]]),
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

  const nahe = (x, z, o, r) => (x - o.x) ** 2 + (z - o.z) ** 2 < r * r;
  /** Felsnadeln im Hochland: je 170-m-Zelle höchstens eine (Rasterzelle + Hash), nicht an Orten. */
  function nadel(x, z) {
    const gx = Math.floor(x / 170), gz = Math.floor(z / 170), s0 = hashSeed('nadel', seed);
    if (hash2(gx, gz, s0) > 0.45) return 0;
    const cx = (gx + 0.25 + hash2(gx, gz, s0 + 1) * 0.5) * 170, cz = (gz + 0.25 + hash2(gx, gz, s0 + 2) * 0.5) * 170;
    const r = 5 + hash2(gx, gz, s0 + 3) * 5, d = Math.hypot(x - cx, z - cz);
    if (d > r) return 0;
    for (const o of ORTE) if (nahe(cx, cz, o, (o.radius || 10) + 50)) return 0;
    return (1 - d / r) ** 1.6 * (7 + hash2(gx, gz, s0 + 4) * 9);
  }
  // Wolfsfels-Terrasse: Höhe = Mittel der Umgebung (einmal bestimmt), damit sie in den Hang geschnitten ist
  let terrasseH = 0;

  /** Höhe ohne Wege-Glättung und ohne Fluss. */
  function roh(x, z) {
    let h = basis(x, z);
    const dw = Math.hypot(x - WOLFSFELS.x, z - WOLFSFELS.z);
    if (dw < 100) {
      h = lerp(terrasseH, h, smoothstep(WOLFSFELS.r + 6, WOLFSFELS.r + 44, dw));
      // Felswand im Norden der Terrasse
      h += smoothstep(0, 40, WOLFSFELS.z - z) * smoothstep(WOLFSFELS.r + 6, WOLFSFELS.r + 20, dw) * (1 - smoothstep(60, 100, dw)) * 16;
    }
    return h;
  }
  function basis(x, z) {
    const det = fbm2(n2, x / 140, z / 140, 3);
    const wald = 15 + det * 2.5 + n1(x / 600, z / 600) * 2;
    const [hx, hz] = warp2(n2, x / 300 + 40, z / 300, 0.7, 0.8);   // Hügelwellen, verwirbelt
    const hoch = 40 + fbm2(n1, x / 380, z / 380, 3) * 16 + det * 3 + fbm2(n3, hx, hz, 3) * 9 + nadel(x, z);
    let h = lerp(hoch, wald, smoothstep(420, 900, z));
    if (z < -150) {
      const amp = smoothstep(-350, -1350, z) * 230;
      const [gx, gz] = warp2(n3, x / 650, z / 650, 0.5, 1.3);   // Grate: Domain-Warp + ridged
      const grat = ridged2(n3, gx * 1.5 + 9, gz * 1.5, 4);
      const alt = (1 - Math.abs(fbm2(n3, x / 1500, z / 1500, 3, 2, 0.35))) ** 2;
      const berg = 46 + det * 4 + (alt * 0.6 + grat * 0.55) * amp * 1.1 + fbm2(n3, x / 300 + 5, z / 300, 2) * amp * 0.08;
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
    // Weicher Kartenrand: Westkette (steigt zur Wand), Nordkette (steigt), Ost = Meer
    if (x < -1700 && z < 1500) h += smoothstep(-1750, -2150, x) * smoothstep(1500, 1100, z) * (120 + ridged2(n3, x / 120, z / 120, 3) * 110 + det * 10);
    if (z < -1650) h += smoothstep(-1650, -2100, z) * (110 + ridged2(n3, x / 130 + 3, z / 130, 3) * 120 + det * 10);
    if (x > 1750) h = lerp(h, -14 - Math.max(0, x - 2050) * 0.03, smoothstep(1750, 2050, x) * smoothstep(-1400, -800, z));
    // Moor im Westen: flach, Tümpel-Muster (verwirbelt, zwei Maßstäbe), Bulten
    if (x < -620 && z > -500 && z < 1450) {
      const w = smoothstep(-620, -900, x) * smoothstep(-500, -300, z) * smoothstep(1450, 1300, z) * smoothstep(-1900, -1650, x);
      const [mx, mz] = warp2(n4, x / 80, z / 80, 0.9, 0.7);
      const t = fbm2(n4, mx, mz, 3) * 0.75 + fbm2(n4, x / 21 + 8, z / 21, 2) * 0.25;
      const moor = 12.1 + det * 0.25 + smoothstep(0.1, 0.5, -t) * 0.35 - smoothstep(0.14, 0.38, t) * 1.8;
      h = lerp(h, moor, w);
    }
    // Moorblick: Bult am Fuß der Westkette
    const da = Math.hypot(x - AUSSICHT_MOOR.x, z - AUSSICHT_MOOR.z);
    if (da < 90) h = lerp(Math.max(h, 12) + 15, h, smoothstep(14, 90, da));
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

  {
    let sum = basis(WOLFSFELS.x, WOLFSFELS.z);
    for (let i = 0; i < 8; i++) sum += basis(WOLFSFELS.x + Math.cos(i * 0.785) * 45, WOLFSFELS.z + Math.sin(i * 0.785) * 45);
    terrasseH = sum / 9;
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

  // Flüsse: glatte Kurven (Catmull-Rom, leichte Mäander) mit Dichte ~12 m; Wasserspiegel y fällt nur (laufender Mindestwert).
  // Hauptfluss: Furt flach, Mündung im Moorwasser. Erlbach: Quelle im Hochland, Ostrand des Dorfes, Klamm, Dämmerwald, Mündung am Strand.
  function kurve(P, maeander, seedV) {
    const dicht = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 12));
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        dicht.push({ x: f(p0[0], p1[0], p2[0], p3[0]), z: f(p0[1], p1[1], p2[1], p3[1]) });
      }
    }
    dicht.push({ x: P[P.length - 1][0], z: P[P.length - 1][1] });
    dicht.forEach((q, i) => {   // Mäander quer zur Fließrichtung
      const a = dicht[Math.max(0, i - 1)], b = dicht[Math.min(dicht.length - 1, i + 1)], l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const m = n4(i / 9, seedV) * maeander(q);
      q.x += -(b.z - a.z) / l * m; q.z += (b.x - a.x) / l * m;
    });
    return dicht;
  }
  const fluesse = [];
  {   // Hauptfluss
    const dicht = kurve(FLUSS_PUNKTE, (q) => 14 * smoothstep(40, 120, Math.hypot(q.x - FURT.x, q.z - FURT.z)), 4.4);
    const fHoehe = Math.max(0.6, wegInfo(FURT.x, FURT.z).h);
    let lauf = Infinity;
    const roh0 = dicht.map((q) => roh(q.x, q.z));
    dicht.forEach((q, i) => {
      let sm = 0, c = 0;
      for (let j = Math.max(0, i - 7); j <= Math.min(dicht.length - 1, i + 7); j++) { sm += roh0[j]; c++; }
      const df = Math.hypot(q.x - FURT.x, q.z - FURT.z), dm = smoothstep(-640, -760, q.x);
      let y = sm / c - 0.3;
      y = lerp(y, fHoehe - 0.55, 1 - smoothstep(40, 140, df));
      y = lerp(y, MOOR_WASSER + 0.02, dm);
      lauf = Math.min(lauf, y); q.y = lauf;
      const lauflaenge = i / (dicht.length - 1), furtNah = 1 - smoothstep(25, 80, df);
      q.b = lerp(3.2, 7.5, lauflaenge) * (1 + 0.35 * furtNah);
      q.tiefe = lerp(1.4, 0.4, furtNah); q.hang = lerp(0.3, 0.1, furtNah); q.rand = 14;
    });
    fluesse.push({ id: 'fluss', name: 'Grauwasser', dicht });
  }
  {   // Erlbach: schmal, Bett folgt dem geglätteten Boden, nahe dem Meer auf 0 auslaufend
    const dicht = kurve(ERLBACH_PUNKTE, (q) => 6 * smoothstep(1700, 1500, q.z), 7.9);
    let lauf = Infinity;
    const roh0 = dicht.map((q) => roh(q.x, q.z));
    dicht.forEach((q, i) => {
      let mn = Infinity;
      for (let j = Math.max(0, i - 3); j <= Math.min(dicht.length - 1, i + 3); j++) mn = Math.min(mn, roh0[j]);
      let y = mn - 0.35;
      y = lerp(y, -0.2, smoothstep(1840, 1930, q.z));
      lauf = Math.min(lauf, y); q.y = lauf;
      const t = i / (dicht.length - 1);
      q.b = lerp(1.1, 3.2, t); q.tiefe = lerp(0.5, 0.9, t); q.hang = 0.3;
      q.rand = clamp((roh0[i] - q.y) * 2.4, 12, 32);   // tiefe Klamm → breitere Böschung
    });
    fluesse.push({ id: 'erlbach', name: 'Erlbach', dicht });
  }
  const dicht = fluesse[0].dicht;
  const fSeg = new Map(), FZ = 64, FM = 38;   // Raster: Zelle → [Fluss, Segment], deren Kasten (+ Rand) sie berührt
  fluesse.forEach((fl, fiNr) => {
    const D = fl.dicht;
    for (let i = 0; i < D.length - 1; i++) {
      const a = D[i], b = D[i + 1], r = Math.max(a.b, b.b) + FM;
      for (let cz = Math.floor((Math.min(a.z, b.z) - r) / FZ); cz <= Math.floor((Math.max(a.z, b.z) + r) / FZ); cz++)
        for (let cx = Math.floor((Math.min(a.x, b.x) - r) / FZ); cx <= Math.floor((Math.max(a.x, b.x) + r) / FZ); cx++) {
          const key = cx * 4096 + cz, l = fSeg.get(key), e = fiNr * 100000 + i;
          if (l) l.push(e); else fSeg.set(key, [e]);
        }
    }
  });
  const fi = { d: 1e9, y: 0, b: 0, tiefe: 1, hang: 0.3, rand: 14, id: '' };
  /** Nächster Flusspunkt (aller Flüsse): Abstand d, Wasserspiegel y, halbe Breite b, id (d = 1e9 → kein Fluss in der Nähe). */
  function flussInfo(x, z) {
    fi.d = 1e9;
    const l = fSeg.get(Math.floor(x / FZ) * 4096 + Math.floor(z / FZ));
    if (!l) return fi;
    let best = Infinity, bD = null, bi = 0, bt = 0, bId = '';
    for (const e of l) {
      const fl = fluesse[Math.floor(e / 100000)], i = e % 100000, D = fl.dicht;
      const [d2, t] = strecke(x, z, D[i], D[i + 1]);
      // weichster Vergleich: Abstand relativ zur Breite (ein schmaler Bach neben dem breiten Fluss gewinnt nicht falsch)
      const g = Math.sqrt(d2) - lerp(D[i].b, D[i + 1].b, t);
      if (g < best) { best = g; bD = D; bi = i; bt = t; bId = fl.id; }
    }
    const a = bD[bi], b = bD[bi + 1], [d2] = strecke(x, z, a, b);
    fi.d = Math.sqrt(d2); fi.y = lerp(a.y, b.y, bt); fi.b = lerp(a.b, b.b, bt); fi.tiefe = lerp(a.tiefe, b.tiefe, bt); fi.hang = lerp(a.hang, b.hang, bt); fi.rand = lerp(a.rand, b.rand, bt); fi.id = bId;
    return fi;
  }
  function hoehe(x, z) {
    let h = roh(x, z);
    const w = wegInfo(x, z);
    if (w.d <= 18) h = lerp(w.h, h, smoothstep(w.breite, w.breite + 14, w.d));
    const f = flussInfo(x, z);
    if (f.d < f.b + f.rand) {
      const q = f.d / f.b, tgt = f.d < f.b ? f.y - f.tiefe * (1 - q * q) : f.y + (f.d - f.b) * f.hang;
      h = lerp(h, tgt, 1 - smoothstep(f.b, f.b + f.rand, f.d));
    }
    return h;
  }
  const inMoorBox = (x, z) => x > MOOR_BOX.x0 && x < MOOR_BOX.x1 && z > MOOR_BOX.z0 && z < MOOR_BOX.z1;
  function wasserHoehe(x, z, h = hoehe(x, z)) {
    if (inMoorBox(x, z) && h < MOOR_WASSER) return MOOR_WASSER;
    if (h < 0) return 0;
    const f = flussInfo(x, z);
    if (f.d < f.b + 1 && h < f.y - 0.03) return f.y;
    return null;
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
    if (x > 1500 && h < 3.2 && id !== 'gebirge') return 'strand';   // Ostküste
    switch (id) {
      case 'kueste': return h < 3.2 ? 'strand' : 'duene';
      case 'daemmerwald': return Math.abs(x) < 500 + d * 80 ? 'urwald' : 'laubwald';
      case 'erlenwacht': return 'wiese';
      case 'moor': return h > 140 ? 'fels' : h > 40 ? 'heide' : 'sumpf';
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
    hoehe, wasserHoehe, region, biom, farbe, wegInfo, meerZ, roh, flussInfo,
    fluss: { proben: dicht.map((q) => ({ x: q.x, z: q.z, y: q.y, b: q.b })), furt: { ...FURT } },
    fluesse: fluesse.map((f) => ({ id: f.id, name: f.name, proben: f.dicht.map((q) => ({ x: q.x, z: q.z, y: q.y, b: q.b })) })),
    abstandZumWeg: (x, z) => wegInfo(x, z).d,
    regionen: REGIONEN.map((r) => ({ ...r, mitte: { ...r.mitte } })),
    orte: ORTE.map((o) => ({ ...o })),
    ort(id) { return this.orte.find((o) => o.id === id) || null; },
    wege: WEGE, startPunkt: { x: ORTE[0].x, z: ORTE[0].z }, groesse: { x: 4096, z: 4096 }, moor: { ...MOOR_BOX, wasser: MOOR_WASSER },
  };
}
