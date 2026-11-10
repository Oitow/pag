/**
 * @modul    ereignisse
 * @zweck    Event-Bus mit Prioritäten, einmaligen Hörern, Platzhalter '*' und Warteschlange für deterministische Reihenfolge
 * @api      createEreignisse({fehler}) -> {an(name,fn,{einmal,prio})->abmelden,einmal(name,fn),aus(name,fn),sende(name,daten)->anzahl,spaeter(name,daten),leeren()->anzahl,hoerer(name)->anzahl,dispose()}
 * @beispiel
 *   import { createEreignisse } from '../../engine/core/ereignisse.js';
 *   const e = createEreignisse();
 *   const ab = e.an('treffer', (d) => console.log(d.schaden));
 *   e.sende('treffer', { schaden: 3 });
 *   e.spaeter('tod', { wer: 'ork' }); e.leeren();
 *   ab();
 * @tags     ereignis, event, bus, nachricht, gameplay
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 */

const MAX_LEEREN = 10000;

export function createEreignisse({ fehler } = {}) {
  const karte = new Map(); // name -> [{ fn, einmal, prio, nr, aktiv }]
  let zaehler = 0;
  let warteschlange = [];

  function an(name, fn, { einmal = false, prio = 0 } = {}) {
    const h = { fn, einmal, prio, nr: zaehler++, aktiv: true };
    if (!karte.has(name)) karte.set(name, []);
    karte.get(name).push(h);
    return () => entferne(name, h);
  }

  function entferne(name, h) {
    h.aktiv = false;
    const liste = karte.get(name);
    if (!liste) return;
    const i = liste.indexOf(h);
    if (i >= 0) liste.splice(i, 1);
    if (!liste.length) karte.delete(name);
  }

  function einmalAn(name, fn) { return an(name, fn, { einmal: true }); }

  function aus(name, fn) {
    const liste = karte.get(name);
    if (!liste) return;
    for (const h of [...liste]) if (h.fn === fn) entferne(name, h);
  }

  function sende(name, daten) {
    const liste = [...(karte.get(name) || [])];
    if (name !== '*' && karte.has('*')) liste.push(...karte.get('*'));
    liste.sort((a, b) => (b.prio - a.prio) || (a.nr - b.nr));
    let aufgerufen = 0;
    let ersterFehler;
    let hatFehler = false;
    for (const h of liste) {
      if (!h.aktiv) continue;
      if (h.einmal) h.aktiv = false, entferneEinmal(h);
      aufgerufen++;
      try {
        h.fn(daten, name);
      } catch (e) {
        if (fehler) fehler(e, name);
        else if (!hatFehler) { hatFehler = true; ersterFehler = e; }
      }
    }
    if (hatFehler) throw ersterFehler;
    return aufgerufen;
  }

  function entferneEinmal(h) {
    for (const [name, liste] of karte) {
      const i = liste.indexOf(h);
      if (i >= 0) { liste.splice(i, 1); if (!liste.length) karte.delete(name); return; }
    }
  }

  function spaeter(name, daten) { warteschlange.push([name, daten]); }

  function leeren() {
    let n = 0;
    let ersterFehler;
    let hatFehler = false;
    while (warteschlange.length && n < MAX_LEEREN) {
      const [name, daten] = warteschlange.shift();
      n++;
      try { sende(name, daten); } catch (e) { if (!hatFehler) { hatFehler = true; ersterFehler = e; } }
    }
    if (hatFehler) throw ersterFehler;
    return n;
  }

  function hoerer(name) {
    return (karte.get(name) || []).length;
  }

  function dispose() {
    for (const liste of karte.values()) for (const h of liste) h.aktiv = false;
    karte.clear();
    warteschlange = [];
  }

  return { an, einmal: einmalAn, aus, sende, spaeter, leeren, hoerer, dispose };
}
