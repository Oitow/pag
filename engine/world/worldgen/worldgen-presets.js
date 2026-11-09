/**
 * @modul    worldgen-presets
 * @zweck    Standardoptionen und benannte Voreinstellungen (insel, archipel, kontinent, gebirge, wueste, tundra, sumpfland, vulkaninsel, canyon, flachland, kueste, hochebene, unendlich) plus tiefes Zusammenführen von Optionen
 * @api      STANDARD_OPTIONEN ; PRESETS ; mischeOptionen(...quellen) -> opts ; aufloesen(optionen) -> opts
 * @beispiel
 *   import { aufloesen } from '../../engine/world/worldgen/worldgen-presets.js';
 *   const opts = aufloesen({ preset: 'vulkaninsel', seed: 9, klima: { feuchte: 0.8 } });
 * @tags     welt, worldgen, presets, optionen, insel
 * @version  1.1.0
 * @status   entwurf
 * @three    nein
 */

/** Alle Optionen mit Standardwerten (Höhen normiert: Meeresspiegel 0, hohe Gipfel ≈ 1). */
export const STANDARD_OPTIONEN = {
  seed: 1, breite: 256, tiefe: 256, zelle: 1, qualitaet: 'normal', hoehenSkala: 1, kachelbar: false,
  form: { typ: 'insel', radius: 0.78, kuestenRauschen: 0.5, randMeer: true, randBreite: 0.08 },
  hoehe: {
    massstab: 0, oktaven: 5, frequenz: 3, rauschGewicht: 0.55, maskGewicht: 1, landAnteil: 0, flach: 0.35, meerTiefe: 0.6,
    warp: { staerke: 0.08, frequenz: 2.5 }, huegel: 1, huegelFrequenz: 8,
    gebirge: { menge: 0.5, hoehe: 0.9, schaerfe: 1.5, frequenz: 2.2, gratFrequenz: 5, oktaven: 5 },
    klippen: 0.3, terrassen: { stufen: 0, staerke: 0 }, kontinente: 0, kontinentFrequenz: 0.35,
  },
  erosion: { aktiv: true, staerke: 1, thermisch: 1, talus: 0.025 },
  wasser: { seen: true, fluesse: true, flussMenge: 0.6, flussBreite: 0.8, flussTiefe: 0.02, seeMinTiefe: 0.006, seeMinFlaeche: 14, glaetten: 2 },
  klima: { temperatur: 0.55, feuchte: 0.5, hoehenKaelte: 0.55, breitengrad: 'keine', breitenSpanne: 0.35, wind: 0, regenschatten: 1, wasserNaehe: 0.2, rauschen: 0.08 },
  biome: { extra: [], aus: [], randRauschen: 0.04 },
  objekte: { aktiv: true, dichte: 1 },
  orte: { start: true, doerfer: 3, poi: true },
  chunk: { fluesse: true, flussModus: 'netz', netz: {}, flussBreite: 0.014, flussTiefe: 0.05, flussFrequenz: 1.6 },
  stufen: [],
};

const ASCHE = { key: 'asche', name: 'Asche', farbe: 0x433c39, regel: { prio: 75, hoehe: [0.62, 99] } };
const LAVA = { key: 'lavafeld', name: 'Lavafeld', farbe: 0x5a2e22, regel: { prio: 74, hoehe: [0.4, 99], hang: [0.05, 99] } };

/** Benannte Voreinstellungen – nur Teil-Optionen, werden über STANDARD_OPTIONEN gelegt. */
export const PRESETS = {
  insel: { name: 'Insel' },
  archipel: {
    name: 'Archipel', form: { typ: 'archipel', anzahl: 8, kuestenRauschen: 0.6 },
    hoehe: { rauschGewicht: 0.45, gebirge: { menge: 0.3, hoehe: 0.7 } }, orte: { doerfer: 2 }, klima: { temperatur: 0.62, feuchte: 0.58 },
  },
  kontinent: {
    name: 'Kontinent', form: { typ: 'kontinent', randMeer: true, randBreite: 0.04 },
    hoehe: { rauschGewicht: 0.7, gebirge: { menge: 0.6, hoehe: 1.1 } }, klima: { breitengrad: 'nord', breitenSpanne: 0.4, wind: 0 },
    wasser: { flussMenge: 0.8 }, orte: { doerfer: 5 },
  },
  gebirge: {
    name: 'Gebirge', form: { typ: 'unendlich' },
    hoehe: { landAnteil: 0.45, flach: 0.5, gebirge: { menge: 0.95, hoehe: 1.4, schaerfe: 1.8 }, klippen: 0 },
    klima: { temperatur: 0.62, hoehenKaelte: 0.6 }, wasser: { flussMenge: 0.8 }, orte: { hoeheMax: 0.8 },
  },
  wueste: {
    name: 'Wüste', form: { typ: 'kontinent', randBreite: 0.03 },
    hoehe: { huegel: 1.6, huegelFrequenz: 6, gebirge: { menge: 0.3, hoehe: 0.7, schaerfe: 2 } },
    erosion: { staerke: 0.5 }, wasser: { flussMenge: 0.25, seen: false },
    klima: { temperatur: 0.88, feuchte: 0.1, regenschatten: 0.6, wasserNaehe: 0.3 },
  },
  tundra: {
    name: 'Tundra', form: { typ: 'kontinent' }, hoehe: { flach: 0.3, gebirge: { menge: 0.4, hoehe: 0.8 } },
    klima: { temperatur: 0.22, feuchte: 0.45, hoehenKaelte: 0.4 }, wasser: { seeMinTiefe: 0.003, seeMinFlaeche: 8 },
  },
  sumpfland: {
    name: 'Sumpfland', form: { typ: 'insel', radius: 0.9 },
    hoehe: { flach: 0.12, huegel: 0.35, gebirge: { menge: 0.05, hoehe: 0.2 }, klippen: 0 },
    erosion: { staerke: 0.6 }, wasser: { flussMenge: 1.2, seeMinTiefe: 0.0015, seeMinFlaeche: 6 },
    klima: { temperatur: 0.6, feuchte: 0.82, wasserNaehe: 0.3 },
    biome: { regeln: { sumpf: { prio: 50, feuchte: [0.6, 1], hoehe: [0, 0.12], hang: [0, 0.03], wasserDist: [0, 14] } } },
  },
  vulkaninsel: {
    name: 'Vulkaninsel', form: { typ: 'vulkan', radius: 0.62, kuestenRauschen: 0.35 },
    hoehe: { gebirge: { menge: 0.2, hoehe: 0.5 }, klippen: 0.6 },
    klima: { temperatur: 0.78, feuchte: 0.62, wind: 45, hoehenKaelte: 0.4 }, biome: { extra: [ASCHE, LAVA] },
  },
  canyon: {
    name: 'Canyon', form: { typ: 'canyon', canyonTiefe: 0, stufen: 4, radius: 0.95 },
    hoehe: { flach: 0.5, gebirge: { menge: 0.15, hoehe: 0.3 }, huegel: 0.5, warp: { staerke: 0.12 }, klippen: 0 },
    erosion: { staerke: 0.5, thermisch: 0.3 },
    wasser: { flussMenge: 0.9, flussBreite: 0.5, seeMinTiefe: 0.02, seeMinFlaeche: 30, tal: { tiefe: 0.28, breite: 5, form: 'schlucht', maxBreite: 12 } },
    klima: { temperatur: 0.86, feuchte: 0.16, hoehenKaelte: 0.2, wasserNaehe: 0.35 },
    biome: { farben: { fels: 0xa4583a, wueste: 0xd59a5e, steppe: 0xc29464 }, regeln: { fels: { prio: 70, hang: [0.05, 99] } } },
  },
  flachland: {
    name: 'Flachland', form: { typ: 'kontinent', randBreite: 0.04 },
    hoehe: { flach: 0.18, huegel: 0.7, gebirge: { menge: 0, hoehe: 0 }, rauschGewicht: 0.6, klippen: 0.1 },
    wasser: { flussMenge: 0.7 }, orte: { doerfer: 5 },
  },
  kueste: {
    name: 'Küste', form: { typ: 'kueste', richtung: 0, kuestenRauschen: 0.7 },
    hoehe: { gebirge: { menge: 0.55 } }, klima: { wind: 0 },
  },
  hochebene: {
    name: 'Hochebene', form: { typ: 'plateau', stufen: 3, kantenHaerte: 0.8 },
    hoehe: { flach: 0.6, gebirge: { menge: 0.3, hoehe: 0.5 } }, klima: { temperatur: 0.6, feuchte: 0.4 }, orte: { hoeheMax: 0.8 },
  },
  unendlich: {
    name: 'Unendlich (Chunks)', form: { typ: 'unendlich' },
    hoehe: { massstab: 256, landAnteil: 0.12, kontinente: 0.6, kontinentFrequenz: 0.18 },
  },
};

const istObjekt = v => v !== null && typeof v === 'object' && !Array.isArray(v) && !ArrayBuffer.isView(v);

/** Tiefes Zusammenführen: spätere Quellen gewinnen, Arrays und Funktionen werden ersetzt. */
export function mischeOptionen(...quellen) {
  const ziel = {};
  for (const q of quellen) if (q) mische(ziel, q);
  return ziel;
}
function mische(ziel, q) {
  for (const k of Object.keys(q)) {
    const v = q[k];
    if (v === undefined) continue;
    if (istObjekt(v)) { if (!istObjekt(ziel[k])) ziel[k] = {}; mische(ziel[k], v); }
    else ziel[k] = v;
  }
}

/** Standard + Preset (optionen.preset, Standard 'insel') + eigene Optionen. */
export function aufloesen(optionen = {}) {
  const name = optionen.preset || 'insel';
  const p = PRESETS[name];
  if (!p) throw new Error(`worldgen: unbekanntes Preset „${name}“ (bekannt: ${Object.keys(PRESETS).join(', ')})`);
  const o = mischeOptionen(STANDARD_OPTIONEN, p, optionen);
  o.preset = name;
  return o;
}
