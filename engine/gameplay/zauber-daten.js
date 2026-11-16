/**
 * @modul    zauber-daten
 * @zweck    Die Zauber-Tabelle als reine Daten: 12 wuchtige Zauber (Geschoss, Strahl, Kegel, Ort, Nova, Selbst, Teleport) mit Wirkzeit, Gewicht, Überladen, Durchschlag und Feldern (Brandboden, Sog) – gemacht für Horden
 * @api      ZAUBER ; ZAUBER_NAMEN ; LADEN
 * @beispiel
 *   import { ZAUBER, ZAUBER_NAMEN } from '../../engine/gameplay/zauber-daten.js';   // oder aus zauber.js (reicht beides durch)
 *   const def = ZAUBER.feuerball;   // def.wirkzeit = Mindest-Aufladezeit, def.gewicht = wie schwer er sich anfühlt (0 … 1)
 * @tags     zauber, magie, daten, tabelle, kampf, flächenschaden, horde, spell
 * @version  1.2.0
 * @status   entwurf
 * @three    nein
 *
 * Felder je Zauber:
 *   name, symbol, text, farbe, clip (Geste aus character-clips-zauber), mana, abkling (s)
 *   element    'feuer' | 'eis' | 'blitz' | 'arkan' | 'natur' | 'heilig' – Schadensart fürs Kampfsystem (kampf-werte ARTEN), ab 1.1.0
 *   art        'geschoss' | 'strahl' | 'kegel' | 'ort' | 'nova' | 'selbst' | 'teleport'
 *   wirkzeit   Sekunden Aufladen, bevor er die Hand verlassen kann (schwer = lang)
 *   gewicht    0 … 1: Wucht für Kamera, Rückstoß, Bremsen beim Aufladen, Treffer-Stopp (wertet das Spiel aus)
 *   schaden, radius (Fläche, 0 = nur das getroffene Ziel), stoss (m/s Wegschleudern), umwerfen, verlangsamt (s)
 *   Geschoss:  tempo, reichweite, fall (m/s² – fliegt im Bogen und schlägt am Boden ein), anzahl, suchend, durchschlag (Ziele, die es durchbohrt)
 *   Strahl:    reichweite, winkel, kette (Sprünge), kettenRadius
 *   Kegel:     reichweite, winkel (halber Öffnungswinkel)
 *   Ort:       reichweite, verzug (s zwischen Ansage und Einschlag)
 *   feld       { dauer, takt, schaden, sog (m/s zur Mitte), verlangsamt, anteil (Radius-Anteil) } – bleibt nach dem Einschlag liegen
 *   feldEnde   { schaden, radius, stoss, umwerfen } – Schluss-Schlag des Feldes (Implosion)
 *   mehr       { anzahl, kette } – Zuwachs bei voller Überladung
 *   Großzauber (art 'gross', seit 1.2.0): gross { art: 'welle'|'wand'|'sturm'|'riss', … } – Daten für gameplay/grosszauber-<art>
 */

/** Überladen: wer nach der Wirkzeit weiter hält, lädt in `zeit` s bis zum Faktor `kraft` auf (je Zauber überschreibbar: ladezeit, ueberladen). */
export const LADEN = Object.freeze({ zeit: 1.1, kraft: 1.6, radius: 0.6, stoss: 0.7 });

export const ZAUBER = Object.freeze({
  feuerball: { name: 'Feuerball', symbol: '🔥', element: 'feuer', farbe: 0xff7a2a, art: 'geschoss', clip: 'zauberWurf', mana: 16, abkling: 1.4, wirkzeit: 0.5, gewicht: 0.6,
    schaden: 34, radius: 3.2, tempo: 14, reichweite: 30, fall: 18, stoss: 8, feld: { dauer: 3, takt: 0.5, schaden: 5, anteil: 0.8 },
    text: 'Fliegt im Bogen, explodiert am Boden und lässt Feuer zurück.' },
  eislanze: { name: 'Eislanze', symbol: '❄️', element: 'eis', farbe: 0x8fd8ff, art: 'geschoss', clip: 'zauberStoss', mana: 8, abkling: 0.5, wirkzeit: 0.28, gewicht: 0.3,
    schaden: 20, radius: 0, tempo: 34, reichweite: 38, stoss: 3, verlangsamt: 3, durchschlag: 6,
    text: 'Schnell und genau. Durchbohrt bis zu sieben Gegner in einer Reihe.' },
  arkan: { name: 'Arkane Geschosse', symbol: '🔮', element: 'arkan', farbe: 0xc77dff, art: 'geschoss', clip: 'zauberWurf', mana: 14, abkling: 1.6, wirkzeit: 0.4, gewicht: 0.35,
    schaden: 12, radius: 0, tempo: 13, reichweite: 30, stoss: 2, anzahl: 3, suchend: 5, mehr: { anzahl: 3 },
    text: 'Drei Geschosse suchen ihr Ziel selbst. Überladen: sechs.' },
  blitz: { name: 'Kettenblitz', symbol: '⚡', element: 'blitz', farbe: 0xfff27a, art: 'strahl', clip: 'zauberFinger', mana: 20, abkling: 2, wirkzeit: 0.32, gewicht: 0.5,
    schaden: 24, reichweite: 22, winkel: 0.5, kette: 5, kettenRadius: 6, stoss: 3, mehr: { kette: 5 },
    text: 'Trifft sofort und springt durch die Horde.' },
  windstoss: { name: 'Druckwelle', symbol: '🌪️', element: 'natur', farbe: 0xd8f4ff, art: 'kegel', clip: 'zauberStoss', mana: 12, abkling: 2.5, wirkzeit: 0.36, gewicht: 0.55,
    schaden: 8, reichweite: 9, winkel: 0.8, stoss: 14, text: 'Schleudert alles vor dir durch die Luft.' },
  erdstachel: { name: 'Erdstachel', symbol: '🪨', element: 'natur', farbe: 0xb08a5a, art: 'ort', clip: 'zauberBoden', mana: 22, abkling: 4, wirkzeit: 0.5, gewicht: 0.7,
    schaden: 28, radius: 3, reichweite: 13, verzug: 0.2, stoss: 9, umwerfen: true, text: 'Stacheln brechen aus dem Boden und werfen alles hoch.' },
  frostnova: { name: 'Frostnova', symbol: '🧊', element: 'eis', farbe: 0xa8e8ff, art: 'nova', clip: 'zauberBoden', mana: 22, abkling: 6, wirkzeit: 0.42, gewicht: 0.65,
    schaden: 14, radius: 6, stoss: 4, verlangsamt: 4.5, text: 'Eisring um dich herum: Schaden und lange Kälte für alle, die zu nah sind.' },
  sog: { name: 'Sog', symbol: '🌀', element: 'arkan', farbe: 0x9a6aff, art: 'ort', clip: 'zauberGriff', mana: 28, abkling: 8, wirkzeit: 0.6, gewicht: 0.8,
    schaden: 0, radius: 6.5, reichweite: 15, verzug: 0.15, stoss: 0, feld: { dauer: 2.2, takt: 0.1, schaden: 0, sog: 10, anteil: 1 },
    feldEnde: { schaden: 30, radius: 3, stoss: 9, umwerfen: true }, text: 'Zieht die Horde auf einen Haufen und zerreißt ihn. Davor für Meteor & Co.' },
  meteor: { name: 'Meteor', symbol: '☄️', element: 'feuer', farbe: 0xff4a1a, art: 'ort', clip: 'zauberHimmel', mana: 45, abkling: 9, wirkzeit: 1.0, gewicht: 1,
    schaden: 80, radius: 5.5, reichweite: 18, verzug: 1.2, stoss: 13, umwerfen: true, feld: { dauer: 4, takt: 0.5, schaden: 6, anteil: 0.6 },
    text: 'Fällt nach kurzer Zeit vom Himmel. Riesiger Einschlag mit brennendem Krater.' },
  heilung: { name: 'Heilung', symbol: '💚', element: 'heilig', farbe: 0x6dff8a, art: 'selbst', clip: 'zauberSelbst', mana: 25, abkling: 6, wirkzeit: 0.45, gewicht: 0.25,
    heilt: 35, text: 'Stellt Leben wieder her.' },
  schild: { name: 'Schutzschild', symbol: '🛡️', element: 'heilig', farbe: 0x7ab8ff, art: 'selbst', clip: 'zauberSelbst', mana: 20, abkling: 10, wirkzeit: 0.35, gewicht: 0.25,
    schild: 40, dauer: 8, text: 'Fängt eine Weile Schaden ab.' },
  flutwelle: { name: 'Flutwelle', symbol: '🌊', element: 'wasser', farbe: 0x3aa8ff, art: 'gross', clip: 'zauberStoss', mana: 60, abkling: 14, wirkzeit: 1.2, gewicht: 1,
    schaden: 30, reichweite: 10, stoss: 12, umwerfen: true, gross: { art: 'welle' }, text: 'Eine haushohe Welle rollt übers Land und reißt alles mit.' },
  erdwall: { name: 'Erdwall', symbol: '🧱', element: 'natur', farbe: 0xa07a50, art: 'gross', clip: 'zauberBoden', mana: 40, abkling: 12, wirkzeit: 0.9, gewicht: 0.9,
    schaden: 25, reichweite: 14, stoss: 10, umwerfen: true, gross: { art: 'wand' }, text: 'Eine Felswand bricht aus dem Boden, schleudert Gegner hoch und sperrt den Weg.' },
  zyklon: { name: 'Zyklon', symbol: '⛈️', element: 'blitz', farbe: 0xbfe0ff, art: 'gross', clip: 'zauberHimmel', mana: 70, abkling: 18, wirkzeit: 1.4, gewicht: 1,
    schaden: 12, reichweite: 16, stoss: 8, gross: { art: 'sturm' }, text: 'Ein gewaltiger Wirbelsturm zieht über das Feld, saugt Gegner hoch und schleudert Blitze.' },
  erdriss: { name: 'Erdriss', symbol: '🌋', element: 'feuer', farbe: 0xff5a1a, art: 'gross', clip: 'zauberBoden', mana: 55, abkling: 14, wirkzeit: 1.1, gewicht: 1,
    schaden: 40, reichweite: 30, stoss: 14, umwerfen: true, gross: { art: 'riss' }, text: 'Die Erde reißt vor dir auf, Lava bricht hervor und wirft alles in die Luft.' },
  blinzeln: { name: 'Blinzeln', symbol: '✨', element: 'arkan', farbe: 0xffe0ff, art: 'teleport', clip: 'zauberSelbst', mana: 15, abkling: 3, wirkzeit: 0.2, gewicht: 0.2,
    reichweite: 9, text: 'Versetzt dich ein Stück in Blickrichtung – raus aus der Horde.' },
});
export const ZAUBER_NAMEN = Object.freeze(Object.keys(ZAUBER));
