/**
 * @modul    grosszauber-sturm
 * @zweck    Platzhalter – wird gerade gebaut (Großzauber 'sturm' für gameplay/grosszauber)
 * @api      createSturm(opts, umgebung) -> instanz
 * @beispiel
 *   import { createSturm } from '../../engine/gameplay/grosszauber-sturm.js';
 * @tags     zauber, großzauber
 * @version  0.0.1
 * @status   entwurf
 * @three    nein
 */
export function createSturm(opts) { let t = 0; return { daten: { pos: opts.punkt, t: 0 }, update(dt) { t += dt; this.daten.t = t; return t < 1; } }; }
