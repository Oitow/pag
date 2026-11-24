// Tagebuch im Erde-Labor: Ziele für die ersten Stunden (reine Daten, ohne DOM/THREE).
// Format von engine/gameplay/aufgaben.js (pruefeDaten): jede Aufgabe = ein Ziel, name = Meldung bei erledigt („✔ Erstes Feuer“).
// Schritt-Arten: 'sammle' (ding, anzahl – zählt über die Tasche, höchster je gesehener Stand) oder
// 'ereignis' (was = Schlüssel aus EREIGNISSE, tagebuch.js prüft ihn alle 0,5 s nach).
// dienst (eigenes Feld): Ziel gilt erst, wenn welt.dienste[dienst] da ist – sonst „kommt noch“ und das nächste Ziel ist dran.
// Reihenfolge = Reihenfolge im Spiel; anpassen erwünscht.

/** Ereignisse, die tagebuch.js erkennt (Schlüssel → kurze Erklärung, wie). */
export const EREIGNISSE = {
  lagerfeuer: 'Lagerfeuer in der Nähe (dienste.bau.naheStationen)',
  werkbank: 'Werkbank in der Nähe (dienste.bau.naheStationen)',
  gegessen: 'gebratenes Fleisch aus der Tasche verschwunden, ohne Tod (gegessen)',
  unterDach: 'Spieler steht unter einem gebauten Dach (dienste.bau.unterDach)',
  feld: 'mindestens ein Beet (dienste.felder.beete)',
  fliegt: 'Gleiter-Flug (dienste.gleiter.fliegt; ohne Dienst reicht der Gleiter in der Tasche)',
};

/** Gegenstände, die parallel entstehende Module einführen (noch nicht in herstellen-daten NAMEN). Ziel bleibt bis dahin „kommt noch“. */
export const SPAETER = ['gleiter', 'eisenbarren'];

export const ZIELE = [
  { id: 'sammeln', name: 'Erste Vorräte', schritte: [
    { id: 'stoecke', art: 'sammle', ding: 'stoecke', anzahl: 4, text: 'Sammle Stöcke', hinweis: 'Büsche mit „Nehmen“ abernten' },
    { id: 'steine', art: 'sammle', ding: 'steine', anzahl: 6, text: 'Sammle Steine', hinweis: 'Geröll aufheben oder in steinigem Boden graben' },
  ] },
  { id: 'holz', name: 'Erster Baum', schritte: [
    { id: 'holz', art: 'sammle', ding: 'holz', anzahl: 3, text: 'Fälle einen Baum', hinweis: 'Mit der Axt: auf einen Baum zielen, „Nehmen“' },
  ] },
  { id: 'feuer', name: 'Erstes Feuer', schritte: [
    { id: 'feuer', art: 'ereignis', was: 'lagerfeuer', text: 'Baue ein Lagerfeuer', hinweis: '🔨 Bauen → Lagerfeuer (5 Steine, 3 Holz)' },
  ] },
  { id: 'speer', name: 'Erste Waffe', schritte: [
    { id: 'speer', art: 'sammle', ding: 'speer', text: 'Stelle einen Speer her', hinweis: '🧰 Herstellen: Seil aus 3 Fasern, dann Speer aus Stöcken, Stein und Seil' },
  ] },
  { id: 'jagd', name: 'Erste Jagd', schritte: [
    { id: 'fleisch', art: 'sammle', ding: 'fleisch', text: 'Erlege ein Tier', hinweis: 'Hasen und Rehe fliehen – anschleichen, „Nehmen“ schlägt zu' },
  ] },
  { id: 'braten', name: 'Warme Mahlzeit', schritte: [
    { id: 'braten', art: 'sammle', ding: 'gebratenesFleisch', text: 'Brate Fleisch', hinweis: 'Am Lagerfeuer: 🧰 Herstellen → Gebratenes Fleisch' },
    { id: 'essen', art: 'ereignis', was: 'gegessen', text: 'Iss das Fleisch', hinweis: '🍖 Essen (wenn du Hunger hast)' },
  ] },
  { id: 'werkbank', name: 'Eigene Werkstatt', schritte: [
    { id: 'werkbank', art: 'ereignis', was: 'werkbank', text: 'Baue eine Werkbank', hinweis: '🔨 Bauen → Werkbank (6 Holz, 2 Steine)' },
  ] },
  { id: 'unterschlupf', name: 'Ein Dach über dem Kopf', schritte: [
    { id: 'dach', art: 'ereignis', was: 'unterDach', text: 'Baue einen Unterschlupf', hinweis: 'Fundament, Wände und Dach bauen – dann darunter stellen' },
  ] },
  { id: 'feld', name: 'Erstes Feld', dienst: 'felder', schritte: [
    { id: 'beet', art: 'ereignis', was: 'feld', text: 'Lege ein Feld an', hinweis: 'Fruchtbaren Boden umgraben und säen' },
  ] },
  { id: 'gleiter', name: 'Abheben', dienst: 'gleiter', schritte: [
    { id: 'bauen', art: 'sammle', ding: 'gleiter', text: 'Stelle einen Gleiter her', hinweis: 'An der Werkbank' },
    { id: 'flug', art: 'ereignis', was: 'fliegt', text: 'Fliege mit dem Gleiter', hinweis: 'Von einem Hügel springen' },
  ] },
  { id: 'eisen', name: 'Eisenzeit', schritte: [
    { id: 'barren', art: 'sammle', ding: 'eisenbarren', text: 'Schmelze Eisen', hinweis: 'Eisenerz und Kohle in den Schmelzofen' },
  ] },
];

/** Gegenstände, die die Ziele verlangen (für Test und Verfügbarkeit). */
export const verlangteDinge = (ziele = ZIELE) => [...new Set(ziele.flatMap((z) => z.schritte.filter((s) => s.art === 'sammle').map((s) => s.ding)))];

/**
 * Welches Ziel ist dran? fertig(id) → bool, verfuegbar(ziel) → bool. → erstes nicht erledigtes, verfügbares Ziel oder null.
 * Nicht verfügbare (Modul fehlt noch) werden übersprungen, bleiben aber offen und kommen dran, sobald es sie gibt.
 */
export function naechstesZiel(ziele, fertig, verfuegbar) {
  for (const z of ziele) if (!fertig(z.id) && verfuegbar(z)) return z;
  return null;
}

/** Entdeckung am Ort: p = planet.probe-Ergebnis, biomName = Name des Bioms dort. → { id, text } oder null */
export function entdeckungBei(p, biomName) {
  if (!p) return null;
  if (p.vulkan > 0.5) return { id: 'vulkan', text: 'Vulkan' };
  if (p.wasser > p.h + 0.05) return p.meer ? { id: 'meer', text: 'Meer' } : null;
  return biomName ? { id: 'biom:' + biomName, text: biomName } : null;
}
