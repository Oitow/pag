/**
 * @modul    interaktion
 * @zweck    „Ansehen → Aktion“: Dinge der Welt (NPC, Gegenstand, Baum, Tür) melden sich als Ziel an; für eine Figur wird das beste Ziel in Reichweite/Blickrichtung bestimmt (Hinweis „E – Aufheben“) und ausgelöst, auch als Gedrückt-halten mit Fortschritt
 * @api      createInteraktion({reichweite,blickWinkelGrad,nahImmer,hoehenToleranz,zelle,ereignisse}) -> {melde(id,{pos,radius,reichweite,art,text,dauer,prio,aktiv,aktion,daten}),bewege(id,x,z,y?),aktualisiere(),entferne(id),hat(id),hole(id),anzahl,beste(wer,{reichweite,filter}?),inReichweite(wer,out?),ausloesen(wer,ziel?),halte(wer,dt,gedrueckt)->{ziel,anteil,fertig},dispose()}
 * @beispiel
 *   import { createInteraktion } from '../../engine/gameplay/interaktion.js';
 *   const ia = createInteraktion({ reichweite: 2.5 });
 *   ia.melde('pilz-1', { pos: { x: 4, z: 7 }, text: 'Aufheben', aktion: (wer, ziel) => ia.entferne(ziel.id) });
 *   // je Bild: ia.aktualisiere(); const z = ia.beste(spieler); hinweis.textContent = z ? 'E – ' + z.text : '';
 *   // bei Tastendruck: ia.halte(spieler, dt, tasteE)   (oder ia.ausloesen(spieler))
 * @tags     interaktion, ansprechen, aufheben, tuer, npc, hinweis, aktion, reichweite, gameplay
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * wer = { x, y?, z, yaw? } (yaw: 0 = +z, wie Math.atan2(dx, dz)). Kandidat: aktiv, Rand-Abstand (Mittelpunkt − radius, min 0) ≤ Reichweite,
 * Höhe passt (nur wenn beide y endlich), im Blickkegel (nur wenn yaw endlich und Rand-Abstand > nahImmer).
 * Wertung (kleiner = besser): randAbstand + winkelRad * 0.6 − prio; bei Gleichstand das zuerst gemeldete Ziel.
 * Ziele liegen in einem Raum-Gitter (engine/core/raum-gitter.js). Funktions-pos wird in aktualisiere() nachgeführt.
 */

import { createRaumGitter } from '../core/raum-gitter.js';
import { angleDiff, numOr, clamp } from '../core/math.js';

export function createInteraktion({
  reichweite = 2.5, blickWinkelGrad = 140, nahImmer = 0.9, hoehenToleranz = 2.5, zelle = 4, ereignisse = null,
} = {}) {
  const gitter = createRaumGitter({ zelle });
  const ziele = new Map();                 // id → Ziel (Einfüge-Reihenfolge)
  const zustaende = new WeakMap();         // wer → Halte-Zustand
  const halbKegel = (clamp(blickWinkelGrad, 0, 360) * Math.PI) / 360;
  let zaehler = 0;
  let maxReichweite = reichweite;

  const lies = (pos) => (typeof pos === 'function' ? pos() : pos) || {};

  /** Ziel anmelden (gleiche id ersetzt). */
  function melde(id, opts = {}) {
    const p = lies(opts.pos);
    const ziel = {
      id, x: numOr(p.x, 0), y: Number.isFinite(+p.y) && p.y != null ? +p.y : NaN, z: numOr(p.z, 0),
      radius: Math.max(0, numOr(opts.radius, 0.4)),
      art: opts.art ?? 'ding', text: opts.text ?? '',
      dauer: Math.max(0, numOr(opts.dauer, 0)), prio: numOr(opts.prio, 0), daten: opts.daten,
      reichweite: numOr(opts.reichweite, reichweite),
      aktivFn: opts.aktiv === undefined ? true : opts.aktiv,
      aktion: typeof opts.aktion === 'function' ? opts.aktion : null,
      posFn: typeof opts.pos === 'function' ? opts.pos : null,
      nr: zaehler++,
    };
    if (ziel.reichweite > maxReichweite) maxReichweite = ziel.reichweite;
    ziele.delete(id);
    ziele.set(id, ziel);
    gitter.setze(id, ziel.x, ziel.z, ziel.radius, ziel);
    return ziel;
  }

  function bewege(id, x, z, y) {
    const ziel = ziele.get(id);
    if (!ziel || !Number.isFinite(x) || !Number.isFinite(z)) return false;
    ziel.x = x; ziel.z = z;
    if (y !== undefined) ziel.y = Number.isFinite(+y) && y != null ? +y : NaN;
    gitter.setze(id, x, z);
    return true;
  }

  /** Alle Ziele mit Funktions-pos neu abfragen (einmal je Bild). */
  function aktualisiere() {
    for (const ziel of ziele.values()) {
      if (!ziel.posFn) continue;
      const p = ziel.posFn() || {};
      bewege(ziel.id, numOr(p.x, ziel.x), numOr(p.z, ziel.z), p.y == null ? NaN : p.y);
    }
  }

  function entferne(id) {
    gitter.entferne(id);
    return ziele.delete(id);
  }

  const istAktiv = (ziel, wer) => (typeof ziel.aktivFn === 'function' ? !!ziel.aktivFn(wer, ziel) : !!ziel.aktivFn);

  /** Alle Kandidaten mit Wertung sammeln (gleiche Regeln für beste/inReichweite). */
  function kandidaten(wer, optReich, filter) {
    const liste = [];
    const suche = optReich !== undefined ? Math.max(optReich, 0) : maxReichweite;
    const yawOk = Number.isFinite(wer.yaw);
    const werY = Number.isFinite(wer.y);
    gitter.imUmkreis(wer.x, wer.z, suche, (e, rand) => {
      const ziel = e.daten;
      if (rand > (optReich !== undefined ? Math.min(optReich, ziel.reichweite) : ziel.reichweite)) return;
      if (werY && Number.isFinite(ziel.y) && Math.abs(wer.y - ziel.y) > hoehenToleranz) return;
      let winkel = 0;
      const dx = ziel.x - wer.x, dz = ziel.z - wer.z;
      if (yawOk && (dx !== 0 || dz !== 0)) {
        winkel = Math.abs(angleDiff(wer.yaw, Math.atan2(dx, dz)));
        if (rand > nahImmer && winkel > halbKegel) return;
      }
      if (!istAktiv(ziel, wer)) return;
      if (filter && !filter(ziel)) return;
      liste.push({ ziel, wert: rand + winkel * 0.6 - ziel.prio });
    });
    return liste;
  }

  const vergleich = (a, b) => a.wert - b.wert || a.ziel.nr - b.ziel.nr;

  function beste(wer, { reichweite: r, filter } = {}) {
    let best = null;
    for (const k of kandidaten(wer, r, filter)) if (!best || vergleich(k, best) < 0) best = k;
    return best ? best.ziel : null;
  }

  function inReichweite(wer, out = []) {
    out.length = 0;
    const l = kandidaten(wer).sort(vergleich);
    for (const k of l) out.push(k.ziel);
    return out;
  }

  function ausloesen(wer, ziel = beste(wer)) {
    if (!ziel || ziele.get(ziel.id) !== ziel || !istAktiv(ziel, wer)) return false;
    let ergebnis = ziel.aktion ? ziel.aktion(wer, ziel) : undefined;
    if (ergebnis === undefined) ergebnis = true;
    if (ereignisse) ereignisse.sende('interaktion', { wer, ziel, ergebnis });
    return ergebnis;
  }

  /** Gedrückt-halten bzw. Flanke. Liefert je wer dasselbe Objekt { ziel, anteil, fertig }. */
  function halte(wer, dt, gedrueckt) {
    let st = zustaende.get(wer);
    if (!st) zustaende.set(wer, st = { ziel: null, vorher: false, sperre: false, res: { ziel: null, anteil: 0, fertig: false } });
    const res = st.res;
    res.fertig = false;
    const ziel = beste(wer);
    res.ziel = ziel;
    if (!gedrueckt) {
      st.ziel = ziel; st.vorher = false; st.sperre = false; res.anteil = 0;
      return res;
    }
    if (!ziel) { st.ziel = null; st.vorher = true; res.anteil = 0; return res; }
    if (ziel.dauer <= 0) {
      if (!st.vorher) { ausloesen(wer, ziel); res.fertig = true; }
      st.vorher = true; st.ziel = ziel; res.anteil = 0;
      return res;
    }
    st.vorher = true;
    if (st.sperre) { st.ziel = ziel; res.anteil = 0; return res; }
    if (ziel !== st.ziel) res.anteil = 0;
    st.ziel = ziel;
    res.anteil = Math.min(1, res.anteil + numOr(dt, 0) / ziel.dauer);
    if (res.anteil >= 1) {
      st.sperre = true;
      res.fertig = true;
      ausloesen(wer, ziel);
    }
    return res;
  }

  return {
    melde, bewege, aktualisiere, entferne, beste, inReichweite, ausloesen, halte,
    hat: (id) => ziele.has(id),
    hole: (id) => ziele.get(id),
    get anzahl() { return ziele.size; },
    dispose() { ziele.clear(); gitter.dispose(); },
  };
}
