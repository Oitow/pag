/**
 * @modul    klassen-daten
 * @zweck    Die drei Erlenwacht-Klassen (Krieger/Wut, Magier/Mana, Waldläufer/Energie) mit je Fähigkeiten und Freischalt-Stufen – reine Daten
 * @api      KLASSEN ; KLASSEN_NAMEN ; KLASSEN_FAEHIGKEITEN ; FREI_STUFEN ; freigeschaltet(klasse, stufe) -> Namen[] ; neuFreigeschaltet(klasse, stufe) -> Namen[] ; ressourcenVon(klasse) -> opts.ressourcen für createLeiste
 * @beispiel
 *   import { KLASSEN, freigeschaltet } from '../../engine/gameplay/klassen-daten.js';
 *   freigeschaltet('krieger', 3);   // ['wuchtschlag', 'wirbelwind']
 * @tags     kampf, klasse, fähigkeit, daten, mmo, erlenwacht, krieger, magier, waldläufer
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Fähigkeits-Format wie gameplay/faehigkeiten-daten (name, symbol, text, ressource, kosten, abkling, gcd, wirkzeit, kanal, takte, beiBewegung, reichweite, zielArt, wirkung)
 * plus `freiStufe`. wirkung.typ: 'nahkampf' (Kegel vor dir) · 'wirbel' (360°) · 'ansturm' (Dash aufs Ziel) · 'schild' · 'beben' (Fläche um dich) ·
 * 'schuss' (Projektil) · 'gift' (Nahkampf + Schaden über Zeit) · 'salto' (zurückspringen) · 'hagel' (Pfeile auf Fläche vor dir) · 'fokus' (Buff) · 'zauber' (Magier: Name im Zauber-Modul).
 * `faktor` = Schadens-Vielfaches der Grundwaffe. Magier-Fähigkeiten stehen im Zauber-Modul (ERLENWACHT_ZAUBER); hier nur Namen + Stufe.
 * Ressourcen: Krieger Wut 0–100 (+8 je Treffer, verfällt 2/s), Waldläufer Energie 100 (+10/s), Magier Mana (verwaltet das Zauber-Modul).
 */
export const FREI_STUFEN = Object.freeze([1, 3, 5, 8, 12]);

const F = (freiStufe, o) => Object.freeze({ gcd: true, zielArt: 'selbst', abkling: 0, kosten: 0, ...o, freiStufe });

export const KLASSEN_FAEHIGKEITEN = Object.freeze({
  // --- Krieger (Wut) ---
  wuchtschlag: F(1, { name: 'Wuchtschlag', symbol: '🔨', text: 'Schwerer Hieb vor dir, wirft Feinde zurück.', ressource: 'wut', kosten: 0, abkling: 4, reichweite: 2.6,
    wirkung: { typ: 'nahkampf', faktor: 2.2, winkel: 0.9, reichweite: 2.8, stoss: 9, clip: 'hacken', wutGewinn: 12 } }),
  wirbelwind: F(3, { name: 'Wirbelwind', symbol: '🌀', text: 'Kanalisiert: Rundumschläge, 360°.', ressource: 'wut', kosten: 25, abkling: 8, kanal: 1.2, takte: 4, beiBewegung: 'erlaubt',
    wirkung: { typ: 'wirbel', faktor: 0.8, radius: 3.2, stoss: 4, clip: 'fegen' } }),
  ansturm: F(5, { name: 'Ansturm', symbol: '🐂', text: 'Stürmt aufs Ziel zu und schlägt zu.', ressource: 'wut', kosten: 0, abkling: 9, reichweite: 14,
    wirkung: { typ: 'ansturm', faktor: 1.6, strecke: 9, tempo: 26, stoss: 7, wutGewinn: 15 } }),
  kriegsschrei: F(8, { name: 'Kriegsschrei', symbol: '📣', text: 'Schild aus Wut: schluckt Schaden für kurze Zeit.', ressource: 'wut', kosten: 30, abkling: 24, gcd: false,
    wirkung: { typ: 'schild', menge: 40, dauer: 8 } }),
  erdbeben: F(12, { name: 'Erdbeben', symbol: '🌋', text: 'Bodenschlag: Fläche um dich, wirft Feinde weg.', ressource: 'wut', kosten: 60, abkling: 20, wirkzeit: 0.35,
    wirkung: { typ: 'beben', faktor: 3.0, radius: 6, stoss: 12, clip: 'haemmern' } }),
  // --- Waldläufer (Energie) ---
  gezielter_schuss: F(1, { name: 'Gezielter Schuss', symbol: '🎯', text: 'Kraftvoller Pfeil auf das Ziel.', ressource: 'energie', kosten: 25, abkling: 3, reichweite: 30,
    wirkung: { typ: 'schuss', faktor: 2.0, tempo: 38, reichweite: 32, stoss: 4, clip: 'werfen' } }),
  giftklinge: F(3, { name: 'Giftklinge', symbol: '🗡️', text: 'Stich, der vergiftet (Schaden über Zeit).', ressource: 'energie', kosten: 20, abkling: 6, reichweite: 2.4,
    wirkung: { typ: 'gift', faktor: 1.0, reichweite: 2.6, winkel: 0.7, dotFaktor: 0.4, dotDauer: 6, dotTakte: 6, stoss: 2, clip: 'stossen' } }),
  rueckwaertssalto: F(5, { name: 'Rückwärtssalto', symbol: '🤸', text: 'Springt nach hinten aus dem Getümmel.', ressource: 'energie', kosten: 15, abkling: 8, gcd: false,
    wirkung: { typ: 'salto', strecke: 7, tempo: 22 } }),
  pfeilhagel: F(8, { name: 'Pfeilhagel', symbol: '🌧️', text: 'Pfeile regnen auf eine Fläche vor dir.', ressource: 'energie', kosten: 50, abkling: 14, wirkzeit: 0.5, beiBewegung: 'erlaubt', reichweite: 22,
    wirkung: { typ: 'hagel', faktor: 0.9, radius: 4.5, takte: 3, stoss: 2, clip: 'werfen' } }),
  falkenauge: F(12, { name: 'Falkenauge', symbol: '🦅', text: 'Schärfster Blick: mehr Krit und Tempo für kurze Zeit.', ressource: 'energie', kosten: 40, abkling: 30, gcd: false,
    wirkung: { typ: 'fokus', krit: 0.3, schaden: 0.25, dauer: 10 } }),
  // --- Magier (Zauber-Namen aus ERLENWACHT_ZAUBER in modul-zauber.js; Kosten/Wirkung dort) ---
  feuerball: F(1, { name: 'Feuerball', symbol: '🔥', ressource: 'mana', wirkung: { typ: 'zauber', zauber: 'feuerball' } }),
  eislanze: F(3, { name: 'Eislanze', symbol: '❄️', ressource: 'mana', wirkung: { typ: 'zauber', zauber: 'eislanze' } }),
  wasserguss: F(3, { name: 'Wasserguss', symbol: '💧', ressource: 'mana', wirkung: { typ: 'zauber', zauber: 'wasserguss' } }),
  blitz: F(5, { name: 'Blitz', symbol: '⚡', ressource: 'mana', wirkung: { typ: 'zauber', zauber: 'blitz' } }),
  erdstachel: F(8, { name: 'Erdstachel', symbol: '🪨', ressource: 'mana', wirkung: { typ: 'zauber', zauber: 'erdstachel' } }),
  windstoss: F(8, { name: 'Windstoß', symbol: '🌬️', ressource: 'mana', wirkung: { typ: 'zauber', zauber: 'windstoss' } }),
  flutwelle: F(12, { name: 'Flutwelle', symbol: '🌊', ressource: 'mana', wirkung: { typ: 'zauber', zauber: 'flutwelle' } }),
  erdwall: F(12, { name: 'Erdwall', symbol: '🧱', ressource: 'mana', wirkung: { typ: 'zauber', zauber: 'erdwall' } }),
});

export const KLASSEN = Object.freeze({
  krieger: Object.freeze({ name: 'Krieger', symbol: '⚔️', ressource: 'wut', waffe: 'schwert', wutProTreffer: 8,
    ressourcen: Object.freeze({ wut: Object.freeze({ max: 100, regen: -2, start: 0 }) }),
    faehigkeiten: Object.freeze(['wuchtschlag', 'wirbelwind', 'ansturm', 'kriegsschrei', 'erdbeben']) }),
  waldlaeufer: Object.freeze({ name: 'Waldläufer', symbol: '🏹', ressource: 'energie', waffe: 'bogen', wutProTreffer: 0,
    ressourcen: Object.freeze({ energie: Object.freeze({ max: 100, regen: 10 }) }),
    faehigkeiten: Object.freeze(['gezielter_schuss', 'giftklinge', 'rueckwaertssalto', 'pfeilhagel', 'falkenauge']) }),
  magier: Object.freeze({ name: 'Magier', symbol: '🔮', ressource: 'mana', waffe: 'stab', wutProTreffer: 0,
    ressourcen: Object.freeze({ mana: Object.freeze({ max: 100, regen: 8 }) }),
    faehigkeiten: Object.freeze(['feuerball', 'eislanze', 'wasserguss', 'blitz', 'erdstachel', 'windstoss', 'flutwelle', 'erdwall']) }),
});
export const KLASSEN_NAMEN = Object.freeze(Object.keys(KLASSEN));

/** Namen der bei dieser Stufe freigeschalteten Fähigkeiten (in Leisten-Reihenfolge). */
export function freigeschaltet(klasse, stufe) {
  const k = KLASSEN[klasse];
  return k ? k.faehigkeiten.filter((n) => KLASSEN_FAEHIGKEITEN[n].freiStufe <= (+stufe || 1)) : [];
}
/** Genau die Fähigkeiten, die beim Sprung von `alt` auf `neu` hinzukommen. */
export function neuFreigeschaltet(klasse, stufe, alt = stufe - 1) {
  const vorher = new Set(freigeschaltet(klasse, alt));
  return freigeschaltet(klasse, stufe).filter((n) => !vorher.has(n));
}
/** Ressourcen-Tabelle für createLeiste({ ressourcen }) – nur die der Klasse (Mana beim Magier macht das Zauber-Modul). */
export function ressourcenVon(klasse) {
  const k = KLASSEN[klasse];
  return k ? Object.fromEntries(Object.entries(k.ressourcen).map(([n, r]) => [n, { ...r }])) : {};
}
