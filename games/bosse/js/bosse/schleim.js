// 4 – Schleimkönig: Metaballs über Marching Cubes (Mesh wird jedes Frame neu trianguliert), glänzendes Gel.
import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { kf, lerp } from '../helfer.js';

const SK = 3.4; // halbe Kantenlänge des Feldes in Welt-Einheiten
export default {
  id: 'schleim', name: 'Schleimkönig', emoji: '🟢',
  stil: 'Glibber · Glanz', technik: 'Metaballs / Marching Cubes',
  himmel: [0x8ad0a0, 0xe8f4c8], boden: 0x7aa060, staub: 0x6fd44a, ring: 0x9aff6a,
  groesse: 4.2, tempo: 1.8, schritt: 0.75, angriffDauer: 1.4, trefferZeit: 0.52, wucht: 1.3,
  erzeuge() {
    const g = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x52d040, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.82, sheen: 0.5, sheenColor: 0xc0ff80 });
    const mc = new MarchingCubes(44, mat, false, false, 40000);
    mc.scale.setScalar(SK); mc.position.y = SK - 0.25; mc.castShadow = true;
    g.add(mc);
    // Verschluckte Knochen im Inneren
    const knochenMat = new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.7 });
    const innen = new THREE.Group(); g.add(innen);
    const schaedel = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), knochenMat); schaedel.position.set(0.4, 0.9, -0.3); innen.add(schaedel);
    const k1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6), knochenMat); k1.position.set(-0.4, 0.7, 0); k1.rotation.set(0.5, 0, 1.1); innen.add(k1);
    // Augen + Krone
    const augen = [-1, 1].map(s => {
      const a = new THREE.Group();
      const weiss = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 }));
      const pupille = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), new THREE.MeshBasicMaterial({ color: 0x111111 }));
      pupille.position.z = 0.2; a.add(weiss, pupille); g.add(a); return { a, s, pupille };
    });
    const krone = new THREE.Group(); g.add(krone);
    const gold = new THREE.MeshStandardMaterial({ color: 0xffc830, metalness: 1, roughness: 0.25 });
    const reif = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.3, 16, 1, true), gold); reif.material.side = THREE.DoubleSide; krone.add(reif);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      const z = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.45, 4), gold); z.position.set(Math.cos(a) * 0.62, 0.35, Math.sin(a) * 0.62); krone.add(z);
      const j = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), new THREE.MeshStandardMaterial({ color: [0xff2050, 0x30a0ff][i % 2], roughness: 0.1 }));
      j.position.set(Math.cos(a) * 0.68, 0.05, Math.sin(a) * 0.68); krone.add(j);
    }
    krone.traverse(o => { if (o.isMesh) o.castShadow = true; });

    const ball = (x, y, z, r) => {
      const n = r / (2 * SK);
      mc.addBall(x / (2 * SK) + 0.5, (y - mc.position.y) / (2 * SK) + 0.5, z / (2 * SK) + 0.5, n * n * (mc.isolation + 12), 12);
    };
    const KEYS = [
      [0, {}],
      [0.38, { streck: 0.55, zurueck: -0.5 }],
      [0.52, { streck: -0.35, arm: 1, zurueck: 0.3 }],
      [0.75, { streck: -0.3, arm: 0.9, zurueck: 0.3 }],
      [1, {}],
    ];
    let quetsch = 0, bodenY = 0;
    return {
      gruppe: g, trefferPunkt: new THREE.Vector3(0, 0, 2.6),
      update(st) {
        const { w, zeit } = st;
        const a = kf(st.p, KEYS);
        // Hüpfen: hocken → Flug → landen
        const u = st.phase % 1;
        let hop = 0, sq = 0;
        if (u < 0.2) sq = -Math.sin(u / 0.2 * Math.PI) * 0.35;
        else if (u < 0.8) { const t = (u - 0.2) / 0.6; hop = Math.sin(t * Math.PI) * 1.2; sq = 0.2 * Math.sin(t * Math.PI); }
        else sq = -Math.sin((u - 0.8) / 0.2 * Math.PI) * 0.25;
        hop *= w.walk; sq *= w.walk;
        const wabbel = Math.sin(zeit * 2.2) * 0.06 * w.idle;
        quetsch = lerp(quetsch, sq + wabbel + a.streck, 0.4);
        const hoehe = 1.25 * (1 + quetsch), breite = 1.35 * (1 - quetsch * 0.5);
        bodenY = hop;
        mc.reset();
        const by = bodenY + hoehe * 0.85, bz = a.zurueck * 0.6;
        ball(0, by, bz, hoehe);
        ball(0, bodenY + 0.55, bz, breite * 1.1);
        for (let i = 0; i < 5; i++) {
          const an = i / 5 * Math.PI * 2 + zeit * 0.5;
          ball(Math.cos(an) * breite * 0.75, bodenY + 0.4 + Math.sin(zeit * 3 + i) * 0.08, bz + Math.sin(an) * breite * 0.75, 0.6 + Math.sin(zeit * 2 + i * 2) * 0.05);
        }
        ball(0, by + hoehe * 0.75, bz, hoehe * 0.6); // Kopf-Beule
        // Pseudopodium beim Angriff
        if (a.arm > 0.01) for (let i = 1; i <= 4; i++) {
          const t = i / 4;
          ball(0, by + 0.5 - t * by * 0.9 * a.arm, bz + t * 2.6 * a.arm, 0.75 - t * 0.2);
        }
        // Kleine Tropfen umkreisen den König
        for (let i = 0; i < 3; i++) {
          const an = zeit * 1.2 + i * 2.1;
          ball(Math.cos(an) * 2.1, bodenY + 1 + Math.sin(zeit * 2 + i) * 0.4, Math.sin(an) * 2.1, 0.22);
        }
        mc.update();
        const top = by + hoehe * 1.3 + 0.5;
        krone.position.set(0, top - 0.05, bz);
        krone.rotation.z = Math.sin(zeit * 1.5) * 0.08 + a.arm * 0.15;
        krone.rotation.x = -a.zurueck * 0.3;
        for (const e of augen) {
          e.a.position.set(e.s * 0.5, by + hoehe * 0.3, bz + breite * 1.12);
          e.a.scale.setScalar(1 + (a.streck > 0.3 ? 0.3 : 0));
          e.pupille.position.x = Math.sin(zeit * 0.9) * 0.08 * w.idle;
        }
        innen.position.set(0, bodenY * 0.9, bz);
        innen.rotation.y = zeit * 0.3;
      },
    };
  },
};
