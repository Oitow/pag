# 🌍 worldgen – Weltgenerator des Baukastens

Deterministischer Höhenfeld-Weltgenerator für alle Spiele. Reine Logik ohne THREE und ohne DOM, läuft in Node, im Browser und in Web Workern.
Alle Ergebnisse liegen in typisierten Arrays (Index `i = y * breite + x`) und lassen sich deshalb billig an einen Worker übergeben und rendern.

```js
import { createWorld } from '../../engine/world/worldgen/worldgen.js';
const welt = createWorld({ preset: 'insel', seed: 42, breite: 256, tiefe: 256, qualitaet: 'normal', hoehenSkala: 30 });
welt.heightAt(100.5, 80.2);  welt.isWater(10, 10);  welt.biome[welt.biomeAt(50, 50)].name;
welt.orte.start;             // { x, y, radius } – flach, nah an Wasser und Wald, eingeebnet
welt.objekte;                // { anzahl, x, y, art, typ, skala, drehung, arten, typen }
```

## Pipeline (je Stufe ein Modul)

| Stufe | Modul | Ergebnis |
|---|---|---|
| hoehe | `worldgen-shape` + `worldgen-height` | Landform-Maske, fBm, Grat-Gebirge, Domain-Warp, Klippen, Terrassen → `hoehe` (Meer = 0, hohe Gipfel ≈ 1) |
| erosion | `worldgen-erosion` | Tropfen-Erosion mit Pinsel + thermische Erosion (Qualität schnell/normal/hoch) |
| hydrologie | `worldgen-hydrology` | Ozean vom Rand, Priority-Flood, Seen, D8-Abfluss → `flags`, `wasserstand`, `ziel`, `abfluss`, `seen` |
| fluesse | `worldgen-rivers` | Flusszellen mit Breite, Flussbett, optionale Täler/Schluchten → `flussBreite`, `fluesse` (geglättete Linien) |
| klima | `worldgen-climate` | Temperatur (Höhe, Breitengrad), Feuchte (Wassernähe, Regenschatten nach Wind) |
| biome | `worldgen-biomes` | Prioritätsregeln (Wasser, Schnee, Fels, Strand, Sumpf) und Whittaker-Tabelle → `biom`, `hang` |
| orte | `worldgen-sites` | Startplatz, Dörfer, Sehenswürdigkeiten (Gipfel, Quelle, Mündung, See) |
| objekte | `worldgen-scatter` | Blue-Noise-Verteilung mit Dichte pro Biom und Lichtungen |

Dazu kommen `worldgen-query` (Abfragen, `mitAbfragen` nach einem Worker), `worldgen-path` (A* mit Hang- und Wasserkosten), `worldgen-chunks` (unendlicher Modus) und `worldgen-grid` (Heap, Abstände, Flags).

## Presets

`insel`, `archipel`, `kontinent`, `gebirge`, `wueste`, `tundra`, `sumpfland`, `vulkaninsel`, `canyon`, `flachland`, `kueste`, `hochebene`, `unendlich`.
Ein Preset ist nur ein Optionsobjekt (siehe `STANDARD_OPTIONEN` in `worldgen-presets.js`). Jede Option lässt sich überschreiben, auch tief verschachtelt:

```js
createWorld({ preset: 'vulkaninsel', seed: 7, klima: { feuchte: 0.8 }, wasser: { flussMenge: 1.2 }, objekte: { dichte: 0.5 } });
```

## Eigene Biome, Objekte und Stufen (für Spiele)

```js
createWorld({
  preset: 'insel',
  biome: {
    extra: [{ key: 'pilzhain', name: 'Pilzhain', farbe: 0x8a5cc0, temp: [0.4, 0.6], feuchte: [0.85, 1] },   // Whittaker-Bereich
            { key: 'kristall', name: 'Kristallfeld', farbe: 0x88ccff, regel: { prio: 90, hoehe: [0.6, 9] } }], // Regel
    aus: ['regenwald'], farben: { fels: 0xa4583a },
  },
  objekte: { extra: [{ key: 'truhe', radius: 12, dichte: { _: 0.05 }, typen: { _: ['truhe'] } }] },
  stufen: [{ name: 'ruinen', nach: 'orte', run(welt, opts) { /* welt.hoehe, welt.biom … ändern */ } }],
  ohne: ['erosion'],   // Stufen weglassen; gleicher Name in `stufen` ersetzt eine Stufe
});
```

Biom-Ids sind stabil (Index in der Liste). Neue Biome werden hinten angehängt, `biomId(welt, 'pilzhain')` liefert die Id.

## Unendlicher Modus (Chunks)

```js
import { createChunkGenerator } from '../../engine/world/worldgen/worldgen.js';
const gen = createChunkGenerator({ preset: 'unendlich', seed: 5, hoehenSkala: 40 });
const c = gen.generateChunk(cx, cy, 64);  // (64+1)² Ecken: hoehe, biom, flags, temperatur, feuchte, wasser, objekte, seen
gen.sampleHeight(x, y);                   // punktweise, identisch mit den Chunk-Werten
gen.seenIn(x0, y0, x1, y1);               // Seen mit Mittelpunkt im Rechteck: { x, y, radius, spiegel, zufluss }
```

Kanten und Objekte sind nahtlos, weil alles nur von Seed und Position abhängt. Ohne globale Stufen gibt es hier keine Erosion.
Flüsse und Seen kommen aus `worldgen-chunkfluss` (Flussmodus `'netz'`, Standard):

- Grobes Knotengitter (Abstand `chunk.netz.weite` × Maßstab, gejittert per Seed). Jeder Knoten fließt zum steilsten tieferen Nachbarn, sofern kein Bergrücken dazwischen liegt. Flache Senken laufen über.
- Der Zufluss wird nur über `tiefeZufluss` Ringe stromauf gezählt (bleibt lokal). Ab `minZufluss` entsteht ein Fluss, breiter mit mehr Zufluss, mit Mäander-Verzerrung und Tal.
- Echte Senken mit genug Zufluss werden kleine Seen (`flags` SEE, Spiegel in `wasser`). Binnengewässer bleiben über dem Meeresspiegel. Flüsse, die ins Meer laufen, bilden Mündungen.
- `chunk: { flussModus: 'rauschen' }` liefert die alten Rauschflüsse (ohne Seen), `chunk: { fluesse: false }` schaltet Wasser im Inland ab.

`c.wasser` enthält den Wasserspiegel × `hoehenSkala` (Meer 0, See = Spiegel, Fluss knapp über dem Boden, trocken = `hoehe`).
`kachelbar: true` macht das Höhenfeld einer endlichen Welt periodisch.

## Worker

```js
// worker.js
const { daten, puffer } = transferierbar(createWorld(opts)); postMessage(daten, puffer);
// Hauptthread
const welt = mitAbfragen(e.data);
```

Eine Vorschau mit allen Reglern liegt unter `games/weltlabor/`. Die Tests startest du mit `node --test 'engine/world/**/*.test.mjs'`.

## Schnappschüsse

`worldgen-snapshot.test.mjs` hält Hashes über Höhe, Biom, Flags und Objekte für 8 Presets und beide Chunk-Flussmodi fest (Seed 77, 48², Qualität `schnell`).
Ändert sich eine Welt absichtlich, gibt `SCHNAPPSCHUSS_NEU=1 node --test engine/world/worldgen/worldgen-snapshot.test.mjs` die neuen Werte aus. Trag sie bewusst ein und erwähne das im PR.
