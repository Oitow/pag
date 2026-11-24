// Worker: baut Planeten-Kacheln im Hintergrund, damit das Bild nicht ruckelt.
// Bekommt einmal die fertige Geologie (Typed Arrays) vom Hauptthread. Streut auch die Natur je Streu-Kachel.
import { createPlanetHoehe } from './planet-hoehe.js';
import { baueKachel } from './kachel-bau.js';
import { streueKachel } from './natur-streu.js';

let planet = null;
self.onmessage = (e) => {
  const m = e.data;
  if (m.art === 'planet') { planet = createPlanetHoehe(m.opts); return; }
  if (m.art === 'bau') {
    const t0 = performance.now();
    const k = baueKachel(m.k, planet);
    k.ms = performance.now() - t0;
    self.postMessage(k, [k.pos.buffer, k.nor.buffer, k.col.buffer, k.nass.buffer, k.idx.buffer]);
  }
  if (m.art === 'streu') { // Natur einer Streu-Kachel (Bäume, Felsen, Schilf …)
    const s = streueKachel(m.k, planet);
    s.typ = 'streu';
    self.postMessage(s, [s.daten.buffer]);
  }
};
