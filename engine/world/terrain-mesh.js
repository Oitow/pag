/**
 * @modul    terrain-mesh
 * @zweck    Baut aus einer erzeugten Welt (worldgen) und ihrem Welt-Adapter ein Three-Gelände: Boden mit weich gemischten Biomfarben, Wiesenflecken, Hangfels, Ufern (Sand/Kies/Schlamm) und Schnee (terrain-farben), Seen/Flüsse auf ihrem Wasserspiegel und ein Meer bis zum Horizont
 * @api      createTerrainMesh(adapter, opts) -> {gruppe,boden,wasser,meer,dispose} ; biomFarben(welt) -> Float32Array
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
import { FLAG } from './worldgen/worldgen-grid.js';
import { gelaendeFarben } from './terrain-farben.js';

const SEE_FLUSS = FLAG.SEE | FLAG.FLUSS;

/** Biomfarben als RGB-Tabelle (0…1) je Biom-Id. */
export function biomFarben(welt) {
  const t = new Float32Array(welt.biome.length * 3), c = new THREE.Color();
  welt.biome.forEach((b, i) => { c.setHex(b.farbe ?? 0x88aa66); t[i * 3] = c.r; t[i * 3 + 1] = c.g; t[i * 3 + 2] = c.b; });
  return t;
}

/**
 * opts: schritt (Gitterzellen je Vertex, 1 = volle Auflösung), schatten, meerGroesse (Vielfaches der Karte),
 * farbRauschen (0…1, Stärke der Mikrovariation), wasserFarbe, meerFarbe, wasserDeckkraft.
 * Ab 1.1 (Farben aus terrain-farben): farben {biomKey: 0xRRGGBB}, details (false = nur weich gemischte Biomfarben),
 * schnee (false = kein Temperatur-Schnee), felsAb (Steigung für Hangfels), mulden, weich (Mischradius in Zellen),
 * weichesUfer (false = Wasserfläche endet an Zellkanten wie in 1.0).
 */
export function createTerrainMesh(adapter, opts = {}) {
  const welt = adapter.welt;
  const schritt = Math.max(1, opts.schritt | 0 || 1);
  const B = welt.breite, T = welt.tiefe, z = welt.zelle, hs = adapter.hoehenSkala;
  const nx = Math.floor((B - 1) / schritt) + 1, nz = Math.floor((T - 1) / schritt) + 1;
  const gruppe = new THREE.Group(); gruppe.name = 'gelaende';
  // Farben je Zelle (weiche Biome, Flecken, Fels, Ufer, Schnee …) aus terrain-farben
  const zf = gelaendeFarben(welt, {
    hoehenSkala: hs, meterProZelle: adapter.meterProZelle, farben: opts.farben, details: opts.details, schnee: opts.schnee,
    felsAb: opts.felsAb, mulden: opts.mulden, weich: opts.weich, rauschen: (opts.farbRauschen ?? 0.08) / 0.08,
  });

  // ---- Boden ----
  const pos = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const gx = Math.min(B - 1, i * schritt), gy = Math.min(T - 1, j * schritt), s = gy * B + gx, v = (j * nx + i) * 3;
    const p = adapter.zuWelt(gx * z, gy * z);
    pos[v] = p.x; pos[v + 1] = welt.hoehe[s] * hs; pos[v + 2] = p.z;
    col[v] = zf[s * 3]; col[v + 1] = zf[s * 3 + 1]; col[v + 2] = zf[s * 3 + 2];
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
    const p = adapter.zuWelt(gx * z, gy * z), boden = welt.hoehe[gy * B + gx] * hs;
    let y = (spiegel(gx, gy) ?? welt.hoehe[gy * B + gx]) * hs + 0.04;
    // Ufer-Vertex (trocken): Wasser knapp unter den Boden ziehen → Uferlinie schneidet schräg durchs Dreieck statt Treppenkante
    if (opts.weichesUfer !== false && !istWasser(gx, gy)) y = Math.min(y, boden - 0.06);
    vNr[k] = wpos.length / 3;
    wpos.push(p.x, y, p.z);
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
  if (widx.length) {
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
  const meer = new THREE.Mesh(meerGeo, meerMat);
  meer.name = 'meer';
  meer.position.y = 0.02;
  meer.renderOrder = 1;
  gruppe.add(meer);
  // Meeresboden unter dem Meer außerhalb der Karte (kein Blick ins Leere)
  const grund = new THREE.Mesh(meerGeo.clone(), new THREE.MeshStandardMaterial({ color: 0x1d3b4f, roughness: 1 }));
  grund.position.y = -0.8 * hs;
  grund.name = 'meeresgrund';
  gruppe.add(grund);

  return {
    gruppe, boden, wasser, meer,
    dispose() {
      gruppe.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      gruppe.removeFromParent();
    },
  };
}
