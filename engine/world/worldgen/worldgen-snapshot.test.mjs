// Schnappschuss-Tests für den Weltgenerator: fester Seed, kleine Welten, Qualität 'schnell'.
// Schlägt ein Hash fehl, hat sich die erzeugte Welt geändert. Ist das gewollt, neue Werte ausgeben mit
//   SCHNAPPSCHUSS_NEU=1 node --test engine/world/worldgen/worldgen-snapshot.test.mjs
// und die Tabelle unten bewusst aktualisieren (im PR erwähnen).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, createChunkGenerator, hashArrays } from './worldgen.js';

const NEU = !!process.env.SCHNAPPSCHUSS_NEU;
const GROESSE = { breite: 48, tiefe: 48, qualitaet: 'schnell' };

/** Hash über Höhe, Biom, Flags und Objekte (Lage, Art, Typ). */
const hashWelt = w => hashArrays(w.hoehe, w.biom, w.flags, w.objekte.x, w.objekte.y, w.objekte.art, w.objekte.typ);
const hashChunk = c => hashArrays(c.hoehe, c.biom, c.flags, c.wasser, c.objekte.x, c.objekte.y, c.objekte.art, c.objekte.typ);

const WELTEN = {
  insel: '6359d48b', archipel: '83c25d53', gebirge: 'f4f3ea07', wueste: 'ca25b15a',
  sumpfland: '26b17cfc', vulkaninsel: '391b1a95', canyon: 'b544632b', unendlich: 'fa6758fc',
};
const CHUNKS = { netz: 'ff436929', rauschen: 'e1abdb22' };

const neu = {};
for (const [preset, erwartet] of Object.entries(WELTEN)) {
  test(`Schnappschuss Welt: ${preset} (Seed 77, 48², schnell)`, () => {
    const h = hashWelt(createWorld({ preset, seed: 77, ...GROESSE }));
    if (NEU) { neu[preset] = h; return; }
    assert.equal(h, erwartet, `Welt '${preset}' hat sich geändert (Schnappschuss bewusst aktualisieren?)`);
  });
}

for (const [modus, erwartet] of Object.entries(CHUNKS)) {
  test(`Schnappschuss Chunks: Flussmodus ${modus} (Seed 77, 2×2 Chunks à 24)`, () => {
    const gen = createChunkGenerator({ seed: 77, qualitaet: 'schnell', hoehenSkala: 20, chunk: { flussModus: modus } });
    const teile = [];
    for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [-1, -1]]) teile.push(hashChunk(gen.generateChunk(cx, cy, 24)));
    const h = hashArrays(new TextEncoder().encode(teile.join('|')));
    if (NEU) { neu['chunks:' + modus] = h; return; }
    assert.equal(h, erwartet, `Chunks (${modus}) haben sich geändert (Schnappschuss bewusst aktualisieren?)`);
  });
}

test.after(() => { if (NEU) console.log('Neue Schnappschüsse:', JSON.stringify(neu, null, 1)); });
