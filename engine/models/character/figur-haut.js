/**
 * @modul    figur-haut
 * @zweck    Organischer Figurenkörper: Look → SDF-Form (Anatomie + Kleidung + Haar) → ein glattes Netz (Surface Nets) mit gebackener Umgebungsverdeckung → SkinnedMesh, das weich mit dem Rig mitbiegt
 * @api      createFigurHaut({ look, masse, rig, material, zelle, mimik, schatten }) -> { mesh, kontext, dreiecke, ms, dispose() } ; formKontext(look, masse, rig, opts) -> ctx ; BINDE_POSE
 * @beispiel
 *   import { createFigurHaut } from '../../engine/models/character/figur-haut.js';
 *   const haut = createFigurHaut({ look, masse, rig, zelle: 0.012 });   // hängt sich selbst an rig.root
 *   // character-model macht das mit createCharacterModel({ look, koerper: 'organisch' })
 * @tags     figur, charakter, organisch, sdf, skinning, mesh, körper, haut
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 *
 * Form-Kontext (für figur-koerper / figur-kleidung / figur-haar, alle ohne THREE):
 *   alles aus teilKontext (character-parts): L, m, g, w, R, f (Farben als Zahlen), aermel, stil, taille, brust, tiefe, armR, beinR, rock, mimik
 *   P(knochen, [x,y,z]) -> [x,y,z]   Punkt im Knochen-Raum (wie die alten Mesh-Teile: Gliedmaßen hängen nach −Y, Kopfkugel bei y = R)
 *                                    → Bindungs-Pose in Figur-Koordinaten (Füße y = 0, Blick +Z, links +X)
 *   dreh(knochen, [rx,ry,rz]) -> Euler XYZ in Figur-Koordinaten (für o.dreh von Ellipsoid/Rundbox/Ring)
 *   achse(knochen) -> [x,y,z]      Einheitsvektor entlang −Y des Knochens (Richtung der Gliedmaße)
 * Gebunden wird in einer A-Pose (BINDE_POSE: Arme gespreizt, Beine leicht auseinander), damit Arme und Beine nicht mit dem Rumpf verschmelzen.
 */
import * as THREE from 'three';
import { sdfNetz } from '../../core/sdf-netz.js';
import { figurMaterial } from '../../render/figur-material.js';
import { teilKontext } from './character-parts.js';
import { KNOCHEN } from './character-rig.js';
import { createFigurForm } from './figur-form.js';
import { baueKoerperForm } from './figur-koerper.js';
import { baueKleidungForm } from './figur-kleidung.js';
import { baueHaarForm } from './figur-haar.js';

/** Gelenkwinkel der Bindungs-Pose (rad, rotation.z bzw. .x). */
export const BINDE_POSE = Object.freeze({ arm: 0.62, ellbogen: -0.12, bein: 0.07 });

function bindePose(rig) {
  const k = rig.knochen, alt = KNOCHEN.map((n) => [k[n].rotation.clone(), k[n].position.clone()]);
  for (const n of KNOCHEN) k[n].rotation.set(0, 0, 0);
  rig.anpassen(rig.masse);
  k.schulterL.rotation.z = BINDE_POSE.arm; k.schulterR.rotation.z = -BINDE_POSE.arm;
  k.ellbogenL.rotation.x = BINDE_POSE.ellbogen; k.ellbogenR.rotation.x = BINDE_POSE.ellbogen;
  k.huefteL.rotation.z = BINDE_POSE.bein; k.huefteR.rotation.z = -BINDE_POSE.bein;
  return () => KNOCHEN.forEach((n, i) => { k[n].rotation.copy(alt[i][0]); k[n].position.copy(alt[i][1]); });
}

/** Kontext für die Form-Bauer. Erwartet das Rig bereits in Bindungs-Pose mit aktuellen Matrizen (relativ zu rig.root). */
export function formKontext(look, masse, rig, { mimik = true } = {}) {
  const ctx = teilKontext(look, masse, { mimik });
  const inv = new THREE.Matrix4().copy(rig.root.matrixWorld).invert(), M = new THREE.Matrix4(), v = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const welt = (n) => M.multiplyMatrices(inv, rig.knochen[n].matrixWorld);
  ctx.P = (n, p = [0, 0, 0]) => { v.set(p[0], p[1], p[2]).applyMatrix4(welt(n)); return [v.x, v.y, v.z]; };
  ctx.dreh = (n, d = [0, 0, 0]) => {
    welt(n).decompose(v, q, new THREE.Vector3());
    q.multiply(new THREE.Quaternion().setFromEuler(e.set(d[0], d[1], d[2])));
    e.setFromQuaternion(q, 'XYZ');
    return [e.x, e.y, e.z];
  };
  ctx.achse = (n) => { welt(n).decompose(v, q, new THREE.Vector3()); v.set(0, -1, 0).applyQuaternion(q); return [v.x, v.y, v.z]; };
  return ctx;
}

/** Umgebungsverdeckung aus dem Abstandsfeld (5 Schritte entlang der Normalen): 1 = offen, kleiner = Achsel, Schritt, Falte. */
function verdeckung(form, x, y, z, nx, ny, nz) {
  let occ = 0, w = 1;
  for (let i = 1; i <= 5; i++) {
    const h = 0.012 * i, d = form.abstand(x + nx * h, y + ny * h, z + nz * h);
    occ += w * Math.max(0, h - d); w *= 0.6;
  }
  return Math.max(0.35, 1 - occ * 14);
}

const cache = new Map();        // gleicher Look + Zelle → dieselbe Geometrie (NPCs, Editor-Zurück)

/**
 * opts: { look (fertig, createLook), masse, rig, material?, zelle = 0.012 m (kleiner = feiner, teurer), mimik = true, schatten = true }
 * → { mesh: THREE.SkinnedMesh (Kind von rig.root), kontext, dreiecke, ms (Bauzeit), dispose() }
 */
export function createFigurHaut({ look, masse, rig, material = null, zelle = 0.012, mimik = true, schatten = true }) {
  const t0 = performance.now();
  const root = rig.root, rootMatrix = root.matrix.clone(), eltern = root.parent;
  eltern?.remove(root);
  root.matrix.identity(); root.matrix.decompose(root.position, root.quaternion, root.scale);
  const zurueck = bindePose(rig);
  root.updateMatrixWorld(true);
  const ctx = formKontext(look, masse, rig, { mimik });

  const schluessel = JSON.stringify([look, zelle, mimik]);
  let geo = cache.get(schluessel)?.geo;
  if (!geo) {
    const form = createFigurForm({ glatt: 0.02 * ctx.g });
    baueKoerperForm(form, ctx);
    baueKleidungForm(form, ctx);
    baueHaarForm(form, ctx);
    const netz = sdfNetz(form, { zelle, block: 4 });
    const n = netz.position.length / 3, P = netz.position, N = netz.normal;
    const farbe = new Float32Array(n * 3), haut = new Float32Array(n), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    const idx = Object.fromEntries(KNOCHEN.map((k, i) => [k, i]));
    for (let i = 0; i < n; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      const e = form.einfluss(x, y, z);
      const ao = verdeckung(form, x, y, z, N[i * 3], N[i * 3 + 1], N[i * 3 + 2]);
      // sRGB-Vertexfarben → linear (wie mesh-builder), dann Verdeckung
      for (let c = 0; c < 3; c++) farbe[i * 3 + c] = Math.pow(e.farbe[c], 2.2) * ao;
      haut[i] = e.haut;
      const liste = Object.entries(e.knochen).filter(([k]) => k in idx).sort((a, b) => b[1] - a[1]).slice(0, 4);
      const summe = liste.reduce((s, [, w]) => s + w, 0) || 1;
      liste.forEach(([k, w], j) => { si[i * 4 + j] = idx[k]; sw[i * 4 + j] = w / summe; });
      if (!liste.length) { si[i * 4] = idx.torso; sw[i * 4] = 1; }
    }
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(farbe, 3));
    geo.setAttribute('haut', new THREE.BufferAttribute(haut, 1));
    geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    geo.setIndex(new THREE.BufferAttribute(netz.index, 1));
    if (cache.size > 40) { const [k, alt] = cache.entries().next().value; cache.delete(k); if (!alt.nutzer) alt.geo.dispose(); }
    cache.set(schluessel, { geo, nutzer: 0 });
  }
  const eintrag = cache.get(schluessel);
  eintrag.nutzer++;

  // Je Rig-Knochen ein THREE.Bone als Kind (Identität) → Skelett folgt den Gruppen ohne Umbau des Rigs
  const bones = KNOCHEN.map((n) => { const b = new THREE.Bone(); b.name = 'haut_' + n; rig.knochen[n].add(b); return b; });
  root.updateMatrixWorld(true);
  const mesh = new THREE.SkinnedMesh(geo, material || figurMaterial({ material: { flatShading: false, roughness: 0.75 } }));
  mesh.name = 'koerper';
  mesh.castShadow = schatten; mesh.receiveShadow = schatten;
  root.add(mesh);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, masse.hoehe * 0.5, 0), masse.hoehe * 0.95);   // Animation bleibt grob im Körperraum

  zurueck();
  root.matrix.copy(rootMatrix); root.matrix.decompose(root.position, root.quaternion, root.scale);
  eltern?.add(root);
  root.updateMatrixWorld(true);

  return {
    mesh, kontext: ctx, dreiecke: geo.index.count / 3, ms: Math.round(performance.now() - t0),
    dispose() {
      mesh.removeFromParent(); mesh.skeleton.dispose();
      for (const b of bones) b.removeFromParent();
      if (--eintrag.nutzer <= 0 && !cache.has(schluessel)) geo.dispose();
    },
  };
}
