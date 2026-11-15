/**
 * @modul    grosszauber-sturm-ansicht
 * @zweck    Ansicht des Zyklons: zwei ineinanderliegende Trichter-Röhren mit scrollender Streifen-Textur, drehende Wolkenscheibe, spiralförmig aufsteigende Staub-/Trümmer-Punkte samt Bodenring, Blitze als Zickzack-Linien
 * @api      createSturmAnsicht(daten, umgebung) -> { objekt, update(dt,daten,zeit), dispose() }
 * @beispiel
 *   import { createSturmAnsicht } from '../../engine/render/grosszauber-sturm.js';
 *   const bilder = createGrosszauberMesh({ arten: { sturm: createSturmAnsicht }, welt });
 * @tags     zauber, großzauber, sturm, tornado, wind, blitz, wolken, shader, episch, render, handy
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 *
 * daten (aus gameplay/grosszauber-sturm): { pos, fuss, oben, hoehe, drehung, alter, wachs, blitze [{ punkte, alter }] }
 * 5 Draw-Calls: 2 Röhren, Wolke, Punkte (Staub + Bodenring), Blitz-Linien. Keine Schatten, alles aus festen Pools.
 */
import { rng } from '../core/rng.js';
import * as THREE from 'three';

const VERT = `
uniform float uR0, uR1, uH, uTime, uWiegen;
varying vec2 vUv;
void main() {
  vUv = uv;
  float y = position.y;                         // 0 … 1
  float r = uR0 + (uR1 - uR0) * pow(y, 1.7);
  vec3 p = vec3(position.x * r, y * uH, position.z * r);
  p.x += sin(y * 4.0 + uTime * 0.9) * uWiegen * y * y;
  p.z += cos(y * 3.2 + uTime * 0.7) * uWiegen * y * y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const FRAG = `
uniform float uTime, uAlpha, uDicht, uSpin;
uniform vec3 uFarbe;
varying vec2 vUv;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float a = vUv.x * 6.2832;
  vec2 q = vec2(vUv.x * 9.0 + vUv.y * 5.0 - uTime * uSpin, vUv.y * 7.0 - uTime * 1.6);
  q.x = mod(q.x, 9.0);
  float s = n(q * vec2(1.0, 1.0)) * 0.6 + n(q * 2.3 + 7.0) * 0.4;
  float streif = smoothstep(0.3, 0.8, s);
  float kante = smoothstep(0.0, 0.08, vUv.y) * (1.0 - smoothstep(0.82, 1.0, vUv.y));
  vec3 c = mix(uFarbe * 0.45, uFarbe * 1.25, streif);
  c = mix(c, vec3(0.8, 0.9, 1.0), pow(streif, 6.0) * 0.35);
  gl_FragColor = vec4(c, (uDicht + streif * 0.55) * kante * uAlpha);
}`;
const WOLKE_F = `
uniform float uTime, uAlpha; varying vec2 vUv;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 p = vUv * 2.0 - 1.0; float r = length(p);
  float w = atan(p.y, p.x) + r * 3.0 - uTime * 0.5;
  float d = n(vec2(w * 2.2, r * 5.0)) * 0.6 + n(vec2(w * 5.0, r * 11.0 - uTime)) * 0.4;
  float rand = 1.0 - smoothstep(0.55, 1.0, r + (d - 0.5) * 0.35);
  float kern = smoothstep(0.0, 0.5, r);
  vec3 c = mix(vec3(0.05, 0.06, 0.09), vec3(0.28, 0.32, 0.4), d * kern);
  gl_FragColor = vec4(c, rand * uAlpha * (0.75 + d * 0.25));
}`;

function roehre(farbe, additiv, dicht, spin) {
  const g = new THREE.CylinderGeometry(1, 1, 1, 28, 14, true);
  g.translate(0, 0.5, 0);
  const m = new THREE.ShaderMaterial({
    uniforms: { uR0: { value: 4 }, uR1: { value: 14 }, uH: { value: 28 }, uTime: { value: 0 }, uWiegen: { value: 2 }, uAlpha: { value: 0 }, uDicht: { value: dicht }, uSpin: { value: spin }, uFarbe: { value: new THREE.Color(farbe) } },
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: additiv ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const o = new THREE.Mesh(g, m); o.frustumCulled = false; o.renderOrder = 3;
  return o;
}

export function createSturmAnsicht(daten0, umgebung = {}) {
  const gruppe = new THREE.Group();
  const aussen = roehre(0x8fa3bd, false, 0.12, 1.4), innen = roehre(0x2a3140, false, 0.3, -2.2);
  gruppe.add(aussen, innen);

  const wolkeM = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } }, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: WOLKE_F, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const wolke = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), wolkeM); wolke.frustumCulled = false; wolke.renderOrder = 2;
  gruppe.add(wolke);

  // Punkte: Staub/Trümmer (spiralförmig) + Bodenring
  const N = 420, M = 140, GES = N + M;
  const pos = new Float32Array(GES * 3), ph = new Float32Array(GES * 4);   // phase, höhe, tempo, radiusFaktor
  const zuf = umgebung.zufall || rng(1);
  for (let i = 0; i < GES; i++) { ph[i * 4] = zuf() * 6.283; ph[i * 4 + 1] = zuf(); ph[i * 4 + 2] = 0.5 + zuf(); ph[i * 4 + 3] = 0.6 + zuf() * 0.7; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const tex = new THREE.DataTexture(new Uint8Array(Array.from({ length: 256 }, (_, i) => { const x = (i % 16) - 7.5, y = (i >> 4) - 7.5; return Math.max(0, 255 - Math.hypot(x, y) * 34); }).flatMap(v => [150, 140, 125, v])), 16, 16, THREE.RGBAFormat);
  tex.needsUpdate = true;
  const pm = new THREE.PointsMaterial({ size: 1.6, map: tex, transparent: true, depthWrite: false, opacity: 0.8, sizeAttenuation: true });
  const punkte = new THREE.Points(pg, pm); punkte.frustumCulled = false; punkte.renderOrder = 4;
  gruppe.add(punkte);

  // Blitze: 4 Plätze à 7 Segmente
  const SEG = 7, PLAETZE = 4, lp = new Float32Array(PLAETZE * SEG * 6);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  const lm = new THREE.LineBasicMaterial({ color: 0xe8f4ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const linien = new THREE.LineSegments(lg, lm); linien.frustumCulled = false; linien.renderOrder = 5;
  gruppe.add(linien);
  const platz = new Array(PLAETZE).fill(null);

  function update(dt, d, zeit) {
    gruppe.position.set(d.pos.x, d.pos.y, d.pos.z);
    const w = d.wachs, H = Math.max(0.01, d.hoehe), spaet = d.phase === 'aufloesen';
    const wieg = 2.2 * w;
    for (const [o, f, a] of [[aussen, 1, 0.85], [innen, 0.55, 0.9]]) {
      const u = o.material.uniforms;
      u.uR0.value = d.fuss * f * (0.4 + 0.6 * w); u.uR1.value = d.oben * f * (0.5 + 0.5 * w); u.uH.value = H;
      u.uTime.value = zeit; u.uWiegen.value = wieg * f; u.uAlpha.value = a * Math.min(1, w * 1.5);
    }
    // Wolke senkt sich beim Formen und liegt oben auf dem Trichter
    wolke.position.set(Math.sin(1.0 * 4 + zeit * 0.9) * wieg, H + (1 - w) * 8, Math.cos(3.2 + zeit * 0.7) * wieg);
    wolke.scale.setScalar(d.oben * 1.9 * (0.4 + 0.6 * w));
    wolkeM.uniforms.uTime.value = zeit; wolkeM.uniforms.uAlpha.value = Math.min(1, w * 2) * 0.95;
    // Punkte
    for (let i = 0; i < GES; i++) {
      const j = i * 4;
      if (i < N) {
        ph[j + 1] = (ph[j + 1] + dt * 0.12 * ph[j + 2]) % 1;
        const y = ph[j + 1], r = (d.fuss + (d.oben - d.fuss) * Math.pow(y, 1.7)) * ph[j + 3] * 1.05, a = ph[j] + d.drehung * (1.4 - y * 0.6) + y * 5;
        pos[i * 3] = Math.cos(a) * r + Math.sin(y * 4 + zeit * 0.9) * wieg * y * y;
        pos[i * 3 + 1] = y * H * 0.85 * w;
        pos[i * 3 + 2] = Math.sin(a) * r + Math.cos(y * 3.2 + zeit * 0.7) * wieg * y * y;
      } else {
        const a = ph[j] + d.drehung * 0.9, r = (d.fuss * 1.2 + ph[j + 3] * d.oben * 0.55) * (0.3 + 0.7 * w);
        pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = 0.3 + ph[j + 1] * 2.2 * w; pos[i * 3 + 2] = Math.sin(a) * r;
      }
    }
    pg.attributes.position.needsUpdate = true;
    pm.opacity = 0.75 * Math.min(1, w * 2); pm.size = 0.5 + d.oben * 0.03;
    // Blitze
    for (const b of d.blitze || []) if (!platz.includes(b)) { const i = platz.findIndex(p => !p || p.alter >= 0.3); if (i >= 0) platz[i] = b; }
    let n = 0;
    for (let s = 0; s < PLAETZE; s++) {
      const b = platz[s]; if (!b || b.alter > 0.3 || (Math.floor(b.alter * 30) % 3 === 2)) { continue; }
      const P = b.punkte;
      for (let i = 0; i < Math.min(SEG, P.length - 1); i++) {
        const a = P[i], c = P[i + 1], k = n * 6;
        lp[k] = a.x - d.pos.x; lp[k + 1] = a.y - d.pos.y; lp[k + 2] = a.z - d.pos.z;
        lp[k + 3] = c.x - d.pos.x; lp[k + 4] = c.y - d.pos.y; lp[k + 5] = c.z - d.pos.z; n++;
      }
    }
    lg.setDrawRange(0, n * 2); lg.attributes.position.needsUpdate = true;
    lm.opacity = 1; linien.visible = n > 0;
    gruppe.visible = !(spaet && w <= 0);
  }
  return { objekt: gruppe, update, dispose() { gruppe.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); tex.dispose(); } };
}
