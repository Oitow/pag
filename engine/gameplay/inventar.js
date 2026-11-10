/**
 * @modul    inventar
 * @zweck    Inventar mit festen Plätzen, Stapeln, Gewichtsgrenze, Speichern/Laden und Änderungs-Meldung
 * @api      createInventar({plaetze,register,stapel,maxGewicht,ereignisse,name}) -> {plaetze,gib(id,anzahl,daten)->rest,passt(id,anzahl),nimm(id,anzahl)->anzahl,nimmVon(platz,anzahl),hat(id,anzahl),zaehle(id),frei(),gewicht,verschiebe(von,nach),teile(platz,anzahl)->index,leere(),zustand(),lade(zustand),onAenderung(fn)->abmelden,dispose()}
 * @beispiel
 *   import { createInventar } from '../../engine/gameplay/inventar.js';
 *   const inv = createInventar({ plaetze: 10, stapel: 50 });
 *   const rest = inv.gib('holz', 120);   // 20 passen nicht
 *   inv.nimm('holz', 5); inv.zaehle('holz');
 *   const sicher = JSON.stringify(inv.zustand());
 * @tags     inventar, gegenstand, stapel, gameplay, speichern
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

export function createInventar({
  plaetze: platzZahl = 20, register = null, stapel = 99,
  maxGewicht = Infinity, ereignisse = null, name = 'inventar',
} = {}) {
  const slots = new Array(Math.max(0, Math.floor(platzZahl) || 0)).fill(null);
  let hoerer = [];

  const gueltigPlatz = (p) => Number.isInteger(p) && p >= 0 && p < slots.length;
  const menge = (n) => (typeof n === 'number' && n >= 1 ? Math.floor(n) : 0); // 0 = ungültig
  const istDaten = (d) => d !== null && typeof d === 'object' && !Array.isArray(d);
  const kopie = (d) => JSON.parse(JSON.stringify(d));

  function stapelGroesse(id, daten) {
    if (daten) return 1;
    const s = Math.floor(register?.hole(id)?.stapel ?? stapel);
    return s >= 1 ? s : 1;
  }
  const gewichtJe = (id) => {
    const w = register?.hole(id)?.gewicht ?? 0;
    return w > 0 ? w : 0;
  };

  function gewichtGesamt() {
    let g = 0;
    for (const s of slots) if (s) g += gewichtJe(s.id) * s.anzahl;
    return g;
  }

  function aenderung() {
    for (const fn of [...hoerer]) fn(api);
    if (ereignisse) ereignisse.sende('inventar:geaendert', { inventar: name });
  }

  /** Wie viele Stück würden passen (ohne zu ändern)? */
  function passend(id, anzahl, daten) {
    let n = anzahl;
    const w = gewichtJe(id);
    if (w > 0 && maxGewicht !== Infinity) {
      n = Math.min(n, Math.max(0, Math.floor((maxGewicht - gewichtGesamt()) / w + 1e-9)));
    }
    const s = stapelGroesse(id, daten);
    let platz = 0;
    for (const slot of slots) {
      if (!slot) platz += s;
      else if (!daten && !slot.daten && slot.id === id) platz += Math.max(0, s - slot.anzahl);
    }
    return Math.min(n, platz);
  }

  function gib(id, anzahl = 1, daten) {
    if (register && !register.hat(id)) throw new Error(`inventar: unbekannter Gegenstand '${id}'`);
    const gesamt = menge(anzahl);
    if (!gesamt) return anzahl;
    const mitDaten = istDaten(daten);
    let rest = passend(id, gesamt, mitDaten ? daten : null);
    const geschafft = rest;
    if (!geschafft) return gesamt;
    const s = stapelGroesse(id, mitDaten);
    if (!mitDaten) {
      for (const slot of slots) {
        if (rest && slot && !slot.daten && slot.id === id && slot.anzahl < s) {
          const t = Math.min(rest, s - slot.anzahl);
          slot.anzahl += t; rest -= t;
        }
      }
    }
    for (let i = 0; i < slots.length && rest > 0; i++) {
      if (slots[i]) continue;
      const t = Math.min(rest, s);
      slots[i] = mitDaten ? { id, anzahl: 1, daten: kopie(daten) } : { id, anzahl: t };
      rest -= mitDaten ? 1 : t;
    }
    aenderung();
    return gesamt - geschafft;
  }

  function passt(id, anzahl = 1) {
    const n = menge(anzahl);
    if (!n) return false;
    if (register && !register.hat(id)) return false;
    return passend(id, n, null) >= n;
  }

  function zaehle(id) {
    let n = 0;
    for (const s of slots) if (s && s.id === id) n += s.anzahl;
    return n;
  }
  const hat = (id, anzahl = 1) => { const n = menge(anzahl); return n > 0 && zaehle(id) >= n; };

  function nimm(id, anzahl = 1) {
    const n = menge(anzahl);
    if (!n) return 0;
    let rest = n;
    for (let i = slots.length - 1; i >= 0 && rest > 0; i--) {
      const s = slots[i];
      if (!s || s.id !== id) continue;
      const t = Math.min(rest, s.anzahl);
      s.anzahl -= t; rest -= t;
      if (s.anzahl <= 0) slots[i] = null;
    }
    const genommen = n - rest;
    if (genommen) aenderung();
    return genommen;
  }

  function nimmVon(platz, anzahl = Infinity) {
    if (!gueltigPlatz(platz) || !slots[platz]) return null;
    const n = menge(anzahl);
    if (!n) return null;
    const s = slots[platz];
    const t = Math.min(n, s.anzahl);
    const aus = { id: s.id, anzahl: t };
    if (s.daten) aus.daten = s.daten;
    s.anzahl -= t;
    if (s.anzahl <= 0) slots[platz] = null;
    aenderung();
    return aus;
  }

  function verschiebe(von, nach) {
    if (!gueltigPlatz(von) || !gueltigPlatz(nach) || von === nach) return false;
    const a = slots[von], b = slots[nach];
    if (!a && !b) return false;
    if (a && b && a.id === b.id && !a.daten && !b.daten) {
      const t = Math.min(a.anzahl, stapelGroesse(a.id) - b.anzahl);
      if (t <= 0) return false;
      b.anzahl += t; a.anzahl -= t;
      if (a.anzahl <= 0) slots[von] = null;
    } else {
      slots[von] = b; slots[nach] = a;
    }
    aenderung();
    return true;
  }

  function teile(platz, anzahl) {
    if (!gueltigPlatz(platz) || !slots[platz]) return -1;
    const s = slots[platz];
    const n = menge(anzahl);
    if (s.daten || !n || n >= s.anzahl) return -1;
    const ziel = slots.indexOf(null);
    if (ziel < 0) return -1;
    s.anzahl -= n;
    slots[ziel] = { id: s.id, anzahl: n };
    aenderung();
    return ziel;
  }

  const frei = () => slots.reduce((n, s) => n + (s ? 0 : 1), 0);

  function leere() {
    const warBelegt = frei() < slots.length;
    slots.fill(null);
    if (warBelegt) aenderung();
  }

  const zustand = () => ({
    plaetze: slots.map((s) => (s ? (s.daten ? [s.id, s.anzahl, kopie(s.daten)] : [s.id, s.anzahl]) : null)),
  });

  function lade(z) {
    const liste = Array.isArray(z?.plaetze) ? z.plaetze : [];
    slots.fill(null);
    for (let i = 0; i < slots.length && i < liste.length; i++) {
      const e = liste[i];
      if (!Array.isArray(e) || typeof e[0] !== 'string') continue;
      const [id, rohAnzahl, daten] = e;
      if (register && !register.hat(id)) continue;
      const n = menge(Number(rohAnzahl));
      if (!n) continue;
      if (istDaten(daten)) slots[i] = { id, anzahl: 1, daten: kopie(daten) };
      else slots[i] = { id, anzahl: Math.min(n, stapelGroesse(id)) };
    }
    aenderung();
  }

  function onAenderung(fn) {
    hoerer.push(fn);
    return () => { hoerer = hoerer.filter((f) => f !== fn); };
  }

  function dispose() { hoerer = []; slots.fill(null); }

  const api = {
    plaetze: slots, gib, passt, nimm, nimmVon, hat, zaehle, frei, verschiebe, teile,
    leere, zustand, lade, onAenderung, dispose,
    get gewicht() { return gewichtGesamt(); },
  };
  return api;
}
