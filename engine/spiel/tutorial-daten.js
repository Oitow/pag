/**
 * @modul    tutorial-daten
 * @zweck    Reine Daten der Erlenwacht-Aufgabenkette (Tutorial + Hauptgeschichte) für gameplay/aufgaben: Schritte, Belohnungen, NPC-Dialoge
 * @api      AUFGABEN_DATEN ; NPC_DATEN ; ORTS_OPTIONAL
 * @beispiel
 *   import { AUFGABEN_DATEN } from '../../engine/spiel/tutorial-daten.js';
 *   const a = createAufgaben({ daten: AUFGABEN_DATEN, ... }); a.starte('erwachen');
 * @tags     spiel, tutorial, aufgaben, quest, daten, dialog
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Erweiterungen je Aufgabe: geber (NPC-Id), intro (Text-Liste im Chat). Je Schritt: sagt (Dialogzeilen bei sprich-mit), hinweis.
 * Benutze-Schritte: was = 'springen' | 'sprint' | 'kamera' | 'beute' | 'ausruesten' | 'stufe-4' | 'talent'. Besiege: ziel = Gegner-Art (ent.daten.art, Boss = 'boss'), '*' = jeder Gegner.
 */

export const NPC_DATEN = Object.freeze({
  alwe: { id: 'alwe', name: 'Alwe', ort: 'start', versatz: { x: 1.5, z: -4 }, vorlage: 'jaegerin',
    begruessung: ['Hey, du bist wach! Das Meer hat dich ausgespuckt.', 'Ich bin Alwe. Komm, ich zeige dir, wie man hier überlebt.'],
    floskeln: ['Geh nach Norden zum Waldtor, ich halte hier die Stellung.', 'Pass auf dich auf da draußen.'] },
  brandt: { id: 'brandt', name: 'Hauptmann Brandt', ort: 'siedlung', versatz: { x: 4, z: 6 }, vorlage: 'wache',
    begruessung: ['Wer da? Ah, ein Neuer. Willkommen in Erlenwacht.'],
    floskeln: ['Die Wache schläft nie. Halt die Augen offen.', 'Gut, dass du da bist.'] },
});

/** Orte, die (noch) fehlen dürfen: der Schritt läuft dann ohne Wegpunkt. */
export const ORTS_OPTIONAL = Object.freeze(['boss', 'lager-waldrand']);

export const AUFGABEN_DATEN = [
  {
    id: 'erwachen', name: 'Erwachen am Strand', geber: 'alwe', danach: 'zaehne', belohnung: { xp: 30, gegenstaende: ['heiltrank'] },
    intro: ['Alwe: Du bist wach! Das Meer hat dich ausgespuckt.'],
    schritte: [
      { id: 'laufen', art: 'gehe-zu', ort: { x: 15, z: 1843 }, radius: 4, text: 'Lauf 15 Meter nach Norden (Stick / WASD).' },
      { id: 'springen', art: 'benutze', was: 'springen', text: 'Spring einmal (Knopf ⤒ / Leertaste).' },
      { id: 'kamera', art: 'benutze', was: 'kamera', text: 'Dreh die Kamera (Wischen / Maus).' },
      { id: 'sprint', art: 'benutze', was: 'sprint', text: 'Sprinte kurz (Knopf 🏃 halten / Shift).' },
      { id: 'alwe', art: 'sprich-mit', ziel: 'alwe', text: 'Sprich mit Alwe (Knopf 💬 / E).',
        sagt: ['Na endlich, du bewegst dich wie ein Mensch.', 'Ich bin Alwe. Ich passe hier auf die Küste auf.', 'Geh zum Waldtor im Norden. Im Gebüsch hausen Ratten – zeig ihnen, was du kannst.'] },
    ],
  },
  {
    id: 'zaehne', name: 'Zähne im Gebüsch', geber: 'alwe', danach: 'waldweg', belohnung: { xp: 80, gegenstaende: ['heiltrank', 'gold'] },
    intro: ['Alwe: Das Waldtor liegt nördlich des Strands. Pass auf die Ratten auf!'],
    schritte: [
      { id: 'tor', art: 'gehe-zu', ort: 'tor', radius: 12, text: 'Geh zum Waldtor.' },
      { id: 'ratten', art: 'besiege', ziel: 'ratte', anzahl: 3, ort: 'lager-waldrand', text: 'Besiege 3 Ratten.',
        hinweis: '⚔ schlägt zu, 🌀 weicht aus, 🎯 zielt auf den nächsten Feind.' },
      { id: 'beute', art: 'benutze', was: 'beute', text: 'Hebe die Beute auf (einfach darüber laufen).' },
      { id: 'anlegen', art: 'benutze', was: 'ausruesten', text: 'Lege Ausrüstung an (☰ Menü → Inventar).', hinweis: 'Tippe einen Gegenstand an und wähle „Anlegen“.' },
    ],
  },
  {
    id: 'waldweg', name: 'Durch den Dämmerwald', geber: 'alwe', danach: 'hochland', belohnung: { xp: 150, gegenstaende: ['manatrank'] },
    intro: ['Alwe: Folge dem Weg zwischen den Riesen. Hauptmann Brandt wartet in Erlenwacht.'],
    schritte: [
      { id: 'lichtung', art: 'gehe-zu', ort: 'lichtung', radius: 25, text: 'Folge dem Weg bis zur Lichtung.' },
      { id: 'siedlung', art: 'gehe-zu', ort: 'siedlung', radius: 30, text: 'Erreiche die Siedlung Erlenwacht.' },
      { id: 'brandt', art: 'sprich-mit', ziel: 'brandt', text: 'Sprich mit Hauptmann Brandt.',
        sagt: ['Willkommen in Erlenwacht, Wanderer. Alwe hat dich angekündigt.', 'Im Hochland sammeln sich Wölfe und Keiler. Wir kommen kaum noch zu den Feldern.', 'Räum das Lager dort aus, dann reden wir weiter.'] },
    ],
  },
  {
    id: 'hochland', name: 'Das Hochland', geber: 'brandt', danach: 'moor', belohnung: { xp: 400, gegenstaende: ['heiltrank'] },
    intro: ['Brandt: Das Hochlandlager liegt östlich der Siedlung.'],
    schritte: [
      { id: 'lager', art: 'besiege', ziel: '*', anzahl: 6, ort: 'lager-hochland', text: 'Besiege 6 Gegner im Hochlandlager.' },
      { id: 'stufe', art: 'benutze', was: 'stufe-4', text: 'Erreiche Stufe 4.' },
      { id: 'talent', art: 'benutze', was: 'talent', text: 'Vergib einen Talentpunkt (☰ Menü → Talente).' },
    ],
  },
  {
    id: 'moor', name: 'Nebel über dem Moor', geber: 'brandt', danach: 'grauzahn', belohnung: { xp: 700, gegenstaende: ['heiltrank', 'ring'] },
    intro: ['Brandt: Im Westen wabern Irrlichter durch den Nebel. Sie locken Reisende in den Sumpf.'],
    schritte: [
      { id: 'irrlichter', art: 'besiege', ziel: 'irrlicht', anzahl: 5, ort: 'lager-moor', text: 'Besiege 5 Irrlichter im Moor.' },
    ],
  },
  {
    id: 'grauzahn', name: 'Grauzahn', geber: 'brandt', danach: null, belohnung: { xp: 1500, gegenstaende: ['wolfszahn'] },
    intro: ['Brandt: Grauzahn, der Wolfsfels-Alte, führt das Rudel an. Nur du kannst ihn aufhalten.'],
    schritte: [
      { id: 'boss', art: 'besiege', ziel: 'boss', ort: 'boss', optional: true, text: 'Besiege den Boss Grauzahn.', hinweis: 'Achte auf die roten Ringe am Boden.' },
    ],
  },
];
