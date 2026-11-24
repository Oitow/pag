// Herstellen im Erde-Labor: Rezepte, Kleidung, Anzeigenamen (reine Daten + Regeln, ohne THREE).
// Rezepte im Format von engine/gameplay/rezepte.js (definiereAlle). Gegenstands-IDs: docs/plaene/ERDE-UEBERLEBEN.md.
// Stationen kommen von dienste.bau.naheStationen → ['lagerfeuer', 'werkbank', 'schmelzofen', 'amboss', …]. Das Engine-Rezept kennt
// nur EINE Station, darum gibt es die gedachte Station 'schmiede' = Werkbank UND Amboss nahe beieinander (siehe stationenAus).
// Fortschritt (Valheim-artig): Stein → Kupfer → Eisen. Werkzeug-Stufen (HACKE, AXT, FUND_STUFE) stehen unten, aktionen.js nutzt sie.

/** Anzeigenamen der Gegenstände, die das Herstellen neu einführt oder braucht (Rest: gegenstandName aus aktionen.js). */
export const NAMEN = {
  fleisch: 'Fleisch', fell: 'Fell', knochen: 'Knochen',
  seil: 'Seil', speer: 'Speer', fackel: 'Fackel', bogen: 'Bogen', pfeil: 'Pfeil',
  fellmantel: 'Fellmantel', fellstiefel: 'Fellstiefel',
  gebratenesFleisch: 'Gebratenes Fleisch', gebratenerFisch: 'Gebratener Fisch', beerenbrei: 'Beerenbrei',
  lagerfeuer: 'Lagerfeuer', werkbank: 'Werkbank', eisenhacke: 'Eisen-Spitzhacke',
  feuerstein: 'Feuerstein', kohle: 'Kohle', eisenerz: 'Eisenerz', kupfererz: 'Kupfererz', gold: 'Gold',
  // Fortschritt Stein → Kupfer → Eisen
  holzkohle: 'Holzkohle', kupferbarren: 'Kupferbarren', eisenbarren: 'Eisenbarren', naegel: 'Nägel',
  kupferaxt: 'Kupfer-Axt', kupferhacke: 'Kupfer-Spitzhacke', eisenaxt: 'Eisen-Axt', eisenspeer: 'Eisenspeer',
  schmelzofen: 'Schmelzofen', amboss: 'Amboss', eisentuer: 'Verstärkte Tür',
};

/** Anzeigenamen der Stationen (Rezept-Feld station). */
export const STATIONEN = { lagerfeuer: 'Lagerfeuer', werkbank: 'Werkbank', schmelzofen: 'Schmelzofen', amboss: 'Amboss',
  schmiede: 'Werkbank + Amboss' };

/** Gruppen für die Liste im Fenster (Reihenfolge = Anzeige). */
export const GRUPPEN = [
  ['werkzeug', '🪓 Werkzeug & Waffen'],
  ['metall', '🔥 Schmelzen & Schmieden'],
  ['kleidung', '🧥 Kleidung'],
  ['essen', '🍖 Essen'],
];

// gruppe ist eigene Angabe fürs Fenster; rezepte.js übernimmt nur zutaten/ergebnis/station/name.
export const REZEPTE = {
  seil:          { gruppe: 'werkzeug', zutaten: { fasern: 3 }, ergebnis: 'seil' },
  speer:         { gruppe: 'werkzeug', zutaten: { stoecke: 2, feuerstein: 1 }, ergebnis: 'speer' },
  speerSeil:     { gruppe: 'werkzeug', name: 'Speer (Steinspitze)', zutaten: { stoecke: 2, steine: 1, seil: 1 }, ergebnis: 'speer' },
  fackel:        { gruppe: 'werkzeug', zutaten: { stoecke: 1, fasern: 2 }, ergebnis: { id: 'fackel', anzahl: 2 } },
  bogen:         { gruppe: 'werkzeug', zutaten: { ruten: 3, seil: 1 }, ergebnis: 'bogen', station: 'werkbank' },
  bogenHolz:     { gruppe: 'werkzeug', name: 'Bogen (aus Holz)', zutaten: { holz: 2, seil: 1 }, ergebnis: 'bogen', station: 'werkbank' },
  pfeil:         { gruppe: 'werkzeug', zutaten: { stoecke: 2, feuerstein: 1 }, ergebnis: { id: 'pfeil', anzahl: 5 } },
  // Metall-Werkzeug: Barren am Amboss, Stiel an der Werkbank → 'schmiede' (Werkbank + Amboss)
  kupferaxt:     { gruppe: 'werkzeug', zutaten: { kupferbarren: 2, holz: 2 }, ergebnis: 'kupferaxt', station: 'schmiede' },
  kupferhacke:   { gruppe: 'werkzeug', zutaten: { kupferbarren: 3, holz: 2 }, ergebnis: 'kupferhacke', station: 'schmiede' },
  eisenaxt:      { gruppe: 'werkzeug', zutaten: { eisenbarren: 2, holz: 2 }, ergebnis: 'eisenaxt', station: 'schmiede' },
  eisenhacke:    { gruppe: 'werkzeug', zutaten: { eisenbarren: 3, holz: 2 }, ergebnis: 'eisenhacke', station: 'schmiede' },
  eisenspeer:    { gruppe: 'werkzeug', zutaten: { eisenbarren: 1, stoecke: 2 }, ergebnis: 'eisenspeer', station: 'schmiede' },
  // Schmelzen: Holzkohle am Feuer (Ofen ergiebiger), Erz + Brennstoff im Schmelzofen, Nägel am Amboss
  holzkohle:     { gruppe: 'metall', zutaten: { holz: 3 }, ergebnis: 'holzkohle', station: 'lagerfeuer' },
  holzkohleOfen: { gruppe: 'metall', name: 'Holzkohle (Ofen)', zutaten: { holz: 3 }, ergebnis: { id: 'holzkohle', anzahl: 2 }, station: 'schmelzofen' },
  kupferbarren:  { gruppe: 'metall', zutaten: { kupfererz: 2, holzkohle: 1 }, ergebnis: 'kupferbarren', station: 'schmelzofen' },
  kupferbarrenKohle: { gruppe: 'metall', name: 'Kupferbarren (Steinkohle)', zutaten: { kupfererz: 2, kohle: 1 }, ergebnis: 'kupferbarren', station: 'schmelzofen' },
  eisenbarren:   { gruppe: 'metall', zutaten: { eisenerz: 2, holzkohle: 2 }, ergebnis: 'eisenbarren', station: 'schmelzofen' },
  eisenbarrenKohle: { gruppe: 'metall', name: 'Eisenbarren (Steinkohle)', zutaten: { eisenerz: 2, kohle: 2 }, ergebnis: 'eisenbarren', station: 'schmelzofen' },
  naegel:        { gruppe: 'metall', zutaten: { eisenbarren: 1 }, ergebnis: { id: 'naegel', anzahl: 10 }, station: 'amboss' },
  fellmantel:    { gruppe: 'kleidung', zutaten: { fell: 3, seil: 1 }, ergebnis: 'fellmantel', station: 'werkbank' },
  fellstiefel:   { gruppe: 'kleidung', zutaten: { fell: 2 }, ergebnis: 'fellstiefel' },
  gebratenesFleisch: { gruppe: 'essen', zutaten: { fleisch: 1 }, ergebnis: 'gebratenesFleisch', station: 'lagerfeuer' },
  gebratenerFisch:   { gruppe: 'essen', zutaten: { fisch: 1 }, ergebnis: 'gebratenerFisch', station: 'lagerfeuer' },
  beerenbrei:    { gruppe: 'essen', zutaten: { beeren: 3, pilz: 1 }, ergebnis: 'beerenbrei', station: 'lagerfeuer' },
  beerenbreiSteinpilz: { gruppe: 'essen', name: 'Beerenbrei (Steinpilz)', zutaten: { beeren: 3, steinpilz: 1 }, ergebnis: 'beerenbrei', station: 'lagerfeuer' },
};

/** Rohstoffe = alle Zutaten, die man nicht selbst herstellt (für den Testschalter ?tasche=voll). */
export function rohstoffe(rezepte = REZEPTE) {
  const her = new Set(Object.values(rezepte).map((r) => (typeof r.ergebnis === 'string' ? r.ergebnis : r.ergebnis.id)));
  const z = new Set();
  for (const r of Object.values(rezepte)) for (const id of Object.keys(r.zutaten)) if (!her.has(id)) z.add(id);
  return [...z];
}

/** Stationen in der Nähe → Liste fürs Rezept, inkl. gedachter 'schmiede' (Werkbank + Amboss). */
export function stationenAus(nahe = []) {
  const s = [...new Set(nahe)];
  if (s.includes('amboss') && s.includes('werkbank')) s.push('schmiede');
  return s;
}

/** Zwischenprodukte = was man herstellt UND wieder verarbeitet (Holzkohle, Barren, Seil …) – für Testschalter wie ?schmiedetest=1. */
export function zwischenprodukte(rezepte = REZEPTE) {
  const roh = new Set(rohstoffe(rezepte)), z = new Set();
  for (const r of Object.values(rezepte)) for (const id of Object.keys(r.zutaten)) if (!roh.has(id)) z.add(id);
  return [...z];
}

// ---------- Werkzeug-Stufen (Fortschritt Stein → Kupfer → Eisen) ----------
/** Spitzhacken-Stufe = Härte, die man schafft (boden.js STOFFE.haerte: 0 Hände, 1 Schaufel, 2 Gestein, 3 Granit/Basalt). */
export const HACKE = { schaufel: 1, spitzhacke: 2, kupferhacke: 3, eisenhacke: 4 };
/** Axt-Stufe: 1 Stein-Axt, 2 Kupfer, 3 Eisen (mehr Holz je Baum, siehe ernte.js). */
export const AXT = { axt: 1, kupferaxt: 2, eisenaxt: 3 };
/** Funde beim Graben, die eine bessere Spitzhacke brauchen (sonst bleiben sie im Fels): Eisenerz ab Kupfer, Gold ab Eisen. */
export const FUND_STUFE = { eisenerz: 3, gold: 4 };
const HACKE_NAME = ['Hände', 'Schaufel', 'Spitzhacke', 'Kupfer-Spitzhacke', 'Eisen-Spitzhacke'];
/** Name des Werkzeugs, das Stufe n schafft. */
export const hackeName = (n) => HACKE_NAME[Math.max(0, Math.min(4, n))];
/** Höchste Stufe aus einer Tabelle (HACKE/AXT), hat(id) → bool. */
export const stufe = (tabelle, hat) => Object.entries(tabelle).reduce((m, [id, n]) => (n > m && hat(id) ? n : m), 0);

/** Kleidung: Wärme in °C, Platz am Körper (je Platz nur ein Stück). */
export const KLEIDUNG = {
  fellmantel:  { waerme: 8, platz: 'koerper' },
  fellstiefel: { waerme: 3, platz: 'fuesse' },
};

/** Was zählt wirklich? Nur bekannte Kleidung, die noch in der Tasche ist, je Platz ein Stück. hat(id) → bool */
export function getragen(liste, hat) {
  const plaetze = new Set(), aus = [];
  for (const id of liste) {
    const k = KLEIDUNG[id];
    if (!k || plaetze.has(k.platz) || !hat(id)) continue;
    plaetze.add(k.platz); aus.push(id);
  }
  return aus;
}

/** Wärme der getragenen Kleidung in °C. */
export const kleidungWaerme = (liste, hat) => getragen(liste, hat).reduce((s, id) => s + KLEIDUNG[id].waerme, 0);
