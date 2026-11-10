/**
 * @modul    behaelter
 * @zweck    Behälter in der Welt (Truhe, Fass, Schrank): eigenes Inventar, öffnen/schließen je Figur, Schloss mit Schlüssel, Ablegen/Entnehmen, Speichern
 * @api      createBehaelter({register,interaktion,ereignisse,reichweite,plaetze}) -> {neu(id,{pos,plaetze,name,inhalt,radius,schluessel,daten})->behaelter,entferne(id)->[{id,anzahl,daten}],hole(id),alle(),anzahl,oeffne(id,wer)->{ok,grund},schliesse(wer)->bool,offen(wer)->behaelter|null,pruefe(wer)->behaelter|null,lege(wer,platz,anzahl?)->bewegt,nimm(wer,platz,anzahl?)->bewegt,nimmAlles(wer)->bewegt,zustand(),lade(stand),dispose()}
 * @beispiel
 *   import { createBehaelter } from '../../engine/gameplay/behaelter.js';
 *   const kisten = createBehaelter({ register: gegenstaende, interaktion, ereignisse });
 *   kisten.neu('truhe-1', { pos: { x: 4, z: 7 }, inhalt: [{ id: 'gold', anzahl: 5 }], schluessel: 'schluessel' });
 *   // E-Taste löst über die Interaktion oeffne() aus; je Bild: kisten.pruefe(spieler);
 *   kisten.nimmAlles(spieler); kisten.schliesse(spieler);
 * @tags     behaelter, truhe, fass, schrank, lager, schluessel, inventar, gameplay, speichern
 * @version  1.0.0
 * @status   entwurf
 * @three    nein
 *
 * behaelter = { id, name, pos, radius, inventar, schluessel, verschlossen, offenFuer (wer | null), daten }.
 * wer = dasselbe Objekt wie bei der Interaktion: { x, y?, z, inventar, … }. Eine Figur hat höchstens einen Behälter offen
 * (ein neues oeffne schließt den alten); ein Behälter ist nur für eine Figur offen (sonst grund 'besetzt').
 * grund: null | 'unbekannt' | 'verschlossen' | 'besetzt' | 'weit' ('weit' nur geprüft, wenn wer.x/wer.z endlich sind).
 * Schloss: Hat wer den `schluessel` (Gegenstand-id) im Inventar, wird dauerhaft aufgeschlossen; der Schlüssel bleibt erhalten.
 * Mit `interaktion`: je Behälter ein Ziel 'behaelter:<id>' (art 'behaelter', text '<name> öffnen').
 * Ereignisse: 'behaelter:offen' | 'behaelter:zu' | 'behaelter:verschlossen' { behaelter, wer }.
 * Speicherformat zustand(): { [id]: { inv: inventar.zustand(), zu: bool } } (zu = noch verschlossen). lade() nimmt nur dieses Format,
 * ignoriert unbekannte ids und lässt offene Behälter offen.
 */
import { createInventar, uebertrage } from './inventar.js';

export function createBehaelter({
  register = null, interaktion = null, ereignisse = null, reichweite = 3, plaetze = 12,
} = {}) {
  const liste = new Map();
  const offenVon = new Map(); // wer -> behaelter

  const sende = (name, daten) => { if (ereignisse) ereignisse.sende(name, daten); };
  const zielId = (id) => 'behaelter:' + id;
  const endlich = (n) => typeof n === 'number' && Number.isFinite(n);

  function neu(id, { pos = { x: 0, z: 0 }, plaetze: n = plaetze, name = 'Truhe', inhalt = null,
    radius = 0.5, schluessel = null, daten = null } = {}) {
    if (typeof id !== 'string' || !id) throw new Error(`behaelter: ungültige id (${String(id)})`);
    if (liste.has(id)) throw new Error(`behaelter '${id}' ist bereits angelegt`);
    const b = {
      id, name, pos: { ...pos }, radius,
      inventar: createInventar({ plaetze: n, register, name: id }),
      schluessel, verschlossen: !!schluessel, offenFuer: null, daten,
    };
    for (const e of inhalt || []) b.inventar.gib(e.id, e.anzahl ?? 1, e.daten);
    liste.set(id, b);
    if (interaktion) {
      interaktion.melde(zielId(id), {
        pos: b.pos, radius, art: 'behaelter', text: `${name} öffnen`, daten: { id },
        aktion: (wer) => oeffne(id, wer),
      });
    }
    return b;
  }

  function entferne(id) {
    const b = liste.get(id);
    if (!b) return [];
    if (b.offenFuer) schliesse(b.offenFuer);
    const inhalt = [];
    for (const s of b.inventar.plaetze) if (s) inhalt.push({ id: s.id, anzahl: s.anzahl, ...(s.daten ? { daten: s.daten } : {}) });
    if (interaktion?.hat(zielId(id))) interaktion.entferne(zielId(id));
    b.inventar.dispose();
    liste.delete(id);
    return inhalt;
  }

  function oeffne(id, wer) {
    const b = liste.get(id);
    if (!b || !wer) return { ok: false, grund: 'unbekannt' };
    if (b.offenFuer === wer) return { ok: true, grund: null };
    if (b.offenFuer) return { ok: false, grund: 'besetzt' };
    if (endlich(wer.x) && endlich(wer.z) && abstand(b, wer) > reichweite + b.radius) return { ok: false, grund: 'weit' };
    if (b.verschlossen) {
      if (b.schluessel && wer.inventar?.hat(b.schluessel, 1)) b.verschlossen = false;
      else { sende('behaelter:verschlossen', { behaelter: b, wer }); return { ok: false, grund: 'verschlossen' }; }
    }
    if (offenVon.has(wer)) schliesse(wer);
    b.offenFuer = wer;
    offenVon.set(wer, b);
    sende('behaelter:offen', { behaelter: b, wer });
    return { ok: true, grund: null };
  }

  function schliesse(wer) {
    const b = offenVon.get(wer);
    if (!b) return false;
    offenVon.delete(wer);
    b.offenFuer = null;
    sende('behaelter:zu', { behaelter: b, wer });
    return true;
  }

  const offen = (wer) => offenVon.get(wer) ?? null;

  function abstand(b, wer) { return Math.hypot(wer.x - b.pos.x, wer.z - b.pos.z); }

  function pruefe(wer) {
    const b = offenVon.get(wer);
    if (!b) return null;
    if (endlich(wer.x) && endlich(wer.z) && abstand(b, wer) > reichweite + b.radius) { schliesse(wer); return null; }
    return b;
  }

  function lege(wer, platz, anzahl) {
    const b = offenVon.get(wer);
    if (!b || !wer.inventar) return 0;
    return uebertrage(wer.inventar, platz, b.inventar, anzahl);
  }

  function nimm(wer, platz, anzahl) {
    const b = offenVon.get(wer);
    if (!b || !wer.inventar) return 0;
    return uebertrage(b.inventar, platz, wer.inventar, anzahl);
  }

  function nimmAlles(wer) {
    const b = offenVon.get(wer);
    if (!b || !wer.inventar) return 0;
    let summe = 0;
    for (let i = 0; i < b.inventar.plaetze.length; i++) summe += uebertrage(b.inventar, i, wer.inventar);
    return summe;
  }

  function zustand() {
    const z = {};
    for (const [id, b] of liste) z[id] = { inv: b.inventar.zustand(), zu: b.verschlossen };
    return z;
  }

  function lade(stand) {
    if (!stand || typeof stand !== 'object') return;
    for (const [id, e] of Object.entries(stand)) {
      const b = liste.get(id);
      if (!b || !e || typeof e !== 'object') continue;
      b.inventar.lade(e.inv);
      b.verschlossen = !!b.schluessel && !!e.zu;
    }
  }

  function dispose() {
    for (const id of [...liste.keys()]) entferne(id);
    offenVon.clear();
  }

  return {
    neu, entferne, oeffne, schliesse, offen, pruefe, lege, nimm, nimmAlles, zustand, lade, dispose,
    hole: (id) => liste.get(id) ?? null,
    alle: () => [...liste.values()],
    get anzahl() { return liste.size; },
  };
}
