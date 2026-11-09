// Testwelt – begehbare 3D-Welt aus dem Baukasten: Weltgenerator (engine/world/worldgen) + Gelände/Objekte
// (engine/world/terrain-chunks mit LOD + Streaming, terrain-mesh nur noch für Wasser) + Spielfigur (Engine-Figurensystem
// oder Platzhalter, siehe figur.js). Preset „unendlich“ läuft über den Chunk-Generator (engine/world/chunk-adapter).
import * as THREE from 'three';
import { createWorld, createChunkGenerator, PRESETS } from '../../../engine/world/worldgen/worldgen.js';
import { createWeltAdapter } from '../../../engine/world/worldgen/worldgen-adapter.js';
import { createChunkAdapter } from '../../../engine/world/chunk-adapter.js';
import { createTerrainMesh, biomFarben } from '../../../engine/world/terrain-mesh.js';
import { createTerrainChunks } from '../../../engine/world/terrain-chunks.js';
import { createSpielerFigur } from './figur.js';

const $ = (id) => document.getElementById(id);
const HOEHEN_SKALA = 60, METER_PRO_ZELLE = 2;
const HIMMEL = 0x9cc4e4;

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
szene.fog = new THREE.Fog(HIMMEL, 120, 520);
const kamera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
szene.add(new THREE.HemisphereLight(0xcfe6ff, 0x5a5040, 1.1));
const sonne = new THREE.DirectionalLight(0xfff1d6, 2.2);
sonne.castShadow = true;
sonne.shadow.mapSize.set(2048, 2048);
Object.assign(sonne.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 300 });
sonne.shadow.bias = -0.0005;
szene.add(sonne, sonne.target);

function groesseAnpassen() {
  renderer.setSize(innerWidth, innerHeight, false);
  kamera.aspect = innerWidth / innerHeight;
  kamera.updateProjectionMatrix();
}
addEventListener('resize', groesseAnpassen);
groesseAnpassen();

// ---- Einstellungen (URL ↔ Oberfläche) ----
const url = new URLSearchParams(location.search);
const presetEl = $('preset'), seedEl = $('seed'), groesseEl = $('groesse');
for (const [key, p] of Object.entries(PRESETS)) presetEl.add(new Option(p.name || key, key));
presetEl.value = PRESETS[url.get('preset')] ? url.get('preset') : 'insel';
seedEl.value = url.get('seed') ?? 42;
if (['128', '256', '512'].includes(url.get('groesse'))) groesseEl.value = url.get('groesse');

// ---- Welt ----
let welt = null, adapter = null, gelaende = null, kacheln = null, meer = null, figur = null;
let dorfNr = 0, gipfelNr = 0;
const pause = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

async function erzeuge() {
  $('lade').hidden = false;
  await pause();
  const t0 = performance.now();
  const g = +groesseEl.value, unendlich = presetEl.value === 'unendlich', seed = +seedEl.value | 0;
  gelaende?.dispose(); kacheln?.dispose(); adapter?.dispose(); meer?.removeFromParent();
  gelaende = welt = null;
  const masse = { hoehenSkala: HOEHEN_SKALA, meterProZelle: METER_PRO_ZELLE };
  if (unendlich) {
    adapter = createChunkAdapter(createChunkGenerator({ preset: 'unendlich', seed }), { ...masse, kachel: 32 });
    meer ??= new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x2b6a96, roughness: 0.2, transparent: true, opacity: 0.85, depthWrite: false }));
    szene.add(meer);
  } else {
    welt = createWorld({ preset: presetEl.value, seed, breite: g, tiefe: g, qualitaet: 'normal' });
    adapter = createWeltAdapter(welt, masse);
    // terrain-mesh nur für Seen/Flüsse/Meer – den Boden zeichnen die LOD-Kacheln
    gelaende = createTerrainMesh(adapter, { schatten: true });
    gelaende.boden.visible = false;
    szene.add(gelaende.gruppe);
  }
  const msWelt = performance.now() - t0;
  kacheln = createTerrainChunks({ adapter, schatten: true, sichtweite: 600 });
  szene.add(kacheln.gruppe);
  szene.fog.near = 150; szene.fog.far = kacheln.sichtweite * 0.95;
  karte.hidden = unendlich;
  if (welt) zeichneKarte();
  const start = adapter.startPunkt();
  if (!figur) figur = await createSpielerFigur({ szene, kamera, adapter, element: canvas, start, seed });
  else figur.setAdapter(adapter);
  figur.teleport(start.x, start.z);
  figur.update(1 / 60);
  kacheln.vorladen(kamera);
  dorfNr = gipfelNr = 0;
  const neueUrl = `?preset=${presetEl.value}&seed=${seedEl.value}&groesse=${g}`;
  history.replaceState(null, '', neueUrl);
  statistik = `Welt ${msWelt.toFixed(0)} ms`;
  $('lade').hidden = true;
}

// ---- Karte (Minimap) ----
const karte = $('karte'), kctx = karte.getContext('2d');
let kartenBild = null;
function zeichneKarte() {
  const B = welt.breite, T = welt.tiefe, f = biomFarben(welt);
  karte.width = B; karte.height = T;
  const img = kctx.createImageData(B, T);
  for (let y = 0; y < T; y++) for (let x = 0; x < B; x++) {
    const i = y * B + x, b = welt.biom[i] * 3;
    // einfache Schummerung von Nordwest
    const d = (welt.hoehe[i] - welt.hoehe[Math.max(0, y - 1) * B + Math.max(0, x - 1)]) * 18;
    const l = Math.max(0.55, Math.min(1.35, 1 + d));
    img.data[i * 4] = f[b] * 255 * l; img.data[i * 4 + 1] = f[b + 1] * 255 * l; img.data[i * 4 + 2] = f[b + 2] * 255 * l; img.data[i * 4 + 3] = 255;
  }
  kctx.putImageData(img, 0, 0);
  kartenBild = kctx.getImageData(0, 0, B, T);
}
function karteMarker() {
  if (!kartenBild || !figur || !welt) return;
  kctx.putImageData(kartenBild, 0, 0);
  const { gx, gy } = adapter.zuGitter(figur.position.x, figur.position.z);
  const r = welt.breite / 48;
  const zeichne = (o, farbe) => { kctx.fillStyle = farbe; kctx.fillRect(o.x - r / 2, o.y - r / 2, r, r); };
  for (const d of welt.orte.doerfer) zeichne(d, '#f4e1a1');
  kctx.fillStyle = '#ff3b30'; kctx.beginPath(); kctx.arc(gx, gy, r, 0, Math.PI * 2); kctx.fill();
  kctx.strokeStyle = '#fff'; kctx.lineWidth = r / 3; kctx.stroke();
}
karte.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  if (!welt) return;
  const rect = karte.getBoundingClientRect();
  const gx = (e.clientX - rect.left) / rect.width * welt.breite, gy = (e.clientY - rect.top) / rect.height * welt.tiefe;
  const p = adapter.zuWelt(gx * welt.zelle, gy * welt.zelle);
  figur.teleport(p.x, p.z);
});

// ---- Knöpfe ----
$('erzeuge').onclick = () => erzeuge();
$('wuerfel').onclick = () => { seedEl.value = Math.floor(Math.random() * 1e6); erzeuge(); };
presetEl.onchange = () => erzeuge();
groesseEl.onchange = () => erzeuge();
seedEl.onkeydown = (e) => { if (e.key === 'Enter') erzeuge(); };
const springeZu = (o) => { if (!o) return; const p = adapter.zuWelt(o.x, o.y); figur.teleport(p.x, p.z); };
$('zumStart').onclick = () => { const s = adapter.startPunkt(); figur.teleport(s.x, s.z); };
$('zumDorf').onclick = () => { const d = welt?.orte.doerfer ?? []; if (d.length) springeZu(d[dorfNr++ % d.length]); };
$('zumGipfel').onclick = () => { const g = (welt?.orte.poi ?? []).filter(p => p.art === 'gipfel'); if (g.length) springeZu(g[gipfelNr++ % g.length]); };
// Fokus von Knöpfen/Auswahl lösen, damit Tasten (Leertaste!) wieder die Figur steuern
for (const el of document.querySelectorAll('#oben button, #oben select')) el.addEventListener('click', () => el.blur());

// ---- Schleife ----
let statistik = '', alt = performance.now(), fpsZeit = 0, fpsBilder = 0, fps = 0, infoZeit = 0;
function bild(jetzt) {
  requestAnimationFrame(bild);
  const echt = (jetzt - alt) / 1000, dt = Math.min(0.05, echt); alt = jetzt;
  if (!figur || !adapter) return;
  figur.update(dt);
  const p = figur.position;
  // Schattenkamera folgt der Figur
  sonne.position.set(p.x + 60, p.y + 120, p.z + 40);
  sonne.target.position.set(p.x, p.y, p.z);
  meer?.position.set(p.x, 0.02, p.z);
  kacheln.update(kamera);
  renderer.render(szene, kamera);

  fpsBilder++; fpsZeit += echt;
  if (fpsZeit > 0.5) { fps = Math.round(fpsBilder / fpsZeit); fpsBilder = 0; fpsZeit = 0; }
  if ((infoZeit -= dt) <= 0) {
    infoZeit = 0.2;
    const biom = adapter.biomBei(p.x, p.z), w = adapter.wasserHoehe(p.x, p.z);
    $('info').innerHTML = `<b>${biom?.name ?? '–'}</b> · Höhe ${p.y.toFixed(1)} m${w !== null && w > p.y ? ' · 🌊' : ''}` +
      ` · ${figur.tempo.toFixed(1)} m/s<br>${figur.art} · ${fps} fps · ${statistik}`;
    karteMarker();
    const d = kacheln.debug(), r = renderer.info.render;
    $('debug').textContent = `${fps} FPS\nKacheln ${d.sichtbar}/${d.kacheln} · LOD ${d.lod.join('/')}` +
      `${d.warteschlange ? ' · ⏳' + d.warteschlange : ''}\nDreiecke ${(r.triangles / 1000).toFixed(0)}k · Draw Calls ${r.calls}\nObjekte ${d.objekte}`;
  }
}

erzeuge().then(() => { requestAnimationFrame(bild); if (url.has("debug")) window.testwelt = { get figur() { return figur; }, get adapter() { return adapter; }, get kacheln() { return kacheln; } }; });
