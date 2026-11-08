// Baut jedes Spiel mit games/<spiel>/spiel.json zu einer Einzeldatei dist/<spiel>.html (Doppelklick-Start).
// Aufruf: node tools/build.mjs [spiel …] [--offline]
//   --offline  packt Three.js mit ein (+~650 KB), sonst kommt Three per Import-Map vom CDN.
// spiel.json: { "eintrag": "js/main.js", "html": "index.html", "skript": "<script type=\"module\" src=\"js/main.js\"></script>" }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const OFFLINE = args.includes('--offline');
const nur = args.filter(a => !a.startsWith('--'));
const DIST = path.join(ROOT, 'dist');
fs.mkdirSync(DIST, { recursive: true });

const spiele = fs.readdirSync(path.join(ROOT, 'games'))
  .filter(s => fs.existsSync(path.join(ROOT, 'games', s, 'spiel.json')))
  .filter(s => !nur.length || nur.includes(s));

if (!spiele.length) { console.log('Keine Spiele mit spiel.json gefunden.'); process.exit(0); }

let fehler = 0;
for (const spiel of spiele) {
  const dir = path.join(ROOT, 'games', spiel);
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'spiel.json'), 'utf8'));
  const eintrag = cfg.eintrag || 'js/main.js';
  const skriptTag = cfg.skript || `<script type="module" src="${eintrag}"></script>`;
  try {
    const res = await esbuild.build({
      entryPoints: [path.join(dir, eintrag)],
      bundle: true, format: 'esm', write: false, target: 'es2020', charset: 'utf8',
      minify: !!cfg.minify, legalComments: 'none',
      external: OFFLINE ? [] : ['three', 'three/*'],
      logLevel: 'silent',
    });
    const code = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
    let html = fs.readFileSync(path.join(dir, cfg.html || 'index.html'), 'utf8');
    if (!html.includes(skriptTag)) throw new Error(`Skript-Tag nicht gefunden: ${skriptTag}`);
    html = html.replace(skriptTag, () => `<script type="module">\n${code}\n</script>`);
    if (OFFLINE) html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '');
    // Links, die in der Einzeldatei ins Leere zeigen, entfernen
    for (const weg of cfg.entfernen || []) html = html.split(weg).join('');
    const ziel = path.join(DIST, `${spiel}.html`);
    fs.writeFileSync(ziel, html);
    console.log(`✓ ${spiel} → dist/${spiel}.html (${Math.round(html.length / 1024)} KB)`);
  } catch (e) {
    fehler++;
    console.error(`✗ ${spiel}: ${e.message}`);
  }
}
process.exit(fehler ? 1 : 0);
