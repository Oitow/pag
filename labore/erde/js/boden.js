// Boden und Untergrund (reine Logik, ohne THREE): Schichten unter jedem Punkt, Stoffe, Härte, Erze.
// Grundlage fürs Graben: was kommt raus, wie tief ist der Boden, braucht man eine Spitzhacke?
// Schichten: [Schnee] → Oberboden (nach Biom) → Unterboden (Lehm/Kies/Sand) → Gestein der Geologie (unendlich tief).
import { BIOM } from './klima.js';
import { GESTEIN_NAME } from './geologie.js';
import { hashSeed } from '../../../engine/core/rng.js';

/** Stoffe: haerte 0 = Hände, 1 = Schaufel, 2 = Spitzhacke, 3 = Eisen-Spitzhacke; dichte kg/m³ (für Gewicht/Menge). */
export const STOFFE = {
  schnee:    { name: 'Schnee', haerte: 0, dichte: 300, farbe: [0.93, 0.95, 0.97] },
  eis:       { name: 'Eis', haerte: 1, dichte: 900, farbe: [0.75, 0.86, 0.93] },
  humus:     { name: 'Erde', haerte: 0, dichte: 1200, farbe: [0.27, 0.2, 0.13] },
  torf:      { name: 'Torf', haerte: 0, dichte: 600, farbe: [0.22, 0.16, 0.1] },
  sand:      { name: 'Sand', haerte: 0, dichte: 1600, farbe: [0.82, 0.73, 0.52] },
  lehm:      { name: 'Lehm', haerte: 1, dichte: 1800, farbe: [0.6, 0.42, 0.27] },
  roterLehm: { name: 'Roter Lehm', haerte: 1, dichte: 1800, farbe: [0.62, 0.3, 0.18] },
  kies:      { name: 'Kies', haerte: 1, dichte: 1900, farbe: [0.55, 0.52, 0.47] },
  sandstein: { name: GESTEIN_NAME[0], haerte: 2, dichte: 2300, gestein: true },
  kalkstein: { name: GESTEIN_NAME[1], haerte: 2, dichte: 2600, gestein: true },
  granit:    { name: GESTEIN_NAME[2], haerte: 3, dichte: 2700, gestein: true },
  schiefer:  { name: GESTEIN_NAME[3], haerte: 2, dichte: 2750, gestein: true },
  basalt:    { name: GESTEIN_NAME[4], haerte: 3, dichte: 2900, gestein: true },
  // Funde beim Graben im Gestein
  kohle:     { name: 'Kohle', haerte: 2, dichte: 1400, fund: true },
  eisenerz:  { name: 'Eisenerz', haerte: 3, dichte: 3500, fund: true },
  kupfererz: { name: 'Kupfererz', haerte: 2, dichte: 3000, fund: true },
  feuerstein:{ name: 'Feuerstein', haerte: 2, dichte: 2600, fund: true },
  gold:      { name: 'Gold', haerte: 2, dichte: 19300, fund: true },
  salz:      { name: 'Salz', haerte: 1, dichte: 2200, fund: true },
  ammonit:   { name: 'Ammonit', haerte: 1, dichte: 2600, fund: true },
  quarz:     { name: 'Quarz', haerte: 2, dichte: 2650, fund: true },
};
const GESTEIN_STOFF = ['sandstein', 'kalkstein', 'granit', 'schiefer', 'basalt'];
// Funde je Gestein: [stoff, Wahrscheinlichkeit je Grabung, Mindesttiefe m]
const FUNDE = {
  sandstein: [['kohle', 0.08, 1], ['eisenerz', 0.02, 3], ['salz', 0.03, 2]],
  kalkstein: [['ammonit', 0.06, 0.5], ['feuerstein', 0.12, 0.5], ['salz', 0.02, 2]],
  granit:    [['quarz', 0.08, 1], ['kupfererz', 0.05, 1], ['gold', 0.006, 3], ['eisenerz', 0.03, 2]],
  schiefer:  [['eisenerz', 0.06, 1], ['kohle', 0.03, 2], ['gold', 0.004, 4]],
  basalt:    [['eisenerz', 0.08, 1], ['kupfererz', 0.03, 2]],
};

/**
 * Schichten unter einem Punkt. p = planet.probe()-Ergebnis (h, wasser, meer, ufer, temp, feuchte, gestein),
 * biom = Biom-Index, steil = tan(Hangneigung). → [{ stoff, dicke (m, letzte = Infinity) }]
 */
export function schichten(p, biom, steil = 0) {
  const s = [];
  const duenn = Math.max(0.15, 1 - Math.min(1, steil) * 0.85);          // am Steilhang wenig Boden
  if (p.temp < -3) s.push({ stoff: biom === BIOM.EIS ? 'eis' : 'schnee', dicke: Math.min(3, 0.3 + (-3 - p.temp) * 0.15) * (biom === BIOM.EIS ? 4 : 1) });
  const unterWasser = p.wasser > p.h + 0.05;
  if (p.meer && (p.h < 3 || unterWasser)) { s.push({ stoff: 'sand', dicke: 3 }); }
  else if (unterWasser || p.ufer > 0.5) { s.push({ stoff: 'kies', dicke: 1.2 }, { stoff: 'lehm', dicke: 1.5 }); }
  else switch (biom) {
    case BIOM.WUESTE: s.push({ stoff: 'sand', dicke: 4 * duenn }); break;
    case BIOM.TUNDRA: s.push({ stoff: 'torf', dicke: 0.5 * duenn }, { stoff: 'kies', dicke: 1 * duenn }); break;
    case BIOM.REGENWALD: case BIOM.SAVANNE: s.push({ stoff: 'humus', dicke: 0.2 * duenn }, { stoff: 'roterLehm', dicke: 3 * duenn }); break;
    case BIOM.STEPPE: s.push({ stoff: 'humus', dicke: 0.3 * duenn }, { stoff: 'sand', dicke: 1 * duenn }); break;
    case BIOM.GRASLAND: s.push({ stoff: 'humus', dicke: 0.8 * duenn }, { stoff: 'lehm', dicke: 1.5 * duenn }); break;
    case BIOM.EIS: break;
    default: s.push({ stoff: 'humus', dicke: 0.5 * duenn }, { stoff: 'lehm', dicke: 1.2 * duenn });
  }
  s.push({ stoff: GESTEIN_STOFF[p.gestein], dicke: Infinity });
  return s.filter((x) => x.dicke > 0.02);
}

/** Welcher Stoff liegt `tiefe` m unter der ursprünglichen Oberfläche? */
export function stoffInTiefe(sch, tiefe) {
  let t = 0;
  for (const x of sch) { t += x.dicke; if (tiefe < t) return x.stoff; }
  return sch[sch.length - 1].stoff;
}

/** Fruchtbarkeit 0…1 des Oberbodens (Ackerbau, Nachwachsen). */
export function fruchtbarkeit(sch) {
  const ob = sch[0]?.stoff;
  return { humus: 1, torf: 0.5, lehm: 0.6, roterLehm: 0.35, sand: 0.15, kies: 0.1 }[ob] ?? 0;
}

/**
 * Was bringt eine Grabung? stoff = Stoff an der Stelle, ort = [x,y,z] in m (für den Fund-Zufall, fest je 2-m-Zelle und Tiefe),
 * tiefe = m unter der ursprünglichen Oberfläche, werkzeug = höchste Härte, die man schafft, seed = Welt-Seed.
 * → { ok, grund?, stoff, menge, fund? }
 */
export function grabung(stoff, ort, tiefe, werkzeug, seed = 1) {
  const S = STOFFE[stoff];
  if (!S) return { ok: false, grund: 'unbekannt', stoff, menge: 0 };
  if (S.haerte > werkzeug) return { ok: false, grund: S.haerte >= 3 ? 'Eisen-Spitzhacke nötig' : S.haerte === 2 ? 'Spitzhacke nötig' : 'Schaufel nötig', stoff, menge: 0 };
  const menge = S.gestein ? 2 : 4;
  let fund = null;
  for (const [f, w, minT] of FUNDE[stoff] || []) {
    if (tiefe < minT) continue;
    const z = hashSeed(seed, f, Math.round(ort[0] / 2), Math.round(ort[1] / 2), Math.round(ort[2] / 2), Math.round(tiefe)) / 4294967296;
    if (z < w) { fund = f; break; }
  }
  return { ok: true, stoff, menge, fund };
}
