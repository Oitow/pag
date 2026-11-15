/**
 * @modul    grosszauber-welle-ansicht
 * @zweck    Ansicht der Flutwelle: gebogenes, verformtes Wellen-Gitter mit überrollendem Kamm, Schaumkrone und Fresnel-Rand, Gischt als Punkte, auslaufende Flutfläche – 3 Draw-Calls, ~3500 Dreiecke, keine Schatten
 * @api      createWelleAnsicht(daten, umgebung) -> { objekt, update(dt,daten,zeit), dispose() }
 * @beispiel
 *   import { createWelleAnsicht } from '../../engine/render/grosszauber-welle.js';
 *   const bilder = createGrosszauberMesh({ arten: { welle: createWelleAnsicht }, welt: adapter });
 * @tags     zauber, großzauber, welle, wasser, flut, episch, shader, gischt, render, mobil
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 *
 * daten stammen aus gameplay/grosszauber-welle (phase, mitte, yaw, breite, hoehe, kruemmung, strecke, flut, tiefe).
 * Wurzel steht am Start der Front (y = 0), lokal +z = Laufrichtung; alle Höhen sind absolut (Gelände aus umgebung.welt.bodenHoehe).
 */
import * as THREE from 'three';

const NX = 56, NV = 22, NFX = 18, NFZ = 28, MAXG = 360;
const VERT = `varying vec3 vP; varying vec2 vF; varying float vW; attribute vec2 aF;
void main(){ vF = aF; vec4 w = modelMatrix * vec4(position,1.0); vW = w.y; vec4 m = viewMatrix * w; vP = m.xyz; gl_Position = projectionMatrix * m; }`;
const FRAG_WELLE = `uniform float uZeit, uAlpha; varying vec3 vP; varying vec2 vF; varying float vW;
void main(){
  vec3 n = normalize(cross(dFdx(vP), dFdy(vP))); vec3 v = normalize(-vP);
  float fr = pow(1.0 - abs(dot(n, v)), 2.5);
  vec3 tief = vec3(0.03,0.27,0.52), flach = vec3(0.18,0.72,0.86);
  vec3 c = mix(tief, flach, smoothstep(0.1,0.95,vF.x) * 0.8 + fr * 0.5);
  float rau = sin(vF.y*60.0 + uZeit*5.0) * sin(vW*1.3 - uZeit*3.0) * 0.5 + 0.5;
  float schaum = smoothstep(0.78, 0.97, vF.x + (rau-0.5)*0.12) + smoothstep(0.92, 1.0, vF.y) * 0.8 * rau;
  c = mix(c, vec3(0.95,0.99,1.0), clamp(schaum,0.0,1.0));
  c += vec3(0.5,0.8,0.9) * fr * 0.35;
  gl_FragColor = vec4(c, uAlpha * clamp(0.62 + fr * 0.4 + schaum * 0.4, 0.0, 1.0));
}`;
const FRAG_FLUT = `uniform float uZeit, uAlpha; varying vec3 vP; varying vec2 vF; varying float vW;
void main(){
  float r = sin(vF.x*40.0 + uZeit*2.0) * sin(vF.y*25.0 - uZeit*1.5) * 0.5 + 0.5;
  float kante = smoothstep(0.0, 0.18, vF.y) * smoothstep(0.0, 0.18, 1.0 - vF.y);
  float vorn = smoothstep(0.93, 1.0, vF.x);
  vec3 c = mix(vec3(0.12,0.55,0.75), vec3(0.8,0.95,1.0), vorn * 0.8 + (1.0 - kante) * 0.5 + r * 0.12);
  gl_FragColor = vec4(c, uAlpha * kante * (0.42 + r * 0.18 + vorn * 0.3));
}`;
const FRAG_G = `varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float k = 1.0 - smoothstep(0.25, 0.5, length(d)); if (k < 0.02) discard; gl_FragColor = vec4(0.92,0.98,1.0, k * vA * 0.85); }`;
const VERT_G = `attribute float aA; attribute float aS; varying float vA; uniform float uPx;
void main(){ vA = aA; vec4 m = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * m; gl_PointSize = clamp(aS * uPx / max(1.0, -m.z), 2.0, 64.0); }`;

export function createWelleAnsicht(daten, umgebung = {}) {
  const welt = umgebung.welt, boden = (x, z) => (typeof welt?.bodenHoehe === 'function' ? +welt.bodenHoehe(x, z) || 0 : 0);
  const objekt = new THREE.Group(); objekt.name = 'welle'; objekt.frustumCulled = false;
  const mat = (frag, extra = {}) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uZeit: { value: 0 }, uAlpha: { value: 1 } }, ...extra });

  // Welle: NX Spalten × NV Profilpunkte
  const wPos = new Float32Array(NX * NV * 3), wF = new Float32Array(NX * NV * 2), idx = [];
  for (let i = 0; i < NX; i++) for (let j = 0; j < NV; j++) {
    wF[(i * NV + j) * 2 + 1] = j / (NV - 1);
    if (i < NX - 1 && j < NV - 1) { const a = i * NV + j, b = a + NV; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  }
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.BufferAttribute(wPos, 3).setUsage(THREE.DynamicDrawUsage));
  wg.setAttribute('aF', new THREE.BufferAttribute(wF, 2).setUsage(THREE.DynamicDrawUsage)); wg.setIndex(idx);
  const wMat = mat(FRAG_WELLE), welle = new THREE.Mesh(wg, wMat); welle.frustumCulled = false; welle.renderOrder = 3;

  // Flutfläche: NFX (Länge) × NFZ (Breite)
  const fPos = new Float32Array(NFX * NFZ * 3), fF = new Float32Array(NFX * NFZ * 2), fi = [];
  for (let i = 0; i < NFX; i++) for (let k = 0; k < NFZ; k++) {
    fF[(i * NFZ + k) * 2] = i / (NFX - 1); fF[(i * NFZ + k) * 2 + 1] = k / (NFZ - 1);
    if (i < NFX - 1 && k < NFZ - 1) { const a = i * NFZ + k, b = a + NFZ; fi.push(a, b, a + 1, b, b + 1, a + 1); }
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(fPos, 3).setUsage(THREE.DynamicDrawUsage));
  fg.setAttribute('aF', new THREE.BufferAttribute(fF, 2)); fg.setIndex(fi);
  const fMat = mat(FRAG_FLUT), flut = new THREE.Mesh(fg, fMat); flut.frustumCulled = false; flut.renderOrder = 2;

  // Gischt: Pool aus MAXG Punkten (Weltkoordinaten relativ zur Wurzel)
  const gP = new Float32Array(MAXG * 3), gA = new Float32Array(MAXG), gS = new Float32Array(MAXG), gV = new Float32Array(MAXG * 3), gL = new Float32Array(MAXG);
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.BufferAttribute(gP, 3).setUsage(THREE.DynamicDrawUsage));
  gg.setAttribute('aA', new THREE.BufferAttribute(gA, 1).setUsage(THREE.DynamicDrawUsage));
  gg.setAttribute('aS', new THREE.BufferAttribute(gS, 1));
  const gMat = new THREE.ShaderMaterial({ vertexShader: VERT_G, fragmentShader: FRAG_G, transparent: true, depthWrite: false, uniforms: { uPx: { value: 600 } } });
  const gischt = new THREE.Points(gg, gMat); gischt.frustumCulled = false; gischt.renderOrder = 4;
  let gN = 0, rest = 0, zuf = 12345;
  const zz = () => { zuf = (zuf * 1664525 + 1013904223) >>> 0; return zuf / 4294967296; };   // nur Optik, deterministisch
  objekt.add(flut, welle, gischt);
  for (let i = 0; i < MAXG; i++) gP[i * 3 + 1] = -1e4;

  function formWelle(d, zeit) {
    const H = d.hoehe, k = d.kruemmung, B = d.breite, back = Math.max(9, H * 2.4), over = H * (0.25 + 0.7 * k), z0 = d.strecke;
    const sx = Math.sin(d.yaw), cz = Math.cos(d.yaw), sx0 = d.start.x, sz0 = d.start.z;
    for (let i = 0; i < NX; i++) {
      const qn = (i / (NX - 1)) * 2 - 1, q = qn * B / 2, q4 = qn * qn * qn * qn;
      const bow = -qn * qn * H * 0.9 + Math.sin(q * 0.35 + zeit * 1.7) * 0.6;   // Mitte läuft voraus
      const hq = H * (1 - q4 * 0.7) * (1 + 0.14 * Math.sin(q * 0.6 + zeit * 2.3) + 0.07 * Math.sin(q * 1.9 - zeit * 3.1));
      for (let j = 0; j < NV; j++) {
        const v = j / (NV - 1); let f, y;
        if (v < 0.5) { const u = v * 2; f = -back + (back + over) * u; y = hq * Math.pow(u, 0.9) + 0.35 * Math.sin(u * 14 + q * 0.5 + zeit * 4) * u * (1 - u); }
        else { const w = (v - 0.5) * 2; f = over * Math.pow(1 - w, 2.2); y = hq * Math.pow(1 - w, 0.7); }
        const z = z0 + f + bow, wx = sx0 + sx * z + cz * q, wz = sz0 + cz * z - sx * q, g = boden(wx, wz);
        const o = (i * NV + j) * 3; wPos[o] = q; wPos[o + 1] = g + y + 0.05; wPos[o + 2] = z;
        wF[(i * NV + j) * 2] = H > 0.01 ? Math.min(1, y / Math.max(hq, 0.01)) : 0;
      }
    }
    wg.attributes.position.needsUpdate = true; wg.attributes.aF.needsUpdate = true;
  }

  function formFlut(d) {
    const B = d.breite * 1.05, L = Math.max(1, d.strecke + 2), sx = Math.sin(d.yaw), cz = Math.cos(d.yaw), tf = Math.max(0.25, d.tiefe * 0.7);
    for (let i = 0; i < NFX; i++) for (let k = 0; k < NFZ; k++) {
      const z = (i / (NFX - 1)) * L, q = (k / (NFZ - 1) - 0.5) * B, wx = d.start.x + sx * z + cz * q, wz = d.start.z + cz * z - sx * q;
      const o = (i * NFZ + k) * 3; fPos[o] = q; fPos[o + 1] = boden(wx, wz) + tf + 0.12; fPos[o + 2] = z;
    }
    fg.attributes.position.needsUpdate = true;
  }

  function gischtUpdate(dt, d) {
    const aktiv = d.phase === 'rollen' || d.phase === 'brechen';
    rest += dt * (aktiv ? (d.phase === 'brechen' ? 220 : 110) : 0);
    const sx = Math.sin(d.yaw), cz = Math.cos(d.yaw);
    while (rest >= 1) {
      rest -= 1; const i = gN++ % MAXG, qn = zz() * 2 - 1, q = qn * d.breite / 2, z = d.strecke - zz() * 2 - qn * qn * d.hoehe * 0.9;
      const x = d.start.x + sx * z + cz * q, zw = d.start.z + cz * z - sx * q;
      gP[i * 3] = q; gP[i * 3 + 1] = boden(x, zw) + d.hoehe * (0.75 + zz() * 0.35); gP[i * 3 + 2] = z;
      const t = 6 + zz() * 7; gV[i * 3] = (zz() - 0.5) * 4; gV[i * 3 + 1] = 2 + zz() * 5; gV[i * 3 + 2] = t; gL[i] = 1; gS[i] = 0.6 + zz() * 1.1;
    }
    for (let i = 0; i < MAXG; i++) {
      if (gL[i] <= 0) { gA[i] = 0; continue; }
      gL[i] -= dt * 0.9; gV[i * 3 + 1] -= 9 * dt;
      gP[i * 3] += gV[i * 3] * dt; gP[i * 3 + 1] += gV[i * 3 + 1] * dt; gP[i * 3 + 2] += gV[i * 3 + 2] * dt; gA[i] = Math.max(0, gL[i]);
      if (gL[i] <= 0) gP[i * 3 + 1] = -1e4;
    }
    gg.attributes.position.needsUpdate = true; gg.attributes.aA.needsUpdate = true;
  }

  function update(dt, d, zeit = 0) {
    objekt.position.set(d.start.x, 0, d.start.z); objekt.rotation.y = d.yaw;
    wMat.uniforms.uZeit.value = fMat.uniforms.uZeit.value = zeit;
    const sichtbar = d.hoehe > 0.15;
    welle.visible = sichtbar && d.phase !== 'flut';
    if (welle.visible) { wMat.uniforms.uAlpha.value = d.phase === 'aufbau' ? 0.4 + 0.6 * Math.min(1, d.hoehe / 3) : 1; formWelle(d, zeit); }
    flut.visible = d.phase !== 'aufbau' && d.flut > 0.01 && d.strecke > 1;
    if (flut.visible) { fMat.uniforms.uAlpha.value = d.flut; formFlut(d); }
    gischtUpdate(dt, d);
  }

  function dispose() { for (const g of [wg, fg, gg]) g.dispose(); for (const m of [wMat, fMat, gMat]) m.dispose(); objekt.removeFromParent(); }
  return { objekt, update, dispose };
}
