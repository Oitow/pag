// Riesenjagd – Verdrahtung: Renderer + PS2-Look, Welt, Held, Riesen, Haken-Zielen, Kampf, Zauber, Klang, HUD.
import * as THREE from 'three';
import { createPsx } from '../../../engine/render/psx.js';
import { createFollowCamera } from '../../../engine/camera/follow-camera.js';
import { createMoveInput, stickZuWelt } from '../../../engine/input/move-input.js';
import { istTouchGeraet } from '../../../engine/input/touch-stick.js';
import { createKlang } from '../../../engine/audio/klang.js';
import { createWelt, WELT } from './welt.js';
import { createHeld, HELD } from './held.js';
import { createRiese } from './riese.js';
import { createEffekte, createSternenfall } from './effekte.js';
import { HAKEN } from './haken.js';

const P = new URLSearchParams(location.search);
const TEST = P.has('test'), DEBUG = P.has('debug');
const $ = (id) => document.getElementById(id);
const fehler = (e) => { const f = $('fehler'); f.hidden = false; f.textContent += (e?.stack || e?.message || String(e)) + '\n'; console.error(e); };
addEventListener('error', (e) => fehler(e.error || e.message));
addEventListener('unhandledrejection', (e) => fehler(e.reason));

const QUALI = {
  niedrig: { splats: 32000, detail: 0.45, schatten: true, dichte: 0.55, zeilen: 300, schattenKarte: 1024 },
  mittel: { splats: 60000, detail: 0.45, schatten: true, dichte: 0.8, zeilen: 360, schattenKarte: 1536 },
  hoch: { splats: 110000, detail: 0.7, schatten: true, dichte: 1, zeilen: 440, schattenKarte: 2048 },
};
const qName = P.get('q') || (istTouchGeraet() ? 'niedrig' : 'mittel');
const Q = { ...(QUALI[qName] || QUALI.mittel) };
if (P.get('splats') === '0') Q.splats = 0;

const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = Q.schatten; renderer.shadowMap.type = THREE.BasicShadowMap;
const szene = new THREE.Scene();
szene.background = new THREE.Color(WELT.nebel);
szene.fog = new THREE.FogExp2(WELT.nebel, WELT.nebelDichte);
const kamera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.2, 900);

// Dämmerlicht: tiefe, warme Sonne von Westen, kühler Himmel, dunkler Boden
const himmel = new THREE.HemisphereLight(0x8a9aa6, 0x3a3022, 1.35); szene.add(himmel);
const sonne = new THREE.DirectionalLight(0xffc890, 2.1); sonne.castShadow = Q.schatten;
sonne.shadow.mapSize.set(Q.schattenKarte, Q.schattenKarte);
Object.assign(sonne.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 400 });
sonne.shadow.bias = -0.0008; szene.add(sonne, sonne.target);
const SONNE_RICHTUNG = new THREE.Vector3(-0.62, 0.42, -0.35).normalize();

const psx = createPsx({ an: P.get('psx') !== '0', raster: 420, farbtiefe: 5, dither: 0.8, zeilen: Q.zeilen, kontrast: 1.08, saettigung: 0.82, vignette: 0.42, toenung: 0xf2efe2, belichtung: 1.05 });
function groesse() { kamera.aspect = innerWidth / innerHeight; kamera.updateProjectionMatrix(); psx.aufloesung(renderer, innerWidth, innerHeight, { pixelRatio: Math.min(devicePixelRatio, 1.5) }); }

const klang = createKlang({ lautstaerke: 0.7 });
let welt, held, cam, eingabe, effekte, stern, riesen = [];
const statistik = { gefaellt: 0 };

const ORTE = {
  start: () => ({ x: WELT.start.x, z: WELT.start.z, yaw: WELT.start.yaw }),
  troll: () => { const r = riesen[0]; return { x: r.pos.x + 30, z: r.pos.z + 30, yaw: Math.atan2(-30, -30) }; },
  zyklop: () => { const r = riesen[1]; return { x: r.pos.x + 40, z: r.pos.z + 40, yaw: Math.atan2(-40, -40) }; },
};

async function start() {
  groesse();
  await new Promise((r) => setTimeout(r, 30));
  welt = createWelt({ szene, qualitaet: Q });
  effekte = createEffekte({ szene, nebel: WELT.nebel, dichte: WELT.nebelDichte });
  stern = createSternenfall({ szene, effekte });
  held = createHeld({ szene, welt, start: WELT.start, schatten: Q.schatten });
  riesen.push(createRiese({ szene, art: 'troll', pos: { x: 12, z: 150 }, seed: 3, welt, schatten: Q.schatten }));
  riesen.push(createRiese({ szene, art: 'zyklop', pos: { x: -150, z: -40 }, seed: 9, welt, schatten: Q.schatten }));

  eingabe = createMoveInput({ element: canvas, aktionen: [
    { name: 'haken', tasten: ['KeyE', 'KeyQ'], knopf: '🪝', titel: 'Haken (tippen = schießen, halten = einholen)', padKnopf: 5 },
    { name: 'angriff', tasten: ['KeyF'], knopf: '⚔', titel: 'Angriff (halten = Stich laden)', padKnopf: 2 },
    { name: 'zauber', tasten: ['KeyR'], knopf: '☄', titel: 'Sternenfall (halten, loslassen)', padKnopf: 3 },
  ] });
  cam = createFollowCamera({
    kamera, fov: 62, sprintFov: 74, distanz: 8, minDistanz: 3, maxDistanz: 26, pitch: -0.12, minPitch: -1.1, maxPitch: 1.2, hoehe: 2.2, autoAusrichten: 0.25,
    bodenHoehe: (x, z) => welt.bodenHoehe(x, z), hindernisse: (x, z, r) => welt.hindernisse(x, z, r),
  });
  cam.yaw = WELT.start.yaw;
  const ort = P.get('ort');
  if (ort && ORTE[ort]) gehe(ort);
  if (ort === 'ruecken') { gehe('troll'); setzeAufTroll(); }
  if (ort === 'ruecken') riesen[0].zustand.bemerkt = true;
  psx.wendeAn(szene);
  $('lade').hidden = true;
  if (!TEST) { $('titel').classList.add('an'); setTimeout(() => $('titel').classList.remove('an'), 3800); }
  for (const t of ['pointerdown', 'keydown']) addEventListener(t, () => klang.entsperren?.(), { once: false, passive: true });
  klang.bett?.('wind', 0.35);
  tipp('haken');
  window.riesenjagd = { bereit: true, held, riesen, welt, gehe, kamera: cam, zahlen: () => ({ ...welt.zahlen(), calls: renderer.info.render.calls, dreiecke: renderer.info.render.triangles }) };
  requestAnimationFrame(schleife);
}

function gehe(name) {
  const o = ORTE[name]?.(); if (!o) return;
  held.wiederbeleben(o); cam.yaw = o.yaw; cam.springeZu?.(held.pos);
}
function setzeAufTroll() {   // Testhilfe ?ort=ruecken: direkt unter der Nacken-Rune festhalten
  const r = riesen[0]; r.update(0, held);
  const w = r.schwach[0].welt.clone(); w.y -= 2.2;
  held.wiederbeleben({ x: w.x, z: w.z }); held.greife(r, w); cam.yaw = r.zustand.yaw; cam.springeZu?.(held.pos);
}

// --- Zielen ---
const strahl = new THREE.Raycaster(), mitte = new THREE.Vector2(0, 0.12), hilfsV = new THREE.Vector3();
function zielSuchen() {
  strahl.setFromCamera(mitte, kamera);
  const o = strahl.ray.origin, d = strahl.ray.direction;
  const brust = { x: held.pos.x, y: held.pos.y + 1.1, z: held.pos.z };
  let bester = null;
  const vonKamera = { x: o.x, y: o.y, z: o.z }, weit = HAKEN.reichweite + o.distanceTo(hilfsV.set(brust.x, brust.y, brust.z));
  const s = welt.strahl(vonKamera, d, weit); if (s) bester = { ...s, art: 'baum' };
  for (const r of riesen) { const t = r.strahl(vonKamera, d, bester ? bester.t : weit); if (t && (!bester || t.t < bester.t)) bester = { ...t, art: 'riese' }; }
  if (bester && Math.hypot(bester.x - brust.x, bester.y - brust.y, bester.z - brust.z) > HAKEN.reichweite) bester = null;
  if (bester && held.kletterRiese && bester.riese === held.kletterRiese) bester = null;
  if (!bester) {   // Zielhilfe: Riese im Blickkegel, sonst nächster Stamm
    let bw = 0.2;
    for (const r of riesen) {
      if (!r.lebt || r === held.kletterRiese) continue;
      for (const t of r.teile) {
        hilfsV.copy(t.aw).lerp(t.bw, 0.5); const dist = hilfsV.distanceTo(o); if (dist > weit) continue;
        const w = hilfsV.clone().sub(o).normalize().angleTo(d); if (w < bw) { bw = w; bester = { x: hilfsV.x, y: hilfsV.y, z: hilfsV.z, teil: t, riese: r, art: 'riese', hilfe: true }; }
      }
    }
    if (bester && Math.hypot(bester.x - brust.x, bester.y - brust.y, bester.z - brust.z) > HAKEN.reichweite) bester = null;
    if (!bester) { const h = welt.hilfe(brust, d); if (h) bester = { ...h, art: 'baum' }; }
  }
  return bester;
}
function zauberZiel() {
  strahl.setFromCamera(mitte, kamera);
  const o = strahl.ray.origin, d = strahl.ray.direction;
  let best = null, bw = 0.35;
  for (const r of riesen) { if (!r.lebt) continue; const t = r.torso, dist = t.distanceTo(held.pos); if (dist > 160) continue; const w = t.clone().sub(o).normalize().angleTo(d); if (w < bw) { bw = w; best = r; } }
  if (best) { const t = best.torso; return { x: t.x, y: t.y, z: t.z, boden: welt.gelaende(t.x, t.z), riese: best }; }
  for (let t = 4; t < 140; t += 2) { const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t, b = welt.bodenHoehe(x, z); if (y <= b) return { x, y: b, z, boden: b }; }
  const x = o.x + d.x * 60, z = o.z + d.z * 60, b = welt.bodenHoehe(x, z); return { x, y: b, z, boden: b };
}

// --- HUD ---
const zahlen = [];
function zahl(pos, text, farbe = '#ffd8a0', gross = false) {
  const el = document.createElement('div'); el.className = 'zahl' + (gross ? ' gross' : ''); el.textContent = text; el.style.color = farbe; $('zahlen').appendChild(el);
  zahlen.push({ el, pos: pos.clone ? pos.clone() : new THREE.Vector3(pos.x, pos.y, pos.z), t: 0 });
}
const TIPPS = [
  ['haken', '🪝 Auf einen Stamm zielen und tippen = Haken. Halten = Seil einholen'],
  ['loesen', '⤒ Springen löst das Seil – schwing dich von Baum zu Baum'],
  ['troll', 'Ein Troll! Hak dich an ihm fest oder spring ihn an, um zu klettern'],
  ['klettern', 'Klettere zur leuchtenden Rune (Nacken, Kniekehlen). Ausdauer im Blick!'],
  ['stich', '⚔ halten = Stich laden, loslassen = zustechen'],
  ['zauber', '☄ halten = Sternenfall laden, loslassen = der Himmel fällt'],
];
const tippErledigt = new Set(); let tippUhr = 0, tippAktuell = null;
function tipp(name) { if (tippErledigt.has(name)) return; tippErledigt.add(name); tippAktuell = TIPPS.find((t) => t[0] === name)?.[1]; tippUhr = 6.5; }

const vorher = { haken: false, angriff: false, zauber: false, springen: false };
let kameraHand = 0, uhr = 0, letzte = performance.now(), fpsUhr = 0, fpsN = 0, fps = 0, neuerRiese = 0, zielMarke = null;
const proj = new THREE.Vector3();

function schleife(jetzt) {
  requestAnimationFrame(schleife);
  const dt = Math.min(0.05, (jetzt - letzte) / 1000); letzte = jetzt; uhr += dt;
  fpsUhr += dt; fpsN++; if (fpsUhr > 0.5) { fps = Math.round(fpsN / fpsUhr); fpsUhr = 0; fpsN = 0; }

  const e = eingabe.lesen(dt);
  cam.drehen(e.kameraX, e.kameraY); if (e.zoom) cam.zoomen(e.zoom);
  const flanke = (n) => { const an = !!e[n]; const f = an && !vorher[n]; return f; };
  const los = (n) => !e[n] && vorher[n];
  const hakenNeu = flanke('haken'), angriffLos = los('angriff'), zauberLos = los('zauber'), springenNeu = flanke('springen');
  for (const n in vorher) vorher[n] = !!e[n];

  // Zielen + Haken
  zielMarke = held.tot ? null : zielSuchen();
  if (hakenNeu && zielMarke) { held.feuern(zielMarke); tippErledigt.add('haken'); tipp('loesen'); }
  else if (hakenNeu) klang.spiele('fehl', { staerke: 0.4 });

  const r = stickZuWelt(e.x, e.y, cam.blickYaw());
  const he = held.update(dt, { stick: { x: e.x, y: e.y }, richtung: r, sprint: e.sprint, springen: springenNeu, hakenGehalten: !!e.haken, angriffGehalten: !!e.angriff, angriffLos }, riesen);
  for (const x of he) {
    if (x.typ === 'schuss') klang.spiele('zisch', { staerke: 0.5, tonhoehe: 1.6 });
    else if (x.typ === 'einhaken') { klang.spiele('hammer', { staerke: 0.5, tonhoehe: 0.7 }); effekte.glut.emit(10, { pos: x.pos, velStreu: 4, leben: 0.4, groesse: 0.2, schwere: 10, farbe: 0xffe0a0 }); }
    else if (x.typ === 'gas') effekte.gas(x.pos, x.richtung);
    else if (x.typ === 'greifen') { tipp('klettern'); klang.spiele('schritt', { staerke: 1 }); }
    else if (x.typ === 'stich' || x.typ === 'schnitt') {
      if (x.wert > 0) {
        effekte.blut(x.pos, x.normale, x.schwach ? x.riese.art.rune : 0x8a7a60);
        zahl(x.pos, x.schwach ? `${x.wert}!` : `${x.wert}`, x.schwach ? '#ffb060' : '#d8d0c0', !!x.schwach);
        klang.spiele(x.schwach ? 'bersten' : 'biss', { staerke: x.schwach ? 1.2 : 0.6, tonhoehe: x.schwach ? 0.7 : 1 });
        cam.schuetteln?.(x.schwach ? 0.5 + x.kraft * 0.5 : 0.15, 0.3);
        if (x.schwach) tippErledigt.add('stich');
      }
    }
    else if (x.typ === 'getroffen') { cam.schuetteln?.(0.8, 0.4); klang.spiele('wumms', { staerke: 1.2 }); flash(); }
    else if (x.typ === 'abgerutscht') zahl(new THREE.Vector3(held.pos.x, held.pos.y + 2, held.pos.z), 'Abgerutscht', '#e0e0d0');
  }

  // Zauber
  if (e.zauber && !held.tot) { if (stern.laden(zauberZiel(), dt) && stern.anteil > 0.05 && stern.anteil < 0.1) klang.spiele('entladen', { staerke: 0.5 }); }
  if (zauberLos) { if (stern.loslassen(held.pos)) { klang.spiele('heulen', { staerke: 0.8 }); tippErledigt.add('zauber'); held.anim.spiele('zauberHimmel'); } }
  for (const ein of stern.update(dt)) {
    effekte.einschlag(ein.pos, ein.kraft * 1.2); klang.spiele('explosion', { staerke: 1.6 * ein.kraft, tonhoehe: 0.6 });
    const hd = held.pos.distanceTo ? held.pos.distanceTo(ein.pos) : Math.hypot(held.pos.x - ein.pos.x, held.pos.y - ein.pos.y, held.pos.z - ein.pos.z);
    cam.schuetteln?.(Math.max(0.2, 1.4 - hd / 80), 0.8);
    for (const r of riesen) {
      if (!r.lebt) continue;
      const t = r.torso, d = Math.hypot(t.x - ein.pos.x, t.y - ein.pos.y, t.z - ein.pos.z);
      if (d < 16 * r.art.skala) { const w = r.schade(55 * ein.kraft, { stagger: true, quelle: 'zauber' }); zahl(t.clone().setY(t.y + 4), `${w}`, '#ffc070', true); }
    }
    if (hd < 9) held.schade(18, { x: (held.pos.x - ein.pos.x) * 2, y: 8, z: (held.pos.z - ein.pos.z) * 2 });
  }

  // Riesen
  for (const rz of riesen) {
    const ev = rz.update(dt, held);
    const d = Math.hypot(rz.pos.x - held.pos.x, rz.pos.z - held.pos.z);
    if (d < 120 && tippErledigt.has('loesen')) tipp('troll');
    for (const x of ev) {
      if (x.typ === 'schritt') { const st = x.staerke * Math.max(0, 1 - d / 120); if (st > 0.02) { cam.schuetteln?.(st * 0.6, 0.25); klang.spiele('wumms', { staerke: st * 1.6, tonhoehe: 0.45 }); effekte.staubwolke(x.pos, 0.5 * rz.art.skala); } }
      else if (x.typ === 'bruellen') { klang.spiele('grollen', { staerke: 1.3 * Math.max(0.3, 1 - d / 150) }); cam.schuetteln?.(0.4 * Math.max(0, 1 - d / 120), 1.2); }
      else if (x.typ === 'stoss') {
        effekte.staubwolke(x.pos, 1.6 * x.staerke); effekte.ring(x.pos, x.radius, 0xb8a888, 0.8); klang.spiele('explosion', { staerke: 1.2, tonhoehe: 0.5 });
        cam.schuetteln?.(Math.max(0, 1.3 - d / 70), 0.6);
        const hd = Math.hypot(held.pos.x - x.pos.x, held.pos.z - x.pos.z);
        if (x.schaden > 0 && hd < x.radius && held.pos.y - x.pos.y < 3 && !held.kletterRiese) held.schade(x.schaden, { x: (held.pos.x - x.pos.x) / Math.max(1, hd) * 10, y: 7, z: (held.pos.z - x.pos.z) / Math.max(1, hd) * 10 });
      }
      else if (x.typ === 'treffer') held.schade(x.schaden, x.stoss);
      else if (x.typ === 'zisch') klang.spiele('rauschen', { staerke: 0.6 });
      else if (x.typ === 'schuetteln') { held.schuetteln(x.staerke); cam.schuetteln?.(0.35 * x.staerke, 0.2); }
      else if (x.typ === 'schieben') held.schieben(x.punkt);
      else if (x.typ === 'knien') { zahl(rz.torso, 'Der Riese bricht ein!', '#ffd8a0', true); klang.spiele('grollen', { staerke: 1 }); }
      else if (x.typ === 'tod') { statistik.gefaellt++; zahl(rz.torso, `${rz.name} fällt!`, '#ffe0a0', true); klang.spiele('grollen', { staerke: 1.6, tonhoehe: 0.7 }); neuerRiese = 14; }
      else if (x.typ === 'aufprall') { effekte.staubwolke(x.pos, x.staerke * 2.2); effekte.ring(x.pos, 30, 0xb8a888, 1.4); klang.spiele('explosion', { staerke: 2, tonhoehe: 0.35 }); cam.schuetteln?.(Math.max(0.2, 1.6 - d / 90), 1.2); }
    }
  }
  if (neuerRiese > 0 && (neuerRiese -= dt) <= 0) {
    const tot = riesen.findIndex((r) => !r.lebt);
    if (tot >= 0) {
      const alt = riesen[tot]; alt.wegnehmen();
      const w = Math.random() * 6.28, p = { x: held.pos.x + Math.cos(w) * 170, z: held.pos.z + Math.sin(w) * 170 };
      const pp = welt.zufallsPunkt(Math.random, p, 30);
      riesen[tot] = createRiese({ szene, art: alt.art === undefined || alt.art.name === 'Zyklop' ? 'troll' : 'zyklop', pos: pp, seed: 20 + statistik.gefaellt, welt, schatten: Q.schatten });
      psx.wendeAn(szene);
    }
  }
  if (held.tot && held.zustand.totUhr > 3.5) gehe('start');
  if (held.kletterRiese) tipp('stich');
  if (statistik.gefaellt === 0 && held.zustand.ausdauer > 0 && tippErledigt.has('stich') && uhr > 40) tipp('zauber');

  // Kamera
  const hp = held.pos, schnell = held.tempo > 16;
  // Klettern: Kamera weiter weg und von außen auf die Fläche schauen (außer man dreht selbst)
  if (Math.abs(e.kameraX) + Math.abs(e.kameraY) > 0.0001) kameraHand = 1.2; else kameraHand = Math.max(0, kameraHand - dt);
  const n = held.kletterNormale;
  if (n) {
    const kd = 11 * (held.kletterRiese?.art.skala ?? 1);
    cam.distanz += (kd - cam.distanz) * (1 - Math.exp(-2 * dt));
    if (kameraHand <= 0 && Math.hypot(n.x, n.z) > 0.2) { let d = Math.atan2(-n.x, -n.z) - cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); cam.yaw += d * (1 - Math.exp(-2.5 * dt)); }
  } else if (cam.distanz > 9) cam.distanz += (8 - cam.distanz) * (1 - Math.exp(-1 * dt));
  cam.update(dt, hp, { tempo: held.tempo, sprintet: schnell, yaw: held.zustand.yaw, amBoden: held.amBoden, augenHoehe: 1.6 });
  // Sonne + Schatten folgen
  sonne.position.set(hp.x + SONNE_RICHTUNG.x * 200, hp.y + SONNE_RICHTUNG.y * 200, hp.z + SONNE_RICHTUNG.z * 200); sonne.target.position.set(hp.x, hp.y, hp.z);
  welt.update(dt, hp, kamera, uhr, renderer.domElement.width, renderer.domElement.height);
  effekte.update(dt, kamera, renderer.domElement.height, hp);
  psx.update(dt, szene);
  renderer.render(szene, kamera);
  hud(dt);
}

let flashUhr = 0;
function flash() { flashUhr = 0.35; }
function balken(id, anteil) { $(id).style.transform = `scaleX(${Math.max(0, Math.min(1, anteil))})`; }
function hud(dt) {
  const z = held.zustand;
  balken('hp', z.hp / HELD.hpMax); balken('gas', z.gas / HELD.gasMax); balken('ausdauer', z.ausdauer / HELD.ausdauerMax);
  $('mana').style.opacity = stern.bereit ? 1 : 0.35; $('manaB').style.transform = `scaleX(${1 - stern.abklingAnteil})`;
  // Riesen-Leiste
  let nah = null, nd = 1e9;
  for (const r of riesen) { const d = Math.hypot(r.pos.x - held.pos.x, r.pos.z - held.pos.z); if (r.zustand.bemerkt && d < nd && (r.lebt || r.zustand.tod < 4)) { nd = d; nah = r; } }
  $('boss').hidden = !nah;
  if (nah) { $('bossName').textContent = nah.name; balken('bossHp', nah.zustand.hp / nah.zustand.max); }
  // Fadenkreuz
  const fk = $('kreuz');
  fk.className = held.tot ? 'aus' : zielMarke ? (zielMarke.art === 'riese' ? 'riese' : 'baum') : 'leer';
  const m = $('marke');
  if (zielMarke && !held.tot) {
    proj.set(zielMarke.x, zielMarke.y, zielMarke.z).project(kamera);
    if (proj.z < 1) { m.hidden = false; m.style.left = `${(proj.x * 0.5 + 0.5) * innerWidth}px`; m.style.top = `${(-proj.y * 0.5 + 0.5) * innerHeight}px`; m.className = zielMarke.art; }
    else m.hidden = true;
  } else m.hidden = true;
  // Zahlen
  for (let i = zahlen.length - 1; i >= 0; i--) {
    const q = zahlen[i]; q.t += dt; q.pos.y += dt * 2.5;
    proj.copy(q.pos).project(kamera);
    if (proj.z > 1 || q.t > 1.6) { q.el.remove(); zahlen.splice(i, 1); continue; }
    q.el.style.transform = `translate(${(proj.x * 0.5 + 0.5) * innerWidth}px, ${(-proj.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -50%)`;
    q.el.style.opacity = String(Math.min(1, (1.6 - q.t) * 2));
  }
  // Hinweis
  if (tippUhr > 0) tippUhr -= dt;
  const hinweis = z.hinweis || (tippUhr > 0 ? tippAktuell : '') || (held.tot ? 'Gefallen … gleich geht es weiter' : '');
  const hEl = $('hinweis'); if (hEl.textContent !== hinweis) hEl.textContent = hinweis; hEl.hidden = !hinweis;
  if (flashUhr > 0) { flashUhr -= dt; } $('rot').style.opacity = String(Math.max(0, flashUhr / 0.35) * 0.5 + (z.hp < 30 ? 0.15 : 0));
  $('info').textContent = DEBUG ? `${fps} fps · ${renderer.info.render.calls} calls · ${(renderer.info.render.triangles / 1000) | 0}k △ · splats ${welt.zahlen().splats} · ${z.modus} · gefällt ${statistik.gefaellt}` : (statistik.gefaellt ? `Riesen gefällt: ${statistik.gefaellt}` : '');
}

addEventListener('resize', groesse);
start().catch(fehler);
