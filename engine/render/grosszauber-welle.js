/**
 * @modul    grosszauber-welle-ansicht
 * @zweck    Platzhalter – wird gerade gebaut (Ansicht für Großzauber 'welle')
 * @api      createWelleAnsicht(daten, umgebung) -> { objekt, update(dt,daten,zeit), dispose() }
 * @beispiel
 *   import { createWelleAnsicht } from '../../engine/render/grosszauber-welle.js';
 * @tags     zauber, großzauber, render
 * @version  0.0.1
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
export function createWelleAnsicht() { return { objekt: new THREE.Group(), update() {}, dispose() {} }; }
