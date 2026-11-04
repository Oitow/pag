// Smoke-Test für games/bosse: lädt jeden Boss headless in Idle, Laufen und Angriff,
// meldet Konsolenfehler und speichert Screenshots (+ Kontaktbogen kontakt.png).
// Aufruf: node tests/bosse-smoke.mjs [ausgabe-ordner] [boss-id,...]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || 'bosse-bilder';
fs.mkdirSync(out, { recursive: true });
const port = 8000 + Math.floor(Math.random() * 900);
const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 480, height: 480 } });
const fehler = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') fehler.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => fehler.push('pageerror: ' + e.message));
await page.goto(`http://127.0.0.1:${port}/games/bosse/index.html?rot=0`);
await page.waitForFunction(() => window.labor, null, { timeout: 30000 });
const ids = process.argv[3] ? process.argv[3].split(',') : await page.evaluate(() => labor.BOSSE.map(b => b.id));
await page.addStyleTag({ content: '#oben,#liste,#anim,#drehen{display:none!important}' });
const bilder = [];
for (const id of ids) {
  for (const anim of ['idle', 'walk', 'attack']) {
    await page.evaluate(([id, anim]) => {
      labor.waehle(labor.BOSSE.findIndex(b => b.id === id));
      labor.setzeAnim(anim === 'attack' ? 'idle' : anim);
      window.__anim = anim;
    }, [id, anim]);
    await page.waitForTimeout(anim === 'walk' ? 1800 : 900);
    if (anim === 'attack') {
      await page.evaluate(() => labor.setzeAnim('attack'));
      // bis kurz nach dem Treffer warten
      await page.waitForFunction(() => labor.st.p > (labor.aktiv.def.trefferZeit ?? 0.5) + 0.05 || labor.st.p < 0, null, { timeout: 10000 });
    }
    const datei = path.join(out, `${id}-${anim}.png`);
    await page.screenshot({ path: datei });
    bilder.push(datei);
  }
  const info = await page.evaluate(() => { const r = labor.renderer.info.render; return { dreiecke: r.triangles, drawcalls: r.calls }; });
  console.log(id.padEnd(10), JSON.stringify(info));
}
// Kontaktbogen
const html = `<body style="margin:0;background:#000;display:grid;grid-template-columns:repeat(3,240px)">${bilder.map(b => `<img src="data:image/png;base64,${fs.readFileSync(b).toString('base64')}" width=240>`).join('')}</body>`;
const p2 = await browser.newPage({ viewport: { width: 720, height: 240 * ids.length } });
await p2.setContent(html); await p2.screenshot({ path: path.join(out, 'kontakt.png'), fullPage: true });
console.log(fehler.length ? 'MELDUNGEN:\n' + [...new Set(fehler)].slice(0, 40).join('\n') : 'Keine Fehler/Warnungen');
await browser.close(); srv.kill();
