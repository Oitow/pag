import * as THREE from 'three';
import { hashSeed, rng } from '../../../engine/core/rng.js';
import { heightAt } from './welt.js';
import { baueFundmodell } from '../../../engine/models/natur/fundmodelle.js';

// Etwa jede dritte 24-m-Zelle hat eine Fundstelle: ein Erzzeiger an der Oberfläche und ein Fund zwei Meter daneben.
// Aktiv sind die Zellen im Umkreis von RING Zellen (5×5 = 120 m), damit nichts sichtbar aufploppt. Die Geometrie liegt fest
// im Boden: Der vorhandene Tiefentest macht abgegrabene Teile sichtbar.
const ZELLE = 24, RING = 2, CHANCE = 0.32, MAX = (2 * RING + 1) ** 2;

export function createFundstellen(K) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84 });
  const typen = ['erzbrocken', 'ammonit', 'quarzdruse'];
  const gruppen = typen.map((art, index) => {
    const { positions, colors } = baueFundmodell(art, 310 + index);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.InstancedMesh(geo, material, MAX);
    mesh.count = 0;
    K.scene.add(mesh);
    return mesh;
  });
  const pose = new THREE.Object3D();
  let letzterX, letzterZ;
  function setze(typ, x, z, tiefe, winkel, groesse) {
    const mesh = gruppen[typ];
    pose.position.set(x, heightAt(x, z) - tiefe, z);
    pose.rotation.y = winkel;
    pose.scale.setScalar(groesse);
    pose.updateMatrix();
    mesh.setMatrixAt(mesh.count++, pose.matrix);
  }
  function update(x, z) {
    const cx = Math.floor(x / ZELLE), cz = Math.floor(z / ZELLE);
    if (letzterX === cx && letzterZ === cz) return;
    letzterX = cx;
    letzterZ = cz;
    for (const mesh of gruppen) mesh.count = 0;
    for (let i = cx - RING; i <= cx + RING; i++) {
      for (let j = cz - RING; j <= cz + RING; j++) {
        const r = rng(hashSeed('fundstelle', i, j));
        if (r() > CHANCE) continue;
        const fx = (i + 0.2 + r() * 0.6) * ZELLE;
        const fz = (j + 0.2 + r() * 0.6) * ZELLE;
        const winkel = r() * 2 * Math.PI;
        setze(0, fx, fz, 0.15, winkel, 1.4);
        setze(r() < 0.5 ? 1 : 2, fx + 2, fz, 0.9 + r() * 0.35, winkel, 1.2);
      }
    }
    for (const mesh of gruppen) {
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }
  function dispose() {
    for (const mesh of gruppen) {
      K.scene.remove(mesh);
      mesh.dispose();
      mesh.geometry.dispose();
    }
    material.dispose();
  }
  return { update, dispose };
}
