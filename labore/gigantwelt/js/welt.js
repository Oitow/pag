// Gigant-Welt: EINE Quelle für Weltform (Fassade). Alle Module importieren Höhe/Wald/GLSL von hier.
// Aktiv: gelaende.js (Gebirge, Flüsse, Seen, Plateaus, Dünen). Rückweg zur alten Form: hier auf rauschen.js umstellen.
import { hoeheAt, waldAt, waldRoh, duneRaw, biomAt, findeStart, GLSL_GELAENDE_VOLL } from './gelaende.js';
export { ss, gn, fbm, ridged, rngFrom, cellSeed, FRAG_COMMON } from './rauschen.js';
export { biomAt, findeStart };
export const heightAt = hoeheAt;
export const forestAt = waldAt;
export const forestRaw = (x, z) => waldRoh(x, z) * (1 - duneRaw(x, z));
export const GLSL_NOISE = GLSL_GELAENDE_VOLL;
