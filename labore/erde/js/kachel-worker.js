// Worker: baut Planeten-Kacheln im Hintergrund, damit das Bild nicht ruckelt.
// Bekommt einmal die fertige Geologie (Typed Arrays) vom Hauptthread. Streut auch die Natur je Streu-Kachel.
import { createPlanetHoehe } from './planet-hoehe.js';
import { baueKachel } from './kachel-bau.js';
import { streueKachel } from './natur-streu.js';
import { createEingriffe } from './eingriffe.js';
import { createGrabFeld } from './graben-feld.js';
import { createVoxelBauer, voxelTransfer } from './voxel-erde.js';

let planet = null, voxel = null;
self.onmessage = (e) => {
  const m = e.data;
  if (m.art === 'planet') {
    // Graben-Feld: gleiche Ops wie im Hauptthread → gleiches feines Höhenfeld
    const feld = createGrabFeld({ radius: m.opts.radius, basis: (x, y, z) => { const p = planet.probe(x, y, z, 1); return p.h - p.feld; } });
    planet = createPlanetHoehe({ ...m.opts, eingriffe: createEingriffe({ radius: m.opts.radius, zustand: m.eingriffe }), feld });
    feld.lade(m.feld);
    return;
  }
  if (m.art === 'feld') { planet.feld.stempel(m.op); return; }   // Graben im feinen Höhenfeld vom Hauptthread
  if (m.art === 'eingriff') { planet.eingriffe.uebernimm(m.e); return; } // Graben/Aufschütten vom Hauptthread
  if (m.art === 'bau') {
    const t0 = performance.now();
    const k = baueKachel(m.k, planet);
    k.ms = performance.now() - t0;
    const t = [k.pos.buffer, k.nor.buffer, k.col.buffer, k.land.buffer, k.nass.buffer, k.hohl.buffer, k.gras.buffer, k.idx.buffer];
    if (k.baeume) t.push(k.baeume.pos.buffer, k.baeume.groesse.buffer, k.baeume.farbe.buffer);
    self.postMessage(k, t);
  }
  if (m.art === 'voxel') { // Voxel-Chunk an einer Grabstelle (Dichte, Stoff, Netz mit Farben)
    voxel ??= createVoxelBauer(planet);
    const r = voxel.baue(m);
    self.postMessage(r, voxelTransfer(r));
    return;
  }
  if (m.art === 'streu') { // Natur einer Streu-Kachel (Bäume, Felsen, Schilf …)
    const s = streueKachel(m.k, planet);
    s.typ = 'streu';
    self.postMessage(s, [s.daten.buffer]);
  }
};
