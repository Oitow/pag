// 9 – Uralter Baumhüter: rekursiv gewachsene Äste (L-System-artig), jede Astebene schwingt phasenversetzt, Laub-Partikel.
import * as THREE from 'three';
import { kf, rng, Partikel } from '../helfer.js';

export default {
  id: 'baum', name: 'Baumhüter', emoji: '🌳',
  stil: 'Organisch · Herbst', technik: 'Rekursive Äste + Hierarchie-Schwingen',
  himmel: [0xf0c890, 0xf8e8c8], boden: 0x9a8a50, staub: 0x8a6a3a, ring: 0xffe0a0,
  groesse: 6, tempo: 1.1, schritt: 0.45, angriffDauer: 1.7, trefferZeit: 0.5, wucht: 1.4,
  erzeuge() {
    const r = rng(42);
    const g = new THREE.Group();
    const rinde = new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.95, flatShading: true });
    const moos = new THREE.MeshStandardMaterial({ color: 0x5a7a30, roughness: 1, flatShading: true });
    const laubMats = [0xe0802a, 0xc8401a, 0xf0b030, 0x9a9a30].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true }));
    const glut = new THREE.MeshBasicMaterial({ color: 0xffc040 });
    const zylG = new THREE.CylinderGeometry(0.7, 1, 1, 7, 2); zylG.translate(0, 0.5, 0);
    const laubG = new THREE.IcosahedronGeometry(1, 0);
    const schwinger = [];
    const mesh = (geo, mat, p) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; p.add(m); return m; };
    // Ast: Pivot an der Basis, Zylinder entlang +Y, Kinder an der Spitze
    function ast(parent, laenge, radius, tiefe, laub = true) {
      const piv = new THREE.Group(); parent.add(piv);
      const m = mesh(zylG, rinde, piv); m.scale.set(radius, laenge, radius);
      schwinger.push({ piv, tiefe, ph: r() * 6.28, rx: 0, rz: 0 });
      const spitze = new THREE.Group(); spitze.position.y = laenge; piv.add(spitze);
      if (tiefe > 0) {
        const n = 2 + (r() < 0.4 ? 1 : 0);
        for (let i = 0; i < n; i++) {
          const k = ast(spitze, laenge * (0.6 + r() * 0.15), radius * 0.65, tiefe - 1, laub);
          k.rotation.set((r() - 0.5) * 1.3, i / n * Math.PI * 2 + r(), (r() - 0.5) * 1.3);
        }
      } else if (laub) {
        for (let i = 0; i < 3; i++) {
          const l = mesh(laubG, laubMats[Math.floor(r() * 4)], spitze);
          l.position.set((r() - 0.5) * 0.6, r() * 0.4, (r() - 0.5) * 0.6); l.scale.setScalar(0.35 + r() * 0.3);
        }
      }
      const s = schwinger.find(x => x.piv === piv);
      s.rx = piv.rotation.x; s.rz = piv.rotation.z;
      return piv;
    }
    // Rumpf
    const huefte = new THREE.Group(); huefte.position.y = 1.6; g.add(huefte);
    const rumpf = new THREE.Group(); huefte.add(rumpf);
    const stamm = mesh(new THREE.CylinderGeometry(0.85, 1.15, 3.2, 9, 4), rinde, rumpf); stamm.position.y = 1.5;
    // Rinde unregelmäßig machen
    { const p = stamm.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const f = 1 + (r() - 0.5) * 0.18; p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f); } stamm.geometry.computeVertexNormals(); }
    const moosK = mesh(new THREE.IcosahedronGeometry(0.9, 1), moos, rumpf); moosK.position.set(0, 3.0, -0.1); moosK.scale.set(1.1, 0.5, 1.1);
    // Gesicht: Höhlen mit glimmenden Augen
    const dunkel = new THREE.MeshBasicMaterial({ color: 0x1a0e08 });
    for (const s of [-1, 1]) {
      const h = mesh(new THREE.SphereGeometry(0.2, 8, 6), dunkel, rumpf); h.position.set(s * 0.33, 2.3, 0.82); h.scale.z = 0.4;
      const a = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), glut); a.position.set(s * 0.33, 2.3, 0.9); rumpf.add(a);
      const braue = mesh(new THREE.BoxGeometry(0.45, 0.12, 0.25), rinde, rumpf); braue.position.set(s * 0.33, 2.52, 0.86); braue.rotation.z = s * -0.3;
    }
    const mund = mesh(new THREE.SphereGeometry(0.3, 10, 6), dunkel, rumpf); mund.position.set(0, 1.75, 0.85); mund.scale.set(1.2, 0.35, 0.4);
    // Krone aus rekursiven Ästen
    const krone = new THREE.Group(); krone.position.y = 3.0; rumpf.add(krone);
    for (let i = 0; i < 4; i++) { const k = ast(krone, 1.1, 0.25, 3); k.rotation.set(-0.3 + r() * 0.6, i * 1.6, (i % 2 ? 1 : -1) * (0.4 + r() * 0.3)); }
    // Arme: dicke Äste mit Zweig-Fingern
    const arme = [-1, 1].map(s => {
      const sch = new THREE.Group(); sch.position.set(s * 0.85, 2.5, 0); rumpf.add(sch);
      const ober = new THREE.Group(); sch.add(ober);
      mesh(zylG, rinde, ober).scale.set(0.3, 1.6, 0.3);
      ober.rotation.z = -s * 2.5;
      const ell = new THREE.Group(); ell.position.y = 1.6; ober.add(ell);
      mesh(zylG, rinde, ell).scale.set(0.24, 1.5, 0.24);
      const hand = new THREE.Group(); hand.position.y = 1.5; ell.add(hand);
      for (let i = 0; i < 4; i++) {
        const f = ast(hand, 0.55, 0.1, 1, false);
        f.rotation.set(-0.6 + i * 0.4, 0, (i - 1.5) * 0.35);
      }
      const blatt = mesh(laubG, laubMats[2], ell); blatt.position.set(s * 0.2, 0.8, 0); blatt.scale.setScalar(0.35);
      return { sch, ober, ell, s };
    });
    schwinger.forEach(s => { s.rx = s.piv.rotation.x; s.rz = s.piv.rotation.z; });
    // Wurzel-Beine
    const beine = [-1, 1].map(s => {
      const h = new THREE.Group(); h.position.set(s * 0.55, 0, 0); huefte.add(h);
      mesh(zylG, rinde, h).scale.set(0.38, 1.0, 0.38); h.children[0].rotation.x = Math.PI;
      const knie = new THREE.Group(); knie.position.y = -0.95; h.add(knie);
      const u = mesh(zylG, rinde, knie); u.scale.set(0.3, 0.7, 0.3); u.rotation.x = Math.PI;
      for (let i = 0; i < 4; i++) { // Wurzel-Zehen
        const z = mesh(zylG, rinde, knie); z.scale.set(0.1, 0.7, 0.1); z.position.y = -0.6;
        z.rotation.set(Math.PI / 2 + 0.5, (i - 1.5) * 0.7 + (s > 0 ? 0 : 0), 0); z.rotation.order = 'YXZ'; z.rotation.y = (i - 1.5) * 0.6 + (i > 2 ? Math.PI : 0);
      }
      return { h, knie, s };
    });
    const blaetter = new Partikel(260, { additiv: false, weich: false }); g.add(blaetter.obj);
    const KEYS = [
      [0, {}],
      [0.36, { arm: 1.3, ell: -0.6, dreh: 0.6, lehn: -0.15 }],
      [0.5, { arm: -1.6, ell: 0.3, dreh: -0.5, lehn: 0.3, huefte: -0.2 }],
      [0.7, { arm: -1.5, ell: 0.3, dreh: -0.45, lehn: 0.3, huefte: -0.2 }],
      [1, {}],
    ];
    return {
      gruppe: g, trefferPunkt: new THREE.Vector3(-1.4, 0, 3),
      update(st) {
        const { w, zeit, dt } = st, ph = st.phase * Math.PI * 2;
        const a = kf(st.p, KEYS);
        const wind = 0.5 + w.walk * 0.6 + Math.abs(a.arm) * 0.4;
        for (const s of schwinger) {
          const k = (4 - s.tiefe) * 0.04 + 0.03;
          s.piv.rotation.x = s.rx + Math.sin(zeit * 1.4 + s.ph) * k * wind;
          s.piv.rotation.z = s.rz + Math.cos(zeit * 1.1 + s.ph) * k * wind;
        }
        huefte.position.y = 1.6 + w.idle * Math.sin(zeit * 0.9) * 0.03 + w.walk * Math.abs(Math.sin(ph)) * 0.15 + a.huefte;
        huefte.rotation.z = w.walk * Math.sin(ph) * 0.07;
        rumpf.rotation.x = w.walk * 0.08 + a.lehn + w.idle * Math.sin(zeit * 0.9) * 0.02;
        rumpf.rotation.y = w.walk * Math.sin(ph) * -0.1 + a.dreh;
        for (const b of beine) {
          const p = ph + (b.s > 0 ? 0 : Math.PI);
          b.h.rotation.x = -w.walk * Math.sin(p) * 0.45;
          b.knie.rotation.x = w.walk * Math.max(0, -Math.cos(p)) * 0.7;
        }
        for (const ar of arme) {
          const p = ph + (ar.s > 0 ? Math.PI : 0);
          const peitsche = ar.s < 0 ? 1 : 0.25;
          ar.sch.rotation.x = w.walk * Math.sin(p) * 0.4 + w.idle * Math.sin(zeit * 0.9 + ar.s) * 0.06 + a.arm * peitsche;
          ar.ober.rotation.z = -ar.s * (2.5 - (ar.s < 0 ? Math.max(0, -a.arm) * 0.6 : 0));
          ar.ell.rotation.z = -ar.s * (-0.4 + a.ell * peitsche);
          ar.ell.rotation.x = -0.3;
        }
        if (Math.random() < 0.08 + w.walk * 0.2) {
          blaetter.emit({ x: (Math.random() - .5) * 3, y: 5 + Math.random(), z: (Math.random() - .5) * 3 }, { x: 0.3, y: -0.6, z: -w.walk * 1.1 }, 4, 0.12, [0xe0802a, 0xc8401a, 0xf0b030][Math.floor(Math.random() * 3)]);
        }
        if (st.treffer) for (let i = 0; i < 50; i++) blaetter.emit({ x: -1 + (Math.random() - .5) * 2, y: 3 + Math.random() * 2, z: 1.5 + Math.random() }, { x: (Math.random() - .5) * 4, y: Math.random() * 3, z: (Math.random() - .5) * 4 }, 3, 0.14, [0xe0802a, 0xc8401a, 0xf0b030][i % 3]);
        blaetter.update(dt, { grav: 0.6, drag: 1.2, fade: 0.3 });
        for (let i = 0; i < blaetter.n; i++) { blaetter.vel[i * 3] += Math.sin(zeit * 2 + i) * dt * 2; if (blaetter.pos[i * 3 + 1] < 0.05) { blaetter.pos[i * 3 + 1] = 0.05; blaetter.vel[i * 3 + 1] = 0; blaetter.vel[i * 3] = 0; blaetter.vel[i * 3 + 2] = -w.walk * 1.1; } }
      },
    };
  },
};
