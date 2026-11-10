/**
 * @modul    welt-dinge
 * @zweck    Gegenstände, die in der Welt liegen (ohne THREE): ablegen, werfen, aufheben ins Inventar, gleiche Stapel in der Nähe zusammenlegen, Lebensdauer, Speichern/Laden – verbindet Physik (koerper), Interaktion und Inventar
 * @api      createWeltDinge({physik,interaktion,register,ereignisse,lebensdauer,sammelRadius,onNeu,onWeg}) -> {lege(id,anzahl,pos,{vel,daten,alter}?)->ding,wirf(id,anzahl,von,yaw,{tempo,hoch,streuung}?)->ding,nimm(ding,inventar)->anzahl,entferne(ding),update(dt),alle(),anzahl,zustand(),lade(stand),dispose()}
 * @beispiel
 *   import { createWeltDinge } from '../../engine/gameplay/welt-dinge.js';
 *   const dinge = createWeltDinge({ physik, interaktion, register: gegenstaende, onNeu: (d) => zeige(d), onWeg: (d) => verstecke(d) });
 *   dinge.wirf('holz', 3, held.zustand.pos, held.zustand.yaw);       // fällt, rollt aus, lässt sich mit der Interaktion aufheben
 *   // je Bild: physik.update(dt); dinge.update(dt);   Position zum Zeichnen: ding.koerper.pos
 * @tags     gegenstand, beute, aufheben, ablegen, werfen, inventar, welt, gameplay
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Ding: { nr, id, anzahl, daten, alter, koerper (aus engine/gameplay/koerper.js) }.
 * Register-Einträge dürfen die Physik bestimmen: { radius, sprung, reibung, haftung, auftrieb, name, stapel }.
 * Aufheben läuft über die Interaktion: das Ziel ruft nimm(ding, wer.inventar) – `wer` braucht also ein Feld `inventar`.
 * Ereignisse (falls Bus gesetzt): 'ding:neu' { ding }, 'ding:aufgehoben' { wer, id, anzahl, rest }, 'ding:weg' { ding }.
 */
import { numOr } from '../core/math.js';
import { hash2 } from '../core/rng.js';

export function createWeltDinge({ physik, interaktion = null, register = null, ereignisse = null, lebensdauer = 600, sammelRadius = 0.6, onNeu = null, onWeg = null } = {}) {
  if (!physik || typeof physik.neu !== 'function') throw new Error('createWeltDinge: physik (createKoerperWelt) fehlt');
  const liste = [];
  let naechsteNr = 1, wuerfe = 0, pruefZeit = 0;
  const def = (id) => register?.hole(id);
  const zielId = (d) => 'ding:' + d.nr;
  const text = (d) => (def(d.id)?.name ?? d.id) + (d.anzahl > 1 ? ' ×' + d.anzahl : '');

  function melde(d) {
    interaktion?.melde(zielId(d), {
      pos: () => d.koerper.pos, radius: d.koerper.radius, art: 'ding', text: text(d), daten: d,
      aktion: (wer) => nimm(d, wer?.inventar, wer),
    });
  }

  function lege(id, anzahl = 1, pos, { vel, daten, alter = 0 } = {}) {
    anzahl = Math.floor(numOr(anzahl, 0));
    if (anzahl <= 0 || !pos || (register && !register.hat(id))) return null;
    const g = def(id) || {};
    const d = { nr: naechsteNr++, id, anzahl, daten, alter: numOr(alter, 0), koerper: null };
    d.koerper = physik.neu({ pos, vel, radius: g.radius ?? 0.15, sprung: g.sprung, reibung: g.reibung, haftung: g.haftung, auftrieb: g.auftrieb, daten: d });
    liste.push(d);
    melde(d);
    onNeu?.(d);
    ereignisse?.sende('ding:neu', { ding: d });
    return d;
  }

  /** Aus Hüfthöhe nach vorn werfen (yaw: 0 = +z). Streuung per laufendem Zähler → deterministisch. */
  function wirf(id, anzahl, von, yaw = 0, { tempo = 3.5, hoch = 3, streuung = 0.5, hoehe = 1 } = {}) {
    const n = wuerfe++;
    const w = yaw + (hash2(n, 17, 9001) - 0.5) * streuung, t = tempo * (0.8 + hash2(n, 23, 9001) * 0.4);
    return lege(id, anzahl, { x: von.x + Math.sin(yaw) * 0.4, y: numOr(von.y, 0) + hoehe, z: von.z + Math.cos(yaw) * 0.4 },
      { vel: { x: Math.sin(w) * t, y: hoch, z: Math.cos(w) * t } });
  }

  function entferne(d) {
    const i = liste.indexOf(d);
    if (i < 0) return false;
    liste.splice(i, 1);
    physik.entferne(d.koerper);
    interaktion?.entferne(zielId(d));
    onWeg?.(d);
    ereignisse?.sende('ding:weg', { ding: d });
    return true;
  }

  /** Ding ins Inventar legen. Liefert die aufgenommene Anzahl; passt nicht alles, bleibt der Rest liegen. */
  function nimm(d, inventar, wer) {
    if (!d || !inventar || !liste.includes(d)) return 0;
    const rest = d.daten === undefined ? inventar.gib(d.id, d.anzahl) : inventar.gib(d.id, d.anzahl, d.daten);
    const genommen = d.anzahl - numOr(rest, d.anzahl);
    if (genommen <= 0) return 0;
    const id = d.id;
    if (rest > 0) { d.anzahl = rest; melde(d); } else entferne(d);
    ereignisse?.sende('ding:aufgehoben', { wer, id, anzahl: genommen, rest });
    return genommen;
  }

  function stapelGrenze(id) { return def(id)?.stapel ?? Infinity; }

  function update(dt) {
    dt = Math.max(0, numOr(dt, 0));
    for (let i = liste.length - 1; i >= 0; i--) {
      const d = liste[i];
      d.alter += dt;
      if (d.alter >= lebensdauer) entferne(d);
    }
    // gleiche, ruhende Stapel in der Nähe zusammenlegen (ein paar Mal je Sekunde reicht)
    if ((pruefZeit -= dt) > 0 || sammelRadius <= 0) return;
    pruefZeit = 0.25;
    for (let i = 0; i < liste.length; i++) {
      const a = liste[i];
      if (!a.koerper.ruht || a.daten !== undefined) continue;
      for (let j = liste.length - 1; j > i; j--) {
        const b = liste[j];
        if (b.id !== a.id || !b.koerper.ruht || b.daten !== undefined || a.anzahl + b.anzahl > stapelGrenze(a.id)) continue;
        const p = a.koerper.pos, q = b.koerper.pos;
        if (Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) > sammelRadius) continue;
        a.anzahl += b.anzahl; a.alter = Math.min(a.alter, b.alter);
        entferne(b); melde(a);
      }
    }
  }

  /** Reines JSON: [[id, anzahl, x, y, z, alter, daten?], …] */
  function zustand() {
    const r = (v) => Math.round(v * 100) / 100;
    return liste.map((d) => { const p = d.koerper.pos, e = [d.id, d.anzahl, r(p.x), r(p.y), r(p.z), Math.round(d.alter)]; if (d.daten !== undefined) e.push(d.daten); return e; });
  }
  function lade(stand) {
    while (liste.length) entferne(liste[liste.length - 1]);
    if (!Array.isArray(stand)) return 0;
    for (const e of stand) {
      if (!Array.isArray(e) || typeof e[0] !== 'string' || ![e[2], e[3], e[4]].every(Number.isFinite)) continue;
      lege(e[0], e[1], { x: e[2], y: e[3], z: e[4] }, { daten: e[6], alter: e[5] });
    }
    return liste.length;
  }

  return {
    lege, wirf, nimm, entferne, update, zustand, lade,
    alle: () => liste,
    get anzahl() { return liste.length; },
    dispose() { while (liste.length) entferne(liste[liste.length - 1]); },
  };
}
