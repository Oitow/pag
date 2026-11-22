/**
 * @modul    fern-wald
 * @zweck    Fernwald als Impostor-Kacheln: Wald-Biome jenseits der Streu-Reichweite (innen … aussen, ~150–1500 m) als grobe Zwei-Kegel-Baumgruppen in EINEM InstancedMesh (1 Draw-Call, ≤ 60 k △), Farbe nach Biom, Nebel über das Szenen-Material; Kacheln (200 m) werden bei Kachelwechsel des Fokus nachgeladen, nie je Bild
 * @api      createFernWald({karte, seed, niedrig, kachel=200, innen=150, aussen=1500, maxDreiecke=60000}) -> {mesh, update(fx,fz,max=3)->{neu,neuAufgebaut}, anzahl, dreiecke, dispose()} ; fernwaldKachel(karte, kachel, {seed,dichte}) -> [{x,y,z,s,r,rot,farbe}]
 * @beispiel
 *   import { createFernWald } from '../../engine/world/fern-wald.js';
 *   const fern = createFernWald({ karte, seed: 7, niedrig: true, innen: 110 }); szene.add(fern.mesh);
 *   fern.update(spieler.x, spieler.z);   // je Bild billig: baut nur bei Kachelwechsel neu
 * @tags     welt, wald, fern, impostor, instancing, lod, kacheln, erlenwacht
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { hash2, hashSeed } from '../core/rng.js';
import { createNoise2D } from '../core/noise.js';

const ZELLE = 20;   // m je Baumgruppe
// Dichte, Kronenradius/Höhe, Farbe (sRGB, gedämpft – Nebel macht den Rest) je Waldbiom
const WALD = {
  urwald: { p: 1, hoehe: [22, 36], breite: 0.3, farbe: [0x2b3a23, 0x33452a] },
  laubwald: { p: 0.8, hoehe: [13, 22], breite: 0.4, farbe: [0x3a4c2b, 0x4a5c33] },
  nadelwald: { p: 0.75, hoehe: [14, 26], breite: 0.22, farbe: [0x2c4030, 0x35493a] },
  sumpf: { p: 0.1, hoehe: [7, 12], breite: 0.35, farbe: [0x474c34, 0x555a3c] },
  wiese: { p: 0.06, hoehe: [11, 17], breite: 0.4, farbe: [0x4a5c33, 0x56683a] },
  heide: { p: 0.05, hoehe: [8, 13], breite: 0.3, farbe: [0x4a5030, 0x575b38] },
};
const rauschCache = new Map();
const hexRgb = (h) => [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255];

/** Baumgruppen einer Kachel (reine Logik, deterministisch): Rasterzelle 20 m, nur Wald-Biome, trocken, flach, nicht auf Weg/Ort. */
export function fernwaldKachel(karte, k, { seed = 1, dichte = 1 } = {}) {
  const n = Math.round(k.groesse / ZELLE), aus = [], s0 = hashSeed('fernwald', seed);
  let rausch = rauschCache.get(seed);
  if (!rausch) { rausch = createNoise2D(hashSeed('fernwald-licht', seed)); rauschCache.set(seed, rausch); }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const gx = Math.round(k.x0 / ZELLE) + i, gz = Math.round(k.z0 / ZELLE) + j;
    const x = (gx + 0.15 + hash2(gx, gz, s0 + 1) * 0.7) * ZELLE, z = (gz + 0.15 + hash2(gx, gz, s0 + 2) * 0.7) * ZELLE;
    const h = karte.hoehe(x, z), b = karte.biom(x, z, h), r = WALD[b];
    if (!r) continue;
    const licht = Math.min(1, Math.max(0, 0.8 + 0.7 * rausch(x / 130, z / 130)));
    if (hash2(gx, gz, s0 + 3) >= r.p * licht * dichte) continue;
    if (karte.wasserHoehe(x, z, h) !== null || karte.wegInfo(x, z).d < 7) continue;
    if (Math.abs(karte.hoehe(x + 6, z) - h) + Math.abs(karte.hoehe(x, z + 6) - h) > 6) continue;
    let imOrt = false;
    for (const o of karte.orte) if (o.radius && (x - o.x) ** 2 + (z - o.z) ** 2 < (o.radius + 12) ** 2) { imOrt = true; break; }
    if (imOrt) continue;
    const u = hash2(gx, gz, s0 + 4), hh = r.hoehe[0] + (r.hoehe[1] - r.hoehe[0]) * u * u;   // wenige sehr hohe
    aus.push({ x, y: h - 0.6, z, s: hh, r: hh * r.breite * (1.6 + hash2(gx, gz, s0 + 5) * 0.8), rot: hash2(gx, gz, s0 + 6) * 6.28, farbe: r.farbe[hash2(gx, gz, s0 + 7) < 0.5 ? 0 : 1] });
  }
  return aus;
}

/** Einheitsbaum: zwei Kegel (6-seitig, 12 △), Höhe 1, Radius 1; oberer Kegel heller. */
function baumGeometrie() {
  const pos = [], col = [], idx = [];
  const kegel = (y0, y1, r, hell) => {
    const b = pos.length / 3, c = 0.78 + hell * 0.3;
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; pos.push(Math.cos(a) * r, y0, Math.sin(a) * r); col.push(c, c, c); }
    pos.push(0, y1, 0); col.push(c * 1.1, c * 1.1, c * 1.1);
    for (let i = 0; i < 6; i++) idx.push(b + i, b + 6, b + (i + 1) % 6);
  };
  kegel(0.08, 0.72, 1, 0); kegel(0.42, 1, 0.68, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function createFernWald({ karte, seed = 1, niedrig = false, kachel = 200, innen = 150, aussen = 1500, maxDreiecke = 60000 } = {}) {
  const geo = baumGeometrie(), tris = geo.index.count / 3;
  const dichte = niedrig ? 0.5 : 1, cap = Math.floor(maxDreiecke / tris) >> 0;
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x1b2619 });
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.name = 'fernwald'; mesh.frustumCulled = false; mesh.count = 0; mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  const cache = new Map();   // key → Baumgruppen
  let ctk = null, anzahl = 0, geplant = null, lx = 0, lz = 0;
  const c = new THREE.Color(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), yAchse = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), sk = new THREE.Vector3();
  const farbCache = new Map();

  function aufbauen(fx, fz) {
    const ci = Math.floor(fx / kachel), cj = Math.floor(fz / kachel), mx = fx, mz = fz;
    const loch = innen + 30, r = Math.ceil(aussen / kachel) + 1, sammel = [];
    for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
      const dx = (i + 0.5) * kachel - mx, dz = (j + 0.5) * kachel - mz, d = Math.hypot(dx, dz);
      if (d - kachel * 0.71 > aussen) continue;
      const e = cache.get(i + ':' + j); if (!e) continue;
      for (const b of e) { const dd = Math.hypot(b.x - mx, b.z - mz); if (dd >= loch && dd <= aussen) sammel.push(b, dd); }
    }
    // zu viele für das Dreiecks-Budget: die fernsten zuerst weglassen (nahe wirken größer)
    const paare = []; for (let i = 0; i < sammel.length; i += 2) paare.push([sammel[i], sammel[i + 1]]);
    if (paare.length > cap) { paare.sort((a, b) => a[1] - b[1]); paare.length = cap; }
    anzahl = paare.length;
    paare.forEach(([b], i) => {
      let rgb = farbCache.get(b.farbe); if (!rgb) farbCache.set(b.farbe, rgb = hexRgb(b.farbe));
      c.setRGB(rgb[0], rgb[1], rgb[2], THREE.SRGBColorSpace);
      mesh.setColorAt(i, c);
      q.setFromAxisAngle(yAchse, b.rot); p.set(b.x, b.y, b.z); sk.set(b.r, b.s, b.r);
      mesh.setMatrixAt(i, m.compose(p, q, sk));
    });
    mesh.count = anzahl; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    ctk = ci + ':' + cj; lx = fx; lz = fz;
  }

  /** Je Bild aufrufen: erzeugt höchstens `max` neue Kacheln; baut den Mesh nur bei Kachelwechsel, > 60 m Weg (Loch um den Fokus) oder wenn Kacheln dazukamen. */
  function update(fx, fz, max = 3) {
    const ci = Math.floor(fx / kachel), cj = Math.floor(fz / kachel), r = Math.ceil(aussen / kachel) + 1, soll = [];
    if (!geplant || geplant.k !== ci + ':' + cj) {
      for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
        const dx = Math.max(i * kachel - fx, 0, fx - (i + 1) * kachel), dz = Math.max(j * kachel - fz, 0, fz - (j + 1) * kachel), d = Math.hypot(dx, dz);
        if (d <= aussen) soll.push({ key: i + ':' + j, i, j, d });
      }
      soll.sort((a, b) => a.d - b.d);
      geplant = { k: ci + ':' + cj, soll, offen: true };
      for (const key of [...cache.keys()]) { const [i, j] = key.split(':').map(Number); if (Math.hypot((i + 0.5) * kachel - fx, (j + 0.5) * kachel - fz) > aussen + kachel * 2) cache.delete(key); }
    }
    let neu = 0;
    if (geplant.offen) for (const t of geplant.soll) {
      if (cache.has(t.key)) continue;
      if (neu >= max) break;
      cache.set(t.key, fernwaldKachel(karte, { x0: t.i * kachel, z0: t.j * kachel, groesse: kachel }, { seed, dichte })); neu++;
    }
    if (geplant.offen && neu === 0 && geplant.soll.every((t) => cache.has(t.key))) geplant.offen = false;
    const wechsel = ctk !== geplant.k || Math.hypot(fx - lx, fz - lz) > 60, neuAufgebaut = wechsel || neu > 0;
    if (neuAufgebaut) aufbauen(fx, fz);
    return { neu, neuAufgebaut };
  }

  return {
    mesh, update,
    get anzahl() { return anzahl; }, get dreiecke() { return anzahl * tris; },
    dispose() { geo.dispose(); mat.dispose(); mesh.dispose(); cache.clear(); },
  };
}
