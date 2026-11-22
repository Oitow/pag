// Welche Module Erlenwacht ansteckt (Reihenfolge egal – der Modul-Kern sortiert nach Abhängigkeiten).
// Neues Modul: engine/spiel/modul-x.js bauen, hier eintragen. Abschalten zum Testen: ?aus=x
import { WELT_MODUL } from '../../../engine/spiel/modul-welt.js';
import { HIMMEL_MODUL } from '../../../engine/spiel/modul-himmel.js';
import { RIESENWALD_MODUL } from '../../../engine/spiel/modul-riesenwald.js';
import { ENTITAETEN_MODUL } from '../../../engine/spiel/modul-entitaeten.js';
import { SPIELER_MODUL } from '../../../engine/spiel/modul-spieler.js';
import { BEWOHNER_MODUL } from '../../../engine/spiel/modul-bewohner.js';
import { GEGNER_MODUL } from '../../../engine/spiel/modul-gegner.js';
import { ZAUBER_MODUL } from '../../../engine/spiel/modul-zauber.js';
import { FORTSCHRITT_MODUL } from '../../../engine/spiel/modul-fortschritt.js';
import { KAMPF_MODUL } from '../../../engine/spiel/modul-kampf.js';
import { TUTORIAL_MODUL } from '../../../engine/spiel/modul-tutorial.js';
import { OBERFLAECHE_MODUL } from '../../../engine/spiel/modul-oberflaeche.js';

export const MODULE = [WELT_MODUL, HIMMEL_MODUL, RIESENWALD_MODUL, ENTITAETEN_MODUL, SPIELER_MODUL, BEWOHNER_MODUL, GEGNER_MODUL, ZAUBER_MODUL,
  FORTSCHRITT_MODUL, KAMPF_MODUL, TUTORIAL_MODUL, OBERFLAECHE_MODUL];
export const MODUL_INFO = {
  welt: '🗺 Welt (Gelände, Regionen, Wege)', himmel: '☀️ Himmel (Tag/Nacht, Wetter)', riesenwald: '🌲 Dämmerwald-Riesen',
  entitaeten: '🆔 Entitäten (IDs, Leben, Befehle)', spieler: '🧍 Spielfigur', bewohner: '🏘 Bewohner', gegner: '🐀 Gegner + Boss', zauber: '✨ Zauber',
  fortschritt: '⭐ Stufen, Beute, Talente', kampf: '⚔ Nahkampf + Fähigkeiten', tutorial: '📜 Tutorial + Aufgaben', oberflaeche: '🖥 Menü, Chat, HUD',
};
