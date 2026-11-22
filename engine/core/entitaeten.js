/**
 * @modul    entitaeten
 * @zweck    Mehrspieler-Fundament: Entitäten (Spieler, Gegner, NPCs, Dinge) mit stabilen, deterministischen IDs ('g:12'), Team, Position, Leben und Daten – räumliche Abfrage, Ereignisse, kompakter Zustand und Änderungs-Zähler für spätere Netz-Deltas
 * @api      createEntitaeten({ereignisse,zelle,praefixe}) -> { neu({id?,art,team,pos,radius,leben,lebenMax,name,daten})->id, hole(id), entferne(id), bewege(id,x,y,z)->bool, aendere(id,felder), markiere(id), leben(id,delta,{quelle,element,krit,stoss})->echt, belebe(id,anteil), imUmkreis(x,z,r,{team,ausser,art,tote},out?)->[ent], naechster(x,z,r,filter), alle(), anzahl, takt, aenderungenSeit(takt)->{takt,geaendert,weg}, kompakt(ent), zustand(), lade(z), dispose() }
 * @beispiel
 *   import { createEntitaeten } from '../../engine/core/entitaeten.js';
 *   const ents = createEntitaeten({ ereignisse });               // ereignisse: core/ereignisse (optional)
 *   const id = ents.neu({ art: 'gegner', team: 'feind', pos: { x: 3, y: 0, z: 4 }, leben: 12, name: 'Ratte' });   // 'g:1'
 *   ents.leben(id, -5, { quelle: 's:2', element: 'feuer' });     // → ent:treffer, bei 0 → ent:tod
 *   const nah = ents.imUmkreis(0, 0, 10, { team: 'feind' });
 *   const delta = ents.aenderungenSeit(letzterTakt);            // { takt, geaendert:[kompakt…], weg:[id…] }
 * @tags     entitaet, id, mehrspieler, mmo, netz, delta, leben, team, raum, gameplay
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * Entität: { id, art: 'spieler'|'gegner'|'npc'|'ding', team: 'spieler'|'feind'|'freund', pos:{x,y,z}, radius, leben, lebenMax, lebt,
 *   name, daten (reine Daten! werte: kampf-werte, hoehe: m für Anzeigen …), v (Änderungs-Takt) }.
 * IDs: Kürzel der Art + ':' + laufende Nummer (ein Zähler für alle) → gleiche Reihenfolge von neu() = gleiche IDs.
 * takt zählt jede Änderung (neu, bewegen, Leben, aendere, weg). Jede Entität merkt sich in v den Takt ihrer letzten Änderung.
 * Ereignisse: ent:neu {id} · ent:treffer {id,menge,element,quelle,pos,krit,stoss} · ent:heil {id,menge,quelle} · ent:tod {id,quelle} · ent:weg {id}
 */
import { createRaumGitter } from './raum-gitter.js';

const PRAEFIXE = { spieler: 's', gegner: 'g', npc: 'n', ding: 'd' };
const WEG_MAX = 512;        // so viele Entfernungen merkt sich aenderungenSeit()
const r2 = (v) => Math.round(v * 100) / 100;

export function createEntitaeten({ ereignisse = null, zelle = 8, praefixe = PRAEFIXE } = {}) {
  const gitter = createRaumGitter({ zelle });
  const map = new Map();           // id → Entität (Einfüge-Reihenfolge = deterministisch)
  const wegLog = [];               // [takt, id]
  let naechste = 1, takt = 0;
  const sende = (n, d) => { if (ereignisse) ereignisse.sende(n, d); };
  const markiere = (e) => { e.v = ++takt; return e; };

  function neu({ id = null, art = 'ding', team = 'freund', pos = null, radius = 0.4, leben = 1, lebenMax = null, name = '', daten = {} } = {}) {
    if (id == null) {
      id = `${praefixe[art] || String(art)[0] || 'e'}:${naechste++}`;
      while (map.has(id)) id = `${praefixe[art] || String(art)[0] || 'e'}:${naechste++}`;
    } else if (map.has(id)) throw new Error(`entitaeten: ID „${id}“ gibt es schon`);
    const lm = Math.max(1, +(lebenMax ?? leben) || 1);
    const e = { id, art, team, pos: { x: +pos?.x || 0, y: +pos?.y || 0, z: +pos?.z || 0 }, radius: Math.max(0, +radius || 0),
      leben: Math.min(lm, Math.max(0, +leben || 0)), lebenMax: lm, lebt: true, name, daten: daten || {}, v: 0 };
    e.lebt = e.leben > 0;
    map.set(id, markiere(e));
    gitter.setze(id, e.pos.x, e.pos.z, e.radius, e);
    sende('ent:neu', { id });
    return id;
  }

  function entferne(id) {
    const e = map.get(id);
    if (!e) return false;
    map.delete(id); gitter.entferne(id);
    wegLog.push([++takt, id]);
    if (wegLog.length > WEG_MAX) wegLog.splice(0, wegLog.length - WEG_MAX);
    sende('ent:weg', { id });
    return true;
  }

  /** Verschieben; unter 1 cm Bewegung zählt nicht als Änderung. */
  function bewege(id, x, y, z) {
    const e = map.get(id);
    if (!e || !Number.isFinite(x) || !Number.isFinite(z)) return false;
    y = Number.isFinite(y) ? y : e.pos.y;
    if (Math.abs(x - e.pos.x) + Math.abs(y - e.pos.y) + Math.abs(z - e.pos.z) < 0.01) return false;
    e.pos.x = x; e.pos.y = y; e.pos.z = z;
    gitter.setze(id, x, z);
    markiere(e);
    return true;
  }

  /** Felder setzen (team, name, radius, daten-Teile …) und als Änderung markieren. */
  function aendere(id, felder = {}) {
    const e = map.get(id);
    if (!e) return null;
    for (const k of Object.keys(felder)) {
      if (k === 'id' || k === 'pos' || k === 'v') continue;
      if (k === 'daten') Object.assign(e.daten, felder.daten); else e[k] = felder[k];
    }
    if ('radius' in felder) gitter.setze(id, e.pos.x, e.pos.z, e.radius);
    if ('pos' in felder) bewege(id, felder.pos.x, felder.pos.y, felder.pos.z);
    return markiere(e);
  }

  /** Leben ändern (delta < 0 Schaden, > 0 Heilung). Liefert die echte Änderung (Betrag). Tote nehmen nichts mehr. */
  function leben(id, delta, { quelle = null, element = null, krit = false, stoss = null } = {}) {
    const e = map.get(id);
    if (!e || !e.lebt || !Number.isFinite(delta) || delta === 0) return 0;
    const vorher = e.leben;
    e.leben = Math.min(e.lebenMax, Math.max(0, e.leben + delta));
    const echt = Math.abs(e.leben - vorher);
    if (!echt) return 0;
    markiere(e);
    if (delta < 0) {
      sende('ent:treffer', { id, menge: echt, element, quelle, pos: { ...e.pos }, krit, stoss });
      if (e.leben <= 0) { e.lebt = false; sende('ent:tod', { id, quelle }); }
    } else sende('ent:heil', { id, menge: echt, quelle });
    return echt;
  }

  /** Wiederbeleben mit Anteil des Höchstlebens. */
  function belebe(id, anteil = 1) {
    const e = map.get(id);
    if (!e || e.lebt) return false;
    e.leben = Math.max(1, Math.round(e.lebenMax * anteil)); e.lebt = true;
    markiere(e);
    return true;
  }

  const passt = (e, f) => (!f.team || e.team === f.team) && (!f.art || e.art === f.art) && (!f.ausser || e.id !== f.ausser) && (f.tote || e.lebt);

  /** Alle im Umkreis (Rand berührt den Kreis), nach Abstand sortiert. filter: { team, art, ausser (id), tote (auch Tote) }. */
  function imUmkreis(x, z, r, filter = {}, out = []) {
    out.length = 0;
    const ab = [];
    gitter.imUmkreis(x, z, r, (g, d) => { if (passt(g.daten, filter)) { out.push(g.daten); ab.push(d); } });
    if (out.length > 1) {
      const idx = out.map((_, i) => i).sort((a, b) => ab[a] - ab[b] || (out[a].id < out[b].id ? -1 : 1));
      const kopie = idx.map((i) => out[i]);
      for (let i = 0; i < kopie.length; i++) out[i] = kopie[i];
    }
    return out;
  }
  function naechster(x, z, r, filter = {}) { return imUmkreis(x, z, r, filter)[0] || null; }

  /** Kompakte Form fürs Netz/Speichern: [id, art, team, x, y, z, radius, leben, lebenMax, name, daten]. */
  const kompakt = (e) => [e.id, e.art, e.team, r2(e.pos.x), r2(e.pos.y), r2(e.pos.z), e.radius, e.leben, e.lebenMax, e.name, e.daten];

  /** Was hat sich seit takt geändert? → { takt (jetzt), geaendert: [kompakt…], weg: [id…], voll (Log reicht nicht → alles neu) }. */
  function aenderungenSeit(seit = 0) {
    const geaendert = [], weg = [];
    for (const e of map.values()) if (e.v > seit) geaendert.push(kompakt(e));
    for (const [t, id] of wegLog) if (t > seit && !map.has(id)) weg.push(id);
    const voll = wegLog.length >= WEG_MAX && wegLog[0][0] > seit;
    return { takt, geaendert, weg, voll };
  }

  function ausKompakt(k) {
    const [id, art, team, x, y, z, radius, lb, lebenMax, name, daten] = k;
    const e = map.get(id);
    if (e) { e.art = art; e.team = team; e.radius = radius; e.lebenMax = lebenMax; e.leben = lb; e.lebt = lb > 0; e.name = name; e.daten = daten || {};
      e.pos.x = x; e.pos.y = y; e.pos.z = z; gitter.setze(id, x, z, radius); markiere(e); return id; }
    const neuId = neu({ id, art, team, pos: { x, y, z }, radius, leben: lb, lebenMax, name, daten: daten || {} });
    map.get(neuId).lebt = lb > 0;
    return neuId;
  }

  return {
    neu, hole: (id) => map.get(id) || null, entferne, bewege, aendere, leben, belebe, imUmkreis, naechster, kompakt, aenderungenSeit,
    markiere: (id) => { const e = map.get(id); return e ? markiere(e) : null; },
    /** Netz-Delta anwenden (Gegenstück zu aenderungenSeit). */
    wende(delta) { for (const k of delta.geaendert || []) ausKompakt(k); for (const id of delta.weg || []) entferne(id); },
    alle: () => [...map.values()],
    get anzahl() { return map.size; },
    get takt() { return takt; },
    zustand: () => ({ n: naechste, t: takt, e: [...map.values()].map(kompakt) }),
    lade(z) {
      for (const id of [...map.keys()]) { map.delete(id); gitter.entferne(id); }
      wegLog.length = 0;
      naechste = z?.n || 1;
      for (const k of z?.e || []) ausKompakt(JSON.parse(JSON.stringify(k)));
      takt = Math.max(takt, z?.t || 0);
    },
    dispose() { map.clear(); wegLog.length = 0; gitter.dispose(); },
  };
}
