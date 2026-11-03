// Planet: Terrain (Cube-Sphere mit Quadtree-LOD), Biome, Wasser, Himmel, Tag/Nacht, Licht.
// API siehe API.md (ctx.planet). heightAt() ist mesh-genau: Höhe wird auf dem feinsten
// LOD-Gitter (≈2,4 m) exakt so interpoliert, wie die Dreiecke liegen.
import { createTerrain } from './planet-terrain.js';
import { createHimmel } from './planet-himmel.js';

const N = 32;                 // Zellen pro Chunk-Kante
const MAXL = 3;               // feinste Quadtree-Stufe
const G = N << MAXL;          // Zellen pro Würfelseite auf feinster Stufe (256)
const G1 = G + 1;
const SPLIT = 1.45;           // Teilen, wenn Abstand < Chunkgröße·SPLIT
const BUDGET_MS = 5;          // Chunk-Bau pro Frame
const Q = Math.PI / 4;
// Würfelseiten: Normale n, Tangente t, Bitangente b (t × b = n → Dreiecke zeigen nach außen)
const FACES = [
  [1, 0, 0, 0, 0, -1, 0, 1, 0],
  [-1, 0, 0, 0, 0, 1, 0, 1, 0],
  [0, 1, 0, 1, 0, 0, 0, 0, -1],
  [0, -1, 0, 1, 0, 0, 0, 0, 1],
  [0, 0, 1, 1, 0, 0, 0, 1, 0],
  [0, 0, -1, -1, 0, 0, 0, 1, 0],
];

export async function init(ctx) {
  const { THREE, scene, camera, DATA } = ctx;
  const R = DATA.R;
  const T = createTerrain(ctx.seed, DATA);
  const spawnDir = new THREE.Vector3(...T.spawn).normalize();

  // ---------- Höhen-Cache auf dem feinsten Gitter ----------
  const cache = new Float32Array(6 * G1 * G1).fill(NaN);
  const gd = [0, 0, 0];
  function gridDir(f, gi, gj, out) {
    const F = FACES[f];
    const a = Math.tan((gi * 2 / G - 1) * Q), b = Math.tan((gj * 2 / G - 1) * Q);
    const x = F[0] + a * F[3] + b * F[6], y = F[1] + a * F[4] + b * F[7], z = F[2] + a * F[5] + b * F[8];
    const l = 1 / Math.sqrt(x * x + y * y + z * z);
    out[0] = x * l; out[1] = y * l; out[2] = z * l;
    return out;
  }
  function gridH(f, gi, gj) {
    const k = (f * G1 + gj) * G1 + gi;
    let h = cache[k];
    if (h !== h) { gridDir(f, gi, gj, gd); h = cache[k] = T.rawHeight(gd[0], gd[1], gd[2]); }
    return h;
  }

  // Mesh-genaue Höhe (feinste Stufe, gleiche Dreiecksteilung wie im Mesh)
  function heightAt(d) {
    let x = d.x, y = d.y, z = d.z;
    const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
    let f;
    if (ax >= ay && ax >= az) f = x > 0 ? 0 : 1; else if (ay >= az) f = y > 0 ? 2 : 3; else f = z > 0 ? 4 : 5;
    const F = FACES[f];
    const dn = x * F[0] + y * F[1] + z * F[2];
    if (!(dn > 0)) return 0;
    const a = (x * F[3] + y * F[4] + z * F[5]) / dn, b = (x * F[6] + y * F[7] + z * F[8]) / dn;
    let gu = (Math.atan(a) / Q + 1) * G / 2, gv = (Math.atan(b) / Q + 1) * G / 2;
    let i = Math.floor(gu), j = Math.floor(gv);
    if (i < 0) i = 0; else if (i > G - 1) i = G - 1;
    if (j < 0) j = 0; else if (j > G - 1) j = G - 1;
    const fx = gu - i, fy = gv - j;
    const h00 = gridH(f, i, j), h11 = gridH(f, i + 1, j + 1);
    if (fx >= fy) { const h10 = gridH(f, i + 1, j); return h00 + fx * (h10 - h00) + fy * (h11 - h10); }
    const h01 = gridH(f, i, j + 1); return h00 + fy * (h01 - h00) + fx * (h11 - h01);
  }
  const heightRaw = d => { const l = Math.hypot(d.x, d.y, d.z) || 1; return T.rawHeight(d.x / l, d.y / l, d.z / l); };

  const _n = new THREE.Vector3(), _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3(), _q = new THREE.Vector3();
  function normalAt(dir, out = new THREE.Vector3()) {
    _n.copy(dir).normalize();
    _e1.set(0, 1, 0); if (Math.abs(_n.y) > 0.9) _e1.set(1, 0, 0);
    _e1.cross(_n).normalize(); _e2.crossVectors(_n, _e1);
    const s = 1.6, dd = s / R;
    const hA = heightAt(_q.copy(_n).addScaledVector(_e1, dd)), hB = heightAt(_q.copy(_n).addScaledVector(_e1, -dd));
    const hC = heightAt(_q.copy(_n).addScaledVector(_e2, dd)), hD = heightAt(_q.copy(_n).addScaledVector(_e2, -dd));
    const g1 = (hA - hB) / (2 * s), g2 = (hC - hD) / (2 * s);
    return out.copy(_n).addScaledVector(_e1, -g1).addScaledVector(_e2, -g2).normalize();
  }
  function surfacePoint(dir, out = new THREE.Vector3()) {
    out.copy(dir).normalize();
    return out.multiplyScalar(R + heightAt(out));
  }
  const _b = new THREE.Vector3();
  function biomeAt(dir) { _b.copy(dir).normalize(); return T.biome(_b.x, _b.y, _b.z, heightAt(_b)); }
  function ringAt(dir) { _b.copy(dir).normalize(); return T.ringDeg(_b.x, _b.y, _b.z); }
  function feuchteAt(dir) { _b.copy(dir).normalize(); return T.feuchte(_b.x, _b.y, _b.z, heightAt(_b)); }

  // ---------- Materialien ----------
  const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const wasserU = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uZeit: { value: 0 }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSonne: { value: new THREE.Color(1, 1, 1) },
    uHimmel: { value: new THREE.Color(0.5, 0.7, 0.9) }, uOrbit: { value: 0 }, uAmb: { value: new THREE.Color(0.3, 0.35, 0.4) },
    uFlach: { value: new THREE.Color(0.06, 0.42, 0.42) }, uTief: { value: new THREE.Color(0.01, 0.07, 0.18) },
  }]);
  const wasserMat = new THREE.ShaderMaterial({
    uniforms: wasserU, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    vertexShader: `attribute float tiefe; varying float vT; varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){ vT = tiefe; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uZeit, uOrbit; uniform vec3 uSun, uSonne, uHimmel, uAmb, uFlach, uTief; varying float vT; varying vec3 vW;
      #include <fog_pars_fragment>
      vec3 welle(vec3 p, vec3 k, float w, float t){ return k * cos(dot(p, k) + t * w); }
      void main(){
        if (vT < -1.5) discard;
        vec3 up = normalize(vW);
        vec3 p = vW; float t = uZeit;
        vec3 g = welle(p, vec3(0.61, 0.33, -0.52), 1.1, t) + welle(p, vec3(-0.27, 0.71, 0.44), 1.4, t)
               + welle(p, vec3(0.45, -0.58, 0.69), 0.9, t) * 0.8 + welle(p * 2.3, vec3(0.7, 0.2, 0.6), 2.1, t) * 0.5
               + welle(p * 3.1, vec3(-0.5, -0.6, 0.3), 2.7, t) * 0.35;
        g -= up * dot(g, up);
        float dist = length(cameraPosition - vW);
        vec3 n = normalize(up + g * 0.07 * (1.0 - smoothstep(40.0, 320.0, dist)));
        vec3 v = (cameraPosition - vW) / dist;
        bool unten = dot(v, up) < 0.0;
        if (unten) n = -n;
        float tiefe = max(vT, 0.0);
        vec3 col = mix(uFlach, uTief, smoothstep(0.0, 26.0, tiefe + dist * 0.06 * (1.0 - uOrbit)));
        float lit = max(dot(up, uSun), 0.0);
        float tagL = smoothstep(-0.15, 0.2, dot(up, uSun));
        vec3 licht = uAmb * (0.25 + 0.75 * tagL) + uSonne * (0.2 * tagL + 0.75 * lit) + vec3(0.012, 0.018, 0.035);
        col *= licht;
        float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
        if (!unten) col = mix(col, uHimmel * (0.3 + 0.7 * tagL), fres * 0.65 * (1.0 - uOrbit));
        vec3 h = normalize(uSun + v);
        float spec = pow(max(dot(n, h), 0.0), 160.0) * 2.5 * step(0.0, dot(up, uSun));
        float schaum = 1.0 - smoothstep(0.0, 0.55 + 0.25 * sin(uZeit * 1.7 + dot(p, vec3(0.9, 0.7, 0.4)) * 0.8), vT);
        schaum *= 0.6 + 0.4 * sin(dot(p, vec3(2.1, 1.7, -1.3)) + uZeit * 2.0);
        col = mix(col, licht * 0.85, clamp(schaum, 0.0, 1.0) * 0.75);
        col += uSonne * spec;
        float a = mix(0.38, 0.97, smoothstep(0.0, 7.0, tiefe));
        float vu = abs(dot(v, up));
        a = max(a, 1.0 - smoothstep(0.03, 0.35, vu) * (1.0 - smoothstep(25.0, 140.0, dist)));
        a = max(a, max(fres * 0.9 * (1.0 - uOrbit), schaum * 0.8));
        if (unten) a = 0.55;
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });

  // ---------- Quadtree ----------
  const terrainGruppe = new THREE.Group(); terrainGruppe.name = 'pl-terrain';
  scene.add(terrainGruppe);
  let statChunks = 0; const statBau = { n: 0, ms: 0 };

  class Node {
    constructor(f, L, x, y) {
      this.f = f; this.L = L; this.x = x; this.y = y;
      this.s = 1 << (MAXL - L);
      this.size = (Math.PI / 2 * R) / (1 << L);
      gridDir(f, (x + 0.5) * N * this.s, (y + 0.5) * N * this.s, gd);
      this.dir = new THREE.Vector3(gd[0], gd[1], gd[2]);
      this.center = this.dir.clone().multiplyScalar(R + Math.max(0, T.rawHeight(gd[0], gd[1], gd[2])));
      this.maxH = DATA.MAX_HOEHE; this.minH = -DATA.MAX_TIEFE;
      this.children = null; this.mesh = null; this.wasser = null;
      this.split = false; this.lastSplit = 0; this.req = -1; this.dist = 0;
    }
  }
  const roots = FACES.map((_, f) => new Node(f, 0, 0, 0));

  const W = N + 3;
  const P = new Float32Array(W * W * 3), HH = new Float32Array(W * W), DD = new Float32Array(W * W * 3);
  const col = [0, 0, 0];
  function build(node) {
    const { f, s } = node;
    const gx0 = node.x * N * s, gy0 = node.y * N * s;
    const ox = node.dir.x * R, oy = node.dir.y * R, oz = node.dir.z * R;
    let minH = 1e9, maxH = -1e9;
    for (let b = -1; b <= N + 1; b++) for (let a = -1; a <= N + 1; a++) {
      const gi = gx0 + a * s, gj = gy0 + b * s, k = (b + 1) * W + (a + 1);
      gridDir(f, gi, gj, gd);
      const h = (gi >= 0 && gi <= G && gj >= 0 && gj <= G) ? gridH(f, gi, gj) : T.rawHeight(gd[0], gd[1], gd[2]);
      HH[k] = h; DD[k * 3] = gd[0]; DD[k * 3 + 1] = gd[1]; DD[k * 3 + 2] = gd[2];
      const r = R + h;
      P[k * 3] = gd[0] * r; P[k * 3 + 1] = gd[1] * r; P[k * 3 + 2] = gd[2] * r;
      if (a >= 0 && a <= N && b >= 0 && b <= N) { if (h < minH) minH = h; if (h > maxH) maxH = h; }
    }
    const NV = (N + 1) * (N + 1), NS = 4 * (N + 1);
    const pos = new Float32Array((NV + NS) * 3), nor = new Float32Array((NV + NS) * 3), cols = new Uint8Array((NV + NS) * 3);
    let hatWasser = minH < 0.3;
    const tiefe = hatWasser ? new Float32Array(NV) : null;
    for (let b = 0; b <= N; b++) for (let a = 0; a <= N; a++) {
      const k = (b + 1) * W + (a + 1), v = b * (N + 1) + a;
      const kx1 = k + 1, kx0 = k - 1, ky1 = k + W, ky0 = k - W;
      const ux = P[kx1 * 3] - P[kx0 * 3], uy = P[kx1 * 3 + 1] - P[kx0 * 3 + 1], uz = P[kx1 * 3 + 2] - P[kx0 * 3 + 2];
      const vx = P[ky1 * 3] - P[ky0 * 3], vy = P[ky1 * 3 + 1] - P[ky0 * 3 + 1], vz = P[ky1 * 3 + 2] - P[ky0 * 3 + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const nl = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz); nx *= nl; ny *= nl; nz *= nl;
      const dx = DD[k * 3], dy = DD[k * 3 + 1], dz = DD[k * 3 + 2], h = HH[k];
      const slope = 1 - (nx * dx + ny * dy + nz * dz);
      pos[v * 3] = P[k * 3] - ox; pos[v * 3 + 1] = P[k * 3 + 1] - oy; pos[v * 3 + 2] = P[k * 3 + 2] - oz;
      nor[v * 3] = nx; nor[v * 3 + 1] = ny; nor[v * 3 + 2] = nz;
      T.color(dx, dy, dz, h, slope * 2.2, col);
      cols[v * 3] = col[0] * 255; cols[v * 3 + 1] = col[1] * 255; cols[v * 3 + 2] = col[2] * 255;
      if (tiefe) tiefe[v] = -h;
    }
    // Skirts: Tiefe je Randvertex = Abweichung zu feineren/gröberen Nachbarstufen (+Reserve)
    const edges = [
      [i => i, i => [i, 0]],                         // unten  (b=0)
      [i => N * (N + 1) + i, i => [i, N]],           // oben   (b=N)
      [i => i * (N + 1), i => [0, i]],               // links  (a=0)
      [i => i * (N + 1) + N, i => [N, i]],           // rechts (a=N)
    ];
    const eh = new Float32Array(N + 1), dev = new Float32Array(N + 1);
    let sv = NV;
    const idx = [];
    for (let e = 0; e < 4; e++) {
      const [vi, ab] = edges[e];
      for (let i = 0; i <= N; i++) { const [a, b] = ab(i); eh[i] = HH[(b + 1) * W + (a + 1)]; dev[i] = 0; }
      for (let i = 0; i <= N; i++) {
        // gröbere Nachbarn (Faktor 2 und 4)
        for (const m of [2, 4, 8]) {
          const i0 = Math.floor(i / m) * m, i1 = Math.min(N, i0 + m);
          if (i0 !== i) { const t = (i - i0) / m; dev[i] = Math.max(dev[i], Math.abs(eh[i] - (eh[i0] + (eh[i1] - eh[i0]) * t))); }
        }
        // feinere Nachbarn (Mittelpunkte)
        if (i < N && s > 1) {
          const [a, b] = ab(i), [a2, b2] = ab(i + 1);
          const gi = gx0 + (a + a2) * s / 2, gj = gy0 + (b + b2) * s / 2;
          if (gi >= 0 && gi <= G && gj >= 0 && gj <= G) {
            const dm = Math.abs(gridH(f, gi, gj) - (eh[i] + eh[i + 1]) / 2) * 1.5;
            if (dm > dev[i]) dev[i] = dm; if (dm > dev[i + 1]) dev[i + 1] = dm;
          }
        }
      }
      const base = sv;
      for (let i = 0; i <= N; i++, sv++) {
        const v = vi(i);
        const skirt = 0.25 + dev[i] * 1.3 + (i > 0 ? dev[i - 1] * 0.3 : 0) + (i < N ? dev[i + 1] * 0.3 : 0);
        const px = pos[v * 3] + ox, py = pos[v * 3 + 1] + oy, pz = pos[v * 3 + 2] + oz;
        const l = Math.sqrt(px * px + py * py + pz * pz), k = (l - skirt) / l;
        pos[sv * 3] = px * k - ox; pos[sv * 3 + 1] = py * k - oy; pos[sv * 3 + 2] = pz * k - oz;
        nor[sv * 3] = nor[v * 3]; nor[sv * 3 + 1] = nor[v * 3 + 1]; nor[sv * 3 + 2] = nor[v * 3 + 2];
        cols[sv * 3] = cols[v * 3]; cols[sv * 3 + 1] = cols[v * 3 + 1]; cols[sv * 3 + 2] = cols[v * 3 + 2];
        if (i > 0) {
          const t0 = vi(i - 1), t1 = v, s0 = base + i - 1, s1 = base + i;
          // beide Windungen (Skirt von beiden Seiten sichtbar)
          idx.push(t0, s0, t1, t1, s0, s1, t0, t1, s0, t1, s1, s0);
        }
      }
    }
    for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) {
      const v00 = b * (N + 1) + a, v10 = v00 + 1, v01 = v00 + N + 1, v11 = v01 + 1;
      idx.push(v00, v10, v11, v00, v11, v01);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3, true));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, terrainMat);
    mesh.position.set(ox, oy, oz);
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    mesh.visible = false;
    terrainGruppe.add(mesh);
    node.mesh = mesh; node.minH = minH; node.maxH = maxH;

    if (tiefe) {
      const wi = [];
      for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) {
        const v00 = b * (N + 1) + a, v10 = v00 + 1, v01 = v00 + N + 1, v11 = v01 + 1;
        if (Math.max(tiefe[v00], tiefe[v10], tiefe[v01], tiefe[v11]) > -0.4) wi.push(v00, v10, v11, v00, v11, v01);
      }
      if (wi.length) {
        const wp = new Float32Array(NV * 3);
        for (let b = 0; b <= N; b++) for (let a = 0; a <= N; a++) {
          const k = (b + 1) * W + (a + 1), v = b * (N + 1) + a;
          wp[v * 3] = DD[k * 3] * R - ox; wp[v * 3 + 1] = DD[k * 3 + 1] * R - oy; wp[v * 3 + 2] = DD[k * 3 + 2] * R - oz;
        }
        const wg = new THREE.BufferGeometry();
        wg.setAttribute('position', new THREE.BufferAttribute(wp, 3));
        wg.setAttribute('tiefe', new THREE.BufferAttribute(tiefe, 1));
        wg.setIndex(wi);
        wg.computeBoundingSphere();
        const wm = new THREE.Mesh(wg, wasserMat);
        wm.position.set(ox, oy, oz); wm.matrixAutoUpdate = false; wm.updateMatrix();
        wm.visible = false; wm.renderOrder = 1;
        terrainGruppe.add(wm);
        node.wasser = wm;
      }
    }
    statChunks++;
  }
  function dispose(node) {
    if (node.children) { for (const c of node.children) dispose(c); node.children = null; }
    for (const m of [node.mesh, node.wasser]) if (m) { terrainGruppe.remove(m); m.geometry.dispose(); m.visible = false; }
    if (node.mesh) statChunks--;
    node.mesh = node.wasser = null; node.split = false;
  }
  function kinder(node) {
    const L = node.L + 1, x = node.x * 2, y = node.y * 2;
    return [new Node(node.f, L, x, y), new Node(node.f, L, x + 1, y), new Node(node.f, L, x, y + 1), new Node(node.f, L, x + 1, y + 1)];
  }

  // Auswahl der sichtbaren Chunks
  let frame = 0, jetzt = 0;
  const sichtbar = new Set(), neuSichtbar = new Set();
  let anfragen = [];
  const camP = new THREE.Vector3(), camN = new THREE.Vector3();
  let camD = 0, horCam = 0;
  function hinterHorizont(node) {
    if (camD <= R * 0.99 || api.dbgKeinHorizont) return false;
    const ang = Math.acos(Math.max(-1, Math.min(1, camN.dot(node.dir))));
    const top = R + Math.max(node.maxH, 0) + 2;
    const horObj = Math.acos(Math.min(1, (R * 0.99) / top));
    const alpha = node.size * 0.8 / R;
    return ang - alpha > horCam + horObj;
  }
  function select(node) {
    if (hinterHorizont(node)) return;
    const d = Math.max(0, node.center.distanceTo(camP) - node.size * 0.72);
    node.dist = d;
    const want = node.L < MAXL && d < node.size * SPLIT * (node.split ? 1.15 : 1);
    if (want) {
      if (!node.children) node.children = kinder(node);
      let ready = true;
      for (const c of node.children) if (!c.mesh) { ready = false; if (c.req !== frame) { c.req = frame; c.dist = d; anfragen.push(c); } }
      if (ready) {
        node.split = true; node.lastSplit = jetzt;
        for (const c of node.children) select(c);
        return;
      }
    }
    node.split = false;
    if (!node.mesh) { if (node.req !== frame) { node.req = frame; anfragen.push(node); } return; }
    neuSichtbar.add(node.mesh);
    if (node.wasser) neuSichtbar.add(node.wasser);
  }
  function gc(node) {
    if (!node.children) return;
    if (!node.split && jetzt - node.lastSplit > 6) { dispose({ children: node.children }); node.children = null; return; }
    for (const c of node.children) gc(c);
  }
  function lodUpdate(budgetMs) {
    frame++;
    camP.copy(camera.position); camD = camP.length(); camN.copy(camP).normalize();
    horCam = camD > R * 0.99 ? Math.acos(Math.min(1, R * 0.99 / camD)) : Math.PI;
    anfragen = [];
    neuSichtbar.clear();
    for (const r of roots) select(r);
    for (const m of sichtbar) if (!neuSichtbar.has(m)) m.visible = false;
    for (const m of neuSichtbar) m.visible = true;
    sichtbar.clear(); for (const m of neuSichtbar) sichtbar.add(m);
    // bauen
    anfragen.sort((a, b) => a.dist - b.dist);
    const t0 = performance.now();
    let n = 0;
    for (const node of anfragen) {
      if (node.mesh) continue;
      const tb = performance.now(); build(node); n++; statBau.n++; statBau.ms += performance.now() - tb;
      if (performance.now() - t0 > budgetMs) break;
    }
    if ((frame & 63) === 0) for (const r of roots) gc(r);
    return anfragen.length - n;
  }

  // ---------- Himmel & Zeit ----------
  const himmel = createHimmel(ctx, R);
  const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3();
  const spawnLon = Math.atan2(spawnDir.x, spawnDir.z);
  const NEIGUNG = 0.32; // Sonnenbahn leicht geneigt (rad)
  function setzeSonne(tz) {
    const lon = spawnLon + (tz - 0.25) * Math.PI * 2;
    const c = Math.cos(NEIGUNG);
    sunDir.set(Math.sin(lon) * c, Math.sin(NEIGUNG) * 0.5 + spawnDir.y, Math.cos(lon) * c).normalize();
    const ml = lon + Math.PI + 0.5;
    moonDir.set(Math.sin(ml) * 0.92, -0.25, Math.cos(ml) * 0.92).normalize();
  }

  const letzteCam = new THREE.Vector3().copy(camera.position);
  function vorladen(maxMs = 1500) {
    const t0 = performance.now();
    for (let i = 0; i < 60; i++) { if (lodUpdate(1e9) <= 0 && i > 0) break; if (performance.now() - t0 > maxMs) break; }
    return performance.now() - t0;
  }
  const api = {
    R, spawnDir, sunDir, moonDir, tageszeit: 0.14, licht: 1,
    heightAt, groundAt: surfacePoint, heightRaw, surfacePoint, normalAt, biomeAt, ringAt, feuchteAt,
    istNacht(dir) {
      const d = dir ? _q.copy(dir).normalize() : _q.copy(ctx.spieler?.pos || camera.position).normalize();
      return d.dot(sunDir) < -0.05;
    },
    lichtAt(dir) { const e = _q.copy(dir).normalize().dot(sunDir); return THREE.MathUtils.smoothstep(e, -0.14, 0.22); },
    biomFarbe(id) { return DATA.BIOME[id]?.farbe ?? 0x888888; },
    zeitFaktor: 1,
    vorladen,
    himmel: himmel.info,
    stats() {
      let tris = 0, calls = 0;
      for (const m of sichtbar) { calls++; tris += m.geometry.index.count / 3; }
      return { chunks: statChunks, sichtbar: calls, dreiecke: tris, gebaut: statBau.n, msProChunk: +(statBau.ms / Math.max(1, statBau.n)).toFixed(2) };
    },
    update(dt) {
      jetzt += dt;
      api.tageszeit = (api.tageszeit + dt * api.zeitFaktor / DATA.TAG_DAUER) % 1;
      setzeSonne(api.tageszeit);
      // Großer Kamerasprung (Teleport, Karte zu) → sofort vollständig verfeinern
      const sprung = letzteCam.distanceTo(camera.position) > 60;
      letzteCam.copy(camera.position);
      if (sprung) vorladen(); else lodUpdate(BUDGET_MS);
      const ort = ctx.spieler?.pos || camera.position;
      const info = himmel.update(sunDir, ort, moonDir);
      api.licht = info.tag;
      wasserU.uZeit.value = jetzt;
      wasserU.uSun.value.copy(sunDir);
      wasserU.uSonne.value.copy(info.sonnenFarbe).multiplyScalar(0.9);
      wasserU.uHimmel.value.copy(info.horizont);
      wasserU.uOrbit.value = info.orbit;
      wasserU.uAmb.value.copy(info.zenit).multiplyScalar(0.5).addScalar(0.03);
    },
    save() { return { tageszeit: api.tageszeit }; },
    load(d) { if (d && typeof d.tageszeit === 'number') api.tageszeit = d.tageszeit; },
  };
  setzeSonne(api.tageszeit);

  // Startgeometrie sofort bauen (Spawn + Kamera), damit nichts fehlt
  {
    const ms = vorladen(5000);
    if (ctx.debug) console.log('planet: Start-LOD', ms.toFixed(0), 'ms', JSON.stringify(api.stats()));
  }
  // Kamera wird erst von spieler gesetzt → beim 'bereit' noch einmal vollständig bauen
  ctx.on('bereit', () => { vorladen(3000); letzteCam.copy(camera.position); });
  return api;
}
