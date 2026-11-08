/**
 * @modul    worldgen
 * @zweck    Weltgenerator-Einstieg: createWorld(optionen) führt die Stufen-Pipeline (Höhe → Erosion → Hydrologie → Flüsse → Klima → Biome → Orte → Objekte) per Preset aus; Spiele können Stufen einfügen/ersetzen; Ergebnis in typisierten Arrays
 * @api      createWorld(optionen) -> welt ; STANDARD_STUFEN ; transferierbar(welt) -> {daten, puffer} ; createChunkGenerator(optionen) -> {sampleHeight,generateChunk} ; PRESETS ; aufloesen(optionen) ; mitAbfragen(welt) ; createPathfinder(welt,opts) ; biomId(welt,key) ; FLAG ; hashArrays(...arrays)
 * @beispiel
 *   import { createWorld } from '../../engine/world/worldgen/worldgen.js';
 *   const welt = createWorld({ preset: 'insel', seed: 42, breite: 256, tiefe: 256, qualitaet: 'normal' });
 *   const h = welt.heightAt(100.5, 80.2), wasser = welt.isWater(100, 80), start = welt.orte.start;
 * @tags     welt, worldgen, insel, terrain, generator, prozedural, karte
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { aufloesen } from './worldgen-presets.js';
import { stufeHoehe } from './worldgen-height.js';
import { stufeErosion } from './worldgen-erosion.js';
import { stufeHydrologie } from './worldgen-hydrology.js';
import { stufeFluesse } from './worldgen-rivers.js';
import { stufeKlima } from './worldgen-climate.js';
import { stufeBiome } from './worldgen-biomes.js';
import { stufeOrte } from './worldgen-sites.js';
import { stufeObjekte } from './worldgen-scatter.js';
import { mitAbfragen } from './worldgen-query.js';

export { PRESETS, aufloesen } from './worldgen-presets.js';
export { mitAbfragen } from './worldgen-query.js';
export { createPathfinder } from './worldgen-path.js';
export { biomId } from './worldgen-biomes.js';
export { FLAG, hashArrays } from './worldgen-grid.js';
export { createChunkGenerator } from './worldgen-chunks.js';

const jetzt = () => (globalThis.performance ? globalThis.performance.now() : Date.now());

/** Abschluss: Höhen skalieren, interne Hilfsdaten entfernen. */
function stufeAbschluss(welt, opts) {
  const s = opts.hoehenSkala ?? 1;
  if (s !== 1) {
    const H = welt.hoehe, W = welt.wasserstand;
    for (let i = 0; i < H.length; i++) { H[i] *= s; W[i] *= s; }
    for (const see of welt.seen || []) { see.spiegel *= s; see.tiefe *= s; }
  }
  delete welt.reihenfolge;
}

/** Standard-Pipeline. Jede Stufe: { name, run(welt, opts) }. */
export const STANDARD_STUFEN = Object.freeze([
  { name: 'hoehe', run: stufeHoehe },
  { name: 'erosion', run: stufeErosion },
  { name: 'hydrologie', run: stufeHydrologie },
  { name: 'fluesse', run: stufeFluesse },
  { name: 'klima', run: stufeKlima },
  { name: 'biome', run: stufeBiome },
  { name: 'orte', run: stufeOrte },
  { name: 'objekte', run: stufeObjekte },
  { name: 'abschluss', run: stufeAbschluss },
]);

/**
 * Baut die Stufenliste: opts.stufen = [{ name, run, nach?: 'biome', vor?: 'objekte' }] fügt ein oder ersetzt (gleicher Name);
 * opts.ohne = ['erosion', …] lässt Stufen weg.
 */
function stufenliste(opts) {
  const liste = STANDARD_STUFEN.slice();
  for (const s of opts.stufen || []) {
    if (typeof s.run !== 'function') throw new Error(`worldgen: Stufe „${s.name}“ braucht run(welt, opts)`);
    const alt = liste.findIndex(x => x.name === s.name);
    if (alt >= 0 && !s.nach && !s.vor) { liste[alt] = s; continue; }
    const ref = liste.findIndex(x => x.name === (s.nach || s.vor));
    if (ref < 0) liste.splice(liste.length - 1, 0, s);
    else liste.splice(s.nach ? ref + 1 : ref, 0, s);
  }
  const ohne = new Set(opts.ohne || []);
  return liste.filter(s => !ohne.has(s.name));
}

/**
 * Erzeugt eine endliche Welt. optionen: siehe STANDARD_OPTIONEN in worldgen-presets.js (+ preset, stufen, ohne).
 * Ergebnis (Index i = y*breite + x):
 *  hoehe, wasserstand, temperatur, feuchte, hang, wasserDistanz, meerDistanz, flussBreite, abfluss: Float32Array
 *  flags: Uint8Array (FLAG-Bits), biom: Uint8Array, ziel: Int32Array (D8-Abfluss), seeId: Int16Array
 *  biome [{id,key,name,farbe}], fluesse [{punkte,breite,muendung}], seen, orte {start,doerfer,poi}, objekte {…}, zeiten {stufe: ms}
 *  + Methoden heightAt, slopeAt, normalAt, biomeAt, isWater, waterDepthAt (Weltkoordinaten = Zelle × zelle)
 */
export function createWorld(optionen = {}) {
  const opts = aufloesen(optionen);
  const b = Math.max(8, opts.breite | 0), t = Math.max(8, opts.tiefe | 0), n = b * t;
  opts.breite = b; opts.tiefe = t;
  const welt = {
    breite: b, tiefe: t, zelle: opts.zelle ?? 1, seed: opts.seed, preset: opts.preset, optionen: opts,
    hoehe: new Float32Array(n), wasserstand: new Float32Array(n), flags: new Uint8Array(n),
    temperatur: new Float32Array(n), feuchte: new Float32Array(n), biom: new Uint8Array(n), hang: new Float32Array(n),
    biome: [], fluesse: [], seen: [], orte: { start: null, doerfer: [], poi: [] }, objekte: null, zeiten: {},
  };
  const t0 = jetzt();
  for (const s of stufenliste(opts)) {
    const a = jetzt();
    s.run(welt, opts);
    welt.zeiten[s.name] = +(jetzt() - a).toFixed(2);
  }
  welt.zeiten.gesamt = +(jetzt() - t0).toFixed(2);
  return mitAbfragen(welt);
}

/**
 * Für postMessage aus einem Web Worker: flache Kopie ohne Funktionen + Liste der übertragbaren Puffer.
 * Empfänger: mitAbfragen(daten).
 */
export function transferierbar(welt) {
  const daten = {}, puffer = [];
  for (const [k, v] of Object.entries(welt)) {
    if (typeof v === 'function' || k === 'biomTabelle' || k === 'optionen') continue;
    if (ArrayBuffer.isView(v)) puffer.push(v.buffer);
    daten[k] = v;
  }
  if (welt.objekte) for (const v of Object.values(welt.objekte)) if (ArrayBuffer.isView(v)) puffer.push(v.buffer);
  for (const f of welt.fluesse || []) { puffer.push(f.punkte.buffer, f.breite.buffer); }
  daten.biome = welt.biome.map(({ regel, ...rest }) => ({ ...rest }));
  const { stufen, ...o } = welt.optionen || {};
  daten.optionen = JSON.parse(JSON.stringify(o));
  return { daten, puffer: [...new Set(puffer)] };
}
