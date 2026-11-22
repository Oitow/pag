// Spiel-Daten: zusätzliche Gegenstände, Rezepte, Ausrüstung, Nahrung, Gefahren-Texte, Quests.
// Wird von spiel.js / ui.js benutzt. Neue Items werden zur Laufzeit in DATA.ITEMS ergänzt
// (nur neue IDs, nichts wird umbenannt).
import * as DATA from './data.js';

// ---------- Zusätzliche Gegenstände ----------
export const EXTRA_ITEMS = {
  fleisch_gebraten: { name: 'Gebratenes Fleisch', icon: '🍗' },
  eintopf:          { name: 'Pilz-Eintopf',       icon: '🍲' },
  beerensaft:       { name: 'Beerensaft',         icon: '🧃' },
  lagerfeuer:       { name: 'Lagerfeuer',         icon: '🏕️' },
  fackel:           { name: 'Fackel',             icon: '🔦' },
  fellmantel:       { name: 'Fellmantel',         icon: '🧥' },
  giftmaske:        { name: 'Kräutermaske',       icon: '😷' },
  sonnenhut:        { name: 'Sonnenhut',          icon: '👒' },
  rucksack:         { name: 'Rucksack',           icon: '🎒' },
  spitzhacke:       { name: 'Kupfer-Spitzhacke',  icon: '⛏️' },
  wanderstiefel:    { name: 'Wanderstiefel',      icon: '🥾' },
};
for (const [id, it] of Object.entries(EXTRA_ITEMS)) if (!DATA.ITEMS[id]) DATA.ITEMS[id] = it;
export const ITEMS = DATA.ITEMS;

// Kurzbeschreibungen fürs Inventar
export const ITEM_TEXT = {
  holz: 'Von Bäumen. Grundstoff für fast alles.', stein: 'Von Felsen und Geröll.', faser: 'Aus Gras und Büschen.',
  beeren: 'Essbar. Heilt ein wenig.', pilz: 'Essbar, besser gekocht.', harz: 'Klebrig – aus Bäumen im Wald.',
  kupfer: 'Erz aus dem Dunkelwald.', eisen: 'Erz aus dem Sumpf. Braucht ⛏️ Abbau 1.',
  silber: 'Erz aus den Bergen. Braucht ⛏️ Abbau 2.', gold: 'Erz aus den Ebenen. Braucht ⛏️ Abbau 2.',
  kristall: 'Funkelt in Bergen und Eis. ⛏️ Abbau 2.', eiskristall: 'Aus der Eiswüste. ⛏️ Abbau 3.',
  bernstein: 'Aus der Glutwüste. ⛏️ Abbau 3.', obsidian: 'Aus den Aschelanden. ⛏️ Abbau 3.',
  glut: 'Glühender Kern.', muschel: 'Vom Strand.', fell: 'Von pelzigen Tieren.', leder: 'Von größeren Tieren.',
  feder: 'Von Vögeln.', schuppe: 'Von Reptilien und Fischen.', fleisch: 'Roh essbar, gebraten viel besser.',
  lagerfeuer: 'Platzieren: Respawn-Punkt, Wärme, Licht und Kochstelle.',
};

// Stapelgröße (Platzbedarf im Inventar)
export function stapelGroesse(id) {
  if (AUSRUESTUNG[id]) return 1;
  if (id.startsWith('kugel_')) return 30;
  if (NAHRUNG[id]) return 20;
  if (id === 'lagerfeuer') return 5;
  return 50;
}

// ---------- Ausrüstung (höchstens Stufe 1 – Tiere bleiben der Hauptweg) ----------
// slot: ein Gegenstand pro Slot. dauer: Sekunden Schutz, die nur verbrennen, solange die
// Ausrüstung gerade aktiv vor einer Gefahr schützt (0 = hält ewig).
export const SLOTS = { hand: 'Hand', kopf: 'Kopf', koerper: 'Körper', ruecken: 'Rücken', fuesse: 'Füße' };
export const AUSRUESTUNG = {
  fackel:        { slot: 'hand',    faehigkeiten: { licht: 1 },      dauer: 240, text: 'Licht 1 – schützt nachts im Dunkelwald (brennt 4 min)' },
  spitzhacke:    { slot: 'hand',    faehigkeiten: { abbau: 1 },      dauer: 0,   text: 'Abbau 1 – baut Eisenerz ab' },
  fellmantel:    { slot: 'koerper', faehigkeiten: { waerme: 1 },     dauer: 300, text: 'Wärme 1 – gegen Bergkälte (hält 5 min)' },
  giftmaske:     { slot: 'kopf',    faehigkeiten: { giftschutz: 1 }, dauer: 240, text: 'Giftschutz 1 – gegen Sumpfgift (hält 4 min)' },
  sonnenhut:     { slot: 'kopf',    faehigkeiten: { kuehlung: 1 },   dauer: 240, text: 'Kühlung 1 – gegen Wüstenhitze (hält 4 min)' },
  rucksack:      { slot: 'ruecken', faehigkeiten: { tragen: 1 },     dauer: 0,   text: 'Tragen 1 – +6 Inventarplätze' },
  wanderstiefel: { slot: 'fuesse',  faehigkeiten: { klettern: 1 },   dauer: 0,   text: 'Klettern 1 – etwas steilere Hänge' },
};

// ---------- Nahrung ----------
export const NAHRUNG = {
  beeren:           { leben: 10, ausdauer: 10 },
  pilz:             { leben: 6,  ausdauer: 0 },
  fleisch:          { leben: 8,  ausdauer: 5 },
  beerensaft:       { leben: 20, ausdauer: 60 },
  fleisch_gebraten: { leben: 35, ausdauer: 25, regen: 30 },
  eintopf:          { leben: 55, ausdauer: 40, regen: 60 },
};

// ---------- Rezepte ----------
// gruppe: Anzeige-Gruppe. station: 'feuer' = nur in der Nähe eines Lagerfeuers.
export const REZEPT_GRUPPEN = { kugel: 'Fangkugeln', ausruestung: 'Ausrüstung', nahrung: 'Nahrung', bauen: 'Bauen' };
export const REZEPTE = [
  // Fangkugeln: Rohstoffe aus dem Biom der Stufe davor (DATA.ERZE) – so führt jede Kugel ins nächste Biom.
  { id: 'kugel_holz',     n: 2, gruppe: 'kugel', zutaten: { holz: 3, faser: 1 } },
  { id: 'kugel_stein',    n: 2, gruppe: 'kugel', zutaten: { stein: 3, holz: 1, harz: 1 } },
  { id: 'kugel_kupfer',   n: 2, gruppe: 'kugel', zutaten: { kupfer: 2, harz: 1, stein: 1 } },
  { id: 'kugel_eisen',    n: 2, gruppe: 'kugel', zutaten: { eisen: 2, leder: 1, holz: 2 } },
  { id: 'kugel_silber',   n: 2, gruppe: 'kugel', zutaten: { silber: 2, kristall: 1, faser: 2 } },
  { id: 'kugel_gold',     n: 2, gruppe: 'kugel', zutaten: { gold: 2, kristall: 1, feder: 1 } },
  { id: 'kugel_obsidian', n: 2, gruppe: 'kugel', zutaten: { obsidian: 2, bernstein: 1, eiskristall: 1 } },
  // Bauen
  { id: 'lagerfeuer',     n: 1, gruppe: 'bauen', zutaten: { holz: 5, stein: 3 } },
  // Ausrüstung
  { id: 'fackel',         n: 1, gruppe: 'ausruestung', zutaten: { holz: 2, harz: 2 } },
  { id: 'rucksack',       n: 1, gruppe: 'ausruestung', zutaten: { leder: 4, faser: 6 } },
  { id: 'wanderstiefel',  n: 1, gruppe: 'ausruestung', zutaten: { leder: 3, fell: 1 } },
  { id: 'spitzhacke',     n: 1, gruppe: 'ausruestung', zutaten: { holz: 3, kupfer: 4 } },
  { id: 'giftmaske',      n: 1, gruppe: 'ausruestung', zutaten: { faser: 4, pilz: 3, harz: 1 } },
  { id: 'fellmantel',     n: 1, gruppe: 'ausruestung', zutaten: { fell: 4, leder: 2, faser: 2 } },
  { id: 'sonnenhut',      n: 1, gruppe: 'ausruestung', zutaten: { faser: 6, feder: 2 } },
  // Nahrung
  { id: 'beerensaft',       n: 1, gruppe: 'nahrung', zutaten: { beeren: 4 } },
  { id: 'fleisch_gebraten', n: 1, gruppe: 'nahrung', zutaten: { fleisch: 1 }, station: 'feuer' },
  { id: 'eintopf',          n: 1, gruppe: 'nahrung', zutaten: { pilz: 3, fleisch: 1, beeren: 2 }, station: 'feuer' },
];

// Startausrüstung einer neuen Welt
export const START_INVENTAR = { kugel_holz: 5, beeren: 6 };

// ---------- Lagerfeuer ----------
export const FEUER = { radius: 9, faehigkeiten: { waerme: 2, licht: 1 }, kochRadius: 6, max: 6 };

// ---------- Gefahren ----------
// dps = Schaden pro Sekunde, wenn die Fähigkeit ganz fehlt (anteilig bei zu niedriger Stufe).
export const GEFAHREN = {
  dunkel:  { icon: '🌑', titel: 'Dunkelheit!',     dps: 3, hilfe: 'Ein Tier mit 💡 Licht (z. B. Glühwürmchen, Eule) oder eine Fackel schützt dich.' },
  gift:    { icon: '☠️', titel: 'Sumpfgift!',      dps: 4, hilfe: 'Ein Tier mit 🧪 Giftschutz (z. B. Kröte, Salamander) schützt dich.' },
  kaelte:  { icon: '🥶', titel: 'Kälte!',          dps: 3, hilfe: 'Ein Tier mit 🔥 Wärme (Schaf, Yak, Alpaka) oder ein Fellmantel schützt dich.' },
  kaelte2: { icon: '🥶', titel: 'Eisige Kälte!',   dps: 7, hilfe: 'Du brauchst 🔥 Wärme Stufe 2 – nur ein starkes Tier (z. B. Yak, Eisbär) reicht.' },
  hitze:   { icon: '🥵', titel: 'Hitze!',          dps: 4, hilfe: 'Ein Tier mit ❄️ Kühlung (Kamel, Erdmännchen) oder ein Sonnenhut schützt dich.' },
  hitze2:  { icon: '🥵', titel: 'Glühende Hitze!', dps: 8, hilfe: 'Du brauchst ❄️ Kühlung Stufe 2 – nur ein starkes Tier hält das aus.' },
  tiefe:   { icon: '🫧', titel: 'Keine Luft!',     dps: 6, hilfe: 'Ein Tier mit 🫧 Tiefsee (Delfin, Wal) lässt dich im Ozean tauchen.' },
};
export const ATEM_SEK = 10; // so lange darf man ohne Tiefsee im Ozean schwimmen

// Welche Fähigkeit schützt gegen eine Gefahr?
export function schutzFuer(gefahr) {
  return Object.keys(DATA.FAEHIGKEITEN).find(f => DATA.FAEHIGKEITEN[f].schutz?.includes(gefahr)) || null;
}

export const BIOM_ICON = {
  ozean: '🌊', strand: '🏖️', wiese: '🌼', wald: '🌲', sumpf: '🐸', berge: '⛰️',
  ebene: '🌾', eis: '🧊', wueste: '🏜️', asche: '🌋',
};

// ---------- Quests ----------
// typ: besitz {item, n} | fangen {n, biom?} | fangenF {faehigkeit, stufe} | aktiv {n} |
//      platzieren {n} | biom {biom} | buch {n} | craften {item}
export const QUESTS = [
  { id: 'holz',      typ: 'besitz', item: 'holz', n: 5, titel: 'Sammle 5 Holz',
    hilfe: 'Schlag gegen einen Baum (Linksklick / F oder ⚔️-Knopf).', belohnung: { beeren: 3 } },
  { id: 'fang1',     typ: 'fangen', n: 1, titel: 'Fange dein erstes Tier',
    hilfe: 'Schwäche ein Tier und wirf dann eine Fangkugel (Q / Rechtsklick).', belohnung: { kugel_holz: 4 } },
  { id: 'wiese3',    typ: 'fangen', n: 3, biom: 'wiese', titel: 'Fange 3 Tiere auf der Wiese',
    hilfe: 'Fangkugeln stellst du im Craft-Menü (C) aus Holz und Faser her.', belohnung: { kugel_holz: 4, beeren: 4 } },
  { id: 'team',      typ: 'aktiv', n: 1, titel: 'Nimm einen Begleiter mit',
    hilfe: 'Öffne den Stall (T) und wähle bis zu 3 Begleiter. Ihre Fähigkeiten gelten für dich.' },
  { id: 'feuer',     typ: 'platzieren', n: 1, titel: 'Baue ein Lagerfeuer',
    hilfe: 'Craften (C): Lagerfeuer aus Holz + Stein, dann im Inventar „Platzieren“. Dort erwachst du nach dem Tod.', belohnung: { fleisch: 2 } },
  { id: 'steinkugel', typ: 'besitz', item: 'kugel_stein', n: 3, titel: 'Stelle 3 Stein-Fangkugeln her',
    hilfe: 'Tiere im Dunkelwald brauchen Kugeln ab Stufe 2. Harz gibt es von Bäumen.' },
  { id: 'licht',     typ: 'fangenF', faehigkeit: 'licht', stufe: 1, titel: 'Fange ein Tier mit 💡 Licht',
    hilfe: 'Ohne Licht ist der Dunkelwald nachts tödlich. Glühwürmchen und Eulen leuchten.', belohnung: { kugel_stein: 2 } },
  { id: 'wald',      typ: 'biom', biom: 'wald', titel: 'Betritt den Dunkelwald',
    hilfe: 'Der Dunkelwald liegt ringförmig hinter den Wiesen. Öffne die Karte mit M.' },
  { id: 'kupfer',    typ: 'besitz', item: 'kupfer', n: 4, titel: 'Baue 4 Kupfererz ab',
    hilfe: 'Kupferadern findest du im Dunkelwald.' },
  { id: 'kupferkugel', typ: 'besitz', item: 'kugel_kupfer', n: 2, titel: 'Stelle 2 Kupfer-Fangkugeln her',
    hilfe: 'Sumpf-Tiere brauchen Kugeln ab Stufe 3.' },
  { id: 'gift',      typ: 'fangenF', faehigkeit: 'giftschutz', stufe: 1, titel: 'Fange ein Tier mit 🧪 Giftschutz',
    hilfe: 'Kröten und Salamander vertragen das Sumpfgift.', belohnung: { kugel_kupfer: 2 } },
  { id: 'sumpf',     typ: 'biom', biom: 'sumpf', titel: 'Betritt den Sumpf',
    hilfe: 'Sümpfe liegen im Tiefland hinter dem Dunkelwald. Nimm den Giftschutz-Begleiter mit!' },
  { id: 'abbau',     typ: 'fangenF', faehigkeit: 'abbau', stufe: 1, titel: 'Fange ein Tier mit ⛏️ Abbau',
    hilfe: 'Maulwurf und Dachs graben Erz aus. Eine Kupfer-Spitzhacke hilft für den Anfang.' },
  { id: 'eisen',     typ: 'besitz', item: 'eisen', n: 4, titel: 'Baue 4 Eisenerz ab',
    hilfe: 'Eisen liegt im Sumpf und braucht ⛏️ Abbau 1.' },
  { id: 'waerme',    typ: 'fangenF', faehigkeit: 'waerme', stufe: 1, titel: 'Fange ein Tier mit 🔥 Wärme',
    hilfe: 'Schafe, Yaks und Alpakas wärmen dich in den Bergen.', belohnung: { kugel_eisen: 2 } },
  { id: 'berge',     typ: 'biom', biom: 'berge', titel: 'Erklimme die Berge',
    hilfe: 'Hohe Lagen sind eiskalt. Ziegen (🧗 Klettern) kommen steile Hänge hinauf.' },
  { id: 'silber',    typ: 'besitz', item: 'silber', n: 4, titel: 'Baue 4 Silbererz ab',
    hilfe: 'Silber gibt es in den Bergen – du brauchst ⛏️ Abbau 2 von einem Tier.' },
  { id: 'ebene',     typ: 'biom', biom: 'ebene', titel: 'Erreiche die Ebenen',
    hilfe: 'Weite Ebenen liegen weit hinter dem Sumpf. Ein Reittier (🐎) macht den Weg kurz.' },
  { id: 'ebene3',    typ: 'fangen', n: 3, biom: 'ebene', titel: 'Fange 3 Tiere in den Ebenen',
    hilfe: 'Tiere der Ebenen brauchen Silber-Fangkugeln (Stufe 5).', belohnung: { kugel_silber: 2 } },
  { id: 'kuehlung',  typ: 'fangenF', faehigkeit: 'kuehlung', stufe: 1, titel: 'Fange ein Tier mit ❄️ Kühlung',
    hilfe: 'Kamel und Erdmännchen halten die Hitze aus.' },
  { id: 'wueste',    typ: 'biom', biom: 'wueste', titel: 'Betritt die Glutwüste',
    hilfe: 'Die Glutwüste liegt jenseits der Ebenen.' },
  { id: 'waerme2',   typ: 'fangenF', faehigkeit: 'waerme', stufe: 2, titel: 'Fange ein Tier mit 🔥 Wärme 2',
    hilfe: 'Für die Eiswüste an den Polen reicht ein Mantel nicht mehr.' },
  { id: 'eis',       typ: 'biom', biom: 'eis', titel: 'Erreiche die Eiswüste',
    hilfe: 'Die Eiswüsten liegen an den Polkappen.', belohnung: { kugel_gold: 2 } },
  { id: 'kuehlung2', typ: 'fangenF', faehigkeit: 'kuehlung', stufe: 2, titel: 'Fange ein Tier mit ❄️ Kühlung 2',
    hilfe: 'Nur so überlebst du die Aschelande.' },
  { id: 'asche',     typ: 'biom', biom: 'asche', titel: 'Betritt die Aschelande',
    hilfe: 'Die Aschelande liegen am anderen Ende des Planeten.', belohnung: { kugel_obsidian: 2 } },
  { id: 'buch50',    typ: 'buch', n: 50, titel: 'Fange 50 verschiedene Tierarten',
    hilfe: 'Im Sammelbuch (B) siehst du, welche Arten dir noch fehlen.' },
  { id: 'buch148',   typ: 'buch', n: 148, titel: 'Vervollständige das Sammelbuch',
    hilfe: 'Jedes Lebewesen des Planeten – du bist ein Meister-Fänger!' },
];

export const TOD_VERLUST = 0.3; // Anteil der Rohstoffe, der beim Tod verloren geht
