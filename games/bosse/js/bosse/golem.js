// 1 – Steingolem: Voxel-Teile (eine Geometrie pro Körperteil), Toon-Shading, Inverted-Hull-Outline.
import * as THREE from 'three';
import { voxelGeo, outline, kf, rng } from '../helfer.js';

const S = 0.25;
export default {
  id: 'golem', name: 'Steingolem', emoji: '🗿',
  stil: 'Voxel · Toon-Outline', technik: 'Voxel-Meshing + Inverted Hull',
  himmel: [0x7fb3e0, 0xd8e6d0], boden: 0x9bb07a, staub: 0x8a8070,
  groesse: 5.6, tempo: 1.3, schritt: 0.55, angriffDauer: 1.7, trefferZeit: 0.5, wucht: 1.6,
  erzeuge() {
    const r = rng(7);
    const grad = new THREE.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, THREE.RedFormat);
    grad.needsUpdate = true;
    const mat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: grad });
    const stein = (x, y, z, ny) => {
      const v = r();
      if (y > ny - 2 && v < 0.6) return v < 0.3 ? 0x5f8f3a : 0x76a548; // Moos oben
      return [0x8c8a86, 0x7a7874, 0x9a9590, 0x6d6a66][Math.floor(v * 4)];
    };
    const blob = (nx, ny, nz, fn = stein, rund = 1) => voxelGeo(nx, ny, nz, (x, y, z) => {
      const dx = (x + 0.5 - nx / 2) / (nx / 2), dy = (y + 0.5 - ny / 2) / (ny / 2), dz = (z + 0.5 - nz / 2) / (nz / 2);
      const d = Math.pow(Math.abs(dx), 2.5) + Math.pow(Math.abs(dy), 2.5) + Math.pow(Math.abs(dz), 2.5);
      return d < rund + (r() - 0.5) * 0.25 ? fn(x, y, z, ny) : null;
    }, S);
    const teil = (geo, parent, x, y, z) => {
      const m = new THREE.Mesh(geo, mat); m.castShadow = true;
      m.position.set(x, y, z); parent.add(m); outline(m, 0.06, 0x1a1612); return m;
    };
    const gelenk = (parent, x, y, z) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };
    const leucht = new THREE.MeshBasicMaterial({ color: 0x5ff6ff });

    const g = new THREE.Group();
    const huefte = gelenk(g, 0, 2.17, 0);
    const torsoP = gelenk(huefte, 0, 0.2, 0);
    const torso = teil(blob(14, 11, 9), torsoP, 0, 1.25, 0);
    // Runen auf der Brust
    for (const [x, y] of [[0, 0.2], [-0.25, 0.45], [0.25, 0.45], [0, 0.7], [0, -0.05]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(S * 0.9, S * 0.9, 0.1), leucht);
      b.position.set(x, 1.0 + y, 1.2); torsoP.add(b);
    }
    const kopfP = gelenk(torsoP, 0, 2.5, 0.35);
    teil(blob(7, 6, 7), kopfP, 0, 0.6, 0);
    for (const x of [-0.3, 0.3]) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.1), leucht);
      a.position.set(x, 0.65, 0.9); kopfP.add(a);
    }
    const arme = [-1, 1].map(s => {
      const sch = gelenk(torsoP, s * 1.95, 2.1, 0);
      teil(blob(6, 6, 6), sch, s * 0.2, 0, 0);            // Schulter-Brocken
      teil(blob(5, 7, 5), sch, s * 0.25, -0.85, 0);       // Oberarm
      const ell = gelenk(sch, s * 0.25, -1.6, 0);
      teil(blob(5, 6, 5), ell, 0, -0.5, 0.05);            // Unterarm
      teil(blob(8, 7, 8, undefined, 1.2), ell, 0, -1.3, 0.1); // Faust
      return { sch, ell, s };
    });
    const beine = [-1, 1].map(s => {
      const h = gelenk(huefte, s * 0.75, 0, 0);
      teil(blob(6, 8, 6), h, 0, -0.75, 0);
      const knie = gelenk(h, 0, -1.45, 0);
      teil(blob(7, 3, 8, undefined, 1.3), knie, 0, -0.38, 0.12); // Fuß
      return { h, knie, s };
    });

    const KEYS = [
      [0, {}],
      [0.38, { arm: -2.9, ell: -0.4, torso: -0.3, kopf: -0.2, hoch: 0.15 }],
      [0.5, { arm: -1.25, ell: -0.1, torso: 0.6, kopf: 0.2, hoch: -0.45, knie: 0.5 }],
      [0.72, { arm: -1.25, ell: -0.1, torso: 0.6, kopf: 0.2, hoch: -0.45, knie: 0.5 }],
      [1, {}],
    ];
    return {
      gruppe: g, trefferPunkt: new THREE.Vector3(0, 0, 2.6),
      update(st) {
        const { w, zeit } = st, ph = st.phase * Math.PI * 2;
        const a = kf(st.p, KEYS);
        const atmen = Math.sin(zeit * 1.6);
        const schwer = Math.abs(Math.sin(ph));
        huefte.position.y = 2.17 + w.idle * atmen * 0.03 + w.walk * (schwer * 0.18 - 0.08) + a.hoch;
        huefte.rotation.z = w.walk * Math.sin(ph) * 0.08;
        torsoP.rotation.x = w.idle * atmen * 0.02 + w.walk * 0.12 + a.torso;
        torsoP.rotation.y = w.walk * Math.sin(ph) * 0.12;
        kopfP.rotation.y = w.idle * Math.sin(zeit * 0.5) * 0.4;
        kopfP.rotation.x = a.kopf;
        for (const b of beine) {
          const sw = Math.sin(ph + (b.s > 0 ? 0 : Math.PI));
          b.h.rotation.x = -w.walk * sw * 0.55 - a.knie * 0.6;
          b.knie.rotation.x = w.walk * Math.max(0, -Math.cos(ph + (b.s > 0 ? 0 : Math.PI))) * 0.6 + a.knie;
          b.h.rotation.z = b.s * 0.05;
        }
        for (const ar of arme) {
          const sw = Math.sin(ph + (ar.s > 0 ? Math.PI : 0));
          ar.sch.rotation.x = -w.walk * sw * 0.5 + w.idle * Math.sin(zeit * 1.6 + ar.s) * 0.04 + a.arm;
          ar.sch.rotation.z = ar.s * (0.12 + w.idle * atmen * 0.02) - ar.s * a.arm * 0.08;
          ar.ell.rotation.x = -0.25 - w.walk * 0.2 + a.ell;
        }
      },
    };
  },
};
