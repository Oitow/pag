// Kleinkram-Assets (A3) für die Asset-Galerie: { name, fabrik, opts }
import { createMarktstand, createBrunnen, createBank } from '../../../engine/models/bau/markt.js';
import { createFass, createKiste, createBanner } from '../../../engine/models/bau/vorrat.js';
import { createLaterne, createFackel, createLagerfeuer } from '../../../engine/models/bau/licht.js';
import { createWegweiser, createZaun, createSteinkreis } from '../../../engine/models/bau/wegbau.js';
import { createTrainingspuppe, createZielscheibe, createZelt, createAmboss } from '../../../engine/models/bau/uebung.js';

export const KLEINKRAM = [
  ...[0, 1, 2, 3].map((v) => ({ name: `Marktstand ${v}`, fabrik: createMarktstand, opts: { seed: 1, variante: v } })),
  { name: 'Brunnen', fabrik: createBrunnen, opts: { seed: 1 } },
  { name: 'Bank', fabrik: createBank, opts: { seed: 1 } },
  { name: 'Fass', fabrik: createFass, opts: { seed: 1 } },
  { name: 'Kiste', fabrik: createKiste, opts: { seed: 1, variante: 0 } },
  { name: 'Kiste flach', fabrik: createKiste, opts: { seed: 1, variante: 1 } },
  ...[0, 1, 2, 3].map((v) => ({ name: `Banner ${v}`, fabrik: createBanner, opts: { seed: 1, variante: v } })),
  { name: 'Laterne', fabrik: createLaterne, opts: { seed: 1 } },
  { name: 'Fackel', fabrik: createFackel, opts: { seed: 1 } },
  { name: 'Lagerfeuer', fabrik: createLagerfeuer, opts: { seed: 1 } },
  { name: 'Wegweiser', fabrik: createWegweiser, opts: { seed: 1, schilder: [{ winkel: 1.2, text: 'Enklave' }, { winkel: -2, text: 'Tal' }, { winkel: 2.6, text: 'Aussicht' }] } },
  { name: 'Zaun Latten', fabrik: createZaun, opts: { seed: 1, variante: 0 } },
  { name: 'Zaun Flechtwerk', fabrik: createZaun, opts: { seed: 1, variante: 1 } },
  { name: 'Steinkreis', fabrik: createSteinkreis, opts: { seed: 1 } },
  { name: 'Trainingspuppe', fabrik: createTrainingspuppe, opts: { seed: 1 } },
  { name: 'Zielscheibe', fabrik: createZielscheibe, opts: { seed: 1 } },
  { name: 'Zelt', fabrik: createZelt, opts: { seed: 1, variante: 0 } },
  { name: 'Amboss', fabrik: createAmboss, opts: { seed: 1 } },
];
