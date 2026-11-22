// Worker: baut Terrain-Chunks im Hintergrund (gleiche Funktionen wie im Hauptthread).
import { createTerrain } from './planet-terrain.js';
import { createChunkBauer } from './planet-chunk.js';
import * as DATA from './data.js';

let bauer = null;
self.onmessage = e => {
  const m = e.data;
  if (m.typ === 'init') {
    const T = createTerrain(m.seed, DATA);
    bauer = createChunkBauer(T, DATA.R);
    self.postMessage({ typ: 'bereit' });
    return;
  }
  if (m.typ === 'bau' && bauer) {
    const d = bauer.bau(m.f, m.L, m.x, m.y);
    d.typ = 'chunk'; d.id = m.id;
    self.postMessage(d, bauer.transfer(d));
  }
};
