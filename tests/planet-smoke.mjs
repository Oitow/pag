// Smoke-Test für games/planet: startet einen lokalen Server, lädt das Spiel headless,
// meldet Konsolenfehler und speichert einen Screenshot.
// Aufruf: node tests/planet-smoke.mjs [ausgabe.png] [wartezeit_ms] [url-query, z.B. "seed=42&debug"]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || 'planet.png';
const warte = +(process.argv[3] || 8000);
const query = process.argv[4] || 'seed=42';
const port = 8000 + Math.floor(Math.random() * 900);
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
const fehler = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') fehler.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => fehler.push('pageerror: ' + e.message));
await page.goto(`http://127.0.0.1:${port}/games/planet/index.html?${query}`);
await page.waitForTimeout(warte);
const info = await page.evaluate(() => {
  const c = window.ctx; if (!c) return 'ctx fehlt';
  const r = c.renderer.info.render;
  return { module: ['planet','flora','kreaturen','spieler','spiel'].map(n => n + ':' + (c[n] ? Object.keys(c[n]).length : 'X')).join(' '),
    dreiecke: r.triangles, drawcalls: r.calls, laden: !!document.getElementById('laden') };
});
await page.screenshot({ path: out });
console.log('INFO', JSON.stringify(info));
console.log(fehler.length ? 'MELDUNGEN:\n' + [...new Set(fehler)].slice(0, 40).join('\n') : 'Keine Fehler/Warnungen');
await browser.close(); srv.kill();
