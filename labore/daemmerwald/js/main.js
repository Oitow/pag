// Der Dämmerwald – MMO-Startgebiet. Nur Verdrahtung (Bauplan: docs/plaene/WELT-DAEMMERWALD.md):
//   plan-daten.js (Pfad, Orte, Riesen) · gelaende.js · wald.js (Riesen) · bewuchs.js · dinge.js · licht.js · splats.js · figur.js
// URL: ?ort=ufer|tor|bogen|stamm|lichtung · ?q=niedrig|mittel|hoch · ?splats=0 · ?test=1 (ohne Intro, Uhr steht) · ?zeit=6.5 (Startstunde) · ?tempo=50 (Sekunden je Spielstunde)
//      · ?licht=einfach (ohne Kronen-Lichtkarte) · ?debug
import * as THREE from 'three';
import { createSchleife } from '../../../engine/core/schleife.js';
import { createSpielzeit } from '../../../engine/core/zeit.js';
import { createQualitaet } from '../../../engine/render/qualitaet.js';
import { createKollisionsWelt } from '../../../engine/world/kollision.js';
import * as riesenModul from '../../../engine/models/natur/riesenbaum.js';
import { ORTE, LICHTUNG, MARKEN, BOGEN_VARIANTE, riesenListe, nebenPfad } from './plan-daten.js';
import { createGelaende } from './gelaende.js';
import { baueVarianten, richteBogenAus, createWald } from './wald.js';
import { createBewuchs } from './bewuchs.js';
import { createDinge } from './dinge.js';
import { createLicht, SONNE, himmelUniforms } from './licht.js';
import { START_STUNDE, MOND_TAG } from './tageslicht.js';
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
const STUFEN = { niedrig: { splats: 40000, pixel: 1, schatten: 1024, detail: 0.45, dichte: 0.6 }, mittel: { splats: 90000, pixel: 1.5, schatten: 2048, detail: 1, dichte: 1, bewuchs: 0.75 }, hoch: { splats: 160000, pixel: 2, schatten: 2048, detail: 1, dichte: 1 } };
const handy = matchMedia('(pointer: coarse)').matches;
const qName = STUFEN[url.get('q')] ? url.get('q') : handy ? 'niedrig' : 'mittel', Q = STUFEN[qName];
const testModus = url.has('test'), mitSplats = url.get('splats') !== '0', debug = url.has('debug'), lichtEinfach = url.get('licht') === 'einfach';
// Tag-Nacht: Standard-Start in der goldenen Abendstunde, ein Tag ≈ 20 min (50 s je Spielstunde); ?test=1 hält die Uhr an
const zahlParam = (n, d) => { const v = parseFloat(url.get(n)); return Number.isFinite(v) ? v : d; };
const uhr = createSpielzeit({ stunde: ((zahlParam('zeit', START_STUNDE) % 24) + 24) % 24, tag: MOND_TAG, sekundenProStunde: Math.max(0.05, zahlParam('tempo', 50)) });
uhr.pause = testModus;

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

let splatUhr = 0;
const REF = new THREE.Color(0x9bbcc0);                                  // Himmelslicht des Standard-Looks (Splat-Faktor 1)
let himmelU, kronen, gelaende, wald, bewuchs, dinge, licht, splats, figur, welt, zeit = testModus ? 40 : 0, infoZeit = 0, ortAktiv = null, ortUhr = 0;
const bahnen = [];

async function baue() {
  await pause();
  // Riesen: Varianten bauen (SDF-Netz + Splats), Bogen-Baum an den Pfad rücken, dann erst das Gelände (ebnet um die Stämme ein)
  const varianten = baueVarianten({ modul: riesenModul, detail: Q.detail });
  await pause();
  const riesen = riesenListe().map((b) => (b.variante === BOGEN_VARIANTE ? richteBogenAus(b, varianten[b.variante].masse) : b));
  himmelU = himmelUniforms();   // ein Satz für Himmel, Wasser (gelaende) und Licht
  gelaende = createGelaende({ szene, riesen, varianten, himmel: himmelU });
  wald = createWald({ szene, riesen, varianten, bodenHoehe: gelaende.bodenHoehe, fussHoehe: gelaende.fussHoehe });
  welt = createKollisionsWelt({ welt: { bodenHoehe: (x, z) => Math.max(gelaende.bodenHoehe(x, z), wald.wurzelHoehe(x, z)), wasserHoehe: gelaende.wasserHoehe } });
  wald.meldeKollision(welt);
  await pause();
  bewuchs = createBewuchs({ szene, hf: gelaende.hf, bodenHoehe: gelaende.bodenHoehe, riesen, dichte: Q.bewuchs ?? Q.dichte });   // [bewuchs] Bodenhöhe aus gelaende.js
  dinge = createDinge({ szene, bodenHoehe: gelaende.bodenHoehe, welt, test: testModus });
  // Lichtbahnen: Sonnenstrahlen, die zwischen den Stämmen bis auf den Pfad fallen; die Lichtsäule steht steil über dem Menhir
  for (const [z, s, breite] of [[34, -5, 7], [84, 6, 6], [118, -4, 8], [171, 5, 6], [204, -7, 8], [262, 4, 7], [318, -5, 7], [362, 6, 6]]) {
    const p = nebenPfad(z, s);
    bahnen.push({ x: p.x, y: gelaende.bodenHoehe(p.x, p.z), z: p.z, breite, laenge: 90, staerke: 0.13 });
  }
  bahnen.push({ x: dinge.menhir.x, y: gelaende.bodenHoehe(dinge.menhir.x, dinge.menhir.z), z: dinge.menhir.z, breite: 11, laenge: 120, staerke: 0.3, richtung: new THREE.Vector3(0.2, 0.93, -0.3).normalize() });
  licht = createLicht({ szene, renderer, bodenHoehe: gelaende.bodenHoehe, bahnen, einfach: lichtEinfach, himmel: himmelU, karte: { groesse: qName === 'niedrig' ? 256 : 384, minBilder: qName === 'niedrig' ? 60 : 20 }, staub: qName === 'niedrig' ? 450 : 900 });
  licht.setzeSchatten(Q.schatten);
  kronen = createKronen({ szene, wald, licht, detail: Q.detail, dichte: Q.dichte });   // KRONEN
  // Kronen-Lichtkarte: Laub (Blatt-Silhouetten) + Riesen (grobe Stufe) verdecken; Sonnentupfer auf Boden, Bewuchs, Dingen und (nur Laub) auf den Stämmen
  if (kronen.laub) licht.fuegeVerdecker(kronen.laub.mesh, { material: kronen.laub.deckMaterial });
  for (const m of wald.meshes) { const nr = /^riesen-(\d+)-s\d$/.exec(m.name)?.[1]; licht.fuegeVerdecker(m, { geometrie: nr != null ? varianten[+nr].fernGeometrie : m.geometry }); }
  const mitTupfern = new Set([gelaende.mesh.material, ...bewuchs.meshes.map((m) => m.material), dinge.materialien.holz, dinge.materialien.stein, dinge.materialien.rinde]);
  for (const m of mitTupfern) licht.mitLichtkarte(m);
  licht.mitLichtkarte(wald.material, { nurLaub: true });
  await pause();
  if (mitSplats) {
    splats = createSplats({ szene, budget: Q.splats, belichtung: renderer.toneMappingExposure, dunstFarbe: licht.dunstFarbe });
    splats.fuegeBaeume(wald);
    splats.fuegeSzene({ gelaende, riesen, bahnen: lichtEinfach ? bahnen : [], pilze: dinge.pilze });   // Lichtstaub: mit Lichtkarte als Schwebeteilchen in licht.js
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
  uhr.update(dt);
  figur.update(dt);
  const p = figur.position;
  gelaende.update(zeit); bewuchs.update(zeit); dinge.update(dt, zeit, p);
  licht.update(zeit, kamera, p, uhr.stunde);
  kronen.setzeLicht(licht.kronenLicht);
  kronen.update(zeit);                                                   // KRONEN
  dinge.setzeNacht(licht.zustand.nacht);
  if (splats && (splatUhr -= dt) <= 0) {                                  // Splats sind unbeleuchtet: Licht-Faktor + Dunstfarbe selten nachführen
    splatUhr = 0.3;
    const h = licht.himmelslicht, f = (h.intensity / 2.0) * 0.8 + (licht.sonne.intensity / 2.3) * 0.2;
    splats.setzeLicht(licht.dunstFarbe, [f * h.color.r / REF.r, f * h.color.g / REF.g, f * h.color.b / REF.b].map((v) => Math.min(1.6, 0.5 * v + 0.5 * f)));
  }
  // Ortsnamen: dezent einblenden, wenn man eine Wegmarke erreicht
  const nah = ORTE.find((o) => Math.abs(MARKEN[o.id] - p.z) < 14 && Math.abs(o.x - p.x) < 30);
  if (nah && nah.id !== ortAktiv) { ortAktiv = nah.id; if (!testModus) zeigeOrt(nah); }
  if (ortUhr > 0 && (ortUhr -= dt) <= 0) $('ort').classList.remove('an');
  $('weiter').hidden = Math.hypot(p.x - LICHTUNG.x, p.z - LICHTUNG.z) > LICHTUNG.radius * 0.8;
  const qs = qual.update(dt);
  if (qs) { pixelMax = Math.min(Q.pixel, qs.pixel); groesse(); licht.setzeSchatten(Math.min(Q.schatten, qs.schatten)); wald.setzeSchatten(qs.schatten > 0); }
  if (debug && (infoZeit -= dt) <= 0 && zahl.calls) {
    infoZeit = 0.5;
    const lk = licht.lichtkarte?.zahlen;
    $('info').textContent = `${Math.round(schleife.fps)} fps · ${zahl.calls} Calls · ${Math.round(zahl.dreiecke / 1000)}k Dreiecke · ${splats ? splats.anzahl : 0} Splats · ${qName} Q${qual.nr + 1} · ${uhr.uhrText()}` +
      (lk ? ` · Lichtkarte ${lk.neu}× (${lk.calls} Calls)` : ' · Licht einfach');
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
  /** Für die Konsole: daemmerwald.zeit(6.5) setzt die Uhr; ohne Zahl → aktuelle Stunde. */
  zeit(stunde) { if (Number.isFinite(stunde)) uhr.setze({ stunde: ((stunde % 24) + 24) % 24 }); return uhr.stunde; }, uhr,
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
