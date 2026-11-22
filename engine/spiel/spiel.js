/**
 * @modul    spiel
 * @zweck    Spiel-Host: die ganze Engine in einem Aufruf – Renderer, Szene, Kamera, Schleife (fester Schritt + Bild), Handy-Qualität, URL-Schalter und Modul-Kern; Module (Welt, Figur, Zauber, Gegner …) werden nur noch angesteckt
 * @api      createSpiel({canvas,module,optionen,seed,url,qualitaet,fest,fehler,hintergrund}) -> Promise<{kern,api(name),renderer,szene,kamera,ui,url,test,stufe,schleife,pause(bool),dispose()}> ; leseUrl(suche) -> {aus,test,seed,q,ort,debug,werte}
 * @beispiel
 *   import { createSpiel } from '../../engine/spiel/spiel.js';
 *   import { WELT_MODUL } from '../../engine/spiel/modul-welt.js';
 *   const spiel = await createSpiel({ canvas: document.getElementById('c'), module: [WELT_MODUL, SPIELER_MODUL] });
 *   spiel.api('spieler').teleport(10, 20);
 * @tags     spiel, host, modul, renderer, schleife, baukasten, mmo
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { createModulKern } from '../core/modul-kern.js';
import { createSchleife } from '../core/schleife.js';
import { hashSeed } from '../core/rng.js';
import { createQualitaet } from '../render/qualitaet.js';

/** URL → Schalter. ?aus=zauber,gegner · ?test=1 · ?seed=7 · ?q=niedrig|mittel|hoch · ?ort=… · ?debug · alle übrigen Werte roh in werte. */
export function leseUrl(suche = '') {
  const u = new URLSearchParams(suche);
  const werte = Object.fromEntries(u.entries());
  const s = u.get('seed');
  return {
    aus: (u.get('aus') || '').split(',').map((x) => x.trim()).filter(Boolean),
    test: u.has('test'), debug: u.has('debug'), ort: u.get('ort') || null,
    q: ['niedrig', 'mittel', 'hoch'].includes(u.get('q')) ? u.get('q') : null,
    seed: s == null ? null : (Number.isFinite(+s) ? +s | 0 : hashSeed(s)),
    werte,
  };
}

// Grund-Stufen fürs Rendern; Module lesen render.stufe und hören auf 'qualitaet' (Ereignis) für Wechsel.
const STUFEN = {
  niedrig: { name: 'niedrig', pixel: 1, schatten: 1024, sicht: 450, dichte: 0.55 },
  mittel: { name: 'mittel', pixel: 1.5, schatten: 2048, sicht: 800, dichte: 1 },
  hoch: { name: 'hoch', pixel: 2, schatten: 2048, sicht: 1200, dichte: 1.3 },
};

export async function createSpiel({
  canvas, module = [], optionen = {}, seed = 1, url = globalThis.location?.search ?? '', fest = 1 / 60,
  fehler = null, hintergrund = 0x7d93a0, ui = null, nah = 0.1, fern = 3000,
} = {}) {
  const schalter = leseUrl(url);
  const handy = !!globalThis.matchMedia?.('(pointer: coarse)').matches;
  const stufe = STUFEN[schalter.q || (handy ? 'niedrig' : 'mittel')];
  const meldeFehler = fehler || ((e, wo) => console.error(`[${wo}]`, e));

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: stufe.name !== 'niedrig', powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const szene = new THREE.Scene();
  szene.background = new THREE.Color(hintergrund);
  const kamera = new THREE.PerspectiveCamera(60, 1, nah, fern);
  let pixelMax = stufe.pixel;
  function groesse() {
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, pixelMax));
    renderer.setSize(globalThis.innerWidth, globalThis.innerHeight, false);
    kamera.aspect = globalThis.innerWidth / Math.max(1, globalThis.innerHeight);
    kamera.updateProjectionMatrix();
  }
  globalThis.addEventListener?.('resize', groesse);
  groesse();

  // Oberflächen-Wurzel für Module (HUD, Knöpfe) – über dem Canvas, Klicks gehen nur auf Kinder
  const uiWurzel = ui || globalThis.document?.createElement('div');
  if (!ui && uiWurzel) { uiWurzel.id = 'spiel-ui'; uiWurzel.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:3'; globalThis.document.body.appendChild(uiWurzel); }

  const qual = createQualitaet({ ziel: 1 / 40 });
  if (schalter.test) qual.fest(true);
  const kern = createModulKern({ optionen, seed: schalter.seed ?? seed, aus: schalter.aus, fehler: meldeFehler });

  // Eingebautes Modul 'render': alles, was andere zum Zeichnen brauchen
  const renderApi = {
    renderer, szene, kamera, canvas, ui: uiWurzel, stufe, handy, test: schalter.test, debug: schalter.debug, url: schalter,
    THREE, bildZeit: 0, echtDt: 0,
    /** Ein Modul kann vor/nach dem Hauptbild eigene Pässe zeichnen (Lichtkarte, Nachbearbeitung). */
    vorBild: new Set(), nachBild: new Set(),
    /** Statt renderer.render: z. B. PSX-Nachbearbeitung. fn(renderer, szene, kamera) */
    zeichner: null,
  };
  kern.registriere({ name: 'render', start: () => renderApi });
  for (const m of module) kern.registriere(m);
  await kern.starte();

  let pausiert = false;
  const schleife = createSchleife({
    fest, fehler: (e) => meldeFehler(e, 'schleife'),
    update: (dt) => { if (!pausiert) kern.fest(dt); },
    render: (alpha, dt) => {
      const t0 = globalThis.performance?.now() ?? 0;
      if (!pausiert) { kern.update(dt); kern.spaet(dt); }
      for (const f of renderApi.vorBild) f(dt);
      if (renderApi.zeichner) renderApi.zeichner(renderer, szene, kamera); else renderer.render(szene, kamera);
      for (const f of renderApi.nachBild) f(dt);
      renderApi.bildZeit = (globalThis.performance?.now() ?? 0) - t0;
      renderApi.echtDt = dt;
      const neu = qual.update(dt);
      if (neu) { pixelMax = Math.min(stufe.pixel, neu.pixel ?? stufe.pixel); groesse(); kern.ereignisse.sende('qualitaet', neu); }
    },
  });
  schleife.start();

  return {
    kern, renderer, szene, kamera, ui: uiWurzel, url: schalter, test: schalter.test, stufe, schleife,
    api: (n) => kern.api(n),
    get fps() { return schleife.fps; },
    pause(an = true) { pausiert = !!an; kern.ereignisse.sende('pause', { an: pausiert }); },
    get pausiert() { return pausiert; },
    dispose() {
      schleife.dispose?.(); schleife.stop?.();
      kern.dispose();
      globalThis.removeEventListener?.('resize', groesse);
      renderer.dispose();
      if (!ui) uiWurzel?.remove();
    },
  };
}
