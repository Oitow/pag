// Dämmerwald – Maßstabs-Anker aus dem Engine-Baukasten: normale Bäume (8–16 m) zwischen den Riesen, Pilze, Findlinge, Kiesel, Schilf, Totholz,
// dazu der Urwald-Unterwuchs (Wedelfarn, Unterholz, Moospolster, Wurzelschösslinge, Laubstreu) über worldgen-scatter `verteile` (Blue-Noise, Regeln s. u.).
// Alles instanziert (ein Draw-Call je Asset-Variante), Farben über das gemeinsame Natur-Material gedämpft (Art-Direction §2).
import * as THREE from 'three';
import { rng, hashSeed } from '../../../engine/core/rng.js';
import { createAssetCache, erzeugeAsset as erzeugeUW } from '../../../engine/models/natur/natur-assets.js';
import { createNaturMaterial } from '../../../engine/render/natur-material.js';
import { erzeuge as erzeugeBoden } from '../../../engine/models/natur/pflanze-boden.js';
import { verteile } from '../../../engine/world/worldgen/worldgen-scatter.js';
import { URWALD_OBJEKTE } from '../../../engine/world/worldgen/worldgen-vegetation.js';
import { FLAG } from '../../../engine/world/worldgen/worldgen-grid.js';
import { WELT, LICHTUNG, PFAD_ENDE, pfadX, pfadAbstand, stammAbstand, STAMM, stammRadiusVon } from './plan-daten.js';

/** opts: { szene, hf (Höhenfeld aus gelaende), bodenHoehe (x,z) (Standard hf.hoehe), riesen, seed, dichte = 1 } → { meshes, material, anzahl, unterwuchs, update(zeit), dispose() } */
export function createBewuchs({ szene, hf, bodenHoehe = hf.hoehe, riesen, seed = WELT.seed, dichte = 1 }) {
  const cache = createAssetCache({ varianten: 2, detail: 1, jahreszeit: 'sommer', seed: 7 });
  const material = createNaturMaterial({ wind: true });
  material.roughness = 1;
  const steinMat = createNaturMaterial({ wind: false });
  // Unterwuchs: eigenes Wind-Material, das ferne Instanzen ausblendet (weite) – kostet keinen Draw-Call extra
  const unterMat = createNaturMaterial({ wind: true, weite: dichte < 1 ? 70 : 95 });
  unterMat.roughness = 1;
  // Dämmerung statt Spielzeug-Grün: Vertexfarben im Shader entsättigen und kühl abdunkeln (der Wind-Hook des Engine-Materials bleibt erhalten)
  for (const [m, satt, ton] of [[material, 0.42, 'vec3(0.56, 0.62, 0.56)'], [steinMat, 0.3, 'vec3(0.42, 0.45, 0.45)'], [unterMat, 0.55, 'vec3(0.6, 0.66, 0.6)']]) {
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
      const y = bodenHoehe(p[0], p[1]);
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
    // Kleinkram in echter Größe direkt am Pfad (Farn & Co. → Unterwuchs unten)
  streue('pilz', 0, 40, () => amPfad(1.7, 6, 30), [0.12, 0.3]);
  streue('grasbueschel', 0, 240, () => (r() < 0.5 ? [(r() - 0.5) * 150, 7 + r() * 22] : r() < 0.5 ? [LICHTUNG.x + (r() - 0.5) * 50, LICHTUNG.z + (r() - 0.5) * 50] : amPfad(1.8, 9)), [0.25, 0.6]);
  streue('schilf', 0, 70, () => { const x = (r() - 0.5) * 220; return Math.abs(x) < 7 ? null : [x, hf.uferVersatz(x) - 2.2 + r() * 3.2]; }, [1.2, 2.2]);
  streue('findling', 0, 34, () => (r() < 0.6 ? amPfad(3, 14) : imWald()), [0.3, 1.0], { mat: steinMat, schatten: true, einsinken: 0.2, neigung: 0.3 });
  streue('felsbrocken', 1, 18, () => (r() < 0.3 ? [(r() - 0.5) * 180, 3 + r() * 14] : imWald()), [0.6, 2.4], { mat: steinMat, schatten: true, einsinken: 0.25, neigung: 0.3 });
  streue('geroell', 0, 110, () => (r() < 0.75 ? [(r() - 0.5) * 120, -1 + r() * 13] : amPfad(1.2, 4)), [0.08, 0.3], { mat: steinMat, einsinken: 0.3 });
    streue('liegenderStamm', 0, 10, () => amPfad(5, 26, 40), [0.5, 0.9], { schatten: true, einsinken: 0.15 });
  streue('baumstumpf', 0, 9, () => amPfad(3.5, 16, 30), [0.6, 1.1], { schatten: true });

  const unterwuchs = baueUnterwuchs({ szene, hf, bodenHoehe, riesen, seed, dichte, material: unterMat, dummy, meshes });

  return {
    meshes, material, steinMat, cache, unterwuchs,
    get anzahl() { return meshes.reduce((s, m) => s + m.count, 0); },
    update(zeit) { material.update(zeit, { staerke: 0.35, richtung: [0.5, 0.86] }); unterMat.update(zeit, { staerke: 0.3, richtung: [0.5, 0.86] }); },
    dispose() { for (const m of meshes) { szene.remove(m); m.dispose(); } cache.dispose(); pilz?.geometrie.dispose(); material.dispose(); steinMat.dispose(); unterMat.dispose(); for (const g of unterwuchs.geometrien) g.dispose(); },
  };
}

// ---- Urwald-Unterwuchs: Arten aus dem Weltgenerator (URWALD_OBJEKTE), Regeln über eine eigene Quelle ----
// Pfad, Stämme, gestürzter Riese, Ufer = FLAG.FREI; Stammfüße = belegt (→ Regel fuss: dichter an den Wurzeln);
// Dichtefeld: voll bis 6 m neben dem Pfad, nach außen exponentiell (10 m) bis auf 4 % ausgedünnt; Lichtung innen frei, Rand weich.
const UNTERWUCHS = {
  urwald_unterwuchs: { dichte: { urwald: 0.36 }, typen: { _: [{ typ: 'wedelfarn', w: 4 }, { typ: 'busch_unterholz', w: 1.3 }] }, fuss: { dist: 5, gewicht: 2.5 } },
  moospolster: { dichte: { urwald: 0.12 }, fuss: { dist: 4, gewicht: 4 } },
  wurzelschoessling: { dichte: { urwald: 0.05 }, fuss: { dist: 4, gewicht: 8 } },
  laubstreu: { dichte: { urwald: 0.25 } },
};
const glatt = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function baueUnterwuchs({ szene, hf, bodenHoehe, riesen, seed, dichte, material, dummy, meshes }) {
  const arten = URWALD_OBJEKTE.filter((a) => UNTERWUCHS[a.key]).map((a) => ({ ...a, ...UNTERWUCHS[a.key], wasserDist: null }));
  const fuesse = riesen.map((b) => ({ x: b.x, z: b.z, r: stammRadiusVon(b) }));
  const quelle = {
    punkt(x, z, aus) {
      let fl = 0, belegt = 0;
      if (pfadAbstand(x, z) < 1.9 || z - hf.uferVersatz(x) < 9 || Math.hypot(x - LICHTUNG.x, z - LICHTUNG.z) < LICHTUNG.radius - 7) fl = FLAG.FREI;
      const sa = stammAbstand(x, z);
      if (sa.aussen < 1 && Math.abs(sa.quer) < STAMM.radius + 0.4) fl = FLAG.FREI;
      for (const f of fuesse) {
        const d = Math.hypot(f.x - x, f.z - z);
        if (d < f.r * 1.02 + 0.3) fl = FLAG.FREI;
        if (d < f.r * 1.2 + 3) belegt = 1;
      }
      aus[0] = 0; aus[1] = 0; aus[2] = 0.1; aus[3] = 99; aus[4] = fl; aus[5] = belegt;
      if (aus.length > 8) { aus[6] = 0.55; aus[7] = 0.75; aus[8] = 0; }
      return true;
    },
    dichte(x, z) {
      const d = pfadAbstand(x, z), l = Math.hypot(x - LICHTUNG.x, z - LICHTUNG.z);
      return (d < 6 ? 1 : Math.max(0.04, Math.exp(-(d - 6) / 10))) * (0.25 + 0.75 * glatt(LICHTUNG.radius - 7, LICHTUNG.radius + 5, l));
    },
  };
  const o = verteile(quelle, arten, { seed: hashSeed('unterwuchs', seed), dichte, massstab: 400, biome: [{ key: 'urwald' }] },
    { x0: WELT.xMin + 2, y0: 6, x1: WELT.xMax - 2, y1: WELT.zMax - 4 });
  // je Typ ein InstancedMesh (Geometrie aus dem Asset-Cache; Handy: detail 0)
  const detail = dichte < 1 ? 0 : 1, zahl = new Map(), zahlen = {}, geometrien = [];
  for (let i = 0; i < o.anzahl; i++) zahl.set(o.typ[i], (zahl.get(o.typ[i]) || 0) + 1);
  for (const [tn, n] of zahl) {
    const typ = o.typen[tn], a = erzeugeUW(typ, 3, { detail });   // eigene Detailstufe (der Varianten-Cache hat detail fest)
    if (!a) continue;
    geometrien.push(a.geometrie);
    const m = new THREE.InstancedMesh(a.geometrie, material, n);
    let k = 0;
    for (let i = 0; i < o.anzahl; i++) {
      if (o.typ[i] !== tn) continue;
      const x = o.x[i], z = o.y[i], s = o.skala[i];
      dummy.position.set(x, bodenHoehe(x, z) - 0.03 * s, z);
      dummy.rotation.set(0, o.drehung[i], 0);
      dummy.scale.set(s, s * (typ === 'laubstreu' || typ === 'moospolster' ? 1 : 0.9 + 0.2 * ((i * 0.618) % 1)), s); dummy.updateMatrix();
      m.setMatrixAt(k++, dummy.matrix);
    }
    m.count = k; m.castShadow = false; m.receiveShadow = true; m.name = `unterwuchs-${typ}`;
    szene.add(m); meshes.push(m); zahlen[typ] = k;
  }
  return { zahlen, geometrien };
}
