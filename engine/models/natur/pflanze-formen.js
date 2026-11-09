/**
 * @modul    pflanze-formen
 * @zweck    Reine Form-Logik für Pflanzen (ohne THREE): Bögen für Halme/Wedel/Blätter, Rosetten-Layouts, Blüten- und Pilzsorten, Kaktusarme, Farbhelfer mit Jahreszeit
 * @api      bogen(laenge, startWinkel, biegung, n) -> [[h,y],…] ; rosette(r, anzahl, opts) -> [{winkel,neigung,laenge}] ; blumenSorte(r, name?) -> sorte ; BLUMEN_SORTEN ; PILZ_SORTEN ; kaktusArme(r, hoehe, anzahl) -> [{ansatz,winkel,aus,hoch}] ; farbe(hex) -> [r,g,b] ; mische(a,b,t) ; hell(f,k) ; laubFarben(jahreszeit) -> {grund,hell,dunkel}
 * @beispiel
 *   import { bogen, rosette, blumenSorte } from '../../engine/models/natur/pflanze-formen.js';
 *   const halm = bogen(0.5, 1.4, 0.8, 4);           // 5 Punkte [horizontal, hoch]
 *   const sorte = blumenSorte(rng(7));               // z. B. { name: 'mohn', form: 'schale', … }
 * @tags     natur, pflanze, form, blume, halm, wedel, rosette, logik
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { range, pick } from '../../core/rng.js';

/** '#rrggbb' oder 0xrrggbb → [r,g,b] (sRGB 0..1). Arrays werden kopiert. */
export function farbe(f) {
  if (Array.isArray(f)) return f.slice(0, 3);
  const n = typeof f === 'number' ? f : parseInt(String(f).replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
/** Lineare Mischung zweier Farben. */
export const mische = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** Helligkeit skalieren (k < 1 dunkler), auf 0..1 begrenzt. */
export const hell = (f, k) => [Math.min(1, f[0] * k), Math.min(1, f[1] * k), Math.min(1, f[2] * k)];

/**
 * Gebogene Linie in der Ebene (h = horizontal, y = hoch), z. B. Halm, Wedel, Blatt.
 * startWinkel: Radiant über der Horizontalen; biegung: Winkeländerung über die ganze Länge (positiv = sinkt).
 */
export function bogen(laenge, startWinkel, biegung, n = 4) {
  const pkt = [[0, 0]];
  const d = laenge / n;
  let h = 0, y = 0;
  for (let i = 0; i < n; i++) {
    const w = startWinkel - biegung * (i + 0.5) / n;
    h += Math.cos(w) * d; y += Math.sin(w) * d;
    pkt.push([h, y]);
  }
  return pkt;
}

/**
 * Rosette (Goldener Winkel): Blätter von innen (steil, kurz) nach außen (flach, lang).
 * opts: { steil = 1.3, flach = 0.35, kurz = 0.6, streu = 0.15 } – Neigung in Radiant über der Horizontalen.
 */
export function rosette(r, anzahl, { steil = 1.3, flach = 0.35, kurz = 0.6, streu = 0.15 } = {}) {
  const out = [];
  const start = r() * Math.PI * 2;
  for (let i = 0; i < anzahl; i++) {
    const t = anzahl > 1 ? i / (anzahl - 1) : 0;    // 0 = außen, 1 = innen
    out.push({
      winkel: start + i * 2.39996 + range(r, -streu, streu),
      neigung: flach + (steil - flach) * t + range(r, -streu, streu),
      laenge: (1 - (1 - kurz) * t) * range(r, 0.85, 1.1),
    });
  }
  return out;
}

/** Blumensorten: form steuert den Bau der Blüte, farben = Auswahl (sRGB-Hex). */
export const BLUMEN_SORTEN = {
  gaensebluemchen: { form: 'stern', farben: ['#ffffff', '#fbf3f6'], mitte: '#f3c623', hoehe: [0.1, 0.18], groesse: 0.045, blaetter: 8 },
  margerite: { form: 'stern', farben: ['#ffffff'], mitte: '#f0b81c', hoehe: [0.35, 0.55], groesse: 0.08, blaetter: 10 },
  mohn: { form: 'schale', farben: ['#e0241b', '#d8331a', '#ef4a26'], mitte: '#1b1414', hoehe: [0.35, 0.6], groesse: 0.08, blaetter: 4 },
  glockenblume: { form: 'glocke', farben: ['#6f62d6', '#8a6fe0', '#5a72d8'], mitte: '#e9e2ff', hoehe: [0.25, 0.45], groesse: 0.05, blaetter: 5 },
  loewenzahn: { form: 'pompon', farben: ['#f6c514', '#f8d32a'], mitte: '#d9a10c', hoehe: [0.15, 0.3], groesse: 0.05, blaetter: 0 },
  lupine: { form: 'aehre', farben: ['#7a52d4', '#d45aa8', '#5d6fe0', '#f0eef8'], mitte: '#ffffff', hoehe: [0.6, 0.95], groesse: 0.07, blaetter: 0 },
  kornblume: { form: 'stern', farben: ['#3d6fe8', '#4a58e0'], mitte: '#2a2f8a', hoehe: [0.3, 0.5], groesse: 0.055, blaetter: 7 },
};
/** Sorte per Zufall (oder per Name) → { name, …parameter }. */
export function blumenSorte(r, name) {
  const n = name && BLUMEN_SORTEN[name] ? name : pick(r, Object.keys(BLUMEN_SORTEN));
  return { name: n, ...BLUMEN_SORTEN[n] };
}

/** Pilzsorten (kreis = Hexenring aus kleinen Pilzen). */
export const PILZ_SORTEN = {
  fliegenpilz: { hut: '#d4231c', stiel: '#f2ede0', unten: '#efe6cf', punkte: '#ffffff', hoehe: [0.14, 0.24], hutR: [0.07, 0.11], stielR: 0.018, flach: 0.55 },
  steinpilz: { hut: '#7a4a24', stiel: '#e2d3b0', unten: '#d9c87a', punkte: null, hoehe: [0.1, 0.17], hutR: [0.06, 0.09], stielR: 0.02, flach: 0.6 },
  kreis: { hut: '#c9a57a', stiel: '#efe4cf', unten: '#e6d8bc', punkte: null, hoehe: [0.05, 0.09], hutR: [0.03, 0.045], stielR: 0.007, flach: 0.7 },
};

/**
 * Arme eines Kandelaber-Kaktus: ansatz (Anteil der Stammhöhe), winkel (um y), aus (horizontal), hoch (senkrecht).
 */
export function kaktusArme(r, hoehe, anzahl) {
  const arme = [];
  const start = r() * Math.PI * 2;
  for (let i = 0; i < anzahl; i++) {
    const ansatz = range(r, 0.3, 0.6);
    arme.push({
      ansatz,
      winkel: start + (i / anzahl) * Math.PI * 2 + range(r, -0.4, 0.4),
      aus: hoehe * range(r, 0.1, 0.16),
      hoch: hoehe * Math.min(range(r, 0.2, 0.42), 0.92 - ansatz),
    });
  }
  return arme;
}

/** Laubfarben je Jahreszeit (sRGB 0..1). */
const LAUB = {
  sommer: { grund: ['#4f8a2f', '#5a9634', '#467f2c', '#62973a'], dunkel: '#2c5520', hell: '#8cc155' },
  herbst: { grund: ['#c8641e', '#d8962a', '#b9431f', '#a67a28'], dunkel: '#6b3418', hell: '#efc35a' },
  winter: { grund: ['#6b5f4c', '#75664f', '#5e5546'], dunkel: '#3a3329', hell: '#9a8c74' },
};
export const JAHRESZEITEN = ['sommer', 'herbst', 'winter'];
/** Palette für Laub: { grund: [[r,g,b]…], dunkel, hell }. Unbekannte Jahreszeit → sommer. */
export function laubFarben(jahreszeit = 'sommer') {
  const p = LAUB[jahreszeit] || LAUB.sommer;
  return { grund: p.grund.map(farbe), dunkel: farbe(p.dunkel), hell: farbe(p.hell) };
}
