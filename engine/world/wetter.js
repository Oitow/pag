/**
 * @modul    wetter
 * @zweck    Wetter-Zustand: Wetterarten wechseln per Seed nach Klima (Feuchte/Temperatur), Werte laufen weich, Wind, Blitz, Nässe
 * @api      createWetter({seed,art,wechselStunden,uebergangStunden}) -> {update(dtStunden,klima), blitzUpdate(dtSekunden), setze(art,sofort), zustand(), lade(z), on('wechsel',fn(art,vorher)), art, wolken, regen, schnee, nebel, wind, windRichtung, blitz, nass, dispose()} ; WETTER_ARTEN
 * @beispiel
 *   import { createWetter } from '../../engine/world/wetter.js';
 *   const w = createWetter({ seed: 7 });
 *   w.update(dtSpielStunden, { temperatur: 0.6, feuchte: 0.7 }); // Klima z. B. aus dem Biom
 *   w.blitzUpdate(dtEchtSekunden);                               // nur für den Blitz-Flash nötig
 *   if (w.regen > 0.1) { … }
 * @tags     wetter, regen, schnee, nebel, wind, gewitter, klima, seed
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { rng } from '../core/rng.js';
import { clamp, numOr } from '../core/math.js';

/** Zielwerte je Wetterart (alle 0..1). */
export const WETTER_ARTEN = {
  klar:     { wolken: 0.05, regen: 0,   schnee: 0,   nebel: 0,    wind: 0.1 },
  heiter:   { wolken: 0.25, regen: 0,   schnee: 0,   nebel: 0,    wind: 0.2 },
  bewoelkt: { wolken: 0.75, regen: 0,   schnee: 0,   nebel: 0.05, wind: 0.3 },
  regen:    { wolken: 0.9,  regen: 0.6, schnee: 0,   nebel: 0.2,  wind: 0.4 },
  gewitter: { wolken: 1,    regen: 1,   schnee: 0,   nebel: 0.15, wind: 0.7 },
  schnee:   { wolken: 0.85, regen: 0,   schnee: 0.7, nebel: 0.3,  wind: 0.25 },
  nebel:    { wolken: 0.5,  regen: 0,   schnee: 0,   nebel: 0.9,  wind: 0.05 },
  sturm:    { wolken: 0.9,  regen: 0.3, schnee: 0,   nebel: 0.1,  wind: 1 },
};
const KEYS = ['wolken', 'regen', 'schnee', 'nebel', 'wind'];

/** Übergangstabelle (Grundgewichte); kein Sprung klar→gewitter. */
const UEBERGANG = {
  klar:     { heiter: 3, bewoelkt: 0.4, nebel: 0.5 },
  heiter:   { klar: 2, bewoelkt: 3, nebel: 0.3 },
  bewoelkt: { heiter: 2, klar: 0.3, regen: 3, nebel: 1, sturm: 0.3 },
  regen:    { bewoelkt: 3, gewitter: 1.5, sturm: 0.4, heiter: 0.5 },
  gewitter: { regen: 3, sturm: 0.5, bewoelkt: 1 },
  schnee:   { bewoelkt: 3, nebel: 0.5, sturm: 0.3, heiter: 1 },
  nebel:    { heiter: 2, bewoelkt: 2, klar: 1 },
  sturm:    { regen: 2, bewoelkt: 2, gewitter: 1, heiter: 0.3 },
};

/** Gewichte der Folge-Wetter von `art` unter Klima k (Liste [art, gewicht]). */
function gewichte(art, k) {
  const f = k.feucht, kalt = k.temperatur < 0.25;
  const heissTrocken = k.temperatur > 0.75 && f < 0.3;
  const mult = {
    klar: 0.4 + (1 - f) * 1.6, heiter: 1, bewoelkt: 0.5 + f, sturm: 1,
    regen: 0.2 + f * 1.8, gewitter: (0.2 + f * 1.8) * (0.5 + f), nebel: 0.3 + f * 1.4, schnee: 0,
  };
  const out = {};
  for (const [ziel, g] of Object.entries(UEBERGANG[art])) {
    let z = ziel, w = g * mult[ziel];
    if (kalt && z === 'gewitter') continue;
    if (kalt && z === 'regen') { z = 'schnee'; w = g * (0.2 + f * 1.8); }
    if (heissTrocken && (z === 'regen' || z === 'gewitter' || z === 'nebel')) w *= 0.02;
    out[z] = (out[z] || 0) + w;
  }
  const paare = Object.entries(out);
  return paare.length ? paare : [['heiter', 1]];
}

export function createWetter(opts = {}) {
  const { seed = 1, wechselStunden = [2, 7], uebergangStunden = 0.6 } = opts;
  const dMin = Math.max(0.05, wechselStunden[0]), dMax = Math.max(dMin, wechselStunden[1]);
  const uebergang = Math.max(1e-3, uebergangStunden);
  let art = WETTER_ARTEN[opts.art] ? opts.art : 'heiter';
  let ist = { ...WETTER_ARTEN[art] };
  let zeit = 0, nass = 0;
  const hoerer = new Set();

  // Zufall mit Zähler, damit der Fortschritt speicherbar ist.
  const zufall = (s, n = 0) => { const r = rng(s); for (let i = 0; i < n; i++) r(); return { r, n }; };
  let z1 = zufall(seed);                // Wetterwechsel
  let z2 = zufall((seed ^ 0x9e3779b9) >>> 0); // Blitze
  const ziehe = (z) => { z.n++; return z.r(); };

  const neueDauer = () => dMin + (dMax - dMin) * ziehe(z1);
  let rest = neueDauer();
  let blitzWert = 0, blitzTimer = 4;

  function wechsle(neu) {
    const vorher = art;
    art = neu;
    rest = neueDauer();
    for (const fn of [...hoerer]) fn(art, vorher);
  }

  function waehle(klima) {
    const paare = gewichte(art, klima);
    let summe = 0;
    for (const p of paare) summe += p[1];
    let x = ziehe(z1) * summe;
    for (const p of paare) { x -= p[1]; if (x < 0) return p[0]; }
    return paare[paare.length - 1][0];
  }

  function update(dtStunden, klima = {}) {
    const dt = Math.max(0, numOr(dtStunden, 0));
    const k = {
      temperatur: clamp(numOr(klima.temperatur, 0.5), 0, 1),
      feucht: clamp(numOr(klima.feuchte, 0.5), 0, 1),
    };
    zeit += dt;
    rest -= dt;
    while (rest <= 0) {
      const dauerRest = rest;
      wechsle(waehle(k));
      rest += dauerRest;
    }
    const ziel = WETTER_ARTEN[art], schritt = dt / uebergang;
    for (const key of KEYS) {
      const d = ziel[key] - ist[key];
      ist[key] += Math.abs(d) <= schritt ? d : Math.sign(d) * schritt;
    }
    if (ist.regen > 0) nass += ist.regen * dt * 1.5; else nass -= dt / 6;
    nass = clamp(nass, 0, 1);
  }

  /** Blitz-Flash: echte Sekunden (nicht Spielzeit!), separat von update(). Blitze nur bei Gewitter. */
  function blitzUpdate(dtSekunden) {
    const dt = Math.max(0, numOr(dtSekunden, 0));
    blitzWert = Math.max(0, blitzWert - dt / 0.2);
    if (art === 'gewitter' && ist.regen > 0.5) {
      blitzTimer -= dt;
      if (blitzTimer <= 0) { blitzWert = 1; blitzTimer = 3 + 9 * ziehe(z2); }
    }
  }

  return {
    update, blitzUpdate,
    setze(neu, sofort = false) {
      if (!WETTER_ARTEN[neu]) return;
      if (neu !== art) wechsle(neu); else rest = neueDauer();
      if (sofort) ist = { ...WETTER_ARTEN[art] };
    },
    zustand: () => ({ seed, art, ist: { ...ist }, rest, zeit, nass, n1: z1.n, n2: z2.n, blitz: blitzWert, blitzTimer }),
    lade(z) {
      art = WETTER_ARTEN[z.art] ? z.art : art;
      ist = { ...ist, ...z.ist };
      rest = z.rest; zeit = z.zeit; nass = z.nass;
      z1 = zufall(seed, z.n1); z2 = zufall((seed ^ 0x9e3779b9) >>> 0, z.n2);
      blitzWert = z.blitz; blitzTimer = z.blitzTimer;
    },
    on(ereignis, fn) {
      if (ereignis !== 'wechsel') return () => {};
      hoerer.add(fn);
      return () => hoerer.delete(fn);
    },
    get art() { return art; },
    get wolken() { return ist.wolken; },
    get regen() { return ist.regen; },
    get schnee() { return ist.schnee; },
    get nebel() { return ist.nebel; },
    /** Grundwind mit leichten Böen (deterministisch aus der Zeit). */
    get wind() {
      const boe = 0.15 * Math.sin(zeit * 37) + 0.08 * Math.sin(zeit * 91 + 1);
      return clamp(ist.wind * (1 + boe), 0, 1);
    },
    /** Windrichtung in rad, dreht langsam. */
    get windRichtung() { return (seed % 628) / 100 + zeit * 0.15 + 0.5 * Math.sin(zeit * 0.3); },
    get blitz() { return blitzWert; },
    get nass() { return nass; },
    dispose() { hoerer.clear(); },
  };
}
