// 5 – Phantom: eigener ShaderMaterial (Fresnel-Glühen, additiv), Vertex-Wellen für den Umhang, zerfetzter Saum per Noise-Discard.
import * as THREE from 'three';
import { kf, Partikel, GLSL_NOISE } from '../helfer.js';

export default {
  id: 'phantom', name: 'Phantom', emoji: '👻',
  stil: 'Geisterhaft · Glühend', technik: 'Custom Shader (Fresnel + Vertex-Wellen)',
  himmel: [0x05080f, 0x1a2a3a], boden: 0x2a3438, staub: 0x60e0ff, ring: 0x60f0ff,
  groesse: 4.8, tempo: 1.6, schritt: 0.5, angriffDauer: 1.1, trefferZeit: 0.5, wucht: 0.8,
  erzeuge() {
    const g = new THREE.Group();
    const U = { uZeit: { value: 0 }, uZug: { value: 0 }, uWut: { value: 0 } };
    const geistMat = (innen, rand, saum = 1) => new THREE.ShaderMaterial({
      uniforms: { ...U, uInnen: { value: new THREE.Color(innen) }, uRand: { value: new THREE.Color(rand) }, uSaum: { value: saum } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uZeit, uZug, uSaum; varying vec3 vN, vV; varying float vH; varying vec3 vP;
        void main(){
          vec3 p = position; vH = clamp((p.y + 2.6) / 4.2, 0., 1.);
          float unten = pow(1. - vH, 2.) * uSaum;
          float a = atan(p.z, p.x);
          p.xz *= 1. + unten * (.25 + .15 * sin(a * 6. + uZeit * 3.));
          p.y += unten * .25 * sin(a * 5. - uZeit * 4.);
          p.z -= unten * uZug * 1.6; p.x += unten * .2 * sin(uZeit * 1.7);
          vP = position;
          vec4 mv = modelViewMatrix * vec4(p, 1.); vV = -mv.xyz; vN = normalMatrix * normal;
          gl_Position = projectionMatrix * mv; }`,
      fragmentShader: GLSL_NOISE + `uniform float uZeit, uWut, uSaum; uniform vec3 uInnen, uRand; varying vec3 vN, vV, vP; varying float vH;
        void main(){
          float f = 1. - abs(dot(normalize(vN), normalize(vV))); f = pow(f, 1.6);
          float n = fbm(vec3(atan(vP.z, vP.x) * 2., vP.y * 2. - uZeit * 1.2, uZeit * .3));
          if (uSaum > .5 && vH < .35 && n > vH * 2.2 + .25) discard;
          float streifen = .6 + .4 * n;
          vec3 c = mix(uInnen, uRand, f) * streifen + uRand * uWut * .6;
          gl_FragColor = vec4(c, (f * .85 + .12) * smoothstep(0., .15, vH + .05)); }`,
    });
    const umhangMat = geistMat(0x0a2a3a, 0x6ff0ff);
    const handMat = geistMat(0x10303a, 0x9ff8ff, 0);
    const schwebe = new THREE.Group(); g.add(schwebe);
    // Umhang als Rotationskörper
    const profil = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, y = -2.6 + t * 4.2;
      const r = t < 0.85 ? 0.35 + Math.pow(1 - t, 0.8) * 0.95 + Math.sin(t * 9) * 0.04 : 0.95 * Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.85) / 0.16, 2))) * 0.85 + 0.01;
      profil.push(new THREE.Vector2(Math.max(0.01, r), y));
    }
    const umhang = new THREE.Mesh(new THREE.LatheGeometry(profil, 48), umhangMat);
    umhang.position.y = 0; schwebe.add(umhang);
    // Kapuze und dunkles Gesicht mit Augen
    const kapuze = new THREE.Mesh(new THREE.SphereGeometry(0.75, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.7), handMat);
    kapuze.position.set(0, 1.25, 0.05); kapuze.rotation.x = 0.35; schwebe.add(kapuze);
    const gesicht = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.85 }));
    gesicht.position.set(0, 1.15, 0.62); schwebe.add(gesicht);
    const augeTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
      const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, '#fff'); gr.addColorStop(0.25, '#7ff'); gr.addColorStop(1, 'rgba(0,255,255,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
    })();
    const augen = [-1, 1].map(s => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: augeTex, blending: THREE.AdditiveBlending, depthWrite: false, color: 0x9fffff }));
      sp.position.set(s * 0.17, 1.2, 0.68); sp.scale.setScalar(0.35); schwebe.add(sp); return sp;
    });
    // Schwebende Klauenhände
    const haende = [-1, 1].map(s => {
      const h = new THREE.Group(); schwebe.add(h);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), handMat); ball.scale.set(1, 0.8, 1.1); h.add(ball);
      for (let i = 0; i < 4; i++) {
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.65, 6), handMat);
        f.position.set((i - 1.5) * 0.12, -0.05, 0.38); f.rotation.x = Math.PI / 2 + 0.3; h.add(f);
      }
      return { h, s };
    });
    // Schein auf dem Boden + umherziehende Seelen
    const schein = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32), new THREE.MeshBasicMaterial({ map: augeTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0x2a8090 }));
    schein.rotation.x = -Math.PI / 2; schein.position.y = 0.02; g.add(schein);
    const seelen = new Partikel(240); g.add(seelen.obj);
    const spur = new Partikel(200); g.add(spur.obj);

    const KEYS = [
      [0, {}],
      [0.38, { aus: 1, wut: 0.6, neig: -0.2 }],
      [0.5, { aus: -1, wut: 1.2, neig: 0.35, vor: 0.8 }],
      [0.65, { aus: -1, wut: 0.8, neig: 0.3, vor: 0.8 }],
      [1, {}],
    ];
    const tmp = new THREE.Vector3();
    return {
      gruppe: g, trefferPunkt: new THREE.Vector3(0, 0, 2.4),
      update(st) {
        const { w, zeit, dt } = st;
        const a = kf(st.p, KEYS);
        U.uZeit.value = zeit; U.uZug.value = w.walk * 0.6 + (a.vor || 0) * 0.3; U.uWut.value = a.wut;
        schwebe.position.y = 2.9 + Math.sin(zeit * 1.5) * 0.18;
        schwebe.position.z = (a.vor || 0) * 0.6;
        schwebe.rotation.x = w.walk * 0.22 + a.neig;
        schwebe.rotation.z = Math.sin(zeit * 0.9) * 0.05;
        augen.forEach(e => e.scale.setScalar(0.32 + a.wut * 0.25 + Math.sin(zeit * 7) * 0.02));
        for (const { h, s } of haende) {
          const sw = Math.sin(zeit * 1.3 + s) * 0.12;
          // Ausholen: Hände weit seitlich/hinten; Schlag: Kreuzen vor dem Körper
          const aus = a.aus;
          h.position.set(s * (1.35 + Math.max(0, aus) * 0.6 - Math.max(0, -aus) * 1.2), 0.25 + sw + w.walk * -0.2 + Math.max(0, aus) * 0.8 - Math.max(0, -aus) * 0.9, 0.5 + w.walk * -0.3 - Math.max(0, aus) * 0.6 + Math.max(0, -aus) * 1.5);
          h.rotation.set(-0.3 + Math.max(0, -aus) * 0.8, -s * (0.3 + Math.max(0, -aus) * 0.5), 0);
          if (st.p > 0.4 && st.p < 0.6) { h.getWorldPosition(tmp); g.worldToLocal(tmp); spur.emit(tmp, { x: 0, y: 0, z: 0 }, 0.4, 0.35, 0xbfffff, 0x0060a0); }
        }
        schein.material.opacity = 0.7 + Math.sin(zeit * 1.5) * 0.2;
        if (Math.random() < 0.5) {
          const an = Math.random() * 6.28, r = 1 + Math.random() * 1.5;
          seelen.emit({ x: Math.cos(an) * r, y: 0.5 + Math.random() * 2, z: Math.sin(an) * r }, { x: -Math.sin(an) * 0.8, y: 0.4, z: Math.cos(an) * 0.8 - w.walk * 1.6 }, 2.5, 0.18, 0x9fffff, 0x204060);
        }
        seelen.update(dt, { drag: 0.2 }); spur.update(dt, { wachsen: -0.5 });
      },
    };
  },
};
