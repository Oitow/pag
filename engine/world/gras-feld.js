/**
 * @modul    gras-feld
 * @zweck    Wogendes Gras um den Fokus: ein InstancedMesh (ein Draw-Call), Halm-Büschel aus gekreuzten, sich verjüngenden Streifen, Wind + Ausblenden (Größe → 0) im Vertex-Shader; Platzierung rein und deterministisch aus der Weltkarte
 * @api      createGrasFeld({ karte, seed, weite = 45, dichte = 1, max, sperren }) -> { mesh, update(dt, fokus{x,z}, zeit), setzeDichte(d), anzahl, dispose() } ; grasPunkte(karte, kachel{x0,z0,groesse}, { seed, dichte, sperren }) -> { n, daten:Float32Array } (Schritt PUNKT_STRIDE: x,y,z,drehung,breite,hoehe,r,g,b(linear),rang[0..1]) ; PUNKT_STRIDE ; GRAS_DICHTE
 * @beispiel
 *   const gras = createGrasFeld({ karte: createWeltRegionen({ seed: 1207 }), seed: 1207, weite: 45 });
 *   szene.add(gras.mesh);   // je Bild: gras.update(dt, { x: spieler.x, z: spieler.z }, zeit);
 * @tags     gras, vegetation, instanzen, wind, boden, welt, render
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { hashSeed, hash2, hash3 } from '../core/rng.js';
import { createKachelRing } from './chunk-strom.js';
import { srgbZuLinear } from './terrain-farben.js';
import { patcheShader } from '../render/natur-material.js';

export const PUNKT_STRIDE = 10;
/** Büschel je m² und Biom (Wiese voll, Wald halb, Heide wenig). */
export const GRAS_DICHTE = { wiese: 9, laubwald: 4, urwald: 2.5, sumpf: 4, heide: 3, nadelwald: 1.8, duene: 1, strand: 0, fels: 0 };
const HOEHE = { wiese: [0.5, 0.8], laubwald: [0.4, 0.65], urwald: [0.35, 0.55], sumpf: [0.5, 0.8], heide: [0.3, 0.5], nadelwald: [0.3, 0.5], duene: [0.35, 0.6] };
const TROCKEN = { wiese: 0.22, laubwald: 0.15, urwald: 0.08, sumpf: 0.1, heide: 0.6, nadelwald: 0.12, duene: 0.5 };
const DRY = [0.66, 0.54, 0.28];   // trockenes Gelb-Braun (sRGB)
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const tmp = [0, 0, 0];

/**
 * Büschel einer Kachel (Zellen à 1 m, je Zelle Biom/Weg/Hang einmal geprüft). Kein Gras: Weg, Wasser/Ufer, Fels, Strand, steil, in `sperren`.
 * Ergebnis ist unabhängig von der Kachelgrenze (globale Zellen) → deterministisch, nahtlos.
 */
export function grasPunkte(karte, kachel, { seed = 1, dichte = 1, sperren } = {}) {
  const { x0, z0, groesse } = kachel, s0 = hashSeed('gras', seed), sp = sperren ? sperren() : [];
  const i0 = Math.floor(x0), j0 = Math.floor(z0), n = Math.ceil(groesse);
  let daten = new Float32Array(Math.max(1, n * n * 3) * PUNKT_STRIDE), anz = 0;
  for (let j = j0; j < j0 + n; j++) for (let i = i0; i < i0 + n; i++) {
    const cx = i + 0.5, cz = j + 0.5, h = karte.hoehe(cx, cz);
    if (h < 0.9) continue;
    const biom = karte.biom(cx, cz, h), basis = GRAS_DICHTE[biom] || 0;
    if (basis <= 0) continue;
    const wh = karte.wasserHoehe(cx, cz, h);
    if (wh !== null && wh !== undefined && wh > h - 0.35) continue;
    const w = karte.wegInfo(cx, cz), wd = w.d, wb = w.breite;
    if (wd < wb + 1.3) continue;
    if (sp.some((o) => (cx - o.x) ** 2 + (cz - o.z) ** 2 < (o.r + 0.75) ** 2)) continue;
    const hx = karte.hoehe(cx + 0.5, cz), hz = karte.hoehe(cx, cz + 0.5), gx = (hx - h) * 2, gz = (hz - h) * 2;
    const steil = 1 - 1 / Math.hypot(gx, 1, gz);
    const hang = 1 - smooth(0.18, 0.4, steil);
    const patch = 0.7 + 0.3 * Math.sin(cx * 0.19 + Math.sin(cz * 0.13) * 2) * Math.sin(cz * 0.21 + Math.sin(cx * 0.11) * 2);
    const rand = smooth(wb + 1.3, wb + 4, wd);   // am Wegrand ausdünnen
    const erw = basis * dichte * hang * patch * (0.4 + 0.6 * rand);
    let k = Math.floor(erw), rest = erw - k;
    if (hash3(i, j, 99, s0) < rest) k++;
    if (k <= 0) continue;
    karte.farbe(cx, cz, h, steil, tmp);
    const gr = Math.min(1, tmp[0] * 1.1), gg = Math.min(1, tmp[1] * 1.2), gb = Math.min(1, tmp[2] * 1.05);
    const hb = HOEHE[biom], tr = TROCKEN[biom] || 0.1;
    for (let q = 0; q < k; q++) {
      if (anz >= daten.length / PUNKT_STRIDE) { const g = new Float32Array(daten.length * 2); g.set(daten); daten = g; }
      const u = hash3(i, j, q, s0 + 1), x = i + hash3(i, j, q, s0 + 2), z = j + hash3(i, j, q, s0 + 3);
      if (x < x0 || x >= x0 + groesse || z < z0 || z >= z0 + groesse) continue;
      const dry = Math.pow(hash3(i, j, q, s0 + 4), 1.5) * tr * 2, v = 0.78 + 0.42 * hash3(i, j, q, s0 + 5);
      const o = anz * PUNKT_STRIDE;
      daten[o] = x; daten[o + 1] = h + gx * (x - cx) + gz * (z - cz) - 0.04; daten[o + 2] = z;
      daten[o + 3] = hash3(i, j, q, s0 + 6) * 6.2832;
      daten[o + 4] = 0.8 + 0.5 * hash3(i, j, q, s0 + 7);
      daten[o + 5] = hb[0] + (hb[1] - hb[0]) * hash3(i, j, q, s0 + 8) * (1 - dry * 0.3);
      daten[o + 6] = srgbZuLinear((gr + (DRY[0] - gr) * Math.min(1, dry)) * v);
      daten[o + 7] = srgbZuLinear((gg + (DRY[1] - gg) * Math.min(1, dry)) * v);
      daten[o + 8] = srgbZuLinear((gb + (DRY[2] - gb) * Math.min(1, dry)) * v);
      daten[o + 9] = u; anz++;
    }
  }
  return { n: anz, daten: daten.subarray(0, anz * PUNKT_STRIDE) };
}

/** Büschel-Geometrie: 3 gekreuzte Streifen (Einheitshöhe 1, ~0.18 m breit), Basis dunkel → Spitze hell/trocken, Normalen nach oben (weiches Licht), 2 Seiten. */
function baueHalmGeo() {
  const pos = [], col = [], nor = [], wind = [], idx = [];
  const reihen = [[0.1, 0, 0.5, 0.55], [0.062, 0.55, 0.9, 0.85], [0, 1, 1.35, 1.1]];   // halbe Breite, Höhe, Farbfaktor R, G (Spitze heller/trockener)
  for (let st = 0; st < 3; st++) {
    const a = (st * Math.PI) / 3, ca = Math.cos(a), sa = Math.sin(a), b0 = pos.length / 3;
    for (const [hb, y, f, fg] of reihen) {
      const lehn = y * y * 0.08;   // Spitze neigt leicht
      for (const sg of [-1, 1]) {
        pos.push(ca * hb * sg + sa * lehn, y, sa * hb * sg - ca * lehn);
        col.push(f, fg * (y > 0.9 ? 0.95 : 1), f * 0.62 * (y > 0.9 ? 0.85 : 1)); nor.push(0, 1, 0); wind.push(y);
      }
    }
    for (let r = 0; r < 2; r++) {
      const a0 = b0 + r * 2, a1 = a0 + 1, c0 = a0 + 2, c1 = a0 + 3;
      idx.push(a0, c0, a1, a1, c0, c1, a0, a1, c0, c0, a1, c1);
    }
  }
  // Rückseiten: Dreiecke mit umgekehrter Reihenfolge (Normalen bleiben "oben")
  const n = idx.length, vorne = idx.slice(0, n);
  const alle = [];
  for (let t = 0; t < n; t += 3) { alle.push(vorne[t], vorne[t + 1], vorne[t + 2]); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('wind', new THREE.Float32BufferAttribute(wind, 1));
  g.setIndex(alle);
  return g;
}

export function createGrasFeld({ karte, seed = 1, weite = 45, dichte = 1, max, sperren, richtung = [1, 0.35] } = {}) {
  const cap = max ?? (weite >= 36 ? 60000 : 15000);
  const geo = baueHalmGeo();
  const uniforms = {
    nwZeit: { value: 0 }, nwStaerke: { value: 1 }, nwAmp: { value: 0.12 }, nwGrund: { value: 0.16 },
    nwWeite: { value: weite }, nwRicht: { value: new THREE.Vector2(...richtung).normalize() },
  };
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    patcheShader(sh, uniforms, { wind: true, weite });
    sh.vertexShader = sh.vertexShader.replace('nwWeite * 0.8', 'nwWeite * 0.35');   // langer, weicher Übergang zum Boden
    // Halm-Normalen zeigen nach oben: Rückseite NICHT umdrehen (sonst schwarze Halme), leicht aufhellen (Durchscheinen)
    sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n  normal = normalize( vNormal );')
      .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= 0.98;');
  };
  mat.customProgramCacheKey = () => 'gras-feld';
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.name = 'gras-feld'; mesh.frustumCulled = false; mesh.count = 0; mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  const mat4 = mesh.instanceMatrix.array, farben = mesh.instanceColor.array;
  const ring = createKachelRing({
    groesse: 16, radius: weite, budget: 4,
    lade: (k) => grasPunkte(karte, k, { seed, dichte: aktDichte, sperren }),
  });
  let aktDichte = dichte, letzte = '', anzahl = 0;

  function fuelle(fx, fz) {
    const kacheln = [...ring.geladen.values()].map((e) => ({ k: e.k, p: e.obj })).sort((a, b) => a.k.abstand - b.k.abstand);
    let n = 0;
    for (const { k, p } of kacheln) {
      const d = Math.hypot(Math.max(k.x0 - fx, 0, fx - k.x0 - k.groesse), Math.max(k.z0 - fz, 0, fz - k.z0 - k.groesse));
      const anteil = 1 - 0.7 * Math.min(1, d / weite);   // außen dünner
      const D = p.daten;
      for (let o = 0; o < p.n * PUNKT_STRIDE && n < cap; o += PUNKT_STRIDE) {
        if (D[o + 9] > anteil) continue;
        const c = Math.cos(D[o + 3]), s = Math.sin(D[o + 3]), sx = D[o + 4], sy = D[o + 5], m = n * 16;
        mat4[m] = c * sx; mat4[m + 1] = 0; mat4[m + 2] = -s * sx; mat4[m + 3] = 0;
        mat4[m + 4] = 0; mat4[m + 5] = sy; mat4[m + 6] = 0; mat4[m + 7] = 0;
        mat4[m + 8] = s * sx; mat4[m + 9] = 0; mat4[m + 10] = c * sx; mat4[m + 11] = 0;
        mat4[m + 12] = D[o]; mat4[m + 13] = D[o + 1]; mat4[m + 14] = D[o + 2]; mat4[m + 15] = 1;
        farben[n * 3] = D[o + 6]; farben[n * 3 + 1] = D[o + 7]; farben[n * 3 + 2] = D[o + 8]; n++;
      }
    }
    mesh.count = anzahl = n;
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
  }

  return {
    mesh,
    update(dt, fokus, zeit = 0) {
      uniforms.nwZeit.value = zeit;
      const r = ring.update(fokus.x, fokus.z);
      const schluessel = `${Math.floor(fokus.x / 8)}:${Math.floor(fokus.z / 8)}:${ring.geladen.size}`;
      if (r.geladen || r.entladen || schluessel !== letzte) { letzte = schluessel; fuelle(fokus.x, fokus.z); }
    },
    setzeDichte(d) { aktDichte = d; ring.neuLaden(); letzte = ''; },
    wind(staerke, r) { uniforms.nwStaerke.value = staerke; if (r) uniforms.nwRicht.value.set(r[0], r[1]).normalize(); },
    get anzahl() { return anzahl; },
    dispose() { ring.dispose(); geo.dispose(); mat.dispose(); mesh.dispose(); },
  };
}
