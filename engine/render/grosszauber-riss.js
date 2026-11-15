/**
 * @modul    grosszauber-riss-ansicht
 * @zweck    Platzhalter – wird gerade gebaut (Ansicht für Großzauber 'riss')
 * @api      createRissAnsicht(daten, umgebung) -> { objekt, update(dt,daten,zeit), dispose() }
 * @beispiel
 *   import { createRissAnsicht } from '../../engine/render/grosszauber-riss.js';
 * @tags     zauber, großzauber, render
 * @version  0.0.1
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
export function createRissAnsicht() { return { objekt: new THREE.Group(), update() {}, dispose() {} }; }
