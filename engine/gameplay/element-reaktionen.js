/**
 * @modul    element-reaktionen
 * @zweck    Element-Reaktionen ohne THREE: Elemente (Feuer, Wasser, Frost, Blitz, Erde, Wind) hinterlassen Zustände auf Zielen UND auf Boden-Flecken (nass, brennend, gefroren, kalt, geladen, schlamm); trifft ein Element auf einen passenden Zustand, gibt es eine Reaktion aus einer Daten-Tabelle (Schock, Einfrieren, Feuersturm, Dampf, Schlamm, Schmelzen …) mit Faktor, neuen Zuständen und Folge-Effekten – deterministisch
 * @api      createElementReaktionen({reaktionen,zustaende,maxFlecken,zelle}) -> { treffer(id,element,{x,z,menge,folge}) -> ergebnis, boden(element,x,z,radius,{dauer}) -> ergebnis, amBoden(id,x,z) -> [neue Zustände], update(dt) -> ticks[], zustaende(id) -> {name:rest}, hat(id,name), setze(id,name,dauer?), loesche(id,name?), bodenBei(x,z) -> [fleck], flecken, tempo(id) (0 … 1), betaeubt(id) -> s, vergiss(id), leeren(), zustand(), lade(z), dispose() } ; ELEMENTE ; ZUSTAENDE ; REAKTIONEN ; normElement(name) -> element|null
 * @beispiel
 *   import { createElementReaktionen } from '../../engine/gameplay/element-reaktionen.js';
 *   const er = createElementReaktionen();
 *   er.boden('wasser', 10, 4, 3);                                  // Pfütze: Boden-Fleck 'nass'
 *   const r = er.treffer('ratte-3', 'blitz', { x: 10, z: 4, menge: 20 });   // steht im Nassen → r.reaktion.name === 'schock'
 *   schade(id, r.menge); for (const f of r.folgen) zeigeEffekt(f);  // f: { art:'flaeche'|'wolke'|'glanz'|…, element, x, z, radius, faktor, dauer }
 * @tags     zauber, element, reaktion, zustand, nass, brennend, gefroren, schock, dampf, boden, kampf, magie
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Reaktion = { name, text, braucht (Zustand am Ziel oder am Boden), element (eintreffend), faktor (Schaden ×), entfernt [Zustände],
 *   setzt { zustand: dauer }, folge { art, radius, faktor (Anteil des Treffer-Schadens), element, dauer }, betaeubt (s), farbe }.
 * Erst wird das Ziel geprüft, dann der Boden-Fleck unter ihm (Reihenfolge der Tabelle entscheidet). Ohne Reaktion hinterlässt das
 * Element seinen eigenen Zustand (HINTERLAESST). Folge-Treffer (opts.folge) lösen keine weiteren Folgen aus (keine Endlos-Ketten).
 * update(dt) meldet Schadens-Takte brennender Ziele: [{ id, menge, element:'feuer' }].
 */
import { createRaumGitter } from '../core/raum-gitter.js';

export const ELEMENTE = Object.freeze(['feuer', 'wasser', 'frost', 'blitz', 'erde', 'wind']);
const ALIAS = { eis: 'frost', kaelte: 'frost', natur: 'erde', stein: 'erde', luft: 'wind', sturm: 'wind' };
/** 'eis' → 'frost', 'natur' → 'erde' …; unbekannt → null. */
export const normElement = (n) => (ELEMENTE.includes(n) ? n : ALIAS[n] || null);

/** Zustände: dauer (Standard, s), tempo (Lauf-Faktor), dot (Schaden je Takt), takt (s), boden (darf als Fleck liegen). */
export const ZUSTAENDE = Object.freeze({
  nass: { dauer: 8, boden: true, farbe: 0x2a5a9a },
  brennend: { dauer: 4, dot: 4, takt: 1, boden: true, farbe: 0xff6a1a },
  gefroren: { dauer: 2.5, tempo: 0, boden: true, farbe: 0xcff0ff },
  kalt: { dauer: 4, tempo: 0.6, farbe: 0x9adfff },
  geladen: { dauer: 5, boden: true, farbe: 0xfff27a },
  schlamm: { dauer: 10, tempo: 0.5, boden: true, farbe: 0x5a3f22 },
});

/** Was ein Element ohne Reaktion zurücklässt (am Ziel / am Boden). */
const HINTERLAESST = { feuer: 'brennend', wasser: 'nass', frost: 'kalt', blitz: 'geladen', erde: null, wind: null };
const BODEN_HINTER = { feuer: 'brennend', wasser: 'nass', frost: null, blitz: null, erde: null, wind: null };

export const REAKTIONEN = Object.freeze([
  { name: 'schock', text: 'Schock!', braucht: 'nass', element: 'blitz', faktor: 1.5, entfernt: ['nass'], setzt: { geladen: 3 },
    folge: { art: 'flaeche', radius: 4.5, faktor: 0.6, element: 'blitz', nurMit: 'nass' }, farbe: 0xfff27a },
  { name: 'einfrieren', text: 'Eingefroren!', braucht: 'nass', element: 'frost', faktor: 1.1, entfernt: ['nass', 'kalt'], setzt: { gefroren: 2.5 },
    betaeubt: 2.5, folge: { art: 'glanz', radius: 1.2, dauer: 2.5 }, farbe: 0xcff0ff },
  { name: 'feuersturm', text: 'Feuersturm!', braucht: 'brennend', element: 'wind', faktor: 1.4, entfernt: [], setzt: { brennend: 5 },
    folge: { art: 'flaeche', radius: 6, faktor: 0.7, element: 'feuer', setzt: 'brennend', sturm: true }, farbe: 0xff8a2a },
  { name: 'dampf', text: 'Dampf!', braucht: 'brennend', element: 'wasser', faktor: 1.2, entfernt: ['brennend'], setzt: {},
    folge: { art: 'wolke', radius: 4, dauer: 4 }, farbe: 0xe8eef2 },
  { name: 'verdampfen', text: 'Dampf!', braucht: 'nass', element: 'feuer', faktor: 0.9, entfernt: ['nass'], setzt: {},
    folge: { art: 'wolke', radius: 3, dauer: 3 }, farbe: 0xe8eef2 },
  { name: 'schlamm', text: 'Schlamm!', braucht: 'nass', element: 'erde', faktor: 1.2, entfernt: ['nass'], setzt: { schlamm: 6 },
    folge: { art: 'fleck', radius: 3, zustand: 'schlamm', dauer: 10 }, farbe: 0x7a5a32 },
  { name: 'schmelzen', text: 'Schmelzen!', braucht: 'gefroren', element: 'feuer', faktor: 2, entfernt: ['gefroren'], setzt: { nass: 4 },
    folge: { art: 'wolke', radius: 2, dauer: 1.5 }, farbe: 0xffb070 },
  { name: 'tauen', text: 'Schmelzen!', braucht: 'kalt', element: 'feuer', faktor: 1.4, entfernt: ['kalt'], setzt: {}, farbe: 0xffb070 },
  { name: 'zerschmettern', text: 'Zerschmettert!', braucht: 'gefroren', element: 'erde', faktor: 2.5, entfernt: ['gefroren'], setzt: {},
    folge: { art: 'splitter', radius: 1.5 }, farbe: 0xd8f4ff },
  { name: 'ueberladung', text: 'Überladung!', braucht: 'geladen', element: 'feuer', faktor: 1.3, entfernt: ['geladen'], setzt: {},
    folge: { art: 'flaeche', radius: 3.5, faktor: 0.5, element: 'blitz' }, farbe: 0xffe060 },
]);

const ergebnisLeer = () => ({ reaktion: null, faktor: 1, menge: 0, neu: [], entfernt: [], folgen: [], betaeubt: 0, amBoden: false });

export function createElementReaktionen({ reaktionen = REAKTIONEN, zustaende = ZUSTAENDE, maxFlecken = 48, zelle = 6 } = {}) {
  const ziele = new Map();            // id → { z: Map(name → rest), takt }
  const gitter = createRaumGitter({ zelle });
  const flecken = [];                 // { id, x, z, radius, zustand, rest } in Anlege-Reihenfolge
  let naechsterFleck = 1;
  const dauerVon = (n, d) => (Number.isFinite(d) ? d : zustaende[n]?.dauer ?? 5);
  const eintrag = (id) => { let e = ziele.get(id); if (!e) ziele.set(id, (e = { z: new Map(), takt: 0 })); return e; };

  function setze(id, name, dauer) {
    if (!zustaende[name]) return false;
    const e = eintrag(id), d = dauerVon(name, dauer);
    e.z.set(name, Math.max(e.z.get(name) || 0, d));
    return true;
  }
  function loesche(id, name) { const e = ziele.get(id); if (!e) return; if (name == null) e.z.clear(); else e.z.delete(name); }

  function bodenBei(x, z) { const out = []; gitter.imUmkreis(x, z, 0, (f) => out.push(f.daten)); return out; }
  function entferneFleck(f) { gitter.entferne(f.id); const i = flecken.indexOf(f); if (i >= 0) flecken.splice(i, 1); }
  function neuerFleck(zustand, x, z, radius, dauer) {
    // gleicher Zustand ganz in der Nähe → auffrischen und etwas wachsen statt stapeln
    for (const f of flecken) if (f.zustand === zustand && Math.hypot(f.x - x, f.z - z) < Math.max(f.radius, radius) * 0.6) {
      f.rest = Math.max(f.rest, dauer); f.radius = Math.min(Math.max(f.radius, radius) * 1.1, 14);
      gitter.setze(f.id, f.x, f.z, f.radius, f); return f;
    }
    while (flecken.length >= maxFlecken) entferneFleck(flecken[0]);
    const f = { id: 'f' + naechsterFleck++, x, z, radius, zustand, rest: dauer, dauer };
    flecken.push(f); gitter.setze(f.id, x, z, radius, f);
    return f;
  }

  /** Passende Reaktion für (vorhandene Zustände, Element) aus der Tabelle. */
  function finde(hatFn, el) { for (const r of reaktionen) if (r.element === el && hatFn(r.braucht)) return r; return null; }

  function folgenVon(r, x, z, out) {
    if (!r.folge) return;
    out.push({ ...r.folge, reaktion: r.name, x, z, farbe: r.farbe });
  }

  /** Ein Element trifft Ziel id an (x,z). → { reaktion, faktor, menge, neu, entfernt, folgen, betaeubt, amBoden } */
  function treffer(id, element, { x = 0, z = 0, menge = 0, folge = false } = {}) {
    const el = normElement(element), res = ergebnisLeer();
    res.menge = menge;
    if (!el) return res;
    const e = eintrag(id);
    let r = finde((n) => e.z.has(n), el), fleck = null;
    if (!r) {   // steht es in einer Pfütze, im Feuer …?
      const unten = bodenBei(x, z);
      r = finde((n) => !!(fleck = unten.find((f) => f.zustand === n)), el);
      if (r) res.amBoden = true; else fleck = null;
    }
    if (r) {
      res.reaktion = r; res.faktor = r.faktor; res.menge = menge * r.faktor; res.betaeubt = r.betaeubt || 0;
      for (const n of r.entfernt) if (e.z.delete(n)) res.entfernt.push(n);
      if (fleck && r.entfernt.includes(fleck.zustand)) entferneFleck(fleck);
      for (const n in r.setzt) { setze(id, n, r.setzt[n]); res.neu.push(n); }
      if (!folge) folgenVon(r, x, z, res.folgen);
      if (r.folge?.art === 'fleck') neuerFleck(r.folge.zustand, x, z, r.folge.radius, r.folge.dauer);
    } else {
      const n = HINTERLAESST[el];
      if (n && setze(id, n)) res.neu.push(n);
    }
    return res;
  }

  /** Ein Element trifft den Boden (Fläche). Reagiert mit Flecken darunter, sonst entsteht ein eigener Fleck. */
  function boden(element, x, z, radius = 2, { dauer } = {}) {
    const el = normElement(element), res = ergebnisLeer();
    if (!el) return res;
    const unten = [];
    gitter.imUmkreis(x, z, radius, (f) => unten.push(f.daten));
    let fleck = null;
    const r = finde((n) => !!(fleck = unten.find((f) => f.zustand === n)), el);
    if (r) {
      res.reaktion = r; res.faktor = r.faktor; res.amBoden = true;
      if (r.entfernt.includes(fleck.zustand)) { entferneFleck(fleck); res.entfernt.push(fleck.zustand); }
      for (const n in r.setzt) if (zustaende[n]?.boden) { neuerFleck(n, fleck.x, fleck.z, Math.max(fleck.radius, radius), dauerVon(n, r.setzt[n] * 2)); res.neu.push(n); }
      if (r.folge?.art === 'fleck') neuerFleck(r.folge.zustand, x, z, Math.max(radius, r.folge.radius), r.folge.dauer);
      folgenVon(r, fleck.x, fleck.z, res.folgen);
    } else {
      const n = BODEN_HINTER[el];
      if (n) { neuerFleck(n, x, z, radius, dauerVon(n, dauer)); res.neu.push(n); }
    }
    return res;
  }

  /** Ziel steht bei (x,z): übernimmt nass/brennend/schlamm vom Boden. → neue Zustände */
  function amBoden(id, x, z) {
    const neu = [];
    for (const f of bodenBei(x, z)) {
      if (f.zustand === 'gefroren') continue;
      const e = eintrag(id), vorher = e.z.has(f.zustand);
      setze(id, f.zustand, Math.min(zustaende[f.zustand].dauer, 2));
      if (!vorher) neu.push(f.zustand);
    }
    return neu;
  }

  const ticks = [];
  function update(dt) {
    ticks.length = 0;
    for (const [id, e] of ziele) {
      for (const [n, rest] of e.z) { const r = rest - dt; if (r <= 0) e.z.delete(n); else e.z.set(n, r); }
      const b = zustaende.brennend;
      if (e.z.has('brennend') && b?.dot) {
        e.takt += dt;
        if (e.takt >= b.takt) { e.takt -= b.takt; ticks.push({ id, menge: b.dot, element: 'feuer' }); }
      } else e.takt = 0;
      if (!e.z.size) ziele.delete(id);
    }
    for (let i = flecken.length - 1; i >= 0; i--) if ((flecken[i].rest -= dt) <= 0) entferneFleck(flecken[i]);
    return ticks;
  }

  function tempo(id) {
    const e = ziele.get(id); if (!e) return 1;
    let t = 1;
    for (const n of e.z.keys()) { const f = zustaende[n]?.tempo; if (f != null) t = Math.min(t, f); }
    return t;
  }

  function leeren() { ziele.clear(); flecken.length = 0; gitter.leeren(); }

  return {
    treffer, boden, amBoden, update, setze, loesche, bodenBei, tempo,
    betaeubt: (id) => ziele.get(id)?.z.get('gefroren') || 0,
    zustaende: (id) => Object.fromEntries(ziele.get(id)?.z || []),
    hat: (id, n) => !!ziele.get(id)?.z.has(n),
    get flecken() { return flecken; },
    vergiss: (id) => { ziele.delete(id); },
    leeren,
    zustand: () => ({ ziele: [...ziele].map(([id, e]) => [id, [...e.z]]), flecken: flecken.map((f) => ({ ...f })), n: naechsterFleck }),
    lade(s) {
      leeren();
      for (const [id, z] of s?.ziele || []) ziele.set(id, { z: new Map(z), takt: 0 });
      for (const f of s?.flecken || []) { const g = { ...f }; flecken.push(g); gitter.setze(g.id, g.x, g.z, g.radius, g); }
      naechsterFleck = s?.n || naechsterFleck;
    },
    dispose() { leeren(); gitter.dispose?.(); },
  };
}
