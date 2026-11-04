// 6 – Glutdrache: SkinnedMesh – Hals/Rumpf/Schwanz als ein Rohr mit Skin-Weights auf einer Knochenkette, Flügel-Membranen, Feuer-Partikel.
import * as THREE from 'three';
import { kf, Partikel } from '../helfer.js';

// Knochen-Positionen entlang Z (Rumpfmitte = 0)
const HALS = [0, 1.0, 1.9, 2.7], SCHWANZ = [0, -1.1, -2.1, -3.0, -3.9, -4.8];
function radius(z) {
  if (z > 0) return z < 1 ? 0.85 - z * 0.3 : Math.max(0.3, 0.55 - (z - 1) * 0.14);
  return Math.max(0.04, 0.85 * Math.pow(1 - Math.min(1, -z / 5), 1.3) + (z > -1 ? 0.05 : 0));
}
export default {
  id: 'drache', name: 'Glutdrache', emoji: '🐉',
  stil: 'Schuppen · Feuer', technik: 'Skinned Mesh + Knochenkette',
  himmel: [0x3a5070, 0xe0a070], boden: 0x8a6a50, staub: 0x6a5a4a, ring: 0xffa040,
  groesse: 5, tempo: 2, schritt: 0.8, angriffDauer: 1.8, trefferZeit: 0.45, wucht: 1.2,
  erzeuge() {
    const g = new THREE.Group();
    const schuppe = new THREE.MeshStandardMaterial({ color: 0x8a1c14, roughness: 0.55, metalness: 0.2, flatShading: true });
    const bauch = new THREE.MeshStandardMaterial({ color: 0xd8a050, roughness: 0.7, flatShading: true });
    const horn = new THREE.MeshStandardMaterial({ color: 0x2a1a14, roughness: 0.6 });
    const torso = new THREE.Group(); g.add(torso);

    // Rohr-Geometrie mit Skin-Weights
    const SEG = 64, RAD = 10, z0 = SCHWANZ.at(-1), z1 = HALS.at(-1) + 0.3;
    const pos = [], idx = [], si = [], sw = [], col = [];
    const bones = [new THREE.Bone()];
    const halsB = [bones[0]], schwB = [bones[0]];
    for (let i = 1; i < HALS.length; i++) { const b = new THREE.Bone(); b.position.z = HALS[i] - HALS[i - 1]; halsB[i - 1].add(b); halsB.push(b); bones.push(b); }
    for (let i = 1; i < SCHWANZ.length; i++) { const b = new THREE.Bone(); b.position.z = SCHWANZ[i] - SCHWANZ[i - 1]; schwB[i - 1].add(b); schwB.push(b); bones.push(b); }
    const idxOf = b => bones.indexOf(b);
    for (let i = 0; i <= SEG; i++) {
      const z = z0 + (z1 - z0) * i / SEG, r = radius(z);
      const kette = z >= 0 ? HALS : SCHWANZ, kb = z >= 0 ? halsB : schwB;
      let k = 0; while (k < kette.length - 2 && Math.abs(z) > Math.abs(kette[k + 1])) k++;
      const f = Math.min(1, Math.max(0, (z - kette[k]) / (kette[k + 1] - kette[k])));
      for (let j = 0; j <= RAD; j++) {
        const a = j / RAD * Math.PI * 2;
        const y = Math.cos(a), x = Math.sin(a);
        pos.push(x * r * 1.05, y * r * (y > 0 ? 1 : 0.85), z);
        si.push(idxOf(kb[k]), idxOf(kb[k + 1]), 0, 0); sw.push(1 - f, f, 0, 0);
        const unten = y < -0.3 ? 1 : 0;
        col.push(unten, 0, 0);
      }
    }
    for (let i = 0; i < SEG; i++) for (let j = 0; j < RAD; j++) {
      const a = i * (RAD + 1) + j, b = a + RAD + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col.map((v, i) => i % 3 === 0 ? 0.55 + v * 0.45 : i % 3 === 1 ? 0.12 + v * 0.5 : 0.1 + v * 0.2), 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    schuppe.vertexColors = true; schuppe.color.set(0xffffff);
    const koerper = new THREE.SkinnedMesh(geo, schuppe);
    koerper.add(bones[0]); koerper.bind(new THREE.Skeleton(bones));
    koerper.castShadow = true; koerper.frustumCulled = false;
    torso.add(koerper);
    // Rückenstacheln an den Knochen
    const stachelG = new THREE.ConeGeometry(0.12, 0.5, 4);
    for (const b of [...halsB.slice(1), ...schwB]) {
      const s = new THREE.Mesh(stachelG, horn); s.position.y = 0.55 * (b === bones[0] ? 1.5 : 1); s.rotation.x = -0.5; s.castShadow = true; b.add(s);
    }
    // Kopf am letzten Halsknochen
    const kopf = new THREE.Group(); kopf.position.z = 0.35; halsB.at(-1).add(kopf);
    const schaedel = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.5, 1.2, 2, 2, 2), schuppe); schaedel.position.set(0, 0.1, 0.4); kopf.add(schaedel);
    const schnauze = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.7), schuppe); schnauze.position.set(0, 0.05, 1.25); kopf.add(schnauze);
    const kiefer = new THREE.Group(); kiefer.position.set(0, -0.15, 0.2); kopf.add(kiefer);
    const unterkiefer = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 1.5), bauch); unterkiefer.position.set(0, -0.05, 0.75); kiefer.add(unterkiefer);
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.9, 5), horn); h.position.set(s * 0.25, 0.45, -0.1); h.rotation.set(-1.2, 0, s * -0.3); kopf.add(h);
      const a = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd23f })); a.position.set(s * 0.3, 0.25, 0.75); kopf.add(a);
    }
    kopf.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const maul = new THREE.Object3D(); maul.position.set(0, -0.05, 1.7); kopf.add(maul);
    // Beine (vorwärts-kinematisch)
    const beinG = new THREE.CylinderGeometry(0.16, 0.2, 1, 6); beinG.translate(0, -0.5, 0);
    const beine = [];
    for (const [z, phase] of [[0.75, 0], [-0.8, 0.5]]) for (const s of [-1, 1]) {
      const h = new THREE.Group(); h.position.set(s * 0.65, -0.3, z); torso.add(h);
      const o = new THREE.Mesh(beinG, schuppe); o.scale.set(z > 0 ? 1 : 1.4, 0.85, z > 0 ? 1 : 1.4); h.add(o);
      const k = new THREE.Group(); k.position.y = -0.85; h.add(k);
      const u = new THREE.Mesh(beinG, schuppe); u.scale.set(0.8, 0.75, 0.8); k.add(u);
      const fuss = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.55), horn); fuss.position.set(0, -0.75, 0.15); k.add(fuss);
      [o, u, fuss].forEach(m => m.castShadow = true);
      beine.push({ h, k, s, ph: phase + (s > 0 ? 0 : 0.5), hinten: z < 0 });
    }
    // Flügel: Membran-Fächer
    const fluegel = [-1, 1].map(s => {
      const f = new THREE.Group(); f.position.set(s * 0.55, 0.5, 0.5); torso.add(f);
      const spitzen = [[3.2, 0.9, -0.4], [3.4, 0.2, -1.4], [2.6, -0.1, -2.4], [1.2, 0, -2.4], [0.2, 0, -1.4]];
      const v = [0, 0, 0];
      spitzen.forEach(p => v.push(p[0] * s, p[1], p[2]));
      const ix = []; for (let i = 1; i < spitzen.length; i++) ix.push(0, i, i + 1);
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); fg.setIndex(ix); fg.computeVertexNormals();
      const m = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ color: 0x5a1010, side: THREE.DoubleSide, roughness: 0.8, transparent: true, opacity: 0.92 }));
      m.castShadow = true; f.add(m);
      for (const p of spitzen.slice(0, 3)) {
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 1, 5), horn);
        const e = new THREE.Vector3(p[0] * s, p[1], p[2]);
        st.position.copy(e).multiplyScalar(0.5); st.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), e.clone().normalize()); st.scale.y = e.length(); f.add(st);
      }
      return { f, s };
    });
    const feuer = new Partikel(500); g.add(feuer.obj);
    const flamme = new THREE.PointLight(0xff8a20, 0, 10); g.add(flamme);

    const KEYS = [
      [0, {}],
      [0.3, { hals: -0.35, kopf: -0.3, maul: 0.2, aufbaeum: 0.25, fl: 0.6 }],
      [0.42, { hals: 0.25, kopf: 0.15, maul: 1, aufbaeum: -0.05, fl: 0.3, feuer: 1 }],
      [0.8, { hals: 0.2, kopf: 0.1, maul: 1, aufbaeum: -0.05, fl: 0.3, feuer: 1 }],
      [1, {}],
    ];
    const tmp = new THREE.Vector3(), dir = new THREE.Vector3(), q = new THREE.Quaternion();
    return {
      gruppe: g, trefferPunkt: new THREE.Vector3(0, 0, 5),
      update(st) {
        const { w, zeit, dt } = st, ph = st.phase * Math.PI * 2;
        const a = kf(st.p, KEYS);
        const atmen = Math.sin(zeit * 1.4);
        torso.position.y = 1.75 + w.idle * atmen * 0.04 + w.walk * Math.abs(Math.sin(ph)) * 0.08;
        torso.rotation.x = -a.aufbaeum;
        torso.rotation.z = w.walk * Math.sin(ph) * 0.04;
        // Hals: S-Kurve nach oben, Kopf bleibt waagerecht
        const hb = halsB;
        hb[1].rotation.x = -0.65 + a.hals + w.idle * atmen * 0.03;
        hb[2].rotation.x = -0.2 + a.hals * 0.6;
        hb[3].rotation.x = 0.7 + a.kopf - a.hals * 0.5;
        hb.forEach((b, i) => { if (i) b.rotation.y = Math.sin(zeit * 0.8 - i * 0.5) * 0.08 * w.idle + Math.sin(ph - i) * 0.05 * w.walk; });
        // Schwanz peitscht
        schwB.forEach((b, i) => {
          if (!i) return;
          b.rotation.y = Math.sin(zeit * 1.6 - i * 0.7) * (0.12 + i * 0.03) * (w.idle + w.walk * 1.5);
          b.rotation.x = i === 1 ? -0.22 : -0.05;
        });
        kiefer.rotation.x = a.maul * 0.7 + w.idle * Math.max(0, Math.sin(zeit * 0.6)) ** 6 * 0.3;
        for (const b of beine) {
          const p = (st.phase + b.ph) * Math.PI * 2;
          b.h.rotation.x = -w.walk * Math.sin(p) * 0.55 + (b.hinten ? 0.15 : -0.1) + a.aufbaeum * (b.hinten ? 0.3 : -0.6);
          b.k.rotation.x = (b.hinten ? -0.3 : 0.25) + w.walk * Math.max(0, Math.cos(p)) * (b.hinten ? -0.6 : 0.6);
        }
        for (const { f, s } of fluegel) {
          f.rotation.z = s * (0.35 + Math.sin(zeit * (1.2 + w.walk * 2)) * (0.12 + w.walk * 0.25) + a.fl);
          f.rotation.y = -s * (0.2 - a.fl * 0.4);
        }
        // Feueratem aus dem Maul in Blickrichtung
        if (a.feuer > 0.5) {
          maul.getWorldPosition(tmp); g.worldToLocal(tmp);
          kopf.getWorldQuaternion(q); dir.set(0, -0.25, 1).applyQuaternion(q).normalize();
          for (let i = 0; i < 12; i++) {
            const v = 7 + Math.random() * 3;
            feuer.emit(tmp, { x: dir.x * v + (Math.random() - .5) * 1.5, y: dir.y * v + (Math.random() - .5) * 1.5, z: dir.z * v + (Math.random() - .5) * 1.5 }, 0.5 + Math.random() * 0.3, 0.35, Math.random() < .3 ? 0xffffa0 : 0xffa020, 0x801000);
          }
          flamme.position.copy(tmp).addScaledVector(dir, 2); flamme.intensity = 25;
        } else flamme.intensity *= 0.85;
        feuer.update(dt, { grav: -1.5, drag: 1.2, wachsen: 3 });
        // Partikel am Boden abprallen lassen
        for (let i = 0; i < feuer.n; i++) if (feuer.pos[i * 3 + 1] < 0.2) { feuer.pos[i * 3 + 1] = 0.2; feuer.vel[i * 3 + 1] *= -0.3; }
      },
    };
  },
};
