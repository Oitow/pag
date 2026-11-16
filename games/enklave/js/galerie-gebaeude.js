// Gebäude-Assets (A2) für die Asset-Galerie: { name, fabrik, opts, varianten? }
import { createHaus } from '../../../engine/models/bau/haus.js';
import { createTaverne } from '../../../engine/models/bau/taverne.js';
import { createSchmiede } from '../../../engine/models/bau/schmiede.js';
import { createWachturm } from '../../../engine/models/bau/wachturm.js';
import { createTempel } from '../../../engine/models/bau/tempel.js';
import { createMauer, createMauerTurm, createTorhaus, createTorfluegel } from '../../../engine/models/bau/mauer.js';

export const GEBAEUDE = [
  { name: 'Haus Fachwerk', fabrik: createHaus, opts: { seed: 1, variante: 0 }, varianten: 2 },
  { name: 'Haus Stein', fabrik: createHaus, opts: { seed: 1, variante: 1 }, varianten: 2 },
  { name: 'Taverne', fabrik: createTaverne, opts: { seed: 1 } },
  { name: 'Schmiede', fabrik: createSchmiede, opts: { seed: 1 } },
  { name: 'Wachturm', fabrik: createWachturm, opts: { seed: 1 } },
  { name: 'Tempel', fabrik: createTempel, opts: { seed: 1 } },
  { name: 'Torhaus', fabrik: createTorhaus, opts: { seed: 1 } },
  { name: 'Mauerturm', fabrik: createMauerTurm, opts: { seed: 1 } },
  { name: 'Mauer', fabrik: createMauer, opts: { seed: 1 } },
  { name: 'Mauer x1.5', fabrik: createMauer, opts: { seed: 1, sx: 1.5 } },
  { name: 'Torflügel', fabrik: createTorfluegel, opts: { seed: 1 } },
];
