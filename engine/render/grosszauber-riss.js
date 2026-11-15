/**
 * @modul    grosszauber-riss-ansicht
 * @zweck    Zeichnet den Erdriss (gameplay/grosszauber-riss): glühendes Lava-Band mit Felsrändern, gekippte Schollen, Lava-Säulen und Glut-Funken; kühlt zu dunkelrot/schwarz ab
 * @api      createRissAnsicht(daten, {welt}) -> { objekt, update(dt,daten,zeit), dispose() }
 * @beispiel
 *   import { createRissAnsicht } from '../../engine/render/grosszauber-riss.js';
 *   const bilder = createGrosszauberMesh({ arten: { riss: createRissAnsicht }, welt: adapter });
 * @tags     zauber, großzauber, render, riss, lava, glut, erdbeben, episch, shader, feuer, mobil
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 *
 * 5 Draw-Calls (Band, Schollen, Säulen, Säulenkern, Funken), ~900 Dreiecke, alles vorab angelegt (Pools), kein Zufall außer festem Hash.
 */
import { rng } from '../core/rng.js';
const zr = rng(0x5a17);   // nur Optik (Funken-Streuung)
import * as THREE from 'three';

const SPALTEN = [[-1.7, 0.0], [-1.2, 0.5], [-0.75, 0.12], [0, 0.0], [0.75, 0.12], [1.2, 0.5], [1.7, 0.0]];   // [Quer (× Breite), Höhe]
const MAX_SCHOLLEN = 90, MAX_SAEULEN = 14, MAX_FUNKEN = 260;
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

const VS = `
attribute vec2 aN; attribute vec4 aC; attribute float aS;
uniform float uAlter, uZu;
varying float vC, vT, vS, vH;
void main() {
  float auf = clamp((uAlter - aC.z) / 0.45, 0.0, 1.0) * (1.0 - uZu * uZu);
  vec3 p = position;
  p.xz += aN * aC.x * aC.w * auf;
  p.y += aC.y * auf + 0.06 - 0.25 * (1.0 - abs(aC.x) / 1.7) * auf;
  vC = aC.x / 1.7; vT = aC.z; vS = aS; vH = aC.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const FS = `
uniform float uAlter, uGlut, uZeit;
varying float vC, vT, vS, vH;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float nz(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
void main() {
  if (vT > uAlter) discard;
  float n = nz(vec2(vS * 0.7, vC * 4.0) + uZeit * 0.25 * uGlut) * 0.6 + nz(vec2(vS * 2.1, vC * 9.0) - uZeit * 0.5 * uGlut) * 0.4;
  float mitte = 1.0 - smoothstep(0.25, 0.62, abs(vC));
  float heiss = uGlut * (0.35 + 0.85 * n) * (0.55 + 0.45 * mitte) * (1.0 + 0.12 * sin(uZeit * 4.0 + vS * 0.8));
  heiss *= 1.0 - smoothstep(0.5, 0.75, abs(vC)) * 0.85;
  // dunkle Kruste in Platten, dazwischen leuchtende Adern
  float kruste = smoothstep(0.45, 0.62, nz(vec2(vS * 1.1 + 3.0, vC * 5.0)));
  float a1 = nz(vec2(vS * 1.6 + uZeit * 0.12 * uGlut, vC * 7.0)), a2 = nz(vec2(vS * 3.4 - uZeit * 0.1, vC * 15.0));
  float ader = max(1.0 - smoothstep(0.0, 0.09, abs(a1 - 0.5)), (1.0 - smoothstep(0.0, 0.07, abs(a2 - 0.5))) * 0.7);
  heiss = mix(heiss, heiss * 0.4, kruste * 0.85 * (1.0 - ader));
  heiss = max(heiss, ader * uGlut * 0.8 * (0.5 + 0.5 * mitte));
  vec3 c = vec3(0.05, 0.035, 0.03);
  c = mix(c, vec3(0.5, 0.05, 0.0), smoothstep(0.12, 0.4, heiss));
  c = mix(c, vec3(1.0, 0.36, 0.04), smoothstep(0.4, 0.8, heiss));
  c = mix(c, vec3(1.0, 0.68, 0.2), smoothstep(0.9, 1.3, heiss));    // heißester Ton bleibt orangegelb, nicht weiß
  c = mix(c, c * vec3(0.55, 0.5, 0.5), kruste * (1.0 - ader) * 0.6);
  vec3 fels = vec3(0.2, 0.15, 0.115) * (0.6 + 0.8 * n + vH * 0.5);
  c = mix(c, fels, smoothstep(0.6, 0.78, abs(vC)) * (1.0 - heiss * 0.5));
  gl_FragColor = vec4(c, 1.0);
  #include <dithering_fragment>
}`;

/** Schollen-Material: Lambert, braun mit Höhenschichten; Unterkante glüht (Glut aus uni.uGlut), unabhängig vom Licht. */
function schollenMaterial(uni) {
  const m = new THREE.MeshLambertMaterial({ color: 0xa27c58, flatShading: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uGlut = uni.uGlut;
    sh.vertexShader = 'varying vec3 vLo;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vLo = position;');
    sh.fragmentShader = 'uniform float uGlut; varying vec3 vLo;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= 0.75 + 0.35 * fract(sin(floor(vLo.y * 5.0) * 12.9898) * 43758.5);')
      .replace('#include <opaque_fragment>', 'outgoingLight += vec3(1.0, 0.36, 0.05) * smoothstep(0.0, -0.32, vLo.y) * (0.3 + 0.9 * uGlut);\n#include <opaque_fragment>');
  };
  return m;
}

export function createRissAnsicht(daten, umgebung = {}) {
  const welt = umgebung.welt, hoehe = (x, z) => (typeof welt?.bodenHoehe === 'function' ? +welt.bodenHoehe(x, z) || 0 : 0);
  const objekt = new THREE.Group(); objekt.name = 'riss';

  // ---- Band entlang aller Polylinien (einmal gebaut, Gelände-folgend)
  const pos = [], aN = [], aC = [], aS = [], idx = [];
  const schollenPos = [];
  for (const r of daten.risse) {
    const P = r.pkt, basis = pos.length / 3; let s = 0;
    for (let i = 0; i < P.length; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
      let tx = b.x - a.x, tz = b.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      if (i) s += Math.hypot(P[i].x - P[i - 1].x, P[i].z - P[i - 1].z);
      const y = hoehe(P[i].x, P[i].z);
      for (const [q, h] of SPALTEN) { pos.push(P[i].x, y, P[i].z); aN.push(tz, -tx); aC.push(q, h, P[i].t, r.breite); aS.push(s); }
      if (i) for (let k = 0; k < SPALTEN.length - 1; k++) {
        const v0 = basis + (i - 1) * SPALTEN.length + k, v1 = v0 + SPALTEN.length;
        idx.push(v0, v1, v0 + 1, v0 + 1, v1, v1 + 1);
      }
      if (i % 2 && schollenPos.length < MAX_SCHOLLEN) for (const seite of [-1, 1]) if (schollenPos.length < MAX_SCHOLLEN)
        schollenPos.push({ x: P[i].x, z: P[i].z, y, nx: tz * seite, nz: -tx * seite, br: r.breite, t: P[i].t, ast: r.ast, w: schollenPos.length });
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aN', new THREE.Float32BufferAttribute(aN, 2));
  g.setAttribute('aC', new THREE.Float32BufferAttribute(aC, 4));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(aS, 1));
  g.setIndex(idx);
  const uni = { uAlter: { value: 0 }, uZu: { value: 0 }, uGlut: { value: 1 }, uZeit: { value: 0 } };
  const bandMat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: uni, side: THREE.DoubleSide });
  const band = new THREE.Mesh(g, bandMat); band.frustumCulled = false; objekt.add(band);

  // ---- Felsschollen (gekippte Brocken am Rand)
  const fels = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.62, 0).scale(1, 0.6, 1), schollenMaterial(uni), MAX_SCHOLLEN);
  fels.count = schollenPos.length; fels.frustumCulled = false; objekt.add(fels);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sk = new THREE.Vector3();

  // ---- Lava-Säulen (additive Kegel, Pool)
  const saeulen = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.55, 1, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), MAX_SAEULEN);
  saeulen.count = 0; saeulen.frustumCulled = false; saeulen.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SAEULEN * 3), 3); objekt.add(saeulen);
  // heller Kern in der Säule (schmaler, gelblicher Kegel, gleiche Matrizen)
  const kern = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.55, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), MAX_SAEULEN);
  kern.count = 0; kern.frustumCulled = false; kern.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SAEULEN * 3), 3); objekt.add(kern);
  const col = new THREE.Color();

  // ---- Glut-Funken (Points, CPU-Simulation)
  const fp = new Float32Array(MAX_FUNKEN * 3), fv = new Float32Array(MAX_FUNKEN * 3), fl = new Float32Array(MAX_FUNKEN), fc = new Float32Array(MAX_FUNKEN * 3);
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(fp, 3)); fg.setAttribute('color', new THREE.BufferAttribute(fc, 3));
  const punkte = new THREE.Points(fg, new THREE.PointsMaterial({ size: 0.45, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  punkte.frustumCulled = false; objekt.add(punkte);
  let nf = 0, zaehler = 0, rest = 0, spawnT = 0;
  const funke = (x, y, z, vx, vy, vz, leben) => {
    const i = nf++ % MAX_FUNKEN; zaehler++;
    fp[i * 3] = x; fp[i * 3 + 1] = y; fp[i * 3 + 2] = z; fv[i * 3] = vx; fv[i * 3 + 1] = vy; fv[i * 3 + 2] = vz; fl[i] = leben;
  };

  const gesehen = new Set();
  function update(dt, d = daten, zeit = 0) {
    dt = Math.min(dt, 0.1);
    uni.uAlter.value = d.alter; uni.uZu.value = d.zu; uni.uGlut.value = d.glut; uni.uZeit.value = zeit;
    // Schollen: kippen hoch, sobald die Spitze kommt, und sacken zurück
    for (let i = 0; i < schollenPos.length; i++) {
      const s = schollenPos[i], a = d.alter - s.t, auf = Math.max(0, Math.min(1, a / 0.45)) * (1 - d.zu * d.zu);
      const kipp = a > 0 ? Math.sin(Math.min(1, a / 0.8) * Math.PI) * 0.7 + 0.35 : 0;
      const ab = s.br * (1.25 + 0.2 * hash(s.w)) * auf;
      v.set(s.x + s.nx * ab, s.y + 0.15 + 0.25 * auf + 0.9 * Math.sin(Math.min(1, a / 0.6) * Math.PI) * (a > 0 ? 1 : 0), s.z + s.nz * ab);
      e.set(s.nz * kipp, hash(s.w + 7) * 6, -s.nx * kipp); q.setFromEuler(e);
      const gr = (0.9 + hash(s.w + 3) * 1.1) * (s.ast ? 0.65 : 1) * auf;
      sk.set(gr * 1.1, gr * (0.8 + hash(s.w + 5)), gr); m4.compose(v, q, sk); fels.setMatrixAt(i, m4);
    }
    fels.instanceMatrix.needsUpdate = true;
    // Säulen
    let n = 0;
    for (const a of d.ausbrueche) {
      if (n >= MAX_SAEULEN) break;
      const u = a.t / a.dauer, h = a.hoehe * Math.sin(Math.min(1, u * 1.6) * Math.PI / 2) * (u > 0.7 ? 1 - (u - 0.7) / 0.3 * 0.6 : 1);
      const br = a.radius * (0.7 + 0.5 * (1 - u)) * (1 + 0.1 * Math.sin(zeit * 20 + n));
      v.set(a.x, hoehe(a.x, a.z) + h * 0.5, a.z); sk.set(br, Math.max(0.05, h), br); q.identity(); m4.compose(v, q, sk); saeulen.setMatrixAt(n, m4); sk.set(br * 0.7, Math.max(0.05, h * 0.92), br * 0.7); m4.compose(v, q, sk); kern.setMatrixAt(n, m4);
      col.setRGB(1, 0.36 - 0.2 * u, 0.04).multiplyScalar(1 - 0.6 * u); saeulen.setColorAt(n, col); kern.setColorAt(n, col.setRGB(1, 0.62, 0.15).multiplyScalar(1 - 0.6 * u));
      // Funken aus Ausbrüchen
      if (u < 0.6 && zaehler < 1e9) for (let k = 0; k < 2; k++) {
        const w = zr() * 6.28, r = zr() * 2.5; funke(a.x, hoehe(a.x, a.z) + h * 0.8, a.z, Math.cos(w) * r, 4 + zr() * 6, Math.sin(w) * r, 0.8 + zr() * 0.8);
      }
      n++;
    }
    saeulen.count = kern.count = n; saeulen.instanceMatrix.needsUpdate = kern.instanceMatrix.needsUpdate = true; saeulen.instanceColor.needsUpdate = kern.instanceColor.needsUpdate = true;
    // aufsteigende Glut über dem Graben
    spawnT += dt;
    if (d.glut > 0.2 && spawnT > 0.025) {
      spawnT = 0; const r = d.risse[Math.floor(zr() * d.risse.length)], i = Math.floor(zr() * r.pkt.length), p = r.pkt[i];
      if (p.t < d.alter) funke(p.x + (zr() - 0.5) * r.breite, hoehe(p.x, p.z) + 0.2, p.z + (zr() - 0.5) * r.breite, 0, 1.5 + zr() * 2, 0, 1 + zr());
    }
    for (let i = 0; i < MAX_FUNKEN; i++) {
      if (fl[i] <= 0) { fc[i * 3] = fc[i * 3 + 1] = fc[i * 3 + 2] = 0; continue; }
      fl[i] -= dt; fv[i * 3 + 1] -= 9 * dt;
      fp[i * 3] += fv[i * 3] * dt; fp[i * 3 + 1] += fv[i * 3 + 1] * dt; fp[i * 3 + 2] += fv[i * 3 + 2] * dt;
      const b = Math.max(0, Math.min(1, fl[i] * 1.5)) * Math.max(0.2, d.glut);
      fc[i * 3] = b; fc[i * 3 + 1] = b * 0.5; fc[i * 3 + 2] = b * 0.1;
    }
    fg.attributes.position.needsUpdate = true; fg.attributes.color.needsUpdate = true;
  }
  update(0, daten, 0);
  return {
    objekt, update,
    dispose() { for (const o of [g, fels.geometry, saeulen.geometry, kern.geometry, fg]) o.dispose(); for (const m of [bandMat, fels.material, saeulen.material, kern.material, punkte.material]) m.dispose(); fels.dispose(); saeulen.dispose(); kern.dispose(); },
  };
}
