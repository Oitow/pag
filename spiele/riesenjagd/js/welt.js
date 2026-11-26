// Riesenjagd – die Welt: welliger Waldboden, Urwald-Riesen (engine riesenbaum, 95–140 m) mit Wurzeln zum Drüberlaufen,
// normale Bäume und Felsen als Maßstab, Laub als Gauß-Splats, Dämmerlicht + dichter Dunst (PS2-Stimmung).
// Liefert die Kollisions-Welt für Held, Riesen, Haken und Kamera.
import * as THREE from 'three';
import { rng, hashSeed } from '../../../engine/core/rng.js';
import { createNoise2D } from '../../../engine/core/noise.js';
import { createRiesenbaum } from '../../../engine/models/natur/riesenbaum.js';
import { erzeuge as erzeugeBaum } from '../../../engine/models/natur/baum.js';
import { erzeuge as erzeugeFels } from '../../../engine/models/natur/fels.js';
import { createGaussWolke } from '../../../engine/render/gauss-wolke.js';
import { stammProfil, strahlStamm, HAKEN } from './haken.js';

export const WELT = Object.freeze({
  seed: 7, radius: 340, abstand: 58, start: { x: 0, z: 250, yaw: Math.PI },
  nebel: 0x46524e, nebelDichte: 0.0068,
});

const VARIANTEN = [
  { seed: 11, hoehe: 112, stammRadius: 5.6, wurzeln: 7, wurzelWeite: 22 },
  { seed: 23, hoehe: 128, stammRadius: 6.4, wurzeln: 8, wurzelWeite: 26 },
  { seed: 37, hoehe: 98, stammRadius: 4.9, wurzeln: 6, wurzelWeite: 18 },
  { seed: 41, hoehe: 138, stammRadius: 6.8, wurzeln: 9, wurzelWeite: 27 },
];

/** Riesen-Standorte (rein, ohne THREE): Poisson-artig, Startlichtung frei. */
export function planeRiesen(seed = WELT.seed, radius = WELT.radius, abstand = WELT.abstand) {
  const r = rng(hashSeed('riesen', seed)), liste = [];
  for (let versuch = 0; versuch < 6000 && liste.length < 140; versuch++) {
    const w = r() * Math.PI * 2, d = Math.sqrt(r()) * radius, x = Math.cos(w) * d, z = Math.sin(w) * d;
    if (Math.hypot(x - WELT.start.x, z - WELT.start.z) < 48) continue;
    const skala = 0.85 + r() * 0.35, min = abstand * (0.75 + 0.25 * skala);
    if (liste.some((b) => Math.hypot(b.x - x, b.z - z) < min)) continue;
    liste.push({ x, z, skala, variante: Math.floor(r() * VARIANTEN.length), drehung: r() * Math.PI * 2 });
  }
  return liste;
}

/** opts: { szene, qualitaet: { splats, detail, schatten } } → Welt-Adapter */
export function createWelt({ szene, qualitaet }) {
  const rausch = createNoise2D(hashSeed('boden', WELT.seed)), rausch2 = createNoise2D(hashSeed('boden2', WELT.seed));
  const gelaende = (x, z) => {
    const d = Math.hypot(x, z), rand = Math.max(0, d - WELT.radius - 40) / 120;
    return rausch(x * 0.0045, z * 0.0045) * 7 + rausch2(x * 0.022, z * 0.022) * 1.3 + rand * rand * 60;
  };

  // --- Riesen ---
  const plan = planeRiesen();
  const varianten = VARIANTEN.map((v) => {
    const nah = createRiesenbaum({ ...v, detail: qualitaet.detail }), fern = createRiesenbaum({ ...v, detail: 0.2 });
    return { v, nah, fern };
  });
  const stamme = plan.map((b) => {
    const V = varianten[b.variante], k = b.skala, fuss = gelaende(b.x, b.z) - 0.45;
    const R = V.v.stammRadius * k, H = V.v.hoehe * k, prof = stammProfil(R, H);
    return { ...b, fuss, R, H, radius: prof, oben: fuss + V.nah.masse.kronenAb * k * 1.15, krone: fuss + V.nah.masse.kronenAb * k, kronenR: V.nah.masse.kronenRadius * k,
      c: Math.cos(b.drehung), s: Math.sin(b.drehung), hk: V.nah.kollision.hoehenkarte, weite: V.v.wurzelWeite * k * 1.3 };
  });
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97, metalness: 0, color: 0xb4bcb8, side: THREE.DoubleSide });
  const dummy = new THREE.Object3D();
  const lod = varianten.map((V, nr) => {
    const meine = stamme.filter((s) => s.variante === nr);
    const mk = (geo, schatten) => { const m = new THREE.InstancedMesh(geo, material, Math.max(1, meine.length)); m.frustumCulled = false; m.castShadow = schatten; m.receiveShadow = true; m.count = 0; szene.add(m); return m; };
    return { meine, nah: mk(V.nah.geometrie, qualitaet.schatten), fern: mk(V.fern.geometrie, false) };
  });
  let lodUhr = 1e9, lodPos = { x: 1e9, z: 1e9 };
  function aktualisiereLod(p) {
    for (const L of lod) {
      let n = 0, f = 0;
      for (const s of L.meine) {
        dummy.position.set(s.x, s.fuss, s.z); dummy.rotation.set(0, s.drehung, 0); dummy.scale.setScalar(s.skala); dummy.updateMatrix();
        const d = Math.hypot(s.x - p.x, s.z - p.z);
        if (d < 130) L.nah.setMatrixAt(n++, dummy.matrix); else if (d < 330) L.fern.setMatrixAt(f++, dummy.matrix);
      }
      L.nah.count = n; L.fern.count = f; L.nah.instanceMatrix.needsUpdate = true; L.fern.instanceMatrix.needsUpdate = true;
    }
  }

  // --- Laub als Gauß-Splats (Budget je Qualität) ---
  let wolke = null;
  if (qualitaet.splats > 0) {
    const gesamt = stamme.reduce((a, s) => a + (varianten[s.variante].nah.splats?.anzahl ?? 3000), 0);
    const anteil = Math.min(1, qualitaet.splats / Math.max(1, gesamt));
    wolke = createGaussWolke({ max: Math.ceil(qualitaet.splats * 1.1) + 2000 });
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), ax = new THREE.Vector3(0, 1, 0);
    for (const s of stamme) {
      m.compose(new THREE.Vector3(s.x, s.fuss, s.z), q.setFromAxisAngle(ax, s.drehung), new THREE.Vector3(s.skala, s.skala, s.skala));
      wolke.fuege(varianten[s.variante].nah.splats, { matrix: m, anteil });
    }
    wolke.mesh.userData.psx = false; wolke.mesh.frustumCulled = false;
    wolke.setze?.({ nebelFarbe: new THREE.Color(WELT.nebel), nebelDichte: WELT.nebelDichte, licht: 0.55 });
    szene.add(wolke.mesh);
  }

  // --- Wurzeln begehbar: Höhe aus der Höhenkarte des Riesen ---
  const lokal = (s, x, z) => { const dx = (x - s.x) / s.skala, dz = (z - s.z) / s.skala; return [dx * s.c - dz * s.s, dx * s.s + dz * s.c]; };
  function naheStamme(x, z, rad = 0) { return stamme.filter((s) => Math.abs(s.x - x) < s.weite + rad && Math.abs(s.z - z) < s.weite + rad); }
  function bodenHoehe(x, z) {
    let h = gelaende(x, z);
    for (const s of naheStamme(x, z)) {
      if (!s.hk) continue;
      const [lx, lz] = lokal(s, x, z), w = s.hk.hoeheBei(lx, lz);
      if (Number.isFinite(w)) h = Math.max(h, s.fuss + w * s.skala);
    }
    return h;
  }

  // --- Boden ---
  const GROESSE = 1100, SEG = qualitaet.detail > 0.5 ? 220 : 160;
  const bodenGeo = new THREE.PlaneGeometry(GROESSE, GROESSE, SEG, SEG).rotateX(-Math.PI / 2);
  {
    const p = bodenGeo.attributes.position, farbe = new Float32Array(p.count * 3), fr = rng(hashSeed('bodenfarbe', WELT.seed)), fleck = createNoise2D(91);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = gelaende(x, z); p.setY(i, y);
      const moos = 0.5 + 0.5 * fleck(x * 0.03, z * 0.03), erde = 0.5 + 0.5 * fleck(x * 0.11 + 7, z * 0.11), j = 0.85 + fr() * 0.3;
      farbe[i * 3] = (0.075 * moos + 0.11 * (1 - moos)) * j * (0.8 + erde * 0.4);
      farbe[i * 3 + 1] = (0.105 * moos + 0.085 * (1 - moos)) * j;
      farbe[i * 3 + 2] = (0.045 * moos + 0.06 * (1 - moos)) * j;
    }
    bodenGeo.setAttribute('color', new THREE.BufferAttribute(farbe, 3));
    bodenGeo.computeVertexNormals();
  }
  const boden = new THREE.Mesh(bodenGeo.toNonIndexed(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
  boden.geometry.computeVertexNormals(); boden.receiveShadow = true; boden.name = 'boden';
  szene.add(boden);

  // --- Maßstab: normale Bäume, Felsen, Farne (Instanzen) ---
  const zr = rng(hashSeed('streu', WELT.seed));
  const frei = (x, z, rand) => !stamme.some((s) => Math.hypot(s.x - x, s.z - z) < s.R * 2.2 + rand);
  function streue(geometrien, anzahl, rand, skalaVon, opts = {}) {
    const mat = opts.material ?? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
    const meshes = geometrien.map((g) => { const m = new THREE.InstancedMesh(g, mat, anzahl); m.count = 0; m.castShadow = !!opts.schatten; m.receiveShadow = true; szene.add(m); return m; });
    for (let i = 0, n = 0; i < anzahl * 4 && n < anzahl * geometrien.length; i++) {
      const w = zr() * Math.PI * 2, d = Math.sqrt(zr()) * (WELT.radius + 60), x = Math.cos(w) * d, z = Math.sin(w) * d;
      if (!frei(x, z, rand)) continue;
      const m = meshes[n % meshes.length]; if (m.count >= anzahl) continue;
      dummy.position.set(x, bodenHoehe(x, z) - 0.1, z); dummy.rotation.set(0, zr() * 6.28, 0); dummy.scale.setScalar(skalaVon()); dummy.updateMatrix();
      m.setMatrixAt(m.count++, dummy.matrix); n++;
    }
    return meshes;
  }
  const baumGeos = ['fichte', 'tanne', 'toterBaum'].map((t, i) => erzeugeBaum(t, 5 + i, { detail: 1, jahreszeit: 'herbst' }).geometrie);
  const anz = Math.round(160 * qualitaet.dichte);
  const kleinBaeume = streue(baumGeos, anz, 2, () => 0.8 + zr() * 0.5, { schatten: false });
  const felsGeos = ['felsbrocken', 'findling', 'fels'].map((t, i) => erzeugeFels(t, 9 + i, { moos: 0.7, gestein: 'granit' }).geometrie);
  streue(felsGeos, Math.round(120 * qualitaet.dichte), 1, () => 0.8 + zr() * 2.2);
  const farnGeo = baueFarn();
  streue([farnGeo], Math.round(2600 * qualitaet.dichte), 0.5, () => 0.7 + zr() * 1.1, { material: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }) });

  // Lichtsäulen durch die Kronen (billige, additive Kegel)
  const strahlMat = new THREE.MeshBasicMaterial({ color: 0xd8c89a, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: true });
  strahlMat.userData.psx = false;
  for (let i = 0; i < 26; i++) {
    const w = zr() * 6.28, d = Math.sqrt(zr()) * WELT.radius, x = Math.cos(w) * d, z = Math.sin(w) * d;
    const h = 90, g = new THREE.CylinderGeometry(2 + zr() * 3, 7 + zr() * 8, h, 10, 1, true);
    const m = new THREE.Mesh(g, strahlMat); m.position.set(x, gelaende(x, z) + h / 2 - 2, z); m.rotation.set(0.25, zr(), 0.15); m.userData.psx = false;
    szene.add(m);
  }

  // --- Abfragen ---
  /** Stamm-Kollision: Punkt (x,y,z) mit Radius r aus Stämmen schieben. → {x,z,nx,nz}|null */
  function stammStoss(x, y, z, r) {
    for (const s of naheStamme(x, z, 10)) {
      const h = y - s.fuss; if (h < -1 || h > s.H) continue;
      const rr = s.radius(Math.max(h, 2.5)) + r, dx = x - s.x, dz = z - s.z, d = Math.hypot(dx, dz);
      if (d < rr && d > 1e-4) return { x: s.x + dx / d * rr, z: s.z + dz / d * rr, nx: dx / d, nz: dz / d };
    }
    return null;
  }
  /** Haken-Strahl gegen alle Stämme → nächster Treffer {t,x,y,z,nx,nz,stamm}|null */
  function strahl(von, richtung, maxT = HAKEN.reichweite) {
    let best = null;
    for (const s of stamme) {
      const dx = s.x - von.x, dz = s.z - von.z, t = dx * richtung.x + dz * richtung.z;
      if (t < -s.R * 2 || t > maxT + s.R * 2) continue;
      const qx = von.x + richtung.x * t - s.x, qz = von.z + richtung.z * t - s.z;
      const horiz = Math.hypot(richtung.x, richtung.z) || 1e-6;
      if (Math.hypot(qx, qz) > s.R * 2.2 + 2 && horiz > 0.3) continue;
      const tr = strahlStamm(von, richtung, s, best ? best.t : maxT);
      if (tr && (!best || tr.t < best.t)) best = { ...tr, stamm: s };
    }
    return best;
  }
  /** Zielhilfe: nächster Stamm im Blickkegel, Ankerpunkt am Stamm in Wunschhöhe. */
  function hilfe(von, richtung, kegel = 0.42) {
    let best = null, bestW = 1e9;
    for (const s of stamme) {
      const dx = s.x - von.x, dz = s.z - von.z, d = Math.hypot(dx, dz);
      if (d < s.R + 1 || d > HAKEN.reichweite) continue;
      const h = Math.hypot(richtung.x, richtung.z) || 1, w = Math.acos(Math.max(-1, Math.min(1, (dx * richtung.x + dz * richtung.z) / (d * h))));
      if (w > kegel) continue;
      const wert = w * 60 + d * 0.15;
      if (wert < bestW) { bestW = wert; best = { s, d }; }
    }
    if (!best) return null;
    const s = best.s, hoeheZiel = Math.min(s.oben - 4, Math.max(s.fuss + 8, von.y + 10 + richtung.y * best.d));
    const nx = (von.x - s.x) / best.d, nz = (von.z - s.z) / best.d, rr = s.radius(hoeheZiel - s.fuss);
    return { x: s.x + nx * rr, y: hoeheZiel, z: s.z + nz * rr, nx, nz, stamm: s, t: best.d, hilfe: true };
  }
  /** Kamera-Kollision: Punkt aus Stämmen schieben. */
  const hindernisse = (x, z, r) => { const p = stammStoss(x, 30, z, r ?? 0.5); return p ? { x: p.x, z: p.z } : null; };
  function zufallsPunkt(r, um = { x: 0, z: 0 }, weite = 120) {
    for (let i = 0; i < 40; i++) {
      const x = um.x + (r() * 2 - 1) * weite, z = um.z + (r() * 2 - 1) * weite;
      if (Math.hypot(x, z) < WELT.radius - 20 && frei(x, z, 10)) return { x, z };
    }
    return { x: um.x, z: um.z };
  }

  return {
    stamme, gelaende, bodenHoehe, stammStoss, strahl, hilfe, hindernisse, zufallsPunkt, frei,
    update(dt, p, kamera, zeit, breite, hoehe) {
      lodUhr += dt;
      if (lodUhr > 0.8 || Math.hypot(p.x - lodPos.x, p.z - lodPos.z) > 25) { lodUhr = 0; lodPos = { x: p.x, z: p.z }; aktualisiereLod(p); }
      wolke?.update(kamera, zeit, breite, hoehe);
    },
    zahlen: () => ({ riesen: stamme.length, splats: wolke?.anzahl ?? 0 }),
    dispose() { varianten.forEach((V) => { V.nah.dispose(); V.fern.dispose(); }); wolke?.dispose(); },
  };
}

/** Kleiner Farn: 6 schräge Wedel als Dreiecke mit Vertexfarben. */
function baueFarn() {
  const pos = [], col = [];
  for (let i = 0; i < 6; i++) {
    const w = (i / 6) * Math.PI * 2 + 0.3, c = Math.cos(w), s = Math.sin(w), L = 0.9 + (i % 2) * 0.35;
    const qx = -s * 0.14, qz = c * 0.14;
    pos.push(qx, 0, qz, -qx, 0, -qz, c * L, 0.55 + (i % 3) * 0.12, s * L);
    col.push(0.05, 0.07, 0.03, 0.05, 0.07, 0.03, 0.12, 0.16, 0.06);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
