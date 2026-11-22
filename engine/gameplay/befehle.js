/**
 * @modul    befehle
 * @zweck    Befehls-Schicht „Wer will was“: Befehle ({von, art, daten}) in eine Warteschlange, je Art Prüfer (lebt, Reichweite, Abklingzeit) + Ausführer, fester Takt, Protokoll zum Nachspielen – gleiche Befehle → gleiches Ergebnis (Server-tauglich)
 * @api      createBefehle({entitaeten,ereignisse,seed,takt,protokollMax,arten}) -> { sende({von,art,daten})->nr, fuehre({von,art,daten})->ergebnis, registriere(art,def), update(dt)->ergebnisse, schritt()->ergebnisse, nachspielen(protokoll)->ergebnisse[], bereit(von,art,schluessel?)->s, protokoll, takt, zeit, wartend, zustand(), lade(z), dispose() } ; STANDARD_BEFEHLE
 * @beispiel
 *   import { createBefehle } from '../../engine/gameplay/befehle.js';
 *   const befehle = createBefehle({ entitaeten: ents, seed: 7 });            // ents: core/entitaeten
 *   befehle.sende({ von: 's:1', art: 'schaden', daten: { ziel: 'g:2', menge: 10, element: 'feuer', reichweite: 20 } });
 *   for (const e of befehle.update(dt)) if (!e.ok) console.log(e.grund);     // fester Takt (Standard 1/20 s)
 *   const sofort = befehle.fuehre({ von: 's:1', art: 'heilen', daten: { ziel: 's:1', menge: 5 } });   // gleich ausführen (auch protokolliert)
 * @tags     befehl, kommando, absicht, mehrspieler, mmo, server, protokoll, replay, kampf, gameplay
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Art-Definition: { reichweite (m, Rand zu Rand; null = egal), abklingzeit (s je von+art+daten.faehigkeit), vonLebt (true), zielLebt (true),
 *   pruefe(b, ctx) -> true | 'grund' (zusätzlich), fuehreAus(b, ctx) -> ergebnis-Objekt }. ctx = { ents, von, ziel, zufall, zeit, takt, ereignisse }.
 * daten.reichweite / daten.abklingzeit dürfen die Art-Werte überschreiben (z. B. je Zauber). von darf auch keine Entität sein ('welt').
 * Ergebnis: { nr, takt, von, art, ok, grund?, …vom Ausführer }. Protokoll: [{ t (Takt), von, art, daten }] in Ausführungs-Reihenfolge.
 */
import { rng, hashSeed } from '../core/rng.js';
import { berechneSchaden, ARTEN } from './kampf-werte.js';

const abstand = (a, b) => Math.max(0, Math.hypot(a.pos.x - b.pos.x, a.pos.z - b.pos.z) - a.radius - b.radius);

/** Die eingebauten Arten. Schaden über kampf-werte (Angriff/Magie, Rüstung/Resistenz, Krit) aus ent.daten.werte. */
export const STANDARD_BEFEHLE = {
  schaden: {
    reichweite: null, abklingzeit: 0,
    pruefe: (b) => (b.daten?.menge > 0 ? true : 'keine Menge'),
    fuehreAus(b, { ents, von, ziel, zufall }) {
      const d = b.daten;
      const art = ARTEN.includes(d.element) ? d.element : 'koerper';
      const s = berechneSchaden(von?.daten?.werte, ziel.daten?.werte, { menge: d.menge, art, krit: d.krit, durchdringung: d.durchdringung }, zufall);
      const menge = Math.max(d.menge > 0 ? 1 : 0, Math.round(s.schaden));
      const echt = ents.leben(ziel.id, -menge, { quelle: b.von, element: d.element || art, krit: s.krit, stoss: d.stoss || null });
      return { menge: echt, krit: s.krit, tot: !ziel.lebt };
    },
  },
  heilen: {
    reichweite: null, abklingzeit: 0,
    pruefe: (b) => (b.daten?.menge > 0 ? true : 'keine Menge'),
    fuehreAus(b, { ents, von, ziel }) {
      const f = von?.daten?.werte?.heilFaktor ?? 1;
      return { menge: ents.leben(ziel.id, Math.round(b.daten.menge * f), { quelle: b.von }) };
    },
  },
  bewegen: {
    reichweite: null, abklingzeit: 0, maxSchritt: 30,          // m je Befehl – größere Sprünge sind Teleport-Schummelei
    pruefe(b, { von }) {
      if (!von) return 'kein Absender';
      const d = b.daten || {};
      if (!Number.isFinite(d.x) || !Number.isFinite(d.z)) return 'kein Ziel';
      return Math.hypot(d.x - von.pos.x, d.z - von.pos.z) <= (d.maxSchritt ?? this.maxSchritt) ? true : 'zu weit';
    },
    fuehreAus(b, { ents }) { return { bewegt: ents.bewege(b.von, b.daten.x, b.daten.y, b.daten.z) }; },
  },
  interagieren: {
    reichweite: 3, abklingzeit: 0.25, zielLebt: false,
    fuehreAus(b, { ereignisse }) {
      ereignisse?.sende('ent:interaktion', { von: b.von, ziel: b.daten.ziel, daten: b.daten });
      return {};
    },
  },
};

export function createBefehle({ entitaeten, ereignisse = null, seed = 1, takt = 1 / 20, protokollMax = 20000, arten = {} } = {}) {
  if (!entitaeten) throw new Error('createBefehle: entitaeten fehlt');
  const defs = { ...STANDARD_BEFEHLE, ...arten };
  const zufall = rng(hashSeed('befehle', seed));
  const schlange = [], protokoll = [], abkling = new Map();  // schlüssel → bereit ab Zeit
  let t = 0, acc = 0, nr = 0;
  const zeit = () => t * takt;

  function pruefe(b, def, von, ziel) {
    if (!def) return 'unbekannte Art';
    if (def.vonLebt !== false && von && !von.lebt) return 'tot';
    const zid = b.daten?.ziel;
    if (zid != null) {
      if (!ziel) return 'kein Ziel';
      if (def.zielLebt !== false && !ziel.lebt) return 'Ziel tot';
      const reich = b.daten.reichweite ?? def.reichweite;
      if (reich != null && von && abstand(von, ziel) > reich + 1e-6) return 'zu weit';
    }
    const k = schluessel(b.von, b.art, b.daten?.faehigkeit);
    if ((abkling.get(k) ?? -1) > zeit() + 1e-9) return 'abklingzeit';
    return def.pruefe ? def.pruefe.call(def, b, { ents: entitaeten, von, ziel, zeit: zeit(), takt: t }) : true;
  }
  const schluessel = (von, art, f) => `${von}|${art}|${f ?? ''}`;

  function ausfuehren(b) {
    const def = defs[b.art];
    const von = b.von != null ? entitaeten.hole(b.von) : null;
    const ziel = b.daten?.ziel != null ? entitaeten.hole(b.daten.ziel) : null;
    const erg = { nr: b.nr, takt: t, von: b.von, art: b.art, ok: false };
    const p = pruefe(b, def, von, ziel);
    protokoll.push({ t, von: b.von, art: b.art, daten: b.daten });
    if (protokoll.length > protokollMax) protokoll.splice(0, protokoll.length - protokollMax);
    if (p !== true) { erg.grund = p; ereignisse?.sende('befehl:abgelehnt', erg); return erg; }
    const ab = b.daten?.abklingzeit ?? def.abklingzeit ?? 0;
    if (ab > 0) abkling.set(schluessel(b.von, b.art, b.daten?.faehigkeit), zeit() + ab);
    Object.assign(erg, def.fuehreAus.call(def, b, { ents: entitaeten, von, ziel, zufall, zeit: zeit(), takt: t, ereignisse }) || {});
    erg.ok = true;
    return erg;
  }

  function schritt() {
    t++;
    for (const [k, bis] of abkling) if (bis <= zeit()) abkling.delete(k);
    const erg = [];
    const jetzt = schlange.splice(0, schlange.length);
    for (const b of jetzt) erg.push(ausfuehren(b));
    return erg;
  }

  const form = ({ von = null, art, daten = {} } = {}) => ({ nr: ++nr, von, art, daten: { ...daten } });

  return {
    /** In die Warteschlange (ausgeführt beim nächsten Takt). Liefert die Befehls-Nummer. */
    sende(b) { const f = form(b); schlange.push(f); return f.nr; },
    /** Sofort ausführen (im aktuellen Takt) – für Spielcode, der das Ergebnis gleich braucht. */
    fuehre(b) { return ausfuehren(form(b)); },
    registriere(art, def) { defs[art] = def; },
    update(dt) {
      acc += Math.min(Math.max(+dt || 0, 0), 0.5);
      let alle = null;
      while (acc >= takt - 1e-9) { acc -= takt; const e = schritt(); if (e.length) (alle ||= []).push(...e); }
      return alle || [];
    },
    schritt,
    /** Protokoll auf DIESEM System nachspielen (frische Entitäten + gleicher Seed → gleiches Ergebnis). */
    nachspielen(liste) {
      const erg = [];
      for (const p of liste) { while (t < p.t) schritt(); erg.push(ausfuehren(form(p))); }
      return erg;
    },
    /** Sekunden bis von die Art (bzw. Fähigkeit) wieder darf. */
    bereit(von, art, f) { return Math.max(0, (abkling.get(schluessel(von, art, f)) ?? 0) - zeit()); },
    protokoll,
    get takt() { return t; },
    get zeit() { return zeit(); },
    get wartend() { return schlange.length; },
    zustand: () => ({ t, nr, ab: [...abkling] }),
    lade(z) { t = z?.t || 0; nr = z?.nr || 0; abkling.clear(); for (const [k, v] of z?.ab || []) abkling.set(k, v); },
    dispose() { schlange.length = 0; protokoll.length = 0; abkling.clear(); },
  };
}
