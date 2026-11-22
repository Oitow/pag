/**
 * @modul    ausdauer
 * @zweck    Ausdauer für Sprint, Rolle/Dash, Schwimmen, Klettern, Springen: Kosten-Tabelle als Daten, Erholung nach Verzögerung, Erschöpft-Zustand (gesperrte Aktionen bis zur Schwelle)
 * @api      createAusdauer({max,erholung,verzoegerung,erschoepftBis,kosten}) -> {wert,max,anteil,voll,leer,erschoepft,kosten,kann(aktion),zahle(aktion,faktor?)->bool,verbrauche(aktion,dt,faktor?)->bool,update(dt),setze(w),reset(),zustand(),lade(z),dispose()} ; AUSDAUER_KOSTEN
 * @beispiel
 *   import { createAusdauer } from '../../engine/gameplay/ausdauer.js';
 *   const ausdauer = createAusdauer({ max: 100 });
 *   absicht.sprint = absicht.sprint && ausdauer.kann('sprint') && ausdauer.verbrauche('sprint', dt);
 *   if (gedrueckt('rollen') && !ausdauer.zahle('rollen')) absicht.rollen = false;
 *   ausdauer.update(dt);              // Erholung (nach Verzögerung seit dem letzten Verbrauch)
 * @tags     ausdauer, stamina, sprint, klettern, schwimmen, rolle, erschoepft, gameplay
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */
import { clamp, numOr } from '../core/math.js';

/**
 * Kosten je Aktion. art 'dauer' = pro Sekunde (verbrauche), 'einmal' = je Auslösung (zahle).
 * sperrbar: im Erschöpft-Zustand nicht erlaubt (kann() → false). Springen ist nie gesperrt, kostet nur.
 */
export const AUSDAUER_KOSTEN = Object.freeze({
  sprint: { art: 'dauer', menge: 14, sperrbar: true },
  schwimmen: { art: 'dauer', menge: 3, sperrbar: false },
  schwimmSprint: { art: 'dauer', menge: 12, sperrbar: true },
  klettern: { art: 'dauer', menge: 9, sperrbar: true },
  kletternHalten: { art: 'dauer', menge: 4, sperrbar: false },
  rollen: { art: 'einmal', menge: 20, sperrbar: true },
  dash: { art: 'einmal', menge: 20, sperrbar: true },
  springen: { art: 'einmal', menge: 6, sperrbar: false },
  kletterSprung: { art: 'einmal', menge: 18, sperrbar: true },
});

export function createAusdauer({ max = 100, erholung = 25, verzoegerung = 1.0, erschoepftBis = 0.3, kosten = null } = {}) {
  const K = { ...AUSDAUER_KOSTEN, ...kosten };
  let maxW = Math.max(1, numOr(max, 100));
  let wert = maxW, pause = 0, erschoepft = false;

  const eintrag = (a) => K[a] || null;
  function abziehen(m) {
    if (!(m > 0)) return;
    wert = Math.max(0, wert - m);
    pause = verzoegerung;
    if (wert <= 0) erschoepft = true;
  }

  return {
    get wert() { return wert; },
    get max() { return maxW; },
    set max(v) { maxW = Math.max(1, numOr(v, maxW)); wert = Math.min(wert, maxW); },
    get anteil() { return wert / maxW; },
    get voll() { return wert >= maxW - 1e-6; },
    get leer() { return wert <= 0; },
    get erschoepft() { return erschoepft; },
    kosten: K,
    /** Darf die Aktion gerade starten/weiterlaufen? Unbekannte Aktionen: immer. */
    kann(aktion) {
      const k = eintrag(aktion);
      if (!k) return true;
      if (k.sperrbar && erschoepft) return false;
      return wert > 0 || !k.sperrbar;
    },
    /** Einmal-Kosten zahlen → false (nichts abgezogen), wenn die Aktion gesperrt ist. */
    zahle(aktion, faktor = 1) {
      const k = eintrag(aktion);
      if (!k) return true;
      if (!this.kann(aktion)) return false;
      abziehen(k.menge * numOr(faktor, 1));
      return true;
    },
    /** Dauer-Kosten für dt Sekunden → false, wenn gesperrt oder jetzt leer (Aktion endet). */
    verbrauche(aktion, dt, faktor = 1) {
      const k = eintrag(aktion);
      if (!k) return true;
      if (!this.kann(aktion)) return false;
      abziehen(k.menge * Math.max(0, numOr(dt, 0)) * numOr(faktor, 1));
      return wert > 0 || !k.sperrbar;
    },
    update(dt) {
      dt = Math.max(0, numOr(dt, 0));
      if (pause > 0) { pause -= dt; if (pause > 0) return; dt = -pause; pause = 0; }
      wert = Math.min(maxW, wert + erholung * dt);
      if (erschoepft && wert / maxW >= erschoepftBis) erschoepft = false;
    },
    setze(w) { wert = clamp(numOr(w, wert), 0, maxW); if (wert <= 0) erschoepft = true; },
    reset() { wert = maxW; pause = 0; erschoepft = false; },
    zustand() { return { wert, pause, erschoepft }; },
    lade(z) { if (!z) return; wert = clamp(numOr(z.wert, wert), 0, maxW); pause = Math.max(0, numOr(z.pause, 0)); erschoepft = !!z.erschoepft; },
    dispose() {},
  };
}
