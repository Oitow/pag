// Dämmerwald – Dinge mit bekannter Größe (Maßstabs-Anker) und Wegmarken: Boot 4.5 m, Laternen 2.2 m (warmes Punktlicht nur bei den nächsten),
// stehender Wanderer 1.8 m am Tor der Alten, gestürzter Riese (zwei Hälften, Kerbe für den Pfad), Menhir + Wegweiser auf der Lichtung, leuchtende Pilze.
import * as THREE from 'three';
import { rng, hashSeed } from '../../../engine/core/rng.js';
import { createNoise3D } from '../../../engine/core/noise.js';
import { createLaterne } from '../../../engine/models/bau/licht.js';
import { createWegweiser } from '../../../engine/models/bau/wegbau.js';
import { erzeuge as erzeugeFels } from '../../../engine/models/natur/fels.js';
import { createCharacter } from '../../../engine/gameplay/character.js';
import { randomLook } from '../../../engine/models/character/character-look.js';
import { LICHTUNG, STAMM, PFAD_ENDE, MARKEN, pfadX, pfadYaw, nebenPfad } from './plan-daten.js';

// Ruderboot als weiche Schale aus Spanten-Profilen (kein Kasten)
function baueBoot() {
  const L = 4.5, stationen = 14, profil = 9, pos = [], col = [], idx = [];
  for (let i = 0; i <= stationen; i++) {
    const t = i / stationen * 2 - 1, b = 0.78 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), 2.6)), 0.55) + 0.02, bug = Math.pow(Math.abs(t), 3) * 0.2;
    for (let j = 0; j <= profil; j++) {
      const u = j / profil * 2 - 1, y = Math.pow(Math.abs(u), 2.2) * 0.62 + bug;
      pos.push(u * b, y, t * L / 2);
      const k = 0.75 + 0.25 * Math.sin(j * 2.1 + i * 0.7);
      col.push(0.2 * k, 0.16 * k, 0.12 * k);
    }
  }
  for (let i = 0; i < stationen; i++) for (let j = 0; j < profil; j++) { const a = i * (profil + 1) + j, c = a + profil + 1; idx.push(a, c, a + 1, a + 1, c, c + 1); }
  for (const z of [-0.8, 0.55]) {                                 // zwei Ruderbänke
    const n = pos.length / 3, w = 0.68;
    pos.push(-w, 0.42, z - 0.11, w, 0.42, z - 0.11, -w, 0.42, z + 0.11, w, 0.42, z + 0.11);
    for (let k = 0; k < 4; k++) col.push(0.26, 0.21, 0.15);
    idx.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }));
}

// Gestürzter Riese: zwei liegende Hälften (Achse lokal x), Rinde mit Längsfurchen, Moos auf der Oberseite, helles Bruchholz an der Kerbe
function baueStammHaelfte(seite, seed) {
  const laenge = (STAMM.laenge - STAMM.kerbe) / 2, r0 = STAMM.radius, n3 = createNoise3D(seed), ringe = 40, seg = 40;
  const pos = [], col = [], idx = [];
  for (let i = 0; i <= ringe + 1; i++) {
    const bruch = i === 0, t = Math.max(0, (i - 1) / ringe), lx = seite * (STAMM.kerbe / 2 + t * laenge);
    const dick = r0 * (seite > 0 ? 1 - 0.28 * t : 1 + 0.12 * t);       // eine Seite Richtung Krone dünner, die andere Richtung Wurzel dicker
    for (let j = 0; j <= seg; j++) {
      const w = j / seg * Math.PI * 2, cw = Math.cos(w), sw = Math.sin(w);
      const furche = 0.34 * n3(cw * 3.2, sw * 3.2, lx * 0.035) + 0.16 * n3(cw * 9, sw * 9, lx * 0.11), beule = 0.5 * n3(cw * 0.9, sw * 0.9, lx * 0.02);
      const rr = bruch ? dick * (0.25 + 0.2 * n3(cw * 2, sw * 2, 9)) : dick + furche + beule;
      const zack = (i <= 1 ? seite * (0.9 * n3(cw * 2.4, sw * 2.4, 4) + (bruch ? -0.5 : 0)) : 0);
      pos.push(lx + zack, sw * rr, cw * rr * 1.06);
      const moos = Math.min(1, Math.max(0, sw * 1.6 - 0.35 + 0.5 * n3(lx * 0.1, cw * 2, 5))), k = 0.8 + 0.5 * (furche + 0.3);
      if (bruch || (i === 1 && false)) col.push(0.33, 0.25, 0.16);
      else col.push(0.1 * k * (1 - moos) + 0.085 * moos, 0.085 * k * (1 - moos) + 0.13 * moos, 0.07 * k * (1 - moos) + 0.05 * moos);
    }
  }
  for (let i = 0; i <= ringe; i++) for (let j = 0; j < seg; j++) {
    const a = i * (seg + 1) + j, b = a + seg + 1;
    if (seite > 0) idx.push(a, a + 1, b, a + 1, b + 1, b); else idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

function instanzen(geo, mat, matrizen, name) {
  const m = new THREE.InstancedMesh(geo, mat, matrizen.length);
  matrizen.forEach((x, i) => m.setMatrixAt(i, x)); m.name = name;
  return m;
}

/** opts: { szene, bodenHoehe, welt (Kollisions-Welt), wald (für Pilz-Plätze an Wurzeln), seed, test } → { laternen, pilze, wanderer, menhir, schildPos, materialien, update(dt, zeit, spielerPos), setzeNacht(n), dispose() } */
export function createDinge({ szene, bodenHoehe, welt, seed = 1, test = false }) {
  const r = rng(hashSeed('dinge', seed)), dummy = new THREE.Object3D(), weg = [];
  const matrix = (x, z, ry = 0, s = 1, dy = 0) => { dummy.position.set(x, bodenHoehe(x, z) + dy, z); dummy.rotation.set(0, ry, 0); dummy.scale.setScalar(s); dummy.updateMatrix(); return dummy.matrix.clone(); };
  const dazu = (o) => { szene.add(o); weg.push(o); return o; };
  const holz = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, color: 0x9a938a });
  const stein = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true, color: 0x8f9490 });

  // Boot: halb auf den Kies gezogen, leicht gekippt
  const boot = dazu(baueBoot());
  boot.position.set(4.2, 0.08, 0.2); boot.rotation.set(0.04, 0.5, 0.05); boot.castShadow = true; boot.receiveShadow = true; boot.name = 'boot';
  welt.fuege({ form: 'kasten', x: 4.2, z: 0.2, bx: 0.7, bz: 2.1, winkel: 0.5, y0: -0.5, hoehe: 1.1 });

  // Laternen am Pfad (Engine-Asset 2.8 m → 0.8 = 2.24 m)
  const lat = createLaterne({ seed: 3 });
  const latPlaetze = [[13, 2.4], [47, -2.4], [91, 2.5], [129, -2.5], [177, 2.5], [213, -2.5], [270, 2.6], [313, -2.5], [357, 2.5], [386, -2.6]].map(([z, s]) => nebenPfad(z, s));
  const latMat = latPlaetze.map((p) => matrix(p.x, p.z, r() * 6.28, 0.8, -0.05));
  const latMesh = dazu(instanzen(lat.geometrie, holz, latMat, 'laternen')); latMesh.castShadow = true;
  const leuchtMat = new THREE.MeshBasicMaterial({ color: 0xf2b060, toneMapped: false });
  dazu(instanzen(lat.leucht, leuchtMat, latMat, 'laternen-licht'));
  for (const p of latPlaetze) welt.fuege({ form: 'kreis', x: p.x, z: p.z, radius: 0.14, hoehe: 2.2 });
  const lichter = [0, 1, 2].map(() => dazu(new THREE.PointLight(0xffa860, 0, 26, 1.6)));
  let lichtUhr = 0, nacht = 0;

  // Gestürzter Riese
  const sy = bodenHoehe(STAMM.x, STAMM.z) + STAMM.radius * 0.66;
  const rinde = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.97 });
  for (const seite of [-1, 1]) {
    const m = dazu(new THREE.Mesh(baueStammHaelfte(seite, 31 + seite), rinde));
    m.position.set(STAMM.x, sy, STAMM.z); m.rotation.y = -STAMM.winkel; m.castShadow = true; m.receiveShadow = true; m.name = 'gestuerzt' + seite;
    const l = (STAMM.laenge - STAMM.kerbe) / 2, mitte = seite * (STAMM.kerbe / 2 + l / 2 + 0.6);
    welt.fuege({ form: 'kasten', x: STAMM.x + Math.cos(STAMM.winkel) * mitte, z: STAMM.z + Math.sin(STAMM.winkel) * mitte, bx: l / 2, bz: STAMM.radius * 0.9, winkel: -STAMM.winkel, y0: sy - STAMM.radius, hoehe: STAMM.radius * 2 });
  }

  // Lichtung: Menhir (5.5 m), kleiner Steinkreis, Wegweiser „Enklave“
  const mz = LICHTUNG.z + 6;
  const menhirAsset = erzeugeFels('felsnadel', 12, { detail: 2, moos: 0.35 });
  const menhir = dazu(new THREE.Mesh(menhirAsset.geometrie, stein));
  const ms = 5.5 / menhirAsset.hoehe;
  menhir.position.set(LICHTUNG.x, bodenHoehe(LICHTUNG.x, mz) - 0.3, mz); menhir.scale.set(ms * 0.8, ms, ms * 0.8); menhir.rotation.y = 0.7; menhir.castShadow = true; menhir.name = 'menhir';
  welt.fuege({ form: 'kreis', x: LICHTUNG.x, z: mz, radius: 0.9, hoehe: 5 });
  const kleinAsset = erzeugeFels('findling', 5, { detail: 1, moos: 0.5 });
  const kreis = dazu(instanzen(kleinAsset.geometrie, stein, [0.5, 1.3, 2.2, 3.9, 4.8, 5.7].map((w) => matrix(LICHTUNG.x + Math.sin(w) * 7.5, mz + Math.cos(w) * 7.5, w * 3, (0.7 + 0.5 * r()) / kleinAsset.hoehe, -0.1)), 'steinkreis'));
  kreis.castShadow = true;
  const schildPos = nebenPfad(PFAD_ENDE - 12, -2.6);
  const wegweiser = createWegweiser({ seed: 2, schilder: [{ winkel: 0, text: 'Enklave' }] });
  const schild = dazu(new THREE.Mesh(wegweiser.geometrie, holz));
  schild.position.set(schildPos.x, bodenHoehe(schildPos.x, schildPos.z), schildPos.z); schild.rotation.y = pfadYaw(PFAD_ENDE - 12); schild.castShadow = true; schild.name = 'wegweiser';

  // Leuchtende Pilze: nur drei kleine Gruppen (Tor, Bogen, gestürzter Riese) – kühles Türkis als Akzent
  const pilzGeo = new THREE.SphereGeometry(1, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const pilzMat = new THREE.MeshBasicMaterial({ color: 0x5fe6d6, toneMapped: false });
  const gruppen = [nebenPfad(MARKEN.tor - 6, 4.2), nebenPfad(MARKEN.bogen - 14, -4.5), nebenPfad(MARKEN.stamm - 7.5, 4.8)];
  const pilze = [];
  for (const g of gruppen) for (let i = 0; i < 5; i++) {
    const x = g.x + (r() - 0.5) * 1.6, z = g.z + (r() - 0.5) * 1.6, s = 0.09 + 0.13 * r();
    dummy.position.set(x, bodenHoehe(x, z) + s * 0.9 + 0.04, z); dummy.rotation.set((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5); dummy.scale.set(s, s * 0.7, s); dummy.updateMatrix();
    pilze.push({ x, y: dummy.position.y, z, s, matrix: dummy.matrix.clone() });
  }
  dazu(instanzen(pilzGeo, pilzMat, pilze.map((p) => p.matrix), 'leuchtpilze'));

  // Wanderer: steht am Tor der Alten neben einer Wurzel und schaut den Stamm hinauf (1.8 m – der Vergleich für die Riesen)
  const wp = nebenPfad(MARKEN.tor - 7, 3.4);
  const stand = { bodenHoehe: (x, z) => bodenHoehe(x, z), wasserHoehe: () => null, hindernisse: () => null };
  const wanderer = createCharacter({ look: randomLook(hashSeed('wanderer', 4)), seed: 4, yaw: pfadYaw(MARKEN.tor) + 0.9, welt: stand, pos: { x: wp.x, y: bodenHoehe(wp.x, wp.z), z: wp.z }, name: 'Wanderer' });
  szene.add(wanderer.root);
  welt.fuege({ form: 'kreis', x: wp.x, z: wp.z, radius: 0.35, hoehe: 1.8 });
  wanderer.update(0.016);

  return {
    laternen: latPlaetze, pilze, wanderer, menhir: { x: LICHTUNG.x, z: mz }, schildPos, materialien: { holz, stein, rinde },
    update(dt, zeit, pos) {
      if (!test) wanderer.update(dt);
      if ((lichtUhr -= dt) > 0) return;
      lichtUhr = 0.4;
      const nah = latPlaetze.map((p) => ({ p, d: Math.hypot(p.x - pos.x, p.z - pos.z) })).sort((a, b) => a.d - b.d);
      lichter.forEach((l, i) => { const n = nah[i]; l.position.set(n.p.x, bodenHoehe(n.p.x, n.p.z) + 2.0, n.p.z); l.intensity = n.d < 70 ? 22 * (1 + 1.3 * nacht) : 0; l.distance = 26 + 14 * nacht; });
    },
    /** Tageszeit: n = 0 (Tag) … 1 (Nacht) – Laternen und Leuchtpilze tragen nachts mehr. */
    setzeNacht(n) {
      if (Math.abs(n - nacht) < 0.01) return;
      nacht = n; lichtUhr = 0;
      leuchtMat.color.setHex(0xf2b060).multiplyScalar(0.75 + 0.25 * n); pilzMat.color.setHex(0x5fe6d6).multiplyScalar(0.6 + 0.4 * n);
    },
    dispose() {
      for (const o of weg) { szene.remove(o); o.geometry?.dispose?.(); }
      for (const m of [holz, stein, rinde, leuchtMat, pilzMat]) m.dispose();
      lat.dispose(); wegweiser.dispose(); wanderer.dispose(); szene.remove(wanderer.root);
    },
  };
}
