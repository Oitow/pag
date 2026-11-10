/**
 * @modul    scatter-mesh
 * @zweck    Zeichnet die Objekte einer erzeugten Welt (welt.objekte) als InstancedMesh je (Typ, Variante): mit Asset-Cache prozedurale Natur-Assets in Metern (Bäume, Felsen, Büsche, Bodendecker …) mit Wind, sonst einfache Low-Poly-FORMEN; unbekannte Typen → Ersatz nach Art oder weglassen; Seerosen auf dem Wasser
 * @api      createScatterMesh(adapter, opts) -> {gruppe,anzahl,dreiecke,meshes,typen,update(zeit, { staerke, richtung, kamera }),verstecke(objektIndex,versteckt?),lage(objektIndex),setzeAufBoden(bereich)->anzahl,dispose} ; FORMEN ; ERSATZ ; BODENDECKER ; baueForm(teile) -> BufferGeometry
 * @beispiel
 *   import { createScatterMesh } from '../../engine/world/scatter-mesh.js';
 *   import { createAssetCache } from '../../engine/models/natur/natur-assets.js';
 *   const pflanzen = createScatterMesh(adapter, { assets: createAssetCache, jahreszeit: 'herbst', bodendeckerWeite: 110 });
 *   szene.add(pflanzen.gruppe);
 *   // je Bild: pflanzen.update(zeit);
 * @tags     welt, objekte, baeume, felsen, instanzen, vegetation, mesh, wind, natur
 * @version  2.2.0
 * @status   entwurf
 * @three    ja
 */

import * as THREE from 'three';
import { hash2 } from '../core/rng.js';
import { createNaturMaterial } from '../render/natur-material.js';

// Teile: [form, farbe, sx, sy, sz, y, x?, z?] – form: 'zyl' | 'kegel' | 'kugel' | 'fels' | 'box'. Maße in Metern bei skala 1.
const STAMM = 0x6b4a2f, DUNKEL = 0x2f5a2a, LAUB = 0x4f8a3a, HELL = 0x7fae4a;
export const FORMEN = {
  eiche: [['zyl', STAMM, 0.32, 2.4, 0.32, 1.2], ['kugel', LAUB, 2.4, 2.0, 2.4, 3.4], ['kugel', 0x5d9a42, 1.5, 1.3, 1.5, 4.3, 0.5, 0.3]],
  buche: [['zyl', 0x7a6650, 0.28, 2.8, 0.28, 1.4], ['kugel', 0x5f9440, 2.0, 2.4, 2.0, 3.9]],
  birke: [['zyl', 0xe8e4da, 0.18, 3.2, 0.18, 1.6], ['kugel', HELL, 1.3, 1.9, 1.3, 3.9]],
  kiefer: [['zyl', STAMM, 0.24, 3.4, 0.24, 1.7], ['kugel', DUNKEL, 1.6, 1.1, 1.6, 4.1]],
  tanne: [['zyl', STAMM, 0.26, 1.2, 0.26, 0.6], ['kegel', DUNKEL, 2.2, 2.8, 2.2, 2.4], ['kegel', 0x356a30, 1.6, 2.2, 1.6, 4.0]],
  weide: [['zyl', STAMM, 0.34, 2.0, 0.34, 1.0], ['kugel', 0x7ea34c, 2.8, 2.6, 2.8, 2.9]],
  toterBaum: [['zyl', 0x5a4a3c, 0.22, 3.0, 0.22, 1.5], ['zyl', 0x5a4a3c, 0.1, 1.2, 0.1, 2.4, 0.4]],
  busch: [['kugel', 0x4c7f34, 1.2, 0.9, 1.2, 0.4]],
  ginster: [['kugel', 0xb8a63a, 1.0, 0.8, 1.0, 0.35]],
  zwergstrauch: [['kugel', 0x6a6a3a, 0.8, 0.45, 0.8, 0.2]],
  fels: [['fels', 0x8a8478, 1.3, 0.9, 1.1, 0.25]],
  felsbrocken: [['fels', 0x7b766c, 2.2, 1.6, 1.9, 0.5]],
  kaktus: [['zyl', 0x4f8a4a, 0.4, 2.2, 0.4, 1.1], ['zyl', 0x4f8a4a, 0.25, 0.9, 0.25, 1.4, 0.4]],
  schilf: [['kegel', 0x8fa65a, 0.5, 1.4, 0.5, 0.7]],
  blume: [['zyl', 0x4f8a3a, 0.04, 0.35, 0.04, 0.17], ['kugel', 0xffffff, 0.18, 0.12, 0.18, 0.36]],
};
// Art → Ersatz-Typ, wenn ein Typ weder Asset noch Form hat. Unbekannte Art → Objekt wird übersprungen.
export const ERSATZ = { baum: 'eiche', busch: 'busch', fels: 'fels', kaktus: 'kaktus', schilf: 'schilf', blume: 'blume', totholz: 'baumstumpf',
  unterholz: 'farn', geroell: 'geroell', seerose: 'seerose', bodendecker: 'grasbueschel' };
/** Flache Typen: kein Schattenwurf, bei opts.bodendeckerWeite Ausblenden mit der Entfernung. */
export const BODENDECKER = new Set(['grasbueschel', 'blume', 'pilz', 'farn', 'seerose', 'schilf', 'ast', 'geroell', 'zwergstrauch']);
const BLUMEN = [0xe2c94a, 0xd96aa0, 0xf0f0f0, 0x8f7ad8, 0xe0703a];

function grundForm(form) {
  switch (form) {
    case 'zyl': return new THREE.CylinderGeometry(0.4, 0.5, 1, 6);
    case 'kegel': return new THREE.ConeGeometry(0.5, 1, 7);
    case 'kugel': return new THREE.IcosahedronGeometry(0.5, 1);
    case 'fels': return new THREE.DodecahedronGeometry(0.5, 0);
    default: return new THREE.BoxGeometry(1, 1, 1);
  }
}

/** Fügt Teile zu einer Geometrie mit Vertexfarben zusammen (nicht indiziert). */
export function baueForm(teile) {
  const pos = [], nor = [], col = [], c = new THREE.Color();
  for (const [form, farbe, sx, sy, sz, y, x = 0, z = 0] of teile) {
    const g0 = grundForm(form), g = g0.index ? g0.toNonIndexed() : g0;
    if (g !== g0) g0.dispose();
    g.scale(sx, sy, sz).translate(x, y, z);
    g.computeVertexNormals();
    c.setHex(farbe);
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i += 3) {
      pos.push(p[i], p[i + 1], p[i + 2]); nor.push(n[i], n[i + 1], n[i + 2]);
      // leichte Schattierung nach Höhe im Teil → weniger flach
      const t = 0.85 + 0.15 * Math.min(1, Math.max(0, (p[i + 1] - y + sy / 2) / (sy || 1)));
      col.push(c.r * t, c.g * t, c.b * t);
    }
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

/**
 * opts: assets (Asset-Cache aus engine/models/natur/natur-assets.js ODER die Fabrik createAssetCache – dann baut und entsorgt
 *       scatter-mesh den Cache selbst mit varianten/detail/jahreszeit/seed), varianten (4), detail (1), jahreszeit ('sommer'),
 *       variantenBoden (2: weniger Varianten für BODENDECKER → weniger Draw-Calls),
 *       wind (true), bodendeckerWeite (0 = aus, Meter), typSkala {typ: Faktor}, formen (eigene Teile je Typ, gehen vor Assets),
 *       kachel (0 = eine Instanz-Gruppe für alles; Meter → Instanzen je Kachel, damit Frustum-/Schatten-Culling greift),
 *       fernWeite (0 = aus; mit kachel: Kacheln weiter weg als fernWeite zeigen fernDetail (0) – braucht die Fabrik oder fernAssets),
 *       schatten, groesse (Gesamtfaktor), nurArten (Liste), unterWasser (false = weglassen; Seerosen liegen immer auf dem Wasser).
 * Ohne assets: alte Low-Poly-FORMEN (Maße × √meterProZelle). Assets sind in Metern → nur skala × groesse × typSkala.
 */
export function createScatterMesh(adapter, opts = {}) {
  const welt = adapter.welt, o = welt.objekte;
  const formen = { ...FORMEN, ...opts.formen };
  const eigeneFormen = opts.formen || {};
  const groesse = opts.groesse ?? 1, faktor = groesse * Math.sqrt(adapter.meterProZelle);
  const fabrik = typeof opts.assets === 'function' ? opts.assets : null;
  const cOpts = { varianten: opts.varianten ?? 4, jahreszeit: opts.jahreszeit ?? 'sommer', seed: welt.seed ?? 1 };
  const assets = fabrik ? fabrik({ ...cOpts, detail: opts.detail ?? 1 }) : opts.assets || null;
  const kachel = opts.kachel ?? 0;
  const fernWeite = assets && kachel > 0 ? opts.fernWeite ?? 0 : 0;
  const fern = fernWeite > 0 ? opts.fernAssets || (fabrik ? fabrik({ ...cOpts, detail: opts.fernDetail ?? 0 }) : null) : null;
  const nVar = assets ? assets.varianten : 1, nVarBoden = Math.min(nVar, opts.variantenBoden ?? 2);
  const typSkala = opts.typSkala || {};
  const gruppe = new THREE.Group(); gruppe.name = 'objekte';
  const wind = opts.wind !== false, weite = opts.bodendeckerWeite ?? 0;
  const mat = createNaturMaterial({ wind });
  const matBoden = weite > 0 ? createNaturMaterial({ wind, weite }) : mat;

  // Typ auflösen: eigene Form → Asset → alte Form → Ersatz nach Art → null (überspringen)
  const aufloesen = (typ) => eigeneFormen[typ] ? ['form', typ] : assets?.hat(typ) ? ['asset', typ] : FORMEN[typ] ? ['form', typ] : null;
  const aufgeloest = new Map();
  const proGruppe = new Map();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), achse = new THREE.Vector3(0, 1, 0);
  if (o) for (let i = 0; i < o.anzahl; i++) {
    const typ = o.typen[o.typ[i]], art = o.arten[o.art[i]];
    if (opts.nurArten && !opts.nurArten.includes(art)) continue;
    const k0 = typ + '|' + art;
    let ziel = aufgeloest.get(k0);
    if (ziel === undefined) { ziel = aufloesen(typ) || (ERSATZ[art] && aufloesen(ERSATZ[art])) || null; aufgeloest.set(k0, ziel); }
    if (!ziel) continue;
    const [form, name] = ziel, asset = form === 'asset', wasser = name === 'seerose';
    const w = adapter.zuWelt(o.x[i], o.y[i]);
    const y = adapter.bodenHoehe(w.x, w.z), wh = adapter.wasserHoehe(w.x, w.z);
    if (wasser) { if (wh === null || wh === undefined || wh < y) continue; }
    else if (opts.unterWasser === false && wh > y + 0.3) continue;
    const v = asset ? Math.floor(hash2(Math.round(o.x[i] * 8), Math.round(o.y[i] * 8), 7331) * (BODENDECKER.has(name) ? nVarBoden : nVar)) : 0;
    const kx = kachel > 0 ? Math.floor(w.x / kachel) : 0, kz = kachel > 0 ? Math.floor(w.z / kachel) : 0;
    const key = `${name}#${v}#${form}#${kx},${kz}`;
    let g = proGruppe.get(key);
    if (!g) proGruppe.set(key, g = { asset, name, v, mitte: [(kx + 0.5) * kachel, (kz + 0.5) * kachel], m: [], idx: [], dy: [] });
    const sk = (o.skala[i] || 1) * (asset ? groesse * (typSkala[name] ?? 1) : faktor);
    p.set(w.x, wasser ? wh + 0.02 : y - (asset ? 0.02 : 0.05 * sk), w.z); s.set(sk, sk, sk); q.setFromAxisAngle(achse, o.drehung ? o.drehung[i] : 0);
    g.m.push(...m4.compose(p, q, s).elements); g.idx.push(i); g.dy.push(wasser ? NaN : p.y - y);
  }
  const farbe = new THREE.Color();
  const geos = new Map();   // eigene Formen: eine Geometrie je Name
  const lod = [];           // [nah, fern, mitte]
  let anzahl = 0, dreiecke = 0;
  const typen = new Set();
  const instanzen = new Map();   // Objekt-Index → [InstancedMesh, Nummer, Gruppe] (fürs Verstecken)
  let faecher = null;            // Zell-Index → [Objekt-Index] (erst bei setzeAufBoden gebaut)
  const baue = (geo, material, g, matrix) => {
    const im = new THREE.InstancedMesh(geo, material, g.idx.length);
    if (matrix) im.instanceMatrix = matrix; else im.instanceMatrix.array.set(g.m);
    im.castShadow = opts.schatten !== false && !BODENDECKER.has(g.name) && g.name !== 'blume';
    im.receiveShadow = opts.schatten !== false;
    if (wind && im.castShadow) im.customDepthMaterial = mat.tiefenMaterial;
    im.computeBoundingSphere();
    gruppe.add(im);
    return im;
  };
  for (const g of proGruppe.values()) {
    const { asset, name, v } = g;
    let geo;
    if (asset) geo = assets.holen(name, v).geometrie;
    else { geo = geos.get(name); if (!geo) geos.set(name, geo = baueForm(formen[name])); }
    const material = BODENDECKER.has(name) ? matBoden : mat;
    const im = baue(geo, material, g);
    im.name = asset ? `${name}#${v}` : name;
    if (!asset && name === 'blume') g.idx.forEach((i, k) => im.setColorAt(k, farbe.setHex(BLUMEN[i % BLUMEN.length]).multiplyScalar(1.2)));
    const f = asset && !(BODENDECKER.has(name) && weite > 0 && weite <= fernWeite) && fern?.holen(name, v);
    if (f) {
      const imF = baue(f.geometrie, material, g, im.instanceMatrix);
      imF.name = im.name + '#fern'; imF.visible = false;
      lod.push([im, imF, g.mitte]);
    }
    typen.add(name);
    g.idx.forEach((i, k) => instanzen.set(i, [im, k, g]));
    anzahl += g.idx.length; dreiecke += g.idx.length * geo.attributes.position.count / 3;
  }
  return {
    gruppe, anzahl, dreiecke, typen: [...typen], meshes: gruppe.children.length,
    /** Wind animieren + Detailstufen je Kachel: zeit in Sekunden; extra { staerke, richtung [x,z], kamera (Object3D oder {x,z}) }. */
    update(zeit, extra = {}) {
      mat.update(zeit, extra); if (matBoden !== mat) matBoden.update(zeit, extra);
      const k = extra.kamera?.position || extra.kamera;
      if (k && lod.length) {
        const w2 = fernWeite * fernWeite;
        for (const [nah, weit, [mx, mz]] of lod) { const nahDran = (k.x - mx) ** 2 + (k.z - mz) ** 2 < w2; nah.visible = nahDran; weit.visible = !nahDran; }
      }
    },
    /** Ein Objekt (Index in welt.objekte) aus-/einblenden – z. B. gefällter Baum. Liefert false, wenn es nicht gezeichnet wird. */
    verstecke(objektIndex, versteckt = true) {
      const e = instanzen.get(objektIndex);
      if (!e) return false;
      const [im, k, g] = e, a = im.instanceMatrix.array;
      if (versteckt) a.fill(0, k * 16, k * 16 + 16); else for (let j = 0; j < 16; j++) a[k * 16 + j] = g.m[k * 16 + j];
      im.instanceMatrix.needsUpdate = true;      // Nah- und Fern-Mesh teilen sich die Matrix
      return true;
    },
    /** Weltposition { x, y, z } und Skala eines gezeichneten Objekts oder null. */
    lage(objektIndex) {
      const e = instanzen.get(objektIndex);
      if (!e) return null;
      const m = e[2].m, k = e[1] * 16;
      return { x: m[k + 12], y: m[k + 13], z: m[k + 14], skala: Math.hypot(m[k], m[k + 1], m[k + 2]) };
    },
    /** Nach einer Gelände-Änderung (bereich {x0,y0,x1,y1} in Gitterzellen): Objekte dort wieder auf den Boden setzen. Liefert die Anzahl. */
    setzeAufBoden(bereich) {
      if (!bereich || !o) return 0;
      const B = welt.breite, T = welt.tiefe, Z = welt.zelle || 1;
      if (!faecher) {
        faecher = new Map();
        for (const i of instanzen.keys()) { const k = Math.floor(o.y[i] / Z) * B + Math.floor(o.x[i] / Z); const l = faecher.get(k); if (l) l.push(i); else faecher.set(k, [i]); }
      }
      let n = 0;
      // ein Objekt hängt (bilinear) an den vier Ecken seiner Zelle → eine Zelle Rand nach links/oben
      for (let b = Math.max(0, bereich.y0 - 1); b <= Math.min(T - 1, bereich.y1); b++) for (let a = Math.max(0, bereich.x0 - 1); a <= Math.min(B - 1, bereich.x1); a++) {
        const l = faecher.get(b * B + a);
        if (!l) continue;
        for (const i of l) {
          const [im, k, g] = instanzen.get(i);
          if (Number.isNaN(g.dy[k])) continue;                      // Seerosen bleiben auf dem Wasser
          const w = adapter.zuWelt(o.x[i], o.y[i]), y = adapter.bodenHoehe(w.x, w.z) + g.dy[k], arr = im.instanceMatrix.array;
          g.m[k * 16 + 13] = y;
          if (arr[k * 16 + 15] !== 0) arr[k * 16 + 13] = y;        // versteckte bleiben versteckt
          im.instanceMatrix.needsUpdate = true; n++;
        }
      }
      return n;
    },
    dispose() {
      instanzen.clear(); faecher = null;
      for (const g of geos.values()) g.dispose();
      for (const m of gruppe.children) m.dispose();
      mat.dispose(); if (matBoden !== mat) matBoden.dispose();
      if (fabrik) { assets.dispose(); if (fern && !opts.fernAssets) fern.dispose(); }
      gruppe.removeFromParent();
    },
  };
}
