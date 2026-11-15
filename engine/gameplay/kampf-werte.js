/**
 * @modul    kampf-werte
 * @zweck    Kämpfer (Leben, Schild, Haltung, Werte, Mods) und reine Schadensformel mit Rüstung, Krit, Parade, Block
 * @api      ARTEN ; STANDARD_WERTE ; berechneSchaden(angreifer,verteidiger,paket,r)->{schaden,krit,roh} ; createKaempfer({id,team,leben,werte,haltung,seed})->{leben,lebenMax,tot,schild,haltung,taumelt,werte,abwehr,nimmSchaden(paket,angreiferWerte)->ergebnis,heile(m)->geheilt,gibSchild(m,dauer),belebe(anteil),setzeMod(id,mod),entferneMod(id),update(dt)->ereignisse,zustand(),laden(z),dispose()}
 * @beispiel
 *   import { createKaempfer } from '../../engine/gameplay/kampf-werte.js';
 *   const ork = createKaempfer({ id: 'ork', team: 2, leben: 80, werte: { ruestung: 100 } });
 *   const e = ork.nimmSchaden({ menge: 20, wucht: 10, richtung: { x: 0, z: -1 } });
 *   ork.abwehr.block = true; ork.abwehr.yaw = 0; // Blick = (sin yaw, cos yaw)
 * @tags     kampf, schaden, leben, haltung, ruestung, krit, mmo, rpg
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { rng } from '../core/rng.js';
import { clamp } from '../core/math.js';

export const ARTEN = ['koerper', 'feuer', 'eis', 'blitz', 'arkan', 'natur', 'heilig', 'schatten'];
export const STANDARD_WERTE = {
  angriff: 0, magie: 0, ruestung: 0, resist: {}, krit: 0.05, kritFaktor: 1.5,
  ausweichen: 0, blockAnteil: 0.7, schadenFaktor: 1, heilFaktor: 1, tempo: 1,
};
const MULT = ['schadenFaktor', 'heilFaktor', 'tempo']; // Mods wirken als Faktor, alles andere additiv
const VORN_COS = Math.cos((75 * Math.PI) / 180);
const TAUMEL_DAUER = 1.5, HALTUNG_REGEN = 25, HALTUNG_PAUSE = 2;

/** Reine Schadensformel. r() liefert [0,1); ohne r gibt es nie einen Zufalls-Krit. */
export function berechneSchaden(angreifer, verteidiger, paket, r = () => 1) {
  const a = { ...STANDARD_WERTE, ...(angreifer || {}) };
  const v = { ...STANDARD_WERTE, ...(verteidiger || {}) };
  const art = paket.art || 'koerper';
  const koerper = art === 'koerper';
  const roh = (paket.menge || 0) * (1 + (koerper ? a.angriff : a.magie) / 100) * a.schadenFaktor;
  let krit = paket.krit === true;
  if (!krit && paket.krit !== false) krit = r() < a.krit;
  const ruest = Math.max(0, v.ruestung);
  let minderung = koerper ? ruest / (ruest + 100) : clamp((v.resist || {})[art] || 0, 0, 0.9);
  minderung = clamp(minderung - (paket.durchdringung || 0), 0, 1);
  const schaden = Math.max(0, roh * (krit ? a.kritFaktor : 1) * (1 - minderung));
  return { schaden, krit, roh };
}

export function createKaempfer({ id, team = 0, leben = 100, werte = {}, haltung = 100, seed = 1 } = {}) {
  let basis = { ...STANDARD_WERTE, ...werte, resist: { ...(werte.resist || {}) } };
  const mods = new Map();
  const abwehr = { block: false, parade: false, unverwundbar: false, yaw: 0 };
  let lebenMax = leben, aktuell = leben, haltungMax = haltung, hal = haltung;
  let schild = { wert: 0, rest: null };
  let taumelRest = 0, seitTreffer = 99, zaehler = 0, zufall = rng(seed), eff = null;
  const wuerfel = () => { zaehler++; return zufall(); };

  function berechne() {
    const w = { ...basis, resist: { ...basis.resist }, unverwundbar: !!abwehr.unverwundbar };
    for (const m of mods.values()) {
      for (const [k, x] of Object.entries(m)) {
        if (k === 'unverwundbar') w.unverwundbar = w.unverwundbar || !!x;
        else if (k === 'resist') for (const [art, y] of Object.entries(x)) w.resist[art] = (w.resist[art] || 0) + y;
        else if (MULT.includes(k)) w[k] = (w[k] ?? 1) * x;
        else if (typeof x === 'number') w[k] = (w[k] || 0) + x;
      }
    }
    return w;
  }
  const werteJetzt = () => { eff = berechne(); return eff; }; // abwehr ist veränderlich → immer frisch

  function vonVorn(richtung) {
    if (!richtung) return false;
    const l = Math.hypot(richtung.x, richtung.z);
    if (!l) return false;
    const bx = Math.sin(abwehr.yaw), bz = Math.cos(abwehr.yaw);
    return (-richtung.x * bx - richtung.z * bz) / l > VORN_COS;
  }

  function nimmSchaden(paket, angreiferWerte) {
    const erg = { schaden: 0, abgefangen: 0, krit: false, ausgewichen: false, pariert: false, geblockt: false, taumelt: false, tot: false, leben: aktuell };
    if (aktuell <= 0) return erg;
    const w = werteJetzt();
    if (w.unverwundbar) { erg.ausgewichen = true; return erg; }
    const direkt = !!paket.direkt; // DoT: kein Ausweichen/Parade/Block
    if (!direkt && w.ausweichen > 0 && wuerfel() < w.ausweichen) { erg.ausgewichen = true; return erg; }
    const vorn = !direkt && vonVorn(paket.richtung);
    if (vorn && abwehr.parade) { erg.pariert = true; return erg; }
    const res = berechneSchaden(angreiferWerte || { krit: 0 }, w, paket, wuerfel);
    erg.krit = res.krit;
    let s = res.schaden;
    if (vorn && abwehr.block) { s *= 1 - clamp(w.blockAnteil, 0, 1); erg.geblockt = true; }
    if (schild.wert > 0) {
      const ab = Math.min(schild.wert, s);
      schild.wert -= ab; s -= ab; erg.abgefangen = ab;
      if (schild.wert <= 0) schild.rest = null;
    }
    aktuell = Math.max(0, aktuell - s);
    erg.schaden = s;
    seitTreffer = 0;
    const wucht = paket.wucht || 0;
    if (wucht > 0 && taumelRest <= 0 && aktuell > 0) {
      hal -= erg.geblockt ? wucht * 0.5 : wucht;
      if (hal <= 0) { hal = 0; taumelRest = TAUMEL_DAUER; erg.taumelt = true; }
    }
    erg.tot = aktuell <= 0;
    erg.leben = aktuell;
    return erg;
  }

  function heile(menge) {
    if (aktuell <= 0) return 0;
    const g = Math.max(0, Math.min(menge * werteJetzt().heilFaktor, lebenMax - aktuell));
    aktuell += g;
    return g;
  }

  function update(dt) {
    const ev = [];
    seitTreffer += dt;
    if (schild.wert > 0 && schild.rest !== null) {
      schild.rest -= dt;
      if (schild.rest <= 0) { schild.wert = 0; schild.rest = null; ev.push({ typ: 'schildEnde' }); }
    }
    if (taumelRest > 0) {
      taumelRest -= dt;
      if (taumelRest <= 0) { taumelRest = 0; hal = haltungMax; ev.push({ typ: 'taumelEnde' }); }
    } else if (seitTreffer > HALTUNG_PAUSE) hal = Math.min(haltungMax, hal + HALTUNG_REGEN * dt);
    return ev;
  }

  const k = {
    id, team, abwehr, nimmSchaden, heile, update,
    get leben() { return aktuell; }, get lebenMax() { return lebenMax; },
    get tot() { return aktuell <= 0; }, get schild() { return schild.wert; },
    get haltung() { return hal; }, get haltungMax() { return haltungMax; },
    get taumelt() { return taumelRest > 0; }, get werte() { return werteJetzt(); },
    gibSchild(menge, dauer = 10) { schild = { wert: Math.max(0, menge), rest: dauer > 0 ? dauer : null }; },
    belebe(anteil = 1) { aktuell = Math.max(1, lebenMax * clamp(anteil, 0, 1)); taumelRest = 0; hal = haltungMax; },
    setzeMod(modId, mod) { mods.set(modId, { ...mod }); },
    entferneMod(modId) { mods.delete(modId); },
    zustand() {
      return {
        id, team, leben: aktuell, lebenMax, haltung: hal, haltungMax, schild: { ...schild }, taumelRest, seitTreffer,
        basis: { ...basis, resist: { ...basis.resist } }, mods: [...mods].map(([n, m]) => [n, { ...m }]),
        abwehr: { ...abwehr }, seed, zaehler,
      };
    },
    laden(z) {
      aktuell = z.leben; lebenMax = z.lebenMax; hal = z.haltung; haltungMax = z.haltungMax;
      schild = { ...z.schild }; taumelRest = z.taumelRest; seitTreffer = z.seitTreffer;
      basis = { ...z.basis, resist: { ...z.basis.resist } };
      mods.clear(); for (const [n, m] of z.mods) mods.set(n, { ...m });
      Object.assign(abwehr, z.abwehr);
      zufall = rng(z.seed); zaehler = 0;
      for (let i = 0; i < z.zaehler; i++) wuerfel();
    },
    dispose() { mods.clear(); },
  };
  return k;
}
