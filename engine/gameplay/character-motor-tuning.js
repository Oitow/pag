/**
 * @modul    character-motor-tuning
 * @zweck    Standard-Tuning des Figuren-Motors (Tempo, Sprung, Rolle/Dash, Gleiten, Tauchen, Kantenschutz) – reine Daten
 * @api      MOTOR_TUNING
 * @beispiel
 *   import { MOTOR_TUNING } from '../../engine/gameplay/character-motor-tuning.js';
 *   const motor = createMotor({ welt, tuning: { ...MOTOR_TUNING, doppelSprung: 1 } });
 * @tags     figur, bewegung, tuning, gameplay
 * @version  1.1.0
 * @status   entwurf
 * @three    nein
 */

/** Standardwerte (Meter, Sekunden). Jeder Motor hat eine eigene Kopie → `setTuning`. */
export const MOTOR_TUNING = {
  gehTempo: 1.8,              // m/s bei halbem Stick-Ausschlag
  laufTempo: 5.0,             // m/s bei vollem Ausschlag
  sprintTempo: 8.0,           // m/s mit Sprint
  duckTempo: 1.6,             // Höchsttempo geduckt / schleichend
  schwimmTempo: 2.4,          // m/s schwimmend (Sprint ×1.4)
  beschleunigung: 40,         // m/s² am Boden mit Eingabe
  abbremsen: 32,              // m/s² am Boden ohne Eingabe
  luftBeschleunigung: 10,     // m/s² in der Luft (× luftKontrolle)
  wasserBeschleunigung: 12,   // m/s² schwimmend
  luftKontrolle: 1.0,         // 0 = keine Steuerung in der Luft
  drehRate: 12,               // Dämpfung der Drehung zur Laufrichtung (1/s)
  schwerkraft: 24,            // m/s²
  sprungHoehe: 1.3,           // m bei gehaltener Taste
  tiefSprungFaktor: 2.6,      // Schwerkraft-Faktor beim Steigen, wenn Taste losgelassen (variable Höhe)
  fallFaktor: 1.5,            // schwereres Fallen = knackiger
  maxFall: 40,                // m/s
  coyoteZeit: 0.13,           // s, Springen kurz nach Verlassen der Kante
  sprungPuffer: 0.15,         // s, Sprung-Druck kurz vor der Landung wird gemerkt
  stufenHoehe: 0.45,          // m, höhere Kanten blockieren wie eine Wand
  hangGrenzeGrad: 46,         // steiler → rutschen
  rutschBeschleunigung: 14,   // m/s² hangabwärts
  rutschKontrolle: 0.15,      // Anteil der Steuerung beim Rutschen
  bergaufBremse: 0.45,        // max. Tempoverlust bergauf
  wasserTiefeSchwimmen: 0.75, // schwimmen ab Wassertiefe = Anteil von hoehe
  schwimmLage: 0.68,          // Anteil von hoehe unter der Oberfläche beim Schwimmen (Kopf bleibt oben)
  auftrieb: 30,               // Federkonstante zur Schwimmlage (1/s²)
  schwimmSprungHoehe: 1.2,    // m, Sprung aus dem Wasser (Ufer erklimmen)
  stossDaempfung: 7,          // Abklingen horizontaler Stöße (1/s), im Wasser ×2
  // --- seit 1.1.0 ---
  doppelSprung: 0,            // zusätzliche Sprünge in der Luft (0 = aus, 1 = Doppelsprung …)
  doppelSprungHoehe: 1.0,     // m
  rollTempo: 9,               // m/s zu Beginn der Ausweichrolle (endet bei ×0,55)
  rollDauer: 0.45,            // s
  rollAbklingzeit: 0.6,       // s ab Start, bis wieder gerollt/gedasht werden kann
  luftDash: true,             // Absicht.rollen in der Luft = Dash (einmal je Luftphase)
  dashTempo: 11,              // m/s
  dashDauer: 0.18,            // s, ohne Schwerkraft
  gleitFallTempo: 2.0,        // m/s max. Sinkgeschwindigkeit beim Gleiten (0 = Gleiten aus)
  gleitLuftKontrolle: 1.6,    // Faktor auf luftBeschleunigung beim Gleiten
  tauchTempo: 1.6,            // m/s ab-/auftauchen (Absicht.tauchen im Wasser; 0 = aus)
  kantenSchutz: false,        // true: nie von Kanten laufen (beim Ducken/Schleichen immer an)
  kantenHoehe: 1.0,           // m, ab dieser Fallhöhe gilt eine Kante als Klippe
  betaeubtKontrolle: 0.15,    // Anteil der Steuerung, solange ein Stoß betäubt
};
