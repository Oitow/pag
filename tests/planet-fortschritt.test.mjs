// Prüft die Fortschrittslogik des Planet-Spiels (games/planet):
//  - jedes Voxel-Tier hat gültige Kreatur-Daten (Biome, Verhalten, Fähigkeiten, Beute …)
//  - jede Biom-Gefahr der Stufe n ist durch ein Tier aus einem Biom mit KLEINERER Stufe lösbar
//  - jedes Erz ist mit Abbau-Fähigkeit eines Tieres aus einem früheren Biom erreichbar
//  - Simulation: vom Start (Wiese, Holzkugel) aus sind alle Biome, Erze und Kugeln erreichbar
//  - um den Spawn (Wiesen) gibt es mehrere leicht fangbare zahme Tiere der Stufe 1
// Aufruf: node tests/planet-fortschritt.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = await import(pathToFileURL(path.join(root, 'games/planet/js/data.js')));
const { baueKreaturen, TIER_DATEN, GLUT_VARIANTEN, VERHALTEN, AKTIVZEIT } =
  await import(pathToFileURL(path.join(root, 'games/planet/js/kreaturen-daten.js')));
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'games/autobattler/tiere-daten.js'), 'utf8'), sandbox);
const TIERE = sandbox.window.TIERE;

let fehler = 0;
const fail = m => { fehler++; console.error('✗ ' + m); };
const ok = m => console.log('✓ ' + m);

const K = baueKreaturen(TIERE, DATA);
const B = DATA.BIOME;

// --- 1. Vollständigkeit & Gültigkeit ---
for (const id of Object.keys(TIERE)) if (!TIER_DATEN[id]) fail('keine Kreatur-Daten für ' + id);
for (const id of Object.keys(TIER_DATEN)) if (!TIERE[id]) fail('TIER_DATEN enthält unbekanntes Tier ' + id);
for (const [id, g] of Object.entries(GLUT_VARIANTEN)) if (!TIERE[g.basis]) fail(id + ': unbekannte Basis ' + g.basis);
for (const k of Object.values(K)) {
  if (!k.biome.length) fail(k.id + ': keine Biome');
  for (const b of k.biome) if (!B[b]) fail(k.id + ': unbekanntes Biom ' + b);
  if (!VERHALTEN.includes(k.verhalten)) fail(k.id + ': Verhalten ' + k.verhalten);
  if (!AKTIVZEIT.includes(k.aktiv)) fail(k.id + ': Aktivzeit ' + k.aktiv);
  if (!(k.stufe >= 1 && k.stufe <= 7)) fail(k.id + ': Stufe ' + k.stufe);
  if (!DATA.KUGELN.some(q => q.stufe >= k.stufe)) fail(k.id + ': keine Kugel für Stufe ' + k.stufe);
  if (!(k.groesse > 0.05 && k.groesse < 15)) fail(k.id + ': Größe ' + k.groesse);
  if (!(k.seltenheit >= 1 && k.seltenheit <= 3)) fail(k.id + ': Seltenheit');
  for (const [f, s] of Object.entries(k.faehigkeiten)) {
    if (!DATA.FAEHIGKEITEN[f]) fail(k.id + ': unbekannte Fähigkeit ' + f);
    if (!(s >= 1 && s <= 3)) fail(k.id + ': Fähigkeitsstufe ' + f + '=' + s);
  }
  for (const it of Object.keys(k.beute)) if (!DATA.ITEMS[it]) fail(k.id + ': unbekannte Beute ' + it);
  if (k.wasser === 'wasser' && !k.biome.includes('ozean')) fail(k.id + ': Wassertier ohne Ozean');
  if (k.stufe < Math.min(...k.biome.map(b => B[b].stufe))) fail(k.id + ': Stufe kleiner als Biomstufe');
}
for (const b of Object.keys(B)) {
  const n = Object.values(K).filter(k => k.biome.includes(b)).length;
  if (n < 4) fail('Biom ' + b + ' hat nur ' + n + ' Tierarten');
}
if (!Object.values(K).some(k => k.glut && k.biome.includes('asche'))) fail('Aschelande ohne Glut-Varianten');
ok(Object.keys(K).length + ' Kreaturen geprüft');

// --- 2. Gefahren: Lösung aus früherem Biom ---
const schuetzer = g => Object.entries(DATA.FAEHIGKEITEN).filter(([, f]) => f.schutz?.includes(g)).map(([n]) => n);
for (const [bid, b] of Object.entries(B)) {
  if (!b.gefahr) continue;
  const need = DATA.GEFAHR_STUFE[b.gefahr] ?? 1;
  const fs_ = schuetzer(b.gefahr);
  if (!fs_.length) { fail('keine Fähigkeit schützt vor ' + b.gefahr); continue; }
  const loeser = Object.values(K).filter(k => k.stufe < b.stufe
    && k.biome.some(x => B[x].stufe < b.stufe)
    && fs_.some(f => (k.faehigkeiten[f] || 0) >= need));
  if (!loeser.length) fail(`Gefahr ${b.gefahr} (${bid}, Stufe ${b.stufe}) nicht aus früherem Biom lösbar`);
  else ok(`${bid}: ${b.gefahr} ≥${need} ← ${loeser.map(k => `${k.name}(${k.biome.filter(x => B[x].stufe < b.stufe).join('/')}, St.${k.stufe})`).join(', ')}`);
}

// --- 3. Erze: Abbau aus früherem Biom ---
for (const [eid, e] of Object.entries(DATA.ERZE)) {
  const s = Math.min(...e.biome.map(b => B[b].stufe));
  if (!e.abbau) { ok(`${eid}: kein Abbau nötig`); continue; }
  const loeser = Object.values(K).filter(k => (k.faehigkeiten.abbau || 0) >= e.abbau && k.stufe < s && k.biome.some(x => B[x].stufe < s));
  if (!loeser.length) fail(`Erz ${eid} (Abbau ${e.abbau}, Stufe ${s}) ohne früheres Abbau-Tier`);
  else ok(`${eid}: Abbau ${e.abbau} ← ${loeser.map(k => k.name).join(', ')}`);
}

// --- 4. Simulation vom Start aus ---
let REZEPTE = null;
try { REZEPTE = (await import(pathToFileURL(path.join(root, 'games/planet/js/spiel-daten.js')))).REZEPTE; } catch (e) { /* optional */ }
const KUGEL_ROH = { kugel_holz: ['holz'], kugel_stein: ['stein'], kugel_kupfer: ['kupfer'], kugel_eisen: ['eisen'],
  kugel_silber: ['silber'], kugel_gold: ['gold'], kugel_obsidian: ['obsidian'] };
const zutaten = id => {
  const r = Array.isArray(REZEPTE) ? REZEPTE.find(x => x.id === id) : null;
  return r?.zutaten ? Object.keys(r.zutaten) : KUGEL_ROH[id];
};
const basis = new Set(['holz', 'stein', 'faser', 'beeren', 'pilz', 'harz']);
const erreichbar = new Set(Object.keys(B).filter(b => !B[b].gefahr && B[b].stufe === 1));
let fz = {}, items = new Set(basis), kugel = 0;
for (let runde = 0; runde < 30; runde++) {
  const vorher = erreichbar.size + items.size + kugel;
  for (const [eid, e] of Object.entries(DATA.ERZE))
    if (e.biome.some(b => erreichbar.has(b)) && (fz.abbau || 0) >= e.abbau) items.add(eid);
  for (const k of Object.values(K)) if (k.biome.some(b => erreichbar.has(b))) for (const it of Object.keys(k.beute)) items.add(it);
  for (const q of DATA.KUGELN) if ((zutaten(q.id) || []).every(z => items.has(z))) kugel = Math.max(kugel, q.stufe);
  for (const k of Object.values(K)) if (k.stufe <= kugel && k.biome.some(b => erreichbar.has(b)))
    for (const [f, s] of Object.entries(k.faehigkeiten)) fz[f] = Math.max(fz[f] || 0, s);
  for (const [bid, b] of Object.entries(B)) {
    if (erreichbar.has(bid)) continue;
    if (!b.gefahr || schuetzer(b.gefahr).some(f => (fz[f] || 0) >= (DATA.GEFAHR_STUFE[b.gefahr] ?? 1))) erreichbar.add(bid);
  }
  if (erreichbar.size + items.size + kugel === vorher) break;
}
for (const b of Object.keys(B)) if (!erreichbar.has(b)) fail('Biom ' + b + ' in der Simulation nicht erreichbar');
for (const e of Object.keys(DATA.ERZE)) if (!items.has(e)) fail('Erz ' + e + ' in der Simulation nicht abbaubar');
if (kugel < 7) fail('höchste herstellbare Kugel nur Stufe ' + kugel);
const unfangbar = Object.values(K).filter(k => k.stufe > kugel);
if (unfangbar.length) fail('nicht fangbar: ' + unfangbar.map(k => k.id).join(', '));
ok(`Simulation: ${erreichbar.size}/${Object.keys(B).length} Biome, Kugel bis Stufe ${kugel}${REZEPTE ? ' (Rezepte aus spiel-daten.js)' : ''}`);

// --- 5. Start: zahme Tiere auf der Wiese ---
const start = Object.values(K).filter(k => k.biome.includes('wiese') && k.stufe === 1 && k.verhalten === 'zahm' && k.aktiv !== 'nacht' && !k.wasser);
if (start.length < 3) fail('zu wenige zahme Starttiere auf der Wiese: ' + start.length);
else ok('Starttiere: ' + start.map(k => k.name).join(', '));

if (fehler) { console.error(`\n${fehler} Fehler`); process.exit(1); }
console.log('\nAlles grün.');
