// Natur-Labor – Betrachter für die prozeduralen Natur-Assets (engine/models/natur/natur-assets.js) mit dem
// gemeinsamen Wind-Material (engine/render/natur-material.js). Einzeln oder alle im Raster, echter Maßstab (Meter).
import * as THREE from 'three';
import { FAMILIEN, familieVon, alleTypen, erzeugeAsset } from '../../../engine/models/natur/natur-assets.js';
import { createNaturMaterial } from '../../../engine/render/natur-material.js';

const $ = (id) => document.getElementById(id);
const HIMMEL = 0x9cc4e4;
const FAMILIEN_NAMEN = { baum: '🌳 Bäume', fels: '🪨 Felsen', totholz: '🪵 Totholz', busch: '🌿 Büsche', bodendecker: '🍄 Bodendecker', wueste: '🌵 Wüste' };

function zeigeFehler(e) { const f = $('fehler'); f.hidden = false; f.textContent = 'Fehler: ' + (e?.stack || e); }
addEventListener('error', (e) => zeigeFehler(e.error || e.message));
addEventListener('unhandledrejection', (e) => zeigeFehler(e.reason));

// ---- Renderer & Szene ----
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const szene = new THREE.Scene();
szene.background = new THREE.Color(HIMMEL);
szene.fog = new THREE.Fog(HIMMEL, 150, 400);
const kamera = new THREE.PerspectiveCamera(50, 1, 0.05, 1000);
szene.add(new THREE.HemisphereLight(0xcfe6ff, 0x5a5040, 1.1));
const sonne = new THREE.DirectionalLight(0xfff1d6, 2.2);
sonne.castShadow = true;
sonne.shadow.mapSize.set(2048, 2048);
sonne.shadow.bias = -0.0004;
szene.add(sonne, sonne.target);
const boden = new THREE.Mesh(new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6f8f4e, roughness: 1 }));
boden.receiveShadow = true;
szene.add(boden);

// Maßstab: Figur 1,8 m
const figur = new THREE.Group();
const figMat = new THREE.MeshStandardMaterial({ color: 0x3d5a80, roughness: 0.8, flatShading: true });
const koerper = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 1.45, 8).translate(0, 0.725, 0), figMat);
const kopf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1).translate(0, 1.64, 0), new THREE.MeshStandardMaterial({ color: 0xe0b896, roughness: 0.8, flatShading: true }));
koerper.castShadow = kopf.castShadow = true;
figur.add(koerper, kopf);
szene.add(figur);

const mat = createNaturMaterial({ wind: true });

function groesseAnpassen() {
  renderer.setSize(innerWidth, innerHeight, false);
  kamera.aspect = innerWidth / innerHeight;
  kamera.updateProjectionMatrix();
}
addEventListener('resize', groesseAnpassen);
groesseAnpassen();

// ---- Einstellungen (URL ↔ Oberfläche) ----
const url = new URLSearchParams(location.search);
const typEl = $('typ'), seedEl = $('seed'), detailEl = $('detail'), zeitEl = $('zeit');
for (const [f, typen] of Object.entries(FAMILIEN)) {
  const g = document.createElement('optgroup'); g.label = FAMILIEN_NAMEN[f] || f;
  for (const t of typen) g.appendChild(new Option(t, t));
  typEl.appendChild(g);
}
typEl.value = alleTypen().includes(url.get('typ')) ? url.get('typ') : 'eiche';
seedEl.value = url.get('seed') ?? 1;
if (['0', '1', '2'].includes(url.get('detail'))) detailEl.value = url.get('detail');
if (['sommer', 'herbst', 'winter'].includes(url.get('zeit'))) zeitEl.value = url.get('zeit');
let raster = url.get('raster') === '1';
let windAn = url.get('wind') !== '0';
let gleich = url.get('massstab') !== 'echt';   // Raster: alle gleich groß oder echter Maßstab

// ---- Orbit (Maus/Touch) ----
const orbit = { yaw: 0.7, pitch: 0.32, dist: 20, ziel: new THREE.Vector3(0, 4, 0) };
const zeiger = new Map();
let pinch = 0, tippStart = null;
canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
  tippStart = zeiger.size === 1 ? { x: e.clientX, y: e.clientY } : null;
  if (zeiger.size === 2) { const [a, b] = [...zeiger.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
});
canvas.addEventListener('pointermove', (e) => {
  const z = zeiger.get(e.pointerId); if (!z) return;
  const dx = e.clientX - z.x, dy = e.clientY - z.y;
  z.x = e.clientX; z.y = e.clientY;
  if (zeiger.size === 1) {
    orbit.yaw -= dx * 0.008;
    orbit.pitch = Math.min(1.45, Math.max(-0.05, orbit.pitch + dy * 0.006));
  } else if (zeiger.size === 2) {
    const [a, b] = [...zeiger.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch > 0) zoom(pinch / d);
    pinch = d;
  }
});
const loslassen = (e) => {
  if (tippStart && zeiger.size === 1 && Math.hypot(e.clientX - tippStart.x, e.clientY - tippStart.y) < 6) tippe(e);
  zeiger.delete(e.pointerId); tippStart = null; pinch = 0;
};
canvas.addEventListener('pointerup', loslassen);
canvas.addEventListener('pointercancel', (e) => { zeiger.delete(e.pointerId); tippStart = null; pinch = 0; });
canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
function zoom(f) { orbit.dist = Math.min(400, Math.max(0.4, orbit.dist * f)); }

// Antippen im Raster → dieses Asset einzeln ansehen
const strahl = new THREE.Raycaster(), maus = new THREE.Vector2();
function tippe(e) {
  if (!raster) return;
  maus.set(e.clientX / innerWidth * 2 - 1, -e.clientY / innerHeight * 2 + 1);
  strahl.setFromCamera(maus, kamera);
  const treffer = strahl.intersectObjects(objekte.children, false).find(t => t.object.userData.typ);
  if (!treffer) return;
  typEl.value = treffer.object.userData.typ;
  raster = false;
  baue(true);
}

// ---- Bauen ----
const objekte = new THREE.Group();
szene.add(objekte);
let stand = { dreiecke: 0, text: '' };

function leeren() {
  for (const m of [...objekte.children]) { m.geometry.dispose(); m.material.map?.dispose(); if (m.isSprite) m.material.dispose(); objekte.remove(m); }
}

function netz(a, typ) {
  const m = new THREE.Mesh(a.geometrie, mat);
  m.castShadow = m.receiveShadow = true;
  m.customDepthMaterial = mat.tiefenMaterial;
  m.userData.typ = typ;
  return m;
}

function schild(text, x, y, z) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  c.width = 256; c.height = 64;
  g.fillStyle = 'rgba(18,22,28,.78)'; g.beginPath(); g.roundRect(2, 8, 252, 48, 12); g.fill();
  g.fillStyle = '#eef1f4'; g.font = '600 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, sizeAttenuation: false, depthTest: false, transparent: true }));
  s.scale.set(0.1, 0.025, 1); s.position.set(x, y, z); s.renderOrder = 2;
  s.geometry = s.geometry.clone();   // eigene Geometrie → leeren() darf sie entsorgen
  return s;
}

const optsJetzt = () => ({ detail: +detailEl.value, jahreszeit: zeitEl.value });

function baueEinzeln(kameraNeu) {
  const typ = typEl.value, t0 = performance.now();
  const a = erzeugeAsset(typ, +seedEl.value | 0, optsJetzt());
  const ms = performance.now() - t0;
  objekte.add(netz(a, typ));
  const tri = a.geometrie.attributes.position.count / 3;
  figur.position.set(a.hoehe > 3 ? a.stammRadius + 1.6 : Math.max(a.radius, 0.2) + 0.6, 0, 0.4);
  const r = Math.max(a.radius + 2.5, a.hoehe * 0.7, 3);
  boden.scale.setScalar(r * 2.2);
  schatten(Math.max(a.radius, a.hoehe) + 3);
  if (kameraNeu) {
    const g = Math.max(a.hoehe, 1.8, (figur.position.x + 0.4) * 1.6);   // Asset + Figur im Bild
    orbit.ziel.set(figur.position.x * 0.3, Math.max(0.8, a.hoehe * 0.42), 0);
    orbit.dist = Math.max(2.5, g * 1.6 / Math.min(1, kamera.aspect * 1.3)); orbit.pitch = 0.32;
  }
  stand = { dreiecke: tri, text: `<b>${typ}</b> · ${FAMILIEN_NAMEN[familieVon(typ)] || ''} · ${tri} Dreiecke · Höhe ${a.hoehe.toFixed(2)} m · Radius ${a.radius.toFixed(2)} m · Stamm ${a.stammRadius.toFixed(2)} m · ${ms.toFixed(0)} ms` };
}

function baueRaster(kameraNeu) {
  const o = optsJetzt(), seed = +seedEl.value | 0, t0 = performance.now();
  const W = gleich ? 26 : 70;   // Zeilenbreite in Metern
  let z = 0, breite = 0, dreiecke = 0, anzahl = 0;
  for (const [f, typen] of Object.entries(FAMILIEN)) {
    const assets = typen.map(t => [t, erzeugeAsset(t, seed, o)]);
    let x = 0, zeileR = 0;
    objekte.add(schild(FAMILIEN_NAMEN[f], -2.5, 0.5, z));
    for (const [t, a] of assets) {
      const sk = gleich ? 2.6 / Math.max(a.hoehe, a.radius * 1.3, 0.05) : 1;
      const r = Math.max(a.radius * sk * 0.85, 0.35), hoehe = a.hoehe * sk;
      if (x > 0 && x + 2 * r > W) { z += zeileR * 2 + 1.5; x = 0; zeileR = 0; }
      zeileR = Math.max(zeileR, r);
      const m = netz(a, t); m.position.set(x + r, 0, z); m.scale.setScalar(sk);
      objekte.add(m, schild(t, x + r, hoehe + 0.35, z));
      x += 2 * r + (gleich ? 0.6 : 1.2);
      breite = Math.max(breite, x);
      dreiecke += a.geometrie.attributes.position.count / 3; anzahl++;
    }
    z += zeileR * 2 + 3;
  }
  // zentrieren
  for (const m of objekte.children) { m.position.x -= breite / 2; m.position.z -= z / 2; }
  figur.position.set(-breite / 2 - 1.5, 0, -z / 2 + 2);
  const r = Math.hypot(breite, z) / 2 + 4;
  boden.scale.setScalar(r * 1.3);
  schatten(r);
  if (kameraNeu) { orbit.ziel.set(0, 1, 0); orbit.dist = r * 1.22; orbit.pitch = 0.72; orbit.yaw = 0.2; }
  stand = { dreiecke, text: `<b>Alle ${anzahl} Typen</b> · ${dreiecke} Dreiecke · ${(performance.now() - t0).toFixed(0)} ms · ${gleich ? 'gleich groß' : 'echter Maßstab (Figur = 1,8 m)'} · antippen = einzeln ansehen` };
}

function schatten(r) {
  Object.assign(sonne.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: r * 6 });
  sonne.shadow.camera.updateProjectionMatrix();
  sonne.position.set(r * 1.2, r * 2.4, r * 0.9);
}

function baue(kameraNeu = false) {
  leeren();
  if (raster) baueRaster(kameraNeu); else baueEinzeln(kameraNeu);
  $('ansicht').textContent = raster ? '◻ Einzeln' : '▦ Alle';
  typEl.disabled = raster;
  $('massstab').hidden = !raster;
  $('massstab').textContent = gleich ? '📏 Echt' : '⤢ Gleich';
  figur.visible = !raster || !gleich;
  $('wind').classList.toggle('an', windAn);
  history.replaceState(null, '', `?typ=${typEl.value}&seed=${seedEl.value}&detail=${detailEl.value}&zeit=${zeitEl.value}${raster ? '&raster=1' : ''}${windAn ? '' : '&wind=0'}${gleich ? '' : '&massstab=echt'}${url.has('test') ? '&test=1' : ''}`);
}

// ---- Knöpfe ----
$('massstab').onclick = () => { gleich = !gleich; baue(true); };
$('ansicht').onclick = () => { raster = !raster; baue(true); };
typEl.onchange = () => baue(true);
seedEl.onchange = () => baue(false);
seedEl.onkeydown = (e) => { if (e.key === 'Enter') baue(false); };
$('wuerfel').onclick = () => { seedEl.value = Math.floor(Math.random() * 1e6); baue(false); };
detailEl.onchange = () => baue(false);
zeitEl.onchange = () => baue(false);
$('wind').onclick = () => { windAn = !windAn; $('wind').classList.toggle('an', windAn); baue(false); };
for (const el of document.querySelectorAll('#oben button, #oben select')) el.addEventListener('click', () => el.blur());

// ---- Schleife ----
let fps = 0, fpsZeit = 0, fpsBilder = 0, alt = performance.now(), infoZeit = 0;
function bild(jetzt) {
  requestAnimationFrame(bild);
  const echt = (jetzt - alt) / 1000; alt = jetzt;
  mat.update(jetzt / 1000, { staerke: windAn ? 1 : 0 });
  const cp = Math.cos(orbit.pitch);
  kamera.position.set(orbit.ziel.x + Math.sin(orbit.yaw) * cp * orbit.dist, orbit.ziel.y + Math.sin(orbit.pitch) * orbit.dist, orbit.ziel.z + Math.cos(orbit.yaw) * cp * orbit.dist);
  kamera.position.y = Math.max(0.15, kamera.position.y);
  kamera.lookAt(orbit.ziel);
  renderer.render(szene, kamera);
  fpsBilder++; fpsZeit += echt;
  if (fpsZeit > 0.5) { fps = Math.round(fpsBilder / fpsZeit); fpsBilder = 0; fpsZeit = 0; }
  if ((infoZeit -= echt) <= 0) {
    infoZeit = 0.3;
    $('info').innerHTML = `${stand.text}<br>${renderer.info.render.calls} Draw-Calls · ${renderer.info.render.triangles} Dreiecke im Bild (mit Schatten) · ${fps} fps · Ziehen = drehen, Rad/zwei Finger = Zoom`;
  }
}

baue(true);
requestAnimationFrame(bild);
window.labor = { renderer, szene, kamera, orbit, baue };
