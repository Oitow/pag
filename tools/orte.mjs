// Wo liegen spielbare Seiten? Eine Liste für build, smoke, bild und katalog.
//   erlenwacht/      das echte Spiel (nur fertige Module)
//   testfeld/        gemeinsames Testfeld (alle Module, auch unfertige)
//   labore/<x>/      ein Labor je Bereich (ein Modul isoliert testen)
//   spiele/<x>/      eigenständige Spiele und alte Prototypen
// Ort = { name, dir (relativ zu ROOT, mit /), art }. Name = Ordnername, muss eindeutig sein.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const EINZELN = [['erlenwacht', 'spiel'], ['testfeld', 'testfeld']];
const SAMMLUNGEN = [['labore', 'labor'], ['spiele', 'spiel-alt']];

/** Alle Orte (mit oder ohne spiel.json). */
export function alleOrte() {
  const orte = [];
  for (const [d, art] of EINZELN) if (fs.existsSync(path.join(ROOT, d))) orte.push({ name: d, dir: d + '/', art });
  for (const [d, art] of SAMMLUNGEN) {
    const abs = path.join(ROOT, d);
    if (!fs.existsSync(abs)) continue;
    for (const e of fs.readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)))
      if (e.isDirectory() && !e.name.startsWith('_')) orte.push({ name: e.name, dir: `${d}/${e.name}/`, art });
  }
  return orte;
}

/** Orte mit spiel.json (baubar + Smoke-Test), optional gefiltert nach Namen. cfg = Inhalt von spiel.json. */
export function spielOrte(nur = []) {
  return alleOrte()
    .filter((o) => fs.existsSync(path.join(ROOT, o.dir, 'spiel.json')))
    .filter((o) => !nur.length || nur.includes(o.name))
    .map((o) => ({ ...o, cfg: JSON.parse(fs.readFileSync(path.join(ROOT, o.dir, 'spiel.json'), 'utf8')) }));
}

/** Name → Ort (für tools/bild.mjs). */
export const findeOrt = (name) => alleOrte().find((o) => o.name === name) || null;
