// Planet: Terrain (Cube-Sphere mit Quadtree-LOD), Biome, Wasser, Himmel, Tag/Nacht, Licht.
// API siehe API.md (ctx.planet). heightAt() ist mesh-genau: Höhe wird auf dem feinsten
// LOD-Gitter (≈2,4 m) exakt so interpoliert, wie die Dreiecke liegen.
import { createTerrain } from './planet-terrain.js';
import { createHimmel } from './planet-himmel.js';
import { N, MAXL, FACES, createChunkBauer, terrainIndex } from './planet-chunk.js';

const SPLIT = 1.45;           // Teilen, wenn Abstand < Chunkgröße·SPLIT
const BUDGET_MS = 4;          // Chunk-Bau im Hauptthread pro Frame (nur ohne Worker)
const MAX_AUFTRAEGE = 3;      // gleichzeitige Aufträge je Worker

export async function init(ctx) {
  const { THREE, scene, camera, DATA } = ctx;
  const R = DATA.R;
  const T = createTerrain(ctx.seed, DATA);
  const spawnDir = new THREE.Vector3(...T.spawn).normalize();

  // ---------- Höhen-Cache auf dem feinsten Gitter (siehe planet-chunk.js) ----------
  const bauer = createChunkBauer(T, R);
  const gd = [0, 0, 0];
  const heightAt = d => {
    const l = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
    return l > 0 ? bauer.heightAt(d.x / l, d.y / l, d.z / l) : 0;
  };
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
        if (unten) { a = 0.85; col = mix(col, uTief * licht * 2.0, 0.5); }
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
      const st = 1 << (MAXL - L);
      this.size = (Math.PI / 2 * R) / (1 << L);
      bauer.gridDir(f, (x + 0.5) * N * st, (y + 0.5) * N * st, gd);
      this.dir = new THREE.Vector3(gd[0], gd[1], gd[2]);
      this.center = this.dir.clone().multiplyScalar(R + Math.max(0, T.rawHeight(gd[0], gd[1], gd[2])));
      this.maxH = DATA.MAX_HOEHE; this.minH = -DATA.MAX_TIEFE;
      this.children = null; this.mesh = null; this.wasser = null;
      this.split = false; this.lastSplit = 0; this.req = -1; this.dist = 0;
      this.auftrag = false; this.tot = false;
    }
  }
  const roots = FACES.map((_, f) => new Node(f, 0, 0, 0));

  const idxAttr = new THREE.BufferAttribute(terrainIndex(), 1);
  function meshAusDaten(node, d) {
    if (node.tot || node.mesh) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(d.cols, 3, true));
    geo.setIndex(idxAttr);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(d.bs[0], d.bs[1], d.bs[2]), d.bs[3]);
    const mesh = new THREE.Mesh(geo, terrainMat);
    mesh.position.set(d.ox, d.oy, d.oz);
    mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    mesh.visible = false;
    terrainGruppe.add(mesh);
    node.mesh = mesh; node.minH = d.minH; node.maxH = d.maxH;
    if (d.wpos) {
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.BufferAttribute(d.wpos, 3));
      wg.setAttribute('tiefe', new THREE.BufferAttribute(d.tiefe, 1));
      wg.setIndex(new THREE.BufferAttribute(d.widx, 1));
      wg.computeBoundingSphere();
      const wm = new THREE.Mesh(wg, wasserMat);
      wm.position.set(d.ox, d.oy, d.oz); wm.matrixAutoUpdate = false; wm.updateMatrix();
      wm.visible = false; wm.renderOrder = 1;
      terrainGruppe.add(wm);
      node.wasser = wm;
    }
    statChunks++;
  }
  function build(node) { meshAusDaten(node, bauer.bau(node.f, node.L, node.x, node.y)); }

  // ---------- Worker (Chunks im Hintergrund bauen) ----------
  const worker = [];
  const auftraege = new Map();
  let auftragId = 0;
  try {
    const anzahl = Math.max(1, Math.min(2, (navigator.hardwareConcurrency || 2) - 1));
    for (let i = 0; i < anzahl; i++) {
      const w = new Worker(new URL('./planet-worker.js', import.meta.url), { type: 'module' });
      const wk = { w, offen: 0, bereit: false };
      w.onmessage = e => {
        const m = e.data;
        if (m.typ === 'bereit') { wk.bereit = true; return; }
        if (m.typ !== 'chunk') return;
        wk.offen--;
        const node = auftraege.get(m.id); auftraege.delete(m.id);
        if (!node) return;
        node.auftrag = false;
        bauer.fuelleCache(m.f, m.L, m.x, m.y, m.hh);
        meshAusDaten(node, m);
      };
      w.onerror = e => { console.warn('planet: Worker-Fehler, baue im Hauptthread', e.message || e); wk.kaputt = true; };
      w.postMessage({ typ: 'init', seed: ctx.seed });
      worker.push(wk);
    }
  } catch (e) { console.warn('planet: kein Worker', e); }
  function freierWorker() {
    let best = null;
    for (const wk of worker) if (wk.bereit && !wk.kaputt && wk.offen < MAX_AUFTRAEGE && (!best || wk.offen < best.offen)) best = wk;
    return best;
  }

  function dispose(node) {
    node.tot = true;
    if (node.children) { for (const c of node.children) dispose(c); node.children = null; }
    for (const m of [node.mesh, node.wasser]) if (m) {
      terrainGruppe.remove(m); m.visible = false;
      if (m === node.mesh) m.geometry.setIndex(null); // gemeinsamen Indexpuffer behalten
      m.geometry.dispose();
    }
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
  let camD = 0, horCam = 0, nebelWeite = 1e9;
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
    if (d > nebelWeite) return;                 // komplett im Nebel
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
    if (!node.split && jetzt - node.lastSplit > 6) { for (const c of node.children) dispose(c); node.children = null; return; }
    for (const c of node.children) gc(c);
  }
  function lodUpdate(budgetMs, sync = false) {
    frame++;
    camP.copy(camera.position); camD = camP.length(); camN.copy(camP).normalize();
    horCam = camD > R * 0.99 ? Math.acos(Math.min(1, R * 0.99 / camD)) : Math.PI;
    nebelWeite = scene.fog && scene.fog.far < 3000 ? scene.fog.far + 20 : 1e9;
    anfragen = [];
    neuSichtbar.clear();
    for (const r of roots) select(r);
    for (const m of sichtbar) if (!neuSichtbar.has(m)) m.visible = false;
    for (const m of neuSichtbar) m.visible = true;
    sichtbar.clear(); for (const m of neuSichtbar) sichtbar.add(m);
    // bauen: per Worker oder (Start/Teleport/ohne Worker) direkt
    anfragen.sort((a, b) => a.dist - b.dist);
    const t0 = performance.now();
    let n = 0;
    for (const node of anfragen) {
      if (node.mesh) continue;
      if (!sync) {
        if (node.auftrag) continue;
        const wk = freierWorker();
        if (wk) {
          const id = ++auftragId; node.auftrag = true; auftraege.set(id, node); wk.offen++;
          wk.w.postMessage({ typ: 'bau', id, f: node.f, L: node.L, x: node.x, y: node.y });
          continue;
        }
        if (worker.some(w => w.bereit && !w.kaputt) || performance.now() - t0 > budgetMs) continue;
      }
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
    for (let i = 0; i < 60; i++) { if (lodUpdate(1e9, true) <= 0 && i > 0) break; if (performance.now() - t0 > maxMs) break; }
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
      for (const m of sichtbar) { calls++; tris += (m.geometry.index ? m.geometry.index.count : 0) / 3; }
      return { worker: worker.filter(w => w.bereit && !w.kaputt).length, chunks: statChunks, sichtbar: calls, dreiecke: tris, gebaut: statBau.n, msProChunk: +(statBau.ms / Math.max(1, statBau.n)).toFixed(2) };
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
