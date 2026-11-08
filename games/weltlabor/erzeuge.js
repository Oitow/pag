// Weltlabor – erzeugt eine Welt (ganze Karte oder aus Chunks) und liefert übertragbare Daten.
// Wird im Web Worker (worker.js) und – falls Worker nicht gehen – direkt im Hauptthread genutzt.
import { createWorld, transferierbar, createChunkGenerator } from '../../engine/world/worldgen/worldgen.js';

const jetzt = () => performance.now();

/** auftrag: { modus: 'karte'|'chunks', optionen, chunkGroesse } → { daten, puffer } */
export function erzeuge(auftrag) {
  if (auftrag.modus === 'chunks') return ausChunks(auftrag);
  const welt = createWorld(auftrag.optionen);
  return transferierbar(welt);
}

/** Setzt eine Karte aus Chunks zusammen (zeigt, dass die Kanten nahtlos sind). */
function ausChunks({ optionen, chunkGroesse = 64 }) {
  const t0 = jetzt();
  const gen = createChunkGenerator(optionen);
  const G = chunkGroesse, S = Math.max(G, Math.round(optionen.breite / G) * G), anz = S / G;
  // Endliche Formen (Insel …) liegen auf 0..breite; 'unendlich' wird um den Ursprung gezeigt
  const endlich = gen.opts.form?.typ !== 'unendlich';
  const n = S * S;
  const hoehe = new Float32Array(n), biom = new Uint8Array(n), flags = new Uint8Array(n);
  const temperatur = new Float32Array(n), feuchte = new Float32Array(n), wasserstand = new Float32Array(n);
  const ox = [], oy = [], oart = [], otyp = [], oskala = [];
  let arten = [];
  const typen = [], typNr = new Map();
  const off = endlich ? 0 : -Math.floor(anz / 2);
  for (let cy = 0; cy < anz; cy++) for (let cx = 0; cx < anz; cx++) {
    const c = gen.generateChunk(cx + off, cy + off, G);
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
      const s = y * c.n + x, d = (cy * G + y) * S + cx * G + x;
      hoehe[d] = c.hoehe[s]; biom[d] = c.biom[s]; flags[d] = c.flags[s];
      temperatur[d] = c.temperatur[s]; feuchte[d] = c.feuchte[s];
      wasserstand[d] = c.flags[s] & 1 ? 0 : c.hoehe[s] + 0.002;
    }
    const o = c.objekte;
    arten = o.arten;
    for (let i = 0; i < o.anzahl; i++) {
      const name = o.typen[o.typ[i]];
      let tn = typNr.get(name);
      if (tn === undefined) { tn = typen.length; typen.push(name); typNr.set(name, tn); }
      ox.push(o.x[i] - off * G); oy.push(o.y[i] - off * G); oart.push(o.art[i]); otyp.push(tn); oskala.push(o.skala[i]);
    }
  }
  const ms = +(jetzt() - t0).toFixed(2);
  const objekte = { anzahl: ox.length, x: Float32Array.from(ox), y: Float32Array.from(oy), art: Uint8Array.from(oart), typ: Uint8Array.from(otyp), skala: Float32Array.from(oskala), arten, typen };
  const daten = {
    breite: S, tiefe: S, zelle: 1, seed: optionen.seed, preset: 'chunks', hoehe, wasserstand, flags, biom, temperatur, feuchte,
    biome: gen.biome.map(({ regel, ...b }) => b), fluesse: [], seen: [], orte: { start: null, doerfer: [], poi: [] }, objekte,
    zeiten: { [`chunks (${anz * anz}×${G}²)`]: ms, gesamt: ms },
  };
  const puffer = [hoehe, biom, flags, temperatur, feuchte, wasserstand, objekte.x, objekte.y, objekte.art, objekte.typ, objekte.skala].map(a => a.buffer);
  return { daten, puffer };
}
