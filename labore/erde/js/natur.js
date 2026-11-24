// Natur am Boden: zeigt die gestreuten Naturfundus-Assets (natur-streu) als InstancedMesh – eine Draw-Call-Gruppe je Art/Variante.
// Nah: Original-Asset aus dem Naturfundus. Fern (nur Bäume): schlanke Variante mit gleichen Farben (wenige Dreiecke).
// Floating Origin: alle Instanzen relativ zu einem Anker; der Anker springt bei jedem Neuaufbau zur Kamera.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { baueNaturAsset } from '../naturfundus/naturfundus.mjs';
import { STREU_ARTEN, STRIDE } from './natur-streu.js';

// nah/fern = Sichtweite in m (fern 0 = keine Fern-Variante), kolli = Stamm-/Fels-Radius bei Skala 1 (Geh-Modus)
const ARTEN = {
  fichte:      { nah: 55, fern: 320, varianten: 3, kolli: 0.25 },
  birke:       { nah: 40, fern: 320, varianten: 3, kolli: 0.18 },
  granitblock: { nah: 230, fern: 0, varianten: 3, kolli: 0.85 },
  schiefer:    { nah: 180, fern: 0, varianten: 2, kolli: 0.8 },
  rohrkolben:  { nah: 55, fern: 0, varianten: 2, kolli: 0 },
  seerose:     { nah: 60, fern: 0, varianten: 2, kolli: 0 },
  steinpilz:   { nah: 45, fern: 0, varianten: 2, kolli: 0 },
  forelle:     { nah: 35, fern: 0, varianten: 1, kolli: 0, fisch: true },
  barsch:      { nah: 35, fern: 0, varianten: 1, kolli: 0, fisch: true },
};

/** Schlanke Fern-Bäume (≈ 40–60 Dreiecke), Farben wie im Naturfundus. */
function fernBaum(art) {
  const teile = [];
  const teil = (g, farbe, x, y, z, sx, sy, sz) => {
    const n = g.index ? g.toNonIndexed() : g;
    n.deleteAttribute('uv'); n.scale(sx, sy, sz).translate(x, y, z); n.computeVertexNormals();
    const c = new THREE.Color(farbe), a = new Float32Array(n.attributes.position.count * 3);
    for (let i = 0; i < a.length; i += 3) c.toArray(a, i);
    n.setAttribute('color', new THREE.BufferAttribute(a, 3));
    teile.push(n);
  };
  if (art === 'fichte') {
    teil(new THREE.CylinderGeometry(0.8, 1, 1, 5, 1, true), 0x624939, 0, 1, 0, 0.19, 2, 0.19);
    teil(new THREE.ConeGeometry(1, 1, 6), 0x2c5543, 0, 2.6, 0, 1.45, 3.2, 1.45);
    teil(new THREE.ConeGeometry(1, 1, 6), 0x407352, 0, 4.4, 0, 0.95, 2.4, 0.95);
  } else {
    teil(new THREE.CylinderGeometry(0.8, 1, 1, 5, 1, true), 0xd5d0bb, 0, 1.8, 0, 0.14, 3.6, 0.14);
    teil(new THREE.IcosahedronGeometry(1, 0), 0x7fa24a, 0, 4.1, 0, 1.25, 1.45, 1.2);
    teil(new THREE.IcosahedronGeometry(1, 0), 0x8eae50, 0.3, 4.9, -0.2, 0.8, 0.9, 0.8);
  }
  const g = mergeGeometries(teile); teile.forEach((t) => t.dispose());
  return g;
}

export function createNatur(scene) {
  const gruppe = new THREE.Group();
  scene.add(gruppe);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  const toepfe = []; // { art, fern, mesh, n, kap }
  const topf = (art, fern, geo) => {
    const t = { art, fern, geo, mesh: null, n: 0, kap: 0 };
    toepfe.push(t);
    return t;
  };
  const NAH = {}, FERN = {};
  for (const art of STREU_ARTEN) {
    const cfg = ARTEN[art];
    NAH[art] = [];
    for (let v = 0; v < cfg.varianten; v++) {
      const m = baueNaturAsset(art, 11 + v * 977);
      m.material.dispose();
      NAH[art].push(topf(art, false, m.geometry));
    }
    if (cfg.fern) FERN[art] = topf(art, true, fernBaum(art));
  }
  const kapazitaet = (t, n) => {
    if (t.mesh && t.kap >= n) return;
    if (t.mesh) { gruppe.remove(t.mesh); t.mesh.dispose(); }
    t.kap = Math.max(64, 1 << Math.ceil(Math.log2(n + 1)));
    t.mesh = new THREE.InstancedMesh(t.geo, mat, t.kap);
    t.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    t.mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    t.mesh.frustumCulled = false;
    gruppe.add(t.mesh);
  };

  const anker = new THREE.Vector3(), letzteKamera = new THREE.Vector3(1e12, 0, 0);
  let schmutzig = true, fische = [], hindernisse = [], dreiecke = 0, anzahl = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qd = new THREE.Quaternion(), oben = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3(), skal = new THREE.Vector3(), farbe = new THREE.Color();
  const tan = new THREE.Vector3(), tan2 = new THREE.Vector3(), vor = new THREE.Vector3(), lokX = new THREE.Vector3(), kreuz = new THREE.Vector3();

  function lage(ax, ay, az, dreh, s) {
    oben.set(ax, ay, az).normalize();
    q.setFromUnitVectors(Y, oben);
    qd.setFromAxisAngle(Y, dreh);
    q.multiply(qd);
    pos.set(ax - anker.x, ay - anker.y, az - anker.z);
    skal.setScalar(s);
    return m4.compose(pos, q, skal);
  }

  /** Neu aufbauen, wenn neue Streu-Kacheln da sind oder die Kamera > 15 m weiter ist. kacheln = [{mitte, daten, anzahl}]. */
  function update(cam, kacheln, zeit, aktiv) {
    gruppe.visible = aktiv;
    if (!aktiv) return;
    if (schmutzig || cam.distanceTo(letzteKamera) > 15) {
      schmutzig = false;
      letzteKamera.copy(cam);
      anker.copy(cam);
      for (const t of toepfe) t.n = 0;
      // erst zählen, dann füllen
      const wahl = [];
      fische = []; hindernisse = [];
      let idx = 0;
      for (const k of kacheln) {
        const d = k.daten, [mx, my, mz] = k.mitte;
        for (let i = 0; i < k.anzahl; i++, idx++) {
          const o = i * STRIDE, art = STREU_ARTEN[d[o]], cfg = ARTEN[art];
          const ax = mx + d[o + 1], ay = my + d[o + 2], az = mz + d[o + 3];
          const ab = Math.hypot(ax - cam.x, ay - cam.y, az - cam.z);
          let t = null;
          if (ab < cfg.nah) t = NAH[art][idx % cfg.varianten];
          else if (ab < cfg.fern && (ab < 180 || idx % 2 === 0)) t = FERN[art]; // weit weg: jeder zweite reicht
          if (!t) continue;
          t.n++;
          wahl.push(t, ax, ay, az, o, d);
          if (cfg.kolli && ab < 60) hindernisse.push({ x: ax, y: ay, z: az, r: cfg.kolli * d[o + 4] });
        }
      }
      for (const t of toepfe) { kapazitaet(t, t.n); t.mesh.count = 0; }
      dreiecke = 0; anzahl = 0;
      for (let w = 0; w < wahl.length; w += 6) {
        const t = wahl[w], ax = wahl[w + 1], ay = wahl[w + 2], az = wahl[w + 3], o = wahl[w + 4], d = wahl[w + 5];
        const i = t.mesh.count++;
        t.mesh.setMatrixAt(i, lage(ax, ay, az, d[o + 5], d[o + 4]));
        t.mesh.setColorAt(i, farbe.setRGB(d[o + 6], d[o + 7], d[o + 8]));
        if (ARTEN[t.art].fisch) fische.push({ t, i, ax, ay, az, dreh: d[o + 5], s: d[o + 4] });
      }
      for (const t of toepfe) {
        t.mesh.instanceMatrix.needsUpdate = true;
        if (t.mesh.instanceColor) t.mesh.instanceColor.needsUpdate = true;
        t.mesh.visible = t.mesh.count > 0;
        dreiecke += t.mesh.count * t.geo.attributes.position.count / 3;
        anzahl += t.mesh.count;
      }
    }
    // Fische schwimmen kleine Kreise unter der Wasseroberfläche
    for (const f of fische) {
      oben.set(f.ax, f.ay, f.az).normalize();
      tan.set(0.3, 1, 0.2).cross(oben).normalize(); tan2.crossVectors(oben, tan);
      const w = zeit * (0.5 + 0.15 * f.s) + f.dreh, r = 1.5 * f.s;
      const x = f.ax + (tan.x * Math.cos(w) + tan2.x * Math.sin(w)) * r;
      const y = f.ay + (tan.y * Math.cos(w) + tan2.y * Math.sin(w)) * r;
      const z = f.az + (tan.z * Math.cos(w) + tan2.z * Math.sin(w)) * r;
      // Blickrichtung = Bahntangente; Fisch schaut nach +X. Erst Grundlage (Drehung 0) → lokale X-Achse, dann Winkel dazu.
      lage(x, y, z, 0, f.s);
      vor.copy(tan).multiplyScalar(-Math.sin(w)).addScaledVector(tan2, Math.cos(w));
      lokX.set(1, 0, 0).applyQuaternion(q);
      const winkel = Math.atan2(kreuz.crossVectors(lokX, vor).dot(oben), lokX.dot(vor)) + Math.sin(zeit * 9 + f.dreh) * 0.12;
      f.t.mesh.setMatrixAt(f.i, lage(x, y, z, winkel, f.s));
      f.t.mesh.instanceMatrix.needsUpdate = true;
    }
    gruppe.position.set(anker.x - cam.x, anker.y - cam.y, anker.z - cam.z);
  }

  /** Stämme/Felsen in der Nähe (Weltkoordinaten) – für Kollision im Geh-Modus. */
  const naheHindernisse = () => hindernisse;

  function dispose() {
    for (const t of toepfe) { if (t.mesh) { gruppe.remove(t.mesh); t.mesh.dispose(); } t.geo.dispose(); }
    mat.dispose(); scene.remove(gruppe);
  }

  return { update, naheHindernisse, neu: () => { schmutzig = true; }, dispose, get info() { return { anzahl, dreiecke: Math.round(dreiecke) }; } };
}
