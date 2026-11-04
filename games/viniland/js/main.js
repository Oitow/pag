// Viniland Testlab – Hauptschleife: Welt, 2 Spieler (Splitscreen), Tiere, Tuning-Menü.
import * as THREE from 'three';
import { PSX, setPSX } from './psx.js';
import { createWorld } from './world.js';
import { createPlayerModel, PLAYER_LOOKS } from './players.js';
import { Fauna } from './fauna.js';
import { Input, KEY_HELP } from './input.js';
import { CharacterController, TUNING } from './controller.js';
import { FollowCamera, CAM_TUNING } from './camera.js';

const params = new URLSearchParams(location.search);
const SETTINGS = {
  players: params.get('p') === '1' ? 1 : 2,
  split: 'auto',           // auto | vertical | horizontal
  pixelScale: 0.5,         // interne Auflösung relativ zum Bildschirm (PSX-Pixel)
  snap: 220, dither: true, shadows: true,
  animals: true,
  debug: false,
  padMode: 'auto',
  keyboard: [true, true],
  looks: [0, 1],
};
try { Object.assign(SETTINGS, JSON.parse(localStorage.getItem('viniland.settings') || '{}')); } catch (e) { /* ok */ }
try { Object.assign(TUNING, JSON.parse(localStorage.getItem('viniland.tuning') || '{}')); } catch (e) { /* ok */ }
try { Object.assign(CAM_TUNING, JSON.parse(localStorage.getItem('viniland.cam') || '{}')); } catch (e) { /* ok */ }
if (params.get('p')) SETTINGS.players = params.get('p') === '1' ? 1 : 2;
const save = () => { try {
  localStorage.setItem('viniland.settings', JSON.stringify(SETTINGS));
  localStorage.setItem('viniland.tuning', JSON.stringify(TUNING));
  localStorage.setItem('viniland.cam', JSON.stringify(CAM_TUNING));
} catch (e) { /* ok */ } };

// ---------- Renderer ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = SETTINGS.shadows;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setScissorTest(true);
const scene = new THREE.Scene();
setPSX({ snap: SETTINGS.snap, dither: SETTINGS.dither });

const seed = Number(params.get('seed')) || 1337;
const world = createWorld(scene, { seed });
const sun = world.sun;
const sunOffset = world.sunOffset ? world.sunOffset.clone() : new THREE.Vector3(70, 110, 45);
if (sun) {
  if (sunOffset.lengthSq() < 1) sunOffset.set(60, 90, 40);
  const sc = sun.shadow.camera; sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 320; sc.updateProjectionMatrix();
  if (!sun.target.parent) scene.add(sun.target);
}

// ---------- Spieler ----------
const input = new Input(canvas);
const players = [];
function makePlayer(i) {
  const model = createPlayerModel(SETTINGS.looks[i] ?? i);
  scene.add(model.object3D);
  const spawn = (world.spawnPoints && world.spawnPoints[i]) ? world.spawnPoints[i].clone() : new THREE.Vector3(i * 3, 0, 0);
  const ctrl = new CharacterController(world, spawn, model.radius || 0.35, model.height || 1.75);
  const cam = new FollowCamera(1);
  cam.yaw = Math.PI; // hinter der Figur
  return { i, model, ctrl, cam, pos: ctrl.pos, vel: ctrl.vel, get speed() { return ctrl.speed || 0; }, intent: null, pendingHit: null, chopT: 0 };
}
for (let i = 0; i < 2; i++) players.push(makePlayer(i));
// Spieler schauen sich zum Start leicht zur Inselmitte hin
for (const p of players) {
  const yaw = Math.atan2(-p.pos.x, -p.pos.z);
  p.ctrl.yaw = yaw; p.cam.yaw = yaw + Math.PI;
}

let fauna = null;
try { if (SETTINGS.animals) fauna = new Fauna(scene, world, seed + 3); } catch (e) { console.error(e); showError('Fauna: ' + e.message); }

// ---------- HUD ----------
const hudEls = [document.getElementById('hud0'), document.getElementById('hud1')];
const fpsEl = document.getElementById('fps');
const helpEl = document.getElementById('help');
helpEl.innerHTML = KEY_HELP.map(s => `<div>${s}</div>`).join('') + '<div>Gamepad: Stick L laufen · A springen · LB/L3 sprinten · X/RT hacken · Y winken · Stick R Kamera · Start = Menü</div><div><b>Tab / Esc</b> = Menü & Tuning</div>';
setTimeout(() => helpEl.classList.add('fade'), 9000);

function showError(msg) { const el = document.getElementById('err'); el.style.display = 'block'; el.textContent += msg + '\n'; }
addEventListener('error', e => showError(e.message));

// ---------- Menü ----------
const menu = document.getElementById('menu');
function buildMenu() {
  const sec = (title, obj, defs) => {
    let h = `<h3>${title}</h3>`;
    for (const [k, min, max, step, label] of defs) {
      h += `<label><span>${label || k}</span><input type="range" data-obj="${title}" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${obj[k]}"><em>${(+obj[k]).toFixed(2)}</em></label>`;
    }
    return h;
  };
  menu.innerHTML = `
  <div class="mhead"><b>Viniland Testlab</b><button id="mclose">✕</button></div>
  <div class="row">
    <button data-act="players">${SETTINGS.players === 2 ? '👥 2 Spieler' : '👤 1 Spieler'}</button>
    <button data-act="split">Split: ${SETTINGS.split}</button>
    <button data-act="pad">Gamepad 1 → ${{ auto: 'Auto', p1: 'Spieler 1', p2: 'Spieler 2' }[SETTINGS.padMode]}</button>
    <button data-act="kb0">Tastatur P1 ${SETTINGS.keyboard[0] ? 'an' : 'aus'}</button>
    <button data-act="kb1">Tastatur P2 ${SETTINGS.keyboard[1] ? 'an' : 'aus'}</button>
  </div>
  <div class="pads">${padInfo()}</div>
  <div class="row">
    <button data-act="look0">P1 Look: ${PLAYER_LOOKS[SETTINGS.looks[0]]?.name ?? SETTINGS.looks[0]}</button>
    <button data-act="look1">P2 Look: ${PLAYER_LOOKS[SETTINGS.looks[1]]?.name ?? SETTINGS.looks[1]}</button>
    <button data-act="dither">Dithering ${SETTINGS.dither ? 'an' : 'aus'}</button>
    <button data-act="shadows">Schatten ${SETTINGS.shadows ? 'an' : 'aus'}</button>
    <button data-act="debug">Debug ${SETTINGS.debug ? 'an' : 'aus'}</button>
    <button data-act="reset">Tuning zurücksetzen</button>
  </div>
  ${sec('Grafik', SETTINGS, [['pixelScale', 0.2, 1, 0.05, 'Pixel-Skala'], ['snap', 0, 400, 10, 'Vertex-Snap (0=aus)']])}
  ${sec('Bewegung', TUNING, [['walkSpeed', 1, 10, 0.1, 'Gehen m/s'], ['runSpeed', 2, 16, 0.1, 'Sprint m/s'], ['accelGround', 5, 120, 1, 'Beschl. Boden'], ['decelGround', 5, 120, 1, 'Bremsen Boden'], ['accelAir', 0, 60, 1, 'Beschl. Luft'], ['turnRate', 2, 30, 0.5, 'Drehrate'], ['gravity', 8, 60, 0.5, 'Schwerkraft'], ['jumpHeight', 0.3, 4, 0.05, 'Sprunghöhe m'], ['lowJumpMul', 1, 5, 0.1, 'Kurzsprung-Mul'], ['fallMul', 1, 4, 0.05, 'Fall-Mul'], ['coyoteTime', 0, 0.4, 0.01, 'Coyote-Zeit'], ['jumpBuffer', 0, 0.4, 0.01, 'Sprung-Puffer'], ['stepHeight', 0.1, 1.2, 0.05, 'Stufenhöhe'], ['slopeLimitDeg', 20, 70, 1, 'Max. Hang °']])}
  ${sec('Kamera', CAM_TUNING, [['distance', 2, 14, 0.1, 'Abstand'], ['height', 0.5, 3, 0.05, 'Höhe'], ['followXZ', 2, 30, 0.5, 'Folgen XZ'], ['followY', 1, 30, 0.5, 'Folgen Y'], ['autoAlign', 0, 4, 0.1, 'Auto-Ausrichtung'], ['fov', 40, 90, 1, 'FOV'], ['sprintFov', 40, 100, 1, 'Sprint-FOV'], ['shake', 0, 3, 0.1, 'Shake']])}
  <p class="hint">Einstellungen werden im Browser gespeichert. URL-Parameter: <code>?p=1</code> (1 Spieler), <code>?seed=42</code>.</p>`;
  menu.querySelector('#mclose').onclick = () => toggleMenu(false);
  menu.querySelectorAll('input[type=range]').forEach(el => el.oninput = () => {
    const obj = { Grafik: SETTINGS, Bewegung: TUNING, Kamera: CAM_TUNING }[el.dataset.obj];
    obj[el.dataset.k] = +el.value;
    el.nextElementSibling.textContent = (+el.value).toFixed(2);
    if (el.dataset.k === 'snap') setPSX({ snap: +el.value });
    if (el.dataset.k === 'distance') players.forEach(p => p.cam.dist = +el.value);
    if (el.dataset.k === 'pixelScale') resize();
    save();
  });
  menu.querySelectorAll('button[data-act]').forEach(b => b.onclick = () => {
    const a = b.dataset.act;
    if (a === 'players') { SETTINGS.players = SETTINGS.players === 2 ? 1 : 2; applyInput(); resize(); }
    if (a === 'split') SETTINGS.split = { auto: 'vertical', vertical: 'horizontal', horizontal: 'auto' }[SETTINGS.split];
    if (a === 'pad') SETTINGS.padMode = { auto: 'p1', p1: 'p2', p2: 'auto' }[SETTINGS.padMode];
    if (a === 'kb0' || a === 'kb1') { const i = +a.slice(-1); SETTINGS.keyboard[i] = !SETTINGS.keyboard[i]; }
    applyInput();
    if (a === 'dither') { SETTINGS.dither = !SETTINGS.dither; setPSX({ dither: SETTINGS.dither }); }
    if (a === 'shadows') { SETTINGS.shadows = !SETTINGS.shadows; if (sun) sun.castShadow = SETTINGS.shadows; }
    if (a === 'debug') SETTINGS.debug = !SETTINGS.debug;
    if (a === 'look0' || a === 'look1') {
      const i = +a.slice(-1);
      SETTINGS.looks[i] = (SETTINGS.looks[i] + 1) % PLAYER_LOOKS.length;
      const p = players[i]; scene.remove(p.model.object3D);
      p.model = createPlayerModel(SETTINGS.looks[i]); scene.add(p.model.object3D);
    }
    if (a === 'reset') { localStorage.removeItem('viniland.tuning'); localStorage.removeItem('viniland.cam'); location.reload(); return; }
    save(); buildMenu();
  });
}
function toggleMenu(open = !menu.classList.contains('open')) {
  if (open) buildMenu();
  menu.classList.toggle('open', open);
  if (open && document.pointerLockElement) document.exitPointerLock();
}
function applyInput() { input.padMode = SETTINGS.padMode; input.players = SETTINGS.players; input.keyboardFor = SETTINGS.keyboard; }
function padInfo() {
  const raw = input.rawPads();
  if (!raw.length) return '🎮 Kein Gamepad erkannt – einmal eine Taste am Controller drücken.';
  return raw.map((p, n) => { const o = input.padOwner(n); return `🎮 ${n + 1}: ${p.id.slice(0, 48)} → ${o < 0 ? 'niemand' : 'Spieler ' + (o + 1)}`; }).join('<br>');
}
applyInput();
addEventListener('gamepadconnected', () => { if (menu.classList.contains('open')) buildMenu(); });
if (sun) sun.castShadow = SETTINGS.shadows;

// ---------- Layout ----------
let W = 1, H = 1;
function views() {
  if (SETTINGS.players === 1) return [{ x: 0, y: 0, w: W, h: H }];
  const vertical = SETTINGS.split === 'vertical' || (SETTINGS.split === 'auto' && W >= H);
  return vertical
    ? [{ x: 0, y: 0, w: Math.floor(W / 2), h: H }, { x: Math.floor(W / 2), y: 0, w: W - Math.floor(W / 2), h: H }]
    : [{ x: 0, y: Math.floor(H / 2), w: W, h: H - Math.floor(H / 2) }, { x: 0, y: 0, w: W, h: Math.floor(H / 2) }];
}
function resize() {
  const s = SETTINGS.pixelScale;
  renderer.setPixelRatio(1);
  W = Math.max(2, Math.floor(innerWidth * s)); H = Math.max(2, Math.floor(innerHeight * s));
  renderer.setSize(W, H, false);
  canvas.style.width = innerWidth + 'px'; canvas.style.height = innerHeight + 'px';
  document.body.classList.toggle('solo', SETTINGS.players === 1);
  const vertical = SETTINGS.split === 'vertical' || (SETTINGS.split === 'auto' && innerWidth >= innerHeight);
  document.body.classList.toggle('hsplit', !vertical);
}
addEventListener('resize', resize);
resize();

// ---------- Interaktion ----------
const _o = new THREE.Vector3(), _d = new THREE.Vector3();
function doChop(p) {
  if (p.model.actionActive) return;
  const r = p.model.playAction('chop') || { duration: 0.55, impactAt: 0.28 };
  p.pendingHit = r.impactAt; p.chopT = r.duration;
}
function impact(p) {
  _o.copy(p.ctrl.pos); _o.y += 1.0;
  p.ctrl.forward(_d);
  const res = world.hitTree(_o, _d, 2.6, 1) || {};
  if (res.hit) {
    p.cam.kick(res.felled ? 1.2 : 0.35);
    input.rumble(SETTINGS.players === 1 ? 0 : p.i, res.felled ? 0.9 : 0.35, res.felled ? 200 : 60);
  }
}

// Spieler gegeneinander
function separatePlayers() {
  if (SETTINGS.players < 2) return;
  const a = players[0].ctrl, b = players[1].ctrl;
  const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), min = a.radius + b.radius;
  if (d < min && d > 1e-4 && Math.abs(a.pos.y - b.pos.y) < 1.6) {
    const push = (min - d) / 2, nx = dx / d, nz = dz / d;
    a.pos.x -= nx * push; a.pos.z -= nz * push; b.pos.x += nx * push; b.pos.z += nz * push;
  }
}

// ---------- Demo (?demo): automatische Eingaben zum Testen ----------
const DEMO = params.has('demo');
let demoT = 0;
function demoIntent(p, o) {
  if (p.i === 0) {
    // zum nächsten Baum laufen und hacken
    const t = world.trees?.filter(t => t.state === 0)
      .reduce((b, t) => { const d = Math.hypot(t.x - p.pos.x, t.z - p.pos.z); return !b || d < b.d ? { t, d } : b; }, null);
    if (t) {
      const want = Math.atan2(t.t.x - p.pos.x, t.t.z - p.pos.z);
      if (t.d > 1.6) { p.cam.yaw = want + Math.PI; o.moveY = 1; o.sprint = t.d > 6; }
      else { p.ctrl.yaw = want; o.chopPressed = true; }
    }
  } else {
    o.moveY = 1; o.moveX = Math.sin(demoT * 0.7) * 0.6;
    o.jump = (demoT % 1.6) < 0.4; o.jumpPressed = (demoT % 1.6) < 0.06;
  }
}

// ---------- Loop ----------
let last = performance.now(), fpsAcc = 0, fpsN = 0, fpsShow = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  if (dt <= 0) return;
  fpsAcc += dt; fpsN++;
  if (fpsAcc > 0.5) { fpsShow = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  PSX.uniforms.uTime.value += dt; demoT += dt;

  const active = players.slice(0, SETTINGS.players);
  const menuOpen = menu.classList.contains('open');
  let menuReq = false;
  for (const p of active) {
    const intent = input.read(p.i, dt);
    if (intent.menuPressed) menuReq = true;
    if (menuOpen) { intent.moveX = intent.moveY = intent.lookX = intent.lookY = 0; intent.jumpPressed = intent.chopPressed = intent.jump = false; }
    if (DEMO) demoIntent(p, intent);
    p.intent = intent;
    if (intent.chopPressed && !p.ctrl.swimming) doChop(p);
    if (intent.wavePressed && !p.model.actionActive) p.model.playAction('wave');

    const mul = p.chopT > 0 ? TUNING.chopMoveMul : 1;
    const steps = dt > 1 / 55 ? 2 : 1;
    for (let s = 0; s < steps; s++) p.ctrl.update(dt / steps, intent, p.cam.yaw, mul);
    if (p.ctrl.landImpact > 0.25) { p.cam.kick(p.ctrl.landImpact * 0.8); input.rumble(p.i, p.ctrl.landImpact * 0.5, 70); }

    if (p.pendingHit !== null) { p.pendingHit -= dt; if (p.pendingHit <= 0) { p.pendingHit = null; impact(p); } }
    p.chopT = Math.max(0, p.chopT - dt);

    const m = p.model;
    m.object3D.position.copy(p.ctrl.pos);
    m.object3D.rotation.y = p.ctrl.yaw;
    m.animate(dt, {
      speed: p.ctrl.speed, maxSpeed: TUNING.runSpeed, grounded: p.ctrl.grounded || p.ctrl.swimming, vy: p.ctrl.vel.y,
      turn: p.ctrl.turn, landImpact: p.ctrl.landImpact, sprint: p.ctrl.sprint, swimming: p.ctrl.swimming,
    });
    p.cam.update(dt, p.ctrl, intent, world);
  }
  // Inaktiver P2 wird versteckt
  players[1].model.object3D.visible = SETTINGS.players === 2;
  separatePlayers();
  input.endFrame();
  if (menuReq) toggleMenu();

  world.update(dt, active.map(p => ({ pos: p.ctrl.pos, vel: p.ctrl.vel })));
  if (fauna) fauna.update(dt, active.map(p => ({ pos: p.ctrl.pos, speed: p.ctrl.speed })));

  // Rendern pro Viewport; Sonne/Schatten folgt dem jeweiligen Spieler
  const vs = views();
  vs.forEach((v, idx) => {
    const p = active[idx];
    p.cam.cam.aspect = v.w / v.h; p.cam.cam.updateProjectionMatrix();
    if (sun) {
      sun.target.position.copy(p.ctrl.pos);
      sun.position.copy(p.ctrl.pos).add(sunOffset);
      sun.target.updateMatrixWorld();
      sun.shadow.needsUpdate = true;
    }
    renderer.setViewport(v.x, v.y, v.w, v.h);
    renderer.setScissor(v.x, v.y, v.w, v.h);
    renderer.render(scene, p.cam.cam);
  });

  // HUD
  const st = world.stats ? world.stats() : {};
  fpsEl.textContent = `${fpsShow} fps · 🪵 ${st.wood ?? 0} · 🌲 ${st.trees ?? '?'} · Logs ${st.logs ?? 0}`;
  active.forEach((p, idx) => {
    const c = p.ctrl;
    let t = `<b>P${p.i + 1}</b> <small>${input.lastDevice[p.i]}</small>`;
    if (SETTINGS.debug) t += `<br><small>v ${c.speed.toFixed(2)} · vy ${c.vel.y.toFixed(2)} · ${c.swimming ? 'schwimmt' : c.grounded ? 'Boden' : 'Luft ' + c.airTime.toFixed(2) + 's'}<br>x ${c.pos.x.toFixed(1)} y ${c.pos.y.toFixed(2)} z ${c.pos.z.toFixed(1)}</small>`;
    hudEls[idx].innerHTML = t;
  });
  hudEls[1].style.display = SETTINGS.players === 2 ? '' : 'none';
}
requestAnimationFrame(frame);
window.__viniland = { world, players, fauna, TUNING, CAM_TUNING, SETTINGS };
if (params.has('dbg')) setInterval(() => {
  const el = document.getElementById('err'); el.style.display = 'block';
  el.textContent = players.map(p => `P${p.i + 1} ${p.model.look?.name} pos ${p.ctrl.pos.toArray().map(n => n.toFixed(2))} cam ${p.cam.cam.position.toArray().map(n => n.toFixed(1))}`).join('\n');
}, 250);
