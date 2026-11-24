// Gigant-Welt: Einstieg – baut den gemeinsamen Kontext K, erzeugt die Module, Frame-Schleife und Start.
// Modulreihenfolge: himmel, terrain, voxel, vegetation, spieler, bauen, hud (Querzugriffe über K.<modul> erst zur Laufzeit).
import * as THREE from 'three';
import { heightAt } from './welt.js';
import { createHimmel } from './himmel.js';
import { createTerrain } from './terrain.js';
import { createFundstellen } from './fundstellen.js';
import { createVoxel } from './voxel.js';
import { createVegetation, key } from './vegetation.js';
import { createSpieler } from './spieler.js';
import { createBauen } from './bauen.js';
import { createHud } from './hud.js';

window.addEventListener('error', e => { const el = document.getElementById('err'); if (el) el.textContent = 'Fehler: ' + e.message; });

const isTouch = matchMedia('(pointer:coarse)').matches || ('ontouchstart' in window);
const $ = id => document.getElementById(id);

/* ================= QUALITÄT ================= */
const DPR = window.devicePixelRatio || 1;
const PRESETS = {
  low:  { name: 'Niedrig', VR: 40, N: 64,  pr: 0.75, R0: 180, R1: 800,  R2: 2600, GR: 38, BR: 150, gDen: .45, shadow: 0 },
  med:  { name: 'Mittel',  VR: 56, N: 96,  pr: 1.0,  R0: 260, R1: 1200, R2: 4000, GR: 55, BR: 220, gDen: .75, shadow: 1024 },
  high: { name: 'Hoch',    VR: 80, N: 128, pr: 1.5,  R0: 380, R1: 1800, R2: 6000, GR: 80, BR: 300, gDen: 1.0, shadow: 2048 },
};
const qKey = isTouch ? 'med' : 'high', Q = PRESETS[qKey];
const maxPR = Math.min(DPR, Q.pr);

/* ================= RENDERER / SZENE ================= */
const renderer = new THREE.WebGLRenderer({ antialias: !isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(maxPR);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = Q.shadow > 0;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);
renderer.debug.onShaderError = (gl, prog, vs, fs) => {
  const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:8px;right:8px;bottom:140px;max-height:40vh;overflow:auto;background:#300;color:#fcc;font:11px monospace;padding:8px;z-index:30;white-space:pre-wrap';
  d.textContent = 'Shader-Fehler:\n' + (gl.getShaderInfoLog(vs) || '') + (gl.getShaderInfoLog(fs) || '') + (gl.getProgramInfoLog(prog) || ''); document.body.appendChild(d);
};
window.addEventListener('error', e => { if ($('load').style.display === 'none') { const d = document.createElement('div'); d.style.cssText = 'position:fixed;left:8px;top:200px;background:#300;color:#fcc;font:11px monospace;padding:6px;z-index:30'; d.textContent = 'Fehler: ' + e.message; document.body.appendChild(d); } });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.4, 60000);
camera.rotation.order = 'YXZ';
camera.layers.set(0);

const U = { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uTreeR: { value: Q.R2 }, uGR: { value: Q.GR } };

/* Gemeinsamer Kontext: unveränderliche Objekte + veränderlicher Zustand (Q, Spieler, Schalter). Module hängen sich als K.<name> ein. */
const K = {
  isTouch, $, DPR, PRESETS, renderer, scene, camera, U,
  qKey, Q, maxPR, curPR: maxPR, shadowsOn: Q.shadow > 0,
  pos: new THREE.Vector3(), yaw: 0, pitch: -0.04, vy: 0, fly: false, grounded: false, flySpeed: 80, upIn: 0,
  forceRebuild: true,
};
K.himmel = createHimmel(K);
K.terrain = createTerrain(K);
K.vox = createVoxel(K);
K.fundstellen = createFundstellen(K);
K.veg = createVegetation(K);
K.spieler = createSpieler(K);
K.bauen = createBauen(K);
K.hud = createHud(K);
const { pos, himmel, terrain, vox, veg, spieler, bauen, hud } = K;
const { treeL, bushL, grassL, layers } = veg;
const { CW } = vox;

/* ================= LOOP ================= */
let last = performance.now(), lastRB = { x: 1e9, z: 1e9, yaw: 0, t: 0 }, lastGR = { x: 1e9, z: 1e9, yaw: 0 };
let evT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  U.uTime.value = now / 1000;
  spieler.move(dt);
  veg.updateFalling(dt);
  camera.position.copy(pos); camera.rotation.set(K.pitch, K.yaw, 0);
  if (K.shake > .01) { camera.position.x += (Math.random() - .5) * K.shake * .25; camera.position.y += (Math.random() - .5) * K.shake * .25; K.shake *= Math.pow(.02, dt); }
  U.uCam.value.copy(pos);
  terrain.update(pos.x, pos.z);
  K.fundstellen.update(pos.x, pos.z);
  himmel.follow(pos, dt);
  if (K.shadowsOn) himmel.placeShadowCam();

  vox.pump(isTouch ? 5 : 9, pos);
  vox.updateMask(Math.floor(pos.x / CW), Math.floor(pos.z / CW));
  veg.pump(isTouch ? 3 : 6, pos);
  veg.updView();
  bauen.update(now);
  const yaw = K.yaw;
  const yawD = Math.abs(Math.atan2(Math.sin(yaw - lastRB.yaw), Math.cos(yaw - lastRB.yaw)));
  if (K.forceRebuild || ((Math.hypot(pos.x - lastRB.x, pos.z - lastRB.z) > 18 || yawD > .12 || treeL.dirty || bushL.dirty) && now - lastRB.t > 90)) {
    veg.rebuildTrees(); veg.rebuildBushes();
    treeL.dirty = bushL.dirty = false; lastRB = { x: pos.x, z: pos.z, yaw, t: now };
  }
  const gyawD = Math.abs(Math.atan2(Math.sin(yaw - lastGR.yaw), Math.cos(yaw - lastGR.yaw)));
  if (K.forceRebuild || Math.hypot(pos.x - lastGR.x, pos.z - lastGR.z) > 3 || gyawD > .1 || grassL.dirty) {
    veg.rebuildGrass(); grassL.dirty = false; lastGR = { x: pos.x, z: pos.z, yaw };
  }
  K.forceRebuild = false;

  himmel.updatePollen(now, dt);
  renderer.render(scene, camera);
  hud.update(now);
  if (now - evT > 3000) { veg.evict(); vox.evict(pos); evT = now; }
}

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); K.forceRebuild = true; });

/* ================= START ================= */
(async () => {
  const sp = spieler.findSpawn();
  const Pq = new URLSearchParams(location.search), testModus = Pq.get('test') === '1';
  const ortN = Pq.get('ort'), og = ortN && spieler.findeOrt(ortN) || sp;
  pos.set(og.x, heightAt(og.x, og.z) + 1.7, og.z); K.yaw = og.yaw;
  if (Pq.has('blick')) K.yaw = +Pq.get('blick') * Math.PI / 180;
  if (Pq.get('flug') === '1') { spieler.toggleFly(); pos.y = Math.max(pos.y, heightAt(og.x, og.z) + (+Pq.get('hoehe') || 100)); K.pitch = -.2; }
  const zeit = Pq.has('zeit') ? +Pq.get('zeit') : 10;
  himmel.setZeit(zeit, 0); if ($('sSun')) $('sSun').value = zeit;
  $('spV').textContent = K.flySpeed + ' m/s';
  hud.applyQuality(K.qKey);
  if (new URLSearchParams(location.search).get('schatten') === '0') hud.setShadows(false);
  camera.position.copy(pos);
  vox.loadWorld();
  if (testModus) window.K = K; // für Prüfskripte
  // Test: ?faellen=1 fällt kurz nach dem Start den nächsten Baum vor dem Spieler
  if (Pq.get('faellen') === '1') { const iv = setInterval(() => { if ($('load').style.display !== 'none') return; clearInterval(iv);
    let best = null, bd = 1e9; const fx = -Math.sin(K.yaw), fz = -Math.cos(K.yaw);
    for (const c of veg.treeL.cache.values()) for (const t of c.trees) {
      const dx = t.x - pos.x, dz = t.z - pos.z, d = Math.hypot(dx, dz);
      if (d > 15 && d < 140 && (dx * fx + dz * fz) / d > .6 && d < bd) { bd = d; best = t; }
    }
    if (best) veg.fellTree(best); console.log('faellen', best ? best.H.toFixed(0) + 'm ' + bd.toFixed(0) + 'm weit' : 'kein Baum');
  }, 500); }
  // Nahbereich vorab erzeugen
  const nearR = K.Q.R1;
  const origR2 = treeL.radiusFn; treeL.radiusFn = () => nearR; treeL.reset();
  let done = false;
  while (!done) {
    done = vox.pump(30, pos) && veg.pump(30, pos);
    const tot = layers.reduce((a, L) => a + L.offs.length, 0) + vox.vOffsLen, p = veg.pending() + (vox.vOffsLen - vox.vPtr);
    $('bar').firstChild.style.width = (100 * (1 - p / tot)).toFixed(0) + '%';
    $('lt').textContent = `${tot - p} / ${tot} Zellen`;
    await new Promise(r => setTimeout(r, 0));
  }
  treeL.radiusFn = origR2; treeL.reset();
  K.forceRebuild = true;
  $('load').style.display = 'none';
  requestAnimationFrame(t => { last = t; frame(t); });
})();
