// Worker: baut Planeten-Kacheln im Hintergrund, damit das Bild nicht ruckelt.
import { createPlanetHoehe } from './planet-hoehe.js';
import { baueKachel } from './kachel-bau.js';

let planet = null;
self.onmessage = (e) => {
  const m = e.data;
  if (m.art === 'planet') { planet = createPlanetHoehe(m.opts); return; }
  if (m.art === 'bau') {
    const t0 = performance.now();
    const k = baueKachel(m.k, planet);
    k.ms = performance.now() - t0;
    self.postMessage(k, [k.pos.buffer, k.nor.buffer, k.col.buffer, k.idx.buffer]);
  }
};
