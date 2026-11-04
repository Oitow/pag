// 7 – Kriegsmech: Hard-Surface aus Primitiven, PBR-Metall mit Umgebungs-Reflexion, Rückwärtsknie per IK, Gatling-Arme mit Mündungsfeuer.
import * as THREE from 'three';
import { kf, ik2, zwischen, Partikel } from '../helfer.js';

export default {
  id: 'mech', name: 'Kriegsmech', emoji: '🤖',
  stil: 'Hard-Surface · PBR-Metall', technik: 'Hierarchie + IK + Env-Reflexion',
  himmel: [0x8a9aa8, 0xd8d0c0], boden: 0x8a8578, staub: 0x8a8070, ring: 0xffd040,
  groesse: 5.2, tempo: 2.6, schritt: 0.7, angriffDauer: 1.6, trefferZeit: 0.4, wucht: 0.7,
  erzeuge() {
    const g = new THREE.Group();
    const stahl = new THREE.MeshStandardMaterial({ color: 0x9aa2aa, metalness: 0.9, roughness: 0.32 });
    const dunkel = new THREE.MeshStandardMaterial({ color: 0x2a2e33, metalness: 0.8, roughness: 0.45 });
    const c = document.createElement('canvas'); c.width = 128; c.height = 32;
    const x = c.getContext('2d'); x.fillStyle = '#e8b020'; x.fillRect(0, 0, 128, 32); x.fillStyle = '#1a1a1a';
    for (let i = -32; i < 128; i += 24) { x.beginPath(); x.moveTo(i, 32); x.lineTo(i + 12, 32); x.lineTo(i + 44, 0); x.lineTo(i + 32, 0); x.fill(); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const warn = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.3, roughness: 0.5 });
    const lack = new THREE.MeshStandardMaterial({ color: 0xd8a020, metalness: 0.4, roughness: 0.4 });
    const visier = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x30e0ff, emissiveIntensity: 2.2 });
    const box = (w, h, d, mat, p, px = 0, py = 0, pz = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(px, py, pz); m.castShadow = true; p.add(m); return m; };
    const zyl = (r, h, mat, p, seg = 16) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); m.castShadow = true; p.add(m); return m; };

    const becken = new THREE.Group(); g.add(becken);
    box(1.6, 0.5, 1.0, dunkel, becken);
    const torso = new THREE.Group(); torso.position.y = 0.35; becken.add(torso);
    box(2.4, 1.3, 1.8, stahl, torso, 0, 0.75, 0);
    box(2.0, 0.6, 1.2, lack, torso, 0, 1.55, -0.1);
    box(1.6, 0.35, 0.1, visier, torso, 0, 1.0, 0.92);
    box(2.42, 0.25, 1.0, warn, torso, 0, 0.15, 0.4);
    for (const s of [-1, 1]) box(0.3, 0.5, 0.3, dunkel, torso, s * 0.9, 0.4, 0.95);
    // Raketenwerfer auf der Schulter
    const werfer = new THREE.Group(); werfer.position.set(-0.75, 2.05, -0.2); torso.add(werfer);
    box(0.9, 0.6, 1.0, lack, werfer);
    for (let i = 0; i < 6; i++) { const r = zyl(0.09, 0.05, dunkel, werfer, 8); r.rotation.x = Math.PI / 2; r.position.set(-0.27 + (i % 3) * 0.27, -0.12 + Math.floor(i / 3) * 0.25, 0.51); }
    const antenne = zyl(0.03, 1.2, dunkel, torso, 6); antenne.position.set(0.8, 2.3, -0.5);
    const blink = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 })); blink.position.set(0.8, 2.92, -0.5); torso.add(blink);
    // Gatling-Arme
    const arme = [-1, 1].map(s => {
      const sch = new THREE.Group(); sch.position.set(s * 1.45, 1.0, 0); torso.add(sch);
      zyl(0.4, 0.5, dunkel, sch).rotation.z = Math.PI / 2;
      const arm = new THREE.Group(); arm.position.set(s * 0.45, -0.1, 0); sch.add(arm);
      box(0.6, 0.6, 1.4, stahl, arm, 0, 0, 0.4);
      box(0.62, 0.15, 1.0, warn, arm, 0, 0.3, 0.3);
      const lauf = new THREE.Group(); lauf.position.set(0, 0, 1.2); arm.add(lauf);
      for (let i = 0; i < 6; i++) { const r = zyl(0.06, 1.2, dunkel, lauf, 8); r.rotation.x = Math.PI / 2; const an = i / 6 * Math.PI * 2; r.position.set(Math.cos(an) * 0.17, Math.sin(an) * 0.17, 0.6); }
      zyl(0.28, 0.15, stahl, lauf).rotation.x = Math.PI / 2;
      const muendung = new THREE.Object3D(); muendung.position.z = 1.3; lauf.add(muendung);
      const blitz = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.9, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      blitz.rotation.x = -Math.PI / 2; blitz.position.z = 1.7; lauf.add(blitz);
      return { sch, arm, lauf, muendung, blitz, s };
    });
    const licht = new THREE.PointLight(0xffc060, 0, 8); g.add(licht);
    // Beine: Hüfte → Knie (zeigt nach hinten) → Fuß
    const OBER = 1.5, UNTER = 1.7;
    const zylG = new THREE.CylinderGeometry(0.2, 0.2, 1, 10);
    const beine = [-1, 1].map(s => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1, 0.5), stahl); o.castShadow = true; g.add(o);
      const u = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1, 0.4), lack); u.castShadow = true; g.add(u);
      const kolben = new THREE.Mesh(zylG, dunkel); kolben.castShadow = true; g.add(kolben);
      const knie = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), dunkel); g.add(knie);
      const fuss = new THREE.Group(); g.add(fuss);
      box(0.7, 0.2, 1.1, dunkel, fuss, 0, 0.1, 0.25); box(0.5, 0.18, 0.4, stahl, fuss, 0, 0.1, -0.35);
      return { s, o, u, kolben, knie, fuss, h: new THREE.Vector3(), k: new THREE.Vector3(), f: new THREE.Vector3(), versatz: s > 0 ? 0 : 0.5 };
    });
    const huelsen = new Partikel(150, { additiv: false, weich: false }); g.add(huelsen.obj);
    const kugeln = new Partikel(150); g.add(kugeln.obj);
    const pole = new THREE.Vector3(), tmp = new THREE.Vector3(), q = new THREE.Quaternion(), dir = new THREE.Vector3();
    let drehung = 0;
    const KEYS = [
      [0, {}],
      [0.25, { ziel: 1, drehen: 0.4 }],
      [0.35, { ziel: 1, drehen: 1, feuer: 1 }],
      [0.82, { ziel: 1, drehen: 1, feuer: 1 }],
      [1, {}],
    ];
    return {
      gruppe: g, trefferPunkt: new THREE.Vector3(0, 0, 5.5),
      update(st) {
        const { w, zeit, dt } = st, ph = st.phase * Math.PI * 2;
        const a = kf(st.p, KEYS);
        const stampf = Math.pow(Math.abs(Math.cos(ph)), 3);
        becken.position.y = 2.75 + w.idle * Math.sin(zeit * 1.2) * 0.03 - w.walk * (0.15 + stampf * 0.15) - a.ziel * 0.2;
        becken.position.x = w.walk * Math.sin(ph) * 0.12;
        becken.rotation.z = w.walk * Math.sin(ph) * 0.05;
        torso.rotation.y = w.idle * Math.sin(zeit * 0.4) * 0.25 + w.walk * Math.sin(ph) * -0.08;
        torso.rotation.x = w.walk * 0.06 + a.ziel * 0.05 + (a.feuer ? Math.sin(zeit * 60) * 0.008 : 0);
        blink.visible = Math.sin(zeit * 6) > 0;
        drehung += dt * (1 + a.drehen * 30);
        for (const r of arme) {
          r.sch.rotation.x = -0.25 + w.walk * Math.sin(ph + (r.s > 0 ? Math.PI : 0)) * 0.12 - a.ziel * 0.15 + w.idle * 0.15;
          r.arm.rotation.y = -r.s * a.ziel * 0.08;
          r.lauf.rotation.z = drehung * r.s;
          const an = a.feuer > 0.5 && Math.random() < 0.7;
          r.blitz.visible = an; r.blitz.scale.setScalar(0.7 + Math.random() * 0.6);
          r.arm.position.z = an ? -0.08 : 0;
          if (an) {
            r.muendung.getWorldPosition(tmp); g.worldToLocal(tmp);
            r.lauf.getWorldQuaternion(q); dir.set(0, 0, 1).applyQuaternion(q);
            kugeln.emit(tmp, { x: dir.x * 40, y: dir.y * 40, z: dir.z * 40 }, 0.18, 0.15, 0xffff80, 0xff8020);
            huelsen.emit(tmp.addScaledVector(dir, -1.2), { x: r.s * (2 + Math.random()), y: 3 + Math.random() * 2, z: (Math.random() - .5) }, 1.2, 0.07, 0xd8a040);
            licht.position.copy(tmp); licht.intensity = 30;
          }
        }
        if (a.feuer < 0.5) licht.intensity *= 0.8;
        becken.updateMatrixWorld(true);
        for (const b of beine) {
          b.h.set(b.s * 0.75, -0.15, 0).applyMatrix4(becken.matrix);
          const u = (st.phase + b.versatz) % 1, SCH = 1.9;
          let dz, dy = 0;
          if (u < 0.5) dz = SCH / 2 - SCH * u / 0.5;
          else { const t = (u - 0.5) / 0.5; dz = -SCH / 2 + SCH * t; dy = Math.sin(t * Math.PI) * 0.55; }
          b.f.set(b.s * 0.95, dy * w.walk, 0.1 + dz * w.walk + a.ziel * (b.s > 0 ? 0.5 : -0.4));
          pole.set(0, 0.3, -1);
          ik2(b.h, b.f, OBER, UNTER, pole, b.k);
          zwischen(b.o, b.h, b.k); zwischen(b.u, b.k, b.f.clone().setY(b.f.y + 0.2));
          b.o.scale.x = b.o.scale.z = 1; b.u.scale.x = b.u.scale.z = 1;
          b.knie.position.copy(b.k);
          zwischen(b.kolben, tmp.copy(b.h).add({ x: 0, y: 0, z: 0.35 }), b.k.clone().lerp(b.f, 0.5), 0.6);
          b.fuss.position.copy(b.f);
          b.fuss.rotation.x = u >= 0.5 ? -Math.sin((u - 0.5) / 0.5 * Math.PI) * 0.4 * w.walk : 0;
        }
        kugeln.update(dt, { fade: 0 });
        huelsen.update(dt, { grav: 12, fade: 0 });
        for (let i = 0; i < huelsen.n; i++) if (huelsen.pos[i * 3 + 1] < 0.05) { huelsen.pos[i * 3 + 1] = 0.05; huelsen.vel[i * 3 + 1] *= -0.4; huelsen.vel[i * 3] *= 0.6; huelsen.vel[i * 3 + 2] *= 0.6; }
      },
    };
  },
};
