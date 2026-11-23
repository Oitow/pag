// Gigant-Welt: EINE Quelle für Weltform (Fassade). Alle Module importieren Höhe/Wald/GLSL von hier.
// Aktiv: gelaende.js (Gebirge, Flüsse, Seen, Plateaus, Dünen). Rückweg zur alten Form: hier auf rauschen.js umstellen.
import { hoeheAt, waldAt, waldRoh, duneRaw, biomAt, findeStart, GLSL_GELAENDE_VOLL } from './gelaende.js';
import { FRAG_COMMON as FRAG_ALT } from './rauschen.js';
export { ss, gn, fbm, ridged, rngFrom, cellSeed } from './rauschen.js';
// Terrain-Farbe für das neue Gelände: Schneegrenze 800–1050 m (Clipmap UND Voxel nutzen diesen String).
export const FRAG_COMMON = FRAG_ALT.replace('smoothstep(640.,740.,hh+v1*70.)', 'smoothstep(800.,1050.,hh+v1*70.)')
  .replace('(1.-smoothstep(.38,.62,slope))', '(1.-smoothstep(.4,.65,slope))');
export { biomAt, findeStart };
export const heightAt = hoeheAt;
export const forestAt = waldAt;
export const forestRaw = (x, z) => waldRoh(x, z) * (1 - duneRaw(x, z));
export const GLSL_NOISE = GLSL_GELAENDE_VOLL;
