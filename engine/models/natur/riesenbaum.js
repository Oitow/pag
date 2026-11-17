/**
 * @modul    riesenbaum
 * @zweck    Urwald-Riese in echter Größe (~110 m): Wurzeln und Stammfuß weich aus dem SDF, darüber Stamm und dicke Äste als EINE Geometrie; Laub, Moos und Flechten als Gauß-Splat-Daten
 * @api      createRiesenbaum({ seed, hoehe = 110, stammRadius = 5.5, wurzeln = 7, wurzelWeite = 22, detail = 1, bogen = false }) -> { geometrie, splats, kollision { stammRadius, hoehenkarte { hoeheBei(x,z) } }, masse { hoehe, stammRadius, kronenAb, kronenRadius, grenzen, bogen? { mitte, achse, quer, lichteHoehe, lichteWeite } }, dreiecke, dispose() }
 * @beispiel
 *   import { createRiesenbaum } from '../../engine/models/natur/riesenbaum.js';
 *   import { createGaussWolke } from '../../engine/render/gauss-wolke.js';
 *   const baum = createRiesenbaum({ seed: 7, bogen: true });
 *   szene.add(new THREE.Mesh(baum.geometrie, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));
 *   const wolke = createGaussWolke(); wolke.fuege(baum.splats); szene.add(wolke.mesh);
 *   baum.kollision.hoehenkarte.hoeheBei(9, 2);      // lokal zum Baumfuß; NaN = blanker Boden
 * @tags     natur, baum, riesenbaum, urwald, wald, sdf, splats, gauss, wurzel, groesse, daemmerwald
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 */
import * as THREE from 'three';
import { baueRiesenbaumRoh } from './riesenbaum-netz.js';

/** Riesenbaum bauen. Baumfuß = Ursprung, y oben, Meter. Deterministisch für die Optionen. */
export function createRiesenbaum(optionen = {}) {
  const roh = baueRiesenbaumRoh(optionen);
  const geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute('position', new THREE.BufferAttribute(roh.position, 3));
  geometrie.setAttribute('normal', new THREE.BufferAttribute(roh.normal, 3));
  geometrie.setAttribute('color', new THREE.BufferAttribute(roh.farbe, 3));
  geometrie.setIndex(new THREE.BufferAttribute(roh.index, 1));
  geometrie.computeBoundingSphere(); geometrie.computeBoundingBox();
  const R = roh.masse.stammRadius;
  return {
    geometrie,
    splats: roh.splats,
    /** Stamm = Kreis-Hindernis (Radius knapp über dem Fuß), Wurzeln begehbar über die Höhenkarte. */
    kollision: { stammRadius: roh.form.radius(1.5) + 0.3 * (R / 5.5), hoehenkarte: roh.hoehenkarte },
    masse: roh.masse,
    dreiecke: roh.dreiecke,
    dispose() { geometrie.dispose(); },
  };
}
