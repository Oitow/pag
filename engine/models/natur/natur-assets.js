/**
 * @modul    natur-assets
 * @zweck    Registry der Natur-Generatoren (Bäume, Felsen, Totholz, Büsche, Bodendecker, Wüste): Typname → Generator, Asset bauen, Varianten-Cache mit gemeinsamen Geometrien
 * @api      TYP_ZU_GENERATOR { typ: erzeuge } ; FAMILIEN { familie: [typ…] } ; familieVon(typ) -> string|null ; alleTypen() -> [typ…] ; erzeugeAsset(typ, seed, opts) -> { geometrie, hoehe, radius, stammRadius } | null ; varianteOpts(typ, variante, opts) -> opts ; createAssetCache({ varianten, detail, jahreszeit, seed, opts }) -> { holen(typ, variante), hat(typ), varianten, detail, jahreszeit, anzahl(), dispose() }
 * @beispiel
 *   import { createAssetCache } from '../../engine/models/natur/natur-assets.js';
 *   const cache = createAssetCache({ varianten: 4, jahreszeit: 'herbst' });
 *   const { geometrie, hoehe } = cache.holen('eiche', 2);   // gleiche Geometrie bei jedem Aufruf
 *   cache.dispose();
 * @tags     natur, vegetation, baum, fels, busch, registry, cache, varianten, prozedural
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import { rng, hashSeed } from '../../core/rng.js';
import * as baum from './baum.js';
import * as fels from './fels.js';
import * as totholz from './totholz.js';
import * as busch from './pflanze-busch.js';
import * as boden from './pflanze-boden.js';
import * as wueste from './pflanze-wueste.js';

const MODULE = { baum, fels, totholz, busch, bodendecker: boden, wueste };

/** Familie → Typen (Reihenfolge wie in den Generatoren). */
export const FAMILIEN = Object.fromEntries(Object.entries(MODULE).map(([k, m]) => [k, [...m.TYPEN]]));

/** Typname → erzeuge(typ, seed, opts). */
export const TYP_ZU_GENERATOR = {};
const FAMILIE = {};
for (const [k, m] of Object.entries(MODULE)) for (const t of m.TYPEN) { TYP_ZU_GENERATOR[t] = m.erzeuge; FAMILIE[t] = k; }

export const familieVon = (typ) => FAMILIE[typ] ?? null;
export const alleTypen = () => Object.keys(TYP_ZU_GENERATOR);

/** Baut ein Asset; unbekannter Typ → null. opts.jahreszeit 'winter' gibt Felsen/Totholz Schnee. */
export function erzeugeAsset(typ, seed = 1, opts = {}) {
  const gen = TYP_ZU_GENERATOR[typ];
  if (!gen) return null;
  const f = FAMILIE[typ];
  const o = { ...opts };
  if ((f === 'fels' || f === 'totholz') && o.schnee === undefined) o.schnee = o.jahreszeit === 'winter' ? 0.7 : 0;
  return gen(typ, seed, o);
}

/**
 * Optionen für Variante v eines Typs: eigener Seed-Anteil plus leichte Streuung (Baumalter, Moos),
 * damit sich die Varianten deutlich unterscheiden. Deterministisch.
 */
export function varianteOpts(typ, variante, opts = {}) {
  const r = rng(hashSeed('natur-variante', typ, variante, opts.seed ?? 1));
  const f = FAMILIE[typ], o = { ...opts };
  if (f === 'baum' && o.alter === undefined) o.alter = 0.72 + 0.28 * r();
  if ((f === 'fels' || f === 'totholz') && o.moos === undefined) o.moos = f === 'totholz' ? 0.2 + 0.5 * r() : r() < 0.5 ? 0 : 0.4 * r();
  delete o.seed;
  return o;
}

/**
 * Cache: je (typ, variante) genau eine Geometrie. Varianten werden erst beim ersten holen() gebaut.
 * opts: { varianten 4, detail 1, jahreszeit 'sommer', seed 1, opts (weitere Generator-Optionen) }
 */
export function createAssetCache({ varianten = 4, detail = 1, jahreszeit = 'sommer', seed = 1, opts = {} } = {}) {
  const n = Math.max(1, varianten | 0);
  const cache = new Map();
  return {
    varianten: n, detail, jahreszeit,
    hat: (typ) => typ in TYP_ZU_GENERATOR,
    /** → { geometrie, hoehe, radius, stammRadius } oder null (unbekannter Typ). variante wird modulo varianten genommen. */
    holen(typ, variante = 0) {
      if (!(typ in TYP_ZU_GENERATOR)) return null;
      const v = ((variante | 0) % n + n) % n, key = typ + '#' + v;
      let a = cache.get(key);
      if (!a) {
        const o = varianteOpts(typ, v, { ...opts, detail, jahreszeit, seed });
        a = erzeugeAsset(typ, hashSeed(seed, typ, v), o);
        cache.set(key, a);
      }
      return a;
    },
    anzahl: () => cache.size,
    dispose() { for (const a of cache.values()) a.geometrie.dispose(); cache.clear(); },
  };
}
