// 3 – Kristallspinne: Low-Poly Flat-Shading, 8 Beine mit 2-Knochen-IK und Schrittfolge (Tetrapod-Gang).
import * as THREE from 'three';
import { kf, ik2, zwischen } from '../helfer.js';

export default {
  id: 'spinne', name: 'Kristallspinne', emoji: '🕷️',
  stil: 'Low-Poly Kristall', technik: 'Prozedurale Bein-IK',
  himmel: [0x1c1640, 0x5a4a8a], boden: 0x6a6480, staub: 0xb8a8ff, ring: 0xc0a0ff,
  groesse: 3.6, tempo: 2.4, schritt: 1.1, angriffDauer: 1.2, trefferZeit: 0.5, wucht: 1,
  erzeuge() {
    const g = new THREE.Group();
    const panzer = new THREE.MeshStandardMaterial({ color: 0x3a2a6a, roughness: 0.3, metalness: 0.5, flatShading: true });
    const kristall = new THREE.MeshStandardMaterial({ color: 0x9a7aff, emissive: 0x5a2aff, emissiveIntensity: 0.9, roughness: 0.1, metalness: 0.2, flatShading: true, transparent: true, opacity: 0.9 });
    const beinMat = new THREE.MeshStandardMaterial({ color: 0x251a45, roughness: 0.4, metalness: 0.6, flatShading: true });
    const mk = (geo, mat, p) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; p.add(m); return m; };

    const koerper = new THREE.Group(); g.add(koerper);
    const brust = mk(new THREE.IcosahedronGeometry(0.75, 0), panzer, koerper); brust.scale.set(1.1, 0.7, 1.2); brust.position.z = 0.4;
    const hinten = mk(new THREE.IcosahedronGeometry(1.2, 1), panzer, koerper); hinten.scale.set(1, 0.85, 1.25); hinten.position.set(0, 0.45, -1.3);
    // Kristalle auf dem Hinterleib
    const kg = new THREE.OctahedronGeometry(0.3, 0);
    const kristalle = [];
    for (let i = 0; i < 9; i++) {
      const k = mk(kg, kristall, koerper);
      const a = i * 2.4, r = 0.2 + (i % 3) * 0.3;
      k.position.set(Math.cos(a) * r * 0.9, 1.2 + (2 - i % 3) * 0.15, -1.3 + Math.sin(a) * r);
      k.scale.set(0.6, 1.6 + (i % 3) * 0.7, 0.6);
      k.rotation.set(Math.sin(a) * 0.5, a, Math.cos(a) * 0.4);
      kristalle.push(k);
    }
    const kopf = new THREE.Group(); kopf.position.set(0, 0.05, 1.2); koerper.add(kopf);
    mk(new THREE.IcosahedronGeometry(0.5, 0), panzer, kopf).scale.set(1, 0.8, 0.9);
    const augeMat = new THREE.MeshBasicMaterial({ color: 0xff3060 });
    for (const [x, y, r] of [[-0.18, 0.25, 0.1], [0.18, 0.25, 0.1], [-0.35, 0.15, 0.07], [0.35, 0.15, 0.07], [-0.1, 0.38, 0.06], [0.1, 0.38, 0.06]]) {
      const a = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), augeMat); a.position.set(x, y, 0.38); kopf.add(a);
    }
    const klauen = [-1, 1].map(s => {
      const k = new THREE.Group(); k.position.set(s * 0.18, -0.2, 0.35); kopf.add(k);
      const m = mk(new THREE.ConeGeometry(0.09, 0.5, 4), kristall, k); m.rotation.x = Math.PI * 0.8; m.position.set(0, -0.15, 0.1);
      return k;
    });

    // Beine: Hüfte am Körper, Fuß-Ruhepunkt auf dem Boden
    const OBER = 1.7, UNTER = 2.0;
    const zyl = new THREE.CylinderGeometry(0.08, 0.13, 1, 5);
    const spitze = new THREE.ConeGeometry(0.11, 1, 5);
    const beine = [];
    for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
      const zh = 0.75 - i * 0.38;
      const winkel = (i - 1.5) * 0.45;
      beine.push({
        s, i,
        huefte: new THREE.Vector3(s * 0.55, 0, zh),
        ruhe: new THREE.Vector3(s * Math.cos(winkel) * 2.7, 0, zh + Math.sin(-winkel) * 2.6 + 0.2),
        versatz: ((i + (s > 0 ? 1 : 0)) % 2) * 0.5,
        ober: mk(zyl, beinMat, g), unter: mk(spitze, beinMat, g),
        gel: mk(new THREE.OctahedronGeometry(0.16, 0), kristall, g),
        knie: new THREE.Vector3(), fuss: new THREE.Vector3(), h: new THREE.Vector3(),
      });
    }
    const up = new THREE.Vector3(0, 1, 0), pole = new THREE.Vector3();
    const KEYS = [
      [0, {}],
      [0.35, { steig: 0.9, kipp: -0.45, vorn: 1, klaue: 0.6 }],
      [0.5, { steig: 0.1, kipp: 0.25, vorn: -0.4, klaue: -0.3, stoss: 1 }],
      [0.68, { steig: 0.1, kipp: 0.25, vorn: -0.4, stoss: 1 }],
      [1, {}],
    ];
    return {
      gruppe: g, trefferPunkt: new THREE.Vector3(0, 0, 3.4),
      update(st) {
        const { w, zeit } = st;
        const a = kf(st.p, KEYS);
        koerper.position.y = 1.5 + w.idle * Math.sin(zeit * 1.4) * 0.05 + w.walk * Math.sin(st.phase * Math.PI * 4) * 0.06 + a.steig;
        koerper.rotation.x = a.kipp + w.walk * 0.05;
        koerper.rotation.z = w.walk * Math.sin(st.phase * Math.PI * 2) * 0.04;
        kopf.rotation.y = w.idle * Math.sin(zeit * 0.7) * 0.25;
        klauen.forEach((k, j) => { k.rotation.x = Math.sin(zeit * 5 + j * 2) * 0.15 * w.idle + a.klaue; });
        kristalle.forEach((k, j) => { k.material.emissiveIntensity = 0.7 + Math.sin(zeit * 2) * 0.3 + (a.stoss || 0) * 1.5; });
        koerper.updateMatrix();
        const SCHRITT = 1.1;
        for (const b of beine) {
          b.h.copy(b.huefte).applyMatrix4(koerper.matrix);
          // Gang: Stand-Phase schiebt den Fuß nach hinten, Schwung-Phase hebt ihn nach vorn
          const u = (st.phase + b.versatz) % 1;
          let dz, dy;
          if (u < 0.5) { dz = SCHRITT / 2 - SCHRITT * (u / 0.5); dy = 0; }
          else { const t = (u - 0.5) / 0.5; dz = -SCHRITT / 2 + SCHRITT * t; dy = Math.sin(t * Math.PI) * 0.5; }
          b.fuss.copy(b.ruhe);
          b.fuss.z += dz * w.walk; b.fuss.y = dy * w.walk;
          // Idle: ab und zu Tippen
          b.fuss.y += w.idle * Math.max(0, Math.sin(zeit * 2.3 + b.i * 1.7 + b.s)) ** 8 * 0.25;
          if (b.i === 0) { // Vorderbeine heben sich zum Stoß
            b.fuss.y += a.vorn > 0 ? a.vorn * 2.6 : 0;
            b.fuss.z += a.vorn > 0 ? a.vorn * 0.4 : 0;
            b.fuss.z += (a.stoss || 0) * 0.9; b.fuss.x *= 1 - (a.stoss || 0) * 0.55;
          }
          pole.copy(up).multiplyScalar(2).add(b.h).sub(b.fuss).add(new THREE.Vector3(b.s * 0.4, 0, 0));
          ik2(b.h, b.fuss, OBER, UNTER, pole.normalize(), b.knie);
          zwischen(b.ober, b.h, b.knie); zwischen(b.unter, b.knie, b.fuss);
          b.gel.position.copy(b.knie);
        }
      },
    };
  },
};
