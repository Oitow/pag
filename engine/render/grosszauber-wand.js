/**
 * @modul    grosszauber-wand-ansicht
 * @zweck    Platzhalter – wird gerade gebaut (Ansicht für Großzauber 'wand')
 * @api      createWandAnsicht(daten, umgebung) -> { objekt, update(dt,daten,zeit), dispose() }
 * @beispiel
 *   import { createWandAnsicht } from '../../engine/render/grosszauber-wand.js';
 * @tags     zauber, großzauber, render
 * @version  0.0.1
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
export function createWandAnsicht() { return { objekt: new THREE.Group(), update() {}, dispose() {} }; }
