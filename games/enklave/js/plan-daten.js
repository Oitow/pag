/**
 * Plan-Daten der Enklave (Meter, Welt-Koordinaten, Ursprung Kartenmitte): Tal der Ersten Schritte, Pfad, ummauerte Stadt.
 * Format und Bedeutung: docs/WELT-ENKLAVE.md §2 · Auswertung: engine/world/welt-plan.js
 */
const TAL = { x: -175, z: 150 }, ENK = { x: 150, z: -137 };
const DREH = Math.atan2(TAL.x - ENK.x, TAL.z - ENK.z);     // Enklave lokal +z zeigt zum Tal

export const ENKLAVE_PLAN = {
  zonen: [
    { id: 'tal', art: 'mulde', ...TAL, radius: 55, tiefe: 5, frei: 0.75 },
    { id: 'enklave', art: 'plateau', ...ENK, radius: 46, anheben: 6, rand: 22, drehung: DREH },
    { id: 'aussicht', art: 'kuppe', x: 60, z: -20, radius: 9, anheben: 4 },
    { id: 'sichtachse', art: 'frei', streifen: [[60, -20], [125, -115]], breite: 18 },
  ],
  gewaesser: [
    { id: 'fluss', punkte: [[-50, -250], [-19, -125], [0, 0], [-6, 137], [31, 300]], breite: 6, tiefe: 1.5 },
    { id: 'bach', punkte: [[-153, 75], [-153, 125], [-154, 175], [-148, 250], [-138, 305]], breite: 2, tiefe: 0.5 },
  ],
  pfade: [
    { id: 'hauptweg', von: 'tal', nach: 'enklave', punkte: [[-120, 135], [-95, 105], [-75, 70], [-50, 40], [-25, 15], [22, -8], [60, -20], [90, -50], [105, -80], [118.5, -109.2]] },
  ],
  ringe: [{ id: 'mauer', zone: 'enklave', radius: 36, ecken: 8, tor: 0 }],
  plaetze: [],
  spawn: { x: -178, z: 152, yaw: 1.0 },
};
