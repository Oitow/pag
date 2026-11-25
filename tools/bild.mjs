// Macht Bildschirmfotos eines Spiels (headless Chromium), damit Mensch und KI das Ergebnis SEHEN – nicht nur Tests grün.
// Aufruf: node tools/bild.mjs <spiel|pfad.html> [--query "?ort=ufer"] [--warte 6000] [--hoch] [--name ufer] [--fps]
//   --hoch   Handy-Hochformat 412×915 (Standard: 960×540 quer)     --fps  misst grob die Bildrate (nur Vergleichswert, SwiftShader!)
// Ergebnis: test-results/bild-<name>.png + Konsolen-Fehler auf stdout. Three.js kommt aus node_modules/three (siehe docs/TESTEN.md).
// Chrome: Umgebungsvariable PAG_CHROME=/pfad/zu/chrome, sonst Playwright-Chromium, sonst /usr/bin/google-chrome.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findeOrt } from './orte.mjs';
import { freierPort } from './freier-port.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args[i + 1]; };
const ziel = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1]?.startsWith('--') !== true) || args[0];
if (!ziel) { console.log('Aufruf: node tools/bild.mjs <spiel|pfad.html> [--query "?…"] [--warte ms] [--hoch] [--name x] [--fps]'); process.exit(2); }
const ort = ziel.endsWith('.html') ? null : findeOrt(ziel);
if (!ziel.endsWith('.html') && !ort) { console.log(`Unbekannter Ort „${ziel}“ – siehe tools/orte.mjs`); process.exit(2); }
const pfad = ort ? `${ort.dir}index.html` : ziel;
const name = opt('name', path.basename(path.dirname(pfad)) + (args.includes('--hoch') ? '-hoch' : ''));
const THREE_LOKAL = path.join(ROOT, 'node_modules', 'three');

const port = await freierPort();
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 700));
const chrome = process.env.PAG_CHROME || (fs.existsSync(chromium.executablePath()) ? undefined : '/usr/bin/google-chrome');
const browser = await chromium.launch({ executablePath: chrome, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: args.includes('--hoch') ? { width: 412, height: 915 } : { width: 960, height: 540 } });
await page.route(/three@([\d.]+)\/(build|examples)\/(.*)$/, (route, req) => {
  const m = req.url().match(/three@([\d.]+)\/(build|examples)\/(.*)$/);
  const datei = path.join(THREE_LOKAL, m[2], m[3]);
  return fs.existsSync(datei) ? route.fulfill({ path: datei, contentType: 'application/javascript' }) : route.continue();
});
const meldungen = [];
page.on('console', m => { if (m.type() === 'error') meldungen.push('console: ' + m.text()); });
page.on('pageerror', e => meldungen.push('pageerror: ' + e.message));
try {
  await page.goto(`http://127.0.0.1:${port}/${pfad}${opt('query', '')}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(+opt('warte', 6000));
  if (args.includes('--fps')) {
    const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; performance.now() - t0 < 2000 ? requestAnimationFrame(f) : r(n / 2); }; requestAnimationFrame(f); }));
    console.log(`fps (Software-Renderer, nur Vergleich): ${fps.toFixed(1)}`);
  }
} catch (e) { meldungen.push('laden: ' + e.message); }
fs.mkdirSync(path.join(ROOT, 'test-results'), { recursive: true });
const bild = path.join('test-results', `bild-${name}.png`);
await page.screenshot({ path: path.join(ROOT, bild) });
console.log(`Bild: ${bild}`);
console.log(meldungen.length ? [...new Set(meldungen)].slice(0, 12).join('\n') : 'keine Konsolen-Fehler');
await browser.close(); srv.kill();
process.exit(meldungen.length ? 1 : 0);
