// Viniland Testlab – Hauptschleife: Welt (Biome, Atmosphäre pro Ansicht), 2 Spieler (Splitscreen), Tiere, Kampf, Bosse in
// world.bossSlots, Gegner in world.mobZones, RPG (Glut, Stufen, Loot, Inventar, Leuchtfeuer, Siegel/Nebeltore), Musik, Menü.
// Alle Module der anderen Agents werden per Feature-Detection benutzt (ältere Stände laufen weiter).
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
import { psxMat } from './psx.js';
import { ALL_BOSSES, ENEMY_TYPES, spawnBoss as spawnBossAny, spawnEnemy } from './enemies.js';
import { Audio } from './audio.js';
import { BIOMES } from './biomes.js';
import { SPELLS } from './spells.js';
import { OPTIONS, OPTION_DEFS, setOption, onOptionsChange, resetOptions } from './options.js';
import { RARITIES, makeItem, itemName, spellIds, spellDef, weaponIds, RELICS } from './items.js';
import { LootWorld, rollLoot, DROP_INFO } from './loot.js';
import { Progression, wreckLoot, levelCost } from './progression.js';
import { RpgUI, deriveUiIntents } from './ui.js';

const params = new URLSearchParams(location.search);
const DEMO = params.has('demo');
const WARP = Number(params.get('warp')) || 0;   // Test: mind. WARP s Simulation pro Bild (Headless ist sehr langsam)
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
try { const f = JSON.parse(localStorage.getItem('viniland.fight') || '{}'); for (const k in f) if (typeof FIGHT[k] === 'number') FIGHT[k] = f[k]; } catch (e) { /* ok */ }
if (params.get('p')) SETTINGS.players = params.get('p') === '1' ? 1 : 2;
if (params.has('hitbox')) OPTIONS.showHitboxes = true;
const save = () => { try {
  localStorage.setItem('viniland.settings', JSON.stringify(SETTINGS));
  localStorage.setItem('viniland.tuning', JSON.stringify(TUNING));
  localStorage.setItem('viniland.cam', JSON.stringify(CAM_TUNING));
  const f = {}; for (const k in FIGHT) if (typeof FIGHT[k] === 'number') f[k] = FIGHT[k];
  localStorage.setItem('viniland.fight', JSON.stringify(f));
} catch (e) { /* ok */ } };

function showError(msg) { const el = document.getElementById('err'); el.style.display = 'block'; el.textContent += msg + '\n'; }
addEventListener('error', e => showError(e.message));
const once = new Set();
function warnOnce(key, err) { if (once.has(key)) return; once.add(key); console.error(key, err); showError(key + ': ' + (err?.message || err)); }

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
combat.debug = OPTIONS.showHitboxes;
// Schadenszahlen abschaltbar (Option) – auch falls combat.js OPTIONS selbst noch nicht liest
{ const dn = combat.damageNumber.bind(combat); combat.damageNumber = (...a) => (OPTIONS.damageNumbers ? dn(...a) : undefined); }

// ---------- Spieler ----------
const input = new Input(canvas);
const players = [];
const spawnOf = i => {
  if (world.spawnPoints && world.spawnPoints[i]) return world.spawnPoints[i].clone();
  if (world.wreck?.pos) return world.wreck.pos.clone().add(new THREE.Vector3(3 + i * 2, 0, 3));
  return new THREE.Vector3(i * 3, 0, 0);
};
const rumble = (k, s, ms) => { if (OPTIONS.rumble) input.rumble(SETTINGS.players === 1 ? 0 : k, s, ms); };
function makePlayer(i) {
  const model = createPlayerModel(SETTINGS.looks[i] ?? i);
  scene.add(model.object3D);
  const ctrl = new CharacterController(world, spawnOf(i), model.radius || 0.35, model.height || 1.75);
  const cam = new FollowCamera(1);
  cam.yaw = Math.PI; // hinter der Figur
  const p = { i, model, ctrl, cam, pos: ctrl.pos, vel: ctrl.vel, get speed() { return ctrl.speed || 0; }, intent: null, uiSt: {}, prevState: 'free', biomeId: null };
  p.prog = new Progression(i);
  p.fighter = new Fighter(p, combat, world, {
    rumble: (k, s, ms) => rumble(k, s, ms),
    kick: (k, a) => players[k]?.cam.kick(a * OPTIONS.screenShake),
    spawn: () => (p.prog.respawn ? p.prog.respawn.pos.clone() : spawnOf(i)),
  });
  // Start mit Fäusten
  try { if (typeof p.fighter.equipWeapon === 'function') p.fighter.equipWeapon('fists'); } catch (e) { warnOnce('equipWeapon(fists)', e); }
  p.prog.applyTo(p.fighter);
  return p;
}
for (let i = 0; i < 2; i++) players.push(makePlayer(i));
// Spieler schauen zum Start zur Inselmitte
for (const p of players) {
  const yaw = Math.atan2(-p.pos.x, -p.pos.z);
  p.ctrl.yaw = yaw; p.cam.yaw = yaw + Math.PI;
}
const fMax = (f, k) => f['max' + k] ?? FIGHT['max' + k];

let fauna = null;
try { if (SETTINGS.animals) fauna = new Fauna(scene, world, seed + 3); } catch (e) { console.error(e); showError('Fauna: ' + e.message); }

// ---------- Loot / RPG-Welt ----------
const loot = new LootWorld(scene, world);
const sfx = (n, o) => { try { Audio?.sfx?.(n, o); } catch (e) { /* ok */ } };
const sting = n => { try { Audio?.sting?.(n); } catch (e) { /* ok */ } };
function wreckLootPos() {
  if (world.wreck?.lootPos) return world.wreck.lootPos.clone();
  const s = spawnOf(0), c = new THREE.Vector3(-s.x, 0, -s.z).normalize();
  return s.clone().addScaledVector(c, 4);
}
function placeWreckLoot() {
  const at = wreckLootPos();
  for (let k = 0; k < 2; k++) for (const it of wreckLoot(spellIds())) loot.drop(it, at, { scatter: 0.9 });
}
placeWreckLoot();

// Leuchtfeuer (Welt baut Modelle; Fallback: eigenes Leuchtfeuer neben dem Spawn)
const shrines = (world.shrines?.length ? world.shrines : (() => {
  const s = spawnOf(0), c = new THREE.Vector3(-s.x, 0, -s.z).normalize(), pos = s.clone().addScaledVector(c, 9).add(new THREE.Vector3(c.z * 4, 0, -c.x * 4));
  pos.y = world.heightAt(pos.x, pos.z);
  const b = new MeshBuilder();
  b.cyl(0.9, 1.1, 0.3, 0x5a5650, { y: 0.15 }, 8);
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; b.box(0.12, 1.1, 0.12, 0x4a3420, { x: Math.cos(a) * 0.25, y: 0.6, z: Math.sin(a) * 0.25, rz: Math.cos(a) * 0.4, rx: -Math.sin(a) * 0.4 }); }
  b.box(0.08, 1.6, 0.08, 0x2a2a2a, { y: 0.9, rz: 0.15 });
  const m = b.mesh(); m.position.copy(pos); scene.add(m);
  const fl = new MeshBuilder(); fl.cone(0.32, 0.9, 0xff8a20, { y: 0.75 }, 6); fl.cone(0.18, 0.6, 0xffe080, { y: 0.7 }, 5);
  const fm = fl.mesh(psxMat({ emissive: new THREE.Color(0xff6a10) })); fm.position.copy(pos); scene.add(fm);
  return [{ id: 'shrine_start', biome: 'kueste', pos, fallback: true, flame: fm }];
})()).map(s => ({ ...s, name: s.name || ('Leuchtfeuer ' + (BIOMES.find(b => b.id === s.biome)?.name || '')) }));
const gates = () => world.gates || [];

// ---------- Bosse + Gegner ----------
const bossInfo = t => ALL_BOSSES?.[t] || {};
const foes = [];   // { kind:'boss'|'mob', type, home, b, summoned, deadT, slotKey?, zone?, rewarded }
const defeated = new Set();   // slotKeys besiegter Bosse (bleiben tot bis „Bosse zurücksetzen“)
let arenaPts = [], kills = 0, foeErr = false, legacySlots = null;
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
/** Boss-Slots: world.bossSlots (Welt-Agent) oder Fallback: 3 Steinkreise wie bisher */
function bossSlots() {
  if (world.bossSlots?.length) return world.bossSlots;
  if (!legacySlots) {
    arenaPts = findArenas(); buildArenaMarkers(arenaPts);
    legacySlots = arenaPts.map((pos, index) => ({ biome: 'kueste', index, key: index === 2, pos }));
  }
  return legacySlots;
}
/** Welcher Boss-Typ gehört in welchen Slot: Typen mit gleichem Biom, Siegelträger in den key-Slot */
function typeForSlot(slot) {
  const types = Object.keys(ALL_BOSSES || {});
  const inB = types.filter(t => (bossInfo(t).biome || 'kueste') === slot.biome);
  if (slot.type && ALL_BOSSES[slot.type]) return slot.type;
  if (slot.key) return inB.find(t => bossInfo(t).key) || null;
  const normal = inB.filter(t => !bossInfo(t).key);
  const idx = world.bossSlots ? world.bossSlots.filter(s => s.biome === slot.biome && !s.key).indexOf(slot) : slot.index;
  return normal[idx] ?? null;
}
const slotKey = s => `${s.biome}:${s.index}`;
function spawnFoe(kind, type, home, opt = {}) {
  try {
    const o = { scene, world, combat, home: home.clone(), yaw: opt.yaw };
    const b = kind === 'boss' ? spawnBossAny(type, o) : spawnEnemy(type, o);
    if (!b) return null;
    const e = { kind, type, home: home.clone(), b, deadT: -1, rewarded: false, ...opt };
    foes.push(e);
    return e;
  } catch (err) { warnOnce((kind === 'boss' ? 'Boss ' : 'Gegner ') + type, err); return null; }
}
function disposeFoe(e) {
  try { e.b.dispose?.(); } catch (err) { console.error(err); }
  combat.removeActor(e.b.actor);
  const k = foes.indexOf(e); if (k >= 0) foes.splice(k, 1);
  for (const p of players) if (p.fighter.lock === e.b.actor) p.fighter.lock = null;
}
function initBosses() {
  for (const s of bossSlots()) {
    if (defeated.has(slotKey(s))) continue;
    const t = typeForSlot(s);
    if (t) spawnFoe('boss', t, s.pos, { slotKey: slotKey(s), key: !!s.key, biome: s.biome });
  }
  if (menu.classList.contains('open')) buildMenu();
}
function resetBosses() { for (const e of foes.filter(e => e.kind === 'boss')) disposeFoe(e); defeated.clear(); initBosses(); }
function summonBoss(type) {
  const p = players[0], f = p.ctrl.forward(new THREE.Vector3());
  const home = p.ctrl.pos.clone().addScaledVector(f, 15); home.y = world.heightAt(home.x, home.z);
  for (const e of [...foes]) if (e.summoned && e.type === type) disposeFoe(e);
  return spawnFoe('boss', type, home, { summoned: true, yaw: Math.atan2(p.ctrl.pos.x - home.x, p.ctrl.pos.z - home.z) });
}
function summonEnemy(id, dist = 10) {
  const p = players[0], f = p.ctrl.forward(new THREE.Vector3());
  const home = p.ctrl.pos.clone().addScaledVector(f, dist); home.y = world.heightAt(home.x, home.z);
  return spawnFoe('mob', id, home, { summoned: true, yaw: Math.atan2(p.ctrl.pos.x - home.x, p.ctrl.pos.z - home.z) });
}

// Mob-Zonen: werden erst in Spielernähe gespawnt (Performance), getötete bleiben weg bis zum Rasten
const zones = (world.mobZones || []).map((z, k) => ({ ...z, k, spawned: false, killed: 0, r: rng(seed * 13 + k * 101) }));
function zoneTypes(z) {
  const ids = Object.keys(ENEMY_TYPES || {});
  const want = z.types || BIOMES.find(b => b.id === z.biome)?.mobs || [];
  const list = want.filter(id => ENEMY_TYPES[id]);
  return list.length ? list : ids.filter(id => (ENEMY_TYPES[id].biome || 'kueste') === z.biome);
}
function spawnZone(z) {
  z.spawned = true;
  const types = zoneTypes(z); if (!types.length) return;
  const n = Math.max(0, Math.min(4, z.count || 3) - z.killed);   // max. 4 je Zone (Draw-Calls)
  for (let k = 0; k < n; k++) {
    const a = z.r() * Math.PI * 2, d = Math.sqrt(z.r()) * (z.radius || 10) * 0.8;
    const pos = new THREE.Vector3(z.pos.x + Math.cos(a) * d, 0, z.pos.z + Math.sin(a) * d); pos.y = world.heightAt(pos.x, pos.z);
    if (world.waterLevel !== undefined && pos.y < world.waterLevel + 0.3) continue;
    spawnFoe('mob', types[Math.floor(z.r() * types.length)], pos, { zone: z, yaw: z.r() * 6.28 });
  }
}
function updateZones(active) {
  for (const z of zones) {
    let d = 1e9; for (const p of active) d = Math.min(d, Math.hypot(p.pos.x - z.pos.x, p.pos.z - z.pos.z));
    if (!z.spawned && d < Math.min(90, (z.radius || 10) + 75)) spawnZone(z);
    else if (z.spawned && d > (z.radius || 10) + 130) { for (const e of foes.filter(e => e.zone === z && e.deadT < 0)) disposeFoe(e); z.spawned = false; }
  }
}
function respawnMobs() {
  for (const e of foes.filter(e => e.kind === 'mob' && !e.summoned)) disposeFoe(e);
  for (const z of zones) { z.killed = 0; z.spawned = false; }
}
const foeDead = e => e.b.actor.hp <= 0 || e.b.actor.alive === false;

/** Tod eines Gegners/Bosses: Glut für alle (Koop), Loot in die Welt, Siegel, Musik-Sting */
function rewardFoe(e) {
  e.rewarded = true; kills++;
  const a = e.b.actor, pos = a.pos.clone();
  let table, glut, ctx = {};
  if (e.kind === 'boss') {
    const I = bossInfo(e.type);
    table = I.loot || 'boss_' + e.type;
    glut = I.glut ?? Math.round((I.hp || a.maxHp || 800) * 1.2);
    ctx = { bossType: e.type, key: !e.summoned && (e.key || I.key), biome: e.biome || I.biome || 'kueste' };
    if (e.slotKey) defeated.add(e.slotKey);
  } else {
    const T = ENEMY_TYPES?.[e.type] || {};
    table = T.loot || 'mob_common';
    glut = T.glut;
    if (e.zone) e.zone.killed++;
  }
  const res = rollLoot(table, ctx);
  glut = glut ?? res.glut;
  for (const it of res.items) loot.drop(it, pos, { scatter: e.kind === 'boss' ? 2.2 : 1.2 });
  const active = players.slice(0, SETTINGS.players);
  for (const p of active) {
    const v = p.prog.addGlut(glut);
    const near = Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z) < 80;
    if (near) { let got = 0; const n = clamp(Math.round(4 + glut / 40), 4, e.kind === 'boss' ? 40 : 14); loot.glut.burst(pos, p, n, () => { if (got++ % 3 === 0) sfx('coin', { vol: 0.4, pitch: 0.9 + Math.random() * 0.3 }); }); }
    p.ui.popup(`+${v} Glut`, '#ffd890', '');
  }
  if (e.kind === 'boss') {
    sting('victory');
    for (const p of active) p.ui.showTitle(e.key || bossInfo(e.type).key ? 'Siegelträger gefällt' : 'Großer Feind gefällt', bossInfo(e.type).name || '', 'banner');
  }
}
function updateFoes(dt, plist, active) {
  for (const e of [...foes]) {
    // weit entfernte Gegner pausieren (Performance)
    let d = 1e9; for (const p of active) d = Math.min(d, Math.hypot(p.pos.x - e.b.actor.pos.x, p.pos.z - e.b.actor.pos.z));
    if (d < (e.kind === 'boss' ? 160 : 110) || e.deadT >= 0) {
      try { e.b.update(dt, plist); } catch (err) { if (!foeErr) { foeErr = true; warnOnce('Gegner-Update ' + e.type, err); } }
    }
    if (foeDead(e)) {
      if (e.deadT < 0) { e.deadT = 0; for (const p of players) if (p.fighter.lock === e.b.actor) p.fighter.lock = null; }
      if (!e.rewarded) rewardFoe(e);
      e.deadT += dt;
      if (e.deadT > (e.kind === 'boss' ? 12 : 6)) disposeFoe(e);
    }
  }
}
function foeName(e) { return e.kind === 'boss' ? (bossInfo(e.type).name || e.type) : (ENEMY_TYPES?.[e.type]?.name || e.type); }

// ---------- HUD ----------
const viewEls = [0, 1].map(i => document.getElementById('view' + i));
const hudEls = [document.getElementById('hud0'), document.getElementById('hud1')];
const ui = viewEls.map(v => ({
  hp: v.querySelector('.hp i'), sta: v.querySelector('.sta i'), mana: v.querySelector('.mana i'),
  hpT: v.querySelector('.hp span'), s1: v.querySelector('.s1'), s2: v.querySelector('.s2'),
  s1c: v.querySelector('.s1 i'), s2c: v.querySelector('.s2 i'), s1k: v.querySelector('.s1 b'), s2k: v.querySelector('.s2 b'),
  s1i: v.querySelector('.s1 span'), s2i: v.querySelector('.s2 span'),
  lock: v.querySelector('.lockm'), boss: v.querySelector('.bossbar'), bn: v.querySelector('.bossbar .bn'),
  bhp: v.querySelector('.bossbar .bbar i'), bstg: v.querySelector('.bossbar .stg i'), bhpL: v.querySelector('.bossbar .bbar u'), flash: v.querySelector('.flash'),
  dead: v.querySelector('.deadmsg'), bossLag: 1, rect: { x: 0, y: 0, w: 1, h: 1 },
}));
const fpsEl = document.getElementById('fps');
const helpEl = document.getElementById('help');
helpEl.innerHTML = KEY_HELP.map(s => `<div>${s}</div>`).join('') + `<div>${PAD_HELP}</div><div><b>Esc / Start</b> = Menü & Optionen · <b>Tab / View</b> = Inventar · Leuchtfeuer: rasten, Stufe aufsteigen, schmieden · Wrack: erste Waffe</div>`;
setTimeout(() => helpEl.classList.add('fade'), DEMO ? 10 : 12000);

// Tastenbeschriftungen (Kampf-Agent legt die echten Belegungen in input.js fest; das hier sind die Anzeige-Labels)
const FALLBACK_KEYS = [
  { interact: ['KeyE', 'KeyB'], inventory: ['KeyI', 'Digit5', 'Backquote'] },
  { interact: ['Quote', 'Backslash'], inventory: ['Digit6', 'BracketRight'] },
];
const LABELS = {
  kb: [{ interact: 'G', inventory: 'Tab', confirm: 'Leertaste', back: 'C', nav: 'WASD', tabL: 'Q', tabR: 'E', flask: '3' },
       { interact: '0', inventory: '⌫', confirm: 'Enter', back: 'M', nav: 'Pfeile', tabL: 'U', tabR: 'O', flask: '9' }],
  pad: { interact: '↑', inventory: 'View', confirm: 'A', back: 'B', nav: 'Stick', tabL: 'LB', tabR: 'RB', flask: 'X' },
};
const keyLabel = (i, a) => (input.lastDevice[i] === 'Gamepad' ? LABELS.pad[a] : LABELS.kb[i][a]) || '?';
const padPrev = [{}, {}];
/** fehlende RPG-Intents (älteres input.js) aus Rohdaten ergänzen */
function fallbackIntents(i, o) {
  const km = FALLBACK_KEYS[i], kb = list => SETTINGS.keyboard[i] && list.some(k => input.pressed.has(k));
  const pad = input.padFor(i), pv = padPrev[i];
  const edge = n => { const b = pad?.buttons[n]; const d = !!(b && (b.pressed || b.value > 0.5)); const r = d && !pv[n]; pv[n] = d; return r; };
  // KeyE ist bei P1 Kamera rechts → nur nutzen, wenn input.js kein interactPressed liefert
  if (!('interactPressed' in o)) o.interactPressed = kb(km.interact) || edge(15);
  else edge(15);
  if (!('inventoryPressed' in o)) o.inventoryPressed = kb(km.inventory) || edge(8);
  else edge(8);
}

// ---------- RPG-UI pro Ansicht ----------
const inCombat = p => foes.some(e => !foeDead(e) && e.b.awake && Math.hypot(e.b.actor.pos.x - p.pos.x, e.b.actor.pos.z - p.pos.z) < 30);
function healFull(p) {
  const f = p.fighter;
  if (f.state === 'dead') f.respawn();
  f.hp = fMax(f, 'Hp'); f.sta = fMax(f, 'Sta'); f.mana = fMax(f, 'Mana');
  p.prog.refillFlask(f);
}
function restAt(p, shrine) {
  healFull(p);
  p.prog.respawn = { id: shrine.id, pos: shrine.pos.clone().add(new THREE.Vector3(1.6, 0, 1.6)) };
  respawnMobs();
  combat.fx('heal', new THREE.Vector3(p.pos.x, p.pos.y + 1, p.pos.z), 26);
  sfx('heal');
}
for (const p of players) {
  p.ui = new RpgUI(viewEls[p.i], {
    prog: p.prog, get fighter() { return p.fighter; }, i: p.i,
    keyLabel: a => keyLabel(p.i, a), inCombat: () => inCombat(p),
    sfx: n => sfx(n, { vol: 0.5 }),
    onRest: () => { if (p.shrine) restAt(p, p.shrine); },
    onLevelUp: alloc => { const ok = p.prog.levelUp(alloc); if (ok) { p.prog.applyTo(p.fighter); healFull(p); sting('levelup'); p.ui.showTitle('Stufe ' + p.prog.level, 'Die Glut stärkt dich', 'banner'); } return ok; },
    onForge: uid => { const t = p.prog.forge(uid); p.prog.applyTo(p.fighter); if (t.endsWith('geschmiedet')) sfx('hitHeavy', { pitch: 1.4 }); return t; },
    onEquip: () => p.prog.applyTo(p.fighter),
    onOptionChange: () => applyOptions(),
    onClose: () => { p.shrine = null; },
  });
}

// ---------- Optionen anwenden ----------
function applyOptions() {
  combat.debug = OPTIONS.showHitboxes;
  document.body.style.setProperty('--hud', OPTIONS.hudScale);
  try { Audio?.setVolume?.({ music: OPTIONS.musicVol, sfx: OPTIONS.sfxVol }); } catch (e) { /* ok */ }
}
onOptionsChange(applyOptions);
applyOptions();

// ---------- Musik ----------
let audioOn = false;
function startAudio() {
  if (audioOn) return; audioOn = true;
  try { Audio?.init?.(); applyOptions(); lastMusic = ''; } catch (e) { warnOnce('Audio.init', e); }
}
addEventListener('keydown', startAudio, { once: false });
addEventListener('pointerdown', startAudio);
let lastMusic = '', musicT = 0;
function updateMusic(dt, active) {
  if ((musicT -= dt) > 0) return; musicT = 0.5;
  const p = active[0]; if (!p) return;
  let combatKind = null, intensity = 0.25, bd = 45;
  for (const e of foes) {
    if (foeDead(e) || !e.b.awake) continue;
    for (const q of active) {
      const d = Math.hypot(e.b.actor.pos.x - q.pos.x, e.b.actor.pos.z - q.pos.z);
      if (e.kind === 'boss' && d < bd) { bd = d; combatKind = (e.key || bossInfo(e.type).key) ? 'key' : 'boss'; }
      if (e.kind === 'mob' && d < 25) intensity = Math.max(intensity, 0.65);
    }
  }
  if (combatKind) intensity = 1;
  const biome = p.biomeId || 'kueste';
  const key = `${biome}|${combatKind}|${intensity}`;
  if (key === lastMusic) return;
  lastMusic = key;
  try { Audio?.setMusic?.({ biome, combat: combatKind, intensity }); } catch (e) { warnOnce('Audio.setMusic', e); }
}

// ---------- Biome / Interaktion ----------
const visited = new Set();
let biomeT = 0;
function updateBiomes(dt, active) {
  if ((biomeT -= dt) > 0) return; biomeT = 0.3;
  if (typeof world.biomeAt !== 'function') { for (const p of active) if (!p.biomeId) { p.biomeId = 'kueste'; p.ui.showTitle('Graue Küste', 'Viniland'); } return; }
  for (const p of active) {
    let b = null; try { b = world.biomeAt(p.pos.x, p.pos.z); } catch (e) { warnOnce('world.biomeAt', e); }
    if (!b || b.id === p.biomeId) continue;
    p.biomeId = b.id;
    p.ui.showTitle(b.name, visited.has(b.id) ? '' : (b.placeholder ? 'Unerforschtes Land' : 'Neues Gebiet entdeckt'));
    if (!visited.has(b.id)) { if (visited.size) sting('discovery'); visited.add(b.id); }
  }
}
function interactTarget(p) {
  const d = loot.nearest(p.pos, p.i);
  if (d) return { kind: 'drop', d, text: (d.inst.kind === 'glutrest' ? 'Aufheben: ' : 'Aufheben: ') + loot.label(d) };
  for (const s of shrines) if (Math.hypot(s.pos.x - p.pos.x, s.pos.z - p.pos.z) < 3.2) return { kind: 'shrine', s, text: p.prog.kindled.has(s.id) ? 'Am Leuchtfeuer rasten' : 'Leuchtfeuer entzünden' };
  for (const g of gates()) {
    if (g.open) continue;
    const dx = p.pos.x - g.pos.x, dz = p.pos.z - g.pos.z;
    if (Math.hypot(dx, dz) > (g.width || 8) / 2 + 3) continue;
    const has = players.slice(0, SETTINGS.players).some(q => q.prog.hasSigil(g.fromBiome));
    const need = BIOMES.find(b => b.id === g.fromBiome)?.name || g.fromBiome;
    return { kind: 'gate', g, has, text: has ? 'Siegel einsetzen – Nebeltor öffnen' : `Nebeltor – versiegelt (Siegel: ${need})` };
  }
  return null;
}
function pickUp(p, d) {
  if (d.inst.kind === 'glutrest') {
    p.prog.addGlut(d.glut, { raw: true }); if (p.prog.glutrest === d) p.prog.glutrest = null;
    p.ui.popup(`Glutrest geborgen: ${d.glut}`, '#ffd890'); sfx('coin');
  } else {
    const t = p.prog.addItem(d.inst);
    p.prog.applyTo(p.fighter);
    p.ui.popup(t, RARITIES[d.inst.rarity]?.css);
    sfx('pickup');
    if (d.inst.kind === 'sigil') { sting('discovery'); p.ui.showTitle(itemName(d.inst), 'Ein Nebeltor wird sich öffnen', 'banner'); }
  }
  loot.remove(d);
}
function doInteract(p, t) {
  if (!t) return;
  if (t.kind === 'drop') pickUp(p, t.d);
  else if (t.kind === 'shrine') {
    const s = t.s;
    if (!p.prog.kindled.has(s.id)) {
      p.prog.kindled.add(s.id); sting('discovery'); p.ui.showTitle('Leuchtfeuer entzündet', s.name, 'banner');
      p.prog.respawn = { id: s.id, pos: s.pos.clone().add(new THREE.Vector3(1.6, 0, 1.6)) };
    }
    p.shrine = s;
    restAt(p, s);
    p.ui.open('shrine');
  } else if (t.kind === 'gate') {
    if (!t.has) { sfx('block'); p.ui.popup('Das Siegel fehlt.', '#c08070', ''); return; }
    try { world.setGateOpen?.(t.g.id, true); t.g.open = true; } catch (e) { warnOnce('world.setGateOpen', e); }
    sting('discovery'); sfx('gate');
    for (const q of players.slice(0, SETTINGS.players)) q.ui.showTitle('Nebeltor geöffnet', BIOMES.find(b => b.id === t.g.toBiome)?.name || '', 'banner');
  }
}
function updateRpg(p) {
  const f = p.fighter;
  // Tod → Glutrest am Todesort (alter Rest verfällt)
  if (f.state === 'dead' && p.prevState !== 'dead') {
    p.prog.deaths++;
    if (p.prog.glutrest) { loot.remove(p.prog.glutrest); p.prog.glutrest = null; }
    if (p.prog.glut > 0) {
      const inst = { uid: 'rest' + p.i + Date.now(), kind: 'glutrest', rarity: 'legendary', def: 'glutrest' };
      p.prog.glutrest = loot.drop(inst, p.pos, { scatter: 0, owner: p.i, glut: p.prog.glut });
      p.prog.glut = 0;
    }
    sting('death'); p.ui.showTitle('Du bist gefallen', '', 'banner death');
    if (p.ui.isOpen) p.ui.close();
  }
  if (f.state !== 'dead' && p.prevState === 'dead') { p.prog.refillFlask(f); p.prog.dirty = true; }
  p.prevState = f.state;
  if (p.prog.dirty) p.prog.applyTo(f);
  // Interaktion
  const t = f.state === 'dead' ? null : interactTarget(p);
  p.ui.setPrompt(t && !(OPTIONS.autoPickup && t.kind === 'drop' && t.d.inst.kind !== 'sigil') ? t.text : '');
  if (t && t.kind === 'drop' && (t.d.inst.kind === 'glutrest' || OPTIONS.autoPickup) && Math.hypot(t.d.pos.x - p.pos.x, t.d.pos.z - p.pos.z) < 1.3 && t.d.pop <= 0) pickUp(p, t.d);
  else if (p.intent.interactPressed && !p.ui.isOpen) doInteract(p, t);
  p.ui.update();
}

// ---------- Menü (Tuning + Optionen + RPG) ----------
const menu = document.getElementById('menu');
let menuTab = 'spiel';
function buildMenu() {
  const sec = (title, obj, defs) => {
    let h = `<h3>${title}</h3>`;
    for (const [k, min, max, step, label] of defs) {
      h += `<label><span>${label || k}</span><input type="range" data-obj="${title}" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${obj[k]}"><em>${(+obj[k]).toFixed(2)}</em></label>`;
    }
    return h;
  };
  const tabs = `<div class="mtabs">${[['spiel', 'Spiel'], ['optionen', 'Optionen'], ['rpg', 'RPG'], ['tuning', 'Tuning']].map(([id, n]) => `<button data-tab="${id}" class="${menuTab === id ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  let body = '';
  if (menuTab === 'spiel') {
    const bossBtns = Object.keys(ALL_BOSSES || {}).map(t => `<button data-act="summon" data-type="${t}">Boss: ${bossInfo(t).name || t}${bossInfo(t).key ? ' ⚜' : ''}</button>`).join('');
    const mobBtns = Object.keys(ENEMY_TYPES || {}).slice(0, 12).map(id => `<button data-act="summonmob" data-type="${id}">${ENEMY_TYPES[id].name || id}</button>`).join('');
    body = `
  <div class="row">
    <button data-act="players">${SETTINGS.players === 2 ? '👥 2 Spieler' : '👤 1 Spieler'}</button>
    <button data-act="split">Split: ${SETTINGS.split}</button>
    <button data-act="pad">Gamepad 1 → ${{ auto: 'Auto', p1: 'Spieler 1', p2: 'Spieler 2' }[SETTINGS.padMode]}</button>
    <button data-act="kb0">Tastatur P1 ${SETTINGS.keyboard[0] ? 'an' : 'aus'}</button>
    <button data-act="kb1">Tastatur P2 ${SETTINGS.keyboard[1] ? 'an' : 'aus'}</button>
  </div>
  <div class="pads">${padInfo()}</div>
  <h3>Kampf</h3>
  <div class="row">${bossBtns}</div>
  <div class="row">${mobBtns ? 'Gegner rufen: ' + mobBtns : ''}</div>
  <div class="row"><button data-act="bossreset">Bosse zurücksetzen</button><button data-act="heal">Spieler heilen</button></div>
  <div class="hint">Besiegt: ${kills} · Bosse aktiv: ${foes.filter(e => e.kind === 'boss' && !foeDead(e)).length} · Gegner aktiv: ${foes.filter(e => e.kind === 'mob' && !foeDead(e)).length} · Zonen: ${zones.length}</div>
  <div class="row">
    <button data-act="look0">P1 Look: ${PLAYER_LOOKS[SETTINGS.looks[0]]?.name ?? SETTINGS.looks[0]}</button>
    <button data-act="look1">P2 Look: ${PLAYER_LOOKS[SETTINGS.looks[1]]?.name ?? SETTINGS.looks[1]}</button>
    <button data-act="dither">Dithering ${SETTINGS.dither ? 'an' : 'aus'}</button>
    <button data-act="shadows">Schatten ${SETTINGS.shadows ? 'an' : 'aus'}</button>
    <button data-act="debug">Debug ${SETTINGS.debug ? 'an' : 'aus'}</button>
  </div>
  ${sec('Grafik', SETTINGS, [['pixelScale', 0.2, 1, 0.05, 'Pixel-Skala'], ['snap', 0, 400, 10, 'Vertex-Snap (0=aus)']])}`;
  } else if (menuTab === 'optionen') {
    body = '<h3>Optionen</h3>' + OPTION_DEFS.map(([k, type, label, min, max, step, names]) => type === 'bool'
      ? `<label class="opt"><span>${label}</span><button data-opt="${k}">${names ? names[OPTIONS[k] ? 1 : 0] : OPTIONS[k] ? 'An' : 'Aus'}</button><em></em></label>`
      : `<label><span>${label}</span><input type="range" data-opt="${k}" min="${min}" max="${max}" step="${step}" value="${OPTIONS[k]}"><em>${(+OPTIONS[k]).toFixed(2)}</em></label>`).join('') +
      `<div class="row"><button data-act="optreset">Optionen zurücksetzen</button></div><p class="hint">Auch im Spiel: Inventar → Reiter „Optionen“ (per Gamepad bedienbar).</p>`;
  } else if (menuTab === 'rpg') {
    body = '<h3>RPG / Test</h3>' + players.slice(0, SETTINGS.players).map(p => `<div class="hint">P${p.i + 1}: Stufe ${p.prog.level} · Glut ${p.prog.glut} (nächste Stufe ${p.prog.nextCost}) · Items ${p.prog.inventory.length} · Flakon ${p.prog.flaskMax} · Tode ${p.prog.deaths}</div>`).join('') +
      `<div class="row"><button data-act="glut">+1000 Glut (alle)</button><button data-act="items">Zufalls-Loot (P1)</button><button data-act="stones">+3 Schmiedesteine (alle)</button><button data-act="sigil">Siegel Graue Küste (P1)</button><button data-act="respawnmobs">Gegner respawnen</button></div>
      <p class="hint">Stufenkosten: 60 + 40·L + 6·L² → ${[1, 2, 5, 10, 20].map(L => `${L}→${L + 1}: ${levelCost(L)}`).join(' · ')}</p><p class="hint">${DROP_INFO}</p>`;
  } else {
    body = `<div class="row"><button data-act="reset">Tuning zurücksetzen</button></div>
  ${sec('Kampfwerte', FIGHT, [['rollSpeed', 4, 16, 0.1, 'Rolle m/s'], ['rollITo', 0.1, 0.55, 0.01, 'Rolle i-frames bis s'], ['buffer', 0, 0.6, 0.01, 'Input-Buffer s'],
    ['staRegen', 5, 100, 1, 'Ausdauer-Regen/s'], ['rollCost', 0, 50, 1, 'Rolle Ausdauer'], ['atkCost', 0, 40, 1, 'Angriff Ausdauer'], ['sprintCost', 0, 40, 1, 'Sprint Ausdauer/s'], ['manaRegen', 0, 40, 0.5, 'Mana-Regen/s']].filter(d => typeof FIGHT[d[0]] === 'number'))}
  ${sec('Bewegung', TUNING, [['walkSpeed', 1, 10, 0.1, 'Gehen m/s'], ['runSpeed', 2, 16, 0.1, 'Sprint m/s'], ['accelGround', 5, 120, 1, 'Beschl. Boden'], ['decelGround', 5, 120, 1, 'Bremsen Boden'], ['accelAir', 0, 60, 1, 'Beschl. Luft'], ['turnRate', 2, 30, 0.5, 'Drehrate'], ['gravity', 8, 60, 0.5, 'Schwerkraft'], ['jumpHeight', 0.3, 4, 0.05, 'Sprunghöhe m'], ['lowJumpMul', 1, 5, 0.1, 'Kurzsprung-Mul'], ['fallMul', 1, 4, 0.05, 'Fall-Mul'], ['coyoteTime', 0, 0.4, 0.01, 'Coyote-Zeit'], ['jumpBuffer', 0, 0.4, 0.01, 'Sprung-Puffer'], ['stepHeight', 0.1, 1.2, 0.05, 'Stufenhöhe'], ['slopeLimitDeg', 20, 70, 1, 'Max. Hang °']])}
  ${sec('Kamera', CAM_TUNING, [['distance', 2, 14, 0.1, 'Abstand'], ['height', 0.5, 3, 0.05, 'Höhe'], ['followXZ', 2, 30, 0.5, 'Folgen XZ'], ['followY', 1, 30, 0.5, 'Folgen Y'], ['autoAlign', 0, 4, 0.1, 'Auto-Ausrichtung'], ['fov', 40, 90, 1, 'FOV'], ['sprintFov', 40, 100, 1, 'Sprint-FOV'], ['shake', 0, 3, 0.1, 'Shake']])}`;
  }
  menu.innerHTML = `<div class="mhead"><b>Viniland Testlab</b><button id="mclose">✕</button></div>${tabs}${body}
  <p class="hint">Einstellungen werden im Browser gespeichert. URL: <code>?p=1</code> · <code>?seed=42</code> · <code>?hitbox</code> · <code>?demo</code> · <code>?dbg</code></p>`;
  menu.querySelector('#mclose').onclick = () => toggleMenu(false);
  menu.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { menuTab = b.dataset.tab; buildMenu(); });
  menu.querySelectorAll('[data-opt]').forEach(el => {
    if (el.tagName === 'BUTTON') el.onclick = e => { e.preventDefault(); setOption(el.dataset.opt, !OPTIONS[el.dataset.opt]); buildMenu(); };
    else el.oninput = () => { setOption(el.dataset.opt, +el.value); el.nextElementSibling.textContent = (+OPTIONS[el.dataset.opt]).toFixed(2); };
  });
  menu.querySelectorAll('input[type=range][data-obj]').forEach(el => el.oninput = () => {
    const obj = { Grafik: SETTINGS, Bewegung: TUNING, Kamera: CAM_TUNING, Kampfwerte: FIGHT }[el.dataset.obj];
    obj[el.dataset.k] = +el.value;
    el.nextElementSibling.textContent = (+el.value).toFixed(2);
    if (el.dataset.k === 'snap') setPSX({ snap: +el.value });
    if (el.dataset.k === 'distance') players.forEach(p => p.cam.dist = +el.value);
    if (el.dataset.k === 'pixelScale') resize();
    save();
  });
  menu.querySelectorAll('button[data-act]').forEach(b => b.onclick = () => {
    const a = b.dataset.act, act = players.slice(0, SETTINGS.players);
    if (a === 'players') { SETTINGS.players = SETTINGS.players === 2 ? 1 : 2; applyInput(); resize(); }
    if (a === 'split') { SETTINGS.split = { auto: 'vertical', vertical: 'horizontal', horizontal: 'auto' }[SETTINGS.split]; resize(); }
    if (a === 'pad') SETTINGS.padMode = { auto: 'p1', p1: 'p2', p2: 'auto' }[SETTINGS.padMode];
    if (a === 'kb0' || a === 'kb1') { const i = +a.slice(-1); SETTINGS.keyboard[i] = !SETTINGS.keyboard[i]; }
    applyInput();
    if (a === 'dither') { SETTINGS.dither = !SETTINGS.dither; setPSX({ dither: SETTINGS.dither }); }
    if (a === 'shadows') { SETTINGS.shadows = !SETTINGS.shadows; if (sun) sun.castShadow = SETTINGS.shadows; }
    if (a === 'debug') SETTINGS.debug = !SETTINGS.debug;
    if (a === 'summon') { summonBoss(b.dataset.type); toggleMenu(false); return; }
    if (a === 'summonmob') { summonEnemy(b.dataset.type); toggleMenu(false); return; }
    if (a === 'bossreset') resetBosses();
    if (a === 'heal') for (const p of players) healFull(p);
    if (a === 'optreset') resetOptions();
    if (a === 'glut') for (const p of act) p.prog.addGlut(1000, { raw: true });
    if (a === 'stones') for (const p of act) p.prog.addItem(makeItem({ consumable: 'forgeStone', count: 3 }));
    if (a === 'sigil') { const it = makeItem({ sigil: 'kueste' }); players[0].prog.addItem(it); players[0].ui.popup(itemName(it), RARITIES.legendary.css); }
    if (a === 'respawnmobs') respawnMobs();
    if (a === 'items') {
      const r = rollLoot('boss_generic', {});
      for (const it of [...r.items, makeItem({ weapon: weaponIds()[Math.floor(Math.random() * weaponIds().length)], rarity: 'epic' }), makeItem({ relic: Object.keys(RELICS)[Math.floor(Math.random() * 13)] })]) loot.drop(it, players[0].pos, { scatter: 2 });
    }
    if (a === 'look0' || a === 'look1') {
      const i = +a.slice(-1);
      SETTINGS.looks[i] = (SETTINGS.looks[i] + 1) % PLAYER_LOOKS.length;
      const p = players[i]; scene.remove(p.model.object3D);
      p.model = createPlayerModel(SETTINGS.looks[i]); scene.add(p.model.object3D);
      p.fighter.actor.object3D = p.model.object3D;
      p.prog.dirty = true;
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
  const kx = innerWidth / W, ky = innerHeight / H;
  views().forEach((v, k) => {
    const r = ui[k].rect; r.x = v.x * kx; r.w = v.w * kx; r.h = v.h * ky; r.y = (H - v.y - v.h) * ky;
    Object.assign(viewEls[k].style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px', display: '' });
  });
  if (SETTINGS.players === 1) viewEls[1].style.display = 'none';
}
addEventListener('resize', resize);
resize();

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
function separatePlayers() {
  if (SETTINGS.players < 2) return;
  const a = players[0].ctrl, b = players[1].ctrl;
  const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), min = a.radius + b.radius;
  if (d < min && d > 1e-4 && Math.abs(a.pos.y - b.pos.y) < 1.6) {
    const push = (min - d) / 2, nx = dx / d, nz = dz / d;
    a.pos.x -= nx * push; a.pos.z -= nz * push; b.pos.x += nx * push; b.pos.z += nz * push;
  }
}

// ---------- Demo (?demo): P1 plündert das Wrack, rüstet aus, kämpft, sammelt Glut; P2 zeigt das Inventar ----------
let demoT = 0, demoFoe = null, demoT0 = 0, demoPrev = 0, demoStage = 0, demoInvT = 0;
const demoGiven = [false, false];
function steerTo(p, o, x, z) {
  // Stick so setzen, dass P in Richtung (x,z) läuft (Kamera-relativ)
  const dx = x - p.pos.x, dz = z - p.pos.z, yaw = p.cam.yaw;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const L = Math.hypot(dx, dz) || 1;
  o.moveY = (dx * fx + dz * fz) / L; o.moveX = (dx * rx + dz * rz) / L;
  return L;
}
function demoIntent(p, o) {
  if (p.i === 0) {
    const f = p.fighter;
    if (demoStage === 0) {   // Wrack-Loot einsammeln
      const d = loot.drops.filter(e => e.owner < 0).sort((a, b) => a.pos.distanceTo(p.pos) - b.pos.distanceTo(p.pos))[0];
      if (!d || p.prog.inventory.length >= 2 || demoT > 9) { demoStage = 1; demoInvT = demoT; return; }
      const L = steerTo(p, o, d.pos.x, d.pos.z);
      if (L < 1.7) { o.moveX = o.moveY = 0; if ((demoT * 3 | 0) !== ((demoT - 0.05) * 3 | 0)) o.interactPressed = true; }
      return;
    }
    if (demoStage === 1) {   // Inventar kurz öffnen, Rolle lesen
      if (!p.ui.isOpen && demoT - demoInvT < 0.2) { p.ui.open('inventory', { tab: 1 }); }
      if (demoT - demoInvT > 0.6 && demoT - demoInvT < 0.7) { const sc = p.prog.inventory.find(it => it.kind === 'scroll'); if (sc) { p.prog.use(sc.uid); p.prog.applyTo(f); } }
      if (demoT - demoInvT > 1.6) { p.ui.close(); demoStage = 2; }
      return;
    }
    // Kämpfen: Gegner rufen (Mob, sonst Boss)
    if (!demoFoe) {
      const mobIds = Object.keys(ENEMY_TYPES || {});
      demoFoe = mobIds.length ? summonEnemy(mobIds[0], 9) : summonBoss(Object.keys(ALL_BOSSES)[0]);
      demoT0 = demoT;
      if (!demoFoe) return;
    }
    if (foeDead(demoFoe)) { if (demoFoe.deadT > 2.5 || !foes.includes(demoFoe)) demoFoe = null; return; }
    const a = demoFoe.b.actor;
    if (!f.lock && f.state !== 'dead') o.lockPressed = true;
    const ph = (demoT - demoT0) % 8, prev = demoPrev; demoPrev = ph;
    const cross = x => (prev < x && ph >= x) || (prev > ph && x < ph);
    const d = Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) - a.radius;
    if (ph < 3.4) {
      if (d > 1.4) { o.moveY = 1; o.sprint = d > 8; }
      else if ((demoT * 4 | 0) !== ((demoT - 0.05) * 4 | 0)) o.chopPressed = true;
    } else if (ph < 4.4) { if (cross(3.5)) { o.rollPressed = true; o.moveX = 1; } if (cross(4.0)) { o.rollPressed = true; o.moveY = -1; } }
    else if (ph < 5.6) { o.moveY = d < 7 ? -1 : 0; if (cross(5.2)) o.spell1Pressed = true; }
    else { if (d > 2.5) o.moveY = 1; if (cross(6.6)) o.chopPressed = true; if (cross(7.4)) { o.rollPressed = true; o.moveX = -1; } }
  } else {
    if (!demoGiven[1]) {
      demoGiven[1] = true;
      for (const s of [{ weapon: 'sword', rarity: 'rare' }, { weapon: 'greatsword', rarity: 'legendary', upgrade: 2 }, { relic: 'glutherz' }, { relic: 'bernsteinauge' }, { consumable: 'forgeStone', count: 3 }, { sigil: 'kueste' }, { scroll: spellIds()[0] }]) p.prog.addItem(makeItem(s));
      p.prog.addGlut(640, { raw: true }); p.prog.applyTo(p.fighter);
    }
    if (demoT > 11 && !p.ui.isOpen && demoT < 12) p.ui.open('inventory', { tab: 1, sel: 2 });
    if (p.ui.isOpen) { if (demoT > 13 && demoT < 13.1) o.uiDown = true; return; }
    o.moveY = 1; o.moveX = Math.sin(demoT * 0.7) * 0.6;
    o.jump = (demoT % 1.6) < 0.4; o.jumpPressed = (demoT % 1.6) < 0.06;
  }
}

// ---------- Loop ----------
const _pv = new THREE.Vector3();
let last = performance.now(), fpsAcc = 0, fpsN = 0, fpsShow = 0, frameN = 0, lastDt = 1 / 60;
function frame(now) {
  requestAnimationFrame(frame);
  let el = Math.max(0, (now - last) / 1000); last = now;
  if (el <= 0) return;
  frameN++;
  fpsAcc += el; fpsN++;
  if (fpsAcc > 0.5) { fpsShow = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
  el = Math.min(el, DEMO ? 4 : 0.05);
  if (WARP) el = Math.max(el, WARP);
  lastDt = Math.min(el, 0.1);
  while (el > 1e-4) { const dt = Math.min(0.05, el); el -= dt; simulate(dt); }
  render();
}
const GAME_KEYS = ['jumpPressed', 'chopPressed', 'jump', 'rollPressed', 'spell1Pressed', 'spell2Pressed', 'lockPressed', 'heavyPressed', 'artPressed', 'flaskPressed', 'interactPressed', 'sprint', 'wavePressed', 'lock'];
function zeroGame(intent) {
  intent.moveX = intent.moveY = intent.lookX = intent.lookY = 0; intent.zoom = 0;
  for (const k of GAME_KEYS) if (k in intent) intent[k] = false;
  intent.switchTarget = 0;
}
function simulate(dt) {
  PSX.uniforms.uTime.value += dt; demoT += dt;
  const gdt = combat.stopT > 0 ? 0 : dt;

  const active = players.slice(0, SETTINGS.players);
  const menuOpen = menu.classList.contains('open');
  let menuReq = false;
  for (const p of players) p.fighter.actor.alive = active.includes(p) && p.fighter.state !== 'dead';
  for (const p of active) {
    const intent = input.read(p.i, dt);
    fallbackIntents(p.i, intent);
    if (!audioOn && (intent.jumpPressed || intent.chopPressed || intent.rollPressed || intent.menuPressed)) startAudio();
    if (DEMO) demoIntent(p, intent);
    // RPG-Panel dieses Spielers: Eingaben gehen an die UI
    if (intent.inventoryPressed && p.fighter.state !== 'dead') p.ui.toggleInventory();
    if (p.ui.isOpen) {
      if (intent.menuPressed) { p.ui.close(); intent.menuPressed = false; }
      else { deriveUiIntents(intent, p.uiSt); p.ui.handle(intent); }
      zeroGame(intent);
    }
    if (intent.menuPressed) menuReq = true;
    if (menuOpen) zeroGame(intent);
    p.intent = intent;
    if (intent.wavePressed && !p.model.actionActive && !p.fighter.busy) p.model.playAction('wave');

    if (gdt > 0) {
      const mul = p.fighter.update(gdt, intent, p.cam.yaw);
      const steps = gdt > 1 / 55 ? 2 : 1;
      for (let s = 0; s < steps; s++) p.ctrl.update(gdt / steps, intent, p.cam.yaw, mul);
      if (p.ctrl.landImpact > 0.25) { p.cam.kick(p.ctrl.landImpact * 0.8 * OPTIONS.screenShake); rumble(p.i, p.ctrl.landImpact * 0.5, 70); }
    } else {
      const f = p.fighter;
      if (intent.chopPressed) f.bufAtk = FIGHT.buffer; if (intent.rollPressed) f.bufRoll = FIGHT.buffer;
      if (intent.spell1Pressed) f.bufS1 = FIGHT.buffer; if (intent.spell2Pressed) f.bufS2 = FIGHT.buffer;
      if (intent.heavyPressed) f.bufHeavy = FIGHT.buffer; if (intent.artPressed) f.bufArt = FIGHT.buffer; if (intent.flaskPressed) f.bufFlask = FIGHT.buffer;
    }

    const m = p.model;
    m.object3D.position.copy(p.ctrl.pos);
    m.object3D.rotation.y = p.ctrl.yaw;
    m.animate(gdt, {
      speed: p.ctrl.speed, maxSpeed: TUNING.runSpeed, grounded: p.ctrl.grounded || p.ctrl.swimming, vy: p.ctrl.vel.y,
      turn: p.ctrl.turn, landImpact: p.ctrl.landImpact, sprint: p.ctrl.sprint, swimming: p.ctrl.swimming,
    });
    p.cam.update(dt, p.ctrl, intent, world);
    updateRpg(p);
  }
  players[1].model.object3D.visible = SETTINGS.players === 2;
  separatePlayers();
  separateFromEnemies(active);
  input.endFrame();
  if (menuReq) toggleMenu();

  world.update(gdt, active.map(p => ({ pos: p.ctrl.pos, vel: p.ctrl.vel })));
  if (fauna) fauna.update(gdt, active.map(p => ({ pos: p.ctrl.pos, speed: p.ctrl.speed })));
  updateZones(active);
  if (gdt > 0) updateFoes(gdt, active.map(p => ({ actor: p.fighter.actor, pos: p.ctrl.pos, alive: p.fighter.state !== 'dead' })), active);
  loot.update(dt, active);
  for (const s of shrines) if (s.flame) { s.flame.scale.y = 1 + Math.sin(demoT * 9 + s.pos.x) * 0.12; s.flame.rotation.y += dt * 2; }
  updateBiomes(dt, active);
  updateMusic(dt, active);
  combat.update(dt);
  for (const s of combat.shakes) for (const p of active) {
    let d = 0;
    if (!Number.isNaN(s.x)) d = Math.hypot(s.x - p.pos.x, s.z - p.pos.z);
    else { d = 1e9; for (const a of combat.actors) if (a.team !== 'player') d = Math.min(d, Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z)); if (d > 1e8) d = 0; }
    const a = s.amount * clamp(1 - d / 35, 0, 1) * OPTIONS.screenShake;
    if (a > 0.02) p.cam.kick(a);
  }
  combat.shakes.length = 0;
}
function render() {
  const active = players.slice(0, SETTINGS.players);
  const vs = views();
  vs.forEach((v, idx) => {
    const p = active[idx];
    p.cam.cam.aspect = v.w / v.h; p.cam.cam.updateProjectionMatrix();
    if (typeof world.applyAtmosphere === 'function') { try { world.applyAtmosphere(p.ctrl.pos, lastDt, idx); } catch (e) { warnOnce('world.applyAtmosphere', e); } }
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

  const st = world.stats ? world.stats() : {};
  fpsEl.textContent = `${fpsShow} fps · 🪵 ${st.wood ?? 0} · 💀 ${kills} · Gegner ${foes.filter(e => !foeDead(e)).length}`;
  active.forEach((p, idx) => updateHud(p, idx, 1 / 60));
}

function setBar(el, v, max) { const w = (clamp(v / max, 0, 1) * 100).toFixed(1) + '%'; if (el.style.width !== w) el.style.width = w; }
function spellCdFrac(f, k, id) {
  if (typeof f.spellInfo === 'function') { const s = f.spellInfo(k); if (s) return s.cdMax ? clamp(s.cd / s.cdMax, 0, 1) : 0; }
  const cd = f.spellCd?.[k] ?? f['cd' + (k + 1)] ?? 0;
  const max = SPELLS?.[id]?.cd || FIGHT['spell' + (k + 1)]?.cd || 1;
  return clamp(cd / max, 0, 1);
}
function updateHud(p, idx, dt) {
  const c = p.ctrl, f = p.fighter, u = ui[idx];
  let t = `<b>P${p.i + 1}</b> <small>${input.lastDevice[p.i]}</small>`;
  if (SETTINGS.debug) t += `<br><small>v ${c.speed.toFixed(2)} · vy ${c.vel.y.toFixed(2)} · ${c.swimming ? 'schwimmt' : c.grounded ? 'Boden' : 'Luft ' + c.airTime.toFixed(2) + 's'} · ${f.state}<br>x ${c.pos.x.toFixed(1)} y ${c.pos.y.toFixed(2)} z ${c.pos.z.toFixed(1)} · ${p.biomeId}</small>`;
  if (hudEls[idx].innerHTML !== t) hudEls[idx].innerHTML = t;
  setBar(u.hp, f.hp, fMax(f, 'Hp')); setBar(u.sta, f.sta, fMax(f, 'Sta')); setBar(u.mana, f.mana, fMax(f, 'Mana'));
  u.hpT.textContent = Math.ceil(f.hp);
  u.sta.parentElement.classList.toggle('ex', !!f.exhausted);
  const pad = input.lastDevice[p.i] === 'Gamepad';
  u.s1k.textContent = pad ? 'LB' : p.i === 0 ? '1' : '7';
  u.s2k.textContent = pad ? 'Y' : p.i === 0 ? '2' : '8';
  // Zauber-Slots aus dem Zauberbuch
  const sp = p.prog.equip.spells;
  [[u.s1, u.s1i, u.s1c], [u.s2, u.s2i, u.s2c]].forEach(([el, ic, cd], k) => {
    const id = sp[k], S = id ? spellDef(id) : null, icon = S ? (S.icon || '✨') : '·';
    if (ic && ic.textContent !== icon) { ic.textContent = icon; el.title = S ? S.name : 'leer'; }
    cd.style.height = (id ? spellCdFrac(f, k, id) * 100 : 0).toFixed(0) + '%';
    const si = typeof f.spellInfo === 'function' ? f.spellInfo(k) : null;
    el.classList.toggle('nomana', !id || f.mana < (si?.mana ?? SPELLS?.[id]?.mana ?? FIGHT['spell' + (k + 1)]?.mana ?? 0));
  });
  u.flash.style.opacity = (f.flash * 0.9).toFixed(2);
  u.dead.style.display = f.state === 'dead' ? '' : 'none';
  if (f.state === 'dead') u.dead.textContent = `${p.prog.glutrest ? 'Deine Glut liegt am Todesort … ' : ''}${Math.max(0, FIGHT.respawn - f.deadT).toFixed(1)}`;
  if (f.lock) {
    _pv.copy(f.lockPoint).project(p.cam.cam);
    const vis = _pv.z < 1 && Math.abs(_pv.x) < 1.1 && Math.abs(_pv.y) < 1.1;
    u.lock.style.display = vis ? '' : 'none';
    if (vis) u.lock.style.transform = `translate(${((_pv.x + 1) / 2 * u.rect.w).toFixed(0)}px, ${((1 - _pv.y) / 2 * u.rect.h).toFixed(0)}px)`;
  } else u.lock.style.display = 'none';
  // Boss-Leiste: gesperrter Boss oder nächster wacher Boss
  let e = foes.find(b => b.kind === 'boss' && b.b.actor === f.lock && !foeDead(b)) || null;
  if (!e) {
    let bd = 50;
    for (const b of foes) {
      if (b.kind !== 'boss' || !b.b.awake || foeDead(b)) continue;
      const d = Math.hypot(b.b.actor.pos.x - c.pos.x, b.b.actor.pos.z - c.pos.z);
      if (d < bd) { bd = d; e = b; }
    }
  }
  u.boss.style.display = e && !p.ui.isOpen ? '' : 'none';
  if (e) {
    const I = bossInfo(e.type), a = e.b.actor;
    const txt = `<b>${I.name || a.name || e.type}</b> <small>${I.title || a.title || ''}</small>${I.key ? ' <em>⚜ Siegelträger</em>' : ''}${e.b.phase === 2 ? ' <em>Phase 2</em>' : ''}`;
    if (u.bn.innerHTML !== txt) u.bn.innerHTML = txt;
    const frac = clamp(a.hp / (a.maxHp || I.hp || 1), 0, 1);
    u.bossLag = Math.max(frac, u.bossLag - dt * 0.35);
    u.bhp.style.width = (frac * 100).toFixed(1) + '%';
    u.bhpL.style.width = (u.bossLag * 100).toFixed(1) + '%';
    u.bstg.style.width = (clamp(a.stagger || 0, 0, 1) * 100).toFixed(0) + '%';
  } else u.bossLag = 1;
}
initBosses();
requestAnimationFrame(frame);
window.__viniland = { world, players, fauna, combat, foes, loot, zones, shrines, TUNING, CAM_TUNING, FIGHT, SETTINGS, OPTIONS, summonBoss, summonEnemy, resetBosses, respawnMobs };
if (params.has('dbg')) setInterval(() => {
  const el = document.getElementById('err'); el.style.display = 'block';
  el.textContent = players.map(p => `P${p.i + 1} ${p.fighter.state} hp ${p.fighter.hp.toFixed(0)}/${fMax(p.fighter, 'Hp')} L${p.prog.level} glut ${p.prog.glut} items ${p.prog.inventory.map(it => it.def).join(',')} wpn ${p.prog.get(p.prog.equip.weapon)?.weaponId ?? 'fists'} sp ${p.prog.equip.spells.join('/')} biome ${p.biomeId} pos ${p.ctrl.pos.toArray().map(n => n.toFixed(0))}`).join('\n') +
    '\n' + foes.filter(e => !foeDead(e)).slice(0, 8).map(e => `${foeName(e)}${e.summoned ? '*' : ''} ${e.b.actor.hp.toFixed(0)}/${e.b.actor.maxHp} ${e.b.awake ? 'wach' : '-'}`).join(' · ') +
    `\nKills ${kills} · Drops ${loot.drops.length} · Zonen ${zones.length} (${zones.filter(z => z.spawned).length} aktiv) · Slots ${bossSlots().length} · Shrines ${shrines.length} · Gates ${gates().length} · Frames ${frameN} demoT ${demoT.toFixed(1)}`;
}, 250);
