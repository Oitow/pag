// Smoke-Test: startet jeden Ort mit spiel.json (tools/orte.mjs) headless in Chromium.
//  1. <ort>/index.html über lokalen Server (Entwicklungsversion)
//  2. dist/<spiel>.html per file:// (Doppelklick-Version), falls gebaut
// Fehlschlag bei Seitenfehlern oder Konsolen-Fehlern. Screenshot nur bei Fehler → test-results/.
// Aufruf: node tests/smoke.mjs [spiel …]
// spiel.json → "smoke": { "query": "?seed=42", "warte": 5000, "ignoriere": ["Text-Teil"] }
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spielOrte } from '../tools/orte.mjs';
import { freierPort } from '../tools/freier-port.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const nur = process.argv.slice(2);
const THREE_LOKAL = path.join(ROOT, 'node_modules', 'three');
const THREE_VERSION = fs.existsSync(THREE_LOKAL) ? JSON.parse(fs.readFileSync(path.join(THREE_LOKAL, 'package.json'), 'utf8')).version : null;

const orte = spielOrte(nur);

const port = await freierPort();
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 700));
// Chrome: PAG_CHROME=/pfad, sonst Playwright-Chromium, sonst System-Chrome (Cloud-Sitzung ohne Playwright-Browser, siehe docs/TESTEN.md)
const chromePfad = process.env.PAG_CHROME || (fs.existsSync(chromium.executablePath()) ? undefined : (fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined));
const browser = await chromium.launch({ executablePath: chromePfad, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });

// Three.js vom CDN auf die lokale Kopie umleiten (CI/Cloud ohne CDN-Zugang). Nur bei passender Version.
async function routeThree(page) {
  if (!THREE_VERSION) return;
  await page.route(/three@([\d.]+)\/(build|examples)\/(.*)$/, (route, req) => {
    const m = req.url().match(/three@([\d.]+)\/(build|examples)\/(.*)$/);
    const datei = path.join(THREE_LOKAL, m[2], m[3]);
    if (m[1] !== THREE_VERSION || !fs.existsSync(datei)) return route.continue();
    route.fulfill({ path: datei, contentType: 'application/javascript' });
  });
}

let fehlgeschlagen = 0;
async function pruefe(name, url, cfg) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await routeThree(page);
  const meldungen = [];
  const ignoriere = cfg.ignoriere || [];
  page.on('console', m => { if (m.type() === 'error') meldungen.push('console: ' + m.text()); });
  page.on('pageerror', e => meldungen.push('pageerror: ' + e.message));
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(cfg.warte ?? 5000);
  } catch (e) { meldungen.push('laden: ' + e.message); }
  const echt = [...new Set(meldungen)].filter(m => !ignoriere.some(i => m.includes(i)));
  if (echt.length) {
    fehlgeschlagen++;
    fs.mkdirSync(path.join(ROOT, 'test-results'), { recursive: true });
    const bild = path.join('test-results', name.replace(/[^\w-]/g, '_') + '.png');
    await page.screenshot({ path: path.join(ROOT, bild) }).catch(() => {});
    console.log(`✗ ${name}\n   ${echt.slice(0, 10).join('\n   ')}\n   Screenshot: ${bild}`);
  } else console.log(`✓ ${name}`);
  await page.close();
}

for (const ort of orte) {
  const spiel = ort.name, cfg = ort.cfg;
  const s = cfg.smoke || {};
  const q = s.query || '';
  await pruefe(`${spiel} (Server)`, `http://127.0.0.1:${port}/${ort.dir}${cfg.html || 'index.html'}${q}`, s);
  const dist = path.join(ROOT, 'dist', `${spiel}.html`);
  if (cfg.eintrag !== false && fs.existsSync(dist)) await pruefe(`${spiel} (Einzeldatei)`, pathToFileURL(dist).href + q, s);
}

await browser.close();
srv.kill();
console.log(fehlgeschlagen ? `\n${fehlgeschlagen} Smoke-Test(s) fehlgeschlagen` : `\nAlle Smoke-Tests ok (${orte.length} Orte)`);
process.exit(fehlgeschlagen ? 1 : 0);
