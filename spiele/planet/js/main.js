// Verdrahtung aller Module. Jedes Modul exportiert `async function init(ctx)` und
// gibt ein Objekt zurück (z. B. { update(dt), save(), load(d) }), das unter ctx[name] landet.
// Reihenfolge = Init-Reihenfolge. Update-Reihenfolge siehe UPDATE_ORDER.
import * as THREE from 'three';
import * as DATA from './data.js';
import { hashSeed, mulberry32 } from './noise.js';

const MODULE = ['planet', 'flora', 'kreaturen', 'spieler', 'spiel'];
const UPDATE_ORDER = ['spieler', 'planet', 'flora', 'kreaturen', 'spiel'];

const params = new URLSearchParams(location.search);
let seedText = params.get('seed');
if (!seedText) { try { seedText = JSON.parse(localStorage.getItem('planet-save-v1') || 'null')?.seed; } catch (e) {} }
if (!seedText) seedText = String(Math.floor(Math.random() * 1e6));
const seed = hashSeed('planet', seedText);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('welt').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 4000);

// Kleiner Event-Bus
const handler = {};
const on = (name, fn) => { (handler[name] ||= []).push(fn); };
const emit = (name, data) => { for (const fn of handler[name] || []) { try { fn(data); } catch (e) { console.error('Event', name, e); } } };

export const ctx = {
  THREE, scene, camera, renderer, DATA,
  seedText, seed, rng: mulberry32(seed),
  R: DATA.R,
  on, emit,
  ziele: [],          // Anbieter für Interaktionsziele: fn(pos) → [{ dist, label, act() }]
  zeit: { t: 0, dt: 0 },
  debug: params.has('debug'),
};
window.ctx = ctx; // für Tests/Debugging

const ladeText = document.getElementById('laden');
function status(t) { if (ladeText) ladeText.textContent = t; }

async function ladeModul(name) {
  try {
    const mod = await import('./' + name + '.js');
    const obj = await mod.init(ctx);
    return obj || {};
  } catch (e) {
    console.error('Modul fehlgeschlagen:', name, e);
    const stub = await import('./stubs/' + name + '.js');
    return (await stub.init(ctx)) || {};
  }
}

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  emit('resize', {});
}
addEventListener('resize', resize);
resize();

for (const name of MODULE) {
  status('Erzeuge ' + name + '…');
  ctx[name] = await ladeModul(name);
}
emit('bereit', {});
if (ladeText) ladeText.remove();

const uhr = new THREE.Clock();
let fehlerGemeldet = {};
renderer.setAnimationLoop(() => {
  const dt = Math.min(uhr.getDelta(), 0.1);
  ctx.zeit.t += dt; ctx.zeit.dt = dt;
  for (const name of UPDATE_ORDER) {
    const m = ctx[name];
    if (m && m.update) {
      try { m.update(dt); } catch (e) { if (!fehlerGemeldet[name]) { console.error('update', name, e); fehlerGemeldet[name] = 1; } }
    }
  }
  renderer.render(scene, camera);
});
