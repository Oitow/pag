/**
 * @modul    himmel-stand
 * @zweck    Himmel als reine Daten: Sonnen- und Mondbahn aus Stunde/Jahreszeit/Breitengrad, Mondphase, Himmels-, Nebel- und Lichtfarben über den Tag (Nacht, Dämmerung, goldene Stunde, Mittag), Sterne, Einfluss von Wolken/Nebel/Regen/Blitz
 * @api      himmelStand({ stunde, jahresAnteil=0.25, tag=1, breite=48, wetter? }, ziel?) -> { sonneRichtung, mondRichtung, lichtRichtung, sonneHoehe, mondHoehe, mondPhase, mondHell, tag, sterne, lichtStaerke, lichtFarbe, umgebungStaerke, sichtweite, wolken, farben: { zenit, horizont, nebel, sonne, umgebungHimmel, umgebungBoden } } ; sonnenRichtung(stunde, jahresAnteil, breite, ziel?) -> [x,y,z] ; MOND_UMLAUF
 * @beispiel
 *   import { himmelStand } from '../../engine/world/himmel-stand.js';
 *   const stand = himmelStand({ stunde: uhr.stunde, jahresAnteil: uhr.jahresAnteil, tag: uhr.tag, wetter });
 *   himmel.update(stand, { kamera, mitte: figur.position });
 * @tags     himmel, tag, nacht, sonne, mond, sterne, licht, farben, dämmerung, wetter
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { clamp, lerp, smoothstep } from '../core/math.js';

/** Tage von Neumond zu Neumond. */
export const MOND_UMLAUF = 29.5;
const GRAD = Math.PI / 180, SCHIEFE = 23.4 * GRAD;

// Farb-Stützpunkte über der Sonnenhöhe h = sin(Höhenwinkel). Farben in sRGB 0..1.
//            h      zenit                 horizont              sonne
const STUFEN = [
  [-0.30, [0.020, 0.032, 0.085], [0.055, 0.080, 0.150], [1.00, 0.45, 0.20]],
  [-0.10, [0.045, 0.065, 0.170], [0.300, 0.200, 0.260], [1.00, 0.45, 0.20]],
  [ 0.00, [0.160, 0.250, 0.480], [0.960, 0.540, 0.300], [1.00, 0.52, 0.24]],
  [ 0.12, [0.230, 0.420, 0.760], [0.930, 0.760, 0.580], [1.00, 0.78, 0.52]],
  [ 0.35, [0.210, 0.450, 0.840], [0.640, 0.790, 0.920], [1.00, 0.94, 0.82]],
  [ 1.00, [0.170, 0.400, 0.820], [0.610, 0.770, 0.910], [1.00, 0.96, 0.86]],
];
const MONDLICHT = [0.56, 0.66, 1.0];

function mische3(a, b, t, ziel) {
  ziel[0] = lerp(a[0], b[0], t); ziel[1] = lerp(a[1], b[1], t); ziel[2] = lerp(a[2], b[2], t);
  return ziel;
}
const helligkeit = (c) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;

/** Richtung ZUM Gestirn (Einheitsvektor; +x Ost, +y oben, −z Nord) aus Stundenwinkel und Deklination. */
function gestirn(stundenWinkel, dekl, breiteRad, ziel) {
  const sb = Math.sin(breiteRad), cb = Math.cos(breiteRad), sd = Math.sin(dekl), cd = Math.cos(dekl);
  const nord = cb * sd - sb * cd * Math.cos(stundenWinkel);
  ziel[0] = -cd * Math.sin(stundenWinkel);
  ziel[1] = sb * sd + cb * cd * Math.cos(stundenWinkel);
  ziel[2] = -nord;
  return ziel;
}

/** Richtung zur Sonne. jahresAnteil 0 = Frühlingsbeginn, 0.25 = Sommer (lange Tage), 0.75 = Winter. */
export function sonnenRichtung(stunde, jahresAnteil = 0.25, breite = 48, ziel = [0, 0, 0]) {
  const dekl = SCHIEFE * Math.sin(jahresAnteil * Math.PI * 2);
  return gestirn((stunde - 12) / 24 * Math.PI * 2, dekl, breite * GRAD, ziel);
}

function leer() {
  return {
    sonneRichtung: [0, 1, 0], mondRichtung: [0, -1, 0], lichtRichtung: [0, 1, 0],
    sonneHoehe: 1, mondHoehe: -1, mondPhase: 0.5, mondHell: 1, tag: 1, sterne: 0,
    lichtStaerke: 2, lichtFarbe: [1, 1, 1], umgebungStaerke: 1, sichtweite: 1, wolken: 0,
    farben: { zenit: [0, 0, 0], horizont: [0, 0, 0], nebel: [0, 0, 0], sonne: [0, 0, 0], umgebungHimmel: [0, 0, 0], umgebungBoden: [0, 0, 0] },
  };
}

/**
 * Kompletter Himmelszustand für einen Zeitpunkt. `ziel` wiederverwenden spart Müll je Bild.
 * wetter (optional): { wolken, nebel, regen, schnee, blitz } je 0..1 – passt zu engine/world/wetter.js.
 * Ergebnis: Farben in sRGB 0..1; `tag` 0 (Nacht) … 1 (heller Tag); `sichtweite` = Faktor für die Nebelweite.
 */
export function himmelStand(e = {}, ziel = leer()) {
  const stunde = e.stunde ?? 12, jahr = e.jahresAnteil ?? 0.25, breite = e.breite ?? 48, tagNr = e.tag ?? 1;
  const w = e.wetter || {};
  const wolken = clamp(w.wolken ?? 0, 0, 1), nebel = clamp(w.nebel ?? 0, 0, 1);
  const nieder = clamp(Math.max(w.regen ?? 0, w.schnee ?? 0), 0, 1), blitz = clamp(w.blitz ?? 0, 0, 1);
  const s = ziel, f = s.farben;

  // --- Bahnen ---
  sonnenRichtung(stunde, jahr, breite, s.sonneRichtung);
  const h = s.sonneHoehe = s.sonneRichtung[1];
  const phase = s.mondPhase = (((tagNr - 1 + stunde / 24) / MOND_UMLAUF) % 1 + 1) % 1;   // 0 Neumond, 0.5 Vollmond
  const dekl = SCHIEFE * Math.sin(jahr * Math.PI * 2);
  gestirn((stunde - 12) / 24 * Math.PI * 2 - phase * Math.PI * 2, dekl * Math.cos(phase * Math.PI * 2) * 0.9,breite * GRAD, s.mondRichtung);
  s.mondHoehe = s.mondRichtung[1];
  s.mondHell = (1 - Math.cos(phase * Math.PI * 2)) / 2;

  // --- Grundfarben aus der Sonnenhöhe ---
  let k = 0;
  while (k < STUFEN.length - 2 && h > STUFEN[k + 1][0]) k++;
  const a = STUFEN[k], b = STUFEN[k + 1], t = clamp((h - a[0]) / (b[0] - a[0]), 0, 1);
  mische3(a[1], b[1], t, f.zenit); mische3(a[2], b[2], t, f.horizont); mische3(a[3], b[3], t, f.sonne);
  const tag = s.tag = smoothstep(-0.12, 0.3, h);

  // --- Wolken: Himmel wird grau und dunkler, Abendrot verblasst ---
  if (wolken > 0) {
    const g = wolken * 0.8, dunkel = 1 - wolken * 0.35 - nieder * 0.15;
    for (const c of [f.zenit, f.horizont]) {
      const l = helligkeit(c) * 1.05;
      c[0] = lerp(c[0], l, g) * dunkel; c[1] = lerp(c[1], l * 1.01, g) * dunkel; c[2] = lerp(c[2], l * 1.06, g) * dunkel;
    }
  }
  // Nebel nimmt die Horizontfarbe; dichter Nebel hellt sie am Tag zu Grauweiß auf
  mische3(f.horizont, f.zenit, 0.12, f.nebel);
  if (nebel > 0) { const l = lerp(helligkeit(f.nebel), 0.8 * tag + 0.05, 0.6); mische3(f.nebel, [l, l, l * 1.03], nebel * 0.8, f.nebel); }
  s.sichtweite = clamp((1 - nebel * 0.82) * (1 - nieder * 0.35) * (1 - wolken * 0.1), 0.08, 1);
  s.wolken = wolken;
  s.sterne = smoothstep(-0.04, -0.22, h) * (1 - wolken) * (1 - nebel);

  // --- Richtungslicht: tags Sonne, nachts Mond; am Übergang ist die Stärke 0 → kein Schattensprung ---
  const sonnenLicht = smoothstep(-0.04, 0.22, h) * 2.3 * (1 - wolken * 0.78) * (1 - nebel * 0.5);
  const mondLicht = smoothstep(-0.06, -0.2, h) * smoothstep(0.0, 0.15, s.mondHoehe) * (0.1 + 0.45 * s.mondHell) * (1 - wolken * 0.85);
  if (h > -0.05) {
    s.lichtRichtung[0] = s.sonneRichtung[0]; s.lichtRichtung[1] = Math.max(0.06, s.sonneRichtung[1]); s.lichtRichtung[2] = s.sonneRichtung[2];
    s.lichtStaerke = sonnenLicht; mische3(f.sonne, f.sonne, 0, s.lichtFarbe);
  } else {
    s.lichtRichtung[0] = s.mondRichtung[0]; s.lichtRichtung[1] = Math.max(0.06, s.mondRichtung[1]); s.lichtRichtung[2] = s.mondRichtung[2];
    s.lichtStaerke = mondLicht; mische3(MONDLICHT, MONDLICHT, 0, s.lichtFarbe);
  }

  // --- Umgebungslicht (Halbkugel): Himmel von oben, Boden von unten ---
  s.umgebungStaerke = lerp(0.42 + 0.14 * s.mondHell * (1 - wolken), 1.1, tag) * (1 - wolken * 0.22 * tag) + blitz * 2.5;
  mische3(f.zenit, f.horizont, 0.55, f.umgebungHimmel);
  mische3(f.umgebungHimmel, [0.8, 0.9, 1], 0.35, f.umgebungHimmel);       // nie ganz farbstichig
  mische3([0.14, 0.16, 0.24], [0.36, 0.32, 0.25], tag, f.umgebungBoden);
  if (blitz > 0) for (const c of [f.zenit, f.horizont, f.nebel]) mische3(c, [0.85, 0.88, 1], blitz * 0.6, c);
  return s;
}
