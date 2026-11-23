/**
 * @modul    fluss-mesh
 * @zweck    Wasserband für Flüsse/Bäche aus Proben {x,z,y,b}: 5 Punkte je Querschnitt (Rand reicht unter die Böschung → keine Lücke), Attribute `ufer` (Schaumsaum für wasser-glanz) und `lauf` (Meter flussab) für fließende Strömungs-Streifen im Shader; ein Mesh für alle Flüsse
 * @api      flussBand(proben, {rand}) -> {pos, ufer, lauf, idx} (reine Daten) ; createFlussMesh(fluesse, {farbe, opazitaet, tempo}) -> {mesh, material, update(zeit), dispose()}
 * @beispiel
 *   import { createFlussMesh } from '../../engine/world/fluss-mesh.js';
 *   const fl = createFlussMesh(karte.fluesse); szene.add(fl.mesh);   // createWasserGlanz([fl.material]) für Glitzer + Schaum
 *   // je Bild: fl.update(zeit);
 * @tags     wasser, fluss, bach, stroemung, schaum, shader, welt
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';

const QUER = [-1, -0.55, 0, 0.55, 1];   // Querschnitt: Rand … Mitte … Rand

/** Reine Geometrie-Daten eines Bandes. rand = Meter, die das Wasser über die halbe Breite b hinaus unter die Böschung reicht. */
export function flussBand(proben, { rand = 0.8 } = {}) {
  const n = proben.length, Q = QUER.length;
  const pos = new Float32Array(n * Q * 3), ufer = new Float32Array(n * Q), lauf = new Float32Array(n * Q), idx = [];
  let s = 0;
  for (let i = 0; i < n; i++) {
    const q = proben[i], a = proben[Math.max(0, i - 1)], b = proben[Math.min(n - 1, i + 1)];
    if (i > 0) s += Math.hypot(q.x - a.x, q.z - a.z);
    const l = Math.hypot(b.x - a.x, b.z - a.z) || 1, nx = -(b.z - a.z) / l, nz = (b.x - a.x) / l, w = q.b + rand;
    QUER.forEach((t, k) => {
      const v = i * Q + k;
      pos[v * 3] = q.x + nx * w * t; pos[v * 3 + 1] = q.y; pos[v * 3 + 2] = q.z + nz * w * t;
      ufer[v] = Math.abs(t) ** 1.5; lauf[v] = s;
    });
    if (i < n - 1) for (let k = 0; k < Q - 1; k++) {
      const p = i * Q + k, r = p + Q;
      idx.push(p, p + 1, r, p + 1, r + 1, r);   // gegen den Uhrzeigersinn von oben → Vorderseite oben
    }
  }
  return { pos, ufer, lauf, idx };
}

// `ufer` deklariert wasser-glanz selbst (GLANZ_UFER), sonst wir
const VERT_KOPF = 'attribute float lauf;\nvarying float vLauf;\nvarying float vUferS;\n#ifndef GLANZ_UFER\nattribute float ufer;\n#endif\n';
const FRAG_KOPF = 'varying float vLauf;\nvarying float vUferS;\nuniform float uStromZeit;\n';
const FRAG = `#include <color_fragment>
  {
    float st = vLauf * 0.55 - uStromZeit * 1.6;
    float a = sin(st + sin(vLauf * 0.13) * 2.0) * 0.5 + 0.5, b = sin(st * 1.7 + 1.3 + vUferS * 4.0) * 0.5 + 0.5;
    diffuseColor.rgb *= 0.92 + 0.16 * a * b;
    diffuseColor.rgb += vec3(0.05, 0.07, 0.07) * smoothstep(0.86, 1.0, a * b) * (1.0 - vUferS);
  }
`;

/** fluesse: [{ id, proben:[{x,z,y,b}] }] (welt-regionen v1.2). */
export function createFlussMesh(fluesse, { farbe = 0x4b6c73, opazitaet = 0.86, tempo = 1 } = {}) {
  const teile = fluesse.map((f) => flussBand(f.proben));
  let n = 0, m = 0;
  for (const t of teile) { n += t.ufer.length; m += t.idx.length; }
  const pos = new Float32Array(n * 3), ufer = new Float32Array(n), lauf = new Float32Array(n), idx = new Uint32Array(m);
  let o = 0, oi = 0;
  for (const t of teile) {
    pos.set(t.pos, o * 3); ufer.set(t.ufer, o); lauf.set(t.lauf, o);
    for (let i = 0; i < t.idx.length; i++) idx[oi + i] = t.idx[i] + o;
    o += t.ufer.length; oi += t.idx.length;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('ufer', new THREE.BufferAttribute(ufer, 1));
  geo.setAttribute('lauf', new THREE.BufferAttribute(lauf, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const nor = new Float32Array(n * 3); for (let i = 0; i < n; i++) nor[i * 3 + 1] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.computeBoundingSphere();
  const uniforms = { uStromZeit: { value: 0 } };
  const material = new THREE.MeshStandardMaterial({ color: farbe, roughness: 0.25, metalness: 0, transparent: true, opacity: opazitaet, side: THREE.DoubleSide, depthWrite: false });
  material.userData.ufer = true;   // wasser-glanz: Schaumsaum über Attribut `ufer`
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + VERT_KOPF)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vLauf = lauf; vUferS = ufer;');
    shader.fragmentShader = FRAG_KOPF + shader.fragmentShader.replace('#include <color_fragment>', FRAG);
    Object.assign(shader.uniforms, uniforms);
  };
  material.customProgramCacheKey = () => 'fluss-strom-1';
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = 'fluesse'; mesh.renderOrder = 1; mesh.frustumCulled = false; mesh.receiveShadow = true;
  return {
    mesh, material,
    update(zeit) { uniforms.uStromZeit.value = (zeit * tempo) % 10000; },
    dispose() { geo.dispose(); material.dispose(); mesh.removeFromParent(); },
  };
}
