/**
 * @modul    worldgen-vegetation
 * @zweck    Standard-Objektarten des Weltgenerators als reine Daten: Kronendach, Totholz, Unterholz, Büsche (Waldrand), Felsen/Findlinge, Geröll am Hangfuß, Kakteen, Schilf, Seerosen, Blumen und Bodendecker – mit gewichteten Typen je Biom und Typmischung nach Höhe/Feuchte/Temperatur
 * @api      STANDARD_OBJEKTE ; VEGETATION_TYPEN ; typenVon(art) -> string[]
 * @beispiel
 *   import { STANDARD_OBJEKTE, VEGETATION_TYPEN } from '../../engine/world/worldgen/worldgen-vegetation.js';
 *   createWorld({ preset: 'insel', objekte: { arten: STANDARD_OBJEKTE.filter(a => a.key !== 'bodendecker') } });
 *   VEGETATION_TYPEN.includes('fichte');   // true
 * @tags     welt, worldgen, objekte, vegetation, baeume, felsen, bodendecker, daten
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

/**
 * Felder einer Art (alle Bereiche [min, max], Werte normiert wie in der Welt):
 *   key, radius (Mindestabstand in Zellen), platz (belegt Zellen, andere Arten weichen aus), belegt:false (ignoriert Belegung),
 *   dichte { biomKey: p, _: Rest }, typen { biomKey: [Eintrag…], _: [...] }, cluster { frequenz, schwelle, weich },
 *   hang, hoehe, wasserDist, skala [min,max],
 *   unterWald (0..1: nur unter Kronendach), rand { dist, gewicht } (mehr am Waldrand), hangFuss { dist, min, weich } (unter Hängen),
 *   wasser: 'see' (nur auf Seen) + tiefe [min,max] (normiert).
 * Typ-Eintrag: 'name' oder { typ, w (Gewicht), hoehe, temp, feuchte, hang, wasserDist, skala }. Bedingungen werden
 * leicht verrauscht geprüft → weiche Übergänge (z. B. Fichte höher, Buche tiefer).
 */
export const STANDARD_OBJEKTE = [
  // ---- Kronendach ----
  { key: 'baum', radius: 2, platz: 1, skala: [0.75, 1.25],
    dichte: { laubwald: 0.85, nadelwald: 0.9, birkenwald: 0.8, regenwald: 0.95, hartlaubwald: 0.5, wiese: 0.05, savanne: 0.07, sumpf: 0.25,
      heide: 0.04, tundra: 0.03, steppe: 0.01, strand: 0.05 },
    typen: {
      laubwald: [{ typ: 'buche', w: 3, feuchte: [0.6, 1], temp: [0.45, 1] }, { typ: 'eiche', w: 3, temp: [0.52, 1] }, { typ: 'ahorn', w: 2 },
        { typ: 'birke', w: 0.6 }, { typ: 'fichte', w: 3, temp: [0, 0.48] }, { typ: 'weide', w: 3, wasserDist: [0, 3] }],
      nadelwald: [{ typ: 'fichte', w: 4 }, { typ: 'tanne', w: 3, feuchte: [0.5, 1] }, { typ: 'kiefer', w: 2.5, feuchte: [0, 0.55] },
        { typ: 'birke', w: 0.6, temp: [0.32, 1] }],
      birkenwald: [{ typ: 'birke', w: 5 }, { typ: 'kiefer', w: 1 }, { typ: 'fichte', w: 1.5, temp: [0, 0.38] }, { typ: 'ahorn', w: 0.6, temp: [0.4, 1] }],
      regenwald: [{ typ: 'tropenbaum', w: 5 }, { typ: 'palme', w: 1.2 }],
      hartlaubwald: [{ typ: 'olive', w: 3 }, { typ: 'pinie', w: 3 }, { typ: 'kiefer', w: 1, temp: [0, 0.8] }],
      savanne: [{ typ: 'akazie', w: 4 }, { typ: 'palme', w: 1, wasserDist: [0, 4] }], steppe: ['akazie'],
      sumpf: [{ typ: 'weide', w: 4 }, { typ: 'toterBaum', w: 1.2 }, { typ: 'birke', w: 1 }],
      heide: [{ typ: 'kiefer', w: 3 }, { typ: 'birke', w: 1 }], tundra: [{ typ: 'fichte', w: 2 }, { typ: 'tanne', w: 1 }],
      wiese: [{ typ: 'eiche', w: 3 }, { typ: 'ahorn', w: 1.5 }, { typ: 'birke', w: 1 }, { typ: 'buche', w: 0.6 }, { typ: 'weide', w: 4, wasserDist: [0, 3] }],
      strand: [{ typ: 'palme', w: 1, temp: [0.62, 1] }],
      _: ['eiche', 'birke'],
    },
    cluster: { frequenz: 14, schwelle: -0.3, weich: 0.35 }, hang: [0, 0.08], wasserDist: [1, 1e9] },
  // ---- Totholz im Wald (Lücken zwischen den Stämmen) ----
  { key: 'totholz', radius: 2.4, skala: [0.7, 1.2],
    dichte: { laubwald: 0.1, nadelwald: 0.13, birkenwald: 0.08, regenwald: 0.08, sumpf: 0.14, hartlaubwald: 0.04 },
    typen: { _: [{ typ: 'baumstumpf', w: 3 }, { typ: 'liegenderStamm', w: 2, hang: [0, 0.05] }, { typ: 'ast', w: 3 }] },
    unterWald: 0.35, hang: [0, 0.08], wasserDist: [1, 1e9] },
  // ---- Büsche, gehäuft am Waldrand ----
  { key: 'busch', radius: 1.4, skala: [0.7, 1.25],
    dichte: { wiese: 0.1, heide: 0.3, laubwald: 0.12, birkenwald: 0.14, savanne: 0.15, steppe: 0.08, hartlaubwald: 0.25, tundra: 0.1, sumpf: 0.1, nadelwald: 0.06, regenwald: 0.1 },
    typen: {
      heide: [{ typ: 'ginster', w: 3 }, { typ: 'zwergstrauch', w: 2 }], tundra: ['zwergstrauch'],
      nadelwald: [{ typ: 'beerenbusch', w: 2 }, { typ: 'zwergstrauch', w: 1 }, { typ: 'busch', w: 1 }],
      laubwald: [{ typ: 'busch', w: 2 }, { typ: 'beerenbusch', w: 2 }], birkenwald: [{ typ: 'beerenbusch', w: 2 }, { typ: 'busch', w: 2 }],
      steppe: [{ typ: 'ginster', w: 2 }, { typ: 'busch', w: 1 }], hartlaubwald: [{ typ: 'busch', w: 2 }, { typ: 'ginster', w: 1 }],
      wiese: [{ typ: 'busch', w: 3 }, { typ: 'beerenbusch', w: 1.2 }, { typ: 'ginster', w: 0.6, feuchte: [0, 0.4] }],
      _: ['busch'],
    },
    rand: { dist: 4, gewicht: 3 }, hang: [0, 0.09], wasserDist: [1, 1e9] },
  // ---- Unterholz im Waldschatten ----
  { key: 'unterholz', radius: 1.3, belegt: false, skala: [0.7, 1.3],
    dichte: { laubwald: 0.4, nadelwald: 0.38, birkenwald: 0.35, regenwald: 0.6, sumpf: 0.25, hartlaubwald: 0.12 },
    typen: { _: [{ typ: 'farn', w: 4, feuchte: [0.45, 1] }, { typ: 'farn', w: 1 }, { typ: 'pilz', w: 1.2 }],
      nadelwald: [{ typ: 'farn', w: 2 }, { typ: 'pilz', w: 2 }], regenwald: ['farn'] },
    unterWald: 0.4, cluster: { frequenz: 30, schwelle: -0.25, weich: 0.4 }, hang: [0, 0.1], wasserDist: [1, 1e9] },
  // ---- Felsen und Findlinge ----
  { key: 'fels', radius: 2.6, platz: 1, skala: [0.7, 1.3],
    dichte: { fels: 0.3, tundra: 0.1, schnee: 0.04, heide: 0.06, wueste: 0.04, steppe: 0.05, strand: 0.03, nadelwald: 0.04, wiese: 0.025 },
    typen: {
      fels: [{ typ: 'fels', w: 3 }, { typ: 'felsbrocken', w: 2 }, { typ: 'felsnadel', w: 1.5, hang: [0.11, 99] }, { typ: 'felsplatte', w: 1.5, hang: [0, 0.1] }],
      wiese: [{ typ: 'findling', w: 4 }, { typ: 'fels', w: 1 }], heide: [{ typ: 'findling', w: 3 }, { typ: 'fels', w: 1 }],
      steppe: [{ typ: 'findling', w: 2 }, { typ: 'felsplatte', w: 1 }], nadelwald: [{ typ: 'findling', w: 2 }, { typ: 'fels', w: 2 }],
      tundra: [{ typ: 'fels', w: 2 }, { typ: 'felsplatte', w: 2 }, { typ: 'findling', w: 1 }],
      wueste: [{ typ: 'felsbrocken', w: 2 }, { typ: 'felsplatte', w: 2 }, { typ: 'felsnadel', w: 0.5 }],
      strand: [{ typ: 'fels', w: 2 }, { typ: 'felsplatte', w: 1 }],
      _: ['fels', 'felsbrocken'],
    },
    wasserDist: [0.5, 1e9] },
  // ---- Geröll am Hangfuß und unter Klippen ----
  { key: 'geroell', radius: 1.6, skala: [0.6, 1.3],
    dichte: { fels: 0.55, tundra: 0.35, schnee: 0.2, heide: 0.3, nadelwald: 0.25, wiese: 0.25, steppe: 0.35, wueste: 0.3, laubwald: 0.15, birkenwald: 0.2,
      hartlaubwald: 0.25, savanne: 0.2, strand: 0.15 },
    typen: { _: [{ typ: 'geroell', w: 4 }, { typ: 'felsplatte', w: 0.7, hang: [0, 0.05] }] },
    hangFuss: { dist: 3, min: 0.025, weich: 0.05 }, wasserDist: [0.5, 1e9] },
  // ---- Wüste ----
  { key: 'kaktus', radius: 2.2, skala: [0.7, 1.25], dichte: { wueste: 0.14, savanne: 0.04, steppe: 0.02 },
    typen: { wueste: [{ typ: 'kaktus', w: 2 }, { typ: 'saeulenkaktus', w: 2, temp: [0.78, 1] }, { typ: 'agave', w: 2 }],
      _: [{ typ: 'agave', w: 2 }, { typ: 'kaktus', w: 1 }] },
    hang: [0, 0.06], wasserDist: [1, 1e9] },
  // ---- Ufer und Wasser ----
  { key: 'schilf', radius: 0.9, dichte: { sumpf: 0.6, wueste: 0, schnee: 0, fels: 0, tundra: 0.1, _: 0.35 }, typen: { _: ['schilf'] }, wasserDist: [0.5, 2.6], hang: [0, 0.05] },
  { key: 'seerose', radius: 1.2, belegt: false, skala: [0.7, 1.3], wasser: 'see', tiefe: [0, 0.035],
    dichte: { see: 0.55 }, typen: { _: [{ typ: 'seerose', w: 1, temp: [0.28, 0.95] }] }, cluster: { frequenz: 26, schwelle: -0.1, weich: 0.35 } },
  // ---- Bodendecker ----
  { key: 'blume', radius: 1.2, dichte: { wiese: 0.3, birkenwald: 0.08, laubwald: 0.03, savanne: 0.04, heide: 0.05 }, typen: { _: ['blume'] },
    cluster: { frequenz: 22, schwelle: 0.0, weich: 0.3 }, hang: [0, 0.06], wasserDist: [1, 1e9], skala: [0.7, 1.3] },
  { key: 'bodendecker', radius: 1.25, belegt: false, skala: [0.6, 1.4],
    dichte: { wiese: 0.5, savanne: 0.45, steppe: 0.3, heide: 0.25, birkenwald: 0.3, laubwald: 0.12, hartlaubwald: 0.2, tundra: 0.2, sumpf: 0.2, nadelwald: 0.06 },
    typen: { _: ['grasbueschel'] }, cluster: { frequenz: 18, schwelle: -0.35, weich: 0.5 }, hang: [0, 0.07], wasserDist: [1, 1e9] },
];

/** Alle Typnamen, die in einer Art vorkommen (ohne Doppelte). */
export function typenVon(art) {
  const s = new Set();
  for (const liste of Object.values(art.typen || {})) for (const e of liste) s.add(typeof e === 'string' ? e : e.typ);
  if (!s.size) s.add(art.key);
  return [...s];
}

/** Alle Typnamen der Standardarten. */
export const VEGETATION_TYPEN = [...new Set(STANDARD_OBJEKTE.flatMap(typenVon))];
