// 2 – Lava-Wurm: Segmentkette entlang einer prozeduralen Wirbelsäule, Lava-Risse per Shader-Injection (fbm-Rauschen).
import * as THREE from 'three';
import { kf, Partikel, GLSL_NOISE, lerp } from '../helfer.js';

const N = 22, ABST = 0.42;
export default {
  id: 'lavawurm', name: 'Lava-Wurm', emoji: '🐛',
  stil: 'Glühendes Magma', technik: 'Segment-Kette + Shader-Injection',
  himmel: [0x2a0d0a, 0x6a2a14], boden: 0x4a3a34, staub: 0xff6a20, ring: 0xff7a30,
  groesse: 4.6, tempo: 2.2, schritt: 0.7, angriffDauer: 1.3, trefferZeit: 0.45, wucht: 1.3,
  erzeuge() {
    const g = new THREE.Group();
    const uZeit = { value: 0 }, uGlut = { value: 0.6 };
    const lava = new THREE.MeshStandardMaterial({ color: 0x2b211e, roughness: 0.85, metalness: 0.1, flatShading: true });
    lava.onBeforeCompile = s => {
      s.uniforms.uZeit = uZeit; s.uniforms.uGlut = uGlut;
      s.vertexShader = 'varying vec3 vOP;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
      s.fragmentShader = 'varying vec3 vOP; uniform float uZeit, uGlut;\n' + GLSL_NOISE + s.fragmentShader.replace('#include <emissivemap_fragment>', `
        float n = fbm(vOP * 2.2 + vec3(0., uZeit * .4, 0.));
        float riss = smoothstep(.06, .0, abs(n - .5)) ;
        float puls = .75 + .25 * sin(uZeit * 3. + vOP.y * 4.);
        totalEmissiveRadiance += vec3(1., .35, .05) * riss * 3. * puls * uGlut;
        diffuseColor.rgb *= 1. - riss * .8;`);
    };
    const kugel = new THREE.IcosahedronGeometry(1, 2);
    const stachel = new THREE.ConeGeometry(0.18, 0.6, 5);
    const steinMat = new THREE.MeshStandardMaterial({ color: 0x1a1412, roughness: 1, flatShading: true });
    const segs = [];
    for (let i = 0; i < N; i++) {
      const m = new THREE.Mesh(kugel, lava); m.castShadow = true; g.add(m);
      const r = 0.75 * (1 - Math.pow(i / N, 1.4) * 0.8) * (i < 3 ? 0.85 + i * 0.05 : 1);
      if (i > 0 && i % 2 === 0) {
        const s = new THREE.Mesh(stachel, steinMat); s.position.set(0, 0.95, -0.1); s.rotation.x = -0.4; m.add(s);
      }
      segs.push({ m, r });
    }
    // Kopf: Ober- und Unterkiefer, Zähne, Augen
    const kopf = new THREE.Group(); g.add(kopf);
    const schaedel = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), lava);
    schaedel.scale.set(1, 0.8, 1.35); schaedel.castShadow = true; kopf.add(schaedel);
    const kiefer = new THREE.Group(); kiefer.position.set(0, 0, -0.3); kopf.add(kiefer);
    const unter = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.4), lava);
    unter.scale.set(0.95, 0.6, 1.3); unter.position.z = 0.3; unter.castShadow = true; kiefer.add(unter);
    const zahnMat = new THREE.MeshStandardMaterial({ color: 0xf2e2c4, roughness: 0.5 });
    const zahn = new THREE.ConeGeometry(0.07, 0.32, 4);
    for (let i = 0; i < 9; i++) {
      const a = -1.2 + i * 0.3;
      const z1 = new THREE.Mesh(zahn, zahnMat); z1.position.set(Math.sin(a) * 0.75, -0.08, Math.cos(a) * 1.0); z1.rotation.x = Math.PI; kopf.add(z1);
      const z2 = new THREE.Mesh(zahn, zahnMat); z2.position.set(Math.sin(a) * 0.7, 0.05, Math.cos(a) * 0.95 + 0.3 - 0.3); kiefer.add(z2); z2.position.z += 0.3;
    }
    const schlund = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff8a20 }));
    schlund.position.z = 0.2; schlund.scale.set(1, 0.4, 1); kopf.add(schlund);
    const auge = new THREE.MeshBasicMaterial({ color: 0xffe04a });
    for (const s of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), auge); a.position.set(s * 0.5, 0.35, 0.65); kopf.add(a);
      const h = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7, 5), steinMat); h.position.set(s * 0.45, 0.6, -0.4); h.rotation.set(-1.1, 0, s * -0.4); kopf.add(h);
    }
    const licht = new THREE.PointLight(0xff6a20, 6, 7); licht.position.set(0, 1, 1); g.add(licht);
    const glut = new Partikel(260);
    g.add(glut.obj);

    const KEYS = [
      [0, {}],
      [0.35, { vor: -1.2, hoch: 0.9, maul: 0.3, glut: 0.6 }],
      [0.47, { vor: 2.6, hoch: -1.7, maul: 1, glut: 1.5 }],
      [0.65, { vor: 2.4, hoch: -1.6, maul: 0.2, glut: 1 }],
      [1, {}],
    ];
    const pts = Array.from({ length: N + 1 }, () => new THREE.Vector3());
    const tmp = new THREE.Vector3();
    return {
      gruppe: g, trefferPunkt: new THREE.Vector3(0, 0, 3.4),
      update(st) {
        const { w, zeit, dt } = st, ph = st.phase * Math.PI * 2;
        const a = kf(st.p, KEYS);
        uZeit.value = zeit; uGlut.value = 0.6 + a.glut + Math.sin(zeit * 2) * 0.1;
        const headZ = 1.6 + a.vor, lift = 3.0 + a.hoch + w.idle * Math.sin(zeit * 1.3) * 0.15;
        // Wirbelsäule: Bogen nach oben am Kopf, Schlängeln hinten
        for (let i = 0; i <= N; i++) {
          const s = i * ABST;
          const neck = Math.max(0, 1 - s / 3.2);
          const k = neck * neck * (3 - 2 * neck);
          const wellen = Math.min(1, s / 2.5);
          const x = (Math.sin(s * 1.3 - ph) * 0.9 * w.walk + Math.sin(s * 0.9 - zeit * 1.1) * 0.35 * w.idle) * wellen;
          const coil = w.idle * (1 - k) * 0.6;
          pts[i].set(x + Math.sin(s * 0.7) * coil, 0, headZ - s * (1 - coil * 0.3) - (1 - k) * 0.4 * a.vor);
          pts[i].y = lift * k + (1 - k) * 0.55;
        }
        for (let i = 0; i < N; i++) {
          const { m, r } = segs[i];
          m.position.copy(pts[i]);
          if (i > 0 && pts[i].y < r) m.position.y = Math.max(m.position.y, r * 0.75);
          const pul = 1 + Math.sin(zeit * 3 - i * 0.6) * 0.04;
          m.scale.set(r * pul, r * pul, r * 1.15);
          m.lookAt(tmp.copy(pts[i]).multiplyScalar(2).sub(pts[i + 1]));
        }
        kopf.position.copy(pts[0]).add(tmp.subVectors(pts[0], pts[1]).normalize().multiplyScalar(0.55));
        kopf.lookAt(tmp.multiplyScalar(4).add(kopf.position).setY(lerp(kopf.position.y, 0, 0.12 + a.maul * 0.25)));
        kiefer.rotation.x = 0.15 + a.maul * 0.8 + w.idle * Math.max(0, Math.sin(zeit * 0.8)) * 0.15;
        licht.position.copy(kopf.position); licht.intensity = 4 + a.glut * 6;
        // Glut steigt auf, beim Biss eine Fontäne
        for (let i = 0; i < 3; i++) {
          const s = segs[Math.floor(Math.random() * N)].m.position;
          glut.emit({ x: s.x + (Math.random() - .5), y: s.y + 0.5, z: s.z + (Math.random() - .5) }, { x: (Math.random() - .5) * .4, y: 1 + Math.random(), z: -st.w.walk * 2.2 }, 1 + Math.random(), 0.12, 0xffc040, 0x801000);
        }
        if (st.treffer) for (let i = 0; i < 80; i++) {
          const v = 3 + Math.random() * 4, an = Math.random() * 6.28;
          glut.emit({ x: kopf.position.x, y: 0.3, z: kopf.position.z + 0.6 }, { x: Math.cos(an) * v * .5, y: v, z: Math.sin(an) * v * .5 }, 1.2, 0.25, 0xffe060, 0xa01000);
        }
        glut.update(dt, { grav: 3, drag: 0.5, wachsen: -0.6 });
      },
    };
  },
};
