// Testwelt – begehbare 3D-Welt aus dem Baukasten: Weltgenerator (engine/world/worldgen) + Gelände/Objekte
// (engine/world/terrain-mesh, scatter-mesh) + Spielfigur (Engine-Figurensystem, figur.js) + Dorfbewohner (dorf.js).
// Gelände verändern: engine/world/welt-aenderung (Spielstand = Seed + Änderungen) · Lagerplatz: lager.js · Menü: pause.js
import * as THREE from 'three';
import { createWorld, PRESETS } from '../../../engine/world/worldgen/worldgen.js';
import { createWeltAdapter } from '../../../engine/world/worldgen/worldgen-adapter.js';
import { createTerrainMesh, biomFarben } from '../../../engine/world/terrain-mesh.js';
import { createScatterMesh } from '../../../engine/world/scatter-mesh.js';
import { createWegeMesh } from '../../../engine/world/wege-mesh.js';
import { mitBruecken } from '../../../engine/world/wege-lage.js';
import { createAssetCache } from '../../../engine/models/natur/natur-assets.js';
import { createFigurSchilder } from '../../../engine/ui/figur-schild.js';
import { createHimmel } from '../../../engine/world/himmel.js';
import { himmelStand } from '../../../engine/world/himmel-stand.js';
import { createWetter, WETTER_ARTEN } from '../../../engine/world/wetter.js';
import { createNiederschlag } from '../../../engine/render/niederschlag.js';
import { createSpielzeit } from '../../../engine/core/zeit.js';
import { createSchleife } from '../../../engine/core/schleife.js';
import { createSpeicher } from '../../../engine/core/speicher.js';
import { createSpielerFigur } from './figur.js';
import { createDorf } from './dorf.js';
import { createSachen } from './sachen.js';
import { createKollisionsWelt } from '../../../engine/world/kollision.js';
import { createWeltAenderung } from '../../../engine/world/welt-aenderung.js';
import { findeLagerPlatz, bereiteLagerPlatz, LAGER_RADIUS } from './lager.js';
import { createPause } from './pause.js';

const $ = (id) => document.getElementById(id);
const HOEHEN_SKALA = 60, METER_PRO_ZELLE = 2;

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
const kamera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
// Himmel (Tag/Nacht, Sonne, Mond, Sterne, Wolken, Licht + Nebel), Wetter, Spieluhr, Spielstand – alles aus der Engine
const himmel = createHimmel({ szene });
const regen = createNiederschlag();
szene.add(regen.objekt);
const uhr = createSpielzeit({ stunde: 9, sekundenProStunde: 30 });
const wetter = createWetter({ seed: 1 });
const speicher = createSpeicher({ schluessel: 'pag-testwelt', version: 1 });
const stand = himmelStand({ stunde: 9 });
const WETTER_NAMEN = Object.keys(WETTER_ARTEN);
const WETTER_ZEICHEN = { klar: '☀️', heiter: '🌤', bewoelkt: '☁️', regen: '🌧', gewitter: '⛈', schnee: '🌨', nebel: '🌫', sturm: '🌬' };

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
if (['128', '256'].includes(url.get('groesse'))) groesseEl.value = url.get('groesse');

// ---- Welt ----
let welt = null, adapter = null, gelaende = null, objekte = null, wege = null, figur = null, dorf = null, sachen = null, kollision = null, aend = null;
let frisch = url.has('frisch'), pausiert = false;
const erde = (i) => Math.abs(aend.delta(i)) / 0.4;      // aufgegrabener/aufgeschütteter Boden wird erdfarben
const standDaten = () => ({ welt: weltSchluessel, uhr: uhr.zustand(), wetter: wetter.zustand(), pos: [figur.position.x, figur.position.z], sachen: sachen?.zustand(), aenderung: aend?.zustand() });
const schilder = createFigurSchilder();
let weltSchluessel = '';
let dorfNr = 0, gipfelNr = 0;
const pause = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

async function erzeuge(vorgabe = null) {
  $('lade').hidden = false;
  await pause();
  const t0 = performance.now();
  const g = +groesseEl.value;
  const neu = createWorld({ preset: presetEl.value, seed: +seedEl.value | 0, breite: g, tiefe: g, qualitaet: 'normal', wege: { aktiv: true } });
  const msWelt = performance.now() - t0;
  sachen?.dispose(); sachen = null; kollision?.dispose();
  gelaende?.dispose(); objekte?.dispose(); wege?.dispose(); adapter?.dispose(); aend?.dispose();
  welt = neu;
  adapter = createWeltAdapter(welt, { hoehenSkala: HOEHEN_SKALA, meterProZelle: METER_PRO_ZELLE });
  // Änderungs-Schicht: erst der Bauplatz fürs Lager (gehört zur Ausgangswelt), dann die gespeicherten Änderungen des Spielers
  aend = createWeltAenderung(adapter, { maxAbweichung: 4 });
  const start = adapter.startPunkt();
  const lagerPlatz = findeLagerPlatz(aend, adapter, start, welt.seed);
  if (lagerPlatz) bereiteLagerPlatz(aend, lagerPlatz);
  aend.festschreiben();
  if (lagerPlatz) aend.sperreUmkreis(lagerPlatz.x, lagerPlatz.z, LAGER_RADIUS + 1);   // unter dem Schuppen wird nicht gegraben
  weltSchluessel = `${presetEl.value}|${seedEl.value}|${g}`;
  const alt = vorgabe ?? (frisch ? null : speicher.lade('auto'));
  const gleicheWelt = !!alt && alt.welt === weltSchluessel;
  const geladen = gleicheWelt && alt.aenderung ? aend.lade(alt.aenderung) : null;
  gelaende = createTerrainMesh(adapter, { schatten: true });
  if (geladen) gelaende.aktualisiere(geladen, { erde });
  const t1 = performance.now();
  objekte = createScatterMesh(adapter, { schatten: true, unterWasser: false, assets: createAssetCache, bodendeckerWeite: 110, kachel: 128, fernWeite: 160,
    typSkala: { fels: 1.4, felsbrocken: 1.8 } });   // Felsen etwas größer → passt zu den Hindernis-Radien des Adapters
  wege = createWegeMesh(adapter, { schatten: true });
  for (const i of aend.entfernte()) { objekte.verstecke(i); adapter.setHindernis(i, false); }
  aend.onAenderung(({ bereich, objekte: geaendert }) => {     // nur das geänderte Stück neu zeichnen
    if (bereich) { gelaende.aktualisiere(bereich, { erde }); objekte.setzeAufBoden(bereich); }
    for (const [i, weg] of geaendert) { objekte.verstecke(i, weg); adapter.setHindernis(i, !weg); }
  });
  // Figur läuft über die Brücken; darüber die Kollisions-Welt (Kisten, Figuren-Körper, abbaubare Bäume)
  const begehbar = kollision = createKollisionsWelt({ welt: mitBruecken(adapter, wege.lagen) });
  szene.add(gelaende.gruppe, objekte.gruppe, wege.gruppe);
  himmel.setNebel(120, Math.max(300, adapter.groesse.x * 1.1));
  zeichneKarte();
  if (!figur) figur = createSpielerFigur({ szene, kamera, adapter: begehbar, element: canvas, start, seed: welt.seed, jetzt: () => uhr.tag + uhr.stunde / 24, schilder, npcs: () => dorf?.bewohner || [] });
  else figur.setAdapter(begehbar);
  figur.teleport(start.x, start.z);
  // Spielstand: Uhr + Wetter immer, Position nur in derselben Welt
  if (alt) {
    if (alt.uhr) uhr.lade(alt.uhr);
    if (alt.wetter) wetter.lade(alt.wetter);
    if (gleicheWelt && alt.pos) figur.teleport(alt.pos[0], alt.pos[1]);
  }
  speicher.auto('auto', standDaten, 10);
  dorf?.dispose();
  dorf = createDorf({ szene, adapter: begehbar, welt, schilder, spieler: () => figur.figur, seed: welt.seed });
  sachen = createSachen({ szene, welt: begehbar, objekte, bewohner: dorf.bewohner, start, seed: welt.seed, jetzt: () => uhr.tag + uhr.stunde / 24,
    stand: gleicheWelt ? alt.sachen : null, aend, lagerPlatz });
  dorfNr = gipfelNr = 0;
  const neueUrl = `?preset=${presetEl.value}&seed=${seedEl.value}&groesse=${g}`;
  history.replaceState(null, '', neueUrl);
  statistik = `Welt ${msWelt.toFixed(0)} ms · ${welt.wege.length} Wege · ${wege.anzahl} Brücken · ${objekte.anzahl} Objekte (${(performance.now() - t1).toFixed(0)} ms)`;
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
  kctx.strokeStyle = '#ecd9a8'; kctx.lineWidth = Math.max(1, B / 160); kctx.lineJoin = 'round';
  for (const w of welt.wege) {
    const P = w.punkte;
    kctx.beginPath(); kctx.moveTo(P[0] / welt.zelle, P[1] / welt.zelle);
    for (let k = 2; k < P.length; k += 2) kctx.lineTo(P[k] / welt.zelle, P[k + 1] / welt.zelle);
    kctx.stroke();
  }
  kartenBild = kctx.getImageData(0, 0, B, T);
}
function karteMarker() {
  if (!kartenBild || !figur) return;
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
$('zumStart').onclick = () => springeZu(welt.orte.start);
$('zumDorf').onclick = () => { const d = welt.orte.doerfer; if (d.length) springeZu(d[dorfNr++ % d.length]); };
$('kameraPreset').onclick = () => { $('kameraPreset').textContent = '🎥 ' + figur.naechstesPreset(); };
$('zeitVor').onclick = () => uhr.vor(3);
$('wetterKnopf').onclick = () => wetter.setze(WETTER_NAMEN[(WETTER_NAMEN.indexOf(wetter.art) + 1) % WETTER_NAMEN.length]);
addEventListener('pagehide', () => speicher.jetztSpeichern());
// Pause-Menü: Spielstand laden = seine Welt neu erzeugen (Seed) und die gespeicherten Änderungen einspielen
const menue = createPause({
  speicher, holeStand: standDaten, aend: () => aend, uhr, renderer, szene, anpassen: groesseAnpassen, onPause: (an) => { pausiert = an; if (an) sachen?.anzeige.fenster.schliesse(); },
  ladeStand(d) {
    const [preset, seed, groesse] = String(d?.welt ?? '').split('|');
    if (!PRESETS[preset]) return;
    presetEl.value = preset; seedEl.value = seed; groesseEl.value = groesse; frisch = false;
    erzeuge(d);
  },
});
$('menueKnopf').onclick = () => menue.schalte('start');
$('zumGipfel').onclick = () => { const g = welt.orte.poi.filter(p => p.art === 'gipfel'); if (g.length) springeZu(g[gipfelNr++ % g.length]); };
// Fokus von Knöpfen/Auswahl lösen, damit Tasten (Leertaste!) wieder die Figur steuern
for (const el of document.querySelectorAll('#oben button, #oben select')) el.addEventListener('click', () => el.blur());

// ---- Schleife ----
let statistik = '', infoZeit = 0, echtZeit = 0;
function klimaBei(p) {
  const { gx, gy } = adapter.zuGitter(p.x, p.z);
  const x = Math.floor(gx / welt.zelle), y = Math.floor(gy / welt.zelle);
  if (x < 0 || y < 0 || x >= welt.breite || y >= welt.tiefe) return { temperatur: 0.5, feuchte: 0.6 };
  const i = y * welt.breite + x;
  // Jahreszeit verschiebt die Temperatur (Sommer wärmer, Winter kälter → Schnee statt Regen)
  return { temperatur: welt.temperatur[i] + Math.sin(uhr.jahresAnteil * Math.PI * 2) * 0.15, feuchte: welt.feuchte[i] };
}
function update(dt) {
  if (!figur || !adapter || pausiert) return;
  echtZeit += dt;
  const stunden = uhr.update(dt);
  const p = figur.position;
  wetter.update(stunden, klimaBei(p));
  wetter.blitzUpdate(dt);
  speicher.update(dt);
  dorf?.update(dt, uhr.stunde);
  figur.update(dt);
  if (sachen) figur.zeigeInteraktion(sachen.update(dt, figur.figur, figur.interagiert));
  schilder.update(kamera, dt);
  himmelStand({ stunde: uhr.stunde, jahresAnteil: uhr.jahresAnteil, tag: uhr.tag, wetter }, stand);
  himmel.update(stand, { kamera, mitte: p, zeit: echtZeit, wind: wetter.wind, windRichtung: wetter.windRichtung });
  regen.update(dt, { kamera, regen: wetter.regen, schnee: wetter.schnee, wind: wetter.wind, windRichtung: wetter.windRichtung, hoehePx: innerHeight });
  objekte?.update(echtZeit, { kamera });

  if ((infoZeit -= dt) <= 0) {
    infoZeit = 0.2;
    const biom = adapter.biomBei(p.x, p.z), w = adapter.wasserHoehe(p.x, p.z);
    $('wetterKnopf').textContent = WETTER_ZEICHEN[wetter.art] ?? '🌦';
    $('info').innerHTML = `<b>${biom?.name ?? '–'}</b> · Höhe ${p.y.toFixed(1)} m${w !== null && w > p.y ? ' · 🌊' : ''}` +
      ` · ${figur.tempo.toFixed(1)} m/s · 🕒 ${uhr.uhrText()} · Tag ${uhr.tag} (${uhr.jahreszeitName}) · ${WETTER_ZEICHEN[wetter.art] ?? ''} ${wetter.art}` +
      `<br>${figur.art} · 🎥 ${figur.preset} · ${dorf?.bewohner.length ?? 0} Bewohner · ${Math.round(schleife.fps)} fps · ${statistik}`;
    karteMarker();
  }
}
const schleife = createSchleife({ update, render: () => { if (figur) renderer.render(szene, kamera); }, fehler: zeigeFehler });

erzeuge().then(() => { schleife.start(); if (url.has("debug")) window.testwelt = { renderer, szene, kamera, uhr, wetter, himmel, speicher, get figur() { return figur; }, get adapter() { return adapter; }, get dorf() { return dorf; }, get objekte() { return objekte; }, get sachen() { return sachen; }, get kollision() { return kollision; }, get aend() { return aend; }, get gelaende() { return gelaende; }, menue };  });
