/**
 * Plan-Daten der Enklave (Meter, Welt-Koordinaten, Ursprung Kartenmitte): Tal der Ersten Schritte, Pfad, ummauerte Stadt.
 * Format und Bedeutung: docs/WELT-ENKLAVE.md §2 · Auswertung: engine/world/welt-plan.js
 */
const TAL = { x: -175, z: 150 }, ENK = { x: 150, z: -137 };
const DREH = Math.atan2(TAL.x - ENK.x, TAL.z - ENK.z);     // Enklave lokal +z zeigt zum Tal

export const ENKLAVE_PLAN = {
  zonen: [
    // Gelände zuerst glätten (Reihenfolge zählt): der Mittelhügel (sonst 40 m hoch) und der Grat am Tal-Ausgang würden jeden Pfad > 14 % Gefälle zwingen
    { id: 'huegel', art: 'eben', x: -25, z: 25, radius: 55, hoehe: 15, rand: 45 },
    { id: 'rampe', art: 'eben', x: -75, z: 125, radius: 30, hoehe: 11, rand: 30 },
    { id: 'tal', art: 'mulde', ...TAL, radius: 55, tiefe: 5, frei: 0.75 },
    { id: 'enklave', art: 'plateau', ...ENK, radius: 46, anheben: 6, rand: 22, drehung: DREH },
    { id: 'aussicht', art: 'kuppe', x: 5, z: -19, radius: 9, anheben: 2.5 },
    { id: 'sichtachse', art: 'frei', streifen: [[5, -19], [125, -115]], breite: 18 },
  ],
  gewaesser: [
    { id: 'fluss', punkte: [[0, -60], [10, -85], [18, -110], [10, -135], [3, -160], [-12, -180], [-2, -202], [3, -227], [-5, -250]], breite: 6, tiefe: 1.5 },
    { id: 'bach', punkte: [[-153, 75], [-153, 125], [-154, 175], [-148, 250], [-138, 305]], breite: 2, tiefe: 0.5 },
  ],
  pfade: [
    { id: 'hauptweg', von: 'tal', nach: 'enklave', punkte: [[-120, 135], [-120, 102], [-98, 88], [-67, 83], [-52, 64], [-48, 35], [-32, 17], [-4, 6], [5, -19], [-13, -47], [-22, -72], [0, -98], [32, -93], [52, -88], [71, -94], [103.6, -96], [118.5, -109.2]] },
  ],
  ringe: [{ id: 'mauer', zone: 'enklave', radius: 36, ecken: 8, tor: 0 }],
  // Plätze: lokal zur Zone (lx, lz, winkel); bx/bz = halbe Grundfläche, radius = runde Fläche; ebnen = bx ≥ 1.5 (Standard)
  plaetze: [
    // Tal der Ersten Schritte (Station-Orte siehe tutorial-daten.js)
    { id: 'lagerfeuer', art: 'lagerfeuer', zone: 'tal', lx: 0, lz: 0, radius: 0.9 },
    { id: 'zelt', art: 'zelt', zone: 'tal', lx: -9, lz: -7, bx: 1.5, bz: 1.5 },
    { id: 'steinkreis', art: 'steinkreis', zone: 'tal', lx: 12, lz: -8, radius: 2 },
    { id: 'stamm', art: 'stamm', zone: 'tal', lx: 22, lz: 8, bx: 3, bz: 0.4, ebnen: false },
    { id: 'puppe', art: 'puppe', zone: 'tal', lx: 38, lz: 12, radius: 0.8 },
    { id: 'zielscheibe', art: 'zielscheibe', zone: 'tal', lx: 44, lz: 18, radius: 0.7 },
    { id: 'wegweiser-tal', art: 'wegweiser', zone: 'tal', lx: 55, lz: -15, radius: 0.4 },
    // Enklave (lokal: +z zeigt zum Tal, Tor an +z)
    { id: 'strasse', art: 'strasse', zone: 'enklave', lx: 0, lz: 18, bx: 2, bz: 15, boden: 'weg' },
    { id: 'torweg', art: 'strasse', zone: 'enklave', lx: 0, lz: 38, bx: 2, bz: 5, boden: 'weg' },
    { id: 'markt', art: 'markt-platz', zone: 'enklave', lx: 0, lz: 2, radius: 9, boden: 'weg' },
    { id: 'brunnen', art: 'brunnen', zone: 'enklave', lx: 0, lz: 2, radius: 1.3 },
    { id: 'stand-1', art: 'marktstand', variante: 0, zone: 'enklave', lx: -7, lz: 6, winkel: Math.PI / 2, bx: 1.5, bz: 1 },
    { id: 'stand-2', art: 'marktstand', variante: 1, zone: 'enklave', lx: 7, lz: 6, winkel: -Math.PI / 2, bx: 1.5, bz: 1 },
    { id: 'stand-3', art: 'marktstand', variante: 2, zone: 'enklave', lx: -7, lz: -3, winkel: Math.PI / 2, bx: 1.5, bz: 1 },
    { id: 'stand-4', art: 'marktstand', variante: 3, zone: 'enklave', lx: 7, lz: -3, winkel: -Math.PI / 2, bx: 1.5, bz: 1 },
    { id: 'taverne', art: 'taverne', zone: 'enklave', lx: -12, lz: 17, winkel: Math.PI / 2, bx: 5, bz: 4 },
    { id: 'schmiede', art: 'schmiede', zone: 'enklave', lx: 12, lz: 17, winkel: -Math.PI / 2, bx: 3.5, bz: 3 },
    { id: 'tempel', art: 'tempel', zone: 'enklave', lx: 0, lz: -22, bx: 5, bz: 6 },
    { id: 'wachturm', art: 'wachturm', zone: 'enklave', lx: -23, lz: -9, winkel: 1.2, radius: 2.25 },
    { id: 'haus-1', art: 'haus', variante: 0, zone: 'enklave', lx: -21, lz: 4, winkel: Math.PI / 2, bx: 3, bz: 2.5 },
    { id: 'haus-2', art: 'haus', variante: 1, zone: 'enklave', lx: 21, lz: 4, winkel: -Math.PI / 2, bx: 3.5, bz: 3 },
    { id: 'haus-3', art: 'haus', variante: 1, zone: 'enklave', lx: -15, lz: -15, winkel: 0.79, bx: 3.5, bz: 3 },
    { id: 'haus-4', art: 'haus', variante: 0, zone: 'enklave', lx: 15, lz: -15, winkel: -0.79, bx: 3, bz: 2.5 },
    { id: 'haus-5', art: 'haus', variante: 0, zone: 'enklave', lx: 24, lz: -8, winkel: -1.25, bx: 3, bz: 2.5 },
  ],
  spawn: { x: -178, z: 152, yaw: 2.16 },           // Tal lokal (−3, 2), Blick zum Lagerfeuer
};
