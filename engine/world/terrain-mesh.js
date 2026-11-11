/**
 * @modul    terrain-mesh
 * @zweck    Baut aus einer erzeugten Welt (worldgen) und ihrem Welt-Adapter ein Three-Gelände: Boden mit weich gemischten Biomfarben, Wiesenflecken, Hangfels, Ufern (Sand/Kies/Schlamm) und Schnee (terrain-farben), Seen/Flüsse auf ihrem Wasserspiegel und ein Meer bis zum Horizont
 * @api      createTerrainMesh(adapter, opts) -> {gruppe,boden,wasser,meer,aktualisiere(bereich,{erde,erdFarbe}?)->vertices,dispose} ; biomFarben(welt) -> Float32Array
 * @beispiel
 *   import { createTerrainMesh } from '../../engine/world/terrain-mesh.js';
 *   const gelaende = createTerrainMesh(adapter, { schritt: 1, schatten: true });
 *   szene.add(gelaende.gruppe);
 *   // nach einer Gelände-Änderung (engine/world/welt-aenderung.js) nur das Stück neu aufbauen:
 *   aend.onAenderung(({ bereich }) => bereich && gelaende.aktualisiere(bereich, { erde: (i) => Math.abs(aend.delta(i)) / 0.4 }));
 * @tags     welt, terrain, gelaende, wasser, meer, mesh, biome, teilupdate
 * @version  1.2.0
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
 * Ab 1.2: aktualisiere(bereich {x0,y0,x1,y1} in Gitterzellen, { erde: (zellIndex) => 0…1, erdFarbe }) baut nur dieses Stück neu
 * (Höhen + Normalen); `erde` mischt die Zellfarbe zur Erdfarbe (aufgegrabener Boden). Wasserflächen bleiben, wie sie sind.
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

  // ---- Teilstück neu aufbauen (nach welt-aenderung): Höhen, Normalen wie computeVertexNormals, optional Erd-Tönung ----
  const erdTon = new THREE.Color();
  function aktualisiere(bereich, { erde = null, erdFarbe = 0x6b4a2e } = {}) {
    if (!bereich) return 0;
    // betroffene Vertices: die geänderten plus ein Ring (deren Normalen hängen an den Nachbarhöhen)
    const i0 = Math.max(0, Math.ceil(bereich.x0 / schritt) - 1), i1 = Math.min(nx - 1, Math.floor(bereich.x1 / schritt) + 1);
    const j0 = Math.max(0, Math.ceil(bereich.y0 / schritt) - 1), j1 = Math.min(nz - 1, Math.floor(bereich.y1 / schritt) + 1);
    if (i0 > i1 || j0 > j1) return 0;
    const nor = geo.attributes.normal.array;
    if (erde) erdTon.setHex(erdFarbe);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const gx = Math.min(B - 1, i * schritt), gy = Math.min(T - 1, j * schritt), s = gy * B + gx, v = (j * nx + i) * 3;
      pos[v + 1] = welt.hoehe[s] * hs;
      nor[v] = nor[v + 1] = nor[v + 2] = 0;
      if (erde) {
        const t = Math.min(1, Math.max(0, erde(s)));
        col[v] = zf[s * 3] + (erdTon.r - zf[s * 3]) * t; col[v + 1] = zf[s * 3 + 1] + (erdTon.g - zf[s * 3 + 1]) * t; col[v + 2] = zf[s * 3 + 2] + (erdTon.b - zf[s * 3 + 2]) * t;
      }
    }
    // Flächennormalen aller Dreiecke, die einen betroffenen Vertex berühren (ungenormt = nach Fläche gewichtet)
    const drin = (i, j) => i >= i0 && i <= i1 && j >= j0 && j <= j1;
    const plus = (i, j, x, y, z) => { if (!drin(i, j)) return; const v = (j * nx + i) * 3; nor[v] += x; nor[v + 1] += y; nor[v + 2] += z; };
    const dreieck = (ai, aj, bi, bj, ci, cj) => {         // wie THREE: (C − B) × (A − B)
      const a = (aj * nx + ai) * 3, b = (bj * nx + bi) * 3, c = (cj * nx + ci) * 3;
      const ux = pos[c] - pos[b], uy = pos[c + 1] - pos[b + 1], uz = pos[c + 2] - pos[b + 2];
      const vx = pos[a] - pos[b], vy = pos[a + 1] - pos[b + 1], vz = pos[a + 2] - pos[b + 2];
      const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx;
      plus(ai, aj, x, y, z); plus(bi, bj, x, y, z); plus(ci, cj, x, y, z);
    };
    for (let j = Math.max(0, j0 - 1); j <= Math.min(nz - 2, j1); j++) for (let i = Math.max(0, i0 - 1); i <= Math.min(nx - 2, i1); i++) {
      dreieck(i, j, i, j + 1, i + 1, j);                  // a, c, b
      dreieck(i + 1, j, i, j + 1, i + 1, j + 1);          // b, c, d
    }
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const v = (j * nx + i) * 3, l = Math.hypot(nor[v], nor[v + 1], nor[v + 2]) || 1;
      nor[v] /= l; nor[v + 1] /= l; nor[v + 2] /= l;
    }
    // nur die betroffenen Zeilen zur Grafikkarte schicken
    const start = j0 * nx * 3, laenge = (j1 - j0 + 1) * nx * 3;
    for (const name of erde ? ['position', 'normal', 'color'] : ['position', 'normal']) {
      const a = geo.attributes[name];
      a.addUpdateRange?.(start, laenge); a.needsUpdate = true;
    }
    return (i1 - i0 + 1) * (j1 - j0 + 1);
  }

  return {
    gruppe, boden, wasser, meer, aktualisiere,
    dispose() {
      gruppe.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      gruppe.removeFromParent();
    },
  };
}
