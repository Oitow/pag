/**
 * @modul    hand
 * @zweck    „In der Hand“: ein Inventar-Platz ist ausgewählt (Schnellleiste); liefert den gehaltenen Gegenstand samt Register-Eintrag, meldet Wechsel (zum Ausrüsten der Figur) und nutzt Werkzeuge ab, bis sie zerbrechen
 * @api      createHand({inventar,register,ereignisse,platz,name}) -> {platz,waehle(platz)->bool,weiter(richtung?)->platz,gegenstand(),eintrag(),hatTag(tag),haltbarkeit()->0..1|null,nutzeAb(n?)->{rest,kaputt}|null,onWechsel(fn)->abmelden,zustand(),lade(stand),dispose()}
 * @beispiel
 *   import { createHand } from '../../engine/gameplay/hand.js';
 *   const hand = createHand({ inventar, register: gegenstaende });
 *   hand.onWechsel((e) => { figur.ablegen('handR'); if (e?.modell) figur.ausruesten('handR', createAusruestung(e.modell)); });
 *   hand.waehle(2); hand.hatTag('axt'); hand.nutzeAb(1);   // Haltbarkeit sinkt, bei 0 verschwindet das Werkzeug
 * @tags     hand, ausruesten, werkzeug, haltbarkeit, schnellleiste, inventar, gameplay
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * platz = -1: leere Hand. Der Platz bleibt gewählt, auch wenn er leer wird (wie eine Schnellleiste).
 * Haltbarkeit: Register-Eintrag { haltbarkeit: 25 } = volle Haltbarkeit; der Stand liegt in den Daten des Platzes ({ haltbarkeit }).
 * Solche Gegenstände brauchen `stapel: 1`. onWechsel(eintrag|null, platzInhalt|null) feuert nur, wenn sich die id in der Hand ändert.
 * Ereignisse: 'hand:gewechselt' { hand, id }, 'werkzeug:kaputt' { hand, id }.
 */

export function createHand({ inventar, register = null, ereignisse = null, platz: start = -1, name = 'hand' } = {}) {
  if (!inventar) throw new Error('hand: inventar fehlt');
  let platz = -1, letzteId = null, hoerer = [];
  const gueltig = (p) => Number.isInteger(p) && p >= -1 && p < inventar.plaetze.length;
  const gegenstand = () => (platz >= 0 ? inventar.plaetze[platz] : null) || null;
  const eintrag = () => { const g = gegenstand(); return g ? register?.hole(g.id) ?? { id: g.id } : null; };

  function pruefeWechsel() {
    const id = gegenstand()?.id ?? null;
    if (id === letzteId) return;
    letzteId = id;
    for (const fn of [...hoerer]) fn(eintrag(), gegenstand());
    ereignisse?.sende('hand:gewechselt', { hand: name, id });
  }
  const ab = inventar.onAenderung(pruefeWechsel);

  function waehle(p) {
    if (!gueltig(p)) return false;
    platz = p; pruefeWechsel();
    return true;
  }

  /** Nächster belegter Platz in Richtung +1/−1 (rundherum); ohne belegten Platz bleibt die Hand, wie sie ist. */
  function weiter(richtung = 1) {
    const n = inventar.plaetze.length, schritt = richtung < 0 ? -1 : 1;
    for (let k = 1; k <= n; k++) {
      const p = (((platz < 0 && schritt < 0 ? 0 : platz) + schritt * k) % n + n) % n;
      if (inventar.plaetze[p]) { waehle(p); break; }
    }
    return platz;
  }

  function haltbarkeit() {
    const g = gegenstand(), voll = g && register?.hole(g.id)?.haltbarkeit;
    if (!(voll > 0)) return null;
    return Math.max(0, Math.min(1, (g.daten?.haltbarkeit ?? voll) / voll));
  }

  function nutzeAb(n = 1) {
    const g = gegenstand(), voll = g && register?.hole(g.id)?.haltbarkeit;
    if (!(voll > 0) || !(n > 0)) return null;
    const rest = (g.daten?.haltbarkeit ?? voll) - n;
    if (rest <= 0) {
      const id = g.id;
      inventar.nimmVon(platz, 1);
      ereignisse?.sende('werkzeug:kaputt', { hand: name, id });
      return { rest: 0, kaputt: true };
    }
    if (g.anzahl === 1) inventar.setzeDaten(platz, { ...g.daten, haltbarkeit: rest });
    return { rest, kaputt: false };
  }

  function onWechsel(fn) {
    hoerer.push(fn);
    return () => { hoerer = hoerer.filter((f) => f !== fn); };
  }

  waehle(gueltig(start) ? start : -1);
  return {
    get platz() { return platz; },
    waehle, weiter, gegenstand, eintrag, haltbarkeit, nutzeAb, onWechsel,
    hatTag: (tag) => { const e = eintrag(); return !!e && (e.id === tag || !!e.tags?.includes(tag)); },
    zustand: () => ({ platz }),
    lade(stand) { waehle(gueltig(stand?.platz) ? stand.platz : -1); },
    dispose() { ab(); hoerer = []; },
  };
}
