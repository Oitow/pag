// Gemeinsames Vokabular aller Module. Erweitern ist ok (neue Einträge),
// bestehende IDs NICHT umbenennen – andere Module verlassen sich darauf.

export const R = 400;            // Planetenradius in Metern (Meeresspiegel = R)
export const MAX_HOEHE = 95;     // höchste Berggipfel über Meeresspiegel
export const MAX_TIEFE = 60;     // tiefster Meeresgrund unter Meeresspiegel
export const SPIELER_GROESSE = 1.8;
export const TAG_DAUER = 600;    // Sekunden für einen ganzen Tag

// Biome. stufe = Fortschritts-Stufe (1 = Start). gefahr = Umweltgefahr,
// gegen die eine Fähigkeit schützt (siehe FAEHIGKEITEN.schutz).
export const BIOME = {
  ozean:  { name: 'Ozean',        stufe: 3, farbe: 0x2a5f8a, gefahr: 'tiefe' },
  strand: { name: 'Strand',       stufe: 1, farbe: 0xe8d9a0, gefahr: null },
  wiese:  { name: 'Wiesen',       stufe: 1, farbe: 0x7fbf4d, gefahr: null },
  wald:   { name: 'Dunkelwald',   stufe: 2, farbe: 0x2f6b3a, gefahr: 'dunkel' },
  sumpf:  { name: 'Sumpf',        stufe: 3, farbe: 0x55603a, gefahr: 'gift' },
  berge:  { name: 'Berge',        stufe: 4, farbe: 0x9a9aa4, gefahr: 'kaelte' },
  ebene:  { name: 'Ebenen',       stufe: 5, farbe: 0xc9b75a, gefahr: null },
  eis:    { name: 'Eiswüste',     stufe: 6, farbe: 0xeef4fb, gefahr: 'kaelte2' },
  wueste: { name: 'Glutwüste',    stufe: 6, farbe: 0xdca35a, gefahr: 'hitze' },
  asche:  { name: 'Aschelande',   stufe: 7, farbe: 0x3a2f2f, gefahr: 'hitze2' },
};

// Fähigkeiten, die gefangene Begleiter (oder Ausrüstung) geben. Werte = Stufe 1..3.
export const FAEHIGKEITEN = {
  reiten:     { name: 'Reiten',      icon: '🐎', text: 'Schneller laufen' },
  schwimmen:  { name: 'Schwimmen',   icon: '🌊', text: 'Schnell schwimmen, kein Ertrinken im tiefen Ozean' },
  fliegen:    { name: 'Gleiten',     icon: '🪽', text: 'Doppelsprung und Gleiten' },
  klettern:   { name: 'Klettern',    icon: '🧗', text: 'Steile Hänge hinauf' },
  waerme:     { name: 'Wärme',       icon: '🔥', text: 'Schutz vor Kälte', schutz: ['kaelte', 'kaelte2'] },
  kuehlung:   { name: 'Kühlung',     icon: '❄️', text: 'Schutz vor Hitze', schutz: ['hitze', 'hitze2'] },
  giftschutz: { name: 'Giftschutz',  icon: '🧪', text: 'Schutz vor Sumpfgift', schutz: ['gift'] },
  licht:      { name: 'Licht',       icon: '💡', text: 'Leuchtet im Dunkeln', schutz: ['dunkel'] },
  tauchen:    { name: 'Tiefsee',     icon: '🫧', text: 'Atem im tiefen Wasser', schutz: ['tiefe'] },
  tragen:     { name: 'Tragen',      icon: '🎒', text: 'Mehr Inventarplätze' },
  sammeln:    { name: 'Sammeln',     icon: '🧺', text: 'Mehr Ertrag beim Sammeln' },
  abbau:      { name: 'Abbau',       icon: '⛏️', text: 'Baut Erz ab (Stufe = Erzstufe)' },
  kampf:      { name: 'Kampf',       icon: '⚔️', text: 'Begleiter kämpft mit' },
  spuernase:  { name: 'Spürnase',    icon: '👃', text: 'Zeigt seltene Tiere und Erze' },
  heilung:    { name: 'Heilung',     icon: '💚', text: 'Regeneration' },
};
// Stufe, die eine Gefahr verlangt (z. B. kaelte2 braucht waerme ≥ 2).
export const GEFAHR_STUFE = { tiefe: 1, dunkel: 1, gift: 1, kaelte: 1, kaelte2: 2, hitze: 1, hitze2: 2 };

// Gegenstände. Neue dürfen ergänzt werden.
export const ITEMS = {
  holz:      { name: 'Holz',        icon: '🪵' },
  stein:     { name: 'Stein',       icon: '🪨' },
  faser:     { name: 'Faser',       icon: '🌾' },
  beeren:    { name: 'Beeren',      icon: '🫐' },
  pilz:      { name: 'Pilz',        icon: '🍄' },
  harz:      { name: 'Harz',        icon: '🟠' },
  kupfer:    { name: 'Kupfererz',   icon: '🟤' },
  eisen:     { name: 'Eisenerz',    icon: '⚙️' },
  silber:    { name: 'Silbererz',   icon: '🥈' },
  gold:      { name: 'Golderz',     icon: '🥇' },
  kristall:  { name: 'Kristall',    icon: '💎' },
  eiskristall:{ name: 'Eiskristall', icon: '🧊' },
  bernstein: { name: 'Bernstein',   icon: '🟡' },
  obsidian:  { name: 'Obsidian',    icon: '⬛' },
  glut:      { name: 'Glutkern',    icon: '🔥' },
  muschel:   { name: 'Muschel',     icon: '🐚' },
  fell:      { name: 'Fell',        icon: '🧶' },
  leder:     { name: 'Leder',       icon: '🟫' },
  feder:     { name: 'Feder',       icon: '🪶' },
  schuppe:   { name: 'Schuppe',     icon: '🐉' },
  fleisch:   { name: 'Fleisch',     icon: '🍖' },
  // Fangkugeln (siehe KUGELN)
  kugel_holz:    { name: 'Holz-Fangkugel',    icon: '🟢' },
  kugel_stein:   { name: 'Stein-Fangkugel',   icon: '⚪' },
  kugel_kupfer:  { name: 'Kupfer-Fangkugel',  icon: '🟠' },
  kugel_eisen:   { name: 'Eisen-Fangkugel',   icon: '🔵' },
  kugel_silber:  { name: 'Silber-Fangkugel',  icon: '🟣' },
  kugel_gold:    { name: 'Gold-Fangkugel',    icon: '🟡' },
  kugel_obsidian:{ name: 'Obsidian-Fangkugel', icon: '⚫' },
};

// Fangkugeln: stufe muss ≥ Tierstufe sein, bonus erhöht die Fangchance.
export const KUGELN = [
  { id: 'kugel_holz',     stufe: 1, bonus: 0.0, farbe: 0x6fbf4f },
  { id: 'kugel_stein',    stufe: 2, bonus: 0.1, farbe: 0xcfcfcf },
  { id: 'kugel_kupfer',   stufe: 3, bonus: 0.15, farbe: 0xd9822b },
  { id: 'kugel_eisen',    stufe: 4, bonus: 0.2, farbe: 0x5a7fd6 },
  { id: 'kugel_silber',   stufe: 5, bonus: 0.25, farbe: 0xb58ae0 },
  { id: 'kugel_gold',     stufe: 6, bonus: 0.3, farbe: 0xf2c94c },
  { id: 'kugel_obsidian', stufe: 7, bonus: 0.4, farbe: 0x2b2233 },
];

// Erz pro Biom und benötigte Abbau-Stufe. Holz/Stein/Faser gibt es überall ohne Fähigkeit.
export const ERZE = {
  kupfer:   { biome: ['wald'],           abbau: 0 },
  eisen:    { biome: ['sumpf'],          abbau: 1 },
  silber:   { biome: ['berge'],          abbau: 2 },
  gold:     { biome: ['ebene'],          abbau: 2 },
  eiskristall: { biome: ['eis'],         abbau: 3 },
  bernstein:{ biome: ['wueste'],         abbau: 3 },
  obsidian: { biome: ['asche'],          abbau: 3 },
  kristall: { biome: ['berge', 'eis'],   abbau: 2 },
};

// Gruppen der Voxel-Tiere (games/autobattler/tiere-daten.js → TIERE[id].gruppe)
// → Standard-Biome. Einzelne Tiere dürfen in kreaturen-daten.js abweichen.
export const GRUPPE_BIOME = {
  bauernhof: ['wiese'],
  insekt:    ['wiese', 'wald'],
  wald:      ['wald'],
  wasser:    ['strand', 'ozean', 'sumpf'],
  dschungel: ['sumpf'],
  luft:      ['berge', 'wiese'],
  savanne:   ['ebene'],
  wueste:    ['wueste', 'asche'],
  polar:     ['eis', 'berge'],
};
