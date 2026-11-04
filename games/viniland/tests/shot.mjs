// Headless-Screenshot + Konsolen-Fehler einer Seite aus games/viniland.
// Nutzung: node tests/shot.mjs <seite.html> <out.png> [ms=6000] [breite=1280] [hoehe=720]
// Erwartet eine lokale three.module.js unter $THREE_LOCAL (Default /home/claude/deps/three/build/three.module.js),
// weil das CDN in der Testumgebung gesperrt ist. Die Import-Map wird für den Test umgeschrieben.
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const [page, out, ms = '6000', w = '1280', h = '720'] = process.argv.slice(2);
const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync('/tmp/vl-');
fs.cpSync(root, tmp, { recursive: true });
fs.copyFileSync(process.env.THREE_LOCAL || '/home/claude/deps/three/build/three.module.js', path.join(tmp, 'three.module.js'));
const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
  const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p);
  else if (p.endsWith('.html')) fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/three@[^"']+three\.module\.js/g, '/three.module.js'));
});
walk(tmp);
const port = 8700 + Math.floor(Math.random() * 200);
const srv = spawn('python3', ['-m', 'http.server', String(port), '-d', tmp], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 600));
let log = '';
try {
  log = execFileSync('google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--enable-logging=stderr', '--v=0', `--window-size=${w},${h}`, `--virtual-time-budget=${ms}`, `--screenshot=${path.resolve(out)}`,
    `http://localhost:${port}/${page}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
} catch (e) { log = (e.stdout || '') + (e.stderr || ''); }
srv.kill();
const lines = String(log).split('\n').filter(l => /CONSOLE|Uncaught|Error/i.test(l) && !/dbus|gpu_init|viz|ozone|fontconfig/i.test(l));
console.log(lines.slice(0, 40).join('\n') || '(keine Konsolen-Meldungen)');
console.log('Screenshot:', path.resolve(out));
