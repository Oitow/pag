/**
 * @modul    rohstoffe
 * @zweck    Abbaubare Quellen (Baum, Fels, Busch) ohne THREE: Beute per Seed, Werkzeug nötig oder nur schneller, Abnutzung, Nachwachsen nach Spielzeit, Speichern/Laden
 * @api      createRohstoffe({arten,seed,ereignisse,onWeg,onDa,warte}) -> {definiere(art,daten),hole(art),pruefe(art,werkzeug?)->{ok,grund,dauer,passt},baueAb(schluessel,art,{werkzeug,jetzt,wer}?)->{beute,abnutzung,reif}|null,istWeg(schluessel),update(jetzt)->anzahl,anzahl,zustand(),lade(stand),dispose()}
 * @beispiel
 *   import { createRohstoffe } from '../../engine/gameplay/rohstoffe.js';
 *   const roh = createRohstoffe({ seed, onWeg: (k) => verstecke(k), onDa: (k) => zeige(k),
 *     arten: { baum: { gibt: [{ id: 'holz', min: 2, max: 4 }], dauer: 1.5, werkzeug: 'axt', ohneFaktor: 3, nachwachsen: 2 } } });
 *   const p = roh.pruefe('baum', hand.eintrag());                       // { ok, dauer, passt }
 *   const erg = roh.baueAb(baumIndex, 'baum', { werkzeug: hand.eintrag(), jetzt: uhr.tag + uhr.stunde / 24 });
 *   // erg.beute → in die Welt werfen; erg.abnutzung → hand.nutzeAb(…);   je Bild: roh.update(jetzt)
 * @tags     rohstoff, abbauen, faellen, nachwachsen, werkzeug, beute, gameplay
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Art: { gibt [{id, min, max, chance}], dauer (s), werkzeug (Tag oder id, optional), noetig (ohne passendes Werkzeug geht nichts),
 *        ohneFaktor (so viel länger ohne Werkzeug, Standard 3), abnutzung (je Abbau, Standard 1), nachwachsen (Zeit-Einheiten, 0 = nie), text }.
 * werkzeug = Register-Eintrag des Gegenstands in der Hand ({ id, tags, tempo }) oder null. `tempo` teilt die Dauer.
 * `jetzt` ist eine beliebige, wachsende Spielzeit (z. B. Tage als Kommazahl) – dieselbe Einheit wie `nachwachsen`.
 * onDa(schluessel, art) darf false liefern („gerade steht jemand dort“) → neuer Versuch nach `warte` Zeit-Einheiten.
 * Ereignisse: 'abgebaut' { schluessel, art, beute, wer }, 'nachgewachsen' { schluessel, art }.
 */
import { rng, hashSeed, int } from '../core/rng.js';

export function createRohstoffe({ arten = {}, seed = 1, ereignisse = null, onWeg = null, onDa = null, warte = 0.02 } = {}) {
  const r = rng(hashSeed('rohstoffe', seed));
  const katalog = new Map();
  const weg = new Map();   // schluessel → { art, reif }  (reif = Infinity: wächst nie nach)

  function definiere(art, daten = {}) {
    const a = Object.freeze({ gibt: [], dauer: 1, werkzeug: null, noetig: false, ohneFaktor: 3, abnutzung: 1, nachwachsen: 0, text: 'Abbauen', ...daten, art });
    katalog.set(art, a);
    return a;
  }
  for (const [art, daten] of Object.entries(arten)) definiere(art, daten);

  const passtWerkzeug = (a, w) => !!a.werkzeug && !!w && (w.id === a.werkzeug || !!w.tags?.includes(a.werkzeug));

  function pruefe(art, werkzeug = null) {
    const a = katalog.get(art);
    if (!a) return { ok: false, grund: 'unbekannt', dauer: 0, passt: false };
    const passt = passtWerkzeug(a, werkzeug);
    if (a.noetig && !passt) return { ok: false, grund: 'werkzeug', dauer: 0, passt };
    const dauer = !a.werkzeug ? a.dauer : passt ? a.dauer / (werkzeug.tempo > 0 ? werkzeug.tempo : 1) : a.dauer * a.ohneFaktor;
    return { ok: true, grund: null, dauer, passt };
  }

  function baueAb(schluessel, art, { werkzeug = null, jetzt = 0, wer = null } = {}) {
    const p = pruefe(art, werkzeug);
    if (!p.ok || weg.has(schluessel)) return null;
    const a = katalog.get(art);
    const beute = [];
    for (const g of a.gibt) {
      if (g.chance !== undefined && r() >= g.chance) continue;
      const min = g.min ?? g.anzahl ?? 1, n = int(r, min, Math.max(min, g.max ?? min));
      if (n > 0) beute.push({ id: g.id, anzahl: n });
    }
    const reif = a.nachwachsen > 0 ? jetzt + a.nachwachsen : Infinity;
    weg.set(schluessel, { art, reif });
    onWeg?.(schluessel, art);
    ereignisse?.sende('abgebaut', { schluessel, art, beute, wer });
    return { beute, abnutzung: p.passt ? a.abnutzung : 0, reif };
  }

  /** Lässt alles Fällige nachwachsen. Liefert, wie viele Quellen wieder da sind. */
  function update(jetzt) {
    let n = 0;
    for (const [schluessel, e] of weg) {
      if (e.reif > jetzt) continue;
      if (onDa?.(schluessel, e.art) === false) { e.reif = jetzt + warte; continue; }
      weg.delete(schluessel); n++;
      ereignisse?.sende('nachgewachsen', { schluessel, art: e.art });
    }
    return n;
  }

  /** Reines JSON: [[schluessel, art, reif|null], …]  (null = wächst nie nach) */
  const zustand = () => [...weg].map(([k, e]) => [k, e.art, Number.isFinite(e.reif) ? Math.round(e.reif * 1000) / 1000 : null]);

  function lade(stand) {
    weg.clear();
    for (const e of Array.isArray(stand) ? stand : []) {
      if (!Array.isArray(e) || weg.has(e[0])) continue;
      weg.set(e[0], { art: e[1], reif: typeof e[2] === 'number' ? e[2] : Infinity });
      onWeg?.(e[0], e[1]);
    }
  }

  return {
    definiere, pruefe, baueAb, update, zustand, lade,
    hole: (art) => katalog.get(art),
    istWeg: (schluessel) => weg.has(schluessel),
    get anzahl() { return weg.size; },
    dispose() { weg.clear(); katalog.clear(); },
  };
}
