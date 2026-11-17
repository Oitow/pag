// Dämmerwald – die Riesen: 4–5 Varianten (engine/models/natur/riesenbaum.js, SDF-Wurzeln) als InstancedMesh, Kollision (Stamm = Kreis, Wurzeln begehbar über
// die Höhenkarte), dazu billige Fern-Silhouetten bis ~650 m, die im Dunst verblassen. Fehlt das Engine-Modul, stehen schlichte Säulen als Platzhalter.
import * as THREE from 'three';
import { rng, hashSeed } from '../../../engine/core/rng.js';
import { RIESEN_VARIANTEN, WELT, pfadX, pfadYaw, pfadAbstand } from './plan-daten.js';
import { mitHoehenDunst } from './licht.js';

const EINSINKEN = 0.45;      // Riesen stehen etwas im Boden, damit kein Wurzelrand schwebt

/** Platzhalter-Riese: gedrehtes Profil mit Wurzelanlauf, Rindenfarbe mit Streifen. */
function platzhalter(v, segmente = 18) {
  const r = v.stammRadius, h = v.hoehe;
  const profil = [[r * 2.1, 0], [r * 1.45, 1.6], [r * 1.15, 5], [r * 1.02, 11], [r * 0.95, 22], [r * 0.8, h * 0.55], [r * 0.55, h * 0.85], [r * 0.4, h]].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(profil, segmente);
  const p = geo.attributes.position, farbe = new Float32Array(p.count * 3), zufall = rng(hashSeed('platzhalter', v.seed));
  const streifen = Array.from({ length: segmente + 1 }, () => 0.8 + 0.4 * zufall());
  for (let i = 0; i < p.count; i++) {
    const w = Math.atan2(p.getZ(i), p.getX(i)), k = streifen[Math.round(((w + Math.PI) / (2 * Math.PI)) * segmente) % segmente] * (0.9 + 0.2 * zufall());
    const moos = Math.max(0, 1 - p.getY(i) / 9) * 0.5;
    farbe[i * 3] = 0.105 * k * (1 - moos) + 0.05 * moos; farbe[i * 3 + 1] = 0.088 * k * (1 - moos) + 0.085 * moos; farbe[i * 3 + 2] = 0.072 * k * (1 - moos) + 0.03 * moos;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(farbe, 3));
  return geo;
}

/** Baut die Varianten: echt (Engine-Modul) oder Platzhalter. → [{ geometrie, splats|null, kollision: { stammRadius, hoehenkarte|null }, masse, echt, dispose() }] */
export function baueVarianten({ modul = null, detail = 1 } = {}) {
  return RIESEN_VARIANTEN.map((v) => {
    if (modul?.createRiesenbaum) {
      // drei Stufen: voll (direkt am Pfad), mittel (≈ 1/3), grob (≈ 1/8 der Dreiecke, fern im Dunst)
      const d = Math.max(0.45, detail), b = modul.createRiesenbaum({ ...v, detail: d });
      const mittel = d > 0.45 ? modul.createRiesenbaum({ ...v, detail: 0.45 }) : null, grob = v.bogen ? null : modul.createRiesenbaum({ ...v, detail: 0.2 });
      return { geometrie: b.geometrie, mittelGeometrie: (mittel ?? grob ?? b).geometrie, fernGeometrie: (grob ?? mittel ?? b).geometrie, splats: b.splats, kollision: b.kollision, masse: b.masse, echt: true,
        dispose: () => { b.dispose(); mittel?.dispose(); grob?.dispose(); } };
    }
    const geometrie = platzhalter(v);
    return { geometrie, mittelGeometrie: geometrie, fernGeometrie: geometrie, splats: null, kollision: { stammRadius: v.stammRadius, hoehenkarte: null }, echt: false,
      masse: { hoehe: v.hoehe, stammRadius: v.stammRadius, kronenAb: v.hoehe * 0.55, kronenRadius: v.hoehe * 0.3 }, dispose: () => geometrie.dispose() };
  });
}

/**
 * Bogen-Baum so stellen, dass der Pfad unter dem Wurzelbogen durchführt.
 * masse.bogen (Engine, Baum-Koordinaten): mitte [x,0,z] = hier geht man durch, achse = Durchgangsrichtung. Die Mitte kommt auf die Pfad-Mitte, die Achse in Laufrichtung.
 */
export function richteBogenAus(b, masse) {
  const bo = masse?.bogen;
  if (!bo?.mitte || !bo.achse) return b;
  const drehung = pfadYaw(b.z) - Math.atan2(bo.achse[0], bo.achse[2]);                  // Drehung um y: lokal (sin l, cos l) → Welt (sin(l+θ), cos(l+θ))
  const c = Math.cos(drehung), s = Math.sin(drehung), k = b.skala, mx = bo.mitte[0], mz = bo.mitte[2];
  return { ...b, drehung, x: pfadX(b.z) - (mx * c + mz * s) * k, z: b.z - (-mx * s + mz * c) * k };
}

/**
 * opts: { szene, riesen, varianten, bodenHoehe (Gelände), kollision (Kollisions-Welt) | null, schatten, fern = 150, seed }
 * → { meshes, instanzen, fernMesh, wurzelHoehe(x,z), dreiecke, update(), dispose() }
 */
export function createWald({ szene, riesen, varianten, bodenHoehe, schatten = true, fern = 150, nahWeite = 30, seed = WELT.seed }) {
  const echt = varianten[0].echt;
  const material = mitHoehenDunst(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, color: echt ? 0xc6cccc : 0xffffff, side: echt ? THREE.DoubleSide : THREE.FrontSide }), echt ? { ab: 34, bis: 110, max: 0.9 } : { ab: 26, bis: 96, max: 1 });
  const dummy = new THREE.Object3D(), farbe = new THREE.Color(), zufall = rng(hashSeed('wald', seed));
  const instanzen = riesen.map((b) => {
    const y = bodenHoehe(b.x, b.z) - EINSINKEN;
    return { ...b, y, cos: Math.cos(b.drehung), sin: Math.sin(b.drehung), v: varianten[b.variante], weite: RIESEN_VARIANTEN[b.variante].wurzelWeite * b.skala * 1.35,
      matrix: new THREE.Matrix4().compose(new THREE.Vector3(b.x, y, b.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.drehung), new THREE.Vector3(b.skala, b.skala, b.skala)) };
  });
  let dreiecke = 0;
  // Stufe 0 = volle Geometrie (Stamm direkt am Pfad), 1 = mittel, 2 = grob (fern, im Dunst)
  const stufe = (i) => { const a = pfadAbstand(i.x, i.z) - i.v.kollision.stammRadius * i.skala; return a < nahWeite * 0.4 ? 0 : a < nahWeite * 1.5 || i.held ? 1 : 2; };
  const meshes = varianten.flatMap((v, nr) => [0, 1, 2].map((st) => {
    const meine = instanzen.filter((i) => i.variante === nr && stufe(i) === st), nah = st < 2;
    if (!meine.length) return null;
    const geo = [v.geometrie, v.mittelGeometrie, v.fernGeometrie][st];
    const m = new THREE.InstancedMesh(geo, material, meine.length);
    meine.forEach((i, k) => { m.setMatrixAt(k, i.matrix); const hell = 0.86 + 0.26 * zufall(); m.setColorAt(k, farbe.setRGB(hell, hell * (0.97 + 0.06 * zufall()), hell * (0.94 + 0.1 * zufall()))); });
    m.castShadow = schatten && nah; m.userData.nah = nah; m.receiveShadow = true; m.frustumCulled = false; m.name = `riesen-${nr}-s${st}`;
    dreiecke += meine.length * (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    szene.add(m);
    return m;
  })).filter(Boolean);

  // Fern-Silhouetten: Säulen außerhalb des Spielbereichs (nur Land), dichter am Rand, dünner in der Ferne
  const fernGeo = platzhalter({ seed: 3, hoehe: 120, stammRadius: 5.5 }, 9);
  const fernMat = mitHoehenDunst(new THREE.MeshLambertMaterial({ vertexColors: true }), { ab: 22, bis: 90, max: 1 });
  const fernMesh = new THREE.InstancedMesh(fernGeo, fernMat, fern);
  const plaetze = [];
  for (let versuch = 0, n = 0; versuch < 8000 && n < fern; versuch++) {
    const x = (zufall() - 0.5) * 1300, z = 30 + zufall() * zufall() * 1000;
    const innen = x > WELT.xMin - 6 && x < WELT.xMax + 6 && z < WELT.zMax + 6;
    if (innen || bodenHoehe(x, z) < 1.2 || plaetze.some((p) => Math.hypot(p[0] - x, p[1] - z) < 26)) continue;
    plaetze.push([x, z]);
    const s = 0.8 + 0.5 * zufall();
    dummy.position.set(x, bodenHoehe(x, z) - 0.5, z); dummy.rotation.y = zufall() * 6.28; dummy.scale.set(s, 0.8 + 0.4 * zufall(), s); dummy.updateMatrix();
    fernMesh.setMatrixAt(n, dummy.matrix); fernMesh.setColorAt(n, farbe.setScalar(0.8 + 0.3 * zufall())); n++;
  }
  fernMesh.count = plaetze.length; fernMesh.frustumCulled = false; fernMesh.name = 'riesen-fern';
  szene.add(fernMesh);

  /** Höhe der Wurzeln (Welt-y) an einer Stelle, −Infinity wenn dort keine Wurzel liegt. */
  function wurzelHoehe(x, z) {
    let h = -Infinity;
    for (const i of instanzen) {
      const dx = x - i.x, dz = z - i.z;
      if (Math.abs(dx) > i.weite || Math.abs(dz) > i.weite) continue;
      const karte = i.v.kollision.hoehenkarte;
      if (!karte) continue;
      const w = karte.hoeheBei((dx * i.cos - dz * i.sin) / i.skala, (dx * i.sin + dz * i.cos) / i.skala);   // Welt → Baum (inverse Instanz-Transformation)
      if (Number.isFinite(w)) h = Math.max(h, i.y + w * i.skala);
    }
    return h;
  }
  return {
    meshes, instanzen, fernMesh, wurzelHoehe, dreiecke, echt, material,
    /** Stämme als Kreis-Hindernisse in die Kollisions-Welt eintragen. */
    meldeKollision(welt) { for (const i of instanzen) welt.fuege({ form: 'kreis', x: i.x, z: i.z, radius: i.v.kollision.stammRadius * i.skala * 0.96, y0: i.y - 3, hoehe: 400, daten: 'riese' }); },
    setzeSchatten(an) { for (const m of meshes) m.castShadow = an && m.userData.nah; },
    dispose() {
      for (const m of meshes) { szene.remove(m); m.dispose(); }
      szene.remove(fernMesh); fernMesh.dispose(); fernGeo.dispose(); fernMat.dispose(); material.dispose();
    },
  };
}
