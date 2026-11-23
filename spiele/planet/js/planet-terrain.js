// Reines Terrain-Modell (ohne THREE): Höhe, Biome, Feuchte, Farben.
// Wird von planet.js benutzt; läuft auch in Node (für Kartentests).
import { createNoise3D, fbm, ridged, hashSeed, hash3 } from './noise.js';

const DEG = 180 / Math.PI;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

// Farbpalette (sRGB 0..1)
const hex = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const PAL = {
  wiese: hex(0x6fa83c), wiese2: hex(0x93bf4a),
  wald: hex(0x2f5a26), wald2: hex(0x47612a),
  sumpf: hex(0x4d5226), sumpf2: hex(0x3b4a2e),
  ebene: hex(0xb9a752), ebene2: hex(0x9ea548),
  wueste: hex(0xd99a52), wueste2: hex(0xe8b46a),
  asche: hex(0x5b4b45), asche2: hex(0x6e4636),
  eis: hex(0xe9f1fa), eis2: hex(0xcfe0f2),
  sand: hex(0xe4d39a), sandNass: hex(0xb8a67a),
  fels: hex(0x8f8b86), fels2: hex(0x75726f),
  felsRot: hex(0x9a5a3a), felsDunkel: hex(0x3d3537),
  schnee: hex(0xf4f7fb),
  grund: hex(0x8f8a6a), grundTief: hex(0x3b4a52),
};

export function createTerrain(seed, DATA) {
  const MAX_H = DATA.MAX_HOEHE, MAX_T = DATA.MAX_TIEFE;
  const nW = createNoise3D(hashSeed('warp', seed));
  const nC = createNoise3D(hashSeed('kontinent', seed));
  const nH = createNoise3D(hashSeed('huegel', seed));
  const nM = createNoise3D(hashSeed('berg', seed));
  const nK = createNoise3D(hashSeed('bergmaske', seed));
  const nF = createNoise3D(hashSeed('feuchte', seed));
  const nR = createNoise3D(hashSeed('ring', seed));
  const nD = createNoise3D(hashSeed('detail', seed));

  // Spawn (wird unten bestimmt). Bis dahin "kein Spawn".
  let sx = 0, sy = 0, sz = 1, spawnAktiv = false;
  let thr = 0;

  function kontinent(x, y, z) {
    const wx = nW(x * 1.6, y * 1.6, z * 1.6), wy = nW(y * 1.6 + 5.2, z * 1.6 + 1.3, x * 1.6 + 7.7);
    const cx = x + wx * 0.22, cy = y + wy * 0.22, cz = z + (wx - wy) * 0.15;
    return fbm(nC, cx * 1.15, cy * 1.15, cz * 1.15, 4) + 0.06 * nD(x * 9, y * 9, z * 9);
  }
  const ringWarp = (x, y, z) => 9 * nR(x * 2.1, y * 2.1, z * 2.1) + 3 * nR(x * 7 + 3, y * 7, z * 7);
  const feuchte0 = (x, y, z) => Math.min(1, Math.max(0, 0.5 + 0.9 * fbm(nF, x * 2.4, y * 2.4, z * 2.4, 2)));

  // Rohe Höhe in m an Einheitsvektor (x,y,z)
  function rawHeight(x, y, z) {
    const dS = x * sx + y * sy + z * sz;
    let c = kontinent(x, y, z);
    let spawnW = 0;
    if (spawnAktiv) { spawnW = smooth(0.966, 0.9986, dS); c += 0.22 * smooth(0.95, 0.995, dS); }
    const e = c - thr;
    let h;
    if (e < 0) {
      const t = -e;
      h = -2.5 * smooth(0, 0.035, t) - (MAX_T - 6) * smooth(0.03, 0.32, t);
      h += 4 * smooth(0.03, 0.12, t) * fbm(nH, x * 7, y * 7, z * 7, 2);
      if (h < -MAX_T) h = -MAX_T;
      // Flache Küstenzone: kaum Detail
      return h;
    }
    const ring = spawnAktiv ? Math.acos(Math.max(-1, Math.min(1, dS))) * DEG : 90;
    const rw = ring + ringWarp(x, y, z);
    // Grundprofil: Strand → Tiefland → Hochland
    h = 1.6 * smooth(0, 0.05, e) + 16 * smooth(0.05, 0.42, e);
    // Hügel
    let hillAmp = 11 * smooth(0.02, 0.14, e);
    const ebene = smooth(55, 62, rw) * (1 - smooth(102, 108, rw));
    hillAmp *= 1 - 0.55 * ebene;
    hillAmp *= 1 - 0.65 * spawnW;
    h += hillAmp * (fbm(nH, x * 6.5, y * 6.5, z * 6.5, 3) + 0.3 * smooth(0.04, 0.12, e));
    // Sumpf: feuchtes Tiefland im Ring 40–80° wird flach und tief
    const sumpfW = rw > 38 && rw < 84 ? smooth(38, 44, rw) * (1 - smooth(78, 84, rw)) * smooth(0.45, 0.6, feuchte0(x, y, z)) : 0;
    if (sumpfW > 0 && h < 18) h = mix(h, 1.2 + 2.2 * nD(x * 18, y * 18, z * 18) + h * 0.15, sumpfW * (1 - smooth(10, 18, h)));
    // Berge (gratig), nicht in den Startwiesen
    const bergMaske = smooth(-0.05, 0.3, fbm(nK, x * 1.7, y * 1.7, z * 1.7, 2) + 0.05) * smooth(0.03, 0.2, e) * smooth(21, 33, rw) * (1 - 0.8 * sumpfW);
    if (bergMaske > 0.001) {
      const r = ridged(nM, x * 3.0, y * 3.0, z * 3.0, 4);
      h += Math.pow(r, 1.35) * (MAX_H - 8) * bergMaske;
    }
    // Dünen in der Glutwüste
    const wuesteW = smooth(102, 110, rw) * (1 - smooth(146, 152, rw));
    if (wuesteW > 0) h += wuesteW * 2.6 * (1 - Math.abs(nD(x * 22 + y * 6, y * 22, z * 22))) * smooth(0.03, 0.1, e);
    // feine Details
    h += 0.7 * nD(x * 34, y * 34, z * 34) * smooth(0.02, 0.08, e);
    // Spawn-Nähe: kein Wasser, sanft
    if (spawnW > 0) h = mix(h, Math.max(h, 3.2), spawnW);
    // weiche Obergrenze
    if (h > MAX_H - 10) h = MAX_H - 10 + 10 * Math.tanh((h - (MAX_H - 10)) / 10);
    return h;
  }

  // Schwelle für ~50 % Ozean bestimmen (Fibonacci-Kugel)
  {
    const n = 5000, vals = new Float32Array(n), ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i + 0.5) * 2 / n, r = Math.sqrt(1 - y * y), a = i * ga;
      vals[i] = kontinent(Math.cos(a) * r, y, Math.sin(a) * r);
    }
    vals.sort(); thr = vals[Math.floor(n * 0.5)];
  }
  // Spawn suchen: nahe Äquator, mitten in großer Landmasse
  {
    let best = -1e9, bx = 0, bz = 1, by = 0;
    const e = (x, y, z) => Math.min(0.25, kontinent(x, y, z) - thr);
    const ringScore = (x, y, z, ang, k) => {
      // Mittelwert über k Punkte im Abstand ang
      let ux = -z, uy = 0, uz = x; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
      const vx = y * uz - z * uy, vy = z * ux - x * uz, vz = x * uy - y * ux;
      const ca = Math.cos(ang), sa = Math.sin(ang); let s = 0;
      for (let i = 0; i < k; i++) {
        const b = i / k * Math.PI * 2, cb = Math.cos(b) * sa, sb = Math.sin(b) * sa;
        s += e(x * ca + ux * cb + vx * sb, y * ca + uy * cb + vy * sb, z * ca + uz * cb + vz * sb);
      }
      return s / k;
    };
    for (let lat = -5; lat <= 5; lat += 2.5) for (let lon = 0; lon < 360; lon += 3) {
      const la = lat / DEG, lo = lon / DEG;
      const x = Math.cos(la) * Math.sin(lo), y = Math.sin(la), z = Math.cos(la) * Math.cos(lo);
      const c0 = e(x, y, z);
      if (c0 < 0.05) continue;
      const s = c0 + ringScore(x, y, z, 8 / DEG, 6) + 0.6 * ringScore(x, y, z, 18 / DEG, 8);
      if (s > best) { best = s; bx = x; by = y; bz = z; }
    }
    sx = bx; sy = by; sz = bz; spawnAktiv = true;
  }

  const ringDeg = (x, y, z) => Math.acos(Math.max(-1, Math.min(1, x * sx + y * sy + z * sz))) * DEG;
  function feuchte(x, y, z, h) {
    let f = feuchte0(x, y, z);
    f += 0.18 * (1 - smooth(0, 14, h));
    const lat = Math.abs(y);
    f -= 0.25 * smooth(102, 115, ringDeg(x, y, z) + ringWarp(x, y, z)); // Wüste trocken
    return Math.min(1, Math.max(0, f + 0 * lat));
  }
  const eisW = (x, y, z) => smooth(60, 64, Math.asin(Math.max(-1, Math.min(1, y))) * DEG * Math.sign(y) + 4 * nR(x * 3 + 11, y * 3, z * 3));
  const bergGrenze = (x, y, z) => 40 + 6 * nR(x * 5, y * 5 + 7, z * 5);

  function biome(x, y, z, h) {
    if (h < 0) return 'ozean';
    const rw = ringDeg(x, y, z) + ringWarp(x, y, z);
    if (eisW(x, y, z) > 0.5) return 'eis';
    if (rw > 25 && h > bergGrenze(x, y, z)) return 'berge';
    if (h < 1.3 + 0.4 * nD(x * 13, y * 13, z * 13) && rw > 3) return 'strand';
    if (rw < 25) return 'wiese';
    const fe = feuchte0(x, y, z);
    if (rw > 41 && rw < 81 && fe > 0.525 && h < 14) return 'sumpf';
    if (rw < 58) return 'wald';
    if (rw < 105) return 'ebene';
    if (rw < 150) return 'wueste';
    return 'asche';
  }

  // Farbe (linear RGB in out[0..2]) für Vertex: Höhe h, Hang slope (0 = flach, 1 = senkrecht)
  const tmp = [0, 0, 0];
  const lerp3 = (o, c, t) => { o[0] += (c[0] - o[0]) * t; o[1] += (c[1] - o[1]) * t; o[2] += (c[2] - o[2]) * t; };
  // Bänder nach Ring (Grenzen in Grad) mit je zwei Farbvarianten
  const BAND_G = [25, 58, 105, 150];
  const BAND_C = [[PAL.wiese, PAL.wiese2], [PAL.wald, PAL.wald2], [PAL.ebene, PAL.ebene2], [PAL.wueste, PAL.wueste2], [PAL.asche, PAL.asche2]];
  const LUT = new Float32Array(1025);
  for (let i = 0; i <= 1024; i++) LUT[i] = Math.pow(i / 1024, 2.2);
  const lin = c => LUT[c >= 1 ? 1024 : c <= 0 ? 0 : (c * 1024) | 0];
  const tmp2 = [0, 0, 0];
  const setMix = (o, A, t) => { o[0] = A[0][0] + (A[1][0] - A[0][0]) * t; o[1] = A[0][1] + (A[1][1] - A[0][1]) * t; o[2] = A[0][2] + (A[1][2] - A[0][2]) * t; };
  const SUMPF = [PAL.sumpf, PAL.sumpf2], EIS = [PAL.eis, PAL.eis2];

  function color(x, y, z, h, slope, out) {
    const v = nD(x * 11 + 5, y * 11, z * 11);       // Flecken
    const v2 = nH(x * 40, y * 40 + 3, z * 40);      // feine Flecken
    const jit = hash3(Math.floor(x * 9000), Math.floor(y * 9000), Math.floor(z * 9000), 7) - 0.5;
    const o = tmp;
    if (h < 0) {
      o[0] = PAL.grund[0]; o[1] = PAL.grund[1]; o[2] = PAL.grund[2];
      lerp3(o, PAL.sand, 1 - smooth(0, 3, -h));
      lerp3(o, PAL.grundTief, smooth(0, 30, -h));
    } else {
      const rw = ringDeg(x, y, z) + ringWarp(x, y, z);
      const pv = Math.min(1, Math.max(0, 0.5 + 0.45 * v + 0.35 * nF(x * 4 + 9, y * 4, z * 4)));
      // Ringbänder
      let bi = 0; while (bi < 4 && rw > BAND_G[bi] + 2.5) bi++;
      setMix(o, BAND_C[bi], pv);
      if (bi < 4 && rw > BAND_G[bi] - 2.5) { setMix(tmp2, BAND_C[bi + 1], pv); lerp3(o, tmp2, smooth(BAND_G[bi] - 2.5, BAND_G[bi] + 2.5, rw)); }
      // Sumpf
      if (rw > 39 && rw < 83 && h < 16) {
        const fe = feuchte0(x, y, z);
        const sw = smooth(39, 43, rw) * (1 - smooth(79, 83, rw)) * smooth(0.5, 0.55, fe) * (1 - smooth(12, 16, h));
        if (sw > 0) { setMix(tmp2, SUMPF, pv); lerp3(o, tmp2, sw); }
      }
      // Polkappen
      const ew = Math.abs(y) > 0.8 ? eisW(x, y, z) : 0;
      if (ew > 0) { setMix(tmp2, EIS, pv); lerp3(o, tmp2, ew); }
      // Strand
      if (h < 2.2 && rw > 3) {
        const st = 1 - smooth(0.9, 1.7, h + 0.4 * nD(x * 13, y * 13, z * 13));
        if (st > 0) { lerp3(o, rw > 150 ? PAL.felsDunkel : PAL.sand, st * (1 - ew * 0.7)); if (h < 0.35) lerp3(o, PAL.sandNass, 1 - smooth(0.05, 0.35, h)); }
      }
      // Fels: Berge & Hänge
      const bw = h > 28 && rw > 23 ? (() => { const bg = bergGrenze(x, y, z); return smooth(bg - 5, bg + 3, h) * smooth(23, 27, rw); })() : 0;
      const hw = smooth(0.28, 0.48, slope);
      const fw = Math.max(bw * (0.75 + 0.25 * v2), hw);
      if (fw > 0) {
        const fels = rw > 150 ? PAL.felsDunkel : rw > 105 ? PAL.felsRot : (v2 > 0 ? PAL.fels : PAL.fels2);
        const sch = 0.86 + 0.14 * Math.sin(h * 0.55 + 3 * v + 2 * v2);   // Gesteinsschichten
        tmp2[0] = fels[0] * sch; tmp2[1] = fels[1] * sch; tmp2[2] = fels[2] * sch;
        lerp3(o, tmp2, fw);
      }
      // Schnee auf Gipfeln (flachere Stellen) und auf Eisbergen
      const schneeH = 60 + 8 * v - 30 * ew;
      if (h > schneeH - 3) { const sn = smooth(schneeH - 3, schneeH + 3, h) * (1 - smooth(0.45, 0.65, slope)); lerp3(o, PAL.schnee, sn); }
      // leichte Höhenaufhellung
      const hl = 1 + 0.12 * smooth(10, 80, h);
      o[0] *= hl; o[1] *= hl; o[2] *= hl;
    }
    const k = 1 + 0.07 * v2 + 0.06 * jit;
    out[0] = lin(o[0] * k); out[1] = lin(o[1] * k); out[2] = lin(o[2] * k);
    return out;
  }

  return {
    rawHeight, biome, color, feuchte, ringDeg,
    spawn: [sx, sy, sz], thr,
  };
}
