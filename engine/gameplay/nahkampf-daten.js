/**
 * @modul    nahkampf-daten
 * @zweck    Waffen-Tabelle für den Action-Nahkampf (Kombo-Ketten, schwerer Schlag, Tempo) – reine Daten
 * @api      WAFFEN { faust, schwert, axt, hammer, dolch, speer, stab } ; WAFFEN_NAMEN -> string[]
 * @beispiel
 *   import { WAFFEN } from '../../engine/gameplay/nahkampf-daten.js';
 *   const s = WAFFEN.schwert.leicht[0]; // { clip:'schlagen', vorlauf, aktiv, nachlauf, schaden, reichweite, winkel, wucht, stoss, schritt }
 * @tags     kampf, nahkampf, waffe, kombo, daten, mmo
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

// Schlag-Fabrik: [clip, vorlauf, aktiv, nachlauf, schaden, reichweite, winkel(halb, rad), wucht, stoss, schritt]
const S = (clip, vorlauf, aktiv, nachlauf, schaden, reichweite, winkel, wucht, stoss, schritt = 0.3) =>
  ({ clip, vorlauf, aktiv, nachlauf, schaden, reichweite, winkel, wucht, stoss, schritt, art: 'koerper' });

/** Clips: nur vorhandene (character-clips*.js): schlagen, stossen, hacken, haemmern, fegen. */
export const WAFFEN = {
  faust: { tempo: 1.2, leicht: [
    S('stossen', 0.08, 0.10, 0.16, 6, 1.6, 0.5, 8, 1.0), S('stossen', 0.08, 0.10, 0.16, 7, 1.6, 0.5, 10, 1.2),
    S('schlagen', 0.10, 0.12, 0.22, 9, 1.7, 0.6, 14, 2.0), S('hacken', 0.14, 0.14, 0.34, 14, 1.8, 0.6, 24, 5.0, 0.6)],
    schwer: S('hacken', 0.20, 0.14, 0.40, 22, 1.8, 0.6, 30, 6.0, 0.7) },
  schwert: { tempo: 1.0, leicht: [
    S('schlagen', 0.12, 0.14, 0.22, 10, 2.2, 0.9, 12, 1.5), S('schlagen', 0.12, 0.14, 0.22, 12, 2.2, 0.9, 14, 2.0),
    S('fegen', 0.16, 0.16, 0.26, 14, 2.4, 1.1, 18, 3.0), S('hacken', 0.22, 0.16, 0.42, 22, 2.4, 0.8, 30, 7.0, 0.7)],
    schwer: S('hacken', 0.30, 0.18, 0.50, 30, 2.4, 0.9, 40, 8.0, 0.8) },
  axt: { tempo: 0.85, leicht: [
    S('hacken', 0.20, 0.14, 0.30, 14, 2.1, 0.8, 18, 2.5), S('hacken', 0.20, 0.14, 0.30, 16, 2.1, 0.8, 20, 3.0),
    S('hacken', 0.28, 0.18, 0.50, 28, 2.2, 0.8, 36, 8.0, 0.7)],
    schwer: S('hacken', 0.40, 0.20, 0.60, 38, 2.2, 0.8, 50, 9.0, 0.8) },
  hammer: { tempo: 0.7, leicht: [
    S('haemmern', 0.26, 0.16, 0.34, 18, 2.2, 1.2, 26, 4.0), S('haemmern', 0.26, 0.16, 0.34, 20, 2.2, 1.2, 28, 5.0),
    S('haemmern', 0.40, 0.20, 0.60, 36, 2.4, 1.5, 50, 11.0, 0.6)],
    schwer: S('haemmern', 0.55, 0.22, 0.70, 48, 2.5, 1.5, 65, 13.0, 0.7) },
  dolch: { tempo: 1.5, leicht: [
    S('stossen', 0.06, 0.08, 0.12, 5, 1.5, 0.5, 6, 0.8), S('schlagen', 0.06, 0.08, 0.12, 5, 1.5, 0.6, 6, 0.8),
    S('stossen', 0.06, 0.08, 0.12, 6, 1.5, 0.5, 8, 1.0), S('stossen', 0.10, 0.10, 0.24, 11, 1.7, 0.4, 14, 3.0, 0.5)],
    schwer: S('stossen', 0.16, 0.10, 0.30, 16, 1.7, 0.4, 20, 4.0, 0.6) },
  speer: { tempo: 0.95, leicht: [
    S('stossen', 0.16, 0.14, 0.26, 11, 3.4, 0.30, 14, 2.5), S('stossen', 0.16, 0.14, 0.26, 12, 3.4, 0.30, 16, 3.0),
    S('stossen', 0.26, 0.18, 0.46, 22, 3.8, 0.25, 30, 8.0, 0.6)],
    schwer: S('stossen', 0.34, 0.20, 0.54, 32, 4.0, 0.25, 40, 9.0, 0.8) },
  stab: { tempo: 1.0, leicht: [
    S('schlagen', 0.14, 0.14, 0.24, 7, 2.3, 0.7, 8, 1.5), S('schlagen', 0.14, 0.14, 0.24, 8, 2.3, 0.7, 10, 2.0),
    S('fegen', 0.22, 0.16, 0.40, 12, 2.5, 1.0, 20, 6.0, 0.4)],
    schwer: S('haemmern', 0.34, 0.18, 0.50, 20, 2.4, 0.8, 30, 7.0, 0.5) },
};
export const WAFFEN_NAMEN = Object.keys(WAFFEN);
