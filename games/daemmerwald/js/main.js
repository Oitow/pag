// Der Dämmerwald – MMO-Startgebiet. Nur Verdrahtung (Bauplan: docs/WELT-DAEMMERWALD.md):
//   plan-daten.js (Pfad, Orte, Riesen) · gelaende.js · wald.js (Riesen) · bewuchs.js · dinge.js · licht.js · splats.js · figur.js
// URL: ?ort=ufer|tor|bogen|stamm|lichtung · ?q=niedrig|mittel|hoch · ?splats=0 · ?test=1 (ohne Intro, feste Zeit) · ?debug
import * as THREE from 'three';
import { createSchleife } from '../../../engine/core/schleife.js';
import { createQualitaet } from '../../../engine/render/qualitaet.js';
import { createKollisionsWelt } from '../../../engine/world/kollision.js';
import * as riesenModul from '../../../engine/models/natur/riesenbaum.js';
import { ORTE, LICHTUNG, MARKEN, BOGEN_VARIANTE, riesenListe, nebenPfad } from './plan-daten.js';
import { createGelaende } from './gelaende.js';
import { baueVarianten, richteBogenAus, createWald } from './wald.js';
import { createBewuchs } from './bewuchs.js';
import { createDinge } from './dinge.js';
import { createLicht, SONNE } from './licht.js';
import { createSplats } from './splats.js';
import { createKronen } from './kronen.js';                       // KRONEN: dichtes Laub der Riesen
import { createSpielerFigur, SICHTFELD } from './figur.js';

const $ = (id) => document.getElementById(id);
const url = new URLSearchParams(location.search);
const zeigeFehler = (e) => { const f = $('fehler'); f.hidden = false; f.textContent = 'Fehler: ' + (e?.stack || e); console.error(e?.stack || e); };
addEventListener('error', (e) => zeigeFehler(e.error || e.message));
addEventListener('unhandledrejection', (e) => zeigeFehler(e.reason));
const pause = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

// ---- Qualität: Splat-Budget und Pixelverhältnis (§3 C) ----
const STUFEN = { niedrig: { splats: 40000, pixel: 1, schatten: 1024, detail: 0.45, dichte: 0.6 }, mittel: { splats: 90000, pixel: 1.5, schatten: 2048, detail: 1, dichte: 1 }, hoch: { splats: 160000, pixel: 2, schatten: 2048, detail: 1, dichte: 1 } };
const handy = matchMedia('(pointer: coarse)').matches;
const qName = STUFEN[url.get('q')] ? url.get('q') : handy ? 'niedrig' : 'mittel', Q = STUFEN[qName];
const testModus = url.has('test'), mitSplats = url.get('splats') !== '0', debug = url.has('debug');

const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const szene = new THREE.Scene();
const kamera = new THREE.PerspectiveCamera(SICHTFELD, 1, 0.3, 2600);
let pixelMax = Q.pixel;
function groesse() {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, pixelMax));
  renderer.setSize(innerWidth, innerHeight, false);
  kamera.aspect = innerWidth / innerHeight; kamera.updateProjectionMatrix();
}
addEventListener('resize', groesse);
groesse();
const qual = createQualitaet({ ziel: 1 / 40 });
if (testModus) qual.fest(true);

let kronen, gelaende, wald, bewuchs, dinge, licht, splats, figur, welt, zeit = testModus ? 40 : 0, infoZeit = 0, ortAktiv = null, ortUhr = 0;
const bahnen = [];

async function baue() {
  await pause();
  // Riesen: Varianten bauen (SDF-Netz + Splats), Bogen-Baum an den Pfad rücken, dann erst das Gelände (ebnet um die Stämme ein)
  const varianten = baueVarianten({ modul: riesenModul, detail: Q.detail });
  await pause();
  const riesen = riesenListe().map((b) => (b.variante === BOGEN_VARIANTE ? richteBogenAus(b, varianten[b.variante].masse) : b));
  gelaende = createGelaende({ szene, riesen, varianten });
  wald = createWald({ szene, riesen, varianten, bodenHoehe: gelaende.bodenHoehe, fussHoehe: gelaende.fussHoehe });
  welt = createKollisionsWelt({ welt: { bodenHoehe: (x, z) => Math.max(gelaende.bodenHoehe(x, z), wald.wurzelHoehe(x, z)), wasserHoehe: gelaende.wasserHoehe } });
  wald.meldeKollision(welt);
  await pause();
  bewuchs = createBewuchs({ szene, hf: gelaende.hf, bodenHoehe: gelaende.bodenHoehe, riesen, dichte: Q.dichte });   // [bewuchs] Bodenhöhe aus gelaende.js
  dinge = createDinge({ szene, bodenHoehe: gelaende.bodenHoehe, welt, test: testModus });
  // Lichtbahnen: Sonnenstrahlen, die zwischen den Stämmen bis auf den Pfad fallen; die Lichtsäule steht steil über dem Menhir
  for (const [z, s, breite] of [[34, -5, 7], [84, 6, 6], [118, -4, 8], [171, 5, 6], [204, -7, 8], [262, 4, 7], [318, -5, 7], [362, 6, 6]]) {
    const p = nebenPfad(z, s);
    bahnen.push({ x: p.x, y: gelaende.bodenHoehe(p.x, p.z), z: p.z, breite, laenge: 90, staerke: 0.13 });
  }
  bahnen.push({ x: dinge.menhir.x, y: gelaende.bodenHoehe(dinge.menhir.x, dinge.menhir.z), z: dinge.menhir.z, breite: 11, laenge: 120, staerke: 0.3, richtung: new THREE.Vector3(0.2, 0.93, -0.3).normalize() });
  licht = createLicht({ szene, renderer, bodenHoehe: gelaende.bodenHoehe, bahnen });
  licht.setzeSchatten(Q.schatten);
  kronen = createKronen({ szene, wald, licht, detail: Q.detail, dichte: Q.dichte });   // KRONEN
  await pause();
  if (mitSplats) {
    splats = createSplats({ szene, budget: Q.splats, belichtung: renderer.toneMappingExposure, dunstFarbe: licht.dunstFarbe });
    splats.fuegeBaeume(wald);
    splats.fuegeSzene({ gelaende, riesen, bahnen, pilze: dinge.pilze });
  }
  const start = ORTE.find((o) => o.id === url.get('ort')) || ORTE[0];
  figur = createSpielerFigur({ szene, kamera, welt, element: $('c'), start });
  figur.stelle(start);
  ortAktiv = start.id;
}

function zeigeOrt(o) {
  const el = $('ort');
  el.textContent = o.name; el.classList.add('an'); ortUhr = 4.5;
}

function update(dt) {
  if (!figur) return;
  if (!testModus) zeit += dt;
  figur.update(dt);
  const p = figur.position;
  gelaende.update(zeit); bewuchs.update(zeit); dinge.update(dt, zeit, p);
  licht.update(zeit, kamera, p);
  kronen.update(zeit);                                                   // KRONEN
  // Ortsnamen: dezent einblenden, wenn man eine Wegmarke erreicht
  const nah = ORTE.find((o) => Math.abs(MARKEN[o.id] - p.z) < 14 && Math.abs(o.x - p.x) < 30);
  if (nah && nah.id !== ortAktiv) { ortAktiv = nah.id; if (!testModus) zeigeOrt(nah); }
  if (ortUhr > 0 && (ortUhr -= dt) <= 0) $('ort').classList.remove('an');
  $('weiter').hidden = Math.hypot(p.x - LICHTUNG.x, p.z - LICHTUNG.z) > LICHTUNG.radius * 0.8;
  const qs = qual.update(dt);
  if (qs) { pixelMax = Math.min(Q.pixel, qs.pixel); groesse(); licht.setzeSchatten(Math.min(Q.schatten, qs.schatten)); wald.setzeSchatten(qs.schatten > 0); }
  if (debug && (infoZeit -= dt) <= 0 && zahl.calls) {
    infoZeit = 0.5;
    $('info').textContent = `${Math.round(schleife.fps)} fps · ${zahl.calls} Calls · ${Math.round(zahl.dreiecke / 1000)}k Dreiecke · ${splats ? splats.anzahl : 0} Splats · ${qName} Q${qual.nr + 1}`;
  }
}

let bilder = 0;
const zahl = { calls: 0, dreiecke: 0 };
function render() {
  if (!figur) return;
  splats?.update(kamera, zeit, renderer.domElement.width, renderer.domElement.height);
  renderer.render(szene, kamera);
  zahl.calls = renderer.info.render.calls; zahl.dreiecke = renderer.info.render.triangles;
  if (++bilder === 3) griff.bereit = true;
}

const schleife = createSchleife({ update, render, fehler: zeigeFehler });
const griff = window.daemmerwald = { bereit: false, renderer, szene, kamera, qual, stufe: qName, orte: ORTE, SONNE,
  get gelaende() { return gelaende; }, get wald() { return wald; }, get bewuchs() { return bewuchs; }, get dinge() { return dinge; }, get licht() { return licht; }, get kronen() { return kronen; },
  get splats() { return splats; }, get figur() { return figur; }, get welt() { return welt; },
  /** Für die Konsole: daemmerwald.gehe('bogen') */
  gehe(id) { const o = ORTE.find((x) => x.id === id); if (o) figur.stelle(o); return !!o; },
  get zahlen() { return { ...zahl, splats: splats ? splats.anzahl : 0, splatTeile: splats?.teile, riesen: wald?.instanzen.length, echt: wald?.echt }; } };

baue().then(() => {
  $('lade').hidden = true;
  schleife.start();
  if (testModus) return;
  const t = $('titel');                         // Einblendung: Titel auf dunklem Grund, dann gibt er den Blick frei
  t.style.transition = 'none'; t.classList.add('an'); void t.offsetWidth; t.style.transition = '';
  setTimeout(() => t.classList.add('klar'), 900);
  setTimeout(() => t.classList.remove('an'), 4200);
  setTimeout(() => zeigeOrt(ORTE.find((o) => o.id === ortAktiv)), 6200);
}).catch(zeigeFehler);
