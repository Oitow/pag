/**
 * @modul    module
 * @zweck    Alle Spiel-Module an einer Stelle: Name → Modul-Objekt; wählt per Register (module-register) die Module fürs echte Spiel, fürs Testfeld oder ein einzelnes Modul samt Abhängigkeiten
 * @api      ALLE_MODULE ; MODUL_INFO ; moduleFuer({stufe, nur}) -> [modul]
 * @beispiel
 *   import { moduleFuer, MODUL_INFO } from '../../engine/spiel/module.js';
 *   const spiel = await createSpiel({ canvas, module: moduleFuer({ stufe: 'spiel' }) });
 *   moduleFuer({ nur: 'kampf' });   // Kampf + Spieler + Entitäten + Welt
 * @tags     spiel, modul, register, auswahl, testfeld
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 *
 * Neues Modul: engine/spiel/modul-x.js bauen, hier importieren + in ALLE_MODULE eintragen, in module-register.js mit stufe 'labor' anmelden.
 */
import { WELT_MODUL } from './modul-welt.js';
import { HIMMEL_MODUL } from './modul-himmel.js';
import { RIESENWALD_MODUL } from './modul-riesenwald.js';
import { ENTITAETEN_MODUL } from './modul-entitaeten.js';
import { SPIELER_MODUL } from './modul-spieler.js';
import { BEWOHNER_MODUL } from './modul-bewohner.js';
import { GEGNER_MODUL } from './modul-gegner.js';
import { ZAUBER_MODUL } from './modul-zauber.js';
import { FORTSCHRITT_MODUL } from './modul-fortschritt.js';
import { KAMPF_MODUL } from './modul-kampf.js';
import { TUTORIAL_MODUL } from './modul-tutorial.js';
import { OBERFLAECHE_MODUL } from './modul-oberflaeche.js';
import { DORF_MODUL } from './modul-dorf.js';
import { MODUL_REGISTER, waehle } from './module-register.js';

export const ALLE_MODULE = Object.freeze(Object.fromEntries([
  WELT_MODUL, HIMMEL_MODUL, RIESENWALD_MODUL, DORF_MODUL, ENTITAETEN_MODUL, SPIELER_MODUL, BEWOHNER_MODUL, GEGNER_MODUL, ZAUBER_MODUL,
  FORTSCHRITT_MODUL, KAMPF_MODUL, TUTORIAL_MODUL, OBERFLAECHE_MODUL,
].map((m) => [m.name, m])));

export const MODUL_INFO = Object.freeze(Object.fromEntries(MODUL_REGISTER.map((e) => [e.name, e.titel])));

/** Modul-Objekte für eine Stufe ('spiel' | 'testfeld' | 'labor') oder nur bestimmte Module (+ Abhängigkeiten). */
export function moduleFuer({ stufe = 'spiel', nur = null } = {}) {
  return waehle({ stufe, nur, brauchtVon: (n) => ALLE_MODULE[n]?.braucht })
    .map((n) => ALLE_MODULE[n])
    .filter(Boolean);
}
