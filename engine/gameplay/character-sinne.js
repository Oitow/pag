/**
 * @modul    character-sinne
 * @zweck    NPC-Wahrnehmung ohne THREE: Sichtkegel (Winkel, Reichweite, Rundum-Nahbereich), Hören (Radius × Lautstärke), Sichtlinie über welt.bodenHoehe, Gedächtnis mit Verdacht und Vergessen
 * @api      createSinne({welt,sichtWeite,sichtWinkelGrad,nahRadius,hoerRadius,augenHoehe,zielHoehe,vergessenNach,entdeckZeit,sichtlinie}) -> {update(dt,selbst,ziele)->{gesehen,gehoert},siehtPunkt(selbst,p,faktor?),hoertPunkt(pos,quelle,laut?),sichtFrei(von,nach),geraeusch(x,z,laut?,id?),erinnerung(id),bekannte(),naechste(filter?),vergiss(id?),einstellungen,dispose()} ; imSichtkegel(pos,yaw,p,weite,winkelRad,nahRadius) -> bool
 * @beispiel
 *   import { createSinne } from '../../engine/gameplay/character-sinne.js';
 *   const sinne = createSinne({ welt, sichtWeite: 12, sichtWinkelGrad: 110, entdeckZeit: 0.8 });
 *   sinne.update(dt, motor.zustand, [{ id: 'spieler', x, y, z, laut: spielerRennt ? 1 : 0, versteckt: duckt ? 0.5 : 0 }]);
 *   const e = sinne.erinnerung('spieler'); if (e?.entdeckt) hirn.gehZu(e.x, e.z);
 * @tags     npc, ki, wahrnehmung, sicht, hoeren, gedaechtnis, schleichen, gameplay
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * selbst = Motor-Zustand ({ pos: {x,y,z}, yaw }) oder { x, y, z, yaw }.
 * Ziel = { id, x, y?, z, laut? (0…1, × hoerRadius), versteckt? (0…1, verkürzt die Sichtweite bis zur Hälfte), feind? … (wird durchgereicht) }.
 * Erinnerung = { id, x, y, z, alter (s seit letzter Wahrnehmung), art ('gesehen'|'gehoert'), sichtbar, verdacht (0…1), entdeckt, ziel }.
 */
import { clamp, numOr, angleDiff } from '../core/math.js';

/** Liegt p im Sichtkegel (nur Geometrie, ohne Sichtlinie)? winkelRad = voller Öffnungswinkel. */
export function imSichtkegel(pos, yaw, p, weite, winkelRad, nahRadius = 0) {
  const dx = p.x - pos.x, dz = p.z - pos.z, d = Math.hypot(dx, dz);
  if (d > weite) return false;
  if (d <= nahRadius || d < 1e-6) return true;
  return Math.abs(angleDiff(yaw, Math.atan2(dx, dz))) <= winkelRad / 2;
}

const STANDARD = {
  sichtWeite: 15, sichtWinkelGrad: 120, nahRadius: 1.5, hoerRadius: 8, augenHoehe: 1.6, zielHoehe: 1.2,
  vergessenNach: 10, entdeckZeit: 0, sichtlinie: true, verdachtAbbau: 0.25,
};

export function createSinne(opts = {}) {
  let welt = opts.welt || null;
  const E = Object.assign({}, STANDARD);
  for (const k of Object.keys(STANDARD)) if (opts[k] !== undefined) E[k] = typeof STANDARD[k] === 'boolean' ? !!opts[k] : Math.max(0, numOr(opts[k], STANDARD[k]));
  const gedaechtnis = new Map();
  const wahrnehmung = { gesehen: [], gehoert: [] };
  const geraeusche = [];
  const s = { x: 0, y: 0, z: 0, yaw: 0 }; // Scratch: selbst

  function leseSelbst(selbst) {
    const p = selbst?.pos || selbst || {};
    s.x = numOr(p.x, 0); s.y = numOr(p.y, 0); s.z = numOr(p.z, 0); s.yaw = numOr(selbst?.yaw, 0);
    return s;
  }

  /** Freie Sichtlinie von → nach ({x,y,z}); Gelände über welt.bodenHoehe, optional welt.sichtBlockiert(von,nach). */
  function sichtFrei(von, nach) {
    if (!welt) return true;
    if (typeof welt.sichtBlockiert === 'function' && welt.sichtBlockiert(von, nach)) return false;
    if (typeof welt.bodenHoehe !== 'function') return true;
    const dx = nach.x - von.x, dy = nach.y - von.y, dz = nach.z - von.z, d = Math.hypot(dx, dz);
    const n = clamp(Math.ceil(d / 0.5), 1, 64);
    for (let i = 1; i < n; i++) {
      const t = i / n, b = numOr(welt.bodenHoehe(von.x + dx * t, von.z + dz * t), -Infinity);
      if (b > von.y + dy * t) return false;
    }
    return true;
  }

  const auge = { x: 0, y: 0, z: 0 }, kopf = { x: 0, y: 0, z: 0 };
  /** Sieht `selbst` den Punkt p? faktor (0…1) skaliert die Sichtweite (Verstecken, Nebel, Nacht). */
  function siehtPunkt(selbst, p, faktor = 1) {
    const me = selbst === s ? s : leseSelbst(selbst);
    const weite = E.sichtWeite * clamp(numOr(faktor, 1), 0, 1);
    if (!imSichtkegel(me, me.yaw, p, weite, E.sichtWinkelGrad * Math.PI / 180, Math.min(E.nahRadius, weite))) return false;
    if (!E.sichtlinie) return true;
    auge.x = me.x; auge.y = me.y + E.augenHoehe; auge.z = me.z;
    kopf.x = p.x; kopf.z = p.z;
    kopf.y = Number.isFinite(+p.y) ? +p.y + E.zielHoehe : numOr(welt?.bodenHoehe?.(p.x, p.z), me.y) + E.zielHoehe;
    return sichtFrei(auge, kopf);
  }

  /** Hört man eine Quelle der Lautstärke laut (1 = hoerRadius)? */
  function hoertPunkt(pos, quelle, laut = 1) {
    const p = pos?.pos || pos;
    const l = numOr(laut, 0);
    if (!(l > 0)) return false;
    return Math.hypot(quelle.x - p.x, quelle.z - p.z) <= E.hoerRadius * l;
  }

  function merke(id, x, y, z, art, ziel) {
    let e = gedaechtnis.get(id);
    if (!e) { e = { id, x, y, z, alter: 0, art, sichtbar: false, verdacht: 0, entdeckt: false, ziel: null }; gedaechtnis.set(id, e); }
    e.x = x; e.y = y; e.z = z; e.alter = 0; e.art = art; if (ziel) e.ziel = ziel;
    return e;
  }

  function update(dt, selbst, ziele = []) {
    dt = clamp(numOr(dt, 0), 0, 60);
    const me = leseSelbst(selbst);
    wahrnehmung.gesehen.length = 0; wahrnehmung.gehoert.length = 0;
    for (const e of gedaechtnis.values()) { e.alter += dt; e.sichtbar = false; }
    for (const z of ziele || []) {
      if (!z || z.id === undefined || !Number.isFinite(+z.x + +z.z)) continue;
      const faktor = 1 - 0.5 * clamp(numOr(z.versteckt, 0), 0, 1);
      if (siehtPunkt(me, z, faktor)) {
        const e = merke(z.id, +z.x, numOr(z.y, me.y), +z.z, 'gesehen', z);
        e.sichtbar = true; e.alter = 0;
        // näher = schneller entdeckt; im Nahbereich sofort
        const d = Math.hypot(z.x - me.x, z.z - me.z);
        const rate = E.entdeckZeit > 0 ? (d <= E.nahRadius ? Infinity : (1.5 - d / (E.sichtWeite * faktor || 1)) / E.entdeckZeit) : Infinity;
        e.verdacht = Math.min(1, e.verdacht + rate * dt);
        if (e.verdacht >= 1) e.entdeckt = true;
        wahrnehmung.gesehen.push(z.id);
      } else if (hoertPunkt(me, z, numOr(z.laut, 0))) {
        const e = merke(z.id, +z.x, numOr(z.y, me.y), +z.z, 'gehoert', z);
        e.verdacht = Math.max(e.verdacht, 0.5);
        wahrnehmung.gehoert.push(z.id);
      }
    }
    for (const g of geraeusche) {
      if (!hoertPunkt(me, g, g.laut)) continue;
      const e = merke(g.id, g.x, me.y, g.z, 'gehoert', null);
      e.verdacht = Math.max(e.verdacht, 0.5);
      wahrnehmung.gehoert.push(g.id);
    }
    geraeusche.length = 0;
    for (const [id, e] of gedaechtnis) {
      if (!e.sichtbar && e.alter > 0) e.verdacht = Math.max(0, e.verdacht - E.verdachtAbbau * dt * (e.entdeckt ? 0 : 1));
      if (e.alter > E.vergessenNach) gedaechtnis.delete(id);
    }
    return wahrnehmung;
  }

  /** Erinnerung mit kleinstem Alter (bei Gleichstand: nächste). filter(e) optional, z. B. e => e.entdeckt. */
  function naechste(filter) {
    let best = null;
    for (const e of gedaechtnis.values()) {
      if (filter && !filter(e)) continue;
      if (!best || e.alter < best.alter - 1e-9 || (Math.abs(e.alter - best.alter) < 1e-9 && Math.hypot(e.x - s.x, e.z - s.z) < Math.hypot(best.x - s.x, best.z - s.z))) best = e;
    }
    return best;
  }

  return {
    einstellungen: E, update, siehtPunkt, hoertPunkt, sichtFrei, naechste,
    /** Einmaliges Geräusch (z. B. Explosion, Ruf); wird beim nächsten update ausgewertet. */
    geraeusch(x, z, laut = 1, id = 'geraeusch') { if (Number.isFinite(+x + +z)) geraeusche.push({ x: +x, z: +z, laut: numOr(laut, 1), id }); },
    erinnerung(id) { return gedaechtnis.get(id) || null; },
    bekannte() { return [...gedaechtnis.values()]; },
    vergiss(id) { if (id === undefined) gedaechtnis.clear(); else gedaechtnis.delete(id); },
    dispose() { gedaechtnis.clear(); geraeusche.length = 0; welt = null; },
  };
}
