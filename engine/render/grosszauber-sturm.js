/**
 * @modul    grosszauber-sturm-ansicht
 * @zweck    Platzhalter – wird gerade gebaut (Ansicht für Großzauber 'sturm')
 * @api      createSturmAnsicht(daten, umgebung) -> { objekt, update(dt,daten,zeit), dispose() }
 * @beispiel
 *   import { createSturmAnsicht } from '../../engine/render/grosszauber-sturm.js';
 * @tags     zauber, großzauber, render
 * @version  0.0.1
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
export function createSturmAnsicht() { return { objekt: new THREE.Group(), update() {}, dispose() {} }; }
