/**
 * @modul    grosszauber-mesh
 * @zweck    Zeichnet laufende Großzauber (gameplay/grosszauber): je Wirkung eine Ansicht aus einer Ansichts-Fabrik je Art, legt sie an und räumt sie ab, sobald die Wirkung endet
 * @api      createGrosszauberMesh({arten,welt}) -> { gruppe, registriere(name,fabrik), update(dt,aktive), anzahl, dispose() }
 * @beispiel
 *   import { createGrosszauberMesh } from '../../engine/render/grosszauber-mesh.js';
 *   import { createWelleAnsicht } from '../../engine/render/grosszauber-welle.js';
 *   const bilder = createGrosszauberMesh({ arten: { welle: createWelleAnsicht }, welt: adapter });
 *   szene.add(bilder.gruppe);
 *   bilder.update(dt, gross.aktive);     // jedes Bild
 * @tags     zauber, großzauber, episch, effekt, render, welle, wand, sturm, beben
 * @version  1.0.0
 * @status   entwurf
 * @three    ja
 *
 * Ansichts-Fabrik:  fabrik(daten, umgebung) -> { objekt (THREE.Object3D), update(dt, daten, zeit), dispose() }
 *   daten = instanz.daten aus der Logik (wird jedes Bild neu gereicht), umgebung = { welt (bodenHoehe/wasserHoehe des Grund-Geländes) }
 */
import * as THREE from 'three';

export function createGrosszauberMesh({ arten = {}, welt = null } = {}) {
  const fabriken = { ...arten }, ansichten = new Map(), gruppe = new THREE.Group();
  gruppe.name = 'grosszauber';
  const umgebung = { welt };
  let zeit = 0;
  const gesehen = new Set();

  function weg(id) {
    const a = ansichten.get(id);
    if (!a) return;
    gruppe.remove(a.objekt);
    a.dispose?.();
    ansichten.delete(id);
  }

  return {
    gruppe,
    registriere(name, fabrik) { fabriken[name] = fabrik; },
    update(dt, aktive = []) {
      zeit += dt;
      gesehen.clear();
      for (const w of aktive) {
        gesehen.add(w.id);
        let a = ansichten.get(w.id);
        if (!a) {
          const f = fabriken[w.art];
          if (typeof f !== 'function') continue;
          a = f(w.inst.daten, umgebung);
          if (!a?.objekt) continue;
          ansichten.set(w.id, a);
          gruppe.add(a.objekt);
        }
        a.update?.(dt, w.inst.daten, zeit);
      }
      for (const id of [...ansichten.keys()]) if (!gesehen.has(id)) weg(id);
    },
    get anzahl() { return ansichten.size; },
    dispose() { for (const id of [...ansichten.keys()]) weg(id); },
  };
}
