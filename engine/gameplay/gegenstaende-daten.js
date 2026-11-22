/**
 * @modul    gegenstaende-daten
 * @zweck    Erlenwacht-Gegenstände als Daten: Waffen, Rüstung je Sockel, Tränke, Material, Gold (Symbol, Sockel, Gewicht, Stapel, Grundwerte), Seltenheiten, Affixe
 * @api      GEGENSTAENDE {id:daten} ; SOCKEL ; SELTENHEITEN {id:{name,farbe,mult,affixe}} ; AFFIXE [{id,adj,wert,basis}] ; WERT_NAMEN {wert:Anzeigename} ; registriereGegenstaende(register) -> register
 * @beispiel
 *   import { createRegister } from '../core/register.js';
 *   import { registriereGegenstaende } from './gegenstaende-daten.js';
 *   const register = registriereGegenstaende(createRegister({ art: 'gegenstand' }));
 *   register.hole('schwert').symbol;   // '🗡️'
 * @tags     gegenstand, waffe, ruestung, trank, material, seltenheit, daten, mmo
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * genus (m|f|n|p) steuert die Adjektiv-Endung im Beute-Namen ("Scharfes Schwert"). stamm: Material-Vorsilbe je Beutequelle steht in beute.js.
 */

export const SOCKEL = ['waffe', 'kopf', 'brust', 'beine', 'fuesse', 'schmuck'];

export const SELTENHEITEN = {
  gewoehnlich: { name: 'Gewöhnlich', farbe: '#c8c8c8', mult: 1.0, affixe: 0 },
  selten: { name: 'Selten', farbe: '#4aa3ff', mult: 1.25, affixe: 1 },
  episch: { name: 'Episch', farbe: '#b46cff', mult: 1.6, affixe: 2 },
  legendaer: { name: 'Legendär', farbe: '#ffa63a', mult: 2.1, affixe: 3 },
};

export const WERT_NAMEN = {
  staerke: 'Stärke', intellekt: 'Intellekt', geschick: 'Geschick', ausdauer: 'Ausdauer', ruestung: 'Rüstung', schaden: 'Schaden',
  zauberkraft: 'Zauberkraft', krit: 'Krit.-Chance', tempo: 'Tempo', leben: 'Leben', mana: 'Mana',
};

/** Affix: adj = Wortstamm (+ er/es/e), wert = Werte-Name, basis = Betrag auf Stufe 1 (gewöhnlich). */
export const AFFIXE = [
  { id: 'scharf', adj: 'Scharf', wert: 'schaden', basis: 2 },
  { id: 'wuchtig', adj: 'Wuchtig', wert: 'staerke', basis: 2 },
  { id: 'klug', adj: 'Klug', wert: 'intellekt', basis: 2 },
  { id: 'flink', adj: 'Flink', wert: 'geschick', basis: 2 },
  { id: 'zaeh', adj: 'Zäh', wert: 'ausdauer', basis: 2 },
  { id: 'robust', adj: 'Robust', wert: 'ruestung', basis: 3 },
  { id: 'lebendig', adj: 'Lebendig', wert: 'leben', basis: 10 },
  { id: 'mystisch', adj: 'Mystisch', wert: 'mana', basis: 8 },
  { id: 'toedlich', adj: 'Tödlich', wert: 'krit', basis: 1.5 },
  { id: 'rasch', adj: 'Rasch', wert: 'tempo', basis: 2 },
];

const W = (name, symbol, genus, grund, gewicht = 3) => ({ name, symbol, art: 'waffe', sockel: 'waffe', genus, gewicht, stapel: 1, grundwerte: grund, tags: ['ausruestung', 'waffe'] });
const R = (name, symbol, genus, sockel, grund, gewicht = 2) => ({ name, symbol, art: 'ruestung', sockel, genus, gewicht, stapel: 1, grundwerte: grund, tags: ['ausruestung', 'ruestung'] });
const M = (name, symbol, wert) => ({ name, symbol, art: 'material', gewicht: 0.1, stapel: 50, wert, tags: ['material'] });

export const GEGENSTAENDE = {
  // Waffen
  schwert: W('Schwert', '🗡️', 'n', { schaden: 8, staerke: 1 }, 3),
  axt: W('Axt', '🪓', 'f', { schaden: 10, staerke: 3 }, 4),
  dolch: W('Dolch', '🔪', 'm', { schaden: 5, geschick: 1, krit: 4, tempo: 4 }, 1),
  stab: W('Stab', '🪄', 'm', { schaden: 2, zauberkraft: 8, intellekt: 2 }, 2),
  bogen: W('Bogen', '🏹', 'm', { schaden: 7, geschick: 2 }, 2),
  // Rüstung je Sockel
  helm: R('Helm', '⛑️', 'm', 'kopf', { ruestung: 4, ausdauer: 1 }),
  harnisch: R('Harnisch', '🦺', 'm', 'brust', { ruestung: 8, ausdauer: 2 }, 5),
  beinlinge: R('Beinlinge', '👖', 'p', 'beine', { ruestung: 5, ausdauer: 1 }, 3),
  stiefel: R('Stiefel', '🥾', 'p', 'fuesse', { ruestung: 3, tempo: 1 }, 2),
  ring: R('Ring', '💍', 'm', 'schmuck', { leben: 6, krit: 1 }, 0.1),
  // Tränke
  heiltrank: { name: 'Heiltrank', symbol: '🧪', art: 'trank', gewicht: 0.3, stapel: 20, wirkung: { heile: 60 }, wert: 12, tags: ['trank'] },
  manatrank: { name: 'Manatrank', symbol: '🔷', art: 'trank', gewicht: 0.3, stapel: 20, wirkung: { mana: 50 }, wert: 12, tags: ['trank'] },
  // Material
  rattenfell: M('Rattenfell', '🐀', 1),
  wolfszahn: M('Wolfszahn', '🦷', 3),
  irrlichtstaub: M('Irrlichtstaub', '✨', 5),
  keilerhauer: M('Keilerhauer', '🐗', 4),
  gold: { name: 'Gold', symbol: '🪙', art: 'gold', gewicht: 0, stapel: 9999, tags: ['gold'] },
};

/** Alle Einträge ins Register (core/register) eintragen. */
export function registriereGegenstaende(register) {
  for (const [id, d] of Object.entries(GEGENSTAENDE)) if (!register.hat(id)) register.definiere(id, d);
  return register;
}
