// Weltlabor – Web Worker: erzeugt Welten im Hintergrund, die Oberfläche bleibt flüssig.
import { erzeuge } from './erzeuge.js';

self.onmessage = (e) => {
  const { id, auftrag } = e.data;
  try {
    const { daten, puffer } = erzeuge(auftrag);
    self.postMessage({ id, daten }, puffer);
  } catch (err) {
    self.postMessage({ id, fehler: String(err && err.stack || err) });
  }
};
self.postMessage({ bereit: true });
