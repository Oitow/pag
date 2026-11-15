/**
 * @modul    grosszauber-wand-ansicht
 * @zweck    Ansicht des Großzaubers 'Erdwall': kantige Felspfeiler (InstancedMesh, Low-Poly, Risse + Moos), Erdwulst und Trümmer am Fuß, Staubwolke beim Aufsteigen und Zerfallen, Zittern beim Steigen
 * @api      createWandAnsicht(daten, umgebung) -> { objekt, update(dt, daten, zeit), dispose() }
 * @beispiel
 *   import { createGrosszauberMesh } from '../../engine/render/grosszauber-mesh.js';
 *   import { createWandAnsicht } from '../../engine/render/grosszauber-wand.js';
 *   const bilder = createGrosszauberMesh({ arten: { wand: createWandAnsicht }, welt: adapter });
 * @tags     zauber, großzauber, wand, fels, render, episch, instancing, staub, erdwall, handy
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 *
 * Daten aus gameplay/grosszauber-wand (segmente[{x,z,breite,dicke,hoeheZiel,hoehe,yaw,seed,zerfall}], phase).
 * Handy: 3 Draw-Calls (Pfeiler, Trümmer+Wulst, Staub), ≤ ~5500 Dreiecke bei 32 Segmenten, Staub aus festem Pool.
 */
import * as THREE from 'three';
import { rng, hashSeed, hash3 } from '../core/rng.js';

const POOL = 220;

function felsGeometrie() {
  const b = new THREE.BoxGeometry(1, 1, 1, 2, 3, 2).toNonIndexed(), p = b.attributes.position, n = p.count, f = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {   // gleiche Ecke → gleicher Versatz (Hash auf Position), also bleibt der Fels dicht
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), h = (k) => hash3(Math.round(x * 4) + k, Math.round(y * 6), Math.round(z * 4), 11) - 0.5;
    const oben = y + 0.5, kante = Math.abs(x) > 0.4 || Math.abs(z) > 0.4 ? 1 : 0.4;
    p.setXYZ(i, x * (1 - 0.18 * oben) + h(1) * 0.22 * kante, (y + 0.5) + h(2) * 0.1 * (y > 0.4 ? 1.6 : 0.3), z * (1 - 0.12 * oben) + h(3) * 0.22 * kante);
    const riss = hash3(Math.round(x * 4), Math.round(y * 6), Math.round(z * 4), 29) < 0.18, moos = y > 0.45 && hash3(Math.round(x * 4), 3, Math.round(z * 4), 31) < 0.55;
    const t = 0.6 + 0.4 * (y + 0.5), c = riss ? [0.82, 0.74, 0.62] : moos ? [0.32, 0.42, 0.2] : [0.5 * t, 0.42 * t, 0.33 * t];
    f.set(c, i * 3);
  }
  b.setAttribute('color', new THREE.BufferAttribute(f, 3));
  b.computeVertexNormals();
  return b;
}

export function createWandAnsicht(daten, umgebung = {}) {
  const segs = daten.segmente, N = segs.length, zufall = rng(hashSeed('wand', segs[0]?.seed || 1));
  const objekt = new THREE.Group(); objekt.name = 'erdwall';
  const hoeheAt = (x, z) => (typeof umgebung.welt?.bodenHoehe === 'function' ? +umgebung.welt.bodenHoehe(x, z) || 0 : 0);
  const y0 = segs.map((s) => hoeheAt(s.x, s.z));

  const stein = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  const pfeiler = new THREE.InstancedMesh(felsGeometrie(), stein, N);
  const traeger = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), stein.clone(), N * 4);
  traeger.material.vertexColors = false;
  for (const m of [pfeiler, traeger]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; objekt.add(m); }
  const farbe = new THREE.Color(), var_ = [];
  for (let i = 0; i < N; i++) {
    const v = { tx: (zufall() - 0.5) * 0.08, tz: (zufall() - 0.5) * 0.08, sb: 0.9 + zufall() * 0.2, sd: 0.85 + zufall() * 0.3, helle: 0.85 + zufall() * 0.3, rocks: [] };
    var_.push(v);
    pfeiler.setColorAt(i, farbe.setScalar(v.helle));
    traeger.setColorAt(i * 4, farbe.setRGB(0.3, 0.22, 0.14));   // Erdwulst
    for (let k = 1; k < 4; k++) {
      const seite = zufall() < 0.5 ? -1 : 1;
      v.rocks.push({ u: (zufall() - 0.5) * segs[i].breite * 1.2, v: seite * (segs[i].dicke / 2 + 0.2 + zufall() * 1.1), r: 0.35 + zufall() * 0.6, ry: zufall() * 6 });
      const g = 0.4 + zufall() * 0.2; traeger.setColorAt(i * 4 + k, farbe.setRGB(g * 1.1, g * 0.95, g * 0.8));
    }
  }
  pfeiler.instanceColor.needsUpdate = traeger.instanceColor.needsUpdate = true;

  // Staub: fester Pool, eigener Mini-Shader (weiche Scheibe mit Alpha je Teilchen)
  const pos = new Float32Array(POOL * 3), vel = new Float32Array(POOL * 3), alter = new Float32Array(POOL).fill(9), dauer = new Float32Array(POOL).fill(1);
  const aA = new Float32Array(POOL), aS = new Float32Array(POOL);
  const gs = new THREE.BufferGeometry();
  gs.setAttribute('position', new THREE.BufferAttribute(pos, 3)); gs.setAttribute('aA', new THREE.BufferAttribute(aA, 1)); gs.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
  const staubMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uSkala: { value: (typeof innerHeight === 'number' ? innerHeight : 720) * 0.5 } },
    vertexShader: 'attribute float aA; attribute float aS; varying float vA; uniform float uSkala; void main(){ vA=aA; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aS*uSkala/max(0.5,-mv.z); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'varying float vA; void main(){ float d=length(gl_PointCoord-0.5); gl_FragColor=vec4(0.62,0.52,0.4,smoothstep(0.5,0.05,d)*vA); }',
  });
  const staub = new THREE.Points(gs, staubMat); staub.frustumCulled = false; objekt.add(staub);
  let naechster = 0;
  const speie = (x, y, z, kraft) => {
    const i = naechster; naechster = (naechster + 1) % POOL;
    pos.set([x + (zufall() - 0.5) * 2, y, z + (zufall() - 0.5) * 2], i * 3);
    vel.set([(zufall() - 0.5) * 3 * kraft, 1 + zufall() * 3 * kraft, (zufall() - 0.5) * 3 * kraft], i * 3);
    alter[i] = 0; dauer[i] = 1 + zufall() * 1.4; aS[i] = 2 + zufall() * 3;
  };

  const d = new THREE.Object3D(), vorher = new Float32Array(N), vz = new Float32Array(N);
  function update(dt, dd, zeit) {
    const S = dd.segmente;
    for (let i = 0; i < N; i++) {
      const s = S[i], v = var_[i], h = s.hoehe, k = Math.min(1, h / s.hoeheZiel), steigt = dd.phase === 'steigt' && k > 0 && k < 1, bebt = s.zerfall > 0 && s.zerfall < 1;
      const zit = steigt ? Math.sin(zeit * 70 + s.seed) * 0.06 * (1 - k) : bebt ? Math.sin(zeit * 55 + s.seed) * 0.08 * s.zerfall : 0;
      d.rotation.set(v.tx + zit * 0.4, s.yaw, v.tz - zit * 0.4, 'YXZ');
      d.position.set(s.x + zit, y0[i] + h - s.hoeheZiel, s.z);
      d.scale.set(s.breite * v.sb, h > 0.01 ? s.hoeheZiel : 0, s.dicke * v.sd);
      d.updateMatrix(); pfeiler.setMatrixAt(i, d.matrix);
      const c = Math.cos(s.yaw), si = Math.sin(s.yaw), wulst = Math.min(1, k * 2.5) * (bebt ? 1 - 0.4 * s.zerfall : 1);
      d.rotation.set(0, s.yaw, 0); d.position.set(s.x, y0[i] + 0.1, s.z); d.scale.set(s.breite * 1.1 * wulst, 0.9 * wulst, (s.dicke + 1.6) * wulst);
      d.updateMatrix(); traeger.setMatrixAt(i * 4, d.matrix);
      for (let r = 0; r < 3; r++) {
        const q = v.rocks[r], a = Math.min(1, Math.max(0, (k - 0.25) * 3)) * q.r * (bebt ? 1 + 0.3 * s.zerfall : 1);
        d.rotation.set(q.ry, q.ry * 2, 0); d.position.set(s.x + q.u * c + q.v * si, y0[i] + a * 0.2, s.z - q.u * si + q.v * c); d.scale.set(a * 1.3, a, a * 1.1);
        d.updateMatrix(); traeger.setMatrixAt(i * 4 + 1 + r, d.matrix);
      }
      // Staub: beim Steigen (Höhenzuwachs) und Zerfallen (Zerfallszuwachs)
      const dh = Math.abs(h - vorher[i]), dz = Math.abs(s.zerfall - vz[i]);
      vorher[i] = h; vz[i] = s.zerfall;
      for (let m = Math.min(5, Math.floor((dh * 3 + dz * 12) * (0.5 + zufall()) + zufall())); m > 0; m--) speie(s.x, y0[i] + 0.3, s.z, dz > 0 ? 0.7 : 1.2);
    }
    pfeiler.instanceMatrix.needsUpdate = traeger.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < POOL; i++) {
      alter[i] += dt;
      const l = alter[i] / dauer[i];
      if (l >= 1) { aA[i] = 0; continue; }
      const dr = Math.exp(-1.8 * dt);
      vel[i * 3] *= dr; vel[i * 3 + 1] = vel[i * 3 + 1] * dr - 0.4 * dt; vel[i * 3 + 2] *= dr;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      aA[i] = 0.55 * (1 - l) * Math.min(1, l * 8); aS[i] += dt * 2.5;
    }
    gs.attributes.position.needsUpdate = gs.attributes.aA.needsUpdate = gs.attributes.aS.needsUpdate = true;
  }

  return { objekt, update, dispose() { for (const m of [pfeiler, traeger]) { m.geometry.dispose(); m.material.dispose(); m.dispose(); } gs.dispose(); staubMat.dispose(); } };
}
