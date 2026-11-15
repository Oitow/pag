// Figuren-Labor – Schlachtfeld-Deko: Baum-/Felsrahmen am Rand, Gras/Blumen in der Fläche, Ruinen und Steinkreise.
// Alles statisch und instanziert (Natur-Assets aus der Engine), Zufall nur geseedet, keine Kollision.
import * as THREE from 'three';
import { rng, range, hashSeed } from '../../../engine/core/rng.js';
import { createAssetCache } from '../../../engine/models/natur/natur-assets.js';
import { createNaturMaterial } from '../../../engine/render/natur-material.js';
import { createMeshBuilder, standardMaterial } from '../../../engine/render/mesh-builder.js';

/** Baut die Deko und hängt sie an `gruppe`. feld(x,z) = Bodenhöhe, feldG = { x, z, halb }. → { dispose() } */
export function baueSchlachtfeldDeko(gruppe, { seed = 1, feld, feldG }) {
  const cache = createAssetCache({ varianten: 2, detail: 0, seed: hashSeed('deko', seed) });
  // Engine-Vertexfarben sind dunkel (für helles Natur-Labor) → hier per Material-Faktor aufhellen
  const mats = {};
  const matVon = (f) => (mats[f] ??= Object.assign(createNaturMaterial({ wind: false }), {}), mats[f].color.setRGB(f, f, f), mats[f]);
  const meshes = [];
  const dummy = new THREE.Object3D();
  const randAbstand = (x, z) => feldG.halb - Math.max(Math.abs(x - feldG.x), Math.abs(z - feldG.z));

  // typ in n Instanzen streuen; wahl(r) → { x, z, s? } oder null
  function streue(typ, anzahl, wahl, { schatten = false, skala = [0.8, 1.3], versenken = 0, hell = 4.5 } = {}) {
    const mat = matVon(hell);
    const r = rng(hashSeed('deko', seed, typ));
    const pos = [];
    for (let i = 0; i < anzahl * 3 && pos.length < anzahl; i++) { const p = wahl(r); if (p) pos.push(p); }
    const nVar = cache.varianten;
    for (let v = 0; v < nVar; v++) {
      const a = cache.holen(typ, v);
      const meine = pos.filter((_, i) => i % nVar === v);
      if (!a || !meine.length) continue;
      const im = new THREE.InstancedMesh(a.geometrie, mat, meine.length);
      meine.forEach((p, i) => {
        dummy.position.set(p.x, feld(p.x, p.z) - versenken, p.z);
        dummy.rotation.set(0, range(r, 0, Math.PI * 2), 0);
        dummy.scale.setScalar((p.s ?? range(r, skala[0], skala[1])));
        dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
      });
      im.castShadow = schatten; im.receiveShadow = true; im.frustumCulled = false;
      gruppe.add(im); meshes.push(im);
    }
  }
  const imFeld = (r, rMin, rMax) => {
    const x = feldG.x + range(r, -feldG.halb, feldG.halb), z = feldG.z + range(r, -feldG.halb, feldG.halb);
    const d = randAbstand(x, z);
    return d >= rMin && d <= rMax ? { x, z } : null;
  };

  // Rahmen: Bäume und Felsen auf dem Randwall (außerhalb der Kampffläche)
  streue('eiche', 40, r => imFeld(r, 1, 10), { schatten: true, skala: [1.3, 2.2] });
  streue('tanne', 56, r => imFeld(r, 1, 12), { schatten: true, skala: [1.4, 2.4] });
  streue('fels', 22, r => imFeld(r, 2, 14), { schatten: true, skala: [1.2, 2.6], versenken: 0.3, hell: 3.5 });
  streue('busch', 50, r => imFeld(r, 6, 22), { skala: [1, 1.8], hell: 5 });
  // verstreute Einzelbäume und Felsbrocken weiter innen (nur Kulisse)
  streue('birke', 14, r => imFeld(r, 14, 40), { schatten: true, skala: [1.1, 1.8] });
  streue('findling', 14, r => imFeld(r, 12, 80), { skala: [0.8, 1.6], versenken: 0.1, hell: 3.5 });
  // Fläche: Gras, Blumen, Farn
  streue('grasbueschel', 700, r => imFeld(r, 5, 80), { skala: [1.2, 2.2], hell: 5.5 });
  streue('blume', 280, r => imFeld(r, 5, 80), { skala: [1.2, 2], hell: 5.5 });
  streue('farn', 40, r => imFeld(r, 5, 40), { skala: [1.2, 2], hell: 5.5 });

  // Landmarken: Steinkreis und Ruinen aus Low-Poly-Blöcken (EIN Mesh)
  const b = createMeshBuilder({ seed: hashSeed('ruinen', seed), jitter: 0.1 });
  const r = rng(hashSeed('ruinen', seed));
  const graue = ['#9a948a', '#8a857c', '#a8a196'], moos = '#7d8a5a';
  const grau = () => graue[(r() * graue.length) | 0];
  function kreis(cx, cz, rad, n) {
    for (let i = 0; i < n; i++) {
      const w = i / n * Math.PI * 2, x = cx + Math.cos(w) * rad, z = cz + Math.sin(w) * rad, h = range(r, 1.6, 2.8);
      b.box(range(r, 0.7, 1.1), h, range(r, 0.5, 0.8), grau(), { x, y: feld(x, z) + h / 2 - 0.2, z, ry: -w, rz: range(r, -0.06, 0.06) });
    }
    b.cyl(rad * 0.25, rad * 0.28, 0.5, '#8a857c', { x: cx, y: feld(cx, cz) + 0.15, z: cz }, 8);   // Altarstein
  }
  function ruine(cx, cz, ry) {
    const c = Math.cos(ry), s = Math.sin(ry), p = (lx, lz) => ({ x: cx + lx * c + lz * s, z: cz - lx * s + lz * c });
    const y0 = feld(cx, cz) - 0.3;
    for (const [lx, h] of [[-4, 5.5], [0, 4], [4, 6.2]]) {   // drei Säulen
      const q = p(lx, 0);
      b.cyl(0.65, 0.8, h, grau(), { x: q.x, y: y0 + h / 2, z: q.z }, 8);
      b.box(1.8, 0.45, 1.8, grau(), { x: q.x, y: y0 + h + 0.2, z: q.z, ry });
    }
    const q1 = p(-2, 0); b.box(4.6, 0.8, 1.3, grau(), { x: q1.x, y: y0 + 5.9, z: q1.z, ry });   // gebrochener Sturz
    const q2 = p(1, 0.5); b.box(3, 1, 1.2, moos, { x: q2.x, y: y0 + 0.4, z: q2.z, ry: ry + 0.2, rz: 0.05 });
    for (let i = 0; i < 5; i++) { const q = p(range(r, -5, 5), range(r, -2.5, 2.5)); b.box(range(r, 0.6, 1.2), range(r, 0.4, 0.9), range(r, 0.6, 1.2), grau(), { x: q.x, y: y0 + 0.4, z: q.z, ry: range(r, 0, 3) }); }
  }
  const { x: fx, z: fz, halb: fh } = feldG;
  kreis(fx - fh * 0.45, fz - fh * 0.3, 7, 9);
  kreis(fx + fh * 0.5, fz + fh * 0.4, 5.5, 7);
  ruine(fx + fh * 0.35, fz - fh * 0.5, 0.5);
  ruine(fx - fh * 0.5, fz + fh * 0.45, -0.9);
  const ruinen = b.mesh(standardMaterial());
  ruinen.castShadow = ruinen.receiveShadow = true; ruinen.frustumCulled = false;
  gruppe.add(ruinen);

  return {
    dispose() { for (const m of meshes) m.dispose(); ruinen.geometry.dispose(); cache.dispose(); Object.values(mats).forEach(m => m.dispose()); },
  };
}
