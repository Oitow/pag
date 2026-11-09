/**
 * @modul    terrain-mesh
 * @zweck    Baut aus einer erzeugten Welt (worldgen) und ihrem Welt-Adapter ein Three-Gelände: Boden mit Biomfarben, Hangfels und Farbrauschen, Seen/Flüsse auf ihrem Wasserspiegel und ein Meer bis zum Horizont
 * @api      createTerrainMesh(adapter, opts) -> {gruppe,boden,wasser,meer,dispose} (wasser/meer = null bei opts.wasser === false) ; biomFarben(welt) -> Float32Array
 * @beispiel
 *   import { createTerrainMesh } from '../../engine/world/terrain-mesh.js';
 *   const gelaende = createTerrainMesh(adapter, { schritt: 1, schatten: true });
 *   szene.add(gelaende.gruppe);
 * @tags     welt, terrain, gelaende, wasser, meer, mesh, biome
 * @version  1.1.0
 * @status   entwurf
 * @three    ja
 */

import * as THREE from 'three';
import { hash2 } from '../core/rng.js';
import { FLAG } from './worldgen/worldgen-grid.js';

const SEE_FLUSS = FLAG.SEE | FLAG.FLUSS;

/** Biomfarben als RGB-Tabelle (0…1) je Biom-Id. */
export function biomFarben(welt) {
  const t = new Float32Array(welt.biome.length * 3), c = new THREE.Color();
  welt.biome.forEach((b, i) => { c.setHex(b.farbe ?? 0x88aa66); t[i * 3] = c.r; t[i * 3 + 1] = c.g; t[i * 3 + 2] = c.b; });
  return t;
}

/**
 * opts: schritt (Gitterzellen je Vertex, 1 = volle Auflösung), schatten, meerGroesse (Vielfaches der Karte),
 * farbRauschen (0…1), felsFarbe, wasserFarbe, meerFarbe, wasserDeckkraft,
 * wasser (false = keine Seen/Flüsse/Meer zeichnen, z. B. weil water-mesh das übernimmt; Meeresgrund bleibt).
 */
export function createTerrainMesh(adapter, opts = {}) {
  const welt = adapter.welt;
  const schritt = Math.max(1, opts.schritt | 0 || 1);
  const rauschen = opts.farbRauschen ?? 0.08;
  const fels = new THREE.Color(opts.felsFarbe ?? 0x7d7468);
  const B = welt.breite, T = welt.tiefe, z = welt.zelle, hs = adapter.hoehenSkala;
  const nx = Math.floor((B - 1) / schritt) + 1, nz = Math.floor((T - 1) / schritt) + 1;
  const farben = biomFarben(welt);
  const gruppe = new THREE.Group(); gruppe.name = 'gelaende';

  // ---- Boden ----
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const gx = Math.min(B - 1, i * schritt), gy = Math.min(T - 1, j * schritt), s = gy * B + gx, v = (j * nx + i) * 3;
    const p = adapter.zuWelt(gx * z, gy * z);
    pos[v] = p.x; pos[v + 1] = welt.hoehe[s] * hs; pos[v + 2] = p.z;
    const b = welt.biom[s] * 3;
    let r = farben[b], g = farben[b + 1], bl = farben[b + 2];
    // Steile Hänge werden Fels, ein wenig Rauschen bricht die Flächen auf
    const hang = welt.hang ? Math.min(1, Math.max(0, (welt.hang[s] * hs / adapter.meterProZelle - 0.7) * 1.4)) : 0;
    r += (fels.r - r) * hang; g += (fels.g - g) * hang; bl += (fels.b - bl) * hang;
    const f = 1 + (hash2(gx, gy, welt.seed | 0) - 0.5) * 2 * rauschen;
    col[v] = r * f; col[v + 1] = g * f; col[v + 2] = bl * f;
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(nx * nz > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const bodenMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: !!opts.flach });
  const boden = new THREE.Mesh(geo, bodenMat);
  boden.name = 'boden';
  boden.receiveShadow = opts.schatten !== false;
  gruppe.add(boden);

  // ---- Seen und Flüsse: eigene Fläche auf dem Wasserspiegel ----
  const wpos = [], widx = [], vNr = new Int32Array(nx * nz).fill(-1);
  const istWasser = (gx, gy) => gx >= 0 && gy >= 0 && gx < B && gy < T && (welt.flags[gy * B + gx] & SEE_FLUSS);
  function spiegel(gx, gy) {
    // Eigener Spiegel oder Mittel der Wasser-Nachbarn (Ufer-Vertices)
    let sum = 0, n = 0;
    for (let dy = -schritt; dy <= schritt; dy += schritt) for (let dx = -schritt; dx <= schritt; dx += schritt) {
      const x = gx + dx, y = gy + dy;
      if (istWasser(x, y)) { sum += welt.wasserstand[y * B + x]; n++; }
    }
    return n ? sum / n : null;
  }
  function vertex(i, j) {
    const k = j * nx + i;
    if (vNr[k] >= 0) return vNr[k];
    const gx = Math.min(B - 1, i * schritt), gy = Math.min(T - 1, j * schritt);
    const p = adapter.zuWelt(gx * z, gy * z), h = spiegel(gx, gy) ?? welt.hoehe[gy * B + gx];
    vNr[k] = wpos.length / 3;
    wpos.push(p.x, h * hs + 0.04, p.z);
    return vNr[k];
  }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const gx = i * schritt, gy = j * schritt;
    if (!(istWasser(gx, gy) || istWasser(gx + schritt, gy) || istWasser(gx, gy + schritt) || istWasser(gx + schritt, gy + schritt))) continue;
    const a = vertex(i, j), b = vertex(i + 1, j), c = vertex(i, j + 1), d = vertex(i + 1, j + 1);
    widx.push(a, c, b, b, c, d);
  }
  const wasserMat = new THREE.MeshStandardMaterial({
    color: opts.wasserFarbe ?? 0x3d7fb0, roughness: 0.15, metalness: 0.1, transparent: true,
    opacity: opts.wasserDeckkraft ?? 0.78, depthWrite: false,
  });
  let wasser = null;
  const mitWasser = opts.wasser !== false;
  if (mitWasser && widx.length) {
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
    wg.setIndex(widx);
    wg.computeVertexNormals();
    wasser = new THREE.Mesh(wg, wasserMat);
    wasser.name = 'seen-fluesse';
    wasser.renderOrder = 1;
    gruppe.add(wasser);
  }

  // ---- Meer: große Fläche auf Höhe 0, reicht über den Kartenrand hinaus ----
  const mg = adapter.groesse, faktor = opts.meerGroesse ?? 6;
  const meerGeo = new THREE.PlaneGeometry(mg.x * faktor, mg.z * faktor, 1, 1).rotateX(-Math.PI / 2);
  const meerMat = new THREE.MeshStandardMaterial({
    color: opts.meerFarbe ?? 0x2b6a96, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85, depthWrite: false,
  });
  let meer = null;
  if (mitWasser) {
    meer = new THREE.Mesh(meerGeo, meerMat);
    meer.name = 'meer';
    meer.position.y = 0.02;
    meer.renderOrder = 1;
    gruppe.add(meer);
  } else { meerMat.dispose(); wasserMat.dispose(); }
  // Meeresboden unter dem Meer außerhalb der Karte (kein Blick ins Leere)
  const grund = new THREE.Mesh(meerGeo.clone(), new THREE.MeshStandardMaterial({ color: 0x1d3b4f, roughness: 1 }));
  grund.position.y = -0.8 * hs;
  grund.name = 'meeresgrund';
  gruppe.add(grund);

  return {
    gruppe, boden, wasser, meer,
    dispose() {
      gruppe.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      if (!meer) meerGeo.dispose();
      gruppe.removeFromParent();
    },
  };
}
