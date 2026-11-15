/**
 * @modul    faehigkeiten-daten
 * @zweck    Beispiel-Fähigkeiten (Krieger, Magier, Heiler) für die MMO-Leiste; reine Daten
 * @api      FAEHIGKEITEN ; FAEHIGKEITEN_NAMEN
 * @beispiel
 *   import { FAEHIGKEITEN } from '../../engine/gameplay/faehigkeiten-daten.js';
 *   const d = FAEHIGKEITEN.feuerball;   // { name, symbol, ressource, kosten, abkling, wirkzeit, reichweite, zielArt, wirkung }
 * @tags     kampf, fähigkeit, daten, mmo
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Felder: { name, symbol, text, rolle, ressource, kosten, abkling, gcd=true, wirkzeit, kanal, takte, beiBewegung,
 *           reichweite, zielArt ('feind'|'freund'|'selbst'), ladungen, wirkung }
 */
export const FAEHIGKEITEN = {
  // Krieger (Wut wird durch Treffer aufgebaut: leiste.gib('wut', n))
  hieb: { name: 'Hieb', symbol: '⚔️', text: 'Leichter Nahkampf-Schlag.', rolle: 'krieger', ressource: 'wut', kosten: 0, abkling: 1.5, reichweite: 3, zielArt: 'feind',
    wirkung: { typ: 'nahkampf', angriff: 'leicht', wutGewinn: 8 } },
  wirbelwind: { name: 'Wirbelwind', symbol: '🌀', text: 'Kanalisiert: Rundumschläge.', rolle: 'krieger', ressource: 'wut', kosten: 30, abkling: 8, kanal: 2, takte: 4, zielArt: 'selbst', beiBewegung: 'erlaubt',
    wirkung: { typ: 'schaden', menge: 8, art: 'koerper', radius: 3 } },
  spott: { name: 'Spott', symbol: '📢', text: 'Zwingt den Feind, dich anzugreifen.', rolle: 'krieger', ressource: 'wut', kosten: 0, abkling: 8, gcd: false, reichweite: 20, zielArt: 'feind',
    wirkung: { typ: 'spott', dauer: 3 } },
  ansturm: { name: 'Ansturm', symbol: '🐂', text: 'Stürmt auf das Ziel zu (2 Ladungen).', rolle: 'krieger', ressource: 'wut', kosten: 0, abkling: 10, ladungen: 2, reichweite: 15, zielArt: 'feind',
    wirkung: { typ: 'schaden', menge: 10, art: 'koerper', ansturm: true, wutGewinn: 15 } },
  // Magier
  feuerball: { name: 'Feuerball', symbol: '🔥', text: 'Feuergeschoss.', rolle: 'magier', ressource: 'mana', kosten: 16, abkling: 0, wirkzeit: 1.2, reichweite: 30, zielArt: 'feind',
    wirkung: { typ: 'zauber', zauber: 'feuerball' } },
  frostnova: { name: 'Frostnova', symbol: '🧊', text: 'Eisring um dich, verlangsamt Feinde.', rolle: 'magier', ressource: 'mana', kosten: 22, abkling: 10, zielArt: 'selbst',
    wirkung: { typ: 'zauber', zauber: 'frostnova' } },
  blinzeln: { name: 'Blinzeln', symbol: '✨', text: 'Kurzer Teleport, ohne globale Abklingzeit.', rolle: 'magier', ressource: 'mana', kosten: 15, abkling: 12, gcd: false, zielArt: 'selbst',
    wirkung: { typ: 'zauber', zauber: 'blinzeln' } },
  pyroschlag: { name: 'Pyroschlag', symbol: '☄️', text: 'Gewaltiger Feuerschlag mit langer Wirkzeit.', rolle: 'magier', ressource: 'mana', kosten: 45, abkling: 15, wirkzeit: 3, reichweite: 35, zielArt: 'feind',
    wirkung: { typ: 'zauber', zauber: 'meteor' } },
  // Heiler
  heilung: { name: 'Heilung', symbol: '💚', text: 'Heilt einen Verbündeten.', rolle: 'heiler', ressource: 'mana', kosten: 25, abkling: 0, wirkzeit: 1.5, reichweite: 30, zielArt: 'freund',
    wirkung: { typ: 'heilung', menge: 40 } },
  erneuerung: { name: 'Erneuerung', symbol: '🌿', text: 'Heilung über Zeit.', rolle: 'heiler', ressource: 'mana', kosten: 15, abkling: 3, reichweite: 30, zielArt: 'freund',
    wirkung: { typ: 'zustand', zustand: 'regeneration', dauer: 10 } },
  laeuterung: { name: 'Läuterung', symbol: '🕊️', text: 'Entfernt schädliche Zustände.', rolle: 'heiler', ressource: 'mana', kosten: 20, abkling: 8, wirkzeit: 0.8, reichweite: 30, zielArt: 'freund',
    wirkung: { typ: 'zustand', reinige: 'schaedlich' } },
  schutzwall: { name: 'Schutzwall', symbol: '🛡️', text: 'Erhöht die Rüstung eines Verbündeten.', rolle: 'heiler', ressource: 'mana', kosten: 20, abkling: 20, reichweite: 30, zielArt: 'freund',
    wirkung: { typ: 'zustand', zustand: 'schutz', dauer: 12 } },
};
export const FAEHIGKEITEN_NAMEN = Object.keys(FAEHIGKEITEN);
