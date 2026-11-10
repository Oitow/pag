/**
 * @modul    stationen
 * @zweck    Stationen als Orte in der Welt (Werkbank, Feuerstelle, Amboss): wer steht an welcher Art Station, nächste Station, benutzen – das Ergebnis von beiWem() passt direkt in rezepte.pruefe(…, {stationen})
 * @api      createStationen({interaktion,ereignisse,reichweite,onBenutzt}) -> {neu(id,{art,pos,radius,reichweite,name,text,aktiv,daten})->station,entferne(id),hole(id),alle(),anzahl,setAktiv(id,an),beiWem(wer,aus?)->[art],naechste(wer,art?)->station|null,benutze(id,wer)->bool,zustand(),lade(stand),dispose()}
 * @beispiel
 *   import { createStationen } from '../../engine/gameplay/stationen.js';
 *   const stationen = createStationen({ interaktion, ereignisse });
 *   stationen.neu('tisch-1', { art: 'werkbank', pos: { x: 4, z: 7 } });
 *   const p = rezepte.pruefe('tisch', inventar, { stationen: stationen.beiWem(spieler) });
 * @tags     station, werkbank, feuerstelle, amboss, herstellen, crafting, ort, gameplay
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * station = { id, art, name, pos {x,y?,z}, radius, reichweite, aktiv, daten }. wer = { x, y?, z }.
 * In Reichweite: aktiv, Rand-Abstand (Mittelpunkt − radius, min 0) ≤ reichweite, Höhe |dy| ≤ 2.5 (nur wenn beide y endlich).
 * beiWem() liefert die verschiedenen Arten als Array (darf per `aus` wiederverwendet werden, dann kein Müll pro Bild).
 * Mit `interaktion` wird jede Station als Ziel 'station:<id>' gemeldet (Hinweistext, Aktion = benutze); inaktiv = Ziel nicht aktiv.
 * Ereignis: 'station:benutzt' { station, wer }. zustand()/lade() sichern nur den Aktiv-Zustand ({id: 0|1}).
 */

const HOEHE = 2.5;

export function createStationen({ interaktion = null, ereignisse = null, reichweite = 2.5, onBenutzt = null } = {}) {
  const map = new Map();

  function neu(id, { art, pos, radius = 0.6, reichweite: r, name = art, text = null, aktiv = true, daten = null } = {}) {
    if (typeof id !== 'string' || !id) throw new Error(`station: ungültige id (${String(id)})`);
    if (typeof art !== 'string' || !art) throw new Error(`station '${id}': art fehlt`);
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.z)) throw new Error(`station '${id}': pos {x,z} fehlt`);
    if (map.has(id)) throw new Error(`station '${id}' existiert bereits`);
    const s = { id, art, name, pos: { x: pos.x, y: pos.y, z: pos.z }, radius, reichweite: r ?? reichweite, aktiv: !!aktiv, daten };
    map.set(id, s);
    interaktion?.melde('station:' + id, {
      pos: s.pos, radius, reichweite: s.reichweite, art: 'station', text: text ?? `${name} benutzen`,
      aktiv: () => s.aktiv, daten: { id, art }, aktion: (wer) => benutze(id, wer),
    });
    return s;
  }

  function entferne(id) {
    if (!map.delete(id)) return false;
    interaktion?.entferne('station:' + id);
    return true;
  }

  function setAktiv(id, an) {
    const s = map.get(id);
    if (!s) return false;
    s.aktiv = !!an;
    return true;
  }

  function inReichweite(s, wer) {
    if (!s.aktiv) return -1;
    if (Number.isFinite(wer.y) && Number.isFinite(s.pos.y) && Math.abs(wer.y - s.pos.y) > HOEHE) return -1;
    const d = Math.max(0, Math.hypot(wer.x - s.pos.x, wer.z - s.pos.z) - s.radius);
    return d <= s.reichweite ? d : -1;
  }

  function beiWem(wer, aus = []) {
    aus.length = 0;
    for (const s of map.values()) if (inReichweite(s, wer) >= 0 && !aus.includes(s.art)) aus.push(s.art);
    return aus;
  }

  function naechste(wer, art = null) {
    let best = null, bd = Infinity;
    for (const s of map.values()) {
      if (art && s.art !== art) continue;
      const d = inReichweite(s, wer);
      if (d >= 0 && d < bd) { bd = d; best = s; }
    }
    return best;
  }

  function benutze(id, wer) {
    const s = map.get(id);
    if (!s || !s.aktiv) return false;
    ereignisse?.sende('station:benutzt', { station: s, wer });
    onBenutzt?.(s, wer);
    return true;
  }

  function zustand() {
    const o = {};
    for (const s of map.values()) o[s.id] = s.aktiv ? 1 : 0;
    return o;
  }

  function lade(stand) {
    for (const [id, v] of Object.entries(stand || {})) setAktiv(id, !!v);
  }

  return {
    neu, entferne, setAktiv, beiWem, naechste, benutze, zustand, lade,
    hole: (id) => map.get(id),
    alle: () => [...map.values()],
    get anzahl() { return map.size; },
    dispose() {
      if (interaktion) for (const id of map.keys()) interaktion.entferne('station:' + id);
      map.clear();
    },
  };
}
