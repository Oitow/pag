/**
 * @modul    grosszauber-welle
 * @zweck    Platzhalter – wird gerade gebaut (Großzauber 'welle' für gameplay/grosszauber)
 * @api      createWelle(opts, umgebung) -> instanz
 * @beispiel
 *   import { createWelle } from '../../engine/gameplay/grosszauber-welle.js';
 * @tags     zauber, großzauber
 * @version  0.0.1
 * @status   entwurf
 * @three    nein
 */
export function createWelle(opts) { let t = 0; return { daten: { pos: opts.punkt, t: 0 }, update(dt) { t += dt; this.daten.t = t; return t < 1; } }; }
