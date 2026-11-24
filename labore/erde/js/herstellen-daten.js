// Herstellen im Erde-Labor: Rezepte, Kleidung, Anzeigenamen (reine Daten + Regeln, ohne THREE).
// Rezepte im Format von engine/gameplay/rezepte.js (definiereAlle). Gegenstands-IDs: docs/plaene/ERDE-UEBERLEBEN.md.
// Stationen kommen von dienste.bau.naheStationen → ['lagerfeuer', 'werkbank', …]. Das Engine-Rezept kennt nur EINE Station,
// darum gibt es die gedachte Station 'schmiede' = Lagerfeuer UND Werkbank nahe beieinander (siehe stationenAus).

/** Anzeigenamen der Gegenstände, die das Herstellen neu einführt oder braucht (Rest: gegenstandName aus aktionen.js). */
export const NAMEN = {
  fleisch: 'Fleisch', fell: 'Fell', knochen: 'Knochen',
  seil: 'Seil', speer: 'Speer', fackel: 'Fackel', bogen: 'Bogen', pfeil: 'Pfeil',
  fellmantel: 'Fellmantel', fellstiefel: 'Fellstiefel',
  gebratenesFleisch: 'Gebratenes Fleisch', gebratenerFisch: 'Gebratener Fisch', beerenbrei: 'Beerenbrei',
  lagerfeuer: 'Lagerfeuer', werkbank: 'Werkbank', eisenhacke: 'Eisen-Spitzhacke',
  feuerstein: 'Feuerstein', kohle: 'Kohle', eisenerz: 'Eisenerz',
};

/** Anzeigenamen der Stationen (Rezept-Feld station). */
export const STATIONEN = { lagerfeuer: 'Lagerfeuer', werkbank: 'Werkbank', schmiede: 'Lagerfeuer + Werkbank' };

/** Gruppen für die Liste im Fenster (Reihenfolge = Anzeige). */
export const GRUPPEN = [
  ['werkzeug', '🪓 Werkzeug & Waffen'],
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
  eisenhacke:    { gruppe: 'werkzeug', zutaten: { eisenerz: 3, kohle: 2, holz: 2 }, ergebnis: 'eisenhacke', station: 'schmiede' },
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

/** Stationen in der Nähe → Liste fürs Rezept, inkl. gedachter 'schmiede' (Lagerfeuer + Werkbank). */
export function stationenAus(nahe = []) {
  const s = [...new Set(nahe)];
  if (s.includes('lagerfeuer') && s.includes('werkbank')) s.push('schmiede');
  return s;
}

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
