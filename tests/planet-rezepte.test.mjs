// Prüft die Spiel-Daten von games/planet (js/spiel-daten.js):
//  - jede Fangkugel aus DATA.KUGELN hat ein Rezept, alle Item-IDs existieren in DATA.ITEMS
//  - alle Zutaten sind beschaffbar (Erz, Grundstoff, Beute oder selbst craftbar)
//  - Kugel-Rohstoffe stammen aus Biomen mit kleinerer Stufe als die Kugel (Fortschritt)
//  - Ausrüstung gibt höchstens Stufe 1 (Tiere bleiben der Hauptweg), Slots gültig
//  - Quests verweisen nur auf gültige Items, Biome und Fähigkeiten
// Aufruf: node tests/planet-rezepte.test.mjs
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = await import(pathToFileURL(path.join(root, 'games/planet/js/data.js')));
const SD = await import(pathToFileURL(path.join(root, 'games/planet/js/spiel-daten.js')));

let fehler = 0;
const fail = m => { fehler++; console.error('✗ ' + m); };
const ok = m => console.log('✓ ' + m);
const ITEMS = DATA.ITEMS;

// Grundstoffe ohne Biom-Bindung (Flora überall / Tierbeute)
const GRUND = ['holz', 'stein', 'faser', 'beeren', 'pilz', 'harz', 'fell', 'leder', 'feder', 'schuppe', 'fleisch', 'muschel', 'glut'];
const beschaffbar = new Set([...GRUND, ...Object.keys(DATA.ERZE)]);
const rezeptFuer = id => SD.REZEPTE.filter(r => r.id === id);

// 1. Items existieren
for (const r of SD.REZEPTE) {
  if (!ITEMS[r.id]) fail('Rezept-Ergebnis fehlt in ITEMS: ' + r.id);
  if (!(r.n >= 1)) fail('Rezept ' + r.id + ' ohne Menge');
  if (!SD.REZEPT_GRUPPEN[r.gruppe]) fail('Rezept ' + r.id + ' mit unbekannter Gruppe ' + r.gruppe);
  for (const [z, n] of Object.entries(r.zutaten)) {
    if (!ITEMS[z]) fail(`Zutat ${z} (Rezept ${r.id}) fehlt in ITEMS`);
    if (!(n >= 1)) fail(`Zutat ${z} (Rezept ${r.id}) ohne Menge`);
  }
}
for (const id of [...Object.keys(SD.AUSRUESTUNG), ...Object.keys(SD.NAHRUNG), ...Object.keys(SD.START_INVENTAR)])
  if (!ITEMS[id]) fail('Item fehlt in ITEMS: ' + id);
ok('alle Item-IDs existieren');

// 2. Erreichbarkeit (Fixpunkt über Rezepte)
let neu = true;
while (neu) {
  neu = false;
  for (const r of SD.REZEPTE) if (!beschaffbar.has(r.id) && Object.keys(r.zutaten).every(z => beschaffbar.has(z))) { beschaffbar.add(r.id); neu = true; }
}
for (const r of SD.REZEPTE) if (!beschaffbar.has(r.id)) fail('nicht herstellbar: ' + r.id);
ok('alle Rezepte sind herstellbar');

// 3. Jede Kugel craftbar, Rohstoffe aus früheren Biomen
const minStufe = erz => Math.min(...DATA.ERZE[erz].biome.map(b => DATA.BIOME[b].stufe));
for (const k of DATA.KUGELN) {
  const rz = rezeptFuer(k.id);
  if (!rz.length) { fail('kein Rezept für ' + k.id); continue; }
  for (const r of rz) for (const z of Object.keys(r.zutaten)) {
    if (DATA.ERZE[z] && minStufe(z) > k.stufe) fail(`${k.id} (Stufe ${k.stufe}) braucht ${z} aus Stufe ${minStufe(z)}`);
  }
}
ok('jede Fangkugel hat ein Rezept mit passenden Rohstoffen');

// 4. Ausrüstung dosiert
for (const [id, a] of Object.entries(SD.AUSRUESTUNG)) {
  if (!SD.SLOTS[a.slot]) fail(id + ': unbekannter Slot ' + a.slot);
  for (const [f, s] of Object.entries(a.faehigkeiten)) {
    if (!DATA.FAEHIGKEITEN[f]) fail(id + ': unbekannte Fähigkeit ' + f);
    if (s > 1) fail(id + ': Stufe ' + s + ' > 1 – Tiere sollen der Hauptweg bleiben');
  }
  if (!rezeptFuer(id).length) fail('Ausrüstung ohne Rezept: ' + id);
}
for (const [g, st] of Object.entries(DATA.GEFAHR_STUFE)) {
  if (!SD.GEFAHREN[g]) fail('kein Gefahren-Text für ' + g);
  if (!SD.schutzFuer(g)) fail('keine Schutz-Fähigkeit für ' + g);
}
ok('Ausrüstung höchstens Stufe 1, alle Gefahren haben Texte und Schutz');

// 5. Quests
const ids = new Set();
for (const q of SD.QUESTS) {
  if (ids.has(q.id)) fail('doppelte Quest-ID ' + q.id); ids.add(q.id);
  if (!q.titel || !q.hilfe) fail('Quest ohne Text: ' + q.id);
  if (q.item && !ITEMS[q.item]) fail(`Quest ${q.id}: unbekanntes Item ${q.item}`);
  if (q.biom && !DATA.BIOME[q.biom]) fail(`Quest ${q.id}: unbekanntes Biom ${q.biom}`);
  if (q.faehigkeit && !DATA.FAEHIGKEITEN[q.faehigkeit]) fail(`Quest ${q.id}: unbekannte Fähigkeit ${q.faehigkeit}`);
  if (!['besitz', 'fangen', 'fangenF', 'aktiv', 'platzieren', 'biom', 'buch'].includes(q.typ)) fail(`Quest ${q.id}: unbekannter Typ ${q.typ}`);
  for (const id of Object.keys(q.belohnung || {})) if (!ITEMS[id]) fail(`Quest ${q.id}: Belohnung ${id} unbekannt`);
}
// jedes gefährliche Biom (außer Ozean) wird von einer Quest betreten, davor wird der Schutz verlangt
for (const [b, B] of Object.entries(DATA.BIOME)) {
  if (!B.gefahr || b === 'ozean') continue;
  const qi = SD.QUESTS.findIndex(q => q.typ === 'biom' && q.biom === b);
  if (qi < 0) { fail('keine Quest führt in ' + b); continue; }
  const sch = SD.schutzFuer(B.gefahr), st = DATA.GEFAHR_STUFE[B.gefahr];
  if (!SD.QUESTS.slice(0, qi).some(q => q.typ === 'fangenF' && q.faehigkeit === sch && q.stufe >= st)) fail(`vor „${SD.QUESTS[qi].titel}“ fehlt eine Quest für ${sch} ${st}`);
}
ok(SD.QUESTS.length + ' Quests gültig, Schutz wird vor jedem gefährlichen Biom verlangt');

if (fehler) { console.error(`\n${fehler} Fehler`); process.exit(1); }
console.log('\nAlles ok.');
