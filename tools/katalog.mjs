// Erzeugt engine/KATALOG.md aus den JSDoc-Köpfen aller Engine-Module und prüft die Regeln.
// Aufruf: node tools/katalog.mjs          → schreibt den Katalog
//         node tools/katalog.mjs --check  → Exit 1, wenn Katalog veraltet oder Regeln verletzt
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = path.join(ROOT, 'engine');
const ZIEL = path.join(ENGINE, 'KATALOG.md');
const CHECK = process.argv.includes('--check');

// Schichten: Importe nur in niedrigere Schichten oder innerhalb desselben Ordners.
const SCHICHT = { core: 0, render: 1, world: 2, models: 2, input: 3, audio: 3, camera: 3, gameplay: 4, ui: 5 };

const fehler = [];
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');

function dateien(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...dateien(p));
    else if (/\.m?js$/.test(e.name) && !/\.test\.m?js$/.test(e.name)) out.push(p);
  }
  return out;
}

function kopf(src) {
  const m = src.match(/^\s*\/\*\*([\s\S]*?)\*\//);
  if (!m || !/@modul/.test(m[1])) return null;
  const zeilen = m[1].split('\n').map(z => z.replace(/^\s*\* ?/, ''));
  const tags = {};
  let aktuell = null;
  for (const z of zeilen) {
    const t = z.match(/^@(\w+)\s*(.*)$/);
    if (t) { aktuell = t[1]; tags[aktuell] = t[2].replace(/\s*\/\/.*$/, '').trim(); }
    else if (aktuell && z.trim()) tags[aktuell] += '\n' + z.replace(/^ {0,2}/, '');
  }
  return tags;
}

function exporte(src) {
  const namen = new Set();
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) namen.add(m[1]);
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm))
    for (const n of m[1].split(',')) { const x = n.trim().split(/\s+as\s+/).pop(); if (x) namen.add(x); }
  return namen;
}

function apiNamen(api) {
  return api.split(/\s*;\s*/).map(s => s.trim().match(/^([A-Za-z_$][\w$]*)/)?.[1]).filter(Boolean);
}

// Wer nutzt das Modul? (Suche nach dem Pfad in games/)
function nutzerListe() {
  const map = {};
  const games = path.join(ROOT, 'games');
  if (!fs.existsSync(games)) return map;
  const durchsuche = (dir, spiel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') durchsuche(p, spiel); }
      else if (/\.(m?js|html)$/.test(e.name)) {
        const src = fs.readFileSync(p, 'utf8');
        if (!src.includes('engine/')) continue;
        for (const m of src.matchAll(/engine\/([\w\-/]+\.m?js)/g)) (map[m[1]] ??= new Set()).add(spiel);
      }
    }
  };
  for (const e of fs.readdirSync(games, { withFileTypes: true })) if (e.isDirectory()) durchsuche(path.join(games, e.name), e.name);
  return map;
}

const nutzer = nutzerListe();
const module = [];
for (const datei of dateien(ENGINE).sort()) {
  const r = rel(datei);
  const enginePfad = r.slice('engine/'.length);
  const src = fs.readFileSync(datei, 'utf8');
  const k = kopf(src);
  if (!k) { fehler.push(`${r}: Modul-Kopf (/** @modul … */) fehlt`); continue; }
  for (const pflicht of ['modul', 'zweck', 'api', 'beispiel', 'tags', 'version', 'status'])
    if (!k[pflicht]) fehler.push(`${r}: @${pflicht} fehlt`);
  const ex = exporte(src);
  for (const n of apiNamen(k.api || '')) if (!ex.has(n)) fehler.push(`${r}: @api nennt „${n}“, wird aber nicht exportiert`);
  if (!/^\d+\.\d+\.\d+$/.test(k.version || '')) fehler.push(`${r}: @version muss x.y.z sein`);

  // Schichtregeln
  const ordner = enginePfad.split('/')[0];
  const rang = SCHICHT[ordner];
  for (const m of src.matchAll(/^\s*import[^'"]*['"]([^'"]+)['"]/gm)) {
    const ziel = m[1];
    if (!ziel.startsWith('.')) continue;
    const zielAbs = path.resolve(path.dirname(datei), ziel);
    const zielRel = path.relative(ENGINE, zielAbs).split(path.sep).join('/');
    if (zielRel.startsWith('..')) { fehler.push(`${r}: importiert außerhalb von engine/ (${ziel})`); continue; }
    const zielOrdner = zielRel.split('/')[0];
    if (rang === undefined || zielOrdner === ordner || zielOrdner === 'test') continue;
    const zielRang = SCHICHT[zielOrdner];
    if (zielRang === undefined || zielRang >= rang) fehler.push(`${r}: Schichtverstoß – ${ordner} darf ${zielOrdner} nicht importieren`);
  }
  module.push({ pfad: enginePfad, k, nutzer: [...(nutzer[enginePfad] || [])].sort() });
}

// Katalog bauen
const tagMap = {};
for (const m of module) for (const t of (m.k.tags || '').split(',').map(s => s.trim()).filter(Boolean)) (tagMap[t] ??= []).push(m.k.modul);

let md = `# 🧰 Engine-Katalog\n\n`;
md += `> Automatisch erzeugt von \`node tools/katalog.mjs\` – nicht von Hand bearbeiten.\n`;
md += `> Erst diese Liste lesen, dann gezielt den Eintrag (\`grep -n -A12 "### <modul>" engine/KATALOG.md\`).\n\n`;
md += `## Übersicht\n\n| Modul | Pfad | Zweck | Status |\n|---|---|---|---|\n`;
for (const m of module) md += `| ${m.k.modul} | \`engine/${m.pfad}\` | ${m.k.zweck} | ${m.k.status} |\n`;
md += `\n## Tags\n\n| Tag | Module |\n|---|---|\n`;
for (const t of Object.keys(tagMap).sort()) md += `| ${t} | ${tagMap[t].join(', ')} |\n`;
md += `\n## Module\n`;
for (const m of module) {
  md += `\n### ${m.k.modul} · \`engine/${m.pfad}\` · v${m.k.version} · ${m.k.status}\n`;
  md += `${m.k.zweck}\n\n`;
  md += (m.k.api || '').split(/\s*;\s*/).filter(Boolean).map(a => `- \`${a.trim()}\``).join('\n') + '\n';
  if (m.k.beispiel) md += '\n```js\n' + m.k.beispiel.trim().split('\n').map(z => z.replace(/^\s{0,3}/, '')).join('\n') + '\n```\n';
  md += `\nGenutzt von: ${m.nutzer.length ? m.nutzer.join(', ') : '–'} · Tags: ${m.k.tags || '–'} · THREE: ${m.k.three || '?'}\n`;
}

if (CHECK) {
  const alt = fs.existsSync(ZIEL) ? fs.readFileSync(ZIEL, 'utf8') : '';
  if (alt !== md) fehler.push('engine/KATALOG.md ist veraltet → node tools/katalog.mjs');
} else {
  fs.writeFileSync(ZIEL, md);
  console.log(`Katalog: ${module.length} Module → engine/KATALOG.md`);
}

if (fehler.length) {
  console.error('Katalog-Prüfung fehlgeschlagen:\n- ' + fehler.join('\n- '));
  process.exit(1);
} else if (CHECK) console.log(`Katalog ok (${module.length} Module)`);
