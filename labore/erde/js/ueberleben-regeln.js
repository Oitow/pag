// Überleben im Erde-Labor – reine Regeln (ohne THREE): Leben, Hunger, Durst, Körperwärme, Essen, Tod.
// Zeitbasis sind Spielstunden (dh). Werte: leben 0…LEBEN_MAX, satt/wasser/waerme 0…1 (1 = gut), nass 0…1.
// ueberleben.js holt die Umwelt aus der Welt (Temperatur, Wetter, Feuer, Dach) und ruft schritt() je Bild.

export const LEBEN_MAX = 100;
export const HUNGER_STUNDEN = 48;   // satt → leer in ~2 Spieltagen
export const DURST_STUNDEN = 24;    // getrunken → leer in ~1 Spieltag
export const KOMFORT = 12;          // ab dieser gefühlten Temperatur (°C) kühlt der Körper nicht aus
export const HITZE = 34;            // darüber doppelter Durst
export { WERKZEUGE } from './herstellen-daten.js';
import { WERKZEUGE } from './herstellen-daten.js';

// Essen: satt/wasser = Anteil (0…1) der Leiste, heil = Lebenspunkte, risiko = Wahrscheinlichkeit, dass einem übel wird
export const ESSEN = {
  beeren:            { name: 'Beeren',            satt: 0.06, wasser: 0.03, heil: 1 },
  pilz:              { name: 'Pilz',              satt: 0.07, wasser: 0,    heil: 0, risiko: 0.1 },
  steinpilz:         { name: 'Steinpilz',         satt: 0.12, wasser: 0,    heil: 2 },
  oliven:            { name: 'Oliven',            satt: 0.08, wasser: 0,    heil: 1 },
  kokosnuss:         { name: 'Kokosnuss',         satt: 0.12, wasser: 0.25, heil: 2 },
  kaktusfleisch:     { name: 'Kaktusfleisch',     satt: 0.06, wasser: 0.2,  heil: 0 },
  fisch:             { name: 'roher Fisch',       satt: 0.15, wasser: 0,    heil: 0, risiko: 0.15 },
  fleisch:           { name: 'rohes Fleisch',     satt: 0.1,  wasser: 0,    heil: 0, risiko: 0.35 },
  kartoffel:         { name: 'rohe Kartoffel',    satt: 0.08, wasser: 0.02, heil: 0, risiko: 0.2 },
  mais:              { name: 'Maiskolben',        satt: 0.1,  wasser: 0,    heil: 0 },
  gebackeneKartoffel:{ name: 'gebackene Kartoffel', satt: 0.3, wasser: 0,   heil: 5 },
  geroesteterMais:   { name: 'gerösteter Mais',   satt: 0.25, wasser: 0,    heil: 4 },
  brot:              { name: 'Brot',              satt: 0.4,  wasser: 0,    heil: 8 },
  reisbrei:          { name: 'Reisbrei',          satt: 0.35, wasser: 0.05, heil: 6 },
  hirsebrei:         { name: 'Hirsebrei',         satt: 0.3,  wasser: 0.05, heil: 6 },
  beerenbrei:        { name: 'Beerenbrei',        satt: 0.25, wasser: 0.1,  heil: 6 },
  gebratenerFisch:   { name: 'gebratener Fisch',  satt: 0.35, wasser: 0,    heil: 8 },
  gebratenesFleisch: { name: 'gebratenes Fleisch', satt: 0.45, wasser: 0,   heil: 12 },
};

const klemme = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

export function neuerZustand(start = {}) {
  return {
    leben: klemme(start.leben ?? LEBEN_MAX, 0, LEBEN_MAX),
    satt: klemme(start.satt ?? 0.8), wasser: klemme(start.wasser ?? 0.8),
    waerme: klemme(start.waerme ?? 1), nass: klemme(start.nass ?? 0),
    tGefuehlt: start.tGefuehlt ?? 15,
  };
}

/**
 * Gefühlte Temperatur (°C) aus der Umwelt:
 * { luft, wind 0…1, regen 0…1, schnee 0…1, nass 0…1, kleidung °C, feuer °C, dach bool }
 */
export function gefuehlteTemp({ luft = 15, wind = 0, regen = 0, schnee = 0, nass = 0, kleidung = 0, feuer = 0, dach = false } = {}) {
  const w = dach ? wind * 0.2 : wind;
  let t = luft - 9 * w * (luft < 25 ? 1 : 0.3);            // Windkühle (bei Hitze kaum)
  if (!dach) t -= 4 * regen + 3 * schnee;
  t -= 8 * nass;                                            // nasse Kleidung
  return t + kleidung + feuer;
}

/**
 * Ein Zeitschritt. z = Zustand (wird verändert), dh = Spielstunden,
 * u = { tGefuehlt, schwimmt, regen (ohne Dach, 0…1), feuer °C }. → Liste der Gründe, warum Leben sank.
 */
export function schritt(z, dh, u = {}) {
  if (!(dh > 0)) return [];
  const t = u.tGefuehlt ?? 15;
  z.tGefuehlt = t;
  // Nässe: im Wasser sofort nass, Regen macht langsam nass, trocknet in ~1,5 h (am Feuer schneller)
  if (u.schwimmt) z.nass = 1;
  else z.nass = klemme(z.nass + (u.regen || 0) * dh * 0.8 - dh / 1.5 * (1 + Math.max(0, u.feuer || 0) / 10));
  // Hunger und Durst
  z.satt = klemme(z.satt - dh / HUNGER_STUNDEN);
  z.wasser = klemme(z.wasser - dh / DURST_STUNDEN * (t > HITZE ? 2 : 1));
  // Körperwärme: unter KOMFORT kühlt man aus (0 °C: ~3 h, −20 °C: ~1 h), darüber wärmt man sich wieder auf
  if (t < KOMFORT) z.waerme = klemme(z.waerme - dh * (KOMFORT - t) / 36);
  else z.waerme = klemme(z.waerme + dh * Math.min(3, Math.max(0.3, (t - KOMFORT) / 8)));
  // Leben
  const gruende = [];
  let d = 0;
  if (z.satt <= 0) { d += 8; gruende.push('Hunger'); }
  if (z.wasser <= 0) { d += 14; gruende.push('Durst'); }
  if (z.waerme <= 0) { d += 30 + Math.max(0, -t) * 1.5; gruende.push('Kälte'); }
  if (d > 0) z.leben = klemme(z.leben - d * dh, 0, LEBEN_MAX);
  else if (z.satt > 0.3 && z.wasser > 0.3 && z.waerme > 0.5) z.leben = klemme(z.leben + 6 * dh, 0, LEBEN_MAX);
  return gruende;
}

/** Wie gut passt dieses Essen gerade? (höher = besser; ≤ 0 = lieber nicht) */
function wert(z, id) {
  const e = ESSEN[id];
  const satt = Math.min(e.satt, 1 - z.satt), wasser = Math.min(e.wasser, 1 - z.wasser);
  const heil = Math.min(e.heil, LEBEN_MAX - z.leben) / LEBEN_MAX;
  return satt + 0.8 * wasser + heil - (e.risiko || 0) * 0.3;
}

/** Bestes Essen aus dem, was da ist (zaehle(id) → Anzahl). → id oder null */
export function bestesEssen(z, zaehle) {
  let best = null, bw = 0.005;
  for (const id of Object.keys(ESSEN)) {
    if (!(zaehle(id) > 0)) continue;
    const w = wert(z, id);
    if (w > bw) { bw = w; best = id; }
  }
  return best;
}

/** Isst id (zufall = Zahl 0…1 fürs Übel-Risiko). → { ok, text, uebel } */
export function iss(z, id, zufall = Math.random()) {
  const e = ESSEN[id];
  if (!e) return { ok: false, text: 'Das kann man nicht essen', uebel: false };
  z.satt = klemme(z.satt + e.satt);
  z.wasser = klemme(z.wasser + e.wasser);
  z.leben = klemme(z.leben + e.heil, 0, LEBEN_MAX);
  if (e.risiko && zufall < e.risiko) {
    z.satt = klemme(z.satt - e.satt - 0.05);
    z.wasser = klemme(z.wasser - 0.12);
    z.leben = klemme(z.leben - 6, 0, LEBEN_MAX);
    return { ok: false, text: `${e.name} – dir wird übel!`, uebel: true };
  }
  return { ok: true, text: `${e.name} gegessen`, uebel: false };
}

/** Trinken: Süßwasser füllt auf, Meerwasser macht durstiger. */
export function trinke(z, meer = false) {
  if (meer) { z.wasser = klemme(z.wasser - 0.05); return { ok: false, text: 'Salzwasser – davon wird der Durst nur schlimmer' }; }
  z.wasser = 1;
  return { ok: true, text: 'Wasser getrunken' };
}

/** Was beim Tod verloren geht: Hälfte jedes Stapels (aufgerundet), außer Werkzeugen. plaetze = [{id, anzahl} | null] */
export function todVerlust(plaetze) {
  const weg = new Map();
  for (const p of plaetze) if (p && !WERKZEUGE.has(p.id)) weg.set(p.id, (weg.get(p.id) || 0) + Math.ceil(p.anzahl / 2));
  return [...weg].map(([id, anzahl]) => ({ id, anzahl }));
}

/** Nach dem Tod: alles auf die Hälfte. */
export function wiederbeleben(z) {
  z.leben = LEBEN_MAX / 2; z.satt = 0.5; z.wasser = 0.5; z.waerme = 0.5; z.nass = 0;
  return z;
}

/** Wort zur Körperwärme fürs HUD. */
export function waermeWort(z) {
  if (z.tGefuehlt > HITZE) return 'heiß';
  if (z.waerme < 0.25) return 'erfriert';
  if (z.tGefuehlt < KOMFORT) return z.waerme < 0.6 ? 'sehr kalt' : 'kalt';
  return z.waerme < 1 ? 'wärmt auf' : 'warm';
}
