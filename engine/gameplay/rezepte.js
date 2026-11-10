/**
 * @modul    rezepte
 * @zweck    Herstellen: Rezepte als Daten (Zutaten → Ergebnis, optional Werkzeug und Station), prüfen was mit einem Inventar möglich ist und sicher herstellen (alles oder nichts)
 * @api      createRezepte({gegenstaende,ereignisse}) -> {definiere(id,{zutaten,ergebnis,werkzeug,station,dauer,name}),definiereAlle({id:daten}),hole(id),alle(),pruefe(id,inventar,{stationen}?)->{ok,grund,fehlt},moeglich(inventar,{stationen}?)->[rezept],stelleHer(id,inventar,{stationen,wer}?)->{id,anzahl}|null,dispose()}
 * @beispiel
 *   import { createRezepte } from '../../engine/gameplay/rezepte.js';
 *   const rezepte = createRezepte({ gegenstaende });
 *   rezepte.definiere('axt', { zutaten: { holz: 2, stein: 1 }, ergebnis: 'axt' });
 *   const p = rezepte.pruefe('axt', inventar);          // { ok: false, grund: 'zutaten', fehlt: { stein: 1 } }
 *   if (p.ok) rezepte.stelleHer('axt', inventar);       // nimmt Zutaten, legt die Axt ins Inventar
 * @tags     rezept, herstellen, crafting, werkbank, zutaten, inventar, gameplay
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Rezept: { id, name, zutaten {id: anzahl}, ergebnis {id, anzahl, daten?}, werkzeug [id oder Tag, wird nicht verbraucht],
 *           station (Text oder null), dauer (Sekunden, nur Angabe fürs Spiel) }.
 * grund: null | 'unbekannt' | 'station' | 'werkzeug' | 'zutaten' | 'platz' (nur bei stelleHer, dann bleibt das Inventar unverändert).
 * Hat der Gegenstand im Register eine `haltbarkeit`, bekommt das Ergebnis automatisch daten { haltbarkeit } (siehe gameplay/hand).
 * Ereignis: 'hergestellt' { rezept, id, anzahl, wer }.
 */

export function createRezepte({ gegenstaende = null, ereignisse = null } = {}) {
  const rezepte = new Map();

  function definiere(id, { zutaten = {}, ergebnis = id, werkzeug = [], station = null, dauer = 0, name = null } = {}) {
    if (typeof id !== 'string' || !id) throw new Error(`rezept: ungültige id (${String(id)})`);
    if (rezepte.has(id)) throw new Error(`rezept '${id}' ist bereits definiert`);
    const e = typeof ergebnis === 'string' ? { id: ergebnis, anzahl: 1 } : { anzahl: 1, ...ergebnis };
    const z = {};
    for (const [zid, n] of Object.entries(zutaten)) if (n >= 1) z[zid] = Math.floor(n);
    if (gegenstaende) {
      for (const gid of [e.id, ...Object.keys(z)]) if (!gegenstaende.hat(gid)) throw new Error(`rezept '${id}': unbekannter Gegenstand '${gid}'`);
    }
    const rezept = Object.freeze({
      id, name: name ?? gegenstaende?.hole(e.id)?.name ?? id, zutaten: Object.freeze(z), ergebnis: Object.freeze(e),
      werkzeug: Object.freeze([].concat(werkzeug)), station, dauer,
    });
    rezepte.set(id, rezept);
    return rezept;
  }

  function definiereAlle(objekt) {
    for (const [id, daten] of Object.entries(objekt || {})) definiere(id, daten);
  }

  /** Liegt ein Gegenstand mit dieser id oder diesem Tag im Inventar? */
  function hatWerkzeug(inventar, w) {
    for (const s of inventar.plaetze) {
      if (!s) continue;
      if (s.id === w || gegenstaende?.hole(s.id)?.tags?.includes(w)) return true;
    }
    return false;
  }

  function pruefe(id, inventar, { stationen = [] } = {}) {
    const r = rezepte.get(id);
    if (!r) return { ok: false, grund: 'unbekannt', fehlt: {} };
    const fehlt = {};
    let grund = null;
    for (const [zid, n] of Object.entries(r.zutaten)) {
      const hat = inventar.zaehle(zid);
      if (hat < n) { fehlt[zid] = n - hat; grund = 'zutaten'; }
    }
    for (const w of r.werkzeug) if (!hatWerkzeug(inventar, w)) { grund = 'werkzeug'; break; }
    if (r.station && !stationen.includes(r.station)) grund = 'station';
    return { ok: !grund, grund, fehlt };
  }

  const moeglich = (inventar, opts) => [...rezepte.values()].filter((r) => pruefe(r.id, inventar, opts).ok);

  function stelleHer(id, inventar, opts = {}) {
    if (!pruefe(id, inventar, opts).ok) return null;
    const r = rezepte.get(id), e = r.ergebnis;
    const vorher = inventar.zustand();
    for (const [zid, n] of Object.entries(r.zutaten)) inventar.nimm(zid, n);
    const haltbar = gegenstaende?.hole(e.id)?.haltbarkeit;
    const daten = e.daten ?? (haltbar > 0 ? { haltbarkeit: haltbar } : undefined);
    let rest = 0;
    if (daten) for (let k = 0; k < e.anzahl; k++) rest += inventar.gib(e.id, 1, daten);
    else rest = inventar.gib(e.id, e.anzahl);
    if (rest > 0) { inventar.lade(vorher); return null; }   // kein Platz → nichts ist passiert
    ereignisse?.sende('hergestellt', { rezept: id, id: e.id, anzahl: e.anzahl, wer: opts.wer ?? null });
    return { id: e.id, anzahl: e.anzahl };
  }

  return {
    definiere, definiereAlle, pruefe, moeglich, stelleHer,
    hole: (id) => rezepte.get(id),
    alle: () => [...rezepte.values()],
    dispose() { rezepte.clear(); },
  };
}
