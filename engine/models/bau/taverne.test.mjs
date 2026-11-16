import { createTaverne } from './taverne.js';
import { pruefeAsset } from './gebaeude-pruefen.mjs';
pruefeAsset('taverne', createTaverne, { budget: 1500, anker: ['tuer', 'sitz', 'licht'] });
