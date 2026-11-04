// 10 – Leerenauge: komplett per Raymarching im Fragment-Shader (Signed Distance Fields) – Auge, Fleischhülle,
// 6 Tentakel und Ring per Smooth-Union. Läuft in einer Box, schreibt echte Tiefe. Das Auge folgt der Kamera.
import * as THREE from 'three';
import { kf, Partikel } from '../helfer.js';

const GROESSE = 7;
export default {
  id: 'auge', name: 'Leerenauge', emoji: '👁️',
  stil: 'Kosmischer Horror', technik: 'SDF-Raymarching im Shader',
  himmel: [0x05020c, 0x2a0a3a], boden: 0x302838, staub: 0xd060ff, ring: 0xe070ff,
  groesse: 5, tempo: 1.5, schritt: 0.4, angriffDauer: 1.6, trefferZeit: 0.55, wucht: 1.2,
  erzeuge({ kamera }) {
    const g = new THREE.Group();
    const U = {
      uZeit: { value: 0 }, uCam: { value: new THREE.Vector3() }, uLook: { value: new THREE.Vector3(0, 0, 1) },
      uWalk: { value: 0 }, uSpreiz: { value: 0 }, uPeitsch: { value: 0 }, uLade: { value: 0 }, uLicht: { value: new THREE.Vector3(0.5, 0.8, 0.4).normalize() },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: U, side: THREE.BackSide, transparent: false,
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `
        uniform mat4 projectionMatrix; uniform mat4 modelViewMatrix;
        uniform float uZeit, uWalk, uSpreiz, uPeitsch, uLade; uniform vec3 uCam, uLook, uLicht; varying vec3 vP;
        float smin(float a, float b, float k){ float h = clamp(.5 + .5*(b-a)/k, 0., 1.); return mix(b, a, h) - k*h*(1.-h); }
        float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p-a, ba = b-a; float h = clamp(dot(pa,ba)/dot(ba,ba), 0., 1.); return length(pa - ba*h) - r; }
        float sdTorus(vec3 p, vec2 t){ vec2 q = vec2(length(p.xz)-t.x, p.y); return length(q)-t.y; }
        mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c,-s,s,c); }
        // Material: x = Abstand, y = 0 Fleisch, 1 Auge, 2 Ring
        vec2 karte(vec3 p){
          float auge = length(p) - 1.0;
          float sack = length(p * vec3(1., 1.05, 1.)) - 1.25;
          sack = max(sack, -(length(p - uLook * 1.25) - .78));
          float tent = 1e5;
          for (int i = 0; i < 6; i++) {
            float a = float(i) * 1.0472 + .5;
            vec3 aus = vec3(cos(a), 0., sin(a));
            vec3 senk = vec3(-sin(a), 0., cos(a));
            vec3 q = aus * .8 + vec3(0., -.7, 0.);
            float r = .3;
            for (int k = 1; k <= 5; k++) {
              float fk = float(k);
              float wl = sin(uZeit * 1.8 - fk * .9 + float(i) * 1.7);
              vec3 n = aus * (.8 + fk * (.42 + uSpreiz * .25)) + vec3(0., -.7 - fk * (.36 - uSpreiz * .3), 0.)
                     + senk * wl * .12 * fk + vec3(0., 0., -fk * fk * .06 * uWalk)
                     + vec3(0., fk * .12 * uSpreiz, fk * fk * .05 * uPeitsch);
              float r2 = .3 - fk * .05;
              tent = smin(tent, sdCap(p, q, n, r2), .12);
              q = n; r = r2;
            }
          }
          float fleisch = smin(sack, tent, .35);
          vec3 pr = p; pr.xy *= rot(.4 + sin(uZeit * .5) * .2); pr.xz *= rot(uZeit * .8);
          float ring = sdTorus(pr, vec2(1.9, .06));
          vec2 res = vec2(fleisch, 0.);
          if (auge < res.x) res = vec2(auge, 1.);
          if (ring < res.x) res = vec2(ring, 2.);
          return res;
        }
        vec3 normale(vec3 p){ vec2 e = vec2(.002, 0.); return normalize(vec3(karte(p+e.xyy).x-karte(p-e.xyy).x, karte(p+e.yxy).x-karte(p-e.yxy).x, karte(p+e.yyx).x-karte(p-e.yyx).x)); }
        vec2 box(vec3 ro, vec3 rd, vec3 b){ vec3 m = 1./rd, n = m*ro, k = abs(m)*b, t1 = -n-k, t2 = -n+k;
          return vec2(max(max(t1.x,t1.y),t1.z), min(min(t2.x,t2.y),t2.z)); }
        void main(){
          vec3 ro = uCam, rd = normalize(vP - uCam);
          vec2 tb = box(ro, rd, vec3(${(GROESSE / 2).toFixed(1)}));
          float t = max(tb.x, 0.); bool hit = false; vec2 h;
          for (int i = 0; i < 90; i++) {
            h = karte(ro + rd * t);
            if (h.x < .002) { hit = true; break; }
            t += h.x * .9; if (t > tb.y) break;
          }
          if (!hit) discard;
          vec3 p = ro + rd * t, n = normale(p);
          float dif = clamp(dot(n, uLicht), 0., 1.), rim = pow(1. - clamp(dot(n, -rd), 0., 1.), 3.);
          vec3 col;
          if (h.y < .5) {
            vec3 basis = mix(vec3(.18, .04, .22), vec3(.5, .12, .35), smoothstep(-1.5, .5, p.y));
            float adern = smoothstep(.7, 1., sin(p.x * 9. + sin(p.y * 7.) * 2.) * sin(p.z * 8. + p.y * 3.));
            col = basis * (.25 + dif * .9) + vec3(.9, .3, 1.) * rim * .9 + vec3(1., .2, .6) * adern * (.25 + uLade * .8);
            col += vec3(.9) * pow(clamp(dot(reflect(-uLicht, n), -rd), 0., 1.), 24.) * .5;
          } else if (h.y < 1.5) {
            float d = dot(normalize(p), uLook);
            float iris = smoothstep(.82, .86, d), pupille = smoothstep(.955 - uLade * .03, .965 - uLade * .03, d);
            vec3 weiss = vec3(.92, .88, .85) * (.35 + dif * .7);
            weiss = mix(weiss, vec3(.7, .1, .1), smoothstep(.3, .7, 1. - d) * .35);
            vec3 ir = mix(vec3(.9, .7, .1), vec3(1., .2, .9), d * d) * (1.2 + uLade * 2.);
            col = mix(weiss, ir, iris);
            col = mix(col, vec3(0.), pupille);
            col += vec3(1.) * pow(clamp(dot(reflect(-uLicht, n), -rd), 0., 1.), 60.);
          } else {
            col = vec3(1., .75, .3) * (.6 + dif) + vec3(1., .5, .1) * uLade;
          }
          gl_FragColor = vec4(col, 1.);
          vec4 clip = projectionMatrix * modelViewMatrix * vec4(p, 1.);
          gl_FragDepth = clip.z / clip.w * .5 + .5;
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const schwebe = new THREE.Group(); g.add(schwebe);
    const kiste = new THREE.Mesh(new THREE.BoxGeometry(GROESSE, GROESSE, GROESSE), mat);
    kiste.frustumCulled = false; schwebe.add(kiste);
    kiste.onBeforeRender = () => { U.uCam.value.copy(kiste.worldToLocal(kamera.position.clone())); };
    // Strahl beim Angriff + Bodenschein
    const strahl = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.15, 1, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xff70ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    strahl.geometry.translate(0, 0.5, 0); strahl.visible = false; g.add(strahl);
    const kern = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.06, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    kern.geometry.translate(0, 0.5, 0); strahl.add(kern);
    const schein = new THREE.Mesh(new THREE.CircleGeometry(2.5, 32), new THREE.MeshBasicMaterial({ color: 0x501070, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    schein.rotation.x = -Math.PI / 2; schein.position.y = 0.02; g.add(schein);
    const funken = new Partikel(300); g.add(funken.obj);
    const KEYS = [
      [0, {}],
      [0.4, { lade: 1, spreiz: 1, zurueck: -0.4 }],
      [0.52, { lade: 1.3, spreiz: 0.2, peitsch: 1, strahl: 1, zurueck: 0.3 }],
      [0.8, { lade: 1, spreiz: 0.2, peitsch: 1, strahl: 1, zurueck: 0.3 }],
      [1, {}],
    ];
    const ziel = new THREE.Vector3(0, 0, 4.2), tmp = new THREE.Vector3(), look = new THREE.Vector3();
    return {
      gruppe: g, trefferPunkt: ziel,
      update(st) {
        const { w, zeit, dt } = st;
        const a = kf(st.p, KEYS);
        U.uZeit.value = zeit; U.uWalk.value = w.walk; U.uSpreiz.value = a.spreiz; U.uPeitsch.value = a.peitsch; U.uLade.value = a.lade;
        schwebe.position.set(0, 3.0 + Math.sin(zeit * 1.1) * 0.2, a.zurueck);
        schwebe.rotation.x = w.walk * 0.2 - a.zurueck * 0.3;
        schwebe.rotation.z = Math.sin(zeit * 0.7) * 0.05;
        // Auge: beim Angriff aufs Ziel, sonst zur Kamera
        schwebe.updateMatrixWorld();
        if (a.lade > 0.2) look.copy(g.localToWorld(ziel.clone()));
        else look.copy(kamera.position).add(tmp.set(Math.sin(zeit * 0.7) * 2, Math.sin(zeit * 1.3) * 1, 0));
        kiste.worldToLocal(look).normalize();
        U.uLook.value.lerp(look, 0.08).normalize();
        strahl.visible = a.strahl > 0.5;
        if (strahl.visible) {
          const von = tmp.copy(U.uLook.value).multiplyScalar(1.0); kiste.localToWorld(von); g.worldToLocal(von);
          strahl.position.copy(von);
          const d = ziel.clone().sub(von);
          strahl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
          strahl.scale.set(1 + Math.sin(zeit * 50) * 0.15, d.length(), 1 + Math.sin(zeit * 50) * 0.15);
          for (let i = 0; i < 6; i++) { const an = Math.random() * 6.28, v = 2 + Math.random() * 4; funken.emit(ziel, { x: Math.cos(an) * v, y: 1 + Math.random() * 4, z: Math.sin(an) * v }, 0.6, 0.18, 0xffc0ff, 0x6010a0); }
        }
        if (Math.random() < 0.3) { const an = Math.random() * 6.28; funken.emit({ x: Math.cos(an) * 1.9, y: 3, z: Math.sin(an) * 1.9 }, { x: 0, y: 0.3, z: 0 }, 1.5, 0.1, 0xffc060, 0x401000); }
        funken.update(dt, { grav: 4, drag: 1 });
        schein.material.opacity = 0.5 + a.lade * 0.4;
      },
    };
  },
};
