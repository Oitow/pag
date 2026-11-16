import { createHaus } from './haus.js';
import { pruefeAsset } from './gebaeude-pruefen.mjs';
pruefeAsset('haus', createHaus, { varianten: [0, 1], budget: 1200, anker: ['tuer', 'fackeln', 'licht'] });
