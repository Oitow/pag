/**
 * @modul    grosszauber-wand
 * @zweck    Platzhalter – wird gerade gebaut (Großzauber 'wand' für gameplay/grosszauber)
 * @api      createWand(opts, umgebung) -> instanz
 * @beispiel
 *   import { createWand } from '../../engine/gameplay/grosszauber-wand.js';
 * @tags     zauber, großzauber
 * @version  0.0.1
 * @status   entwurf
 * @three    nein
 */
export function createWand(opts) { let t = 0; return { daten: { pos: opts.punkt, t: 0 }, update(dt) { t += dt; this.daten.t = t; return t < 1; } }; }
