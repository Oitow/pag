// Dämmerwald – Maßstabs-Anker aus dem Engine-Baukasten: normale Bäume (8–16 m) zwischen den Riesen, Farn, Pilze, Findlinge, Kiesel, Schilf, Totholz.
// Alles instanziert (ein Draw-Call je Asset-Variante), Farben über das gemeinsame Natur-Material gedämpft (Art-Direction §2).
import * as THREE from 'three';
import { rng, hashSeed } from '../../../engine/core/rng.js';
import { createAssetCache } from '../../../engine/models/natur/natur-assets.js';
import { createNaturMaterial } from '../../../engine/render/natur-material.js';
import { erzeuge as erzeugeBoden } from '../../../engine/models/natur/pflanze-boden.js';
import { WELT, LICHTUNG, PFAD_ENDE, pfadX, pfadAbstand, stammAbstand, STAMM, stammRadiusVon } from './plan-daten.js';

/** opts: { szene, hf (Höhenfeld aus gelaende), riesen, seed, dichte = 1 } → { meshes, material, anzahl, update(zeit), dispose() } */
export function createBewuchs({ szene, hf, riesen, seed = WELT.seed, dichte = 1 }) {
  const cache = createAssetCache({ varianten: 2, detail: 1, jahreszeit: 'sommer', seed: 7 });
  const material = createNaturMaterial({ wind: true });
  material.roughness = 1;
  const steinMat = createNaturMaterial({ wind: false });
  // Dämmerung statt Spielzeug-Grün: Vertexfarben im Shader entsättigen und kühl abdunkeln (der Wind-Hook des Engine-Materials bleibt erhalten)
  for (const [m, satt, ton] of [[material, 0.42, 'vec3(0.56, 0.62, 0.56)'], [steinMat, 0.3, 'vec3(0.42, 0.45, 0.45)']]) {
    const vorher = m.onBeforeCompile, alt = m.customProgramCacheKey?.bind(m);
    m.onBeforeCompile = (s, r) => {
      vorher?.call(m, s, r);
      s.fragmentShader = s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  diffuseColor.rgb = mix(vec3(dot(diffuseColor.rgb, vec3(0.3, 0.6, 0.1))), diffuseColor.rgb, ${satt.toFixed(2)}) * ${ton};`);
    };
    m.customProgramCacheKey = () => 'dw-bewuchs' + satt + '|' + (alt ? alt() : '');
  }
  const r = rng(hashSeed('bewuchs', seed)), dummy = new THREE.Object3D(), meshes = [];
  const frei = (x, z, rand = 2) => {
    for (const b of riesen) if (Math.hypot(b.x - x, b.z - z) < stammRadiusVon(b) + rand) return false;
    const sa = stammAbstand(x, z);
    return !(sa.aussen < 1 && Math.abs(sa.quer) < STAMM.radius + rand);
  };
  // Stelle nahe am Pfad (seitlicher Abstand von…bis) oder irgendwo im Wald
  const amPfad = (von, bis, zVon = 14, zBis = PFAD_ENDE) => { const z = zVon + r() * (zBis - zVon), s = (von + r() * r() * (bis - von)) * (r() < 0.5 ? -1 : 1); return [pfadX(z) + s, z]; };
  const imWald = () => [WELT.xMin + r() * (WELT.xMax - WELT.xMin), 20 + r() * (WELT.zMax - 20)];

  let pilz = null;
  /** Streut ein Asset: platz() → [x, z] | null, hoehe = [min, max] Zielhöhe in m (echte Maße!). */
  function streue(typ, variante, anzahl, platz, hoehe, { mat = material, schatten = false, rand = 2, einsinken = 0, neigung = 0 } = {}) {
    const a = typ === 'pilz' ? (pilz ??= erzeugeBoden('pilz', 4, { sorte: 'steinpilz' })) : cache.holen(typ, variante);
    if (!a) return;
    const n = Math.round(anzahl * dichte), m = new THREE.InstancedMesh(a.geometrie, mat, n);
    let k = 0;
    for (let versuch = 0; versuch < n * 6 && k < n; versuch++) {
      const p = platz();
      if (!p || !frei(p[0], p[1], rand)) continue;
      const y = hf.hoehe(p[0], p[1]);
      if (y < 0.12 && typ !== 'schilf') continue;
      const s = (hoehe[0] + r() * (hoehe[1] - hoehe[0])) / Math.max(a.hoehe, 0.01);
      dummy.position.set(p[0], y - einsinken * s * a.hoehe, p[1]);
      dummy.rotation.set((r() - 0.5) * neigung, r() * Math.PI * 2, (r() - 0.5) * neigung);
      dummy.scale.set(s * (0.85 + 0.3 * r()), s, s * (0.85 + 0.3 * r())); dummy.updateMatrix();
      m.setMatrixAt(k++, dummy.matrix);
    }
    m.count = k; m.castShadow = schatten; m.receiveShadow = true; m.name = `${typ}-${variante}`;
    if (mat === material) m.customDepthMaterial = material.tiefenMaterial;
    szene.add(m); meshes.push(m);
  }

  // Normale Bäume als Vergleich: die Hälfte nah am Pfad (5–30 m), der Rest im Wald; nicht auf der Lichtung
  const baumPlatz = () => {
    const p = r() < 0.55 ? amPfad(10, 36, 22) : imWald();
    return pfadAbstand(p[0], p[1]) < 9 || Math.hypot(p[0] - LICHTUNG.x, p[1] - LICHTUNG.z) < LICHTUNG.radius - 3 ? null : p;
  };
  streue('kiefer', 0, 26, baumPlatz, [10, 16], { schatten: true, rand: 3 });
  streue('fichte', 1, 22, baumPlatz, [9, 15], { schatten: true, rand: 3 });
  streue('buche', 0, 32, baumPlatz, [8, 13], { schatten: true, rand: 3 });
  streue('birke', 1, 22, baumPlatz, [8, 12], { schatten: true, rand: 3 });
    // Kleinkram in echter Größe direkt am Pfad
  streue('farn', 0, 300, () => amPfad(2.2, 15), [0.35, 0.85]);
  streue('farn', 1, 260, () => (r() < 0.6 ? amPfad(2.6, 24) : imWald()), [0.4, 1.0]);
  streue('pilz', 0, 40, () => amPfad(1.7, 6, 30), [0.12, 0.3]);
  streue('grasbueschel', 0, 240, () => (r() < 0.5 ? [(r() - 0.5) * 150, 7 + r() * 22] : r() < 0.5 ? [LICHTUNG.x + (r() - 0.5) * 50, LICHTUNG.z + (r() - 0.5) * 50] : amPfad(1.8, 9)), [0.25, 0.6]);
  streue('schilf', 0, 70, () => { const x = (r() - 0.5) * 220; return Math.abs(x) < 7 ? null : [x, hf.uferVersatz(x) - 2.2 + r() * 3.2]; }, [1.2, 2.2]);
  streue('findling', 0, 34, () => (r() < 0.6 ? amPfad(3, 14) : imWald()), [0.3, 1.0], { mat: steinMat, schatten: true, einsinken: 0.2, neigung: 0.3 });
  streue('felsbrocken', 1, 18, () => (r() < 0.3 ? [(r() - 0.5) * 180, 3 + r() * 14] : imWald()), [0.6, 2.4], { mat: steinMat, schatten: true, einsinken: 0.25, neigung: 0.3 });
  streue('geroell', 0, 110, () => (r() < 0.75 ? [(r() - 0.5) * 120, -1 + r() * 13] : amPfad(1.2, 4)), [0.08, 0.3], { mat: steinMat, einsinken: 0.3 });
    streue('liegenderStamm', 0, 10, () => amPfad(5, 26, 40), [0.5, 0.9], { schatten: true, einsinken: 0.15 });
  streue('baumstumpf', 0, 9, () => amPfad(3.5, 16, 30), [0.6, 1.1], { schatten: true });

  return {
    meshes, material, steinMat, cache,
    get anzahl() { return meshes.reduce((s, m) => s + m.count, 0); },
    update(zeit) { material.update(zeit, { staerke: 0.35, richtung: [0.5, 0.86] }); },
    dispose() { for (const m of meshes) { szene.remove(m); m.dispose(); } cache.dispose(); pilz?.geometrie.dispose(); material.dispose(); steinMat.dispose(); },
  };
}
