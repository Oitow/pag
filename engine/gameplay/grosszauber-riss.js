/**
 * @modul    grosszauber-riss
 * @zweck    Platzhalter – wird gerade gebaut (Großzauber 'riss' für gameplay/grosszauber)
 * @api      createRiss(opts, umgebung) -> instanz
 * @beispiel
 *   import { createRiss } from '../../engine/gameplay/grosszauber-riss.js';
 * @tags     zauber, großzauber
 * @version  0.0.1
 * @status   entwurf
 * @three    nein
 */
export function createRiss(opts) { let t = 0; return { daten: { pos: opts.punkt, t: 0 }, update(dt) { t += dt; this.daten.t = t; return t < 1; } }; }
