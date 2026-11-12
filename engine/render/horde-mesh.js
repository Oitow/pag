/**
 * @modul    horde-mesh
 * @zweck    Zeichnet eine Horde (gameplay/horde) mit wenigen Draw-Calls: je Modell und Lauf-Bild ein InstancedMesh; Hüpfer, Überschlag im Flug, Treffer-Aufblitzen, Leichen auf der Seite, Versinken
 * @api      createHordeMesh({ modelle: { name: [geoBild0, geoBild1 …] }, max, material, schatten }) -> { gruppe, update(wesen), sichtbar, dispose() }
 * @beispiel
 *   import { createHordeMesh } from '../../engine/render/horde-mesh.js';
 *   import { createRatte } from '../../engine/models/kreaturen/ratte.js';
 *   const ratte = createRatte({ seed: 3 });
 *   const hm = createHordeMesh({ modelle: { ratte: ratte.frames }, max: 140 }); szene.add(hm.gruppe);
 *   hm.update(horde.wesen);   // jedes Bild nach horde.update()
 * @tags     horde, gegner, instancing, instancedmesh, rendern, schwarm, ratte, monster
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 *
 * Erwartet je Wesen (wie gameplay/horde): { def: { modell }, x, y, z, yaw, skala, phase, hub, dreh, zustand, blitz, verfall, ton, hoehe }.
 * Modelle: Nase nach +Z, Füße auf y = 0. Die Geometrien gehören dem Aufrufer (dispose() gibt sie nicht frei).
 */
import * as THREE from 'three';

/** opts: { modelle, max = 140 (je Bild), material (Standard: Vertexfarben, flach), schatten = true } */
export function createHordeMesh({ modelle = {}, max = 140, material = null, schatten = true } = {}) {
  const gruppe = new THREE.Group();
  gruppe.name = 'horde';
  const mat = material || new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
  const eigenesMaterial = !material;
  const meshes = {};
  for (const [name, bilder] of Object.entries(modelle)) {
    meshes[name] = bilder.map((geo) => {
      const m = new THREE.InstancedMesh(geo, mat, max);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.setColorAt(0, new THREE.Color(1, 1, 1));
      m.instanceColor.setUsage(THREE.DynamicDrawUsage);
      m.count = 0; m.castShadow = schatten; m.receiveShadow = false;
      m.frustumCulled = false;
      gruppe.add(m);
      return m;
    });
  }
  const mtx = new THREE.Matrix4(), pos = new THREE.Vector3(), quat = new THREE.Quaternion(), skal = new THREE.Vector3();
  const eu = new THREE.Euler(0, 0, 0, 'YXZ'), farbe = new THREE.Color();

  return {
    gruppe,
    get sichtbar() { return gruppe.visible; },
    set sichtbar(an) { gruppe.visible = !!an; },
    /** Instanzen aus der Wesen-Liste neu setzen. */
    update(wesen) {
      for (const n in meshes) for (const m of meshes[n]) m.count = 0;
      for (const w of wesen) {
        const bilder = meshes[w.def?.modell];
        if (!bilder) continue;
        const tot = w.zustand === 'tot', liegt = tot || (w.tot && w.zustand !== 'flug');
        const bild = w.zustand === 'lauf' || w.zustand === 'sprung' ? ((w.phase % 1) + 1) % 1 < 0.5 ? 0 : 1 : 0;
        const m = bilder[Math.min(bild, bilder.length - 1)];
        if (m.count >= max) continue;
        const s = w.skala * (1 - 0.35 * (w.verfall || 0));
        let y = w.y + (w.hub || 0), rx = 0, rz = 0;
        if (w.zustand === 'flug') rx = w.dreh || 0;                                   // Überschlag
        else if (liegt) { rz = Math.PI / 2; y += w.hoehe * 0.38 - w.hoehe * (w.verfall || 0); }   // auf der Seite, versinkt
        else if (w.zustand === 'benommen') rz = Math.sin(w.t * 30) * 0.25 * Math.max(0, 1 - w.t * 2);
        else if (w.zustand === 'sprung') rx = -0.5 * Math.sin(Math.PI * Math.min(1, w.t / 0.3));   // Kopf hoch beim Anspringen
        eu.set(rx, w.yaw, rz);
        quat.setFromEuler(eu);
        pos.set(w.x, y, w.z);
        skal.set(s, s * (w.zustand === 'sprung' ? 1.08 : 1), s);
        mtx.compose(pos, quat, skal);
        const i = m.count++;
        m.setMatrixAt(i, mtx);
        const t = w.ton ?? 1, b = w.blitz || 0, dunkel = tot ? 0.55 : 1;
        farbe.setRGB((t * dunkel) * (1 - b) + 3.5 * b, (t * dunkel) * (1 - b) + 3 * b, (t * dunkel) * (1 - b) + 2.6 * b);
        m.setColorAt(i, farbe);
      }
      for (const n in meshes) for (const m of meshes[n]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    },
    dispose() {
      for (const n in meshes) for (const m of meshes[n]) { m.dispose(); m.removeFromParent(); }
      if (eigenesMaterial) mat.dispose();
      gruppe.removeFromParent();
    },
  };
}
