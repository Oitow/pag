// Die Enklave – Tutorial-Tal → Pfad → ummauerte Stadt. Nur Verdrahtung von Engine-Bausteinen (Plan: docs/WELT-ENKLAVE.md):
//   welt.js (Plan + worldgen + Gelände) · stadt.js (Gebäude, Tor) · npcs.js · kampf.js · dinge.js · tutorial.js · figur.js (Spielfigur + Kamera) · menue.js
// URL: ?seed=<n> (nur Anzeige – die Welt hat einen festen Seed) · ?ort=tal|aussicht|tor|stadt · ?schritt=<Nr|id> · ?frisch · ?debug · ?test=1 (Smoke)
import * as THREE from 'three';
import { createHimmel } from '../../../engine/world/himmel.js';
import { himmelStand } from '../../../engine/world/himmel-stand.js';
import { createSpielzeit } from '../../../engine/core/zeit.js';
import { createSchleife } from '../../../engine/core/schleife.js';
import { createSpeicher } from '../../../engine/core/speicher.js';
import { createPsx } from '../../../engine/render/psx.js';
import { createQualitaet } from '../../../engine/render/qualitaet.js';
import { createFigurSchilder } from '../../../engine/ui/figur-schild.js';
import { baueWelt } from './welt.js';
import { baueStadt } from './stadt.js';
import { createSpielerFigur } from './figur.js';
import { createDinge } from './dinge.js';
import { createNpcs } from './npcs.js';
import { createKampf } from './kampf.js';
import { createTutorial } from './tutorial.js';
import { createPause } from './menue.js';
import { createAtmosphaere } from './atmosphaere.js';
import { TAL } from './tutorial-daten.js';

const $ = (id) => document.getElementById(id);
const url = new URLSearchParams(location.search);
const zeigeFehler = (e) => { const f = $('fehler'); f.hidden = false; f.textContent = 'Fehler: ' + (e?.stack || e); console.error(e?.stack || e); };
addEventListener('error', (e) => zeigeFehler(e.error || e.message));
addEventListener('unhandledrejection', (e) => zeigeFehler(e.reason));
const pause = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

// ---- Renderer, PS1-Look, Qualität ----
const speicher = createSpeicher({ schluessel: 'pag-enklave', version: 1 });
const optionen = speicher.lade('optionen') || {};
const psx = createPsx({ an: optionen.psx !== false });
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: !psx.an });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
let pixelWunsch = Math.min(devicePixelRatio, 2);
const szene = new THREE.Scene();
const kamera = new THREE.PerspectiveCamera(60, 1, 0.1, 400);
const qual = createQualitaet({ ziel: 1 / 40 });
let pixelMax = 1.5;
function groesse(pixel) {
  if (typeof pixel === 'number') pixelWunsch = pixel;
  psx.aufloesung(renderer, innerWidth, innerHeight, { pixelRatio: Math.min(pixelWunsch, pixelMax) });
  kamera.aspect = innerWidth / innerHeight; kamera.updateProjectionMatrix();
}
addEventListener('resize', () => groesse());
groesse();

// ---- Himmel, Zeit, Schilder ----
const himmel = createHimmel({ szene, schattenWeite: 30, schattenAufloesung: 1024 });
himmel.setNebel(60, 230);
const uhr = createSpielzeit({ stunde: 9, sekundenProStunde: 60 });
const stand = himmelStand({ stunde: 9 });
const schilder = createFigurSchilder();
const testModus = url.has('test'), frisch = url.has('frisch') || testModus;

let atmo, w, figur, dinge, stadt, npcs, kampf, tutorial, menue, pausiert = false, echtZeit = 0, infoZeit = 0;

async function baue() {
  await pause();
  w = baueWelt({ szene, pruefen: url.has('debug') });
  const sp = w.plan.plan.spawn, alt = frisch ? null : speicher.lade('auto');
  const startPos = { x: sp.x, z: sp.z, yaw: sp.yaw };
  if (alt?.pos) { startPos.x = alt.pos[0]; startPos.z = alt.pos[1]; }
  figur = createSpielerFigur({ szene, kamera, adapter: w.kollision, element: $('c'), start: { x: startPos.x, y: w.adapter.bodenHoehe(startPos.x, startPos.z) + 0.3, z: startPos.z, yaw: sp.yaw },
    seed: 1, schilder, npcs: () => npcs?.npcs ?? [] });
  figur.teleport(startPos.x, startPos.z, alt?.pos ? undefined : sp.yaw);
  if (alt?.uhr) uhr.lade(alt.uhr);
  await pause();
  const kraeuter = { x: TAL.x + 36, z: TAL.z - 12 };
  dinge = createDinge({ szene, welt: w.kollision, kraeuter, seed: 1, stand: alt?.dinge ?? null });
  stadt = baueStadt({ szene, w, interaktion: dinge.interaktion, ereignisse: dinge.ereignisse });
  dinge.ereignisse.an('station:benutzt', () => dinge.hud.melde('Der Schmied winkt ab: „Schmieden lernst du später.“'));
  let tut = null;
  atmo = createAtmosphaere({ szene, w, stadt, klangAn: optionen.klang !== false });
  npcs = createNpcs({ szene, w, kollision: w.kollision, schilder, interaktion: dinge.interaktion, spieler: () => figur.figur, onAnsprechen: (n) => tut?.onAnsprechen(n) ?? null, seed: 1 });
  const platz = (id) => w.plan.platz(id);
  const uebung = (id, r, h) => ({ id, fest: true, x: platz(id).x, z: platz(id).z, radius: r, hoehe: h, y: 0 });
  kampf = createKampf({ szene, welt: w.kollision, spieler: figur, kamera: figur.kamera, hud: dinge.hud, seed: 1,
    ziele: [uebung('puppe', 0.6, 1.8), uebung('zielscheibe', 0.6, 1.4)],
    onBesiegt: (art) => tut?.melde('besiegt', { art }), onBenutzt: (was) => tut?.melde('benutzt', { was }),
    onTreffer: (id) => { if (id === 'puppe') tut?.melde('benutzt', { was: 'treffer:puppe' }); } });
  tut = tutorial = createTutorial({ w, npcs, dinge, kampf, stadt, spieler: figur, speicher, neu: frisch });
  menue = createPause({ speicher, uhr, renderer, szene, psx, anpassen: groesse, onPause: (an) => { pausiert = an; },
    onKlang: (an) => atmo?.setKlang(an), neuStart: () => { speicher.loesche('tutorial'); speicher.loesche('auto'); location.search = ''; } });
  $('menueKnopf').onclick = () => menue.schalte('start');
  $('menueKnopf').addEventListener('click', (e) => e.currentTarget.blur());
  speicher.auto('auto', () => ({ uhr: uhr.zustand(), pos: [figur.position.x, figur.position.z], dinge: dinge.zustand() }), 10);
  addEventListener('pagehide', () => speicher.jetztSpeichern());
  abkuerzungen();
}

/** ?schritt=<Nr|id> und ?ort=… zum Testen. */
function abkuerzungen() {
  const teleport = (o, yaw) => { if (o) figur.teleport(o.x, o.z, yaw); };
  if (url.has('schritt')) {
    const s = url.get('schritt'), n = /^\d+$/.test(s) ? +s : s;
    tutorial.springe(n);
    const o = tutorial.ortVor(n);
    if (o) teleport(o);
  }
  const ort = url.get('ort'), p = w.plan;
  const lok = (id, lx, lz) => p.lokalZuWelt(p.platz(id), lx, lz);
  if (ort === 'tor') teleport(lok('torweg', 0, -2), p.platz('mauer-torhaus').winkel + Math.PI);
  else if (ort === 'aussicht') teleport(p.zone('aussicht'), 2.2);
  else if (ort === 'stadt') teleport(lok('strasse', 0, 10), p.platz('mauer-torhaus').winkel + Math.PI);
  else if (ort === 'tal') teleport(p.plan.spawn, p.plan.spawn.yaw);
}

function update(dt) {
  if (!figur || pausiert) return;
  echtZeit += dt;
  uhr.update(dt); speicher.update(dt);
  const p = figur.position;
  const amBoden = figur.figur.zustand.amBoden;   // vor dem Update: danach hat der Sprung den Boden schon verlassen
  figur.update(dt, (absicht, e) => kampf.eingaben(dt, absicht, e));
  const ein = figur.eingabe;
  if (ein.gedrueckt('springen') && amBoden) tutorial.melde('benutzt', { was: 'sprung' });
  if (ein.gedrueckt('rucksack')) dinge.schalteRucksack();
  figur.zeigeInteraktion(dinge.update(dt, figur.figur, figur.interagiert));
  himmelStand({ stunde: uhr.stunde, jahresAnteil: uhr.jahresAnteil, tag: uhr.tag }, stand);
  const nacht = Math.max(0, Math.min(1, (0.15 - stand.sonneHoehe) / 0.35));
  npcs.update(dt, uhr.stunde);
  stadt.update(dt, p, nacht); atmo.update(dt, { spieler: p, nacht, zeit: echtZeit });
  kampf.update(dt, renderer.domElement.height);
  tutorial.update(dt);
  schilder.update(kamera, dt);
  kampf.zahlen.update(kamera, dt);
  himmel.update(stand, { kamera, mitte: p, zeit: echtZeit });
  w.update(echtZeit, { kamera });
  psx.update(dt, szene);
  const qs = qual.update(dt);
  if (qs) {
    pixelMax = qs.pixel; groesse();
    himmel.licht.castShadow = qs.schatten > 0;
    if (qs.schatten > 0 && himmel.licht.shadow.mapSize.x !== Math.min(qs.schatten, 1024)) { himmel.licht.shadow.map?.dispose(); himmel.licht.shadow.map = null; himmel.licht.shadow.mapSize.set(Math.min(qs.schatten, 1024), Math.min(qs.schatten, 1024)); }
    kampf.fx.anteil = qs.partikel; kampf.zahlen.grenze = qs.zahlen;
  }
  if ((infoZeit -= dt) <= 0) {
    infoZeit = 0.5;
    if (url.has('debug')) $('info').textContent = `${Math.round(schleife.fps)} fps · 🕒 ${uhr.uhrText()} · ${renderer.info.render.calls} Calls · Q${qual.nr + 1}`;
  }
}

const zeitraffer = Math.max(1, Math.min(8, +url.get('zeitraffer') || 1));   // ?zeitraffer=N: N Updates je Bild (Testen auf langsamen Rechnern)
const schleife = createSchleife({ update: (dt, z) => { for (let k = 0; k < zeitraffer; k++) update(dt, z); }, render: () => { if (figur) renderer.render(szene, kamera); }, fehler: zeigeFehler });
window.enklave = { renderer, szene, kamera, psx, qual, uhr, schilder, get w() { return w; }, get figur() { return figur; }, get npcs() { return npcs; }, get kampf() { return kampf; },
  get tutorial() { return tutorial; }, get stadt() { return stadt; }, get dinge() { return dinge; } };
baue().then(() => { psx.wendeAn(szene); $('lade').hidden = true; schleife.start(); }).catch(zeigeFehler);
