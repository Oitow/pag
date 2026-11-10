/**
 * @modul    zeit
 * @zweck    Spieluhr: Tageszeit, Tage, Jahreszeiten und Jahre mit Ereignissen, Pause, Tempo und Speicherstand
 * @api      createSpielzeit({stunde,tag,sekundenProStunde,tageProJahreszeit,tempo}) -> {stunde,tag,jahr,jahreszeit,jahreszeitName,jahresAnteil,istNacht,tempo,pause,update(dt),vor(h),setze({stunde,tag}),on(name,fn),uhrText(),zustand(),lade(z),dispose()} ; JAHRESZEITEN
 * @beispiel
 *   import { createSpielzeit } from '../../engine/core/zeit.js';
 *   const uhr = createSpielzeit({ stunde: 8, sekundenProStunde: 30 });
 *   uhr.on('tag', (tag) => console.log('Neuer Tag', tag));
 *   uhr.update(dt); // je Bild, dt in echten Sekunden
 * @tags     zeit, tageszeit, jahreszeit, kalender, uhr, speichern
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

export const JAHRESZEITEN = ['Frühling', 'Sommer', 'Herbst', 'Winter'];

const EPS = 1e-9;

/** Erzeugt eine Spieluhr. Ereignisse: 'stunde' (volleStunde, uhr), 'tag' (tag, uhr), 'jahreszeit' (index, uhr). */
export function createSpielzeit(opts = {}) {
  const { sekundenProStunde = 30, tageProJahreszeit = 7 } = opts;
  const tageProJahr = tageProJahreszeit * 4;
  let h = Math.min(Math.max(opts.stunde ?? 8, 0), 24 - EPS);
  let tag = Math.max(1, Math.floor(opts.tag ?? 1));
  const lauscher = { stunde: [], tag: [], jahreszeit: [] };

  const jzIndex = (t) => Math.floor((t - 1) / tageProJahreszeit) % 4;

  function feuere(name, arg) {
    for (const fn of lauscher[name].slice()) fn(arg, uhr);
  }

  /** Schreitet um `stunden` Spielstunden fort und feuert Ereignisse der Reihe nach. */
  function fortschritt(stunden) {
    let rest = stunden;
    while (rest > EPS) {
      const naechste = Math.floor(h + EPS) + 1;
      const abstand = naechste - h;
      if (rest + EPS < abstand) { h += rest; break; }
      rest -= abstand;
      if (naechste >= 24) {
        const alt = jzIndex(tag);
        h = 0;
        tag++;
        feuere('tag', tag);
        const neu = jzIndex(tag);
        if (neu !== alt) feuere('jahreszeit', neu);
        feuere('stunde', 0);
      } else {
        h = naechste;
        feuere('stunde', naechste);
      }
    }
    return stunden;
  }

  const uhr = {
    get stunde() { return h; },
    get tag() { return tag; },
    get jahr() { return Math.floor((tag - 1) / tageProJahr) + 1; },
    get jahreszeit() { return jzIndex(tag); },
    get jahreszeitName() { return JAHRESZEITEN[jzIndex(tag)]; },
    get jahresAnteil() { return (((tag - 1) % tageProJahr) + h / 24) / tageProJahr; },
    get istNacht() { return h < 6 || h >= 20; },
    tempo: opts.tempo ?? 1,
    pause: false,

    /** dt in echten Sekunden; gibt vergangene Spielstunden zurück (0 bei Pause). */
    update(dt) {
      if (uhr.pause || !(dt > 0)) return 0;
      return fortschritt((dt * uhr.tempo) / sekundenProStunde);
    },
    /** Springt um Spielstunden vor und feuert dabei alle Ereignisse. */
    vor(stunden) {
      return stunden > 0 ? fortschritt(stunden) : 0;
    },
    /** Setzt Zeit direkt, ohne Ereignisse. */
    setze(z = {}) {
      if (z.stunde != null) h = Math.min(Math.max(z.stunde, 0), 24 - EPS);
      if (z.tag != null) tag = Math.max(1, Math.floor(z.tag));
    },
    /** Meldet einen Lauscher an; gibt die Abmelde-Funktion zurück. */
    on(name, fn) {
      if (!lauscher[name]) throw new Error(`zeit: unbekanntes Ereignis "${name}"`);
      lauscher[name].push(fn);
      return () => {
        const i = lauscher[name].indexOf(fn);
        if (i >= 0) lauscher[name].splice(i, 1);
      };
    },
    uhrText() {
      let std = Math.floor(h);
      let min = Math.floor((h - std) * 60 + EPS);
      if (min >= 60) { min = 0; std = (std + 1) % 24; }
      return String(std).padStart(2, '0') + ':' + String(min).padStart(2, '0');
    },
    /** Schlichtes JSON für Spielstände. */
    zustand() {
      return { stunde: h, tag, tempo: uhr.tempo, pause: uhr.pause };
    },
    lade(z) {
      if (!z) return;
      uhr.setze({ stunde: z.stunde, tag: z.tag });
      if (z.tempo != null) uhr.tempo = z.tempo;
      if (z.pause != null) uhr.pause = !!z.pause;
    },
    dispose() {
      for (const k of Object.keys(lauscher)) lauscher[k].length = 0;
    },
  };
  return uhr;
}
