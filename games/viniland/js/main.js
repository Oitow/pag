// Viniland Testlab – Hauptschleife: Welt, 2 Spieler (Splitscreen), Tiere, Kampf + Bosse, Tuning-Menü.
import * as THREE from 'three';
import { PSX, setPSX } from './psx.js';
import { createWorld } from './world.js';
import { createPlayerModel, PLAYER_LOOKS } from './players.js';
import { Fauna } from './fauna.js';
import { Input, KEY_HELP, PAD_HELP } from './input.js';
import { CharacterController, TUNING } from './controller.js';
import { FollowCamera, CAM_TUNING } from './camera.js';
import { Combat } from './combat.js';
import { Fighter, FIGHT } from './fighter.js';
import { MeshBuilder, rng, clamp } from './kit.js';
import { createBoss, BOSS_TYPES, BOSS_INFO } from './bosses.js';

const params = new URLSearchParams(location.search);
const DEMO = params.has('demo');
const SETTINGS = {
  players: params.get('p') === '1' ? 1 : 2,
  split: 'auto',           // auto | vertical | horizontal
  pixelScale: 0.5,         // interne Auflösung relativ zum Bildschirm (PSX-Pixel)
  snap: 220, dither: true, shadows: true,
  animals: true,
  debug: false,
  hitboxes: false,
  padMode: 'auto',
  keyboard: [true, true],
  looks: [0, 1],
};
try { Object.assign(SETTINGS, JSON.parse(localStorage.getItem('viniland.settings') || '{}')); } catch (e) { /* ok */ }
try { Object.assign(TUNING, JSON.parse(localStorage.getItem('viniland.tuning') || '{}')); } catch (e) { /* ok */ }
try { Object.assign(CAM_TUNING, JSON.parse(localStorage.getItem('viniland.cam') || '{}')); } catch (e) { /* ok */ }
try { const f = JSON.parse(localStorage.getItem('viniland.fight') || '{}'); for (const k in f) if (typeof FIGHT[k] === 'number') FIGHT[k] = f[k]; } catch (e) { /* ok */ }
if (params.get('p')) SETTINGS.players = params.get('p') === '1' ? 1 : 2;
if (params.has('hitbox')) SETTINGS.hitboxes = true;
const save = () => { try {
  localStorage.setItem('viniland.settings', JSON.stringify(SETTINGS));
  localStorage.setItem('viniland.tuning', JSON.stringify(TUNING));
  localStorage.setItem('viniland.cam', JSON.stringify(CAM_TUNING));
  const f = {}; for (const k in FIGHT) if (typeof FIGHT[k] === 'number') f[k] = FIGHT[k];
  localStorage.setItem('viniland.fight', JSON.stringify(f));
} catch (e) { /* ok */ } };

function showError(msg) { const el = document.getElementById('err'); el.style.display = 'block'; el.textContent += msg + '\n'; }
addEventListener('error', e => showError(e.message));

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
const combat = new Combat(scene, world);
combat.debug = SETTINGS.hitboxes;

// ---------- Spieler ----------
const input = new Input(canvas);
const players = [];
const spawnOf = i => (world.spawnPoints && world.spawnPoints[i]) ? world.spawnPoints[i].clone() : new THREE.Vector3(i * 3, 0, 0);
function makePlayer(i) {
  const model = createPlayerModel(SETTINGS.looks[i] ?? i);
  scene.add(model.object3D);
  const ctrl = new CharacterController(world, spawnOf(i), model.radius || 0.35, model.height || 1.75);
  const cam = new FollowCamera(1);
  cam.yaw = Math.PI; // hinter der Figur
  const p = { i, model, ctrl, cam, pos: ctrl.pos, vel: ctrl.vel, get speed() { return ctrl.speed || 0; }, intent: null };
  p.fighter = new Fighter(p, combat, world, {
    rumble: (k, s, ms) => input.rumble(SETTINGS.players === 1 ? 0 : k, s, ms),
    kick: (k, a) => players[k]?.cam.kick(a),
    spawn: () => spawnOf(i),
  });
  return p;
}
for (let i = 0; i < 2; i++) players.push(makePlayer(i));
// Spieler schauen sich zum Start leicht zur Inselmitte hin
for (const p of players) {
  const yaw = Math.atan2(-p.pos.x, -p.pos.z);
  p.ctrl.yaw = yaw; p.cam.yaw = yaw + Math.PI;
}

let fauna = null;
try { if (SETTINGS.animals) fauna = new Fauna(scene, world, seed + 3); } catch (e) { console.error(e); showError('Fauna: ' + e.message); }

// ---------- Bosse ----------
const BOSS = { createBoss, BOSS_TYPES, BOSS_INFO };
const bosses = [];   // { type, home, b, summoned, deadT }
let arenaPts = [], kills = 0, bossErr = false;
function findArenas() {
  const sp = world.spawnPoints?.length ? world.spawnPoints : [new THREE.Vector3()];
  const cx = sp.reduce((s, p) => s + p.x, 0) / sp.length, cz = sp.reduce((s, p) => s + p.z, 0) / sp.length;
  const r = rng(seed * 7 + 11), out = [];
  const trees = world.trees || [];
  for (const strict of [1, 0.6, 0.3, 0]) {
    for (let tries = 0; tries < 1500 && out.length < 3; tries++) {
      const a = r() * Math.PI * 2, d = 60 + r() * 90, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      if (Math.hypot(x, z) > (world.radius || 200) - 18) continue;
      const h = world.heightAt(x, z);
      if (h < 2) continue;
      let ok = true;
      for (let k = 0; k < 10 && ok; k++) {
        const b = k / 10 * Math.PI * 2, hh = world.heightAt(x + Math.cos(b) * 10, z + Math.sin(b) * 10);
        if (hh < 1.2 || Math.abs(hh - h) > 2.2 + (1 - strict) * 4) ok = false;
      }
      if (!ok) continue;
      if (strict > 0.5 && trees.filter(t => t.state === 0 && (t.x - x) ** 2 + (t.z - z) ** 2 < 81).length > 2) continue;
      if (out.some(o => Math.hypot(o.x - x, o.z - z) < 85 * strict + 25)) continue;
      out.push(new THREE.Vector3(x, h, z));
    }
  }
  while (out.length < 3) out.push(new THREE.Vector3(cx + 70 * Math.cos(out.length * 2.1), 0, cz + 70 * Math.sin(out.length * 2.1)));
  return out;
}
function buildArenaMarkers(pts) {
  // kleiner Steinkreis mit Glutschalen, damit man die Arena von weitem sieht
  for (const p of pts) {
    const b = new MeshBuilder();
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * Math.PI * 2 + 0.3, x = Math.cos(a) * 14, z = Math.sin(a) * 14;
      const y = world.heightAt(p.x + x, p.z + z) - p.y;
      b.box(0.9, 2.4 + (k % 3) * 0.5, 0.7, 0x8a8f96, { x, y: y + 1.0, z, ry: a, rz: (k % 2 - 0.5) * 0.12 });
      b.box(1.0, 0.25, 0.8, 0x6a7078, { x, y: y + 2.3 + (k % 3) * 0.5, z, ry: a });
      if (k % 2 === 0) b.cone(0.22, 0.4, 0xff9a3a, { x, y: y + 2.65 + (k % 3) * 0.5, z }, 5);
    }
    const m = b.mesh(); m.position.copy(p); scene.add(m);
  }
}
function spawnBoss(type, home, summoned, yaw) {
  if (!BOSS) return null;
  try {
    const b = BOSS.createBoss(type, { scene, world, combat, home: home.clone(), yaw });
    const e = { type, home: home.clone(), b, summoned, deadT: -1 };
    bosses.push(e);
    return e;
  } catch (err) { console.error(err); showError('Boss ' + type + ': ' + err.message); return null; }
}
function disposeBoss(e) { try { e.b.dispose(); } catch (err) { console.error(err); } combat.removeActor(e.b.actor); const k = bosses.indexOf(e); if (k >= 0) bosses.splice(k, 1); }
function initBosses() {
  if (!arenaPts.length) { arenaPts = findArenas(); buildArenaMarkers(arenaPts); }
  BOSS.BOSS_TYPES.slice(0, 3).forEach((t, k) => spawnBoss(t, arenaPts[k % arenaPts.length], false));
  if (menu.classList.contains('open')) buildMenu();
}
function resetBosses() { while (bosses.length) disposeBoss(bosses[0]); initBosses(); }
function summonBoss(type) {
  const p = players[0], f = p.ctrl.forward(new THREE.Vector3());
  const home = p.ctrl.pos.clone().addScaledVector(f, 15); home.y = world.heightAt(home.x, home.z);
  // gleicher Typ darf nur einmal gerufen existieren
  for (const e of [...bosses]) if (e.summoned && e.type === type) disposeBoss(e);
  return spawnBoss(type, home, true, Math.atan2(p.ctrl.pos.x - home.x, p.ctrl.pos.z - home.z));
}
const bossDead = e => e.b.actor.hp <= 0 || e.b.actor.alive === false;
function updateBosses(dt, plist) {
  for (const e of [...bosses]) {
    try { e.b.update(dt, plist); } catch (err) { if (!bossErr) { bossErr = true; console.error(err); showError('Boss-Update: ' + err.message); } }
    if (bossDead(e)) {
      if (e.deadT < 0) { e.deadT = 0; kills++; for (const p of players) if (p.fighter.lock === e.b.actor) p.fighter.lock = null; }
      e.deadT += dt;
      if (e.deadT > 30) { disposeBoss(e); if (!e.summoned) spawnBoss(e.type, e.home, false); }
    }
  }
}
function bossName(t) { const I = BOSS?.BOSS_INFO?.[t]; return I ? I.name : t; }

// ---------- HUD ----------
const viewEls = [0, 1].map(i => document.getElementById('view' + i));
const hudEls = [document.getElementById('hud0'), document.getElementById('hud1')];
const ui = viewEls.map(v => ({
  hp: v.querySelector('.hp i'), sta: v.querySelector('.sta i'), mana: v.querySelector('.mana i'),
  hpT: v.querySelector('.hp span'), s1: v.querySelector('.s1'), s2: v.querySelector('.s2'),
  s1c: v.querySelector('.s1 i'), s2c: v.querySelector('.s2 i'), s1k: v.querySelector('.s1 b'), s2k: v.querySelector('.s2 b'),
  lock: v.querySelector('.lockm'), boss: v.querySelector('.bossbar'), bn: v.querySelector('.bossbar .bn'),
  bhp: v.querySelector('.bossbar .bbar i'), bstg: v.querySelector('.bossbar .stg i'), bhpL: v.querySelector('.bossbar .bbar u'), flash: v.querySelector('.flash'),
  dead: v.querySelector('.deadmsg'), bossLag: 1, rect: { x: 0, y: 0, w: 1, h: 1 },
}));
const fpsEl = document.getElementById('fps');
const helpEl = document.getElementById('help');
helpEl.innerHTML = KEY_HELP.map(s => `<div>${s}</div>`).join('') + `<div>${PAD_HELP}</div><div><b>Tab / Esc</b> = Menü & Tuning · Bosse: Steinkreise auf der Insel oder im Menü rufen</div>`;
setTimeout(() => helpEl.classList.add('fade'), DEMO ? 10 : 12000);

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
  const bossBtns = BOSS ? BOSS.BOSS_TYPES.map(t => `<button data-act="summon" data-type="${t}">Boss rufen: ${bossName(t)}</button>`).join('') : '<span class="hint">Bosse laden …</span>';
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
  <h3>Kampf</h3>
  <div class="row">${bossBtns}
    <button data-act="bossreset">Bosse zurücksetzen</button>
    <button data-act="hitboxes">Hitboxen zeigen: ${SETTINGS.hitboxes ? 'an' : 'aus'}</button>
    <button data-act="heal">Spieler heilen</button>
  </div>
  <div class="hint">Besiegte Bosse: ${kills} · Arena-Bosse kehren 30 s nach dem Tod zurück.</div>
  <div class="row">
    <button data-act="look0">P1 Look: ${PLAYER_LOOKS[SETTINGS.looks[0]]?.name ?? SETTINGS.looks[0]}</button>
    <button data-act="look1">P2 Look: ${PLAYER_LOOKS[SETTINGS.looks[1]]?.name ?? SETTINGS.looks[1]}</button>
    <button data-act="dither">Dithering ${SETTINGS.dither ? 'an' : 'aus'}</button>
    <button data-act="shadows">Schatten ${SETTINGS.shadows ? 'an' : 'aus'}</button>
    <button data-act="debug">Debug ${SETTINGS.debug ? 'an' : 'aus'}</button>
    <button data-act="reset">Tuning zurücksetzen</button>
  </div>
  ${sec('Grafik', SETTINGS, [['pixelScale', 0.2, 1, 0.05, 'Pixel-Skala'], ['snap', 0, 400, 10, 'Vertex-Snap (0=aus)']])}
  ${sec('Kampfwerte', FIGHT, [['rollSpeed', 4, 16, 0.1, 'Rolle m/s'], ['rollITo', 0.1, 0.55, 0.01, 'Rolle i-frames bis s'], ['buffer', 0, 0.6, 0.01, 'Input-Buffer s'],
    ['staRegen', 5, 100, 1, 'Ausdauer-Regen/s'], ['rollCost', 0, 50, 1, 'Rolle Ausdauer'], ['atkCost', 0, 40, 1, 'Angriff Ausdauer'], ['sprintCost', 0, 40, 1, 'Sprint Ausdauer/s'], ['manaRegen', 0, 40, 0.5, 'Mana-Regen/s']])}
  ${sec('Bewegung', TUNING, [['walkSpeed', 1, 10, 0.1, 'Gehen m/s'], ['runSpeed', 2, 16, 0.1, 'Sprint m/s'], ['accelGround', 5, 120, 1, 'Beschl. Boden'], ['decelGround', 5, 120, 1, 'Bremsen Boden'], ['accelAir', 0, 60, 1, 'Beschl. Luft'], ['turnRate', 2, 30, 0.5, 'Drehrate'], ['gravity', 8, 60, 0.5, 'Schwerkraft'], ['jumpHeight', 0.3, 4, 0.05, 'Sprunghöhe m'], ['lowJumpMul', 1, 5, 0.1, 'Kurzsprung-Mul'], ['fallMul', 1, 4, 0.05, 'Fall-Mul'], ['coyoteTime', 0, 0.4, 0.01, 'Coyote-Zeit'], ['jumpBuffer', 0, 0.4, 0.01, 'Sprung-Puffer'], ['stepHeight', 0.1, 1.2, 0.05, 'Stufenhöhe'], ['slopeLimitDeg', 20, 70, 1, 'Max. Hang °']])}
  ${sec('Kamera', CAM_TUNING, [['distance', 2, 14, 0.1, 'Abstand'], ['height', 0.5, 3, 0.05, 'Höhe'], ['followXZ', 2, 30, 0.5, 'Folgen XZ'], ['followY', 1, 30, 0.5, 'Folgen Y'], ['autoAlign', 0, 4, 0.1, 'Auto-Ausrichtung'], ['fov', 40, 90, 1, 'FOV'], ['sprintFov', 40, 100, 1, 'Sprint-FOV'], ['shake', 0, 3, 0.1, 'Shake']])}
  <p class="hint">Einstellungen werden im Browser gespeichert. URL-Parameter: <code>?p=1</code> (1 Spieler), <code>?seed=42</code>, <code>?hitbox</code>.</p>`;
  menu.querySelector('#mclose').onclick = () => toggleMenu(false);
  menu.querySelectorAll('input[type=range]').forEach(el => el.oninput = () => {
    const obj = { Grafik: SETTINGS, Bewegung: TUNING, Kamera: CAM_TUNING, Kampfwerte: FIGHT }[el.dataset.obj];
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
    if (a === 'split') { SETTINGS.split = { auto: 'vertical', vertical: 'horizontal', horizontal: 'auto' }[SETTINGS.split]; resize(); }
    if (a === 'pad') SETTINGS.padMode = { auto: 'p1', p1: 'p2', p2: 'auto' }[SETTINGS.padMode];
    if (a === 'kb0' || a === 'kb1') { const i = +a.slice(-1); SETTINGS.keyboard[i] = !SETTINGS.keyboard[i]; }
    applyInput();
    if (a === 'dither') { SETTINGS.dither = !SETTINGS.dither; setPSX({ dither: SETTINGS.dither }); }
    if (a === 'shadows') { SETTINGS.shadows = !SETTINGS.shadows; if (sun) sun.castShadow = SETTINGS.shadows; }
    if (a === 'debug') SETTINGS.debug = !SETTINGS.debug;
    if (a === 'hitboxes') { SETTINGS.hitboxes = !SETTINGS.hitboxes; combat.debug = SETTINGS.hitboxes; }
    if (a === 'summon') { summonBoss(b.dataset.type); toggleMenu(false); return; }
    if (a === 'bossreset') resetBosses();
    if (a === 'heal') for (const p of players) { const f = p.fighter; if (f.state === 'dead') f.respawn(); f.hp = FIGHT.maxHp; f.sta = FIGHT.maxSta; f.mana = FIGHT.maxMana; }
    if (a === 'look0' || a === 'look1') {
      const i = +a.slice(-1);
      SETTINGS.looks[i] = (SETTINGS.looks[i] + 1) % PLAYER_LOOKS.length;
      const p = players[i]; scene.remove(p.model.object3D);
      p.model = createPlayerModel(SETTINGS.looks[i]); scene.add(p.model.object3D);
      p.fighter.actor.object3D = p.model.object3D;
    }
    if (a === 'reset') { ['tuning', 'cam', 'fight'].forEach(k => localStorage.removeItem('viniland.' + k)); location.reload(); return; }
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
  // HUD-Container deckungsgleich mit den Viewports (CSS-Pixel; WebGL-y zählt von unten)
  const kx = innerWidth / W, ky = innerHeight / H;
  views().forEach((v, k) => {
    const r = ui[k].rect; r.x = v.x * kx; r.w = v.w * kx; r.h = v.h * ky; r.y = (H - v.y - v.h) * ky;
    Object.assign(viewEls[k].style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px', display: '' });
  });
  if (SETTINGS.players === 1) viewEls[1].style.display = 'none';
}
addEventListener('resize', resize);
resize();

// Spieler gegen Gegner-Kapseln (Bosse) – nicht in den Boss hineinlaufen/-rollen
function separateFromEnemies(active) {
  for (const p of active) {
    const c = p.ctrl;
    for (const a of combat.actors) {
      if (a.team === 'player' || a.alive === false || a.hp <= 0) continue;
      if (c.pos.y > a.pos.y + a.height || c.pos.y + c.height < a.pos.y) continue;
      const dx = c.pos.x - a.pos.x, dz = c.pos.z - a.pos.z, d = Math.hypot(dx, dz), min = c.radius + a.radius * 0.9;
      if (d < min) { const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0; c.pos.x = a.pos.x + nx * min; c.pos.z = a.pos.z + nz * min; }
    }
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
let demoT = 0, demoBoss = null, demoT0 = 0, demoPrev = 0;
function demoIntent(p, o) {
  if (p.i === 0) {
    const f = p.fighter;
    if (!demoBoss && BOSS && demoT > 0.8) { demoBoss = summonBoss(BOSS.BOSS_TYPES[0]); demoT0 = demoT; }
    if (!demoBoss || bossDead(demoBoss)) {
      if (demoBoss && demoBoss.deadT > 3) demoBoss = null;   // neuen rufen
      return;
    }
    const a = demoBoss.b.actor;
    if (!f.lock && f.state !== 'dead') o.lockPressed = true;
    const ph = (demoT - demoT0) % 8, prev = demoPrev; demoPrev = ph;
    const cross = x => (prev < x && ph >= x) || (prev > ph && x < ph);   // Zeitmarke überschritten
    const d = Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) - a.radius;
    if (ph < 3.4) {
      if (d > 1.4) { o.moveY = 1; o.sprint = d > 8; }
      else if ((demoT * 4 | 0) !== ((demoT - 0.05) * 4 | 0)) o.chopPressed = true;
    } else if (ph < 4.4) { if (cross(3.5)) { o.rollPressed = true; o.moveX = 1; } if (cross(4.0)) { o.rollPressed = true; o.moveY = -1; } }
    else if (ph < 5.6) { o.moveY = d < 7 ? -1 : 0; if (cross(5.2)) o.spell1Pressed = true; }
    else { if (d > 2.5) o.moveY = 1; if (cross(6.6)) o.spell2Pressed = true; if (cross(7.4)) { o.rollPressed = true; o.moveX = -1; } }
  } else {
    o.moveY = 1; o.moveX = Math.sin(demoT * 0.7) * 0.6;
    o.jump = (demoT % 1.6) < 0.4; o.jumpPressed = (demoT % 1.6) < 0.06;
  }
}

// ---------- Loop ----------
const _pv = new THREE.Vector3();
let last = performance.now(), fpsAcc = 0, fpsN = 0, fpsShow = 0, frameN = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let el = Math.max(0, (now - last) / 1000); last = now;
  if (el <= 0) return;
  frameN++;
  fpsAcc += el; fpsN++;
  if (fpsAcc > 0.5) { fpsShow = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  // Demo: bei sehr niedriger Framerate (Headless-Test) mehrere Simulationsschritte pro Bild nachholen
  el = Math.min(el, DEMO ? 4 : 0.05);
  while (el > 1e-4) { const dt = Math.min(0.05, el); el -= dt; simulate(dt); }
  render();
}
function simulate(dt) {
  PSX.uniforms.uTime.value += dt; demoT += dt;
  const gdt = combat.stopT > 0 ? 0 : dt;        // Hitstop friert die Spielwelt kurz ein

  const active = players.slice(0, SETTINGS.players);
  const menuOpen = menu.classList.contains('open');
  let menuReq = false;
  for (const p of players) p.fighter.actor.alive = active.includes(p) && p.fighter.state !== 'dead';
  for (const p of active) {
    const intent = input.read(p.i, dt);
    if (intent.menuPressed) menuReq = true;
    if (menuOpen) {
      intent.moveX = intent.moveY = intent.lookX = intent.lookY = 0;
      intent.jumpPressed = intent.chopPressed = intent.jump = intent.rollPressed = intent.spell1Pressed = intent.spell2Pressed = intent.lockPressed = false;
      intent.switchTarget = 0;
    }
    if (DEMO) demoIntent(p, intent);
    p.intent = intent;
    if (intent.wavePressed && !p.model.actionActive && !p.fighter.busy) p.model.playAction('wave');

    if (gdt > 0) {
      const mul = p.fighter.update(gdt, intent, p.cam.yaw);
      const steps = gdt > 1 / 55 ? 2 : 1;
      for (let s = 0; s < steps; s++) p.ctrl.update(gdt / steps, intent, p.cam.yaw, mul);
      if (p.ctrl.landImpact > 0.25) { p.cam.kick(p.ctrl.landImpact * 0.8); input.rumble(p.i, p.ctrl.landImpact * 0.5, 70); }
    } else {
      // während Hitstop Eingaben puffern
      const f = p.fighter;
      if (intent.chopPressed) f.bufAtk = FIGHT.buffer; if (intent.rollPressed) f.bufRoll = FIGHT.buffer;
      if (intent.spell1Pressed) f.bufS1 = FIGHT.buffer; if (intent.spell2Pressed) f.bufS2 = FIGHT.buffer;
    }

    const m = p.model;
    m.object3D.position.copy(p.ctrl.pos);
    m.object3D.rotation.y = p.ctrl.yaw;
    m.animate(gdt, {
      speed: p.ctrl.speed, maxSpeed: TUNING.runSpeed, grounded: p.ctrl.grounded || p.ctrl.swimming, vy: p.ctrl.vel.y,
      turn: p.ctrl.turn, landImpact: p.ctrl.landImpact, sprint: p.ctrl.sprint, swimming: p.ctrl.swimming,
    });
    p.cam.update(dt, p.ctrl, intent, world);
  }
  // Inaktiver P2 wird versteckt
  players[1].model.object3D.visible = SETTINGS.players === 2;
  separatePlayers();
  separateFromEnemies(active);
  input.endFrame();
  if (menuReq) toggleMenu();

  world.update(gdt, active.map(p => ({ pos: p.ctrl.pos, vel: p.ctrl.vel })));
  if (fauna) fauna.update(gdt, active.map(p => ({ pos: p.ctrl.pos, speed: p.ctrl.speed })));
  if (gdt > 0) updateBosses(gdt, active.map(p => ({ actor: p.fighter.actor, pos: p.ctrl.pos, alive: p.fighter.state !== 'dead' })));
  combat.update(dt);
  // Kamera-Shake-Anfragen aus dem Kampf verteilen
  for (const s of combat.shakes) for (const p of active) {
    let d = 0;
    if (!Number.isNaN(s.x)) d = Math.hypot(s.x - p.pos.x, s.z - p.pos.z);
    else { d = 1e9; for (const a of combat.actors) if (a.team !== 'player') d = Math.min(d, Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z)); if (d > 1e8) d = 0; }
    const a = s.amount * clamp(1 - d / 35, 0, 1);
    if (a > 0.02) p.cam.kick(a);
  }
  combat.shakes.length = 0;
}
function render() {
  const active = players.slice(0, SETTINGS.players);
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
  fpsEl.textContent = `${fpsShow} fps · 🪵 ${st.wood ?? 0} · 🌲 ${st.trees ?? '?'} · Logs ${st.logs ?? 0} · 💀 ${kills}`;
  active.forEach((p, idx) => updateHud(p, idx, 1 / 60));
}

function setBar(el, v, max) { const w = (clamp(v / max, 0, 1) * 100).toFixed(1) + '%'; if (el.style.width !== w) el.style.width = w; }
function updateHud(p, idx, dt) {
  const c = p.ctrl, f = p.fighter, u = ui[idx];
  let t = `<b>P${p.i + 1}</b> <small>${input.lastDevice[p.i]}</small>`;
  if (SETTINGS.debug) t += `<br><small>v ${c.speed.toFixed(2)} · vy ${c.vel.y.toFixed(2)} · ${c.swimming ? 'schwimmt' : c.grounded ? 'Boden' : 'Luft ' + c.airTime.toFixed(2) + 's'} · ${f.state}<br>x ${c.pos.x.toFixed(1)} y ${c.pos.y.toFixed(2)} z ${c.pos.z.toFixed(1)}</small>`;
  if (hudEls[idx].innerHTML !== t) hudEls[idx].innerHTML = t;
  setBar(u.hp, f.hp, FIGHT.maxHp); setBar(u.sta, f.sta, FIGHT.maxSta); setBar(u.mana, f.mana, FIGHT.maxMana);
  u.hpT.textContent = Math.ceil(f.hp);
  u.sta.parentElement.classList.toggle('ex', f.exhausted);
  const pad = input.lastDevice[p.i] === 'Gamepad';
  u.s1k.textContent = pad ? 'RB' : p.i === 0 ? '1' : '7';
  u.s2k.textContent = pad ? 'Y' : p.i === 0 ? '2' : '8';
  u.s1c.style.height = (f.cd1 / FIGHT.spell1.cd * 100).toFixed(0) + '%';
  u.s2c.style.height = (f.cd2 / FIGHT.spell2.cd * 100).toFixed(0) + '%';
  u.s1.classList.toggle('nomana', f.mana < FIGHT.spell1.mana);
  u.s2.classList.toggle('nomana', f.mana < FIGHT.spell2.mana);
  u.flash.style.opacity = (f.flash * 0.9).toFixed(2);
  u.dead.style.display = f.state === 'dead' ? '' : 'none';
  if (f.state === 'dead') u.dead.textContent = `Du bist gefallen … ${Math.max(0, FIGHT.respawn - f.deadT).toFixed(1)}`;
  // Lock-On-Markierung
  if (f.lock) {
    _pv.copy(f.lockPoint).project(p.cam.cam);
    const vis = _pv.z < 1 && Math.abs(_pv.x) < 1.1 && Math.abs(_pv.y) < 1.1;
    u.lock.style.display = vis ? '' : 'none';
    if (vis) u.lock.style.transform = `translate(${((_pv.x + 1) / 2 * u.rect.w).toFixed(0)}px, ${((1 - _pv.y) / 2 * u.rect.h).toFixed(0)}px)`;
  } else u.lock.style.display = 'none';
  // Boss-Leiste: gesperrter Boss oder nächster wacher Boss in der Nähe
  let e = bosses.find(b => b.b.actor === f.lock && !bossDead(b)) || null;
  if (!e) {
    let bd = 50;
    for (const b of bosses) {
      if (!b.b.awake || bossDead(b)) continue;
      const d = Math.hypot(b.b.actor.pos.x - c.pos.x, b.b.actor.pos.z - c.pos.z);
      if (d < bd) { bd = d; e = b; }
    }
  }
  u.boss.style.display = e ? '' : 'none';
  if (e) {
    const I = BOSS.BOSS_INFO[e.type] || {}, a = e.b.actor;
    const txt = `<b>${I.name || a.name || e.type}</b> <small>${I.title || a.title || ''}</small>${e.b.phase === 2 ? ' <em>Phase 2</em>' : ''}`;
    if (u.bn.innerHTML !== txt) u.bn.innerHTML = txt;
    const frac = clamp(a.hp / (a.maxHp || I.hp || 1), 0, 1);
    u.bossLag = Math.max(frac, u.bossLag - dt * 0.35);
    u.bhp.style.width = (frac * 100).toFixed(1) + '%';
    u.bhpL.style.width = (u.bossLag * 100).toFixed(1) + '%';
    u.bstg.style.width = (clamp(a.stagger || 0, 0, 1) * 100).toFixed(0) + '%';
  } else u.bossLag = 1;
}
if (BOSS && !bosses.length) initBosses();
requestAnimationFrame(frame);
window.__viniland = { world, players, fauna, combat, bosses, TUNING, CAM_TUNING, FIGHT, SETTINGS, summonBoss, resetBosses };
if (params.has('dbg')) setInterval(() => {
  const el = document.getElementById('err'); el.style.display = 'block';
  el.textContent = players.map(p => `P${p.i + 1} ${p.model.look?.name} ${p.fighter.state} hp ${p.fighter.hp.toFixed(0)} sta ${p.fighter.sta.toFixed(0)} mana ${p.fighter.mana.toFixed(0)} lock ${p.fighter.lock?.name ?? '-'} pos ${p.ctrl.pos.toArray().map(n => n.toFixed(1))}`).join('\n') +
    '\n' + bosses.map(e => `${e.type}${e.summoned ? '*' : ''} hp ${e.b.actor.hp.toFixed(0)}/${e.b.actor.maxHp} ${e.b.awake ? 'wach' : 'schläft'} P${e.b.phase} @ ${e.b.actor.pos.x.toFixed(0)},${e.b.actor.pos.z.toFixed(0)}`).join(' · ') +
    `\nArenen: ${arenaPts.map(a => a.x.toFixed(0) + ',' + a.z.toFixed(0)).join(' | ')} · Kills ${kills} · Frames ${frameN} demoT ${demoT.toFixed(1)} · Hitboxen ${combat.hitboxes.length} · Projektile ${combat.projectiles.length}`;
}, 250);
